/**
 * `CacheContractClient` backed by in-process circuit execution — no network,
 * no wallet, no deployed contract address. This is what the app runs against
 * until Phase C's Preprod deployment exists, and it's also useful afterward
 * for fast local development. It manages all the private-state bookkeeping
 * (salts, periods, carry-forward balance) that the raw `CacheHarness` and
 * `witnesses.ts` helpers otherwise require the caller to do by hand — see
 * `contract/src/test/cache.test.ts` for that lower-level, explicit version.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';

import { CacheHarness, type CacheCircuitId } from './harness.js';
import type {
  CacheContractClient,
  CacheLedgerSnapshot,
  ProveSavingsOptions,
  ProveSavingsResult,
} from './types.js';
import {
  afterProveSavings,
  afterRegister,
  commitTotals,
  createCachePrivateState,
  deriveSalt,
  deriveUserId,
  startPeriod,
  withTotals,
  type CachePrivateState,
} from '../witnesses.js';

/** `sha256("cache:period:" + "YYYY-MM")`, truncated/padded to 32 bytes like everything else here. */
export const periodIdForMonth = (year: number, month1to12: number): Uint8Array => {
  const label = `${year}-${String(month1to12).padStart(2, '0')}`;
  return sha256(utf8ToBytes(`cache:period:${label}`));
};

const currentPeriodId = (): Uint8Array => {
  const now = new Date();
  return periodIdForMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
};

export class LocalCacheContractClient implements CacheContractClient {
  readonly mode = 'local' as const;

  private harness: CacheHarness;
  private privateState: CachePrivateState;
  private readonly zkConfigProvider: ZKConfigProvider<CacheCircuitId> | undefined;

  private constructor(
    harness: CacheHarness,
    privateState: CachePrivateState,
    zkConfigProvider: ZKConfigProvider<CacheCircuitId> | undefined,
  ) {
    this.harness = harness;
    this.privateState = privateState;
    this.zkConfigProvider = zkConfigProvider;
  }

  /**
   * Creates a client for a brand-new local identity: `secret` is the user's
   * root secret (persist it — losing it means losing the identity), and the
   * salt seed is drawn from a CSPRNG, per the production note in
   * `witnesses.ts` (unlike the test suite, which seeds deterministically for
   * reproducibility).
   *
   * `zkConfigProvider` is only needed if callers will pass
   * `generateRealProof: true` to {@link proveSavings} — pass a
   * `NodeZkConfigProvider` in Node or a `FetchZkConfigProvider` in the
   * browser. Omit it if you only need circuit-constraint checking (which is
   * itself real: a false claim throws here exactly as it would on a prover).
   */
  static async createNew(
    secret: Uint8Array,
    zkConfigProvider?: ZKConfigProvider<CacheCircuitId>,
  ): Promise<LocalCacheContractClient> {
    const saltSeed = randomBytes(32);
    const periodId = currentPeriodId();
    const currentSalt = deriveSalt(saltSeed, 0n);
    const privateState = createCachePrivateState({ secret, saltSeed, periodId, currentSalt });
    const harness = await CacheHarness.deployLocal(privateState);
    return new LocalCacheContractClient(harness, harness.privateState, zkConfigProvider);
  }

  // Local mode has no durable ledger to resume against once the process
  // exits — the "ledger" only exists in this harness's memory. There is
  // deliberately no `resume()` here; once Phase C's deployed client exists,
  // resuming a session means `findDeployedContract` against the real
  // indexer, which is a different shape of operation entirely.

  private async advanceToCurrentPeriodIfNeeded(): Promise<void> {
    const period = currentPeriodId();
    const samePeriod =
      this.privateState.periodId.length === period.length &&
      this.privateState.periodId.every((b, i) => b === period[i]);
    if (samePeriod) return;
    const salt = deriveSalt(this.privateState.saltSeed, this.privateState.saltCounter);
    this.privateState = {
      ...startPeriod(this.privateState, period, salt),
      saltCounter: this.privateState.saltCounter + 1n,
    };
  }

  async register(): Promise<void> {
    await this.harness.register();
    this.privateState = afterRegister(this.harness.privateState);
    this.harness.privateState = this.privateState;
  }

  async updateTotals(incomeCents: bigint, spendCents: bigint): Promise<void> {
    await this.advanceToCurrentPeriodIfNeeded();
    const salt = deriveSalt(this.privateState.saltSeed, this.privateState.saltCounter);
    this.privateState = {
      ...withTotals(this.privateState, incomeCents, spendCents, salt),
      saltCounter: this.privateState.saltCounter + 1n,
    };
    this.harness.privateState = this.privateState;
    const commitment = commitTotals(incomeCents, spendCents, salt);
    await this.harness.updateTotals(commitment);
    this.privateState = this.harness.privateState;
  }

  async proveSavings(tier: number, options?: ProveSavingsOptions): Promise<ProveSavingsResult> {
    if (options?.periodId !== undefined) {
      this.privateState = { ...this.privateState, periodId: options.periodId };
      this.harness.privateState = this.privateState;
    }
    await this.harness.proveSavings(BigInt(tier));
    this.privateState = afterProveSavings(this.harness.privateState);
    this.harness.privateState = this.privateState;

    const userId = deriveUserId(this.privateState.secret);
    const totalBlocks = Number(this.harness.ledger.blocks.lookup(userId));
    const result: ProveSavingsResult = {
      tier,
      blocksEarned: tier + 1,
      totalBlocks,
    };
    if (options?.generateRealProof) {
      if (!this.zkConfigProvider) {
        throw new Error(
          'proveSavings({ generateRealProof: true }) requires a zkConfigProvider — pass one to ' +
            'createCacheContractClient({ mode: "local", secret, zkConfigProvider }).',
        );
      }
      result.proofBytes = await this.harness.proveLastCallOnProofServer(
        'proveSavings' satisfies CacheCircuitId,
        this.zkConfigProvider,
      );
    }
    return result;
  }

  async build(kind: number): Promise<void> {
    await this.harness.build(BigInt(kind));
    this.privateState = this.harness.privateState;
  }

  async getLedgerSnapshot(): Promise<CacheLedgerSnapshot> {
    const userId = deriveUserId(this.privateState.secret);
    const ledger = this.harness.ledger;
    return {
      registered: ledger.tiers.member(userId),
      tier: ledger.tiers.member(userId) ? Number(ledger.tiers.lookup(userId)) : 0,
      blocks: ledger.blocks.member(userId) ? Number(ledger.blocks.lookup(userId)) : 0,
      hasCommitment:
        ledger.commitments.member(userId) &&
        !ledger.commitments.lookup(userId).every((b) => b === 0),
    };
  }
}
