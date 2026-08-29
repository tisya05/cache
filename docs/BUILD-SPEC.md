# Cache — Build Specification

**Handoff document. Read this fully before writing code.**

Working title: **Cache**. Repo: `github.com/tisya05/cache` (currently **private**).
Event: MLH Midnight Hackathon, Aug 28–30 2026. Solo builder (Tisya), assisted.

---

## 0. Rules of engagement for the implementing agent

1. **Build bottom-up: contract → witnesses → proof round-trip → UI.** Do not build screens
   before a proof verifies. The failure mode that kills this project is a beautiful app
   on Sunday morning with no working zero-knowledge proof.
2. **STOP AND ASK the user** at every point marked `🛑 ASK USER`. Do not guess, do not
   invent placeholder credentials, do not skip the step and continue.
3. **Never handle secrets.** Never ask for, read, echo, or write a seed phrase, mnemonic,
   or Gmail app password. The user places these in `.env` themselves. Read them only via
   `process.env.*`. `.gitignore` already blocks `.env`, `*.seed`, `mnemonic.txt`, `wallet.json`.
4. **Commit after every working increment**, with a real message. Never commit `.env`,
   compiled ZK keys, or `node_modules`.
5. **Consult the installed Midnight plugin skills rather than guessing Compact syntax.**
   `compact-core:compact-language-ref`, `compact-core:compact-patterns`,
   `compact-core:compact-ledger`, `compact-core:compact-privacy-disclosure`,
   `compact-examples:code-examples`. For any error: `/midnight-status-codes:lookup <code>`.
6. **If a gate fails, stop and report.** Do not push a broken layer downstream.

---

## 1. What Cache is

A savings game for students where **nobody ever sees your money** — not your friends,
not the leaderboard, not the server, not the developer.

### The thesis (this is the pitch, lead with it)

A competitive savings leaderboard is impossible to build honestly. You get two options:

1. **Self-reported numbers** — everyone lies, the game is worthless in a week.
2. **Server-verified numbers** — everyone uploads their bank account to a startup's database.

Cache is the third option: prove you hit your savings goal in zero knowledge. Friends see
a **tier badge** and a **city**. They never see a dollar figure, a category, or a merchant.

### The loop

1. Email receipts are ingested automatically and parsed into income/spend events (local only).
2. Ambiguous ones get categorized by an LLM, then confirmed by the user via swipe.
3. Running totals are committed on-chain as a fingerprint — not the numbers.
4. At period close, the phone proves `savings_rate >= tier` without revealing income or spend.
5. A valid proof mints game coins. Coins build a city.
6. The leaderboard ranks tiers. The city *is* a rendering of proof history.

---

## 2. Environment — already done, do not redo

| Component | State |
|---|---|
| Docker Desktop | Running |
| Compact CLI | `0.5.2` at `~/.local/bin/compact` (PATH via `~/.local/bin/env` in `.zshrc`) |
| Compact compiler | `0.34.0` |
| Proof server | `midnightntwrk/proof-server:8.0.3`, container `midnight-proof-server`, healthy on `:6300` |
| Node | `v23.10.0` |
| Git repo | initialized, `main`, remote `origin` → `github.com/tisya05/cache` |
| Plugins enabled | compact-core, compact-examples, core-concepts, midnight-tooling, midnight-dapp-dev, midnight-wallet, midnight-status-codes, midnight-expert |

**Verified working:** a counter contract compiled with full ZK key generation in ~1.5s
(`increment.prover`, `increment.verifier`, `read.prover`, `read.verifier`). The toolchain is green.

**⚠️ Node version risk.** Plugin docs require Node 22+. `v23.10.0` satisfies that numerically
but is non-LTS. If native modules (`node-gyp`, sqlite, wasm) misbehave, run `nvm install 22`
and retry — nvm currently only has `v19.9.0` installed.

**Restart proof server if needed:**
```bash
docker start midnight-proof-server || docker run -d --name midnight-proof-server -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
```

---

## 3. Platform decision — PWA, and why not native

**The user has an iPhone.** Every native path was investigated and rejected:

