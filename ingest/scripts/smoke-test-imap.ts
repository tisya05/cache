#!/usr/bin/env node
/**
 * Manual, human-run smoke test for the IMAP ingest path. NOT run by the
 * automated test suite (there are no real credentials in CI/test
 * environments, and this makes a real network connection to Gmail).
 *
 * Usage, once .env has real GMAIL_USER / GMAIL_APP_PASSWORD values:
 *
 *   node --env-file=.env --experimental-strip-types ingest/scripts/smoke-test-imap.ts
 *
 * or, after building:
 *
 *   node --env-file=.env ingest/dist/scripts/smoke-test-imap.js
 *
 * This script deliberately never logs the credentials themselves — only
 * counts and non-sensitive summaries of what it found.
 */

import { connectToInbox, fetchRawMessages } from '../src/imap.js';
import { processRawMessages } from '../src/pipeline.js';
import { partitionByConfidence } from '../src/review-queue.js';

async function main() {
  console.log('Connecting to Gmail over IMAP...');
  const client = await connectToInbox();
  console.log('Connected. Fetching messages from known transactional senders (last 30 days)...');

  try {
    const rawMessages = await fetchRawMessages(client);
    console.log(`Fetched ${rawMessages.length} raw message(s) matching known senders.`);

    const events = await processRawMessages(rawMessages);
    console.log(`Parsed ${events.length} transaction event(s).`);

    const { autoApplied, needsReview } = partitionByConfidence(events);
    console.log(`  auto-applied: ${autoApplied.length}`);
    console.log(`  needs review: ${needsReview.length}`);

    for (const event of events) {
      // Non-sensitive summary only: no full memo dump, just shape.
      console.log(`  [${event.type}] ${event.merchant} - ${event.category} (confidence ${event.confidence.toFixed(2)})`);
    }
  } finally {
    await client.logout();
    console.log('Logged out.');
  }
}

main().catch((err) => {
  console.error('Smoke test failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
