CREATE TABLE "account_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"month" text NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	CONSTRAINT "account_balances_month_format" CHECK ("account_balances"."month" ~ '^\d{4}-\d{2}$')
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_balances_account_month" ON "account_balances" USING btree ("account_id","month");