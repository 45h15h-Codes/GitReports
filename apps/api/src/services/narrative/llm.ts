/**
 * LLM narrative generator (PRD §3.6)
 *
 * Calls Claude API with the structured AI payload and returns the
 * reflective summary paragraph (80–120 words).
 *
 * This module is the ONLY place in the codebase that communicates with
 * the Claude API. All calls are server-side only — user tokens never used here.
 *
 * Rate limit: 5 req/user/min enforced upstream by the job queue (PRD §9.3).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AiPayload } from '../aggregation/types';
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativeMessages,
} from './prompt';

// ── Claude client ─────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('[narrative] ANTHROPIC_API_KEY is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ── Model config (PRD §3.6) ───────────────────────────────────────────────────

const MODEL_ID      = 'claude-haiku-4-5';
const MAX_TOKENS    = 200;
const TEMPERATURE   = 0.7;

// ── Narrative generator ───────────────────────────────────────────────────────

export interface NarrativeResult {
  narrative:    string;
  inputTokens:  number;
  outputTokens: number;
}

/**
 * Generate the AI reflective summary for the given payload.
 *
 * Throws if:
 *   - ANTHROPIC_API_KEY is not set
 *   - The Claude API returns a non-success response
 *   - The response contains no text content
 *
 * The caller (worker) is responsible for catching errors and updating
 * narrativeStatus to 'failed'.
 */
export async function generateNarrative(
  payload: AiPayload,
): Promise<NarrativeResult> {
  const client   = getClient();
  const messages = buildNarrativeMessages(payload);

  const response = await client.messages.create({
    model:      MODEL_ID,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system:     NARRATIVE_SYSTEM_PROMPT,
    messages,
  });

  // Extract the text block from the response
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('[narrative] Claude response contained no text block');
  }

  const narrative = textBlock.text.trim();
  if (!narrative) {
    throw new Error('[narrative] Claude returned an empty narrative');
  }

  return {
    narrative,
    inputTokens:  response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
