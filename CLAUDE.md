# CLAUDE.md — MedBoard Pro

> Operating contract for any agent (Claude or human) working this repo. Read before touching code.
> Lean by design. The receipts — verified facts, failed attempts, last session, next run — live in **`PROJECT_MEMORY.md`**. Deep clinical canon and architecture live in the section-numbered reference below and in **`MEDBOARD_DESIGN.md`**.
> Authoritative state is always **live SQL + GitHub HEAD**, never this file.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React via in-browser Babel in `index.html` / `public/index.html` — **no build step**. Every edit is the deployed edit. |
| Hosting | Netlify, auto-deploy from GitHub `main` |
| Backend | Netlify Functions (Node 18+) |
| DB | Supabase Postgres + RLS — project `vhzeeskhvkujihuvddcc`, table `mcqs` |
| Serving | Supabase RPC `serve_next_mcq` (DB-first, ~95%); `generate-mcq.js` is the fallback only |
| Auth / keys | Supabase Auth; opaque keys — `sb_publishable_*` client-side, `sb_secret_*` server-only. Legacy anon JWT **disabled**. |
| MCQ generation | Anthropic Claude `claude-sonnet-4-6` (primary); Gemini fallback (gen-mcq path only) |
| Bulk ops | GitHub Actions (`bulk-generate.yml`); Anthropic **Batch API** via `mode=batch` (50% off, ≤24 h SLA) |
| Payments | Stripe Payment Links + Customer Portal (no custom checkout) |
| Repo | `antenehzenebe-glitch/medboard-pro`; deployed by Dr. Z via GitHub Codespaces |

**Two generator files must stay in parity** — byte-identical `TOPIC_GUARDRAILS`, `integrityRules`, `ALLOWED_GUIDELINE_CITATIONS`:
- `netlify/functions/generate-mcq.js` — live, user-facing
- `scripts/bulk-generate.js` — GitHub Actions batch

Bulk-only by design (do **not** mirror to gen-mcq): the B-series sampler (B3 spread, B4/concept-saturation dedup, B5 generation cap), `VERIFY_PASS`, and the S5 rate-limit/origin handler guard.

---

## Commands

```bash
npm run check     # node --check both generator files
npm run parity    # test/check-parity.js — 15 parity-locked blocks (must be 15/15)
npm test          # node --test → test/validators.test.js (7/7)
npm run ci        # check + parity + test — the gate. Run before EVERY commit.
```

Live state (run at every session open, before trusting any log):
```sql
-- canonical servable cross-tab (Supabase MCP execute_sql, project vhzeeskhvkujihuvddcc)
SELECT exam_level,
       count(*) FILTER (WHERE status='approved' AND cueing_flag IS NOT TRUE) AS servable,
       count(*) FILTER (WHERE status='pending_review')                       AS pending,
       count(*) FILTER (WHERE status='re_audit')                             AS re_audit
FROM mcqs GROUP BY exam_level ORDER BY exam_level;
```

GitHub HEAD check: `list_commits perPage:6`. Post-push verification: `get_commit detail:full_patch` (NOT `search_code` — it lags after push).

Bulk generation: dispatch `bulk-generate.yml` with `ceiling` (per-(level,topic) servable+pending depth target; default 8) and `mode` (`batch` recommended). Self-balancing: deep topics get 0 budget, thin topics fill.

---

## Code style

- **No build step.** Frontend edits go live on deploy. Smoke-test in incognito after every deploy.
- **Env vars are required, not optional.** Fail-fast (`throw`) on missing secrets. Never `|| "fallback"`.
- **`status` is the authoritative serving column.** Gate serving on `status` only. `approval_status` is a deprecated parallel marker (kept for the re-audit provenance cohort) — never read it for serving.
- **Servable = `status='approved' AND cueing_flag IS NOT TRUE`.** This definition is canonical; do not redefine it anywhere.
- **Promote writes set** `status='approved'`, `approval_status='approved'`, `reviewed_at=now()`. `reviewed_by` stays NULL (it is `uuid`, never `'admin'`).
- **Every DB write is followed by a verification SELECT.** No exceptions.
- **Explanation format is the emoji format** (🩺 / 🚫 / 💎) — forward-only. Legacy `S1:`/`S2:` rows are a known, separate backlog; do not regress new rows into it.
- **Brand:** Navy `#002868`, Gold `#C9A84C`. User-facing content carries the "educational use only, not medical advice" disclaimer.
- **Single-purpose commits.** Security ≠ feature ≠ guardrail ≠ docs. Conventional-commit prefixes (`feat`/`fix`/`sec`/`ci`/`chore`/`docs`).
- **Supabase grant convention (Oct-30-2026 Data API change):** every migration creating a `public` table/function MUST include explicit `GRANT` statements in the same file. Prefer `SECURITY INVOKER` unless the funnel demands DEFINER. DDL/policy → `apply_migration`; reads/DO-blocks → `execute_sql`. See `SUPABASE_OCT2026_FALLBACK_PLAN.md`.

