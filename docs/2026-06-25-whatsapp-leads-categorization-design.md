# Design Spec — WhatsApp Leads Categorization Chatbot (Law Firm)

## Context

Perusahaan adalah firma hukum yang menerima leads via WhatsApp. Saat ini tidak ada
sistem yang otomatis mengategorikan dan menyimpan leads. Tujuannya: setiap chat
masuk dari lead di WhatsApp otomatis (1) dikategorikan industry & jenis kebutuhan
hukumnya, (2) diekstrak nama perorangan / perusahaannya, lalu (3) disimpan dan
ditampilkan di dashboard agar tim bisa follow-up dengan routing ke lawyer yang tepat.

Provider AI: **DeepSeek** (`deepseek-chat`, API OpenAI-compatible).

Bot bersifat **hybrid**: mengumpulkan info awal secara otomatis, lalu handover ke
manusia. Selama fase aktif bot **murni pengumpul info** (tidak menjawab pertanyaan
hukum apa pun — menghindari risiko nasihat hukum yang salah). Setelah handover, tim
membalas leads **langsung dari dashboard** (live chat), pesan dikirim ke WhatsApp via WAHA.

Proyek greenfield (direktori kosong, bukan git repo).

## Keputusan yang sudah disepakati
- Peran bot: **Hybrid** (kumpul info otomatis → handover ke manusia)
- Output kategorisasi: **industry (fixed) + jenis kebutuhan hukum (fixed) + nama/perusahaan**
- Penyimpanan/tampilan: **dashboard web sendiri**
- Handover: tim **balas dari dashboard** (live chat real-time via WAHA)
- Fase aktif bot: **opsi 1** — murni pengumpul info, tidak menjawab pertanyaan hukum
- Stack: **Node.js + TypeScript full-stack**
- Database: **PostgreSQL** (default); Dev: **lokal pakai Docker**

## Arsitektur & Data Flow

```
Lead kirim WA → WAHA (Docker) → webhook POST /webhook/waha → Backend
  1. Simpan inbound message ke DB
  2. Conversation Engine: tentukan state lead + balasan berikutnya
  3. Classifier Service: 1 panggilan DeepSeek (JSON output) → industry,
     legalNeed, personName, companyName, confidence
  4. Update record lead di DB
  5. Push update ke dashboard via Socket.io
  6. Jika belum cukup info → kirim pertanyaan via WAHA; jika cukup → status
     ready_for_handover, bot berhenti
Tim balas dari dashboard → Backend POST WAHA /api/sendText → WhatsApp lead
```

## Komponen (boundary jelas, bisa dites terpisah)

1. **WAHA Connector** (`src/waha/`)
   - `sendMessage(chatId, text)` → POST ke WAHA `/api/sendText`
   - `verifyAndParseWebhook(payload)` → normalisasi event pesan masuk
   - Depends on: env `WAHA_BASE_URL`, `WAHA_SESSION`, `WAHA_API_KEY`

2. **Conversation Engine** (`src/conversation/`)
   - State machine per lead: `new → collecting → ready_for_handover → handed_over`
   - `nextAction(lead, history)` → `{ reply?, newStatus }`
   - Aturan "info cukup": punya nama ATAU perusahaan + industry + legalNeed terisi
     (confidence di atas ambang), atau sudah N giliran. Saat handover, kirim pesan
     penutup "tim kami akan segera menghubungi Anda" dan stop.

