/**
 * Cache — TypeScript witness implementations and local private state.
 *
 * Witnesses run off-chain, on the prover's own device. They read the user's
 * local private state (`CachePrivateState`) and hand values into the circuit.
 * Nothing here ever reaches the chain: the contract binds every witness value
 * to something already committed on-chain before it believes it.
 *
 * This module also mirrors the contract's four non-exported helper circuits
 * (`deriveUserId`, `deriveNullifier`, `commitTotals`, `commitBalance`) in
 * TypeScript. A client needs `commitTotals` to compute the argument it passes
 * to `updateTotals`, and needs `commitBalance` to keep its local carry-forward
 * bookkeeping in step with the ledger. The mirrors are built from the same
 * `@midnight-ntwrk/compact-runtime` primitives the generated circuit code uses
 * (`persistentHash`, `persistentCommit`, `convertFieldToBytes`) so they cannot
 * silently drift from the circuit — see `cache.test.ts`, which asserts the
 * mirrored `commitBalance` reproduces the value `register` actually wrote.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';

import {
  CompactTypeBytes,
  CompactTypeVector,
  convertFieldToBytes,
  persistentCommit,
  persistentHash,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';

import type { Ledger, Witnesses } from './managed/cache/contract/index.js';

// ============================================================================
// Runtime type descriptors — mirrors of the generated contract's descriptors
// ============================================================================

const BYTES_32 = new CompactTypeBytes(32);
const VECTOR_2_BYTES_32 = new CompactTypeVector(2, BYTES_32);
const VECTOR_3_BYTES_32 = new CompactTypeVector(3, BYTES_32);

/**
 * The TypeScript equivalent of Compact's `pad(32, "...")`: the ASCII bytes of
 * `text`, right-padded with zero bytes to 32.
 */
export const pad32 = (text: string): Uint8Array => {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 32) {
    throw new Error(`domain prefix "${text}" does not fit in 32 bytes`);
  }
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
};

// Domain separators, matching the string literals in cache.compact exactly.
const DOMAIN_PK = pad32('cache:pk:');
const DOMAIN_NULLIFIER = pad32('cache:nul:');
const DOMAIN_TOTALS = pad32('cache:commit:');
const DOMAIN_BALANCE = pad32('cache:bal:');

// ============================================================================
// Mirrors of the contract's helper circuits
// ============================================================================

/** Mirror of `deriveUserId` — the deterministic identity commitment. */
export const deriveUserId = (secret: Uint8Array): Uint8Array =>
  persistentHash(VECTOR_2_BYTES_32, [DOMAIN_PK, secret]);

/** Mirror of `deriveNullifier` — the per-period spend tag. */
export const deriveNullifier = (secret: Uint8Array, periodId: Uint8Array): Uint8Array =>
  persistentHash(VECTOR_3_BYTES_32, [DOMAIN_NULLIFIER, secret, periodId]);

/**
 * Mirror of `commitTotals`. This is the value a client passes as the
 * `commitment` argument to `updateTotals`; the circuit recomputes it from the
 * private witnesses and rejects the call unless the two agree.
 */
export const commitTotals = (income: bigint, spend: bigint, salt: Uint8Array): Uint8Array =>
  persistentCommit(
    VECTOR_3_BYTES_32,
    [
      DOMAIN_TOTALS,
      convertFieldToBytes(32, income, 'witnesses.ts commitTotals income'),
      convertFieldToBytes(32, spend, 'witnesses.ts commitTotals spend'),
    ],
    salt,
  );

/** Mirror of `commitBalance` — the carry-forward savings commitment. */
export const commitBalance = (amount: bigint, salt: Uint8Array): Uint8Array =>
  persistentCommit(
    VECTOR_2_BYTES_32,
    [DOMAIN_BALANCE, convertFieldToBytes(32, amount, 'witnesses.ts commitBalance amount')],
    salt,
  );

// ============================================================================
// Private state
// ============================================================================

/**
 * Everything a Cache client keeps on its own device. None of this is ever
 * transmitted; the circuits consume it through the witnesses below.
 */
export type CachePrivateState = {
  /** Root secret. Every identity and nullifier in the contract derives from it. */
  readonly secret: Uint8Array;

  /** Running income total for the period currently being tracked, in minor units. */
  readonly income: bigint;

  /** Running spend total for the period currently being tracked, in minor units. */
  readonly spend: bigint;

  /**
   * The salt binding the totals commitment currently stored on-chain for this
   * user. Must be the salt that was in effect when `updateTotals` last ran,
   * otherwise `proveSavings` cannot reopen the stored fingerprint.
   */
  readonly currentSalt: Uint8Array;

  /** Opaque 32-byte identifier of the period being claimed (e.g. a hash of "2026-08"). */
  readonly periodId: Uint8Array;

  /** The amount the on-chain `savingsBalance` commitment currently opens to. */
  readonly previousBalance: bigint;

  /** The salt that on-chain `savingsBalance` commitment was made with. */
  readonly previousBalanceSalt: Uint8Array;

  /**
   * Seed for the salt source backing `newSalt()`.
   *
   * PRODUCTION NOTE: a seeded, deterministic source is used here so tests are
   * reproducible and so a client can re-derive a salt it has lost. A real
   * deployment MUST draw salts from a cryptographically secure RNG —
   * `crypto.getRandomValues(new Uint8Array(32))` in the browser, or
   * `crypto.randomBytes(32)` in Node — because a predictable salt destroys the
   * hiding property of every commitment in this contract: the plaintext space
   * of a monthly income figure is small enough to brute-force once the salt is
   * known or guessable.
   */
  readonly saltSeed: Uint8Array;

  /** Index of the next salt to be issued from `saltSeed`. */
  readonly saltCounter: bigint;

  /**
   * The salt `newSalt()` most recently handed to a circuit. After a circuit
   * that writes a `savingsBalance` commitment succeeds, this becomes the
   * client's `previousBalanceSalt` — see {@link afterRegister} and
   * {@link afterProveSavings}.
   */
  readonly lastIssuedSalt: Uint8Array | undefined;
};

