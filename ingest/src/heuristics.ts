/**
 * Cheap, local, zero-disclosure parsing for known transactional senders.
 * No network call, no LLM, ever, in this file.
 *
 * Each per-sender parser takes (subject, body) and either returns a
 * fully-formed ParsedEmailResult or null if it can't confidently recognize
 * that email as a transaction at all (falls through to "unrecognized").
 *
 * Per the project's privacy design (docs/BUILD-SPEC.md §7, and the
 * coordinator's follow-up refinement), only Venmo and Zelle carry free-text,
 * human-written memos that can be genuinely ambiguous — every other known
 * sender (PayPal, Amazon, DoorDash, Uber, Starbucks, Target, generic bank
 * alerts) is fully resolved locally, always, with zero disclosure. This is
 * enforced structurally here: only parseVenmo/parseZelle ever set
 * `llmEligible: true`, and only when they could not confidently determine a
 * category. See senders.ts `llmFallbackEligible` for the same invariant
 * expressed at the sender-registry level.
 */

import { identifySender } from './senders.js';
import { makeEventId, normalizeMemo, parseMoneyToCents } from './util.js';
import { getCategoryGroup, type TransactionEvent } from './types.js';

export interface ParsedEmailResult {
  event: TransactionEvent;
  /** True only for a Venmo/Zelle event whose category could not be resolved locally. */
  llmEligible: boolean;
}

function buildEvent(params: {
  type: 'income' | 'spend';
  amountCents: number;
  merchant: string;
  memo: string;
  category: string;
  confidence: number;
  timestamp: string;
}): TransactionEvent {
  const { type, amountCents, merchant, memo, category, confidence, timestamp } = params;
  return {
    id: makeEventId(merchant, timestamp, amountCents, memo),
    type,
    amountCents,
    merchant,
    memo,
    category,
    categoryGroup: getCategoryGroup(category),
    confidence,
    timestamp,
    source: 'heuristic',
  };
}

// ---------------------------------------------------------------------------
// Canonical clean memo phrases for Venmo/Zelle. If the normalized memo is an
// EXACT match for one of these, we categorize confidently and locally. Any
// extra words (slang, emoji-derived leftovers, additional context) fail the
// exact match on purpose — that is what correctly routes genuinely ambiguous
// memos like "Steph 🍕🍺 rent split lol" to the (batched, opt-in) LLM path
// instead of guessing.
// ---------------------------------------------------------------------------

const SPEND_CANONICAL_MEMOS: Record<string, string> = {
  rent: 'rent',
  'rent split': 'rent',
  'for rent': 'rent',
  groceries: 'groceries',
  grocery: 'groceries',
  tuition: 'tuition',
  textbooks: 'textbooks',
  textbook: 'textbooks',
  coffee: 'coffee',
  utilities: 'utilities',
  wifi: 'utilities',
};

const INCOME_CANONICAL_MEMOS: Record<string, string> = {
  tutoring: 'tutoring_income',
  'calc tutoring': 'tutoring_income',
  'tutoring session': 'tutoring_income',
  reimbursement: 'reimbursement',
  gift: 'gift_income',
};

function categorizeP2pMemo(
  memo: string,
  type: 'income' | 'spend',
): { category: string; confidence: number; llmEligible: boolean } {
  const normalized = normalizeMemo(memo);
  const map = type === 'income' ? INCOME_CANONICAL_MEMOS : SPEND_CANONICAL_MEMOS;
  const hit = map[normalized];
  if (hit) {
    return { category: hit, confidence: 1.0, llmEligible: false };
  }
  // Genuinely ambiguous: extract amount/type/merchant confidently (that part
  // IS mechanical) but leave category as an explicit low-confidence guess so
  // it correctly flows to review / the batched LLM path.
  return { category: 'uncategorized', confidence: 0.35, llmEligible: true };
}

// ---------------------------------------------------------------------------
// Generic keyword categorization, used by senders whose body text names an
// arbitrary business (PayPal, generic bank alerts) rather than being a fixed
// known template like Amazon/DoorDash.
// ---------------------------------------------------------------------------

