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
export async function generateHistory(
  client: CacheContractClient,
  count: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const now = new Date();
  const alreadyDone = loadHistory().length;

  // Vary tiers realistically rather than always claiming the max, and derive
  // income/spend that actually support the target tier via the same
  // multiplication check the contract uses: net*100 >= tier*10*income.
  const tierCycle = [2, 3, 4, 3, 2, 4, 3, 4];

  for (let i = 0; i < count; i++) {
    const tier = tierCycle[i % tierCycle.length]!;
    // A month i+1+alreadyDone back from the current one.
    const monthsBack = i + 1 + alreadyDone;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
    const periodId = periodIdForMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);

    const incomeCents = 150_000 + Math.round(Math.random() * 100_000); // $1,500-$2,500
    // Leave a small margin above the tier's minimum required savings rate.
    const maxSpendForTier = Math.floor(incomeCents * (1 - (tier * 10 + 3) / 100));
    const spendCents = Math.max(10_000, maxSpendForTier);

    await client.updateTotals(BigInt(incomeCents), BigInt(spendCents));
    const result = await client.proveSavings(tier, { periodId, generateRealProof: true });

    appendHistoryEntry({ periodId, incomeCents, spendCents, tier });
    addProofReceipt({
      date: d.toISOString(),
      tier: result.tier,
      blocksEarned: result.blocksEarned,
      proofBytesLength: result.proofBytes?.length,
    });

    onProgress?.(i + 1, count);
  }
}
