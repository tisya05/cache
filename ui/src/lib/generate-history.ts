import { periodIdForMonth, type CacheContractClient } from "@cache/contract";
import { appendHistoryEntry, loadHistory } from "@/lib/history";
import { addProofReceipt } from "@/lib/app-storage";

/**
 * Dev-only: backfills N past periods of genuine history so the city has
 * something to show before a demo recording, instead of an empty lot. Every
 * period runs the REAL client — real updateTotals, real proveSavings, a real
 * SNARK from the local proof server, real blocks minted by the real circuit's
 * own tier check. Nothing here is fabricated data; it's real transactions
 * against months that have already passed, which is also why each one uses
 * an explicit past periodId rather than the current month (the current
 * month's real Prove flow is untouched by this and can still run normally).
 */
/** The contract's own nullifier-reuse assertion (cache.compact: `assert(!nullifiers.member(nul), "period already claimed")`).
 *  A prior run's network call can fail client-side (dropped connection,
 *  backgrounded tab) AFTER the ledger already recorded the claim -- the next
 *  attempt then correctly hits this same period as already spent, even
 *  though nothing was ever persisted locally for it. */
const ALREADY_CLAIMED_RE = /already claimed/i;

export async function generateHistory(
  client: CacheContractClient,
  count: number,
  onProgress?: (done: number, total: number) => void,
  // Tokens/tiers/blocks come entirely from the LOCAL circuit simulation --
  // the real proof-server round trip only ever affects the byte length
  // recorded on the receipt, nothing about actual game state. Defaults to
  // true (the dev tool's own advertised behavior: "real proofs"); the
  // automatic fresh-identity seed in cache-client.ts passes false so it
  // never depends on a real network round trip at all.
  generateRealProof = true,
): Promise<void> {
  const now = new Date();
  let alreadyDone = loadHistory().length;

  // Vary tiers realistically rather than always claiming the max, and derive
  // income/spend that actually support the target tier via the same
  // multiplication check the contract uses: net*100 >= tier*10*income.
  const tierCycle = [2, 3, 4, 3, 2, 4, 3, 4];

  // A guard, not a real budget -- bounds the "keep skipping already-claimed
  // periods" loop so a genuinely different failure can't spin forever.
  const maxAttempts = count * 3;
  let attempts = 0;
  let done = 0;

  while (done < count && attempts < maxAttempts) {
    attempts++;
    const tier = tierCycle[done % tierCycle.length]!;
    // A month done+1+alreadyDone back from the current one.
    const monthsBack = done + 1 + alreadyDone;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
    const periodId = periodIdForMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);

    const incomeCents = 150_000 + Math.round(Math.random() * 100_000); // $1,500-$2,500
    // Leave a small margin above the tier's minimum required savings rate.
    const maxSpendForTier = Math.floor(incomeCents * (1 - (tier * 10 + 3) / 100));
    const spendCents = Math.max(10_000, maxSpendForTier);

    try {
      await client.updateTotals(BigInt(incomeCents), BigInt(spendCents));
      const result = await client.proveSavings(tier, { periodId, generateRealProof });

      appendHistoryEntry({ periodId, incomeCents, spendCents, tier });
      addProofReceipt({
        date: d.toISOString(),
        tier: result.tier,
        blocksEarned: result.blocksEarned,
        proofBytesLength: result.proofBytes?.length,
      });

      done++;
      onProgress?.(done, count);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!ALREADY_CLAIMED_RE.test(message)) throw err;
      // This month-slot is already consumed on-chain from a prior partial
      // run -- we don't know its exact committed numbers (nothing was
      // persisted locally for it), so it just won't get its own point on the
      // trend chart. Skip past it rather than retrying the same doomed
      // period forever.
      alreadyDone++;
    }
  }
}
