import type pg from "pg";
import type { Lead } from "../types.js";

function rowToLead(r: any): Lead {
  return {
    id: r.id, waChatId: r.wa_chat_id, personName: r.person_name,
    companyName: r.company_name, industry: r.industry, legalNeed: r.legal_need,
    status: r.status, confidence: r.confidence, needsReview: r.needs_review,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getOrCreateLeadByChatId(pool: pg.Pool, waChatId: string): Promise<Lead> {
  const { rows } = await pool.query(
    `INSERT INTO leads (wa_chat_id) VALUES ($1)
     ON CONFLICT (wa_chat_id) DO UPDATE SET wa_chat_id = EXCLUDED.wa_chat_id
     RETURNING *`,
    [waChatId],
  );
  return rowToLead(rows[0]);
}

type LeadPatch = Partial<Pick<Lead,
  "personName" | "companyName" | "industry" | "legalNeed" | "status" | "confidence" | "needsReview">>;

export async function updateLead(pool: pg.Pool, id: number, patch: LeadPatch): Promise<Lead> {
  const map: Record<string, string> = {
    personName: "person_name", companyName: "company_name", industry: "industry",
    legalNeed: "legal_need", status: "status", confidence: "confidence", needsReview: "needs_review",
  };
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${map[k]} = $${sets.length + 1}`);
    vals.push(v);
  }
  sets.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE leads SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals,
  );
  return rowToLead(rows[0]);
}

export async function getLeadById(pool: pg.Pool, id: number): Promise<Lead | null> {
  const { rows } = await pool.query(`SELECT * FROM leads WHERE id = $1`, [id]);
  return rows[0] ? rowToLead(rows[0]) : null;
}

export async function listLeads(
  pool: pg.Pool,
  filter: { industry?: string; legalNeed?: string; status?: string; q?: string },
): Promise<Lead[]> {
  const where: string[] = [];
  const vals: any[] = [];
  if (filter.industry) { vals.push(filter.industry); where.push(`industry = $${vals.length}`); }
  if (filter.legalNeed) { vals.push(filter.legalNeed); where.push(`legal_need = $${vals.length}`); }
  if (filter.status) { vals.push(filter.status); where.push(`status = $${vals.length}`); }
  if (filter.q) { vals.push(`%${filter.q}%`); where.push(`(person_name ILIKE $${vals.length} OR company_name ILIKE $${vals.length})`); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await pool.query(`SELECT * FROM leads ${clause} ORDER BY updated_at DESC`, vals);
  return rows.map(rowToLead);
}
