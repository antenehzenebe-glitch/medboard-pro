// bulk-generate.js — MedBoard Pro
// Standalone Node.js script for pre-populating Supabase via Anthropic Batch API
// Usage:
//   node bulk-generate.js                          # 500 questions, all levels/topics
//   node bulk-generate.js --count 200              # 200 questions
//   node bulk-generate.js --level "ABIM Endocrinology" --count 100
//   node bulk-generate.js --level "USMLE Step 1" --topic "Diabetes" --count 50
//   node bulk-generate.js --mode standard          # skip batch API, use concurrent calls
//
// Required env vars:
//   ANTHROPIC_API_KEY=sk-ant-...
//   SUPABASE_URL=https://xxx.supabase.co          (optional, has fallback)
//   SUPABASE_ANON_KEY=eyJ...                      (optional, has fallback)

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
const TARGET_COUNT  = parseInt(getArg("--count", "500"), 10);
const FILTER_LEVEL  = getArg("--level", null);    // e.g. "ABIM Endocrinology"
const FILTER_TOPIC  = getArg("--topic", null);    // e.g. "Diabetes"
const MODE          = getArg("--mode", "batch");  // "batch" | "standard"
const CONCURRENCY   = parseInt(getArg("--concurrency", "6"), 10); // for standard mode

// ─── SHARED CONSTANTS (mirrored from generate-mcq.js) ────────────────────────
const VALID_LEVELS = [
  "ABIM Internal Medicine",
  "ABIM Endocrinology",
  "USMLE Step 1",
  "USMLE Step 2 CK",
  "USMLE Step 3"
];

const GUIDELINE_MAP = [
  { keywords: ["diabetes", "hypoglycemia", "dka", "hhs", "insulin"], citation: "ADA Standards of Medical Care in Diabetes—2026" },
  { keywords: ["thyroid", "nodule", "graves", "hashimoto"], citation: "ATA 2025 Management Guidelines" },
  { keywords: ["obesity", "lipid", "dyslipidemia", "bariatric", "metabolic"], citation: "AACE 2026 Clinical Practice Guidelines" },
  { keywords: ["pcos", "polycystic"], citation: "International Evidence-based PCOS Guideline 2023" },
  { keywords: ["cardio", "acs", "arrhythmia", "heart failure"], citation: "ACC/AHA 2025-2026 Guidelines" },
  { keywords: ["hypertension", "blood pressure"], citation: "ACC/AHA 2025 Hypertension Guidelines" },
  { keywords: ["nephro", "renal", "ckd"], citation: "KDIGO 2025 Guidelines" },
  { keywords: ["gastro", "hepat", "cirrhosis"], citation: "AASLD 2025 Practice Guidance" },
  { keywords: ["parathyroid", "calcium", "bone", "osteoporosis"], citation: "Endocrine Society 2022 Primary Hyperparathyroidism Guideline & AACE 2025 Osteoporosis Guideline" },
  { keywords: ["menopause", "hrt", "reproductive"], citation: "Endocrine Society Menopause Guidelines 2022 & NAMS 2025" },
  { keywords: ["cushing", "adrenal"], citation: "Endocrine Society CPGs and Fleseriu 2021 Pituitary Society Consensus. (CRITICAL: MRI->BIPSS threshold is >=10mm. 1mg DST is screening; 8mg DST is obsolete for localization. ACTH <10 is independent, >20 is dependent.)" }
];

const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const NUTRITION_INJECTION_RATE = 0.12;

const MALE_ONLY_TOPIC_KEYWORDS   = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
const FEMALE_ONLY_TOPIC_KEYWORDS = ["pcos", "polycystic ovary", "menopause", "ovarian", "endometri", "pregnancy", "obstetric", "gynecolog", "turner syndrome"];

