// bulk-generate.js — MedBoard Pro
// v7.3 — Truncation Budget Increase & Stem-Explanation Hallucination Guard
// ---------------------------------------------------------------
// CHANGELOG (from v7.2):
// - FIX 1 (TRUNCATION BUDGET): Raised max_tokens across all levels.
//     ABIM Endocrinology: 1800 → 2400
//     ABIM Internal Medicine: 1700 → 2200
//     USMLE Step 3: 1700 → 2200
//     USMLE Step 1 / Step 2 CK: 1400 → 1800
// - FIX 2 (HALLUCINATION GUARD): Added validateConsistency(p).
//   Extracts lab/vital name-value pairs from both stem and explanation.
//   If the same lab appears in both with DIFFERENT values → skip/retry.
// - FIX 2b (PROMPT HARDENING): Added INTEGRITY RULE G to system prompt.
// - validateConsistency() wired into processRawMcq() alongside
//   validateDemographics(). Both must pass for a question to be accepted.
// - All other v7.2 logic preserved verbatim (Tier 3 prompts, shuffle,
//   demographic validator, B-hCG/PSA traps, guideline map, batch+standard
//   modes, topic distribution, etc.).
// ---------------------------------------------------------------
"use strict";
const crypto = require("crypto");

// ─── ENV ──────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

if (!ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY is required. Set it as an environment variable.");
  process.exit(1);
}

// ─── CLI ARGS ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}
const TARGET_COUNT  = parseInt(process.env.BULK_COUNT  || getArg("--count", "500"), 10);
const FILTER_LEVEL  = (process.env.BULK_LEVEL  || getArg("--level", "")).trim()  || null;
const FILTER_TOPIC  = (process.env.BULK_TOPIC  || getArg("--topic", "")).trim()  || null;
const MODE          = (process.env.BULK_MODE   || getArg("--mode", "batch")).trim();
const CONCURRENCY   = parseInt(process.env.BULK_CONCURRENCY || getArg("--concurrency", "6"), 10);

// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────
const VALID_LEVELS = ["ABIM Internal Medicine", "ABIM Endocrinology", "USMLE Step 1", "USMLE Step 2 CK", "USMLE Step 3"];

