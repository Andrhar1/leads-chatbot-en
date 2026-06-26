/**
 * Create or reset a login account (admin only).
 * Run (use node directly so names with spaces aren't split by npm):
 *   node --env-file=.env --import tsx scripts/seed-user.ts <username> "<Full Name>" <password>
 */
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { loadConfig } from "../src/config.js";
import { hashPassword } from "../src/auth/password.js";
import { createUser } from "../src/db/users.js";

const [, , username, name, password] = process.argv;
if (!username || !name || !password) {
  console.error('Usage: node --env-file=.env --import tsx scripts/seed-user.ts <username> "<Full Name>" <password>');
  process.exit(1);
}

const cfg = loadConfig();
await migrate(cfg.databaseUrl);
const pool = createPool(cfg.databaseUrl);
const hash = await hashPassword(password);
const user = await createUser(pool, username, name, hash);
await pool.end();
console.log(`✅ user '${user.username}' (id=${user.id}) is ready to log in.`);
