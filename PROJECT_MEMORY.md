# PROJECT_MEMORY.md — MedBoard Pro

> The receipts. Append-only-ish: facts get confirmed, attempts get recorded, the last-session and next-run blocks roll forward.
> Updated: **2026-06-11 (session 2 / PM)** (HEAD `1fadcf7`). Authoritative state is live SQL + GitHub HEAD; this is the carry-forward narrative.

---

## 1. Verified facts

### Live bank state (verified 2026-06-11 via live cross-tab)
| Level | Servable | Pending | Re-audit |
|---|---|---|---|
| ABIM Internal Medicine | 402 | 0 | 0 |
| ABIM Endocrinology | 259 | 0 | 0 |
| USMLE Step 1 | 159 | 0 | 0 |
| USMLE Step 2 CK | 102 | 0 | 0 |
| USMLE Step 3 | 135 | 0 | 0 |
| **Total servable** | **1,057** | | |

All queues 0 bank-wide. (Endo 200→259 this session: 80-row pending batch triaged → promote 59 / reject 21.)

Servable = `status='approved' AND cueing_flag IS NOT TRUE` (canonical). `mcqs` status domain: `draft` · `pending_review` · `approved` · `rejected` · `retired` · `re_audit`.

### Infrastructure (confirmed)
- Repo `antenehzenebe-glitch/medboard-pro`, HEAD `1fadcf7`. Deployed by Dr. Z via Codespaces. Netlify auto-deploys `main`.
- Supabase project `vhzeeskhvkujihuvddcc`. Active key = publishable `sb_publishable_BrMb59PYqV2W7DPbRe_L6g_7I2mqAt_`; legacy anon JWT **disabled**.
- `npm run ci` = check (node --check both generators) + parity (15/15 blocks) + test (7/7 validator unit tests). CI workflow `ci.yml` live.
- Migrations `0001`–`0006` version-controlled in `supabase/migrations/`. `0006_sec_gen_rate_limit.sql` = the S5 per-IP rate-limit RPC. Legacy root `supabase-migration.sql` = historical cueing_* migration.
- Generators carry parity-locked `TOPIC_GUARDRAILS` / `integrityRules` / `ALLOWED_GUIDELINE_CITATIONS`. Bulk-only (not mirrored): B3 sampler, B4/`flagConceptSaturation` dedup, B5 generation cap, `VERIFY_PASS`, S5 handler guard.
- `bulk-generate.yml` exposes `ceiling` (per-(level,topic) servable+pending depth target, default 8) and `mode` (`batch` = Anthropic Batch API, 50% off, ≤24 h SLA). `mode=batch` confirmed real (posts to `/v1/messages/batches` + polls).

### Security posture (verified)
- Five RLS holes found + fixed live + version-controlled (migrations 0001–0005): **S1** blanket `allow_anon_select` (exposed answer keys) → dropped; `serve_next_mcq` made SECURITY DEFINER, fixed search_path. **S2** unconstrained anon INSERT → pinned to `pending_review`. **S3** profiles UPDATE self-grant of `is_admin` → WITH CHECK added. **S4** `fetch_unseen_mcqs` missing cueing gate → added. **S6** excess grants → revoked. DEFINER view `v_approved_mcqs` (exposed all approved rows incl. keys) → anon access revoked.
- **S5 closed (commit `1e6dc23`, migration `0006`):** per-IP rate limit (`check_and_bump_gen_rate`, SECURITY DEFINER, fixed search_path, fail-open on empty IP) + origin allow-list, in the `generate-mcq.js` **handler only** (documented live-only divergence; parity untouched). Defaults: 20 calls/IP/hr; origins `medboardpro.org`,`www`,`*.netlify.app`. Smoke-tested green on all four paths (400/403/200/429). `GENERATE_MCQ_SECRET` correctly left **inert** — a shared secret is wrong for a browser-called endpoint (it would ship client-side).
- **Leaked-password protection ENABLED** (Supabase Pro, $25/mo/org). Advisor lag may still list it — dashboard toggle is authoritative.
- Remaining advisors are **by-design**: SECURITY DEFINER on the gated RPCs (`serve_next_mcq`, `fetch_unseen_mcqs`, `handle_new_user`, `check_and_bump_gen_rate`) = intended funnel pattern; `gen_rate_limit` RLS-no-policy = intentional deny-all.

