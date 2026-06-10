// bulk-generate.js — MedBoard Pro
// v7.9.0 — blueprint-aligned TOPIC_DISTRIBUTION rebuild (5 levels sum to 100 = exam %) + per-level targets; nutrition injection retired (bulk-only).
// v7.8.0 — blueprint-proportional cap + blueprint-weighted (deficit) draw; restores pre-B3 weighting (bulk-only).
// v7.7.0 — Phase-2 cross-run concept-saturation (warn-mode, bulk-only): candidate stems+keys
//          compared against the existing approved+pending bank, not just this batch.
//          Banner reconciled from 7.5.x drift (the 7.6.0 guard stack shipped in cb4d40d).
// v7.5.16 — lipid non-statin escalation = conventional ladder (ezetimibe → PCSK9i; bempedoic statin-intolerant branch only), 2026 ACC/AHA/PREVENT canon, LDL goal <55; AACE unseeded → 2025; interchangeable-agent flag tuned (warn-mode, precision+recall); parity with generate-mcq.js v7.5.16
// ---------------------------------------------------------------
// CHANGELOG (v7.5.15 — 2026-06-05):
// - TUNED: flagInterchangeableAgents precision + recall (warn-mode only; no
//   reject-gate change). (E1) GLP-1 tie-break now matches spelled-out cardiorenal
//   terms (atherosclerotic cardiovascular / chronic kidney disease /
//   albumin-to-creatinine / \bascvd\b). (E2) ketoconazole member gains (?<!levo)
//   lookbehind so levoketoconazole is one drug, not a self-pair. (E3) flag now
//   requires matched members to occupy >=2 distinct options (kills single-option
//   "e.g., X or Y" exemplar listings). Backtest over live Endo/IM bank:
//   11 -> 8 warn-hits, 0 true positives lost; IM clean.
//
// CHANGELOG (v7.5.14 — 2026-06-04):
// - ADDED: warn-mode interchangeable-agent soft-single-best flag (Rule M) on both paths.
//   flagInterchangeableAgents() + INTERCHANGEABLE_AGENT_CLASSES (SGLT2i, basal insulin,
//   anabolic osteo, Cushing steroidogenesis inhibitors, GLP-1/incretin). Flags choice sets
//   offering >=2 members of one class unless a tie-breaking stem feature is present
//   (e.g. eGFR 20-24 for SGLT2i, prior MI/stroke for romosozumab, QTc/hepatic for metyrapone,
//   CKD+albuminuria for semaglutide). NON-BLOCKING: never drops — mirrors checkUnseededCitations
//   at PART 2, past all reject gates. Bulk increments dropTally._warnInterchange (shown in run
//   summary); gen-mcq console.warns (no dropTally on single-question path).
//
// CHANGELOG (v7.5.13 — 2026-06-03):
// - FIXED (2a): added "most_appropriate_clinical_intervention" to ABIM Internal Medicine
//   and ABIM Endocrinology allow-lists in ALLOWED_LEAD_INS_BY_LEVEL (was permitted at
//   Step 2 CK / Step 3 only; ABIM is management-heavy and was silently dropping valid
//   intervention-tier items — ~4/14 at Endo smoke). Brings ABIM into §C.1 parity.
// - HARDENED (2b): added minLength:3 to choices A-E in emit_mcq tool schema as a
//   generation-time nudge against stub/empty first-option emits (validateChoiceCompleteness
//   remains the hard backstop; schema minLength is advisory to the model, not API-enforced).
//
// CHANGELOG (v7.5.12 — 2026-06-02):
// - REPOINTED: Primary Aldosteronism citation -> ES 2025 (Adler et al.),
//   retiring the superseded 2016 (Funder) CPG in the adrenal GUIDELINE_MAP.
// - FIXED: PA cognitive-complexity anchor (l2) — removed "adding amiloride"
//   steer (now anti-guideline); encodes 2025 canon (up-titrate MRA to raise
//   renin; spironolactone preferred; MRAs over ENaC inhibitors).
// - ADDED: validateNoPhantomCitations() + BANNED_CITATION_PATTERNS — hard
//   reject gate for fabricated/superseded (society, year, topic) tuples the
//   per-year allow-list cannot catch. Bulk: recordDrop("phantomCitation");
//   gen-mcq: phantomOk in both isValid chains. Bornstein-2016 PAI +
//   Lenders-2014 pheo intentionally pass.
// - No ALLOWED_GUIDELINE_CITATIONS change (ES already permits 2014/16/24/25).
// ---------------------------------------------------------------
// CHANGELOG (v7.5.6):
// - ADDED: 8 canon-aligned validators sourced from ABIM Question Writing
//   Guidelines (Sections B.1, B.3, C.1, C.2.a, C.2.b, D.4-D.7) and
//   USMLE/NBME Item-Writing Guide (6th ed):
//     validateLeadInType            — per-level enum allow-list (ABIM C.1)
//     validateNegativeForm          — bans EXCEPT / NOT / LEAST (ABIM C.2.b)
//     validateAssociatedWith        — bans "associated with" (ABIM C.2.a)
//     validateVagueQualifiers       — bans often/usually/etc in choices (ABIM B.3)
//     validateSubjectiveAdjectives  — bans young/elderly/obese as descriptors (ABIM B.3)
//     validatePejorativeLanguage    — bans "complains of" / "denies" (ABIM B.3)
//     validateNoAllOrNoneOfTheAbove — bans these as choices (ABIM D.6/D.7)
//     validateSiteOfCare            — requires site in first 2 stem sentences (ABIM B.1.c)
// - ADDED: lead_in_type field in MCQ_TOOL.input_schema (17-value universal enum).
// - ADDED: isStep2CK branch in buildPrompt() with dedicated qTypePool grounded
//   in USMLE Step 2 CK Physician Tasks/Competencies blueprint weights.
// - CORRECTED: Tier prompts no longer say "FORBIDDEN: most likely diagnosis"
//   at Step 3 / ABIM IM / ABIM Endo. ABIM canon lists diagnosis-tier
//   lead-ins under Question Task (a). Replaced with: "permitted only with
//   synthesis-tier atypical or guideline-edge stems" (matches ABIM's own
//   classification of diagnosis questions as synthesis-tier).
// - ADDED: ABIM race/ethnicity rule to L1 guardrails (B.1, second paragraph):
//   "Race or ethnic origin must not be mentioned in the stem unless the
//   testing point requires it and cannot be answered correctly without it."
// - FORWARD-ONLY: existing rows not retroactively re-validated. Validators
//   gate generation, not the existing bank.
// ---------------------------------------------------------------
// v7.5.5 — Parity with generate-mcq.js v7.5.4
// CHANGELOG (v7.5.5 — 2026-05-20):
// - FIXED (P0): processRawMcq now calls validateChoiceCompleteness.
//   Closes the root-cause bug that admitted 34 rows with empty {} choices.
//   Empty {} is truthy in JS, so the prior `if (!p.choices)` guard failed open;
//   validateChoiceCompleteness requires all 5 letter keys (A-E), length >= 3,
//   stem ending in '?', and the 🩺/🚫 markers in the explanation.
// - FIXED (P1): runStandardMode retry loop now runs up to 3 attempts (was 1).
//   Triggers on either network error OR validation failure (validator-driven
//   retry — not just transport-error retry).
// - SYNCED (P2): step3TierPrompt, abimIMTierPrompt, endoTier3Prompt now
//   include the distractor-requirement lines previously stripped:
//     • Step 3: "Distractors must include the Tier 1/2 answer (MS3 choice)."
//     • ABIM IM: "Distractors must include the Tier 1 answer (MS4 choice)."
//     • ABIM Endo: "Distractors must include the 'classic teaching' answer."
//   Plus the Step 3 "realistic constraint" clause (facility/transfer/failure).
// - ADDED (P5): callGemini + extractJSONSimple helpers. Gemini 2.0 Flash
//   serves as fallback after 3 failed Claude attempts. No-op if
//   GEMINI_API_KEY is unset.
// ---------------------------------------------------------------
// CHANGELOG (v7.5.3):
// - SYNCED: Synchronized with generate-mcq.js v7.5.3 logic.
// - FIXED: Added missing nutrition topic injection during bulk "Random" generation.
// - OPTIMIZED: Synchronized deriveSpecialtyGroup with production API.
// - CLINICAL UPDATE: Integrated ATA 2025 DTC Guidelines for Papillary/Follicular cancer.generate.js — MedBoard Pro
// v7.5.3 — Randomization Loop & Nutrition Bug Fixes Sync
// ---------------------------------------------------------------
// CHANGELOG:
// - SYNCED (v7.5.3): Synchronized with generate-mcq.js v7.5.3 logic.
// - FIXED (v7.5.3): Added missing nutrition topic injection during bulk "Random" (All Topics) generation.
// - OPTIMIZED: Synchronized deriveSpecialtyGroup with production API.
// - CLINICAL UPDATE: Integrated ATA 2025 DTC Guidelines. Model is instructed 
//   to use ATA 2025 exclusively for Papillary/Follicular cancer.

"use strict";
const crypto = require("crypto");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BULK_CLAUDE_MODEL = "claude-sonnet-4-6";
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
   const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
   if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
     throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY env vars are required");
   }

if (!ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY is required.");
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}
const TARGET_COUNT = parseInt(process.env.BULK_COUNT  || getArg("--count", "500"), 10);
const FILTER_LEVEL = (process.env.BULK_LEVEL || getArg("--level", "")).trim() || null;
const FILTER_TOPIC = (process.env.BULK_TOPIC || getArg("--topic", "")).trim() || null;
const MODE         = (process.env.BULK_MODE  || getArg("--mode", "batch")).trim();
const CONCURRENCY  = parseInt(process.env.BULK_CONCURRENCY || getArg("--concurrency", "6"), 10);
const VERIFY_PASS  = /^(1|true|on|yes)$/i.test(process.env.VERIFY_PASS || "");   // Layer-4a verify-pass (opt-in; ~doubles Claude calls)
const VERIFY_MODEL = process.env.VERIFY_MODEL || "claude-sonnet-4-6";          // set to another model id for cross-model independence

const VALID_LEVELS = ["ABIM Internal Medicine", "ABIM Endocrinology", "USMLE Step 1", "USMLE Step 2 CK", "USMLE Step 3"];

const NUTRITION_INJECTION_RATE = 0; // v7.9.0 retired — nutrition folded into weighted TOPIC_DISTRIBUTION

const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const MALE_ONLY_TOPIC_KEYWORDS   = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
const FEMALE_ONLY_TOPIC_KEYWORDS = ["pcos", "polycystic ovary", "menopause", "ovarian", "endometri", "pregnancy", "obstetric", "gynecolog", "turner syndrome"];

const TOPIC_DISTRIBUTION = {
  "ABIM Endocrinology": [
    { topic: "Type 2 Diagnosis and Management",  weight: 7 },
    { topic: "Type 1 Insulin Therapy",           weight: 5 },
    { topic: "DKA and HHS",                       weight: 4 },
    { topic: "Hypoglycemia",                      weight: 3 },
    { topic: "GLP-1 Receptor Agonists",           weight: 3 },
    { topic: "SGLT2 Inhibitors",                  weight: 3 },
    { topic: "CGM and AID Systems",               weight: 2 },
    { topic: "Insulinoma",                        weight: 1 },
    { topic: "Diabetic complications (retinopathy, neuropathy, nephropathy)", weight: 3 },
    { topic: "Hypothyroidism and Hashimotos",     weight: 4 },
    { topic: "Hyperthyroidism and Graves",        weight: 4 },
    { topic: "Thyroid Nodule Evaluation",         weight: 3 },
    { topic: "Thyroid Cancer",                    weight: 3 },
    { topic: "Thyroid Storm",                     weight: 2 },
    { topic: "Thyroiditis (subacute and postpartum)", weight: 2 },
    { topic: "Dyslipidemia (2026 ACC/AHA/PREVENT)", weight: 4 },
    { topic: "Obesity pharmacotherapy",           weight: 3 },
    { topic: "Medical nutrition therapy for T1DM/T2DM (ADA 2026)", weight: 2 },
    { topic: "Bariatric surgery and metabolic outcomes", weight: 2 },
    { topic: "Hypertriglyceridemia and pancreatitis risk", weight: 2 },
    { topic: "Osteoporosis",                      weight: 4 },
    { topic: "Hyperparathyroidism",               weight: 3 },
    { topic: "Hypercalcemia",                     weight: 2 },
    { topic: "MEN1",                              weight: 1 },
    { topic: "Hypocalcemia and hypoparathyroidism", weight: 1 },
    { topic: "Metabolic bone disease (osteomalacia, Paget)", weight: 1 },
    { topic: "Cushing Syndrome",                  weight: 2 },
    { topic: "Primary Aldosteronism",             weight: 2 },
    { topic: "Adrenal Insufficiency",             weight: 2 },
    { topic: "Pheochromocytoma",                  weight: 1 },
    { topic: "MEN2A and MEN2B",                   weight: 1 },
    { topic: "Prolactinoma",                      weight: 2 },
    { topic: "Acromegaly",                        weight: 2 },
    { topic: "Hypopituitarism",                   weight: 2 },
    { topic: "Diabetes Insipidus",                weight: 1 },
    { topic: "Non-functioning pituitary adenoma", weight: 1 },
    { topic: "PCOS",                              weight: 2 },
    { topic: "Functional hypothalamic amenorrhea", weight: 1 },
    { topic: "Menopause and hormone therapy",     weight: 1 },
    { topic: "Turner syndrome and primary ovarian insufficiency", weight: 1 },
    { topic: "Male Hypogonadism",                 weight: 2 },
    { topic: "Testosterone therapy and monitoring", weight: 1 },
    { topic: "Gynecomastia",                      weight: 1 },
    { topic: "Klinefelter syndrome and male infertility", weight: 1 },
  ],
  "ABIM Internal Medicine": [
    { topic: "ACS STEMI NSTEMI",                  weight: 3 },
    { topic: "Heart Failure",                     weight: 3 },
    { topic: "Atrial Fibrillation",               weight: 2 },
    { topic: "Hypertension",                      weight: 2 },
    { topic: "Valvular heart disease",            weight: 2 },
    { topic: "Lipid Disorders",                   weight: 1 },
    { topic: "Cardiomyopathy and pericardial disease", weight: 1 },
    { topic: "Cardiovascular prevention and syncope", weight: 1 },
    { topic: "Type 2 Diagnosis and Management",   weight: 3 },
    { topic: "Hypothyroidism and Hashimotos",     weight: 2 },
    { topic: "Adrenal disorders (IM)",            weight: 1 },
    { topic: "Osteoporosis and calcium-bone (IM)", weight: 1 },
    { topic: "Pituitary and SIADH (IM)",          weight: 1 },
    { topic: "Diabetes complications and emergencies (IM)", weight: 2 },
    { topic: "IBD Crohns and UC",                 weight: 2 },
    { topic: "Cirrhosis",                         weight: 2 },
    { topic: "Peptic ulcer disease, GERD, H. pylori", weight: 2 },
    { topic: "GI bleeding",                       weight: 1 },
    { topic: "Pancreatitis",                      weight: 1 },
    { topic: "Viral hepatitis and NAFLD",         weight: 1 },
    { topic: "Malabsorption and chronic diarrhea", weight: 1 },
    { topic: "Pneumonia",                         weight: 2 },
    { topic: "Sepsis and Septic Shock",           weight: 2 },
    { topic: "HIV",                               weight: 2 },
    { topic: "Urinary tract infection and pyelonephritis", weight: 1 },
    { topic: "Infective endocarditis",            weight: 1 },
    { topic: "Skin, soft tissue, and bone infection", weight: 1 },
    { topic: "Antimicrobial stewardship and resistance", weight: 1 },
    { topic: "Rheumatoid Arthritis",              weight: 2 },
    { topic: "SLE",                               weight: 2 },
    { topic: "Crystal arthropathy (gout and CPPD)", weight: 2 },
    { topic: "Systemic vasculitis",               weight: 1 },
    { topic: "Spondyloarthropathy",               weight: 1 },
    { topic: "Osteoarthritis and mechanical back pain", weight: 1 },
    { topic: "Polymyalgia rheumatica and giant cell arteritis", weight: 1 },
    { topic: "Asthma and COPD",                   weight: 2 },
    { topic: "Pulmonary Embolism",                weight: 2 },
    { topic: "Interstitial lung disease and sarcoidosis", weight: 1 },
    { topic: "Pleural disease",                   weight: 1 },
    { topic: "Pulmonary hypertension",            weight: 1 },
    { topic: "Obstructive sleep apnea and respiratory failure", weight: 1 },
    { topic: "Acute Kidney Injury",               weight: 2 },
    { topic: "CKD",                               weight: 1 },
    { topic: "Electrolyte Disorders",             weight: 1 },
    { topic: "Acid-Base Disorders",               weight: 1 },
    { topic: "Glomerular disease, nephrolithiasis, and hematuria", weight: 1 },
    { topic: "Breast cancer",                     weight: 1 },
    { topic: "Lung cancer",                       weight: 1 },
    { topic: "Colorectal cancer",                 weight: 1 },
    { topic: "Lymphoma and leukemia",             weight: 1 },
    { topic: "Oncologic emergencies",             weight: 1 },
    { topic: "Cancer screening and survivorship", weight: 1 },
    { topic: "Anemia",                            weight: 1 },
    { topic: "DVT and Anticoagulation",           weight: 1 },
    { topic: "Thrombocytopenia and bleeding disorders", weight: 1 },
    { topic: "Hemoglobinopathy and hemolytic anemia", weight: 1 },
    { topic: "Stroke and TIA",                    weight: 1 },
    { topic: "Seizure and epilepsy",              weight: 1 },
    { topic: "Headache and migraine",             weight: 1 },
    { topic: "Neurodegenerative disease and peripheral neuropathy", weight: 1 },
    { topic: "Drug eruptions and SJS/TEN",        weight: 1 },
    { topic: "Skin cancer and suspicious lesions", weight: 1 },
    { topic: "Common inflammatory dermatoses",    weight: 1 },
    { topic: "Contraception and menstrual disorders", weight: 1 },
    { topic: "Medical disease in pregnancy",      weight: 1 },
    { topic: "Menopause and breast/cervical screening", weight: 1 },
    { topic: "Depression and anxiety disorders",  weight: 1 },
    { topic: "Substance use disorders",           weight: 1 },
    { topic: "Delirium, dementia, and somatic symptom disorders", weight: 1 },
    { topic: "Falls, frailty, and polypharmacy",  weight: 1 },
    { topic: "Delirium and cognitive impairment", weight: 1 },
    { topic: "Goals of care, advance directives, and end-of-life", weight: 1 },
    { topic: "Anaphylaxis and drug allergy",      weight: 1 },
    { topic: "Immunodeficiency and angioedema",   weight: 1 },
    { topic: "General internal medicine and patient safety", weight: 1 },
    { topic: "Acute vision loss, red eye, and retinopathy", weight: 1 },
    { topic: "ENT and oral-dental medicine",      weight: 1 },
  ],
  "USMLE Step 1": [
    { topic: "Systemic Pathology and Pathophysiology",              weight: 24 },
    { topic: "Physiology and Clinical Biochemistry",                weight: 20 },
    { topic: "Pharmacology, Pharmacokinetics, and Adverse Effects",  weight: 16 },
    { topic: "Microbiology, Virology, and Immunology",              weight: 16 },
    { topic: "Anatomy, Neuroanatomy, and Embryology",               weight: 12 },
    { topic: "Behavioral Science, Medical Ethics, and Biostatistics", weight: 8 },
    { topic: "Genetics and Molecular Medicine",                     weight: 4 },
  ],
  "USMLE Step 2 CK": [
    { topic: "ACS STEMI NSTEMI",                  weight: 4 },
    { topic: "Heart Failure",                     weight: 3 },
    { topic: "Arrhythmias and valvular disease (CK)", weight: 3 },
    { topic: "Obstetrics and Gynecology",         weight: 5 },
    { topic: "Gestational Diabetes",              weight: 2 },
    { topic: "Prenatal care and obstetric complications (CK)", weight: 2 },
    { topic: "Pediatrics and Congenital Issues",  weight: 8 },
    { topic: "GI bleeding and peptic ulcer (CK)", weight: 3 },
    { topic: "Liver and biliary disease (CK)",    weight: 3 },
    { topic: "IBD and diarrheal disease (CK)",    weight: 2 },
    { topic: "Pneumonia",                         weight: 3 },
    { topic: "Sepsis and Septic Shock",           weight: 3 },
    { topic: "Common infections and antimicrobials (CK)", weight: 2 },
    { topic: "Asthma, COPD, and obstructive disease (CK)", weight: 4 },
    { topic: "PE, pleural, and respiratory failure (CK)", weight: 3 },
    { topic: "Anemia and bleeding disorders (CK)", weight: 3 },
    { topic: "Common malignancies and oncologic emergencies (CK)", weight: 4 },
    { topic: "Psychiatry and Substance Abuse",    weight: 7 },
    { topic: "Acute Kidney Injury",               weight: 3 },
    { topic: "CKD, electrolytes, and acid-base (CK)", weight: 3 },
    { topic: "Type 2 Diagnosis and Management",   weight: 4 },
    { topic: "Thyroid and adrenal disorders (CK)", weight: 2 },
    { topic: "Stroke, seizure, and headache (CK)", weight: 4 },
    { topic: "Neuromuscular and neurodegenerative disease (CK)", weight: 2 },
    { topic: "General Surgery and Trauma Management", weight: 4 },
    { topic: "Perioperative and acute abdomen (CK)", weight: 2 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 4 },
    { topic: "Rheumatologic and musculoskeletal disease (CK)", weight: 4 },
    { topic: "Dermatology (CK)",                  weight: 3 },
    { topic: "Biostatistics and epidemiology (CK)", weight: 1 },
  ],
  "USMLE Step 3": [
    { topic: "ACS STEMI NSTEMI",                  weight: 4 },
    { topic: "Heart failure and chronic CV management (S3)", weight: 5 },
    { topic: "Hypertension and CV prevention (S3)", weight: 4 },
    { topic: "Type 2 Diagnosis and Management",   weight: 5 },
    { topic: "Chronic disease nutrition management", weight: 3 },
    { topic: "Thyroid and metabolic management (S3)", weight: 2 },
    { topic: "Sepsis and Septic Shock",           weight: 4 },
    { topic: "Outpatient and chronic infection management (S3)", weight: 7 },
    { topic: "CKD",                               weight: 4 },
    { topic: "AKI, electrolytes, and GU (S3)",    weight: 4 },
    { topic: "Pulmonary Embolism",                weight: 4 },
    { topic: "Asthma, COPD, and chronic pulmonary care (S3)", weight: 4 },
    { topic: "GI and hepatobiliary management (S3)", weight: 8 },
    { topic: "Psychiatry and Substance Abuse",    weight: 7 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 7 },
    { topic: "Obstetrics and Gynecology",         weight: 6 },
    { topic: "Hematology, oncology, and survivorship (S3)", weight: 7 },
    { topic: "Neurologic disease management (S3)", weight: 5 },
    { topic: "Geriatric and chronic disease management (S3)", weight: 5 },
    { topic: "Food insecurity screening",         weight: 2 },
    { topic: "Preventive care and health maintenance (S3)", weight: 3 },
  ],
};

