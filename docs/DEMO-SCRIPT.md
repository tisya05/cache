# Demo video — script

**Track: Mobile.** Its brief — *"sensitive information never leaves the device
unproven"* — is literally what Nomi does, and it's the thinner field.

**Hard rules:** under 2:00. Hackathon name at the start. Recorded this weekend.
Screen recording of the PWA on the iPhone, voiceover.

**~258 words ≈ 112 seconds.** Real buffer under the cap.

---

## Why it's shaped this way

Every winner from the last event does the same eight things. This hits all of them:

1. Opens on an external tension, never "let me show you my app"
2. A crisp mechanism sentence *before* the demo
3. Names the actual primitive out loud — commitment, nullifier, circuit
4. Speaks real numbers
5. An explicit "this is real, not a mockup" list
6. Precise about what is NOT live — say **"local devnet"**, never "deployed" or "mainnet"
7. A mirrored closing tagline
8. No philosophical "why Midnight" — the primitive and its consequence, then move

Lead with the mechanism. The city and leaderboard are **evidence the mechanism
produces something people would use** — not the hook. Don't open on the city.

---

### 0:00 — Hook (13s)

> "Hey, I'm Tisya — this is my demo for the Midnight Hackathon.
>
> Nomi is a savings game for the years before you're a real adult — teenagers,
> students, your first job.
>
> A social savings app forces a choice: either everyone lies about their
> numbers, or everyone hands over their bank account. Nomi is the third option."

**Screen:** Nomi icon on the home screen, tap to open.

---

### 0:13 — Market (10s)

> "Teen money apps charge up to fifteen a month — and every one works by
> watching you."

**Screen:** quick cut — City, then leaderboard.

*Moved up from the end deliberately. A market number lands while judges are
still forming an opinion, not after.*

---

### 0:23 — The mechanism (17s)

> "Local heuristics resolve most transactions with zero disclosure. For a
> genuinely ambiguous memo, names get stripped and the amount bucketed before
> anything reaches an LLM — I see the exact payload first, and if it doesn't
> match, the call never fires."

**Screen:** Connect → sync → transactions appear → swipe one review-queue card,
holding a beat on the low-confidence guess.

---

### 0:40 — The proof (30s) — THE CENTREPIECE

> "At the end of the month, my phone proves I hit my savings goal without
> revealing what I earn or spent. That proof sets my tier, earns Noms, and grows
> my city.
>
> Totals are sealed with a commitment before the leaderboard opens, and a
> nullifier blocks claiming the same month twice. Four Compact circuits.
>
> Everything on the left stays on my device. The only thing public is a tier
> number."

**Screen:** Prove — hold on the private/public split. Tap Generate, let it run.
Tier lands, Noms mint, city grows.

> "A real Midnight circuit. A real proof — about four and a half kilobytes,
> generated in a few seconds, on my phone."

**⚠️ Never cut inside Generate → tier landing.** A cut there reads as hiding
something.

**⚠️ Don't state a proof time.** It ranged 3.3s to 13.9s in testing. "A few
seconds" is honest; a number the screen contradicts is worse than a vague one.
**4,508 bytes is stable across every run — that one is safe to say exactly.**

**Optional, strongest shot available:** mirror the phone to the Mac (QuickTime →
New Movie Recording → select iPhone as camera), put the terminal beside it
running:

```
docker logs -f --tail 0 midnight-proof-server 2>&1 | grep --line-buffered -E "prove|proof ok"
```

Tap Generate and `POST /prove → proof ok` lands in the same frame. Skip if it
fights you.

---

### 1:10 — The cheat (12s)

> "And you can't fake it."

**Screen:** Profile → Cheat Mode → tamper → Prove → **rejected.** Say nothing
while it rejects. Let it land.

> "The circuit rejected it. Not a UI check — a proof cannot be generated for a
> false statement."

**Phone only on this beat — no terminal.** The cheat never reaches the proof
server: the assert fires during local circuit execution, before proof data
exists. That's correct (you can't prove a false statement), but an empty
terminal reads as *broken* on camera, not as *rejected*.

---

### 1:22 — Completion (12s)

> "Not a mockup: real inbox, real Gemini calls, real proof server, seventeen
> contract tests against a local Midnight devnet."

**Screen:** quick cut — Friends leaderboard, then City.

**⚠️ Say "seventeen," not "112."** The terminal shows `Tests 17 passed` for the
contract suite. 112 is contract + ingest combined. A number your footage
contradicts makes judges doubt everything else.

---

### 1:34 — Business, limit, tagline (16s)

> "Leaderboards aren't new. What's new is what the leaderboard is allowed to
> learn.
>
> Before you have a credit score, you have nothing. Same if you move countries.
> A tier you can prove but never have to explain is where one should start.
>
> Self-entered data can still be inflated within a month. DKIM-signed email
> closes that — documented, not claimed.
>
> Nomi proves your progress. Reveals nothing."

**Screen:** best city shot, hold through the tagline.

*The limitation line is not a weakness. Judges explicitly praised exactly this
in two of four winners — "deliberately choosing what to keep public rather than
claiming false privacy guarantees."*

---

## Recording notes

- Three takes minimum. The first is always stiff. Stop at three.
- **Record the screen silently, add voiceover after.** Far easier to retime words
  to footage than the reverse.
- Proof and Cheat as continuous takes. Cuts there look like hiding.
- Speed the proof wait 2× so it lands around 4s — but never remove it. An instant
  proof looks fake.
- Cut all typing, scrolling and navigation. Jump-cut between screens.
- Speak slower than feels natural.
- If a screen isn't finished, cut that beat rather than show something broken.

**Cut order if over time:** DKIM sentence → completion list → market beat.
**Never cut the proof or the cheat.**
