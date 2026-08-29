#!/usr/bin/env -S node --experimental-strip-types
/**
 * One-off generator: runs the seeded month through the REAL ingest pipeline
 * (heuristics + batched Gemini fallback, if GEMINI_API_KEY is set) and writes
 * the result — already partitioned into auto-applied vs needs-review — as
 * static JSON the UI bundles for its "Use demo data" path and for exercising
 * the review queue / insights screens without a live inbox.
 *
 * Rerun this whenever seed.ts changes, or to regenerate with/without a live
 * Gemini key. The output is checked in (small, deterministic-ish JSON) so the
 * UI has something to render even without ever running this script.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateSeedMonth } from "../src/seed.js";
import { partitionByConfidence } from "../src/review-queue.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "ui", "src", "data", "seeded-month.json");

async function main() {
  const events = await generateSeedMonth(42, { decide: () => true });
  const { autoApplied, needsReview } = partitionByConfidence(events);

  const payload = {
    generatedAt: new Date().toISOString(),
    geminiUsed: Boolean(process.env.GEMINI_API_KEY),
    events,
    autoAppliedIds: autoApplied.map((e) => e.id),
    needsReviewIds: needsReview.map((e) => e.id),
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${events.length} events (${needsReview.length} needing review) to ${OUT}`);
  console.log(`Gemini used: ${payload.geminiUsed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