// ============================================================
// TOPIC GUARDRAIL MAP
// ============================================================
const TOPIC_GUARDRAILS = [
  {
    keywords: ["atrial fibrillation stroke", "post-stroke anticoagulation", "cardioembolic stroke", "anticoagulation timing after stroke", "ELAN", "1-3-6-12", "DOAC after stroke", "secondary stroke prevention", "hemorrhagic transformation", "AF-related ischemic stroke"],
    l1: `POST-STROKE ANTICOAGULATION TIMING (AF-RELATED ISCHEMIC STROKE) FOUNDATIONAL ANCHORS:
- TWO frameworks coexist and are BOTH defensible: (1) the traditional EHRA "1-3-6-12 day" rule keyed to infarct severity (TIA ~day 1; small/mild ~day 3; moderate ~day 6; large/severe ~day 12); (2) the ELAN trial (2023) and 2024 AHA/ASA guidance supporting EARLIER initiation (early DOAC by ~day 3-4 in minor-to-moderate stroke; ~day 6-7 in large stroke) without increased symptomatic intracranial hemorrhage.
- For non-valvular AF, a DOAC is PREFERRED over warfarin for secondary prevention.
- WARFARIN (not a DOAC) is required when AF coexists with a MECHANICAL heart valve OR moderate-to-severe (rheumatic) MITRAL STENOSIS.
- NO heparin "bridging" for AF-associated ischemic stroke - therapeutic UFH/LMWH bridging increases hemorrhagic transformation without reducing recurrence.
- Exclude HEMORRHAGIC TRANSFORMATION on repeat imaging before initiating; defer (commonly up to ~4 weeks) for large infarcts or established hemorrhagic transformation.
- Source: ELAN trial 2023 (NEJM); 2024 AHA/ASA secondary stroke-prevention guidance; EHRA practical guide.`,
    l2: `POST-STROKE ANTICOAGULATION TIMING COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "When do you start anticoagulation after stroke?" with a single numeric key.
FORBIDDEN keys: keying a specific day that only ONE of the two frameworks supports (1-3-6-12 vs ELAN) - this is double-defensible and must not be the discriminator; keying transesophageal echocardiography BEFORE anticoagulation when AF is already the established embolic source; keying therapeutic UFH/LMWH BRIDGING for AF-associated stroke.
REQUIRED Tier-3 angles: identify WHEN a ~4-week deferral applies (large infarct / hemorrhagic transformation); distinguish CARDIOEMBOLIC (anticoagulate) from non-cardioembolic (antiplatelet) secondary prevention; reason about hemorrhagic-transformation imaging timing before initiation; select warfarin over a DOAC for mechanical valve or moderate-to-severe mitral stenosis.`,
  },
  {
    keywords: ["adrenal insufficiency", "addison", "addison's disease", "primary adrenal insufficiency", "secondary adrenal insufficiency", "hydrocortisone replacement", "fludrocortisone", "glucocorticoid replacement", "mineralocorticoid replacement", "plasma renin activity", "steroid replacement monitoring"],
    l1: `ADRENAL INSUFFICIENCY - REPLACEMENT MONITORING FOUNDATIONAL ANCHORS:
- GLUCOCORTICOID adequacy has NO reliable biochemical marker. Titrate hydrocortisone CLINICALLY: resolution of fatigue/anorexia/weight loss, and absence of over-replacement signs (weight gain, central adiposity, glucose intolerance, insomnia, hypertension). Do NOT titrate hydrocortisone to random serum cortisol, ACTH, or 24-hour urinary free cortisol.
- MINERALOCORTICOID adequacy (fludrocortisone; primary AI only) is assessed PRIMARILY CLINICALLY: supine and standing BP, orthostatic symptoms, salt craving, peripheral edema, plus serum Na and K. PLASMA RENIN ACTIVITY is ADJUNCTIVE - target the upper half of the reference range. Suppressed PRA with edema/hypertension/hypokalemia indicates OVER-replacement; elevated PRA with orthostasis/salt-craving/hyperkalemia indicates UNDER-replacement.
- SECONDARY (and tertiary) adrenal insufficiency does NOT require mineralocorticoid replacement - the renin-angiotensin-aldosterone axis is intact. Fludrocortisone and PRA monitoring apply to PRIMARY AI (Addison) only.
- Sick-day / stress-dose rules and a parenteral hydrocortisone emergency kit are mandatory components of management and patient education.
- Source: Endocrine Society 2016 (Bornstein et al.), Primary Adrenal Insufficiency clinical practice guideline.`,
    l2: `ADRENAL INSUFFICIENCY - REPLACEMENT MONITORING COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "How do you monitor glucocorticoid replacement?", "What is the treatment of Addison's disease?"
FORBIDDEN keys: framing plasma renin activity as the "gold standard" for monitoring replacement; keying "best test to monitor glucocorticoid replacement" to ANY biochemical test (there is none - it is clinical); keying random/serum cortisol or ACTH to titrate the hydrocortisone dose; keying fludrocortisone or PRA monitoring in a patient with SECONDARY AI.
REQUIRED Tier-3 angles: discriminate OVER- vs UNDER-replacement from a constellation (BP, orthostasis, Na/K, PRA, edema, weight); recognize that secondary AI needs glucocorticoid only; adjust stress dosing for intercurrent illness or surgery.`,
  },
  // ─── ENDOCRINOLOGY: DIABETES CLUSTER ──────────────────────────────────────
  {
    keywords: ["dka", "hhs", "diabetic ketoacidosis", "hyperglycemic hyperosmolar"],
    l1: `DKA/HHS FOUNDATIONAL ANCHORS (ADA 2026):
- Insulin held until K+ ≥3.3 mEq/L. Replace K+ first.
- DKA resolution: glucose <200 + TWO of: AG ≤12, bicarb ≥15, pH ≥7.3.
- Bicarbonate ONLY if pH <6.9.
- Euglycemic DKA on SGLT2i: glucose may be near-normal despite true DKA — anion gap is the key.
- HHS: osmolality typically >320 mOsm/kg, glucose >600 mg/dL, minimal ketosis. Fluid resuscitation primary.`,
    l2: `DKA/HHS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Patient with DKA + K+ 2.9 — what next?", "First step in DKA?", "Best fluid for DKA?"
REQUIRED Tier 3+ angles (pick one):
- IV-to-SQ insulin transition timing post-resolution (overlap duration required)
- Euglycemic DKA recognition on SGLT2i with normal-ish glucose
- Identifying the precipitant in a previously well-controlled T1DM
- Cerebral edema during pediatric DKA management
- HHS vs DKA differentiation in mixed-feature presentation
- Restarting home insulin regimen during the IV-to-SQ transition`
  },
  {
    keywords: ["hypoglycemia", "insulinoma", "whipple"],
    l1: `HYPOGLYCEMIA FOUNDATIONAL ANCHORS (Endocrine Society 2009 Hypoglycemia Guideline, still current):
- Whipple triad required: symptoms + plasma glucose <55 mg/dL + relief with glucose.
- Endogenous hyperinsulinism panel (drawn during a documented hypoglycemic episode, spontaneous or 72-hour fast):
  * Glucose <55 mg/dL
  * Insulin ≥3 µU/mL (≥18 pmol/L)
  * C-peptide ≥0.6 ng/mL (≥0.2 nmol/L)
  * Proinsulin ≥5 pmol/L  (UNITS ARE pmol/L, NOT ng/mL)
  * β-hydroxybutyrate ≤2.7 mmol/L
  * Sulfonylurea/meglitinide screen NEGATIVE
- Insulinoma pattern: insulin ↑, C-peptide ↑, proinsulin ↑, β-OHB suppressed.
- Surreptitious insulin (factitious): insulin ↑ BUT C-peptide SUPPRESSED.
- Surreptitious sulfonylurea: biochemically mimics insulinoma EXCEPT sulfonylurea screen is POSITIVE.
- Non-islet-cell tumor hypoglycemia (big-IGF-2): insulin low, C-peptide low, IGF-1 low, IGF-2 elevated, IGF-2:IGF-1 ratio >10 — usually a large mesenchymal tumor.
- Insulinoma localization: pancreas-protocol CT/MRI first; endoscopic ultrasound if non-localizing; selective arterial calcium stimulation if imaging is negative.
- Post-bariatric (post-RYGB) hypoglycemia is POSTPRANDIAL (not fasting); driven by exaggerated GLP-1 / nesidioblastosis; treat with low-carb diet, acarbose, or GLP-1 antagonist trials.`,
    l2: `HYPOGLYCEMIA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Patient with insulinoma — what is the diagnosis?", "Whipple triad — what does it mean?"
REQUIRED Tier 3+ angles (pick one):
- Insulinoma vs surreptitious sulfonylurea — both have ↑ insulin AND ↑ C-peptide. Sulfonylurea screen is the only test that separates them.
- Insulinoma vs exogenous insulin — both have ↑ insulin. C-peptide separates them (suppressed in exogenous).
- Post-RYGB postprandial hypoglycemia — timing (1–3 hr post meal) and reactive nature.
- Non-islet-cell tumor hypoglycemia — large mesenchymal/hepatic tumor with hypoglycemia and SUPPRESSED insulin/C-peptide.
- Localization sequence when first-line imaging is negative.
- Whipple-triad documentation requirement before workup — patients with unconfirmed symptoms get a 72-hour fast, not a panel during a normoglycemic state.`
  },
  {
    keywords: ["glp-1", "glp1", "semaglutide", "tirzepatide", "liraglutide", "dulaglutide", "wegovy", "ozempic", "mounjaro", "zepbound"],
    l1: `GLP-1 RA FOUNDATIONAL ANCHORS:
- Black Box: contraindicated with personal/family history MTC or MEN2.
- Pancreatitis history = relative contraindication.
- Tirzepatide is dual GIP/GLP-1 agonist.
- Semaglutide has FDA approval for ASCVD risk reduction in T2DM.
- Hold pre-operatively per ASA 2023 (1 week for weekly agents) for aspiration risk.`,
    l2: `GLP-1 RA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Side effects of GLP-1?", "First-line for T2DM with obesity?"
REQUIRED Tier 3+ angles:
- Choosing among agents based on cardiorenal-obesity profile
- Perioperative holding strategy and aspiration risk
- Transitioning between GLP-1 RAs or to dual GIP/GLP-1
- Recognizing gastroparesis precipitated by GLP-1 RA
- Managing GLP-1 RA in CKD across eGFR ranges`
  },
  {
    keywords: ["sglt2", "sglt-2", "empagliflozin", "dapagliflozin", "canagliflozin", "ertugliflozin"],
    l1: `SGLT2 INHIBITOR FOUNDATIONAL ANCHORS (KDIGO 2024):
- eGFR ≥20 + UACR >200 mg/g = Class 1A for renoprotection, INDEPENDENT of T2DM or glycemic indication.
- NEVER dismiss SGLT2i solely on "glycemic inefficacy at low eGFR" when the question concerns cardiorenal benefit.
- eGFR <20: do not initiate; continue if already established and tolerated.
- Hold ≥3-4 days perioperatively (euglycemic DKA risk).
- Mycotic genital infections common; rare Fournier's gangrene reported.`,
    l2: `SGLT2 INHIBITOR COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Mechanism of SGLT2i?", "First-line for T2DM with HF?"
REQUIRED Tier 3+ angles:
- Cardiorenal benefit at low eGFR despite glycemic ineffectiveness
- Choosing among empagliflozin/dapagliflozin/canagliflozin by indication
- Perioperative holding timing and rationale
- Euglycemic DKA recognition during illness or surgery
- Initiation in non-diabetic CKD with proteinuria`
  },
  {
    keywords: ["type 2", "t2dm", "type ii diabetes", "type-2"],
    l1: `T2DM FOUNDATIONAL ANCHORS (ADA 2026):
- Diagnosis: HbA1c ≥6.5%, FPG ≥126 mg/dL, OGTT 2h ≥200 mg/dL, or random ≥200 + symptoms. Confirm on repeat unless symptomatic.
- Cardiorenal-driven add-on: SGLT2i if HF/CKD, GLP-1 RA if ASCVD/obesity (regardless of A1c).
- SGLT2i (empagliflozin, dapagliflozin) are CLASS I for HFrEF (EMPEROR-Reduced, DAPA-HF) and are initiated/continued down to eGFR 20; reduced GLYCEMIC efficacy below eGFR 45 does NOT remove the HF/cardiorenal indication. In a T2D + HFrEF stem an SGLT2i is preferred over a GLP-1 RA for the HF indication; GLP-1 RAs reduce ASCVD events but do NOT reduce HF hospitalization.
- SGLT2i are potassium-NEUTRAL to mildly K-LOWERING and do NOT cause/worsen hyperkalemia (an advantage over MRAs/finerenone). Do NOT key a GLP-1 RA over an SGLT2i in an HFrEF stem on the basis of a hyperkalemia or a sub-eGFR-45 glycemic argument.
- Finerenone, the SGLT2i GLYCEMIC indication, and GLP-1 renal indications are T2D-SPECIFIC (do NOT extrapolate to T1D).
- Metformin: avoid if eGFR <30. Reduce dose at eGFR 30-44.
- Avoid: sulfonylureas in elderly with hypoglycemia; TZDs in NYHA III/IV.`,
    l2: `T2DM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Newly diagnosed T2DM, what to start?", "Diagnosis of T2DM?"
REQUIRED Tier 3+ angles:
- Drug selection in multi-comorbidity (HF + CKD + obesity + ASCVD)
- Deprescribing in elderly with hypoglycemia or limited life expectancy
- Interpreting CGM time-in-range and ambulatory glucose profile
- Adding GLP-1 RA to existing basal insulin regimen
- Steroid-induced hyperglycemia management strategy`
  },
  {
    keywords: ["type 1", "t1dm", "type i diabetes", "type-1", "insulin therapy"],
    l1: `T1DM INSULIN THERAPY FOUNDATIONAL ANCHORS:
- MDI: basal (glargine/degludec) + prandial (lispro/aspart/glulisine).
- Insulin pump: physiologic basal rates with adjustable hourly profile.
- Honeymoon phase reduces insulin needs temporarily but is not remission.
- DKA risk on insulin omission — never tell a T1DM patient to stop basal insulin.`,
    l2: `T1DM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Best basal insulin for T1DM?", "Initial insulin regimen for T1DM?"
REQUIRED Tier 3+ angles:
- Insulin pump-to-MDI transition during hospitalization
- Dawn phenomenon vs Somogyi effect differentiation
- Sick day rules and DKA prevention during illness
- Exercise-induced hypoglycemia prevention for athletes
- Closed-loop AID system troubleshooting`
  },
  {
    keywords: ["cgm", "continuous glucose", "aid system", "closed loop", "ambulatory glucose"],
    l1: `CGM/AID FOUNDATIONAL ANCHORS:
- Time-in-range goal ≥70% (70-180 mg/dL).
- Time-below-range <4% (<70 mg/dL); time below 54 <1%.
- AID systems require accurate basal rates and carb ratios for safe operation.
- Sensor accuracy degraded in DKA, severe dehydration, certain medications (acetaminophen high-dose for older sensors).`,
    l2: `CGM/AID COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is CGM?", "Benefits of CGM?"
REQUIRED Tier 3+ angles:
- Interpreting AGP report with specific glycemic patterns
- Troubleshooting AID system glycemic instability
- Sensor accuracy concerns in DKA or post-operative settings
- Choosing CGM vs flash glucose monitoring by clinical scenario`
  },

  // ─── ENDOCRINOLOGY: THYROID CLUSTER ───────────────────────────────────────
  {
    keywords: ["subclinical hypothyroid", "subclinical hypothyroidism"],
    l1: `SUBCLINICAL HYPOTHYROIDISM FOUNDATIONAL ANCHORS (ATA 2014 + TRUST trial, Stott NEJM 2017):
- DEFINITION: TSH above the reference range with FREE T4 NORMAL.
- CONFIRM WITH REPEAT TESTING in 2–3 months before treating — transient TSH elevations are common (recovery from non-thyroidal illness, recent infection, lab variation).
- TREAT WITH LEVOTHYROXINE IF:
  * TSH >10 mIU/L (any age), OR
  * TSH 7–10 mIU/L AND any of: pregnant or planning pregnancy, hypothyroid symptoms, positive anti-TPO antibodies, age <70 with cardiovascular risk factors.
- DO NOT ROUTINELY TREAT:
  * TSH 4.5–7 mIU/L in adults >70 — TRUST trial showed no benefit, with risk of overtreatment, atrial fibrillation, and bone loss.
  * Mildly elevated TSH during recovery from acute illness — recheck after recovery.
- IN PREGNANCY: trimester-specific TSH targets.
  * First trimester: <2.5 mIU/L.
  * Second/third trimester: <3.0 mIU/L.
  * Treat if TSH > trimester-specific upper limit (typically ~4.0) AND anti-TPO positive, OR TSH >10 regardless of antibodies.
- LEVOTHYROXINE STARTING DOSE:
  * Young, otherwise healthy: full replacement (~1.6 µg/kg/day lean body weight).
  * Elderly or known coronary disease: low and slow (12.5–25 µg/day, titrate).
- ABSORPTION INTERACTIONS (separate by ≥4 hours): PPIs, calcium, iron, soy, coffee. Take levothyroxine on empty stomach, 30–60 min before breakfast.
- DOSE ADJUSTMENTS IN PREGNANCY: increase by ~30% as soon as pregnancy is confirmed in a known hypothyroid patient.`,
    l2: `SUBCLINICAL HYPOTHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Patient with TSH 8 — start levothyroxine?" without nuance.
REQUIRED Tier 3+ angles (pick one):
- 75-YEAR-OLD WITH TSH 6.8 and vague fatigue: per TRUST, do NOT treat. Classic distractor: "Start low-dose levothyroxine."
- PREGNANT PATIENT, TSH 3.2 + anti-TPO POSITIVE: treat to trimester-specific target.
- 32-YEAR-OLD PLANNING PREGNANCY, TSH 4.8: treat to TSH <2.5 BEFORE conception.
- KNOWN HYPOTHYROID PATIENT WITH NEWLY CONFIRMED PREGNANCY: increase dose ~30% immediately, don't wait for next TSH.
- RECOVERY FROM NON-THYROIDAL ILLNESS: mild TSH elevation right after ICU stay — do NOT start replacement; recheck in 2–3 months.
- LEVOTHYROXINE MALABSORPTION WORKUP when TSH won't normalize despite escalating dose: separate PPI/calcium/iron by 4 hours, check celiac and H. pylori, consider liquid or soft-gel formulation.`
  },
  {
    keywords: ["hypothyroidism", "hashimoto", "levothyroxine", "central hypothyroidism", "myxedema"],
    l1: `HYPOTHYROIDISM FOUNDATIONAL ANCHORS:
- Overt hypothyroidism = elevated TSH + LOW free T4.
- Subclinical = elevated TSH + NORMAL free T4. TSH >10 with normal free T4 is still subclinical (grade 2).
- Non-pregnant adult TSH target: 0.4-4.0 mIU/L.
- Pregnancy first trimester TSH target: <2.5 mIU/L.
- Levothyroxine absorption affected by PPI, calcium, iron, soy, food. Take 30-60 min before breakfast.
- TPO antibodies confirm Hashimoto etiology.`,
    l2: `HYPOTHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of hypothyroidism?", "First-line for hypothyroidism?"
REQUIRED Tier 3+ angles:
- Stable patient on levo develops rising TSH — cause hunt (malabsorption, non-compliance, drug interaction, pregnancy, weight gain)
- Levothyroxine dose adjustment in pregnancy
- Central hypothyroidism recognition (low TSH + low free T4)
- Myxedema coma management priorities
- Subclinical treatment threshold for elderly vs young pregnancy-planning patient`
  },
  {
    keywords: ["hyperthyroidism", "graves", "thyrotoxicosis", "methimazole", "propylthiouracil", "ptu", "radioiodine", "rai", "thyroiditis"],
    l1: `HYPERTHYROIDISM FOUNDATIONAL ANCHORS:
- TRAb confirms Graves disease.
- Methimazole first-line for most adults. PTU preferred in T1 pregnancy and thyroid storm only.
- RAI contraindicated in pregnancy, lactation, and active moderate-severe ophthalmopathy.
- Beta-blocker (propranolol or atenolol) for symptom control during workup.
- Subacute thyroiditis: RAIU LOW, often painful goiter, post-viral.`,
    l2: `HYPERTHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of hyperthyroidism?", "First-line for Graves?"
REQUIRED Tier 3+ angles:
- Subacute thyroiditis vs Graves vs factitious differentiation using RAIU
- Antithyroid drug agranulocytosis recognition and management
- RAI-associated worsening of ophthalmopathy mitigation (steroid prophylaxis criteria)
- Postpartum thyroiditis triphasic course recognition
- Choosing definitive therapy: surgery vs RAI vs prolonged ATD`
  },
  {
    keywords: ["thyroid nodule", "thyroid biopsy", "tirads", "bethesda", "fine needle aspiration", "fna thyroid"],
    l1: `THYROID NODULE FOUNDATIONAL ANCHORS (ATA 2015 / TIRADS):
- TSH first. If suppressed → radionuclide scan (hot nodule rarely malignant).
- Ultrasound + ACR TIRADS for all nodules; size + TIRADS category guides FNA.
- Bethesda system guides management:
   I: non-diagnostic — repeat
   II: benign — surveillance
   III: AUS — molecular testing or repeat FNA
   IV: FN/SFN — molecular testing or lobectomy
   V: suspicious for malignancy — surgery
   VI: malignant — surgery`,
    l2: `THYROID NODULE COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Next step in thyroid nodule?", "When to biopsy a nodule?"
REQUIRED Tier 3+ angles:
- Bethesda III/IV management decision (molecular testing vs repeat FNA vs lobectomy)
- Incidentally found nodule in patient already on levothyroxine
- Hot nodule management (toxic adenoma) treatment options
- Nodule in pregnancy management and timing`
  },
  {
    keywords: ["thyroid cancer", "papillary thyroid", "follicular thyroid", "medullary thyroid", "anaplastic thyroid", "differentiated thyroid", "thyroglobulin", "rair", "lenvatinib", "sorafenib", "vandetanib", "cabozantinib", "selpercatinib"],
    l1: `THYROID CANCER FOUNDATIONAL ANCHORS (ATA 2025):
- RAIR (radioiodine-refractory) requires DOCUMENTED RAI failure or ineligibility: no uptake, progression within 12mo, or cumulative ≥600 mCi. Patient REFUSAL of RAI is NOT RAIR.
- Kinase inhibitors require RECIST 1.1 measurable STRUCTURAL disease — NEVER initiate for biochemically occult disease (rising Tg, no structural lesion).
- Vandetanib and cabozantinib: MTC only. Selpercatinib: RET fusion/mutation confirmed only.
- ATA and ESMO are SEPARATE organizations; do NOT cite "ATA/ESMO joint guidelines" — they do not exist.`,
    l2: `THYROID CANCER COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First-line for papillary thyroid cancer?", "Treatment of MTC?"
REQUIRED Tier 3+ angles:
- ATA 2025 TSH suppression de-escalation for low-risk patients
- Biochemical recurrence (rising Tg) with NEGATIVE structural imaging — workup, NOT immediate kinase inhibitor
- MTC family screening cascade and prophylactic thyroidectomy timing
- Anaplastic vs poorly differentiated management urgency
- Choosing between lenvatinib and sorafenib in true RAIR-DTC with structural disease`
  },
  {
    keywords: ["thyroid storm", "thyrotoxic crisis", "burch-wartofsky"],
    l1: `THYROID STORM FOUNDATIONAL ANCHORS (American Thyroid Association 2016 — still current):
- DIAGNOSIS IS CLINICAL. Burch–Wartofsky score ≥45 highly suggestive; 25–44 suggestive. Do NOT delay treatment for confirmatory labs.
- SEQUENCE OF PHARMACOLOGIC THERAPY — ORDER MATTERS BECAUSE OF MECHANISM:
  1. BLOCK SYNTHESIS: thionamide first.
     * PTU preferred in storm — 500–1000 mg load, then 250 mg PO/NG q4h. PTU also blocks peripheral T4→T3 conversion (D1 deiodinase inhibition).
     * Methimazole acceptable if PTU unavailable (60–80 mg/day).
  2. BLOCK RELEASE: iodine — SSKI 5 drops PO q6h or Lugol's solution. Give AT LEAST 30–60 MINUTES AFTER the thionamide.
     RATIONALE: giving iodine before blocking synthesis triggers Jod-Basedow / paradoxical hormone release from preformed stores in the gland.
  3. BLOCK ADRENERGIC TONE & PERIPHERAL CONVERSION:
     * Propranolol IV 0.5–1 mg or PO 60–80 mg q4h (non-selective; also blocks T4→T3 conversion).
     * Esmolol if hemodynamically tenuous or reduced LVEF.
  4. CORTICOSTEROIDS: hydrocortisone 100 mg IV q8h. Covers possible relative adrenal insufficiency AND blocks peripheral T4→T3 conversion.
  5. SUPPORTIVE & PRECIPITANT: cooling for hyperpyrexia; aggressive volume resuscitation; identify and treat precipitant (infection, surgery, iodine contrast, untreated DKA, missed thionamide).
- PTU IS PREFERRED IN STORM AND IN FIRST-TRIMESTER PREGNANCY (methimazole → aplasia cutis / methimazole embryopathy).
- METHIMAZOLE IS PREFERRED in non-storm second/third-trimester pregnancy and in non-pregnant outpatients (PTU has hepatotoxicity risk).`,
    l2: `THYROID STORM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First step in thyroid storm?", "Best treatment for thyroid storm?"
REQUIRED Tier 3+ angles (pick one):
- THE SEQUENCE: thionamide BEFORE iodine — and WHY (synthesis must be blocked before release). Distractor: "Give SSKI immediately."
- WHY PTU OVER METHIMAZOLE IN STORM: additional block of T4→T3 conversion.
- APATHETIC THYROID STORM in the elderly: presents as cardiac decompensation (CHF, AF with RVR, weight loss) WITHOUT classic hyperthermia or agitation. Easy to miss.
- AMIODARONE-INDUCED THYROTOXICOSIS:
  * Type 1 (iodine-induced, underlying nodular disease, ↑ vascularity on Doppler) → thionamide.
  * Type 2 (destructive thyroiditis, no vascularity) → corticosteroids.
  * When uncertain, treat for BOTH.
- BETA-BLOCKER CHOICE when LVEF is reduced: esmolol > propranolol; in decompensated HF, beta-blockade can precipitate cardiogenic shock.
- REFRACTORY STORM: plasmapheresis or emergency thyroidectomy after at least 5–7 days of medical therapy.`
  },

  // ─── ENDOCRINOLOGY: ADRENAL CLUSTER ───────────────────────────────────────
  {
    keywords: ["cushing", "hypercortisolism", "ectopic acth", "bipss", "petrosal sinus"],
    l1: `CUSHING'S FOUNDATIONAL ANCHORS:
- Screening tests: 1mg overnight DST OR 24h UFC OR late-night salivary cortisol.
- 8mg DST is NOT a standard screening test (legacy localization tool, largely obsolete).
- ACTH <10 pg/mL = ACTH-independent (adrenal source).
- ACTH >20 pg/mL = ACTH-dependent (pituitary or ectopic).
- BIPSS required for localization when MRI shows lesion <6mm or no lesion: central:peripheral ACTH ratio ≥2 basal or ≥3 post-CRH = pituitary source.
- MRI finding of ≥10mm microadenoma does NOT replace BIPSS for localization.
- Pseudo-Cushing's mimics: depression, alcohol use, severe obesity.`,
    l2: `CUSHING'S COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of Cushing's?", "Screening for Cushing's?"
REQUIRED Tier 3+ angles:
- Cyclic Cushing's recognition with intermittently normal screens
- Ectopic ACTH workup when BIPSS shows no central:peripheral gradient
- Post-op cortisol management after pituitary surgery (replacement, recovery timeline)
- Recurrence after transsphenoidal surgery — surgical re-exploration vs medical therapy
- Discriminating pseudo-Cushing's from mild Cushing's with dexamethasone-CRH test`
  },
  {
    keywords: ["primary aldosteronism", "hyperaldosteronism", "conn syndrome", "adrenal vein sampling", "avs", "spironolactone", "eplerenone"],
    l1: `PRIMARY ALDOSTERONISM FOUNDATIONAL ANCHORS:
- Screening: ARR >30 (ng/dL per ng/mL/hr).
- Confirmatory test required before AVS: oral salt loading, IV saline infusion, fludrocortisone suppression, or captopril challenge.
- AVS required pre-surgery in ALL patients >35 years to lateralize. CT alone insufficient.
- Spironolactone interferes with ARR — washout 4-6 weeks before testing.
- Unilateral adenoma → adrenalectomy. Bilateral hyperplasia → MRA (spironolactone or eplerenone).`,
    l2: `PRIMARY ALDOSTERONISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Screening test for PA?", "Treatment of Conn syndrome?"
REQUIRED Tier 3+ angles:
- AVS interpretation: lateralization ratio ≥4:1 post-ACTH stimulation
- Failed AVS (non-dominant vein cannulation) — repeat vs alternative options
- Spironolactone-on-board patient — washout vs MRA-sparing testing
- Refractory PA on MRA with suppressed renin — up-titrate the MRA to raise renin (ES 2025 Adler: spironolactone preferred over other MRAs; MRAs preferred over ENaC inhibitors such as amiloride) vs surgical reconsideration
- Familial hyperaldosteronism types and genetic testing`
  },
  {
    keywords: ["pheochromocytoma", "paraganglioma", "metanephrine", "phenoxybenzamine", "doxazosin", "men2 pheo", "vhl pheo", "sdh"],
    l1: `PHEOCHROMOCYTOMA FOUNDATIONAL ANCHORS:
- Biochemical first-line: plasma free metanephrines OR 24h urine fractionated metanephrines.
- Alpha blockade (phenoxybenzamine or doxazosin) MUST precede beta blockade by 10-14 days.
- Starting beta-blocker first → unopposed alpha → hypertensive crisis. Never do this.
- Volume expansion preoperatively (high-salt diet, sometimes IV fluids).
- Genetic testing in ALL pheo/paraganglioma patients: MEN2 (RET), VHL, SDH-related, NF1.`,
    l2: `PHEOCHROMOCYTOMA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of pheochromocytoma?", "Diagnosis of pheo?"
REQUIRED Tier 3+ angles:
- Pheo crisis management acute blockade strategy
- Paraganglioma vs pheo workup and imaging differences (DOTATATE PET for paraganglioma)
- Pregnancy management timing of surgery
- MEN2 surveillance protocol after RET mutation identification
- Incidentaloma workup distinguishing pheo from non-functioning adenoma`
  },
  {
    keywords: ["adrenal incidentaloma", "adrenal mass", "adrenal nodule", "incidental adrenal"],
    l1: `ADRENAL INCIDENTALOMA FOUNDATIONAL ANCHORS (AACE/ACE/ESE 2023 update):
- Definition: ≥1 cm adrenal mass found on imaging done for another reason.
- IMAGING CHARACTERIZATION (non-contrast CT):
  * ≤10 Hounsfield units → lipid-rich benign adenoma. No further imaging.
  * 11–20 HU → indeterminate; do absolute washout (>60% = benign) OR chemical-shift MRI.
  * >20 HU + low washout → suspicious; pursue biochemical workup AND consider resection.
- BIOCHEMICAL WORKUP — perform on EVERY adrenal incidentaloma regardless of HU:
  * 1 mg overnight dexamethasone suppression test: cortisol >1.8 µg/dL = possible mild autonomous cortisol secretion (MACS); >5 µg/dL = autonomous secretion.
  * Plasma free metanephrines OR 24-hour urine metanephrines — rule out pheochromocytoma.
  * Plasma aldosterone-to-renin ratio — ONLY if patient is hypertensive or hypokalemic.
  * DHEA-S — only when imaging suggests adrenocortical carcinoma (heterogeneous, >4 cm, high HU).
- SURGICAL INDICATIONS (any one):
  * Size >4 cm.
  * Imaging features suspicious for malignancy: heterogeneous, >20 HU, washout <60%, growth >5 mm/year.
  * Biochemically functional: pheo, primary aldosteronism, Cushing.
- PHEOCHROMOCYTOMA PRE-OP RULE: ALPHA-blockade (phenoxybenzamine or doxazosin) for 7–14 days BEFORE beta-blockade and BEFORE surgery. NEVER beta-block first — unopposed alpha tone causes hypertensive crisis.
- DO NOT biopsy an adrenal mass without ruling out pheochromocytoma first (catecholamine storm risk). Biopsy is generally reserved for suspected metastasis in a patient with a known extra-adrenal primary.`,
    l2: `ADRENAL INCIDENTALOMA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is the most likely diagnosis?" when the case obviously states "incidentaloma."
REQUIRED Tier 3+ angles (pick one):
- MILD AUTONOMOUS CORTISOL SECRETION (MACS): 1-mg DST cortisol 1.9–5.0 µg/dL. Decision to resect vs. monitor turns on cardiometabolic comorbidities (HTN, T2DM, osteoporosis, dyslipidemia).
- PRE-OPERATIVE PHEOCHROMOCYTOMA BLOCKADE: sequence (alpha first), duration (7–14 days), volume expansion, target BP, role of calcium-channel blocker only if BP still high after adequate alpha-blockade.
- BILATERAL adrenal masses → CAH, bilateral metastases, primary bilateral macronodular hyperplasia, infiltrative disease — different workup.
- ADRENOCORTICAL CARCINOMA suspicion: >4 cm, heterogeneous, >20 HU, rapid growth, mixed functional pattern (cortisol + DHEA-S + androgens).
- WHY NOT BIOPSY FIRST: rule out pheo first; biopsy almost never changes management in primary adrenal disease.`
  },
  {
    keywords: ["adrenal insufficiency", "addison", "cortisol deficiency", "secondary adrenal", "acth stim test", "cosyntropin"],
    l1: `ADRENAL INSUFFICIENCY FOUNDATIONAL ANCHORS:
- Primary (Addison): ↓cortisol, ↑ACTH, ↑renin, ↓aldosterone, hyperpigmentation, hyponatremia + hyperkalemia.
- Secondary: ↓cortisol, ↓ACTH, NORMAL aldosterone (RAAS intact), no hyperpigmentation.
- ACTH stimulation test confirms primary (cortisol <18 µg/dL at 30/60 min).
- Adrenal crisis: stress-dose hydrocortisone (100mg IV) IMMEDIATELY — do not wait for confirmation.
- Steroid-induced HPA suppression: any chronic exogenous steroid >3 weeks.`,
    l2: `ADRENAL INSUFFICIENCY COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of Addison's?", "Treatment of adrenal crisis?"
REQUIRED Tier 3+ angles:
- Steroid-induced HPA suppression recovery timeline and tapering
- Stress dosing rules for surgery, illness, dental procedures
- Adrenal crisis precipitants in known AI patient (missed dose, infection, surgery)
- Mineralocorticoid replacement adjustment with hot weather/exercise
- Distinguishing primary vs secondary AI in newly diagnosed patient`
  },

  // ─── ENDOCRINOLOGY: PITUITARY CLUSTER ─────────────────────────────────────
  {
    keywords: ["prolactinoma", "hyperprolactinemia", "cabergoline", "bromocriptine", "macroprolactin", "stalk effect"],
    l1: `PROLACTINOMA FOUNDATIONAL ANCHORS:
- Cabergoline first-line (better tolerability and efficacy than bromocriptine; bromocriptine preferred in pregnancy planning due to longer safety record).
- Stalk effect from non-prolactinoma compressing stalk: prolactin elevated but typically <100 ng/mL.
- Hook effect at very high prolactin (>1000): assay underestimates — must dilute sample.
- Macroprolactin: inactive complex causing lab elevation without clinical disease.
- Macroadenoma >1 cm; surveillance with MRI.`,
    l2: `PROLACTINOMA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First-line for prolactinoma?", "Diagnosis of prolactinoma?"
REQUIRED Tier 3+ angles:
- Cabergoline-resistant macroadenoma — surgery vs higher-dose vs alternative agent
- Pregnancy management of macroprolactinoma (when to stop, surveillance)
- Dopamine agonist withdrawal criteria after biochemical and radiologic remission
- Valve disease screening on long-term high-dose cabergoline
- Hook effect recognition in massively elevated prolactin`
  },
  {
    keywords: ["acromegaly", "growth hormone excess", "octreotide", "lanreotide", "pegvisomant", "igf-1 elevation"],
    l1: `ACROMEGALY FOUNDATIONAL ANCHORS:
- GH nadir <1 ng/mL on 75g OGTT diagnoses acromegaly.
- IGF-1 used for diagnosis and monitoring.
- Transsphenoidal surgery first-line for most.
- Somatostatin analogs (octreotide, lanreotide) for post-op residual or non-surgical candidates.
- Pegvisomant (GH receptor antagonist) for resistant cases — IGF-1 monitoring, NOT GH (pegvisomant interferes with GH assay).`,
    l2: `ACROMEGALY COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of acromegaly?", "First-line for acromegaly?"
REQUIRED Tier 3+ angles:
- Post-op residual disease management algorithm
- Somatostatin analog resistance — pegvisomant vs pasireotide vs surgery re-exploration
- Cardiac and colon cancer screening recommendations
- Monitoring acromegaly on pegvisomant (IGF-1 only)
- Pituitary apoplexy presenting in undiagnosed acromegaly`
  },
  {
    keywords: ["hypopituitarism", "panhypopituitarism", "sheehan", "pituitary apoplexy", "empty sella"],
    l1: `HYPOPITUITARISM FOUNDATIONAL ANCHORS:
- Replace cortisol BEFORE thyroid hormone (giving levothyroxine first can precipitate adrenal crisis by accelerating cortisol clearance).
- Sheehan syndrome: postpartum pituitary infarction following severe hemorrhage and hypotension.
- Empty sella usually asymptomatic and incidental.
- Pituitary apoplexy: acute headache + visual change + hypopituitarism = neurosurgical emergency requiring stress-dose steroids first.`,
    l2: `HYPOPITUITARISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is hypopituitarism?", "Hormone replacement order?"
REQUIRED Tier 3+ angles:
- Pituitary apoplexy recognition and immediate management priorities
- GH replacement decision in adults — when indicated, monitoring
- Post-radiation pituitary failure timeline (years to decades)
- Hormone replacement adjustment during pregnancy
- Sheehan presenting years later with subtle features`
  },
  {
    keywords: ["diabetes insipidus", "avp-d", "avp-r", "central di", "nephrogenic di", "desmopressin", "ddavp", "copeptin", "water deprivation"],
    l1: `DIABETES INSIPIDUS FOUNDATIONAL ANCHORS:
- Hypertonic saline-stimulated copeptin >6.4 pmol/L confirms AVP-R (nephrogenic DI).
- Hypertonic saline-stimulated copeptin <4.9 pmol/L confirms AVP-D (central DI).
- Desmopressin response distinguishes central (responds) from nephrogenic (does not).
- Hypertonic saline-stimulated copeptin has largely replaced classic water deprivation test in many centers.
- Lithium causes nephrogenic DI; gestational DI from placental vasopressinase.
- WATER DEPRIVATION CONTRAINDICATED if baseline serum Na > 145 mEq/L OR serum osmolality > 295-300 mOsm/kg — patient is already maximally stimulated; deprivation risks dangerous hypernatremia without diagnostic yield. Proceed directly to DDAVP challenge (or hypertonic saline copeptin testing where available). Source: Endocrine Society / ESE 2018 consensus, Christ-Crain et al.`,
    l2: `DIABETES INSIPIDUS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of DI?", "Treatment of central DI?"
FORBIDDEN: ordering water deprivation test as the correct answer when stem labs indicate Na > 145 or serum osmolality > 295-300 — this is a contraindication failure mode (board examiners will mark direct DDAVP challenge as the correct answer instead).
REQUIRED Tier 3+ angles:
- Primary polydipsia vs partial central DI differentiation
- Post-pituitary-surgery triphasic response recognition (DI → SIADH → permanent DI)
- Lithium-induced nephrogenic DI management without stopping lithium
- Gestational DI management and postpartum resolution
- Adipsic central DI (osmoreceptor dysfunction) management challenges`
  },

  // ─── ENDOCRINOLOGY: BONE & CALCIUM CLUSTER ────────────────────────────────
  {
    keywords: ["hyperparathyroidism", "primary hyperparathyroidism", "parathyroidectomy", "fhh", "familial hypocalciuric"],
    l1: `HYPERPARATHYROIDISM FOUNDATIONAL ANCHORS:
- Primary HPT: ↑Ca + ↑PTH (or inappropriately normal PTH for the calcium level).
- 24h urine calcium DISTINGUISHES primary HPT from FHH (calcium/creatinine clearance ratio <0.01 in FHH).
- Surgery indications (any one): symptomatic, age <50, Ca >1 mg/dL above ULN, eGFR <60, T-score ≤-2.5, vertebral fracture, kidney stones, 24h urine Ca >400.
- Sestamibi scan + neck ultrasound for preoperative localization.
- Hungry bone syndrome post-parathyroidectomy: severe hypocalcemia from rapid bone uptake.`,
    l2: `HYPERPARATHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of primary hyperparathyroidism?"
REQUIRED Tier 3+ angles:
- Normocalcemic primary hyperparathyroidism workup and treatment threshold
- FHH differentiation when 24h urine calcium is borderline
- Post-parathyroidectomy hungry bone syndrome management
- Calcimimetics (cinacalcet) in non-surgical candidates or parathyroid carcinoma
- Tertiary hyperparathyroidism in CKD or post-transplant`
  },
  {
    keywords: ["hypercalcemia", "malignant hypercalcemia", "pthrp", "calcitonin", "denosumab hypercalcemia", "milk alkali"],
    l1: `HYPERCALCEMIA FOUNDATIONAL ANCHORS:
- PTH-mediated (high or inappropriately normal PTH): primary HPT, FHH, lithium.
- PTH-independent (low PTH): malignancy (PTHrP, osteolytic, 1,25-D), granulomatous (1,25-D), vitamin D toxicity, milk-alkali, immobilization.
- Treatment: IV fluids first, then bisphosphonate (4-7 day onset) + calcitonin (rapid but tachyphylaxis at 48h).
- Denosumab if renal failure (bisphosphonate contraindicated at low eGFR).
- Granulomatous hypercalcemia (sarcoid, TB) responds to corticosteroids.`,
    l2: `HYPERCALCEMIA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First step in hypercalcemia?", "Treatment of malignant hypercalcemia?"
REQUIRED Tier 3+ angles:
- Hypercalcemia in CKD — denosumab vs cinacalcet vs reduced bisphosphonate dosing
- Refractory malignant hypercalcemia after bisphosphonate failure
- Granulomatous disease (1,25-D mediated) recognition and steroid response
- Milk-alkali syndrome differentiation from primary HPT
- Hypercalcemia of immobilization in young patient with spinal cord injury`
  },
  {
    keywords: ["osteoporosis", "fracture risk", "frax", "bisphosphonate", "denosumab", "teriparatide", "abaloparatide", "romosozumab", "atypical femur fracture"],
    l1: `OSTEOPOROSIS FOUNDATIONAL ANCHORS (AACE 2025):
- Treatment threshold: T-score ≤-2.5, OR T -1.0 to -2.5 + FRAX 10-yr major osteoporotic fracture ≥20% or hip fracture ≥3%.
- Bisphosphonate holiday: after 5 years oral / 3 years IV zoledronic acid — reassess. High-risk patients continue.
- Denosumab discontinuation REQUIRES bridging with bisphosphonate to prevent rebound vertebral fractures.
- Romosozumab BLACK BOX: contraindicated if MI or stroke within prior 12 months.
- Teriparatide and abaloparatide: maximum 2 years lifetime use.
- Sequential therapy: anabolic (teriparatide/abaloparatide/romosozumab) → followed by antiresorptive to maintain gains.`,
    l2: `OSTEOPOROSIS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of osteoporosis?", "When to start bisphosphonate?"
REQUIRED Tier 3+ angles:
- Sequential therapy after 2 years of teriparatide — what comes next
- Denosumab-to-bisphosphonate transition timing (within 6 months of last dose)
- Atypical femur fracture on long-term bisphosphonate — drug change strategy
- Treatment in CKD G4-G5 (denosumab vs reduced-dose bisphosphonate)
- Romosozumab eligibility decision in patient with prior MI`
  },

  // ─── ENDOCRINOLOGY: REPRODUCTIVE CLUSTER ──────────────────────────────────
  {
    keywords: ["pcos", "polycystic ovary"],
    l1: `PCOS FOUNDATIONAL ANCHORS (2023 International Guideline):
- Rotterdam criteria: 2 of 3 — oligo/anovulation, clinical/biochemical hyperandrogenism, polycystic ovaries on ultrasound.
- Metformin for insulin resistance.
- Combined OC (preferring non-androgenic progestogen) for menstrual regulation and androgen suppression.
- Spironolactone for hirsutism (with reliable contraception due to teratogenicity).
- Letrozole first-line for ovulation induction (superior to clomiphene).
- BP ≥140/90 = relative contraindication to estrogen-containing contraceptives.
- Avoid androgenic progestogens (levonorgestrel) in metabolically complex PCOS.`,
    l2: `PCOS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of PCOS?", "First-line for PCOS?"
REQUIRED Tier 3+ angles:
- Drug selection in metabolically complex PCOS (CKD, dyslipidemia, hypertension)
- Ovulation induction failure escalation (letrozole → clomiphene → gonadotropins → IVF)
- NIH vs Rotterdam phenotype implications for cardiometabolic risk
- Post-fertility transition management (long-term endometrial protection)
- Choosing OC formulation when androgenic burden is concerning`
  },
  {
    keywords: ["male hypogonadism", "low testosterone", "trt", "testosterone replacement", "kallmann", "klinefelter"],
    l1: `MALE HYPOGONADISM FOUNDATIONAL ANCHORS (Endocrine Society 2018):
- TWO morning total testosterone measurements (conventional threshold ~300 ng/dL).
- LH/FSH distinguishes primary (elevated) from secondary (low or inappropriately normal).
- Iron studies for hemochromatosis if secondary.
- SHBG affects total T interpretation — measure free T or calculated free T when SHBG abnormal.
- TRT contraindications: untreated polycythemia (Hct >54%), prostate cancer, severe LUTS, untreated severe OSA, breast cancer, planned fertility.`,
    l2: `MALE HYPOGONADISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of hypogonadism?", "First-line for low T?"
REQUIRED Tier 3+ angles:
- Fertility-preserving alternatives to TRT (clomiphene, hCG, aromatase inhibitors)
- Monitoring during TRT (Hct, PSA, lipids, T levels)
- Age-appropriate testosterone targets and treatment threshold debate
- Klinefelter management beyond testosterone (cardiometabolic, fertility counseling)
- Distinguishing primary vs secondary hypogonadism workup`
  },

  // ─── ENDOCRINOLOGY: MEN & NET CLUSTER ─────────────────────────────────────
  {
    keywords: ["men1", "multiple endocrine neoplasia type 1", "wermer"],
    l1: `MEN1 FOUNDATIONAL ANCHORS:
- Triad: parathyroid hyperplasia (>90%), pituitary tumors, pancreatic NETs (gastrinoma most common).
- Genetic testing index case + first-degree relatives.
- Parathyroidectomy = SUBTOTAL (3.5 gland) due to multi-gland hyperplasia, not adenoma.
- Annual screening: calcium/PTH, prolactin, IGF-1, gastrin, fasting insulin/glucose, cross-sectional pancreas imaging.`,
    l2: `MEN1 COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is MEN1?", "Triad of MEN1?"
REQUIRED Tier 3+ angles:
- Surveillance interval choices for asymptomatic mutation carriers
- Family member screening cascade and age to start
- Gastrinoma management within MEN1 (often multifocal, surgery debate)
- Pituitary tumor management nuances when MEN1 versus sporadic`
  },
  {
    keywords: ["men2", "men 2a", "men 2b", "ret mutation", "prophylactic thyroidectomy"],
    l1: `MEN2 FOUNDATIONAL ANCHORS:
- RET proto-oncogene mutation. MTC universal — prophylactic thyroidectomy required.
- MEN2B: aggressive MTC + mucosal neuromas + marfanoid habitus → thyroidectomy in INFANCY (before 1 year).
- MEN2A: pheochromocytoma (40%), primary hyperparathyroidism. Prophylactic thyroidectomy timing per RET codon risk stratification.
- Pheo screening MANDATORY before any surgery or pregnancy in known MEN2.
- Calcitonin and CEA surveillance post-thyroidectomy.`,
    l2: `MEN2 COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is MEN2?", "Genetics of MEN2?"
REQUIRED Tier 3+ angles:
- Prophylactic thyroidectomy timing based on RET codon ATA risk category
- Pre-operative pheochromocytoma workup as mandatory step
- Post-thyroidectomy calcitonin/CEA surveillance interpretation
- Family genetic counseling cascade and pediatric screening
- Selpercatinib in RET-mutant advanced MTC`
  },

  // ─── INTERNAL MEDICINE CLUSTER (high-error topics) ────────────────────────
  {
    keywords: ["acs", "stemi", "nstemi", "acute coronary", "myocardial infarction"],
    l1: `ACS FOUNDATIONAL ANCHORS (ACC/AHA 2025):
- STEMI: PCI within 90 minutes (door-to-balloon). Fibrinolysis if PCI unavailable within 120 min.
- NSTEMI high-risk: early invasive strategy within 24 hours.
- DAPT (aspirin + P2Y12 inhibitor) for 12 months minimum post-ACS unless prohibitive bleeding.
- HIT: argatroban (hepatic clearance) preferred if renal impairment; bivalirudin or fondaparinux for renal impairment without HIT. NEVER heparin in confirmed HIT.`,
    l2: `ACS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of STEMI?", "Treatment of NSTEMI?"
REQUIRED Tier 2-3 angles:
- Antiplatelet selection by bleeding risk (HBR criteria, ARC-HBR)
- PCI vs CABG decision in multivessel disease
- DAPT duration shortening in HBR patients
- Post-ACS GDMT optimization (statin + ACEi/ARB + BB + MRA in HFrEF)`
  },
  {
    keywords: ["heart failure", "hfref", "hfpef", "cardiomyopathy", "arni", "sacubitril"],
    l1: `HEART FAILURE FOUNDATIONAL ANCHORS (ACC/AHA 2022):
- HFrEF (EF <40%): Four pillars = ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i.
- ARNI superior to ACEi alone — DO NOT combine ARNI with ACEi (angioedema risk; 36-hour washout required).
- HFpEF (EF ≥50%): SGLT2i Class 2a recommendation.
- Avoid in HFrEF: NSAIDs, non-DHP CCBs (verapamil/diltiazem), TZDs (pioglitazone) in NYHA III/IV.`,
    l2: `HEART FAILURE COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of HFrEF?", "What is HFpEF?"
REQUIRED Tier 2-3 angles:
- GDMT optimization in CKD/hypotension/hyperkalemia (titration order, finerenone option)
- ARNI initiation timing post-decompensation
- ICD/CRT eligibility decision based on EF, QRS, and clinical course
- Advanced HF transition criteria for transplant/LVAD evaluation`
  },
  {
    keywords: ["atrial fibrillation", "afib", "anticoagulation af", "doac", "cha2ds2", "ablation"],
    l1: `ATRIAL FIBRILLATION FOUNDATIONAL ANCHORS:
- CHA2DS2-VASc ≥2 (men) or ≥3 (women) → anticoagulation indicated.
- DOACs preferred over warfarin EXCEPT mechanical valves and moderate-to-severe mitral stenosis (warfarin only).
- Rate vs rhythm: most patients fine with rate control; early rhythm control benefit shown in EAST-AFNET 4.
- Reversal: idarucizumab for dabigatran; andexanet alfa for apixaban/rivaroxaban.`,
    l2: `ATRIAL FIBRILLATION COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Anticoagulation in AF?", "Rate vs rhythm in AF?"
REQUIRED Tier 2-3 angles:
- DOAC dose selection in CKD or hemodialysis
- Peri-procedural management (when to hold and bridge)
- Recurrent AF after ablation — repeat ablation vs antiarrhythmic
- Stroke despite anticoagulation — workup and management change`
  },
  {
    keywords: ["sepsis", "septic shock", "norepinephrine", "vasopressin", "ssc"],
    l1: `SEPSIS FOUNDATIONAL ANCHORS (SSC 2021/2025):
- Norepinephrine = first-line vasopressor.
- Add vasopressin (up to 0.03 units/min) BEFORE escalating to epinephrine or dopamine.
- Hydrocortisone ONLY for refractory septic shock (not responding to adequate fluids + 2 vasopressors).
- Cultures before antibiotics — but do NOT delay antibiotics >1 hour to obtain cultures.
- Procalcitonin guides antibiotic de-escalation, not initiation.`,
    l2: `SEPSIS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First step in sepsis?", "First-line vasopressor?"
REQUIRED Tier 2-3 angles:
- Vasopressor escalation sequence and indications for each
- Fluid resuscitation modification in HF or cirrhosis
- Source control failure recognition and re-evaluation
- Antibiotic de-escalation timing using procalcitonin and clinical course`
  },
  {
    keywords: ["lipid", "dyslipidemia", "statin", "ascvd", "pcsk9", "ezetimibe", "bempedoic"],
    l1: `LIPID FOUNDATIONAL ANCHORS (2026 ACC/AHA/Multisociety Dyslipidemia Guideline — RETIRES & REPLACES the 2018 Blood Cholesterol Guideline):
- RISK-BASED LDL-C GOALS RESTORED (2018 set none; do NOT write items to "intensity, not goal" logic):
  - Clinical ASCVD: <55 mg/dL very-high-risk; <70 not very-high-risk.
  - Primary, LDL-C >=190: <100 (<70 if HeFH, >=1 ASCVD risk factor, or subclinical atherosclerosis).
  - Primary, LDL-C 70-189: <100 at low/borderline/intermediate PREVENT risk; <70 at high PREVENT risk.
  - Subclinical (CAC): <100 if CAC 1-99 AU and <75th pct; <70 if CAC 100-299 AU or >=75th pct; <55 if CAC >=1000 AU.
- RISK TOOL: AHA PREVENT equations REPLACE the Pooled Cohort Equations for primary prevention, ages 30-79 (race-neutral; includes eGFR/UACR and HbA1c; 10- and 30-year risk). PCE (2013) is LEGACY.
- Lp(a): universal once-in-a-lifetime screening (causal, independent of LDL-C). apoB and non-HDL-C are secondary targets.
- Escalation when LDL above goal on maximally-tolerated statin: add ezetimibe -> add PCSK9i (evolocumab/alirocumab). Bempedoic acid for statin-intolerant. Inclisiran: siRNA, doses at 0 and 3 months, then every 6 months.
- Statin myopathy: CK >10x ULN -> discontinue; always rechallenge with an alternate statin before declaring complete intolerance.
- AACE 2025 (Patel/Wyne, Endocr Pract 2025;31:236-262) = GRADE nonstatin focused update; niacin NOT recommended as add-on in hypertriglyceridemia 150-499 mg/dL with or at risk of ASCVD. Where AACE 2025 and 2026 ACC/AHA conflict on risk tooling, PREVENT (2026) governs.`,
    l2: `LIPID COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First-line for hyperlipidemia?", "Diagnosis of FH?", "Target LDL?" stated without risk stratification.
FORBIDDEN: keying "treat to statin intensity, no numeric goal" as correct — retired 2018 logic; 2026 restores numeric, risk-based goals.
FORBIDDEN: using the Pooled Cohort Equations as the correct primary-prevention risk tool for ages 30-79 — PREVENT supersedes it.
REQUIRED Tier 2-3 angles:
- Statin intolerance workup and structured rechallenge
- Familial hypercholesterolemia management with PCSK9i
- LDL-C goal selection by risk stratum; nonstatin sequencing (ezetimibe -> bempedoic acid / PCSK9i)
- Elevated Lp(a) interpretation and cascade screening
- Lipid management in pregnancy when statin contraindicated`
  },
  {
    keywords: ["ckd", "chronic kidney disease", "kdigo"],
    l1: `CKD FOUNDATIONAL ANCHORS (KDIGO 2024):
- SGLT2i for eGFR ≥20 + UACR >200 mg/g — Class 1A regardless of T2DM.
- RAS blockade titrated to maximum tolerated dose for proteinuria.
- Finerenone for T2DM + CKD + albuminuria (FIDELIO/FIGARO).
- Hyperkalemia mitigation: patiromer or sodium zirconium cyclosilicate ALLOWS continuation of RAS blockade.
- Avoid: NSAIDs, contrast when possible.`,
    l2: `CKD COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of CKD?", "Stages of CKD?"
REQUIRED Tier 2-3 angles:
- Multi-drug optimization (RAS + SGLT2i + finerenone) sequencing
- Hyperkalemia mitigation strategies to preserve RAS blockade
- Dialysis initiation criteria and modality choice
- Anemia, mineral-bone, acidosis management priorities`
  },
  {
    keywords: ["acute kidney injury", "aki", "ain", "atn", "fena", "contrast nephropathy"],
    l1: `AKI FOUNDATIONAL ANCHORS:
- Pre-renal vs intrinsic vs post-renal classification.
- FENa <1% pre-renal, >2% ATN — UNRELIABLE on diuretics (use FEUrea instead: <35% pre-renal).
- Contrast nephropathy peaks 3-5 days post-exposure.
- Nephrology consult: stage 3 AKI, refractory hyperkalemia, uremia, refractory volume overload.`,
    l2: `AKI COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of AKI?", "Cause of AKI?"
REQUIRED Tier 2-3 angles:
- Acute interstitial nephritis recognition and management (stop offending drug, steroids if biopsy-proven)
- Hepatorenal syndrome management (terlipressin, albumin, transplant evaluation)
- RRT timing decisions (early vs delayed start)
- Contrast prophylaxis evidence-based approach`
  },
  {
    keywords: ["hit", "heparin-induced thrombocytopenia", "argatroban hit", "bivalirudin hit", "fondaparinux hit"],
    l1: `HIT FOUNDATIONAL ANCHORS:
- 4Ts score for pre-test probability.
- Stop ALL heparin including line flushes immediately on suspicion.
- Argatroban (hepatic clearance) for renal impairment.
- Bivalirudin or fondaparinux for hepatic dysfunction.
- NEVER warfarin alone — venous gangrene risk; bridge with non-heparin parenteral anticoagulant first.
- Confirmatory testing: PF4-heparin antibody (ELISA), serotonin release assay.`,
    l2: `HIT COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is HIT?", "Treatment of HIT?"
REQUIRED Tier 2-3 angles:
- Mixed renal-hepatic dysfunction agent choice
- Transition to oral anticoagulation timing (after platelets >150 and adequate non-heparin overlap)
- HIT in pregnancy (fondaparinux preferred)
- HIT antibody persistence and re-exposure risk in subsequent surgery`
  }
];

