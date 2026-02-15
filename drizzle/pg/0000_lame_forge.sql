CREATE TABLE "api_key_projects" (
	"key_id" text NOT NULL,
	"project_slug" text NOT NULL,
	CONSTRAINT "api_key_projects_key_id_project_slug_pk" PRIMARY KEY("key_id","project_slug")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"label" text NOT NULL,
	"role" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text,
	"revoked_at" text,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"key_id" text,
	"project_slug" text,
	"method" text NOT NULL,
	"endpoint" text NOT NULL,
	"app_id" text,
	"result" text NOT NULL,
	"reason" text,
	"response_status" integer
);
--> statement-breakpoint
CREATE TABLE "blocklist" (
	"app_id" text NOT NULL,
	"project_slug" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "blocklist_app_id_project_slug_pk" PRIMARY KEY("app_id","project_slug")
);
--> statement-breakpoint
CREATE TABLE "key_scopes" (
	"key_id" text NOT NULL,
	"project_slug" text NOT NULL,
	"scope" text NOT NULL,
	"target" text DEFAULT '*' NOT NULL,
	CONSTRAINT "key_scopes_key_id_project_slug_scope_target_pk" PRIMARY KEY("key_id","project_slug","scope","target")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"nodion_api_key_encrypted" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"app_id" text NOT NULL,
	"project_slug" text NOT NULL,
	"created_by_key" text NOT NULL,
	"created_at" text NOT NULL,
	"label" text,
	"last_deployed_at" text,
	CONSTRAINT "resources_app_id_project_slug_pk" PRIMARY KEY("app_id","project_slug")
);
--> statement-breakpoint
ALTER TABLE "api_key_projects" ADD CONSTRAINT "api_key_projects_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_projects" ADD CONSTRAINT "api_key_projects_project_slug_projects_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."projects"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocklist" ADD CONSTRAINT "blocklist_project_slug_projects_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."projects"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_scopes" ADD CONSTRAINT "key_scopes_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_scopes" ADD CONSTRAINT "key_scopes_project_slug_projects_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."projects"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_project_slug_projects_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."projects"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_key_api_keys_id_fk" FOREIGN KEY ("created_by_key") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;