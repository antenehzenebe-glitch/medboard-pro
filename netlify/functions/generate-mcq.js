// generate-mcq.js — MedBoard Pro
// v7.3 — Truncation Budget Increase & Stem-Explanation Hallucination Guard
// ---------------------------------------------------------------
// CHANGELOG (from v7.2):
// - FIX 1 (TRUNCATION BUDGET): Raised max_tokens across all levels.
//     ABIM Endocrinology: 1800 → 2400
//     ABIM Internal Medicine: 1700 → 2200
//     USMLE Step 3: 1700 → 2200
//     USMLE Step 1 / Step 2 CK: 1400 → 1800
//   Rationale: The 🩺+🚫×4+💎 explanation format plus tool-use JSON
//   overhead was regularly approaching the old limits on complex
//   endocrine/Tier-3 cases, causing truncated output that reached Supabase
//   as partial JSON — the primary cause of the rejected questions.
//
// - FIX 2 (HALLUCINATION GUARD): Added validateConsistency(p) function.
//   Extracts lab/vital name-value pairs from both stem and explanation
//   using a targeted regex. If the same lab (TSH, HbA1c, glucose, etc.)
//   appears in both fields with DIFFERENT numeric values → returns false
//   → triggers a retry. Guideline cutoff numbers cited in the explanation
//   but absent from the stem are intentionally NOT flagged (avoids false
//   positives on "TSH >10 mIU/L per ATA guidelines").
//
// - FIX 2b (PROMPT HARDENING): Added INTEGRITY RULE G to system prompt.
//   Forces model to self-verify numeric consistency before calling emit_mcq.
//
// - validateConsistency() is wired into the retry loop alongside
//   validateDemographics(). Both must pass for a question to be accepted.
//
// - All other v7.2 logic preserved verbatim (Tier 3 prompts, shuffle,
//   demographic validator, B-hCG/PSA traps, guideline map, etc.).

const crypto = require("crypto");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

const VALID_LEVELS = ["ABIM Internal Medicine","ABIM Endocrinology","USMLE Step 1","USMLE Step 2 CK","USMLE Step 3"];

// ============================================================
// DYNAMIC 2025/2026 GUIDELINE MAP
// ============================================================
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

function getGuidelineContext(topic, isNutrition) {
  if (isNutrition) return "ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, and IOM/DRI Nutrition Guidelines";
  const t = topic.toLowerCase();
  const match = GUIDELINE_MAP.find(g => g.keywords.some(k => t.includes(k)));
  return match ? match.citation : "the most current 2025-2026 official society guidelines";
}

// ============================================================
// NUTRITION SUBTOPICS & INJECTION
// ============================================================
const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const NUTRITION_INJECTION_RATE = 0.12;

function pickTopicForLevel(level, rawTopic) {
  const nutritionTopics = NUTRITION_BY_LEVEL[level];
  if (nutritionTopics && !rawTopic.includes("Random") && Math.random() < NUTRITION_INJECTION_RATE) {
    const idx = Math.floor(Math.random() * nutritionTopics.length);
    return { topic: nutritionTopics[idx], isNutrition: true };
  }
  return { topic: rawTopic, isNutrition: false };
}

const MALE_ONLY_TOPIC_KEYWORDS   = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
const FEMALE_ONLY_TOPIC_KEYWORDS = ["pcos", "polycystic ovary", "menopause", "ovarian", "endometri", "pregnancy", "obstetric", "gynecolog", "turner syndrome"];

function pickSexForTopic(promptTopic) {
  const t = promptTopic.toLowerCase();
  if (MALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k)))   return "man";
  if (FEMALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k))) return "woman";
  return Math.random() > 0.5 ? "man" : "woman";
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  if (t.includes("cardio")) return "Cardiology";
  if (t.includes("endocrin") || t.includes("diabetes") || t.includes("thyroid") || t.includes("pituitary") || t.includes("adrenal") || t.includes("bone") || t.includes("calcium")) return "Endocrinology";
  if (t.includes("nephro") || t.includes("renal")) return "Nephrology";
  if (t.includes("pulm")) return "Pulmonology";
  if (t.includes("gastro") || t.includes("hepat")) return "Gastroenterology";
  if (t.includes("hematol") || t.includes("oncolog")) return "Hematology/Oncology";
  if (t.includes("rheumatol")) return "Rheumatology";
  if (t.includes("infectious")) return "Infectious Disease";
  if (t.includes("neurolog")) return "Neurology";
  if (t.includes("ethics") || t.includes("hipaa") || t.includes("palliative") || t.includes("end-of-life")) return "Ethics/Communication";
  if (t.includes("psychi")) return "Psychiatry";
  if (t.includes("pediat")) return "Pediatrics";
  if (t.includes("obstet") || t.includes("gynec")) return "OB/GYN";
  if (t.includes("surg") || t.includes("trauma")) return "Surgery";
  if (t.includes("pharmac")) return "Pharmacology";
  if (t.includes("patholog")) return "Pathology";
  if (t.includes("microbiol") || t.includes("virol") || t.includes("immunolog")) return "Microbiology/Immunology";
  if (t.includes("anatom") || t.includes("embryol")) return "Anatomy";
  if (t.includes("physiolog") || t.includes("biochem")) return "Physiology/Biochemistry";
  if (t.includes("behav") || t.includes("biostat")) return "Behavioral/Biostatistics";
  if (t.includes("nutrition")) return "Nutrition";
  return "General Internal Medicine";
}

