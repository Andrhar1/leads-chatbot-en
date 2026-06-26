import OpenAI from "openai";
import { z } from "zod";
import { INDUSTRIES, LEGAL_NEEDS, type Classification } from "../types.js";

export interface ChatClient {
  chat: { completions: { create(args: any): Promise<{ choices: { message: { content: string | null } }[] }> } };
}

const resultSchema = z.object({
  industry: z.enum(INDUSTRIES).nullable(),
  legalNeed: z.enum(LEGAL_NEEDS).nullable(),
  personName: z.string().min(1).nullable(),
  companyName: z.string().min(1).nullable(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are a lead-classification assistant for a law firm.
From a WhatsApp conversation transcript, determine:
- industry: one of ${INDUSTRIES.join(", ")}; null if the customer has NOT yet mentioned their line of business
- legalNeed: one of ${LEGAL_NEEDS.join(", ")}; null if the customer has NOT yet described their legal need/issue
- personName: the individual's name if mentioned, otherwise null
- companyName: the company name if mentioned, otherwise null
- confidence: a number 0..1 for how confident you are about the industry & legalNeed classification
Reply ONLY with a single valid JSON object matching the fields above. Do not make things up.
Use null (NOT "Other") when the information is not yet present in the conversation. Use "Other" only when the customer has explained but it does not match any category.`;

export function makeClassifier(client: ChatClient) {
  return async function classify(transcript: string): Promise<Classification | null> {
    const res = await client.chat.completions.create({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { return null; }
    const v = resultSchema.safeParse(parsed);
    return v.success ? v.data : null;
  };
}

export function createDeepSeekClient(apiKey: string): ChatClient {
  return new OpenAI({ baseURL: "https://api.deepseek.com", apiKey }) as unknown as ChatClient;
}
