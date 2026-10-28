import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

export const pool = new Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: config.migrationsDir });
}
