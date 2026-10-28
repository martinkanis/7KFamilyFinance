CREATE TYPE "public"."account_kind" AS ENUM('operating', 'savings');--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "kind" "account_kind" DEFAULT 'savings' NOT NULL;--> statement-breakpoint
-- Provozní = dosavadní platební účty a hotovost; ostatní zůstávají spořicí.
UPDATE "accounts" SET "kind" = 'operating' WHERE "payment_account" OR "type" ILIKE 'Hotovost%';
--> statement-breakpoint
UPDATE "accounts" SET "type" = 'Bankovní účet' WHERE "type" = 'Běžný účet';--> statement-breakpoint
UPDATE "accounts" SET "type" = 'Bankovní spořicí účet' WHERE "type" = 'Spořicí účet';
