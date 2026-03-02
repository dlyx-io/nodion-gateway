CREATE TABLE "service_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"email" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"totp_secret_encrypted" text,
	"created_at" text NOT NULL
);
