CREATE TABLE "category_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "payment_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payment_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "type_id" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "payment_type_id" integer;--> statement-breakpoint
ALTER TABLE "month_entries" ADD COLUMN "payment_type_id" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_type_id_category_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."category_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_payment_type_id_payment_types_id_fk" FOREIGN KEY ("payment_type_id") REFERENCES "public"."payment_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_entries" ADD CONSTRAINT "month_entries_payment_type_id_payment_types_id_fk" FOREIGN KEY ("payment_type_id") REFERENCES "public"."payment_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "category_types" ("name", "sort_order") VALUES ('Investiční nemovitosti', 1), ('Osobní spotřeba', 2), ('Půjčky a pojistky', 3);--> statement-breakpoint
INSERT INTO "payment_types" ("name", "sort_order") VALUES ('Energie – elektřina', 1), ('Nájmy', 2), ('Hypotéky', 3), ('Úvěry & půjčky', 4);
