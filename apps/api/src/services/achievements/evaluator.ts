import { db }                      from '../../db/client'
import { achievements, reports }    from '../../db/schema'
import { ACHIEVEMENT_DEFINITIONS }  from './definitions'
import type { AiPayload }           from '../aggregation/types'
import { eq, count }                from 'drizzle-orm'

export interface UnlockedAchievement {
  achievementId: string
  title:         string
  description:   string
  meta:          Record<string, unknown>
  isNew:         boolean   // true if just unlocked this run
}

/**
 * Evaluate all achievement definitions against the current payload.
 * Inserts new unlocks. Returns full list of earned achievements for the user
 * (both new and previously unlocked).
 *
 * Safe to call multiple times — unique constraint prevents duplicates.
 */
export async function evaluateAchievements(
  userId: number,
  period: string,
  payload: AiPayload,
): Promise<UnlockedAchievement[]> {

  // Count total completed reports for this user — needed for first_report
  const [{ value: reportCount }] = await db
    .select({ value: count() })
    .from(reports)
    .where(eq(reports.userId, userId))

  // Fetch already-unlocked achievement IDs for this user
  const existing = await db
    .select({ achievementId: achievements.achievementId })
    .from(achievements)
    .where(eq(achievements.userId, userId))

  const existingIds = new Set(existing.map(r => r.achievementId))

  const newUnlocks: typeof achievements.$inferInsert[] = []
  const newIds     = new Set<string>()

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (existingIds.has(def.id)) continue  // already unlocked, skip

    const meta = def.evaluate(payload, Number(reportCount))
    if (meta === null) continue

    newUnlocks.push({
      userId,
      achievementId: def.id,
      period,
      meta,
    })
    newIds.add(def.id)
  }

  // Bulk insert new unlocks — ignore conflict (race condition safety)
  if (newUnlocks.length > 0) {
    await db
      .insert(achievements)
      .values(newUnlocks)
      .onConflictDoNothing()
  }

  // Return full earned list (existing + new) with isNew flag
  const allEarned = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, userId))

  const defMap = new Map(ACHIEVEMENT_DEFINITIONS.map(d => [d.id, d]))

  return allEarned
    .map(row => {
      const def = defMap.get(row.achievementId)
      if (!def) return null
      return {
        achievementId: row.achievementId,
        title:         def.title,
        description:   def.description,
        meta:          (row.meta ?? {}) as Record<string, unknown>,
        isNew:         newIds.has(row.achievementId),
      }
    })
    .filter((x): x is UnlockedAchievement => x !== null)
}
