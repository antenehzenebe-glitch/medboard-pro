#!/usr/bin/env node
/**
 * apply-patches.js — MedBoard Pro Priority 1 + 2 patcher
 * ════════════════════════════════════════════════════════════════════════════
 *
 * USAGE (from repo root, in Codespace or local terminal):
 *
 *     node apply-patches.js
 *
 * WHAT IT DOES (one command, all edits):
 *
 *   PRIORITY 1 — Anti-Cueing:
 *     [1] Adds Rule H (ANTI-CUEING) to integrityRules in both files
 *     [2] Replaces the two "Pertinent Negatives" lines with a tighter version
 *     [3] Inserts detectAntiCueingViolation() function in both files
 *     [4] Wires the validator into the validation chains:
 *         - generate-mcq.js: main loop + Gemini fallback
 *         - bulk-generate.js: processRawMcq()
 *
 *   PRIORITY 2 — Per-Exam Item-Writing Scaffolds:
 *     [5] Replaces the 3-branch levelRules ternary (which silently bug-routes
 *         Step 2 CK and Step 3 into "ABIM ENDOCRINOLOGY RULES") with a proper
 *         5-branch if/else, with exam-appropriate writing conventions for
 *         Step 1, Step 2 CK, Step 3, ABIM-IM, and ABIM-Endo.
 *
 *   SCHEMA:
 *     [6] Writes supabase-migration.sql for the cueing_flag columns
 *
 * SAFETY:
 *   - Idempotent: detects already-applied patches and skips them
 *   - Creates *.bak backup files before mutating
 *   - Reports every patch (applied / skipped / failed) with line counts
 *   - Exits non-zero if any required patch failed (CI-friendly)
 *
 * ════════════════════════════════════════════════════════════════════════════
 */
"use strict";

const fs = require("fs");
const path = require("path");

// ─── TARGET FILES ────────────────────────────────────────────────────────────
const FILES = {
  api:  "netlify/functions/generate-mcq.js",
  bulk: "scripts/bulk-generate.js",
};

// ─── NEW CONTENT BLOCKS ──────────────────────────────────────────────────────

const RULE_H = `
H. ANTI-CUEING (CRITICAL — VIOLATIONS DISQUALIFY THE ITEM):
   A "pertinent negative" or descriptor in the stem MUST NOT pre-emptively clear a contraindication, side effect, or eligibility marker that is SPECIFIC to the correct answer. FORBIDDEN cueing examples:
   - "no history of bladder cancer" / "no recurrent UTIs" when the correct answer is an SGLT2 inhibitor
   - "no history of pancreatitis" / "no family history of medullary thyroid carcinoma or MEN 2" when the correct answer is a GLP-1 RA
   - "eGFR > 30" stated without diagnostic purpose when the correct answer is metformin
   - "no history of heart failure" / "no peripheral edema" when the correct answer is a TZD/pioglitazone
   - "no history of angioedema" when the correct answer is sacubitril/valsartan or an ACE-I
   - "potassium 4.2" stated without diagnostic purpose when the correct answer is spironolactone/eplerenone
   - "QTc 410 ms" stated without diagnostic purpose when the correct answer is a QT-prolonging drug
   - "no history of asthma or bronchospasm" when the correct answer is a non-selective beta-blocker
   - "no history of gout" when the correct answer is a thiazide or loop diuretic
   - "reliable medication adherence / injection technique" when the correct answer is insulin or a GLP-1 RA

   REMOVAL TEST: For every pertinent negative, mentally remove it.
   - If removing makes a DISTRACTOR more attractive (rules out competing differential) → KEEP.
   - If removing makes only the CORRECT answer less attractive (clears its contraindication) → DELETE.

   Pertinent negatives exist to differentiate among DIAGNOSES on the differential, NOT to clear the path to the THERAPEUTIC answer.`;

const NEW_PERTINENT_NEG_STEP1 =
  '- Pertinent Negatives: Include a pertinent negative ONLY if it helps rule out a competing DIAGNOSIS on the differential. A pertinent negative MUST NOT clear a contraindication, side effect, or eligibility marker for the correct THERAPEUTIC choice (see Rule H — Anti-Cueing). Do NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, etc.) unless directly relevant to the diagnosis.';

