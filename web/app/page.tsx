"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { fetchLeads, fetchLead, sendReply, type Lead, type Message } from "../lib/api";
import { getSocket } from "../lib/socket";
import { statusMeta, channelMeta, displayName, formatTime, derivedTags } from "../lib/decorate";
import { Avatar, StatusBadge, ConfidenceMeter, ChatThread, Composer } from "../components/primitives";
import { Card, CardTitle, InfoField, TagList, NoteBox, AgentRow } from "../components/panels";
import {
  Briefcase, Scale, MessageSquare, Flag, Check, MoreH, Phone,
} from "../components/icons";

const INDUSTRIES = ["Manufacturing", "Real Estate", "Fintech/Finance", "F&B", "Healthcare", "Technology", "Energy", "Retail", "Other"];
const STATUS_OPTS: [string, string][] = [
  ["new", "New"], ["collecting", "Qualifying"], ["ready_for_handover", "Ready for Handover"], ["handed_over", "Handed Over"],
];
type Tab = "all" | "open" | "unassigned";

export default function InboxPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchLeads().then((ls) => {
      setLeads(ls);
      setSelectedId((cur) => cur ?? ls[0]?.id ?? null);
    }).catch(() => setLeads([]));
  }, []);

  // Load thread when selection changes
  useEffect(() => {
    if (selectedId == null) { setMessages([]); return; }
    fetchLead(selectedId).then(({ messages }) => setMessages(messages)).catch(() => setMessages([]));
  }, [selectedId]);

  // Realtime updates
  useEffect(() => {
    const s = getSocket();
    const onMsg = (m: Message) => { if (m.leadId === selectedId) setMessages((p) => [...p, m]); };
    const onLead = (l: Lead) => setLeads((p) => p.map((x) => (x.id === l.id ? l : x)));
    s.on("message:new", onMsg);
    s.on("lead:updated", onLead);
    return () => { s.off("message:new", onMsg); s.off("lead:updated", onLead); };
  }, [selectedId]);

  const filtered = useMemo(() => leads.filter((l) => {
    if (tab === "open" && l.status === "handed_over") return false;
    if (tab === "unassigned" && l.status !== "new") return false;
    if (industry && l.industry !== industry) return false;
    if (status && l.status !== status) return false;
    return true;
  }), [leads, tab, industry, status]);

  const counts = useMemo(() => ({
    all: leads.length,
    open: leads.filter((l) => l.status !== "handed_over").length,
    unassigned: leads.filter((l) => l.status === "new").length,
  }), [leads]);

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const send = async (text: string) => { if (selectedId != null) await sendReply(selectedId, text); };

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
      {/* A. LEAD LIST ------------------------------------------------ */}
      <aside style={{
        width: 360, flexShrink: 0, background: "var(--c-surface)", borderRight: "1px solid var(--c-border)",
        display: "flex", flexDirection: "column", minHeight: 0,
      }}>
        <div style={{ padding: "18px 18px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--t-strong)", letterSpacing: "-.4px" }}>Leads</h2>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t-muted)" }}>{filtered.length} conversations</span>
          </div>

          {/* Tabs */}
          <div style={{
            marginTop: 14, display: "flex", gap: 4, padding: 4, background: "var(--c-control-bg)", borderRadius: 11,
          }}>
            {([["all", "All"], ["open", "Active"], ["unassigned", "New"]] as [Tab, string][]).map(([k, label]) => {
              const active = tab === k;
              return (
                <button key={k} className="lf-btn" onClick={() => setTab(k)} style={{
                  flex: 1, height: 32, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: active ? "#fff" : "transparent", color: active ? "var(--c-primary)" : "var(--t-muted)",
                  boxShadow: active ? "var(--sh-tab)" : "none",
                }}>
                  {label}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                    background: active ? "var(--c-primary-tint)" : "rgba(124,137,168,.15)",
                    color: active ? "var(--c-primary)" : "var(--t-muted)",
                  }}>{counts[k]}</span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <select className="lf-select" value={industry} onChange={(e) => setIndustry(e.target.value)} style={selectStyle}>
              <option value="">All industries</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <select className="lf-select" value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
              <option value="">All statuses</option>
              {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Rows */}
        <div className="lf-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 10px 12px" }}>
          {filtered.length === 0 && (
            <p style={{ padding: 24, textAlign: "center", color: "var(--t-faint)", fontSize: 13 }}>No leads.</p>
          )}
          {filtered.map((l) => {
            const sel = l.id === selectedId;
            const sm = statusMeta(l.status);
            return (
              <button key={l.id} className={sel ? "" : "lf-row"} onClick={() => setSelectedId(l.id)} style={{
                width: "100%", textAlign: "left", border: "none", cursor: "pointer", padding: 12, borderRadius: 14,
                display: "flex", gap: 12, marginBottom: 2,
                background: sel ? "#F0F5FF" : "transparent",
                boxShadow: sel ? "inset 3px 0 0 var(--c-primary)" : "none",
              }}>
                <Avatar lead={l} size={46} withDot />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{
                      fontSize: 13.5, fontWeight: 700, color: "var(--t-primary)", letterSpacing: "-.2px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{displayName(l)}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t-faint)", flexShrink: 0 }}>{formatTime(l.updatedAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.companyName || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#8592AC", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.legalNeed || "Need not identified yet"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                    <StatusBadge sm={sm} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t-faint)" }}>{l.industry || "—"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* B. CHAT ----------------------------------------------------- */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--c-chat-bg)" }}>
        {selected ? <ChatPane lead={selected} messages={messages} onSend={send} /> : <EmptyChat />}
      </section>

      {/* C. DETAIL PANEL ------------------------------------------- */}
      <aside className="lf-scroll" style={{
        width: 320, flexShrink: 0, background: "var(--c-surface)", borderLeft: "1px solid var(--c-border)",
        overflowY: "auto",
      }}>
        {selected && <DetailPanel lead={selected} onOpenProfile={() => router.push(`/leads/${selected.id}`)} />}
      </aside>
    </div>
  );
}

const selectStyle: CSSProperties = {
  flex: 1, minWidth: 0, height: 36, padding: "0 12px", borderRadius: 9, border: "1px solid var(--c-border-input)",
  background: "#fff", color: "var(--t-secondary)", fontSize: 12.5, fontWeight: 600, outline: "none",
};

/* ---------------- Chat pane ---------------- */
function ChatPane({ lead, messages, onSend }: { lead: Lead; messages: Message[]; onSend: (t: string) => void | Promise<void> }) {
  const sm = statusMeta(lead.status);
  const ch = channelMeta(lead);
  return (
    <>
      <header style={{
        height: 64, flexShrink: 0, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", gap: 12, padding: "0 22px",
      }}>
        <Avatar lead={lead} size={42} radius={11} withDot />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: "var(--t-strong)", letterSpacing: "-.3px" }}>{displayName(lead)}</span>
            <StatusBadge sm={sm} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: ch.color }} />
            {ch.label} · {lead.companyName || "—"}
          </div>
        </div>
        <button className="lf-btn" style={{
          display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: 10,
          border: "none", background: "#E9F7EF", color: "#16A45E", fontSize: 12.5, fontWeight: 700,
        }}>
          <Check size={16} color="#16A45E" /> Mark Done
        </button>
        <button className="lf-btn lf-outline" style={{
          width: 38, height: 38, borderRadius: 10, border: "1px solid var(--c-border-input)", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-muted)",
        }}>
          <MoreH size={18} />
        </button>
      </header>

      <div className="lf-scroll" style={{ flex: 1, overflowY: "auto", padding: "22px 26px 8px" }}>
        <ChatThread messages={messages} />
      </div>

      <div style={{ padding: "8px 22px 18px" }}>
        <Composer onSend={onSend} />
      </div>
    </>
  );
}