### Clinical canon locked (real, do NOT flag as fabricated)
- **Dyslipidemia: 2026 ACC/AHA/Multisociety Guideline** retires & **bans** the 2018 Blood Cholesterol Guideline; PREVENT replaces Pooled Cohort Equations (ages 30–79); universal Lp(a) screening; very-high-risk LDL-C <55, ASCVD <70. AACE 2025 (Patel/Wyne) = GRADE nonstatin focused update; PREVENT governs on conflict.
- **Primary aldosteronism: ES 2025 (Adler)** retires & replaces 2016 Funder. Spironolactone preferred; MRAs over ENaC inhibitors; CT + AVS before medical-vs-surgical.
- **Cardiorenal T2D:** SGLT2i (empagliflozin/dapagliflozin) = Class I HFrEF (EMPEROR-Reduced, DAPA-HF), to eGFR 20, K-neutral to K-lowering. Prefer SGLT2i over GLP-1 for the HF indication. Finerenone (FIDELIO/FIGARO/KDIGO), SGLT2i-glycemic, GLP-1-renal are **T2D-specific** — never extrapolate to T1D.
- **SURPASS-CVOT (Nicholls, NEJM 2025):** tirzepatide now has CV data — "tirzepatide lacks CVOT" is stale.
- **ATA 2025 DTC guideline is REAL** (Ringel & Sosa, *Thyroid* 2025;35(8):841-985) — do not flag as fabricated.
- **Severe hypertriglyceridemia (TG >500): fibrate is first-line** for pancreatitis prevention (ES HTG CPG 2012; AACE). **REDUCE-IT excluded TG >500**, so IPE/icosapent has no pancreatitis-prevention evidence there. Choose **fenofibrate** (statin-compatible) over gemfibrozil (statin glucuronidation interaction); dose-adjust at eGFR 30–59, stop <30 (not contraindicated at 38).
- **ACTH-dependent Cushing workup:** after biochemical confirmation (UFC, late-night salivary, non-suppressed ACTH), **pituitary MRI is the next step**; BIPSS only if MRI negative/equivocal. HDDST + CRH stimulation are **de-emphasized** (limited specificity), not the next step.
- **Insulinoma medical therapy:** diazoxide is textbook first-line BUT contraindicated in severe heart failure (Na/water retention) → octreotide LAR is preferred in that setting.
- **Somogyi (posthypoglycemic rebound) is a contested/largely-debunked premise** in the CGM era — reject items resting on it; morning hyperglycemia is usually dawn phenomenon or waning insulin.
- Other locked anchors: DKA/HHS (K⁺ before insulin) · thyroid storm (ATA 2016; PTU contraindicated in hepatic disease → methimazole) · DI/copeptin (no water deprivation when Na>145; Fenske 2018) · adrenal insufficiency (ES 2016 Bornstein, clinical titration) · post-stroke anticoag timing (EHRA 1-3-6-12 vs ELAN 2023 / AHA-ASA 2024) · adrenal incidentaloma (AACE/ESE 2023) · pheo (ES 2014 Lenders) · MEN1 (Thakker JCEM 2012 + AACE 2025) · ES MEN1 CPG (2012).

### Working conventions (confirmed)
- `status` authoritative; `approval_status` deprecated (re-audit provenance only). Promote sets `status/approval_status='approved'`, `reviewed_at=now()`, `reviewed_by` NULL (uuid). Every DB write → verify-SELECT.
- Emoji explanation format (🩺/🚫/💎), forward-only. `content_hash` dedupes exact stems only (semantic near-dups survive → manual/B4).
- Supabase MCP: DDL/policy → `apply_migration`; reads/DO-blocks → `execute_sql` (multi-statement returns only the final result set). RLS attacker-role verification: `set_config('role','anon',true)` inside a DO block with `raise exception` to surface + abort.
- GitHub MCP: reads reliable (`get_file_contents`, `list_commits`, `get_commit detail:full_patch`); **writes 403** (workflow paths + general repo writes). `search_code` lags after push — use commit diffs for immediate verification. All file mods go through Codespaces CLI.

---

## 2. Failed attempts (don't repeat these)

### Bugs that masqueraded as working
- **Cap-8 silent no-op:** every main topic pinned at exactly 8 because `bulk-generate.yml` never forwarded `GEN_CAP_CEILING` to the script. "Fill DB" dispatch was a silent no-op. Fixed `3665d4c`. **Lesson: verify env plumbing reaches the script, not just that the var exists.**
- **`flagCardiorenalMiskey` H1 no-op:** resolved the key from `p.correct_answer` (unset at validation) → never fired. The "≥2 clean batches" had only ever validated H2. Fixed to read `p.correct` (`94e83b2`).
- **B4 was warn-only + stem-only:** couldn't block template-sharing-but-distinct items. Fix added the **key dimension** (`flagConceptSaturation`: stem-similar AND keyed-answer ≥0.40 token-contained), hard-reject, `cb4d40d`.

