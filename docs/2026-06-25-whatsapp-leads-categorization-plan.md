# WhatsApp Leads Categorization Chatbot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun sistem yang menerima chat WhatsApp dari leads (via WAHA), mengategorikan tiap lead (industry + kebutuhan hukum + nama/perusahaan) dengan DeepSeek, menyimpannya ke PostgreSQL, dan menampilkannya di dashboard web tempat tim bisa membalas lead langsung.

**Architecture:** Backend Node.js/TypeScript (Fastify) menerima webhook WAHA → Conversation Engine (state machine) menentukan balasan → Classifier Service memanggil DeepSeek (JSON output, divalidasi Zod) → hasil disimpan ke Postgres → update di-push ke dashboard Next.js via Socket.io. Bot bersifat hybrid: kumpulkan info inti otomatis, lalu handover ke tim.

**Tech Stack:** Node.js 20, TypeScript (strict), Fastify, Socket.io, `pg` (node-postgres), `openai` SDK (base URL DeepSeek), Zod, Vitest, Next.js (App Router) + socket.io-client, Docker Compose (WAHA + Postgres).

Spec acuan: `docs/2026-06-25-whatsapp-leads-categorization-design.md`.

## Global Constraints

- Node.js **20+**, package manager **npm**, TypeScript `strict: true`.
- Provider AI: **DeepSeek**, model `deepseek-chat`, base URL `https://api.deepseek.com`, diakses via paket `openai`.
- Ambang confidence handover = **0.6**. Giliran maksimum (jumlah pesan masuk dari lead) sebelum paksa handover = **4**.
- Industry enum (verbatim): `Manufaktur`, `Properti`, `Fintech/Keuangan`, `F&B`, `Kesehatan`, `Teknologi`, `Energi`, `Ritel`, `Lainnya`.
- LegalNeed enum (verbatim): `Korporat/M&A`, `Litigasi`, `Ketenagakerjaan`, `HKI`, `Perizinan/Regulasi`, `Kontrak`, `Lainnya`.
- Lead status enum: `new`, `collecting`, `ready_for_handover`, `handed_over`.
- Semua pesan bot ke lead dalam **Bahasa Indonesia**. Bot fase aktif = murni pengumpul info; **tidak** menjawab pertanyaan hukum.
- Test framework: **Vitest**. Test DB & WAHA & DeepSeek di-mock pada unit test; webhook flow diuji integrasi dengan dependency di-inject (di-mock).

## File Structure

```
docker-compose.yml          # WAHA + Postgres (dev)
package.json, tsconfig.json, vitest.config.ts, .env.example
src/
  config.ts                 # load & validasi env (Zod)
  types.ts                  # tipe domain bersama (Lead, Message, enums, Classification)
  db/
    pool.ts                 # pg Pool singleton
    schema.sql              # DDL leads + messages
    migrate.ts              # apply schema.sql
    leads.ts                # LeadsRepo (CRUD)
    messages.ts             # MessagesRepo (CRUD)
  classifier/
    classifier.ts           # classify(transcript) via DeepSeek + Zod
  conversation/
    engine.ts               # nextAction(lead, turnCount)
  waha/
    connector.ts            # parseWebhook(), sendMessage()
  server/
    app.ts                  # build Fastify app + socket.io
    webhook.ts              # orchestrator handler
    routes.ts               # REST: GET /leads, GET /leads/:id, POST /leads/:id/reply
    index.ts                # entrypoint (listen)
tests/
  config.test.ts
  classifier.test.ts
  engine.test.ts
  waha.test.ts
  webhook.test.ts
  db.integration.test.ts
web/                        # Next.js dashboard (app terpisah)
  package.json, next.config.js, tsconfig.json
  app/page.tsx              # daftar leads + filter
  app/leads/[id]/page.tsx   # detail + live chat
  lib/api.ts                # fetch helper
  lib/socket.ts             # socket.io-client
```

Catatan: dashboard dibuat sebagai Next.js app terpisah di `web/` (bukan `src/web/`) agar build backend (tsx/vitest) dan frontend (Next) tidak saling mengganggu. Ini penyesuaian kecil dari spec.

---

