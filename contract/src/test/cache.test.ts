/**
 * Cache — local round-trip tests against the real compiled circuits.
 *
 * Every `expect` here is backed by an actual execution of the compiled
 * contract in `managed/cache/contract`. The rejection tests do not compare
 * strings against the Compact source; they run the circuit and capture what it
 * actually threw.
 */

import { describe, expect, it } from 'vitest';

import {
  afterProveSavings,
  afterRegister,
  commitBalance,
  commitTotals,
  createCachePrivateState,
  deriveNullifier,
  deriveUserId,
  deriveSalt,
  startPeriod,
  withTotals,
} from '../witnesses.js';
import { CacheHarness, PROOF_SERVER_URL, captureRejection, toHex } from './harness.js';

const SENTINEL = new Uint8Array(32);

const secretOf = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);
const seedOf = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);
const periodOf = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);

/** A registered user with local state already folded forward. */
const registeredUser = async (opts?: { secret?: number; seed?: number; period?: number }) => {
  const state = createCachePrivateState({
    secret: secretOf(opts?.secret ?? 0xa1),
    saltSeed: seedOf(opts?.seed ?? 0xb2),
    periodId: periodOf(opts?.period ?? 0xc3),
  });
  const harness = await CacheHarness.deployLocal(state);
  await harness.register();
  harness.privateState = afterRegister(harness.privateState);
  return harness;
};

/** Commit `income`/`spend` for the current period and push the fingerprint on-chain. */
const commitPeriodTotals = async (
  harness: CacheHarness,
  income: bigint,
  spend: bigint,
  saltIndex: bigint,
) => {
  const salt = deriveSalt(harness.privateState.saltSeed, saltIndex);
  harness.privateState = withTotals(harness.privateState, income, spend, salt);
  await harness.updateTotals(commitTotals(income, spend, salt));
};

describe('Cache — helper mirrors match the compiled circuit', () => {
  it('TS commitBalance reproduces the commitment register actually wrote', async () => {
    const harness = await registeredUser();
    const userId = deriveUserId(harness.privateState.secret);

    const onChain = harness.ledger.savingsBalance.lookup(userId);
    const mirrored = commitBalance(0n, harness.privateState.previousBalanceSalt);

    console.log('\n[mirror check] savingsBalance on-chain :', toHex(onChain));
    console.log('[mirror check] TS commitBalance(0, salt):', toHex(mirrored));

    // If this passes, the TS mirrors of the contract's private helper circuits
    // are byte-identical to the compiled ones, so the commitments the tests
    // feed to `updateTotals` are the same ones the circuit recomputes.
    expect(toHex(mirrored)).toBe(toHex(onChain));
  });
});

