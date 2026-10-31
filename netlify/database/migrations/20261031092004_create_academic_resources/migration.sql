CREATE TABLE "courses" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"year" integer NOT NULL,
	"semester" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY,
	"subject_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"filename" text NOT NULL,
	"format" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_subject_id_courses_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;