const GENERIC_GUARDRAILS = {
  l1: `GENERAL CLINICAL ANCHORS:
- Cite only data explicitly present in the stem.
- Use current officially published society guidelines, not legacy criteria. Do not invent recent dates for older guidelines.
- Numeric values in explanation must match stem exactly.`,
  l2: `COGNITIVE COMPLEXITY EXPECTATION:
FORBIDDEN: "What is the most likely diagnosis?" for ABIM-level questions.
REQUIRED: Test management decision, drug selection, or workup escalation — not basic recognition.`
};

function getTopicGuardrails(level, topic) {
  const t = (topic || "").toLowerCase();
  const match = TOPIC_GUARDRAILS.find(g => g.keywords.some(k => t.includes(k)));
  if (match) return { l1: match.l1, l2: match.l2 };
  return GENERIC_GUARDRAILS;
}

const GUIDELINE_MAP = [
  { keywords: ["diabetes", "hypoglycemia", "dka", "hhs", "insulin"], citation: `ADA Standards of Medical Care in Diabetes 2026; ADA/EASD Consensus Report 2022.

CRITICAL DIABETES ANCHORS — ADA 2026:
1. CARDIORENAL-DRIVEN PRESCRIBING (mandatory framework):
   - Established ASCVD or high ASCVD risk → GLP-1 RA with proven CV benefit (semaglutide, liraglutide, dulaglutide) OR SGLT2i with proven CV benefit (empagliflozin, canagliflozin).
   - Heart failure (HFrEF or HFpEF) → SGLT2i (Class 1A regardless of HbA1c).
   - CKD (eGFR ≥20 + UACR >200 mg/g) → SGLT2i (Class 1A regardless of HbA1c). Add finerenone if T2DM + albuminuria persists.
   - Obesity priority → tirzepatide or semaglutide preferred for weight loss.
2. METFORMIN: avoid if eGFR <30 mL/min. Reduce dose at eGFR 30-44. Hold periprocedurally if contrast risk.
3. SULFONYLUREAS: avoid in elderly, frequent hypoglycemia, or low HbA1c — high risk of severe hypoglycemia. Glipizide preferred over glyburide if must use.
4. INSULIN: do not stop basal insulin in T1DM (DKA risk). Sick day rules: continue basal, adjust prandial.
5. DKA: insulin held until K+ ≥3.3. Resolution = glucose <200 + 2 of (AG ≤12, bicarb ≥15, pH ≥7.3). Bicarbonate ONLY if pH <6.9.
6. HHS: osmolality >320 mOsm/kg, glucose >600 mg/dL, minimal ketosis. Fluids primary. Slower correction than DKA to avoid cerebral edema.
7. EUGLYCEMIC DKA: SGLT2i, pregnancy, recent surgery — anion gap is the key diagnostic finding when glucose is near-normal.
8. HYPOGLYCEMIA: Whipple triad. Endogenous hyperinsulinism: glucose <55 + insulin ≥3 + C-peptide ≥0.6 + sulfonylurea screen negative. Factitious insulin: insulin ↑, C-peptide LOW. Sulfonylurea: insulin ↑, C-peptide ↑, screen POSITIVE.

DEPRESCRIBING IN ELDERLY: HbA1c <7.0 + history of hypoglycemia → deprescribe sulfonylurea or insulin BEFORE adding new agents. Target HbA1c relaxed to <8.0 or <8.5 in frail elderly per ADA 2026.` },
  { keywords: ["thyroid", "nodule", "graves", "hashimoto", "hypothyroid", "hyperthyroid", "tsh", "free t4", "levothyroxine", "methimazole", "propylthiouracil", "radioiodine", "thyroiditis", "thyrotoxicosis", "goiter", "trab", "tpo", "thyroglobulin", "tg", "papillary", "follicular", "medullary", "anaplastic", "rair", "lenvatinib", "sorafenib", "vandetanib", "cabozantinib", "selpercatinib"], citation: `ATA 2025 Guidelines for Differentiated Thyroid Cancer (Ringel/Sosa); ATA 2015 Guidelines for Thyroid Nodules (Haugen); ATA 2014 Hypothyroidism (Jonklaas); ATA 2016 Hyperthyroidism (Ross); Endocrine Society 2016 Thyroid in Pregnancy.

⚠️ CITATION DATE LOCKS:
- Use "ATA 2025" EXCLUSIVELY for Differentiated Thyroid Cancer (Papillary/Follicular).
- DO NOT cite "ATA 2025" for Nodules (use 2015) or Hypothyroidism (use 2014).
- "ATA/ESMO Joint Guidelines" DO NOT EXIST.

CRITICAL THYROID ANCHORS:

1. OVERT vs SUBCLINICAL:
   - OVERT = ↑TSH + LOW free T4 (regardless of TSH value).
   - SUBCLINICAL = ↑TSH + NORMAL free T4. TSH >10 with normal free T4 is still subclinical.

2. TSH TARGETS (ATA 2025 DTC Update):
   - DTC long-term surveillance: TSH suppression is NO LONGER recommended for low- or intermediate-risk patients without evidence of recurrence (target lower reference range 0.5–2.0 mIU/L).
   - General adult hypothyroid: 0.4–4.0 mIU/L. Pregnancy: 0.1–2.5 (T1).

3. DTC SURGERY (ATA 2025 Update):
   - Lobectomy is the preferred option for low-risk unifocal cancers ≤4 cm without extrathyroidal extension or nodal spread.

4. THYROID CANCER — RAIR HARD RULES:
   - RAIR requires DOCUMENTED RAI failure: no uptake on scan, OR progression within 12mo of RAI, OR cumulative RAI ≥600 mCi. Patient REFUSAL is NOT RAIR.
   - Kinase inhibitors require RECIST 1.1 STRUCTURAL disease.
   - Vandetanib/cabozantinib: MTC only. Selpercatinib: RET-confirmed only.

5. THYROID STORM: PTU BEFORE iodine. Beta-blocker (propranolol). Hydrocortisone.

6. COGNITIVE LEVEL:
   - FORBIDDEN Tier 1: "TSH 9.8 + low T4 — start levo?"
   - REQUIRED Tier 3+: "Stable patient on levo develops elevated TSH — most likely cause?"
   - REQUIRED Tier 4: "Post-thyroidectomy DTC — TSH 1.2, Tg undetectable, anti-Tg rising — interpretation?"` },
  { keywords: ["lipid", "dyslipidemia", "cholesterol", "statin", "ascvd", "pcsk9", "ezetimibe", "triglyceride", "lpa", "lp(a)", "familial hypercholesterolemia", "bempedoic", "inclisiran", "fenofibrate"], citation: `2026 ACC/AHA/Multisociety Guideline on the Management of Dyslipidemia (Blumenthal et al., Circulation 2026) — RETIRES & REPLACES the 2018 Blood Cholesterol Guideline; AACE 2025 CPG on Pharmacologic Management of Adults with Dyslipidemia (Patel SB, Wyne KL, Endocr Pract 2025;31:236-262); 2022 ACC Expert Consensus Decision Pathway on Non-Statin Therapies (Lloyd-Jones et al.).

⚠️ FABRICATED / RETIRED CITATION WARNINGS:
- "AACE 2026 Lipid Guidelines" DOES NOT EXIST. AACE's dyslipidemia guideline is 2025 (Patel/Wyne; GRADE nonstatin focused update of the 2017 Jellinger guideline).
- The 2018 AHA/ACC Cholesterol Guideline (Grundy et al.) is RETIRED (replaced by 2026) AND pre-2023 — BANNED for new items; never cite it as current.

CRITICAL LIPID ANCHORS (2026 ACC/AHA):
1. RISK CALCULATOR — USE PREVENT, NOT PCE:
   - PREVENT (AHA) is the current primary-prevention risk tool — race-neutral, includes kidney function, ages 30-79, 10- and 30-year risk. The 2026 guideline formally adopts PREVENT over PCE.
   - Pooled Cohort Equations (PCE, 2013) are LEGACY.
2. RISK-BASED LDL-C GOALS (RESTORED 2026; the 2018 threshold-only framework is retired):
   - Clinical ASCVD: <55 (very-high-risk) or <70 (not very-high-risk).
   - Primary, LDL-C >=190: <100 (<70 if HeFH, >=1 RF, or subclinical atherosclerosis).
   - Primary, LDL-C 70-189: <100 or <70 by PREVENT risk.
   - CAC: 1-99 AU and <75th pct -> <100; 100-299 AU or >=75th pct -> <70; >=1000 AU -> <55.
3. Lp(a): universal once-in-a-lifetime screening; causal, independent of LDL-C. apoB / non-HDL-C secondary targets.
4. NON-STATIN ESCALATION: LDL above goal on max-tolerated statin -> ezetimibe -> PCSK9i. Statin-intolerant + high risk -> bempedoic acid + ezetimibe -> PCSK9i. Inclisiran: siRNA, 0 and 3 months then every 6 months. AACE 2025: niacin NOT recommended as add-on in hypertriglyceridemia 150-499 with/at risk of ASCVD.
5. STATIN INTOLERANCE: CK >10x ULN -> discontinue; always rechallenge with an alternate statin before declaring complete intolerance.
6. PREGNANCY: statins contraindicated.` },
  { keywords: ["obesity", "bariatric", "metabolic syndrome", "wegovy", "tirzepatide weight", "semaglutide obesity"], citation: `AHA/ACC 2023 Obesity Guideline; AACE 2023 Obesity Algorithm; ADA 2026 Standards of Care.

CRITICAL OBESITY ANCHORS:
1. PHARMACOTHERAPY ELIGIBILITY: BMI ≥30, OR BMI ≥27 + weight-related comorbidity.
2. SEMAGLUTIDE (Wegovy) and TIRZEPATIDE (Zepbound) FDA-approved for chronic weight management.
3. CONTRAINDICATIONS for GLP-1 RAs: personal/family MTC, MEN2 (BLACK BOX). Pancreatitis history relative.
4. POST-BARIATRIC MICRONUTRIENT MONITORING (mandatory): B12, iron, folate, vitamin D, calcium, thiamine — lifelong.
5. POST-BARIATRIC HYPOGLYCEMIA: late dumping syndrome, nesidioblastosis. Acarbose or diazoxide may help.` },
  { keywords: ["pcos", "polycystic"], citation: `International Evidence-based PCOS Guideline 2023 (Teede et al.); Endocrine Society PCOS CPGs.

CRITICAL PCOS ANCHORS:
1. ROTTERDAM CRITERIA: 2 of 3 — oligo/anovulation, clinical or biochemical hyperandrogenism, polycystic ovaries on US.
2. METFORMIN: first-line for insulin resistance.
3. COMBINED OC: menstrual regulation. Prefer NON-androgenic progestogens (drospirenone, norgestimate). AVOID levonorgestrel in metabolically complex PCOS.
4. SPIRONOLACTONE: hirsutism. Requires RELIABLE contraception (teratogenic).
5. LETROZOLE: FIRST-LINE for ovulation induction (superior to clomiphene per 2023 Guideline).
6. BP ≥140/90: relative contraindication to estrogen-containing contraceptives.
7. METABOLICALLY COMPLEX PCOS: avoid androgenic progestogens. Consider non-hormonal alternatives.
8. PIOGLITAZONE: second-line insulin sensitizer when metformin contraindicated. WARNING: causes fluid retention via PPAR-γ — contraindicated in NYHA III/IV HF; use caution in CKD with hypertension/edema.` },
  { keywords: ["cardio", "acs", "stemi", "nstemi", "acute coronary", "myocardial infarction"], citation: `ACC/AHA 2025 ACS Guidelines; ACC/AHA/SCAI 2021 Coronary Revascularization Guideline.

CRITICAL ACS ANCHORS:
1. STEMI: PCI within 90 min (door-to-balloon). Fibrinolysis if PCI unavailable within 120 min.
2. NSTEMI high-risk (elevated troponin, dynamic ECG, hemodynamic instability): early invasive within 24h.
3. DAPT: aspirin + P2Y12 inhibitor (ticagrelor or prasugrel preferred over clopidogrel) for 12 months minimum post-ACS.
4. HBR (high bleeding risk) patients: shorten DAPT to 1-3 months, then aspirin alone.
5. POST-ACS GDMT: high-intensity statin + ACEi/ARB + beta-blocker. Add MRA if HFrEF.
6. HIT: argatroban (hepatic clearance) preferred for renal impairment. Bivalirudin or fondaparinux for hepatic dysfunction. NEVER heparin in confirmed HIT.
7. CARDIOGENIC SHOCK: IABP routine support not recommended (IABP-SHOCK II). Impella or VA-ECMO in select cases.` },
  { keywords: ["heart failure", "hfref", "hfpef", "cardiomyopathy", "arni", "sacubitril"], citation: `ACC/AHA/HFSA 2022 Heart Failure Guideline (Heidenreich et al.).

CRITICAL HEART FAILURE ANCHORS:
1. HFrEF (EF <40%): FOUR PILLARS = ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i. All four are Class 1A.
2. ARNI (sacubitril/valsartan) SUPERIOR to ACEi alone (PARADIGM-HF). 36-hour washout required when switching from ACEi (angioedema risk). DO NOT combine ARNI with ACEi.
3. HFpEF (EF ≥50%): SGLT2i Class 2a recommendation (EMPEROR-Preserved, DELIVER).
4. AVOID in HFrEF: NSAIDs, non-DHP CCBs (verapamil, diltiazem), TZDs (pioglitazone) in NYHA III/IV.
5. ICD: primary prevention if EF ≤35% on optimized GDMT for ≥3 months (NYHA II-III).
6. CRT: EF ≤35% + LBBB + QRS ≥150ms + NYHA II-IV on optimized GDMT.
7. ACUTE DECOMPENSATION: IV loop diuretic. Dose at home dose × 2 IV.
8. CARDIOGENIC SHOCK: norepinephrine first-line (SOAP II); avoid dopamine.` },
  { keywords: ["atrial fibrillation", "afib", "anticoagulation af", "doac", "cha2ds2", "ablation"], citation: `ACC/AHA/ACCP/HRS 2023 Atrial Fibrillation Guideline (Joglar et al.).

CRITICAL ATRIAL FIBRILLATION ANCHORS:
1. CHA2DS2-VASc ≥2 (men) / ≥3 (women) → anticoagulation indicated.
2. DOACs preferred OVER warfarin EXCEPT mechanical valves and moderate-severe MS (warfarin only).
3. Apixaban: preferred in CKD (5 mg BID; 2.5 BID if 2 of: age ≥80, weight ≤60, Cr ≥1.5).
4. Rate vs rhythm: many patients fine with rate. Early rhythm control benefit (EAST-AFNET 4).
5. DOAC reversal: idarucizumab for dabigatran; andexanet alfa for apixaban/rivaroxaban.
6. PERIPROCEDURAL: hold DOAC 24-48h pre-low-bleeding-risk, 48-72h pre-high-bleeding-risk procedure. Bridge only mechanical valves.
7. RECURRENT AF AFTER ABLATION within 3 months = blanking period; reassess at 6 months.` },
  { keywords: ["arrhythmia", "tachycardia", "bradycardia", "vt", "vf", "svt"], citation: "ACC/AHA/HRS 2017 Ventricular Arrhythmia Guideline; AHA 2020 ACLS Updates." },
  { keywords: ["hypertension", "blood pressure"], citation: `ACC/AHA 2017 Hypertension Guideline (Whelton et al.) + 2024 ACC/AHA Updates.

CRITICAL HYPERTENSION ANCHORS:
1. BP THRESHOLD: stage 1 = 130-139/80-89; stage 2 = ≥140/90.
2. TREATMENT THRESHOLD: stage 2 OR stage 1 + ASCVD risk ≥10%.
3. BP TARGET: <130/80 most patients (SPRINT-derived).
4. FIRST-LINE: thiazide, ACEi/ARB, or DHP-CCB. AVOID beta-blockers as first-line unless compelling indication (post-MI, HFrEF).
5. RESISTANT HYPERTENSION: 3 drugs at max-tolerated dose including diuretic. Add spironolactone (PATHWAY-2). Workup: aldosterone, renal artery stenosis, OSA, secondary causes.
6. PREGNANCY: methyldopa, labetalol, nifedipine. AVOID ACEi/ARB (teratogenic).` },
  { keywords: ["nephro", "renal", "ckd", "kidney disease", "egfr", "albuminuria", "uacr", "finerenone"], citation: `KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD; KDIGO 2022 Diabetes Management in CKD.

CRITICAL CKD ANCHORS:

1. SGLT2i — CARDIORENAL ANCHOR (CRITICAL ANTI-HALLUCINATION):
   - eGFR ≥20 + UACR >200 mg/g = Class 1A for renoprotection, INDEPENDENT of T2DM or glycemic indication.
   - DAPA-CKD, EMPA-KIDNEY trials confirm renoprotection in non-diabetic CKD.
   - NEVER dismiss SGLT2i solely on "glycemic inefficacy at low eGFR" when question concerns cardiorenal benefit.
   - eGFR <20: do not initiate; continue if already established and tolerated.

2. RAS BLOCKADE: ACEi or ARB titrated to maximum tolerated dose for proteinuria. Continue despite mild creatinine rise (≤30%).

3. FINERENONE: nonsteroidal MRA for T2DM + CKD + albuminuria (FIDELIO-DKD, FIGARO-DKD). Reduces CV events and CKD progression.

4. HYPERKALEMIA MITIGATION: patiromer or sodium zirconium cyclosilicate ALLOWS continuation of RAS blockade rather than discontinuation. New paradigm post-AMBER trial.

5. AKI WORKUP:
   - Pre-renal vs intrinsic vs post-renal classification.
   - FENa <1% prerenal vs >2% ATN — UNRELIABLE on diuretics (use FEUrea: <35% prerenal).
   - Contrast nephropathy peaks 3-5 days post-exposure.
   - AIN: triad of fever + rash + eosinophilia present in <30%; urine eosinophils unreliable.

6. NEPHROLOGY CONSULT: stage 3 AKI, refractory hyperkalemia, uremia, refractory volume overload, RRT consideration.

7. CONTRAST NEPHROPATHY PROPHYLAXIS: IV isotonic saline; sodium bicarbonate not superior. N-acetylcysteine NOT recommended (no benefit per PRESERVE trial).

8. DIALYSIS INITIATION: AEIOU mnemonic — Acidosis, Electrolytes, Intoxications, Overload, Uremia. Not based on eGFR alone.` },
  { keywords: ["gastro", "hepat", "cirrhosis", "ibd", "crohn", "colitis", "ulcerative", "inflammatory bowel", "infliximab", "adalimumab", "vedolizumab", "ustekinumab", "risankizumab", "tofacitinib", "upadacitinib", "biologic", "anti-tnf", "fistula", "perianal", "colonoscopy", "budesonide", "mesalamine", "azathioprine"], citation: `ACG 2024 Crohn Disease Guidelines (Lichtenstein et al.); AGA 2021 Moderate-to-Severe Crohn Guideline; ACG 2019 UC Guidelines; ECCO 2022 IBD Guidelines; AASLD 2025 Practice Guidance.

CRITICAL IBD ANCHORS:
1. THERAPEUTIC DRUG MONITORING (TDM) — ANTI-TNF:
   - Infliximab trough goal: ≥5 mcg/mL induction, ≥3-5 mcg/mL maintenance.
   - ATI + low trough → switch CLASS (primary immunogenicity).
   - Subtherapeutic trough + no ATI → dose optimize.
2. TOP-DOWN VS STEP-UP:
   - Moderate-to-severe CD: early biologic + immunomodulator combination.
   - SONIC trial: infliximab + azathioprine > infliximab alone > azathioprine alone for CD.
3. BIOLOGIC SWITCHING:
   - Primary non-response → switch CLASS.
   - Secondary loss of response → TDM first.
4. PRE-BIOLOGIC SCREENING (mandatory):
   - TB: CXR + IGRA. Treat LTBI before biologic.
   - HBV: HBsAg, anti-HBc, anti-HBs. If HBsAg+ → entecavir prophylaxis.
   - Varicella IgG: vaccinate if seronegative BEFORE biologic (live vaccine).
5. CANCER SURVEILLANCE: UC and colonic CD — colonoscopy q1-2y from 8-10y after diagnosis. PSC + IBD: annual.
6. PERIANAL DISEASE: EUA + MRI pelvis. Infliximab has best perianal data. Surgical drainage + seton BEFORE biologic. AVOID systemic corticosteroids.
7. PREGNANCY:
   - Anti-TNF (infliximab, adalimumab): SAFE; continue.
   - Methotrexate: CONTRAINDICATED (teratogenic). Stop 3-6 months before conception.
8. JAK INHIBITORS (tofacitinib, upadacitinib): BLACK BOX — CV events, malignancy, thrombosis.
9. CIRRHOSIS:
   - SBP prophylaxis after first episode: norfloxacin or ciprofloxacin.
   - HRS-AKI: terlipressin + albumin first-line.
   - HE: lactulose + rifaximin.
   - HCC screening: q6mo US ± AFP in cirrhosis.` },
  { keywords: ["parathyroid", "calcium", "bone", "osteoporosis", "hyperparathyroidism", "hypercalcemia", "bisphosphonate", "denosumab", "teriparatide", "abaloparatide", "romosozumab", "frax", "pthrp", "calcimimetic", "cinacalcet"], citation: `Endocrine Society 2022 Primary Hyperparathyroidism Guideline (Bilezikian et al.); AACE 2020 Postmenopausal Osteoporosis Guideline + 2024 Updates.

CRITICAL BONE/PTH ANCHORS:

1. PRIMARY HYPERPARATHYROIDISM:
   - Diagnosis: ↑Ca + ↑PTH (or inappropriately normal PTH).
   - 24h urine calcium DISTINGUISHES from FHH (Ca/Cr clearance ratio <0.01 = FHH).
   - Surgery indications (any one): symptomatic, age <50, Ca >1 above ULN, eGFR <60, T-score ≤-2.5, vertebral fracture, kidney stones, 24h urine Ca >400.
   - Sestamibi + neck US for localization.
   - Hungry bone syndrome: post-op severe hypocalcemia.

2. HYPERCALCEMIA — CRITICAL ANTI-HALLUCINATION RULES:
   - Treatment sequence: IV fluids first → calcitonin (rapid, tachyphylaxis 48h) → BISPHOSPHONATE (4-7 day onset).
   - BISPHOSPHONATES DO LOWER SERUM CALCIUM via osteoclast inhibition. NEVER state "alendronate does not lower calcium" — this is FALSE.
   - Denosumab: alternative when bisphosphonate contraindicated (renal failure).
   - Cinacalcet: severe primary HPT or parathyroid carcinoma not amenable to surgery.
   - Granulomatous (sarcoid, TB) hypercalcemia: corticosteroids effective (1,25-D mediated).

3. OSTEOPOROSIS TREATMENT THRESHOLD:
   - T-score ≤-2.5, OR T -1.0 to -2.5 + FRAX MOF ≥20% or hip ≥3%.

4. BISPHOSPHONATE FACTS:
   - Alendronate, risedronate, zoledronic acid: ALL LOWER SERUM CALCIUM and improve BMD.
   - Drug holiday: 5 years oral / 3 years IV — high-risk continue.
   - Alendronate: NOT RECOMMENDED at eGFR <35 (FDA labeling); not absolutely contraindicated, use clinical judgment.
   - Atypical femur fracture risk after long-term use → consider holiday.

5. DENOSUMAB:
   - DISCONTINUATION REQUIRES bisphosphonate bridge (within 6 months of last dose) — rebound vertebral fractures otherwise.
   - Approved at any eGFR (no renal dose adjustment).

6. ANABOLIC AGENTS:
   - Teriparatide and abaloparatide: MAX 2 YEARS lifetime.
   - Romosozumab: BLACK BOX — contraindicated if MI or stroke within prior 12 months (ARCH trial signal).
   - Sequential therapy: anabolic first, then antiresorptive to maintain gains.

7. DRUG-INDUCED OSTEOPOROSIS:
   - Glucocorticoids: prednisone ≥5 mg/day ≥3 months → consider treatment.
   - Aromatase inhibitors, GnRH agonists, AR-blockers: monitor BMD.
   - Long-term PPI: ?modest fracture risk; not a contraindication.` },
  { keywords: ["menopause", "hrt", "hormone therapy", "vasomotor", "estrogen replacement", "reproductive"], citation: `Endocrine Society 2022 Menopause Guideline; NAMS 2022 Hormone Therapy Position Statement.

CRITICAL MENOPAUSE ANCHORS:
1. HORMONE THERAPY: most beneficial when initiated <60 years or <10 years from menopause onset (timing hypothesis).
2. CONTRAINDICATIONS: history of breast cancer, CHD, stroke, VTE, active liver disease, undiagnosed vaginal bleeding.
3. ROUTE: transdermal preferred for VTE risk (avoids first-pass hepatic effect).
4. PROGESTOGEN: required if intact uterus (endometrial protection). Continuous combined or sequential.
5. NON-HORMONAL OPTIONS: SSRIs (paroxetine FDA-approved for VMS), SNRIs (venlafaxine), gabapentin, fezolinetant (NK3R antagonist, 2023 FDA approval).
6. GENITOURINARY SYNDROME: low-dose vaginal estrogen safe even in many breast cancer survivors after specialist discussion.` },
  { keywords: ["pituitary", "hypothalamus", "acromegaly", "prolactin", "prolactinoma", "hypopituitarism", "craniopharyngioma", "avp", "diabetes insipidus", "siadh", "igf-1", "growth hormone", "gonadotropin", "sheehan", "apoplexy", "cabergoline", "octreotide", "lanreotide", "pegvisomant", "desmopressin", "copeptin"], citation: `Pituitary Society 2023 Consensus on Acromegaly, Hypopituitarism, and Pituitary Tumors; Endocrine Society 2025 CPGs; European Journal of Endocrinology 2023 AVP-D Consensus.

CRITICAL PITUITARY ANCHORS:

1. PROLACTINOMA:
   - Cabergoline first-line.
   - Bromocriptine preferred during planned pregnancy.
   - Stalk effect (non-prolactinoma compressing stalk): prolactin typically <100 ng/mL.
   - Hook effect at very high prolactin (>1000): assay underestimates — must dilute.

2. ACROMEGALY:
   - GH nadir <1 ng/mL on 75g OGTT (or <0.4 with ultrasensitive assay).
   - IGF-1 used for diagnosis and monitoring.
   - Transsphenoidal surgery first-line.
   - Pegvisomant (GH receptor antagonist): IGF-1 monitoring only — interferes with GH assay.

3. HYPOPITUITARISM:
   - REPLACE CORTISOL BEFORE THYROID HORMONE.
   - Sheehan syndrome: postpartum pituitary infarction.
   - Pituitary apoplexy: acute headache + visual change + hypopituitarism = neurosurgical emergency. Stress-dose steroids FIRST.

4. AVP-D vs AVP-R:
   - Hypertonic saline-stimulated copeptin >6.4 pmol/L confirms AVP-R.
   - Hypertonic saline-stimulated copeptin <4.9 pmol/L confirms AVP-D.
   - Largely replaced classic water deprivation test.
   - Lithium → nephrogenic DI; gestational DI → placental vasopressinase.

5. POST-PITUITARY-SURGERY TRIPHASIC: DI → SIADH → permanent DI.

6. SIADH:
   - Euvolemic hyponatremia + concentrated urine + low serum osmolality.
   - Fluid restriction first. Tolvaptan or demeclocycline second-line.
   - Correction <8 mEq/L per 24h to prevent osmotic demyelination.` },
  { keywords: ["sepsis", "septic shock", "infectious", "antibiotic", "bacteremia", "pneumonia", "pyelonephritis", "meningitis", "endocarditis", "esbl", "carbapenem", "vasopressor", "norepinephrine", "vasopressin", "hydrocortisone", "source control", "lactate", "procalcitonin"], citation: `Surviving Sepsis Campaign (SSC) 2021 International Guidelines; IDSA 2024 Antibiotic Stewardship Guidelines.

CRITICAL SEPSIS/ID ANCHORS:

1. PRESSORS:
   - Norepinephrine = FIRST-LINE.
   - Add VASOPRESSIN 0.03 units/min when norepinephrine ≥0.25 mcg/kg/min — NOT dopamine.
   - Dopamine: select bradycardic patients only; higher arrhythmia risk.
   - Epinephrine: third-line in refractory shock.

2. STEROIDS IN SEPTIC SHOCK:
   - IV hydrocortisone 200 mg/day ONLY if hemodynamically unstable despite adequate fluids AND vasopressors.
   - Do NOT use steroids in sepsis WITHOUT shock.
   - ACTH stim test NOT required.

3. ANTIBIOTIC STEWARDSHIP:
   - Empiric carbapenem (meropenem/ertapenem): known ESBL, prior ESBL, recurrent UTI with prior ESBL, septic shock without time for cultures.
   - Pip-tazo NOT reliable for ESBL bacteremia (MERINO 2018 — higher mortality).
   - De-escalate carbapenem to cephalosporin/quinolone once susceptibility known.
   - Ceftolozane-tazobactam or ceftazidime-avibactam: MDR Pseudomonas or KPC.

4. SOURCE CONTROL:
   - Obstructive pyelonephritis with sepsis = UROLOGIC EMERGENCY. Decompression within 6-12 hours.
   - Necrotizing fasciitis: surgical debridement is the source control.

5. REFRACTORY SHOCK ESCALATION:
   - MAP <65 despite norepinephrine ≥0.25 mcg/kg/min + adequate fluids.
   - Step 1: vasopressin. Step 2: hydrocortisone. Step 3: epinephrine.

6. ICU TRANSFER:
   - Lactate ≥4: immediate ICU.
   - Lactate 2-4: reassess at 2h — failure to clear ≥10% = ICU.
   - Vasopressor at any dose: ICU mandatory.

7. PROCALCITONIN: guides DE-ESCALATION, not initiation.

8. ENDOCARDITIS:
   - Modified Duke Criteria.
   - Native valve viridans/Strep gallolyticus: penicillin/ceftriaxone.
   - Native valve Staph: nafcillin (MSSA), vancomycin (MRSA).
   - Prosthetic valve: vancomycin + gentamicin + rifampin.` },
  { keywords: ["men1", "multiple endocrine neoplasia type 1", "wermer", "men2", "men 2a", "men 2b", "ret mutation", "prophylactic thyroidectomy"], citation: `Endocrine Society Clinical Practice Guidelines for MEN1 (2012) and MEN2/MTC (2015). Do not cite guidelines newer than these.` },
  { keywords: ["cushing", "adrenal", "aldosterone", "pheochromocytoma", "paraganglioma", "addison", "cortisol", "acth", "metanephrine", "phenoxybenzamine", "spironolactone adrenal", "eplerenone"], citation: `Endocrine Society 2008 Cushing Syndrome Diagnostic CPG (Nieman et al.) + 2015 Treatment CPG; Pituitary Society 2023 Consensus on Cushing Disease; Endocrine Society 2025 Primary Aldosteronism CPG (Adler et al.); Endocrine Society 2014 Pheochromocytoma/Paraganglioma CPG.

CRITICAL ADRENAL ANCHORS:

1. CUSHING'S SCREENING:
   - 1mg overnight DST OR 24h UFC OR late-night salivary cortisol.
   - 8mg DST is NOT a standard screening test (legacy localization tool, largely obsolete).
   - ACTH <10 pg/mL = ACTH-INDEPENDENT (adrenal source).
   - ACTH >20 pg/mL = ACTH-DEPENDENT (pituitary or ectopic).

2. CUSHING'S LOCALIZATION:
   - BIPSS required when MRI shows lesion <6mm or no lesion.
   - Central:peripheral ACTH ratio ≥2 basal or ≥3 post-CRH = pituitary source.
   - MRI finding of ≥10mm microadenoma does NOT replace BIPSS for localization in ambiguous cases.

3. PRIMARY ALDOSTERONISM:
   - Screening: aldosterone-renin ratio (ARR) >30 (ng/dL per ng/mL/hr).
   - Confirmation required before AVS: salt loading, IV saline, fludrocortisone suppression, or captopril challenge.
   - AVS required pre-surgery in ALL patients >35 years to lateralize. CT alone insufficient.
   - Spironolactone interferes — washout 4-6 weeks before testing.
   - Unilateral adenoma → adrenalectomy. Bilateral hyperplasia → MRA (spironolactone or eplerenone).

4. PHEOCHROMOCYTOMA:
   - Plasma free metanephrines OR 24h urine fractionated metanephrines first-line.
   - ALPHA BLOCKADE (phenoxybenzamine or doxazosin) MUST PRECEDE BETA BLOCKADE by 10-14 days.
   - Starting beta-blocker first → unopposed alpha → hypertensive crisis. Never do this.
   - Volume expansion preoperatively (high-salt diet, sometimes IV fluids).
   - Genetic testing in ALL patients: MEN2 (RET), VHL, SDH-related, NF1.

5. ADRENAL INSUFFICIENCY:
   - Primary (Addison): ↓cortisol, ↑ACTH, ↑renin, ↓aldosterone, hyperpigmentation.
   - Secondary: ↓cortisol, ↓ACTH, NORMAL aldosterone, no hyperpigmentation.
   - ACTH stim test confirms primary (cortisol <18 µg/dL at 30/60 min).
   - Adrenal crisis: hydrocortisone 100mg IV IMMEDIATELY — do not wait for confirmation.
   - Steroid-induced HPA suppression: any chronic exogenous steroid >3 weeks.

6. ADRENAL INCIDENTALOMA:
   - Workup: 1mg DST (Cushing screen), plasma metanephrines (pheo screen), aldosterone-renin (PA screen if hypertensive).
   - Imaging features: HU <10 = lipid-rich adenoma; HU >10 with washout >50% absolute or >40% relative = adenoma; HU >10 with poor washout = suspicious.
   - Surgery: functional tumor, >4 cm, suspicious imaging features.` }
];

