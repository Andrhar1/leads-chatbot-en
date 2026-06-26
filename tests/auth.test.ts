import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { buildApp } from "../src/server/app.js";
import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { createUser } from "../src/db/users.js";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";
const pool = createPool(DB);

beforeAll(async () => { await migrate(DB); });
beforeEach(async () => {
  await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
});
afterAll(async () => { await pool.end(); });

function makeApp() {
  return buildApp({
    pool,
    classify: vi.fn(async () => null),
    send: vi.fn(async () => "OUTID"),
    confidenceThreshold: 0.6,
    maxTurns: 4,
    cookieSecure: false,
  }).fastify;
}

async function seedUser(username = "legal", password = "secret123") {
  await createUser(pool, username, "Legal Team", await hashPassword(password));
}

function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }): string {
  const c = res.cookies.find((x) => x.name === "lf_session");
  return c ? `lf_session=${c.value}` : "";
}

describe("password hashing", () => {
  it("verify true untuk password benar, false untuk salah", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword("secret123", hash)).toBe(true);
    expect(await verifyPassword("salah", hash)).toBe(false);
  });
});

describe("auth routes", () => {
  it("login sukses → 200 + Set-Cookie httpOnly", async () => {
    await seedUser();
    const app = makeApp();
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "secret123" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ username: "legal", name: "Legal Team" });
    const c = res.cookies.find((x) => x.name === "lf_session");
    expect(c?.httpOnly).toBe(true);
    expect(c?.value).toBeTruthy();
  });

  it("login gagal (password salah) → 401", async () => {
    await seedUser();
    const app = makeApp();
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "salah" } });
    expect(res.statusCode).toBe(401);
  });

  it("rate-limit: percobaan ke-6 dalam window → 429", async () => {
    await seedUser();
    const app = makeApp();
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "salah" } });
      expect(r.statusCode).toBe(401);
    }
    const sixth = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "salah" } });
    expect(sixth.statusCode).toBe(429);
  });

  it("GET /leads tanpa cookie → 401, dengan cookie → 200", async () => {
    await seedUser();
    const app = makeApp();
    const noAuth = await app.inject({ method: "GET", url: "/leads" });
    expect(noAuth.statusCode).toBe(401);

    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "secret123" } });
    const authed = await app.inject({ method: "GET", url: "/leads", headers: { cookie: cookieFrom(login) } });
    expect(authed.statusCode).toBe(200);
    expect(authed.json()).toEqual([]);
  });

  it("logout menghapus sesi → /auth/me setelahnya 401", async () => {
    await seedUser();
    const app = makeApp();
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "secret123" } });
    const cookie = cookieFrom(login);

    const me1 = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(me1.statusCode).toBe(200);

    await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });

    const me2 = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(me2.statusCode).toBe(401);
  });

  it("POST /webhook/waha tetap terbuka tanpa cookie", async () => {
    const app = makeApp();
    const res = await app.inject({ method: "POST", url: "/webhook/waha", payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
