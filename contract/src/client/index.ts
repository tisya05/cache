import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';

import type { CacheCircuitId } from './harness.js';
import { DeployedCacheContractClient, type DeployedCacheClientConfig } from './deployed-client.js';
import { LocalCacheContractClient } from './local-client.js';
import type { CacheContractClient } from './types.js';

export type { CacheContractClient, CacheLedgerSnapshot, ProveSavingsOptions, ProveSavingsResult } from './types.js';
export { LocalCacheContractClient, periodIdForMonth } from './local-client.js';
export { DeployedCacheContractClient, type DeployedCacheClientConfig } from './deployed-client.js';
// NodeZkConfigProvider is deliberately NOT re-exported here: it imports
// node:fs, and this barrel is what the browser UI imports from. Node
// consumers (tests, tooling) import it directly from
// './node-zk-config-provider.js' instead.
export { FetchZkConfigProvider } from './fetch-zk-config-provider.js';
export type { CacheCircuitId } from './harness.js';

export type CacheClientConfig =
  | { mode: 'local'; secret: Uint8Array; zkConfigProvider?: ZKConfigProvider<CacheCircuitId> }
  | ({ mode: 'deployed' } & DeployedCacheClientConfig);

/**
 * The one place a caller decides local-vs-deployed. Everything upstream of
 * this call (ingest pipeline, UI, CLI) should hold a `CacheContractClient`
 * and never import `LocalCacheContractClient`/`DeployedCacheContractClient`
 * directly — that's what makes the eventual Phase C switch a config change.
 */
export const createCacheContractClient = async (config: CacheClientConfig): Promise<CacheContractClient> => {
  if (config.mode === 'local') {
    return LocalCacheContractClient.createNew(config.secret, config.zkConfigProvider);
  }
  return new DeployedCacheContractClient(config);
};
