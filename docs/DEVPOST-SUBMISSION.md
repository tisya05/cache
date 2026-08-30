# Devpost — paste-ready

**Project name:** Nomi
**Elevator pitch:** A savings game where you prove your progress without revealing your finances.
**Track:** Mobile
**Try it out:** https://github.com/tisya05/nomi

---

## At a glance

**Save. Prove. Build. Compete.**

1. Connect your email and set a savings goal.
2. Transactions are categorised on your device — only genuinely ambiguous ones take the constrained LLM path, with names stripped and amounts bucketed.
3. Close the period and your phone generates a zero-knowledge proof of your savings rate.
4. Your tier becomes public. Your financial data does not.
5. Earn Noms, build your city, compete with friends.

## Inspiration

A competitive savings app forces a choice. Either progress is self-reported, in
which case it isn't verifiable — or you hand over your bank account and let an app
watch every transaction. That's why no trustworthy version exists. Not because
nobody wanted one, but because the trust model has no third option.

The people who'd benefit most have the least to point at. If you're a teenager, a
student, or you've just moved countries, there is almost no portable evidence of
how you actually handle money. The products that try to fix this build your record
by reporting everything you do to a bureau. You buy standing with disclosure.

We asked: what if financial standing were a cryptographic claim instead of a
surveillance byproduct? What if a leaderboard could rank you honestly while
learning nothing about you?

## What it does

Nomi is a savings game. Transactions arrive from email and are categorised on the
device. At period close, the phone generates a zero-knowledge proof that you hit
your savings goal — without revealing income, spending, categories, merchants, or a
single transaction. A valid proof mints Noms, which you spend building an isometric
city you place tile by tile. Friends see a tier badge and a streak.

**No dollar figure appears anywhere on the social surface.** Not hidden, not
blurred, not access-controlled. It was never published.

The tier is the product. It's a portable record of financial behaviour that can be
proven and never has to be explained.

## How we built it

### Contract — four Compact circuits

`register`, `updateTotals`, `proveSavings`, `build`. Compiled with Compact **0.31.1**,
language **0.23**, targeting **ledger-8.1.0** and `compact-runtime` **0.16**. All four
produce prover and verifier keys.

The public ledger is five fields, none of them private:

```compact
export ledger commitments:    Map<Bytes<32>, Bytes<32>>;  // user -> sealed period
export ledger nullifiers:     Set<Bytes<32>>;             // one claim per period
export ledger tiers:          Map<Bytes<32>, Uint<8>>;    // achieved tier 0..4
export ledger blocks:         Map<Bytes<32>, Uint<16>>;   // city buildings earned
export ledger savingsBalance: Map<Bytes<32>, Bytes<32>>;  // carry-forward, committed
```

### The savings-rate trick

Savings rate is `(income − spend) / income`. Division is expensive and awkward
inside a ZK circuit, so it's rearranged to use multiplication only:

$$\frac{income - spend}{income} \ge \frac{10k}{100} \iff (income - spend)\cdot 100 \ge 10k \cdot income$$

```compact
assert((income - spend) * 100 >= (tier * 10) * income,
       "savings below claimed tier");
```

One multiply, one compare. No division, no fixed-point, no floating point.

### Three anti-cheat mechanisms

**Commitment before disclosure.** Totals are sealed with `persistentCommit` before
the leaderboard opens, so a result can't be revised after seeing where you rank.
`persistentCommit` rather than `persistentHash` matters here: monthly incomes are a
small, brute-forceable plaintext space, and the salted commitment also clears
witness taint so no `disclose()` is needed on income-derived values.

**Nullifiers.** Derived as `persistentHash([pad(32,"cache:nul:"), sk, periodId])`.
A replay is rejected *even after re-committing fresh, internally valid totals for the
same period* — the nullifier is per-period, not a lockout.

**Carry-forward balance.** Claimed savings enter an on-chain committed balance the
witness must open before writing a new one. Fake savings must be carried forever or
the books stop balancing.

