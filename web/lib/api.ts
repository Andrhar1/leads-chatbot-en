const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Lead {
  id: number; waChatId: string; personName: string | null; companyName: string | null;
  industry: string | null; legalNeed: string | null; status: string;
  confidence: number | null; needsReview: boolean; createdAt: string; updatedAt: string;
}
export interface Message { id: number; leadId: number; direction: "in" | "out"; body: string; createdAt: string; }
export interface AuthUser { id: number; username: string; name: string; }

export async function fetchLeads(filter: Record<string, string> = {}): Promise<Lead[]> {
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
  const res = await fetch(`${BASE}/leads?${qs}`, { cache: "no-store", credentials: "include" });
  return res.json();
}
export async function fetchLead(id: number): Promise<{ lead: Lead; messages: Message[] }> {
  const res = await fetch(`${BASE}/leads/${id}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error("not found");
  return res.json();
}
export async function sendReply(id: number, text: string): Promise<void> {
  await fetch(`${BASE}/leads/${id}/reply`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  });
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Login failed, please try again.");
  }
  return (await res.json()).user;
}
export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" });
}
export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/auth/me`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()).user;
}

export const API_BASE = BASE;