### Patch-script discipline (how generator/DB edits are made)
- Byte-anchored Python: anchor on a unique exact string, **assert occurrence count, abort-before-write on mismatch**, idempotent. Run from repo root. `node --check` both files after. **Never `git add` the patch script; delete it after push.** One-off deploy scripts are never committed.
- Do **not** paste large multi-line heredocs into the Codespaces web terminal — they char-mangle at scale. Use file-based patch scripts dropped via the VS Code file explorer, or a quoted `<<'EOF'` heredoc for whole-file writes.
- Space-aligned YAML (e.g. workflow env blocks) defeats whitespace anchors — prefer a full-file rewrite over byte-anchoring there.
- DB text edits: confirm-SELECT first; `id::text LIKE ANY (ARRAY['xxxxxxxx%', …])` for UUID-prefix matching; dollar-quote (`$mbp$…$mbp$`) long clinical text; `jsonb_set(choices,'{E}','"…"')` for partial choice updates; verify-SELECT after.

---

## Forbidden files (never commit / never edit blindly)

- **`netlify/functions/generate-mcq.js` ↔ `scripts/bulk-generate.js` parity blocks** — never edit one without diffing the other. CI `parity` is the backstop.
- **One-off patch / deploy `.py` scripts** — never `git add`; delete after run. (`.gitignore` should cover `*_patch.py`, `deploy_*.py`.)
- **`package-lock.json`** — gitignored; zero-dep project (Node built-ins only). Do not commit.
- **`src/`** — was orphaned React scaffold; removed. Do not recreate.
- **`index.html` / `public/index.html` base64 headshot (~line 388, ~100 KB)** — do not select/edit during patches.
- **`SB_KEY` constant (~line 39, publishable)** — by design, leave it.
- **Secrets** — `sb_secret_*`, `SUPABASE_SERVICE_ROLE`, Anthropic/Gemini keys live in Netlify/Actions env only. Never paste into chat, never hardcode. If one leaks: rotate, audit, never paste it.
- **`.github/workflows/*`** — GitHub MCP cannot write these (403). Land via Codespaces CLI only.

---

## Review rules — Maker / Verifier / Memory

The loop, every run:
> **Maker** writes the change → **Verifier** checks the real artifact → **Memory** keeps the receipt.

### 1. Split maker and verifier
- **Maker** writes the change only: patch script, generator edit, migration, MCQ promote/triage decision.
- **Verifier** checks the *real artifact*, never the maker's claim:
  - runs `npm run ci` (check + parity + tests must pass);
  - runs the **live verification SELECT** after any DB write;
  - **screenshots** the incognito smoke test for any `index.html` / widget UI change (question loads, choices render, explanation appears) — text logs are not sufficient for visual work;
  - reads back the **pushed commit diff** via `get_commit detail:full_patch` (commit content is truth; commit-message banners are not);
  - reads **logs** (Netlify function logs; bulk-run surfaced HTTP cause; the `429/403/400/200` smoke paths for `generate-mcq`).
- A change is not "done" until the Verifier confirms the artifact. Never tell the user a write is saved/shipped before the verify-SELECT or commit diff confirms it.

### 2. Model routing by price
| Tier | Model | Use for |
|---|---|---|
| Plan | `claude-fable-5` | Multi-day roadmaps, generation sequencing, architecture decisions, the Oct-2026 fallback plan |
| Bulk edit | `claude-sonnet-4-6` | Patch scripts, generator edits, batch promotes, **and the MCQ generation itself** |
| Grade | `claude-haiku-4-5` | Eval grading, routine pass/fail (parity diff, CI status, smoke-path checks) |
| Fallback | `claude-opus-4-8` | Hard clinical calls — contradiction-pair adjudication, ambiguous mis-keys, anything a cheaper tier flagged uncertain |

(Distinct from the MCQ **generation** model, which is pinned to `claude-sonnet-4-6` in both generators.)

### 3. Parallel runs use worktrees
No shared checkout, no file collisions, no mystery edits. One `git worktree` per parallel job (e.g. a Step 1 fill and an Endo triage at once):
```bash
git worktree add ../mbp-step1 -b gen/step1
git worktree add ../mbp-endo  -b triage/endo
# … work each in isolation, run `npm run ci` per tree, commit, then `git worktree remove`
```

