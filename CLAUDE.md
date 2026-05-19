# CLAUDE.md — MedBoard Pro

> Project context for Claude. Read this before making any changes to the codebase.
> Last updated: May 16, 2026

---

## 1. What this project is

**MedBoard Pro** (medboardpro.org) is an AI-augmented medical board exam preparation platform that delivers clinically rigorous, blueprint-aligned multiple-choice questions (MCQs) across five exam levels:

- **ABIM Internal Medicine** (board certification)
- **ABIM Endocrinology & Metabolism** (subspecialty board — the platform's flagship strength)
- **USMLE Step 1** (preclinical)
- **USMLE Step 2 CK** (clinical knowledge)
- **USMLE Step 3** (post-graduate)

**Founder:** Dr. Anteneh Zenebe, MD, FACE — Assistant Clinical Professor and Associate Program Director, Howard University College of Medicine. All content is personally authored and reviewed against current clinical guidelines.

**Differentiator (do not lose sight of this):** built by a fellowship program director with endocrinology depth, including fellowship-level clinical algorithms, ACGME milestone alignment, and a culturally responsive case design philosophy. The platform does NOT compete with UWorld/Amboss on breadth — it competes on Endo depth, rigor, and price.

**Subscription tiers:** Medical Student ($29/mo), Resident/Fellow ($59/mo), Institution ($499/mo). Stripe Payment Links + Customer Portal. 14-day free trial.

---

## 2. Tech stack

| Layer | Stack |
|---|---|
| Frontend | React (single-file via Babel in `public/index.html`), inline CSS-in-JS, no build step |
| Hosting | Netlify (auto-deploy from GitHub `main` branch) |
| Serverless backend | Netlify Functions (Node.js 18+) |
| Database | Supabase (Postgres) with Row Level Security |
| Auth | Supabase Auth, opaque API keys (`sb_publishable_*` client-side, `sb_secret_*` server-only) |
| AI generation | Anthropic Claude (primary), Google Gemini (fallback) |
| Payments | Stripe Payment Links + Customer Portal (no custom checkout) |
| Bulk operations | GitHub Actions workflows |

---

## 3. Repository layout

```
medboard-pro/
├── public/
│   └── index.html              # Single-file React frontend; base64 headshot embedded on line ~388
├── netlify/
│   └── functions/
│       ├── generate-mcq.js     # Main MCQ generation endpoint
│       └── edge-functions/     # Edge function scaffolding (partially used)
├── scripts/
│   └── bulk-generate.js        # Batch MCQ generator run via GitHub Actions
├── .github/
│   └── workflows/              # Bulk MCQ Generator workflow lives here
├── supabase-migration.sql      # Pending schema migration (cueing_flag, cueing_notes, cueing_checked_at)
├── revet.js                    # Re-vetting script (anti-cueing pass on existing rows)
└── CLAUDE.md                   # This file
```

**Critical:** `public/index.html` is a single static file with Babel-in-the-browser JSX. There is **no build step**. Every change is the deployed change.

---

## 4. Architecture

### Current (AI-first)

```
User clicks "Next Question"
    ↓
React frontend (public/index.html)
    ↓ POST /.netlify/functions/generate-mcq
Netlify Function (generate-mcq.js)
    ↓
Claude API (with topic-guardrailed prompt + 5-point self-verification)
    ↓ on failure
Gemini API (fallback)
    ↓
Supabase INSERT → mcqs (status: 'pending_review')
    ↓
Return question JSON to frontend
```

**Observed latency:** 19–25 seconds per call. Netlify hard timeout is 26 seconds. The system operates within a 1–7 second margin of catastrophic failure on every request. Cold starts add 1–3 seconds and account for most "Unable to reach QBank" errors.

### Target (DB-first hybrid — top architectural priority)

```
User clicks "Next Question"
    ↓
Frontend calls Supabase RPC: serve_next_mcq(level, topic, user_id)
    ↓
    ├── Match found → Return approved unseen row    (~0.05–0.3s)  ← 95% of cases
    └── No match    → POST /.netlify/functions/generate-mcq  (22–25s)  ← thin filters only
```

**Threshold to flip DB-first per level:**

| Level | Approved rows needed before flipping |
|---|---|
| ABIM Endocrinology | ~175 (25 per major topic × 7 topics) |
| ABIM Internal Medicine | ~165 (15 per subspecialty × 11) |
| USMLE Step 1 | ~150 (10 per organ system × 15) |
| USMLE Step 2 CK | ~180 (15 per system × 12) |
| USMLE Step 3 | ~150 (15 per system × 10) |

A `level_is_live` config row in Supabase will gate the DB-first call per level so we can flip levels independently.

---

## 5. Database schema (Supabase)

### `mcqs` (primary table)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `exam_level` | text | One of the 5 valid levels (see VALID_LEVELS constant) |
| `blueprint_tag` | text | Topic/subtopic tag |
| `stem` | text | Clinical vignette |
| `choices` | jsonb | Array of 5 choice strings (`["A...", "B...", ...]`) |
| `correct_answer` | text | A/B/C/D/E |
| `explanation` | text | Teaching explanation |
| `status` | text | `'pending_review'` \| `'approved'` \| `'rejected'` |
| `is_approved` | boolean | Convenience flag; may be redundant with `status` |
| `reviewed_at` | timestamptz | When vetted |
| `reviewed_by` | text | Reviewer identifier (default `'admin'`) |
| `content_hash` | text | Dedupe hash on stem |
| `created_at` | timestamptz | Generation timestamp |
| `cueing_flag` | text | **PENDING** — added by `supabase-migration.sql` |
| `cueing_notes` | text | **PENDING** — added by `supabase-migration.sql` |
| `cueing_checked_at` | timestamptz | **PENDING** — added by `supabase-migration.sql` |

### `user_responses`

Tracks every `mcq_id` each user has answered. Used by `serve_next_mcq` RPC to exclude already-seen questions.

### RLS

Enabled. The publishable key respects RLS; the secret key bypasses it. **Never** ship `sb_secret_*` to the client.

---

## 6. Clinical accuracy standards (the most important section)

This platform is staked on clinical rigor. Every MCQ must meet ABIM/NBME item-writing standards. The two files that enforce this are `generate-mcq.js` and `scripts/bulk-generate.js`, which share an identical `TOPIC_GUARDRAILS` array.

### TOPIC_GUARDRAILS structure

Each entry is keyed by topic and contains two layers:

- **L1 — Foundational Anchors:** hard-coded clinical facts the LLM must respect (numeric thresholds, named trials, current guideline years, contraindications, formulas).
- **L2 — Cognitive Complexity:** forbids Tier 1–2 trivial stems and requires Tier 3+ angles (e.g., recognizing euglycemic DKA on SGLT2i, distinguishing factitious from endogenous hyperinsulinism, IV-to-SQ insulin transition).

### Topics with tightened guardrails (shipped May 15–16, 2026)

- DKA / HHS
- Hypoglycemia / Insulinoma (corrected proinsulin units to pmol/L; locked Whipple triad criteria; locked endogenous hyperinsulinism panel)
- Thyroid storm (locked synthesis-before-release sequence; corrected fabricated ATA citations to ATA 2016)
- Adrenal incidentaloma (locked AACE/ESE 2023 size and washout criteria)
- Subclinical hypothyroidism (locked TRUST trial findings; corrected wrong TSH targets)
- Hypothyroidism / Levothyroxine dosing

### Validators enforced in code

| Validator | Purpose |
|---|---|
| `detectAntiCueingViolation()` | Rejects MCQs where choices telegraph the correct answer (Rule H) |
| `validateConsistency()` | Catches lab-value mismatches between stem and explanation (e.g., stem calcium 10.1 vs explanation calcium 145) |
| `validateDemographics()` | Catches contradictions between demographic statements |
| `5-point self-verification` | Final LLM self-check before output |

### Citation rules (CRITICAL)

- **Never fabricate guideline years.** Use these specific anchors:
  - ATA 2016 (thyroid)
  - Endocrine Society 2009 (hypoglycemia)
  - AACE/ESE 2023 (adrenal incidentaloma)
  - AACE 2022 (some thyroid topics)
  - Jonklaas et al. 2014 (LT4 therapy)
  - ADA 2026 (diabetes)
  - TRUST trial (subclinical hypothyroidism in older adults)
- If a citation is uncertain, leave it general ("per current guidelines") rather than invent a year.

### Forbidden stem patterns

- "First step in DKA?" / "What is the next step?" / "Best fluid for DKA?" — Tier 1 trivia, automatic reject
- Stems that contradict their own explanation (lab values, demographics, timeline)
- Choices where 4 are obviously wrong (cueing violation)
- Generic Vogue-style demographic vignettes that don't pressure-test clinical reasoning

---

## 7. Workflows

### Single question generation (user-facing)

User clicks Next Question → frontend POST → `generate-mcq.js` → Claude/Gemini → Supabase insert with `status: pending_review` → returned to user.

### Bulk generation (admin)

GitHub → repo → **Actions** → **Bulk MCQ Generator** → Run workflow with `Count` (e.g., 100), `Level` (specific or blank for round-robin), `Mode: standard`. Output summary line: `Saved to DB: N, DB errors: M`.

### Vetting

Pending rows are reviewed in Supabase SQL Editor or via the admin vetting panel (HTML file in Codespace, not deployed). Approved → `status='approved'`, `reviewed_at=now()`. Rejected → `DELETE` row.

### Re-vetting (one-off, pending today)

Run `node revet.js` (dry run) → `node revet.js --apply` to classify existing rows against new rules (e.g., anti-cueing). Sets `cueing_flag` column.

---

## 8. Current state (as of May 16, 2026)

**Question bank:**
- ~113 approved
- ~56 pending review (generated before tightened guardrails; should be re-vetted or regenerated)
- 3 rejected

**Distribution skews heavily toward ABIM IM and ABIM Endo.** USMLE Step 1/2 CK/3 are thin (single digits each).

**Security posture (closed today):**
- Migrated from Supabase JWT keys to opaque key system
- All hardcoded JWT fallbacks stripped from source
- JWT-based API keys disabled in Supabase project
- Leaked `service_role` JWT permanently revoked
- New keys: `sb_publishable_*` (Netlify env var, GitHub Actions secret, `public/index.html`), `sb_secret_*` (local admin scripts only, never deployed)

---

## 9. Roadmap priorities (in order)

1. **Run `supabase-migration.sql`** — adds `cueing_flag` columns. ~5 min.
2. **Run `revet.js --apply`** — classify the ~172 existing rows for anti-cueing violations. ~15–30 min.
3. **Bulk-approve clean rows** — SQL to flip cueing-clear rows to `is_approved=true`.
4. **Build the DB-first RPC (`serve_next_mcq`) + frontend hybrid** — drops user latency from 22s to ~0.1s for 95% of calls. Highest UX-impact item on the roadmap. ~1–2 hours.
5. **No-signup demo mode** — let prospective subscribers try a question without creating an account.
6. **30-fellow outreach** — measure willingness-to-pay before further engineering.
7. **Bulk-generate fresh batches** under tightened guardrails (target: 80–100 approved per level).
8. **Spaced-repetition engine v2** — Q4 2026.
9. **Mobile PWA optimization** — Q4 2026.

---

## 10. Coding conventions

- **No build step on frontend.** `public/index.html` is the deployed file. Edits to it are immediately live after Netlify auto-deploy.
- **Env vars are required, not optional.** All Netlify functions and scripts must fail-fast (`throw new Error(...)`) if `SUPABASE_URL` or `SUPABASE_ANON_KEY` is unset. Never use `|| "fallback-value"` for secrets.
- **Brand colors:** Navy `#002868`, Gold `#C9A84C`. Used consistently across UI.
- **Disclaimers required** on any user-facing content: "educational use only, not medical advice."
- **Pending → approved gate is non-negotiable.** No row ever serves to users with `status != 'approved'`.
- **Single-purpose commits.** Security commits should not include feature work and vice versa.

---

## 11. Security

- **Never paste secrets back into chat.** Even after revocation, hygiene matters.
- **`sb_secret_*` keys are local-only.** Never commit, never deploy, never embed in client code.
- **`sb_publishable_*` is safe in client code** (that's literally what "publishable" means in Supabase's model).
- **RLS protects everything** — but the secret key bypasses RLS, which is why it cannot ship to clients.
- **Stripe URLs in source are safe:** `billing.stripe.com/p/login/*` and `buy.stripe.com/*` are public by design.
- **Anthropic/Gemini API keys** live in Netlify env vars only.

If a credential is ever exposed: rotate first, audit second, never paste the leaked value back into any chat or issue.

---

## 12. Known gotchas

- **Netlify function timeout is 26 seconds.** Current AI generation runs 19–25s. Cold starts add 1–3s. First call after deploy almost always fails or runs slow. Once DB-first ships, this becomes a non-issue for 95% of calls.
- **Cold-start "Unable to reach QBank" errors** are almost never auth issues — they're function timeouts. If you suspect auth, look for `<1 second` failures with `401`/`403` codes in the browser console. Timeouts after 26+ seconds are infrastructure, not auth.
- **`public/index.html` line 39** holds `SB_KEY` as a constant — this is the publishable key. Frontend cannot read `process.env`, so the key is necessarily hardcoded here. This is by design and secure.
- **The base64 headshot on line ~388 of `public/index.html`** is ~100KB embedded as a data URI. Don't accidentally select it during edits. Moving it to a separate `.jpg` file is a small future optimization but not a priority.
- **Validator rejections during bulk-generate are a feature, not a bug.** Look for `[validateConsistency] Mismatch` etc. in logs — those rows were correctly killed before they could pollute the bank.

---

## 13. Sequencing principle

When in doubt, follow this order:

1. **Schema first** — DB changes before code changes that depend on them.
2. **Server-side second** — Netlify functions and bulk scripts.
3. **Frontend last** — `public/index.html` only after server is verified.
4. **Production-deploy validation always** — smoke test in a private/incognito window after every deploy. Pass = question loads, choices render, explanation appears. Fail = roll back via Netlify Deploys → Publish previous deploy.

---

## 14. Founder voice and product positioning

- Tone: senior attending walking a junior through a high-yield case. Clinically rigorous, never condescending.
- Position: academic-credibility-first (founder's titles and program director role lead). Not flashy. Not gamified.
- Compete on: Endocrinology depth, clinical rigor, price.
- Do NOT compete on: breadth, flashcard volume, gamification, social features.

---

*End of CLAUDE.md*
