CREATE TYPE "public"."SurveyStatus" AS ENUM('DRAFT', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "Survey" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"templateId" text NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"questions" jsonb NOT NULL,
	"status" "SurveyStatus" DEFAULT 'DRAFT' NOT NULL,
	"minResponses" integer DEFAULT 5 NOT NULL,
	"createdByUserId" text NOT NULL,
	"openedAt" timestamp (3),
	"closedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "SurveyInvitation" (
	"id" text PRIMARY KEY NOT NULL,
	"surveyId" text NOT NULL,
	"residentId" text NOT NULL,
	"invitedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"answered" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SurveyResponse" (
	"id" text PRIMARY KEY NOT NULL,
	"surveyId" text NOT NULL,
	"answers" jsonb NOT NULL,
	"submittedOn" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "public"."Resident"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Survey_status_idx" ON "Survey" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "SurveyInvitation_surveyId_residentId_key" ON "SurveyInvitation" USING btree ("surveyId","residentId");--> statement-breakpoint
CREATE INDEX "SurveyInvitation_residentId_idx" ON "SurveyInvitation" USING btree ("residentId");--> statement-breakpoint
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse" USING btree ("surveyId");