import type { Lead, LeadStatus } from "../types.js";

const CLOSING = "Thank you for the information. Our team will reach out to you shortly. 🙏";

export interface NextAction { reply?: string; newStatus: LeadStatus; }

export function nextAction(
  lead: Lead,
  turnCount: number,
  opts: { confidenceThreshold?: number; maxTurns?: number } = {},
): NextAction {
  const threshold = opts.confidenceThreshold ?? 0.6;
  const maxTurns = opts.maxTurns ?? 4;

  const hasIdentity = Boolean(lead.personName || lead.companyName);
  const coreFilled = hasIdentity && Boolean(lead.industry) && Boolean(lead.legalNeed);

  if (coreFilled && (lead.confidence ?? 0) >= threshold) {
    return { reply: CLOSING, newStatus: "ready_for_handover" };
  }
  if (turnCount >= maxTurns) {
    return { reply: CLOSING, newStatus: "ready_for_handover" };
  }

  let reply: string;
  if (!hasIdentity) {
    reply = "Hello! Thanks for reaching out. May I have your name and your company/organization name (if any)?";
  } else if (!lead.legalNeed) {
    reply = "Got it. Could you describe the legal need or issue we can help you with?";
  } else {
    reply = "Could you tell us a bit about your line of business or industry so we can route you to the right team?";
  }
  return { reply, newStatus: "collecting" };
}
