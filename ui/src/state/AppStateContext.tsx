import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CacheContractClient, CacheLedgerSnapshot } from "@cache/contract";

import { getCacheClient } from "@/lib/cache-client";
import { createIdentitySecret, loadIdentitySecret } from "@/lib/identity";
import { isOnboarded } from "@/lib/app-storage";

export type Screen =
  | "welcome"
  | "goals"
  | "connect"
  | "city"
  | "insights"
  | "friends"
  | "profile"
  | "prove"
  | "review"
  | "transactionLog";

interface AppStateValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  identitySecret: Uint8Array | null;
  client: CacheContractClient | null;
  clientReady: boolean;
  clientError: string | null;
  ledger: CacheLedgerSnapshot | null;
  refreshLedger: () => Promise<void>;
  createIdentity: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => {
    const existing = loadIdentitySecret();
    if (!existing) return "welcome";
    return isOnboarded() ? "city" : "goals";
  });
  const [identitySecret, setIdentitySecret] = useState<Uint8Array | null>(() => loadIdentitySecret());
  const [client, setClient] = useState<CacheContractClient | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<CacheLedgerSnapshot | null>(null);

  useEffect(() => {
    if (!identitySecret) return;
    let cancelled = false;
    // Registration and history replay happen inside getCacheClient itself
    // (see cache-client.ts) so they run exactly once regardless of how many
    // times this effect fires.
    getCacheClient(identitySecret)
      .then(async (c) => {
        if (cancelled) return;
        setClient(c);
        setLedger(await c.getLedgerSnapshot());
      })
      .catch((err) => {
        // Without this, a rejected promise here (a bad history entry, a
        // dropped proof-server connection, anything) left clientReady false
        // forever with no error and no way to tell -- just an unexplained,
        // permanent "Loading…" screen.
        if (cancelled) return;
        setClientError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [identitySecret]);

  const refreshLedger = useCallback(async () => {
    if (!client) return;
    setLedger(await client.getLedgerSnapshot());
  }, [client]);

  const createIdentity = useCallback(() => {
    const secret = createIdentitySecret();
    setIdentitySecret(secret);
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const value = useMemo<AppStateValue>(
    () => ({
      screen,
      navigate,
      identitySecret,
      client,
      clientReady: client !== null,
      clientError,
      ledger,
      refreshLedger,
      createIdentity,
    }),
    [screen, navigate, identitySecret, client, clientError, ledger, refreshLedger, createIdentity],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
