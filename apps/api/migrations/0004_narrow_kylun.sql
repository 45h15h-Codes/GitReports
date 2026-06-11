CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" varchar(64) NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	"period" varchar(7) NOT NULL,
	"meta" jsonb,
	CONSTRAINT "achievements_user_achievement_unique" UNIQUE("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_user_id_idx" ON "achievements" USING btree ("user_id");