const NEW_PERTINENT_NEG_TIER3 =
  '- Pertinent Negatives: Include 1-2 pertinent negatives ONLY if they help rule out a competing DIAGNOSIS on the differential. A pertinent negative MUST NOT clear a contraindication, side effect, or eligibility marker for the correct THERAPEUTIC choice (see Rule H — Anti-Cueing). DO NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, pelvic exam, etc.) unless the case turns on them.';

const VALIDATOR_FUNCTION = `
// ─── ANTI-CUEING VALIDATOR ────────────────────────────────────────────────────
// Detects pertinent-negative patterns in the stem that telegraph the correct
// therapeutic choice. Returns true if cueing is detected (item should be rejected).
//
// This is a heuristic safety net. Rule H in the system prompt is the primary
// defense; the validator catches slip-throughs. False positives are possible
// (a pertinent negative may legitimately rule out a competing differential that
// happens to share a contraindication with the correct answer); items it flags
// should be human-reviewed rather than silently discarded.
function detectAntiCueingViolation(p) {
  if (!p || !p.stem || !p.choices || !p.correct) return false;

  const stemLower   = p.stem.toLowerCase();
  const correctText = (p.choices[p.correct] || "").toLowerCase();

  const CUEING_PAIRS = [
    {
      label: "SGLT2 inhibitor",
      drugPatterns: [
        /\\bsglt[\\-\\s]?2\\b/i,
        /\\b(empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|bexagliflozin)\\b/i
      ],
      cuePatterns: [
        /\\bno\\b.{0,40}\\b(bladder cancer|recurrent uti|fournier|euglycemic dka)\\b/i,
        /\\bdenies\\b.{0,40}\\b(bladder cancer|recurrent uti)\\b/i,
        /\\bnegative\\s+(history\\s+)?for\\b.{0,40}\\bbladder cancer\\b/i
      ]
    },
    {
      label: "GLP-1 receptor agonist",
      drugPatterns: [
        /\\bglp[\\-\\s]?1\\b/i,
        /\\b(liraglutide|semaglutide|dulaglutide|exenatide|tirzepatide|lixisenatide)\\b/i
      ],
      cuePatterns: [
        /\\bno\\b.{0,40}\\b(history of pancreatitis|pancreatitis|medullary thyroid|men\\s*2|men2)\\b/i,
        /\\bdenies\\b.{0,40}\\b(pancreatitis|medullary thyroid)\\b/i,
        /\\bnegative\\s+family\\s+history\\b.{0,40}\\b(medullary thyroid|men\\s*2)\\b/i
      ]
    },
    {
      label: "Metformin",
      drugPatterns: [/\\bmetformin\\b/i, /\\bglucophage\\b/i],
      cuePatterns: [
        /\\begfr\\b.{0,30}\\b(>|>=|greater than)\\s*30\\b/i,
        /\\bno\\b.{0,30}\\b(iv contrast|lactic acidosis|severe (renal|hepatic))\\b/i
      ]
    },
    {
      label: "Thiazolidinedione (pioglitazone)",
      drugPatterns: [/\\bpioglitazone\\b/i, /\\brosiglitazone\\b/i, /\\bthiazolidinedione\\b/i, /\\btzd\\b/i],
      cuePatterns: [
        /\\bno\\b.{0,40}\\b(heart failure|peripheral edema|history of bladder cancer|history of fracture)\\b/i,
        /\\bnyha\\b.{0,10}\\bclass\\s*i\\b/i
      ]
    },
    {
      label: "Sulfonylurea",
      drugPatterns: [/\\bsulfonylurea\\b/i, /\\b(glipizide|glyburide|glimepiride|gliclazide)\\b/i],
      cuePatterns: [
        /\\bregular meal pattern\\b/i,
        /\\bno\\b.{0,30}\\bskipped meals\\b/i,
        /\\breliable meal schedule\\b/i
      ]
    },
    {
      label: "Insulin",
      drugPatterns: [/\\b(insulin glargine|insulin detemir|insulin degludec|basal insulin|nph|regular insulin|lispro|aspart|glulisine)\\b/i],
      cuePatterns: [
        /\\breliable.{0,30}(self.?care|injection|adherence)\\b/i,
        /\\bable to\\b.{0,20}\\b(self.?monitor|inject|adhere)\\b/i,
        /\\bgood understanding\\b.{0,30}\\binjection\\b/i
      ]
    },
    {
      label: "Sacubitril/Valsartan or ACE-I/ARB",
      drugPatterns: [
        /\\b(sacubitril|valsartan|entresto|lisinopril|enalapril|ramipril|losartan|olmesartan|candesartan)\\b/i,
        /\\b(ace\\s*inhibitor|arni|arb)\\b/i
      ],
      cuePatterns: [
        /\\bno\\b.{0,30}\\b(angioedema|history of cough on ace)\\b/i,
        /\\b36.?hour\\s+washout\\b/i
      ]
    },
    {
      label: "Mineralocorticoid receptor antagonist",
      drugPatterns: [/\\b(spironolactone|eplerenone|finerenone|mineralocorticoid receptor antagonist|mra)\\b/i],
      cuePatterns: [
        /\\bpotassium\\b.{0,20}\\b(normal|3\\.[5-9]|4\\.\\d)\\b/i,
        /\\bk\\+?\\b.{0,15}\\b(3\\.[5-9]|4\\.\\d)\\b/i
      ]
    },
    {
      label: "Non-selective beta-blocker",
      drugPatterns: [/\\b(propranolol|nadolol|carvedilol|labetalol|timolol)\\b/i],
      cuePatterns: [/\\bno\\b.{0,30}\\b(asthma|bronchospasm|reactive airway|copd exacerbation)\\b/i]
    },
    {
      label: "Thiazide or loop diuretic",
      drugPatterns: [/\\b(hydrochlorothiazide|hctz|chlorthalidone|indapamide|furosemide|bumetanide|torsemide|metolazone)\\b/i],
      cuePatterns: [/\\bno\\b.{0,30}\\b(history of gout|hyperuricemia)\\b/i]
    },
    {
      label: "QT-prolonging agent",
      drugPatterns: [/\\b(methadone|ondansetron|haloperidol|sotalol|dofetilide|amiodarone|citalopram|escitalopram|azithromycin|levofloxacin|moxifloxacin)\\b/i],
      cuePatterns: [
        /\\bqtc\\b.{0,15}\\b[34]\\d{2}\\s*ms\\b/i,
        /\\bno\\b.{0,30}\\b(qt prolongation|long qt|torsades)\\b/i
      ]
    },
    {
      label: "DPP-4 inhibitor",
      drugPatterns: [/\\b(sitagliptin|saxagliptin|linagliptin|alogliptin|vildagliptin)\\b/i, /\\bdpp.?4\\b/i],
      cuePatterns: [/\\bno\\b.{0,30}\\b(history of pancreatitis|heart failure)\\b/i]
    },
    {
      label: "Bisphosphonate",
      drugPatterns: [/\\b(alendronate|risedronate|ibandronate|zoledronic acid|pamidronate)\\b/i, /\\bbisphosphonate\\b/i],
      cuePatterns: [
        /\\bno\\b.{0,30}\\b(esophageal|gastroesophageal|gerd|dental work|jaw)\\b/i,
        /\\begfr\\b.{0,30}\\b(>|>=|greater than)\\s*35\\b/i
      ]
    },
    {
      label: "Denosumab",
      drugPatterns: [/\\bdenosumab\\b/i, /\\bprolia\\b/i, /\\bxgeva\\b/i],
      cuePatterns: [
        /\\bcalcium\\b.{0,20}\\b(normal|9\\.\\d|10\\.\\d)\\b/i,
        /\\bno\\b.{0,30}\\bhypocalcemia\\b/i
      ]
    },
    {
      label: "Levothyroxine dose adjustment",
      drugPatterns: [/\\b(increase|decrease|adjust).{0,20}levothyroxine\\b/i, /\\blevothyroxine\\s+dose\\b/i],
      cuePatterns: [
        /\\bgood adherence\\b/i,
        /\\btakes (it|levothyroxine) on an empty stomach\\b/i,
        /\\bno (calcium|iron|ppi|coffee).{0,20}(within|near|around).{0,10}(dose|administration)\\b/i
      ]
    }
  ];

  for (const pair of CUEING_PAIRS) {
    const correctMatches = pair.drugPatterns.some(pat => pat.test(correctText));
    if (!correctMatches) continue;
    for (const cuePat of pair.cuePatterns) {
      if (cuePat.test(stemLower)) {
        console.warn(\`[detectAntiCueingViolation] CUEING — stem telegraphs "\${pair.label}".\`);
        return true;
      }
    }
  }
  return false;
}
`;

