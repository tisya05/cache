# Feature status — what's real, what isn't

Honest inventory as of Sat 3:00 PM. Keep this accurate; it feeds the README and
governs what can truthfully be said in the demo video.

---

## A. Fully real — works end to end, independently verified

| Feature | Evidence |
|---|---|
| Compact contract, 4 circuits | `register`, `updateTotals`, `proveSavings`, `build` — compiles clean |
| Compiled against Preprod's actual toolchain | Compact 0.31.1, language 0.23, ledger-8.1.0, runtime 0.16 |
| **Real ZK proof generation** | 4,508-byte SNARK in ~5s from `midnightntwrk/proof-server:8.0.3`; proof bytes begin `midnight:proof-versioned:` |
| **Invalid proofs rejected by the circuit** | Tier-4 claim against Tier-1 data → `failed assert: savings below claimed tier`. Honest Tier-1 on the same totals is accepted, proving the rejection is about the tier, not a broken fixture |
| **Nullifier replay prevention** | Replay rejected even after re-committing fresh, internally-valid totals for the same period. A different period still claims fine |
| Commitment scheme | `persistentCommit`, 4 distinct domain-separation prefixes, no reuse |
| Carry-forward savings balance | Witness opens the previously-stored commitment before a new one is written |
| Savings-rate check without division | `(income − spend) * 100 >= tier * 10 * income` |
| Email parsing heuristics | Per-sender rules, run locally, zero disclosure for known merchants |
| LLM categorization | Gemini Flash, batched 10/call, names stripped, amounts bucketed to $25 brackets |
| Structural consent gate | Throws before any network call if the batch doesn't byte-match the user-previewed payload |
| Graceful degradation | No `GEMINI_API_KEY` → everything routes to review queue, zero fetch calls, no throw |
| Test suite | 111 passing (16 contract + 95 ingest) |

---

## B. Real, but not reachable from the app

| Feature | Status |
|---|---|
| **IMAP email ingest** | Client written (`imapflow`), typechecked, shares one parsing pipeline with the seeded path. **Cannot run in a browser** — IMAP needs raw TCP sockets. Demonstrable via a Node script. Becomes a real app feature only if the local HTTP bridge gets built. |
| Preprod deployment | Contract is deploy-ready and `CacheContractClient` is swappable, but no deploy has happened |

---

## C. Simulated

| Feature | What's simulated | What's real about it |
|---|---|---|
| Transaction data | The transactions themselves are generated | They run through the **real** parser, heuristics, and Gemini categorizer — not pre-labeled fixtures |
| Friends leaderboard | There are no other users; the friends are seeded | The tier/streak display logic is real, and no dollar figure is ever published |
| Streaks and history | No real multi-month history exists | — |
| City contents | Buildings reflect proofs generated in-session | Each building genuinely requires a valid proof |

---

## D. Does not exist

- **On-chain deployment.** Blocked by Preprod's ~12h DUST registration initialization, which hung for 14 hours and never confirmed.
- **Bank connection.** Labeled "Coming soon" in the UI — correct, do not change this.
- **Real multi-user anything.** No accounts, no server, no other people.
- **Face ID.** The Welcome mockup says "Unlocks with Face ID." Unless WebAuthn is actually implemented, **remove that line** — it's a claimed feature on the first screen.
- Push notifications, password reset, account recovery.

---

## Rules for the demo video

**Do not say:**
- "Deployed on Midnight" — it isn't
- "Connects to your bank" — it doesn't
- "My friends" — they're seeded demo accounts

**Can say, truthfully:**
- "My phone generates a real zero-knowledge proof in about five seconds"
- "The contract rejects invalid claims — that's the circuit's own assertion, not my code"
- "Known merchants are categorized on-device and never leave it"
- "There is no dollar figure on this screen — it was never published"

If the ingest bridge doesn't get built, cut the email beat and show the demo data
path instead. A shorter video of working things beats a longer one with a dead screen.
