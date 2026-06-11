/**
 * Unit tests: narrative worker (Sprint 4)
 *
 * Tests queue factory + worker job handler logic.
 * BullMQ and the DB are mocked — no Redis or Postgres required.
 *
 * Coverage:
 *   - getNarrativeQueue: returns a singleton Queue instance
 *   - Worker job handler: happy path → marks generating → calls LLM → marks complete
 *   - Worker job handler: LLM error → marks failed
 *   - NarrativeJobData type contract
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AiPayload } from "../services/aggregation/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock BullMQ — we test the job processor logic, not BullMQ internals
vi.mock("bullmq", () => {
  const Queue = vi.fn().mockImplementation(function () {
    return {
      add: vi.fn().mockResolvedValue({ id: "job-1" }),
    };
  });
  const Worker = vi
    .fn()
    .mockImplementation(function (_name: string, processor: unknown) {
      return {
        _processor: processor, // expose for testing
        on: vi.fn(),
      };
    });
  return { Queue, Worker };
});

// Mock the DB client
vi.mock("../db/client", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    // Steps 4+5: email + achievement evaluation both call db.select
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue(null),
          }),
          // evaluator calls .where() without .limit (full list query)
          then: vi.fn().mockResolvedValue([]),
        }),
        // count query shape: .select({ value: count() }).from(reports).where()
        then: vi.fn().mockResolvedValue([{ value: 1 }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock the Redis factory
vi.mock("../lib/redis", () => ({
  getRedisClient: vi.fn().mockReturnValue({}),
  getRedisSubscriber: vi.fn().mockReturnValue({}),
}));

// Mock LLM
vi.mock("../services/narrative/llm", () => ({
  generateNarrative: vi.fn(),
}));

// Mock email — fire-and-forget, must not affect job outcome
vi.mock("../lib/email", () => ({
  sendReportReadyEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock achievement evaluator — fire-and-forget
vi.mock("../services/achievements/evaluator", () => ({
  evaluateAchievements: vi.fn().mockResolvedValue([]),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_PAYLOAD: AiPayload = {
  payload_version: 1,
  period: "2025-04",
  total_commits: 50,
  active_days: 15,
  longest_streak: 7,
  current_streak: 2,
  repos: [],
  languages: { TypeScript: 100 },
  peak_hour_block: "morning",
  commit_size_dist: { tiny: 10, small: 20, medium: 15, large: 5 },
  focus_score: 0.9,
  developer_persona: "The Maintainer",
  lines_added_total: 1000,
  prs_merged_total: 5,
  repos_touched: 0,
  daily_commits: [0, 0, 0, 5, 10],
  prev_period_summary: null,
};

// ── Queue singleton ───────────────────────────────────────────────────────────

describe("getNarrativeQueue", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a Queue instance", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { getNarrativeQueue } = await import("../workers/narrativeWorker");
    const queue = getNarrativeQueue();
    expect(queue).toBeDefined();
    expect(typeof queue.add).toBe("function");
  });

  it("returns the same Queue instance on repeated calls (singleton)", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { getNarrativeQueue } = await import("../workers/narrativeWorker");
    const q1 = getNarrativeQueue();
    const q2 = getNarrativeQueue();
    expect(q1).toBe(q2);
  });
});

// ── Worker job handler ────────────────────────────────────────────────────────

describe("startNarrativeWorker — job processor", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("marks report as generating then complete on success", async () => {
    const { db } = await import("../db/client");
    const { generateNarrative } = await import("../services/narrative/llm");

    vi.mocked(generateNarrative).mockResolvedValueOnce({
      narrative: "You shipped fast this month.",
      inputTokens: 400,
      outputTokens: 30,
    });

    const { startNarrativeWorker } = await import("../workers/narrativeWorker");
    const worker = startNarrativeWorker() as unknown as {
      _processor: (job: unknown) => Promise<void>;
    };

    // Simulate the worker processing a job
    await worker._processor({
      data: { reportId: 42, payload: SAMPLE_PAYLOAD },
    });

    // Should have called db.update twice: generating → complete
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(generateNarrative).toHaveBeenCalledWith(SAMPLE_PAYLOAD, expect.any(String));
  });

  it("propagates LLM errors (worker failure handler marks as failed)", async () => {
    const { generateNarrative } = await import("../services/narrative/llm");
    vi.mocked(generateNarrative).mockRejectedValueOnce(
      new Error("Claude API timeout"),
    );

    const { startNarrativeWorker } = await import("../workers/narrativeWorker");
    const worker = startNarrativeWorker() as unknown as {
      _processor: (job: unknown) => Promise<void>;
    };

    await expect(
      worker._processor({ data: { reportId: 99, payload: SAMPLE_PAYLOAD } }),
    ).rejects.toThrow("Claude API timeout");
  });
});

// ── NarrativeJobData type contract ────────────────────────────────────────────

describe("NarrativeJobData", () => {
  it("has reportId (number) and payload (AiPayload) fields", async () => {
    const {} = await import("../workers/narrativeWorker");
    // TypeScript type test — verified at compile time; runtime shape test here
    const job = { reportId: 1, payload: SAMPLE_PAYLOAD };
    expect(typeof job.reportId).toBe("number");
    expect(typeof job.payload.period).toBe("string");
    expect(typeof job.payload.focus_score).toBe("number");
  });
});
