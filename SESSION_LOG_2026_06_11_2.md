# MedBoard Pro — Session Log 2026-06-11 (session 2 / PM)

> Continuity doc. Authoritative state = live SQL + GitHub HEAD; this log is the carry-forward narrative.
> **HEAD at close:** `1fadcf7` · **Servable at close:** 1,057 · **All queues 0** bank-wide.

---

## 1. Session-open reconciliation (3 sources)

- **GitHub HEAD** was `3665d4c` (AM session close). Live `list_commits` confirmed it, plus `c5395187` (gitignore package-lock) was already in history → that open item is **closed**. `src/` scaffolding confirmed **gone** from the tree.
- **DB drift:** AM log said 943 servable / all queues 0. Live audit found **998 servable** and a live **80-row Endo `pending_review`** queue. Cause: the in-flight Step 3 run had completed (80→135) and a fresh 80-item Endo batch (single run, 2026-06-11 21:26, one model, 34 topics) had landed. Logs drift; live state won.

## 2. Agent-meta deliverables (committed `1fadcf7`)

Refactored the 53 KB changelog-style `CLAUDE.md` into a lean operating contract + split the receipts into `PROJECT_MEMORY.md`; added 4 workflow skills and an eval suite. Shipped on `main`:
- `CLAUDE.md` (lean: stack / commands / code style / forbidden files / review rules — maker-verifier, model routing, worktrees, screenshots, routines, write-the-lesson-back).
- `PROJECT_MEMORY.md` (verified facts / failed attempts / last session / next run).
- `.claude/skills/{ci-triage,pr-review,design-qa,deploy-check}/SKILL.md`.
- `eval/{ci-triage,pr-review,design-qa,deploy-check}.jsonl` (22 graded cases, all parse-validated; graders routed Haiku/Opus).
- Transport: `apply.sh` quoted-heredoc writer (round-trip byte-verified). **Placement lesson:** downloads land flat with mangled names (`ci-triage.SKILL.md` in root); `apply.sh` is the correct transport (nested paths, correct names). A stale "CLAUDE.md is clean ⇒ apply.sh didn't run" inference was wrong — "clean" meant committed-no-diff, not untouched. Confirmed nested `.claude/skills/*/SKILL.md` landed via `get_file_contents`.

## 3. Endo 80 pending — two-pass triage → promote 59 / reject 21

Single 2026-06-11 batch, heavy within-topic clustering (documented Endo defect surface). Pass-1 lean projection (id / topic / key / 175-char stem) → pass-2 full-text (stem + all choices + explanation) in two chunks. No phantom citations bank-batch (all society×year×topic tuples verified, incl. ATA 2025 DTC = real).

**Disposition: 80 → promote 59 (56 as-is + 3 fixed), reject 21.** Endo servable **200 → 259**; pending → 0; `approved_today=59` reconciled exactly.

**3 fixes applied (guideline-compliance directive):**
- `ebef7474` — stem edit: patient already on duloxetine (neutralizes the pain-distractor two-valid trap) → empagliflozin clean single-best for A3 albuminuria; key B unchanged.
- `4ad9041a` — re-key **B→D (fenofibrate)** + explanation rewrite. The IPE key misapplied REDUCE-IT (which **excluded TG >500**); at TG 920 with pancreatitis history a fibrate is guideline first-line, fenofibrate dose-adjusted (not contraindicated) at eGFR 38, preferred over gemfibrozil (statin interaction).
- `30d900d4` — re-key **C→B (pituitary MRI)** + re-topic Obesity→**Cushing Syndrome** + explanation rewrite. HDDST/CRH is de-emphasized; MRI is the next step after ACTH-dependent confirmation, BIPSS only if MRI negative/equivocal.

**3 flagged-fixes that were already clean once untruncated (promoted as-is — re-keying would have INTRODUCED error):**
- `12c244f2` (Acromegaly) — full stem has eGFR 31 + LVH; pasireotide's hyperglycemia/cardiorenal risk is the tie-breaker → pegvisomant already clean.
- `f09a6232` (Insulinoma) — full stem has NYHA III / EF 22%; diazoxide contraindicated (fluid retention) → octreotide LAR correct *because of* the HF.
- `7906bf0e` (Diabetic comp.) — stem explicitly states "on lisinopril 10 mg daily"; SGLT2i-next is clean, no contradiction with `acab012a`.