function getGuidelineContext(topic, isNutrition) {
  if (isNutrition) return "ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, IOM/DRI Nutrition Guidelines";
  const t = topic.toLowerCase();
  const match = GUIDELINE_MAP.find(g => g.keywords.some(k => t.includes(k)));
  return match ? match.citation : "the most recent applicable society guidelines (do not fabricate publication years)";
}

function pickSexForTopic(promptTopic) {
  const t = promptTopic.toLowerCase();
  if (MALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k)))   return "man";
  if (FEMALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k))) return "woman";
  return Math.random() > 0.5 ? "man" : "woman";
}

function pickWeighted(blueprint) {
  const total = blueprint.reduce((acc, curr) => acc + curr.w, 0);
  let rand = Math.random() * total;
  for (const item of blueprint) { rand -= item.w; if (rand < 0) return item.s; }
  return blueprint[blueprint.length - 1].s;
}

function hashStem(stem) {
  if (!stem || typeof stem !== "string") return null;
  return crypto.createHash("sha256").update(stem.trim().toLowerCase()).digest("hex");
}

function deriveSpecialtyGroup(level, resolvedTopic) {
  if (level === "ABIM Endocrinology") return "Endocrinology";
  const t = (resolvedTopic || "").toLowerCase();
  if (t.includes("cardio") || t.includes("acs") || t.includes("heart failure") || t.includes("atrial")) return "Cardiology";
  if (t.includes("endocrin") || t.includes("diabetes") || t.includes("thyroid") || t.includes("pituitary") || t.includes("adrenal") || t.includes("bone") || t.includes("calcium")) return "Endocrinology";
  if (t.includes("nephro") || t.includes("renal") || t.includes("ckd") || t.includes("kidney")) return "Nephrology";
  if (t.includes("pulm") || t.includes("copd") || t.includes("asthma") || t.includes("pneumonia")) return "Pulmonology";
  if (t.includes("gastro") || t.includes("hepat") || t.includes("cirrhosis") || t.includes("ibd")) return "Gastroenterology";
  if (t.includes("hematol") || t.includes("oncolog") || t.includes("anemia") || t.includes("dvt")) return "Hematology/Oncology";
  if (t.includes("rheumatol") || t.includes("arthritis") || t.includes("sle") || t.includes("lupus")) return "Rheumatology";
  if (t.includes("infectious") || t.includes("sepsis") || t.includes("hiv") || t.includes("antibiotic")) return "Infectious Disease";
  if (t.includes("neurolog") || t.includes("stroke") || t.includes("seizure")) return "Neurology";
  if (t.includes("ethics") || t.includes("hipaa") || t.includes("palliative") || t.includes("end-of-life") || t.includes("consent")) return "Ethics/Communication";
  if (t.includes("psychi") || t.includes("substance")) return "Psychiatry";
  if (t.includes("pediat") || t.includes("congenital")) return "Pediatrics";
  if (t.includes("obstet") || t.includes("gynec") || t.includes("gestational")) return "OB/GYN";
  if (t.includes("surg") || t.includes("trauma")) return "Surgery";
  if (t.includes("pharmac")) return "Pharmacology";
  if (t.includes("nutrition") || t.includes("vitamin") || t.includes("thiamine") || t.includes("refeeding")) return "Nutrition";
  return "General Internal Medicine";
}

