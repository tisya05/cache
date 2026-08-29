/** Small localStorage-backed persistence for onboarding/goal state. Not sensitive data. */

export type Goal =
  | { kind: "percent"; percent: number }
  | { kind: "amount"; amountCents: number; deadline: string };

export type Split = { needs: number; wants: number; savings: number };

export type GoalsConfig = {
  goal: Goal;
  split: Split;
  expectedIncomeCents?: number;
};

const GOALS_KEY = "cache:goals:v1";
const ONBOARDED_KEY = "cache:onboarded:v1";
const CHEAT_MODE_KEY = "cache:cheat-mode:v1";
const REVIEWED_IDS_KEY = "cache:reviewed-ids:v1";
const CATEGORY_OVERRIDES_KEY = "cache:category-overrides:v1";
const BLOCKS_PLACED_KEY = "cache:blocks-placed:v1";

export const DEFAULT_SPLIT: Split = { needs: 50, wants: 30, savings: 20 };

export function loadGoals(): GoalsConfig | null {
  const raw = localStorage.getItem(GOALS_KEY);
  return raw ? (JSON.parse(raw) as GoalsConfig) : null;
}

export function saveGoals(config: GoalsConfig): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(config));
}

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === "1";
}

export function markOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, "1");
}

export function isCheatModeOn(): boolean {
  return localStorage.getItem(CHEAT_MODE_KEY) === "1";
}

export function setCheatMode(on: boolean): void {
  localStorage.setItem(CHEAT_MODE_KEY, on ? "1" : "0");
}

export function loadReviewedIds(): Set<string> {
  const raw = localStorage.getItem(REVIEWED_IDS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

export function markReviewed(id: string): void {
  const ids = loadReviewedIds();
  ids.add(id);
  localStorage.setItem(REVIEWED_IDS_KEY, JSON.stringify([...ids]));
}

export function loadCategoryOverrides(): Record<string, string> {
  const raw = localStorage.getItem(CATEGORY_OVERRIDES_KEY);
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

export function setCategoryOverride(id: string, category: string): void {
  const overrides = loadCategoryOverrides();
  overrides[id] = category;
  localStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(overrides));
}

/** Which building kinds (0..7) have been placed, in placement order. Purely cosmetic/local. */
export function loadBlocksPlaced(): number[] {
  const raw = localStorage.getItem(BLOCKS_PLACED_KEY);
  return raw ? (JSON.parse(raw) as number[]) : [];
}

export function addBlockPlaced(kind: number): void {
  const placed = loadBlocksPlaced();
  placed.push(kind);
  localStorage.setItem(BLOCKS_PLACED_KEY, JSON.stringify(placed));
}

export type ProofReceipt = {
  date: string;
  tier: number;
  blocksEarned: number;
  proofBytesLength?: number;
};

const PROOF_RECEIPTS_KEY = "cache:proof-receipts:v1";

export function loadProofReceipts(): ProofReceipt[] {
  const raw = localStorage.getItem(PROOF_RECEIPTS_KEY);
  return raw ? (JSON.parse(raw) as ProofReceipt[]) : [];
}

export function addProofReceipt(receipt: ProofReceipt): void {
  const receipts = loadProofReceipts();
  receipts.unshift(receipt);
  localStorage.setItem(PROOF_RECEIPTS_KEY, JSON.stringify(receipts));
}
