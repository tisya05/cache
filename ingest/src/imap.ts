/**
 * IMAP client for Gmail. Correct but untestable live right now — there are
 * no real credentials yet. Type-checks correctly; see
 * ingest/scripts/smoke-test-imap.ts for a manual, human-run smoke test once
 * `.env` has real values.
 *
 * Credentials: read ONLY via process.env.GMAIL_USER / process.env.GMAIL_APP_PASSWORD.
 * Never logged, printed, hardcoded, or echoed, and no fallback/default value —
 * if either is missing, `connectToInbox` throws a clear "not configured"
 * error rather than silently degrading.
 *
 * Sender list: reused directly from senders.ts (`allKnownDomains`) — this
 * file does not maintain a second, potentially-drifting copy of "which
 * senders do we care about".
 *
 * This module intentionally does not know or care whether its caller is
 * going to use the LLM fallback path: `fetchRawMessages` just produces raw
 * (subject, sender, bodyText) tuples, and `syncInbox` hands them to the same
 * `processRawMessages` pipeline that seed.ts (and any future manual-entry
 * path) also uses — there is exactly one place the heuristic -> LLM
 * fallback logic lives (pipeline.ts).
 */

import { ImapFlow, type FetchMessageObject } from 'imapflow';
import { simpleParser } from 'mailparser';
import { allKnownDomains } from './senders.js';
import { processRawMessages, type ProcessRawMessagesOptions, type RawMessage } from './pipeline.js';
import type { TransactionEvent } from './types.js';

export interface ImapCredentials {
  user: string;
  appPassword: string;
}

/**
 * Read Gmail IMAP credentials from process.env only. Throws a clear,
 * non-sensitive "not configured" error if either is missing — never
 * defaults, never degrades silently, and never includes the (absent) value
 * in the error message.
 */
export function readImapCredentialsFromEnv(): ImapCredentials {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) {
    throw new Error(
      'IMAP is not configured: GMAIL_USER and GMAIL_APP_PASSWORD must both be set in the environment ' +
        '(place them in .env — see .env.example). Neither value is logged by this error.',
    );
  }
  return { user, appPassword };
}

export interface ConnectOptions {
  /** Defaults to reading from process.env via readImapCredentialsFromEnv(). */
  credentials?: ImapCredentials;
}

/**
 * Open an authenticated IMAP connection to Gmail. Caller is responsible for
 * calling `client.logout()` when done (see `syncInbox` for the usual
 * connect -> use -> logout lifecycle).
 */
export async function connectToInbox(opts: ConnectOptions = {}): Promise<ImapFlow> {
  const { user, appPassword } = opts.credentials ?? readImapCredentialsFromEnv();

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass: appPassword },
    logger: false,
  });

  await client.connect();
  return client;
}

export interface FetchRawMessagesOptions {
  /** Only fetch messages received after this date. Defaults to 30 days ago. */
  since?: Date;
  /** Restrict the search to these domains instead of the full known-sender list (mainly for testing/tuning). */
  domains?: string[];
}

/**
 * Fetch raw (subject, sender, bodyText) tuples for messages from known
 * transactional senders. Pure data collection — no heuristic parsing, no
 * LLM, no opinions about what happens next.
 */
export async function fetchRawMessages(client: ImapFlow, opts: FetchRawMessagesOptions = {}): Promise<RawMessage[]> {
  const since = opts.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const domains = opts.domains ?? allKnownDomains();

  const lock = await client.getMailboxLock('INBOX');
  const messages: RawMessage[] = [];
  const seenUids = new Set<number>();

  try {
    for (const domain of domains) {
      // IMAP SEARCH FROM is a substring match against the From header, so
      // searching by bare domain (e.g. "venmo.com") catches any address at
      // that domain without needing to know exact local-parts up front.
      const uids = await client.search({ from: domain, since }, { uid: true });
      if (!uids) continue;

      for (const uid of uids) {
        if (seenUids.has(uid)) continue; // a message could match more than one domain search
        seenUids.add(uid);

        const message: FetchMessageObject | false = await client.fetchOne(
          uid,
          { source: true, envelope: true },
          { uid: true },
        );
        if (!message || !message.source) continue;

        const parsed = await simpleParser(message.source);
        const subject = parsed.subject ?? '';
        const sender = parsed.from?.text ?? message.envelope?.from?.[0]?.address ?? '';
        const bodyText = parsed.text ?? '';
        const timestamp = (parsed.date ?? message.envelope?.date ?? new Date()).toISOString();

        messages.push({ subject, sender, bodyText, timestamp });
      }
    }
  } finally {
    lock.release();
  }

  return messages;
}

export interface SyncInboxOptions extends FetchRawMessagesOptions, ProcessRawMessagesOptions {
  credentials?: ImapCredentials;
}

/**
 * Convenience end-to-end sync: connect, fetch raw messages from known
 * senders, run them through the shared pipeline (heuristics + batched LLM
 * fallback for ambiguous Venmo/Zelle memos), and log out. This is the
 * function real application code should call; `connectToInbox` and
 * `fetchRawMessages` are exposed separately for testing and for callers that
 * want to manage the connection lifecycle themselves.
 */
export async function syncInbox(opts: SyncInboxOptions = {}): Promise<TransactionEvent[]> {
  const client = await connectToInbox({ credentials: opts.credentials });
  try {
    const rawMessages = await fetchRawMessages(client, { since: opts.since, domains: opts.domains });
    return await processRawMessages(rawMessages, { decide: opts.decide, batchSize: opts.batchSize });
  } finally {
    await client.logout();
  }
}