/**
 * Derives salt number `counter` from `seed`. Deterministic by design; see the
 * production note on {@link CachePrivateState.saltSeed}.
 */
export const deriveSalt = (seed: Uint8Array, counter: bigint): Uint8Array => {
  const counterBytes = convertFieldToBytes(32, counter, 'witnesses.ts deriveSalt counter');
  // @noble/hashes rather than node:crypto: this must run identically in the
  // browser (the PWA) and in Node (tests, IMAP ingest) — no platform split.
  return sha256(concatBytes(pad32('cache:salt:'), seed, counterBytes));
};

/**
 * Builds a fresh private state for a user who has not registered yet.
 *
 * `currentSalt` defaults to salt 0 of the seed. Note that salts issued by
 * `newSalt()` start at `saltCounter`, so pass a `saltCounter` above any index
 * you consume directly for `currentSalt` if you derive it that way.
 */
export const createCachePrivateState = (args: {
  secret: Uint8Array;
  saltSeed: Uint8Array;
  periodId: Uint8Array;
  income?: bigint;
  spend?: bigint;
  currentSalt?: Uint8Array;
}): CachePrivateState => ({
  secret: args.secret,
  income: args.income ?? 0n,
  spend: args.spend ?? 0n,
  currentSalt: args.currentSalt ?? deriveSalt(args.saltSeed, 0n),
  periodId: args.periodId,
  previousBalance: 0n,
  previousBalanceSalt: new Uint8Array(32),
  saltSeed: args.saltSeed,
  // Salt 0 is reserved for `currentSalt` above, so `newSalt()` starts at 1.
  saltCounter: 1n,
  lastIssuedSalt: undefined,
});

// ============================================================================
// Client-side state transitions
// ============================================================================

/**
 * Fold the result of a successful `register` back into local state.
 *
 * `register` writes `commitBalance(0, newSalt())`, so the salt it consumed
 * becomes the salt that opens the stored balance commitment.
 */
export const afterRegister = (state: CachePrivateState): CachePrivateState => {
  if (state.lastIssuedSalt === undefined) {
    throw new Error('afterRegister: register did not consume a salt');
  }
  return { ...state, previousBalance: 0n, previousBalanceSalt: state.lastIssuedSalt };
};

/** Record this period's running totals and the salt committing them. */
export const withTotals = (
  state: CachePrivateState,
  income: bigint,
  spend: bigint,
  salt: Uint8Array,
): CachePrivateState => ({ ...state, income, spend, currentSalt: salt });

/**
 * Fold the result of a successful `proveSavings` back into local state.
 *
 * The contract sets the new balance to `previousBalance + (income - spend)` and
 * recommits it under the salt `newSalt()` just issued, so both fields advance
 * together. Call this before moving on to the next period.
 */
export const afterProveSavings = (state: CachePrivateState): CachePrivateState => {
  if (state.lastIssuedSalt === undefined) {
    throw new Error('afterProveSavings: proveSavings did not consume a salt');
  }
  const net = state.income - state.spend;
  if (net < 0n) {
    throw new Error('afterProveSavings: spend exceeds income');
  }
  return {
    ...state,
    previousBalance: state.previousBalance + net,
    previousBalanceSalt: state.lastIssuedSalt,
  };
};

/** Begin a new period: fresh period id, fresh totals, fresh totals salt. */
export const startPeriod = (
  state: CachePrivateState,
  periodId: Uint8Array,
  salt: Uint8Array,
): CachePrivateState => ({ ...state, periodId, income: 0n, spend: 0n, currentSalt: salt });

// ============================================================================
// Witnesses
// ============================================================================

/**
 * The eight witnesses declared in `cache.compact`.
 *
 * All but `newSalt` are pure reads of local state and leave it untouched.
 * `newSalt` is the one witness with a side effect: it issues the next salt from
 * the seeded source, advances the counter so a salt is never handed out twice
 * within a session, and records the issued salt so the client can promote it to
 * `previousBalanceSalt` once the call succeeds.
 */
export const witnesses: Witnesses<CachePrivateState> = {
  localSecret: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    Uint8Array,
  ] => [privateState, privateState.secret],

  incomeTotal: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    bigint,
  ] => [privateState, privateState.income],

  spendTotal: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    bigint,
  ] => [privateState, privateState.spend],

  currentSalt: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    Uint8Array,
  ] => [privateState, privateState.currentSalt],

  periodId: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    Uint8Array,
  ] => [privateState, privateState.periodId],

  previousBalance: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    bigint,
  ] => [privateState, privateState.previousBalance],

  previousBalanceSalt: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    Uint8Array,
  ] => [privateState, privateState.previousBalanceSalt],

  newSalt: ({ privateState }: WitnessContext<Ledger, CachePrivateState>): [
    CachePrivateState,
    Uint8Array,
  ] => {
    const salt = deriveSalt(privateState.saltSeed, privateState.saltCounter);
    return [
      { ...privateState, saltCounter: privateState.saltCounter + 1n, lastIssuedSalt: salt },
      salt,
    ];
  },
};