### 4. UI work goes behind screenshots
If the task changes anything visual (`index.html`, `public/index.html`, `medboard-widget.js`, landing page), the verify step **must** include before/after screenshots of the incognito render. Log lines do not prove the explanation panel renders.

### 5. Long jobs → Routines
- **CI failed** → run the `ci-triage` skill.
- **PR opened** → run the `pr-review` skill.
- **Pre-deploy / post-deploy** → run the `deploy-check` skill.
- **7 am** → send the daily digest: live servable cross-tab + open queues + HEAD commit + any in-flight Action.

### 6. Write the lesson back
A fix that stays in chat dies there. End **every** run by appending to `PROJECT_MEMORY.md`:
- new **verified facts** (a clinical anchor locked, a real citation confirmed),
- new **failed attempts** (a defect class, a phantom citation, a bug pattern),
- the **last-session** summary and the **next-run** plan.
Plus the end-of-day session log (`SESSION_LOG_YYYY_MM_DD.md`) in continuity-doc style.

### Session-open protocol (terse signal = "A, search, go")
1. Read the latest `SESSION_LOG_*` + `PROJECT_MEMORY.md` to anchor carry-forward.
2. Run the live servable cross-tab (SQL above).
3. Verify GitHub HEAD against `antenehzenebe-glitch/medboard-pro`.
4. Reconcile all three before doing anything. Logs drift; live state wins.

### Triage workflow (MCQ review)
- Two-pass: lean projection first (`id`, keyed answer, topic, stem snippet) → full-text pull on flagged subsets only. **Spot-check the unflagged** — the 175-char prefix hides contradiction-pairs and stem–key contradictions.
- Present a keep / reject / fix ledger; execute on single-exchange approval. Default to **fixing items to guideline standard** over outright reject.

---

## Reference (deep canon — read when the task touches it)

### Servable thresholds ("live-first" target per level)
Endo ~175 · IM ~165 · Step 1 ~150 · Step 2 CK ~180 · Step 3 ~150.

### Clinical non-negotiables (the most important thing in the repo)
Enforcement = shared `TOPIC_GUARDRAILS` (L1 hard facts / L2 cognitive complexity) + `integrityRules` A–M (H = anti-cueing, L = lab-value lock, M = single-best discriminator) + the validator stack. Locked anchors include: DKA/HHS (K⁺ before insulin); thyroid storm (ATA 2016; PTU contraindicated in hepatic disease); DI/copeptin (no water-deprivation when Na>145); adrenal insufficiency (ES 2016 Bornstein, clinical titration); dyslipidemia (**2026 ACC/AHA/Multisociety** — retires & **bans** the 2018 guideline; PREVENT replaces Pooled Cohort); primary aldosteronism (ES 2025 Adler — retires 2016 Funder); **cardiorenal T2D** (SGLT2i = Class I HFrEF, K-neutral, to eGFR 20 — prefer over GLP-1 for the HF indication; finerenone/SGLT2i-glycemic/GLP-1-renal are **T2D-specific, never extrapolate to T1D**); **cardiorenal sequencing** (in an SGLT2i-naïve T2D + CKD + albuminuria patient, SGLT2i is the first add-on pillar — finerenone is layered *after* SGLT2i; keying finerenone/spironolactone over an available SGLT2i = mis-key); **β-blocker in thyrotoxicosis + CKD** (propranolol preferred — hepatic clearance + blocks T4→T3; atenolol is renally cleared and accumulates at low eGFR); **drug currency** (rhPTH(1-84)/Natpara is **withdrawn** — palopegteriparatide [Yorvipath, FDA 2024] is the current PTH-replacement agent for refractory hypoparathyroidism). The planned **v7.9.6 `validateCurrency` guardrail** (warn-mode: superseded-drug blocklist + cardiorenal-ordering + renal-β-blocker heuristics) enforces the last three classes. Full validator inventory, phantom-citation list, and defect classes → `PROJECT_MEMORY.md`.

### Sequencing principle
Schema first (DB before dependent code) → server-side (functions, bulk) → frontend last → production-deploy validation always (incognito smoke; roll back via Netlify Deploys → Publish previous deploy).

### Founder voice
Senior attending walking a junior through a high-yield case — rigorous, never condescending. Compete on Endocrinology depth, clinical rigor, and price; **not** breadth, gamification, or flashcards.

---
*This file is the contract. The history is in `PROJECT_MEMORY.md`. The runbooks are in `.claude/skills/`. The graded checks are in `eval/`.*
