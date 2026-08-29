/**
 * Node-only ZK config provider: reads the ZK artifacts `compact compile`
 * emitted into `managed/cache` straight off the local filesystem. Used by the
 * contract test suite and any future Node-side tooling (CLI, relayer). The
 * browser UI cannot use this — `node:fs` doesn't exist there — see
 * `fetch-zk-config-provider.ts` for the browser equivalent. Kept in its own
 * file specifically so `harness.ts` and `local-client.ts` never import
 * `node:fs`/`node:path`/`node:url` and stay safe to bundle for the browser.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANAGED = path.resolve(HERE, '..', 'managed', 'cache');

export class NodeZkConfigProvider extends ZKConfigProvider<CacheCircuitId> {
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