// ─── VALIDATORS ───────────────────────────────────────────────────────────────
function validateDemographics(stem, sex, topic) {
  const lowerText  = stem.toLowerCase();
  const lowerTopic = (topic || "").toLowerCase();

  if (sex === "man") {
    const femaleTerms = ["oral contraceptive","ocp","pregnant","pregnancy","gravida","menopause","menstrual","menses","amenorrhea","ovary","uterus","endometrial","vaginal","cervical cancer"];
    if (femaleTerms.some(term => lowerText.includes(term))) return false;
  } else {
    const maleTerms = ["prostate","bph","psa level","testicle","testicular","scrotal","sildenafil","erectile dysfunction"];
    if (maleTerms.some(term => lowerText.includes(term))) return false;
  }

  const ageMatch = stem.match(/(\d+)[\s\-]*year[\s\-]*old/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

  if (sex === "woman" && age !== null && age >= 55) {
    const pregTestTerms = ["b-hcg", "beta-hcg", "β-hcg", "pregnancy test", "urine pregnancy", "serum hcg", "qhcg", "quantitative hcg"];
    const isPregnancyRelevantTopic = lowerTopic.includes("pregnancy") || lowerTopic.includes("obstet") || lowerTopic.includes("gestational") || lowerTopic.includes("prolactin") || lowerTopic.includes("hyperprolactin");
    if (!isPregnancyRelevantTopic && pregTestTerms.some(term => lowerText.includes(term))) return false;
  }

  if (sex === "man") {
    const isUrologicalTopic = lowerTopic.includes("prostate") || lowerTopic.includes("urolog") || lowerTopic.includes("bph") || lowerTopic.includes("hypogonadism");
    if (!isUrologicalTopic && (lowerText.includes(" psa ") || lowerText.includes("prostate-specific antigen") || lowerText.includes("psa level") || lowerText.includes("psa is") || lowerText.includes("psa was"))) return false;
  }

  return true;
}

const LAB_VALUE_PATTERN = /\b(tsh|free\s*t4|free\s*t3|total\s*t4|total\s*t3|hba1c|a1c|fasting\s*glucose|glucose|sodium|potassium|creatinine|egfr|calcium|phosphorus|cortisol|acth|igf-1|igf1|prolactin|lh|fsh|testosterone|estradiol|aldosterone|plasma\s*renin|renin|creatine\s*kinase|ck\b|alt|ast|alp|tbili|bilirubin|hemoglobin|hgb|hematocrit|wbc|platelets|inr|ptt|bun|bicarbonate|bicarb|co2|pco2|po2|ldl|hdl|triglyceride|total\s*cholesterol|cholesterol|trab|tpo\s*antibody|vitamin\s*d|25-oh\s*vitamin|pth|parathyroid\s*hormone|urine\s*cortisol|urine\s*albumin|albumin|ferritin|b12|folate|tsh\s*receptor\s*antibod)\s+(?:of\s+|was\s+|is\s+|:?\s*)(\d+\.?\d*)/gi;

function extractLabValues(text) {
  const values = {};
  LAB_VALUE_PATTERN.lastIndex = 0;
  let m;
  while ((m = LAB_VALUE_PATTERN.exec(text)) !== null) {
    const labName = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    if (!(labName in values)) values[labName] = m[2];
  }
  return values;
}

function validateConsistency(p) {
  if (!p || !p.stem || !p.explanation) return true;
  const stemValues = extractLabValues(p.stem);
  const explValues = extractLabValues(p.explanation);
  for (const lab of Object.keys(explValues)) {
    if (stemValues[lab] !== undefined && stemValues[lab] !== explValues[lab]) {
      console.warn(`[validateConsistency] Mismatch — ${lab}: stem="${stemValues[lab]}" vs explanation="${explValues[lab]}"`);
      return false;
    }
  }
  return true;
}

// ─── CANON-ALIGNED VALIDATORS (v7.5.6) ───────────────────────────────────────
// All rules sourced from ABIM Question Writing Guidelines and NBME Item-Writing
// Guide (6th ed). Section references in comments throughout.

// ABIM C.1 — Per-level lead-in allow-list. Diagnosis-tier lead-ins permitted at
// all levels per ABIM canon, but weighted/scoped via qTypePool and tier prompts.
const ALLOWED_LEAD_INS_BY_LEVEL = {
  "USMLE Step 1": new Set([
    "underlying_mechanism_or_pathophysiology",
    "mechanism_of_action_or_toxicity",
    "most_likely_diagnosis",
    "clinical_features_of_named_disease",
    "strongest_risk_factor",
    "interpretation_of_data_or_literature"
  ]),
  "USMLE Step 2 CK": new Set([
    "most_likely_diagnosis",
    "diagnostic_inference_atypical_presentation",
    "next_step_in_diagnostic_workup",
    "most_accurate_diagnostic_test",
    "most_appropriate_pharmacotherapy",
    "most_appropriate_clinical_intervention",
    "next_step_in_management",
    "risk_of_future_adverse_event_or_complication",
    "preventive_recommendation",
    "informed_consent_or_ethical_decision",
    "interpretation_of_data_or_literature"
  ]),
  "USMLE Step 3": new Set([
    "next_step_in_management",
    "mixed_management_with_comorbidity",
    "disposition_or_transition_of_care",
    "most_appropriate_pharmacotherapy",
    "most_appropriate_clinical_intervention",
    "most_accurate_diagnostic_test",
    "next_step_in_diagnostic_workup",
    "risk_of_future_adverse_event_or_complication",
    "informed_consent_or_ethical_decision",
    "diagnostic_inference_atypical_presentation"
  ]),
  "ABIM Internal Medicine": new Set([
    "next_step_in_management",
    "mixed_management_with_comorbidity",
    "most_appropriate_pharmacotherapy",
    "most_appropriate_clinical_intervention",
    "most_accurate_diagnostic_test",
    "next_step_in_diagnostic_workup",
    "risk_of_future_adverse_event_or_complication",
    "preventive_recommendation",
    "diagnostic_inference_atypical_presentation",
    "interpretation_of_data_or_literature"
  ]),
  "ABIM Endocrinology": new Set([
    "next_step_in_management",
    "mixed_management_with_comorbidity",
    "most_appropriate_pharmacotherapy",
    "most_appropriate_clinical_intervention",
    "next_step_in_diagnostic_workup",
    "most_accurate_diagnostic_test",
    "risk_of_future_adverse_event_or_complication",
    "diagnostic_inference_atypical_presentation",
    "interpretation_of_data_or_literature"
  ])
};

function validateLeadInType(p, level) {
  if (!p.lead_in_type) {
    console.warn("[validateLeadInType] Missing lead_in_type field.");
    return false;
  }
  const allowed = ALLOWED_LEAD_INS_BY_LEVEL[level];
  if (!allowed) {
    console.warn(`[validateLeadInType] Unknown level: ${level}`);
    return false;
  }
  if (!allowed.has(p.lead_in_type)) {
    console.warn(`[validateLeadInType] Lead-in type "${p.lead_in_type}" not permitted at level "${level}".`);
    return false;
  }
  return true;
}

// Extract the lead-in (last sentence of stem). Defensive: returns full stem if no
// terminal sentence boundary is found.
function extractLeadIn(stem) {
  if (!stem || typeof stem !== "string") return "";
  const sentences = stem.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) return stem.trim();
  return sentences[sentences.length - 1].trim();
}

// ABIM C.2.b — Negative-form lead-ins forbidden ("Which of the following is NOT
// true", "LEAST likely", "all of the following EXCEPT").
function validateNegativeForm(p) {
  if (!p || !p.stem) return false;
  const leadIn = extractLeadIn(p.stem);
  if (/\b(EXCEPT|NOT|LEAST\s+likely|all\s+of\s+the\s+following\s+except)\b/i.test(leadIn)) {
    console.warn(`[validateNegativeForm] Negative-form lead-in detected: "${leadIn.slice(0, 80)}..."`);
    return false;
  }
  return true;
}

// ABIM C.2.a — "Associated with" is forbidden in lead-ins.
function validateAssociatedWith(p) {
  if (!p || !p.stem) return false;
  const leadIn = extractLeadIn(p.stem);
  if (/\bassociated\s+with\b/i.test(leadIn)) {
    console.warn(`[validateAssociatedWith] "Associated with" detected in lead-in: "${leadIn.slice(0, 80)}..."`);
    return false;
  }
  return true;
}

// ABIM B.3 — Vague qualifiers and absolutes forbidden in choices.
const VAGUE_QUALIFIER_PATTERN = /\b(often|usually|sometimes|rarely|commonly|frequently|generally|always|never)\b/i;
function validateVagueQualifiers(p) {
  if (!p || !p.choices) return false;
  for (const letter of ["A", "B", "C", "D", "E"]) {
    const text = p.choices[letter];
    if (text && VAGUE_QUALIFIER_PATTERN.test(text)) {
      console.warn(`[validateVagueQualifiers] Vague qualifier in choice ${letter}: "${text.slice(0, 80)}..."`);
      return false;
    }
  }
  return true;
}

// ABIM B.3 — Subjective adjectives forbidden as patient descriptors. Scoped to
// the first sentence of the stem to avoid false positives when these terms
// appear in lab/history context (e.g., "older adults are at increased risk" in
// the explanation is fine; "an older patient presents to clinic" is not).
function validateSubjectiveAdjectives(p) {
  if (!p || !p.stem) return false;
  const firstSentence = p.stem.split(/[.!?]/)[0] || "";
  const SUBJECTIVE_PATTERN = /\b(young|middle-aged|older|elderly|obese)\s+(man|woman|patient|male|female|adult)\b/i;
  if (SUBJECTIVE_PATTERN.test(firstSentence)) {
    console.warn(`[validateSubjectiveAdjectives] Subjective adjective as patient descriptor: "${firstSentence.slice(0, 80)}..."`);
    return false;
  }
  return true;
}

// ABIM B.3 — Pejorative phrasings forbidden in patient history. "Complains of"
// and "denies" carry judgment connotations per ABIM canon.
function validatePejorativeLanguage(p) {
  if (!p || !p.stem) return false;
  if (/\b(complains\s+of|denies)\b/i.test(p.stem)) {
    console.warn(`[validatePejorativeLanguage] Pejorative phrasing detected in stem ("complains of" / "denies").`);
    return false;
  }
  return true;
}

// ABIM D.6, D.7 — "All of the above" / "None of the above" forbidden as choices.
function validateNoAllOrNoneOfTheAbove(p) {
  if (!p || !p.choices) return false;
  const PATTERN = /^\s*(all|none)\s+of\s+the\s+above\s*\.?\s*$/i;
  for (const letter of ["A", "B", "C", "D", "E"]) {
    if (PATTERN.test(p.choices[letter] || "")) {
      console.warn(`[validateNoAllOrNoneOfTheAbove] Forbidden meta-choice in ${letter}: "${p.choices[letter]}"`);
      return false;
    }
  }
  return true;
}

// ABIM B.1.c — Site of care required in patient-based questions. Scoped to the
// first 2 sentences of the stem (liberal whitelist, opening-orientation rule).
const SITE_OF_CARE_PATTERNS = [
  /\b(emergency\s+department|ED|emergency\s+room|ER)\b/i,
  /\b(clinic|outpatient|office|primary\s+care|endocrinology\s+clinic|cardiology\s+clinic|fellowship\s+clinic)\b/i,
  /\b(hospital|inpatient|admitted|hospitalized|admission)\b/i,
  /\b(ICU|intensive\s+care|MICU|SICU|CCU|NICU)\b/i,
  /\b(nursing\s+home|long-term\s+care|skilled\s+nursing|SNF|rehabilitation)\b/i,
  /\b(urgent\s+care|walk-in)\b/i,
  /\b(your\s+office|your\s+clinic|the\s+practice)\b/i,
  /\b(follow[-\s]?up\s+visit|routine\s+visit|annual\s+(visit|physical|exam))\b/i,
  /\b(presents\s+to|was\s+admitted\s+to|is\s+hospitalized|was\s+seen\s+in|was\s+referred\s+to)\b/i,
  /\b(consultation|consult\s+is\s+requested|asked\s+to\s+see)\b/i,
  /\b(postpartum|postoperative|peri[-\s]?operative)\s+(unit|day|setting)\b/i,
  /\b(operating\s+room|OR|recovery\s+room|PACU)\b/i
];
function validateSiteOfCare(p) {
  if (!p || !p.stem) return false;
  const sentences = p.stem.match(/[^.!?]+[.!?]+/g) || [p.stem];
  const opening = sentences.slice(0, 2).join(" ");
  for (const pat of SITE_OF_CARE_PATTERNS) {
    if (pat.test(opening)) return true;
  }
  console.warn(`[validateSiteOfCare] No site of care detected in first 2 sentences: "${opening.slice(0, 120)}..."`);
  return false;
}

// ============================================================
// CITATION-YEAR LOCK (v7.5.8) - forbids fabricated guideline years
// ============================================================
// Targets explanations that attach an invented year to a society/guideline name
// ("ATA 2024", "ATA 2025", "AACE 2025", "2023 ATA/ACR"). Only years adjacent to a
// recognized issuing body are checked; bare numbers (ages, labs) are ignored.
// Per-society allow-list lets us permit "AHA/ASA 2024" while still rejecting
// "ATA 2024". Seed = CLAUDE.md s6 canon + DI (ESE 2018) + A1/A2 anchors.
// Runs at GENERATION time only; stored rows are untouched.
const ALLOWED_GUIDELINE_CITATIONS = {
  // Endocrine core — verified to publication year (AM pass; SESSION_LOG_2026_05_29_AM)
  "Endocrine Society": new Set(["2008", "2009", "2012", "2014", "2016", "2018", "2022", "2024", "2025"]),
  "ATA":   new Set(["2014", "2015", "2016", "2017", "2025"]),
  "AACE":  new Set(["2020", "2022", "2023", "2025", "2026"]),
  "ESE":   new Set(["2018", "2023", "2024"]),
  "ADA":   new Set(["2024", "2025", "2026"]),
  // Non-endo — verified to publication year (PM pass, 2026-05-29)
  "AHA":   new Set(["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]),
  "ASA":   new Set(["2018", "2019", "2021", "2022", "2026"]),
  "KDIGO": new Set(["2021", "2022", "2024", "2025"]),
  "GOLD":  new Set(["2024", "2025", "2026"]),
  "GINA":  new Set(["2024", "2025", "2026"]),
  "EULAR": new Set(["2022", "2023"]),
  "ACR":   new Set(["2017", "2023"]),
  "EHRA":  new Set(["2021"]),
  "Jonklaas": new Set(["2014"]),
  "Pituitary Society": new Set(["2023"])
};
// Match longest society names first so "Endocrine Society" wins over substrings.
const GUIDELINE_TOKENS = Object.keys(ALLOWED_GUIDELINE_CITATIONS)
  .sort((a, b) => b.length - a.length);
const CITATION_LOCK_ENFORCE = true; // set false for warn-only during initial rollout

// Unseeded bodies (no canonical single "correct year"): flag for vetting, never reject.
// Promote any of these into ALLOWED_GUIDELINE_CITATIONS to switch it to hard enforcement.
const WARN_GUIDELINE_TOKENS = ["USPSTF", "ACG", "AASLD", "AGA", "ASH", "IDSA", "SSC", "ASPEN", "ATTD", "ASAS"]
  .sort((a, b) => b.length - a.length);

const dropTally = { _genFailed: 0, _warnUnseeded: 0, _warnInterchange: 0, _warnCardiorenal: 0, _cardiorenalRejected: 0, _warnT1DCardiorenal: 0, _warnSemanticDup: 0, _warnTopicMismatch: 0, _topicMismatchRejected: 0, _conceptSaturated: 0, _warnMetforminEgfr: 0, _warnSlidingScale: 0, _warnGdmCoherence: 0, _warnCrossRunDup: 0, _warnVerifyMiskey: 0 };
function recordDrop(reason) { dropTally[reason] = (dropTally[reason] || 0) + 1; return null; }

// --- Topic-consistency guard (B2): catch mis-topiced stems (male in gestational item, etc.) ---
function flagTopicMismatch(p) {
  const topic = String((p && p.topic) || "").toLowerCase();
  const stem  = String((p && p.stem)  || "");
  const maleOpener   = /\b(?:a|an)\s+\d{1,3}[\s-]*year[\s-]*old\s+(?:man|male|gentleman|boy)\b/i.test(stem);
  const femaleOpener = /\b(?:a|an)\s+\d{1,3}[\s-]*year[\s-]*old\s+(?:woman|female|lady|girl)\b/i.test(stem);
  const pregMarker   = /(gestation|pregnan|trimester|prenatal|antenatal|intrapartum|postpartum|gravida|g\dp\d|fetal|fetus|labou?r and delivery|cervical ripening|preeclampsia|eclampsia|placenta|amnio)/i.test(stem);
  const obgynTopic   = /(obstetric|gynecolog|gestational)/.test(topic);
  // HARD: an obstetric/gestational/ob-gyn item with a male patient is never valid.
  if (obgynTopic && maleOpener && !femaleOpener) {
    return { hardReject: true, reason: 'topic-mismatch(HARD): male patient in obstetric/gestational topic "' + p.topic + '"' };
  }
  // HARD: a "gestational" item must contain pregnancy context.
  if (/gestational/.test(topic) && !pregMarker) {
    return { hardReject: true, reason: 'topic-mismatch(HARD): gestational topic "' + p.topic + '" with no pregnancy context' };
  }
  // WARN: pediatric/congenital topic with an adult patient and no peri-natal/congenital framing.
  if (/(pediatric|congenital)/.test(topic)) {
    const m = stem.match(/\b(\d{1,3})[\s-]*year[\s-]*old\b/);
    const age = m ? parseInt(m[1], 10) : null;
    const ctx = /(neonat|congenital|fetal|fetus|prenatal|gestation|pregnan|newborn|infant|adolescen|\bchild\b)/i.test(stem);
    if (age !== null && age >= 18 && !ctx) {
      return { warn: true, reason: 'topic-mismatch(warn): pediatric/congenital topic "' + p.topic + '" with adult patient (age ' + age + ')' };
    }
  }
  return {};
}


function checkUnseededCitations(p) {
  if (!p || !p.explanation) return [];
  const text = String(p.explanation);
  const notices = [];
  for (const token of WARN_GUIDELINE_TOKENS) {
    if (ALLOWED_GUIDELINE_CITATIONS[token]) continue; // promoted -> hard path owns it
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenRe = new RegExp("\\b" + esc + "\\b", "gi");
    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      const start = Math.max(0, m.index - 25);
      const window = text.slice(start, m.index + token.length + 25);
      const yearMatch = window.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        const msg = `[citation-warn] Unseeded body "${token} ${yearMatch[0]}" \u2014 verify edition during vetting.`;
        console.warn(msg);
        notices.push(msg);
        dropTally._warnUnseeded++;
      }
    }
  }
  return notices;
}

function validateCitationYears(p) {
  if (!p || !p.explanation) return true;
  const text = String(p.explanation);
  for (const token of GUIDELINE_TOKENS) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenRe = new RegExp("\\b" + esc + "\\b", "gi");
    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      const start = Math.max(0, m.index - 25);
      const window = text.slice(start, m.index + token.length + 25);
      const yearMatch = window.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && !ALLOWED_GUIDELINE_CITATIONS[token].has(yearMatch[0])) {
        console.warn(`[validateCitationYears] Disallowed citation "${token} ${yearMatch[0]}" (allowed: ${[...ALLOWED_GUIDELINE_CITATIONS[token]].join(", ")}).`);
        if (CITATION_LOCK_ENFORCE) return false;
      }
    }
  }
  return true;
}