const NEW_LEVEL_RULES_LET = `  let levelRules;
  if (isStep1) {
    levelRules = \`USMLE STEP 1 RULES (M2 LEVEL — BASIC SCIENCE INTEGRATION):
- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs.
- Question type focus: mechanism of disease, pharmacology MOA, biochemistry pathways, genetics, microbiology, pathophysiology, histology, gross anatomy.
- Acceptable lead-ins: "most likely cause", "best explanation for this finding", "mechanism most likely responsible".
- AVOID management-style lead-ins — Step 1 tests UNDERSTANDING, not management decisions.
- Distractors should target the most common student confusions (mechanistically adjacent enzymes/pathways/receptors).
- Shorter stems acceptable (1–2 well-loaded sentences if the case turns on a single mechanism).\`;
  } else if (level === "USMLE Step 2 CK") {
    levelRules = \`USMLE STEP 2 CK RULES (M3/M4 LEVEL — CLINICAL REASONING):
- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs/Imaging.
- Question type focus: most likely diagnosis, best initial diagnostic test, best initial management, most likely cause of an acute clinical finding.
- Test PATTERN RECOGNITION of common conditions over rare ones — bread-and-butter conditions seen on medicine, surgery, peds, OB/GYN, psych, family medicine rotations.
- Distractors are competing diagnoses on the differential — wrong but plausible to a clerkship student.
- Settings: outpatient clinic, ED, inpatient ward, urgent care.
- Bayesian reasoning expected: prior probability + new test result → posterior decision.\`;
  } else if (isStep3) {
    levelRules = \`USMLE STEP 3 RULES (PGY-1 LEVEL — PRACTICE-READY PHYSICIAN):
- Question type focus: management decisions, disposition (admit vs discharge, ICU vs floor), threshold decisions (treat vs observe), follow-up planning.
- FORBIDDEN: "What is the most likely diagnosis?" — diagnosis must be implied or stated in the stem.
- Distractors should reflect real management forks where a PGY-1 might choose wrong (premature discharge, unnecessary admission, wrong tier of antibiotic, wrong agent in a stepped protocol).
- Multi-system, complex patients are expected; address polypharmacy, comorbidity interactions, code status, goals of care where appropriate.
- Public-health, ethics, and biostatistics integration acceptable when clinically relevant.\`;
  } else if (isABIM_IM) {
    levelRules = \`ABIM INTERNAL MEDICINE RULES (BOARD-CERTIFYING INTERNIST LEVEL):
- Question type focus: multi-system synthesis, complex comorbidities, drug-drug interactions, treatment failure or intolerance, borderline risk scores requiring judgment.
- FORBIDDEN: "What is the most likely diagnosis?" — synthesis questions require management-level lead-ins.
- Distractors must be options a guideline-aware internist might actually choose; "obviously wrong" distractors are unacceptable at this level.
- Address: when to refer to subspecialty, when to initiate vs withhold treatment, how to adjust for comorbidities (CKD, HF, cirrhosis, frailty).\`;
  } else if (isABIM_Endo) {
    levelRules = \`ABIM ENDOCRINOLOGY RULES (SUBSPECIALIST LEVEL):
- Question type focus: atypical presentations, guideline-edge cases, complex diagnostic workups (CRH stimulation, IPSS, octreotide/68Ga-DOTATATE scan, genetic panels), therapy modification.
- FORBIDDEN: "What is the most likely diagnosis?" — the stem must test subspecialty management, complex diagnostic workup, or therapy modification.
- Distractors must be options a subspecialty colleague might reasonably propose; items must discriminate between fellow-level and attending-level reasoning.
- Address: dynamic testing protocols, surgical vs medical management, peri-procedural management (adrenalectomy, thyroidectomy), pregnancy considerations for endocrine disease.\`;
  } else {
    levelRules = \`BOARD-STYLE RULES: Generalist synthesis level.\`;
  }`;

