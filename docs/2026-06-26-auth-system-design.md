# Sistem Autentikasi Leadflow — Desain

Tanggal: 2026-06-26
Status: Disetujui, siap implementasi

## Tujuan

Menambahkan autentikasi pada dashboard Leadflow agar hanya pengguna tim legal
internal (akun di-seed admin) yang bisa mengakses data lead. Login form bertema
sama dengan tampilan dashboard.

## Keputusan kunci

- **Model pengguna:** internal, akun di-seed admin. Tidak ada registrasi publik.
- **Mekanisme:** session cookie httpOnly yang dikelola di backend Fastify
  (server-side session, tabel `sessions` di Postgres).
- **Password hashing:** `crypto.scrypt` bawaan Node (tanpa native dependency).
- **Rate limiting:** in-memory fixed-window limiter (5 percobaan / menit per IP+username).
- **Sesi:** kedaluwarsa 7 hari, tombol logout menghapus sesi server-side & cookie.
- **Proteksi:** semua route HTTP wajib sesi valid kecuali `/auth/login`,
  `/auth/me`, `/auth/logout`, dan `/webhook/waha`.
- **Dependency baru:** `@fastify/cookie` (satu-satunya).

## Arsitektur & alur

Browser tetap memanggil Fastify (`:4000`) langsung dari Next.js (`:3005`), kini
menyertakan cookie sesi httpOnly (`credentials: 'include'`).

```
[Login form Next.js :3005]
   POST /auth/login {username,password}  (credentials: 'include')
   → Fastify: cek rate-limit → verifikasi password (scrypt, timing-safe)
   → buat row sessions (token acak 32-byte) → Set-Cookie httpOnly
   → cookie ikut otomatis pada tiap request /leads*
   → preHandler hook cek sesi valid; jika tidak → 401
```

`localhost:3005` dan `localhost:4000` adalah **same-site** (port tidak masuk
hitungan SameSite), jadi cookie `SameSite=Lax` bekerja di dev. CORS memakai
`credentials: true` + origin direfleksikan (bukan `*`).

## Database (tambahan idempoten ke `src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,        -- format: scrypt$N$r$p$saltHex$hashHex
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,        -- token acak 32-byte (base64url), opaque
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

## Backend (modul baru / perubahan)

- `src/auth/password.ts` — `hashPassword`, `verifyPassword` (scrypt + `timingSafeEqual`).
- `src/auth/sessions.ts` — `createSession`, `getSessionUser` (join user, cek
  expiry, hapus sesi kedaluwarsa), `deleteSession`. TTL 7 hari.
- `src/auth/rate-limit.ts` — `createRateLimiter({ max, windowMs })` in-memory.
- `src/db/users.ts` — `getUserByUsername`, `createUser` (upsert by username).
- `src/server/auth-routes.ts` — `POST /auth/login`, `POST /auth/logout`,
  `GET /auth/me`. Konstanta `SESSION_COOKIE = "lf_session"`.
- `src/server/app.ts` — register `@fastify/cookie`; CORS `credentials: true`;
  `preHandler` hook proteksi semua route kecuali allowlist publik; register auth routes.
  `AppDeps` dapat field `cookieSecure`.
- `src/server/index.ts` — teruskan `cookieSecure: process.env.NODE_ENV === "production"`.
- `scripts/seed-user.ts` + npm script `seed:user` — admin buat/reset akun:
  `npm run seed:user -- <username> <name> <password>`.

Cookie: `httpOnly`, `sameSite:'lax'`, `path:'/'`, `secure` ikut env, `maxAge` 7 hari.

## Frontend

- `web/lib/api.ts` — semua `fetch` diberi `credentials:'include'`; tambah
  `login`, `logout`, `fetchMe`, tipe `AuthUser`.
- `web/app/login/page.tsx` — halaman bertema sama: background `--c-page-bg`,
  kartu putih `--r-card`/`--sh-card`, logo gradient Leadflow, field username &
  password, tombol gradient `--grad-btn`, error state merah halus, loading state.
- `web/components/auth.tsx` — `AuthGate`: panggil `/auth/me` saat mount; jika
  401 dan bukan di `/login` → redirect `/login`; render loader saat memeriksa;
  bila authed render `AppShell` dengan user + logout. `/login` dirender tanpa shell.
- `web/components/chrome.tsx` — `AppShell` menerima `user` + `onLogout`; avatar di
  TopBar jadi tombol dropdown (nama user + "Keluar").
- `web/app/layout.tsx` — bungkus children dengan `AuthGate` (bukan `AppShell`).

## Error handling

- Login salah → 401 generik `"Username atau password salah"` (tidak bocorkan field mana).
- Rate limit terlampaui → 429 `"Terlalu banyak percobaan, coba lagi nanti."`.
- Sesi kedaluwarsa/invalid → 401 → guard redirect ke `/login`.

## Testing (`tests/auth.test.ts`, vitest + Postgres lokal)

- Unit: hash/verify password (benar & salah).
- Integrasi (via `fastify.inject`):
  - login sukses → 200 + `Set-Cookie`.
  - login gagal → 401.
  - rate-limit → percobaan ke-6 dalam 1 menit → 429.
  - `GET /leads` tanpa cookie → 401; dengan cookie → 200.
  - logout menghapus sesi → `GET /auth/me` setelahnya → 401.
  - `POST /webhook/waha` tetap terbuka (tanpa cookie tidak 401).
