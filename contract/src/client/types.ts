/**
 * The contract-calls interface. Every consumer of the Cache contract (the
 * ingest pipeline, the future UI, any CLI) should depend on this interface,
 * not on a concrete implementation. Swapping `LocalCacheContractClient` (runs
 * circuits in-process, no network) for a real deployed-contract client is a
 * config change — see {@link createCacheContractClient} — not a rewrite.
 */

/** Public ledger facts about one user, decoded from on-chain state. */
export type CacheLedgerSnapshot = {
  /** Whether `register()` has been called for this identity. */
  registered: boolean;
  /** Highest tier proven for the most recently claimed period (0 if none yet). */
  tier: number;
  /** Unspent game blocks available to spend via `build()`. */
  blocks: number;
  /** Whether a totals commitment has been written (`updateTotals` called at least once this period). */
  hasCommitment: boolean;
};

/** Result of a successful `proveSavings` call. */
export type ProveSavingsResult = {
  tier: number;
  /** Blocks minted by this claim (always `tier + 1` — see cache.compact). */
  blocksEarned: number;
  /** Total unspent blocks after this claim. */
  totalBlocks: number;
  /**
   * The real SNARK bytes, present only when the caller asked for one (local
   * mode: requires the proof server; deployed mode: always present, since a
   * transaction cannot submit without one).
   */
  proofBytes?: Uint8Array;
  /** On-chain transaction hash. Present only in deployed mode. */
  txHash?: string;
};

export type ProveSavingsOptions = {
  /**
   * Opaque identifier for the period being claimed (e.g. a hash of "2026-08").
   * Defaults to a hash of the current UTC year-month if omitted — callers that
   * care about period boundaries explicitly (tests, backfills) should pass one.
   */
  periodId?: Uint8Array;
  /**
   * If true, also round-trips the proof through a real proof server and
   * returns the SNARK bytes in {@link ProveSavingsResult.proofBytes}. Local
   * mode only; ignored (always true, implicitly) in deployed mode.
   */
  generateRealProof?: boolean;
};

/**
 * Everything the app needs from the Cache contract, independent of whether
 * it's running against an in-process local simulation or a real deployment.
 */
export interface CacheContractClient {
  readonly mode: 'local' | 'deployed';

  /** One-time identity bootstrap. Throws if already registered. */
  register(): Promise<void>;

  /**
   * Records this period's running totals. Safe to call as often as local
   * totals change — no per-period limit. `incomeCents`/`spendCents` are the
   * user's real numbers; they never leave this call as plaintext (the
   * underlying commitment is what's ever written anywhere).
   */
  updateTotals(incomeCents: bigint, spendCents: bigint): Promise<void>;

  /**
   * Proves the claimed tier against the currently committed totals. Throws
   * (with the contract's real assertion message) if the tier isn't supported
   * by the committed totals, or if this period was already claimed.
   */
  proveSavings(tier: number, options?: ProveSavingsOptions): Promise<ProveSavingsResult>;

  /** Spends one earned block on a city building of the given kind (0..7). */
  build(kind: number): Promise<void>;

  /** Current public ledger state for this identity. */
  getLedgerSnapshot(): Promise<CacheLedgerSnapshot>;
}
