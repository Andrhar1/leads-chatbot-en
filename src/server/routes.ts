import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { getLeadById, listLeads, updateLead } from "../db/leads.js";
import { listMessages, insertMessage } from "../db/messages.js";
import { botSentKey } from "./webhook.js";
import type { Lead, Message } from "../types.js";

export interface RouteDeps {
  pool: pg.Pool;
  send: (chatId: string, text: string) => Promise<string>;
  emit: (event: "lead:updated" | "message:new", data: Lead | Message) => void;
  botSent: Set<string>;
}

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get("/leads", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return listLeads(deps.pool, { industry: q.industry, legalNeed: q.legalNeed, status: q.status, q: q.q });
  });

  app.get("/leads/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const lead = await getLeadById(deps.pool, id);
    if (!lead) return reply.code(404).send({ error: "not found" });
    const messages = await listMessages(deps.pool, id);
    return { lead, messages };
  });

  app.post("/leads/:id/reply", async (req, reply) => {
    const id = Number((req.params as any).id);
    const text = String((req.body as any)?.text ?? "").trim();
    const lead = await getLeadById(deps.pool, id);
    if (!lead) return reply.code(404).send({ error: "not found" });
    if (!text) return reply.code(400).send({ error: "text required" });
    deps.botSent.add(botSentKey(lead.waChatId, text)); // agar echo WAHA tidak dianggap balasan baru
    await deps.send(lead.waChatId, text);
    const out = await insertMessage(deps.pool, id, "out", text);
    const updated = await updateLead(deps.pool, id, { status: "handed_over" });
    deps.emit("message:new", out);
    deps.emit("lead:updated", updated);
    return out;
  });
}
