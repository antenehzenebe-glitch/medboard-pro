---
name: ci-triage
description: Triage a red CI run on MedBoard Pro. Use when `npm run ci` fails locally or the ci.yml GitHub Action goes red — covers the three gates (node --check, parity, validator tests), isolates which gate broke, and prescribes the fix. The most common red is a generator-parity drift between generate-mcq.js and bulk-generate.js.
---

# CI triage

CI = `npm run ci` = **check → parity → test**, in that order. It stops at the first failure, so triage by which gate spoke last.

## Step 0 — reproduce locally
```bash
npm run ci
```
Note the LAST line before the failure. That names the broken gate.

## Gate 1 — `npm run check` (syntax)
`node --check` on both generators. A failure here = a syntax error in `scripts/bulk-generate.js` or `netlify/functions/generate-mcq.js`.
- Run each half to localize: `node --check scripts/bulk-generate.js` then `node --check netlify/functions/generate-mcq.js`.
- Usual cause: a hand-edit or a mangled heredoc paste. Re-open the file, find the unbalanced brace/quote near the last edit.
- **Never** "fix" by deleting code you don't understand — restore from `git --no-pager diff` and re-apply the intended edit cleanly.

## Gate 2 — `npm run parity` (the common one)
`test/check-parity.js` asserts 15 byte-identical blocks across the two generators (`TOPIC_GUARDRAILS`, `integrityRules`, `ALLOWED_GUIDELINE_CITATIONS`, and the validator functions). A drift here means a guardrail was edited in one file but not the other.
1. Read which block the test names as mismatched.
2. `git --no-pager diff` (NOT `git diff` — it opens less and swallows the next command) to see the intended change.
3. Decide the source of truth (usually the file you meant to edit) and copy the block **byte-identical** into the other.
4. Re-run `npm run parity` until 15/15.
- Legitimate bulk-only blocks (B3 sampler, `flagConceptSaturation`, B5 cap, `VERIFY_PASS`, S5 handler guard) are **not** parity-checked by design — if the test flags one of these, the test's allow-list is wrong, not the code.

## Gate 3 — `npm test` (validator units)
`node --test` → `test/validators.test.js` (7 cases). A red here = a validator's behavior changed.
- Read the failing assertion. If you *intended* to change the validator, update the test to match the new contract **and** add a case for the new behavior.
- If you did NOT intend it, you broke a validator — revert and re-approach.
- A newly-built validator MUST ship with a unit test in this file (warn-mode first).

## After green
- Commit the fix as a **single-purpose** commit (`ci:` or `fix:`), never bundled with a feature.
- Verify the pushed diff with `get_commit detail:full_patch` — `search_code` lags after push.
- If the red was a parity drift, write the lesson back to `PROJECT_MEMORY.md` (which block drifted, what edit caused it).

## Eval
Graded cases in `eval/ci-triage.jsonl`.