const GUIDELINE_MAP = [
  { keywords: ["diabetes", "hypoglycemia", "dka", "hhs", "insulin"], citation: "ADA Standards of Medical Care in Diabetes—2026" },
  { keywords: ["thyroid", "nodule", "graves", "hashimoto", "hypothyroid", "hyperthyroid", "tsh", "free t4", "levothyroxine", "methimazole", "propylthiouracil", "radioiodine", "thyroiditis", "thyrotoxicosis", "goiter", "trab", "tpo", "thyroglobulin", "tg"], citation: `2024-2026 Clinical Consensus (ATA/AACE/Endocrine Society). 
CRITICAL THYROID ANCHORS — ABIM ENDOCRINOLOGY (MANDATORY ACCURACY):
1. OVERT vs SUBCLINICAL HYPOTHYROIDISM: Overt = elevated TSH + LOW free T4. Subclinical = elevated TSH + NORMAL free T4. TSH >10 with NORMAL free T4 is still subclinical (grade 2).
2. TSH TARGET RANGES: General adult (non-pregnant): 0.4–4.0 mIU/L. Pregnancy: TSH target 0.1–2.5 mIU/L (first trimester). DO NOT use 0.5-2.5 for non-pregnant adults.
3. SUBCLINICAL HYPOTHYROIDISM TREATMENT: TSH >10: treat. TSH 4.5–10 + asymptomatic: observe. TSH 4.5–10 + pregnancy/trying to conceive: TREAT.
4. GRAVES DISEASE: Methimazole first-line for most adults. PTU preferred in first trimester of pregnancy and thyroid storm.
5. THYROID NODULE WORKUP: TSH first: if suppressed → radionuclide scan. Ultrasound: characterize all nodules; size + TIRADS guides FNA.
COGNITIVE LEVEL: FORBIDDEN: "Patient has TSH 9.8 + low T4 — start levothyroxine?" REQUIRED: "Patient on stable levo develops elevated TSH — what is the most likely cause?" (malabsorption, non-compliance).` },
  { keywords: ["lipid", "dyslipidemia", "cholesterol", "statin", "ascvd", "pcsk9", "ezetimibe", "triglyceride", "lpa", "lp(a)", "familial hypercholesterolemia", "bempedoic", "inclisiran", "fenofibrate"], citation: `2024 AHA Scientific Statement on PREVENT Calculator; 2022 ACC Expert Consensus on Non-Statin Therapies.
CRITICAL LIPID ANCHORS:
1. RISK CALCULATOR: Use the PREVENT calculator (race-neutral, includes kidney function). PCE (2013) is LEGACY.
2. NON-STATIN THERAPIES: Add ezetimibe first when LDL not at goal. Add PCSK9i when LDL still not at goal or statin-intolerant + high risk. Bempedoic acid is an option for statin-intolerant patients.
3. STATIN INTOLERANCE: True myopathy (CK >10x ULN) -> discontinue. Always rechallenge with alternate statin before declaring complete intolerance.` },
  { keywords: ["obesity", "bariatric", "metabolic syndrome", "GLP-1", "wegovy", "tirzepatide", "semaglutide obesity"], citation: "AHA/ACC 2023 Obesity Guideline; AACE 2023 Obesity Algorithm; ADA 2026 Standards of Care." },
  { keywords: ["pcos", "polycystic"], citation: "International Evidence-based PCOS Guideline 2023" },
  { keywords: ["cardio", "acs", "arrhythmia", "heart failure"], citation: "ACC/AHA 2025-2026 Guidelines" },
  { keywords: ["hypertension", "blood pressure"], citation: "ACC/AHA 2025 Hypertension Guidelines" },
  { keywords: ["nephro", "renal", "ckd"], citation: "KDIGO 2025 Guidelines" },
  { keywords: ["gastro", "hepat", "cirrhosis", "ibd", "crohn", "colitis", "ulcerative", "inflammatory bowel", "infliximab", "adalimumab", "vedolizumab", "ustekinumab", "risankizumab", "tofacitinib", "upadacitinib", "biologic", "anti-tnf", "fistula", "perianal", "colonoscopy", "budesonide", "mesalamine", "azathioprine", "methotrexate ibd"], citation: `ACG 2024 Crohn's Disease Guidelines; AGA 2021 Moderate-to-Severe Crohn's Guideline; AASLD 2025 Practice Guidance. Focus on Top-down therapy, therapeutic drug monitoring, and pre-biologic screening (TB/HBV mandatory). Methotrexate is contraindicated in pregnancy.` },
  { keywords: ["parathyroid", "calcium", "bone", "osteoporosis"], citation: "Endocrine Society 2022 Primary Hyperparathyroidism Guideline & AACE 2025 Osteoporosis Guideline" },
  { keywords: ["menopause", "hrt", "reproductive"], citation: "Endocrine Society Menopause Guidelines 2022 & NAMS 2025" },
  { keywords: ["pituitary", "hypothalamus", "acromegaly", "prolactin", "prolactinoma", "hypopituitarism", "craniopharyngioma", "avp", "diabetes insipidus", "siadh", "igf-1", "growth hormone", "gonadotropin"], citation: "Pituitary Society 2023 Consensus on Acromegaly, Hypopituitarism, and Pituitary Tumors; Endocrine Society 2025 CPGs. CRITICAL: copeptin >=6.4 pmol/L after hypertonic saline confirms AVP-R (NDI); GH nadir <1 ng/mL on OGTT diagnoses acromegaly." },
  { keywords: ["sepsis", "septic shock", "infectious", "antibiotic", "bacteremia", "pneumonia", "pyelonephritis", "meningitis", "endocarditis", "esbl", "carbapenem", "vasopressor", "norepinephrine", "vasopressin", "hydrocortisone", "source control", "lactate", "procalcitonin"], citation: `Surviving Sepsis Campaign (SSC) 2021/2025 Updates; IDSA 2024 Antibiotic Stewardship Guidelines. Focus: Norepinephrine is 1st line. Add vasopressin BEFORE dopamine. Steroids ONLY for refractory shock. Carbapenems for ESBL.` },
  { keywords: ["cushing", "adrenal", "aldosterone", "pheochromocytoma", "paraganglioma"], citation: "Endocrine Society 2024 CPG on Cushing Syndrome & Adrenal Incidentaloma. CRITICAL: 1mg DST is screening; ACTH <10 pg/mL = independent." }
];

