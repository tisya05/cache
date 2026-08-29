import { describe, expect, it } from 'vitest';
import { parseTransactionEmail } from '../src/heuristics.js';

const TS = '2026-02-10T12:00:00.000Z';

describe('parseTransactionEmail: Venmo', () => {
  it('parses a clean "you paid" memo confidently', () => {
    const result = parseTransactionEmail(
      'You paid Landlord Realty',
      'venmo@venmo.com',
      'You paid $650.00 to Landlord Realty for "rent"',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 65000,
      merchant: 'Venmo',
      category: 'rent',
      categoryGroup: 'needs',
      confidence: 1.0,
      source: 'heuristic',
    });
    expect(result!.llmEligible).toBe(false);
  });

  it('parses a clean "paid you" memo confidently as income', () => {
    const result = parseTransactionEmail(
      'Alex Chen paid you',
      'venmo@venmo.com',
      'Alex Chen paid you $40.00 for "calc tutoring"',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'income',
      amountCents: 4000,
      merchant: 'Venmo',
      category: 'tutoring_income',
      categoryGroup: 'savings',
      confidence: 1.0,
    });
    expect(result!.llmEligible).toBe(false);
  });

  it('extracts amount/type/merchant confidently but flags an ambiguous memo for LLM review', () => {
    const result = parseTransactionEmail(
      'You paid Steph Lee',
      'venmo@venmo.com',
      'You paid $23.00 to Steph Lee for "🍕🍺 rent split lol"',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe('spend');
    expect(result!.event.amountCents).toBe(2300);
    expect(result!.event.merchant).toBe('Venmo');
    expect(result!.event.category).toBe('uncategorized');
    expect(result!.event.confidence).toBeLessThan(0.8);
    expect(result!.llmEligible).toBe(true);
  });

  it('returns null for a non-transactional Venmo email', () => {
    const result = parseTransactionEmail(
      'Your weekly Venmo digest',
      'venmo@venmo.com',
      'See what your friends have been up to this week!',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: Zelle', () => {
  it('parses a bank-hosted Zelle send with no memo as ambiguous (income/spend certain, category not)', () => {
    const result = parseTransactionEmail(
      'Zelle payment sent',
      'alerts@chase.com',
      'You sent $30.00 to Priya Patel via Zelle',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe('spend');
    expect(result!.event.amountCents).toBe(3000);
    expect(result!.event.merchant).toBe('Zelle');
    expect(result!.event.category).toBe('uncategorized');
    expect(result!.event.confidence).toBeLessThan(0.8);
    expect(result!.llmEligible).toBe(true);
  });

  it('parses a received Zelle payment with a clean memo confidently', () => {
    const result = parseTransactionEmail(
      'Money received',
      'zelle@zellepay.com',
      'Sam Rivera sent you $50.00 via Zelle for "tuition"',
      TS,
    );
    expect(result).not.toBeNull();
    // "tuition" is not in the income canonical map (it's a spend concept),
    // so this correctly stays ambiguous rather than guessing.
    expect(result!.event.type).toBe('income');
    expect(result!.event.amountCents).toBe(5000);
  });

  it('returns null for an unrelated bank alert with no Zelle/transaction language', () => {
    const result = parseTransactionEmail(
      'Statement ready',
      'alerts@chase.com',
      'Your monthly statement is now available to view online.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: PayPal', () => {
  it('resolves a sent payment fully locally, never LLM-eligible', () => {
    const result = parseTransactionEmail(
      'Receipt for your payment',
      'service@paypal.com',
      'You sent $12.00 USD to Campus Print Shop',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe('spend');
    expect(result!.event.amountCents).toBe(1200);
    expect(result!.event.merchant).toBe('PayPal');
    expect(result!.event.confidence).toBe(1.0);
    expect(result!.llmEligible).toBe(false);
  });

  it('resolves a received payment fully locally', () => {
    const result = parseTransactionEmail(
      'You\'ve got money',
      'service@paypal.com',
      "You've received $75.00 USD from Freelance Client",
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe('income');
    expect(result!.event.amountCents).toBe(7500);
    expect(result!.llmEligible).toBe(false);
  });

  it('returns null for a PayPal email with no payment amount', () => {
    const result = parseTransactionEmail(
      'Update your PayPal password',
      'service@paypal.com',
      'We noticed a login from a new device. If this wasn\'t you, secure your account.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: Amazon', () => {
  it('parses an order confirmation as shopping', () => {
    const result = parseTransactionEmail(
      'Your Amazon.com order confirmation',
      'order-update@amazon.com',
      'Order Total: $34.99',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 3499,
      merchant: 'Amazon',
      category: 'shopping',
      confidence: 1.0,
    });
    expect(result!.llmEligible).toBe(false);
  });

  it('recognizes a textbook rental order as textbooks', () => {
    const result = parseTransactionEmail(
      'Your Amazon.com Textbook Rental order confirmation',
      'order-update@amazon.com',
      'Order Total: $89.50',
      TS,
    );
    expect(result!.event.category).toBe('textbooks');
  });

  it('returns null when there is no total in the email', () => {
    const result = parseTransactionEmail(
      'Your package has shipped',
      'order-update@amazon.com',
      'Track your package for delivery updates.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: DoorDash', () => {
  it('parses a receipt as food', () => {
    const result = parseTransactionEmail(
      'Your DoorDash order receipt',
      'no-reply@doordash.com',
      'Thanks for your order! Total: $23.45',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 2345,
      merchant: 'DoorDash',
      category: 'food',
      confidence: 1.0,
    });
  });

  it('returns null for a DoorDash promo email with no total', () => {
    const result = parseTransactionEmail(
      '50% off your next order!',
      'no-reply@doordash.com',
      'Use code SAVE50 at checkout.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: Uber', () => {
  it('parses a ride receipt as transport', () => {
    const result = parseTransactionEmail(
      'Your Tuesday morning trip with Uber',
      'receipts@uber.com',
      'Trip cost: $14.32',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 1432,
      merchant: 'Uber',
      category: 'transport',
    });
  });

  it('parses an Uber Eats receipt as food', () => {
    const result = parseTransactionEmail(
      'Your Uber Eats order receipt',
      'receipts@uber.com',
      'Total: $28.40',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      merchant: 'Uber Eats',
      category: 'food',
    });
  });

  it('returns null for an Uber email with no amount', () => {
    const result = parseTransactionEmail('Rate your trip', 'receipts@uber.com', 'How was your ride today?', TS);
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: Starbucks', () => {
  it('parses a receipt as coffee', () => {
    const result = parseTransactionEmail(
      'Your Starbucks receipt',
      'receipts@starbucks.com',
      'Thanks for visiting! Total: $6.75',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 675,
      merchant: 'Starbucks',
      category: 'coffee',
      confidence: 1.0,
    });
  });

  it('returns null for a Starbucks marketing email', () => {
    const result = parseTransactionEmail(
      'New Fall Menu Is Here',
      'receipts@starbucks.com',
      'Try our new pumpkin spice lineup today.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: Target', () => {
  it('parses an order confirmation as shopping', () => {
    const result = parseTransactionEmail(
      'Your Target order confirmation',
      'orders@target.com',
      'Order Total: $42.10',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 4210,
      merchant: 'Target',
      category: 'shopping',
      confidence: 1.0,
    });
    expect(result!.llmEligible).toBe(false);
  });

  it('returns null for a Target circular/ad email', () => {
    const result = parseTransactionEmail(
      'This week\'s deals',
      'orders@target.com',
      'Check out this week\'s deals in the Target Circle app.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: generic bank alert', () => {
  it('parses a deposit alert as income and keyword-categorizes it', () => {
    const result = parseTransactionEmail(
      'Account Alert',
      'alerts@chase.com',
      'A $412.50 deposit was posted to your account ending in 4321 from PAYROLL',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'income',
      amountCents: 41250,
      category: 'paycheck',
      confidence: 1.0,
    });
    expect(result!.llmEligible).toBe(false);
  });

  it('parses a purchase alert as spend and keyword-categorizes it', () => {
    const result = parseTransactionEmail(
      'Account Alert',
      'alerts@chase.com',
      'A $58.23 transaction was posted to your account ending in 4321 at TRADER JOES',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event).toMatchObject({
      type: 'spend',
      amountCents: 5823,
      category: 'groceries',
      confidence: 1.0,
    });
  });

  it('falls back to a generic default category for an unrecognized merchant', () => {
    const result = parseTransactionEmail(
      'Account Alert',
      'alerts@chase.com',
      'A $19.99 transaction was posted to your account ending in 4321 at SOME RANDOM SHOP',
      TS,
    );
    expect(result).not.toBeNull();
    expect(result!.event.category).toBe('shopping');
    expect(result!.event.confidence).toBe(1.0);
  });

  it('returns null for a low-balance alert (not a transaction)', () => {
    const result = parseTransactionEmail(
      'Low balance alert',
      'alerts@chase.com',
      'Your checking account balance is below $50. Consider transferring funds.',
      TS,
    );
    expect(result).toBeNull();
  });
});

describe('parseTransactionEmail: unrecognized sender', () => {
  it('returns null for a sender not in the known list', () => {
    const result = parseTransactionEmail(
      'Newsletter',
      'newsletter@some-random-blog.com',
      'Here is this week\'s roundup.',
      TS,
    );
    expect(result).toBeNull();
  });
});
