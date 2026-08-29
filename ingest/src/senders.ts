/**
 * The single, shared registry of known transactional senders. Both the
 * heuristic parsers (heuristics.ts) and the IMAP query builder (imap.ts) key
 * off this list, so the two can never drift into two different "who do we
 * treat as a known sender" answers.
 *
 * Each entry's `domains` are substrings matched case-insensitively against the
 * email's From header. `llmFallbackEligible` marks senders whose category can
 * be genuinely ambiguous and may be routed to the batched LLM step — per the
 * project's privacy design, that is true ONLY for Venmo and Zelle (free-text,
 * human-written P2P memos). Every other known sender is resolved entirely by
 * local heuristics with zero disclosure, by design, not merely because a
 * confidence threshold happened to be met.
 */

export type SenderKey =
  | 'venmo'
  | 'zelle'
  | 'paypal'
  | 'amazon'
  | 'doordash'
  | 'uber'
  | 'starbucks'
  | 'target'
  | 'bankAlert';

export interface SenderDefinition {
  key: SenderKey;
  domains: string[];
  llmFallbackEligible: boolean;
}

export const KNOWN_SENDERS: Record<SenderKey, SenderDefinition> = {
  venmo: { key: 'venmo', domains: ['venmo.com'], llmFallbackEligible: true },
  zelle: {
    key: 'zelle',
    // Zelle is bank-mediated: notifications come from "zellepay.com" or from
    // the user's own bank domain with "zelle" in the subject/body. We match
    // on the zellepay.com domain here; bank-hosted Zelle notifications are
    // additionally recognized in heuristics.ts by body/subject content.
    domains: ['zellepay.com'],
    llmFallbackEligible: true,
  },
  paypal: { key: 'paypal', domains: ['paypal.com'], llmFallbackEligible: false },
  amazon: { key: 'amazon', domains: ['amazon.com'], llmFallbackEligible: false },
  doordash: { key: 'doordash', domains: ['doordash.com'], llmFallbackEligible: false },
  uber: { key: 'uber', domains: ['uber.com'], llmFallbackEligible: false },
  starbucks: { key: 'starbucks', domains: ['starbucks.com'], llmFallbackEligible: false },
  target: { key: 'target', domains: ['target.com'], llmFallbackEligible: false },
  // Generic bank alert domains. Not exhaustive — this is a best-effort list of
  // common student/consumer bank domains for the fallback "generic bank alert"
  // parser. llmFallbackEligible is false: bank alert text is a fixed template,
  // not a human-written memo, so any ambiguity there is resolved (or dropped)
  // by the heuristic parser itself, never sent to an LLM.
  bankAlert: {
    key: 'bankAlert',
    domains: [
      'chase.com',
      'bankofamerica.com',
      'wellsfargo.com',
      'capitalone.com',
      'usbank.com',
      'ally.com',
      'discover.com',
      'citizensbank.com',
    ],
    llmFallbackEligible: false,
  },
};

export function identifySender(fromHeader: string): SenderKey | null {
  const lower = fromHeader.toLowerCase();
  for (const def of Object.values(KNOWN_SENDERS)) {
    if (def.domains.some((d) => lower.includes(d))) {
      return def.key;
    }
  }
  return null;
}

export function isLlmFallbackEligibleSender(key: SenderKey): boolean {
  return KNOWN_SENDERS[key].llmFallbackEligible;
}

/** Flat list of all known domains, useful for building an IMAP search filter. */
export function allKnownDomains(): string[] {
  return Object.values(KNOWN_SENDERS).flatMap((d) => d.domains);
}