function genericSpendKeywordCategory(text: string): string {
  const t = text.toLowerCase();
  if (/(trader joe|whole foods|stop\s*&?\s*shop|grocery|groceries|market)/.test(t)) return 'groceries';
  if (/(spotify|netflix|hulu|disney\+|subscription)/.test(t)) return 'subscriptions';
  if (/textbook/.test(t)) return 'textbooks';
  if (/(tuition|bursar)/.test(t)) return 'tuition';
  if (/(rent|landlord|realty)/.test(t)) return 'rent';
  if (/(electric|utility|utilities|internet|wifi)/.test(t)) return 'utilities';
  if (/insurance/.test(t)) return 'insurance';
  return 'shopping';
}

function genericIncomeKeywordCategory(text: string): string {
  const t = text.toLowerCase();
  if (/(payroll|paycheck|salary|employer)/.test(t)) return 'paycheck';
  if (/(financial aid|disbursement|\baid\b)/.test(t)) return 'financial_aid';
  if (/tutoring/.test(t)) return 'tutoring_income';
  if (/gift/.test(t)) return 'gift_income';
  return 'reimbursement';
}

// ---------------------------------------------------------------------------
// Venmo
// ---------------------------------------------------------------------------

const VENMO_PAID_BY_USER = /you paid\s+\$([\d,.]+)\s+to\s+([^\n"“”]+?)\s+for\s+["“](.*?)["”]/i;
const VENMO_PAID_TO_USER = /([^\n"“”]+?)\s+paid you\s+\$([\d,.]+)\s+for\s+["“](.*?)["”]/i;

export function parseVenmo(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;

  const paidBy = text.match(VENMO_PAID_BY_USER);
  if (paidBy) {
    const amountCents = parseMoneyToCents(paidBy[1]);
    const memo = paidBy[3].trim();
    const { category, confidence, llmEligible } = categorizeP2pMemo(memo, 'spend');
    return {
      event: buildEvent({ type: 'spend', amountCents, merchant: 'Venmo', memo, category, confidence, timestamp }),
      llmEligible,
    };
  }

  const paidTo = text.match(VENMO_PAID_TO_USER);
  if (paidTo) {
    const amountCents = parseMoneyToCents(paidTo[2]);
    const memo = paidTo[3].trim();
    const { category, confidence, llmEligible } = categorizeP2pMemo(memo, 'income');
    return {
      event: buildEvent({ type: 'income', amountCents, merchant: 'Venmo', memo, category, confidence, timestamp }),
      llmEligible,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Zelle (either zellepay.com directly, or bank-hosted notifications that
// mention Zelle in the subject/body — see dispatcher below)
// ---------------------------------------------------------------------------

const ZELLE_SENT = /you sent\s+\$([\d,.]+)\s+to\s+([^\n]+?)\s+via zelle(?:\s+for\s+["“](.*?)["”])?/i;
const ZELLE_RECEIVED = /([^\n]+?)\s+sent you\s+\$([\d,.]+)\s+via zelle(?:\s+for\s+["“](.*?)["”])?/i;

export function parseZelle(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;

  const sent = text.match(ZELLE_SENT);
  if (sent) {
    const amountCents = parseMoneyToCents(sent[1]);
    const memo = (sent[3] ?? '').trim();
    const { category, confidence, llmEligible } = categorizeP2pMemo(memo, 'spend');
    return {
      event: buildEvent({ type: 'spend', amountCents, merchant: 'Zelle', memo, category, confidence, timestamp }),
      llmEligible,
    };
  }

  const received = text.match(ZELLE_RECEIVED);
  if (received) {
    const amountCents = parseMoneyToCents(received[2]);
    const memo = (received[3] ?? '').trim();
    const { category, confidence, llmEligible } = categorizeP2pMemo(memo, 'income');
    return {
      event: buildEvent({ type: 'income', amountCents, merchant: 'Zelle', memo, category, confidence, timestamp }),
      llmEligible,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// PayPal — never LLM-eligible. Category is a best-effort keyword guess but
// still resolved fully locally, per the new design (heuristics always
// resolve these senders, not merely "when confident").
// ---------------------------------------------------------------------------

const PAYPAL_SENT = /you sent\s+\$([\d,.]+)(?:\s*usd)?\s+to\s+([^\n.]+)/i;
const PAYPAL_RECEIVED = /you(?:'ve| have) received\s+\$([\d,.]+)(?:\s*usd)?\s+from\s+([^\n.]+)/i;

export function parsePaypal(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;

  const sent = text.match(PAYPAL_SENT);
  if (sent) {
    const amountCents = parseMoneyToCents(sent[1]);
    const counterparty = sent[2].trim();
    const category = genericSpendKeywordCategory(counterparty);
    return {
      event: buildEvent({
        type: 'spend',
        amountCents,
        merchant: 'PayPal',
        memo: counterparty,
        category,
        confidence: 1.0,
        timestamp,
      }),
      llmEligible: false,
    };
  }

  const received = text.match(PAYPAL_RECEIVED);
  if (received) {
    const amountCents = parseMoneyToCents(received[1]);
    const counterparty = received[2].trim();
    const category = genericIncomeKeywordCategory(counterparty);
    return {
      event: buildEvent({
        type: 'income',
        amountCents,
        merchant: 'PayPal',
        memo: counterparty,
        category,
        confidence: 1.0,
        timestamp,
      }),
      llmEligible: false,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Amazon — order confirmations. Always spend, always resolved locally.
// ---------------------------------------------------------------------------

const AMAZON_TOTAL = /(?:order total|grand total|total)[:\s]+\$([\d,.]+)/i;

export function parseAmazon(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;
  const match = text.match(AMAZON_TOTAL);
  if (!match) return null;
  const amountCents = parseMoneyToCents(match[1]);
  const category = /textbook/i.test(text) ? 'textbooks' : 'shopping';
  return {
    event: buildEvent({
      type: 'spend',
      amountCents,
      merchant: 'Amazon',
      memo: subject.trim(),
      category,
      confidence: 1.0,
      timestamp,
    }),
    llmEligible: false,
  };
}

// ---------------------------------------------------------------------------
// DoorDash — always spend, always "food".
// ---------------------------------------------------------------------------

const DOORDASH_TOTAL = /total[:\s]+\$([\d,.]+)/i;

export function parseDoordash(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;
  const match = text.match(DOORDASH_TOTAL);
  if (!match) return null;
  const amountCents = parseMoneyToCents(match[1]);
  return {
    event: buildEvent({
      type: 'spend',
      amountCents,
      merchant: 'DoorDash',
      memo: subject.trim(),
      category: 'food',
      confidence: 1.0,
      timestamp,
    }),
    llmEligible: false,
  };
}

// ---------------------------------------------------------------------------
// Uber — either a ride (transport) or Uber Eats (food).
// ---------------------------------------------------------------------------

const UBER_AMOUNT = /(?:total|you paid|trip cost)[:\s]+\$([\d,.]+)/i;

export function parseUber(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;
  const match = text.match(UBER_AMOUNT);
  if (!match) return null;
  const amountCents = parseMoneyToCents(match[1]);
  const isEats = /eats/i.test(text);
  return {
    event: buildEvent({
      type: 'spend',
      amountCents,
      merchant: isEats ? 'Uber Eats' : 'Uber',
      memo: subject.trim(),
      category: isEats ? 'food' : 'transport',
      confidence: 1.0,
      timestamp,
    }),
    llmEligible: false,
  };
}

// ---------------------------------------------------------------------------
// Starbucks — always spend, always "coffee".
// ---------------------------------------------------------------------------

const STARBUCKS_TOTAL = /total[:\s]+\$([\d,.]+)/i;

export function parseStarbucks(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;
  const match = text.match(STARBUCKS_TOTAL);
  if (!match) return null;
  const amountCents = parseMoneyToCents(match[1]);
  return {
    event: buildEvent({
      type: 'spend',
      amountCents,
      merchant: 'Starbucks',
      memo: subject.trim(),
      category: 'coffee',
      confidence: 1.0,
      timestamp,
    }),
    llmEligible: false,
  };
}

// ---------------------------------------------------------------------------
// Target — always spend, always resolved locally to "shopping".
// ---------------------------------------------------------------------------

const TARGET_TOTAL = /(?:order total|total)[:\s]+\$([\d,.]+)/i;

export function parseTarget(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;
  const match = text.match(TARGET_TOTAL);
  if (!match) return null;
  const amountCents = parseMoneyToCents(match[1]);
  return {
    event: buildEvent({
      type: 'spend',
      amountCents,
      merchant: 'Target',
      memo: subject.trim(),
      category: 'shopping',
      confidence: 1.0,
      timestamp,
    }),
    llmEligible: false,
  };
}

// ---------------------------------------------------------------------------
// Generic bank alert — either a transaction/deposit alert (resolved locally,
// always) or a low-balance-style alert with no transaction at all (returns
// null; it is genuinely not a transaction event).
// ---------------------------------------------------------------------------

const BANK_TRANSACTION_ALERT =
  /a\s+\$([\d,.]+)\s+(deposit|credit|transaction|purchase|debit|charge)\s+(?:was\s+)?posted(?:\s+to your account(?:\s+ending in\s+\d+)?)?\s*(?:from|at)\s+([A-Za-z0-9 &'.]+)/i;

export function parseGenericBankAlert(subject: string, body: string, timestamp: string): ParsedEmailResult | null {
  const text = `${subject}\n${body}`;
  const match = text.match(BANK_TRANSACTION_ALERT);
  if (!match) return null; // e.g. a low-balance alert — not a transaction

  const amountCents = parseMoneyToCents(match[1]);
  const kind = match[2].toLowerCase();
  const counterparty = match[3].trim();
  const isIncome = kind === 'deposit' || kind === 'credit';

  const category = isIncome ? genericIncomeKeywordCategory(counterparty) : genericSpendKeywordCategory(counterparty);

  return {
    event: buildEvent({
      type: isIncome ? 'income' : 'spend',
      amountCents,
      merchant: counterparty,
      memo: subject.trim(),
      category,
      confidence: 1.0,
      timestamp,
    }),
    llmEligible: false,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Try every known-sender parser and return the first confident match, or
 * null if this email doesn't look like a transaction from any known sender
 * at all (falls through to "unrecognized" — no event is produced).
 *
 * `timestamp` defaults to "now" for convenience in ad-hoc calls, but callers
 * that care about determinism or historical accuracy (imap.ts using the
 * email's real Date header, seed.ts generating a historical month) should
 * always pass it explicitly.
 */
export function parseTransactionEmail(
  subject: string,
  sender: string,
  body: string,
  timestamp: string = new Date().toISOString(),
): ParsedEmailResult | null {
  const senderKey = identifySender(sender);

  // Some banks host Zelle notifications on their own domain; detect those by
  // content even when the From address matched the generic bank-alert bucket
  // (or matched nothing at all).
  if (senderKey !== 'venmo' && /zelle/i.test(`${subject}\n${body}`)) {
    const zelle = parseZelle(subject, body, timestamp);
    if (zelle) return zelle;
  }

  switch (senderKey) {
    case 'venmo':
      return parseVenmo(subject, body, timestamp);
    case 'zelle':
      return parseZelle(subject, body, timestamp);
    case 'paypal':
      return parsePaypal(subject, body, timestamp);
    case 'amazon':
      return parseAmazon(subject, body, timestamp);
    case 'doordash':
      return parseDoordash(subject, body, timestamp);
    case 'uber':
      return parseUber(subject, body, timestamp);
    case 'starbucks':
      return parseStarbucks(subject, body, timestamp);
    case 'target':
      return parseTarget(subject, body, timestamp);
    case 'bankAlert':
      return parseGenericBankAlert(subject, body, timestamp);
    default:
      return null;
  }
}
