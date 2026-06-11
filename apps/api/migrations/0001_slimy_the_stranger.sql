DROP INDEX "reports_user_period_idx";--> statement-breakpoint
DROP INDEX "reports_public_idx";--> statement-breakpoint
CREATE INDEX "reports_user_period_desc_idx" ON "reports" USING btree ("user_id","period" DESC NULLS LAST);