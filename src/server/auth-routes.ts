import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { getUserByUsername } from "../db/users.js";
import { verifyPassword } from "../auth/password.js";
import { createSession, deleteSession, getSessionUser, SESSION_TTL_MS } from "../auth/sessions.js";
import { createRateLimiter } from "../auth/rate-limit.js";

export const SESSION_COOKIE = "lf_session";

export interface AuthRouteDeps {
  pool: pg.Pool;
  cookieSecure: boolean;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });

  const cookieOpts = (maxAgeSec?: number) => ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: deps.cookieSecure,
    path: "/",
    ...(maxAgeSec !== undefined ? { maxAge: maxAgeSec } : {}),
  });

  app.post("/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return reply.code(400).send({ error: "Username and password are required" });
    }
    if (!limiter.check(`${req.ip}:${username.toLowerCase()}`)) {
      return reply.code(429).send({ error: "Too many attempts, please try again later." });
    }

    const user = await getUserByUsername(deps.pool, username);
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    const session = await createSession(deps.pool, user.id);
    reply.setCookie(SESSION_COOKIE, session.id, cookieOpts(Math.floor(SESSION_TTL_MS / 1000)));
    return { user: { id: user.id, username: user.username, name: user.name } };
  });

  app.post("/auth/logout", async (req, reply) => {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) await deleteSession(deps.pool, sid);
    reply.clearCookie(SESSION_COOKIE, cookieOpts());
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    const sid = req.cookies?.[SESSION_COOKIE];
    const user = sid ? await getSessionUser(deps.pool, sid) : null;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    return { user };
  });
}
