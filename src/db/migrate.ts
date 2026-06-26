import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPool } from "./pool.js";
import { loadConfig } from "../config.js";

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate(databaseUrl: string): Promise<void> {
  const pool = createPool(databaseUrl);
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate(loadConfig().databaseUrl).then(() => console.log("migrated"));
}
