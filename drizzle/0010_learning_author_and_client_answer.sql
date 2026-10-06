ALTER TABLE "LearningRecord" ADD COLUMN "recordedByUserId" text;--> statement-breakpoint
ALTER TABLE "OpportunityApplication" ADD COLUMN "residentAnswer" text;--> statement-breakpoint
ALTER TABLE "OpportunityApplication" ADD COLUMN "residentAnsweredAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "LearningRecord" ADD CONSTRAINT "LearningRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;