const NEW_LEVEL_RULES_CONST = `  let _lr;
  if (isStep1) {
    _lr = "USMLE STEP 1 RULES (M2 LEVEL — BASIC SCIENCE INTEGRATION):\\n- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs.\\n- Question type focus: mechanism of disease, pharmacology MOA, biochemistry pathways, genetics, microbiology, pathophysiology, histology, gross anatomy.\\n- Acceptable lead-ins: 'most likely cause', 'best explanation for this finding', 'mechanism most likely responsible'.\\n- AVOID management-style lead-ins — Step 1 tests UNDERSTANDING, not management decisions.\\n- Distractors should target the most common student confusions (mechanistically adjacent enzymes/pathways/receptors).\\n- Shorter stems acceptable (1–2 well-loaded sentences if the case turns on a single mechanism).";
  } else if (level === "USMLE Step 2 CK") {
    _lr = "USMLE STEP 2 CK RULES (M3/M4 LEVEL — CLINICAL REASONING):\\n- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs/Imaging.\\n- Question type focus: most likely diagnosis, best initial diagnostic test, best initial management, most likely cause of an acute clinical finding.\\n- Test PATTERN RECOGNITION of common conditions over rare ones — bread-and-butter conditions on medicine, surgery, peds, OB/GYN, psych, family medicine rotations.\\n- Distractors are competing diagnoses on the differential — wrong but plausible to a clerkship student.\\n- Settings: outpatient clinic, ED, inpatient ward, urgent care.\\n- Bayesian reasoning expected: prior probability + new test result → posterior decision.";
  } else if (isStep3) {
    _lr = "USMLE STEP 3 RULES (PGY-1 LEVEL — PRACTICE-READY PHYSICIAN):\\n- Question type focus: management decisions, disposition (admit vs discharge, ICU vs floor), threshold decisions (treat vs observe), follow-up planning.\\n- FORBIDDEN: 'What is the most likely diagnosis?' — diagnosis must be implied or stated in the stem.\\n- Distractors should reflect real management forks where a PGY-1 might choose wrong (premature discharge, unnecessary admission, wrong tier of antibiotic, wrong agent in a stepped protocol).\\n- Multi-system, complex patients are expected; address polypharmacy, comorbidity interactions, code status, goals of care where appropriate.\\n- Public-health, ethics, and biostatistics integration acceptable when clinically relevant.";
  } else if (isABIM_IM) {
    _lr = "ABIM INTERNAL MEDICINE RULES (BOARD-CERTIFYING INTERNIST LEVEL):\\n- Question type focus: multi-system synthesis, complex comorbidities, drug-drug interactions, treatment failure or intolerance, borderline risk scores requiring judgment.\\n- FORBIDDEN: 'What is the most likely diagnosis?' — synthesis questions require management-level lead-ins.\\n- Distractors must be options a guideline-aware internist might actually choose; 'obviously wrong' distractors are unacceptable at this level.\\n- Address: when to refer to subspecialty, when to initiate vs withhold treatment, how to adjust for comorbidities (CKD, HF, cirrhosis, frailty).";
  } else if (isABIM_Endo) {
    _lr = "ABIM ENDOCRINOLOGY RULES (SUBSPECIALIST LEVEL):\\n- Question type focus: atypical presentations, guideline-edge cases, complex diagnostic workups (CRH stimulation, IPSS, octreotide/68Ga-DOTATATE scan, genetic panels), therapy modification.\\n- FORBIDDEN: 'What is the most likely diagnosis?' — the stem must test subspecialty management, complex diagnostic workup, or therapy modification.\\n- Distractors must be options a subspecialty colleague might reasonably propose; items must discriminate between fellow-level and attending-level reasoning.\\n- Address: dynamic testing protocols, surgical vs medical management, peri-procedural management (adrenalectomy, thyroidectomy), pregnancy considerations for endocrine disease.";
  } else {
    _lr = "BOARD-STYLE RULES: Generalist synthesis level.";
  }
  const levelRules = _lr;`;