3. **Classifier Service** (`src/classifier/`)
   - Provider: **DeepSeek** (API OpenAI-compatible). Pakai paket `openai` dengan
     `baseURL: "https://api.deepseek.com"`, `apiKey: DEEPSEEK_API_KEY`,
     model `deepseek-chat`.
   - Satu panggilan `chat.completions.create()` dengan
     `response_format: { type: "json_object" }`. Prompt menyertakan skema JSON yang
     diharapkan; hasil di-`JSON.parse` lalu divalidasi dengan **Zod** di sisi kita
     (DeepSeek belum punya strict schema enforcement, jadi validasi wajib di aplikasi).
     Input: transkrip percakapan lead.
   - Output schema (divalidasi Zod):
     ```
     industry: enum(Manufaktur, Properti, Fintech/Keuangan, F&B, Kesehatan,
                    Teknologi, Energi, Ritel, Lainnya)
     legalNeed: enum(Korporat/M&A, Litigasi, Ketenagakerjaan, HKI,
                     Perizinan/Regulasi, Kontrak, Lainnya)
     personName: string | null
     companyName: string | null
     confidence: number (0..1)
     ```
   - System prompt menegaskan domain firma hukum + bahasa Indonesia + "balas HANYA
     JSON valid sesuai skema; jangan mengarang; pakai null kalau tidak yakin".
   - Catatan: jika output bukan JSON valid / gagal validasi Zod → simpan pesan tanpa
     kategori dan tandai `needs_review` (lihat Error Handling).

4. **Dashboard** (`src/web/`, Next.js)
   - Halaman daftar leads: tabel filter by industry / legalNeed / status, search nama.
   - Halaman detail lead: identitas + kategori + transkrip chat + panel live chat
     (kirim balasan via WAHA). Update real-time via Socket.io.

5. **Backend API** (Fastify, `src/server/`)
   - `POST /webhook/waha` — entry webhook
   - `GET /leads`, `GET /leads/:id`, `POST /leads/:id/reply`
   - Socket.io untuk push event `lead:updated`, `message:new`

## Skema Database (PostgreSQL)

- `leads`: id (pk), wa_chat_id (unique), person_name, company_name, industry,
  legal_need, status, confidence, created_at, updated_at
- `messages`: id (pk), lead_id (fk), direction ('in'|'out'), body, created_at

Pakai migration sederhana (mis. `node-pg-migrate` atau Drizzle).

## Struktur Proyek (usulan)
```
docker-compose.yml        # WAHA + Postgres untuk dev
src/
  server/                 # Fastify app, routes, socket.io
  waha/                   # connector
  conversation/           # state machine
  classifier/             # DeepSeek JSON-output call + validasi Zod
  db/                     # schema, migrations, queries
  web/                    # Next.js dashboard
.env.example              # WAHA_*, DEEPSEEK_API_KEY, DATABASE_URL
```

## Error Handling
- Webhook idempoten by message id (hindari double-process saat WAHA retry).
- Panggilan DeepSeek: tangani error HTTP & timeout (retry dengan backoff); kalau
  output bukan JSON valid atau gagal validasi Zod, simpan pesan tanpa kategori dan
  tandai `needs_review`.
- Kirim WAHA gagal → log + tandai pesan outbound `failed`, bisa retry dari dashboard.

## Testing
- Unit: Conversation Engine state transitions; Classifier dengan transkrip contoh
  (mock DeepSeek/OpenAI client) + uji validasi Zod menolak JSON tak valid.
- Integration: webhook → DB → classify (mock DeepSeek) → socket emit.
- Manual E2E: jalankan docker-compose, scan QR WAHA, kirim chat dari HP, cek lead
  muncul & terkategorisasi di dashboard, balas dari dashboard sampai ke WhatsApp.

## Provider AI
- **DeepSeek** (`deepseek-chat`) via API OpenAI-compatible (`https://api.deepseek.com`),
  diakses pakai paket `openai`. Dipilih user.

## Parameter yang sudah dikunci
- Ambang `confidence` = **0.6** (medium). Jika hasil klasifikasi `confidence >= 0.6`
  dan data inti terisi → lead siap di-handover; jika `< 0.6` → bot ajukan pertanyaan lanjutan.
- Giliran maksimum sebelum handover = **4**. Setelah 4 giliran tanya-jawab dan info
  masih kurang, bot kirim pesan penutup dan tetap handover ke tim (status `ready_for_handover`).

## Out of Scope (YAGNI untuk v1)
- Multi-nomor / multi-session WhatsApp
- Auth multi-user dashboard (v1 single-tenant internal)
- Integrasi CRM eksternal
- Bot menjawab pertanyaan hukum / FAQ
