import { describe, it, expect, vi } from "vitest";
import { parseWebhook, makeWahaSender } from "../src/waha/connector.js";

describe("parseWebhook", () => {
  it("parses inbound (message, fromMe=false) → chatId from 'from'", () => {
    const r = parseWebhook({ event: "message", payload: { id: "ABC", from: "628111@c.us", body: "hi", fromMe: false } });
    expect(r).toEqual({ chatId: "628111@c.us", body: "hi", messageId: "ABC", fromMe: false });
  });

  it("parses outbound (message.any, fromMe=true) → chatId from 'to'", () => {
    const r = parseWebhook({ event: "message.any", payload: { id: "OUT1", from: "628000@c.us", to: "628111@c.us", body: "human reply", fromMe: true } });
    expect(r).toEqual({ chatId: "628111@c.us", body: "human reply", messageId: "OUT1", fromMe: true });
  });

  it("supports id/from as { _serialized } objects", () => {
    const r = parseWebhook({ event: "message", payload: { id: { _serialized: "XYZ" }, from: { _serialized: "628222@c.us" }, body: "hey", fromMe: false } });
    expect(r).toEqual({ chatId: "628222@c.us", body: "hey", messageId: "XYZ", fromMe: false });
  });

  it("ignores non-message events / empty body", () => {
    expect(parseWebhook({ event: "session.status", payload: {} })).toBeNull();
    expect(parseWebhook({ event: "message", payload: { id: "A", from: "x", body: "", fromMe: false } })).toBeNull();
  });
});

describe("makeWahaSender", () => {
  it("POSTs to /api/sendText with the right payload & returns the message id", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ _data: { id: { _serialized: "true_628111@c.us_MID_out" } } }),
      { status: 200 },
    ));
    const send = makeWahaSender({ baseUrl: "http://w", session: "default", apiKey: "k" }, fetchMock as any);
    const id = await send("628111@c.us", "hi");
    expect(id).toBe("true_628111@c.us_MID_out");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://w/api/sendText");
    expect(JSON.parse((opts as any).body)).toEqual({ session: "default", chatId: "628111@c.us", text: "hi" });
    expect((opts as any).headers["X-Api-Key"]).toBe("k");
  });
});
