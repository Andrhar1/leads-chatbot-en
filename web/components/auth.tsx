"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, logout as apiLogout, type AuthUser } from "../lib/api";
import { AppShell } from "./chrome";

interface AuthCtx { user: AuthUser | null; logout: () => Promise<void>; }
const Ctx = createContext<AuthCtx>({ user: null, logout: async () => {} });
export const useAuth = () => useContext(Ctx);

function FullLoader() {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--t-faint)", fontSize: 13, fontWeight: 600,
    }}>
      Loading…
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; user: AuthUser | null }>({ loading: true, user: null });

  useEffect(() => {
    let alive = true;
    fetchMe().then((u) => { if (alive) setState({ loading: false, user: u }); });
    return () => { alive = false; };
  }, [pathname]);

  // Not logged in & not on the login page → redirect to /login.
  useEffect(() => {
    if (!state.loading && !state.user && pathname !== "/login") router.replace("/login");
  }, [state, pathname, router]);

  // The login page is rendered bare, without the app shell.
  if (pathname === "/login") return <>{children}</>;

  if (state.loading || !state.user) return <FullLoader />;

  const logout = async () => {
    await apiLogout();
    setState({ loading: false, user: null });
    router.replace("/login");
  };

  return (
    <Ctx.Provider value={{ user: state.user, logout }}>
      <AppShell user={state.user} onLogout={logout}>{children}</AppShell>
    </Ctx.Provider>
  );
}
