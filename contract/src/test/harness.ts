/**
 * Local execution harness for the Cache contract.
 *
 * This drives the REAL compiled circuits from `managed/cache/contract`. Every
 * `assert()` in `cache.compact` executes here exactly as it would on a prover's
 * device: a failed assert throws, and a call that throws never produces the
 * proof data a SNARK could be built from. Nothing in this file re-implements or
 * stubs the contract's checks.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type CallProofData,
  type CircuitResults,
  createCircuitContext,
  createConstructorContext,
  proofDataIntoSerializedPreimage,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  ZKConfigProvider,
  type ZKIR,
} from '@midnight-ntwrk/midnight-js-types';

import type { CachePrivateState } from '../witnesses.js';
import { witnesses } from '../witnesses.js';
import { Contract, type Ledger, ledger } from '../managed/cache/contract/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANAGED = path.resolve(HERE, '..', 'managed', 'cache');

export type CacheCircuitId = 'register' | 'updateTotals' | 'proveSavings' | 'build';

/**
 * Reads the ZK artifacts `compact compile` emitted into `managed/cache`.
 * Purely local filesystem access — no network, no indexer.
 */
export class LocalZkConfigProvider extends ZKConfigProvider<CacheCircuitId> {
  async getProverKey(circuitId: CacheCircuitId): Promise<ProverKey> {
    return createProverKey(new Uint8Array(await readFile(path.join(MANAGED, 'keys', `${circuitId}.prover`))));
  }

  async getVerifierKey(circuitId: CacheCircuitId): Promise<VerifierKey> {
    return createVerifierKey(
      new Uint8Array(await readFile(path.join(MANAGED, 'keys', `${circuitId}.verifier`))),
    );
  }

  async getZKIR(circuitId: CacheCircuitId): Promise<ZKIR> {
    return createZKIR(new Uint8Array(await readFile(path.join(MANAGED, 'zkir', `${circuitId}.bzkir`))));
  }
}

export const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL ?? 'http://localhost:6300';

/** A single user's local view: the contract's public state plus their private state. */
export class CacheHarness {
  /** Contract public state. Advanced only by calls that actually succeed. */
  private contractState: Parameters<typeof ledger>[0];

  /** Private state, advanced only by calls that actually succeed. */
  privateState: CachePrivateState;

  /** Proof data produced by the most recent successful call. */
  lastProofData: CallProofData | undefined;

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

  private context(circuitId: CacheCircuitId) {
    return createCircuitContext<CachePrivateState>(
      circuitId,
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
  private commit(results: CircuitResults<CachePrivateState, unknown>): void {
    this.contractState = results.context.callContext.currentQueryContext.state;
    this.privateState = results.context.callContext.currentPrivateState as CachePrivateState;
    this.lastProofData = results.context.callProofDataTrace.at(-1);
  }

  async register(): Promise<void> {
    this.commit(await this.contract.circuits.register(this.context('register')));
  }

  async updateTotals(commitment: Uint8Array): Promise<void> {
    this.commit(await this.contract.circuits.updateTotals(this.context('updateTotals'), commitment));
  }

  async proveSavings(tier: bigint): Promise<void> {
    this.commit(await this.contract.circuits.proveSavings(this.context('proveSavings'), tier));
  }

  async build(kind: bigint): Promise<void> {
    this.commit(await this.contract.circuits.build(this.context('build'), kind));
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
  async proveLastCallOnProofServer(circuitId: CacheCircuitId): Promise<Uint8Array> {
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
    const provingProvider = httpClientProvingProvider(PROOF_SERVER_URL, new LocalZkConfigProvider());
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
