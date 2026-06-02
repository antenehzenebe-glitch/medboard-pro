# RE_AUDIT_LEDGER.md -- MedBoard Pro

Per-row disposition log for the **re-audit workstream**. Opened 2026-05-31.

## Premise
`status='approved'` reflects sign-off under *older* guardrails, not current-standard
clinical compliance. This ledger tracks re-certification of the approved bank: every row
pulled for scrutiny, its finding, and its disposition -- persisted across sessions.

## Mechanics
- Migration `add_re_audit_to_mcqs_status_check` expanded the `status` CHECK to:
  `draft | pending_review | approved | rejected | retired | re_audit`.
- **Demote** (defect confirmed): set `status='re_audit'`, **preserve** `approval_status='approved'`.
  Removes the row from serving immediately (serving gates on `status='approved'` only).
- **Re-audit cohort** (addressable): `WHERE status='re_audit' AND approval_status='approved'`.
  Repurposes the otherwise-deprecated `approval_status` as a provenance marker -- it records
  that the row *was* approved. **Do not drop `approval_status` while the re-audit is active.**
- **Lifecycle out:**
  - Re-certified (fixed + verified to current canon) -> `status='approved'`.
  - Unsalvageable -> `status='rejected', approval_status='rejected'`.
- **Tier-2 suspicion set** = the 122 legacy-format approved rows (no emoji-labeled sections).
  Audited by topic; **thyroid + lipids first** (highest canon drift; both already yielded hits).

## Bank snapshot at open -- 2026-05-31 (verified live)
| Level | Approved / Servable |
|---|---|
| ABIM Internal Medicine | 120 |
| ABIM Endocrinology | 52 |
| USMLE Step 1 | 22 |
| USMLE Step 3 | 19 |
| USMLE Step 2 CK | 16 |
| **Total servable** | **229** |

Servable = `status='approved'` (0 approved rows are cueing-flagged, so approved == servable).
`re_audit` cohort: 2 (IM 1, Endo 1).

## Disposition log
| id (prefix) | Level | Topic | Finding | Severity | Disposition | Current status | Date |
|---|---|---|---|---|---|---|---|
| `fe5ceb27` | Endo | Thyroid / PTC | Wrong answer key -- keyed **E**, but the row's own explanation calls E a distractor; correct = **C** (childhood radiation). Fabricated "ATA 2025" citation x3. Legacy format. Concept is sound. | SEVERE | **Rewrite** -- re-key **C**; ATA 2025 -> ATA 2015 / AJCC 8th-ed; emoji format | `re_audit` -- rewrite pending | 2026-05-31 |
| `102e3b34` | IM | Lipid / HeFH | Answer correct (PCSK9i; bempedoic placement right) but cites retired **2018 / Grundy** and uses the old **<70** very-high-risk LDL threshold. | Moderate | **Edit** -- re-cite 2026 ACC/AHA; restore very-high-risk goal **<55** | `re_audit` -- edit pending | 2026-05-31 |

## Watch-items / data hygiene
- Stray `exam_level = 'ABIM Internal Medicine boards (residents)'` (2 rejected rows) -- label
  inconsistency vs canonical `'ABIM Internal Medicine'`. Not servable; normalize or leave.
- 2 contradictory `status='rejected'` / `approval_status='approved'` rows (1 Endo, 1 IM, per the
  2026-05-31 audit) -- harmless to serving; resolve after Tier-2.

## Next
1. Rewrite `fe5ceb27` + edit `102e3b34`, verify, re-certify -> `status='approved'`.
2. Pull the 122 legacy-format approved rows in topic batches -- thyroid, then lipids first -- and log each disposition here.

## 2026-06-01 — #2 pending-lipid dispositions (ECDP-drop policy applied)
Policy: 2022 ACC ECDP (Lloyd-Jones) DROPPED bank-wide (pre-2023; 2026 ACC/AHA + AACE 2025 carry every claim).

PROMOTED (stripped ECDP / Blumenthal):
- 3c52e136  IM lipid  key A evolocumab — 2× ECDP refs removed
- 7fd8760e  IM lipid  key A alirocumab — 1× ECDP ref removed
- df1b0da1  IM lipid  key D ezetimibe-first — 2× ECDP refs + "Blumenthal et al." author tag removed

PROMOTED (Rule-M two-PCSK9 fix — inclisiran distractor swapped):
- cd8ead16  IM lipid  key C evolocumab — D inclisiran → icosapent ethyl; Choice-D para rewritten
- 9047c7e1  IM lipid  key C evolocumab — B inclisiran → bempedoic acid; Choice-B para rewritten

PROMOTED (choice-B fix):
- 58d9d3e9  IM lipid  key A evolocumab — malformed choice B → "Switch rosuvastatin to atorvastatin 80 mg daily"

REJECTED:
- 1d11cd97  key C "discontinue statin + bempedoic" (counterproductive; raises LDL)
- 37c03116  key C "discontinue statin + bempedoic" (same defect)
- 3edb718b  dup of PCSK9i cohort + two-PCSK9 ambiguity + impossible "rosuvastatin 80 mg" distractor

Servable: 233 → 239 (IM 123 → 129). #2 CLOSED.

## 2026-06-01 — Tier-2 re-audit: thyroid/pituitary slice (10 legacy-format approved rows)
FIXED (served item, letter-map defect — key was correct):
- d95f822e  Endo Thyroid Cancer  key B Anaplastic — S1 header said "WHY CHOICE A IS CORRECT" (A=lymphoma distractor); realigned to "CHOICE B". Clinical content excellent. Re-certified.

RE-CERTIFIED CLEAN (key + ATA-scope + letter-map all correct):
- 25e815fc  Thyroid Storm        key A  PTU→SSKI→hydrocortisone→propranolol (PTU-before-iodine; BWPS pearl OK). Soft note: A-vs-D beta-blocker timing, defensible given hypotension.
- 2c59716a  Endo (PTC dx)        key E  classic nuclei + normal calcitonin; ATA 2015/2016 + ACR TI-RADS 2017
- 415cf306  Hyperthyroid/Graves  key A  confirm overt vs subclinical before etiologic w/u; ATA 2016
- a0ab9097  Thyroid Cancer       key D  fixed nodule, normal TSH → FNA; ATA 2015
- 0240b8a6  Endo (nodule)        key B  new high-suspicion 1.3cm in Hashimoto, normal TSH → FNA; ATA 2015
- d06921e1  Endo (nodule)        key E  1.4cm high-suspicion, normal TSH → FNA; ATA 2015
- fdb95df7  Endo (nodule)        key C  no prior US → TSH + ultrasound first; ATA 2015

FLAGGED (clinically correct; policy decision pending — NOT acted on):
- ad3a0545  pituitary (macroprolactinoma) key A — cites ES 2011 (Melmed); unseeded year
- e942717a  pituitary (PRL → MRI)        key B — cites ES 2011 (Melmed); unseeded year
  → Decision mirror of ECDP: keep ES 2011 (real, still the ES prolactinoma CPG) vs modernize to 2023 Pituitary Society consensus (Petersenn).

WATCH: 0240b8a6 / d06921e1 / a0ab9097 are 3 semantic near-dupes ("high-suspicion US + normal TSH → FNA") — future dedup candidate, not a defect.

ATA-2025 canon correction held up: zero thyroid rows were defective on the basis of citing a non-2015 ATA year.
