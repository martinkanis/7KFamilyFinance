ALTER TABLE "accounts" ADD COLUMN "payment_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Výchozí stav: platí se z běžných účtů, ostatní jsou jen místa, kde máme peníze.
UPDATE "accounts" SET "payment_account" = true WHERE "type" ILIKE 'Běžný%';