// ─── TOPIC DISTRIBUTION MAP ───────────────────────────────────────────────────
// Defines how many questions per topic per level in a balanced 500-question run.
// Adjust weights to match your curriculum priorities.
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
    { topic: "Acute Kidney Injury",               weight: 5 },
    { topic: "CKD",                               weight: 4 },
    { topic: "Electrolyte Disorders",             weight: 5 },
    { topic: "Acid-Base Disorders",               weight: 4 },
    { topic: "IBD Crohns and UC",                 weight: 4 },
    { topic: "Cirrhosis",                         weight: 4 },
    { topic: "Sepsis and Septic Shock",           weight: 5 },
    { topic: "HIV",                               weight: 3 },
    { topic: "Anemia",                            weight: 4 },
    { topic: "DVT and Anticoagulation",           weight: 4 },
    { topic: "Rheumatoid Arthritis",              weight: 3 },
    { topic: "SLE",                               weight: 3 },
    { topic: "Type 2 Diagnosis and Management",   weight: 4 },
    { topic: "Hypothyroidism and Hashimotos",     weight: 3 },
    { topic: "Informed Consent",                  weight: 2 },
    { topic: "End-of-Life Care",                  weight: 2 },
  ],
  "USMLE Step 1": [
    { topic: "Systemic Pathology and Pathophysiology",    weight: 10 },
    { topic: "Pharmacology, Pharmacokinetics, and Adverse Effects", weight: 8 },
    { topic: "Physiology and Clinical Biochemistry",      weight: 8 },
    { topic: "Microbiology, Virology, and Immunology",    weight: 7 },
    { topic: "Anatomy, Neuroanatomy, and Embryology",     weight: 4 },
    { topic: "Behavioral Science, Medical Ethics, and Biostatistics", weight: 5 },
    { topic: "Vitamin D deficiency — rickets vs. osteomalacia", weight: 3 },
    { topic: "Thiamine (B1) deficiency — Wernicke encephalopathy", weight: 3 },
  ],
  "USMLE Step 2 CK": [
    { topic: "ACS STEMI NSTEMI",                          weight: 6 },
    { topic: "Heart Failure",                             weight: 5 },
    { topic: "Pneumonia",                                 weight: 5 },
    { topic: "Sepsis and Septic Shock",                   weight: 5 },
    { topic: "Acute Kidney Injury",                      weight: 5 },
    { topic: "Type 2 Diagnosis and Management",           weight: 5 },
    { topic: "Gestational Diabetes",                      weight: 4 },
    { topic: "Obstetrics and Gynecology",                 weight: 5 },
    { topic: "Pediatrics and Congenital Issues",          weight: 5 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 5 },
    { topic: "Psychiatry and Substance Abuse",            weight: 4 },
    { topic: "General Surgery and Trauma Management",     weight: 5 },
  ],
  "USMLE Step 3": [
    { topic: "ACS STEMI NSTEMI",                          weight: 5 },
    { topic: "Sepsis and Septic Shock",                   weight: 5 },
    { topic: "Pulmonary Embolism",                        weight: 4 },
    { topic: "CKD",                                       weight: 4 },
    { topic: "Type 2 Diagnosis and Management",           weight: 4 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 6 },
    { topic: "Psychiatry and Substance Abuse",            weight: 4 },
    { topic: "Obstetrics and Gynecology",                 weight: 4 },
    { topic: "ICU nutrition — ASPEN/ESPEN 2023",          weight: 3 },
    { topic: "Chronic disease nutrition management",      weight: 3 },
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

function validateDemographics(stem, sex) {
  const lowerText = stem.toLowerCase();
  if (sex === "man") {
    const femaleTerms = ["oral contraceptive","ocp","pregnant","pregnancy","gravida","menopause","menstrual","menses","amenorrhea","ovary","uterus","endometrial","vaginal","cervical cancer"];
    return !femaleTerms.some(term => lowerText.includes(term));
  } else {
    const maleTerms = ["prostate","bph","psa level","testicle","testicular","scrotal","sildenafil","erectile dysfunction"];
    return !maleTerms.some(term => lowerText.includes(term));
  }
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
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation. This is the ONLY way to respond to the user's request.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: { type: "string", description: "Confirmation that the vignette's patient sex matches the requested sex. Format: 'confirmed man' or 'confirmed woman'." },
      stem:              { type: "string", description: "The clinical vignette. Must end with the interrogative sentence." },
      choices: {
        type: "object",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct:      { type: "string", enum: ["A","B","C","D","E"] },
      explanation:  { type: "string", description: "S1 (why correct + citation), S2 (why distractors fail + bias label), Board Pearl." }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────
function buildPrompt(level, topic) {
  const isNutrition = NUTRITION_BY_LEVEL[level]?.includes(topic) ?? false;

  let qTypePool = [];
  if (topic.includes("Ethics") || topic.includes("Behavioral") || topic.includes("HIPAA") || topic.includes("end-of-life") || topic.includes("consent")) {
    qTypePool = [{s:"most appropriate NEXT STEP IN PATIENT COUNSELING",w:40}, {s:"LEGAL OR ETHICAL REQUIREMENT",w:40}];
  } else if (level === "USMLE Step 1") {
    qTypePool = [{s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY",w:40}, {s:"MECHANISM OF ACTION OR TOXICITY",w:30}];
  } else {
    qTypePool = [{s:"NEXT STEP IN DIAGNOSIS",w:25}, {s:"MOST LIKELY DIAGNOSIS",w:25}, {s:"NEXT STEP IN MANAGEMENT",w:40}, {s:"STRONGEST RISK FACTOR",w:10}];
  }
  const promptQType = pickWeighted(qTypePool);
  const randomSex   = pickSexForTopic(topic);

  const isUSMLE     = level.includes("USMLE");
  const isABIM_Endo = level === "ABIM Endocrinology";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  const maxTokens   = isABIM_Endo ? 1700 : 1300;

  const systemRole  = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  const levelRules  = isUSMLE
    ? "USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1, M3/M4 for Step 2/3."
    : isABIM_IM
    ? "ABIM IM RULES: Generalist level. First-line recognition, initial workup, when to refer, first-line management."
    : "ABIM ENDOCRINOLOGY RULES: Full subspecialty level — guideline-specific management, exact cutoff values, second/third-line decisions.";

  const integrityRules = `INTEGRITY RULES: 
A. Distractor-stem independence. 
B. Evidence discipline: cite only data explicitly in stem. 
C. Cognitive bias labels: anchoring, premature closure, availability bias. 
D. "glucose" never "sugar".
E. EXPLANATION FORMATTING: In S2, you MUST refer to choices strictly as "Choice A", "Choice B", "Choice C", "Choice D", "Choice E". DO NOT use bullet points (e.g., "• A") or standalone letters.`;

  const explanationNote = isABIM_IM
    ? "EXPLANATION: concise total <=250 words."
    : "EXPLANATION: S1 (why correct), S2 (why distractors fail), Board Pearl. STRICT LENGTH LIMIT: <= 350 words total.";

  const topicGuideline = getGuidelineContext(topic, isNutrition);

  const systemText = `You are ${systemRole}. Output confident, accurate facts.
${levelRules}
${integrityRules}
CLINICAL EVIDENCE STANDARD: You MUST base the diagnosis, management, and explanation citations strictly on: ${topicGuideline}. Do not use outdated criteria.
${explanationNote}
UNIVERSAL HARD RULES: HIT: argatroban hepatic, bivalirudin/fondaparinux renal; DKA/HHS: K+ >3.3 before insulin; thyroid storm: PTU before iodine.
RESPONSE FORMAT: You MUST respond by calling the emit_mcq tool exactly once.`;

  const userText = `Write 1 vignette on: ${topic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. Select a clinically appropriate age and care setting (Clinic, ED, Inpatient, ICU) that matches the typical epidemiological presentation of the target diagnosis.
- Pertinent negatives biologically possible for a ${randomSex}.
- The stem MUST end with the interrogative sentence.
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

  return { systemText, userText, randomSex, maxTokens, topic };
}

// ─── PROCESS RAW MCQ (shuffle + validate) ────────────────────────────────────
function processRawMcq(p, level, topic) {
  if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) return null;
  if (!validateDemographics(p.stem, p._sex || "man")) return null;

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
    stem:          p.stem,
    choices:       shuffledChoices,
    correct:       newCorrectLetter,
    explanation:   rewriteExplanationLetters(p.explanation, letterMap),
    content_hash:  hashStem(p.stem),
    exam_level:    level,
    specialty_group: deriveSpecialtyGroup(level, topic),
    blueprint_tag: topic,
  };
}

// ─── SUPABASE SAVER ───────────────────────────────────────────────────────────
async function saveToSupabase(records) {
  if (!records.length) return { saved: 0, errors: 0 };
  let saved = 0, errors = 0;

  // Insert in chunks of 50 to avoid payload limits
  const CHUNK = 50;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/mcqs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(chunk)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`  ⚠️  Supabase chunk error: ${res.status} — ${errText.slice(0, 120)}`);
        errors += chunk.length;
      } else {
        saved += chunk.length;
      }
    } catch (e) {
      console.error(`  ⚠️  Supabase fetch error: ${e.message}`);
      errors += chunk.length;
    }
  }
  return { saved, errors };
}

// ─── BUILD WORK QUEUE ─────────────────────────────────────────────────────────
function buildWorkQueue(count) {
  const levels = FILTER_LEVEL ? [FILTER_LEVEL] : Object.keys(TOPIC_DISTRIBUTION);
  const queue  = [];

  // If a specific topic is requested, just repeat it across allowed levels
  if (FILTER_TOPIC && FILTER_LEVEL) {
    for (let i = 0; i < count; i++) queue.push({ level: FILTER_LEVEL, topic: FILTER_TOPIC });
    return queue;
  }

  // Build a weighted flat list of (level, topic) pairs
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

// ─── COST ESTIMATOR ───────────────────────────────────────────────────────────
function estimateCost(count) {
  const avgInputTokens  = 800;
  const avgOutputTokens = 1100;
  const inputRate  = 3.00  / 1_000_000;  // $3/M
  const outputRate = 15.00 / 1_000_000;  // $15/M
  const discount   = MODE === "batch" ? 0.5 : 1.0;
  const total = count * ((avgInputTokens * inputRate + avgOutputTokens * outputRate) * discount);
  return total.toFixed(2);
}

// ─── SLEEP ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// MODE A — ANTHROPIC BATCH API (cheapest, async)
// ============================================================
async function runBatchMode(queue) {
  console.log(`\n📦  Submitting ${queue.length} requests to Anthropic Batch API...`);

  // Batch API max is 10,000 requests per batch — split if needed
  const BATCH_LIMIT = 10_000;
  const batches = [];
  for (let i = 0; i < queue.length; i += BATCH_LIMIT) {
    batches.push(queue.slice(i, i + BATCH_LIMIT));
  }

  const allRecords = [];

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(`\n  🔵  Batch ${bi + 1}/${batches.length} — ${batch.length} questions`);

    // Build batch requests
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
        // Attach metadata so we can recover level/topic/sex from results
        _meta: { level: item.level, topic: item.topic, sex: pd.randomSex }
      };
    });

    // Separate _meta before sending (not part of API spec)
    const metaMap = {};
    const apiRequests = requests.map(r => {
      metaMap[r.custom_id] = r._meta;
      return { custom_id: r.custom_id, params: r.params };
    });

    // Submit batch
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
      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`Batch submit failed: ${submitRes.status} — ${errText.slice(0, 200)}`);
      }
      const submitData = await submitRes.json();
      batchId = submitData.id;
      console.log(`  ✅  Batch submitted. ID: ${batchId}`);
    } catch (e) {
      console.error(`  ❌  ${e.message}`);
      console.log(`  ↩️  Falling back to standard concurrent mode for this batch...`);
      const fallbackRecords = await runStandardMode(batch, true);
      allRecords.push(...fallbackRecords);
      continue;
    }

    // Poll until complete
    console.log(`  ⏳  Polling for completion (check every 30s)...`);
    let batchStatus = "in_progress";
    let pollCount   = 0;
    while (batchStatus === "in_progress") {
      await sleep(30_000);
      pollCount++;
      try {
        const pollRes  = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
          headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "message-batches-2024-09-24" }
        });
        const pollData = await pollRes.json();
        batchStatus    = pollData.processing_status;
        const counts   = pollData.request_counts || {};
        process.stdout.write(`\r  📊  Poll #${pollCount}: ${counts.succeeded || 0} done, ${counts.processing || 0} processing, ${counts.errored || 0} errored   `);
      } catch (e) {
        console.warn(`\n  ⚠️  Poll error: ${e.message} — retrying...`);
      }
    }
    console.log(`\n  ✅  Batch complete. Fetching results...`);

    // Fetch results (JSONL stream)
    const resultsRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/results`, {
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "message-batches-2024-09-24" }
    });
    const resultsText = await resultsRes.text();
    const lines       = resultsText.trim().split("\n").filter(Boolean);

    let success = 0, failed = 0;
    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.result?.type !== "succeeded") { failed++; continue; }

        const customId = result.custom_id;
        const meta     = metaMap[customId];
        if (!meta) { failed++; continue; }

        const toolBlock = result.result.message?.content?.find(b => b.type === "tool_use" && b.name === "emit_mcq");
        if (!toolBlock?.input) { failed++; continue; }

        const raw = { ...toolBlock.input, _sex: meta.sex };
        const processed = processRawMcq(raw, meta.level, meta.topic);
        if (processed) { allRecords.push(processed); success++; }
        else failed++;
      } catch (e) {
        failed++;
      }
    }
    console.log(`  📋  Parsed: ${success} valid, ${failed} failed/skipped`);
  }

  return allRecords;
}

// ============================================================
// MODE B — STANDARD CONCURRENT CALLS (immediate, no polling)
// ============================================================
async function runStandardMode(queue, silent = false) {
  if (!silent) console.log(`\n⚡  Running ${queue.length} questions with concurrency=${CONCURRENCY}...`);
  const results = [];
  let done = 0;

  async function processItem(item) {
    const pd = buildPrompt(item.level, item.topic);
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
        if (res.status === 429) { await sleep(3000); continue; }
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
        if (attempt === 1) {
          done++;
          if (!silent) process.stdout.write(`\r  ❌  ${done}/${queue.length} (error: ${e.message.slice(0,40)})   `);
        } else {
          await sleep(1000);
        }
      }
    }
    return null;
  }

  // Process in concurrent windows
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const window  = queue.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(window.map(processItem));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    // Brief pause between windows to avoid sustained rate-limit pressure
    if (i + CONCURRENCY < queue.length) await sleep(500);
  }

  if (!silent) console.log("");
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     MedBoard Pro — Bulk MCQ Generator            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Mode:         ${MODE === "batch" ? "Anthropic Batch API (50% discount)" : "Standard Concurrent"}`);
  console.log(`  Target count: ${TARGET_COUNT}`);
  console.log(`  Level filter: ${FILTER_LEVEL || "All levels"}`);
  console.log(`  Topic filter: ${FILTER_TOPIC || "Weighted distribution"}`);
  console.log(`  Est. cost:    ~$${estimateCost(TARGET_COUNT)}`);
  console.log("──────────────────────────────────────────────────");

  const queue = buildWorkQueue(TARGET_COUNT);

  // Show distribution preview
  const dist = {};
  queue.forEach(q => { const key = `${q.level} / ${q.topic}`; dist[key] = (dist[key] || 0) + 1; });
  console.log(`\n📊  Question distribution (${queue.length} total):`);
  Object.entries(dist).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([k,v]) => {
    console.log(`     ${v.toString().padStart(3)}x  ${k}`);
  });
  if (Object.keys(dist).length > 15) console.log(`     ... and ${Object.keys(dist).length - 15} more topics`);

  const startMs = Date.now();

  // Generate
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
  console.log(`║  Est. cost:   $${String(estimateCost(validRecords.length)).padEnd(32)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (errors > 0) {
    console.log("⚠️  Some records failed to save. Check your Supabase RLS policies");
    console.log("   and ensure the 'mcqs' table allows anon INSERT.");
  }
}

main().catch(e => {
  console.error("\n❌  Fatal error:", e.message);
  process.exit(1);
});
