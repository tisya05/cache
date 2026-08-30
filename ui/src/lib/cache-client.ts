import { createCacheContractClient, FetchZkConfigProvider, type CacheContractClient } from "@cache/contract";
import { loadHistory, fromHex } from "@/lib/history";
import { loadBuildLog } from "@/lib/city-grid";
import { generateHistory } from "@/lib/generate-history";

/** How many months of demo history a brand-new identity gets seeded with,
 *  so there's always a token balance to build a city with -- including
 *  right after Profile → Clear all data, which creates a fresh identity
 *  with nothing else the app could show. Not literally the SAME tokens
 *  surviving a wipe (a wipe deletes the identity itself, so there's nothing
 *  to survive) -- every fresh identity re-provisions itself the same way. */
const DEMO_SEED_MONTHS = 12;

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
      // Same-origin, proxied to the real proof server by vite.config.ts. A
      // literal "http://localhost:6300" only works when the browser and the
      // proof server are the same machine; through a tunnel (a phone on a
      // different network) "localhost" means the phone's own loopback,
      // which has nothing listening on it. Built from window.location
      // rather than a relative string: the proof-provider package does
      // `new URL(baseUrl)` with no base argument, which throws on anything
      // that isn't already absolute.
      proofServerUrl: `${window.location.origin}/proof-server`,
    });
    const snapshot = await c.getLedgerSnapshot();
    const isFreshIdentity = !snapshot.registered;
    if (isFreshIdentity) {
      await c.register();
    }
    // A brand-new identity (including one just created after a data wipe)
    // has zero blocks and nothing to build with -- seed history for it once
    // so there's always a demo-able city instead of an empty lot on first
    // load. generateRealProof: false on purpose -- this must never depend on
    // a real proof-server round trip (a single dropped connection across 12
    // sequential real network calls used to be enough to fail the ENTIRE app
    // boot, with no way to recover short of a lucky retry). Tokens/tiers
    // come from the local circuit simulation regardless of that flag; only
    // the byte-length recorded on a receipt would differ, which nothing
    // here reads. Gated on isFreshIdentity (not just "history is empty") so
    // this can never re-run for a real returning identity that legitimately
    // has none. generateHistory already runs these against THIS client and
    // persists them via appendHistoryEntry, so they must NOT also go
    // through the replay loop below -- replaying them a second time on the
    // same client would just be 12 guaranteed, wasted "already claimed"
    // round trips.
    const isFreshSeed = isFreshIdentity && loadHistory().length === 0;
    if (isFreshSeed) {
      await generateHistory(c, DEMO_SEED_MONTHS, undefined, false);
    }
    // Replay real history: the in-memory local ledger has nothing else to
    // remember across a reload, so every period ever proved gets re-executed
    // (real updateTotals + real proveSavings, same nullifier rules) rather
    // than the app just forgetting all prior progress on refresh.
    if (!isFreshSeed) {
      for (const entry of loadHistory()) {
        try {
          await c.updateTotals(BigInt(entry.incomeCents), BigInt(entry.spendCents));
          await c.proveSavings(entry.tier, { periodId: fromHex(entry.periodIdHex) });
        } catch (err) {
          // A stale/duplicate entry (e.g. from an interrupted dev-tool
          // backfill run -- see generate-history.ts) throws "period already
          // claimed" here on every single future load, since replay is
          // unconditional and this loop previously had no error handling at
          // all: one bad entry meant the client promise never resolved and
          // the app was stuck on "Loading…" forever, with no way to
          // self-heal. Skipping a duplicate is safe -- the period's real
          // claim already replayed successfully earlier in this same loop
          // -- but any OTHER failure still needs to be loud, not swallowed.
          const message = err instanceof Error ? err.message : String(err);
          if (!/already claimed/i.test(message)) throw err;
          console.warn(`Skipping duplicate history entry during replay: ${message}`);
        }
      }
    }
    // Replay every real build() call too, in the same order, so the token
    // balance on reload matches what the (separately, locally persisted)
    // city grid shows as already spent.
    for (const kind of loadBuildLog()) {
      await c.build(kind);
    }
    return c;
  })();

  cached = { secretHex, client };
  return client;
}
