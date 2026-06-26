"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Lead, Message } from "../lib/api";
import {
  avatarColor, channelMeta, confColor, confPct, initial, messageTime,
  statusMeta, type StatusMeta,
} from "../lib/decorate";
import { Send, Smile, Paperclip, FileText } from "./icons";

/* ---------------- Avatar ---------------- */
export function Avatar({
  lead, size = 46, radius = 12, font, withDot = false,
}: { lead: Lead; size?: number; radius?: number; font?: number; withDot?: boolean }) {
  const ch = channelMeta(lead);
  const dot = Math.round(size * 0.34);
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: radius, background: avatarColor(lead),
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: font ?? Math.round(size * 0.42), letterSpacing: "-.3px",
      }}>
        {initial(lead)}
      </div>
      {withDot && (
        <span style={{
          position: "absolute", right: -2, bottom: -2, width: dot, height: dot,
          borderRadius: "50%", background: ch.color, border: "2.5px solid #fff",
        }} />
      )}
    </div>
  );
}

/* ---------------- Status badge ---------------- */
export function StatusBadge({ status, sm }: { status?: string; sm?: StatusMeta }) {
  const m = sm ?? statusMeta(status ?? "new");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px",
      borderRadius: 7, background: m.bg, color: m.text, fontSize: 11, fontWeight: 600,
      whiteSpace: "nowrap", letterSpacing: "-.1px",
    }}>
      {m.label}
    </span>
  );
}

/* ---------------- Confidence meter ---------------- */
export function ConfidenceMeter({
  conf, big = false, caption,
}: { conf: number | null; big?: boolean; caption?: string }) {
  const pct = confPct(conf);
  const color = confColor(conf);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        {!big && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t-muted)" }}>AI Confidence Score</span>}
        <span style={{ fontSize: big ? 22 : 13.5, fontWeight: 800, color, letterSpacing: "-.4px" }}>{pct}%</span>
      </div>
      <div style={{
        marginTop: 8, height: big ? 10 : 8, borderRadius: 999, background: "var(--c-divider)", overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 999,
          background: `linear-gradient(90deg, ${color}, ${color})`, transition: "width .5s cubic-bezier(.22,1,.36,1)",
        }} />
      </div>
      {caption && <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--t-faint)" }}>{caption}</p>}
    </div>
  );
}

/* ---------------- Chat thread (message bubbles) ---------------- */
export function ChatThread({
  messages, inset = false,
}: { messages: Message[]; inset?: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", margin: "2px 0 18px" }}>
        <span style={{
          padding: "4px 12px", borderRadius: 999, background: "#E7ECF7",
          fontSize: 11, fontWeight: 600, color: "var(--t-muted)",
        }}>
          Today
        </span>
      </div>
      {messages.map((m) => {
        const us = m.direction === "out";
        return (
          <div key={m.id} className="lf-pop" style={{
            display: "flex", justifyContent: us ? "flex-end" : "flex-start", marginBottom: 12,
          }}>
            <div style={{ maxWidth: "74%" }}>
              <div style={{
                padding: "10px 13px",
                background: us ? "linear-gradient(135deg, #2A6BFF, #3D7BFF)" : (inset ? "#fff" : "var(--c-surface)"),
                color: us ? "#fff" : "#27324C",
                border: us ? "none" : "1px solid var(--c-border-card)",
                borderRadius: us ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, boxShadow: "var(--sh-bubble)",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {m.body}
              </div>
              <div style={{
                marginTop: 4, fontSize: 10, fontWeight: 600, color: "var(--t-faint)",
                textAlign: us ? "right" : "left", paddingInline: 4,
              }}>
                {messageTime(m.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </>
  );
}

/* ---------------- Composer ---------------- */
const iconBtn: CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: "none", background: "var(--c-control-bg)",
  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-muted)",
};

export function Composer({ onSend }: { onSend: (text: string) => void | Promise<void> }) {
  const [draft, setDraft] = useState("");
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    void onSend(t);
    setDraft("");
  };
  return (
    <div style={{
      background: "var(--c-surface)", borderRadius: 16, border: "1px solid var(--c-border-card)",
      padding: 12, boxShadow: "var(--sh-card)",
    }}>
      <textarea
        className="lf-scroll"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder="Type a reply…  Press Enter to send"
        rows={2}
        style={{
          width: "100%", border: "none", outline: "none", resize: "none", background: "transparent",
          fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: "var(--t-primary)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button className="lf-btn lf-ghost" style={iconBtn} title="Emoji" type="button"><Smile size={17} /></button>
        <button className="lf-btn lf-ghost" style={iconBtn} title="Attachment" type="button"><Paperclip size={17} /></button>
        <button className="lf-btn lf-ghost" style={{
          ...iconBtn, width: "auto", padding: "0 12px", gap: 7, fontSize: 12.5, fontWeight: 600,
          color: "var(--t-secondary)",
        }} title="Template" type="button">
          <FileText size={15} /> Template
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="lf-btn lf-primary"
          onClick={send}
          type="button"
          style={{
            display: "flex", alignItems: "center", gap: 7, height: 36, padding: "0 16px",
            borderRadius: 10, border: "none", background: "var(--grad-btn)", color: "#fff",
            fontSize: 13, fontWeight: 700, boxShadow: "var(--sh-primary)",
          }}
        >
          <Send size={16} /> Send
        </button>
      </div>
    </div>
  );
}
