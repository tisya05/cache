import { describe, expect, it } from 'vitest';
import { allKnownDomains, identifySender, isLlmFallbackEligibleSender, KNOWN_SENDERS } from '../src/senders.js';

describe('KNOWN_SENDERS', () => {
  it('includes Target alongside Venmo, Zelle, PayPal, Amazon, DoorDash, Uber, Starbucks, and bank alerts', () => {
    const keys = Object.keys(KNOWN_SENDERS).sort();
    expect(keys).toEqual(
      ['amazon', 'bankAlert', 'doordash', 'paypal', 'starbucks', 'target', 'uber', 'venmo', 'zelle'].sort(),
    );
  });

  it('marks only Venmo and Zelle as LLM-fallback eligible', () => {
    for (const key of Object.keys(KNOWN_SENDERS) as (keyof typeof KNOWN_SENDERS)[]) {
      const expected = key === 'venmo' || key === 'zelle';
      expect(isLlmFallbackEligibleSender(key)).toBe(expected);
    }
  });

  it('identifySender matches a known domain case-insensitively', () => {
    expect(identifySender('receipts@Target.com')).toBe('target');
    expect(identifySender('no-reply@DoorDash.com')).toBe('doordash');
  });

  it('identifySender returns null for an unknown domain', () => {
    expect(identifySender('newsletter@some-random-blog.com')).toBeNull();
  });

  it('allKnownDomains includes target.com', () => {
    expect(allKnownDomains()).toContain('target.com');
  });
});