const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const MALE_ONLY_TOPIC_KEYWORDS   = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
const FEMALE_ONLY_TOPIC_KEYWORDS = ["pcos", "polycystic ovary", "menopause", "ovarian", "endometri", "pregnancy", "obstetric", "gynecolog", "turner syndrome"];

// ─── TOPIC DISTRIBUTION MAP ───────────────────────────────────────────────────
const TOPIC_DISTRIBUTION = {
  "ABIM Endocrinology": [
    { topic: "Type 2 Diagnosis and Management",    weight: 8 },
    { topic: "Type 1 Insulin Therapy",             weight: 6 },
    { topic: "DKA and HHS",                        weight: 5 },
    { topic: "Hypoglycemia",                       weight: 5 },
    { topic: "GLP-1 Receptor Agonists",            weight: 5 },
    { topic: "SGLT2 Inhibitors",                   weight: 4 },
    { topic: "CGM and AID Systems",                weight: 3 },
    { topic: "Hypothyroidism and Hashimotos",      weight: 5 },
    { topic: "Hyperthyroidism and Graves",         weight: 5 },
    { topic: "Thyroid Nodule Evaluation",          weight: 4 },
    { topic: "Thyroid Cancer",                     weight: 3 },
    { topic: "Thyroid Storm",                      weight: 3 },
    { topic: "Cushing Syndrome",                   weight: 5 },
    { topic: "Primary Aldosteronism",              weight: 4 },
    { topic: "Pheochromocytoma",                   weight: 3 },
    { topic: "Adrenal Insufficiency",              weight: 4 },
    { topic: "Prolactinoma",                       weight: 4 },
    { topic: "Acromegaly",                         weight: 3 },
    { topic: "Hypopituitarism",                    weight: 3 },
    { topic: "Diabetes Insipidus",                 weight: 3 },
    { topic: "Hyperparathyroidism",                weight: 4 },
    { topic: "Hypercalcemia",                      weight: 3 },
    { topic: "Osteoporosis",                       weight: 4 },
    { topic: "PCOS",                               weight: 4 },
    { topic: "Male Hypogonadism",                  weight: 3 },
    { topic: "MEN1",                               weight: 2 },
    { topic: "MEN2A and MEN2B",                    weight: 2 },
    { topic: "Insulinoma",                         weight: 2 },
  ],
  "ABIM Internal Medicine": [
    { topic: "ACS STEMI NSTEMI",                   weight: 7 },
    { topic: "Heart Failure",                      weight: 6 },
    { topic: "Atrial Fibrillation",                weight: 6 },
    { topic: "Hypertension",                       weight: 5 },
    { topic: "Lipid Disorders",                    weight: 4 },
    { topic: "Asthma and COPD",                    weight: 5 },
    { topic: "Pneumonia",                          weight: 4 },
    { topic: "Pulmonary Embolism",                 weight: 5 },
    { topic: "Acute Kidney Injury",                weight: 5 },
    { topic: "CKD",                                weight: 4 },
    { topic: "Electrolyte Disorders",              weight: 5 },
    { topic: "Acid-Base Disorders",                weight: 4 },
    { topic: "IBD Crohns and UC",                  weight: 4 },
    { topic: "Cirrhosis",                          weight: 4 },
    { topic: "Sepsis and Septic Shock",            weight: 5 },
    { topic: "HIV",                                weight: 3 },
    { topic: "Anemia",                             weight: 4 },
    { topic: "DVT and Anticoagulation",            weight: 4 },
    { topic: "Rheumatoid Arthritis",               weight: 3 },
    { topic: "SLE",                                weight: 3 },
    { topic: "Type 2 Diagnosis and Management",    weight: 4 },
    { topic: "Hypothyroidism and Hashimotos",      weight: 3 },
    { topic: "Informed Consent",                   weight: 2 },
    { topic: "End-of-Life Care",                   weight: 2 },
  ],
  "USMLE Step 1": [
    { topic: "Systemic Pathology and Pathophysiology",              weight: 10 },
    { topic: "Pharmacology, Pharmacokinetics, and Adverse Effects", weight: 8 },
    { topic: "Physiology and Clinical Biochemistry",                weight: 8 },
    { topic: "Microbiology, Virology, and Immunology",              weight: 7 },
    { topic: "Anatomy, Neuroanatomy, and Embryology",               weight: 4 },
    { topic: "Behavioral Science, Medical Ethics, and Biostatistics", weight: 5 },
    { topic: "Vitamin D deficiency — rickets vs. osteomalacia",     weight: 3 },
    { topic: "Thiamine (B1) deficiency — Wernicke encephalopathy",  weight: 3 },
  ],
  "USMLE Step 2 CK": [
    { topic: "ACS STEMI NSTEMI",                                                    weight: 6 },
    { topic: "Heart Failure",                                                        weight: 5 },
    { topic: "Pneumonia",                                                            weight: 5 },
    { topic: "Sepsis and Septic Shock",                                              weight: 5 },
    { topic: "Acute Kidney Injury",                                                  weight: 5 },
    { topic: "Type 2 Diagnosis and Management",                                      weight: 5 },
    { topic: "Gestational Diabetes",                                                 weight: 4 },
    { topic: "Obstetrics and Gynecology",                                            weight: 5 },
    { topic: "Pediatrics and Congenital Issues",                                     weight: 5 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care",     weight: 5 },
    { topic: "Psychiatry and Substance Abuse",                                       weight: 4 },
    { topic: "General Surgery and Trauma Management",                                weight: 5 },
  ],
  "USMLE Step 3": [
    { topic: "ACS STEMI NSTEMI",                                                    weight: 5 },
    { topic: "Sepsis and Septic Shock",                                              weight: 5 },
    { topic: "Pulmonary Embolism",                                                   weight: 4 },
    { topic: "CKD",                                                                  weight: 4 },
    { topic: "Type 2 Diagnosis and Management",                                      weight: 4 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care",     weight: 6 },
    { topic: "Psychiatry and Substance Abuse",                                       weight: 4 },
    { topic: "Obstetrics and Gynecology",                                            weight: 4 },
    { topic: "ICU nutrition — ASPEN/ESPEN 2023",                                    weight: 3 },
    { topic: "Chronic disease nutrition management",                                 weight: 3 },
  ],
};

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────
function getGuidelineContext(topic, isNutrition) {
  if (isNutrition) return "ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, and IOM/DRI Nutrition Guidelines";
  const t = topic.toLowerCase();
  const match = GUIDELINE_MAP.find(g => g.keywords.some(k => t.includes(k)));
  return match ? match.citation : "the most current 2025-2026 official society guidelines";
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

// ============================================================
// VALIDATOR v7.2 — sex-irrelevant lab safety net (unchanged)
// ============================================================
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

// ============================================================
// v7.3 — HALLUCINATION GUARD: Stem-Explanation Consistency
// ============================================================
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

// ─── SHUFFLE HELPER ───────────────────────────────────────────────────────────
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
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: { type: "string" },
      stem:              { type: "string" },
      choices: {
        type: "object",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct:      { type: "string", enum: ["A","B","C","D","E"] },
      explanation:  { type: "string" }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

// ─── PROMPT BUILDER (v7.3 — maxTokens raised, Integrity Rule G added) ────────
function buildPrompt(level, topic) {
  const isNutrition = NUTRITION_BY_LEVEL[level]?.includes(topic) ?? false;

  const isABIM_Endo = level === "ABIM Endocrinology";
  const isStep3     = level === "USMLE Step 3";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  const isStep1     = level === "USMLE Step 1";

  // v7.3 — Raised token budgets (was 1800/1700/1700/1400 in v7.2)
  const maxTokens   = isABIM_Endo ? 2400 : (isABIM_IM || isStep3) ? 2200 : 1800;

  let qTypePool = [];
  if (topic.includes("Ethics") || topic.includes("Behavioral") || topic.includes("HIPAA") || topic.includes("end-of-life") || topic.includes("consent")) {
    qTypePool = [{s:"most appropriate NEXT STEP IN PATIENT COUNSELING",w:40}, {s:"LEGAL OR ETHICAL REQUIREMENT",w:40}];
  } else if (isStep1) {
    qTypePool = [{s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY",w:40}, {s:"MECHANISM OF ACTION OR TOXICITY",w:30}];
  } else if (isStep3) {
    qTypePool = [
      {s:"MOST APPROPRIATE MULTI-STEP MANAGEMENT given facility constraints or patient comorbidities",w:30},
      {s:"NEXT BEST ACTION when initial management has failed or complications arise",w:25},
      {s:"MOST APPROPRIATE DISPOSITION OR TRANSITION OF CARE decision",w:20},
      {s:"MOST LIKELY COMPLICATION of current management and how to address it",w:15},
      {s:"MOST APPROPRIATE INFORMED CONSENT or ethical decision in a complex clinical scenario",w:10}
    ];
  } else if (isABIM_IM) {
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT TREATMENT STEP given statin intolerance, organ dysfunction, or comorbidity conflict",w:40},
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
  const randomSex   = pickSexForTopic(topic);

  const isUSMLE     = level.includes("USMLE");
  const systemRole  = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  const VIGNETTE_STYLE_GUIDE = isStep1 ? "" : `
STRICT VIGNETTE SYNTAX (NBME/ABIM STANDARD):
1. MAXIMUM 130 WORDS for the stem.
2. ZERO INTRODUCTORY FLUFF. Start immediately with age, sex, and chief complaint.
3. HIGH-DENSITY DATA. Combine vitals and physical exam into single sentences. 
4. DO NOT interpret labs. State the raw value.
5. CONCEALMENT RULE: NEVER name the primary diagnosis or underlying mechanism in the stem.`;

  const levelRules  = isStep1
    ? "USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1."
    : isABIM_IM
    ? "ABIM IM RULES: Generalist level. Require internist synthesis for complex comorbidities. Do not ask basic first-line questions."
    : `ABIM ENDOCRINOLOGY RULES: Full subspecialty level. MANDATORY Tier 3+ cognitive complexity:
(1) ATYPICAL PRESENTATIONS.
(2) SUBTYPE DIFFERENTIATION.
(3) MULTI-AXIS WORKUP.
Do NOT generate basic first-line questions. Every question must require subspecialty reasoning.`;

  // v7.3 — Added Integrity Rule G
  const integrityRules = `INTEGRITY RULES:
A. Evidence discipline: cite only data explicitly in stem.
B. "glucose" never "sugar".
C. VLDL/LDL: You MUST accurately distinguish between VLDL and LDL.
D. COMPETITIVE DISTRACTORS (TIER 3 REQUIREMENT): Every wrong choice MUST be a highly plausible action or mechanism for a related, competing diagnosis. 
E. EXPLANATION FORMATTING (MANDATORY TO AVOID SHUFFLE BUGS): 
   - In the 🩺 section, YOU ARE FORBIDDEN FROM NAMING THE LETTER OF THE CORRECT CHOICE. Do not write "Choice A is correct". Simply explain the clinical reasoning.
   - In the 🚫 section, YOU MUST start each explanation EXACTLY with "Choice A:", "Choice B:", etc. Do not use bullets.
F. EXPLANATION-CHOICE CONSISTENCY: The explanation MUST strictly match the text of the corresponding choice.
G. STEM-EXPLANATION NUMERIC LOCK: Every lab value, vital sign, and numeric result cited in your explanation MUST be identical to the value stated in the stem. You are STRICTLY FORBIDDEN from writing a different number in the explanation than what appears in the stem. Before calling emit_mcq, re-read your stem and verify every number in your explanation matches exactly.`;

  const explanationNote = `EXPLANATION FORMAT — use these exact headers:
🩺 Why this is the correct answer: [Explain clinical reasoning without naming the choice letter. Cite 2024+ guideline].
🚫 Why the other choices fail: [Explain the 4 INCORRECT choices only, starting exactly with "Choice X:". DO NOT include the correct choice in this section].
💎 Board Pearl: [one high-yield fact].`;

  const topicGuideline = getGuidelineContext(topic, isNutrition);

  const systemText = `You are ${systemRole}. Output confident, accurate facts.
${levelRules}
${VIGNETTE_STYLE_GUIDE}
${integrityRules}
CLINICAL EVIDENCE STANDARD: You MUST base the diagnosis, management, and explanation citations strictly on: ${topicGuideline}. Do not use outdated criteria.
${explanationNote}
UNIVERSAL HARD RULES: HIT: argatroban hepatic, bivalirudin/fondaparinux renal; DKA/HHS: K+ >3.3 before insulin; thyroid storm: PTU before iodine.
RESPONSE FORMAT: You MUST respond by calling the emit_mcq tool exactly once.`;

  const step3TierPrompt = isStep3 ? `
USMLE STEP 3 TIER 3–5 REQUIREMENTS:
- FORBIDDEN: Do NOT ask "What is the most likely diagnosis?". The diagnosis MUST be implied or stated.
- The vignette MUST present a management decision, disposition, or intervention.
- Build in a realistic constraint: facility without cath lab, transfer time >120 min, or failed first-line therapy.
- Distractors must include the Tier 1/2 answer (what a MS3 would choose) — the correct answer requires resident-level multi-step reasoning.` : "";

  const abimIMTierPrompt = isABIM_IM ? `
ABIM INTERNAL MEDICINE TIER 3–4 REQUIREMENTS:
- FORBIDDEN: Do NOT ask "What is the most likely diagnosis?". The diagnosis MUST be implied or stated.
- Present a scenario requiring synthesis: borderline risk scores, treatment failure, statin intolerance with high ASCVD risk, or multi-comorbidity drug selection.
- Distractors must include the Tier 1 answer (what a MS4 would choose).` : "";

  const endoTier3Prompt = isABIM_Endo ? `
ABIM ENDOCRINOLOGY TIER 3+ REQUIREMENTS:
- FORBIDDEN: Do NOT ask "What is the most likely diagnosis?". The question must test subspecialty management, complex diagnostic workup (e.g., dynamic testing), or therapy modification.
- Present an ATYPICAL, COMPLEX, or GUIDELINE-EDGE scenario.
- Distractors must include the "classic teaching" answer that a non-subspecialist would choose.` : "";

  const userText = isStep1
  ? `Write 1 vignette on: ${topic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. 
- Pertinent Negatives: Include a pertinent negative ONLY if it helps rule out a competing answer choice. Do NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, etc.) unless directly relevant to the diagnosis.
- The stem MUST end with the interrogative sentence.
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`
  : `Construct a Tier 3 Board-style puzzle on: ${topic}.
- Lead-in asks for: ${promptQType}.
- Demographics & Setting: Patient is a ${randomSex}. Select a clinically appropriate age and care setting.
- Pertinent Negatives: Include 1-2 pertinent negatives ONLY if they help rule out a competing answer choice. DO NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, pelvic exam, etc.) unless the case turns on them. If a pertinent negative would not change which choice is correct, omit it.
- The stem MUST end with the interrogative sentence.
${step3TierPrompt}${abimIMTierPrompt}${endoTier3Prompt}
Execute the generation using the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

  return { systemText, userText, randomSex, maxTokens, topic };
}

// ─── PROCESS RAW MCQ (shuffle + validate) ────────────────────────────────────
function processRawMcq(p, level, topic) {
  if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) return null;

  // v7.3: both validators must pass
  if (!validateDemographics(p.stem, p._sex || "man", topic)) return null;
  if (!validateConsistency(p)) return null;

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
    topic,
    stem:            p.stem,
    choices:         shuffledChoices,
    correct_answer:  newCorrectLetter,
    explanation:     rewriteExplanationLetters(p.explanation, letterMap),
    content_hash:    hashStem(p.stem),
    exam_level:      level,
    specialty_group: deriveSpecialtyGroup(level, topic),
    blueprint_tag:   topic,
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
      if (!res.ok) { errors += chunk.length; } else { saved += chunk.length; }
    } catch (e) { errors += chunk.length; }
  }
  return { saved, errors };
}

// ─── BUILD WORK QUEUE ─────────────────────────────────────────────────────────
function buildWorkQueue(count) {
  const levels = FILTER_LEVEL ? [FILTER_LEVEL] : Object.keys(TOPIC_DISTRIBUTION);
  const queue  = [];

  if (FILTER_TOPIC && FILTER_LEVEL) {
    for (let i = 0; i < count; i++) queue.push({ level: FILTER_LEVEL, topic: FILTER_TOPIC });
    return queue;
  }

  const flat = [];
  for (const level of levels) {
    const topics = TOPIC_DISTRIBUTION[level] || [];
    for (const t of topics) flat.push({ level, topic: t.topic, w: t.weight });
  }
  const totalWeight = flat.reduce((s, f) => s + f.w, 0);

  for (let i = 0; i < count; i++) {
    let rand = Math.random() * totalWeight;
    for (const item of flat) {
      rand -= item.w;
      if (rand < 0) { queue.push({ level: item.level, topic: item.topic }); break; }
    }
  }
  return queue;
}

// ─── SLEEP ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// MODE A — ANTHROPIC BATCH API
// ============================================================
async function runBatchMode(queue) {
  console.log(`\n📦  Submitting ${queue.length} requests to Anthropic Batch API...`);
  const BATCH_LIMIT = 10_000;
  const batches = [];
  for (let i = 0; i < queue.length; i += BATCH_LIMIT) {
    batches.push(queue.slice(i, i + BATCH_LIMIT));
  }

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
        _meta: { level: item.level, topic: item.topic, sex: pd.randomSex }
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
      await sleep(30_000);
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

        const raw       = { ...toolBlock.input, _sex: meta.sex };
        const processed = processRawMcq(raw, meta.level, meta.topic);
        if (processed) allRecords.push(processed);
      } catch (e) {}
    }
  }
  return allRecords;
}

// ============================================================
// MODE B — STANDARD CONCURRENT CALLS
// ============================================================
async function runStandardMode(queue, silent = false) {
  if (!silent) console.log(`\n⚡  Running ${queue.length} questions with concurrency=${CONCURRENCY}...`);
  const results = [];
  let done = 0;

  async function processItem(item) {
    const pd          = buildPrompt(item.level, item.topic);
    const entropySeed = `${Date.now()}-${Math.random()}`;

    for (let attempt = 0; attempt < 2; attempt++) {
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
            messages: [{ role: "user", content: pd.userText + `\n\n[Seed: ${entropySeed}]` }]
          })
        });
        if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data      = await res.json();
        const toolBlock = data.content?.find(b => b.type === "tool_use" && b.name === "emit_mcq");
        if (!toolBlock?.input) throw new Error("No tool_use block");

        const raw       = { ...toolBlock.input, _sex: pd.randomSex };
        const processed = processRawMcq(raw, item.level, item.topic);
        done++;
        if (!silent) process.stdout.write(`\r  ✅  ${done}/${queue.length} complete   `);
        return processed;
      } catch (e) {
        if (attempt === 1) { done++; } else { await sleep(2000); }
      }
    }
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

  if (!silent) console.log("");
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║    MedBoard Pro — Bulk MCQ Generator             ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Mode:         ${MODE === "batch" ? "Anthropic Batch API (50% discount)" : "Standard Concurrent"}`);
  console.log(`  Target count: ${TARGET_COUNT}`);

  const queue   = buildWorkQueue(TARGET_COUNT);
  const startMs = Date.now();

  let records;
  if (MODE === "batch") {
    records = await runBatchMode(queue);
  } else {
    records = await runStandardMode(queue);
  }

  const validRecords = records.filter(Boolean);
  console.log(`\n💾  Saving ${validRecords.length} valid questions to Supabase...`);

  const { saved, errors } = await saveToSupabase(validRecords);

  const elapsedSec = Math.round((Date.now() - startMs) / 1000);
  const mins       = Math.floor(elapsedSec / 60);
  const secs       = elapsedSec % 60;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                    SUMMARY                       ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Generated:   ${String(validRecords.length).padEnd(33)}║`);
  console.log(`║  Saved to DB: ${String(saved).padEnd(33)}║`);
  console.log(`║  DB errors:   ${String(errors).padEnd(33)}║`);
  console.log(`║  Time:        ${String(`${mins}m ${secs}s`).padEnd(33)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");
}

main().catch(e => {
  console.error("\n❌  Fatal error:", e.message);
  process.exit(1);
});