| Option | Verdict |
|---|---|
| Kuira Labs SDK | **Android only.** Their docs: *"Android only — no iOS, no React Native bridge, no JS interop."* iOS is roadmap, not shipped. |
| `@dedanzi/midnight-mobile-sdk` | Only iOS-claiming option. **2 stars, 8 commits, 0 forks.** README is aspirational, not battle-tested. Delegates ZK proving anyway, so buys no advantage. |
| `react-native-midnight` | Unrelated npm package (subscribes to day changes). Red herring. |

Even a flawless RN SDK would *cost* time: Xcode builds are minutes vs Vite's seconds, free
provisioning certs expire in 7 days, Expo Go can't load native modules, and judges could
never open the app from a link.

**Decision: mobile-first PWA.** The Mobile track explicitly permits *"a mobile app, or
mobile-first PWA."* Installs to the iPhone home screen via Safari → Share → Add to Home Screen.
No Xcode, no Apple Developer account (saves $99/yr), and judges can open it on their own phones.

**Serve over a tunnel for HTTPS** (iOS requires it for service workers). `cloudflared` quick
tunnels give a **new random URL every restart** — fine for the PWA, fatal for OAuth redirect
URIs. This is exactly why §6 uses IMAP, not OAuth.

### Scaffold

Run `/midnight-dapp-dev:init` — the official plugin scaffold. Generates **32 files**:
Vite + React 19 + Tailwind v4 + shadcn, `providers/midnight-providers.tsx` (provider assembly,
the fiddliest part of Midnight frontend work), `wallet-context.tsx`, `use-contract-state.ts`,
`proof-server-status.tsx`, a wired API package, vitest.

**Required adaptation:** the scaffold's wallet path assumes the **Lace browser extension,
which does not exist on iOS Safari.** Split it:
- **Desktop/admin path** (Lace): deploying the contract, funding it. Developer-only.
- **Phone path**: locally-generated identity secret in IndexedDB + a relayer that pays fees
  and submits transactions. The user never installs a wallet on their phone.

Fallback if provider assembly fights you: MeshJS `@meshsdk/midnight-react`.

---

## 4. The contract

### 4.1 Design history — read this, it prevents a wrong turn

The **original** design sealed `(income, goal)` as one fixed number at period start. **This was
rejected by the user and is wrong.** Student income is not fixed — irregular paychecks, gig work,
Venmo rent splits, tutoring cash, aid disbursements. Locking one number forces people to lie on day one.

**Corrected model: income is a stream of events, exactly like spending.** Both totals move all month.

### 4.2 What this costs, and how it's recovered

Being precise, because the README must be:

- **Old claim:** "income was locked before you knew anything."
- **New claim:** "you committed your totals *before you could see the leaderboard*."

Retroactive revision after seeing you lost is still impossible, and the cheat demo still works.
But someone could inflate income on day 29 and commit that. So add a second mechanism:

**Carry-forward savings balance.** Claimed savings enter an on-chain committed balance. Next
period it must still be there or be visibly spent down. You cannot hold fake savings and real
spending simultaneously — the books stop balancing. Double-entry bookkeeping enforced by
cryptography; a lie must be maintained forever or it collapses.

### 4.3 Ledger state (public — the ONLY things the world sees)

```compact
export ledger commitments:    Map<Bytes<32>, Bytes<32>>;  // userId -> current period commitment
export ledger nullifiers:     Set<Bytes<32>>;             // one claim per (user, period)
export ledger tiers:          Map<Bytes<32>, Uint<8>>;    // userId -> achieved tier 0..4
export ledger blocks:         Map<Bytes<32>, Uint<16>>;   // city buildings earned
export ledger savingsBalance: Map<Bytes<32>, Bytes<32>>;  // carry-forward, committed not plain
```

**Nothing else goes on chain.** No income, no spend, no categories, no merchants, no names.

### 4.4 Circuits

| Circuit | Purpose |
|---|---|
| `register()` | Create identity commitment from local secret |
| `updateTotals(commitment)` | Called many times during a period as totals change. Overwrites the user's commitment. |
| `proveSavings(tier)` | The whole game. Opens the final commitment, asserts the tier, burns a nullifier, mints blocks. |
| `build(kind)` | Spend earned blocks on a city building |

### 4.5 The savings-rate trick — keep this, it is the technical highlight

Savings rate is `(income - spend) / income`. Division is expensive and awkward in a ZK circuit.
Rearranged, it needs only multiplication:

