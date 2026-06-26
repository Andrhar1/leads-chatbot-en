import type { Lead, Message } from "./api";

/* ------------------------------------------------------------------ *
 * Maps the real backend Lead/Message model onto the Leadflow design
 * view model. Fields the backend doesn't store yet (channel, tags,
 * notes, full contact, timeline) degrade gracefully from what exists.
 * ------------------------------------------------------------------ */

export interface StatusMeta {
  key: string;
  label: string;
  bg: string;
  text: string;
}

/* Backend status -> design badge. No "closed" exists in the DB; it is
   kept UI-only (see channelLabel / "Mark Done"). */
const STATUS: Record<string, StatusMeta> = {
  new: { key: "new", label: "New", bg: "#EAF1FF", text: "#2A6BFF" },
  collecting: { key: "qualifying", label: "Qualifying", bg: "#FFF3E0", text: "#E8870B" },
  ready_for_handover: { key: "ready_for_handover", label: "Ready for Handover", bg: "#E9F7EF", text: "#16A45E" },
  handed_over: { key: "handover", label: "Handed Over", bg: "#F0EBFF", text: "#7B52E0" },
  closed: { key: "closed", label: "Closed", bg: "#EEF1F8", text: "#7C89A8" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS[status] ?? STATUS.new;
}

/* The backend is WhatsApp-only (waChatId via WAHA). The channel system
   is kept so other channels can be added later without UI changes. */
export interface ChannelMeta { key: string; label: string; color: string; }
const CHANNELS: Record<string, ChannelMeta> = {
  whatsapp: { key: "whatsapp", label: "WhatsApp", color: "#25D366" },
  instagram: { key: "instagram", label: "Instagram", color: "#E1306C" },
  email: { key: "email", label: "Email", color: "#EA4335" },
  webchat: { key: "webchat", label: "Webchat", color: "#2A6BFF" },
  line: { key: "line", label: "LINE", color: "#06C755" },
};

export function channelMeta(lead: Lead): ChannelMeta {
  // Only WhatsApp is wired today; derive defensively from the chat id.
  if (lead.waChatId) return CHANNELS.whatsapp;
  return CHANNELS.whatsapp;
}

const AVATAR_PALETTE = ["#2A6BFF", "#7B52E0", "#E8870B", "#16A45E", "#E1306C", "#0EA5C4", "#EC4899"];

export function avatarColor(lead: Lead): string {
  return AVATAR_PALETTE[lead.id % AVATAR_PALETTE.length];
}

export function initial(lead: Lead): string {
  const n = (lead.personName || lead.companyName || "?").trim();
  return (n[0] || "?").toUpperCase();
}

export function displayName(lead: Lead): string {
  return lead.personName?.trim() || "(no name)";
}

export function confColor(conf: number | null): string {
  const c = conf ?? 0;
  if (c >= 0.75) return "#16A45E";
  if (c >= 0.55) return "#E8870B";
  return "#E15050";
}

export function confPct(conf: number | null): number {
  return Math.round((conf ?? 0) * 100);
}

/* WhatsApp jid "62812...@c.us" -> "+62 812..." (best effort). */
export function phoneFromChatId(waChatId: string | null): string | null {
  if (!waChatId) return null;
  const digits = waChatId.split("@")[0]?.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return "+" + digits;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export function formatDateLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

export function messageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export interface TimelineStep { color: string; title: string; desc: string; time: string; }

export function timeline(lead: Lead): TimelineStep[] {
  const ch = channelMeta(lead);
  const created = formatTime(lead.createdAt);
  const updated = formatTime(lead.updatedAt);
  const steps: TimelineStep[] = [
    { color: ch.color, title: "Lead received", desc: `Via ${ch.label}`, time: created },
    { color: "#2A6BFF", title: "AI gathering info", desc: "Assistant asks about needs & company details", time: created },
  ];
  if (lead.confidence != null) {
    steps.push({
      color: confColor(lead.confidence),
      title: `Confidence score ${confPct(lead.confidence)}%`,
      desc: "Lead quality estimate updated",
      time: updated,
    });
  }
  const sm = statusMeta(lead.status);
  steps.push({ color: sm.text, title: `Status: ${sm.label}`, desc: "Current lead status", time: updated });
  return steps;
}

export function lastPreview(messages: Message[] | undefined): string {
  if (!messages || messages.length === 0) return "No messages yet";
  return messages[messages.length - 1].body;
}

/* Tags derived honestly from real fields (no backend tag store yet). */
export function derivedTags(lead: Lead): { t: string; c: string }[] {
  const out: { t: string; c: string }[] = [];
  if (lead.industry) out.push({ t: lead.industry, c: "#2A6BFF" });
  if (lead.legalNeed) out.push({ t: lead.legalNeed, c: "#7B52E0" });
  if (lead.needsReview) out.push({ t: "Needs Review", c: "#E8870B" });
  return out;
}
