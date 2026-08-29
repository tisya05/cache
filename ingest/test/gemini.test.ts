import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categorizeAmbiguousEvents,
  categorizeBatchWithLLM,
  isGeminiConfigured,
  MAX_BATCH_SIZE,
} from '../src/llm/gemini.js';
import { buildDisclosureBatch } from '../src/disclosure.js';
import type { TransactionEvent } from '../src/types.js';

function makeEvent(overrides: Partial<TransactionEvent> = {}): TransactionEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    type: 'spend',
    amountCents: 2300,
    merchant: 'Venmo',
    memo: 'rent split lol',
    category: 'uncategorized',
    categoryGroup: 'wants',
    confidence: 0.35,
    timestamp: '2026-02-05T21:00:00.000Z',
    source: 'heuristic',
    ...overrides,
  };
}

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

describe('gemini: missing API key', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    if (ORIGINAL_KEY !== undefined) process.env.GEMINI_API_KEY = ORIGINAL_KEY;
  });

  it('isGeminiConfigured is false with no key set', () => {
    expect(isGeminiConfigured()).toBe(false);
  });

  it('categorizeBatchWithLLM throws a clear config error and never calls fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const events = [makeEvent()];
    const consentedBatch = buildDisclosureBatch(events);

    await expect(categorizeBatchWithLLM(events, { consentedBatch })).rejects.toThrow(/GEMINI_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('categorizeAmbiguousEvents degrades gracefully: no throw, zero API calls, everything routed to skipped', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' }), makeEvent({ id: 'c' })];

    const result = await categorizeAmbiguousEvents(events);

    expect(result.apiCallsMade).toBe(0);
    expect(result.categorized.size).toBe(0);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('gemini: consent gate', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key-not-real';
  });
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
  });

  it('rejects a stale/mismatched consented batch before any network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const events = [makeEvent({ id: 'a', memo: 'original' })];
    const staleConsent = buildDisclosureBatch(events);
    const mutated = [{ ...events[0], memo: 'changed after preview was shown' }];

    await expect(categorizeBatchWithLLM(mutated, { consentedBatch: staleConsent })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects a batch larger than MAX_BATCH_SIZE', async () => {
    const events = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => makeEvent({ id: `e${i}` }));
    const consentedBatch = buildDisclosureBatch(events);
    await expect(categorizeBatchWithLLM(events, { consentedBatch })).rejects.toThrow(/max batch size/i);
  });
});

describe('gemini: batch decline', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key-not-real';
  });
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
  });

  it('declining the preview routes every event to skipped with zero API calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })];

    const result = await categorizeAmbiguousEvents(events, { decide: () => false });

    expect(result.apiCallsMade).toBe(0);
    expect(result.categorized.size).toBe(0);
    expect(result.skipped).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('gemini: batching behavior with a mocked network call', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key-not-real';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
  });

  function mockGeminiResponse(categoriesInOrder: Array<{ category: string; confidence: number }>) {
    const body = categoriesInOrder.map((c, i) => ({ index: i + 1, category: c.category, confidence: c.confidence }));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }],
      }),
    } as Response;
  }

  it('sends 12 ambiguous events as exactly 2 batches (10 + 2), never more than MAX_BATCH_SIZE per call', async () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      makeEvent({ id: `e${i}`, memo: `note ${i}`, amountCents: 1000 + i * 100 }),
    );

    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      const itemCount = (body.contents[0].parts[0].text.match(/^\d+\. memo:/gm) || []).length;
      return mockGeminiResponse(Array.from({ length: itemCount }, () => ({ category: 'food', confidence: 0.9 })));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await categorizeAmbiguousEvents(events);

    expect(result.apiCallsMade).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.categorized.size).toBe(12);
    expect(result.skipped).toHaveLength(0);

    // Confirm the payload sent per transaction is ONLY memo + bucket: no
    // merchant, no exact amount, anywhere in the outgoing request text.
    for (const [, init] of fetchMock.mock.calls) {
      const text = JSON.parse((init as any).body).contents[0].parts[0].text as string;
      expect(text).not.toMatch(/Venmo/);
      expect(text).not.toMatch(/\b10\.00\b/); // an exact dollar amount would appear like this if leaked
    }
  });

  it('maps an unrecognized category from the model to uncategorized/low-confidence', async () => {
    const events = [makeEvent({ id: 'a' })];
    const fetchMock = vi.fn(async () => mockGeminiResponse([{ category: 'made_up_nonsense', confidence: 0.9 }]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await categorizeAmbiguousEvents(events);
    const categorization = result.categorized.get('a');
    expect(categorization).toBeDefined();
    expect(categorization!.category).toBe('uncategorized');
    expect(categorization!.confidence).toBe(0);
  });

  it('routes a batch to skipped (not a crash) when the Gemini call itself fails', async () => {
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('simulated network failure');
      }),
    );
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await categorizeAmbiguousEvents(events);

    expect(result.apiCallsMade).toBe(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.categorized.size).toBe(0);
    consoleErrorSpy.mockRestore();
  });
});