Four distinct domain-separation prefixes, no reuse: `cache:pk:`, `cache:nul:`,
`cache:commit:`, `cache:bal:`.

### Data flow, and what gets stripped

```
IMAP inbox ──► parser ──► per-sender heuristics ──┬──► categorised locally (ZERO disclosure)
                                                   │
                                    ambiguous only ├──► strip names ──► bucket amount
                                                   │         │
                                                   │    consent preview ──► user approves
                                                   │         │
                                                   │    structural gate (throws on mismatch)
                                                   │         ▼
                                                   └──► Gemini Flash, batched 10/call
                                                             │
                        totals ──► witness ──► proof server ──► SNARK ──► ledger (tier only)
```

Only `venmo` and `zelle` carry `llmFallbackEligible: true`. Amazon, Starbucks,
Uber, DoorDash, Target and bank alerts are structurally excluded from the LLM path
— not by policy, by type.

The payload is exactly `{ memo, amountBucket }`. Names are stripped with a
capitalised-sequence regex against a brand allowlist, so "Uber Eats" survives and
"Steph Lee" doesn't. Amounts bucket to $25 brackets — never the exact figure. No
merchant, no timestamp, no id, no identity.

`categorizeBatchWithLLM` **throws before any network call** if the batch it receives
doesn't byte-for-byte match what the consent preview built. That's a structural
gate, not a comment.

Without `GEMINI_API_KEY` the pipeline degrades cleanly: everything routes to the
review queue, zero fetch calls, no throw.

### Client

Mobile-first PWA — React 19, Vite, Tailwind v4, installs to an iPhone home screen.
The recommended Midnight mobile SDK is Android-only, so a PWA was the only route to
a real iOS demo. Isometric city rendered from a 282×172 diamond footprint:
`screenX = (col−row)·141`, `screenY = (col+row)·86`, z-ordered by `col+row`.

Local devnet via Docker: `midnight-node` 0.22.5, `indexer-standalone` 4.2.1,
`proof-server` 8.1.0.

## Challenges we ran into

**The compiler targets a newer ledger than the network runs.** Compact 0.34.0 builds
against ledger-9; Preprod runs ledger-8.1.0. Nothing surfaces this until a deploy
fails. We found the network's `support-matrix.json`, pinned to 0.31.1 / language
0.23, and re-ran the entire proof suite to confirm nothing broke. Only the `pragma`
line and two renamed runtime functions differed.

**DUST registration never completed.** Preprod requires registering NIGHT for DUST
generation with a ~12-hour initialisation. Ours hung in "Sending" for fourteen hours
and never confirmed — `0 / 0 tDUST`, meaning zero NIGHT registered. We stood up a
local Midnight devnet instead, which is the organisers' recommended path and has no
faucet wait. All 17 contract tests pass against it.

**IMAP can't run in a browser.** It needs raw TCP sockets. The ingest pipeline runs
as a local process behind an HTTP bridge rather than in the page.

**`localhost` means the phone.** The proof server URL was hardcoded to
`localhost:6300`, which on a phone resolves to the phone's own loopback. Every proof
would have silently failed on a real device while working perfectly on the laptop.
Fixed with a dev-server proxy and an origin-relative URL.

**A corrupted localStorage key blanked the app.** `JSON.parse` threw during initial
render with no error boundary, so React unmounted to a white screen with nothing to
diagnose. Added a root error boundary that renders the real error plus a reset
action, and a `readJSON()` helper wrapping all nine read sites so a bad key is
dropped and cleared instead of crashing.

## Accomplishments that we're proud of

**Real proofs.** A 4,508-byte SNARK, generated in seconds against a real Midnight
proof server. Proof bytes begin `midnight:proof-versioned:`.

**Invalid claims are rejected by the circuit's own assertion, not application code.**
The test suite pairs every rejection with an honest claim on the *same committed
totals*:

