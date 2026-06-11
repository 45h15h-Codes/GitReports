/**
 * ReportService — data-access layer for the `reports` table.
 *
 * Route handlers must NOT write Drizzle queries directly.
 * All DB interactions for reports go through this service.
 *
 * Sprint D.4 — Extract service layer.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { reports } from '../db/schema';
import type { Report } from '../db/schema';
import type { AiPayload } from './aggregation/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpsertReportInput {
  userId:          number;
  period:          string;
  payloadVersion:  number;
  payload:         AiPayload;
  narrativeStatus: string;
  persona:         string;
  focusScore:      string;
  isPublic:        boolean;
}

// ── Report operations ─────────────────────────────────────────────────────────

/**
 * Find a report by (userId, period). Returns null if not found.
 */
export async function findReport(userId: number, period: string): Promise<Report | null> {
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, period)))
    .limit(1);
  return (row as Report) ?? null;
}

/**
 * Find a report for a specific status check — returns only status fields.
 */
export async function findReportStatus(
  userId: number,
  period: string,
): Promise<{ narrativeStatus: string; narrative: string | null } | null> {
  const [row] = await db
    .select({ narrativeStatus: reports.narrativeStatus, narrative: reports.narrative })
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, period)))
    .limit(1);
  return row ?? null;
}

/**
 * Find the previous period's summary fields for longitudinal context.
 */
export async function findPrevPeriodPartial(
  userId: number,
  period: string,
): Promise<{ payload: Record<string, unknown>; persona: string | null; focusScore: string | null } | null> {
  const [row] = await db
    .select({ payload: reports.payload, persona: reports.persona, focusScore: reports.focusScore })
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, period)))
    .limit(1);
  return row
    ? { payload: row.payload as Record<string, unknown>, persona: row.persona, focusScore: row.focusScore }
    : null;
}

/**
 * List all reports for a user — metadata only, no payload.
 */
export async function listReports(userId: number) {
  return db
    .select({
      id:              reports.id,
      period:          reports.period,
      narrativeStatus: reports.narrativeStatus,
      persona:         reports.persona,
      isPublic:        reports.isPublic,
      createdAt:       reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.period));
}

/**
 * Atomic upsert (insert or update on (userId, period) conflict).
 * Returns the upserted report row.
 */
export async function upsertReport(input: UpsertReportInput): Promise<Report> {
  const report = await db.transaction(async (tx) => {
    const [upserted] = await tx
      .insert(reports)
      .values({
        userId:          input.userId,
        period:          input.period,
        payloadVersion:  input.payloadVersion,
        payload:         input.payload as unknown as Record<string, unknown>,
        narrativeStatus: input.narrativeStatus,
        persona:         input.persona,
        focusScore:      input.focusScore,
        isPublic:        input.isPublic,
      })
      .onConflictDoUpdate({
        target: [reports.userId, reports.period],
        set: {
          payloadVersion:  input.payloadVersion,
          payload:         input.payload as unknown as Record<string, unknown>,
          narrativeStatus: input.narrativeStatus,
          persona:         input.persona,
          focusScore:      input.focusScore,
          isPublic:        input.isPublic,
          updatedAt:       new Date(),
        },
      })
      .returning();
    return upserted!;
  });
  return report as Report;
}

/**
 * Delete a report. Returns true if a row was deleted, false if not found.
 */
export async function deleteReport(userId: number, period: string): Promise<boolean> {
  const deleted = await db
    .delete(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, period)))
    .returning({ id: reports.id });
  return deleted.length > 0;
}

/**
 * Toggle isPublic on a report. Returns the updated record or null if not found.
 */
export async function setReportVisibility(
  userId:   number,
  period:   string,
  isPublic: boolean,
): Promise<{ id: number; isPublic: boolean } | null> {
  const [updated] = await db
    .update(reports)
    .set({ isPublic, updatedAt: new Date() })
    .where(and(eq(reports.userId, userId), eq(reports.period, period)))
    .returning({ id: reports.id, isPublic: reports.isPublic });
  return updated ?? null;
}

/**
 * Find a public report by username resolution.
 */
export async function findPublicReport(userId: number, period: string): Promise<Report | null> {
  const [row] = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.userId, userId),
        eq(reports.period, period),
        eq(reports.isPublic, true),
      ),
    )
    .limit(1);
  return (row as Report) ?? null;
}
