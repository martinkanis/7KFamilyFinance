ALTER TABLE "categories" ADD COLUMN "parent" text;--> statement-breakpoint
-- Nadkategorie (typy kategorií) se mění na nadřazené kategorie stejného směru.
INSERT INTO "categories" ("direction", "name", "sort_order")
SELECT c."direction", t."name", MIN(c."sort_order")
FROM "categories" c JOIN "category_types" t ON t."id" = c."type_id"
GROUP BY c."direction", t."name"
ON CONFLICT ("direction", "name") DO NOTHING;--> statement-breakpoint
UPDATE "categories" c SET "parent" = t."name"
FROM "category_types" t
WHERE c."type_id" = t."id" AND c."name" <> t."name";