### Task 1: Project scaffolding & config

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`, `docker-compose.yml`
- Create: `src/config.ts`, `src/types.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(): AppConfig` dari `src/config.ts` dengan field `databaseUrl`, `deepseekApiKey`, `wahaBaseUrl`, `wahaSession`, `wahaApiKey`, `port`, `confidenceThreshold`, `maxTurns`.
- Produces: tipe domain di `src/types.ts`: `Industry`, `LegalNeed`, `LeadStatus`, `Lead`, `Message`, `Classification`, `INDUSTRIES`, `LEGAL_NEEDS`.

- [ ] **Step 1: Inisialisasi project & dependencies**

```bash
npm init -y
npm pkg set type=module
npm install fastify @fastify/cors socket.io pg openai zod
npm install -D typescript tsx vitest @types/node @types/pg
```

- [ ] **Step 2: Tulis `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Tulis `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Tulis `.env.example` dan `.gitignore`**

`.env.example`:
```
DATABASE_URL=postgres://app:app@localhost:5432/leads
DEEPSEEK_API_KEY=sk-xxxx
WAHA_BASE_URL=http://localhost:3000
WAHA_SESSION=default
WAHA_API_KEY=
PORT=4000
```

`.gitignore`:
```
node_modules
dist
.env
web/.next
```

- [ ] **Step 5: Tulis `src/types.ts`**

```ts
export const INDUSTRIES = [
  "Manufaktur", "Properti", "Fintech/Keuangan", "F&B", "Kesehatan",
  "Teknologi", "Energi", "Ritel", "Lainnya",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const LEGAL_NEEDS = [
  "Korporat/M&A", "Litigasi", "Ketenagakerjaan", "HKI",
  "Perizinan/Regulasi", "Kontrak", "Lainnya",
] as const;
export type LegalNeed = (typeof LEGAL_NEEDS)[number];

export type LeadStatus = "new" | "collecting" | "ready_for_handover" | "handed_over";

export interface Lead {
  id: number;
  waChatId: string;
  personName: string | null;
  companyName: string | null;
  industry: Industry | null;
  legalNeed: LegalNeed | null;
  status: LeadStatus;
  confidence: number | null;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  leadId: number;
  direction: "in" | "out";
  body: string;
  createdAt: string;
}

export interface Classification {
  industry: Industry;
  legalNeed: LegalNeed;
  personName: string | null;
  companyName: string | null;
  confidence: number;
}
```

- [ ] **Step 6: Tulis test `tests/config.test.ts` (failing)**

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("memakai default untuk port, confidenceThreshold, maxTurns", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgres://x",
      DEEPSEEK_API_KEY: "k",
      WAHA_BASE_URL: "http://w",
      WAHA_SESSION: "default",
    });
    expect(cfg.port).toBe(4000);
    expect(cfg.confidenceThreshold).toBe(0.6);
    expect(cfg.maxTurns).toBe(4);
  });

  it("error kalau DATABASE_URL kosong", () => {
    expect(() => loadConfig({} as any)).toThrow();
  });
});
```

- [ ] **Step 7: Run test, pastikan FAIL**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL ("Cannot find module ../src/config.js" / loadConfig undefined)

- [ ] **Step 8: Tulis `src/config.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DEEPSEEK_API_KEY: z.string().min(1),
  WAHA_BASE_URL: z.string().min(1),
  WAHA_SESSION: z.string().default("default"),
  WAHA_API_KEY: z.string().optional().default(""),
  PORT: z.coerce.number().default(4000),
});

export interface AppConfig {
  databaseUrl: string;
  deepseekApiKey: string;
  wahaBaseUrl: string;
  wahaSession: string;
  wahaApiKey: string;
  port: number;
  confidenceThreshold: number;
  maxTurns: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = schema.parse(env);
  return {
    databaseUrl: e.DATABASE_URL,
    deepseekApiKey: e.DEEPSEEK_API_KEY,
    wahaBaseUrl: e.WAHA_BASE_URL,
    wahaSession: e.WAHA_SESSION,
    wahaApiKey: e.WAHA_API_KEY,
    port: e.PORT,
    confidenceThreshold: 0.6,
    maxTurns: 4,
  };
}
```

- [ ] **Step 9: Run test, pastikan PASS**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 10: Tulis `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: leads
    ports: ["5432:5432"]
  waha:
    image: devlikeapro/waha:latest
    ports: ["3000:3000"]
    environment:
      WHATSAPP_HOOK_URL: http://host.docker.internal:4000/webhook/waha
      WHATSAPP_HOOK_EVENTS: message
```

- [ ] **Step 11: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project, config, domain types"
```

---

### Task 2: Database schema & repositories

**Files:**
- Create: `src/db/schema.sql`, `src/db/pool.ts`, `src/db/migrate.ts`, `src/db/leads.ts`, `src/db/messages.ts`
- Test: `tests/db.integration.test.ts`

**Interfaces:**
- Consumes: `Lead`, `Message`, `Industry`, `LegalNeed`, `LeadStatus` dari `src/types.ts`.
- Produces (`src/db/leads.ts`):
  - `getOrCreateLeadByChatId(pool, waChatId): Promise<Lead>`
  - `updateLead(pool, id, patch: Partial<Pick<Lead,"personName"|"companyName"|"industry"|"legalNeed"|"status"|"confidence"|"needsReview">>): Promise<Lead>`
  - `getLeadById(pool, id): Promise<Lead | null>`
  - `listLeads(pool, filter: { industry?; legalNeed?; status?; q? }): Promise<Lead[]>`
- Produces (`src/db/messages.ts`):
  - `insertMessage(pool, leadId, direction:"in"|"out", body): Promise<Message>`
  - `listMessages(pool, leadId): Promise<Message[]>`
  - `countInbound(pool, leadId): Promise<number>`
- Produces (`src/db/pool.ts`): `createPool(databaseUrl): Pool`.

> Test ini **integrasi** dan butuh Postgres dari `docker-compose`. Jalankan `docker compose up -d postgres` lebih dulu. Test memakai `DATABASE_URL` (default ke Postgres dev) dan `TRUNCATE` di tiap test.

- [ ] **Step 1: Tulis `src/db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS leads (
  id           SERIAL PRIMARY KEY,
  wa_chat_id   TEXT UNIQUE NOT NULL,
  person_name  TEXT,
  company_name TEXT,
  industry     TEXT,
  legal_need   TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  confidence   REAL,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('in','out')),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
```

- [ ] **Step 2: Tulis `src/db/pool.ts`**

```ts
import pg from "pg";

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}
```

- [ ] **Step 3: Tulis `src/db/migrate.ts`**

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPool } from "./pool.js";
import { loadConfig } from "../config.js";

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate(databaseUrl: string): Promise<void> {
  const pool = createPool(databaseUrl);
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate(loadConfig().databaseUrl).then(() => console.log("migrated"));
}
```

- [ ] **Step 4: Tambah script di `package.json`**

```bash
npm pkg set scripts.migrate="tsx src/db/migrate.ts"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.dev="tsx watch src/server/index.ts"
```

- [ ] **Step 5: Tulis test `tests/db.integration.test.ts` (failing)**

```ts
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
  it("getOrCreate idempoten per chatId", async () => {
    const a = await getOrCreateLeadByChatId(pool, "628111@c.us");
    const b = await getOrCreateLeadByChatId(pool, "628111@c.us");
    expect(a.id).toBe(b.id);
    expect(a.status).toBe("new");
  });

  it("update lalu list + filter", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628222@c.us");
    await updateLead(pool, lead.id, { industry: "Teknologi", legalNeed: "HKI", status: "collecting" });
    const got = await getLeadById(pool, lead.id);
    expect(got?.industry).toBe("Teknologi");
    const filtered = await listLeads(pool, { industry: "Teknologi" });
    expect(filtered).toHaveLength(1);
    const none = await listLeads(pool, { industry: "Properti" });
    expect(none).toHaveLength(0);
  });
});

describe("messages repo", () => {
  it("insert, list, countInbound", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628333@c.us");
    await insertMessage(pool, lead.id, "in", "halo");
    await insertMessage(pool, lead.id, "out", "selamat datang");
    await insertMessage(pool, lead.id, "in", "mau konsultasi");
    expect(await listMessages(pool, lead.id)).toHaveLength(3);
    expect(await countInbound(pool, lead.id)).toBe(2);
  });
});
```