// ─── PATCH DEFINITIONS ───────────────────────────────────────────────────────

/**
 * Each patch:
 *   name:   human label for log output
 *   marker: substring whose presence means "already applied" (skip if present)
 *   find:   exact substring to locate (or null = use `find_re`)
 *   find_re: regex alternative (used when `find` is null)
 *   replace: string to splice in (replaces matched text)
 *   mode:   "replace" | "insert_after" | "append_in_block"
 *   required: if true, missing anchor fails the whole run
 */

const PATCHES_COMMON = [
  // ─────────────────── PRIORITY 2: Expanded levelRules ────────────────────
  {
    name: "Priority 2 — Expand levelRules (let form, generate-mcq.js)",
    marker: "USMLE STEP 1 RULES (M2 LEVEL — BASIC SCIENCE",
    find:
      "  let levelRules = isStep1\n" +
      "    ? `USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1.`\n" +
      "    : isABIM_IM\n" +
      "    ? `ABIM IM RULES: Generalist level. Internist synthesis for complex comorbidities.`\n" +
      "    : `ABIM ENDOCRINOLOGY RULES: Full subspecialty level.`;",
    replace: NEW_LEVEL_RULES_LET,
    required: false,
    onlyIfPresent: true,
  },
  {
    name: "Priority 2 — Expand levelRules (const form, bulk-generate.js)",
    marker: "USMLE STEP 1 RULES (M2 LEVEL — BASIC SCIENCE",
    find:
      '  const levelRules  = isStep1\n' +
      '    ? "USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1."\n' +
      '    : isABIM_IM\n' +
      '    ? "ABIM IM RULES: Generalist level. Internist synthesis for complex comorbidities."\n' +
      '    : "ABIM ENDOCRINOLOGY RULES: Full subspecialty level.";',
    replace: NEW_LEVEL_RULES_CONST,
    required: false,
    onlyIfPresent: true,
  },

  // ─────────────────── PRIORITY 1: Append Rule H ──────────────────────────
  {
    name: "Priority 1 — Append Rule H to integrityRules",
    marker: "H. ANTI-CUEING (CRITICAL — VIOLATIONS DISQUALIFY",
    find:
      "G. STEM-EXPLANATION NUMERIC LOCK: Every lab value, vital sign, and numeric result cited in your explanation MUST be identical to the value stated in the stem. Re-read your stem before calling emit_mcq.`;",
    replace:
      "G. STEM-EXPLANATION NUMERIC LOCK: Every lab value, vital sign, and numeric result cited in your explanation MUST be identical to the value stated in the stem. Re-read your stem before calling emit_mcq." +
      RULE_H +
      "`;",
    required: true,
  },

  // ────────────── PRIORITY 1: Pertinent Negatives (Step 1 branch) ─────────
  {
    name: "Priority 1 — Update Pertinent Negatives (Step 1 branch)",
    marker: "Include a pertinent negative ONLY if it helps rule out a competing DIAGNOSIS",
    find:
      "- Pertinent Negatives: Include a pertinent negative ONLY if it helps rule out a competing answer choice. Do NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, etc.) unless directly relevant to the diagnosis.",
    replace: NEW_PERTINENT_NEG_STEP1,
    required: true,
  },

  // ────────────── PRIORITY 1: Pertinent Negatives (Tier 3 branch) ─────────
  {
    name: "Priority 1 — Update Pertinent Negatives (Tier 3 branch)",
    marker: "Include 1-2 pertinent negatives ONLY if they help rule out a competing DIAGNOSIS",
    find:
      "- Pertinent Negatives: Include 1-2 pertinent negatives ONLY if they help rule out a competing answer choice. DO NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, pelvic exam, etc.) unless the case turns on them.",
    replace: NEW_PERTINENT_NEG_TIER3,
    required: true,
  },

  // ─────────────── PRIORITY 1: Insert validator function ──────────────────
  {
    name: "Priority 1 — Insert detectAntiCueingViolation function",
    marker: "function detectAntiCueingViolation(p)",
    find_re: /function validateChoiceCompleteness\(p\) \{[\s\S]*?\n  return true;\n\}/,
    replaceFn: (matched) => matched + "\n" + VALIDATOR_FUNCTION,
    required: true,
  },
];

