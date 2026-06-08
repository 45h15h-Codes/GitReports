/**
 * Report assembler (PRD §10.2 — Report object assembly)
 *
 * Composes the final client-facing report object from:
 *   - A database report row (payload JSONB + narrative + metadata)
 *   - A visibility context (owner vs. public surface)
 *
 * Design rules:
 *   - Owner view: full payload including private repo aggregates
 *   - Public view: payload stripped of private repos (server-rendered absent)
 *   - Narrative included only when narrativeStatus === 'complete'
 *   - Never includes raw DB internals (e.g. userId, raw timestamps from ORM)
 *
 * This is the single authoritative place that shapes what the client receives.
 * All report route handlers must go through assembleOwnerReport() or assemblePublicReport().
 */

import type { Report } from '../../db/schema';
import type { AiPayload, RepoAggregate } from '../aggregation/types';

// ── Output types ──────────────────────────────────────────────────────────────

/**
 * The report object returned to an authenticated owner.
 * Contains full payload (including private repo aggregates).
 */
export interface OwnerReport {
  id:              number;
  period:          string;
  payloadVersion:  number;
  payload:         AiPayload;
  narrative:       string | null;
  narrativeStatus: string;
  persona:         string | null;
  focusScore:      string | null;
  isPublic:        boolean;
  generatedAt:     Date;
  updatedAt:       Date;
}

/**
 * The report object returned on public surfaces (shared report page, challenge page).
 * Private repos are absent from payload — not hidden, not null, just absent.
 * PRD §9.2: "zero private data in DOM — server-rendered absent, not CSS-hidden"
 */
export interface PublicReport {
  period:          string;
  payloadVersion:  number;
  payload:         Omit<AiPayload, 'repos'> & { repos: RepoAggregate[] };
  narrative:       string | null;
  narrativeStatus: string;
  persona:         string | null;
  focusScore:      string | null;
  generatedAt:     Date;
}

/**
 * A lightweight summary row for the reports list view.
 * Does NOT include the full payload or narrative text.
 */
export interface ReportListItem {
  id:              number;
  period:          string;
  persona:         string | null;
  focusScore:      string | null;
  narrativeStatus: string;
  isPublic:        boolean;
  generatedAt:     Date;
}

// ── Assemblers ────────────────────────────────────────────────────────────────

/**
 * Assemble the full owner-facing report from a DB row.
 * The owner sees their full payload including private repo aggregates.
 */
export function assembleOwnerReport(row: Report): OwnerReport {
  return {
    id:              row.id,
    period:          row.period,
    payloadVersion:  row.payloadVersion,
    payload:         row.payload as unknown as AiPayload,
    narrative:       row.narrative,
    narrativeStatus: row.narrativeStatus,
    persona:         row.persona,
    focusScore:      row.focusScore,
    isPublic:        row.isPublic,
    generatedAt:     row.generatedAt,
    updatedAt:       row.updatedAt,
  };
}

/**
 * Assemble the public-facing report from a DB row.
 * Private repos are stripped from the payload at the assembler level —
 * they never reach the serialisation layer, so they cannot appear in the DOM.
 */
export function assemblePublicReport(row: Report): PublicReport {
  const rawPayload = row.payload as unknown as AiPayload;

  // Strip private repos — server-rendered absent (PRD §9.2)
  const publicRepos: RepoAggregate[] = rawPayload.repos.filter(
    (r: RepoAggregate) => r.is_public === true,
  );

  const publicPayload: AiPayload = {
    ...rawPayload,
    repos: publicRepos,
  };

  return {
    period:          row.period,
    payloadVersion:  row.payloadVersion,
    payload:         publicPayload,
    narrative:       row.narrative,
    narrativeStatus: row.narrativeStatus,
    persona:         row.persona,
    focusScore:      row.focusScore,
    generatedAt:     row.generatedAt,
  };
}

/**
 * Assemble a lightweight list item for the reports list view.
 * Excludes the full payload and narrative — reduces response size.
 */
export function assembleReportListItem(row: Report): ReportListItem {
  return {
    id:              row.id,
    period:          row.period,
    persona:         row.persona,
    focusScore:      row.focusScore,
    narrativeStatus: row.narrativeStatus,
    isPublic:        row.isPublic,
    generatedAt:     row.generatedAt,
  };
}
