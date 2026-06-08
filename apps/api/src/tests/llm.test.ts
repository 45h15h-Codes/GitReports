/**
 * Unit tests: LLM narrative module (PRD §3.6)
 *
 * Tests the prompt builder and LLM call wrapper without making real API calls.
 * The Anthropic client is mocked via vitest.mock().
 *
 * Coverage:
 *   - buildNarrativeUserMessage: correct JSON embedding + month label
 *   - buildNarrativeMessages: returns correct message structure
 *   - generateNarrative: happy path, empty narrative error, no text block error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AiPayload } from '../services/aggregation/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_PAYLOAD: AiPayload = {
  payload_version:  1,
  period:           '2025-04',
  total_commits:    82,
  active_days:      22,
  longest_streak:   14,
  current_streak:   6,
  repos: [
    {
      name_hash:       'abc123def456789a',
      is_public:       true,
      language:        'TypeScript',
      commits:         82,
      lines_added:     3400,
      lines_deleted:   1200,
      prs_merged:      11,
      category_signal: 'high_churn_refactor',
    },
  ],
  languages:        { TypeScript: 62, Python: 28, CSS: 10 },
  peak_hour_block:  'evening',
  commit_size_dist: { tiny: 40, small: 120, medium: 60, large: 27 },
  focus_score:      0.68,
  developer_persona: 'The Architect',
  prev_period_summary: {
    total_commits:     209,
    focus_score:       0.82,
    dominant_language: 'TypeScript',
    persona:           'The Architect',
  },
};

// ── Prompt builder tests ──────────────────────────────────────────────────────

describe('buildNarrativeUserMessage', () => {
  // Import lazily so mocks are applied first
  let buildNarrativeUserMessage: typeof import('../services/narrative/prompt').buildNarrativeUserMessage;
  let buildNarrativeMessages: typeof import('../services/narrative/prompt').buildNarrativeMessages;

  beforeEach(async () => {
    const mod = await import('../services/narrative/prompt');
    buildNarrativeUserMessage = mod.buildNarrativeUserMessage;
    buildNarrativeMessages    = mod.buildNarrativeMessages;
  });

  it('embeds the payload JSON in the user message', () => {
    const msg = buildNarrativeUserMessage(SAMPLE_PAYLOAD);
    expect(msg).toContain('"period": "2025-04"');
    expect(msg).toContain('"total_commits": 82');
    expect(msg).toContain('"developer_persona": "The Architect"');
  });

  it('appends the correct month label', () => {
    const msg = buildNarrativeUserMessage(SAMPLE_PAYLOAD);
    expect(msg).toContain('April 2025');
  });

  it('correctly formats a different month (December)', () => {
    const decPayload: AiPayload = { ...SAMPLE_PAYLOAD, period: '2024-12' };
    const msg = buildNarrativeUserMessage(decPayload);
    expect(msg).toContain('December 2024');
  });

  it('never includes raw repo names (only hashes)', () => {
    const msg = buildNarrativeUserMessage(SAMPLE_PAYLOAD);
    // The payload fixture uses hashes — this verifies no real name leaks through
    expect(msg).not.toContain('testuser/');
  });

  it('buildNarrativeMessages returns a single user-role message', () => {
    const messages = buildNarrativeMessages(SAMPLE_PAYLOAD);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toContain('"period": "2025-04"');
  });
});

// ── Module-scope constant for vi.mock factory (hoisting-safe) ─────────────────
// vi.mock() is hoisted before variable declarations — the string must live at
// module scope so the mock factory closure can reference it without TDZ errors.
const MOCK_NARRATIVE_TEXT =
  'April was your month of deep work. As an Architect, you tore things down to build them better.';

// Mock the @anthropic-ai/sdk module (top-level, hoisted by vitest)
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: MOCK_NARRATIVE_TEXT }],
        usage:   { input_tokens: 420, output_tokens: 32 },
      }),
    },
  })),
}));

// ── generateNarrative: mocked Claude API ─────────────────────────────────────

describe('generateNarrative', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.resetModules();
  });

  it('returns narrative + token counts on success', async () => {
    const { generateNarrative } = await import('../services/narrative/llm');
    const result = await generateNarrative(SAMPLE_PAYLOAD);

    expect(result.narrative).toBe(MOCK_NARRATIVE_TEXT);
    expect(result.inputTokens).toBe(420);
    expect(result.outputTokens).toBe(32);
  });

  it('throws when the API returns no text block', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as import('vitest').Mock;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', id: 'tu_1', name: 'dummy', input: {} }],
          usage:   { input_tokens: 10, output_tokens: 0 },
        }),
      },
    }));

    const { generateNarrative } = await import('../services/narrative/llm');
    await expect(generateNarrative(SAMPLE_PAYLOAD)).rejects.toThrow(
      'Claude response contained no text block',
    );
  });

  it('throws when the API returns an empty narrative', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as import('vitest').Mock;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '   ' }],
          usage:   { input_tokens: 10, output_tokens: 1 },
        }),
      },
    }));

    const { generateNarrative } = await import('../services/narrative/llm');
    await expect(generateNarrative(SAMPLE_PAYLOAD)).rejects.toThrow(
      'Claude returned an empty narrative',
    );
  });

  it('throws when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
    const { generateNarrative } = await import('../services/narrative/llm');
    await expect(generateNarrative(SAMPLE_PAYLOAD)).rejects.toThrow('ANTHROPIC_API_KEY');
  });
});
