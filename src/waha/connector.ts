export interface ParsedMessage {
  chatId: string;
  body: string;
  messageId: string;
  fromMe: boolean;
}

/** Ambil string JID dari field yang bisa berupa string atau objek { _serialized }. */
function jid(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as any)._serialized === "string") return (v as any)._serialized;
  return "";
}

export function parseWebhook(payload: unknown): ParsedMessage | null {
  const p = payload as any;
  if (!p || (p.event !== "message" && p.event !== "message.any") || !p.payload) return null;
  const m = p.payload;
  const fromMe = Boolean(m.fromMe);
  const body = typeof m.body === "string" ? m.body.trim() : "";
  const messageId = jid(m.id);
  // For outbound (fromMe) the counterpart chat is in 'to'; for inbound it's in 'from'.
  const chatId = jid(fromMe ? m.to : m.from);
  if (!body || !chatId || !messageId) return null;
  return { chatId, body, messageId, fromMe };
}

function extractMessageId(data: any): string {
  const d = data?._data?.id;
  return jid(d) || jid(d?.id) || jid(data?.id) || "";
}

export function makeWahaSender(
  cfg: { baseUrl: string; session: string; apiKey: string },
  fetchImpl: typeof fetch = fetch,
) {
  return async function send(chatId: string, text: string): Promise<string> {
    const res = await fetchImpl(`${cfg.baseUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": cfg.apiKey },
      body: JSON.stringify({ session: cfg.session, chatId, text }),
    });
    if (!res.ok) throw new Error(`WAHA sendText failed: ${res.status}`);
    const data = await res.json().catch(() => null);
    return extractMessageId(data);
  };
}
