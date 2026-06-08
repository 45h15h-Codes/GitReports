/**
 * Report routes (PRD §7.2, §10.2)
 *
 * POST /reports/generate
 *   Triggers full aggregation pipeline for the authenticated user + period.
 *   Enqueues async narrative generation via BullMQ.
 *   Rate limited: 10 req/user/min (PRD §9.3).
 *
 * GET /reports
 *   Returns metadata list for all reports owned by the authenticated user.
 *   No payload or narrative in the list — lightweight for dashboard sidebar.
 *
 * GET /reports/:period
 *   Returns the full report (payload + narrative) for the owner.
 *   Period format: 'YYYY-MM' (e.g. '2025-04').
 *
 * GET /reports/:period/status
 *   Lightweight poll endpoint for narrative generation status.
 *   Returns { narrativeStatus, narrative? } — used by the dashboard to poll
 *   while the LLM worker is running in the background.
 *
 * DELETE /reports/:period
 *   Deletes the report for the given period. Allows the user to regenerate.
 *   Stored payload (longitudinal data) is also deleted — GDPR compliance.
 *
 * PUT /reports/:period/visibility
 *   Toggle isPublic on a report. Body: { isPublic: boolean }.
 *   Governs whether the report appears on public surfaces (PRD §4.4).
 *
 * GET /public/u/:username/:period
 *   Public report surface — no auth required.
 *   Private repo data is absent from payload (server-rendered, not CSS-hidden).
 *   PRD §9.2: zero private data in DOM on public surfaces.
 */

import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { users, reports } from "../db/schema";
import { requireAuth } from "../lib/auth";
import { decryptToken } from "../lib/crypto";
import { ingestMonthlyData } from "../services/aggregation/ingestion";
import { aggregateMonthlyData } from "../services/aggregation/engine";
import type { PrevPeriodSummary } from "../services/aggregation/types";
import { getNarrativeQueue } from "../workers/narrativeWorker";
import {
  assembleOwnerReport,
  assemblePublicReport,
  assembleReportListItem,
} from "../services/report/assembler";
import type { Report } from "../db/schema";

