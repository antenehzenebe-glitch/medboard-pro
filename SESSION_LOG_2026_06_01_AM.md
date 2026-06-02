# End-of-day wrap, MedBoard Pro -- Monday 2026-06-01

Version state: generators v7.5.11 (HEAD 71cd081); docs v7.5.11 (CLAUDE.md base commit
f156186, + this session's ATA-2025 correction commit). No code changes this session --
all work was DB re-certification, one docs/canon patch, and ledger updates.

---

## Session log -- 2026-06-01

**#1 bookkeeping -- CLOSED.** Confirmed the docs commit (f156186: CLAUDE.md -> v7.5.11 +
RE_AUDIT_LEDGER.md) pushed. Code 71cd081 + docs both at v7.5.11.

**#3 re_audit re-certifications -- CLOSED (both rows). cohort 2 -> 0; servable 229 -> 231.**
- fe5ceb27 (Endo thyroid PTC): live pull OVERTURNED the PM/night dx. It is NOT a mis-key --
  correct_answer E (childhood neck irradiation) was right. Executing the night plan's
  "re-key C" literally would have BROKEN a correctly-keyed item. Real defect = scrambled
  explanation letter-map (B/D/E mislabeled vs the choices) + 55-yr staging cutoff
  mis-attributed to an ATA mgmt guideline (it belongs to AJCC 8th-ed TNM) + legacy format.
  Action: explanation rewrite (emoji, letters realigned, AJCC-8th fixed, ATA 2025 retained),
  key E unchanged. status/approval_status=approved, reviewed_at=now(), reviewed_by NULL. Verified.
- 102e3b34 (IM lipid HeFH): key B (PCSK9i) correct + robust. Dropped retired 2018/Grundy +
  2022 ACC ECDP cites -> 2026 ACC/AHA Multisociety Dyslipidemia Guideline; restored
  very-high-risk LDL-C goal <55 in stem + explanation. Verified.

**CANON FINDING (cross-cutting, high priority):** "ATA 2025" is REAL -- Ringel et al.,
Thyroid 2025;35(8):841-985, pub Aug 22 2025. The standing "ATA 2025 = fabricated" assumption
was INVERTED and would have mis-flagged the entire Tier-2 thyroid batch. Corrected in CLAUDE.md
sec 6/9 (and the sec 12 re-audit status line) via patch_claude_md_ata2025.py -- 5 ASCII-anchored
edits, dry-run validated, run live, committed, script removed. RE_AUDIT_LEDGER.md appended (both rows).
Separately, the 2026 ACC/AHA Multisociety Dyslipidemia Guideline confirmed REAL (pub Mar 13 2026;
Circulation 10.1161/CIR.0000000000001423 / JACC 10.1016/j.jacc.2025.11.016): very-high-risk <55,
ASCVD <70, PREVENT > PCE. Project canon validated.

**#2 pending-lipid dispositions -- STARTED. servable 231 -> 233 (IM 121 -> 123).**
- Live-verified the 5 promote-candidates: all keys clinically correct, all correct thresholds
  (the <70 rows are primary-prevention HeFH + subclinical-atherosclerosis = genuinely the <70
  tier, not errors), all emoji, none cite 2018/Grundy.
- PROMOTED 2 fully-clean (both IM): 62bb291a (E, HeFH+CAC210+DM, <70), b6252e8e (B, HeFH+CAC310+Lp(a), <70).
- HELD 3 pending a policy call: 3c52e136 (A, HFrEF partial-intol), 7fd8760e (A, alirocumab HeFH+MI),
  df1b0da1 (D, ezetimibe-first). All clinically perfect; only issue = they cite the 2022 ACC ECDP
  (Lloyd-Jones), pre-2023, which I dropped from 102e3b34 this AM. df1b0da1 also tags the 2026
  guideline "Blumenthal et al." -- unverifiable author, not used by the other 4 rows.

**Learnings:** (1) Prior-session diagnoses are hypotheses, not verified state -- pull live before
drafting (it just prevented a NEW error). (2) Guideline existence is verifiable + time-sensitive:
found TWO opposite errors (ATA 2025 assumed fake = real; 2026 ACC/AHA needed confirming = real).
Screen on existence + claim accuracy, not the year in the title. (3) A citation standard set
mid-session (drop 2022 ECDP) must govern the pending backlog too, not just the row it was set on.
(4) ASCII-anchored patches beat unicode (\u em-dash) anchors; dry-run vs pasted live text first.

---

## Plan of action -- next morning

1. DECISION (gates 3 held promotes): keep or drop the 2022 ACC ECDP (Lloyd-Jones) citation.
   Lean = drop (consistent with 102e3b34; 2026 guideline + AACE 2025 carry every claim).
   - If drop: batch-edit strip the ECDP sentence from 3c52e136 / 7fd8760e / df1b0da1 + remove
     df1b0da1's "Blumenthal et al." tag -> promote all 3.
   - If keep: promote all 3 as-is + record the ECDP exception in CLAUDE.md citation lock.

2. Finish #2 lipid dispositions:
   - Edit-hold pair cd8ead16 (C) + 9047c7e1: pull live, swap the inclisiran distractor
     (two-PCSK9-pathway Rule-M soft-fail) for a non-PCSK9 option, then promote.
   - Drop 3: 3edb718b, 1d11cd97, 37c03116 -> status/approval_status=rejected
     (quick live confirm of the bempedoic-before-PCSK9i defect before rejecting).

3. CLAUDE.md sec 8 servable-count refresh -- ONE edit after the lipid batch settles.
   Stale now (table: 229 / IM 120 / Endo 52); live = 233 / IM 123 / Endo 53; will move again
   with the held promotes/drops. Do it once at the end to avoid touching it repeatedly.

4. Append the #2 lipid dispositions to RE_AUDIT_LEDGER.md.

5. Resume re-audit Tier 2 (#4): 122 legacy-format approved rows, thyroid + lipids first.
   APPLY the corrected ATA-2025 canon -- a Tier-2 thyroid row that cites "ATA 2025" is NOT
   defective on that basis; screen on claim accuracy.

**Carry-forward:**
- 2022 ACC ECDP policy (decision #1): once decided, encode in CLAUDE.md so generation + audits stay consistent.
- "Blumenthal et al." fabricated-author risk on the 2026 guideline (seen in df1b0da1) -- watch the
  bulk lipid batch; safe form is unattributed guideline + journal/year. Candidate WARN token.
- evolocumab-vs-inclisiran two-PCSK9-distractor pattern now 2+ occurrences (cd8ead16, 9047c7e1) --
  approaching the threshold for a generator guardrail; re-evaluate after the edit.
- Stray 'ABIM Internal Medicine boards (residents)' exam_level label (2 rejected rows) still un-normalized.

End of Session log
