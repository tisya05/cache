/**
 * Exercises `CacheContractClient` through its public interface only — no
 * reaching into `CacheHarness` or `witnesses.ts` directly. This is what an
 * ingest pipeline or a future UI actually sees, so if this suite passes, the
 * abstraction genuinely hides the salt/period/commitment bookkeeping and not
 * just in the happy path.
 */

import { describe, expect, it } from 'vitest';

import { createCacheContractClient } from './index.js';
import { DeployedCacheContractClient } from './deployed-client.js';
import { NodeZkConfigProvider } from './node-zk-config-provider.js';

const secretOf = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);

describe('CacheContractClient — local mode, via the public interface only', () => {
  it('register -> updateTotals -> proveSavings -> build works end to end', async () => {
    const client = await createCacheContractClient({ mode: 'local', secret: secretOf(0x11) });
    expect(client.mode).toBe('local');

    await client.register();
    let snapshot = await client.getLedgerSnapshot();
    expect(snapshot).toEqual({ registered: true, tier: 0, blocks: 0, hasCommitment: false });

    // $2000 income, $1000 spend -> 50% savings rate -> supports tier 4.
    await client.updateTotals(200_000n, 100_000n);
    snapshot = await client.getLedgerSnapshot();
    expect(snapshot.hasCommitment).toBe(true);

    const result = await client.proveSavings(4);
    expect(result).toEqual({ tier: 4, blocksEarned: 5, totalBlocks: 5 });
    expect(result.proofBytes).toBeUndefined(); // not requested

    snapshot = await client.getLedgerSnapshot();
    expect(snapshot).toEqual({ registered: true, tier: 4, blocks: 5, hasCommitment: true });

    await client.build(2);
    snapshot = await client.getLedgerSnapshot();
    expect(snapshot.blocks).toBe(4);
  });

  it('a false tier claim is rejected through the public interface, with the real assertion message', async () => {
    const client = await createCacheContractClient({ mode: 'local', secret: secretOf(0x12) });
    await client.register();
    await client.updateTotals(100_000n, 90_000n); // 10% savings -> tier 1 only

    await expect(client.proveSavings(4)).rejects.toThrow('savings below claimed tier');

    const snapshot = await client.getLedgerSnapshot();
    expect(snapshot.tier).toBe(0);
    expect(snapshot.blocks).toBe(0);
  });

  it('claiming the same auto-derived period twice is rejected (nullifier replay, via the public API)', async () => {
    const client = await createCacheContractClient({ mode: 'local', secret: secretOf(0x13) });
    await client.register();
    await client.updateTotals(200_000n, 100_000n);
    await client.proveSavings(4);

    // Same call again: updateTotals -> proveSavings in the SAME auto-derived
    // (current-month) period. Totals recommit fine; the claim does not.
    await client.updateTotals(500_000n, 100_000n);
    await expect(client.proveSavings(4)).rejects.toThrow('period already claimed');
  });

  it('generateRealProof round-trips a genuine SNARK through the local proof server', async () => {
    const client = await createCacheContractClient({
      mode: 'local',
      secret: secretOf(0x14),
      zkConfigProvider: new NodeZkConfigProvider(),
    });
    await client.register();
    await client.updateTotals(200_000n, 100_000n);

    const result = await client.proveSavings(4, { generateRealProof: true });
    expect(result.proofBytes).toBeInstanceOf(Uint8Array);
    expect(result.proofBytes!.length).toBeGreaterThan(1000);
  }, 30_000);

  it('generateRealProof without a configured zkConfigProvider throws a clear config error, not a crash', async () => {
    const client = await createCacheContractClient({ mode: 'local', secret: secretOf(0x15) });
    await client.register();
    await client.updateTotals(200_000n, 100_000n);
    await expect(client.proveSavings(4, { generateRealProof: true })).rejects.toThrow('zkConfigProvider');
  });
});

describe('CacheContractClient — deployed mode', () => {
  it('every method throws a clear not-yet-deployed error, and the factory dispatches to it correctly', async () => {
    const client = await createCacheContractClient({
      mode: 'deployed',
      contractAddress: '0x0',
      indexerUrl: 'http://localhost',
      indexerWsUrl: 'ws://localhost',
      proofServerUrl: 'http://localhost:6300',
      relayerUrl: 'http://localhost',
    });
    expect(client.mode).toBe('deployed');
    expect(client).toBeInstanceOf(DeployedCacheContractClient);
    await expect(client.register()).rejects.toThrow('not implemented');
    await expect(client.getLedgerSnapshot()).rejects.toThrow('not implemented');
  });
});
