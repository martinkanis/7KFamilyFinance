CREATE TABLE "item_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"from_month" text NOT NULL,
	"amount" numeric(14, 2),
	"due_day" integer,
	"our_account_id" integer,
	"counterparty_account" text,
	"vs" text,
	CONSTRAINT "item_changes_month_format" CHECK ("item_changes"."from_month" ~ '^\d{4}-\d{2}$'),
	CONSTRAINT "item_changes_due_day_range" CHECK ("item_changes"."due_day" is null or "item_changes"."due_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "item_changes" ADD CONSTRAINT "item_changes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_changes" ADD CONSTRAINT "item_changes_our_account_id_accounts_id_fk" FOREIGN KEY ("our_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_changes_item_month" ON "item_changes" USING btree ("item_id","from_month");