// ============================================================
// PHANTOM-CITATION HARD BLOCK (added 2026-06-02)
// ============================================================
// validateCitationYears() checks (society, year) only. It cannot catch a
// citation whose year is individually valid for the society but whose
// (society, year, TOPIC) tuple is fabricated or superseded -- e.g. a real ES
// year (2016/2024) attached to a guideline that does not exist for that topic.
// Curated, extensible block-list for the demonstrated phantoms.
// Confirmed 2026-06-02: ES Primary Aldosteronism CPG is 2025 (Adler et al.);
// the 2016 (Funder) edition is superseded and "ES 2024 PA"/"Funder 2024" never
// existed; no 2024 ES pheochromocytoma/paraganglioma CPG exists (real: Lenders
// 2014). Bornstein 2016 (Primary Adrenal Insufficiency) is current and is
// intentionally NOT matched here.
const BANNED_CITATION_PATTERNS = [
  { re: /Endocrine Society[^.]{0,60}(?:Primary Aldosteronism|aldosteronism)[^.]{0,25}\b20(?:0\d|1\d|2[0-4])\b/i,
    why: "ES Primary Aldosteronism CPG is 2025 (Adler); 2016 superseded, 2024 never existed" },
  { re: /\b20(?:0\d|1\d|2[0-4])\b[^.]{0,45}Endocrine Society[^.]{0,45}(?:Primary Aldosteronism|aldosteronism)/i,
    why: "ES Primary Aldosteronism CPG is 2025 (Adler); 2016 superseded, 2024 never existed" },
  { re: /Funder[^.]{0,45}\b2024\b/i,
    why: "No 2024 Funder PA guideline (Funder chaired 2016; 2025 lead is Adler)" },
  { re: /Endocrine Society[^.]{0,60}(?:pheochromocytoma|paraganglioma|SDHx|SDHB|MIBG)[^.]{0,25}\b2024\b/i,
    why: "No 2024 ES pheochromocytoma/paraganglioma CPG (real: Lenders 2014)" },
  { re: /\b2024\b[^.]{0,60}Endocrine Society[^.]{0,60}(?:pheochromocytoma|paraganglioma|SDHx|SDHB|MIBG)/i,
    why: "No 2024 ES pheochromocytoma/paraganglioma CPG (real: Lenders 2014)" }
];

// ── Interchangeable-agent soft-single-best flag (v7.5.14, warn-mode) ──
// Surfaces (does not drop) "select the agent" sets offering >=2 members of one
// interchangeable drug class when the stem lacks the tie-breaking feature. Rule M.
const INTERCHANGEABLE_AGENT_CLASSES = [
  { cls: "SGLT2i", tieBreak: /e\.?gfr\D{0,10}2[0-4]\b/i, members: [
    { id: "dapagliflozin", pat: /dapagliflozin/ }, { id: "empagliflozin", pat: /empagliflozin/ },
    { id: "canagliflozin", pat: /canagliflozin/ }, { id: "ertugliflozin", pat: /ertugliflozin/ },
    { id: "bexagliflozin", pat: /bexagliflozin/ } ] },
  { cls: "basal insulin", tieBreak: null, members: [
    { id: "degludec", pat: /degludec/ }, { id: "glargine-u300", pat: /glargine\s*u-?\s*300/ },
    { id: "glargine-u100", pat: /glargine\s*u-?\s*100/ }, { id: "detemir", pat: /detemir/ } ] },
  { cls: "anabolic osteoporosis", tieBreak: /myocardial infarction|recent (mi|stroke)|\bstroke\b|cardiovascular (event|disease)|ascvd/i, members: [
    { id: "romosozumab", pat: /romosozumab/ }, { id: "teriparatide", pat: /teriparatide/ }, { id: "abaloparatide", pat: /abaloparatide/ } ] },
  { cls: "Cushing steroidogenesis inhibitor", tieBreak: /qtc|prolonged qt|hepatotox|transaminas|hepatic impair|liver (injury|disease)/i, members: [
    { id: "metyrapone", pat: /metyrapone/ }, { id: "osilodrostat", pat: /osilodrostat/ },
    { id: "ketoconazole", pat: /(?<!levo)ketoconazole/ }, { id: "levoketoconazole", pat: /levoketoconazole/ } ] },
  { cls: "GLP-1 / incretin", tieBreak: /albuminuria|uacr|albumin-to-creatinine|\bckd\b|chronic kidney disease|flow trial|\bascvd\b|atherosclerotic cardiovascular|established cardiovascular/i, members: [
    { id: "semaglutide", pat: /semaglutide/ }, { id: "dulaglutide", pat: /dulaglutide/ },
    { id: "liraglutide", pat: /liraglutide/ }, { id: "tirzepatide", pat: /tirzepatide/ }, { id: "exenatide", pat: /exenatide/ } ] },
];

// -- Cardiorenal SGLT2i-deprioritization mis-key flag (warn-mode, both paths; added 2026-06-06) --
// Non-blocking. H1: HFrEF stem keying a GLP-1 RA while an SGLT2i is offered. H2: explanation
// asserting SGLT2i cause/worsen hyperkalemia (they are potassium-neutral to K-lowering).
// Mirrors flagInterchangeableAgents. Backtest 2026-06-06: recall 3/3 (ec94b12a, c6714248,
// 12f5f085); approved-bank false positives 0 (H1) + 1 benign (H2). Keep warn-mode for >=2
// batches; promote to hard-reject only after multi-batch precision/recall data.
// ─── B4 SEMANTIC NEAR-DUP FINGERPRINT (intra-batch, warn-mode; bulk-only) ───────
// Validated 2026-06-07 vs the 2026-06-06 reject clusters (CKD/HFrEF, Wernicke,
// vitamin-D osteomalacia, sepsis/obstructive-pyelonephritis): token-containment
// >= 0.35 OR bigram-containment >= 0.30, scoped WITHIN exam_level (topic is
// model-mislabeled, so scoping on topic misses cross-topic dups). Pairwise
// precision 1.00 / recall 0.85; per-row cluster recall 18/18. Distinct concepts
// sharing a vignette frame (alcoholic ketoacidosis vs Wernicke) do NOT collide.
// Warn-only; never drops. NOT mirrored to generate-mcq.js (live path doesn't batch).
const B4_TOK_CONTAIN = 0.35;
const B4_BI_CONTAIN  = 0.30;
const _b4seen = new Map(); // exam_level -> [{tok:Set, bi:Set, head:string}]
const _B4_STOP = new Set(`a an the of to in on at by for with and or as is are was were be been being he she his her him they them their it its this that these those patient man woman boy girl male female year old years presents present presented presenting evaluated evaluation seen brought clinic outpatient inpatient emergency department ed icu hospital admitted admission visit follow followup routine scheduled history reports report notes noted notable past medical takes taking current medications medication regimen examination exam physical reveals reveal show shows showed studies study laboratory labs lab results result vital vitals signs sign which following best most appropriate next step management explains explain explanation responsible mechanism over several months weeks days due no not has have had does who whom what bp hr rr temperature blood pressure pulse respirations heart rate weight bmi serum repeat initial reference`.split(/\s+/));
function _b4OrderedTokens(stem) {
  let s = String(stem || "").toLowerCase().replace(/,/g, "");
  s = s.replace(/^\s*a\s+\d+-year-old\s+\w+/, " ");
  s = s.replace(/[^a-z0-9./%-]+/g, " ");
  const out = [];
  for (let w of s.split(/\s+/)) {
    w = w.replace(/^[.\-/]+|[.\-/]+$/g, "");
    if (!w || _B4_STOP.has(w)) continue;
    if (/^[a-z]+$/.test(w) && w.length <= 2) continue;
    out.push(w);
  }
  return out;
}
function _b4Fingerprint(stem) {
  const toks = _b4OrderedTokens(stem);
  const tok = new Set(toks);
  const bi = new Set();
  for (let i = 0; i < toks.length - 1; i++) bi.add(toks[i] + "\u0001" + toks[i + 1]);
  return { tok, bi, head: String(stem || "").slice(0, 80) };
}
function _b4Containment(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) inter++;
  return inter / small.size;
}
// Compares p vs prior ACCEPTED items of the same exam_level THIS BATCH, then records
// p's fingerprint for later comparisons. Returns {dup, score, against}.
function flagSemanticDup(p) {
  if (!p || !p.stem) return { dup: false };
  const lvl = String(p.exam_level || "");
  const fpNew = _b4Fingerprint(p.stem);
  const prior = _b4seen.get(lvl) || [];
  let best = 0, bestHead = null;
  for (const e of prior) {
    const tc = _b4Containment(fpNew.tok, e.tok);
    const bc = _b4Containment(fpNew.bi, e.bi);
    if (tc >= B4_TOK_CONTAIN || bc >= B4_BI_CONTAIN) {
      const sc = Math.max(tc, bc);
      if (sc > best) { best = sc; bestHead = e.head; }
    }
  }
  prior.push(fpNew);
  _b4seen.set(lvl, prior);
  return { dup: bestHead !== null, score: best, against: bestHead };
}

// --- PERMANENT-FIX GUARDS (concept-saturation dedup + clinical warns) ---
function _guardKeyText(p) {
  if (!p) return "";
  const co = (p.choices && typeof p.choices === "object" && !Array.isArray(p.choices)) ? p.choices : null;
  const ca = Array.isArray(p.choices) ? p.choices : (co ? Object.values(p.choices) : []);
  const kr = (p.correct_answer != null) ? p.correct_answer : (p.correct != null ? p.correct : null);
  if (kr == null) return "";
  if (co && co[kr] != null) return String(co[kr]);
  if (/^[A-E]$/i.test(String(kr))) { const i = String(kr).toUpperCase().charCodeAt(0) - 65; if (ca[i] != null) return String(ca[i]); }
  return String(kr);
}
const CONCEPT_KEY_CONTAIN = 0.40;
const _conceptSeen = new Map();
const _CKEY_STOP = new Set(`a an the of to in on at by for with and or as is are was due start started initiate initiated begin given give add added discontinue discontinued stop stopped reduce reduced continue continued perform refer transition switch most appropriate next step management this patient her his their now agent current regimen dose daily mg units per day specifically formulated that than then which best explain explains failure impaired reduced inadequate increased decreased he she they it`.split(/\s+/));
function _conceptKeyTokens(text) {
  const out = new Set();
  for (let w of String(text || "").toLowerCase().replace(/[^a-z0-9\u03b1-]+/g, " ").split(/\s+/)) {
    w = w.replace(/^-+|-+$/g, "");
    if (!w || _CKEY_STOP.has(w)) continue;
    if (/^[a-z]+$/.test(w) && w.length <= 2) continue;
    out.add(w);
  }
  return out;
}
function flagConceptSaturation(p) {
  if (!p || !p.stem) return false;
  const lvl = String(p.exam_level || "");
  const fp = _b4Fingerprint(p.stem);
  const keyTok = _conceptKeyTokens(_guardKeyText(p));
  const prior = _conceptSeen.get(lvl) || [];
  for (const e of prior) {
    const tc = _b4Containment(fp.tok, e.stemTok), bc = _b4Containment(fp.bi, e.stemBi);
    const stemSimilar = (tc >= B4_TOK_CONTAIN || bc >= B4_BI_CONTAIN);
    const keySim = Math.max(_b4Containment(keyTok, e.keyTok), _b4Containment(e.keyTok, keyTok));
    if (stemSimilar && keySim >= CONCEPT_KEY_CONTAIN) return true;
  }
  prior.push({ stemTok: fp.tok, stemBi: fp.bi, keyTok });
  _conceptSeen.set(lvl, prior);
  return false;
}
function flagMetforminEgfr(p) {
  if (!p) return [];
  const warns = [];
  const stem = String(p.stem || ""), expl = String(p.explanation || "");
  const m = expl.match(/eGFR\s*(?:of\s*)?(\d{2})[^.]{0,55}below the threshold of 30/i);
  if (m && parseInt(m[1], 10) >= 30) warns.push('explanation calls eGFR ' + m[1] + ' "below the threshold of 30" (false; metformin cutoff is <30; 30-45 = continue dose-reduced)');
  const stopMet = /(discontinu|stop)\w*[^.]{0,25}metformin|metformin[^.]{0,25}(discontinu|stop)/i.test(_guardKeyText(p));
  const eg = stem.match(/eGFR\s*(?:of\s*)?(\d{2})\b/i);
  if (stopMet && eg) { const v = parseInt(eg[1], 10); if (v >= 30 && v <= 45) warns.push('key discontinues metformin at eGFR ' + v + ' (30-45 = continue dose-reduced, not stop)'); }
  return warns;
}
function flagSlidingScaleInsulin(p) {
  if (!p) return [];
  if (/sliding[\s-]scale[^.]{0,40}insulin|insulin[^.]{0,40}sliding[\s-]scale/i.test(_guardKeyText(p))) {
    const frail = /\b(dementia|elderly|nursing facility|long-term care|memory care|frail|cognitive impairment)\b/i.test(String(p.stem || "")) ? " (heightened: frail/elderly/dementia)" : "";
    return ['keyed answer recommends sliding-scale insulin -- discouraged as monotherapy/transition' + frail];
  }
  return [];
}
function flagGdmCoherence(p) {
  if (!p || !/gestational diabetes/i.test(String(p.topic || ""))) return [];
  const stem = String(p.stem || "");
  if (/\b\d{1,2}-year-old man\b/i.test(stem)) return ['"Gestational Diabetes" topic but index patient is male -- topic/content mismatch'];
  if (!/(pregnan|gestation|gravid|postpartum|prenatal|obstetric|trimester|breastfeed)/i.test(stem)) return ['"Gestational Diabetes" topic but no pregnancy/postpartum marker -- likely topic drift'];
  return [];
}
// Phase-2 (v7.7.0): cross-run concept-saturation — compare candidate vs the EXISTING
// bank (approved+pending), not just this batch. WARN-MODE, bulk-only; non-blocking
// until >=2 clean batches confirm true-positives, then promote to hard-reject.
const _conceptBank = new Map(); // exam_level -> [{stemTok, stemBi, keyTok, head}] from the live bank
function flagCrossRunSaturation(p) {
  if (!p || !p.stem) return [];
  const lvl = String(p.exam_level || "");
  const prior = _conceptBank.get(lvl);
  if (!prior || !prior.length) return [];
  const fp = _b4Fingerprint(p.stem);
  const keyTok = _conceptKeyTokens(_guardKeyText(p));
  for (const e of prior) {
    const tc = _b4Containment(fp.tok, e.stemTok), bc = _b4Containment(fp.bi, e.stemBi);
    const stemSimilar = (tc >= B4_TOK_CONTAIN || bc >= B4_BI_CONTAIN);
    const keySim = Math.max(_b4Containment(keyTok, e.keyTok), _b4Containment(e.keyTok, keyTok));
    if (stemSimilar && keySim >= CONCEPT_KEY_CONTAIN) {
      return ['stem+key match vs existing bank item (stemSim=' + Math.max(tc, bc).toFixed(2) + ', keySim=' + keySim.toFixed(2) + '): "' + String(e.head || '').slice(0, 70) + '"'];
    }
  }
  return [];
}
// --- END PERMANENT-FIX GUARDS ---

function flagT1DCardiorenal(p) {
  if (!p) return [];
  const warns = [];
  const stem = String(p.stem || "");
  const expl = String(p.explanation || "");
  const choicesObj = (p.choices && typeof p.choices === "object" && !Array.isArray(p.choices)) ? p.choices : null;
  const choicesArr = Array.isArray(p.choices) ? p.choices : (choicesObj ? Object.values(p.choices) : []);
  // Resolve the keyed answer's TEXT -- same convention as flagCardiorenalMiskey: prefer
  // p.correct_answer, fall back to p.correct (the letter A-E present at validation time).
  const keyRef = (p.correct_answer != null) ? p.correct_answer : (p.correct != null ? p.correct : null);
  let keyText = "";
  if (keyRef != null) {
    if (choicesObj && choicesObj[keyRef] != null) {
      keyText = String(choicesObj[keyRef]);
    } else if (/^[A-E]$/i.test(String(keyRef))) {
      const _i = String(keyRef).toUpperCase().charCodeAt(0) - 65;
      if (choicesArr[_i] != null) keyText = String(choicesArr[_i]);
    } else {
      keyText = String(keyRef);
    }
  }
  // Index patient must be Type 1 diabetic. Explicit T1D language, OR an islet autoantibody
  // stated POSITIVE (bare antibody names are excluded -- many T2D/MODY/MIDD work-ups cite them
  // as NEGATIVE to rule T1D out, which must not trip this gate).
  const t1d = /\btype[\s-]?1\s+diabet|\bT1DM?\b|insulin-dependent diabet|autoimmune diabet|(?:anti-?GAD(?:-?65)?|IA-?2|islet[\s-]?cell|ZnT8)[^.]{0,40}(?:positiv|elevat|detectab|\+)|(?:positiv|elevat|detectab)[^.]{0,40}(?:anti-?GAD|IA-?2|islet[\s-]?cell|ZnT8)/i.test(stem);
  if (!t1d) return warns;
  // Negation guard: a T2D/other stem that merely says "no history of type 1" must not fire.
  const t1dNegated = /\b(?:no (?:history of |known )?|not |denies |without |rather than |excludes? )type[\s-]?1/i.test(stem);
  if (t1dNegated) return warns;
  // Suppress when the item is testing the HAZARD of these agents in T1D (euglycemic DKA,
  // contraindication, discontinuation) rather than recommending them as therapy.
  const hazardFraming = /euglyc[a-z]*emic (?:dka|ketoacidosis)|diabetic ketoacidosis|\bketoacidosis\b|contraindicat|\bnot (?:indicated|approved|recommended)\b|should not (?:be )?(?:use|receive|start|prescrib)|discontinue|stop (?:the|her|his) /i.test(stem + " || " + expl);
  const FINERENONE = /finerenone/i;
  const SGLT2I = /empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|sotagliflozin|gliflozin|SGLT-?2/i;
  const GLP1 = /semaglutide|dulaglutide|liraglutide|exenatide|tirzepatide|GLP-?1/i;
  // H1: finerenone keyed in a T1D patient -- FIDELIO/FIGARO + KDIGO 2024 are T2D-specific.
  if (FINERENONE.test(keyText)) {
    warns.push("finerenone keyed in a Type 1 diabetes stem -- FIDELIO/FIGARO + KDIGO are T2D-specific; finerenone has no T1D indication/evidence. Verify key.");
  }
  // H2: SGLT2i keyed AS THERAPY in a T1D patient (not framed as the hazard) -- cardiorenal
  // trials excluded T1D; euglycemic-DKA risk + no approved T1D glycemic indication.
  if (SGLT2I.test(keyText) && !hazardFraming) {
    warns.push("SGLT2i keyed as therapy in a Type 1 diabetes stem -- cardiorenal trials (DAPA-HF/EMPEROR/DAPA-CKD/CREDENCE) enrolled T2D/non-diabetic, not T1D; euglycemic-DKA risk + no approved T1D glycemic indication. Verify key.");
  }
  // H3: GLP-1 RA keyed in a T1D patient (not the hazard) -- indicated in T2D/obesity, not T1D.
  if (GLP1.test(keyText) && !hazardFraming) {
    warns.push("GLP-1 RA keyed in a Type 1 diabetes stem -- GLP-1 RAs are indicated in T2D/obesity, not T1D glycemic management. Verify key.");
  }
  return warns;
}

function flagCardiorenalMiskey(p) {
  // Returns { hard: [...], warn: [...] }.
  // H1 (HARD): HFrEF stem + an SGLT2i offered + a GLP-1 RA keyed for the HF indication.
  // H2 (WARN, v7.9.1 demoted from hard): SGLT2i<->hyperkalemia proximity. The bare
  //   proximity regex CANNOT separate the error ("SGLT2i cause hyperkalemia") from the
  //   correct teaching ("SGLT2i do NOT raise K+", "SGLT2i mitigate MRA hyperkalemia",
  //   "hyperkalemia risk before establishing SGLT2i"), so as a hard-reject it silently
  //   killed correct items. Now warn-only, and suppressed when the matched window
  //   carries a negation / contrast / MRA-attribution token.
  if (!p) return { hard: [], warn: [] };
  const hard = [];
  const warn = [];
  const stem = String(p.stem || "");
  const expl = String(p.explanation || "");
  const choicesObj = (p.choices && typeof p.choices === "object" && !Array.isArray(p.choices)) ? p.choices : null;
  const choicesArr = Array.isArray(p.choices) ? p.choices : (choicesObj ? Object.values(p.choices) : []);
  const choicesText = choicesArr.join(" | ");
  const keyRef = (p.correct_answer != null) ? p.correct_answer : (p.correct != null ? p.correct : null);
  let keyText = "";
  if (keyRef != null) {
    if (choicesObj && choicesObj[keyRef] != null) {
      keyText = String(choicesObj[keyRef]);
    } else if (/^[A-E]$/i.test(String(keyRef))) {
      const _i = String(keyRef).toUpperCase().charCodeAt(0) - 65;
      if (choicesArr[_i] != null) keyText = String(choicesArr[_i]);
    } else {
      keyText = String(keyRef);
    }
  }
  const hfref = /HFrEF|reduced ejection fraction|EF \b[1-3]\d\b|NYHA class (III|IV)/i.test(stem);
  const SGLT2I = /empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|SGLT2/i;
  const GLP1 = /semaglutide|dulaglutide|liraglutide|exenatide|tirzepatide|GLP-1/i;
  const weightGlycemicFocus = /\b(weight loss|weight reduction|lose weight|most weight|greatest weight|glycemic control|glucose-lowering|glucose lowering|hemoglobin a1c|hba1c|a1c reduction|greatest a1c|lower(?:ing)? (?:the )?a1c)\b/i.test(stem);
  if (hfref && SGLT2I.test(choicesText) && GLP1.test(keyText) && !weightGlycemicFocus) {
    hard.push("possible SGLT2i-deprioritization mis-key in HFrEF -- SGLT2i is Class I (EMPEROR-Reduced/DAPA-HF); verify key.");
  }
  const _h2 = expl.match(/SGLT2[^.]{0,60}hyperkalem|hyperkalem[^.]{0,60}SGLT2/i);
  if (_h2 && !/not|without|neutral|lower|reduc|decreas|mitigat|attenuat|protect|unlike|whereas|in contrast|before|prior to|rather than|instead of|mra|mineralocorticoid|spironolactone|finerenone|eplerenone/i.test(_h2[0])) {
    warn.push("SGLT2i are K-neutral/lowering -- verify any hyperkalemia claim attributing risk to an SGLT2i.");
  }
  return { hard, warn };
}

function flagInterchangeableAgents(p) {
  if (!p || !p.choices) return [];
  const raw = Array.isArray(p.choices) ? p.choices
    : (typeof p.choices === "object" ? Object.values(p.choices) : []);
  const opts = raw.map(o => String(o == null ? "" : (typeof o === "object" ? (o.text || o.value || "") : o)).toLowerCase());
  const stem = String(p.stem || "").toLowerCase();
  const notices = [];
  for (const { cls, members, tieBreak } of INTERCHANGEABLE_AGENT_CLASSES) {
    const present = members.filter(m => opts.some(o => m.pat.test(o))).map(m => m.id);
    if (new Set(present).size < 2) continue;
    if (tieBreak && tieBreak.test(stem)) continue;
    let optsWithMember = 0;
    for (const o of opts) { if (members.some(m => m.pat.test(o))) optsWithMember++; }
    if (optsWithMember < 2) continue;
    notices.push(`[interchangeable] ${present.length} ${cls} agents in one set (${present.join(", ")}) with no tie-breaking stem feature \u2014 soft single-best (Rule M); confirm one dominant answer.`);
  }
  return notices;
}

function validateNoPhantomCitations(p) {
  if (!p || !p.explanation) return true;
  const text = String(p.explanation);
  for (const { re, why } of BANNED_CITATION_PATTERNS) {
    if (re.test(text)) {
      console.warn(`[validateNoPhantomCitations] Phantom/superseded citation blocked \u2014 ${why}.`);
      return false;
    }
  }
  return true;
}

