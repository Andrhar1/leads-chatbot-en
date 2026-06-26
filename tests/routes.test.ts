import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { getOrCreateLeadByChatId, updateLead } from "../src/db/leads.js";
import { createUser } from "../src/db/users.js";
import { hashPassword } from "../src/auth/password.js";
import { buildApp } from "../src/server/app.js";
import type { FastifyInstance } from "fastify";

const DB = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/leads";
const pool = createPool(DB);

beforeAll(async () => { await migrate(DB); });
beforeEach(async () => {
  await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
});
afterAll(async () => { await pool.end(); });

function build(send = vi.fn(async () => {})) {
  return buildApp({
    pool, send,
    classify: vi.fn(async () => null),
    confidenceThreshold: 0.6, maxTurns: 4,
    cookieSecure: false,
  });
}

/** Seed a user then log in, returning the session cookie header for protected requests. */
async function authCookie(fastify: FastifyInstance): Promise<string> {
  await createUser(pool, "legal", "Legal Team", await hashPassword("secret123"));
  const res = await fastify.inject({ method: "POST", url: "/auth/login", payload: { username: "legal", password: "secret123" } });
  const c = res.cookies.find((x) => x.name === "lf_session");
  return `lf_session=${c?.value}`;
}

describe("routes", () => {
  it("GET /leads returns an array", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628111@c.us");
    await updateLead(pool, lead.id, { industry: "Technology" });
    const { fastify } = build();
    const cookie = await authCookie(fastify);
    const res = await fastify.inject({ method: "GET", url: "/leads?industry=Technology", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    await fastify.close();
  });

  it("GET /leads/:id includes messages, 404 when missing", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628222@c.us");
    const { fastify } = build();
    const cookie = await authCookie(fastify);
    const ok = await fastify.inject({ method: "GET", url: `/leads/${lead.id}`, headers: { cookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().lead.id).toBe(lead.id);
    const nf = await fastify.inject({ method: "GET", url: "/leads/999999", headers: { cookie } });
    expect(nf.statusCode).toBe(404);
    await fastify.close();
  });

  it("POST /leads/:id/reply sends via WAHA & sets handed_over", async () => {
    const lead = await getOrCreateLeadByChatId(pool, "628333@c.us");
    const send = vi.fn(async () => {});
    const { fastify } = build(send);
    const cookie = await authCookie(fastify);
    const res = await fastify.inject({ method: "POST", url: `/leads/${lead.id}/reply`, payload: { text: "Hello, this is the legal team" }, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(send).toHaveBeenCalledWith("628333@c.us", "Hello, this is the legal team");
    const after = await fastify.inject({ method: "GET", url: `/leads/${lead.id}`, headers: { cookie } });
    expect(after.json().lead.status).toBe("handed_over");
    await fastify.close();
  });
});
