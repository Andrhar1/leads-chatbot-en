/**
 * Reset leads & messages to 0 (clear everything, ids start from 1 again).
 * Run: npm run db:reset
 */
import { createPool } from "../src/db/pool.js";
import { loadConfig } from "../src/config.js";

const cfg = loadConfig();
const pool = createPool(cfg.databaseUrl);
await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE");
await pool.end();
console.log("✅ leads & messages cleared (ids reset to 1).");