describe('Cache — happy path', () => {
  it('register -> updateTotals -> proveSavings(tier 4) succeeds and updates all ledger state', async () => {
    const harness = await registeredUser();
    const userId = deriveUserId(harness.privateState.secret);

    console.log('\n=== HAPPY PATH ===');
    console.log('userId                 :', toHex(userId));

    // After register: seeded, but no totals committed yet.
    expect(toHex(harness.ledger.commitments.lookup(userId))).toBe(toHex(SENTINEL));
    expect(harness.ledger.tiers.lookup(userId)).toBe(0n);
    expect(harness.ledger.blocks.lookup(userId)).toBe(0n);
    console.log('after register         : commitment = all-zero sentinel, tier = 0, blocks = 0');

    // $2000.00 income, $1000.00 spend -> 50% savings rate -> supports tier 4.
    const income = 200_000n;
    const spend = 100_000n;
    await commitPeriodTotals(harness, income, spend, 10n);

    const committed = harness.ledger.commitments.lookup(userId);
    expect(toHex(committed)).not.toBe(toHex(SENTINEL));
    console.log('after updateTotals     : commitment =', toHex(committed));

    const balanceBefore = harness.ledger.savingsBalance.lookup(userId);

    await harness.proveSavings(4n);
    harness.privateState = afterProveSavings(harness.privateState);

    const nullifier = deriveNullifier(harness.privateState.secret, harness.privateState.periodId);

    console.log('after proveSavings(4)  :');
    console.log('  tier                 :', harness.ledger.tiers.lookup(userId));
    console.log('  blocks               :', harness.ledger.blocks.lookup(userId));
    console.log('  nullifiers.size      :', harness.ledger.nullifiers.size());
    console.log('  nullifier recorded   :', toHex(nullifier));
    console.log('  savingsBalance       :', toHex(harness.ledger.savingsBalance.lookup(userId)));

    expect(harness.ledger.tiers.lookup(userId)).toBe(4n);
    // Blocks minted = tier + 1.
    expect(harness.ledger.blocks.lookup(userId)).toBe(5n);
    expect(harness.ledger.nullifiers.member(nullifier)).toBe(true);
    expect(harness.ledger.nullifiers.size()).toBe(1n);

    // The savings balance moved off its seeded value and is not the sentinel.
    const balanceAfter = harness.ledger.savingsBalance.lookup(userId);
    expect(toHex(balanceAfter)).not.toBe(toHex(balanceBefore));
    expect(toHex(balanceAfter)).not.toBe(toHex(SENTINEL));

    // The client's own bookkeeping tracks the chain: net savings carried forward.
    expect(harness.privateState.previousBalance).toBe(income - spend);
    expect(toHex(commitBalance(income - spend, harness.privateState.previousBalanceSalt))).toBe(
      toHex(balanceAfter),
    );
    console.log('  carry-forward opens  : yes (previousBalance =', harness.privateState.previousBalance, ')');

    // And a block can then be spent.
    await harness.build(3n);
    expect(harness.ledger.blocks.lookup(userId)).toBe(4n);
    console.log('  after build(3)       : blocks =', harness.ledger.blocks.lookup(userId));
  });
});

describe('Cache — a deliberately wrong proof is REJECTED', () => {
  it('claiming tier 4 on totals that only support tier 1 fails the savings assertion', async () => {
    const harness = await registeredUser();
    const userId = deriveUserId(harness.privateState.secret);

    // $1000.00 income, $900.00 spend -> exactly 10% savings -> tier 1 only.
    const income = 100_000n;
    const spend = 90_000n;
    await commitPeriodTotals(harness, income, spend, 20n);

    console.log('\n=== WRONG-TIER REJECTION ===');
    console.log('committed totals support: tier 1 (10% savings rate)');
    console.log('claiming                : tier 4 (>= 40%)');

    const message = await captureRejection('proveSavings(4) on tier-1 totals', () =>
      harness.proveSavings(4n),
    );
    console.log('REJECTED with           :', message);

    expect(message).toContain('savings below claimed tier');

    // Nothing moved: no tier recorded, no blocks minted, no nullifier spent.
    expect(harness.ledger.tiers.lookup(userId)).toBe(0n);
    expect(harness.ledger.blocks.lookup(userId)).toBe(0n);
    expect(harness.ledger.nullifiers.size()).toBe(0n);
    console.log('ledger unchanged        : tier = 0, blocks = 0, nullifiers = 0');

    // The honest claim on the very same committed totals succeeds, which proves
    // the rejection was about the tier and not about a malformed setup.
    await harness.proveSavings(1n);
    harness.privateState = afterProveSavings(harness.privateState);
    expect(harness.ledger.tiers.lookup(userId)).toBe(1n);
    expect(harness.ledger.blocks.lookup(userId)).toBe(2n);
    console.log('honest tier 1 on same totals: ACCEPTED (tier = 1, blocks = 2)');
  });

  it('claiming a tier above the maximum is rejected', async () => {
    const harness = await registeredUser({ secret: 0xa2 });
    await commitPeriodTotals(harness, 100_000n, 0n, 21n);

    const message = await captureRejection('proveSavings(9)', () => harness.proveSavings(9n));
    console.log('\n[tier out of range] REJECTED with:', message);
    expect(message).toContain('tier out of range');
  });
});

