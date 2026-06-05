# CLAUDE.md — MedBoard Pro

> Project context for Claude. Read this before making any changes to the codebase.
> Last updated: **June 5, 2026** — **v7.5.16:** Endocrine Society 2012 added to citation allow-list (real ES MEN1 CPG — Thakker, JCEM 2012); **v7.5.15:** interchangeable-agent validator tuning. Endo tail-cluster triage (CGM/AID, Hashimoto's, Male Hypogonadism, thyroid/Ca): 14 promoted (incl. 5 citation/terminology repoints — 3 phantom "2024 ES" survivors purged), 4 rejected (T1D-finerenone, Klinefelter-mislabel, sorafenib-renal-error, SGLT2i-K⁺-error); Endo 110→141, total 315→346. **Prior (June 4):** Endo pending-triage: 6 clusters dispositioned(GLP-1, Cushing, PCOS, Type 1 Insulin, Hyperthyroid/Graves, Osteoporosis); Endo 84→110 servable, total 289→315. **SURPASS-CVOT (NEJM 2025) clinical-canon shift** recorded (tirzepatide CV data — "lacks CVOT" items now stale; servable `6cf8c36d` fixed). Four citation phantoms flagged for the generator pass (see §6). Prior (June 3): Pituitary Society 2023 added to the citation lock; §4 threshold table repaired. **v7.5.12 (2026-06-02):** PA citation repointed to ES 2025 (Adler) + `validateNoPhantomCitations` phantom-citation hard block added. Prior (May 31): B3 topic-distribution control shipped; D1 closed; citation lock complete; generation-outage fix recorded. **Lipid canon refreshed in place:** existing lipid `TOPIC_GUARDRAILS` (l1/l2) and the lipid citation-map entry rewritten to the **2026 ACC/AHA/Multisociety Dyslipidemia Guideline + AACE 2025**; the **2018 Grundy citation retired** (was instructing generation to cite a retired, pre-2023 guideline) and the false "no AACE lipid guideline since 2017" warning corrected.
> Generators at **v7.5.13** (2026-06-03; +2a lead-in allow-list, +2b choices minLength), prior **v7.5.12** (HEAD `71cd081`) — header/banner parity fixed, both files byte-consistent on the conventional-ladder decision; re-audit workstream opened (`re_audit` status added). Prior: v7.5.10 (lipid refresh), v7.5.9 (HEAD `abd3ccd`).

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
│   └── bulk-generate.js        # Batch MCQ generator run via GitHub Actions (v7.5.12)
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
DKA/HHS (K⁺-before-insulin) · Hypoglycemia/Insulinoma (proinsulin pmol/L; Whipple) · Thyroid storm (ATA 2016) · Adrenal incidentaloma (AACE/ESE 2023) · Subclinical hypothyroidism (TRUST) · LT4 dosing · **DI / posterior pituitary** (water deprivation contraindicated when Na > 145 / osm > 295–300; direct DDAVP/copeptin — ESE 2018) · **A1 adrenal-insufficiency replacement monitoring** (no reliable biochemical GC marker; clinical titration; ES 2016) · **A2 post-stroke anticoagulation timing** (EHRA 1-3-6-12 vs ELAN 2023 / AHA-ASA 2024) · **Dyslipidemia / lipid-lowering** (2026 ACC/AHA/Multisociety Dyslipidemia Guideline — **RETIRES & REPLACES the 2018 Blood Cholesterol Guideline**; risk-based LDL-C goals restored: very-high-risk ASCVD <55, ASCVD <70; primary ≥190 → <100 (<70 w/ HeFH·RF·subclinical); 70–189 → <100/<70 by PREVENT; CAC strata <100/<70/<55; **PREVENT replaces Pooled Cohort Equations ages 30–79**; universal Lp(a) screening; apoB/non-HDL-C secondary targets. AACE 2025 [Patel/Wyne, Endocr Pract 2025;31:236–262] = GRADE nonstatin focused update; **PREVENT governs on conflict**. The 2018 guideline is BANNED — retired AND pre-2023). · **Primary Aldosteronism** (ES 2025 Adler et al. — RETIRES & REPLACES the 2016 Funder CPG; spironolactone preferred over other MRAs; MRAs preferred over ENaC inhibitors [amiloride/triamterene]; uncontrolled-on-MRA + suppressed renin → up-titrate the MRA to raise renin; CT + AVS before deciding medical vs surgical).

### Integrity rules A–M
A–H pre-existing (H = anti-cueing). I/J/K = v7.5.6 ABIM canon. **L** = lab-value reproduction lock; **M** = single-best-answer discriminator.

### Validator stack
`detectAntiCueingViolation`, `validateConsistency` (stem↔explanation lab mismatch backstop), `validateDemographics`, `validateChoiceCompleteness`, the v7.5.6 canon validators (`validateLeadInType` etc.), and **`validateCitationYears` + `ALLOWED_GUIDELINE_CITATIONS`** (per-society allow-list; inspects years within ~25 chars of a recognized society token). Plus `checkUnseededCitations` warn-mode (`WARN_GUIDELINE_TOKENS`) — non-blocking "verify edition" flag, wired on both paths. Plus **`validateNoPhantomCitations` + `BANNED_CITATION_PATTERNS`** (v7.5.12) — HARD reject gate for fabricated/superseded (society, year, *topic*) tuples the per-year list can't catch (ES Primary Aldosteronism ≠ 2025; Funder 2024; ES 2024 pheo incl. SDHx/MIBG); Bornstein-2016 PAI and Lenders-2014 pheo intentionally pass.

> Wiring differs: gen-mcq chains validators with `&&`; bulk uses guard-clause `return recordDrop("name")` (14 guards; the C1 drop-reason tally). In bulk, citation runs before anti-cueing (anti-cueing is dead last — its drops can be masked; re-evaluate ordering with multi-batch data, don't reorder blind).

### Citation lock — COMPLETE (closed May 29)
Per-society allow-list with bounded rolling windows for annual bodies; verified to publication year for episodic bodies; warn-mode for un-promoted bodies. Final map (both files, byte-identical): Endocrine Society {2008,09,12,14,16,18,22,24,25} · ATA {2014,15,16,17,25} (2024 rejected) · AACE {2020,22,23,25,26} · ESE {2018,23,24} · ADA {2024,25,26} · AHA {2017–2026} · ASA {2018,19,21,22,26} · KDIGO {2021,22,24,25} · GOLD {2024,25,26} · GINA {2024,25,26} · EULAR {2022,23} · ACR {2017,23} · EHRA {2021} · Jonklaas {2014} · Pituitary Society {2023}. Warn-mode: USPSTF, ACG, AASLD, AGA, ASH, IDSA, SSC, ASPEN, ATTD, ASAS. `CITATION_LOCK_ENFORCE = true`. **Note:** Endocrine Society **2011 is intentionally NOT seeded** (founder decision — real guideline but declined to widen; the lock correctly rejects it). Prolactinoma rows now cite the **2023 Pituitary Society International Consensus** (Petersenn et al., Nat Rev Endocrinol 2023), added to the map above as the modern successor to ES 2011. **Lipid refresh (2026):** the AHA window already spans 2026 and AACE already includes 2025 — **no allow-list *year* change is required**. Two open items: (1) there is no `ACC` society token — alias `ACC → AHA` window or write lipid citations as "AHA"; (2) confirm the seeded `AACE 2026` maps to a real document — AACE's dyslipidemia guideline is **2025**, so a bare "AACE 2026" lipid citation is a phantom-risk and should warn/reject. **PA refresh (v7.5.12, 2026-06-02):** ES Primary Aldosteronism repointed from the superseded 2016 Funder CPG to **2025 Adler et al.** (adrenal citation map + PA `TOPIC_GUARDRAILS` l2). No allow-list *year* change (ES 2025 already seeded). The (society, year) list cannot separate a real ES-2024 (GC-induced AI) from a phantom ES-2024 PA/pheo — `validateNoPhantomCitations` closes that gap.

### Forbidden stem patterns
"First step / next step / best fluid" Tier-1 trivia · stems contradicting their own explanation · 4-obviously-wrong choices (cueing) · NOT/EXCEPT/LEAST lead-ins · gratuitous race/demographic descriptors (Rule I) · "all/none of the above."

-----

## 7. Workflows

### Single question (user-facing)
Frontend → `serve_next_mcq` (DB-first). No-match → `generate-mcq.js` → Claude/Gemini → insert `status: pending_review`. Newly generated rows are **never served until vetted.**

### Bulk generation (admin)
GitHub → **Actions** → **Bulk MCQ Generator** → run with `Count`, `Level` (specific or blank for round-robin), `Mode: standard`. Confirm the banner version (`… (v7.5.12)`) in the log before vetting a batch. Summary prints `Saved to DB: N`, `DB errors: M`, the **C1 validator-drop breakdown** by reason, gen-failures, and unseeded-citation warns.

**B3 topic-distribution control (v7.5.9):** `buildWorkQueue` draws **without replacement** — shuffles the distinct `{level, topic}` concepts and emits round-robin, reshuffling when the pool empties, so each concept appears at most `ceil(count / N_concepts)` times, evenly spread. Replaces the old weighted-with-replacement sampler that let high-weight topics recur within a batch (the April clustering `content_hash` couldn't catch). The `FILTER_TOPIC && FILTER_LEVEL` single-topic path and the nutrition-injection hook are preserved. **Smoke-confirmed May 30** (Endo count=10 → 7 saved, 7 distinct concepts across 6 subspecialty groups, zero repeats). Note: B3 spreads at the *topic* level; semantic near-dupes *within* a topic remain the job of a future semantic-dedup pass.

### Vetting (manual, SQL-driven)
`status` is authoritative. Safe approval write (mirrors the deprecated column harmlessly):
```sql
UPDATE mcqs SET status='approved', approval_status='approved', reviewed_at=now() WHERE id='<row_id>';
```
Reject mirrors with `'rejected'`, or `DELETE`. Bulk-approve a fresh batch by scoping `created_at > now() - interval '2 hours' AND status='pending_review'`. **Always run a WHERE-clause verification SELECT (using a unique stem substring) before any UPDATE.**

-----

## 8. Current state (as of June 1, 2026)

### Question bank — servable

| Level | Servable | ~Flip target | Gap |
|---|---|---|---|
| ABIM Internal Medicine | 148 | ~165 | ~17 |
| ABIM Endocrinology | 141 | ~175 | ~34 |
| USMLE Step 1 | 22 | ~150 | ~128 |
| USMLE Step 3 | 19 | ~150 | ~131 |
| USMLE Step 2 CK | 16 | ~180 | ~164 |
| **Total servable** | **346** | | |

> 346 = `status='approved' AND cueing_flag IS NOT TRUE` = servable. Verified live 2026-06-05 PM-2 (tail-cluster triage: +14 promote, −4 reject; keeper `994f0def` AFF now applied). Prior 315 verified 2026-06-04. This session: 6 Endo clusters triaged (GLP-1, Cushing, PCOS, Type 1 Insulin, Hyperthyroid/Graves, Osteoporosis) — 26 promoted, 24 rejected; Endo 84→110, Endo pending 139→89. Plus servable `6cf8c36d` fixed in place (SURPASS-CVOT staleness). Keeper `994f0def` (AFF) applied 2026-06-05. `re_audit` cohort empty.

Pending (not servable until vetted): **Endo 41** (tail clusters CGM/AID, Hashimoto's, Male Hypogonadism, thyroid/Ca triaged 2026-06-05; 4 rows held for founder decision: `b7b5bf5b`, `26edb833`, `4de2771d`, `69797382`), plus Step1 14 / Step3 9 / Step2CK 11. IM pending = 0. Remaining Endo clusters by size: Prolactinoma 7, Hypopituitarism 6, Thyroid Storm 6, Acromegaly 5, Adrenal Insufficiency 5, CGM/AID 5, Hypothyroidism/Hashimotos 5, Male Hypogonadism 5, then the DI/parathyroid/insulinoma/thyroid/MEN tail. Triage rule in force: **keep ≤2 distinct sub-angles per concept.** Two reject classes seen heavily this session: (a) "two co-valid agents" soft single-best (see §12) and (b) **mis-keyed** items where the labs/organ/guideline-rank contradict the keyed answer (need a human clinical read; no validator catches them).

### Generators
> Generators at **v7.5.16** (2026-06-05; +ES-2012 citation allow-list, +`flagInterchangeableAgents` tuning), prior **v7.5.13** (2026-06-03; +2a lead-in allow-list, +2b choices minLength). Lipid non-statin escalation = corrected **conventional ladder** (the night-log "magnitude-keying" was never built — only the bad bempedoic-before-PCSK9i order was fixed). B3 shipped + smoke-confirmed. Citation lock complete. C1 (drop-reason breakdown) + C2 (`generation_model` per-row) shipped. **Generation outage fixed** (`BULK_CLAUDE_MODEL` use-before-declare introduced by C2 → every bulk run produced 0; declared at module scope, line 68). Error-surfacing patch live (catch blocks log HTTP status + body + per-attempt cause) — keep it; it named the outage in one run.

### Lead funnel (Option A — LIVE May 30)
`medboard-widget.js` v1.1 deployed: **email gate removed** — answering reveals the full explanation + "Start your free trial" CTA immediately (drive trials directly). UTM tags intact. Email-capture machinery (`gateBlock`/`bindGate`/`captureLead`, `capture-lead.js`, `leads` schema) is **parked, not deleted** — for a future non-blocking, post-explanation optional email ask. Landing page picks this up automatically (the `DailyQuestionWidget` React component only injects `/medboard-widget.js`; no `index.html` change needed).

### Security posture (closed May 16)
Opaque keys; JWT fallbacks stripped; leaked `service_role` JWT revoked. `sb_publishable_*` client-side; `sb_secret_*` local admin only.

-----

## 9. Roadmap priorities (in order)

1. **Endo pending-triage — IN PROGRESS** (servable 110; pending 89). 6 of ~13 clusters done (GLP-1, Cushing, PCOS, Type 1 Insulin, Hyperthyroid/Graves, Osteoporosis). Continue cluster-by-cluster down the §8 list (Prolactinoma next), ≤2 sub-angles/concept. Then a moderate Endo generation run to close the residual gap to ~175 (triage first, never onto an untriaged backlog). **Before the gen run:** clear the citation-canon pass (§6) + the interchangeable-agent guardrail (§12).
2. ### Tail-cluster triage learnings (NEW 2026-06-05)
- **Phantom *survivors*.** Repointing an item's *primary* citation does NOT clean phantoms in individual choice rationales — `e6c4928f` kept a "2024 Endocrine Society" subclinical-hypothyroid clause in Choice A after its lead cite was fixed earlier the same day. Grep the *entire* explanation for every society token when repointing. Purged this session: `e6c4928f` (→ATA 2014 Jonklaas), `af368bfc` CHH (→2015 European Consensus, Boehm + 2019 Young, Endocr Rev), `3a054e55` (→ATA 2015 Haugen), `f4d02b48` (→ATA 2017 Alexander pregnancy).
- **T1D cardiorenal extrapolation = recurring invalid class.** Finerenone (FIDELIO/FIGARO), the SGLT2i glycemic indication, and GLP-1 renal indications are **T2D**; generators fabricate "regardless of T1D vs T2D" (`fd981d51` rejected; `6aefa349` rejected earlier same day). Backlog guardrail: flag these agents co-occurring with "type 1 diabetes."
- **RAIR-DTC kinase-inhibitor near-dups with contradictory pharmacology.** Four sorafenib-vs-lenvatinib items clustered; `59cc6125` (rejected) claimed sorafenib is renally cleared/nephrotoxic, while `7262b834` (kept) correctly states it is ~77% fecally excreted. MKI items need a pharmacology anchor + a "structurally-measurable RAIR disease required" rule (`4de2771d` started lenvatinib for Tg-only disease, contradicting `91becbe7`).
- **"Two co-valid agents" (existing gotcha) — new instances:** `12f5f085` (semaglutide vs empagliflozin; also a factual SGLT2i/K⁺ error — rejected) and `69797382` (hCG mono vs combo).

### May-30 smoke findings (RESOLVED — v7.5.13, 2026-06-03).** (a) `most_appropriate_clinical_intervention` added to the ABIM Internal Medicine + ABIM Endocrinology lead-in allow-lists (was over-strict — now parity with Step 2 CK / Step 3). (b) "truncated choice A" = `emit_mcq` schema permitted an empty first option; `minLength:3` added to choices A–E, `validateChoiceCompleteness` remains the hard backstop. **Scaled IM generation gate is CLEAR.**
3. **Staged IM bulk generation** (only after B3 confirmed — done — and #2 resolved): moderate batches (count 20–30), vet to keep pace; new rows = `pending_review`.
4. **Vet the ~35 Endo bulk candidates** (50 → up to ~85). Expect SGLT2i/hypoglycemia clustering (predate B3).
5. **Rewrite 3 held items:** `425cf587` (NIPHS), `a660f8af` (LT4 + fabricated ATA 2025), `93191d92` (TCA + bicarbonate).
6. **Disposition edge-case rows:** IM `pending/rejected` pair resolved (rescued during IM-36). Bank-wide `rejected/approved` pair still open. Excluded from serving; rescue or confirm.
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

### "Two co-valid agents" soft single-best (generator defect — v7.5.x candidate)
The generator routinely offers two interchangeably-labeled agents from the same class as separate options when the stem cannot distinguish them → unanswerable single-best (Rule M). Confirmed instances: **SGLT2i** dapa vs empa (5/11, 2026-06-03); **basal insulin** degludec vs glargine U-300 (2026-06-04 Type 1 Insulin); **anabolic osteoporosis** romosozumab vs teriparatide (Osteoporosis); **Cushing steroidogenesis inhibitors** metyrapone vs osilodrostat (both hepatic, both raise 11-DOC → the 7-item sub-pool even self-contradicted on which agent to key). **Guardrail:** for "select the agent" stems, the choice set must contain at most ONE member of an interchangeable class **unless the stem encodes the specific feature that breaks the tie** — e.g., SGLT2i eGFR 20–25 window (dapa ≥25, empa ≥20); QTc prolongation → metyrapone (osilodrostat/keto/pasireotide prolong QT); CKD-with-albuminuria → semaglutide (FLOW) over tirzepatide.

### Citation phantoms found 2026-06-04 (generator/doc pass before next gen run)
Recurring fabrication class. Purge/repoint in both generators (parity) and `validateNoPhantomCitations`/`BANNED_CITATION_PATTERNS`:
- **"2024 ES Cushing CPG"** and **"2024 ES Adrenal Incidentaloma guideline"** — do not exist. Real: ES Cushing **treatment 2015** / **dx 2008**; **Pituitary Society 2021** (Fleseriu); **ESE/ENSAT 2023** (Fassnacht).
- **MEN1 "2022 consensus (Thakker)"** — does not exist. Real: **Thakker, JCEM 2012** + **AACE 2025** MEN1 consensus.
- **"AACE 2025 Osteoporosis"** — does not exist. Real: **AACE/ACE 2020** (Camacho). (AACE-2025 token is seeded for other docs; ensure the osteoporosis (society, year) tuple is blocked.)
- **"2024 ATA" hyperthyroidism** — mis-dated. Real: **ATA 2016** (Ross) + **ATA 2017** pregnancy (Alexander).
- **ADD: SURPASS-CVOT** (Nicholls, NEJM 2025;393:2409-2420) to the citation canon — tirzepatide CV-outcomes; "tirzepatide lacks CVOT" is now a stale/false claim. Sweep servable + pending for residual stale phrasing.

### `approval_status` deprecated — `status` authoritative (D1 RESOLVED May 30, option b)
Both serve functions gate on `status`. `approval_status` is stale; legacy rows are inconsistent across the two columns. The 2-of-2 gate was rejected (footgun: a promotion that forgets `approval_status` silently de-serves rows). Edge-case rows (`status='rejected'` + `approval_status='approved'`) are excluded from serving — disposition pending.

### Re-audit workstream (OPENED 2026-05-31)
Premise: `status='approved'` reflects sign-off under *older* guardrails, not current-standard compliance — re-certifying the approved bank. Migration `add_re_audit_to_mcqs_status_check` expanded the status CHECK to `draft | pending_review | approved | rejected | retired | re_audit`. **Demotion** sets `status='re_audit'` and **preserves** `approval_status='approved'` (cohort = `WHERE status='re_audit' AND approval_status='approved'`); this removes the row from serving immediately (serving gates on `status='approved'`) and repurposes the deprecated `approval_status` as a provenance marker. Lifecycle out: re-certified → `status='approved'`; unsalvageable → `status='rejected', approval_status='rejected'`. Tier-2 suspicion set = the 122 legacy-format (no emoji-labeled sections) approved rows; thyroid + lipids first. Per-row dispositions in `RE_AUDIT_LEDGER.md`. First two hits demoted 2026-05-31: `fe5ceb27` (Endo thyroid, SEVERE mis-key — rewrite pending) and `102e3b34` (IM lipid HeFH — retired-cite edit pending).

### May-30 smoke findings (RESOLVED — v7.5.13, 2026-06-03)
- **2a `validateLeadInType` — FIXED.** `most_appropriate_clinical_intervention` added to the ABIM Internal Medicine + ABIM Endocrinology Sets in `ALLOWED_LEAD_INS_BY_LEVEL` (was permitted at Step 2 CK / Step 3 only; ABIM is management-heavy and was silently dropping valid intervention-tier items, ~4/14 at Endo). Adjudicated over-strict, not canon. Founder-approved.
- **2b "truncated choice A" — ROOT-CAUSED + HARDENED.** Not a parse bug: the Claude path returns a clean structured object and validation runs pre-shuffle. The `emit_mcq` `choices` schema declared A–E with no `minLength`, so a near-empty first option was schema-valid and the model occasionally stubbed the first slot. `minLength:3` added to A–E as a generation-time nudge (advisory to the model, not API-enforced); `validateChoiceCompleteness` (`<3` chars) remains the hard backstop. Gate CLEAR.

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
