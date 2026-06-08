/**
 * LLM prompt builder for the AI narrative call (PRD §3.6)
 *
 * Builds system + user messages from the structured AI payload.
 * The system prompt is ~150 tokens; the user message ~400–600 tokens.
 *
 * Privacy guardrails enforced here:
 *   - Only the payload JSON is passed to the LLM — never raw GitHub API data
 *   - Repo names are hashes in the payload (enforced upstream by engine.ts)
 *   - No commit messages, file names, branch names, or code content
 *
 * Model: claude-haiku-4-5 (PRD §3.6)
 * Max output: 200 tokens
 * Temperature: 0.7
 */

import type { AiPayload } from '../aggregation/types';

// ── System prompt (~150 tokens) ───────────────────────────────────────────────

export const NARRATIVE_SYSTEM_PROMPT = `\
You are GitReport's narrative engine. Given a structured JSON summary of a \
developer's monthly GitHub activity, write a single paragraph (80–120 words) that \
translates their work into a human achievement narrative. Use the developer_persona \
field to set the tone. Reference the prev_period_summary for longitudinal context \
if available. Never mention repository names. Write in second person ("you"). \
Output plain text only — no markdown, no headers, no bullet points.\
`;

// ── User message builder ──────────────────────────────────────────────────────

/**
 * Build the user-turn message from the payload.
 * Formats the JSON payload and appends the generation instruction.
 */
export function buildNarrativeUserMessage(payload: AiPayload): string {
  // Derive the human-readable month label from the period
  const [yearStr, monthStr] = payload.period.split('-');
  const year  = Number(yearStr);
  const month = Number(monthStr);
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
  });

  const payloadJson = JSON.stringify(payload, null, 2);

  return `${payloadJson}\n\nGenerate the monthly summary for ${monthName} ${year}.`;
}

/**
 * Returns the full messages array for the Claude API call.
 */
export function buildNarrativeMessages(payload: AiPayload): Array<{
  role: 'user';
  content: string;
}> {
  return [
    {
      role: 'user',
      content: buildNarrativeUserMessage(payload),
    },
  ];
}