describe('Cache — a replayed nullifier is REJECTED', () => {
  it('a second proveSavings for the same periodId fails, even with freshly updated totals', async () => {
    const harness = await registeredUser({ secret: 0xa3, seed: 0xb3, period: 0xc3 });
    const userId = deriveUserId(harness.privateState.secret);

    console.log('\n=== NULLIFIER REPLAY REJECTION ===');
    console.log('periodId                :', toHex(harness.privateState.periodId));

    // Period is claimed once, legitimately.
    await commitPeriodTotals(harness, 200_000n, 100_000n, 30n);
    await harness.proveSavings(4n);
    harness.privateState = afterProveSavings(harness.privateState);

    const nullifier = deriveNullifier(harness.privateState.secret, harness.privateState.periodId);
    const tierAfterFirst = harness.ledger.tiers.lookup(userId);
    const blocksAfterFirst = harness.ledger.blocks.lookup(userId);
    console.log('first claim             : ACCEPTED (tier =', tierAfterFirst, ', blocks =', blocksAfterFirst, ')');
    console.log('nullifier spent         :', toHex(nullifier));
    expect(harness.ledger.nullifiers.member(nullifier)).toBe(true);

    // Replay A — immediate repeat of the identical claim.
    const messageA = await captureRejection('immediate replay', () => harness.proveSavings(4n));
    console.log('replay (identical)      : REJECTED with:', messageA);
    expect(messageA).toContain('period already claimed');

    // Replay B — the stronger case. The user re-runs updateTotals with brand new,
    // internally-valid totals for the SAME period, so every check up to the
    // nullifier passes. Only the spent nullifier can stop this.
    await commitPeriodTotals(harness, 500_000n, 100_000n, 31n);
    console.log('re-committed new valid totals for the SAME periodId');

    const messageB = await captureRejection('replay after fresh updateTotals', () =>
      harness.proveSavings(4n),
    );
    console.log('replay (fresh totals)   : REJECTED with:', messageB);
    expect(messageB).toContain('period already claimed');

    // Neither replay minted anything.
    expect(harness.ledger.tiers.lookup(userId)).toBe(tierAfterFirst);
    expect(harness.ledger.blocks.lookup(userId)).toBe(blocksAfterFirst);
    expect(harness.ledger.nullifiers.size()).toBe(1n);
    console.log('ledger unchanged        : tier =', harness.ledger.tiers.lookup(userId),
      ', blocks =', harness.ledger.blocks.lookup(userId),
      ', nullifiers =', harness.ledger.nullifiers.size());

    // A DIFFERENT period, same secret, is still claimable — the nullifier is
    // per-period, not a permanent lockout.
    const nextPeriod = periodOf(0xc4);
    harness.privateState = startPeriod(harness.privateState, nextPeriod, deriveSalt(harness.privateState.saltSeed, 40n));
    await commitPeriodTotals(harness, 300_000n, 150_000n, 40n);
    await harness.proveSavings(4n);
    harness.privateState = afterProveSavings(harness.privateState);
    console.log('new period claim        : ACCEPTED (nullifiers =', harness.ledger.nullifiers.size(), ')');
    expect(harness.ledger.nullifiers.size()).toBe(2n);
    expect(harness.ledger.blocks.lookup(userId)).toBe(10n);
  });
});