```compact
// tier k requires saving at least k*10 percent
assert((income - spend) * 100 >= (tier * 10) * income,
       "savings below claimed tier");
```

One multiply, one compare. No division, no floating point. Call this out in the README — it is
a specific, defensible choice a judge scoring *Technology* can point at.

### 4.6 Verified Compact syntax notes

From the installed plugin references. **Do not deviate without checking the skill.**

```compact
pragma language_version >= 0.22;
import CompactStandardLibrary;
```

- **Domain-separated hashing:** `persistentHash<Vector<2, Bytes<32>>>([pad(32, "cache:nul:"), sk])`
  Use a DIFFERENT domain prefix for each purpose (`cache:pk:`, `cache:nul:`, `cache:commit:`).
  Reusing one prefix across purposes is a real vulnerability.
- **Commitment:** `persistentHash<Vector<2, Bytes<32>>>([valueBytes, salt])`
- **Field → bytes:** `const valueBytes = value as Bytes<32>;`
- **Map:** `.insert(k, v)`, `.lookup(k)`, `.member(k)`
- **Set:** `.insert(x)`, `.member(x)`
- **Counter:** `.increment(n)`, `.decrement(n)`, `.read()`
- **Assertions:** `assert(cond, "message")` — **assert messages are public**, never interpolate private data into them.
- **`disclose()`** is required wherever a witness value flows to ledger state or a public output.
  If you hit *"potential witness-value disclosure must be declared"*, that is what it means.
  Use `compact-core:compact-privacy-disclosure` — do not sprinkle `disclose()` to silence the compiler.
- **Witnesses in TypeScript return a tuple:** `[updatedPrivateState, returnValue]`.

### 4.7 Compile

```bash
# fast iteration, no ZK keys
compact compile -- --skip-zk src/cache.compact src/managed/cache
# full, with prover/verifier keys
compact compile src/cache.compact src/managed/cache
```
Flags go after `--`, before file paths.

---

## 5. Trust boundary — state this honestly, do not overclaim

**The single most important README section.** Judges reward precision here and tear apart vagueness.

### What Cache genuinely guarantees
- Your income, spending, categories, and merchants are never transmitted or stored anywhere but your device.
- The chain stores only a tier, a nullifier, and opaque commitments.
- You cannot revise your numbers after seeing the leaderboard.
- You cannot claim the same period twice, or farm multiple accounts (nullifier).
- Sustained lying breaks the carry-forward balance.

### What it does NOT guarantee
- **Within a single period, unsigned self-entered data can be inflated.** Automated email
  ingest raises the effort bar; it is **not** a cryptographic guarantee. The chain never sees
  your email — it sees a number the client submitted, and a determined user can change what
  the client submits.