// ── Period validation ─────────────────────────────────────────────────────────

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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
  // ── POST /reports/generate ─────────────────────────────────────────────────

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
      const userId = req.session.get("userId")!;
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

      // Return existing complete report (idempotent GET-like behaviour)
      const [existing] = await db
        .select()
        .from(reports)
        .where(and(eq(reports.userId, userId), eq(reports.period, period)))
        .limit(1);

      if (existing && existing.narrativeStatus === "complete") {
        return reply.send({
          report: assembleOwnerReport(existing as unknown as Report),
          cached: true,
        });
      }

      // Fetch user + decrypt GitHub token
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          accessToken: users.accessToken,
          tokenScope: users.tokenScope,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) return reply.status(401).send({ error: "User not found" });

      const plainToken = decryptToken(user.accessToken);
      const includePrivate =
        req.body?.include_private === true && user.tokenScope.includes("repo");

      // Fetch previous period payload for longitudinal narrative context (PRD §6.1)
      const prevPeriod = getPrevPeriod(period);
      const prevPeriodSummary = await fetchPrevPeriodSummary(
        userId,
        prevPeriod,
      );

      // Run GitHub data ingestion
      const ingestion = await ingestMonthlyData(
        plainToken,
        user.username,
        period,
        { includePrivate },
      );

      if (ingestion.rateLimitHit && ingestion.repos.length === 0) {
        return reply.status(503).send({
          error:
            "GitHub API rate limit reached. Please retry after the reset time.",
          rateLimitReset: ingestion.rateLimitReset,
        });
      }

      // Assemble the structured AI payload via the aggregation engine
      const payload = aggregateMonthlyData({
        username: user.username,
        period,
        repos: ingestion.repos,
        prevPeriodSummary,
      });

      // Upsert report row
      // Delete existing (pending/failed) before insert — Drizzle 0.30 composite unique workaround
      await db
        .delete(reports)
        .where(and(eq(reports.userId, userId), eq(reports.period, period)));

      const [report] = await db
        .insert(reports)
        .values({
          userId,
          period,
          payloadVersion: payload.payload_version,
          payload: payload as unknown as Record<string, unknown>,
          narrativeStatus: "pending",
          persona: payload.developer_persona,
          focusScore: String(payload.focus_score),
          isPublic: true,
        })
        .returning();

      // Enqueue async LLM narrative generation
      // The worker picks this up, calls Claude Haiku, and updates the row.
      // Non-fatal: report is still useful without narrative — UI shows placeholder.
      try {
        const queue = getNarrativeQueue();
        await queue.add(
          "generate-narrative",
          { reportId: report!.id, payload },
          { jobId: `narrative:${report!.id}` }, // idempotent — dedup by reportId
        );
      } catch (queueErr) {
        req.log.error(
          { err: queueErr },
          "[reports] Failed to enqueue narrative job",
        );
      }

      return reply.status(201).send({
        report: assembleOwnerReport(report! as unknown as Report),
        cached: false,
        rateLimitHit: ingestion.rateLimitHit,
        reposProcessed: ingestion.repos.length,
        reposSkipped: ingestion.reposSkipped,
      });
    },
  );

  // ── GET /reports ───────────────────────────────────────────────────────────

  fastify.get("/reports", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.get("userId")!;

    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.period));

    return reply.send({
      reports: rows.map((r) => assembleReportListItem(r as unknown as Report)),
    });
  });

  // ── GET /reports/:period ───────────────────────────────────────────────────

  fastify.get<{
    Params: { period: string };
  }>("/reports/:period", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.get("userId")!;
    const { period } = req.params;

    if (!isValidPeriod(period)) {
      return reply
        .status(400)
        .send({ error: "Invalid period format. Use YYYY-MM." });
    }

    const [row] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, period)))
      .limit(1);

    if (!row) {
      return reply
        .status(404)
        .send({ error: "Report not found for this period." });
    }

    return reply.send({
      report: assembleOwnerReport(row as unknown as Report),
    });
  });

  // ── GET /reports/:period/status ────────────────────────────────────────────
  // Lightweight poll endpoint for narrative generation status.
  // The dashboard polls this until narrativeStatus === 'complete' or 'failed'.

  fastify.get<{
    Params: { period: string };
  }>(
    "/reports/:period/status",
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.session.get("userId")!;
      const { period } = req.params;

      if (!isValidPeriod(period)) {
        return reply
          .status(400)
          .send({ error: "Invalid period format. Use YYYY-MM." });
      }

      const [row] = await db
        .select({
          narrativeStatus: reports.narrativeStatus,
          narrative: reports.narrative,
        })
        .from(reports)
        .where(and(eq(reports.userId, userId), eq(reports.period, period)))
        .limit(1);

      if (!row) {
        return reply
          .status(404)
          .send({ error: "Report not found for this period." });
      }

      return reply.send({
        narrativeStatus: row.narrativeStatus,
        // Include narrative text only once complete — avoids streaming partial text
        ...(row.narrativeStatus === "complete"
          ? { narrative: row.narrative }
          : {}),
      });
    },
  );

  // ── DELETE /reports/:period ────────────────────────────────────────────────
  // Allows the user to delete a report (e.g. to regenerate it).
  // The stored payload (longitudinal data asset) is also deleted — GDPR §9.1.

  fastify.delete<{
    Params: { period: string };
  }>("/reports/:period", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.get("userId")!;
    const { period } = req.params;

    if (!isValidPeriod(period)) {
      return reply
        .status(400)
        .send({ error: "Invalid period format. Use YYYY-MM." });
    }

    const deleted = await db
      .delete(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, period)))
      .returning({ id: reports.id });

    if (deleted.length === 0) {
      return reply
        .status(404)
        .send({ error: "Report not found for this period." });
    }

    return reply.send({ deleted: true, period });
  });

  // ── PUT /reports/:period/visibility ────────────────────────────────────────
  // Toggle whether the report appears on public surfaces.
  // PRD §4.4: private reports are absent from challenge, public profile, shared page.

  fastify.put<{
    Params: { period: string };
    Body: { isPublic: boolean };
  }>(
    "/reports/:period/visibility",
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.session.get("userId")!;
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

      const [updated] = await db
        .update(reports)
        .set({ isPublic, updatedAt: new Date() })
        .where(and(eq(reports.userId, userId), eq(reports.period, period)))
        .returning({ id: reports.id, isPublic: reports.isPublic });

      if (!updated) {
        return reply
          .status(404)
          .send({ error: "Report not found for this period." });
      }

      return reply.send({ updated: true, period, isPublic: updated.isPublic });
    },
  );

  // ── GET /public/u/:username/:period ────────────────────────────────────────
  // Public surface — no auth required.
  // Private repos are absent from payload (server-rendered, not CSS-hidden).
  // PRD §9.2: "zero private data in DOM on all non-owner surfaces"

  fastify.get<{
    Params: { username: string; period: string };
  }>("/public/u/:username/:period", async (req, reply) => {
    const { username, period } = req.params;

    if (!isValidPeriod(period)) {
      return reply.status(400).send({ error: "Invalid period format." });
    }

    // Resolve user
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) return reply.status(404).send({ error: "User not found." });

    // Find public report
    const [row] = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.userId, user.id),
          eq(reports.period, period),
          eq(reports.isPublic, true),
        ),
      )
      .limit(1);

    if (!row) {
      return reply
        .status(404)
        .send({ error: "Report not found or is private." });
    }

    return reply.send({
      user: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      report: assemblePublicReport(row as unknown as Report),
    });
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the previous calendar month as 'YYYY-MM' */
function getPrevPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const prev = new Date(year!, month! - 1, 1);
  prev.setMonth(prev.getMonth() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

/** Fetch the previous period's summary for longitudinal narrative context (PRD §6.1) */
async function fetchPrevPeriodSummary(
  userId: number,
  prevPeriod: string,
): Promise<PrevPeriodSummary | null> {
  const [prev] = await db
    .select({
      payload: reports.payload,
      persona: reports.persona,
      focusScore: reports.focusScore,
    })
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, prevPeriod)))
    .limit(1);

  if (!prev || !prev.payload) return null;

  const p = prev.payload as Record<string, unknown>;

  return {
    total_commits: (p["total_commits"] as number) ?? 0,
    focus_score: Number(prev.focusScore ?? 0),
    dominant_language: getDominantLanguage(
      p["languages"] as Record<string, number> | undefined,
    ),
    persona: (prev.persona as PrevPeriodSummary["persona"]) ?? "The Builder",
  };
}

function getDominantLanguage(
  languages?: Record<string, number>,
): string | null {
  if (!languages) return null;
  let top: string | null = null;
  let max = 0;
  for (const [lang, pct] of Object.entries(languages)) {
    if (pct > max) {
      max = pct;
      top = lang;
    }
  }
  return top;
}

export default reportRoutes;