**21 rejects (by defect class):**
- *Correct answer not offered / mis-key:* `2ca4dc18` (pulsatile-GnRH for male RED-S), `9af64858` (cosyntropin for RED-S), `a7507bda` (SACHS for PBHH; redundant w/ correct `fd242fe4`), `94506208` (PTHrP/1,25-D for NPHPT), `276b9243` (SQSTM1 for sporadic Paget), `11976425` (pelvic US "for ovarian pathology" + hemianopsia→surgery), `d843fbdf` (HFpEF "no agent" misses SGLT2i).
- *Contradiction-pair / conflicting best-answer:* `ceed3a06` (sorafenib vs preferred lenvatinib, dup of `a4a7fc6d`), `2cabe143` (transdermal HT for unprovoked DVT vs `7bcc9b35`→fezolinetant), `4727e9ce` (transdermal switch *during acute DVT*; should discontinue), `ec4f3c8e`+`a2231c5d` (muddled TRAb-vs-RAIU Graves pair).
- *Two co-valid agents (soft single-best):* `a947f974` (atenolol vs propranolol), `e6478fe6` (explanation concedes D and E both valid), `326b4d76` (statin-intolerant: ≥3 defensible answers).
- *Within-topic saturation:* `19ab9392` + `2b48b97a` (SU-deprescribing; kept 2 of 5), `9dad98da` (Bethesda-IV overlap), `15e629b0` (exact twin of `22cdb530`).
- *Debunked premise:* `1a1f4da4` (Somogyi rebound — CGM-era teaching disfavors it).
- *Topic-drift + weak key:* `16967c23` (overt hypothyroidism under Obesity; antibody answer not management-changing).

## Commits this session
- `1fadcf7` — docs: lean CLAUDE.md + PROJECT_MEMORY.md + 4 workflow skills + eval suite. (Endo triage was DB-only — no repo change.)

## Bank state at close (verified live)
| Level | Servable |
|---|---|
| ABIM Internal Medicine | 402 |
| ABIM Endocrinology | 259 |
| USMLE Step 1 | 159 |
| USMLE Step 2 CK | 102 |
| USMLE Step 3 | 135 |
| **Total** | **1,057** |

`pending` 0 · `re_audit` 0 — bank-wide.

---

## Key learnings
- **Full stem before any re-key.** 3 of 6 flagged "soft single-best" fixes were already guideline-clean once untruncated — the disambiguating detail (NYHA III → diazoxide out; eGFR 31+LVH → pasireotide out; on-lisinopril line) lived past the 320-char projection. Re-keying `f09a6232` to diazoxide would have introduced an error. Pass-1 projections flag; pass-2 full text decides.
- **REDUCE-IT excluded TG >500** — IPE/icosapent has no pancreatitis-prevention evidence above TG 500; a fibrate (fenofibrate, statin-compatible, dose-adjusted at eGFR 30–59, stop <30) is first-line there. New canon anchor.
- **HDDST/CRH is de-emphasized** in ACTH-dependent Cushing — pituitary MRI is the next step after biochemical confirmation; BIPSS only if MRI negative/equivocal.
- **Somogyi rebound** is a contestable/largely-debunked premise in the CGM era — reject items that rest on it.
- **Transport vs hand-placement:** repo-destined files go via the `apply.sh` heredoc writer (nested paths, correct names), never the flat download. "Committed-no-diff" reads as clean ≠ "not applied."

## Next-morning plan of action
1. **Session-open reconcile** (live cross-tab + HEAD `1fadcf7` + this log). Expect 1,057 / all queues 0 unless a run landed overnight.
2. **Continue fills under the now-working ceiling.** Step 2 CK is the thinnest flagship-relevant level (102) — blanket ceiling ~18, clean blueprint. Then **Step 1 via targeted topic runs** on thin core (Genetics, Anatomy), NOT level-wide (narrow single-fact tail balloons).
3. **Switch bulk runs to `mode=batch`** (50% cost; chunk if huge — 6 h Actions timeout vs 24 h batch SLA).
4. **Triage every batch on landing** — never promote onto an untriaged backlog; two-pass + spot-check unflagged + full-stem-before-rekey.
5. **`flagT1DCardiorenal` promotion still ON HOLD** (warn-mode) until ≥2 batches actually exercise it.
6. **Phase-2 cross-run semantic dedup** (compare new items vs existing bank per topic).
7. **Plan-independent deadline:** Oct 30 2026 Supabase Data API explicit-grants change — reconcile vs `SUPABASE_OCT2026_FALLBACK_PLAN.md`; verify `serve_next_mcq` / `fetch_unseen_mcqs` carry explicit `GRANT EXECUTE`.

## Open / watch
- ~99 servable legacy-format rows (`S1:`/`S2:`/`S3:`) still rendering in-app: IM 62 / Endo 19 / S1 12 / S2CK 3 / S3 3.
- Image integration Phase 1 on horizon (`IMAGE_INTEGRATION_PLAN.md`).
- Doc drift: `INTEGRATION.md` widget path; `Spabase_lead_schema` typo.
- Run `npm run ci` on local sync of `1fadcf7` to confirm the docs commit left parity/tests green (docs-only, expected clean).