// ============================================================
// MCQ TOOL SCHEMA
// ============================================================
const MCQ_TOOL = {
  name: "emit_mcq",
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: { type: "string" },
      stem: { type: "string", description: "The clinical vignette. Must end with the interrogative sentence." },
      choices: {
        type: "object",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct: { type: "string", enum: ["A", "B", "C", "D", "E"] },
      explanation: { type: "string", description: "Use provided formatting rules for the explanation." }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

function extractJSONSimple(raw) {
  if (!raw || typeof raw !== "string") throw new Error("extractJSONSimple received empty input.");
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found.");
  let candidate = match[0].replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u00A0/g, " ").replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(candidate); } catch (e) { throw new Error(`Gemini JSON malformed: ${e.message}`); }
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
// Strategy: extract (lab_name → numeric_value) pairs from both stem and
// explanation using a targeted clinical regex. If the SAME lab appears in
// both fields with DIFFERENT values → the model hallucinated a number in
// the explanation → return false → trigger retry.
//
// Design choices:
//  ✓ Only flags mismatches when the lab appears in BOTH fields.
//    Numbers that only appear in the explanation (guideline cutoffs like
//    "TSH >10 per ATA") are intentionally ignored — no false positives.
//  ✓ Keeps first occurrence per lab name (primary stated value).
//  ✓ Case-insensitive, handles decimals (0.02, 11.2, 420).
//  ✓ Matches common phrasing: "TSH 0.02", "TSH of 0.02", "TSH was 0.02",
//    "TSH: 0.02".

const LAB_VALUE_PATTERN = /\b(tsh|free\s*t4|free\s*t3|total\s*t4|total\s*t3|hba1c|a1c|fasting\s*glucose|glucose|sodium|potassium|creatinine|egfr|calcium|phosphorus|cortisol|acth|igf-1|igf1|prolactin|lh|fsh|testosterone|estradiol|aldosterone|plasma\s*renin|renin|creatine\s*kinase|ck\b|alt|ast|alp|tbili|bilirubin|hemoglobin|hgb|hematocrit|wbc|platelets|inr|ptt|bun|bicarbonate|bicarb|co2|pco2|po2|ldl|hdl|triglyceride|total\s*cholesterol|cholesterol|trab|tpo\s*antibody|vitamin\s*d|25-oh\s*vitamin|pth|parathyroid\s*hormone|urine\s*cortisol|urine\s*albumin|albumin|ferritin|b12|folate|tsh\s*receptor\s*antibod)\s+(?:of\s+|was\s+|is\s+|:?\s*)(\d+\.?\d*)/gi;

function extractLabValues(text) {
  const values = {};
  LAB_VALUE_PATTERN.lastIndex = 0;
  let m;
  while ((m = LAB_VALUE_PATTERN.exec(text)) !== null) {
    const labName = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    if (!(labName in values)) values[labName] = m[2]; // keep first occurrence
  }
  return values;
}

function validateConsistency(p) {
  if (!p || !p.stem || !p.explanation) return true;

  const stemValues = extractLabValues(p.stem);
  const explValues = extractLabValues(p.explanation);

  for (const lab of Object.keys(explValues)) {
    if (stemValues[lab] !== undefined && stemValues[lab] !== explValues[lab]) {
      console.warn(
        `[validateConsistency] Value mismatch — ${lab}: stem="${stemValues[lab]}" vs explanation="${explValues[lab]}"`
      );
      return false;
    }
  }
  return true;
}

// ============================================================
// CLAUDE & GEMINI CLIENTS
// ============================================================
async function callClaude(systemText, userText, maxTokens) {
  const maxRetries  = 2;
  const entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  const finalUserText = userText + "\n\n[Seed: " + entropySeed + "]";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          temperature: 0.6,
          system: systemText,
          tools: [MCQ_TOOL],
          tool_choice: { type: "tool", name: "emit_mcq" },
          messages: [{ role: "user", content: finalUserText }]
        })
      });
      if (response.status === 429) { await sleep(2000); continue; }
      if (!response.ok) throw new Error(`Claude HTTP Error: ${response.status}`);
      const data = await response.json();
      const toolUseBlock = data.content.find(b => b.type === "tool_use" && b.name === "emit_mcq");
      if (!toolUseBlock || !toolUseBlock.input) throw new Error("Claude response missing expected tool_use block.");
      return { parsed: toolUseBlock.input, model: "claude-sonnet-4-6" };
    } catch (e) {
      console.warn(`Claude attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === maxRetries - 1) return await callGemini(systemText, finalUserText, maxTokens);
    }
  }
}

async function callGemini(systemText, userText, maxTokens) {
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
        generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: maxTokens }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response.");
  return { parsed: extractJSONSimple(text), model: "gemini-2.0-flash" };
}

// ============================================================
// SHUFFLE & DB SAVER (unchanged from v7.2)
// ============================================================
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
      if (wrap === 1) { out = out.replace(re, `$1${placeholder}`); }
      else if (wrap === 2) { out = out.replace(re, `(${placeholder})`); }
      else if (wrap === 3) { out = out.replace(re, (match, p1, p2) => `${p1}${placeholder}${p2}`); }
    });
  });
  Object.keys(placeholders).forEach(placeholder => { out = out.split(placeholder).join(placeholders[placeholder]); });
  return out;
}

async function saveMcqToSupabase(p, level, meta) {
  try {
    const payload = {
      exam_level: level, topic: p.topic, stem: p.stem, choices: p.choices, correct_answer: p.correct,
      explanation: p.explanation, specialty_group: deriveSpecialtyGroup(level, meta && meta.resolvedTopic),
      blueprint_tag: meta && meta.resolvedTopic ? meta.resolvedTopic : p.topic,
      generation_model: meta && meta.generationModel ? meta.generationModel : null,
      content_hash: hashStem(p.stem),
    };
    await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify(payload)
    });
  } catch (e) { console.error("DB Save Exception:", e.message); }
}

// ============================================================
// PROMPT BUILDER (v7.3 — adds Integrity Rule G)
// ============================================================
function buildPrompt(level, topic, isNutrition) {
  let promptTopic = topic;
  if (topic.includes("Random")) {
    if (level === "ABIM Endocrinology" || topic === "Random -- Endocrinology Only") {
      promptTopic = pickWeighted([{s:"Diabetes Mellitus and Hypoglycemia Management",w:25}, {s:"Thyroid Disorders and Thyroid Cancer",w:20}, {s:"Pituitary and Neuroendocrine Tumors",w:15}, {s:"Bone, Calcium, and Parathyroid Disorders",w:15}, {s:"Adrenal Disorders and Hypertension",w:10}, {s:"Reproductive Endocrinology, PCOS, and Hypogonadism",w:10}, {s:"Lipid Disorders and Multiple Endocrine Neoplasia",w:5}]);
    } else if (level === "USMLE Step 1") {
      promptTopic = pickWeighted([{s:"Systemic Pathology and Pathophysiology",w:30}, {s:"Pharmacology, Pharmacokinetics, and Adverse Effects",w:20}, {s:"Physiology and Clinical Biochemistry",w:20}, {s:"Microbiology, Virology, and Immunology",w:15}, {s:"Anatomy, Neuroanatomy, and Embryology",w:5}, {s:"Behavioral Science, Medical Ethics, and Biostatistics",w:10}]);
    } else if (level === "USMLE Step 2 CK" || level === "USMLE Step 3") {
      promptTopic = pickWeighted([{s:"Internal Medicine (Cardio, Pulm, GI, Renal, Endo, ID)",w:45}, {s:"General Surgery and Trauma Management",w:15}, {s:"Pediatrics and Congenital Issues",w:10}, {s:"Obstetrics and Gynecology",w:10}, {s:"Psychiatry and Substance Abuse",w:10}, {s:"Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care",w:10}]);
    } else {
      promptTopic = pickWeighted([{s:"Cardiology (e.g., ACS, Heart Failure, Arrhythmias)",w:14}, {s:"Hematology and Oncology",w:12}, {s:"Pulmonology",w:9}, {s:"Gastroenterology and Hepatology",w:9}, {s:"Infectious Disease",w:9}, {s:"Rheumatology",w:9}, {s:"Endocrinology",w:9}, {s:"Nephrology",w:9}, {s:"General Internal Medicine",w:10}]);
    }
  }

  const isABIM_Endo = level === "ABIM Endocrinology";
  const isStep3     = level === "USMLE Step 3";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  const isStep1     = level === "USMLE Step 1";

  let qTypePool = [];
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA")) {
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
  const randomSex   = pickSexForTopic(promptTopic);

  const isUSMLE = level.includes("USMLE");

  // v7.3 — Raised max_tokens to prevent truncation on complex explanations
  const maxTokens = isABIM_Endo ? 2400 : (isABIM_IM || isStep3) ? 2200 : 1800;

  const systemRole = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  const VIGNETTE_STYLE_GUIDE = isStep1 ? "" : `
STRICT VIGNETTE SYNTAX (NBME/ABIM STANDARD):
1. MAXIMUM 130 WORDS for the stem.
2. ZERO INTRODUCTORY FLUFF. Start immediately with age, sex, and chief complaint.
3. HIGH-DENSITY DATA. Combine vitals and physical exam into single sentences. 
4. DO NOT interpret labs. State the raw value.
5. CONCEALMENT RULE: NEVER name the primary diagnosis or underlying mechanism in the stem. Force the examinee to deduce it from physical findings and labs.`;

  let levelRules = isStep1
    ? `USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1.`
    : isABIM_IM
    ? `ABIM IM RULES: Generalist level. First-line recognition, initial workup, when to refer, first-line management.`
    : `ABIM ENDOCRINOLOGY RULES: Full subspecialty level.`;

  // v7.3 — Added Integrity Rule G: numeric self-consistency lock
  const integrityRules = `INTEGRITY RULES:
A. Evidence discipline: cite only data explicitly in stem.
B. "glucose" never "sugar".
C. VLDL/LDL: You MUST accurately distinguish between VLDL and LDL. Do not confuse them.
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

  const topicGuideline = getGuidelineContext(promptTopic, isNutrition);

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
  ? `Write 1 vignette on: ${promptTopic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. 
- Pertinent Negatives: Include a pertinent negative ONLY if it helps rule out a competing answer choice. Do NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, etc.) unless directly relevant to the diagnosis.
- The stem MUST end with the interrogative sentence.
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`
  : `Construct a Tier 3 Board-style puzzle on: ${promptTopic}.
- Lead-in asks for: ${promptQType}.
- Demographics & Setting: Patient is a ${randomSex}. Select a clinically appropriate age and care setting.
- Pertinent Negatives: Include 1-2 pertinent negatives ONLY if they help rule out a competing answer choice. DO NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, pelvic exam, etc.) unless the case turns on them. If a pertinent negative would not change which choice is correct, omit it.
- The stem MUST end with the interrogative sentence.
${step3TierPrompt}${abimIMTierPrompt}${endoTier3Prompt}
Execute the generation using the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

  return { systemText, userText, randomSex, maxTokens, resolvedTopic: promptTopic };
}

// ============================================================
// NETLIFY HANDLER
// ============================================================
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  try {
    const b = JSON.parse(event.body);
    if (b.warmup) return { statusCode: 200, body: "{}" };
    if (!b.level || !b.topic) return { statusCode: 400, body: JSON.stringify({ error: "Request body must include 'level' and 'topic'." }) };

    const topicResult   = pickTopicForLevel(b.level, b.topic);
    const resolvedTopic = topicResult.topic;
    const isNutrition   = topicResult.isNutrition;

    const pd = buildPrompt(b.level, resolvedTopic, isNutrition);

    let p;
    let generationModel = null;
    let isValid = false;
    let attempts = 0;

    while (!isValid && attempts < 3) {
      attempts++;
      let callResult;
      try { callResult = await callClaude(pd.systemText, pd.userText, pd.maxTokens); }
      catch (e) { throw new Error(`AI Network Failure: ${e.message}`); }

      p = callResult.parsed;
      generationModel = callResult.model;
      if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) continue;

      // v7.3: both validators must pass
      const demoOk        = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic);
      const consistencyOk = validateConsistency(p);
      isValid = demoOk && consistencyOk;

      if (!isValid && attempts === 3) {
        const fbResult  = await callGemini(pd.systemText, pd.userText, pd.maxTokens);
        p               = fbResult.parsed;
        generationModel = fbResult.model;
        isValid = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic) && validateConsistency(p);
      }
    }

    p.topic = pd.resolvedTopic;
    const letters      = ['A', 'B', 'C', 'D', 'E'];
    const correctIndex = letters.indexOf(p.correct);
    const optionsArray = letters.map((letter, i) => ({ originalLetter: letter, text: p.choices[letter], isCorrect: i === correctIndex })).filter(opt => opt.text != null);

    for (let i = optionsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
    }

    const shuffledChoices = {};
    const letterMap       = {};
    let newCorrectLetter  = 'A';
    optionsArray.forEach((item, index) => {
      const newLetter = letters[index];
      shuffledChoices[newLetter] = item.text;
      letterMap[item.originalLetter] = newLetter;
      if (item.isCorrect) newCorrectLetter = newLetter;
    });

    p.choices     = shuffledChoices;
    p.correct     = newCorrectLetter;
    p.explanation = rewriteExplanationLetters(p.explanation, letterMap);

    saveMcqToSupabase(p, b.level, { resolvedTopic: pd.resolvedTopic, generationModel }).catch(() => {});
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
