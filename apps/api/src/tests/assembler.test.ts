/**
 * Unit tests: report assembler (Sprint 4)
 *
 * Tests the three assembler functions that shape DB rows into client responses:
 *   - assembleOwnerReport: full payload, all fields
 *   - assemblePublicReport: private repos stripped from payload
 *   - assembleReportListItem: lightweight metadata only
 *
 * No network, DB, or external dependencies — pure data transformation tests.
 */

import { describe, it, expect } from "vitest";
import {
  assembleOwnerReport,
  assemblePublicReport,
  assembleReportListItem,
} from "../services/report/assembler";
import type { Report } from "../db/schema";
import type { AiPayload } from "../services/aggregation/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PAYLOAD: AiPayload = {
  payload_version: 1,
  period: "2025-04",
  total_commits: 100,
  active_days: 20,
  longest_streak: 10,
  current_streak: 3,
  repos: [
    {
      name_hash: "public_hash_0001",
      is_public: true,
      language: "TypeScript",
      commits: 80,
      lines_added: 2000,
      lines_deleted: 500,
      prs_merged: 8,
      category_signal: "feature_build",
    },
    {
      name_hash: "private_hash_0002",
      is_public: false, // private repo — must be stripped from public views
      language: "Python",
      commits: 20,
      lines_added: 400,
      lines_deleted: 100,
      prs_merged: 1,
      category_signal: "maintenance",
    },
  ],
  languages: { TypeScript: 80, Python: 20 },
  peak_hour_block: "evening",
  commit_size_dist: { tiny: 10, small: 60, medium: 20, large: 10 },
  focus_score: 0.72,
  developer_persona: "The Shipper",
  prev_period_summary: null,
};

const MOCK_ROW: Report = {
  id: 42,
  userId: 7,
  period: "2025-04",
  payloadVersion: 1,
  payload: PAYLOAD as unknown as Record<string, unknown>,
  narrative: "You shipped fast this month.",
  narrativeStatus: "complete",
  persona: "The Shipper",
  focusScore: "0.72",
  isPublic: true,
  generatedAt: new Date("2025-05-01T10:00:00Z"),
  createdAt: new Date("2025-05-01T10:00:00Z"),
  updatedAt: new Date("2025-05-01T10:05:00Z"),
};

// ── assembleOwnerReport ───────────────────────────────────────────────────────

describe("assembleOwnerReport", () => {
  it("includes all required fields", () => {
    const report = assembleOwnerReport(MOCK_ROW);
    expect(report.id).toBe(42);
    expect(report.period).toBe("2025-04");
    expect(report.payloadVersion).toBe(1);
    expect(report.narrative).toBe("You shipped fast this month.");
    expect(report.narrativeStatus).toBe("complete");
    expect(report.persona).toBe("The Shipper");
    expect(report.focusScore).toBe("0.72");
    expect(report.isPublic).toBe(true);
  });

  it("includes both public and private repos in the payload", () => {
    const report = assembleOwnerReport(MOCK_ROW);
    expect(report.payload.repos).toHaveLength(2);
    const privateRepo = report.payload.repos.find((r) => !r.is_public);
    expect(privateRepo).toBeDefined();
  });

  it("does NOT include userId (internal field)", () => {
    const report = assembleOwnerReport(MOCK_ROW);
    expect((report as unknown as Record<string, unknown>)['userId']).toBeUndefined();
  });

  it("includes generatedAt and updatedAt timestamps", () => {
    const report = assembleOwnerReport(MOCK_ROW);
    expect(report.generatedAt).toBeInstanceOf(Date);
    expect(report.updatedAt).toBeInstanceOf(Date);
  });
});

// ── assemblePublicReport ──────────────────────────────────────────────────────

describe("assemblePublicReport", () => {
  it("strips private repos from the payload", () => {
    const report = assemblePublicReport(MOCK_ROW);
    // Only the public repo should remain
    expect(report.payload.repos).toHaveLength(1);
    expect(report.payload.repos[0]!.is_public).toBe(true);
    expect(report.payload.repos[0]!.name_hash).toBe("public_hash_0001");
  });

  it("does NOT include private repo data — not even as null", () => {
    const report = assemblePublicReport(MOCK_ROW);
    const privateHash = "private_hash_0002";
    const hasPrivate = report.payload.repos.some(
      (r) => r.name_hash === privateHash,
    );
    expect(hasPrivate).toBe(false);
  });

  it("includes narrative when status is complete", () => {
    const report = assemblePublicReport(MOCK_ROW);
    expect(report.narrative).toBe("You shipped fast this month.");
    expect(report.narrativeStatus).toBe("complete");
  });

  it("preserves all non-repo payload fields", () => {
    const report = assemblePublicReport(MOCK_ROW);
    expect(report.payload.total_commits).toBe(100);
    expect(report.payload.focus_score).toBe(0.72);
    expect(report.payload.developer_persona).toBe("The Shipper");
    expect(report.payload.languages).toEqual({ TypeScript: 80, Python: 20 });
  });

  it("does NOT include userId or isPublic (internal fields)", () => {
    const report = assemblePublicReport(MOCK_ROW);
    expect((report as unknown as Record<string, unknown>)['userId']).toBeUndefined();
    expect((report as unknown as Record<string, unknown>)['isPublic']).toBeUndefined();
  });

  it("handles a report with zero repos gracefully", () => {
    const emptyPayload: AiPayload = { ...PAYLOAD, repos: [] };
    const emptyRow: Report = {
      ...MOCK_ROW,
      payload: emptyPayload as unknown as Record<string, unknown>,
    };
    const report = assemblePublicReport(emptyRow);
    expect(report.payload.repos).toHaveLength(0);
  });

  it("handles a report where ALL repos are private", () => {
    const allPrivatePayload: AiPayload = {
      ...PAYLOAD,
      repos: [{ ...PAYLOAD.repos[1]!, is_public: false }],
    };
    const allPrivateRow: Report = {
      ...MOCK_ROW,
      payload: allPrivatePayload as unknown as Record<string, unknown>,
    };
    const report = assemblePublicReport(allPrivateRow);
    expect(report.payload.repos).toHaveLength(0);
  });
});

// ── assembleReportListItem ────────────────────────────────────────────────────

describe("assembleReportListItem", () => {
  it("includes only metadata fields (no payload or narrative text)", () => {
    const item = assembleReportListItem(MOCK_ROW);
    expect(item.id).toBe(42);
    expect(item.period).toBe("2025-04");
    expect(item.persona).toBe("The Shipper");
    expect(item.focusScore).toBe("0.72");
    expect(item.narrativeStatus).toBe("complete");
    expect(item.isPublic).toBe(true);
    expect(item.generatedAt).toBeInstanceOf(Date);
  });

  it("does NOT include payload or narrative text", () => {
    const item = assembleReportListItem(MOCK_ROW);
    expect((item as unknown as Record<string, unknown>)['payload']).toBeUndefined();
    expect((item as unknown as Record<string, unknown>)['narrative']).toBeUndefined();
  });

  it("does NOT include userId or internal DB fields", () => {
    const item = assembleReportListItem(MOCK_ROW);
    expect((item as unknown as Record<string, unknown>)['userId']).toBeUndefined();
    expect((item as unknown as Record<string, unknown>)['createdAt']).toBeUndefined();
    expect((item as unknown as Record<string, unknown>)['updatedAt']).toBeUndefined();
  });
});
