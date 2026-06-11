import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  varchar,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────
// GitHub OAuth creates the user record on first sign-in.
// access_token is AES-256 encrypted at rest — NEVER returned to client-side JS.
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    githubId: integer("github_id").notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    email: text("email"), // nullable — GitHub email privacy
    accessToken: text("access_token").notNull(), // AES-256 encrypted
    geminiApiKey: text("gemini_api_key"), // AES-256 encrypted, nullable
    tokenScope: text("token_scope").notNull().default("public_repo"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
    hasSeenCinematic: boolean('has_seen_cinematic').notNull().default(false),
    deletedAt: timestamp("deleted_at"), // soft delete → then hard delete job
  },
  (table) => ({
    githubIdIdx: index("users_github_id_idx").on(table.githubId),
    usernameIdx: index("users_username_idx").on(table.username),
    githubIdUniq: unique("users_github_id_unique").on(table.githubId),
  }),
);

// ─── Reports ──────────────────────────────────────────────────────────────────
// One row per user per calendar month (YYYY-MM).
// payload: the structured AI payload JSON — versioned schema — the longitudinal data asset.
// narrative: the LLM-generated reflective summary paragraph.
// payload_version: increment when payload schema changes. Historical reads must not break.
export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(), // 'YYYY-MM'
    payloadVersion: integer("payload_version").notNull().default(1),
    payload: jsonb("payload").notNull(), // structured AI payload (see PRD §3.2)
    narrative: text("narrative"), // LLM output — null if generation failed
    narrativeStatus: varchar("narrative_status", { length: 20 })
      .notNull()
      .default("pending"),
    // 'pending' | 'generating' | 'complete' | 'failed'
    persona: varchar("persona", { length: 50 }), // The Architect | The Shipper | etc.
    focusScore: text("focus_score"), // stored as text to avoid float rounding
    isPublic: boolean("is_public").notNull().default(true), // user can make report private
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userPeriodDescIdx: index("reports_user_period_desc_idx").on(
      table.userId,
      table.period.desc(),
    ),
    userPeriodUniq: unique("reports_user_period_unique").on(
      table.userId,
      table.period,
    ),
  }),
);

// ─── Challenge Links ───────────────────────────────────────────────────────────
// Generated from Compare tab → sends challenger's PUBLIC stats to the challenged user.
// Expires 30 days after generation. Not reusable after expiry.
// IMPORTANT: challenger's stats are PUBLIC only — private data never stored here.
export const challengeLinks = pgTable(
  "challenge_links",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 64 }).notNull(), // URL-safe random token
    challengerUserId: integer("challenger_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(), // 'YYYY-MM'
    challengerStats: jsonb("challenger_stats").notNull(), // snapshot of PUBLIC stats at creation time
    clickCount: integer("click_count").notNull().default(0),
    acceptCount: integer("accept_count").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(), // createdAt + 30 days
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: index("challenge_links_token_idx").on(table.token),
    tokenUniq: unique("challenge_links_token_unique").on(table.token),
  }),
);

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Managed by @fastify/session + connect-pg-simple.
// 30-day inactivity logout enforced by session TTL.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").notNull().primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("sessions_expire_idx").on(table.expire),
  }),
);

export const failedJobs = pgTable('failed_jobs', {
  id:          serial('id').primaryKey(),
  jobId:       text('job_id').notNull(),
  jobName:     text('job_name').notNull(),
  queueName:   text('queue_name').notNull(),
  payload:     jsonb('payload').notNull(),
  errorMessage: text('error_message').notNull(),
  attemptsMade: integer('attempts_made').notNull(),
  failedAt:    timestamp('failed_at').notNull().defaultNow(),
});

// ─── Achievements ──────────────────────────────────────────────────────────────
// One row per user per achievement unlock. Unique on (userId, achievementId).
// Unlocks are permanent — no revocation.
export const achievements = pgTable(
  'achievements',
  {
    id:            serial('id').primaryKey(),
    userId:        integer('user_id')
                     .notNull()
                     .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: varchar('achievement_id', { length: 64 }).notNull(),
    unlockedAt:    timestamp('unlocked_at').notNull().defaultNow(),
    period:        varchar('period', { length: 7 }).notNull(), // month that triggered it
    meta:          jsonb('meta'),  // optional context e.g. { streak: 30 }
  },
  (table) => ({
    userAchievementUniq: unique('achievements_user_achievement_unique').on(
      table.userId,
      table.achievementId,
    ),
    userIdIdx: index('achievements_user_id_idx').on(table.userId),
  }),
)

// ─── Type exports ─────────────────────────────────────────────────────────────
export type User            = typeof users.$inferSelect;
export type NewUser         = typeof users.$inferInsert;
export type Report          = typeof reports.$inferSelect;
export type NewReport       = typeof reports.$inferInsert;
export type ChallengeLink   = typeof challengeLinks.$inferSelect;
export type NewChallengeLink = typeof challengeLinks.$inferInsert;
export type Achievement     = typeof achievements.$inferSelect;
export type NewAchievement  = typeof achievements.$inferInsert;
