# CLAUDE.md — MedBoard Pro

> Project context for Claude. Read this before making any changes to the codebase.
> Last updated: **May 30, 2026** — B3 topic-distribution control shipped; D1 closed; citation lock complete; generation-outage fix recorded.
> Generators at **v7.5.9**, pushed (HEAD `abd3ccd`).

-----

## 1. What this project is

**MedBoard Pro** (medboardpro.org) is an AI-augmented medical board exam preparation platform that delivers clinically rigorous, blueprint-aligned multiple-choice questions (MCQs) across five exam levels:

- **ABIM Internal Medicine** (board certification)
- **ABIM Endocrinology & Metabolism** (subspecialty board — the platform's flagship strength)
- **USMLE Step 1** (preclinical)
- **USMLE Step 2 CK** (clinical knowledge)
- **USMLE Step 3** (post-graduate)

**Founder:** Dr. Anteneh Zenebe, MD, FACE — Assistant Clinical Professor and Associate Program Director, Howard University College of Medicine. All content is personally authored and reviewed against current clinical guidelines.

**Differentiator (do not lose sight of this):** built by a fellowship program director with endocrinology depth, including fellowship-level clinical algorithms, ACGME milestone alignment, and a culturally responsive case design philosophy. The platform does NOT compete with UWorld/Amboss on breadth — it competes on Endo depth, rigor, and price.

**Subscription tiers:** Medical Student ($29/mo), Resident/Fellow ($59/mo), Institution ($499/mo or $2,999/yr). Stripe Payment Links + Customer Portal. 14-day free trial.

-----

## 2. Tech stack

|Layer             |Stack                                                                                       |
|------------------|--------------------------------------------------------------------------------------------|
|Frontend          |React (single-file via Babel in `public/index.html` / root `index.html`), inline CSS-in-JS, no build step |
|Hosting           |Netlify (auto-deploy from GitHub `main` branch)                                             |
|Serverless backend|Netlify Functions (Node.js 18+)                                                             |
|Database          |Supabase (Postgres) with Row Level Security                                                 |
|Serving           |Supabase RPC `serve_next_mcq` (DB-first, **live**); `generate-mcq.js` as fallback           |
|Auth              |Supabase Auth, opaque API keys (`sb_publishable_*` client-side, `sb_secret_*` server-only)  |
|AI generation     |Anthropic Claude (primary, Sonnet 4.6 = `claude-sonnet-4-6`), Google Gemini (fallback, gen-mcq only) |
|Lead funnel       |Embeddable `medboard-widget.js` (Shadow DOM); `capture-lead.js` Netlify fn (parked)         |
|Payments          |Stripe Payment Links + Customer Portal (no custom checkout)                                 |
|Bulk operations   |GitHub Actions workflows                                                                    |

-----

## 3. Repository layout

```
medboard-pro/                   # REPO ROOT (= /workspaces/medboard-pro in Codespaces)
├── index.html                  # Landing + app (single-file React); embeds the daily-question widget
├── medboard-widget.js          # Embeddable lead/funnel widget (served at root: /medboard-widget.js)
├── netlify/
│   └── functions/
│       ├── generate-mcq.js     # Live single-question generator + DB-first fallback (v7.5.x)
│       └── capture-lead.js     # Lead-capture fn (ready; wiring PARKED — see §8 funnel)
├── public/
│   └── index.html              # (single-file React frontend; base64 headshot ~line 388)
├── scripts/
│   └── bulk-generate.js        # Batch MCQ generator run via GitHub Actions (v7.5.9)
├── .github/
│   └── workflows/              # Bulk MCQ Generator workflow lives here
├── supabase-migration.sql      # cueing_* migration (historical)
├── README.md
└── CLAUDE.md                   # This file
```

**Critical:** the frontend is Babel-in-the-browser JSX with **no build step**. Every change is the deployed change.

**Patch workflow:** generator edits use self-contained Python scripts that anchor on a unique byte-exact string, assert the occurrence count before editing (abort-before-write if the anchor is wrong), and are idempotent. Run from the **repo root** (`python3 patch.py`), `node --check` both files, `rm` the script, commit. Do NOT paste large heredocs into the Codespaces web terminal — they char-mangle; create the file (or use a quoted `<<'EOF'` heredoc) instead. Browser uploads of `.py` scripts sometimes land in `.github/workflows/` or get renamed `name (1).py` — `find` + `mv` to root before running.

**Parity rule:** `generate-mcq.js` and `bulk-generate.js` must carry byte-identical `TOPIC_GUARDRAILS`, `integrityRules`, and `ALLOWED_GUIDELINE_CITATIONS`. These have silently drifted before (fixed in `ed36ef9`). Diff after any guardrail edit. Note B3 (the sampler) is **bulk-only** — the live single-question path doesn't batch-sample, so it is correctly NOT mirrored to gen-mcq.

-----

## 4. Architecture

### Serving path (DB-first hybrid — LIVE)

```
User clicks "Next Question"
    ↓ Supabase RPC: serve_next_mcq(level, topic, user_id)
    ├── Match found → approved, unseen, cueing-clear row   (~0.05–0.3s)  ← ~95% of cases
    └── No match    → POST /.netlify/functions/generate-mcq (19–25s)     ← fallback only
```

Both serving functions gate on `status` only. `serve_next_mcq` additionally filters `cueing_flag IS NOT TRUE`; `fetch_unseen_mcqs` (SECURITY DEFINER) does not (audit before relying on cueing_flag as a hard gate through every path).

**Servable-pool definition (authoritative):** `status = 'approved' AND cueing_flag IS NOT TRUE`.

### Threshold to declare a level "live-first"

| Level | Servable target | Basis |
|---|---|---|
| ABIM Endocrinology | ~175 | 25 per major topic × 7 |
| ABIM Internal Medicine | ~165 | 15 per subspecialty × 11 |
| USMLE Step 1 | ~150 | 10 per organ system × 15 |
| USMLE Step 2 CK | ~180 | 15 per system × 12 |
| USMLE Step 3 | ~150 | 15 per system × 10 |

### Supabase Oct-30-2026 Data API change

New `public` tables/functions created after Oct 30 2026 won't auto-expose to the Data API. Existing objects (incl. `serve_next_mcq`, `fetch_unseen_mcqs` if already shipped) keep their grants. **Verify those two RPCs carry explicit `GRANT EXECUTE`** (they shipped inside the at-risk window). See `SUPABASE_OCT2026_FALLBACK_PLAN.md`. New-object grant convention is now mandatory — see §10.

-----

## 5. Database schema (Supabase) — `mcqs` (25 columns)

Key columns: `id` (uuid PK), `exam_level`, `topic`, `stem`, `choices` (jsonb), `correct_answer`, `explanation`, `created_at`, **`status`** (authoritative approval column: `pending_review` | `approved` | `rejected`), `specialty_group`, `blueprint_tag`, `difficulty`, `reviewed_at`, `reviewed_by` (**uuid** — never write `'admin'`; generally NULL), `generation_model` (e.g. `claude-sonnet-4-6`; populated per-row since C2; NULL on pre-C2 rows), `content_hash` (hash-only dedup — does NOT catch semantic near-dupes), `times_served`, `updated_at`, **`approval_status`** (**deprecated** parallel column — see §12), `cueing_flag` (**boolean**), `cueing_notes`, `cueing_checked_at`.

Deprecated / drop-candidates (future migration, not urgent): `quality_score`, `flagged_reason`, `approval_status`, the `cueing_*` trio.

`user_responses` tracks each user's answered `mcq_id` (used by `serve_next_mcq` to exclude seen rows). RLS enabled; publishable key respects RLS, secret key bypasses it.

-----

## 6. Clinical accuracy standards (the most important section)

Enforcement lives in `generate-mcq.js` and `scripts/bulk-generate.js`, sharing an identical `TOPIC_GUARDRAILS` array, an `integrityRules` block (A–M), and a validator stack.

### TOPIC_GUARDRAILS
- **L1 — Foundational Anchors:** hard clinical facts (thresholds, named trials, guideline years, contraindications, formulas).
- **L2 — Cognitive Complexity:** forbids Tier 1–2 trivia; requires Tier 3+ angles.

### Clinical anchors locked
DKA/HHS (K⁺-before-insulin) · Hypoglycemia/Insulinoma (proinsulin pmol/L; Whipple) · Thyroid storm (ATA 2016) · Adrenal incidentaloma (AACE/ESE 2023) · Subclinical hypothyroidism (TRUST) · LT4 dosing · **DI / posterior pituitary** (water deprivation contraindicated when Na > 145 / osm > 295–300; direct DDAVP/copeptin — ESE 2018) · **A1 adrenal-insufficiency replacement monitoring** (no reliable biochemical GC marker; clinical titration; ES 2016) · **A2 post-stroke anticoagulation timing** (EHRA 1-3-6-12 vs ELAN 2023 / AHA-ASA 2024).

### Integrity rules A–M
A–H pre-existing (H = anti-cueing). I/J/K = v7.5.6 ABIM canon. **L** = lab-value reproduction lock; **M** = single-best-answer discriminator.

### Validator stack
`detectAntiCueingViolation`, `validateConsistency` (stem↔explanation lab mismatch backstop), `validateDemographics`, `validateChoiceCompleteness`, the v7.5.6 canon validators (`validateLeadInType` etc.), and **`validateCitationYears` + `ALLOWED_GUIDELINE_CITATIONS`** (per-society allow-list; inspects years within ~25 chars of a recognized society token). Plus `checkUnseededCitations` warn-mode (`WARN_GUIDELINE_TOKENS`) — non-blocking "verify edition" flag, wired on both paths.

> Wiring differs: gen-mcq chains validators with `&&`; bulk uses guard-clause `return recordDrop("name")` (14 guards; the C1 drop-reason tally). In bulk, citation runs before anti-cueing (anti-cueing is dead last — its drops can be masked; re-evaluate ordering with multi-batch data, don't reorder blind).

### Citation lock — COMPLETE (closed May 29)
Per-society allow-list with bounded rolling windows for annual bodies; verified to publication year for episodic bodies; warn-mode for un-promoted bodies. Final map (both files, byte-identical): Endocrine Society {2008,09,14,16,18,22,24,25} · ATA {2014,15,16,17,25} (2024 rejected) · AACE {2020,22,23,25,26} · ESE {2018,23,24} · ADA {2024,25,26} · AHA {2017–2026} · ASA {2018,19,21,22,26} · KDIGO {2021,22,24,25} · GOLD {2024,25,26} · GINA {2024,25,26} · EULAR {2022,23} · ACR {2017,23} · EHRA {2021} · Jonklaas {2014}. Warn-mode: USPSTF, ACG, AASLD, AGA, ASH, IDSA, SSC, ASPEN, ATTD, ASAS. `CITATION_LOCK_ENFORCE = true`. **Note:** Endocrine Society **2011 is intentionally NOT seeded** (founder decision — real guideline but declined to widen; the lock correctly rejects it).

### Forbidden stem patterns
"First step / next step / best fluid" Tier-1 trivia · stems contradicting their own explanation · 4-obviously-wrong choices (cueing) · NOT/EXCEPT/LEAST lead-ins · gratuitous race/demographic descriptors (Rule I) · "all/none of the above."

-----

## 7. Workflows

### Single question (user-facing)
Frontend → `serve_next_mcq` (DB-first). No-match → `generate-mcq.js` → Claude/Gemini → insert `status: pending_review`. Newly generated rows are **never served until vetted.**

### Bulk generation (admin)
GitHub → **Actions** → **Bulk MCQ Generator** → run with `Count`, `Level` (specific or blank for round-robin), `Mode: standard`. Confirm the banner version (`… (v7.5.9)`) in the log before vetting a batch. Summary prints `Saved to DB: N`, `DB errors: M`, the **C1 validator-drop breakdown** by reason, gen-failures, and unseeded-citation warns.

**B3 topic-distribution control (v7.5.9):** `buildWorkQueue` draws **without replacement** — shuffles the distinct `{level, topic}` concepts and emits round-robin, reshuffling when the pool empties, so each concept appears at most `ceil(count / N_concepts)` times, evenly spread. Replaces the old weighted-with-replacement sampler that let high-weight topics recur within a batch (the April clustering `content_hash` couldn't catch). The `FILTER_TOPIC && FILTER_LEVEL` single-topic path and the nutrition-injection hook are preserved. **Smoke-confirmed May 30** (Endo count=10 → 7 saved, 7 distinct concepts across 6 subspecialty groups, zero repeats). Note: B3 spreads at the *topic* level; semantic near-dupes *within* a topic remain the job of a future semantic-dedup pass.

### Vetting (manual, SQL-driven)
`status` is authoritative. Safe approval write (mirrors the deprecated column harmlessly):
```sql
UPDATE mcqs SET status='approved', approval_status='approved', reviewed_at=now() WHERE id='<row_id>';
```
Reject mirrors with `'rejected'`, or `DELETE`. Bulk-approve a fresh batch by scoping `created_at > now() - interval '2 hours' AND status='pending_review'`. **Always run a WHERE-clause verification SELECT (using a unique stem substring) before any UPDATE.**

-----

## 8. Current state (as of May 30, 2026)

### Question bank — servable

| Level | Servable | ~Flip target | Gap |
|---|---|---|---|
| ABIM Internal Medicine | 87 | ~165 | ~78 |
| ABIM Endocrinology | 50 | ~175 | ~125 |
| USMLE Step 1 | 21 | ~150 | ~129 |
| USMLE Step 3 | 19 | ~150 | ~131 |
| USMLE Step 2 CK | 16 | ~180 | ~164 |
| **Total servable** | **193** | | |

Pending (not servable until vetted): ~35 Endo v7.5.7 candidates + 3 night-verified + 7 from the May 30 B3 smoke. **IM-36 recovery block** identified: exactly **36** rows `status='pending_review' AND approval_status='approved'` (April pre-canon; spread cleanly across subspecialties — GI/Hep 8, Cardiology 8, Pulm 6, Gen IM 5, Nephro 4, Rheum 3, +Heme/Onc, ID, Ethics). Recovery = triage (promote/edit/drop), not blanket promotion.

### Generators
**v7.5.9**, HEAD `abd3ccd`, pushed. B3 shipped + smoke-confirmed. Citation lock complete. C1 (drop-reason breakdown) + C2 (`generation_model` per-row) shipped. **Generation outage fixed** (`BULK_CLAUDE_MODEL` use-before-declare introduced by C2 → every bulk run produced 0; declared at module scope, line 68). Error-surfacing patch live (catch blocks log HTTP status + body + per-attempt cause) — keep it; it named the outage in one run.

### Lead funnel (Option A — LIVE May 30)
`medboard-widget.js` v1.1 deployed: **email gate removed** — answering reveals the full explanation + "Start your free trial" CTA immediately (drive trials directly). UTM tags intact. Email-capture machinery (`gateBlock`/`bindGate`/`captureLead`, `capture-lead.js`, `leads` schema) is **parked, not deleted** — for a future non-blocking, post-explanation optional email ask. Landing page picks this up automatically (the `DailyQuestionWidget` React component only injects `/medboard-widget.js`; no `index.html` change needed).

### Security posture (closed May 16)
Opaque keys; JWT fallbacks stripped; leaked `service_role` JWT revoked. `sb_publishable_*` client-side; `sb_secret_*` local admin only.

-----

## 9. Roadmap priorities (in order)

1. **IM-36 recovery** — triage the 36 `pending_review/approved` rows (promote clean → `status='approved', reviewed_at=now()`; edit-promote; drop dup/mis-key; hold rewrites). Fastest IM bank growth.
2. **Resolve two May-30 smoke findings before any scaled IM *generation* run** (see §12): (a) `validateLeadInType` rejecting `most_appropriate_clinical_intervention` at Endo — confirm canon-correct vs over-strict; (b) recurring "truncated choice A" — likely generation/parse defect.
3. **Staged IM bulk generation** (only after B3 confirmed — done — and #2 resolved): moderate batches (count 20–30), vet to keep pace; new rows = `pending_review`.
4. **Vet the ~35 Endo bulk candidates** (50 → up to ~85). Expect SGLT2i/hypoglycemia clustering (predate B3).
5. **Rewrite 3 held items:** `425cf587` (NIPHS), `a660f8af` (LT4 + fabricated ATA 2025), `93191d92` (TCA + bicarbonate).
6. **Disposition edge-case rows:** IM has 1 `rejected/approved` + 2 `pending/rejected`; bank-wide 2 `rejected/approved`. Excluded from serving; rescue or confirm.
7. **Image integration Phase 1 decision** — fold `requires_image`/`image_spec` generator flagging into a release, or defer (Phase 0 policy lock still open; see `IMAGE_INTEGRATION_PLAN.md`). Does NOT block MVP.
8. Continue bulk generation toward thresholds · No-signup demo mode · 30-fellow willingness-to-pay outreach · trial-cancellation survey (the real funnel leak).
9. Spaced-repetition v2 · Mobile PWA — Q4 2026.

-----

## 10. Coding conventions

- **No build step on frontend.** Edits to `index.html` / `public/index.html` are immediately live.
- **Env vars required, not optional.** Fail-fast (`throw`) on missing secrets; never `|| "fallback"`.
- **Brand colors:** Navy `#002868`, Gold `#C9A84C`. (See `MEDBOARD_DESIGN.md`.)
- **Disclaimers required** on user-facing content: "educational use only, not medical advice."
- **Approval gate is non-negotiable.** No row serves with `status != 'approved'`.
- **`status` is authoritative (D1 closed — option b).** Serve gates on `status` only. Mirror `approval_status` on approvals (harmless, future-proof). Do NOT introduce new logic that reads `approval_status` for serving.
- **Generator parity mandatory.** Diff `TOPIC_GUARDRAILS` / `integrityRules` / `ALLOWED_GUIDELINE_CITATIONS` after every edit. (Bulk-only changes like B3 are exempt by design.)
- **Supabase grant convention (Oct-2026):** every migration creating a table/function in `public` MUST include explicit `GRANT` statements in the same migration. No "grant later." Prefer `SECURITY INVOKER` for functions unless there's a clear reason for DEFINER.
- **Single-purpose commits.** Security ≠ feature ≠ guardrail.

-----

## 11. Security

- Never paste secrets back into chat. `sb_secret_*` = local-only. `sb_publishable_*` safe client-side. RLS protects everything; secret key bypasses it. Stripe `billing.stripe.com/p/login/*` + `buy.stripe.com/*` are public by design. Anthropic/Gemini keys in Netlify env vars only. `capture-lead.js` uses `SUPABASE_SERVICE_ROLE` server-side only. If a credential leaks: rotate, audit, never paste it.

-----

## 12. Known gotchas

### `approval_status` deprecated — `status` authoritative (D1 RESOLVED May 30, option b)
Both serve functions gate on `status`. `approval_status` is stale; legacy rows are inconsistent across the two columns. The 2-of-2 gate was rejected (footgun: a promotion that forgets `approval_status` silently de-serves rows). Edge-case rows (`status='rejected'` + `approval_status='approved'`) are excluded from serving — disposition pending.

### May-30 smoke findings (OPEN — gate the scaled IM generation run)
- **`validateLeadInType` rejecting `most_appropriate_clinical_intervention` at ABIM Endocrinology** (4/14 drops in a 10-count run). "Most appropriate intervention/next step" is a core ABIM management lead-in; confirm whether the level-map restriction is canon-correct or over-strict (it'll bite IM harder — IM is management-heavy).
- **Recurring "truncated choice A"** (`validateChoiceCompleteness`, 4/14). Systematic, always choice A → likely a generation token-cutoff or choice-extraction parse defect, not content. Investigate before scaling.

### Frontend — `saveResponse()` row match is fragile
In `index.html`, `saveResponse()` looks up the row by `eq("stem", question.stem)` even though the DB-first path already returns the real `id` as `question.id`. Exact long-text matching is brittle (whitespace/encoding drift → response silently not saved → corrupted analytics). Fix: use `question.id` directly when `_source === "db"`; only fall back to a lookup for AI-generated items.

### Generation-outage debugging rule
If a bulk run returns 0, **read the surfaced HTTP cause first** (error-surfacing patch prints it) and check the most recent commit that touched the generation path **before** suspecting keys/billing. The May-29 outage was a `ReferenceError` (missing constant), not the API. The Anthropic key is confirmed present in Actions secrets.

### Citation lock — blind spots CLOSED
Full seed list + warn-mode shipped May 29. Remaining residual: journals/trials (NEJM, JAMA, etc.) and FDA/UpToDate are deliberately unguarded (no canonical year); warn-mode surfaces unseeded TitleCase-bodies. `±25-char window takes the FIRST year in range` → adjacent citations can mis-attribute (backlog).

### `TOPIC_GUARDRAILS` drift between generators
Reconciled in `ed36ef9`. Always diff after a guardrail edit. A pre-commit parity assertion would catch this automatically (backlog).

### Semantic near-duplicates
`content_hash` dedupes exact stems only. B3 fixes *topic-level* clustering; semantic near-dupes within a topic still survive (real fix = semantic dedup, backlog).

### Doc/file drift (cleanup)
- `INTEGRATION.md` documents the widget at `/widget/medboard-widget.js`; it is actually live at the root `/medboard-widget.js`.
- The leads schema is committed as `Spabase_lead_schema` (typo, no `.sql`); docs call it `supabase-leads-schema.sql`.

### Other
- Netlify function timeout = 26s; gen runs 19–25s. Off the critical path now (DB-first serves ~95%). Cold-start "Unable to reach QBank" ≈ timeout, not auth (auth fails are `<1s` with 401/403).
- `index.html` / `public/index.html` line ~39 holds `SB_KEY` (publishable) as a constant — by design, secure.
- Base64 headshot ~line 388 is ~100KB; don't select it during edits.
- `reviewed_by` is **uuid**, never `'admin'`. `cueing_flag` is **boolean**.
- **Watch the aldosterone consistency-rejection rate** — Rule L (prompt) isn't fully landing on aldosterone values; `validateConsistency` is the backstop. The May-30 run showed only 1 consistency drop (TSH), better than prior aldosterone-heavy runs.

### Backlog (carry forward)
Model-literal consolidation (fetch bodies hardcode `claude-sonnet-4-6`; point at `BULK_CLAUDE_MODEL`) · guard-order decision (anti-cueing last) · pre-commit parity assertion · pre-C2 `generation_model` backfill (359 NULL rows → `pre-c2-unknown`) · A1 keyword-shadowing check · integrityRules A–J parity diff · semantic dedup · ±25-char citation-window mis-attribution.

-----

## 13. Sequencing principle

1. Schema first (DB before dependent code). 2. Server-side second (functions, bulk scripts). 3. Frontend last. 4. Production-deploy validation always — smoke test in incognito after every deploy (question loads, choices render, explanation appears); roll back via Netlify Deploys → Publish previous deploy.

-----

## 14. Founder voice and product positioning

- Tone: senior attending walking a junior through a high-yield case. Rigorous, never condescending.
- Position: academic-credibility-first. Not flashy, not gamified.
- Compete on: Endocrinology depth, clinical rigor, price. NOT on breadth, flashcards, gamification, social.

-----

*End of CLAUDE.md*
