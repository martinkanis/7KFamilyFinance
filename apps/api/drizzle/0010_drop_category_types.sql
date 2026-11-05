ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_type_id_category_types_id_fk";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "type_id";--> statement-breakpoint
DROP TABLE "category_types";
