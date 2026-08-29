/**
 * Local execution harness for the Cache contract.
 *
 * This drives the REAL compiled circuits from `managed/cache/contract`. Every
 * `assert()` in `cache.compact` executes here exactly as it would on a prover's
 * device: a failed assert throws, and a call that throws never produces the
 * proof data a SNARK could be built from. Nothing in this file re-implements or
 * stubs the contract's checks.
 */

import {
  type CircuitResults,
  createCircuitContext,
  createConstructorContext,
  type ProofData,
  proofDataIntoSerializedPreimage,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';

import type { CachePrivateState } from '../witnesses.js';
import { witnesses } from '../witnesses.js';
import { Contract, type Ledger, ledger } from '../managed/cache/contract/index.js';

// No node:fs/path/url here on purpose — this file must be safe to bundle for
// the browser. Node-only key/zkir loading lives in node-zk-config-provider.ts;
// the browser equivalent is fetch-zk-config-provider.ts. Callers of
// `proveLastCallOnProofServer` supply whichever one fits their environment.

export type CacheCircuitId = 'register' | 'updateTotals' | 'proveSavings' | 'build';

export const PROOF_SERVER_URL =
  (typeof process !== 'undefined' ? process.env?.PROOF_SERVER_URL : undefined) ?? 'http://localhost:6300';

/** A single user's local view: the contract's public state plus their private state. */
export class CacheHarness {
  /** Contract public state. Advanced only by calls that actually succeed. */
  private contractState: Parameters<typeof ledger>[0];

  /** Private state, advanced only by calls that actually succeed. */
  privateState: CachePrivateState;

  /** Proof data produced by the most recent successful call. */
  lastProofData: ProofData | undefined;

  /**
   * Which circuit produced {@link lastProofData}. `ProofData` itself carries
   * no circuit identity in compact-runtime 0.16.0 (unlike 0.19.0's
   * `CallProofData`), so the harness tracks it alongside instead.
   */
  lastProofCircuitId: CacheCircuitId | undefined;

  readonly contractAddress: string;
  readonly coinPublicKey: string;
  private readonly contract: Contract<CachePrivateState>;

  private constructor(
    contract: Contract<CachePrivateState>,
    contractState: Parameters<typeof ledger>[0],
    privateState: CachePrivateState,
    contractAddress: string,
  ) {
    this.contract = contract;
    this.contractState = contractState;
    this.privateState = privateState;
    this.contractAddress = contractAddress;
    // A local stand-in for the submitting wallet's Zswap key. This contract
    // moves no coins, so the value is never consulted beyond bookkeeping.
    this.coinPublicKey = '0'.repeat(64);
  }

  /** Runs the contract's constructor to obtain the genesis ledger state. */
  static async deployLocal(privateState: CachePrivateState): Promise<CacheHarness> {
    const contract = new Contract<CachePrivateState>(witnesses);
    // Synchronous in compact-runtime 0.16.0 (the version Preprod's ledger
    // 8.1.0 / toolchain 0.31.1 actually support); `await` on a non-promise is
    // a harmless no-op, kept so this method's own signature can stay async.
    const initial = await contract.initialState(createConstructorContext(privateState, '0'.repeat(64)));
    return new CacheHarness(
      contract,
      initial.currentContractState.data,
      initial.currentPrivateState,
      sampleContractAddress(),
    );
  }

  /** The public ledger, decoded. */
  get ledger(): Ledger {
    return ledger(this.contractState);
  }

  private context() {
    // No circuitId argument in 0.16.0 — the circuit being run is implicit in
    // which `contract.circuits.X()` method is called, not in the context.
    return createCircuitContext<CachePrivateState>(
      this.contractAddress,
      this.coinPublicKey,
      this.contractState,
      this.privateState,
    );
  }

  /**
   * Commits a successful call: public state, private state and proof data all
   * advance together. Never reached when a circuit `assert` throws, which is
   * exactly the on-chain semantics — a rejected call changes nothing.
   */
  private commit(circuitId: CacheCircuitId, results: CircuitResults<CachePrivateState, unknown>): void {
    this.contractState = results.context.currentQueryContext.state;
    this.privateState = results.context.currentPrivateState as CachePrivateState;
    this.lastProofData = results.proofData;
    this.lastProofCircuitId = circuitId;
  }

  // Circuit calls are synchronous in compact-runtime 0.16.0; these methods
  // stay `async` (awaiting a non-promise is a harmless no-op) so callers
  // don't need to change if the runtime ever moves back to an async API.
  async register(): Promise<void> {
    this.commit('register', await this.contract.circuits.register(this.context()));
  }

  async updateTotals(commitment: Uint8Array): Promise<void> {
    this.commit('updateTotals', await this.contract.circuits.updateTotals(this.context(), commitment));
  }

  async proveSavings(tier: bigint): Promise<void> {
    this.commit('proveSavings', await this.contract.circuits.proveSavings(this.context(), tier));
  }

  async build(kind: bigint): Promise<void> {
    this.commit('build', await this.contract.circuits.build(this.context(), kind));
  }

  /**
   * Sends the proof data from the last successful call to the local proof
   * server and returns the SNARK it produces.
   *
   * This is the genuine article: `proofDataIntoSerializedPreimage` builds the
   * same preimage the SDK's transaction-proving path builds, and
   * `httpClientProvingProvider` POSTs it to the proof server's `/prove`
   * endpoint together with the compiled prover key and ZKIR.
   */
  async proveLastCallOnProofServer(
    circuitId: CacheCircuitId,
    zkConfigProvider: ZKConfigProvider<CacheCircuitId>,
    proofServerUrl: string = PROOF_SERVER_URL,
  ): Promise<Uint8Array> {
    if (this.lastProofData === undefined) {
      throw new Error('no successful call to prove');
    }
    const preimage = proofDataIntoSerializedPreimage(
      this.lastProofData.input,
      this.lastProofData.output,
      this.lastProofData.publicTranscript,
      this.lastProofData.privateTranscriptOutputs,
      circuitId,
    );
    const provingProvider = httpClientProvingProvider(proofServerUrl, zkConfigProvider);
    return provingProvider.prove(preimage, circuitId);
  }

  /** Serialized preimage size for the last successful call, for reporting. */
  lastPreimageBytes(circuitId: CacheCircuitId): number {
    if (this.lastProofData === undefined) {
      throw new Error('no successful call');
    }
    return proofDataIntoSerializedPreimage(
      this.lastProofData.input,
      this.lastProofData.output,
      this.lastProofData.publicTranscript,
      this.lastProofData.privateTranscriptOutputs,
      circuitId,
    ).length;
  }
}

export const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** Captures the message of a rejected circuit call, or fails if it succeeded. */
export const captureRejection = async (label: string, run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`${label}: expected the call to be REJECTED, but it succeeded`);
};
