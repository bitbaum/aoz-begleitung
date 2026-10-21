CREATE TABLE "ClaimInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tokenHash" text NOT NULL,
	"userId" text NOT NULL,
	"createdById" text,
	"expiresAt" timestamp (3) NOT NULL,
	"usedAt" timestamp (3),
	"revokedAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "ClaimInvite" ADD CONSTRAINT "ClaimInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClaimInvite" ADD CONSTRAINT "ClaimInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "ClaimInvite_tokenHash_key" ON "ClaimInvite" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "ClaimInvite_userId_idx" ON "ClaimInvite" USING btree ("userId");