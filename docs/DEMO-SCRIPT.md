# Demo video — script

**Hard rules:** under 2:00. Must state the hackathon name at the start. Must be
recorded this weekend. Screen recording of the PWA on the iPhone, voiceover.

Record on the phone: iOS Control Centre → Screen Recording, with mic on.

Timings below sum to ~111s, leaving buffer under the 2:00 cap for pacing and
pauses. If a take runs long, cut in this order: Future scope → Automatic
tracking → Value. Never cut the Proof or Cheat beats — they're the whole case.

---

### 0:00 — Hook (15s)

> "Hey, I'm Tisya, and this is my demo for the Midnight Hackathon.
>
> A savings leaderboard shouldn't be possible — either everyone lies, or
> everyone hands their bank account to a stranger.
>
> Nomi is the third option."

**On screen:** the Nomi icon on your iPhone home screen, then tap to open.

---

### 0:15 — Automatic tracking (16s)

> "It reads my income and spending from my email automatically. Known
> merchants are categorized on-device, never leaving it. Only a genuinely
> ambiguous memo gets sent anywhere — names stripped, amount rounded to a
> bracket."

**On screen:** Connect → sync → transactions appear → swipe one card in the
review queue.

---

### 0:31 — The proof (33s) — THE CENTREPIECE

> "At the end of the month, my phone proves I hit my savings goal — without
> revealing what I earn, what I spent, or where.
>
> This is the only place Midnight touches anything here. Not the email, not
> the categorizing — just this one claim, made to an audience with every
> reason not to trust me.
>
> Everything on the left stays on my device. The only thing that goes public
> is a tier number. That's it."

**On screen:** Prove — hold on the private/public split for a beat. Tap
Generate. Let the proof run. Tier lands, tokens mint, city grows.

> "That's a real zero-knowledge proof, generated in a few seconds."

*Why this matters more than it sounds:* every past Midnight hackathon winner
used ZK for institutional plumbing — clinical trials, voting, KYC. Here it's
consumer, and it's the moment the audience actually watches happen, not
invisible infrastructure. If there's room, one line of that framing belongs
right here, e.g. "usually this kind of proof is invisible — here it's the
whole feature." Cut it first if the beat runs long; the screen already makes
the point without narration.

---

### 1:04 — Social without disclosure (14s)

> "My friends see my tier and my city — never a dollar figure, not hidden,
> not blurred, never published in the first place.
>
> This is what only I can see."

**On screen:** Friends leaderboard, scroll. Then Insights — the private view.

---

### 1:18 — The cheat (14s)

> "And you can't fake it."

**On screen:** Profile → Cheat Mode on → tamper the numbers → Prove →
**rejected.** Say nothing while it rejects. Let it land.

> "The contract rejected it. Not my code — the circuit's own math."

---

### 1:32 — Value (12s)

> "Teen money apps already charge up to fifteen dollars a month. Nobody's
> built a competitive one — because until now, showing your progress meant
> showing your money."

That line carries both the market (a paying category already exists) and the
mechanism (peer-visible progress works — Strava, Duolingo streaks — money was
just the one category it was never safe to try in). Don't unpack that in the
video; the line does it in one breath. Say it, don't explain it.

---

### 1:44 — Future scope (7s) — cut first if you're over time

> "Next: proving it straight from a cryptographically signed email, instead
> of a number I submit."

One sentence, clearly future-tense, no more. This is the DKIM/ZK Email
closure already written up in the README's Limitations and Next sections —
say it as direction, not as a claim about what's shipped today.

---

## Recording notes

- Record 3 takes minimum. The first is always stiff.
- Do the Prove and Cheat sections as one continuous take if possible — cuts
  there look like you're hiding something.
- If a screen isn't finished, cut that beat rather than showing something
  broken. A 90-second video of working things beats 2:00 with a dead screen.
- Speak slower than feels natural. Everyone rushes.
- Check the audio before recording all three takes.
- Don't claim Midnight is protecting the email or Gemini steps — it isn't,
  and the script above doesn't say it does. It's the one thing that makes the
  Proof beat possible; let the other beats be about data minimization
  instead, which is a different (and true) claim.
