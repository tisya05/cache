#!/usr/bin/env node
// Copies the compiled contract's ZK artifacts (keys + zkir) into ui/public so
// the browser's FetchZkConfigProvider can fetch them as static assets. Rerun
// this after every `npm run compile` in contract/ (keys/zkir are gitignored,
// so this is a build-time step, not a one-time copy).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "..", "contract", "src", "managed", "cache");
const DEST = path.resolve(HERE, "..", "public", "managed", "cache");

if (!existsSync(path.join(SRC, "keys"))) {
  console.error(
    `No compiled keys found at ${path.join(SRC, "keys")}. Run "npm run compile --workspace=contract" first.`,
  );
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(path.join(SRC, "keys"), path.join(DEST, "keys"), { recursive: true });
cpSync(path.join(SRC, "zkir"), path.join(DEST, "zkir"), { recursive: true });

console.log(`Copied contract ZK artifacts to ${DEST}`);
