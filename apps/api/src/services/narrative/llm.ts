/**
 * LLM narrative generator (PRD §3.6)
 *
 * Calls Gemini API with the structured AI payload and returns the
 * reflective summary paragraph (80–120 words).
 *
 * This module is the ONLY place in the codebase that communicates with
 * the LLM API. All calls are server-side only.
 *
 * Model: gemini-2.5-flash (free tier — 15 req/min, 1M tokens/day)
 * Rate limit: 5 req/user/min enforced upstream by the job queue (PRD §9.3).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AiPayload } from '../aggregation/types';
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativeUserMessage,
} from './prompt';

// Global client removed — instantiated per-request using user API key

// ── Model config ──────────────────────────────────────────────────────────────

const MODEL_ID    = 'gemini-2.5-flash';
const MAX_TOKENS  = 1000;
const TEMPERATURE = 0.7;

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
 *   - GEMINI_API_KEY is not set
 *   - The Gemini API returns a non-success response
 *   - The response contains no text content
 *
 * The caller (worker) is responsible for catching errors and updating
 * narrativeStatus to 'failed'.
 */
export async function generateNarrative(
  payload: AiPayload,
  apiKey:  string,
): Promise<NarrativeResult> {
  const client = new GoogleGenerativeAI(apiKey);

  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: NARRATIVE_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature:     TEMPERATURE,
    },
  });

  const userMessage = buildNarrativeUserMessage(payload);

  const result = await model.generateContent(userMessage);
  const response = result.response;

  const narrative = response.text().trim();

  if (!narrative) {
    throw new Error('[narrative] Gemini returned an empty narrative');
  }

  // Gemini returns token counts in usageMetadata
  const inputTokens  = response.usageMetadata?.promptTokenCount     ?? 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    narrative,
    inputTokens,
    outputTokens,
  };
}
