import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { getOrCreateLeadByChatId, updateLead, getLeadById, listLeads } from "../src/db/leads.js";
import { insertMessage, listMessages, countInbound } from "../src/db/messages.js";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";
const pool = createPool(DB);

beforeAll(async () => { await migrate(DB); });
beforeEach(async () => { await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE"); });
afterAll(async () => { await pool.end(); });

describe("leads repo", () => {
  it("getOrCreate is idempotent per chatId", async () => {
    const a = await getOrCreateLeadByChatId(pool, "628111@c.us");
    const b = await getOrCreateLeadByChatId(pool, "628111@c.us");
    expect(a.id).toBe(b.id);
    expect(a.status).toBe("new");
  });

  it("update then list + filter", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628222@c.us");
    await updateLead(pool, lead.id, { industry: "Technology", legalNeed: "Intellectual Property", status: "collecting" });
    const got = await getLeadById(pool, lead.id);
    expect(got?.industry).toBe("Technology");
    const filtered = await listLeads(pool, { industry: "Technology" });
    expect(filtered).toHaveLength(1);
    const none = await listLeads(pool, { industry: "Real Estate" });
    expect(none).toHaveLength(0);
  });
});

describe("messages repo", () => {
  it("insert, list, countInbound", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628333@c.us");
    await insertMessage(pool, lead.id, "in", "hi");
    await insertMessage(pool, lead.id, "out", "welcome");
    await insertMessage(pool, lead.id, "in", "I'd like a consultation");
    expect(await listMessages(pool, lead.id)).toHaveLength(3);
    expect(await countInbound(pool, lead.id)).toBe(2);
  });
});
