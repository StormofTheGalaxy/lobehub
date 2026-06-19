CREATE TABLE "agent_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" varchar(120) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" varchar(1000),
	"avatar" text,
	"background_color" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"category" varchar(120),
	"config" jsonb NOT NULL,
	"editor_data" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"workspace_id" text,
	"published_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_presets" ADD CONSTRAINT "agent_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_presets" ADD CONSTRAINT "agent_presets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_presets" ADD CONSTRAINT "agent_presets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_presets_status_idx" ON "agent_presets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_presets_workspace_id_idx" ON "agent_presets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_presets_featured_idx" ON "agent_presets" USING btree ("featured");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_presets_identifier_global_unique" ON "agent_presets" USING btree ("identifier") WHERE "agent_presets"."workspace_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_presets_identifier_workspace_unique" ON "agent_presets" USING btree ("identifier","workspace_id") WHERE "agent_presets"."workspace_id" is not null;