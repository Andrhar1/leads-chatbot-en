import type pg from "pg";

export interface UserRow {
  id: number;
  username: string;
  name: string;
  passwordHash: string;
}

function rowToUser(r: any): UserRow {
  return { id: r.id, username: r.username, name: r.name, passwordHash: r.password_hash };
}

export async function getUserByUsername(pool: pg.Pool, username: string): Promise<UserRow | null> {
  const { rows } = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

/** Buat user, atau update nama & password bila username sudah ada (dipakai seed admin). */
export async function createUser(
  pool: pg.Pool, username: string, name: string, passwordHash: string,
): Promise<UserRow> {
  const { rows } = await pool.query(
    `INSERT INTO users (username, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
     RETURNING *`,
    [username, name, passwordHash],
  );
  return rowToUser(rows[0]);
}