### Wrong controls / wrong tools
- **S5 shared-secret gate is wrong for a browser endpoint** — the secret would ship client-side. Right control = per-IP rate limit + lenient (fail-open) origin check, because `generate-mcq` is hit by the same-origin `index.html` fallback.
- **Byte-anchor patches fight space-aligned YAML** — env blocks defeat whitespace anchors; full-file rewrite via quoted heredoc instead.
- **Multi-line Python heredocs char-mangle** in the Codespaces web terminal at scale — use file-based patch scripts via the VS Code file explorer.
- **Commit-message version banners are unreliable** proof of what shipped — grep file content / `get_commit` diffs are authoritative.
- **`search_code` returns stale results post-push** — use `get_commit detail:full_patch`.
- **Never trust prior-session diagnoses or log-based counts** without pulling live state first — mid-session DB drift is real (this session: log said all queues 0; live found 80 Endo pending + Step 3 grown to 135).

### Recurring clinical defect classes (the bank's systematic weaknesses)
- **Phantom citations:** fabricated (society, year, topic) tuples that pass year-list validation but fail society×topic accuracy. Confirmed fabrications to purge/repoint: "2024 ES Cushing/Adrenal-Incidentaloma" (real: ES Cushing tx 2015/dx 2008; Pituitary Society 2021; ESE/ENSAT 2023); MEN1 "2022 consensus" (real: Thakker 2012 + AACE 2025); "AACE 2025 Osteoporosis" (real: AACE/ACE 2020 Camacho); "2024 ATA hyperthyroidism" (real: ATA 2016 Ross); "ES 2024 pheo" (real: ES 2014); "ES 2023 hypercalcemia" (use NCCN + expert consensus); "2024 ES adrenal-insufficiency" (real: ES 2016 Bornstein); acromegaly "Endocrine Society 2025" (real: ES acromegaly CPG 2014). **Repointing the primary citation does NOT clean phantoms in individual choice rationales — grep the whole explanation.**
- **Contradiction-pair:** template-sibling items keying opposite answers to the same clinical question — invisible to semantic dedup, caught only by manual clinical read + spot-checking unflagged rows (e.g. DM1 anticipation `fa5c06ab` vs `1c0dcc2b`).
- **Two co-valid agents (soft single-best):** SGLT2i (dapa/empa), basal insulin (degludec/glargine-U300), anabolic osteoporosis (romo/teriparatide), Cushing steroidogenesis (metyrapone/osilodrostat), GLP-1/incretin. Needs the interchangeable-agents guardrail — choice set ≤1 member of a class unless the stem encodes the tie-breaker.
- **SGLT2i-deprioritization mis-key:** keying GLP-1 over an offered SGLT2i in HFrEF/CKD, justified by a false hyperkalemia claim or the irrelevant sub-eGFR-45 glycemic argument. `flagCardiorenalMiskey` H1/H2 (hard-reject).
- **T1D cardiorenal extrapolation:** finerenone/SGLT2i-glycemic/GLP-1-renal keyed in T1D stems — clinically wrong (T2D-specific evidence). `flagT1DCardiorenal` (warn-mode; flagging these in T1D stems is correct).
- **Within-topic semantic near-duplication** (B3 spreads across topics, not within): CKD-nutrition ×6, acyclovir-MOA ×3-4, Wernicke/thiamine ×5, vitamin-D osteomalacia ×4. Plus repeated stem-opener templates.
- **Other one-offs seen:** HSV-latency keyed to a lytic-phase mechanism (ICP47); alcoholic-hypoglycemia backwards premise + fabricated CoA/carnitine mechanism; X-ALD adrenal atrophy mis-stated as enlargement; insulinoma-vs-PBH sequencing (PBH → diet+acarbose, not SACST; 68Ga-DOTATATE unreliable for insulinoma).

