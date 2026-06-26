import type pg from "pg";
import type { Message } from "../types.js";

function rowToMessage(r: any): Message {
  return { id: r.id, leadId: r.lead_id, direction: r.direction, body: r.body, createdAt: r.created_at };
}

export async function insertMessage(
  pool: pg.Pool, leadId: number, direction: "in" | "out", body: string,
): Promise<Message> {
  const { rows } = await pool.query(
    `INSERT INTO messages (lead_id, direction, body) VALUES ($1,$2,$3) RETURNING *`,
    [leadId, direction, body],
  );
  return rowToMessage(rows[0]);
}

export async function listMessages(pool: pg.Pool, leadId: number): Promise<Message[]> {
  const { rows } = await pool.query(`SELECT * FROM messages WHERE lead_id=$1 ORDER BY created_at ASC`, [leadId]);
  return rows.map(rowToMessage);
}

export async function countInbound(pool: pg.Pool, leadId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM messages WHERE lead_id=$1 AND direction='in'`, [leadId],
  );
  return rows[0].n;
}