const PATCHES_API_ONLY = [
  // ───────── PRIORITY 1: Wire validator into main validation chain ────────
  {
    name: "Priority 1 — Wire validator into main validation chain",
    marker: "cueingFree    = !detectAntiCueingViolation(p);",
    find:
      "const demoOk        = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic);\n" +
      "      const consistencyOk = validateConsistency(p);\n" +
      "      const choicesOk     = validateChoiceCompleteness(p);\n" +
      "      isValid = demoOk && consistencyOk && choicesOk;",
    replace:
      "const demoOk        = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic);\n" +
      "      const consistencyOk = validateConsistency(p);\n" +
      "      const choicesOk     = validateChoiceCompleteness(p);\n" +
      "      const cueingFree    = !detectAntiCueingViolation(p);\n" +
      "      isValid = demoOk && consistencyOk && choicesOk && cueingFree;",
    required: true,
  },

  // ─────────── PRIORITY 1: Wire validator into Gemini fallback ────────────
  {
    name: "Priority 1 — Wire validator into Gemini fallback",
    marker: "validateChoiceCompleteness(p) && !detectAntiCueingViolation(p)",
    find:
      "isValid = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic) && validateConsistency(p) && validateChoiceCompleteness(p);",
    replace:
      "isValid = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic) && validateConsistency(p) && validateChoiceCompleteness(p) && !detectAntiCueingViolation(p);",
    required: true,
  },
];

