export type { CacheContractClient, CacheLedgerSnapshot, ProveSavingsOptions, ProveSavingsResult } from './types.js';
export { LocalCacheContractClient, periodIdForMonth } from './local-client.js';
export { DeployedCacheContractClient, type DeployedCacheClientConfig } from './deployed-client.js';

import { DeployedCacheContractClient, type DeployedCacheClientConfig } from './deployed-client.js';
import { LocalCacheContractClient } from './local-client.js';
import type { CacheContractClient } from './types.js';

export type CacheClientConfig =
  | { mode: 'local'; secret: Uint8Array }
  | ({ mode: 'deployed' } & DeployedCacheClientConfig);

/**
 * The one place a caller decides local-vs-deployed. Everything upstream of
 * this call (ingest pipeline, UI, CLI) should hold a `CacheContractClient`
 * and never import `LocalCacheContractClient`/`DeployedCacheContractClient`
 * directly — that's what makes the eventual Phase C switch a config change.
 */
export const createCacheContractClient = async (config: CacheClientConfig): Promise<CacheContractClient> => {
  if (config.mode === 'local') {
    return LocalCacheContractClient.createNew(config.secret);
  }
  return new DeployedCacheContractClient(config);
};