function EmptyChat() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-faint)" }}>
      <div style={{ textAlign: "center" }}>
        <MessageSquare size={40} color="var(--t-faint-2)" />
        <p style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600 }}>Select a lead to view the conversation</p>
      </div>
    </div>
  );
}

/* ---------------- Detail panel (right) ---------------- */
function DetailPanel({ lead, onOpenProfile }: { lead: Lead; onOpenProfile: () => void }) {
  const sm = statusMeta(lead.status);
  const ch = channelMeta(lead);
  const tags = derivedTags(lead);

  return (
    <div style={{ padding: 22 }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Avatar lead={lead} size={72} radius={22} font={28} />
        <h3 style={{ margin: "12px 0 2px", fontSize: 16, fontWeight: 800, color: "var(--t-strong)", letterSpacing: "-.3px" }}>{displayName(lead)}</h3>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--t-muted)" }}>{lead.companyName || "—"}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, width: "100%" }}>
          <button className="lf-btn lf-outline" style={{
            flex: 1, height: 38, borderRadius: 10, border: "1px solid var(--c-border-input)", background: "#fff",
            color: "var(--t-secondary)", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Phone size={15} color="var(--t-secondary)" /> Call
          </button>
          <button className="lf-btn" onClick={onOpenProfile} style={{
            flex: 1.4, height: 38, borderRadius: 10, border: "none", background: "var(--c-primary-tint)",
            color: "var(--c-primary)", fontSize: 12.5, fontWeight: 700,
          }}>
            View Full Profile
          </button>
        </div>
      </div>

      <Divider />
      <ConfidenceMeter conf={lead.confidence} />
      <Divider />

      <SectionLabel>Lead Information</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <InfoField icon={<Briefcase size={16} />} label="Industry" value={lead.industry}
          tileBg="var(--c-primary-tint)" tileColor="var(--c-primary)" />
        <InfoField icon={<Scale size={16} />} label="Legal Need" value={lead.legalNeed}
          tileBg="#F0EBFF" tileColor="#7B52E0" />
        <InfoField icon={<span style={{ width: 7, height: 7, borderRadius: "50%", background: ch.color }} />} label="Channel" value={ch.label} />
        <InfoField icon={<Flag size={15} />} label="Status" value={<StatusBadge sm={sm} />} tileBg={sm.bg} tileColor={sm.text} />
      </div>

      <Divider />
      <SectionLabel>Tags</SectionLabel>
      <TagList tags={tags} />

      <Divider />
      <SectionLabel>Notes</SectionLabel>
      <NoteBox note={null} />

      <Divider />
      <SectionLabel>Assigned Agent</SectionLabel>
      <AgentRow />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--c-divider)", margin: "18px 0" }} />;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: "var(--t-strong)", marginBottom: 12, letterSpacing: "-.2px" }}>{children}</div>;
}
