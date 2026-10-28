CREATE TYPE "public"."direction" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'processing', 'paid');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"owner" text,
	"type" text,
	"number" text,
	"currency" text DEFAULT 'CZK' NOT NULL,
	"initial_balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "accounts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"start_date" date
);
--> statement-breakpoint
CREATE TABLE "counterparties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"account_number" text,
	"web" text,
	"contact" text,
	"note" text,
	CONSTRAINT "counterparties_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"annual_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"direction" "direction" NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(14, 2),
	"amount_from_insurance" boolean DEFAULT false NOT NULL,
	"due_day" integer,
	"due_months" text,
	"valid_from" date,
	"valid_to" date,
	"our_account_id" integer,
	"counterparty_id" integer,
	"template_id" integer,
	"counterparty_account" text,
	"vs" text,
	"ks" text,
	"ss" text,
	"message" text,
	"savings" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "items_code_unique" UNIQUE("code"),
	CONSTRAINT "items_due_day_range" CHECK ("items"."due_day" is null or "items"."due_day" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "month_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"item_id" integer,
	"status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"paid_on" date,
	"note" text,
	"amount" numeric(14, 2),
	"due_day" integer,
	"our_account_id" integer,
	"counterparty_account" text,
	"vs" text,
	"name" text,
	"direction" "direction",
	"category" text,
	"counterparty_id" integer,
	CONSTRAINT "month_entries_month_format" CHECK ("month_entries"."month" ~ '^\d{4}-\d{2}$'),
	CONSTRAINT "month_entries_one_off_complete" CHECK ("month_entries"."item_id" is not null or ("month_entries"."name" is not null and "month_entries"."direction" is not null)),
	CONSTRAINT "month_entries_due_day_range" CHECK ("month_entries"."due_day" is null or "month_entries"."due_day" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "month_settings" (
	"month" text PRIMARY KEY NOT NULL,
	"wealth_correction" numeric(14, 2) DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "server_secrets" (
	"name" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"bank_login" text,
	"counterparty_id" integer,
	"account_number" text,
	"vs" text,
	"ks" text,
	"ss" text,
	"message" text,
	"amount" numeric(14, 2),
	"times_used" integer,
	"known_account" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_our_account_id_accounts_id_fk" FOREIGN KEY ("our_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_entries" ADD CONSTRAINT "month_entries_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_entries" ADD CONSTRAINT "month_entries_our_account_id_accounts_id_fk" FOREIGN KEY ("our_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_entries" ADD CONSTRAINT "month_entries_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "month_entries_month_item" ON "month_entries" USING btree ("month","item_id");