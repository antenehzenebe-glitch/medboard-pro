---
name: pr-review
description: Review a pull request or a proposed commit on MedBoard Pro before it merges to main (which auto-deploys to Netlify). Use when a PR opens or before any push. Enforces the maker/verifier split, generator parity, single-purpose commits, the security/secret rules, and — for any clinical-content change — a guideline-soundness read.
---

# PR review

`main` auto-deploys. A merge IS a deploy. Review accordingly: the verifier checks the real artifact, never the maker's claim.

## 1. Scope & hygiene
- **Single purpose?** Security ≠ feature ≠ guardrail ≠ docs. If a diff mixes them, ask to split.
- **No forbidden files staged:** one-off `*_patch.py` / `deploy_*.py` scripts, `package-lock.json`, anything under `src/`, the base64 headshot region, the `SB_KEY` constant. Reject if present.
- **Commit message ≠ proof.** Read the diff, not the banner.

## 2. Run the gate
```bash
npm run ci   # check + parity + test must be green
```
If the PR touches a generator, parity is the first thing to confirm (15/15). If it adds a validator, confirm a unit test came with it.

## 3. Generator parity (if either generator changed)
Diff `TOPIC_GUARDRAILS` / `integrityRules` / `ALLOWED_GUIDELINE_CITATIONS` across both files — must be byte-identical. Bulk-only blocks (B3/B4/B5/`VERIFY_PASS`/S5 guard) are exempt by design; confirm the change is genuinely bulk-only before waving it through.

## 4. Security read
- No secret in the diff (`sb_secret_*`, `SUPABASE_SERVICE_ROLE`, Anthropic/Gemini keys). Run a secret scan on changed files.
- Any new `public` table/function migration MUST carry explicit `GRANT`s in the same file and prefer `SECURITY INVOKER` (DEFINER only for the funnel RPCs, and say why).
- Serving logic must gate on `status` only — reject any new read of `approval_status` for serving.

## 5. Clinical-content read (if MCQs or guardrails changed)
For any change to clinical canon, citations, or generated/promoted items, do a guideline-soundness pass:
- Citations: society × topic × year against primary sources (catch phantom tuples that pass the year-list — see the phantom list in `PROJECT_MEMORY.md`).
- Single-best integrity: no two co-valid interchangeable agents offered unless the stem encodes the tie-breaker.
- Mis-key classes: SGLT2i-deprioritization in HFrEF; T1D cardiorenal extrapolation; contradiction-pairs vs the existing bank.
- Default ruling: **modify to guideline standard** rather than reject outright.

## 6. UI changes
If the diff touches `index.html`, `public/index.html`, `medboard-widget.js`, or the landing page → require before/after **screenshots** of the incognito render (question loads, choices render, explanation panel appears). Text logs are not enough.

## 7. Verdict
Approve / request-changes with explicit per-item reasons. On merge, run the `deploy-check` skill. Write any new defect-class or lesson back to `PROJECT_MEMORY.md`.

## Model routing
Routine pass/fail (parity diff, secret scan, CI status) → Haiku 4.5. Ambiguous clinical adjudication → Opus 4.8.

## Eval
Graded cases in `eval/pr-review.jsonl`.
