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
  cookieSecure: process.env.NODE_ENV === "production",
});

await fastify.listen({ port: cfg.port, host: "0.0.0.0" });
console.log(`backend listening on ${cfg.port}`);
