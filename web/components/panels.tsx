"use client";
import type { CSSProperties, ReactNode } from "react";
import { Plus } from "./icons";

/* ---------------- Card ---------------- */
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{
      background: "var(--c-surface)", border: "1px solid var(--c-border-card)", borderRadius: 18,
      boxShadow: "var(--sh-card)", padding: 20, ...style,
    }}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--t-strong)", letterSpacing: "-.3px" }}>{children}</h3>
      {action}
    </div>
  );
}

/* ---------------- Info field (icon tile + label/value) ---------------- */
export function InfoField({
  icon, label, value, tileBg = "var(--c-control-bg)", tileColor = "var(--t-muted)", tileSize = 32,
}: {
  icon: ReactNode; label: string; value: ReactNode;
  tileBg?: string; tileColor?: string; tileSize?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <div style={{
        width: tileSize, height: tileSize, borderRadius: 9, flexShrink: 0, background: tileBg,
        color: tileColor, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t-faint)", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t-primary)", wordBreak: "break-word" }}>{value || "—"}</div>
      </div>
    </div>
  );
}

/* ---------------- Tag list ---------------- */
export function TagList({ tags }: { tags: { t: string; c: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {tags.map((tag) => (
        <span key={tag.t} style={{
          padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: `${tag.c}1A`, color: tag.c,
        }}>
          {tag.t}
        </span>
      ))}
      <button className="lf-btn" style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20,
        border: "1px dashed var(--c-border-input)", background: "transparent", color: "var(--t-muted)",
        fontSize: 12, fontWeight: 600,
      }}>
        <Plus size={13} color="var(--t-muted)" /> Add
      </button>
    </div>
  );
}

/* ---------------- Note box ---------------- */
export function NoteBox({ note }: { note: string | null }) {
  return (
    <div style={{
      background: "#FFF9EC", border: "1px solid #FBE4BC", borderRadius: 12, padding: "12px 14px",
      fontSize: 12.5, lineHeight: 1.55, color: "#7A6322", fontWeight: 500,
    }}>
      {note || <span style={{ color: "#B79A55" }}>No notes for this lead yet.</span>}
    </div>
  );
}

/* ---------------- Agent card ---------------- */
export function AgentRow({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", background: "var(--c-primary-deep)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>
        N
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t-primary)" }}>Nadia (You)</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#16A45E", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9 }}>●</span> Online
        </div>
      </div>
    </div>
  );
}
