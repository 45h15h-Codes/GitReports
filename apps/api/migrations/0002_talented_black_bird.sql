CREATE TABLE "failed_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"job_name" text NOT NULL,
	"queue_name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text NOT NULL,
	"attempts_made" integer NOT NULL,
	"failed_at" timestamp DEFAULT now() NOT NULL
);