function validateChoiceCompleteness(p) {
  if (!p || !p.choices || !p.stem || !p.explanation) return false;
  
  const letters = ["A", "B", "C", "D", "E"];
  for (const l of letters) {
    if (!p.choices[l] || p.choices[l].trim().length < 3) {
      console.warn(`[validateChoiceCompleteness] Missing or truncated choice: ${l}`);
      return false;
    }
  }
  
  if (!/\?[\s"']*$/.test(p.stem)) {
    console.warn("[validateChoiceCompleteness] Stem does not end with a question mark.");
    return false;
  }
  
  if (!p.explanation.includes("🩺") || !p.explanation.includes("🚫")) {
    console.warn("[validateChoiceCompleteness] Explanation missing 🩺 or 🚫 markers.");
    return false;
  }
  
  if (!letters.includes(p.correct)) {
    console.warn(`[validateChoiceCompleteness] Invalid correct answer letter: ${p.correct}`);
    return false;
  }
  
  return true;
}

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
        /\bsglt[\-\s]?2\b/i,
        /\b(empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|bexagliflozin)\b/i
      ],
      cuePatterns: [
        /\bno\b.{0,40}\b(bladder cancer|recurrent uti|fournier|euglycemic dka)\b/i,
        /\bdenies\b.{0,40}\b(bladder cancer|recurrent uti)\b/i,
        /\bnegative\s+(history\s+)?for\b.{0,40}\bbladder cancer\b/i
      ]
    },
    {
      label: "GLP-1 receptor agonist",
      drugPatterns: [
        /\bglp[\-\s]?1\b/i,
        /\b(liraglutide|semaglutide|dulaglutide|exenatide|tirzepatide|lixisenatide)\b/i
      ],
      cuePatterns: [
        /\bno\b.{0,40}\b(history of pancreatitis|pancreatitis|medullary thyroid|men\s*2|men2)\b/i,
        /\bdenies\b.{0,40}\b(pancreatitis|medullary thyroid)\b/i,
        /\bnegative\s+family\s+history\b.{0,40}\b(medullary thyroid|men\s*2)\b/i
      ]
    },
    {
      label: "Metformin",
      drugPatterns: [/\bmetformin\b/i, /\bglucophage\b/i],
      cuePatterns: [
        /\begfr\b.{0,30}\b(>|>=|greater than)\s*30\b/i,
        /\bno\b.{0,30}\b(iv contrast|lactic acidosis|severe (renal|hepatic))\b/i
      ]
    },
    {
      label: "Thiazolidinedione (pioglitazone)",
      drugPatterns: [/\bpioglitazone\b/i, /\brosiglitazone\b/i, /\bthiazolidinedione\b/i, /\btzd\b/i],
      cuePatterns: [
        /\bno\b.{0,40}\b(heart failure|peripheral edema|history of bladder cancer|history of fracture)\b/i,
        /\bnyha\b.{0,10}\bclass\s*i\b/i
      ]
    },
    {
      label: "Sulfonylurea",
      drugPatterns: [/\bsulfonylurea\b/i, /\b(glipizide|glyburide|glimepiride|gliclazide)\b/i],
      cuePatterns: [
        /\bregular meal pattern\b/i,
        /\bno\b.{0,30}\bskipped meals\b/i,
        /\breliable meal schedule\b/i
      ]
    },
    {
      label: "Insulin",
      drugPatterns: [/\b(insulin glargine|insulin detemir|insulin degludec|basal insulin|nph|regular insulin|lispro|aspart|glulisine)\b/i],
      cuePatterns: [
        /\breliable.{0,30}(self.?care|injection|adherence)\b/i,
        /\bable to\b.{0,20}\b(self.?monitor|inject|adhere)\b/i,
        /\bgood understanding\b.{0,30}\binjection\b/i
      ]
    },
    {
      label: "Sacubitril/Valsartan or ACE-I/ARB",
      drugPatterns: [
        /\b(sacubitril|valsartan|entresto|lisinopril|enalapril|ramipril|losartan|olmesartan|candesartan)\b/i,
        /\b(ace\s*inhibitor|arni|arb)\b/i
      ],
      cuePatterns: [
        /\bno\b.{0,30}\b(angioedema|history of cough on ace)\b/i,
        /\b36.?hour\s+washout\b/i
      ]
    },
    {
      label: "Mineralocorticoid receptor antagonist",
      drugPatterns: [/\b(spironolactone|eplerenone|finerenone|mineralocorticoid receptor antagonist|mra)\b/i],
      cuePatterns: [
        /\bpotassium\b.{0,20}\b(normal|3\.[5-9]|4\.\d)\b/i,
        /\bk\+?\b.{0,15}\b(3\.[5-9]|4\.\d)\b/i
      ]
    },
    {
      label: "Non-selective beta-blocker",
      drugPatterns: [/\b(propranolol|nadolol|carvedilol|labetalol|timolol)\b/i],
      cuePatterns: [/\bno\b.{0,30}\b(asthma|bronchospasm|reactive airway|copd exacerbation)\b/i]
    },
    {
      label: "Thiazide or loop diuretic",
      drugPatterns: [/\b(hydrochlorothiazide|hctz|chlorthalidone|indapamide|furosemide|bumetanide|torsemide|metolazone)\b/i],
      cuePatterns: [/\bno\b.{0,30}\b(history of gout|hyperuricemia)\b/i]
    },
    {
      label: "QT-prolonging agent",
      drugPatterns: [/\b(methadone|ondansetron|haloperidol|sotalol|dofetilide|amiodarone|citalopram|escitalopram|azithromycin|levofloxacin|moxifloxacin)\b/i],
      cuePatterns: [
        /\bqtc\b.{0,15}\b[34]\d{2}\s*ms\b/i,
        /\bno\b.{0,30}\b(qt prolongation|long qt|torsades)\b/i
      ]
    },
    {
      label: "DPP-4 inhibitor",
      drugPatterns: [/\b(sitagliptin|saxagliptin|linagliptin|alogliptin|vildagliptin)\b/i, /\bdpp.?4\b/i],
      cuePatterns: [/\bno\b.{0,30}\b(history of pancreatitis|heart failure)\b/i]
    },
    {
      label: "Bisphosphonate",
      drugPatterns: [/\b(alendronate|risedronate|ibandronate|zoledronic acid|pamidronate)\b/i, /\bbisphosphonate\b/i],
      cuePatterns: [
        /\bno\b.{0,30}\b(esophageal|gastroesophageal|gerd|dental work|jaw)\b/i,
        /\begfr\b.{0,30}\b(>|>=|greater than)\s*35\b/i
      ]
    },
    {
      label: "Denosumab",
      drugPatterns: [/\bdenosumab\b/i, /\bprolia\b/i, /\bxgeva\b/i],
      cuePatterns: [
        /\bcalcium\b.{0,20}\b(normal|9\.\d|10\.\d)\b/i,
        /\bno\b.{0,30}\bhypocalcemia\b/i
      ]
    },
    {
      label: "Levothyroxine dose adjustment",
      drugPatterns: [/\b(increase|decrease|adjust).{0,20}levothyroxine\b/i, /\blevothyroxine\s+dose\b/i],
      cuePatterns: [
        /\bgood adherence\b/i,
        /\btakes (it|levothyroxine) on an empty stomach\b/i,
        /\bno (calcium|iron|ppi|coffee).{0,20}(within|near|around).{0,10}(dose|administration)\b/i
      ]
    }
  ];

  for (const pair of CUEING_PAIRS) {
    const correctMatches = pair.drugPatterns.some(pat => pat.test(correctText));
    if (!correctMatches) continue;
    for (const cuePat of pair.cuePatterns) {
      if (cuePat.test(stemLower)) {
        console.warn(`[detectAntiCueingViolation] CUEING — stem telegraphs "${pair.label}".`);
        return true;
      }
    }
  }
  return false;
}


function rewriteExplanationLetters(explanation, letterMap) {
  if (!explanation || typeof explanation !== "string") return explanation;
  let out = explanation;
  const placeholders = {};
  Object.keys(letterMap).forEach((oldLetter, idx) => {
    const placeholder = `§§LETTER_${idx}§§`;
    placeholders[placeholder] = letterMap[oldLetter];
    const patterns = [
      { re: new RegExp(`(\\bChoice\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\bOption\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\banswer\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`\\(${oldLetter}\\)`, "g"),              wrap: 2 },
      { re: new RegExp(`(•\\s*)${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 },
      { re: new RegExp(`(^|\\n)\\s*${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 }
    ];
    patterns.forEach(({ re, wrap }) => {
      if (wrap === 1) out = out.replace(re, `$1${placeholder}`);
      else if (wrap === 2) out = out.replace(re, `(${placeholder})`);
      else if (wrap === 3) out = out.replace(re, (match, p1, p2) => `${p1}${placeholder}${p2}`);
    });
  });
  Object.keys(placeholders).forEach(p => { out = out.split(p).join(placeholders[p]); });
  return out;
}

// ─── MCQ TOOL SCHEMA ──────────────────────────────────────────────────────────
const MCQ_TOOL = {
  name: "emit_mcq",
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation. Conforms to ABIM Question Writing Guidelines and USMLE/NBME Item-Writing Guide canon.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: { type: "string" },
      stem:              { type: "string" },
      choices: {
        type: "object",
        properties: { A: { type: "string", minLength: 3 }, B: { type: "string", minLength: 3 }, C: { type: "string", minLength: 3 }, D: { type: "string", minLength: 3 }, E: { type: "string", minLength: 3 } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct:      { type: "string", enum: ["A","B","C","D","E"] },
      explanation:  { type: "string" },
      lead_in_type: {
        type: "string",
        enum: [
          "most_likely_diagnosis",
          "diagnostic_inference_atypical_presentation",
          "clinical_features_of_named_disease",
          "next_step_in_diagnostic_workup",
          "most_accurate_diagnostic_test",
          "underlying_mechanism_or_pathophysiology",
          "mechanism_of_action_or_toxicity",
          "most_appropriate_pharmacotherapy",
          "most_appropriate_clinical_intervention",
          "next_step_in_management",
          "mixed_management_with_comorbidity",
          "disposition_or_transition_of_care",
          "risk_of_future_adverse_event_or_complication",
          "strongest_risk_factor",
          "preventive_recommendation",
          "informed_consent_or_ethical_decision",
          "interpretation_of_data_or_literature"
        ],
        description: "REQUIRED. Identifies the lead-in task type per ABIM Question Writing Guidelines Section C.1. Per-level allow-lists enforced post-emit; selecting a type outside the level's allowed set will cause rejection."
      }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation", "lead_in_type"]
  }
};

// ─── PROMPT BUILDER (v7.5.3) ─────────────────────────────────────────────────
function buildPrompt(level, topic) {
  let promptTopic = topic;
  let isNutrition = false;

  // v7.5.3 Logic Fix: Dynamic routing ensures no hallucination if passed "--topic Random"
  if (topic.includes("Random")) {
    const dist = TOPIC_DISTRIBUTION[level] || TOPIC_DISTRIBUTION["ABIM Internal Medicine"];
    const mappedBlueprint = dist.map(t => ({ s: t.topic, w: t.weight }));
    promptTopic = pickWeighted(mappedBlueprint);
  } else {
    isNutrition = NUTRITION_BY_LEVEL[level]?.includes(topic) ?? false;
  }

  const isABIM_Endo = level === "ABIM Endocrinology";
  const isStep3     = level === "USMLE Step 3";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  const isStep1     = level === "USMLE Step 1";
  const isStep2CK   = level === "USMLE Step 2 CK";  // v7.5.6

  const maxTokens   = isABIM_Endo ? 3200
                    : (isABIM_IM || isStep3) ? 2800
                    : isStep2CK ? 2600
                    : 2200;
  let qTypePool = [];
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA") || promptTopic.includes("end-of-life") || promptTopic.includes("consent")) {
    qTypePool = [{s:"most appropriate NEXT STEP IN PATIENT COUNSELING",w:40}, {s:"LEGAL OR ETHICAL REQUIREMENT",w:40}];
  } else if (isStep1) {
    qTypePool = [{s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY",w:40}, {s:"MECHANISM OF ACTION OR TOXICITY",w:30}];
    } else if (isStep2CK) {
    // v7.5.6 — Weights derived from USMLE Step 2 CK Physician Tasks/Competencies blueprint.
    qTypePool = [
      {s:"MOST LIKELY DIAGNOSIS (Patient Care: Diagnosis — 16-20% of CK)", w:18},
      {s:"MOST ACCURATE DIAGNOSTIC TEST or laboratory study with highest sensitivity/specificity (Patient Care: Lab/Diagnostic Studies — 13-17%)", w:15},
      {s:"NEXT STEP IN MANAGEMENT after initial workup (Patient Care: Mixed Management — 12-16%)", w:14},
      {s:"MOST APPROPRIATE PHARMACOTHERAPY given patient factors (Patient Care: Pharmacotherapy — 8-12%)", w:12},
      {s:"MOST APPROPRIATE PREVENTIVE RECOMMENDATION or screening (Patient Care: Health Maintenance — 5-10%)", w:8},
      {s:"RISK OF DEVELOPING WHICH ADVERSE EFFECT or future complication (Patient Care: Prognosis/Outcome — 5-9%)", w:8},
      {s:"MOST APPROPRIATE CLINICAL INTERVENTION or procedure (Patient Care: Clinical Interventions — 6-10%)", w:7},
      {s:"INFORMED CONSENT or ethical decision (Professionalism — 5-7%)", w:6},
      {s:"INTERPRETATION OF DATA from a study or graph (Practice-based Learning — 3-5%)", w:4},
      {s:"NEXT STEP IN DIAGNOSTIC WORKUP given an incomplete picture", w:8}
    ];
  } else if (isStep3) {
    // v7.9.0 — weights = USMLE Step 3 Physician Competency blueprint
    // (Patient Care 30 / Medical Knowledge 20 / Interpersonal & Communication 20 /
    //  Professionalism 15 / Practice-Based Learning 10 / Systems-Based Practice 5).
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT STEP IN MANAGEMENT given comorbidities or facility constraints (Patient Care)",w:18},
      {s:"MOST APPROPRIATE PHARMACOTHERAPY OR TREATMENT for the clinical scenario (Patient Care)",w:12},
      {s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY of the condition or therapy (Medical Knowledge)",w:20},
      {s:"MOST APPROPRIATE NEXT STEP IN PATIENT COUNSELING or shared decision-making (Interpersonal and Communication)",w:20},
      {s:"MOST APPROPRIATE INFORMED CONSENT, ethical, or legal decision (Professionalism)",w:15},
      {s:"INTERPRETATION OF STUDY DATA, a graph, or evidence to guide care (Practice-Based Learning)",w:10},
      {s:"MOST APPROPRIATE DISPOSITION, TRANSITION OF CARE, or systems and cost decision (Systems-Based Practice)",w:5}
    ];
  } else if (isABIM_IM) {
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT TREATMENT STEP given organ dysfunction, intolerance, or comorbidity conflict",w:40},
      {s:"MOST APPROPRIATE MANAGEMENT when first-line therapy has failed or is contraindicated",w:35},
      {s:"MOST APPROPRIATE DRUG CHOICE given specific comorbidity profile (CKD, HF, DM, prior ASCVD)",w:20},
      {s:"MOST APPROPRIATE NEXT STEP when risk stratification tools yield borderline or conflicting results",w:5}
    ];
  } else if (isABIM_Endo) {
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT STEP IN MANAGEMENT given an atypical or guideline-edge scenario",w:35},
      {s:"MOST APPROPRIATE PHARMACOLOGIC CHOICE based on cardiorenal or comorbidity profile",w:30},
      {s:"NEXT STEP IN DIAGNOSTIC WORKUP (e.g., dynamic testing, imaging, or genetic screening) to confirm a complex subtype",w:25},
      {s:"MOST APPROPRIATE MODIFICATION to current therapy given a new complication or side effect",w:10}
    ];
  } else {
    qTypePool = [{s:"NEXT STEP IN DIAGNOSIS",w:25}, {s:"MOST LIKELY DIAGNOSIS",w:25}, {s:"NEXT STEP IN MANAGEMENT",w:40}, {s:"STRONGEST RISK FACTOR",w:10}];
  }
  const promptQType = pickWeighted(qTypePool);
  const randomSex   = pickSexForTopic(promptTopic);

  const isUSMLE     = level.includes("USMLE");
  const systemRole  = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  const VIGNETTE_STYLE_GUIDE = isStep1 ? "" : `
STRICT VIGNETTE SYNTAX (NBME/ABIM STANDARD):
1. MAXIMUM 130 WORDS for the stem.
2. ZERO INTRODUCTORY FLUFF. Start immediately with age, sex, and chief complaint.
3. HIGH-DENSITY DATA. Combine vitals and physical exam into single sentences. 
4. DO NOT interpret labs. State the raw value.
5. CONCEALMENT RULE: NEVER name the primary diagnosis or underlying mechanism in the stem.`;

  let _lr;
  if (isStep1) {
    _lr = "USMLE STEP 1 RULES (M2 LEVEL — BASIC SCIENCE INTEGRATION):\n- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs.\n- Question type focus: mechanism of disease, pharmacology MOA, biochemistry pathways, genetics, microbiology, pathophysiology, histology, gross anatomy.\n- Acceptable lead-ins: 'most likely cause', 'best explanation for this finding', 'mechanism most likely responsible'.\n- AVOID management-style lead-ins — Step 1 tests UNDERSTANDING, not management decisions.\n- Distractors should target the most common student confusions (mechanistically adjacent enzymes/pathways/receptors).\n- Shorter stems acceptable (1–2 well-loaded sentences if the case turns on a single mechanism).";
  } else if (level === "USMLE Step 2 CK") {
    _lr = "USMLE STEP 2 CK RULES (M3/M4 LEVEL — CLINICAL REASONING):\n- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs/Imaging.\n- Question type focus: most likely diagnosis, best initial diagnostic test, best initial management, most likely cause of an acute clinical finding.\n- Test PATTERN RECOGNITION of common conditions over rare ones — bread-and-butter conditions on medicine, surgery, peds, OB/GYN, psych, family medicine rotations.\n- Distractors are competing diagnoses on the differential — wrong but plausible to a clerkship student.\n- Settings: outpatient clinic, ED, inpatient ward, urgent care.\n- Bayesian reasoning expected: prior probability + new test result → posterior decision.";
  } else if (isStep3) {
    _lr = "USMLE STEP 3 RULES (PGY-1 LEVEL — PRACTICE-READY PHYSICIAN):\n- Question type focus: management decisions, disposition (admit vs discharge, ICU vs floor), threshold decisions (treat vs observe), follow-up planning.\n- 'What is the most likely diagnosis?' is PERMITTED only at synthesis tier (~10-15% of pool); the majority of items must center on management decisions, disposition, or threshold judgments.\n- Distractors should reflect real management forks where a PGY-1 might choose wrong (premature discharge, unnecessary admission, wrong tier of antibiotic, wrong agent in a stepped protocol).\n- Multi-system, complex patients are expected; address polypharmacy, comorbidity interactions, code status, goals of care where appropriate.\n- Public-health, ethics, and biostatistics integration acceptable when clinically relevant.";
  } else if (isABIM_IM) {
    _lr = "ABIM INTERNAL MEDICINE RULES (BOARD-CERTIFYING INTERNIST LEVEL):\n- Question type focus: multi-system synthesis, complex comorbidities, drug-drug interactions, treatment failure or intolerance, borderline risk scores requiring judgment.\n- 'What is the most likely diagnosis?' is PERMITTED only at synthesis tier (~10-15% of pool); the majority of items require management-level lead-ins.\n- Distractors must be options a guideline-aware internist might actually choose; 'obviously wrong' distractors are unacceptable at this level.\n- Address: when to refer to subspecialty, when to initiate vs withhold treatment, how to adjust for comorbidities (CKD, HF, cirrhosis, frailty).";
  } else if (isABIM_Endo) {
    _lr = "ABIM ENDOCRINOLOGY RULES (SUBSPECIALIST LEVEL):\n- Question type focus: atypical presentations, guideline-edge cases, complex diagnostic workups (CRH stimulation, IPSS, octreotide/68Ga-DOTATATE scan, genetic panels), therapy modification.\n- 'What is the most likely diagnosis?' is PERMITTED only at synthesis tier (~10-15% of pool); the majority of items must test subspecialty management, complex diagnostic workup, or therapy modification.\n- Distractors must be options a subspecialty colleague might reasonably propose; items must discriminate between fellow-level and attending-level reasoning.\n- Address: dynamic testing protocols, surgical vs medical management, peri-procedural management (adrenalectomy, thyroidectomy), pregnancy considerations for endocrine disease.";
  } else {
    _lr = "BOARD-STYLE RULES: Generalist synthesis level.";
  }
  const levelRules = _lr;

  const integrityRules = `INTEGRITY RULES:
A. Evidence discipline: cite only data explicitly in stem.
B. "glucose" never "sugar".
C. VLDL/LDL: You MUST accurately distinguish between VLDL and LDL.
D. COMPETITIVE DISTRACTORS (TIER 3 REQUIREMENT): Every wrong choice MUST be a highly plausible action or mechanism for a related, competing diagnosis.
E. EXPLANATION FORMATTING (MANDATORY TO AVOID SHUFFLE BUGS):
   - In the 🩺 section, YOU ARE FORBIDDEN FROM NAMING THE LETTER OF THE CORRECT CHOICE.
   - In the 🚫 section, YOU MUST start each explanation EXACTLY with "Choice A:", "Choice B:", etc.
F. EXPLANATION-CHOICE CONSISTENCY: The explanation MUST strictly match the text of the corresponding choice.
G. STEM-EXPLANATION NUMERIC LOCK: Every lab value, vital sign, and numeric result cited in your explanation MUST be identical to the value stated in the stem. Re-read your stem before calling emit_mcq.
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

   Pertinent negatives exist to differentiate among DIAGNOSES on the differential, NOT to clear the path to the THERAPEUTIC answer.
I. ABIM CANON — DEMOGRAPHICS (Section B.1):
   - Stem MUST include gender, age, and site of care (clinic, ED, hospital, ICU, etc.) within the first 2 sentences.
   - Race, ethnicity, and occupation MUST NOT be mentioned unless the testing point cannot be answered correctly without that information. Default: omit.
   - Use quantitative descriptors (e.g., "55-year-old", "BMI 31"). FORBIDDEN: subjective adjectives "young", "middle-aged", "older", "elderly", "obese" as patient descriptors.
J. ABIM CANON — STEM PHRASING (Section B.3):
   - FORBIDDEN phrasing: "complains of" → use "reports" or "has". "denies" → use "has no" or "no history of".
   - FORBIDDEN in choices: vague qualifiers (often, usually, sometimes, rarely, commonly, frequently, generally) and absolutes (always, never).
K. ABIM CANON — LEAD-IN (Sections C.1, C.2):
   - Lead-in MUST be a single closed question ending in "?".
   - FORBIDDEN phrasings: "associated with", "NOT", "EXCEPT", "LEAST likely".
   - FORBIDDEN choices: "All of the above", "None of the above".
   - Set lead_in_type to the appropriate enum value matching the cognitive task.
L. STEM-EXPLANATION LAB-VALUE REPRODUCTION LOCK (v7.5.8): When the explanation restates any analyte, vital sign, or numeric result already given in the stem, reproduce the EXACT value and units from the stem verbatim. NEVER introduce a second, different number for the same analyte (e.g., a stem calcium of 10.1 mg/dL must not appear as 14.5 mg/dL in the explanation). If a genuinely new follow-up or derived value is needed, label it explicitly as a separate measurement; do not silently overwrite the stem value.
M. SINGLE-BEST-ANSWER DISCRIMINATOR (v7.5.8): Do NOT key an answer when another option is equally defensible under current guidelines (e.g., levothyroxine start-low-go-slow vs full-replacement dose in a healthy young adult; preeclampsia delivery timing within an acceptable window; coexisting post-stroke anticoagulation-timing frameworks). The stem MUST contain an explicit discriminator - a comorbidity, age or physiologic extreme, contraindication, or guideline-defined threshold - that makes exactly ONE option best, and the explanation must name that discriminator as the reason the runner-up is inferior. If no single best answer can be justified, fix the STEM (add the discriminator), not the key.
`;

  const guardrails = getTopicGuardrails(level, promptTopic);

  const explanationNote = `EXPLANATION FORMAT — use these exact headers:
🩺 Why this is the correct answer: [Explain clinical reasoning without naming the choice letter. Cite the most recent officially published guideline (do not fabricate dates if older)].
🚫 Why the other choices fail: [Explain the 4 INCORRECT choices only, starting exactly with "Choice X:". DO NOT include the correct choice in this section].
💎 Board Pearl: [one high-yield fact].`;

  const topicGuideline = getGuidelineContext(promptTopic, isNutrition);

  const systemText = `You are ${systemRole}. Output confident, accurate facts.
${levelRules}
${VIGNETTE_STYLE_GUIDE}
${integrityRules}

TOPIC-SPECIFIC HARD RULES (CLINICAL ACCURACY ANCHORS):
${guardrails.l1}

CLINICAL EVIDENCE STANDARD: You MUST base the diagnosis, management, and explanation citations strictly on: ${topicGuideline}. Do not use outdated criteria.
${explanationNote}
UNIVERSAL HARD RULES: HIT: argatroban hepatic, bivalirudin/fondaparinux renal; DKA/HHS: K+ >3.3 before insulin; thyroid storm: PTU before iodine.
RESPONSE FORMAT: You MUST respond by calling the emit_mcq tool exactly once.`;

  const step3TierPrompt = isStep3 ? `
USMLE STEP 3 TIER 3-5 REQUIREMENTS:
- Diagnosis-tier lead-ins ("Which of the following is the most likely diagnosis?") are permitted per ABIM/NBME canon ONLY if the case requires synthesis (atypical presentation, conflicting data, multi-system reasoning). They must be a small minority of items at this level.
- Default to management-tier lead-ins: next step in management, disposition, pharmacotherapy, intervention.
- Build in realistic constraint: facility without cath lab, transfer time >120 min, or failed first-line therapy.
- Distractors must include the Tier 1/2 answer (what an MS3 would choose).` : "";

  const abimIMTierPrompt = isABIM_IM ? `
ABIM INTERNAL MEDICINE TIER 3-4 REQUIREMENTS:
- Diagnosis-tier lead-ins permitted per ABIM Question Writing Guidelines C.1(a) ONLY when the case requires synthesis (borderline data, atypical presentation, multi-comorbidity reasoning). Cap diagnosis-tier items at ≤15% of pool.
- Default to management-tier lead-ins: next step in management, pharmacotherapy choice given comorbidities, diagnostic test selection.
- Present synthesis scenario: borderline risk scores, treatment failure, intolerance, multi-comorbidity drug selection.
- Distractors must include the Tier 1 answer (what an MS4 would choose).` : "";

  const endoTier3Prompt = isABIM_Endo ? `
ABIM ENDOCRINOLOGY TIER 3+ REQUIREMENTS:
- Diagnosis-tier lead-ins permitted per ABIM Question Writing Guidelines C.1(a) ONLY when the case is atypical, complex, or guideline-edge (e.g., distinguishing factitious from endogenous hyperinsulinism). Cap diagnosis-tier items at ≤10% of pool.
- Default to subspecialty-tier lead-ins: next step in management, pharmacologic choice with cardiorenal profile, next step in diagnostic workup, therapy modification.
- Present an ATYPICAL, COMPLEX, or GUIDELINE-EDGE scenario.
- Distractors must include the "classic teaching" answer that a non-subspecialist would choose.` : "";

  const selfVerification = `
MANDATORY SELF-VERIFICATION — complete all 5 checks before calling emit_mcq:
1. SCENARIO PLAUSIBILITY: Is the patient age, sex, and diagnosis combination clinically realistic? (e.g., eGFR 28 in a 34yo requires explicit etiology)
2. CORRECT ANSWER DEFENSIBILITY: Does your correct answer remain correct against current guidelines if a subspecialist challenges it?
3. DISTRACTOR AUDIT: Would any distractor actually be chosen by a guideline-following clinician for THIS specific patient profile? If yes, reconsider — distractors must be wrong for a specific, statable reason.
4. NUMERIC CONSISTENCY: Do all lab values in the explanation EXACTLY match the stem?
5. CITATION ACCURACY: Did you cite a real trial with real data? Do not fabricate co-authoring organizations or joint guidelines.`;

  const userText = isStep1
  ? `Write 1 vignette on: ${promptTopic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}.
- Pertinent Negatives: Include a pertinent negative ONLY if it helps rule out a competing DIAGNOSIS on the differential. A pertinent negative MUST NOT clear a contraindication, side effect, or eligibility marker for the correct THERAPEUTIC choice (see Rule H — Anti-Cueing). Do NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, etc.) unless directly relevant to the diagnosis.
- The stem MUST end with the interrogative sentence.
${selfVerification}
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`
  : `Construct a Tier 3 Board-style puzzle on: ${promptTopic}.
- Lead-in asks for: ${promptQType}.
- Demographics & Setting: Patient is a ${randomSex}. Select a clinically appropriate age and care setting.
- Pertinent Negatives: Include 1-2 pertinent negatives ONLY if they help rule out a competing DIAGNOSIS on the differential. A pertinent negative MUST NOT clear a contraindication, side effect, or eligibility marker for the correct THERAPEUTIC choice (see Rule H — Anti-Cueing). DO NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, pelvic exam, etc.) unless the case turns on them.
- The stem MUST end with the interrogative sentence.

${guardrails.l2}

${step3TierPrompt}${abimIMTierPrompt}${endoTier3Prompt}
${selfVerification}
Execute the generation using the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

  return { systemText, userText, randomSex, maxTokens, resolvedTopic: promptTopic };
}

// ─── PROCESS RAW MCQ ─────────────────────────────────────────────────────────
function processRawMcq(p, level, topic, resolvedTopic, generationModel = "unknown") {
  if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) return recordDrop("malformed");
  if (!validateDemographics(p.stem, p._sex || "man", resolvedTopic)) return recordDrop("demographics");
  if (!validateConsistency(p)) return recordDrop("consistency");
  if (!validateChoiceCompleteness(p)) return recordDrop("choiceCompleteness");
  // v7.5.6 — ABIM/NBME canon enforcement (ordered by rejection-rate priors):
  if (!validateLeadInType(p, level)) return recordDrop("leadInType");
  if (!validateNegativeForm(p)) return recordDrop("negativeForm");
  if (!validateAssociatedWith(p)) return recordDrop("associatedWith");
  if (!validateVagueQualifiers(p)) return recordDrop("vagueQualifiers");
  if (!validateSubjectiveAdjectives(p)) return recordDrop("subjectiveAdjectives");
  if (!validatePejorativeLanguage(p)) return recordDrop("pejorativeLanguage");
  if (!validateNoAllOrNoneOfTheAbove(p)) return recordDrop("allOrNoneOfAbove");
  if (!validateSiteOfCare(p)) return recordDrop("siteOfCare");
  if (!validateCitationYears(p)) return recordDrop("citationYears");
  if (!validateNoPhantomCitations(p)) return recordDrop("phantomCitation");
  if (detectAntiCueingViolation(p)) return recordDrop("antiCueing");
  checkUnseededCitations(p); // PART 2: non-blocking warn on the accepted item, past all reject gates
  { const _ia = flagInterchangeableAgents(p); if (_ia.length) { _ia.forEach(n => console.warn(n)); dropTally._warnInterchange += _ia.length; } } // PART 2b: interchangeable-agent soft-single-best flag (v7.5.14)
  { const _sd = flagSemanticDup(p); if (_sd.dup) { console.warn(`⚠️  B4 semantic near-dup (sim=${_sd.score.toFixed(2)}) [${p.exam_level}] vs "${_sd.against}" :: "${String(p.stem||"").slice(0,80)}"`); dropTally._warnSemanticDup++; } } // PART 2c: intra-batch semantic near-dup flag (B4)
  { const _tm = flagTopicMismatch(p); if (_tm.hardReject) { console.warn('[REJECT] ' + _tm.reason + ' :: "' + String(p.stem||'').slice(0,80) + '"'); return recordDrop('_topicMismatchRejected'); } if (_tm.warn) { console.warn('[warn] ' + _tm.reason); dropTally._warnTopicMismatch++; } } // PART 2d: topic-consistency guard (B2)
  // SGLT2i-deprioritization cardiorenal mis-key (HARD-REJECT — promoted from warn; H1 key-resolution fixed + weight/glycemia tie-break)
  { const _crmk = flagCardiorenalMiskey(p); if (_crmk.hard.length) { console.warn('[REJECT] cardiorenal mis-key :: ' + _crmk.hard.join('; ') + ' :: "' + String(p.stem||'').slice(0,80) + '"'); return recordDrop('_cardiorenalRejected'); } if (_crmk.warn.length) { dropTally._warnCardiorenal += _crmk.warn.length; for (const _w of _crmk.warn) console.warn('[warn] cardiorenal:', _w); } }
  // T1D cardiorenal/pharmacotherapy mis-key (warn-mode) -- non-blocking; promote to hard-reject after >=2 clean batches
  { const _t1dcr = flagT1DCardiorenal(p); if (_t1dcr.length) { dropTally._warnT1DCardiorenal++; for (const _w of _t1dcr) console.warn('[warn] T1D cardiorenal mis-key:', _w); } }
  { const _ms = flagMetforminEgfr(p); if (_ms.length) { dropTally._warnMetforminEgfr++; for (const _w of _ms) console.warn('[warn] metformin-eGFR:', _w); } }
  { const _ss = flagSlidingScaleInsulin(p); if (_ss.length) { dropTally._warnSlidingScale++; for (const _w of _ss) console.warn('[warn] sliding-scale insulin:', _w); } }
  { const _gd = flagGdmCoherence(p); if (_gd.length) { dropTally._warnGdmCoherence++; for (const _w of _gd) console.warn('[warn] GDM topic-coherence:', _w); } }
  { if (flagConceptSaturation(p)) { console.warn('[REJECT] concept-saturation (<=1/concept) :: "' + String(p.stem||'').slice(0,80) + '"'); return recordDrop('_conceptSaturated'); } } // Layer 1: stem-AND-key dedup, <=1/concept
  { const _xr = flagCrossRunSaturation(p); if (_xr.length) { dropTally._warnCrossRunDup++; for (const _w of _xr) console.warn('[warn] cross-run concept-saturation:', _w); } } // Phase-2: vs existing bank (warn-mode, bulk-only)

  const letters      = ["A","B","C","D","E"];
  const correctIndex = letters.indexOf(p.correct);
  const optionsArray = letters
    .map((letter, i) => ({ originalLetter: letter, text: p.choices[letter], isCorrect: i === correctIndex }))
    .filter(opt => opt.text != null);

  for (let i = optionsArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
  }

  const shuffledChoices = {};
  const letterMap       = {};
  let newCorrectLetter  = "A";
  optionsArray.forEach((item, index) => {
    const newLetter = letters[index];
    shuffledChoices[newLetter] = item.text;
    letterMap[item.originalLetter] = newLetter;
    if (item.isCorrect) newCorrectLetter = newLetter;
  });

  return {
    topic:           resolvedTopic, // Ensuring the precise topic tag saves to DB
    stem:            p.stem,
    choices:         shuffledChoices,
    correct_answer:  newCorrectLetter,
    explanation:     rewriteExplanationLetters(p.explanation, letterMap),
    content_hash:    hashStem(p.stem),
    exam_level:      level,
    specialty_group: deriveSpecialtyGroup(level, resolvedTopic),
    blueprint_tag:   resolvedTopic,
    generation_model: generationModel,
  };
}

// ─── SUPABASE SAVER ───────────────────────────────────────────────────────────
async function saveToSupabase(records) {
  if (!records.length) return { saved: 0, errors: 0 };
  let saved = 0, errors = 0;
  const CHUNK = 10;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/mcqs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal,resolution=ignore-duplicates"
        },
        body: JSON.stringify(chunk)
      });
      if (!res.ok) errors += chunk.length;
      else saved += chunk.length;
    } catch (e) { errors += chunk.length; }
  }
  return { saved, errors };
}

