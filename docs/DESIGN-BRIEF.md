# Cache — Design Brief

Brief for mockups. Everything below is settled; palette and typography are open.

---

## What it is

**Cache** — a savings game for students where nobody ever sees your money.

You connect your email. It finds your income and spending automatically. At the end of
each month your phone generates a cryptographic proof that you hit your savings goal —
without revealing your income, your spending, or a single transaction. That proof mints
coins. Coins build a city. Your friends see your city and a tier badge. They never see
a dollar figure.

**The tension the design must hold:** rigorous privacy engineering underneath, a game on
top. It should feel like something a 20-year-old opens for fun, not a fintech dashboard
and not a crypto wallet. But the moments where cryptography is doing work should feel
substantial, not hand-waved.

**Audience:** university and high-school students. Broke, social, competitive, phone-first.
Most have never used a blockchain app and never should have to know they are.

---

## Platform constraints

- **iPhone, portrait, ~390 × 844.** Mobile-first PWA installed to the home screen.
- Must read as a **native iOS app**, not a website in a phone frame. Respect safe areas,
  thumb-reachable primary actions, iOS-native motion feel.
- **Bottom tab bar, 4 tabs:** City · Insights · Friends · Profile
- Both **light and dark** themes.
- No wallet UI, no seed phrases, no addresses, no blockchain jargon anywhere in the
  interface. The word "blockchain" should not appear.

---

## Rules that must hold visually

1. **No dollar figures on any social screen, ever.** Friends and Friend City show tier
   badges and streaks only. This is the product thesis rendered as a layout rule.
2. **Private screens are visibly marked private.** Insights carries a lock affordance on
   every panel. The user should feel the boundary, not read about it.
3. **Tiers are the social currency.** Tier 0–4 (10/20/30/40% saved). Design them as
   something worth showing off — this is what replaces the dollar amount socially.
4. **The city is earned, never bought.** Buildings exist only because a proof minted them.
   Nothing in the UI should imply purchase.
5. **Growth only, never decay.** The city never crumbles when someone overspends. Earned
   stays earned. Punishing broke students is both bad product and bad optics.

---

## Screens

### 1. Welcome
**Job:** state the thesis and get out of the way.

- Hero line: *"A savings leaderboard shouldn't be possible."* Subline explains: either
  everyone lies, or everyone hands their bank account to a stranger.
- One primary button: **Create your identity**
- No wallet prompt, no sign-up form, no email/password
- Return state: Face ID unlock

---

### 2. Goals
**Job:** capture the target. **Does not ask for income** — that is ingested automatically.

- Goal type selector, two modes:
  - *"Save 30% of whatever I earn"* — a rate. Big, prominent, the default.
  - *"Save $2,000 by December"* — an amount and a date.
- Needs / Wants / Savings split — 50/30/20 default, adjustable. A three-segment control
  or draggable bar. This governs how spending categories are grouped, not income.
- Optional, clearly skippable: *"Roughly what do you expect to earn?"* — used only to
  project pace in week one, before ingest has history.

---

### 3. Connect
**Job:** turn on automatic tracking.

- **Email** (primary, live) — connect flow, then a scanning state, then a result:
  *"Found 34 transactions from the last 30 days."*
- **Add manually** (secondary) — quick-entry form
- **Use demo data** (tertiary)
- Anything unbuilt is explicitly labeled **Coming soon**. Never mock a working integration.

---

### 4. City — *home tab, hero screen*
**Job:** the payoff. This is what people open the app to see.

- An **isometric city** built from earned blocks. ~6 building types. Should feel alive and
  worth returning to. This is the most art-directed surface in the app.
- Coin balance
- Current streak (consecutive months hitting goal)
- Progress ring for the running period — *"18 days in, tracking at 34%"*
- Primary CTA: **Seal this month**
- Empty state matters: a first-time city with one small building should still feel like a
  beginning, not a failure.

---

### 5. Prove — *hero screen, the centerpiece*
**Job:** make the cryptography visible and legible in four seconds.

The demo video is built around this screen. It needs four distinct states:

- **Idle / pre-proof:** two columns side by side —
  - **Stays private:** income, every transaction, categories, merchants
  - **Goes public:** a single tier number
  - The asymmetry between the two columns is the whole argument. Make it visual.
- **Generating:** live proof generation, ~5 seconds (measured, real). Should feel like
  something substantial is happening, not a generic spinner.
- **Success:** tier revealed, coins minted, city grows. The biggest celebratory moment
  in the app.
- **Rejected:** the proof fails when data doesn't support the claim. Firm and clear, not
  punishing — this is a security guarantee working correctly, not the user failing.

---

### 6. Friends
**Job:** competition without disclosure.

- Leaderboard ranked by tier, then streak
- Each row: avatar, name, **tier badge**, streak — and **no dollar amount anywhere**
- Tap a row to visit that person's city
- Should feel social and light, closer to a game leaderboard than a finance app

---

### 7. Insights — *private*
**Job:** the detail only you ever see.

- Category breakdown
- Spending trend over time
- Needs / Wants / Savings actual vs. goal
- **A lock affordance on every panel** — persistent reinforcement that this view exists
  nowhere but this device
- This is the one screen where denser, more data-forward design is right

---

### 8. Review queue
**Job:** confirm transactions the AI wasn't sure about.

Venmo and Zelle memos are natural language — *"Steph 🍕🍺 rent split lol"* — so some
transactions need a human call.

- **Tinder-style swipe cards.** One transaction per card: merchant/memo, amount, date, and
  the AI's guessed category with its confidence.
- Swipe **right** = correct. Swipe **left** = wrong → category picker opens, including
  "create new category" (new ones get tagged needs/wants/savings).
- Surfaces on app boot when the queue is non-empty. Only genuinely ambiguous transactions
  appear — confident ones auto-apply.
- Should feel fast and satisfying. A queue of 5 cards, not 40.
- Needs a clean **empty/all-done state**.

---

### 9. Friend city *(lower priority)*
Read-only view of someone else's city. Their tier badge, their streak, a nudge button, and
an explicit **"what you can't see"** panel listing everything that stays hidden.

---

### 10. Profile / Proof log *(lower priority)*
Every proof generated, with timestamps. Reads like a receipt log — quiet, credible, factual.
Also holds settings and the demo's **Cheat Mode** toggle.

---

## Mock in this order

1. **City** (4) and **Prove** (5) — the two hero screens; these carry the whole design
2. **Friends** (6) — proves the "tiers not dollars" rule works visually
3. **Review queue** (8) — the most tactile interaction
4. **Welcome** (1), **Goals** (2), **Connect** (3) — onboarding
5. **Insights** (7)
6. Everything else

---

## Open

Palette and typography are undecided — propose something. It should feel like a game a
student would keep on their home screen, while still carrying enough weight that the
Prove screen reads as serious. Avoid both crypto-neon and banking-app blue.
