import { randomBytes } from "node:crypto";
import type pg from "pg";

export interface SessionUser {
  id: number;
  username: string;
  name: string;
}

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

/** Buat sesi baru (token acak opaque) dan simpan ke DB. */
export async function createSession(pool: pg.Pool, userId: number): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [id, userId, expiresAt],
  );
  return { id, expiresAt };
}

/** Get the user from a session; null if missing or expired (expired sessions are deleted). */
export async function getSessionUser(pool: pg.Pool, sessionId: string): Promise<SessionUser | null> {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await deleteSession(pool, sessionId);
    return null;
  }
  return { id: row.id, username: row.username, name: row.name };
}

export async function deleteSession(pool: pg.Pool, sessionId: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}
