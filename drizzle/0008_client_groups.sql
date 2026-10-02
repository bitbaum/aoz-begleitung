CREATE TABLE "ClientGroup" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filters" jsonb NOT NULL,
	"createdByUserId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ClientGroup" ADD CONSTRAINT "ClientGroup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ClientGroup_createdByUserId_idx" ON "ClientGroup" USING btree ("createdByUserId");