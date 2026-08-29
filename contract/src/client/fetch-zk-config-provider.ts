/**
 * Browser ZK config provider: fetches the ZK artifacts `compact compile`
 * emitted into `managed/cache` over HTTP from static assets the app serves
 * itself — no `node:fs`, works in any browser. The UI's build copies
 * `contract/src/managed/cache/{keys,zkir}` into `ui/public/managed/cache/`
 * (see `ui/scripts/copy-contract-artifacts.mjs`) so they're served at
 * `/managed/cache/...` alongside the app.
 */

import {
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  ZKConfigProvider,
  type ZKIR,
} from '@midnight-ntwrk/midnight-js-types';

import type { CacheCircuitId } from './harness.js';

const fetchBytes = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ZK asset ${url}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

export class FetchZkConfigProvider extends ZKConfigProvider<CacheCircuitId> {
  /** @param baseUrl e.g. "/managed/cache" — no trailing slash. */
  constructor(private readonly baseUrl: string) {
    super();
  }

  async getProverKey(circuitId: CacheCircuitId): Promise<ProverKey> {
    return createProverKey(await fetchBytes(`${this.baseUrl}/keys/${circuitId}.prover`));
  }

  async getVerifierKey(circuitId: CacheCircuitId): Promise<VerifierKey> {
    return createVerifierKey(await fetchBytes(`${this.baseUrl}/keys/${circuitId}.verifier`));
  }

  async getZKIR(circuitId: CacheCircuitId): Promise<ZKIR> {
    return createZKIR(await fetchBytes(`${this.baseUrl}/zkir/${circuitId}.bzkir`));
  }
}
