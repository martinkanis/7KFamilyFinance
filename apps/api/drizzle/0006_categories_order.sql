CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" "direction" NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "month_entries" ADD COLUMN "after_item_id" integer;--> statement-breakpoint
ALTER TABLE "month_entries" ADD COLUMN "sort_order" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_direction_name" ON "categories" USING btree ("direction","name");--> statement-breakpoint
ALTER TABLE "month_entries" ADD CONSTRAINT "month_entries_after_item_id_items_id_fk" FOREIGN KEY ("after_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;