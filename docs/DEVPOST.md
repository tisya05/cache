# Devpost submission copy

## Tagline
A savings game for students where nobody ever sees your money.

## Inspiration
A competitive savings leaderboard is impossible to build honestly. Self-reported
numbers mean everyone lies and the game is worthless within a week. Server-verified
numbers mean everyone uploads their bank account to a startup's database. That's
why no competitive savings app exists at scale — not because nobody wanted one.

Zero-knowledge proofs are the third option, and Midnight is what makes it buildable.

## What it does
Nomi reads your income and spending from your email automatically. At the end of
each period, your phone generates a zero-knowledge proof that you hit your savings
goal — without revealing your income, your spending, your categories, or a single
transaction. A valid proof mints in-game tokens. Tokens build a city. Friends see
your city and a tier badge, and never a dollar figure.

The city is not decoration bolted onto a budgeting app: every building exists
because a valid zero-knowledge proof minted it. The city *is* a rendering of your
proof history.

## How we built it
- **Compact contract** — four circuits: register, updateTotals, proveSavings, build.
  Ledger state is five fields and holds nothing private: commitments, nullifiers,
  tiers, block counts, and a carry-forward savings balance.
- **The savings-rate trick** — savings rate is (income − spend) / income. Division is
  expensive in a ZK circuit, so it's rearranged to
  `(income − spend) * 100 >= tier * 10 * income` — one multiply, one compare, no
  division, no floating point.
- **Anti-cheat** — totals are committed before the leaderboard is visible, so results
  can't be revised after the fact. A nullifier derived from
  `persistentHash([secret, periodId])` blocks double-claims and account farming. A
  carry-forward committed savings balance makes sustained lying break the books.
- **Ingest** — IMAP email parsing with per-sender heuristics that run locally. Only
  genuinely ambiguous memos reach an LLM, with names stripped and amounts bucketed.
  Corrections you make — on a card the pipeline flagged, or later from a full
  transaction log — are remembered and folded back into every downstream view.
- **Mobile-first PWA** — React 19, Vite, Tailwind v4. Installs to an iPhone home
  screen. (The recommended mobile SDK for Midnight is Android-only.)

## Challenges
The Compact compiler's default version targets a newer ledger than Preprod actually
runs. We found the network's support matrix, pinned the toolchain to Compact 0.31.1
/ ledger-8.1.0, and re-verified every proof afterwards. Preprod deployment was then
blocked by the network's ~12-hour DUST registration initialisation, which exceeded
the hackathon window — so contract access sits behind a swappable interface and
deployment is a configuration change.

IMAP also can't run in a browser at all — it needs a raw TCP socket. Rather than
fake the ingest step, we ran the real parser as a tiny local bridge process and
proxied it into the PWA the same way the proof server already was, so "connect your
email" in the app is calling the literal same code that reads a real inbox over IMAP.

## What we learned
Naming your own trust boundary is worth more than overclaiming. Nomi's README
enumerates every point where data leaves the device, and states plainly what the
system does *not* guarantee: within a single period, unsigned self-entered data can
be inflated. The cryptographic closure is DKIM verification inside the circuit, as
ZK Email demonstrates — Compact's standard library doesn't currently expose RSA or
SHA-256, so that's documented as the production path rather than implemented.

## What's next
DKIM-verified email ingest, on-device proving, and a portable savings credential for
people with no credit history.

## Built with
compact · midnight · zero-knowledge-proofs · react · typescript · vite · tailwind ·
pwa · imap · gemini
