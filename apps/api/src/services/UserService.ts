/**
 * UserService — data-access layer for the `users` table.
 *
 * Route handlers must NOT write Drizzle queries against `users` directly.
 * All user-related DB interactions go through this service.
 *
 * Sprint D.4 — Extract service layer.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { users, reports, achievements } from '../db/schema';
import { decryptToken } from '../lib/crypto';
import { ACHIEVEMENT_DEFINITIONS } from './achievements/definitions';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:               number;
  username:         string;
  displayName:      string | null;
  avatarUrl:        string | null;
  tokenScope:       string;
  createdAt:        Date;
  hasSeenCinematic: boolean;
  hasGeminiApiKey:  boolean;
}

export interface UserForGeneration {
  id:          number;
  username:    string;
  plainToken:  string;
  tokenScope:  string;
  geminiApiKey: string | null;
}

export interface PublicUser {
  id:          number;
  username:    string;
  avatarUrl:   string | null;
  displayName: string | null;
}

// ── User operations ───────────────────────────────────────────────────────────

/**
 * Fetch authenticated user's public profile (for /auth/me).
 * Never returns accessToken or raw email.
 */
export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const [user] = await db
    .select({
      id:               users.id,
      username:         users.username,
      displayName:      users.displayName,
      avatarUrl:        users.avatarUrl,
      tokenScope:       users.tokenScope,
      createdAt:        users.createdAt,
      hasSeenCinematic: users.hasSeenCinematic,
      geminiApiKey:     users.geminiApiKey,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const { geminiApiKey, ...rest } = user;
  return {
    ...rest,
    hasGeminiApiKey: !!geminiApiKey,
  };
}

/**
 * Fetch user with decrypted GitHub token for report generation.
 * Decrypts token in-service — token plaintext never persists.
 */
export async function getUserForGeneration(userId: number): Promise<UserForGeneration | null> {
  const [user] = await db
    .select({
      id:          users.id,
      username:    users.username,
      accessToken: users.accessToken,
      tokenScope:  users.tokenScope,
      geminiApiKey: users.geminiApiKey,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  return {
    id:         user.id,
    username:   user.username,
    plainToken: decryptToken(user.accessToken),
    tokenScope: user.tokenScope,
    geminiApiKey: user.geminiApiKey ? decryptToken(user.geminiApiKey) : null,
  };
}

/**
 * Fetch a user's public profile by username — for public report surfaces.
 * Returns null if username not found.
 */
export async function getPublicUserByUsername(username: string): Promise<PublicUser | null> {
  const [user] = await db
    .select({
      id:          users.id,
      username:    users.username,
      avatarUrl:   users.avatarUrl,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user ?? null;
}

/**
 * Fetch full public profile for /public/u/:username archive page.
 * Returns user + all public completed reports (metadata only) + earned achievements.
 * Private reports excluded. Never returns accessToken or email.
 */
export async function getPublicProfile(username: string): Promise<{
  user: {
    username:    string
    displayName: string | null
    avatarUrl:   string | null
  }
  reports: {
    period:       string
    persona:      string | null
    focusScore:   string | null
    totalCommits: number
    narrative:    string | null
    generatedAt:  Date
  }[]
  achievements: {
    achievementId: string
    title:         string
    description:   string
    unlockedAt:    Date
    period:        string
  }[]
} | null> {
  const userRow = await db
    .select({
      id:          users.id,
      username:    users.username,
      displayName: users.displayName,
      avatarUrl:   users.avatarUrl,
      deletedAt:   users.deletedAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
    .then(r => r[0])

  if (!userRow || userRow.deletedAt) return null

  const reportRows = await db
    .select({
      period:      reports.period,
      persona:     reports.persona,
      focusScore:  reports.focusScore,
      payload:     reports.payload,
      narrative:   reports.narrative,
      generatedAt: reports.generatedAt,
    })
    .from(reports)
    .where(
      and(
        eq(reports.userId,          userRow.id),
        eq(reports.isPublic,        true),
        eq(reports.narrativeStatus, 'complete'),
      ),
    )
    .orderBy(reports.period)

  const defMap = new Map(
    ACHIEVEMENT_DEFINITIONS.map(d => [d.id, { title: d.title, description: d.description }])
  )

  const achievementRows = await db
    .select({
      achievementId: achievements.achievementId,
      unlockedAt:    achievements.unlockedAt,
      period:        achievements.period,
    })
    .from(achievements)
    .where(eq(achievements.userId, userRow.id))
    .orderBy(achievements.unlockedAt)

  return {
    user: {
      username:    userRow.username,
      displayName: userRow.displayName,
      avatarUrl:   userRow.avatarUrl,
    },
    reports: reportRows.map(r => {
      const p = r.payload as { total_commits?: number }
      return {
        period:       r.period,
        persona:      r.persona,
        focusScore:   r.focusScore,
        totalCommits: p.total_commits ?? 0,
        narrative:    r.narrative,
        generatedAt:  r.generatedAt,
      }
    }),
    achievements: achievementRows
      .map(r => {
        const def = defMap.get(r.achievementId)
        if (!def) return null
        return {
          achievementId: r.achievementId,
          title:         def.title,
          description:   def.description,
          unlockedAt:    r.unlockedAt,
          period:        r.period,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  }
}

/**
 * Save user's personal Gemini API key.
 */
export async function saveGeminiApiKey(userId: number, apiKey: string): Promise<void> {
  const { encryptToken } = await import('../lib/crypto');
  const encryptedKey = encryptToken(apiKey);
  await db
    .update(users)
    .set({ geminiApiKey: encryptedKey, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