const PATCHES_BULK_ONLY = [
  // ─────────── PRIORITY 1: Wire validator into processRawMcq ──────────────
  {
    name: "Priority 1 — Wire validator into processRawMcq",
    marker: "if (detectAntiCueingViolation(p)) return null;",
    find:
      "if (!validateDemographics(p.stem, p._sex || \"man\", resolvedTopic)) return null;\n" +
      "  if (!validateConsistency(p)) return null;",
    replace:
      "if (!validateDemographics(p.stem, p._sex || \"man\", resolvedTopic)) return null;\n" +
      "  if (!validateConsistency(p)) return null;\n" +
      "  if (detectAntiCueingViolation(p)) return null;",
    required: true,
  },
];

// ─── SUPABASE MIGRATION SQL ──────────────────────────────────────────────────
const SQL_MIGRATION = `-- ════════════════════════════════════════════════════════════════════════════
-- MedBoard Pro — Priority 1 Schema Migration
-- Adds anti-cueing tracking columns to the mcqs table.
-- Run this in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.mcqs
  ADD COLUMN IF NOT EXISTS cueing_flag       BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cueing_notes      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cueing_checked_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.mcqs.cueing_flag IS
  'NULL = not yet checked. FALSE = passed anti-cueing validator. TRUE = flagged for human review.';

-- Partial index — only NULL and TRUE rows (items needing attention) are indexed.
CREATE INDEX IF NOT EXISTS idx_mcqs_cueing_flag
  ON public.mcqs (cueing_flag)
  WHERE cueing_flag IS NOT FALSE;
`;

// ─── ENGINE ──────────────────────────────────────────────────────────────────