- [ ] **Step 6: Run test, pastikan FAIL**

Run: `docker compose up -d postgres && npx vitest run tests/db.integration.test.ts`
Expected: FAIL (modul leads/messages belum ada)

- [ ] **Step 7: Tulis `src/db/leads.ts`**

```ts
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
```

- [ ] **Step 8: Tulis `src/db/messages.ts`**

```ts
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
```

- [ ] **Step 9: Run test, pastikan PASS**

Run: `npx vitest run tests/db.integration.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 10: Commit**

```bash
git add src/db tests/db.integration.test.ts package.json docker-compose.yml
git commit -m "feat: postgres schema, migrate, leads/messages repositories"
```

---

### Task 3: Classifier Service (DeepSeek + Zod)

**Files:**
- Create: `src/classifier/classifier.ts`
- Test: `tests/classifier.test.ts`

**Interfaces:**
- Consumes: `Classification`, `INDUSTRIES`, `LEGAL_NEEDS` dari `src/types.ts`.
- Produces:
  - `makeClassifier(client: ChatClient): (transcript: string) => Promise<Classification | null>`
  - `ChatClient` = `{ chat: { completions: { create(args): Promise<{ choices: { message: { content: string | null } }[] }> } } }` — sengaja dibuat minimal agar gampang di-mock; di produksi diisi instance `openai`.
  - `createDeepSeekClient(apiKey): ChatClient` (membungkus `new OpenAI({ baseURL, apiKey })`).
- Mengembalikan `null` bila JSON tidak valid atau gagal validasi Zod (lead akan ditandai `needsReview` oleh orchestrator).

- [ ] **Step 1: Tulis test `tests/classifier.test.ts` (failing)**

```ts
import { describe, it, expect } from "vitest";
import { makeClassifier } from "../src/classifier/classifier.js";

function fakeClient(content: string | null) {
  return { chat: { completions: { create: async () => ({ choices: [{ message: { content } }] }) } } };
}