### The closure, and why it isn't built
**DKIM.** Every email from Venmo, Amazon, or a bank is cryptographically signed by the sending
domain. [ZK Email](https://docs.zk.email/architecture/dkim-verification) proves in zero knowledge
that a validly-signed email exists containing a given amount, without revealing the email.

**Compact's standard library exposes `persistentHash`, `transientHash`, commitments, Merkle paths,
and elliptic-curve operations. It has no RSA, no big-integer modular exponentiation, and no SHA-256.**
DKIM requires RSA-2048 verification plus SHA-256 over the email body. This is documented as the
production path rather than implemented.

Naming the exact missing primitive reads as engineering maturity. Hand-waving reads as a gap.

---

## 6. Automated ingest — MANDATORY, at least one automated path must ship

The user explicitly requires **at least one working automated input**. Manual-entry-only is not
an acceptable outcome.

### 6.1 Use IMAP, NOT OAuth

**Google OAuth is a deadline trap.** Redirect URIs must be pre-registered, and `cloudflared`
quick tunnels hand out a new random URL every restart, so auth breaks constantly. Gmail
`readonly` is also a *restricted* scope.

**IMAP with a Gmail app password**: no consent screen, no Cloud project, no redirect URIs,
no verification review. ~2–3h instead of 5+, with far fewer landmines.

### 6.2 Privacy architecture — non-negotiable

**Ingest runs locally. Email bodies never touch the relayer or any server.** Keep ingest and
relayer as **separate components** so this is true by construction, not by promise. Only
aggregate commitments ever leave the device.

### 6.3 Implementation

- Connect over IMAP, query for known transactional senders (Venmo, Zelle, PayPal, Amazon,
  DoorDash, Uber, Starbucks, bank alerts).
- Parse with per-sender heuristics first (cheap, local, no disclosure).
- Fall back to LLM extraction for unrecognized formats (§7).
- Produce events: `{ type: income | spend, amount, merchant, memo, category, confidence, timestamp }`.

```
🛑 ASK USER: Gmail app password.
   Requires 2FA enabled on their Google account.
   They create it and place it in `.env` themselves as GMAIL_APP_PASSWORD and GMAIL_USER.
   NEVER ask them to paste it in chat. NEVER read or echo the value.
   Provide `.env.example` with the key names only.
```

### 6.4 Seeded fallback — build this regardless

A realistic seeded student month **must** exist. The user's real inbox may be thin on receipts,
and that cannot be discovered on camera Sunday morning. The demo video should be able to run
entirely on seeded data if needed.

### 6.5 Reconciliation (nice-to-have, user's idea, reframed)

Local statement check: *"Your tracked balance is $47 off — looks like a missing transaction."*
This is an **accuracy feature, not an anti-cheat** (a cheater simply doesn't upload). Runs
entirely locally, sends nothing anywhere. Do not market it as enforcement.

---

## 7. LLM categorization + swipe confirmation

Venmo and Zelle memos are natural language — *"Steph 🍕🍺 rent split lol"* is not rule-parseable.

### Design
1. **Heuristics first.** Known merchants categorize locally with no disclosure at all.
2. **LLM for the rest.** Returns `{ category, confidence }`.
3. **Confidence threshold.** High-confidence auto-applies. Only genuinely ambiguous transactions
   enter the review queue. Without this the user swipes 40 cards on boot and the feature becomes a chore.
4. **Swipe review on app boot** — Tinder-style. Right = correct, left = wrong. Wrong opens a
   category picker with an option to create a new one.
5. **New categories must be tagged `needs | wants | savings`** — otherwise they float free of the
   50/30/20 goal engine and the math breaks.

### Disclosure preview — build this, it is thematically load-bearing
Before any LLM call, show **exactly what is being sent**: memo text and amount, **names stripped**,
never the full email, never identity, never the running totals. A privacy app that treats its own
AI call as a disclosure event — and shows the payload — is the detail that separates a real privacy
product from one that just says the word. It is also honest.

### AI track
This is what legitimately qualifies Cache for the **AI track**: the model acts on private financial
data and Midnight proves the rules were followed — close to the track brief verbatim. Human-in-the-loop
confirmation makes it a defensible design, not "we called an LLM."

**Categories never touch the chain.** Only the tier does.

---

## 8. Disclosure ledger — REQUIRED README TABLE

The user explicitly asked that every point where data leaves the device be flagged. Reproduce
this table in the README and keep it accurate as the code changes.

| # | Boundary | What crosses it | Mitigation |
|---|---|---|---|
| 1 | Device → LLM API | Memo text + amount, for ambiguous transactions only | Names stripped; heuristics handle known merchants with zero disclosure; user sees exact payload first; opt-in |
| 2 | Device → proof server | Witness: income total, spend total, salt | Self-hosted on `localhost:6300`. Midnight's normal model is a proof server you control. Production path is on-device proving — Kuira already does this on Android, so it is proven viable |
| 3 | Device → relayer | Signed transaction containing tier only | Relayer pays fees; sees no private values |
| 4 | Relayer → chain | Tier, nullifier, commitment, block count | Public by design. Opaque commitments reveal nothing |
| 5 | IMAP → device | Email bodies | **Local only.** Never leaves the device, never reaches the relayer |

**Never leaves the device under any circumstance:** raw transactions, per-category totals,
income figures, merchant names, email bodies, the identity secret.

---

## 9. Screens

Bottom tab bar: **City · Insights · Friends · Profile**. Must read as a native iOS app, not a
website in a phone frame.

| # | Screen | Contents |
|---|---|---|
| 01 | **Welcome** | The impossibility line as hero. "Create your identity" silently generates the local secret. No wallet, no seed phrase, no jargon. Face ID gate to unlock. |
| 02 | **Goals** | Monthly income *estimate* (editable any time — income is a stream, not a fixed value). 50/30/20 preset, adjustable. Target amount + deadline → required monthly saving. |
| 03 | **Connect** | Email connect (the live automated path). Manual add. Demo data. Anything not implemented is labeled **Coming soon** — do not fake integrations, judges notice. |
| 04 | **City** | Home tab. Isometric city built from earned blocks. Coin balance, streak, period progress ring, "Seal this month" CTA. |
| 05 | **Prove** | **Centerpiece.** Two columns: what stays private vs what goes public. Live proof generation with real timing. Tier revealed, coins minted, tx hash shown. |
| 06 | **Insights** | Private analytics, rendered only from local data. Category breakdown, trend, needs/wants/savings vs goal. Lock badge on every panel. |
| 07 | **Friends** | Leaderboard by tier then streak. **Tier badges only — no dollar figures anywhere.** Tap through to a city. |
| 08 | **Friend city** | Read-only. Their city, tier, streak. Nudge button. Explicit "what you cannot see" panel. |
| 09 | **Review queue** | The swipe categorization flow (§7). Surfaces on boot when ambiguous transactions exist. |
| 10 | **Proof log** | Every proof generated, with tx hashes, linking to the block explorer. Cheat Mode toggle lives here. |

### Cheat Mode — build this, it wins the demo
A toggle that tampers with committed values before proving. On camera: tamper, hit prove, the
contract **rejects it**. Ten seconds, no narration needed, proves the cryptography is load-bearing.

---

## 10. Build order and gates

**~30 hours remain. Initial submission Sunday 10:00 ET, final 11:45 ET.**

| Phase | Work | Gate |
|---|---|---|
| **A** | Scaffold via `/midnight-dapp-dev:init`. Contract v1, all four circuits. Compile with ZK keys. | Contract compiles, keys generated |
| **B** | TS witnesses. Local proof round-trip. Nullifier replay rejection. | **A deliberately wrong proof is rejected** |
| **C** | Deploy to testnet. Relayer submits a real transaction. | A real tx hash exists |
| **D** | IMAP ingest + parser + seeded month + LLM categorization + swipe queue | Real transactions appear from a real inbox |
| **E** | All screens, user's theme, PWA manifest, tunnel | Full click-through on the actual iPhone |
| **F** | README (incl. §8 table), demo video, repo public, Devpost | **Submitted by 10:00 ET** |

### Cut list, in this order
Friend city visits → insights charts → city building variety → reconciliation → LLM fallback
(keep heuristics).

**Never cut:** the Prove screen, the cheat rejection, the disclosure table, or automated ingest.
A submission with two screens and working proofs beats nine screens over a mock.

---

## 11. Known traps

1. **`cd` in Bash tool calls resets between invocations.** Use absolute paths or `(cd X && ...)`.
2. **Compile flags go after `--`**: `compact compile -- --skip-zk src/x.compact out/`.
3. **`disclose()` errors** mean a witness value reached public state. Understand the flow; don't
   sprinkle `disclose()` to silence the compiler.
4. **Domain separation.** Different `pad(32, "...")` prefix per hash purpose. Reuse is a real vulnerability.
5. **Assert messages are public.** Never interpolate private values into them.
6. **Node 23 is non-LTS.** If native modules break, `nvm install 22`.
7. **Cloudflare quick tunnel URLs change every restart.** Never hard-code one.
8. **iOS Safari has no Lace.** Do not wire the phone UI to a browser wallet.
9. **Proof server must be running** before any proof attempt. Check `docker ps`.
10. **Do not commit** `.env`, ZK keys, or `node_modules`.

---

## 12. 🛑 Points where you MUST stop and ask the user

| Trigger | Ask for | Why |
|---|---|---|
| Before deploying to testnet | **Lace wallet address** (`mn_...`), plus confirmation they have tNIGHT and registered DUST | Cannot deploy without a funded wallet. **Never ask for the seed phrase.** |
| Before building email ingest | **Gmail app password placed in `.env` by them** (needs 2FA on) | Credential — they enter it, you never see it |
| Before styling any screen | **UI theme, colors, reference images** | The user is researching this; do not invent a theme and force a rewrite |
| Before the LLM step | **Which model/API and the key in `.env`** | Credential + cost decision |
| Anything ambiguous in this spec | Ask | Rework costs more than a question |

**Also remind the user, unprompted, near the end:**
- 🚨 **Flip the repo public before submission** — `gh repo edit tisya05/cache --visibility public`.
  It is private now. Forgetting this **disqualifies the submission**.
- Devpost + MLH registration must use the **same email**.
- Demo video must **state the hackathon name at the start** and be under 2 minutes.
- Repo and video must **stay public after the event** to remain prize-eligible.

---

## 13. README requirements (scored — "Documentation" is a judging criterion)

Must include:
1. The thesis (§1) — lead with the impossibility, not with budgeting.
2. Architecture diagram + what runs where.
3. **The disclosure ledger table (§8), verbatim.**
4. **The trust boundary section (§5), including the DKIM/ZK Email closure and the specific
   missing Compact primitives.**
5. The savings-rate multiplication trick (§4.5).
6. Named canonical patterns: **nullifier**, **commitment**, **Merkle membership**. Past winner
   NulliVote led with "Midnight's Zero-Knowledge Nullifier pattern" — judges reward naming them.
7. A hard business number up front. Past winner MedProof opened with "$69B market."
8. Setup instructions someone can actually follow.

### Business framing

**What Cache actually is: a money tracker and savings game for students.** Do not describe it
as anything else. It tracks income and spending, proves savings goals in zero knowledge, and
turns that into a city-building game with a friends leaderboard. That is the whole product.

**Primary pitch — the consumer business, which is real and has named comparables.**
Greenlight charges $5.99–14.98/month for teen money apps and has millions of subscribers;
Step, Current, and Chime pay enormous acquisition costs for young users. A game that acquires
them organically is worth real money. Financial habits formed before graduation persist, and
the existing category proves people pay for this.

**Secondary — one sentence of upside, clearly labeled as future direction, never as a feature:**
because savings claims here are cryptographically proven rather than self-reported, they are
portable verifiable claims, which over time could serve as a savings-discipline signal for
people with thin credit files.

⚠️ **Do not describe Cache as a credential product, an underwriting tool, or a savings account.**
It is none of those. An earlier draft of this spec overreached here. If a judge asks "can I get
a credit line with this?" the answer is no, and overclaiming in the pitch undermines the
carefully honest trust-boundary section that is one of this project's real strengths.

---

## 14. Demo video — 2 minutes, six beats

Opens with the required line, then the hook:

> "Hey, I'm Tisya, and this is my demo for the Midnight Hackathon. A savings leaderboard
> shouldn't be possible. Either everyone lies about their numbers, or everyone uploads their
> bank account to a stranger's server."

| Time | Beat |
|---|---|
| 0:00 | **Hook** — the line above, over the app icon on the iPhone home screen |
| 0:18 | **Ingest** — email transactions appear automatically; swipe-categorize an ambiguous Venmo memo |
| 0:38 | **Prove** — private vs public columns, proof generates, tier lands, coins mint, city grows |
| 1:10 | **Social** — leaderboard shows tiers; open Insights to show everything friends cannot see |
| 1:32 | **Cheat** — tamper, prove, rejected. Silent. Let it speak. |
| 1:45 | **Value** — the credential pitch, not the budgeting pitch |

---

## 15. Judging criteria → where points come from

| Criterion | Strategy |
|---|---|
| **Originality** | Strongest axis. No consumer app, no game, no mobile-first app has ever won a Midnight event — every past winner was institutional (clinical trials, voting, KYC, genomics, whistleblowing). |
| **Execution** | Past 1st place (EDDA) won explicitly on polish and a functional demo. UI is the edge. |
| **Documentation** | Explicit criterion most teams ignore. §13 is near-free points. |
| **Business Value** | Purely a writing problem. Use the credential framing. |
| **Technology** | Nullifier + commitment + range assertion are canonical, not novel — but NulliVote won on canonical nullifiers alone. The multiplication trick and carry-forward balance are the differentiators. |
| **Completion** | The real risk. Cut aggressively per §10 rather than shipping something half-wired. |

**Tracks to tag:** Mobile (primary — thinnest competition), AI (secondary, via §7),
Best Beginner Hack if the user qualifies as a first-time hacker.
