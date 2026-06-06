# CLAUDE.md — MedBoard Pro

> Project context for Claude. Read this before making any changes to the codebase.

> Last updated: **June 6, 2026** — **Cardiorenal SGLT2i-deprioritization guardrail shipped** (commits `c260ad1` L2 + `4e7e0e2` L1): L1 `TOPIC_GUARDRAILS` anchor (SGLT2i = Class I for HFrEF, initiated to eGFR 20, potassium-neutral; cardiorenal indications T2D-specific) + `flagCardiorenalMiskey` warn-mode validator (H1 HFrEF-keys-GLP-1-over-SGLT2i; H2 false-hyperkalemia rationale), both files parity, no banner bump. Backtest recall 3/3; approved-bank FP 0 H1 / 1 benign H2. **2026-06-06 full Endo triage:** fresh batch (14, guardrail-live, 0 cardiorenal warns) + backlog (37) cleared across 3 tranches — 30 promoted, 17 rejected (2 cardiorenal mis-keys, soft single-bests, near-dups, phantom-citation/clinical-error items); **Endo servable 163→201, pending → 0, ~175 flip target MET**; total 346→406. **Prior (June 5) — v7.5.16:** Endocrine Society 2012 added to citation allow-list (real ES MEN1 CPG — Thakker, JCEM 2012); **v7.5.15:** interchangeable-agent validator tuning. Endo tail-cluster triage (CGM/AID, Hashimoto's, Male Hypogonadism, thyroid/Ca): 14 promoted (incl. 5 citation/terminology repoints — 3 phantom "2024 ES" survivors purged), 4 rejected (T1D-finerenone, Klinefelter-mislabel, sorafenib-renal-error, SGLT2i-K⁺-error); Endo 110→141, total 315→346. **Prior (June 4):** Endo pending-triage: 6 clusters dispositioned (GLP-1, Cushing, PCOS, Type 1 Insulin, Hyperthyroid/Graves, Osteoporosis); Endo 84→110 servable, total 289→315. **SURPASS-CVOT (NEJM 2025) clinical-canon shift** recorded (tirzepatide CV data — "lacks CVOT" items now stale; servable `6cf8c36d` fixed). Prior (June 3): Pituitary Society 2023 added to the citation lock; §4 threshold table repaired. **v7.5.12 (2026-06-02):** PA citation repointed to ES 2025 (Adler) + `validateNoPhantomCitations` phantom-citation hard block added. Prior (May 31): B3 topic-distribution control shipped; D1 closed; citation lock complete. **Lipid canon refreshed in place:** lipid `TOPIC_GUARDRAILS` + citation-map rewritten to the **2026 ACC/AHA/Multisociety Dyslipidemia Guideline + AACE 2025**; the **2018 Grundy citation retired**.
> Generators at **v7.5.16** (2026-06-05; +ES-2012 citation allow-list, +`flagInterchangeableAgents` tuning), **+cardiorenal SGLT2i guardrail (2026-06-06: L1 anchor + `flagCardiorenalMiskey` warn-mode, no banner bump)**. Prior **v7.5.13** (2026-06-03; +2a lead-in allow-list, +2b choices minLength).

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
│   └── bulk-generate.js        # Batch MCQ generator run via GitHub Actions (v7.5.x)
├── .github/
│   └── workflows/              # Bulk MCQ Generator workflow lives here
├── supabase-migration.sql      # cueing_* migration (historical)
├── README.md
└── CLAUDE.md                   # This file
```

**Critical:** the frontend is Babel-in-the-browser JSX with **no build step**. Every change is the deployed change.

**Patch workflow:** generator edits use self-contained Python scripts that anchor on a unique byte-exact string, assert the occurrence count before editing (abort-before-write if the anchor is wrong), and are idempotent. Run from the **repo root** (`python3 patch.py`), `node --check` both files, `rm` the script, commit. Do NOT paste large heredocs into the Codespaces web terminal — they char-mangle; create the file (or use a quoted `<<'EOF'` heredoc) instead. Browser uploads of `.py` scripts sometimes land in `.github/workflows/` or get renamed `name (1).py` — `find` + `mv` to root before running. **Doc edits:** apply CLAUDE.md updates as a patch *script* (or in-editor find/replace) — do NOT paste the Python `EDITS` list literally into the markdown (corrupted the file once on 2026-06-06; rebuilt clean).

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

Key columns: `id` (uuid PK), `exam_level`, `topic`, `stem`, `choices` (jsonb), `correct_answer`, `explanation`, `created_at`, **`status`** (authoritative approval column; CHECK allows `draft` | `pending_review` | `approved` | `rejected` | `retired` | `re_audit` — `re_audit` added 2026-05-31, see §12), `specialty_group`, `blueprint_tag`, `difficulty`, `reviewed_at`, `reviewed_by` (**uuid** — never write `'admin'`; generally NULL), `generation_model` (e.g. `claude-sonnet-4-6`; populated per-row since C2; NULL on pre-C2 rows), `content_hash` (hash-only dedup — does NOT catch semantic near-dupes), `times_served`, `updated_at`, **`approval_status`** (**deprecated** parallel column — see §12), `cueing_flag` (**boolean**), `cueing_notes`, `cueing_checked_at`.

Deprecated / drop-candidates (future migration, not urgent): `quality_score`, `flagged_reason`, the `cueing_*` trio. **`approval_status` is no longer a clean drop candidate** — the re-audit workstream repurposes it as a provenance marker (see §12); do not drop it while the re-audit is active.

`user_responses` tracks each user's answered `mcq_id` (used by `serve_next_mcq` to exclude seen rows). RLS enabled; publishable key respects RLS, secret key bypasses it.

-----

## 6. Clinical accuracy standards (the most important section)

Enforcement lives in `generate-mcq.js` and `scripts/bulk-generate.js`, sharing an identical `TOPIC_GUARDRAILS` array, an `integrityRules` block (A–M), and a validator stack.

### TOPIC_GUARDRAILS
- **L1 — Foundational Anchors:** hard clinical facts (thresholds, named trials, guideline years, contraindications, formulas).
- **L2 — Cognitive Complexity:** forbids Tier 1–2 trivia; requires Tier 3+ angles.

### Clinical anchors locked
DKA/HHS (K⁺-before-insulin) · Hypoglycemia/Insulinoma (proinsulin pmol/L; Whipple) · Thyroid storm (ATA 2016; **PTU contraindicated in hepatic disease → methimazole, rectal route if oral unreliable**; iodine ≥1 h after thionamide) · Adrenal incidentaloma (AACE/ESE 2023) · Subclinical hypothyroidism (TRUST) · LT4 dosing · **DI / posterior pituitary** (water deprivation contraindicated when Na > 145 / osm > 295–300; hypertonic-saline-stimulated copeptin [Fenske 2018] for indeterminate cases; lithium NDI → amiloride) · **Adrenal insufficiency** (no reliable biochemical GC marker; clinical titration; ES 2016 Bornstein) · **Post-stroke anticoagulation timing** (EHRA 1-3-6-12 vs ELAN 2023 / AHA-ASA 2024) · **Dyslipidemia / lipid-lowering** (2026 ACC/AHA/Multisociety Dyslipidemia Guideline — RETIRES & REPLACES the 2018 Blood Cholesterol Guideline; risk-based LDL-C goals: very-high-risk ASCVD <55, ASCVD <70; PREVENT replaces Pooled Cohort Equations ages 30–79; universal Lp(a) screening. AACE 2025 [Patel/Wyne] = GRADE nonstatin focused update; PREVENT governs on conflict. The 2018 guideline is BANNED). · **Primary Aldosteronism** (ES 2025 Adler et al. — RETIRES & REPLACES the 2016 Funder CPG; spironolactone preferred; MRAs preferred over ENaC inhibitors; CT + AVS before deciding medical vs surgical). · **Cardiorenal (T2D) — SGLT2i vs GLP-1** (SGLT2i [empagliflozin, dapagliflozin] = Class I for HFrEF [EMPEROR-Reduced, DAPA-HF], initiated to eGFR 20; potassium-neutral to K-lowering — do NOT cause hyperkalemia; reduced glycemic efficacy below eGFR 45 does NOT remove the HF/cardiorenal indication; prefer SGLT2i over a GLP-1 RA for the HF indication. Finerenone / SGLT2i-glycemic / GLP-1-renal indications are T2D-specific — never extrapolate to T1D).

### Integrity rules A–M
A–H pre-existing (H = anti-cueing). I/J/K = v7.5.6 ABIM canon. **L** = lab-value reproduction lock; **M** = single-best-answer discriminator.

### Validator stack
`detectAntiCueingViolation`, `validateConsistency` (stem↔explanation lab mismatch backstop), `validateDemographics`, `validateChoiceCompleteness`, the v7.5.6 canon validators (`validateLeadInType` etc.), and **`validateCitationYears` + `ALLOWED_GUIDELINE_CITATIONS`** (per-society allow-list; inspects years within ~25 chars of a recognized society token). Plus `checkUnseededCitations` warn-mode (`WARN_GUIDELINE_TOKENS`) — non-blocking "verify edition" flag, wired on both paths. Plus **`validateNoPhantomCitations` + `BANNED_CITATION_PATTERNS`** (v7.5.12) — HARD reject gate for fabricated/superseded (society, year, *topic*) tuples the per-year list can't catch (ES Primary Aldosteronism ≠ 2025; Funder 2024; ES 2024 pheo incl. SDHx/MIBG); Bornstein-2016 PAI and Lenders-2014 pheo intentionally pass. Plus **`flagCardiorenalMiskey`** (warn-mode, both paths; 2026-06-06) — non-blocking surfacing of the SGLT2i-deprioritization mis-key class (H1 HFrEF stem keying a GLP-1 RA over an offered SGLT2i; H2 explanation asserting SGLT2i cause hyperkalemia); see §12.

> Wiring differs: gen-mcq chains validators with `&&`; bulk uses guard-clause `return recordDrop("name")` (the C1 drop-reason tally) and adds `dropTally._warnCardiorenal` / `_warnInterchange` warn counters. In bulk, citation runs before anti-cueing (anti-cueing is dead last — its drops can be masked; re-evaluate ordering with multi-batch data, don't reorder blind).

### Citation lock — COMPLETE (closed May 29)
Per-society allow-list with bounded rolling windows for annual bodies; verified to publication year for episodic bodies; warn-mode for un-promoted bodies. Final map (both files, byte-identical): Endocrine Society {2008,09,12,14,16,18,22,24,25} · ATA {2014,15,16,17,25} (2024 rejected) · AACE {2020,22,23,25,26} · ESE {2018,23,24} · ADA {2024,25,26} · AHA {2017–2026} · ASA {2018,19,21,22,26} · KDIGO {2021,22,24,25} · GOLD {2024,25,26} · GINA {2024,25,26} · EULAR {2022,23} · ACR {2017,23} · EHRA {2021} · Jonklaas {2014} · Pituitary Society {2023}. Warn-mode: USPSTF, ACG, AASLD, AGA, ASH, IDSA, SSC, ASPEN, ATTD, ASAS. `CITATION_LOCK_ENFORCE = true`. **Note:** Endocrine Society **2011 is intentionally NOT seeded** (founder decision). Prolactinoma rows cite the **2023 Pituitary Society International Consensus** (Petersenn et al.). Two open items: (1) no `ACC` society token — alias `ACC → AHA` window or write lipid citations as "AHA"; (2) confirm seeded `AACE 2026` maps to a real document — AACE's dyslipidemia guideline is **2025**, so a bare "AACE 2026" lipid citation is phantom-risk. **PA refresh (v7.5.12):** ES Primary Aldosteronism repointed from superseded 2016 Funder to **2025 Adler et al.** `validateNoPhantomCitations` closes the (society, year) vs *topic* gap.

### Forbidden stem patterns
"First step / next step / best fluid" Tier-1 trivia · stems contradicting their own explanation · 4-obviously-wrong choices (cueing) · NOT/EXCEPT/LEAST lead-ins · gratuitous race/demographic descriptors (Rule I) · "all/none of the above."

-----

## 7. Workflows

### Single question (user-facing)
Frontend → `serve_next_mcq` (DB-first). No-match → `generate-mcq.js` → Claude/Gemini → insert `status: pending_review`. Newly generated rows are **never served until vetted.**

### Bulk generation (admin)
GitHub → **Actions** → **Bulk MCQ Generator** → run with `Count`, `Level` (specific or blank for round-robin), `Mode: standard`. Confirm the banner version in the log before vetting a batch. Summary prints `Saved to DB: N`, `DB errors: M`, the **C1 validator-drop breakdown** by reason, gen-failures, and unseeded-citation/cardiorenal/interchangeable warns.

**B3 topic-distribution control (v7.5.9):** `buildWorkQueue` draws **without replacement** — shuffles the distinct `{level, topic}` concepts and emits round-robin, so each concept appears at most `ceil(count / N_concepts)` times, evenly spread. Replaces the old weighted-with-replacement sampler. **Smoke-confirmed May 30** and again 2026-06-06 (Endo fresh batch of 14 = 14 distinct topics, zero repeats). B3 spreads at the *topic* level; semantic near-dupes *within* a topic remain the job of a future semantic-dedup pass.

### Vetting (manual, SQL-driven)
`status` is authoritative. Safe approval write (mirrors the deprecated column harmlessly):
```sql
UPDATE mcqs SET status='approved', approval_status='approved', reviewed_at=now() WHERE id='<row_id>';
```
Reject mirrors with `'rejected'`. Bulk-approve a fresh batch by scoping `created_at > now() - interval '2 hours' AND status='pending_review'`. **Always run a WHERE-clause verification SELECT (using a unique stem substring) before any UPDATE.** Partial-UUID matching: `id::text LIKE 'prefix%'`. Multi-statement UPDATE+SELECT only echoes the final statement — issue verification SELECTs separately.

-----

## 8. Current state (as of June 6, 2026)

### Question bank — servable

| Level | Servable | ~Flip target | Gap |
|---|---|---|---|
| ABIM Endocrinology | 201 | ~175 | **met** |
| ABIM Internal Medicine | 148 | ~165 | ~17 |
| USMLE Step 1 | 22 | ~150 | ~128 |
| USMLE Step 3 | 19 | ~150 | ~131 |
| USMLE Step 2 CK | 16 | ~180 | ~164 |
| **Total servable** | **406** | | |

> 406 = `status='approved' AND cueing_flag IS NOT TRUE` = servable. Verified live 2026-06-06. **2026-06-06:** Endo 141→201 servable (fresh batch of 14 + full backlog triage of 37 across 3 tranches), total 346→406; **Endo pending 41→0 — backlog fully cleared.** **ABIM Endocrinology ~175 flip target MET (201).** Cardiorenal guardrail shipped; first live read clean (0 warns on the fresh batch); 17 backlog rows rejected (2 cardiorenal mis-keys, soft single-bests, near-dups, phantom-citation/clinical-error items). `re_audit` cohort empty.

Pending (not servable until vetted): **Endo 0 — backlog fully cleared 2026-06-06.** Step1 14 / Step3 9 / Step2CK 11. IM pending = 0. Triage rule in force: **keep ≤2 distinct sub-angles per concept.** Two heavily-seen reject classes: (a) "two co-valid agents" soft single-best (see §12) and (b) **mis-keyed** items where the labs/organ/guideline-rank contradict the keyed answer (need a human clinical read; no validator catches them — `flagCardiorenalMiskey` now warn-flags the SGLT2i/HFrEF subclass).

### Generators
Generators at **v7.5.16** (2026-06-05; +ES-2012 citation allow-list, +`flagInterchangeableAgents` tuning), **+cardiorenal SGLT2i guardrail (2026-06-06: L1 anchor + `flagCardiorenalMiskey` warn-mode, no banner bump)**, prior **v7.5.13** (2026-06-03; +2a lead-in allow-list, +2b choices minLength). B3 shipped + smoke-confirmed. Citation lock complete. C1 (drop-reason breakdown) + C2 (`generation_model` per-row) shipped. **Generation outage fixed** (`BULK_CLAUDE_MODEL` use-before-declare → declared at module scope, line 68). Error-surfacing patch live (catch blocks log HTTP status + body + per-attempt cause) — keep it.

### Lead funnel (Option A — LIVE May 30)
`medboard-widget.js` v1.1 deployed: **email gate removed** — answering reveals the full explanation + "Start your free trial" CTA immediately. UTM tags intact. Email-capture machinery (`capture-lead.js`, `leads` schema) is **parked, not deleted**. Landing page picks this up automatically.

### Security posture (closed May 16)
Opaque keys; JWT fallbacks stripped; leaked `service_role` JWT revoked. `sb_publishable_*` client-side; `sb_secret_*` local admin only.

-----

## 9. Roadmap priorities (in order)

1. **Endo pending-triage — COMPLETE 2026-06-06** (servable 201; pending 0; ~175 flip target MET, backlog fully cleared). Next: a moderate Endo generation run can deepen the bank (≤2 sub-angles/concept; triage each batch, never onto an untriaged backlog).
2. **Staged IM bulk generation** (B3 confirmed; smoke gate clear): moderate batches (count 20–30), vet to keep pace; new rows = `pending_review`. IM is the next threshold target (148 → ~165).
3. **Staged USMLE generation** (Step 1/2CK/3 are far from threshold): round-robin or per-level batches.
4. **Rewrite held items:** `425cf587` (NIPHS), `a660f8af` (LT4 + fabricated ATA 2025), `93191d92` (TCA + bicarbonate).
5. **Disposition edge-case rows:** bank-wide `rejected/approved` column-mismatch pair still open; excluded from serving.
6. **Image integration Phase 1 decision** — fold `requires_image`/`image_spec` flagging into a release, or defer (`IMAGE_INTEGRATION_PLAN.md`). Does NOT block MVP.
7. **Promote `flagCardiorenalMiskey` to hard-reject** only after ≥2 batches of warn-mode data; build sibling `flagT1DCardiorenal`.
8. Continue bulk generation toward thresholds · No-signup demo mode · 30-fellow willingness-to-pay outreach · trial-cancellation survey.
9. Spaced-repetition v2 · Mobile PWA — Q4 2026.

### Tail-cluster / backlog triage learnings
- **Phantom *survivors*.** Repointing an item's *primary* citation does NOT clean phantoms in individual choice rationales — grep the *entire* explanation for every society token when repointing. Fabricated-society×year tuples that pass the year-list (e.g. "2024 ES" adrenal/pheo guidelines, "ES 2024 pheo," "ES 2023 hypercalcemia") recur; verify society×topic×year against primary sources.
- **T1D cardiorenal extrapolation = recurring invalid class.** Finerenone (FIDELIO/FIGARO), the SGLT2i glycemic indication, and GLP-1 renal indications are **T2D**; generators fabricate "regardless of T1D vs T2D." Backlog guardrail candidate: `flagT1DCardiorenal`.
- **SGLT2i-deprioritization mis-key (2026-06-06).** Keying a GLP-1 RA over an available SGLT2i in HFrEF, justified by a false hyperkalemia claim or the irrelevant sub-eGFR-45 glycemic argument — now warn-flagged (`flagCardiorenalMiskey`); 2 backlog instances rejected (`ccae9922`, `dd4e9fb4`).
- **Insulinoma vs PBH sequencing errors.** Post-bariatric hypoglycemia (PBH) → diet + acarbose first (NOT SACST/surgery — that is the insulinoma path; PBH is diffuse, SACST misleads). Insulinoma localization: CT/MRI → EUS → SACST (don't skip EUS); **68Ga-DOTATATE is unreliable for insulinoma** (SSTR2-poor). Renal angiomyolipoma is a TSC feature, NOT MEN1.
- **X-ALD causes adrenal ATROPHY, not enlargement** — a seronegative-PAI-in-a-male → VLCFA item keyed to "bilateral enlargement" was rejected (mismatch).
- **"Two co-valid agents" soft single-best** — recurring; see §12.

-----

## 10. Coding conventions

- **No build step on frontend.** Edits to `index.html` / `public/index.html` are immediately live.
- **Env vars required, not optional.** Fail-fast (`throw`) on missing secrets; never `|| "fallback"`.
- **Brand colors:** Navy `#002868`, Gold `#C9A84C`. (See `MEDBOARD_DESIGN.md`.)
- **Disclaimers required** on user-facing content: "educational use only, not medical advice."
- **Approval gate is non-negotiable.** No row serves with `status != 'approved'`.
- **`status` is authoritative (D1 closed — option b).** Serve gates on `status` only. Mirror `approval_status` on approvals (harmless, future-proof). Do NOT introduce new logic that reads `approval_status` for serving.
- **Generator parity mandatory.** Diff `TOPIC_GUARDRAILS` / `integrityRules` / `ALLOWED_GUIDELINE_CITATIONS` after every edit. (Bulk-only changes like B3 are exempt by design.)
- **Supabase grant convention (Oct-2026):** every migration creating a table/function in `public` MUST include explicit `GRANT` statements in the same migration. Prefer `SECURITY INVOKER` unless there's a clear reason for DEFINER.
- **Single-purpose commits.** Security ≠ feature ≠ guardrail ≠ docs.

-----

## 11. Security

- Never paste secrets back into chat. `sb_secret_*` = local-only. `sb_publishable_*` safe client-side. RLS protects everything; secret key bypasses it. Stripe `billing.stripe.com/p/login/*` + `buy.stripe.com/*` are public by design. Anthropic/Gemini keys in Netlify env vars only. `capture-lead.js` uses `SUPABASE_SERVICE_ROLE` server-side only. If a credential leaks: rotate, audit, never paste it.

-----

## 12. Known gotchas

### "Two co-valid agents" soft single-best (generator defect)
The generator routinely offers two interchangeably-labeled agents from the same class as separate options when the stem cannot distinguish them → unanswerable single-best (Rule M). Confirmed instances: **SGLT2i** dapa vs empa; **basal insulin** degludec vs glargine U-300; **anabolic osteoporosis** romosozumab vs teriparatide; **Cushing steroidogenesis inhibitors** metyrapone vs osilodrostat. `flagInterchangeableAgents` (warn-mode) surfaces these. **Guardrail:** for "select the agent" stems, the choice set must contain at most ONE member of an interchangeable class **unless the stem encodes the tie-breaking feature** — e.g., SGLT2i eGFR 20–25 window (dapa ≥25, empa ≥20); QTc → metyrapone (osilodrostat/keto/pasireotide prolong QT); CKD-with-albuminuria → semaglutide (FLOW) over tirzepatide.

### SGLT2i-deprioritization mis-key (warn-mode flagged — shipped 2026-06-06)
A clinically-wrong-but-validator-invisible key class, adjacent to the T1D cardiorenal-extrapolation note (§9): the generator keys a GLP-1 RA over an available SGLT2i in an HFrEF/CKD stem, justified by a **false** "SGLT2i cause/worsen hyperkalemia" claim or the **irrelevant** "SGLT2i lose glycemic efficacy below eGFR 45" argument. In HFrEF, SGLT2i is **Class I** (EMPEROR-Reduced/DAPA-HF), initiated to eGFR 20, regardless of glucose; GLP-1 RAs reduce ASCVD events but **not** HF hospitalization; SGLT2i are potassium-neutral to K-lowering. **`flagCardiorenalMiskey`** (warn-mode, both paths; mirrors `flagInterchangeableAgents`, never drops): **H1** HFrEF stem + an SGLT2i offered + the keyed answer is a GLP-1 RA; **H2** `SGLT2[^.]{0,60}hyperkalem` proximity in the explanation. Warns print via `console.warn` on both paths; bulk also increments `dropTally._warnCardiorenal`. **L1 generation anchor** added to the T2D management guardrail (the rate-reducer). Backtest 2026-06-06 (whole approved bank + node unit test): recall 3/3 (`ec94b12a`, `c6714248` → H1; `12f5f085` → H2); approved-bank false positives **0 (H1) + 1 benign (H2)** — `32278205`, a correct MRA-attribution sentence (expected warn noise). **First live read (2026-06-06 fresh batch of 14): 0 warns** — the L1 anchor steered generation away from the mis-key. **Warn-mode only for ≥2 batches** before any hard-reject decision. Sibling `flagT1DCardiorenal` (finerenone/SGLT2i/GLP-1 keyed in a T1D stem) is the next candidate. The 2 backlog instances `ccae9922` and `dd4e9fb4` were **rejected 2026-06-06**.

### Citation phantoms (generator/doc pass before next gen run)
Recurring fabrication class. Purge/repoint in both generators (parity) and `validateNoPhantomCitations`/`BANNED_CITATION_PATTERNS`:
- **"2024 ES Cushing CPG"** / **"2024 ES Adrenal Incidentaloma"** — do not exist. Real: ES Cushing **tx 2015** / **dx 2008**; **Pituitary Society 2021** (Fleseriu); **ESE/ENSAT 2023** (Fassnacht).
- **MEN1 "2022 consensus (Thakker)"** — does not exist. Real: **Thakker, JCEM 2012** + **AACE 2025** MEN1 consensus.
- **"AACE 2025 Osteoporosis"** — does not exist. Real: **AACE/ACE 2020** (Camacho).
- **"2024 ATA" hyperthyroidism** — mis-dated. Real: **ATA 2016** (Ross) + **ATA 2017** pregnancy.
- **"ES 2024 pheo guideline"** — does not exist. Real: **ES 2014** (Lenders). (Caught one 2026-06-06: `9dafb7d2` repointed 2024→2014.)
- **"ES 2023 hypercalcemia guideline"** — does not exist; use NCCN + expert consensus. (Caught 2026-06-06: `3ba74bed`.)
- **"2024 ES adrenal-insufficiency guideline"** — the ES AI CPG is **2016 (Bornstein)**. (Drove a 2026-06-06 reject.)
- **ADD: SURPASS-CVOT** (Nicholls, NEJM 2025) to canon — "tirzepatide lacks CVOT" is now stale.

### `approval_status` deprecated — `status` authoritative (D1 RESOLVED May 30, option b)
Both serve functions gate on `status`. `approval_status` is stale; legacy rows are inconsistent across the two columns. The 2-of-2 gate was rejected (footgun). Edge-case rows (`status='rejected'` + `approval_status='approved'`) are excluded from serving — disposition pending.

### Re-audit workstream (OPENED 2026-05-31)
Premise: `status='approved'` reflects sign-off under *older* guardrails. Migration `add_re_audit_to_mcqs_status_check` expanded the CHECK to include `re_audit`. **Demotion** sets `status='re_audit'`, preserves `approval_status='approved'` (cohort = `WHERE status='re_audit' AND approval_status='approved'`); removes from serving immediately. Lifecycle out: re-certified → `status='approved'`; unsalvageable → `rejected`. Per-row dispositions in `RE_AUDIT_LEDGER.md`.

### Frontend — `saveResponse()` row match is fragile
In `index.html`, `saveResponse()` looks up the row by `eq("stem", question.stem)` even though the DB-first path already returns `question.id`. Exact long-text matching is brittle. Fix: use `question.id` directly when `_source === "db"`.

### Generation-outage debugging rule
If a bulk run returns 0, **read the surfaced HTTP cause first** and check the most recent commit that touched the generation path **before** suspecting keys/billing. The May-29 outage was a `ReferenceError`, not the API.

### Other
- Netlify function timeout = 26s; gen runs 19–25s. Off the critical path now (DB-first serves ~95%).
- `index.html` / `public/index.html` line ~39 holds `SB_KEY` (publishable) as a constant — by design.
- Base64 headshot ~line 388 is ~100KB; don't select it during edits.
- `reviewed_by` is **uuid**, never `'admin'`. `cueing_flag` is **boolean**.
- **Watch the aldosterone consistency-rejection rate** — Rule L isn't fully landing on aldosterone values; `validateConsistency` is the backstop.
- **`content_hash` dedupes exact stems only** — semantic near-dupes within a topic survive (real fix = semantic dedup, backlog).
- **±25-char citation-window** takes the FIRST year in range → adjacent citations can mis-attribute (backlog).

### Doc/file drift (cleanup)
- `INTEGRATION.md` documents the widget at `/widget/medboard-widget.js`; it is actually live at the root `/medboard-widget.js`.
- The leads schema is committed as `Spabase_lead_schema` (typo, no `.sql`).

### Backlog (carry forward)
Model-literal consolidation (fetch bodies hardcode `claude-sonnet-4-6`; point at `BULK_CLAUDE_MODEL`) · guard-order decision (anti-cueing last) · pre-commit parity assertion · pre-C2 `generation_model` backfill (NULL rows → `pre-c2-unknown`) · integrityRules A–J parity diff · semantic dedup · ±25-char citation-window mis-attribution · `flagCardiorenalMiskey` warn→reject promotion after multi-batch data.

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
