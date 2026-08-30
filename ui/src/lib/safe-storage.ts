/**
 * A corrupted localStorage value (partial write from a crash/reload mid-save,
 * a schema change, manual tampering) used to throw straight out of a render
 * function on JSON.parse, which React has no boundary for by default --
 * the whole tree unmounts to a blank white screen with nothing on screen to
 * diagnose it. Every JSON-backed read in this app goes through here instead:
 * a bad value is dropped and the key cleared rather than crashing.
 */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}