describe('Cache — other rejections', () => {
  it('updateTotals with a commitment that does not match the private totals is rejected', async () => {
    const harness = await registeredUser({ secret: 0xa5, seed: 0xb5 });
    const salt = deriveSalt(harness.privateState.saltSeed, 50n);
    harness.privateState = withTotals(harness.privateState, 100_000n, 90_000n, salt);

    // A commitment to flattering numbers the user does not actually hold.
    const lie = commitTotals(100_000n, 0n, salt);
    const message = await captureRejection('updateTotals(lie)', () => harness.updateTotals(lie));
    console.log('\n[commitment mismatch] REJECTED with:', message);
    expect(message).toContain('commitment does not match local totals');
  });

  it('registering twice with the same secret is rejected', async () => {
    const harness = await registeredUser({ secret: 0xa6, seed: 0xb6 });
    const message = await captureRejection('second register', () => harness.register());
    console.log('[double registration] REJECTED with:', message);
    expect(message).toContain('user already registered');
  });

  it('proveSavings before any updateTotals cannot open the sentinel commitment', async () => {
    const harness = await registeredUser({ secret: 0xa7, seed: 0xb7 });
    harness.privateState = withTotals(
      harness.privateState,
      100_000n,
      0n,
      deriveSalt(harness.privateState.saltSeed, 60n),
    );
    const message = await captureRejection('proveSavings before updateTotals', () =>
      harness.proveSavings(1n),
    );
    console.log('[sentinel commitment] REJECTED with:', message);
    expect(message).toContain('totals do not match committed fingerprint');
  });

  it('spending a block with none held is rejected', async () => {
    const harness = await registeredUser({ secret: 0xa8, seed: 0xb8 });
    const message = await captureRejection('build with no blocks', () => harness.build(0n));
    console.log('[no blocks] REJECTED with:', message);
    expect(message).toContain('no unspent blocks');
  });
});

describe('Cache — real ZK proof generation against the local proof server', () => {
  it('produces an actual SNARK for a successful proveSavings call', async () => {
    const health = await fetch(`${PROOF_SERVER_URL}/health`).then(
      (r) => r.text(),
      (e) => `UNREACHABLE: ${String(e)}`,
    );
    console.log('\n=== REAL PROOF SERVER ROUND-TRIP ===');
    console.log('proof server            :', PROOF_SERVER_URL);
    console.log('health                  :', health.trim());

    const harness = await registeredUser({ secret: 0xa9, seed: 0xb9, period: 0xc9 });
    await commitPeriodTotals(harness, 200_000n, 100_000n, 70n);
    await harness.proveSavings(4n);

    const preimageBytes = harness.lastPreimageBytes('proveSavings');
    console.log('serialized preimage     :', preimageBytes, 'bytes');

    const started = Date.now();
    const proof = await harness.proveLastCallOnProofServer('proveSavings');
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    const head = Buffer.from(proof.slice(0, 48)).toString('hex');
    const magic = Buffer.from(proof.slice(0, 25)).toString('utf8');
    console.log('PROOF RECEIVED          :', proof.length, 'bytes in', elapsed, 's');
    console.log('proof magic             :', JSON.stringify(magic));
    console.log('proof first 48 bytes    :', head);

    expect(proof).toBeInstanceOf(Uint8Array);
    expect(proof.length).toBeGreaterThan(1000);
    expect(magic).toContain('midnight:proof');
  }, 300_000);

  it('a rejected call produces no proof data at all, so no proof can exist', async () => {
    const harness = await registeredUser({ secret: 0xaa, seed: 0xba });
    await commitPeriodTotals(harness, 100_000n, 90_000n, 80n);

    // Proof data standing before the doomed call: the last thing that succeeded.
    const before = harness.lastProofData;
    expect(before?.circuitId).toBe('updateTotals');

    const message = await captureRejection('wrong-tier proveSavings', () => harness.proveSavings(4n));
    console.log('\n[unprovable] wrong-tier call REJECTED with:', message);

    expect(message).toContain('savings below claimed tier');

    // The circuit threw part-way through, so it never yielded proof data of its
    // own. The newest proof data available is still the earlier updateTotals
    // call — there is simply no proveSavings preimage in existence to hand to a
    // prover, which is why a false tier claim can never become a valid proof.
    console.log('[unprovable] newest proof data still from circuit:', harness.lastProofData?.circuitId);
    expect(harness.lastProofData).toBe(before);
    expect(harness.lastProofData?.circuitId).toBe('updateTotals');
  });
});