describe("classifier", () => {
  it("mengembalikan Classification valid", async () => {
    const client = fakeClient(JSON.stringify({
      industry: "Teknologi", legalNeed: "HKI",
      personName: "Budi", companyName: "PT Maju", confidence: 0.9,
    }));
    const classify = makeClassifier(client as any);
    const r = await classify("Halo saya Budi dari PT Maju, mau daftar merek dagang");
    expect(r).toEqual({ industry: "Teknologi", legalNeed: "HKI", personName: "Budi", companyName: "PT Maju", confidence: 0.9 });
  });

  it("null kalau enum tidak valid", async () => {
    const client = fakeClient(JSON.stringify({
      industry: "Astronot", legalNeed: "HKI", personName: null, companyName: null, confidence: 0.5,
    }));
    const classify = makeClassifier(client as any);
    expect(await classify("...")).toBeNull();
  });

  it("null kalau bukan JSON", async () => {
    const classify = makeClassifier(fakeClient("maaf saya tidak bisa") as any);
    expect(await classify("...")).toBeNull();
  });

  it("null kalau content kosong", async () => {
    const classify = makeClassifier(fakeClient(null) as any);
    expect(await classify("...")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL (makeClassifier belum ada)

- [ ] **Step 3: Tulis `src/classifier/classifier.ts`**

```ts
import OpenAI from "openai";
import { z } from "zod";
import { INDUSTRIES, LEGAL_NEEDS, type Classification } from "../types.js";

export interface ChatClient {
  chat: { completions: { create(args: any): Promise<{ choices: { message: { content: string | null } }[] }> } };
}

const resultSchema = z.object({
  industry: z.enum(INDUSTRIES),
  legalNeed: z.enum(LEGAL_NEEDS),
  personName: z.string().min(1).nullable(),
  companyName: z.string().min(1).nullable(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `Anda adalah asisten klasifikasi leads untuk sebuah firma hukum di Indonesia.
Dari transkrip percakapan WhatsApp, tentukan:
- industry: salah satu dari ${INDUSTRIES.join(", ")}
- legalNeed: salah satu dari ${LEGAL_NEEDS.join(", ")}
- personName: nama perorangan jika disebut, selain itu null
- companyName: nama perusahaan jika disebut, selain itu null
- confidence: angka 0..1 seberapa yakin Anda dengan klasifikasi industry & legalNeed
Balas HANYA dengan satu objek JSON valid sesuai field di atas. Jangan mengarang; jika tidak yakin pakai "Lainnya" untuk enum dan null untuk nama.`;

export function makeClassifier(client: ChatClient) {
  return async function classify(transcript: string): Promise<Classification | null> {
    const res = await client.chat.completions.create({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { return null; }
    const v = resultSchema.safeParse(parsed);
    return v.success ? v.data : null;
  };
}

export function createDeepSeekClient(apiKey: string): ChatClient {
  return new OpenAI({ baseURL: "https://api.deepseek.com", apiKey }) as unknown as ChatClient;
}
```

- [ ] **Step 4: Run test, pastikan PASS**

Run: `npx vitest run tests/classifier.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/classifier tests/classifier.test.ts
git commit -m "feat: deepseek classifier with zod validation"
```

---

### Task 4: Conversation Engine (state machine)

**Files:**
- Create: `src/conversation/engine.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `Lead`, `LeadStatus` dari `src/types.ts`; konstanta `confidenceThreshold` (0.6) & `maxTurns` (4) di-inject.
- Produces: `nextAction(lead: Lead, turnCount: number, opts?: { confidenceThreshold?: number; maxTurns?: number }): { reply?: string; newStatus: LeadStatus }`.

Aturan (urut prioritas):
1. `coreFilled` = `(personName || companyName) && industry && legalNeed`.
2. Jika `coreFilled && (confidence ?? 0) >= confidenceThreshold` → `ready_for_handover` + reply pesan penutup.
3. Jika `turnCount >= maxTurns` → `ready_for_handover` + reply pesan penutup.
4. Selain itu → `collecting` + reply pertanyaan untuk field yang masih kosong (urut: nama/perusahaan → kebutuhan hukum → industry).

Pesan penutup (verbatim): `"Terima kasih atas informasinya. Tim kami akan segera menghubungi Anda. 🙏"`.

- [ ] **Step 1: Tulis test `tests/engine.test.ts` (failing)**

```ts
import { describe, it, expect } from "vitest";
import { nextAction } from "../src/conversation/engine.js";
import type { Lead } from "../src/types.js";

function lead(p: Partial<Lead>): Lead {
  return {
    id: 1, waChatId: "x", personName: null, companyName: null, industry: null,
    legalNeed: null, status: "collecting", confidence: null, needsReview: false,
    createdAt: "", updatedAt: "", ...p,
  };
}

const CLOSING = "Terima kasih atas informasinya. Tim kami akan segera menghubungi Anda. 🙏";

describe("nextAction", () => {
  it("handover kalau core lengkap & confidence >= 0.6", () => {
    const a = nextAction(lead({ personName: "Budi", industry: "Teknologi", legalNeed: "HKI", confidence: 0.8 }), 2);
    expect(a.newStatus).toBe("ready_for_handover");
    expect(a.reply).toBe(CLOSING);
  });

  it("tetap tanya kalau confidence < 0.6 walau core terisi", () => {
    const a = nextAction(lead({ personName: "Budi", industry: "Teknologi", legalNeed: "HKI", confidence: 0.4 }), 2);
    expect(a.newStatus).toBe("collecting");
    expect(a.reply).toBeTruthy();
  });

  it("paksa handover di giliran ke-4 walau info kurang", () => {
    const a = nextAction(lead({}), 4);
    expect(a.newStatus).toBe("ready_for_handover");
    expect(a.reply).toBe(CLOSING);
  });

  it("tanya nama/perusahaan kalau keduanya kosong", () => {
    const a = nextAction(lead({}), 1);
    expect(a.newStatus).toBe("collecting");
    expect(a.reply).toMatch(/nama|perusahaan/i);
  });

  it("tanya kebutuhan hukum kalau identitas ada tapi legalNeed kosong", () => {
    const a = nextAction(lead({ personName: "Budi", industry: "Teknologi" }), 2);
    expect(a.reply).toMatch(/hukum|bantu/i);
  });
});
```

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npx vitest run tests/engine.test.ts`
Expected: FAIL (nextAction belum ada)

- [ ] **Step 3: Tulis `src/conversation/engine.ts`**

```ts
import type { Lead, LeadStatus } from "../types.js";

const CLOSING = "Terima kasih atas informasinya. Tim kami akan segera menghubungi Anda. 🙏";

export interface NextAction { reply?: string; newStatus: LeadStatus; }

export function nextAction(
  lead: Lead,
  turnCount: number,
  opts: { confidenceThreshold?: number; maxTurns?: number } = {},
): NextAction {
  const threshold = opts.confidenceThreshold ?? 0.6;
  const maxTurns = opts.maxTurns ?? 4;

  const hasIdentity = Boolean(lead.personName || lead.companyName);
  const coreFilled = hasIdentity && Boolean(lead.industry) && Boolean(lead.legalNeed);

  if (coreFilled && (lead.confidence ?? 0) >= threshold) {
    return { reply: CLOSING, newStatus: "ready_for_handover" };
  }
  if (turnCount >= maxTurns) {
    return { reply: CLOSING, newStatus: "ready_for_handover" };
  }

  let reply: string;
  if (!hasIdentity) {
    reply = "Halo! Terima kasih sudah menghubungi kami. Boleh saya tahu nama Anda dan nama perusahaan/instansi (jika ada)?";
  } else if (!lead.legalNeed) {
    reply = "Baik. Boleh dijelaskan kebutuhan hukum atau permasalahan apa yang bisa kami bantu?";
  } else {
    reply = "Boleh ceritakan sedikit bidang usaha atau industri Anda agar kami arahkan ke tim yang tepat?";
  }
  return { reply, newStatus: "collecting" };
}
```

- [ ] **Step 4: Run test, pastikan PASS**

Run: `npx vitest run tests/engine.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/conversation tests/engine.test.ts
git commit -m "feat: conversation engine state machine"
```

---

### Task 5: WAHA Connector

**Files:**
- Create: `src/waha/connector.ts`
- Test: `tests/waha.test.ts`

**Interfaces:**
- Produces:
  - `parseWebhook(payload: unknown): { chatId: string; body: string; messageId: string } | null` — null jika bukan pesan masuk relevan (mis. `fromMe: true`, body kosong, atau event bukan `message`).
  - `makeWahaSender(cfg: { baseUrl: string; session: string; apiKey: string }, fetchImpl?: typeof fetch): (chatId: string, text: string) => Promise<void>` — POST ke `${baseUrl}/api/sendText`.

WAHA webhook shape (relevan): `{ event: "message", payload: { id, from, body, fromMe } }`.

- [ ] **Step 1: Tulis test `tests/waha.test.ts` (failing)**

```ts
import { describe, it, expect, vi } from "vitest";
import { parseWebhook, makeWahaSender } from "../src/waha/connector.js";

describe("parseWebhook", () => {
  it("parse pesan masuk valid", () => {
    const r = parseWebhook({ event: "message", payload: { id: "ABC", from: "628111@c.us", body: "halo", fromMe: false } });
    expect(r).toEqual({ chatId: "628111@c.us", body: "halo", messageId: "ABC" });
  });
  it("abaikan pesan dari diri sendiri", () => {
    expect(parseWebhook({ event: "message", payload: { id: "A", from: "x", body: "hi", fromMe: true } })).toBeNull();
  });
  it("abaikan event non-message / body kosong", () => {
    expect(parseWebhook({ event: "session.status", payload: {} })).toBeNull();
    expect(parseWebhook({ event: "message", payload: { id: "A", from: "x", body: "", fromMe: false } })).toBeNull();
  });
});

describe("makeWahaSender", () => {
  it("POST ke /api/sendText dengan payload benar", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const send = makeWahaSender({ baseUrl: "http://w", session: "default", apiKey: "k" }, fetchMock as any);
    await send("628111@c.us", "halo");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://w/api/sendText");
    expect(JSON.parse((opts as any).body)).toEqual({ session: "default", chatId: "628111@c.us", text: "halo" });
    expect((opts as any).headers["X-Api-Key"]).toBe("k");
  });
});
```

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npx vitest run tests/waha.test.ts`
Expected: FAIL (connector belum ada)

- [ ] **Step 3: Tulis `src/waha/connector.ts`**

```ts
export function parseWebhook(payload: unknown): { chatId: string; body: string; messageId: string } | null {
  const p = payload as any;
  if (!p || p.event !== "message" || !p.payload) return null;
  const m = p.payload;
  if (m.fromMe) return null;
  const body = typeof m.body === "string" ? m.body.trim() : "";
  if (!body || !m.from || !m.id) return null;
  return { chatId: String(m.from), body, messageId: String(m.id) };
}

export function makeWahaSender(
  cfg: { baseUrl: string; session: string; apiKey: string },
  fetchImpl: typeof fetch = fetch,
) {
  return async function send(chatId: string, text: string): Promise<void> {
    const res = await fetchImpl(`${cfg.baseUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": cfg.apiKey },
      body: JSON.stringify({ session: cfg.session, chatId, text }),
    });
    if (!res.ok) throw new Error(`WAHA sendText failed: ${res.status}`);
  };
}
```

- [ ] **Step 4: Run test, pastikan PASS**

Run: `npx vitest run tests/waha.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/waha tests/waha.test.ts
git commit -m "feat: waha connector parse webhook + send"
```

---

### Task 6: Webhook orchestrator

**Files:**
- Create: `src/server/webhook.ts`
- Test: `tests/webhook.test.ts`

**Interfaces:**
- Consumes: repo functions (Task 2), `makeClassifier`/`classify` (Task 3), `nextAction` (Task 4), `parseWebhook` + sender (Task 5).
- Produces: `makeHandleInbound(deps): (payload: unknown) => Promise<void>` di mana
  `deps = { pool, classify, send, emit, confidenceThreshold, maxTurns, processedIds: Set<string> }`.
  `emit(event: "lead:updated" | "message:new", data): void`.

Alur (lihat spec Data Flow):
1. `parseWebhook`; null → return.
2. Idempotensi: jika `messageId` sudah di `processedIds` → return; else tambahkan.
3. `getOrCreateLeadByChatId` → `insertMessage(in)` → `emit("message:new", msg)`.
4. `transcript` dari `listMessages` (gabung body).
5. `classify(transcript)`; jika hasil ada → `updateLead` field + confidence (needsReview=false); jika null → `updateLead({ needsReview: true })`.
6. `turnCount = countInbound`.
7. `nextAction(lead, turnCount)` → update status; jika `reply` → `send` + `insertMessage(out)` + `emit("message:new")`.
8. `emit("lead:updated", lead)`.

- [ ] **Step 1: Tulis test `tests/webhook.test.ts` (failing)**

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { listMessages, countInbound } from "../src/db/messages.js";
import { getLeadById, listLeads } from "../src/db/leads.js";
import { makeHandleInbound } from "../src/server/webhook.js";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";
const pool = createPool(DB);

beforeAll(async () => { await migrate(DB); });
beforeEach(async () => { await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE"); });
afterAll(async () => { await pool.end(); });

function deps(over: Partial<any> = {}) {
  return {
    pool,
    classify: vi.fn(async () => ({ industry: "Teknologi", legalNeed: "HKI", personName: "Budi", companyName: "PT Maju", confidence: 0.9 })),
    send: vi.fn(async () => {}),
    emit: vi.fn(),
    confidenceThreshold: 0.6,
    maxTurns: 4,
    processedIds: new Set<string>(),
    ...over,
  };
}

function msg(id: string, body: string) {
  return { event: "message", payload: { id, from: "628111@c.us", body, fromMe: false } };
}

describe("handleInbound", () => {
  it("klasifikasi confident → simpan, handover, balas penutup", async () => {
    const d = deps();
    const handle = makeHandleInbound(d);
    await handle(msg("M1", "Halo saya Budi dari PT Maju, mau daftar merek"));
    const [lead] = await listLeads(pool, {});
    expect(lead.industry).toBe("Teknologi");
    expect(lead.status).toBe("ready_for_handover");
    expect(d.send).toHaveBeenCalledOnce();
    const msgs = await listMessages(pool, lead.id);
    expect(msgs.map(m => m.direction)).toEqual(["in", "out"]);
  });

  it("idempoten: messageId sama tidak diproses dua kali", async () => {
    const d = deps();
    const handle = makeHandleInbound(d);
    await handle(msg("M1", "halo"));
    await handle(msg("M1", "halo"));
    const [lead] = await listLeads(pool, {});
    expect(await countInbound(pool, lead.id)).toBe(1);
  });

  it("classify null → lead ditandai needsReview, tetap balas pertanyaan", async () => {
    const d = deps({ classify: vi.fn(async () => null) });
    const handle = makeHandleInbound(d);
    await handle(msg("M1", "halo"));
    const [lead] = await listLeads(pool, {});
    expect(lead.needsReview).toBe(true);
    expect(lead.status).toBe("collecting");
    expect(d.send).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npx vitest run tests/webhook.test.ts`
Expected: FAIL (makeHandleInbound belum ada)

- [ ] **Step 3: Tulis `src/server/webhook.ts`**

```ts
import type pg from "pg";
import { parseWebhook } from "../waha/connector.js";
import { getOrCreateLeadByChatId, updateLead } from "../db/leads.js";
import { insertMessage, listMessages, countInbound } from "../db/messages.js";
import { nextAction } from "../conversation/engine.js";
import type { Classification, Lead, Message } from "../types.js";

export interface InboundDeps {
  pool: pg.Pool;
  classify: (transcript: string) => Promise<Classification | null>;
  send: (chatId: string, text: string) => Promise<void>;
  emit: (event: "lead:updated" | "message:new", data: Lead | Message) => void;
  confidenceThreshold: number;
  maxTurns: number;
  processedIds: Set<string>;
}

export function makeHandleInbound(deps: InboundDeps) {
  return async function handleInbound(payload: unknown): Promise<void> {
    const parsed = parseWebhook(payload);
    if (!parsed) return;
    if (deps.processedIds.has(parsed.messageId)) return;
    deps.processedIds.add(parsed.messageId);

    let lead = await getOrCreateLeadByChatId(deps.pool, parsed.chatId);
    const inbound = await insertMessage(deps.pool, lead.id, "in", parsed.body);
    deps.emit("message:new", inbound);

    const transcript = (await listMessages(deps.pool, lead.id)).map((m) => m.body).join("\n");
    const cls = await deps.classify(transcript);

    if (cls) {
      lead = await updateLead(deps.pool, lead.id, {
        industry: cls.industry, legalNeed: cls.legalNeed,
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
      await deps.send(parsed.chatId, action.reply);
      const out = await insertMessage(deps.pool, lead.id, "out", action.reply);
      deps.emit("message:new", out);
    }
    deps.emit("lead:updated", lead);
  };
}
```

- [ ] **Step 4: Run test, pastikan PASS**

Run: `npx vitest run tests/webhook.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/webhook.ts tests/webhook.test.ts
git commit -m "feat: webhook orchestrator wiring classify+engine+waha+db"
```

---

### Task 7: Fastify app, REST routes, Socket.io, entrypoint

**Files:**
- Create: `src/server/app.ts`, `src/server/routes.ts`, `src/server/index.ts`
- Test: `tests/routes.test.ts`

**Interfaces:**
- Consumes: repo functions, `makeHandleInbound`, sender, classifier, config.
- Produces: `buildApp(deps): { fastify, io }` dengan route:
  - `POST /webhook/waha` → panggil `handleInbound`, balas `{ ok: true }`.
  - `GET /leads?industry=&legalNeed=&status=&q=` → `Lead[]`.
  - `GET /leads/:id` → `{ lead: Lead; messages: Message[] }` atau 404.
  - `POST /leads/:id/reply` `{ text }` → kirim via WAHA, simpan outbound, set status `handed_over`, emit, balas message.
- `buildApp` menerima `emit` yang terhubung ke Socket.io.

- [ ] **Step 1: Tulis test `tests/routes.test.ts` (failing)**

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { getOrCreateLeadByChatId, updateLead } from "../src/db/leads.js";
import { buildApp } from "../src/server/app.js";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";
const pool = createPool(DB);

beforeAll(async () => { await migrate(DB); });
beforeEach(async () => { await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE"); });
afterAll(async () => { await pool.end(); });

function build(send = vi.fn(async () => {})) {
  return buildApp({
    pool, send,
    classify: vi.fn(async () => null),
    confidenceThreshold: 0.6, maxTurns: 4,
  });
}

describe("routes", () => {
  it("GET /leads kembalikan array", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628111@c.us");
    await updateLead(pool, lead.id, { industry: "Teknologi" });
    const { fastify } = build();
    const res = await fastify.inject({ method: "GET", url: "/leads?industry=Teknologi" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    await fastify.close();
  });

  it("GET /leads/:id sertakan messages, 404 kalau tidak ada", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628222@c.us");
    const { fastify } = build();
    const ok = await fastify.inject({ method: "GET", url: `/leads/${lead.id}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().lead.id).toBe(lead.id);
    const nf = await fastify.inject({ method: "GET", url: "/leads/999999" });
    expect(nf.statusCode).toBe(404);
    await fastify.close();
  });

  it("POST /leads/:id/reply kirim WAHA & set handed_over", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628333@c.us");
    const send = vi.fn(async () => {});
    const { fastify } = build(send);
    const res = await fastify.inject({ method: "POST", url: `/leads/${lead.id}/reply`, payload: { text: "Halo, kami dari tim hukum" } });
    expect(res.statusCode).toBe(200);
    expect(send).toHaveBeenCalledWith("628333@c.us", "Halo, kami dari tim hukum");
    const after = await fastify.inject({ method: "GET", url: `/leads/${lead.id}` });
    expect(after.json().lead.status).toBe("handed_over");
    await fastify.close();
  });
});
```

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npx vitest run tests/routes.test.ts`
Expected: FAIL (buildApp belum ada)

- [ ] **Step 3: Tulis `src/server/routes.ts`**

```ts
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { getLeadById, listLeads, updateLead } from "../db/leads.js";
import { listMessages, insertMessage } from "../db/messages.js";
import type { Lead, Message } from "../types.js";

export interface RouteDeps {
  pool: pg.Pool;
  send: (chatId: string, text: string) => Promise<void>;
  emit: (event: "lead:updated" | "message:new", data: Lead | Message) => void;
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
    await deps.send(lead.waChatId, text);
    const out = await insertMessage(deps.pool, id, "out", text);
    const updated = await updateLead(deps.pool, id, { status: "handed_over" });
    deps.emit("message:new", out);
    deps.emit("lead:updated", updated);
    return out;
  });
}
```

- [ ] **Step 4: Tulis `src/server/app.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Server as IOServer } from "socket.io";
import type pg from "pg";
import { makeHandleInbound } from "./webhook.js";
import { registerRoutes } from "./routes.js";
import type { Classification, Lead, Message } from "../types.js";

export interface AppDeps {
  pool: pg.Pool;
  classify: (t: string) => Promise<Classification | null>;
  send: (chatId: string, text: string) => Promise<void>;
  confidenceThreshold: number;
  maxTurns: number;
}

export function buildApp(deps: AppDeps): { fastify: FastifyInstance; io: IOServer } {
  const fastify = Fastify({ logger: false });
  fastify.register(cors, { origin: true });

  const io = new IOServer(fastify.server, { cors: { origin: "*" } });
  const emit = (event: "lead:updated" | "message:new", data: Lead | Message) => io.emit(event, data);

  const processedIds = new Set<string>();
  const handleInbound = makeHandleInbound({ ...deps, emit, processedIds });

  fastify.post("/webhook/waha", async (req) => {
    await handleInbound(req.body);
    return { ok: true };
  });

  registerRoutes(fastify, { pool: deps.pool, send: deps.send, emit });
  return { fastify, io };
}
```

- [ ] **Step 5: Tulis `src/server/index.ts`**

```ts
import { loadConfig } from "../config.js";
import { createPool } from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { createDeepSeekClient, makeClassifier } from "../classifier/classifier.js";
import { makeWahaSender } from "../waha/connector.js";
import { buildApp } from "./app.js";

const cfg = loadConfig();
await migrate(cfg.databaseUrl);
const pool = createPool(cfg.databaseUrl);
const classify = makeClassifier(createDeepSeekClient(cfg.deepseekApiKey));
const send = makeWahaSender({ baseUrl: cfg.wahaBaseUrl, session: cfg.wahaSession, apiKey: cfg.wahaApiKey });

const { fastify } = buildApp({
  pool, classify, send,
  confidenceThreshold: cfg.confidenceThreshold, maxTurns: cfg.maxTurns,
});

await fastify.listen({ port: cfg.port, host: "0.0.0.0" });
console.log(`backend listening on ${cfg.port}`);
```

- [ ] **Step 6: Run test, pastikan PASS**

Run: `npx vitest run tests/routes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Run seluruh test suite**

Run: `docker compose up -d postgres && npx vitest run`
Expected: PASS semua file test.

- [ ] **Step 8: Commit**

```bash
git add src/server tests/routes.test.ts
git commit -m "feat: fastify app, REST routes, socket.io, entrypoint"
```

---

### Task 8: Dashboard — daftar leads (Next.js)

**Files:**
- Create: `web/package.json`, `web/next.config.js`, `web/tsconfig.json`, `web/.env.local.example`
- Create: `web/lib/api.ts`, `web/app/layout.tsx`, `web/app/page.tsx`

**Interfaces:**
- Consumes: backend REST `GET /leads`.
- Produces: `fetchLeads(filter)`, `fetchLead(id)`, `sendReply(id, text)` di `web/lib/api.ts`.
- Env: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

- [ ] **Step 1: Scaffold Next.js app**

```bash
mkdir web && cd web
npm init -y
npm pkg set type=module
npm install next react react-dom socket.io-client
npm install -D typescript @types/react @types/node
cd ..
```

- [ ] **Step 2: Tulis `web/next.config.js`, `web/tsconfig.json`, `web/.env.local.example`**

`web/next.config.js`:
```js
export default { reactStrictMode: true };
```

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "es2022"], "jsx": "preserve",
    "module": "esnext", "moduleResolution": "bundler", "strict": true,
    "esModuleInterop": true, "skipLibCheck": true, "noEmit": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

`web/.env.local.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

- [ ] **Step 3: Tulis `web/lib/api.ts`**

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Lead {
  id: number; waChatId: string; personName: string | null; companyName: string | null;
  industry: string | null; legalNeed: string | null; status: string;
  confidence: number | null; needsReview: boolean; createdAt: string; updatedAt: string;
}
export interface Message { id: number; leadId: number; direction: "in" | "out"; body: string; createdAt: string; }

export async function fetchLeads(filter: Record<string, string> = {}): Promise<Lead[]> {
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
  const res = await fetch(`${BASE}/leads?${qs}`, { cache: "no-store" });
  return res.json();
}
export async function fetchLead(id: number): Promise<{ lead: Lead; messages: Message[] }> {
  const res = await fetch(`${BASE}/leads/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("not found");
  return res.json();
}
export async function sendReply(id: number, text: string): Promise<void> {
  await fetch(`${BASE}/leads/${id}/reply`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  });
}
export const API_BASE = BASE;
```

- [ ] **Step 4: Tulis `web/app/layout.tsx`**

```tsx
export const metadata = { title: "Leads Dashboard" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Tulis `web/app/page.tsx` (daftar leads + filter)**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchLeads, type Lead } from "../lib/api.js";

const INDUSTRIES = ["", "Manufaktur", "Properti", "Fintech/Keuangan", "F&B", "Kesehatan", "Teknologi", "Energi", "Ritel", "Lainnya"];
const STATUSES = ["", "new", "collecting", "ready_for_handover", "handed_over"];

export default function Page() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchLeads({ industry, status, q }).then(setLeads).catch(() => setLeads([]));
  }, [industry, status, q]);

  return (
    <main>
      <h1>Leads</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i || "Semua industry"}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || "Semua status"}</option>)}
        </select>
        <input placeholder="cari nama/perusahaan" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th>Nama</th><th>Perusahaan</th><th>Industry</th><th>Kebutuhan Hukum</th><th>Status</th><th>Conf.</th><th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{l.personName ?? "-"} {l.needsReview ? "⚠️" : ""}</td>
              <td>{l.companyName ?? "-"}</td>
              <td>{l.industry ?? "-"}</td>
              <td>{l.legalNeed ?? "-"}</td>
              <td>{l.status}</td>
              <td>{l.confidence?.toFixed(2) ?? "-"}</td>
              <td><Link href={`/leads/${l.id}`}>buka</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 6: Tambah scripts & verifikasi build**

```bash
cd web
npm pkg set scripts.dev="next dev -p 3001"
npm pkg set scripts.build="next build"
npm run build
cd ..
```
Expected: `next build` selesai tanpa error TypeScript.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat: dashboard leads list page (next.js)"
```

---

### Task 9: Dashboard — detail lead + live chat (real-time)

**Files:**
- Create: `web/lib/socket.ts`, `web/app/leads/[id]/page.tsx`

**Interfaces:**
- Consumes: `fetchLead`, `sendReply`, `API_BASE` (Task 8); backend Socket.io events `message:new`, `lead:updated`.
- Produces: `getSocket(): Socket` di `web/lib/socket.ts`.

- [ ] **Step 1: Tulis `web/lib/socket.ts`**

```ts
"use client";
import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api.js";

let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) socket = io(API_BASE, { transports: ["websocket"] });
  return socket;
}
```

- [ ] **Step 2: Tulis `web/app/leads/[id]/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchLead, sendReply, type Lead, type Message } from "../../../lib/api.js";
import { getSocket } from "../../../lib/socket.js";

export default function LeadDetail() {
  const id = Number(useParams().id);
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    fetchLead(id).then(({ lead, messages }) => { setLead(lead); setMessages(messages); });
    const s = getSocket();
    const onMsg = (m: Message) => { if (m.leadId === id) setMessages((prev) => [...prev, m]); };
    const onLead = (l: Lead) => { if (l.id === id) setLead(l); };
    s.on("message:new", onMsg);
    s.on("lead:updated", onLead);
    return () => { s.off("message:new", onMsg); s.off("lead:updated", onLead); };
  }, [id]);

  async function submit() {
    if (!text.trim()) return;
    await sendReply(id, text.trim());
    setText("");
  }

  if (!lead) return <main>Memuat…</main>;
  return (
    <main>
      <a href="/">← kembali</a>
      <h1>{lead.personName ?? "(tanpa nama)"} — {lead.companyName ?? "-"}</h1>
      <p>Industry: <b>{lead.industry ?? "-"}</b> · Kebutuhan: <b>{lead.legalNeed ?? "-"}</b> · Status: <b>{lead.status}</b> · Conf: {lead.confidence?.toFixed(2) ?? "-"}</p>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, height: 400, overflowY: "auto", marginBottom: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ textAlign: m.direction === "out" ? "right" : "left", margin: "6px 0" }}>
            <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 8, background: m.direction === "out" ? "#dcf8c6" : "#eee" }}>
              {m.body}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ flex: 1 }} value={text} placeholder="Tulis balasan…"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button onClick={submit}>Kirim</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verifikasi build**

```bash
cd web && npm run build && cd ..
```
Expected: build sukses tanpa error.

- [ ] **Step 4: Commit**

```bash
git add web/lib/socket.ts web/app/leads
git commit -m "feat: dashboard lead detail + live chat via socket.io"
```

---

### Task 10: Verifikasi end-to-end manual

**Files:** tidak ada perubahan kode; ini langkah verifikasi.

- [ ] **Step 1: Siapkan env & infra**

```bash
cp .env.example .env   # isi DEEPSEEK_API_KEY asli
docker compose up -d
npm run migrate
```

- [ ] **Step 2: Jalankan backend & dashboard**

Terminal A: `npm run dev` (backend :4000)
Terminal B: `cd web && cp .env.local.example .env.local && npm run dev` (dashboard :3001)

- [ ] **Step 3: Sambungkan WAHA**

Buka `http://localhost:3000` (WAHA), scan QR dengan WhatsApp nomor firma. Pastikan webhook ke `http://host.docker.internal:4000/webhook/waha` aktif (sudah di-set di `docker-compose.yml`).

- [ ] **Step 4: Uji alur lead**

Dari HP lain, kirim chat ke nomor firma: *"Halo, saya Andi dari PT Sinar Abadi, mau konsultasi sengketa kontrak."*
Verifikasi:
- Bot membalas otomatis di WhatsApp.
- Buka dashboard `http://localhost:3001` → lead muncul dengan industry & kebutuhan hukum terisi, status `ready_for_handover` (jika confident) atau `collecting`.
- Klik lead → transkrip muncul; ketik balasan dari dashboard → balasan sampai ke WhatsApp; status berubah `handed_over`; chat update real-time tanpa refresh.

- [ ] **Step 5: Commit catatan verifikasi (opsional)**

```bash
git commit --allow-empty -m "docs: manual E2E verification passed"
```

---

## Self-Review

**Spec coverage:**
- WAHA connector (receive + send) → Task 5, dipakai Task 6/7. ✅
- Conversation Engine hybrid + opsi 1 (murni pengumpul info) + handover → Task 4 (pesan penutup, tidak menjawab hukum). ✅
- Classifier DeepSeek + JSON output + Zod + needsReview → Task 3 & Task 6. ✅
- Klasifikasi industry (fixed) + kebutuhan hukum (fixed) + nama/perusahaan → enum di Task 1, dipakai Task 3. ✅
- Ambang 0.6 & maxTurns 4 → Task 4 (default), dialirkan dari config Task 1, dipakai Task 6/7. ✅
- DB schema leads+messages → Task 2. ✅
- Dashboard: list+filter+search → Task 8; detail+transkrip+live chat balas via WAHA → Task 9. ✅
- Backend API webhook + GET /leads + GET /leads/:id + POST /leads/:id/reply + Socket.io → Task 6/7. ✅
- Error handling: webhook idempoten (Task 6), classify gagal → needsReview (Task 3/6), kirim WAHA gagal → throw (Task 5). ✅
- Testing unit + integration + manual E2E → Task 1–7 (vitest) + Task 10. ✅

**Placeholder scan:** Tidak ada TBD/TODO; setiap step berisi kode lengkap. ✅

**Type consistency:** `Classification`, `Lead`, `Message`, enum `INDUSTRIES`/`LEGAL_NEEDS`, `nextAction`, `makeClassifier`, `parseWebhook`, `makeWahaSender`, `makeHandleInbound`, `buildApp` konsisten dipakai lintas task. ✅

**Catatan kecil:** "kirim WAHA gagal → tandai outbound failed + retry dari dashboard" (spec Error Handling) disederhanakan jadi `throw` pada v1 (Task 5); fitur retry outbound masuk backlog, bukan blocker MVP.
