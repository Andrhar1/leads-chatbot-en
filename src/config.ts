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
