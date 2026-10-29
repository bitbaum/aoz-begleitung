CREATE TABLE "AccountSessionScope" (
	"sessionId" text PRIMARY KEY NOT NULL,
	"side" text,
	"impersonatorStaffId" text,
	"returnSessionId" text
);
--> statement-breakpoint
ALTER TABLE "AccountSessionScope" ADD CONSTRAINT "AccountSessionScope_sessionId_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AccountSessionScope" ADD CONSTRAINT "AccountSessionScope_impersonatorStaffId_User_id_fk" FOREIGN KEY ("impersonatorStaffId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AccountSessionScope" ADD CONSTRAINT "AccountSessionScope_returnSessionId_sessions_id_fk" FOREIGN KEY ("returnSessionId") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;