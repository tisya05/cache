import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processRawMessage, processRawMessages } from '../src/pipeline.js';

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

describe('processRawMessage', () => {
  it('resolves a known-sender message synchronously via heuristics only', () => {
    const result = processRawMessage({
      subject: 'Your Starbucks receipt',
      sender: 'receipts@starbucks.com',
      bodyText: 'Thanks for visiting! Total: $6.75',
      timestamp: '2026-02-05T08:00:00.000Z',
    });
    expect(result).not.toBeNull();
    expect(result!.event.category).toBe('coffee');
    expect(result!.llmEligible).toBe(false);
  });

  it('returns null for an unrecognized message', () => {
    const result = processRawMessage({
      subject: 'Weekly newsletter',
      sender: 'hello@some-blog.com',
      bodyText: 'This week in tech...',
    });
    expect(result).toBeNull();
  });
});

describe('processRawMessages', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    if (ORIGINAL_KEY !== undefined) process.env.GEMINI_API_KEY = ORIGINAL_KEY;
  });

  it('drops unrecognized messages and keeps recognized ones', async () => {
    const events = await processRawMessages([
      { subject: 'Weekly newsletter', sender: 'hello@some-blog.com', bodyText: 'nothing here' },
      {
        subject: 'Your DoorDash order receipt',
        sender: 'no-reply@doordash.com',
        bodyText: 'Thanks for your order! Total: $23.45',
        timestamp: '2026-02-06T19:00:00.000Z',
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].merchant).toBe('DoorDash');
  });

  it('leaves an ambiguous Venmo/Zelle event as low-confidence uncategorized when GEMINI_API_KEY is absent', async () => {
    const events = await processRawMessages([
      {
        subject: 'You paid Steph Lee',
        sender: 'venmo@venmo.com',
        bodyText: 'You paid $23.00 to Steph Lee for "🍕🍺 rent split lol"',
        timestamp: '2026-02-05T21:00:00.000Z',
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('uncategorized');
    expect(events[0].confidence).toBeLessThan(0.8);
    expect(events[0].source).toBe('heuristic'); // never touched the LLM path
  });

  it('never calls the LLM path at all when there is nothing ambiguous in the batch', async () => {
    const events = await processRawMessages([
      {
        subject: 'Your Starbucks receipt',
        sender: 'receipts@starbucks.com',
        bodyText: 'Total: $4.50',
        timestamp: '2026-02-05T08:00:00.000Z',
      },
      {
        subject: 'Your Target order confirmation',
        sender: 'orders@target.com',
        bodyText: 'Order Total: $42.10',
        timestamp: '2026-02-15T12:00:00.000Z',
      },
    ]);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.confidence === 1.0 && e.source === 'heuristic')).toBe(true);
  });
});
