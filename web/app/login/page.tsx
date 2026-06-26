"use client";
import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/api";
import { FileText } from "../../components/icons";

const inputStyle: CSSProperties = {
  width: "100%", height: 44, padding: "0 14px", borderRadius: "var(--r-input)",
  border: "1px solid var(--c-border-input)", background: "#fff", outline: "none",
  fontSize: 14, fontWeight: 500, color: "var(--t-primary)",
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed, please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--c-page-bg)", padding: 20,
    }}>
      <div className="lf-pop" style={{
        width: "100%", maxWidth: 400, background: "var(--c-surface)", borderRadius: "var(--r-card)",
        border: "1px solid var(--c-border-card)", boxShadow: "var(--sh-card)", padding: "34px 30px",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 26 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: "var(--grad-btn)",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-primary)",
          }}>
            <FileText size={24} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ margin: "16px 0 4px", fontSize: 21, fontWeight: 800, color: "var(--t-strong)", letterSpacing: "-.5px" }}>
            Sign in to Leadflow
          </h1>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--t-muted)" }}>
            Internal dashboard for the legal team
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 13px", borderRadius: 10, background: "#FDECEC", border: "1px solid #F6C9C9",
              color: "#C23A3A", fontSize: 12.5, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button
            className="lf-btn lf-primary"
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, height: 46, borderRadius: 12, border: "none", background: "var(--grad-btn)",
              color: "#fff", fontSize: 14.5, fontWeight: 700, boxShadow: "var(--sh-primary)",
              opacity: loading ? 0.7 : 1, cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "block", marginBottom: 7, fontSize: 12.5, fontWeight: 700,
  color: "var(--t-secondary)", letterSpacing: "-.1px",
};
