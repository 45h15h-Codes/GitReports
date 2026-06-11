import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertReport } from "../services/ReportService";
import { db } from "../db/client";

// Mock DB
const mocks = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnThis();
  return {
    mockInsert,
    mockValues: vi.fn().mockReturnThis(),
    mockOnConflictDoUpdate: vi.fn().mockReturnThis(),
    mockReturning: vi.fn().mockResolvedValue([{ id: 10 }]),
    mockDelete: vi.fn().mockReturnThis(),
    mockTransaction: vi.fn().mockImplementation(async (cb: any) =>
      cb({
        insert: mockInsert,
        delete: vi.fn().mockReturnThis(),
      })
    )
  };
});

vi.mock("../db/client", () => ({
  db: {
    delete: mocks.mockDelete,
    insert: mocks.mockInsert,
    transaction: mocks.mockTransaction,
  },
}));

// Mock db schema
vi.mock("../db/schema", () => ({
  reports: { userId: "user_id", period: "period" },
}));

describe("upsertReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use db.transaction and onConflictDoUpdate instead of delete-then-insert", async () => {
    mocks.mockInsert.mockReturnThis();
    mocks.mockValues.mockReturnThis();
    mocks.mockOnConflictDoUpdate.mockReturnThis();
    mocks.mockReturning.mockResolvedValue([{ id: 10 }]);

    // Patch the mock chain for insert
    mocks.mockInsert.mockImplementation(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: mocks.mockReturning,
        }),
        returning: mocks.mockReturning,
      }),
    }));

    await upsertReport({
      userId: 1,
      period: "2025-04",
      payloadVersion: 1,
      payload: { test: true } as any,
      narrativeStatus: "pending",
      persona: "The Maintainer",
      focusScore: "0.9",
      isPublic: false
    });

    // Verify delete was NEVER called
    expect(mocks.mockDelete).not.toHaveBeenCalled();

    // Verify transaction was called
    expect(mocks.mockTransaction).toHaveBeenCalled();
  });
});