function applyPatch(content, patch, fileLabel) {
  // Idempotency check
  if (!patch.skipMarkerCheck && content.includes(patch.marker)) {
    console.log(`  ⏭  [${fileLabel}] ${patch.name} — already applied, skipping`);
    return { content, applied: false, skipped: true, failed: false };
  }

  // Locate the anchor
  let matched, before, after;
  if (patch.find) {
    const idx = content.indexOf(patch.find);
    if (idx === -1) {
      if (patch.onlyIfPresent) {
        console.log(`  ⏭  [${fileLabel}] ${patch.name} — anchor not in this file, skipping`);
        return { content, applied: false, skipped: true, failed: false };
      }
      console.log(`  ❌ [${fileLabel}] ${patch.name} — anchor NOT FOUND`);
      return { content, applied: false, skipped: false, failed: true };
    }
    before = content.slice(0, idx);
    matched = patch.find;
    after = content.slice(idx + patch.find.length);
  } else if (patch.find_re) {
    const m = content.match(patch.find_re);
    if (!m) {
      console.log(`  ❌ [${fileLabel}] ${patch.name} — regex anchor NOT FOUND`);
      return { content, applied: false, skipped: false, failed: true };
    }
    const idx = content.indexOf(m[0]);
    before = content.slice(0, idx);
    matched = m[0];
    after = content.slice(idx + m[0].length);
  } else {
    console.log(`  ❌ [${fileLabel}] ${patch.name} — no anchor defined`);
    return { content, applied: false, skipped: false, failed: true };
  }

  const replacement = patch.replaceFn ? patch.replaceFn(matched) : patch.replace;
  const newContent = before + replacement + after;
  console.log(`  ✅ [${fileLabel}] ${patch.name}`);
  return { content: newContent, applied: true, skipped: false, failed: false };
}

function patchFile(filepath, patches, fileLabel) {
  if (!fs.existsSync(filepath)) {
    console.log(`\n⚠  ${filepath} not found — skipping (run this from repo root)`);
    return { applied: 0, skipped: 0, failed: 0, missing: true };
  }
  let content = fs.readFileSync(filepath, "utf8");
  const original = content;
  let applied = 0, skipped = 0, failed = 0;
  for (const patch of patches) {
    const res = applyPatch(content, patch, fileLabel);
    content = res.content;
    if (res.applied) applied++;
    if (res.skipped) skipped++;
    if (res.failed) failed++;
  }
  if (content !== original) {
    fs.writeFileSync(filepath + ".bak", original, "utf8");
    fs.writeFileSync(filepath, content, "utf8");
    console.log(`  💾 [${fileLabel}] wrote ${filepath} (backup: ${filepath}.bak)`);
  } else {
    console.log(`  ⏭  [${fileLabel}] no changes`);
  }
  return { applied, skipped, failed, missing: false };
}

function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  MedBoard Pro — Priority 1 + 2 Patcher");
  console.log("════════════════════════════════════════════════════════════\n");

  console.log("📄 Patching " + FILES.api);
  const r1 = patchFile(FILES.api, [...PATCHES_COMMON, ...PATCHES_API_ONLY], "api");

  console.log("\n📄 Patching " + FILES.bulk);
  const r2 = patchFile(FILES.bulk, [...PATCHES_COMMON, ...PATCHES_BULK_ONLY], "bulk");

  console.log("\n📄 Writing supabase-migration.sql");
  fs.writeFileSync("supabase-migration.sql", SQL_MIGRATION, "utf8");
  console.log("  💾 wrote supabase-migration.sql");

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("════════════════════════════════════════════════════════════");
  const totApplied = r1.applied + r2.applied;
  const totSkipped = r1.skipped + r2.skipped;
  const totFailed  = r1.failed  + r2.failed;
  console.log(`  Patches applied:  ${totApplied}`);
  console.log(`  Patches skipped:  ${totSkipped} (already applied or anchor not in file)`);
  console.log(`  Patches failed:   ${totFailed}`);

  if (totFailed > 0) {
    console.log("\n⚠  Some patches failed. Review the errors above.");
    console.log("   Possible causes:");
    console.log("     - File has been modified since the version this patcher targets");
    console.log("     - Wrong directory (run from repo root)");
    console.log("     - Whitespace differences in anchor strings");
    process.exit(1);
  }

  console.log("\n✅ Done. Next steps:");
  console.log("   1. Review the diff:    git diff netlify/functions/generate-mcq.js scripts/bulk-generate.js");
  console.log("   2. Run the SQL:        paste supabase-migration.sql into Supabase SQL editor");
  console.log("   3. Smoke-test:         generate 2-3 MCQs per exam level (Study Mode)");
  console.log("   4. Commit:             git add -A && git commit -m 'feat: anti-cueing + per-exam scaffolds'");
  console.log("   5. Delete backups:     rm netlify/functions/generate-mcq.js.bak scripts/bulk-generate.js.bak\n");
}

main();
