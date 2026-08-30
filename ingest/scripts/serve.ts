#!/usr/bin/env node
/**
 * Local HTTP bridge for the IMAP ingest pipeline, so the browser (which
 * can't open an IMAP connection itself) can trigger a real inbox sync. Sits
 * behind the same kind of Vite proxy already used for the proof server
 * (see ui/vite.config.ts, /email-server -> this process) rather than being
 * reachable directly -- the browser only ever calls a same-origin relative
 * path, exactly like /proof-server.
 *
 * Usage:
 *   node --env-file=.env --experimental-strip-types ingest/scripts/serve.ts
 * or
 *   npx tsx --env-file=.env ingest/scripts/serve.ts
 *
 * GET /sync -> runs syncInbox() and returns { events: TransactionEvent[] }.
 * Never logs credentials or email content -- only counts, same convention
 * as smoke-test-imap.ts.
 */

import { createServer } from 'node:http';
import { syncInbox } from '../src/imap.js';

const PORT = Number(process.env.EMAIL_SERVER_PORT ?? 4100);

const server = createServer(async (req, res) => {
  if (req.url === '/sync' && req.method === 'GET') {
    try {
      console.log('Sync requested: connecting to Gmail over IMAP...');
      const events = await syncInbox();
      console.log(`Sync complete: ${events.length} transaction event(s).`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ events }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Sync failed:', message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`Email ingest bridge listening on http://localhost:${PORT} (GET /sync)`);
});
