CREATE TABLE IF NOT EXISTS "challenge_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"challenger_user_id" integer NOT NULL,
	"period" varchar(7) NOT NULL,
	"challenger_stats" jsonb NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"accept_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"period" varchar(7) NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"narrative" text,
	"narrative_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"persona" varchar(50),
	"focus_score" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reports_user_period_unique" UNIQUE("user_id","period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"username" varchar(255) NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"email" text,
	"access_token" text NOT NULL,
	"token_scope" text DEFAULT 'public_repo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenge_links" ADD CONSTRAINT "challenge_links_challenger_user_id_users_id_fk" FOREIGN KEY ("challenger_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_links_token_idx" ON "challenge_links" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_user_period_idx" ON "reports" ("user_id","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_public_idx" ON "reports" ("is_public","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expire_idx" ON "sessions" ("expire");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_github_id_idx" ON "users" ("github_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");