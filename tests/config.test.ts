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
