"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchLead, type Lead, type Message } from "../../../lib/api";
import { getSocket } from "../../../lib/socket";
import {
  statusMeta, channelMeta, displayName, formatDateLong, phoneFromChatId, timeline,
  avatarColor, initial, derivedTags,
} from "../../../lib/decorate";
import { StatusBadge, ConfidenceMeter, ChatThread } from "../../../components/primitives";
import { Card, CardTitle, InfoField, TagList, NoteBox, AgentRow } from "../../../components/panels";
import {
  ChevronLeft, Briefcase, Scale, Flag, MessageSquare, Calendar, Sparkle,
  Phone, Mail, MapPin, Globe, ArrowRight,
} from "../../../components/icons";

export default function LeadDetailPage() {
  const id = Number(useParams().id);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    fetchLead(id).then(({ lead, messages }) => { setLead(lead); setMessages(messages); }).catch(() => setLead(null));
    const s = getSocket();
    const onMsg = (m: Message) => { if (m.leadId === id) setMessages((p) => [...p, m]); };
    const onLead = (l: Lead) => { if (l.id === id) setLead(l); };
    s.on("message:new", onMsg);
    s.on("lead:updated", onLead);
    return () => { s.off("message:new", onMsg); s.off("lead:updated", onLead); };
  }, [id]);

  if (!lead) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-faint)" }}>
        Loading…
      </div>
    );
  }

  const sm = statusMeta(lead.status);
  const ch = channelMeta(lead);
  const tags = derivedTags(lead);
  const steps = timeline(lead);
  const avColor = avatarColor(lead);
  const init = initial(lead);

  return (
    <div className="lf-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--c-page-bg)" }}>
      {/* Sub-header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 3, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", gap: 14, padding: "14px 28px",
      }}>
        <button className="lf-btn lf-outline" onClick={() => router.push("/")} style={{
          display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 13px", borderRadius: 10,
          border: "1px solid var(--c-border-input)", background: "#fff", color: "var(--t-secondary)",
          fontSize: 12.5, fontWeight: 700,
        }}>
          <ChevronLeft size={16} color="var(--t-secondary)" /> Back
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t-muted)" }}>
          Leads <span style={{ color: "var(--t-faint-2)" }}>/</span> <span style={{ color: "var(--t-primary)", fontWeight: 700 }}>{displayName(lead)}</span>
        </span>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 28px 40px" }}>
        {/* Hero card */}
        <Card style={{ padding: 24, display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 26, flexShrink: 0, background: avColor, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700, letterSpacing: "-.5px",
          }}>
            {init}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t-strong)", letterSpacing: "-.5px" }}>{displayName(lead)}</h1>
              <StatusBadge sm={sm} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 600, color: "var(--t-muted)" }}>{lead.companyName || "—"}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: "var(--t-faint)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: ch.color }} /> {ch.label}
              </span>
              <span>Received {formatDateLong(lead.createdAt)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button className="lf-btn lf-outline" onClick={() => router.push("/")} style={{
              display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 16px", borderRadius: 10,
              border: "1px solid var(--c-border-input)", background: "#fff", color: "var(--t-secondary)",
              fontSize: 13, fontWeight: 700,
            }}>
              <MessageSquare size={16} color="var(--t-secondary)" /> Open Chat
            </button>
            <button className="lf-btn lf-primary" style={{
              height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: "var(--grad-btn)",
              color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "var(--sh-primary)",
            }}>
              Hand Over to Team
            </button>
          </div>
        </Card>

        {/* Two-column grid */}
        <div className="lf-detail-grid" style={{ marginTop: 20 }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <Card>
              <CardTitle>Lead Information</CardTitle>
              <div className="lf-info-grid">
                <InfoField icon={<Briefcase size={17} />} label="Industry" value={lead.industry} tileSize={40} tileBg="var(--c-primary-tint)" tileColor="var(--c-primary)" />
                <InfoField icon={<Scale size={17} />} label="Legal Need" value={lead.legalNeed} tileSize={40} tileBg="#F0EBFF" tileColor="#7B52E0" />
                <InfoField icon={<Flag size={16} />} label="Status" value={<StatusBadge sm={sm} />} tileSize={40} tileBg={sm.bg} tileColor={sm.text} />
                <InfoField icon={<span style={{ width: 8, height: 8, borderRadius: "50%", background: ch.color }} />} label="Channel" value={ch.label} tileSize={40} />
                <InfoField icon={<Calendar size={16} />} label="Date Received" value={formatDateLong(lead.createdAt)} tileSize={40} tileBg="#E9F7EF" tileColor="#16A45E" />
                <InfoField icon={<Sparkle size={16} />} label="Lead Source" value={ch.label} tileSize={40} tileBg="#FFF3E0" tileColor="#E8870B" />
              </div>
            </Card>

            <Card>
              <CardTitle action={
                <button className="lf-btn" onClick={() => router.push("/")} style={{
                  display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none",
                  color: "var(--c-primary)", fontSize: 12.5, fontWeight: 700,
                }}>
                  Open in Inbox <ArrowRight size={14} color="var(--c-primary)" />
                </button>
              }>Conversation History</CardTitle>
              <div className="lf-scroll" style={{
                background: "var(--c-surface-tint)", border: "1px solid var(--c-divider)", borderRadius: 14,
                padding: "16px 16px 8px", maxHeight: 300, overflowY: "auto",
              }}>
                {messages.length === 0
                  ? <p style={{ textAlign: "center", color: "var(--t-faint)", fontSize: 13, padding: 16 }}>No conversation yet.</p>
                  : <ChatThread messages={messages} inset />}
              </div>
            </Card>

            <Card>
              <CardTitle>Activity History</CardTitle>
              <div>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{
                        width: 11, height: 11, borderRadius: "50%", background: s.color, flexShrink: 0,
                        border: "3px solid #fff", boxShadow: `0 0 0 2px ${s.color}55`, marginTop: 3,
                      }} />
                      {i < steps.length - 1 && <span style={{ flex: 1, width: 2, background: "var(--c-border)", marginTop: 2 }} />}
                    </div>
                    <div style={{ paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t-primary)" }}>{s.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--t-muted-2)", marginTop: 1 }}>{s.desc}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t-faint)", marginTop: 3 }}>{s.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <Card>
              <CardTitle>AI Confidence Score</CardTitle>
              <ConfidenceMeter conf={lead.confidence} big
                caption="Estimated lead quality based on data completeness & conversation signals." />
            </Card>

            <Card>
              <CardTitle>Contact</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <InfoField icon={<Phone size={16} />} label="Phone Number" value={phoneFromChatId(lead.waChatId)} tileSize={36} />
                <InfoField icon={<Mail size={16} />} label="Email" value={null} tileSize={36} />
                <InfoField icon={<MapPin size={16} />} label="Location" value={null} tileSize={36} />
                <InfoField icon={<Globe size={16} />} label="Website" value={null} tileSize={36} />
              </div>
            </Card>

            <Card>
              <CardTitle>Tags</CardTitle>
              <TagList tags={tags} />
            </Card>

            <Card>
              <CardTitle>Notes</CardTitle>
              <NoteBox note={null} />
            </Card>

            <Card>
              <CardTitle>Assigned Agent</CardTitle>
              <AgentRow size={38} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
