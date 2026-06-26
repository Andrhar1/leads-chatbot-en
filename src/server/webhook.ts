import type pg from "pg";
import { parseWebhook } from "../waha/connector.js";
import { getOrCreateLeadByChatId, updateLead } from "../db/leads.js";
import { insertMessage, listMessages, countInbound } from "../db/messages.js";
import { nextAction } from "../conversation/engine.js";
import type { Classification, Lead, Message } from "../types.js";

/** Key to recognize the bot's own echoed message: chatId + message body (trimmed). */
export function botSentKey(chatId: string, body: string): string {
  return `${chatId} ${body.trim()}`;
}

export interface InboundDeps {
  pool: pg.Pool;
  classify: (transcript: string) => Promise<Classification | null>;
  send: (chatId: string, text: string) => Promise<string>;
  emit: (event: "lead:updated" | "message:new", data: Lead | Message) => void;
  confidenceThreshold: number;
  maxTurns: number;
  processedIds: Set<string>;
  /** Keys (chatId+body) of messages sent by the bot/dashboard, so a WAHA echo isn't treated as a human reply. */
  botSent: Set<string>;
}

export function makeHandleInbound(deps: InboundDeps) {
  return async function handleInbound(payload: unknown): Promise<void> {
    const parsed = parseWebhook(payload);
    if (!parsed) return;
    if (deps.processedIds.has(parsed.messageId)) return;
    deps.processedIds.add(parsed.messageId);

    // Outbound message (fromMe): could be the bot's echo, or a human reply from WhatsApp.
    if (parsed.fromMe) {
      if (deps.botSent.has(botSentKey(parsed.chatId, parsed.body))) return; // bot echo → ignore
      // Human reply directly from WhatsApp → hand over to a human, bot stops.
      let lead = await getOrCreateLeadByChatId(deps.pool, parsed.chatId);
      const out = await insertMessage(deps.pool, lead.id, "out", parsed.body);
      deps.emit("message:new", out);
      lead = await updateLead(deps.pool, lead.id, { status: "handed_over" });
      deps.emit("lead:updated", lead);
      return;
    }

    let lead = await getOrCreateLeadByChatId(deps.pool, parsed.chatId);
    const inbound = await insertMessage(deps.pool, lead.id, "in", parsed.body);
    deps.emit("message:new", inbound);

    // Bot is already done (closing sent / handed over to a human) → stop replying
    // automatically. Messages are still stored & shown to the team.
    if (lead.status === "ready_for_handover" || lead.status === "handed_over") {
      deps.emit("lead:updated", lead);
      return;
    }

    const transcript = (await listMessages(deps.pool, lead.id)).map((m) => m.body).join("\n");
    const cls = await deps.classify(transcript);

    if (cls) {
      lead = await updateLead(deps.pool, lead.id, {
        industry: cls.industry ?? lead.industry,
        legalNeed: cls.legalNeed ?? lead.legalNeed,
        personName: cls.personName ?? lead.personName,
        companyName: cls.companyName ?? lead.companyName,
        confidence: cls.confidence, needsReview: false,
      });
    } else {
      lead = await updateLead(deps.pool, lead.id, { needsReview: true });
    }

    const turnCount = await countInbound(deps.pool, lead.id);
    const action = nextAction(lead, turnCount, {
      confidenceThreshold: deps.confidenceThreshold, maxTurns: deps.maxTurns,
    });
    lead = await updateLead(deps.pool, lead.id, { status: action.newStatus });

    if (action.reply) {
      deps.botSent.add(botSentKey(parsed.chatId, action.reply)); // mark before sending, so a fast echo is still caught
      await deps.send(parsed.chatId, action.reply);
      const out = await insertMessage(deps.pool, lead.id, "out", action.reply);
      deps.emit("message:new", out);
    }
    deps.emit("lead:updated", lead);
  };
}
