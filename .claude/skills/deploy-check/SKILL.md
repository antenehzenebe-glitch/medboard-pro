---
name: deploy-check
description: Pre- and post-deploy verification for MedBoard Pro. Use before merging to main (a merge auto-deploys via Netlify) and immediately after a deploy lands. Confirms CI is green, the pushed artifact matches intent, the live serving path works in incognito, and DB writes are verified — with a clear rollback path.
---

# Deploy check

`main` → Netlify auto-deploy. There is no staging gate but the deploy preview and incognito smoke. Sequencing principle: **schema first → server-side → frontend last → production-deploy validation always.**

## Pre-deploy
1. `npm run ci` green (check + parity + test).
2. Diff is single-purpose; no forbidden files staged (see CLAUDE.md).
3. If the change includes a migration: it ran via `apply_migration` against `vhzeeskhvkujihuvddcc`, carries explicit `GRANT`s, and you ran the attacker-role RLS check (anon DO-block) where relevant.
4. If clinical content changed: `pr-review` clinical read passed.

## Post-push verification (artifact, not claim)
5. Confirm the pushed commit with `get_commit detail:full_patch` — commit content is truth; `search_code` lags; the message banner is not proof.
6. Confirm Netlify built the deploy (Deploys tab shows the new commit, build succeeded).

## Live smoke (incognito)
7. Serving path: open the live site in incognito — question loads, choices render, explanation appears (emoji format). This exercises `serve_next_mcq` (the ~95% DB-first path).
8. If `generate-mcq.js` changed: confirm the four guard paths still behave — 400 (invalid level), 403 (foreign Origin), 200 (legit/no-Origin), 429 (rate-limit). The 429 can be proven zero-cost by pre-seeding the IP counter, no redeploy.
9. For any UI change → run `design-qa` and attach screenshots.

## DB writes
10. Every promote/triage/data write is followed by a **verification SELECT**. Re-run the canonical servable cross-tab and confirm the deltas match what you intended (and reconcile against the log — mid-session drift is real).

## Rollback
- Frontend / function regression: Netlify → **Deploys → Publish previous deploy** (instant).
- Bad migration: forward-fix with a new migration (don't hand-edit a shipped one); if a policy opened a hole, reapply the deny-all and re-verify as the anon role.
- A bulk run returning 0: read the **surfaced HTTP cause first** and check the most recent commit touching the generation path before suspecting keys/billing.

## After
Write what shipped + any lesson to `PROJECT_MEMORY.md` and the end-of-day `SESSION_LOG_*`. Commits are the receipt; the memory file is the lesson.

## Eval
Graded cases in `eval/deploy-check.jsonl`.
