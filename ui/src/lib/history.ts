/**
 * The local `CacheContractClient` runs an in-memory ledger — nothing survives
 * a page reload on its own. To make "8 months of city growth" real rather
 * than fabricated, we persist the actual sequence of periods proved and
 * REPLAY them (real updateTotals + real proveSavings, same circuits, same
 * nullifier rules) against a fresh client on every load. This is the local-
 * simulation equivalent of a real chain remembering its own history: the
 * state is reconstructed by re-executing real transactions, not invented.
 */

import { readJSON } from "@/lib/safe-storage";

const HISTORY_KEY = "cache:proof-history:v1";

export type HistoryEntry = {
  periodIdHex: string;
  incomeCents: number;
  spendCents: number;
  tier: number;
};

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

export function loadHistory(): HistoryEntry[] {
  return readJSON<HistoryEntry[]>(HISTORY_KEY, []);
}

export function appendHistoryEntry(entry: Omit<HistoryEntry, "periodIdHex"> & { periodId: Uint8Array }): void {
  const history = loadHistory();
  history.push({
    periodIdHex: toHex(entry.periodId),
    incomeCents: entry.incomeCents,
    spendCents: entry.spendCents,
    tier: entry.tier,
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
