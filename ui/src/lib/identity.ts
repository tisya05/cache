/**
 * The user's local identity secret. Generated silently the first time
 * "Create your identity" is tapped, then persisted in this browser only —
 * never transmitted, never shown, no seed phrase UI. Losing it means losing
 * the identity; that's an accepted tradeoff for a hackathon demo (a real
 * deployment would want an export/backup flow, out of scope here).
 */

const STORAGE_KEY = "cache:identity-secret:v1";

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

export function loadIdentitySecret(): Uint8Array | null {
  const hex = localStorage.getItem(STORAGE_KEY);
  return hex ? fromHex(hex) : null;
}

export function hasIdentity(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Generates a fresh secret and persists it. Idempotent-unsafe by design — call only from "Create your identity". */
export function createIdentitySecret(): Uint8Array {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(STORAGE_KEY, toHex(secret));
  return secret;
}

/** For Cheat Mode / dev only: wipes the local identity so the app resets to Welcome. */
export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
