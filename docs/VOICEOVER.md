# Nomi — read this out loud

Pause at each blank line. Slower than feels natural.
Italics are actions, not words.

---

Hey, I'm Tisya — this is my demo for the Midnight Hackathon.

Nomi is a savings game for the years before you're a real adult — teenagers, students, anyone who's just moved countries and started from zero.

How do you prove you're financially reliable before you have any record to point at?

Today you either self-report, which isn't verifiable — or you hand over your bank account and let an app watch you.

Nomi is the third option.

Three parts: transactions arrive from email, an LLM resolves the ambiguous ones, and a Midnight circuit proves the result.

---

Local heuristics resolve most transactions with zero disclosure.

For an ambiguous memo, names are stripped and the amount bucketed before anything reaches the LLM — I see the payload first, and if it doesn't match, the call never fires.

---

At the end of the month, my phone proves I hit my savings goal without revealing what I earn or spent.

Hit your goal, and that proof sets your tier, earns Noms, and grows your city.

Totals are sealed with a commitment before the leaderboard opens, and a nullifier blocks claiming the same month twice, across four Compact circuits.

Everything on the left stays on my device. The only thing public is a tier number.

*tap Generate — let it run*

A real Midnight circuit. A real proof — about four and a half kilobytes, generated in seconds against my own proof server.

---

And you can't fake it.

*tamper → prove → let the rejection land in silence*

The circuit rejected it. Not a UI check — a proof cannot be generated for a false statement.

---

This isn't a mockup: real inbox, real Gemini calls, real proof server, and seventeen contract tests against a local Midnight devnet.

---

Leaderboards aren't new. What's new is what the leaderboard is allowed to learn.

Before you have a credit score, there's very little portable evidence of how you manage money. Same if you move countries.

A tier you can prove but never have to explain is where one should start.

Self-entered data can still be inflated within a month. DKIM-signed email closes that — documented, not claimed.

Nomi proves your progress. Reveals nothing.

*hold on the city — stop*

---

**If a take runs long, cut the DKIM line.** Never the proof or the cheat.
**Say "local devnet."** Never "deployed," never "mainnet."
