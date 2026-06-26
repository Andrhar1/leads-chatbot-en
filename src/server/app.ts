import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { Server as IOServer } from "socket.io";
import type pg from "pg";
import { makeHandleInbound } from "./webhook.js";
import { registerRoutes } from "./routes.js";
import { registerAuthRoutes, SESSION_COOKIE } from "./auth-routes.js";
import { getSessionUser } from "../auth/sessions.js";
import type { Classification, Lead, Message } from "../types.js";

export interface AppDeps {
  pool: pg.Pool;
  classify: (t: string) => Promise<Classification | null>;
  send: (chatId: string, text: string) => Promise<string>;
  confidenceThreshold: number;
  maxTurns: number;
  cookieSecure: boolean;
}

// Route yang boleh diakses tanpa sesi valid.
const PUBLIC_ROUTES = new Set(["/auth/login", "/auth/logout", "/auth/me", "/webhook/waha", "/health"]);

export function buildApp(deps: AppDeps): { fastify: FastifyInstance; io: IOServer } {
  const fastify = Fastify({ logger: false });
  fastify.register(cors, { origin: true, credentials: true });
  fastify.register(cookie);

  const io = new IOServer(fastify.server, { cors: { origin: "*" } });
  const emit = (event: "lead:updated" | "message:new", data: Lead | Message) => io.emit(event, data);

  // Proteksi: semua route wajib sesi valid kecuali allowlist publik.
  // preHandler (bukan onRequest) agar cookie sudah diparse oleh @fastify/cookie.
  fastify.addHook("preHandler", async (req, reply) => {
    if (req.method === "OPTIONS") return;
    const routeUrl = req.routeOptions?.url ?? req.url;
    if (PUBLIC_ROUTES.has(routeUrl)) return;
    const sid = req.cookies?.[SESSION_COOKIE];
    const user = sid ? await getSessionUser(deps.pool, sid) : null;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
  });

  const processedIds = new Set<string>();
  const botSent = new Set<string>();
  const handleInbound = makeHandleInbound({ ...deps, emit, processedIds, botSent });

  // Liveness/readiness probe for Docker healthcheck and Nginx upstream checks.
  fastify.get("/health", async () => ({ ok: true }));

  fastify.post("/webhook/waha", async (req) => {
    await handleInbound(req.body);
    return { ok: true };
  });

  registerAuthRoutes(fastify, { pool: deps.pool, cookieSecure: deps.cookieSecure });
  registerRoutes(fastify, { pool: deps.pool, send: deps.send, emit, botSent });
  return { fastify, io };
}
