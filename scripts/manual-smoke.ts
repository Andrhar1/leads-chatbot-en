/**
 * Manual smoke test — runs the webhook pipeline end-to-end against local
 * Postgres, with DeepSeek & WAHA STUBBED (no API key / WAHA needed).
 *
 * Run: npx tsx scripts/manual-smoke.ts
 *
 * This is just a dev/manual helper — safe to delete at any time.
 */
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { listLeads } from "../src/db/leads.js";
import { listMessages } from "../src/db/messages.js";
import { makeHandleInbound } from "../src/server/webhook.js";
import type { Classification } from "../src/types.js";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";

// STUB DeepSeek: return a classification based on message content (no real API call).
const fakeClassify = async (transcript: string): Promise<Classification | null> => {
  const t = transcript.toLowerCase();
  if (t.includes("trademark") || t.includes("ip") || t.includes("patent")) {
    return { industry: "Technology", legalNeed: "Intellectual Property", personName: "John", companyName: "Acme Corp", confidence: 0.9 };
  }
  if (t.includes("employee") || t.includes("layoff")) {
    return { industry: "Manufacturing", legalNeed: "Employment", personName: "Sara", companyName: "Karya Inc", confidence: 0.85 };
  }
  return null; // triggers needsReview
};

// STUB WAHA: just print to the console, as if sending to WhatsApp.
const fakeSend = async (chatId: string, text: string) => {
  console.log(`  📤 [WAHA stub] to ${chatId}: ${text}`);
};

async function main() {
  const pool = createPool(DB);
  await migrate(DB);
  await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE");

  const handle = makeHandleInbound({
    pool,
    classify: fakeClassify,
    send: fakeSend,
    emit: (event, data) => console.log(`  🔔 emit ${event}: id=${(data as any).id}`),
    confidenceThreshold: 0.6,
    maxTurns: 4,
    processedIds: new Set<string>(),
    botSent: new Set<string>(),
  });

  console.log("\n=== Scenario 1: clear lead (IP) — should hand over immediately ===");
  await handle({ event: "message", payload: { id: "M1", from: "628111@c.us", body: "Hi, I'm John from Acme Corp, I'd like to register a trademark", fromMe: false } });

  console.log("\n=== Scenario 2: vague lead — should be needsReview & the bot asks ===");
  await handle({ event: "message", payload: { id: "M2", from: "628222@c.us", body: "hi, I have a question", fromMe: false } });

  console.log("\n=== Scenario 3: idempotency — send M1 again, should be ignored ===");
  await handle({ event: "message", payload: { id: "M1", from: "628111@c.us", body: "Hi, I'm John from Acme Corp, I'd like to register a trademark", fromMe: false } });

  console.log("\n================= DATABASE CONTENTS =================");
  const leads = await listLeads(pool, {});
  for (const lead of leads) {
    console.log(`\n#${lead.id} ${lead.waChatId}`);
    console.log(`  name=${lead.personName} company=${lead.companyName}`);
    console.log(`  industry=${lead.industry} legalNeed=${lead.legalNeed}`);
    console.log(`  status=${lead.status} confidence=${lead.confidence} needsReview=${lead.needsReview}`);
    const msgs = await listMessages(pool, lead.id);
    for (const m of msgs) console.log(`    [${m.direction}] ${m.body}`);
  }

  await pool.end();
  console.log("\n✅ done");
}

main().catch((e) => { console.error(e); process.exit(1); });
