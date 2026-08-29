import { createCacheContractClient, FetchZkConfigProvider, type CacheContractClient } from "@cache/contract";
import { loadHistory, fromHex } from "@/lib/history";

let cached: { secretHex: string; client: Promise<CacheContractClient> } | null = null;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Memoized per-secret AND self-initializing: register() and history replay
 * happen exactly once per secret per page load, inside this cached promise,
 * regardless of how many times or how many components call this (including
 * React StrictMode's double effect invocation in dev). Doing this in the
 * caller instead — e.g. in a useEffect after awaiting the client — would run
 * register()/replay every time that effect re-fires, and a second register()
 * or a second proveSavings() for an already-claimed period throws.
 */
export function getCacheClient(secret: Uint8Array): Promise<CacheContractClient> {
  const secretHex = toHex(secret);
  if (cached?.secretHex === secretHex) return cached.client;

  const client = (async () => {
    const c = await createCacheContractClient({
      mode: "local",
      secret,
      zkConfigProvider: new FetchZkConfigProvider("/managed/cache"),
    });
    const snapshot = await c.getLedgerSnapshot();
    if (!snapshot.registered) {
      await c.register();
    }
    // Replay real history: the in-memory local ledger has nothing else to
    // remember across a reload, so every period ever proved gets re-executed
    // (real updateTotals + real proveSavings, same nullifier rules) rather
    // than the app just forgetting all prior progress on refresh.
    for (const entry of loadHistory()) {
      await c.updateTotals(BigInt(entry.incomeCents), BigInt(entry.spendCents));
      await c.proveSavings(entry.tier, { periodId: fromHex(entry.periodIdHex) });
    }
    return c;
  })();

  cached = { secretHex, client };
  return client;
}
