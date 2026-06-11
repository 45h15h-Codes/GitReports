/**
 * Report routes (PRD §7.2, §10.2)
 *
 * POST /reports/generate — Sprint D.3 fully async pipeline:
 *   Validates → checks idempotency → enqueues to BullMQ → returns 202.
 *   No ingestion or aggregation in the HTTP handler.
 *   The reportWorker handles the full pipeline asynchronously.
 *   SSE endpoint /reports/:period/stream provides real-time status updates.
 *
 * GET /reports
 *   Returns metadata list for all reports owned by the authenticated user.
 *
 * GET /reports/:period
 *   Returns the full report (payload + narrative) for the owner.
 *
 * GET /reports/:period/stream
 *   SSE for real-time narrative generation status.
 *
 * DELETE /reports/:period
 *   Deletes the report. GDPR §9.1.
 *
 * PUT /reports/:period/visibility
 *   Toggle isPublic.
 *
 * GET /public/u/:username/:period
 *   Public report surface — no auth required. Private repos stripped server-side.
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../lib/auth";
import {
  assembleOwnerReport,
  assemblePublicReport,
  assembleReportListItem,
} from "../services/report/assembler";
import type { Report } from "../db/schema";
import { getReportQueue } from "../workers/reportWorker";
import { db } from "../db/client";
import { challengeLinks, reports, users, achievements } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { generateReportPdf } from "../services/pdf/reportPdf";
import type { AiPayload } from "../services/aggregation/types";
import { ACHIEVEMENT_DEFINITIONS } from "../services/achievements/definitions";

// ── Service layer imports (D.4) ───────────────────────────────────────────────
import {
  findReport,
  findReportStatus,
  listReports,
  deleteReport,
  setReportVisibility,
  findPublicReport,
} from "../services/ReportService";
import { getPublicUserByUsername, getPublicProfile } from "../services/UserService";

// ── Period validation ─────────────────────────────────────────────────────────

const PERIOD_REGEX = /^(\d{4}|\d{4}-(0[1-9]|1[0-2]))$/;

function isValidPeriod(period: string): boolean {
  return PERIOD_REGEX.test(period);
}

/** Previous complete month in 'YYYY-MM' format (default for new requests) */
function previousMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /reports/generate — Sprint D.3 fully async ───────────────────────
  // Validate → idempotency check → enqueue → return 202.
  // All heavy lifting done in reportWorker (ingestion, aggregation, upsert).

  fastify.post<{
    Body: { period?: string; include_private?: boolean };
  }>(
    "/reports/generate",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const userId = req.session.userId!;
      const period = req.body?.period ?? previousMonth();

      if (!isValidPeriod(period)) {
        return reply
          .status(400)
          .send({ error: "Invalid period format. Use YYYY-MM." });
      }

      // Future period guard
      const [reqYear, reqMonth] = period.split("-").map(Number);
      const now = new Date();
      if (
        reqYear! > now.getFullYear() ||
        (reqYear === now.getFullYear() && reqMonth! >= now.getMonth() + 1)
      ) {
        return reply.status(400).send({
          error: "Cannot generate reports for the current or a future month.",
        });
      }

      // Idempotency: return cached complete report immediately (no re-enqueue)
      const existing = await findReport(userId, period);
      if (existing && existing.narrativeStatus === "complete") {
        return reply.status(200).send({
          report:  assembleOwnerReport(existing as unknown as Report),
          cached:  true,
          queued:  false,
        });
      }

      // If already in-flight, just acknowledge (don't double-enqueue)
      if (
        existing &&
        (existing.narrativeStatus === "pending" ||
          existing.narrativeStatus === "generating")
      ) {
        return reply.status(202).send({
          status: "in_progress",
          period,
          queued: false,
        });
      }

      // Enqueue to report-generation queue (idempotent job ID per user+period)
      const queue = getReportQueue();
      await queue.add(
        "generate-report",
        {
          userId,
          period,
          includePrivate: req.body?.include_private === true,
        },
        {
          jobId:    `report:${userId}:${period}`,
          attempts: 3,
          backoff:  { type: "exponential", delay: 5000 },
        },
      );

      return reply.status(202).send({
        status: "queued",
        period,
        queued: true,
      });
    },
  );

  // ── GET /reports ───────────────────────────────────────────────────────────

  fastify.get("/reports", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.userId!;
    const rows = await listReports(userId);
    return reply.send({
      reports: rows.map((r) => assembleReportListItem(r as unknown as Report)),
    });
  });

  // ── GET /reports/:period ───────────────────────────────────────────────────

  fastify.get<{
    Params: { period: string };
  }>("/reports/:period", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.userId!;
    const { period } = req.params;

    if (!isValidPeriod(period)) {
      return reply
        .status(400)
        .send({ error: "Invalid period format. Use YYYY-MM." });
    }

    const row = await findReport(userId, period);

    if (!row) {
      return reply
        .status(404)
        .send({ error: "Report not found for this period." });
    }

    return reply.send({
      report: assembleOwnerReport(row as unknown as Report),
    });
  });

  // ── GET /reports/:period/stream ────────────────────────────────────────────
  // Server-Sent Events (SSE) for real-time report + narrative status.

  fastify.get<{
    Params: { period: string };
  }>(
    "/reports/:period/stream",
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.session.userId!;
      const { period } = req.params;

      if (!isValidPeriod(period)) {
        return reply
          .status(400)
          .send({ error: "Invalid period format. Use YYYY-MM." });
      }

      const origin = req.headers.origin ?? process.env.FRONTEND_URL ?? "http://localhost:5173";

      reply.hijack();
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("Access-Control-Allow-Origin", origin);
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
      reply.raw.flushHeaders();

      const interval = setInterval(async () => {
        try {
          const row = await findReportStatus(userId, period);

          if (!row) {
            // Report not yet created (worker hasn't run) — keep polling
            reply.raw.write(
              `data: ${JSON.stringify({ narrativeStatus: "queued" })}\n\n`,
            );
            return;
          }

          const payload = {
            narrativeStatus: row.narrativeStatus,
            ...(row.narrativeStatus === "complete"
              ? { narrative: row.narrative }
              : {}),
          };

          reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);

          if (
            row.narrativeStatus === "complete" ||
            row.narrativeStatus === "failed"
          ) {
            clearInterval(interval);
            reply.raw.end();
          }
        } catch {
          clearInterval(interval);
          reply.raw.end();
        }
      }, 2000);

      req.raw.on("close", () => {
        clearInterval(interval);
      });
    },
  );

  // ── DELETE /reports/:period ────────────────────────────────────────────────

  fastify.delete<{
    Params: { period: string };
  }>("/reports/:period", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.userId!;
    const { period } = req.params;

    if (!isValidPeriod(period)) {
      return reply
        .status(400)
        .send({ error: "Invalid period format. Use YYYY-MM." });
    }

    const deleted = await deleteReport(userId, period);

    if (!deleted) {
      return reply
        .status(404)
        .send({ error: "Report not found for this period." });
    }

    return reply.send({ deleted: true, period });
  });

  // ── PUT /reports/:period/visibility ────────────────────────────────────────

  fastify.put<{
    Params: { period: string };
    Body: { isPublic: boolean };
  }>(
    "/reports/:period/visibility",
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.session.userId!;
      const { period } = req.params;
      const { isPublic } = req.body ?? {};

      if (!isValidPeriod(period)) {
        return reply
          .status(400)
          .send({ error: "Invalid period format. Use YYYY-MM." });
      }

      if (typeof isPublic !== "boolean") {
        return reply
          .status(400)
          .send({ error: "Body must include isPublic (boolean)." });
      }

      const updated = await setReportVisibility(userId, period, isPublic);

      if (!updated) {
        return reply
          .status(404)
          .send({ error: "Report not found for this period." });
      }

      return reply.send({ updated: true, period, isPublic: updated.isPublic });
    },
  );

  // ── GET /public/u/:username/:period ────────────────────────────────────────

  fastify.get<{
    Params: { username: string; period: string };
  }>("/public/u/:username/:period", async (req, reply) => {
    const { username, period } = req.params;

    if (!isValidPeriod(period)) {
      return reply.status(400).send({ error: "Invalid period format." });
    }

    const user = await getPublicUserByUsername(username);
    if (!user) return reply.status(404).send({ error: "User not found." });

    const row = await findPublicReport(user.id, period);
    if (!row) {
      return reply
        .status(404)
        .send({ error: "Report not found or is private." });
    }

    return reply.send({
      user: {
        username:    user.username,
        displayName: user.displayName,
        avatarUrl:   user.avatarUrl,
      },
      report: assemblePublicReport(row as unknown as Report),
    });
  });
  // ── POST /challenges — create challenge link (PRD §7.8 P1) ────────────────
  // Authenticated user creates a challenge pointing at a target username.
  // Inserts into challenge_links, then fires a challenge-received email
  // to the challenged user (fire-and-forget — never fails the request).

  fastify.post<{
    Body: { period: string; challengedUsername?: string; challengerStats?: Record<string, unknown> };
  }>(
    "/challenges",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: { max: 20, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const challengerUserId = req.session.userId!;
      const { period, challengedUsername, challengerStats = {} } = req.body ?? {};

      if (!period || !isValidPeriod(period)) {
        return reply
          .status(400)
          .send({ error: "Invalid or missing period. Use YYYY-MM." });
      }

      // Generate a URL-safe token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(challengeLinks).values({
        token,
        challengerUserId,
        period,
        challengerStats,
        expiresAt,
      });

      // Resolve challenger username from DB (session only stores userId)
      const challengerRow = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, challengerUserId))
        .limit(1)
        .then(r => r[0]);
      
      const challengerUsername = challengerRow?.username ?? "Someone";

      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      // In App.tsx the route is /challenge/:username/:period
      const challengeUrl = `${frontendUrl}/challenge/${challengerUsername}/${period}`;

      // Fire challenge-received email — P1, fire-and-forget
      try {
        const { sendChallengeReceivedEmail } = await import("../lib/email");

        if (challengedUsername) {
          const challengedUser = await db
            .select({ email: users.email, displayName: users.displayName })
            .from(users)
            .where(eq(users.username, challengedUsername))
            .limit(1)
            .then(r => r[0]);

          if (challengedUser?.email) {
            // challengerUsername already resolved above

            await sendChallengeReceivedEmail({
              to:                 challengedUser.email,
              displayName:        challengedUser.displayName ?? challengedUsername,
              challengerUsername,
              period,
              challengeUrl,
            });
          }
        }
      } catch (emailErr) {
        console.error("[challenge] Failed to send challenge email:", emailErr);
      }

      return reply.status(201).send({ token, challengeUrl });
    },
  );

  // ── PDF export — PRD §7.5 ─────────────────────────────────────────────────
  // Public-data-only. Private repos filtered server-side before PDF generation.
  // No auth required — public reports are exportable by anyone.
  fastify.get<{ Params: { username: string; period: string } }>(
    '/reports/export/:username/:period',
    {
      config: { rateLimit: { max: 10, timeWindow: 60_000 } },
      schema: {
        params: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            period:   { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
          },
          required: ['username', 'period'],
        },
      },
    },
    async (req, reply) => {
      const { username, period } = req.params

      // Look up user
      const userRow = await db
        .select({
          id:          users.id,
          username:    users.username,
          displayName: users.displayName,
          avatarUrl:   users.avatarUrl,
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1)
        .then(r => r[0])

      if (!userRow) {
        return reply.status(404).send({ error: 'User not found' })
      }

      const isOwner = req.session?.userId === userRow.id;

      // Look up report — must be public, OR requester must be the owner
      const reportRow = await db
        .select({
          payload:         reports.payload,
          narrative:       reports.narrative,
          isPublic:        reports.isPublic,
          narrativeStatus: reports.narrativeStatus,
        })
        .from(reports)
        .where(
          and(
            eq(reports.userId,   userRow.id),
            eq(reports.period,   period),
          ),
        )
        .limit(1)
        .then(r => r[0])

      if (!reportRow || (!reportRow.isPublic && !isOwner)) {
        return reply.status(404).send({ error: 'Report not found or not public' })
      }

      if (reportRow.narrativeStatus !== 'complete') {
        return reply.status(409).send({ error: 'Report is not yet complete' })
      }

      const payload = reportRow.payload as AiPayload

      // PRD §4.4 — filter private repos before ANY data enters PDF, unless owner
      const finalPayload: AiPayload = isOwner
        ? payload
        : {
            ...payload,
            repos: payload.repos.filter(r => r.is_public),
          }

      // Auto-filename — PRD §7.5
      const filename = `gitreport-${username}-${period}.pdf`

      reply
        .header('Content-Type',        'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)

      const stream = generateReportPdf({
        username:    userRow.username,
        displayName: userRow.displayName ?? userRow.username,
        avatarUrl:   userRow.avatarUrl,
        payload:     finalPayload,
        narrative:   reportRow.narrative,
        isOwner,
      })

      return reply.send(stream)
    },
  )

  // ── GET /achievements ──────────────────────────────────────────────────────────────
  fastify.get(
    '/achievements',
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.session.userId!

      const earned = await db
        .select()
        .from(achievements)
        .where(eq(achievements.userId, userId))
        .orderBy(achievements.unlockedAt)

      const defMap = new Map(ACHIEVEMENT_DEFINITIONS.map(d => [d.id, d]))

      const result = earned.map(row => {
        const def = defMap.get(row.achievementId)
        return {
          achievementId: row.achievementId,
          title:         def?.title         ?? row.achievementId,
          description:   def?.description   ?? '',
          meta:          row.meta,
          unlockedAt:    row.unlockedAt,
          period:        row.period,
        }
      })

      return reply.send({ achievements: result })
    },
  )

  // ── GET /public/u/:username — public developer profile archive ────────────
  // PRD §7.6 Phase 3 — no auth required. Returns all public reports + achievements.
  fastify.get<{ Params: { username: string } }>(
    '/public/u/:username',
    {
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
      schema: {
        params: {
          type:       'object',
          properties: { username: { type: 'string' } },
          required:   ['username'],
        },
      },
    },
    async (req, reply) => {
      const { username } = req.params
      const profile = await getPublicProfile(username)
      if (!profile) {
        return reply.status(404).send({ error: 'User not found' })
      }
      return reply.send(profile)
    },
  )
};

export default reportRoutes;
