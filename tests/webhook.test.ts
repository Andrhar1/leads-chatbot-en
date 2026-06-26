import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { listMessages, countInbound } from "../src/db/messages.js";
import { getLeadById, listLeads, getOrCreateLeadByChatId, updateLead } from "../src/db/leads.js";
import { makeHandleInbound, botSentKey } from "../src/server/webhook.js";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";
const pool = createPool(DB);

beforeAll(async () => { await migrate(DB); });
beforeEach(async () => { await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE"); });
afterAll(async () => { await pool.end(); });

function deps(over: Partial<any> = {}) {
  return {
    pool,
    classify: vi.fn(async () => ({ industry: "Technology", legalNeed: "Intellectual Property", personName: "John", companyName: "Acme Corp", confidence: 0.9 })),
    send: vi.fn(async () => "OUTID"),
    emit: vi.fn(),
    confidenceThreshold: 0.6,
    maxTurns: 4,
    processedIds: new Set<string>(),
    botSent: new Set<string>(),
    ...over,
  };
}

function incoming(id: string, body: string) {
  return { event: "message", payload: { id, from: "628111@c.us", body, fromMe: false } };
}
function outgoing(id: string, body: string) {
  return { event: "message.any", payload: { id, from: "628000@c.us", to: "628111@c.us", body, fromMe: true } };
}

describe("handleInbound", () => {
  it("confident classification → store, handover, send closing", async () => {
    const d = deps();
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "Hi, I'm John from Acme Corp, I'd like to register a trademark"));
    const [lead] = await listLeads(pool, {});
    expect(lead.industry).toBe("Technology");
    expect(lead.status).toBe("ready_for_handover");
    expect(d.send).toHaveBeenCalledOnce();
    const msgs = await listMessages(pool, lead.id);
    expect(msgs.map(m => m.direction)).toEqual(["in", "out"]);
  });

  it("legal need not mentioned yet → legalNeed stays null & bot asks for it", async () => {
    const d = deps({ classify: vi.fn(async () => ({ industry: "Technology", legalNeed: null, personName: "John", companyName: "Acme Corp", confidence: 0.3 })) });
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "Hi, I'm John from Acme Corp"));
    const [lead] = await listLeads(pool, {});
    expect(lead.legalNeed).toBeNull();
    expect(lead.status).toBe("collecting");
    const out = (await listMessages(pool, lead.id)).find((m) => m.direction === "out");
    expect(out?.body).toMatch(/legal|help/i);
  });

  it("already-collected legalNeed isn't lost even if the next classification is null", async () => {
    const d = deps({
      classify: vi.fn()
        .mockResolvedValueOnce({ industry: null, legalNeed: "Intellectual Property", personName: "John", companyName: null, confidence: 0.4 })
        .mockResolvedValueOnce({ industry: "Technology", legalNeed: null, personName: "John", companyName: "Acme Corp", confidence: 0.5 }),
    });
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "I'm John, I want to register a trademark"));
    let [lead] = await listLeads(pool, {});
    expect(lead.legalNeed).toBe("Intellectual Property");
    await handle(incoming("M2", "my company is Acme Corp, in technology"));
    [lead] = await listLeads(pool, {});
    expect(lead.legalNeed).toBe("Intellectual Property"); // not nulled by the next classification
    expect(lead.industry).toBe("Technology");
  });

  it("idempotent: the same messageId isn't processed twice", async () => {
    const d = deps();
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "hi"));
    await handle(incoming("M1", "hi"));
    const [lead] = await listLeads(pool, {});
    expect(await countInbound(pool, lead.id)).toBe(1);
  });

  it("classify null → lead flagged needsReview, still asks a question", async () => {
    const d = deps({ classify: vi.fn(async () => null) });
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "hi"));
    const [lead] = await listLeads(pool, {});
    expect(lead.needsReview).toBe(true);
    expect(lead.status).toBe("collecting");
    expect(d.send).toHaveBeenCalledOnce();
  });

  it("after bot sends closing (ready_for_handover) → next inbound is NOT replied to", async () => {
    const d = deps(); // confident classify → handover on the first message
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "Hi, I'm John from Acme Corp, I'd like to register a trademark"));
    const [lead] = await listLeads(pool, {});
    expect(lead.status).toBe("ready_for_handover");
    expect(d.send).toHaveBeenCalledOnce(); // closing sent once
    d.send.mockClear();

    await handle(incoming("M2", "hello, still there?")); // customer chats again
    const after = await getLeadById(pool, lead.id);
    expect(after?.status).toBe("ready_for_handover");
    expect(d.send).not.toHaveBeenCalled(); // bot stays silent, doesn't send closing again
    const ins = (await listMessages(pool, lead.id)).filter(m => m.direction === "in");
    expect(ins).toHaveLength(2); // customer message still stored for the team
  });

  it("lead handed_over → inbound stored but bot does NOT reply", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628111@c.us");
    await updateLead(pool, lead.id, { status: "handed_over" });
    const d = deps();
    const handle = makeHandleInbound(d);
    await handle(incoming("M9", "hello again"));
    const after = await getLeadById(pool, lead.id);
    expect(after?.status).toBe("handed_over");
    expect(d.send).not.toHaveBeenCalled();
    const msgs = await listMessages(pool, lead.id);
    expect(msgs.map(m => m.direction)).toEqual(["in"]); // only inbound, no bot reply
  });

  it("human reply from WhatsApp (fromMe, not a bot message) → set handed_over, store as 'out'", async () => {
    const d = deps();
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "hi")); // bot asks a question (status collecting)
    d.send.mockClear();
    await handle(outgoing("H1", "Hello, our lawyer will assist you")); // human replies from WA
    const [lead] = await listLeads(pool, {});
    expect(lead.status).toBe("handed_over");
    const msgs = await listMessages(pool, lead.id);
    expect(msgs.some(m => m.direction === "out" && m.body.includes("lawyer"))).toBe(true);
    expect(d.send).not.toHaveBeenCalled(); // bot doesn't also send
  });

  it("echo of the bot's own reply (message.any, same body) → ignored, NOT handed_over", async () => {
    const d = deps({ classify: vi.fn(async () => null) });
    const handle = makeHandleInbound(d);
    await handle(incoming("M1", "hi")); // bot asks a question, status collecting
    const [lead0] = await listLeads(pool, {});
    const botMsg = (await listMessages(pool, lead0.id)).find(m => m.direction === "out")!;
    // WAHA echoes the bot's own reply back as an outbound message (fromMe)
    await handle(outgoing("ECHO1", botMsg.body));
    const after = await getLeadById(pool, lead0.id);
    expect(after?.status).toBe("collecting"); // doesn't change to handed_over
    const outs = (await listMessages(pool, lead0.id)).filter(m => m.direction === "out");
    expect(outs).toHaveLength(1); // echo doesn't add an outbound message
  });

  it("echo via already-marked botSent (e.g. a dashboard reply) → ignored", async () => {
    const d = deps({ botSent: new Set<string>([botSentKey("628111@c.us", "Hello from the team")]) });
    const handle = makeHandleInbound(d);
    await handle(outgoing("ECHO2", "Hello from the team"));
    const leads = await listLeads(pool, {});
    if (leads.length) {
      expect(leads[0].status).not.toBe("handed_over");
      expect(await listMessages(pool, leads[0].id)).toHaveLength(0);
    }
  });
});