```
REJECTED with           : failed assert: savings below claimed tier
honest tier 1 on same totals: ACCEPTED (tier = 1, blocks = 2)

first claim             : ACCEPTED (tier = 4, blocks = 5)
replay (identical)      : REJECTED with: failed assert: period already claimed
replay (fresh totals)   : REJECTED with: failed assert: period already claimed

[tier out of range]     failed assert: tier out of range
[commitment mismatch]   failed assert: commitment does not match local totals
[sentinel commitment]   failed assert: totals do not match committed fingerprint
```

That pairing is the point — it shows the rejection is about the tier, not a broken
fixture.

**17 contract tests, 95 ingest tests**, all green against a local Midnight devnet.

**A README that enumerates every boundary where data crosses** — including the one
where our own LLM call is a disclosure event, on a free tier where the provider may
train on inputs. We'd rather state that than let a judge find it.

## What we learned

You cannot generate a proof of a false statement. The assertion fires during local
circuit execution, before proof data exists — the proof server is never even
contacted. The rejection isn't a check that runs and fails. There is simply nothing
to prove.

Naming your own trust boundary is worth more than overclaiming. Nomi's README says
plainly what the system does **not** guarantee: within a single period, unsigned
self-entered data can be inflated. Automated ingest raises the effort bar; it isn't
a cryptographic guarantee. The chain never sees your email — it sees a number the
client submitted.

The closure is **DKIM**. Every email from a bank is signed by the sending domain,
and ZK Email demonstrates proving that in zero knowledge. Compact's standard library
exposes hashing, commitments, Merkle paths and curve operations — but no RSA, no
big-integer modular exponentiation and no SHA-256, which DKIM requires. Documented
as the production path rather than implemented.

## Business value

**More than 80% of 18–19 year olds in the US are credit invisible or unscorable**
(CFPB). It drops under 40% by ages 20–24, and 25.3 million adults were unscored as
of 2020. That's not an edge case — it's the default state of being young, and it's
the exact window Nomi is built for.

The consequences are ordinary and expensive: no first apartment without a
co-signer, no phone contract, worse rates on everything, or a secured card that
requires money you don't have yet. And the racial skew is stark — roughly 15% of
Black and Hispanic consumers are credit invisible against 9% of white consumers.

Two markets sit on top of that gap.

**The consumer layer already prices itself.** Greenlight runs $5.99 to $19.98 a
month; Step and Current are free because the product is the data relationship.
Every one works the same way — you earn standing by being watched. Step will even
build genuine credit history for under-18s, by reporting everything you do to a
bureau.

**That's the trade Nomi breaks. Standing without disclosure.**

**The institutional layer is where it scales.** Banks want customers early — the
lifetime value of acquiring someone at 18 is enormous — but they cannot underwrite
a file that doesn't exist. Their current options are a parent's co-signature, a
secured card, or nothing. A tier is a signal about financial behaviour they can
verify without taking custody of the data that produced it: no PII in their
systems, no breach surface, no data-sharing agreement to negotiate. That opens
starter credit lines, first cards, and student products to people who currently
can't be assessed at all.

**And it crosses borders.** Someone who moves countries can leave most of their
credit history behind and start again — creditworthy in one jurisdiction, close to
invisible in the next. Companies like Nova Credit exist precisely because this
problem is real and worth paying to solve; they solve it by moving your bureau file
between institutions. A tier carries no income, no balances, no merchant history
and nothing to leak, so it moves without any of that machinery.

**To be precise about what exists today:** Nomi is a savings game. The tier is a
proven, portable claim, and the credential and underwriting uses are the direction
that follows from it — not something shipped this weekend.

## What's next for Nomi

DKIM-verified ingest, so the proof rests on a signed bank email rather than a number
the client submits. On-device proving. Friend-group challenges. And the tier as a
portable credential — provable financial standing for people who don't have a credit
score yet, or who left theirs behind in another country.

---

## Built with

compact · midnight-network · zero-knowledge-proofs · zk-snarks · react · typescript ·
vite · tailwind · pwa · imap · imapflow · gemini · docker · node.js · vitest ·
recharts · motion
