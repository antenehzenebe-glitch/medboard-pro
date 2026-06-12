---
name: design-qa
description: Visual / UX QA for MedBoard Pro's no-build-step frontend (index.html, public/index.html, medboard-widget.js, landing page). Use after any change that could affect what the user sees. Because the frontend is Babel-in-the-browser with no build, every edit is the deployed render — so QA is screenshot-driven, not log-driven.
---

# Design QA

The frontend has **no build step**. There is no compile to catch a broken render — the only proof a screen works is the screen. QA visual work behind screenshots.

## When this runs
Any diff touching `index.html`, `public/index.html`, `medboard-widget.js`, or `landing.html`. Also as a post-deploy gate (see `deploy-check`).

## The incognito smoke (every time)
Open the live site (or Netlify deploy preview) in a clean incognito window and capture screenshots of:
1. **Question loads** — a stem renders, not a spinner or error.
2. **Choices render** — all options A–E present, selectable.
3. **Answer reveals the explanation** — the explanation panel appears with the emoji format (🩺 / 🚫 / 💎), not a raw `S1:`/`S2:` legacy block.
4. **Widget path** — the embeddable `medboard-widget.js` (Shadow DOM) reveals the full explanation + "Start your free trial" CTA on answer (email gate is removed by design).

Attach before/after for any changed screen. A passing log line is **not** acceptance for visual work.

## Brand & content checks
- Colors: Navy `#002868`, Gold `#C9A84C` (see `MEDBOARD_DESIGN.md`). No off-palette accents.
- The "educational use only, not medical advice" disclaimer is present on user-facing content.
- Tone: senior-attending, rigorous, not gamified. No flashcard/streak gimmickry.
- Mobile width: the question, choices, and explanation are readable on a phone viewport.

## Known visual debt to watch
- ~99 servable legacy-format rows still render `S1:`/`S2:`/`S3:` markers instead of the emoji format (IM 62 / Endo 19 / S1 12 / S2CK 3 / S3 3). If one surfaces in QA, log it against the legacy-format backlog — don't hand-fix in the frontend; the fix is at the data layer.
- Don't select/edit the base64 headshot (~line 388, ~100 KB) during any markup edit.

## Output
A screenshot set + a pass/fail per checkpoint. Failures get a specific repro (which screen, which viewport). Write any recurring visual defect back to `PROJECT_MEMORY.md`.

## Eval
Graded cases in `eval/design-qa.jsonl`.