// ─── BUILD WORK QUEUE ─────────────────────────────────────────────────────────
// ─── GENERATION CAP (B5): per-(exam_level, topic) saturation guard — bulk-only ──
// B4 dedupes only WITHIN a batch and cannot see duplication against the existing
// bank — the cross-batch saturation that drove the Step-3 spike (e.g. 6 generated
// into a topic already holding 4). This soft cap budgets each topic at
// max(0, ceiling - current servable+pending) and redistributes freed slots to
// eligible topics, preserving target count. Tunable via env:
//   GEN_CAP_CEILING  (default 8; <=0 disables the cap)
//   GEN_CAP_EXEMPT   (pipe-delimited topic names exempt from the cap; default the
//                     "Random -- All Specialties" catch-all bucket)
// Bulk-only — the single-question gen-mcq path is user-topic-driven (same scope
// exemption as B3/B4), so no parity mirror is required.
const GEN_CAP_CEILING = parseInt(process.env.GEN_CAP_CEILING || "8", 10);
const GEN_CAP_EXEMPT_TOPICS = new Set(
  (process.env.GEN_CAP_EXEMPT || "Random -- All Specialties")
    .split("|").map(s => s.trim()).filter(Boolean)
);
// v7.8.0 — blueprint-proportional cap + blueprint-weighted draw. Per-level target bank
// size sets each weighted topic's ceiling = round(weight / Sigma-weight * target); the draw
// is then deficit-weighted so generation converges to blueprint proportions and corrects
// existing skew. Restores the pre-B3 weighting the v7.5.9 uniform round-robin demoted.
// Set GEN_BANK_TARGET (applies to all levels) or edit BANK_TARGET_BY_LEVEL. A level with no
// positive target falls back to the flat GEN_CAP_CEILING with a blueprint-weighted draw.
const BANK_TARGET_BY_LEVEL = {
  "ABIM Endocrinology": 500,
  "ABIM Internal Medicine": 600,
  "USMLE Step 1": 400,
  "USMLE Step 2 CK": 400,
  "USMLE Step 3": 300,
};
const GEN_BANK_TARGET = parseInt(process.env.GEN_BANK_TARGET || "0", 10);
function bankTargetFor(level) {
  if (Number.isFinite(GEN_BANK_TARGET) && GEN_BANK_TARGET > 0) return GEN_BANK_TARGET;
  const t = BANK_TARGET_BY_LEVEL[level];
  return (Number.isFinite(t) && t > 0) ? t : 0;
}
const _bpWeightSum = {};
function _levelWeightSum(level) {
  if (_bpWeightSum[level] == null) {
    const ts = TOPIC_DISTRIBUTION[level] || [];
    _bpWeightSum[level] = ts.reduce((s, t) => s + Math.max(0, t.weight || 0), 0) || 0;
  }
  return _bpWeightSum[level];
}
function _topicCeiling(level, weight) {
  const target = bankTargetFor(level);
  if (target > 0 && weight > 0) {
    const sum = _levelWeightSum(level);
    if (sum > 0) return Math.max(1, Math.round((weight / sum) * target));
  }
  return GEN_CAP_CEILING;
}
let GEN_PROPORTIONAL_ACTIVE = false;
async function fetchTopicBudgets() {
  const budgets = new Map(); // "level\u0001topic" -> remaining slots; absent => uncapped
  if (!Number.isFinite(GEN_CAP_CEILING) || GEN_CAP_CEILING <= 0) {
    console.log("🚦  Generation cap disabled (GEN_CAP_CEILING <= 0).");
    return budgets;
  }
  let rows = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/mcqs?select=exam_level,topic&status=in.(approved,pending_review)&limit=20000`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) { console.warn(`[gen-cap] count fetch failed (HTTP ${res.status}) — cap disabled this run`); return budgets; }
    rows = await res.json();
  } catch (e) {
    console.warn(`[gen-cap] count fetch error (${e.message}) — cap disabled this run`);
    return budgets;
  }
  const counts = new Map();
  for (const r of rows) {
    const k = `${r.exam_level}\u0001${r.topic}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  // Register a budget for EVERY known topic. Weighted topics get a blueprint-proportional
  // ceiling (weight/Sigma-weight * target) when a per-level target is set; otherwise the flat
  // GEN_CAP_CEILING. Nutrition-only topics (no blueprint weight yet) keep the flat ceiling.
  const register = (level, topic, weight = 0) => {
    if (GEN_CAP_EXEMPT_TOPICS.has(topic)) return; // uncapped
    const k = `${level}\u0001${topic}`;
    if (budgets.has(k)) return;
    if (bankTargetFor(level) > 0 && weight > 0) GEN_PROPORTIONAL_ACTIVE = true;
    budgets.set(k, Math.max(0, _topicCeiling(level, weight) - (counts.get(k) || 0)));
  };
  for (const [level, topics] of Object.entries(TOPIC_DISTRIBUTION)) for (const t of topics) register(level, t.topic, Math.max(0, t.weight || 0));
  for (const [level, nlist]  of Object.entries(NUTRITION_BY_LEVEL))  for (const top of nlist) register(level, top);
  const atCap = [...budgets].filter(([, b]) => b === 0).map(([k]) => k.replace("\u0001", " / "));
  console.log(`🚦  Generation cap ${GEN_PROPORTIONAL_ACTIVE ? "ON (blueprint-proportional)" : `ON (flat ceiling ${GEN_CAP_CEILING})`}; ${atCap.length} topic(s) at/over cap → 0 new${atCap.length ? ": " + atCap.join("; ") : ""}.`);
  return budgets;
}

async function fetchConceptBank() {
  // Phase-2 bank prefetch (parallels fetchTopicBudgets): load existing approved+pending
  // stems/keys per exam_level so cross-run saturation can be detected. Fail-open: any
  // fetch error leaves _conceptBank empty -> flagCrossRunSaturation is a no-op.
  let rows = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/mcqs?select=exam_level,stem,choices,correct_answer&status=in.(approved,pending_review)&limit=20000`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) { console.warn(`[xrun] concept-bank fetch failed (HTTP ${res.status}) — cross-run check disabled this run`); return 0; }
    rows = await res.json();
  } catch (e) {
    console.warn(`[xrun] concept-bank fetch error (${e.message}) — cross-run check disabled this run`);
    return 0;
  }
  let n = 0;
  for (const r of rows) {
    if (!r || !r.stem) continue;
    const lvl = String(r.exam_level || "");
    const fp = _b4Fingerprint(r.stem);
    const keyTok = _conceptKeyTokens(_guardKeyText({ choices: r.choices, correct_answer: r.correct_answer }));
    const arr = _conceptBank.get(lvl) || [];
    arr.push({ stemTok: fp.tok, stemBi: fp.bi, keyTok, head: fp.head });
    _conceptBank.set(lvl, arr);
    n++;
  }
  console.log(`🔁  Cross-run concept-bank loaded: ${n} item(s) across ${_conceptBank.size} level(s) (warn-mode).`);
  return n;
}

function buildWorkQueue(count, budgets = new Map()) {
  const levels = FILTER_LEVEL ? [FILTER_LEVEL] : Object.keys(TOPIC_DISTRIBUTION);
  const queue  = [];

  if (FILTER_TOPIC && FILTER_LEVEL) {
    // Explicit single-topic run bypasses the generation cap by design.
    for (let i = 0; i < count; i++) queue.push({ level: FILTER_LEVEL, topic: FILTER_TOPIC });
    return queue;
  }

  const capKey = (lvl, top) => `${lvl}\u0001${top}`;
  const emitted = new Map();
  const budgetLeft = (lvl, top) => {
    const k = capKey(lvl, top);
    if (!budgets.has(k)) return Infinity;           // exempt / unknown -> uncapped
    return budgets.get(k) - (emitted.get(k) || 0);
  };
  const bump = (lvl, top) => { const k = capKey(lvl, top); emitted.set(k, (emitted.get(k) || 0) + 1); };

  const flat = [];
  for (const level of levels) {
    const topics = TOPIC_DISTRIBUTION[level] || [];
    for (const t of topics) flat.push({ level, topic: t.topic, w: Math.max(0, t.weight || 0) });
  }
  if (flat.length === 0) return queue;
  // v7.8.0 — blueprint-faithful draw. Each slot picks a concept weighted by its remaining
  // deficit when that level has a proportional cap (deficit = blueprint target - current),
  // else by its raw blueprint weight. A concept's probability falls as it is emitted (budget
  // shrinks), so it self-spreads (no intra-batch clustering -- the property the v7.5.9 uniform
  // round-robin protected) AND converges to blueprint proportions, correcting existing skew.
  for (let i = 0; i < count; i++) {
    const elig = []; let total = 0;
    for (const it of flat) {
      const bl = budgetLeft(it.level, it.topic);
      if (bl <= 0) continue;
      const lvlProp = bankTargetFor(it.level) > 0;
      const demand = (lvlProp && Number.isFinite(bl)) ? bl : it.w;
      if (demand <= 0) continue;
      elig.push({ it, demand }); total += demand;
    }
    if (!elig.length || total <= 0) break;
    let r = Math.random() * total, chosen = elig[elig.length - 1].it;
    for (const e of elig) { r -= e.demand; if (r < 0) { chosen = e.it; break; } }
    const nTopics = NUTRITION_BY_LEVEL[chosen.level];
    if (nTopics && Math.random() < NUTRITION_INJECTION_RATE) {
      const randomNutrition = nTopics[Math.floor(Math.random() * nTopics.length)];
      if (budgetLeft(chosen.level, randomNutrition) > 0) { queue.push({ level: chosen.level, topic: randomNutrition }); bump(chosen.level, randomNutrition); }
      else if (budgetLeft(chosen.level, chosen.topic) > 0) { queue.push({ level: chosen.level, topic: chosen.topic }); bump(chosen.level, chosen.topic); }
    } else {
      if (budgetLeft(chosen.level, chosen.topic) > 0) { queue.push({ level: chosen.level, topic: chosen.topic }); bump(chosen.level, chosen.topic); }
    }
  }
  return queue;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── BATCH MODE ───────────────────────────────────────────────────────────────
async function runBatchMode(queue) {
  console.log(`\n📦  Submitting ${queue.length} requests to Anthropic Batch API...`);
  const BATCH_LIMIT = 10000;
  const batches = [];
  for (let i = 0; i < queue.length; i += BATCH_LIMIT) batches.push(queue.slice(i, i + BATCH_LIMIT));

  const allRecords = [];

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(`\n  🔵  Batch ${bi + 1}/${batches.length} — ${batch.length} questions`);

    const requests = batch.map((item, idx) => {
      const pd = buildPrompt(item.level, item.topic);
      return {
        custom_id: `mbp-${Date.now()}-${bi}-${idx}`,
        params: {
          model: "claude-sonnet-4-6",
          max_tokens: pd.maxTokens,
          system: pd.systemText,
          tools: [MCQ_TOOL],
          tool_choice: { type: "tool", name: "emit_mcq" },
          messages: [{ role: "user", content: pd.userText + `\n\n[Seed: ${Date.now()}-${idx}]` }],
        },
        _meta: { level: item.level, topic: item.topic, resolvedTopic: pd.resolvedTopic, sex: pd.randomSex }
      };
    });

    const metaMap = {};
    const apiRequests = requests.map(r => {
      metaMap[r.custom_id] = r._meta;
      return { custom_id: r.custom_id, params: r.params };
    });

    let batchId;
    try {
      const submitRes = await fetch("https://api.anthropic.com/v1/messages/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "message-batches-2024-09-24"
        },
        body: JSON.stringify({ requests: apiRequests })
      });
      if (!submitRes.ok) throw new Error("Batch submit failed");
      const submitData = await submitRes.json();
      batchId = submitData.id;
      console.log(`  ✅  Batch submitted. ID: ${batchId}`);
    } catch (e) {
      console.log(`  ↩️  Falling back to standard concurrent mode for this batch...`);
      const fallbackRecords = await runStandardMode(batch, true);
      allRecords.push(...fallbackRecords);
      continue;
    }

    console.log(`  ⏳  Polling for completion...`);
    let batchStatus = "in_progress";
    while (batchStatus === "in_progress") {
      await sleep(30000);
      try {
        const pollRes  = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
          headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "message-batches-2024-09-24" }
        });
        const pollData = await pollRes.json();
        batchStatus    = pollData.processing_status;
      } catch (e) {}
    }
    console.log(`\n  ✅  Batch complete. Fetching results...`);

    const resultsRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/results`, {
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "message-batches-2024-09-24" }
    });
    const resultsText = await resultsRes.text();
    const lines       = resultsText.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.result?.type !== "succeeded") continue;
        const customId = result.custom_id;
        const meta     = metaMap[customId];
        if (!meta) continue;
        const toolBlock = result.result.message?.content?.find(b => b.type === "tool_use" && b.name === "emit_mcq");
        if (!toolBlock?.input) continue;
        const raw = { ...toolBlock.input, _sex: meta.sex };
        const processed = processRawMcq(raw, meta.level, meta.topic, meta.resolvedTopic, BULK_CLAUDE_MODEL);
        if (processed) allRecords.push(processed);
      } catch (e) {}
    }
  }
  return allRecords;
}

// ─── GEMINI FALLBACK (v7.5.5 P5) ─────────────────────────────────────────────
// Mirrors generate-mcq.js callGemini. Used only when 3 Claude attempts fail in
// runStandardMode. No-op if GEMINI_API_KEY is unset.
async function callGemini(systemText, userText, maxTokens) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set; cannot fall back to Gemini.");
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: MCQ_TOOL.input_schema,
          temperature: 0.6,
          maxOutputTokens: maxTokens
        }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response.");
  return { parsed: extractJSONSimple(text), model: "gemini-2.0-flash" };
}

function extractJSONSimple(raw) {
  if (!raw || typeof raw !== "string") throw new Error("extractJSONSimple received empty input.");
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found.");
  const candidate = match[0]
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(candidate); }
  catch (e) { throw new Error(`Gemini JSON malformed: ${e.message}`); }
}

// ─── STANDARD MODE ───────────────────────────────────────────────────────────
// ── INDEPENDENT VERIFY-PASS (Layer 4a self-consistency; bulk-only, warn-mode, opt-in) ──
// Blind second pass: re-answer the FINISHED item from stem + shuffled choices only (no
// key, no explanation); disagreement => possible mis-key warn. The only general guard
// against wrong-keyed items. Enable with VERIFY_PASS=1 (default OFF; ~doubles Claude
// calls). Bulk-only: the live path can't afford a second round-trip in Netlify's 26s.
const VERIFY_TOOL = {
  name: "emit_answer",
  description: "Emit the single best answer letter for the multiple-choice question.",
  input_schema: { type: "object", properties: { answer: { type: "string", enum: ["A","B","C","D","E"] } }, required: ["answer"] }
};
async function verifyKeyConsistency(record) {
  if (!record || !record.stem || !record.choices || !record.correct_answer) return null;
  const letters = ["A","B","C","D","E"];
  const lines = letters.filter(L => record.choices[L] != null).map(L => `${L}. ${record.choices[L]}`).join("\n");
  const sys = "You are an independent board examiner. Using current clinical practice guidelines, choose the single best answer to the multiple-choice question. Do not explain. Call emit_answer exactly once with only the letter.";
  const usr = `${record.stem}\n\n${lines}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: VERIFY_MODEL, max_tokens: 64, temperature: 0,
        tools: [VERIFY_TOOL], tool_choice: { type: "tool", name: "emit_answer" },
        system: sys, messages: [{ role: "user", content: usr }]
      })
    });
    if (!res.ok) return null;                          // fail-open: never block on verifier error
    const data = await res.json();
    const tb = data.content?.find(b => b.type === "tool_use" && b.name === "emit_answer");
    const ans = tb?.input?.answer;
    if (!ans || !/^[A-E]$/.test(ans)) return null;
    return { disagree: ans !== record.correct_answer, modelAnswer: ans, keyed: record.correct_answer };
  } catch (e) {
    return null;                                       // fail-open
  }
}

async function runStandardMode(queue, silent = false) {
  if (!silent) console.log(`\n⚡  Running ${queue.length} questions with concurrency=${CONCURRENCY}...`);
  const results = [];
  let done = 0;

  async function processItem(item) {
    const pd = buildPrompt(item.level, item.topic);
    const entropySeed = `${Date.now()}-${Math.random()}`;

    // v7.5.5 P1: 3-attempt Claude retry loop. Retries on network error OR
    // validator rejection (processRawMcq returning null).
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: pd.maxTokens,
            temperature: 0.6,
            system: pd.systemText,
            tools: [MCQ_TOOL],
            tool_choice: { type: "tool", name: "emit_mcq" },
            messages: [{ role: "user", content: pd.userText + `\n\n[Seed: ${entropySeed}-${attempt}]` }]
          })
        });
        if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
        if (!res.ok) { const eb = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status} — ${eb.slice(0, 200)}`); }
        const data      = await res.json();
        const toolBlock = data.content?.find(b => b.type === "tool_use" && b.name === "emit_mcq");
        if (!toolBlock?.input) throw new Error("No tool_use block");
        const raw       = { ...toolBlock.input, _sex: pd.randomSex };
        const processed = processRawMcq(raw, item.level, item.topic, pd.resolvedTopic, BULK_CLAUDE_MODEL);
        if (processed) {
          done++;
          if (!silent) process.stdout.write(`\r  ✅  ${done}/${queue.length} complete   `);
          return processed;
        }
        // Validator rejected — fall through to next attempt
        if (attempt < 2) await sleep(1500);
      } catch (e) {
        if (!silent) console.warn(`  ⚠️  [${item.level}/${item.topic}] claude attempt ${attempt + 1}: ${e.message}`);
        // Network / schema / tool_use error — fall through to next attempt
        if (attempt < 2) await sleep(2000);
      }
    }

    // v7.5.5 P5: Gemini 2.0 Flash fallback after 3 failed Claude attempts.
    if (GEMINI_API_KEY) {
      try {
        const fbResult  = await callGemini(pd.systemText, pd.userText, pd.maxTokens);
        const raw       = { ...fbResult.parsed, _sex: pd.randomSex };
        const processed = processRawMcq(raw, item.level, item.topic, pd.resolvedTopic, fbResult.model);
        if (processed) {
          done++;
          if (!silent) process.stdout.write(`\r  🔁  ${done}/${queue.length} complete (gemini)   `);
          return processed;
        }
      } catch (e2) {
        if (!silent) console.warn(`  ⚠️  [${item.level}/${item.topic}] gemini fallback: ${e2.message}`);
        // Both providers exhausted; the queued item is lost. Continue the run.
      }
    }

    done++;
    dropTally._genFailed++;
    return null;
  }
  
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const window  = queue.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(window.map(processItem));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    if (i + CONCURRENCY < queue.length) await sleep(2000);
  }

  if (VERIFY_PASS && results.length) {
    if (!silent) console.log(`\n\uD83D\uDD0E  Verify-pass (independent blind re-answer) on ${results.length} items...`);
    for (let i = 0; i < results.length; i += CONCURRENCY) {
      const win = results.slice(i, i + CONCURRENCY);
      const checks = await Promise.allSettled(win.map(r => verifyKeyConsistency(r)));
      checks.forEach((c, k) => {
        if (c.status === "fulfilled" && c.value && c.value.disagree) {
          dropTally._warnVerifyMiskey++;
          const r = win[k];
          console.warn(`[warn] verify-pass disagreement: keyed ${c.value.keyed}, independent answer ${c.value.modelAnswer} :: [${r.exam_level}] "${String(r.stem || "").slice(0, 80)}"`);
        }
      });
      if (i + CONCURRENCY < results.length) await sleep(1500);
    }
  }

  if (!silent) console.log("");
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║    MedBoard Pro — Bulk MCQ Generator (v7.9.0)    ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Mode:         ${MODE === "batch" ? "Anthropic Batch API (50% discount)" : "Standard Concurrent"}`);
  console.log(`  Target count: ${TARGET_COUNT}`);

  const _budgets = await fetchTopicBudgets();
  await fetchConceptBank(); // Phase-2: load existing-bank stems/keys for cross-run warn
  const queue   = buildWorkQueue(TARGET_COUNT, _budgets);
  const startMs = Date.now();

  let records;
  if (MODE === "batch") records = await runBatchMode(queue);
  else                  records = await runStandardMode(queue);

  const validRecords = records.filter(Boolean);
  console.log(`\n💾  Saving ${validRecords.length} valid questions to Supabase...`);

  const { saved, errors } = await saveToSupabase(validRecords);

  const elapsedSec = Math.round((Date.now() - startMs) / 1000);
  const mins       = Math.floor(elapsedSec / 60);
  const secs       = elapsedSec % 60;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                   SUMMARY                        ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Generated:   ${String(validRecords.length).padEnd(33)}║`);
  console.log(`║  Saved to DB: ${String(saved).padEnd(33)}║`);
  console.log(`║  DB errors:   ${String(errors).padEnd(33)}║`);
  const validatorDrops = Object.entries(dropTally).filter(([k]) => !k.startsWith("_")).sort((a,b) => b[1]-a[1]);
  const totalDropped = validatorDrops.reduce((s,[,n]) => s+n, 0);
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Validator drops: ${String(totalDropped).padEnd(29)}║`);
  for (const [reason, n] of validatorDrops) console.log(`║    • ${reason}: ${n}`);
  console.log(`║  Gen failures (both engines): ${String(dropTally._genFailed).padEnd(17)}║`);
  console.log(`║  Unseeded-citation warns: ${String(dropTally._warnUnseeded).padEnd(21)}║`);
  console.log(`║  Interchangeable-agent warns: ${String(dropTally._warnInterchange).padEnd(17)}║`);
  console.log(`║  Cardiorenal H2 warns: ${String(dropTally._warnCardiorenal).padEnd(24)}║`);
  console.log(`║  Semantic near-dup warns: ${String(dropTally._warnSemanticDup).padEnd(21)}║`);
  console.log(`║  Concept-saturation drops: ${String(dropTally._conceptSaturated).padEnd(20)}║`);
  console.log(`║  Metformin-eGFR warns: ${String(dropTally._warnMetforminEgfr).padEnd(24)}║`);
  console.log(`║  Sliding-scale warns: ${String(dropTally._warnSlidingScale).padEnd(25)}║`);
  console.log(`║  GDM-coherence warns: ${String(dropTally._warnGdmCoherence).padEnd(25)}║`);
  console.log(`║  Cross-run dedup warns: ${String(dropTally._warnCrossRunDup).padEnd(23)}║`);
  console.log(`║  Verify-pass disagreements: ${String(dropTally._warnVerifyMiskey).padEnd(19)}║`);
  console.log(`║  Time:        ${String(`${mins}m ${secs}s`).padEnd(33)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");
}

main().catch(e => {
  console.error("\n❌  Fatal error:", e.message);
  process.exit(1);
});
