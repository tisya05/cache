/**
 * `CacheContractClient` backed by a real Preprod deployment. Not implemented
 * yet — Phase C (deploy to testnet, wire the relayer) is blocked on the
 * ~12-hour DUST registration delay and hasn't started. This stub exists so
 * every other layer (ingest, any future UI/CLI) can be written against
 * `CacheContractClient` today and get the real thing later via
 * {@link createCacheContractClient} without any calling code changing.
 *
 * When Phase C lands, this will use `@midnight-ntwrk/midnight-js-contracts`
 * (`deployContract`/`findDeployedContract`/`callTx`) — confirmed compatible
 * at midnight-js-*@4.1.1, dapp-connector-api@4.0.1, wallet-sdk-facade@4.0.1 /
 * wallet-sdk-hd@3.0.2 against Preprod's actual ledger-8.1.0 / compact-runtime
 * -0.16.0 stack (see the toolchain-migration commit). The relayer holds the
 * funded wallet and pays fees; per the disclosure table (BUILD-SPEC §8), the
 * device proves locally against its own proof server and hands the relayer
 * only a signed transaction containing the tier — never the witness values.
 */

import type { CacheContractClient, CacheLedgerSnapshot, ProveSavingsOptions, ProveSavingsResult } from './types.js';

export type DeployedCacheClientConfig = {
  contractAddress: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
  relayerUrl: string;
};

const NOT_YET_DEPLOYED =
  'DeployedCacheContractClient is not implemented yet — Phase C (Preprod deployment) has not run. ' +
  'Use createCacheContractClient({ mode: "local" }) until a real contract address exists.';

export class DeployedCacheContractClient implements CacheContractClient {
  readonly mode = 'deployed' as const;

  constructor(private readonly config: DeployedCacheClientConfig) {}

  async register(): Promise<void> {
    throw new Error(NOT_YET_DEPLOYED);
  }

  async updateTotals(_incomeCents: bigint, _spendCents: bigint): Promise<void> {
    throw new Error(NOT_YET_DEPLOYED);
  }

  async proveSavings(_tier: number, _options?: ProveSavingsOptions): Promise<ProveSavingsResult> {
    throw new Error(NOT_YET_DEPLOYED);
  }

  async build(_kind: number): Promise<void> {
    throw new Error(NOT_YET_DEPLOYED);
  }

  async getLedgerSnapshot(): Promise<CacheLedgerSnapshot> {
    throw new Error(NOT_YET_DEPLOYED);
  }
}
