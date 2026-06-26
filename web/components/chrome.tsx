"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Inbox, Users, BarChart, Settings, Search, Plus, FileText, LogOut } from "./icons";
import type { AuthUser } from "../lib/api";

/* ---------------- User menu ---------------- */
function UserMenu({ user, onLogout }: { user: AuthUser; onLogout: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (user.name || user.username).trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="lf-btn"
        onClick={() => setOpen((v) => !v)}
        title={user.name}
        style={{
          width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--c-primary-deep)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          fontSize: 14, fontWeight: 700, boxShadow: "0 0 0 2px rgba(255,255,255,.35)",
        }}
      >
        {initial}
      </button>
      {open && (
        <div className="lf-pop" style={{
          position: "absolute", top: 46, right: 0, width: 200, background: "var(--c-surface)",
          borderRadius: 14, border: "1px solid var(--c-border-card)", boxShadow: "var(--sh-card)",
          padding: 8, zIndex: 20,
        }}>
          <div style={{ padding: "8px 10px 10px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t-strong)", letterSpacing: "-.2px" }}>{user.name}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t-faint)" }}>@{user.username}</div>
          </div>
          <div style={{ height: 1, background: "var(--c-divider)", margin: "2px 0 6px" }} />
          <button
            className="lf-btn lf-ghost"
            onClick={() => { setOpen(false); void onLogout(); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9, height: 36, padding: "0 10px",
              border: "none", borderRadius: 9, background: "transparent", color: "#D14343",
              fontSize: 13, fontWeight: 600, textAlign: "left",
            }}
          >
            <LogOut size={16} color="#D14343" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Top bar ---------------- */
function TopBar({
  search, onSearch, user, onLogout,
}: { search: string; onSearch: (v: string) => void; user: AuthUser; onLogout: () => void | Promise<void> }) {
  return (
    <header style={{
      height: 60, flexShrink: 0, display: "flex", alignItems: "center", gap: 18,
      padding: "0 18px", background: "var(--grad-header)", boxShadow: "var(--sh-header)",
      position: "relative", zIndex: 5,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.18)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        }}>
          <FileText size={19} color="#fff" strokeWidth={2} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-.4px" }}>Leadflow</span>
      </div>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.85)" }}>
          <Search size={17} color="rgba(255,255,255,.85)" />
        </span>
        <input
          className="lf-search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search leads, companies, or conversations…"
          style={{
            width: "100%", height: 38, paddingLeft: 38, paddingRight: 14, borderRadius: 10,
            border: "none", outline: "none", background: "rgba(255,255,255,.16)", color: "#fff",
            fontSize: 13, fontWeight: 500,
          }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <button className="lf-btn" style={{
        display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px",
        borderRadius: 10, border: "none", background: "#fff", color: "var(--c-primary)",
        fontSize: 13, fontWeight: 700,
      }}>
        <Plus size={17} color="var(--c-primary)" /> New Lead
      </button>
      <UserMenu user={user} onLogout={onLogout} />
    </header>
  );
}

/* ---------------- Icon rail ---------------- */
const RAIL = [
  { key: "inbox", label: "Inbox", icon: Inbox, href: "/" },
  { key: "leads", label: "Leads", icon: Users, href: "/" },
  { key: "reports", label: "Reports", icon: BarChart, href: "/" },
];

function RailItem({
  label, icon: Icon, active, onClick,
}: { label: string; icon: typeof Inbox; active: boolean; onClick: () => void }) {
  const base: CSSProperties = {
    width: 60, padding: "10px 0", borderRadius: 12, border: "none", background: active ? "var(--c-primary-tint)" : "transparent",
    color: active ? "var(--c-primary)" : "#8A97B4", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 5, transition: "background-color .14s ease, color .14s ease",
  };
  return (
    <button className="lf-btn" style={base} onClick={onClick}>
      <Icon size={22} color={active ? "var(--c-primary)" : "#8A97B4"} />
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function IconRail() {
  const router = useRouter();
  const pathname = usePathname();
  const onInbox = pathname === "/" || pathname.startsWith("/leads");
  return (
    <nav style={{
      width: 76, flexShrink: 0, background: "var(--c-surface)", borderRight: "1px solid var(--c-border)",
      display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 6,
    }}>
      {RAIL.map((r) => (
        <RailItem
          key={r.key}
          label={r.label}
          icon={r.icon}
          active={r.key === "inbox" ? onInbox : false}
          onClick={() => router.push(r.href)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <RailItem label="Settings" icon={Settings} active={false} onClick={() => {}} />
    </nav>
  );
}

/* ---------------- App shell ---------------- */
export function AppShell({
  children, user, onLogout,
}: { children: React.ReactNode; user: AuthUser; onLogout: () => void | Promise<void> }) {
  const [search, setSearch] = useState("");
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar search={search} onSearch={setSearch} user={user} onLogout={onLogout} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <IconRail />
        {children}
      </div>
    </div>
  );
}