### Guardrail / promotion discipline (hard-won)
- **Never promote a warn-mode validator to hard-reject without backtesting its false-positive rate against the live bank.** `flagCardiorenalMiskey` H2 bare proximity regex can't tell error from correct teaching — needs negation guards.
- **Full stem before any re-key.** Pass-1/pass-2 projections truncate (~320 chars) and hide disambiguating details; a "soft single-best" on the projection is often clean once untruncated. This session, 3 of 6 flagged fixes were already guideline-correct (NYHA III → diazoxide out; eGFR 31+LVH → pasireotide out; on-lisinopril line). Re-keying `f09a6232` to diazoxide from the truncated read would have INTRODUCED an error. Projections flag; full text decides.
- **Vacuous-clean batches don't count** toward the ≥2-clean-batch promotion bar — the validator must actually be exercised by relevant content.

---

## 3. Last session — 2026-06-11 (session 2 / PM)

- **Reconcile:** HEAD `3665d4c` (AM). Live found 998 servable + an 80-row Endo pending batch (Step 3 run had completed 80→135; fresh Endo batch landed 21:26). `c5395187` (package-lock gitignore) + `src/` removal both confirmed closed.
- **Agent-meta docs shipped (`1fadcf7`):** lean `CLAUDE.md`, new `PROJECT_MEMORY.md`, 4 workflow skills (`.claude/skills/`), eval suite (`eval/`, 22 graded cases). Transport = `apply.sh` heredoc writer (round-trip byte-verified). Placement-fixup lesson: downloads land flat/mangled; the writer is the correct transport.
- **Endo 80 pending triaged (two-pass):** promote 59 (56 as-is + 3 fixed), reject 21. Endo servable **200→259**; `approved_today=59` reconciled. **Fixes:** `ebef7474` (already-on-duloxetine stem edit), `4ad9041a` (re-key B→D fenofibrate; IPE misapplied REDUCE-IT), `30d900d4` (re-key C→B pituitary MRI + re-topic→Cushing). **Rejects** spanned all documented defect classes (correct-answer-absent mis-keys, contradiction-pairs, two-co-valid soft single-best, within-topic saturation, debunked Somogyi premise, topic-drift).
- **Close:** 1,057 servable bank-wide (IM 402 / Endo 259 / S1 159 / S2CK 102 / S3 135); all queues 0; HEAD `1fadcf7`.

## 4. Next run

1. **Session-open reconcile** (live cross-tab + HEAD `1fadcf7` + latest `SESSION_LOG_*`). Expect 1,057 / all queues 0 unless a run landed overnight.
2. **Continue fills under the working ceiling.** Step 2 CK is thinnest (102) — blanket ceiling ~18, clean blueprint. Then **Step 1 via targeted topic runs** on thin core (Genetics, Anatomy), not level-wide.
3. **Switch bulk runs to `mode=batch`** (50% cost; chunk if huge — 6 h Actions timeout vs 24 h batch SLA).
4. **Triage every batch on landing** — never promote onto an untriaged backlog; two-pass + spot-check unflagged + **full-stem-before-rekey**.
5. **`flagT1DCardiorenal` promotion still ON HOLD** (warn-mode) until ≥2 batches actually exercise it.
6. **Phase-2 cross-run semantic dedup** (compare new items vs existing bank per topic).
7. **Plan-independent deadline:** Oct 30 2026 Supabase Data API explicit-grants change — reconcile vs `SUPABASE_OCT2026_FALLBACK_PLAN.md`; verify `serve_next_mcq` / `fetch_unseen_mcqs` carry explicit `GRANT EXECUTE`.
8. **On the horizon:** image integration Phase 1 (`IMAGE_INTEGRATION_PLAN.md`); lead-capture/trial CTA hybrid; `serve_next_mcq` 2-of-2 gate (deferred, architectural).

### Known backlog (carry forward)
- ~99 servable legacy-format rows (`S1:`/`S2:`/`S3:` markers) rendering in the live app: IM 62 / Endo 19 / Step 1 12 / Step 2 CK 3 / Step 3 3.
- Doc drift: `INTEGRATION.md` points the widget at `/widget/medboard-widget.js` (actually root `/medboard-widget.js`); leads schema committed as `Spabase_lead_schema` (typo, no `.sql`).
- Model-literal consolidation (fetch bodies hardcode `claude-sonnet-4-6` → point at `BULK_CLAUDE_MODEL`); ±25-char citation-window mis-attribution (takes first year in range); guard-order decision (anti-cueing runs last in bulk — its drops can be masked).
- Run `npm run ci` on local sync of `1fadcf7` to confirm the docs commit left parity/tests green (docs-only — expected clean).
