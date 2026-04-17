// generate-mcq.js — MedBoard Pro
// v5.0 — Nutrition Enhancement (USMLE June 2026) built on real v4.9
// All v4.9 features preserved exactly:
//   • USMLE vs ABIM prompt isolation (isUSMLE branch, systemRole)
//   • NBME vignette structure + ABIM complexity + DST/Cushing guardrails
//   • 3-sentence explanation rule (S1/S2/S3) + Board Pearl
//   • Ethics/HIPAA qTypePool, Step1 mechanism qTypePool
//   • Setting blueprint with ICU/telemedicine for ABIM/Step3
//   • Random topic weighted pools per level
//   • Entropy seed, temperature 0.6, max_tokens 2048
//   • Gemini BLOCK_NONE safetySettings + responseMimeType
//   • Supabase /rest/v1/mcqs with exam_level + correct_answer fields
//   • warmup ping, topic length validation, demographic_check field
//   • Two-way validateDemographics (female terms block for men, male terms block for women)
//   • rewriteExplanationLetters with §§LETTER§§ placeholders
//   • glucose/sugar terminology rule
// New in v5.0:
//   • NUTRITION_BY_LEVEL constant — 5 level-specific subtopic lists
//   • pickTopicForLevel() — injects nutrition at ~12% rate via weighted coin flip
//   • nutritionAddendum — appended to systemText when isNutrition=true
//   • Nutrition topics cross-checked against USMLE/ABIM cognitive level expectations
//   • saveMcqToSupabase gains optional `category` field ("Nutrition" or null)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

const VALID_LEVELS = ["ABIM Internal Medicine","ABIM Endocrinology","USMLE Step 1","USMLE Step 2 CK","USMLE Step 3"];

// ============================================================
// TOPIC-SEX COUPLING (v4.8 — unchanged)
// ============================================================
const MALE_ONLY_TOPIC_KEYWORDS = [
  "male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"
];
const FEMALE_ONLY_TOPIC_KEYWORDS = [
  "pcos", "polycystic ovary", "menopause", "ovarian", "endometri",
  "pregnancy", "obstetric", "gynecolog", "turner syndrome"
];

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

function extractJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response.");
  try { return JSON.parse(match[0]); }
  catch (e) {
    const sanitized = match[0].replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F\u007F]/g, ' ');
    return JSON.parse(sanitized);
  }
}

// ============================================================
// DEMOGRAPHIC VALIDATION (v4.9 — two-way, unchanged)
// ============================================================
function validateDemographics(stem, sex) {
  const lowerText = stem.toLowerCase();
  if (sex === "man") {
    const femaleTerms = ["oral contraceptive","ocp","ocps","birth control pill","pregnant","pregnancy","gravida","gestation","g1p","g2p","g3p","menopause","menopausal","perimenopausal","postmenopausal","menstrual","menses","menarche","amenorrhea","dysmenorrhea","ovary","ovarian","uterus","uterine","endometrial","endometriosis","vaginal","vulvar","cervical cancer","progesterone","progestin","hormone replacement therapy","hrt","hormonal contraception","tamoxifen","raloxifene","clomiphene"];
    return !femaleTerms.some(term => lowerText.includes(term));
  } else {
    const maleTerms = ["prostate","bph","psa level","testicle","testicular","scrotal","scrotum","sildenafil","tadalafil","finasteride","dutasteride","erectile dysfunction"];
    return !maleTerms.some(term => lowerText.includes(term));
  }
}

// ============================================================
// SHUFFLE-AWARE EXPLANATION REWRITER (v4.7 — unchanged)
// ============================================================
function rewriteExplanationLetters(explanation, letterMap) {
  if (!explanation || typeof explanation !== "string") return explanation;
  let out = explanation;
  const placeholders = {};
  Object.keys(letterMap).forEach((oldLetter, idx) => {
    const placeholder = `§§LETTER_${idx}§§`;
    placeholders[placeholder] = letterMap[oldLetter];
    const patterns = [
      { re: new RegExp(`(\\bChoice\\s+)${oldLetter}\\b`, "g"),  wrap: false },
      { re: new RegExp(`(\\bchoice\\s+)${oldLetter}\\b`, "g"),  wrap: false },
      { re: new RegExp(`(\\banswer\\s+)${oldLetter}\\b`, "gi"), wrap: false },
      { re: new RegExp(`(\\bOption\\s+)${oldLetter}\\b`, "gi"), wrap: false },
      { re: new RegExp(`\\(${oldLetter}\\)`, "g"),              wrap: true  }
    ];
    patterns.forEach(({ re, wrap }) => {
      if (wrap) out = out.replace(re, `(${placeholder})`);
      else out = out.replace(re, `$1${placeholder}`);
    });
  });
  Object.keys(placeholders).forEach(placeholder => {
    out = out.split(placeholder).join(placeholders[placeholder]);
  });
  return out;
}

// ============================================================
// NUTRITION SUBTOPICS (v5.0 — NEW)
// Per USMLE June 2026: nutrition remains integrated within
// system-based questions. Injected at ~12% rate.
// Topics are calibrated to each exam's cognitive level.
// ============================================================
const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": [
    "Protein-energy malnutrition: kwashiorkor vs. marasmus — mechanisms and distinguishing features",
    "Essential fatty acid deficiency — biochemical role, clinical presentation, triene:tetraene ratio",
    "Vitamin A deficiency — retinal mechanism, night blindness, xerophthalmia, teratogenicity",
    "Vitamin D deficiency — rickets vs. osteomalacia, PTH response, biochemical markers",
    "Vitamin E deficiency — neurological sequelae, hemolytic anemia in premature neonates",
    "Vitamin K deficiency — coagulation factor synthesis (II, VII, IX, X), PT/INR elevation",
    "Thiamine (B1) deficiency — Wernicke encephalopathy, dry/wet beriberi, pyruvate dehydrogenase",
    "Riboflavin (B2) deficiency — FAD/FMN cofactor, cheilosis, corneal vascularization",
    "Niacin (B3) deficiency — pellagra (3 Ds), tryptophan conversion pathway, Hartnup disease",
    "Pyridoxine (B6) deficiency — sideroblastic anemia, peripheral neuropathy, INH-induced",
    "Vitamin B12 deficiency — megaloblastic anemia, subacute combined degeneration, methylmalonyl-CoA",
    "Folate deficiency — neural tube defects, one-carbon metabolism, homocysteine elevation",
    "Vitamin C (ascorbic acid) deficiency — scurvy, collagen hydroxylation defect, perifollicular hemorrhage",
    "Iron deficiency — ferritin/transferrin/TIBC interpretation, microcytic anemia mechanism",
    "Zinc deficiency — acrodermatitis enteropathica, wound healing, immune dysfunction",
    "Iodine deficiency — thyroid hormone synthesis pathway, goiter mechanism, endemic cretinism",
    "Selenium deficiency — Keshan disease, thyroid peroxidase cofactor, Kashin-Beck disease",
    "Refeeding syndrome — pathophysiology: hypophosphatemia, hypokalemia, hypomagnesemia, cardiac risk",
    "Starvation biochemistry — gluconeogenesis substrates, ketogenesis, urea cycle, nitrogen balance",
    "TPN complications — hepatic steatosis (IFALD), acalculous cholecystitis, essential fatty acid deficiency",
  ],
  "USMLE Step 2 CK": [
    "Nutritional assessment in hospitalized patients — albumin, prealbumin, NRS-2002 screening tool",
    "Enteral nutrition — indications, contraindications, aspiration risk, nasogastric vs. PEG tube",
    "Parenteral nutrition — central vs. peripheral, indications, line infection, metabolic complications",
    "Refeeding syndrome recognition and prevention — monitoring protocol, phosphate repletion",
    "Obesity pharmacotherapy — orlistat, phentermine-topiramate, naltrexone-bupropion, GLP-1 RA indication",
    "Bariatric surgery — RYGB vs. sleeve gastrectomy, T2DM remission, nutritional risk",
    "Post-bariatric micronutrient deficiencies — B12, iron, thiamine (Wernicke), calcium/vitamin D",
    "Celiac disease — dietary gluten elimination, anti-tTG monitoring, refractory disease management",
    "Short bowel syndrome — enteral vs. parenteral support, GLP-2 agonist teduglutide indication",
    "Pancreatic exocrine insufficiency — enzyme replacement dosing, fat-soluble vitamin repletion",
    "Anorexia nervosa — cardiovascular (QTc, bradycardia), endocrine (amenorrhea, low IGF-1), bone complications",
    "Bulimia nervosa — electrolyte abnormalities (hypokalemia, hypochloremia, metabolic alkalosis)",
    "Medical nutrition therapy for T2DM — ADA 2026 plate method, carbohydrate targets",
    "DASH diet — evidence for hypertension reduction (ALLHAT), sodium targets",
    "Mediterranean diet — cardiovascular risk reduction, PREDIMED trial application",
    "CKD nutritional management — GFR-stratified phosphorus, potassium, protein restriction",
    "Cirrhosis nutritional management — protein intake paradox, BCAA supplementation, zinc",
    "Critical illness nutrition — early enteral feeding within 24–48 h, ASPEN/ESPEN 2023 guidelines",
    "Vitamin D supplementation — population-specific indications, dosing, toxicity threshold",
  ],
  "USMLE Step 3": [
    "Chronic disease nutrition management in ambulatory practice — shared decision-making approach",
    "Food insecurity screening (Hunger Vital Sign) — SDOH integration, referral pathways",
    "Medical nutrition therapy for T2DM — ADA 2026 individualized carbohydrate goals, MNT billing",
    "CKD nutritional monitoring — phosphate binder selection, potassium management by GFR stage",
    "ICU nutrition — ASPEN/ESPEN 2023, permissive underfeeding in obesity, early EN vs. PN decision",
    "Post-bariatric nutritional monitoring — annual lab protocol, B12/iron/D/thiamine supplementation",
    "Vitamin D across life stages — IOM DRIs, upper tolerable intake levels, toxicity management",
    "Nutrition in pregnancy — folate 400–800 mcg pre-conception, iron 27 mg/day, DHA requirements",
    "Cancer cachexia — multimodal management, role of ONS, avoiding harmful supplement interactions",
    "Preventive nutrition counseling — USPSTF 2020 healthy diet/physical activity behavioral counseling",
    "Enteral-to-oral transition — weaning criteria, GI function assessment, aspiration risk management",
    "Obesity — BMI thresholds for pharmacotherapy vs. bariatric surgery, comorbidity-driven algorithm",
  ],
  "ABIM Internal Medicine": [
    "Refeeding syndrome — recognition, prevention protocol, phosphate repletion targets (>1.5 mg/dL)",
    "Enteral vs. parenteral nutrition — clinical decision algorithm, GI tract accessibility rule",
    "TPN complications — IFALD (hepatic steatosis), EFAD, metabolic bone disease, line sepsis",
    "Nutritional management of heart failure — sodium ≤2g/day restriction evidence, fluid limits",
    "Nutritional management of CKD — GFR-stratified protein (0.6–0.8 g/kg), phosphorus, potassium",
    "Nutritional management of cirrhosis — 1.2–1.5 g/kg protein, BCAA for encephalopathy",
    "Malabsorption workup — Sudan stain, 72-hour fecal fat, D-xylose test interpretation",
    "Celiac disease — anti-tTG IgA, duodenal biopsy (Marsh classification), HLA-DQ2/DQ8",
    "Obesity — comorbidity-driven pharmacotherapy selection, bariatric surgery candidacy criteria",
    "DASH diet — ACC/AHA 2017 evidence: 11 mmHg SBP reduction, dietary components",
    "Mediterranean diet — PREDIMED 2013: 30% relative CV risk reduction vs. low-fat diet",
    "Vitamin D deficiency in chronic disease — 25-OH cutoffs, repletion protocol, monitoring",
    "Thiamine deficiency in heart failure and alcohol use — Wernicke prevention, empiric dosing",
    "Metformin and B12 deficiency — screening interval, repletion threshold, neuropathy prevention",
  ],
  "ABIM Endocrinology": [
    "Medical nutrition therapy for T1DM — carbohydrate-to-insulin ratios, correction factor, CGM integration",
    "Medical nutrition therapy for T2DM — low-carb vs. low-fat RCT data, ADA 2026 MNT evidence",
    "Vitamin D metabolism — 25-OH vs. 1,25-OH forms, PTH feedback loop, deficiency thresholds by society",
    "Nutritional causes of secondary osteoporosis — calcium, vitamin D, protein, alcohol, vitamin K2",
    "Iodine excess and thyroid — Wolff-Chaikoff effect, escape mechanism, amiodarone thyroid effects",
    "Iodine deficiency — endemic goiter, cretinism, WHO global burden",
    "Eating disorders in endocrinology — hypothalamic amenorrhea (FHA), bone loss DEXA findings, hypoglycemia",
    "Ketogenic diet — mechanisms (ketogenesis, glucagon/insulin ratio), clinical evidence, risks (LDL-P, nephrolithiasis)",
    "Obesity pharmacotherapy — GLP-1 RA (semaglutide), dual GLP-1/GIP (tirzepatide), mechanism comparison",
    "Bariatric surgery endocrine outcomes — T2DM remission rates (RYGB > sleeve), hypoglycemia (nesidioblastosis)",
    "Post-bariatric micronutrient protocol — B12 IM or high-dose oral 1000 mcg/day, iron sulfate, thiamine 100 mg/day",
    "Selenium deficiency and thyroid — TPO cofactor, autoimmune thyroiditis, supplementation evidence",
    "Zinc deficiency in diabetes — wound healing impairment, taste disturbance, supplementation indication",
    "Very low calorie diet (VLCD) and intermittent fasting — metabolic effects, safety in T2DM, evidence",
  ],
};

// ============================================================
// NUTRITION TOPIC PICKER (v5.0 — NEW)
// ~12% injection rate; topics scoped to the requested level
// ============================================================
const NUTRITION_INJECTION_RATE = 0.12;

function pickTopicForLevel(level, rawTopic) {
  // Only inject nutrition on non-Random topic calls to avoid
  // double-randomization (the Random pools already vary enough)
  const nutritionTopics = NUTRITION_BY_LEVEL[level];
  if (nutritionTopics && !rawTopic.includes("Random") && Math.random() < NUTRITION_INJECTION_RATE) {
    const idx = Math.floor(Math.random() * nutritionTopics.length);
    return { topic: nutritionTopics[idx], isNutrition: true };
  }
  return { topic: rawTopic, isNutrition: false };
}

// ============================================================
// AI CLIENTS (v4.9 — unchanged)
// ============================================================
async function callClaude(systemText, userText) {
  const maxRetries = 2;
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
          max_tokens: 2048,
          temperature: 0.6,
          system: systemText,
          messages: [{ role: "user", content: finalUserText }]
        })
      });
      if (response.status === 429) { await sleep(2000); continue; }
      if (!response.ok) throw new Error(`Claude HTTP Error: ${response.status}`);
      const data = await response.json();
      return data.content.find(b => b.type === "text").text;
    } catch (e) {
      console.warn(`Claude attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === maxRetries - 1) {
        console.warn("Switching to Gemini Fallback...");
        return await callGemini(systemText, finalUserText);
      }
    }
  }
}

async function callGemini(systemText, userText) {
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
        generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: 2048 }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response.");
  return text;
}

// ============================================================
// SUPABASE SAVE (v5.0 — adds optional category field)
// ============================================================
async function saveMcqToSupabase(p, level, category) {
  try {
    const payload = {
      exam_level:    level,
      topic:         p.topic,
      stem:          p.stem,
      choices:       p.choices,
      correct_answer: p.correct,
      explanation:   p.explanation,
    };
    if (category) payload.category = category;   // "Nutrition" or omitted
    const res = await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.warn(`Supabase save failed: ${res.status}`);
  } catch (e) { console.error("DB Save Exception:", e.message); }
}

// ============================================================
// PROMPT BUILDER (v4.9 base + v5.0 nutritionAddendum)
// ============================================================
function buildPrompt(level, topic, isNutrition) {
  let promptTopic = topic;
  if (topic.includes("Random")) {
    if (level === "ABIM Endocrinology" || topic === "Random -- Endocrinology Only") {
      promptTopic = pickWeighted([
        { s: "Diabetes Mellitus and Hypoglycemia Management", w: 25 },
        { s: "Thyroid Disorders and Thyroid Cancer", w: 20 },
        { s: "Pituitary and Neuroendocrine Tumors", w: 15 },
        { s: "Bone, Calcium, and Parathyroid Disorders", w: 15 },
        { s: "Adrenal Disorders and Hypertension", w: 10 },
        { s: "Reproductive Endocrinology, PCOS, and Hypogonadism", w: 10 },
        { s: "Lipid Disorders and Multiple Endocrine Neoplasia", w: 5 }
      ]);
    } else if (level === "USMLE Step 1") {
      promptTopic = pickWeighted([
        { s: "Systemic Pathology and Pathophysiology", w: 30 },
        { s: "Pharmacology, Pharmacokinetics, and Adverse Effects", w: 20 },
        { s: "Physiology and Clinical Biochemistry", w: 20 },
        { s: "Microbiology, Virology, and Immunology", w: 15 },
        { s: "Anatomy, Neuroanatomy, and Embryology", w: 5 },
        { s: "Behavioral Science, Medical Ethics, and Biostatistics", w: 10 }
      ]);
    } else if (level === "USMLE Step 2 CK" || level === "USMLE Step 3") {
      promptTopic = pickWeighted([
        { s: "Internal Medicine (Cardio, Pulm, GI, Renal, Endo, ID)", w: 45 },
        { s: "General Surgery and Trauma Management", w: 15 },
        { s: "Pediatrics and Congenital Issues", w: 10 },
        { s: "Obstetrics and Gynecology", w: 10 },
        { s: "Psychiatry and Substance Abuse", w: 10 },
        { s: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", w: 10 }
      ]);
    } else {
      promptTopic = pickWeighted([
        { s: "Cardiology (e.g., ACS, Heart Failure, Arrhythmias)", w: 14 },
        { s: "Hematology and Oncology", w: 12 },
        { s: "Pulmonology", w: 9 },
        { s: "Gastroenterology and Hepatology", w: 9 },
        { s: "Infectious Disease", w: 9 },
        { s: "Rheumatology", w: 9 },
        { s: "Endocrinology", w: 9 },
        { s: "Nephrology", w: 9 },
        { s: "Neurology", w: 4 },
        { s: "General Internal Medicine", w: 10 },
        { s: "Medical Ethics, HIPAA Compliance, Patient Counseling, and Palliative/End-of-Life Care", w: 6 }
      ]);
    }
  }

  let qTypePool = [];
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA")) {
    qTypePool = [
      { s: "the most appropriate NEXT STEP IN PATIENT COUNSELING OR COMMUNICATION", w: 40 },
      { s: "the LEGAL OR ETHICAL REQUIREMENT in this scenario (e.g., HIPAA, surrogate decision-making, autonomy)", w: 40 },
      { s: "the most appropriate approach to PALLIATIVE OR END-OF-LIFE CARE for this patient", w: 20 }
    ];
  } else if (level === "USMLE Step 1") {
    qTypePool = [
      { s: "the UNDERLYING MECHANISM, ENZYME DEFICIENCY, OR PATHOPHYSIOLOGY of the condition", w: 40 },
      { s: "the MECHANISM OF ACTION, PHARMACODYNAMICS, OR TOXICITY of the appropriate drug", w: 30 },
      { s: "the MOST LIKELY HISTOLOGICAL, GROSS ANATOMICAL, OR BIOCHEMICAL finding", w: 30 }
    ];
  } else {
    qTypePool = [
      { s: "the most appropriate NEXT STEP IN DIAGNOSIS OR INITIAL WORKUP (e.g., what lab/imaging to order)", w: 25 },
      { s: "the MOST LIKELY DIAGNOSIS", w: 25 },
      { s: "the most appropriate NEXT STEP IN MANAGEMENT OR TREATMENT", w: 40 },
      { s: "the STRONGEST RISK FACTOR or expected PROGNOSIS for this condition", w: 10 }
    ];
  }
  const promptQType = pickWeighted(qTypePool);

  const randomAge = Math.floor(Math.random() * 66) + 20;
  const randomSex = pickSexForTopic(promptTopic);

  let settingBlueprint = [
    { s: "a routine chronic outpatient clinic follow-up", w: 40 },
    { s: "an inpatient hospital ward admission", w: 30 },
    { s: "an acute emergency department presentation", w: 20 }
  ];
  if (level === "USMLE Step 3" || level.includes("ABIM")) {
    settingBlueprint.push(
      { s: "an intensive care unit (ICU) transfer", w: 5 },
      { s: "a telephone consult or telemedicine follow-up", w: 5 }
    );
  }
  const promptSetting = pickWeighted(settingBlueprint);

  // ── v4.9: USMLE vs ABIM prompt isolation (unchanged) ──────────────────
  const isUSMLE = level.includes("USMLE");
  const systemRole = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : "an ABIM Fellowship Program Director";

  let specificGuardrails = "";
  if (isUSMLE) {
    specificGuardrails = `
USMLE SPECIFIC RULES:
1. NBME VIGNETTE STRUCTURE: Strictly follow the standard NBME format: Age/Sex/Setting -> Chief Complaint -> History of Present Illness -> Past Medical History -> Medications/Social/Family History -> Vitals -> Physical Exam -> Labs/Imaging.
2. COGNITIVE LEVEL: Target medical students (M2 for Step 1, M3/M4 for Step 2/3). Do NOT test fellowship-level subspecialty management.
3. DISTRACTORS: Distractors must be distinct, plausible alternative diagnoses or underlying mechanisms, not nuanced variations in subspecialty management.`;
  } else {
    specificGuardrails = `
ABIM SPECIFIC RULES:
1. COMPLEXITY: Test complex management, esoteric guidelines, and nuanced clinical reasoning appropriate for a subspecialty fellowship level.
2. ENDOCRINE HARD RULES (DO NOT VIOLATE):
   - DEXAMETHASONE SUPPRESSION TESTS: The 1 mg overnight DST is a SCREENING test (cutoff: <1.8 mcg/dL = normal). The 8 mg high-dose DST is a LOCALIZATION test used AFTER ACTH-dependence is established. NEVER apply the 1 mg DST cutoff to an 8 mg DST result.
   - CUSHING'S WORKUP SEQUENCE: After biochemical confirmation, ACTH measurement is the MANDATORY next step. Pituitary MRI is ONLY after ACTH-dependence is established. Adrenal CT is ONLY after ACTH-independence is established.`;
  }

  // ── v5.0: NUTRITION ADDENDUM — appended only when isNutrition=true ────
  const nutritionAddendum = isNutrition ? `

NUTRITION QUESTION REQUIREMENTS (USMLE June 2026 Standard):
- This question MUST test applied clinical nutrition science — not generic dietary advice.
- USMLE Step 1: Focus on biochemical mechanism (enzyme, metabolic pathway, cofactor deficiency, starvation physiology).
- USMLE Step 2 CK / Step 3: Focus on clinical recognition, workup, or management decision using nutrition knowledge.
- ABIM levels: Focus on evidence-based dietary intervention, guideline-based nutritional management, or complication recognition.
- The clinical vignette MUST include realistic patient history, physical findings, or laboratory values that require integration of nutritional knowledge to reach the correct answer.
- Do NOT generate questions about "eating healthy" in the abstract. Every question must have a clear, defensible single-best answer grounded in a specific guideline or mechanism.
- The explanation MUST cite the relevant mechanism or authoritative source (e.g., ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, IOM/DRI, PREDIMED, ALLHAT).
- Distractors must represent plausible clinical missteps: ordering the wrong repletion, misidentifying the deficiency, or choosing the wrong dietary intervention.` : "";

  const systemText = `You are ${systemRole} writing high-yield Board Exam QBank items for ${level}. Do NOT argue with yourself in the explanation. Output confident, accurate facts.

CLINICAL & ETHICAL GUARDRAILS:
1. TERMINOLOGY: Always use the precise medical term "glucose". Never use the colloquial term "sugar" in any stem, choice, or explanation.
2. ETHICS/HIPAA: If testing ethics, test complex autonomy, capacity vs. competence, surrogate decision-making ladders, strict HIPAA exceptions, or advanced directives. Do not make the correct answer "call the ethics committee."
3. SETTING VALIDATION: Ensure the patient's vital signs and presentation perfectly match their clinical setting.
4. DISTRACTOR LOGIC: Every distractor (wrong answer) must be plausible and represent a cognitive error: Anchoring, Premature Closure, or Availability Bias.
5. EXPLANATION: 3-sentence rule.
   - S1: Why the correct answer is right + official society citation.
   - S2: Why tempting wrong answers fail, explicitly naming the cognitive trap.
   - S3: THE BOARD PEARL. A hard clinical rule or cutoff.
6. VISUAL DIAGNOSIS: If the vignette relies on imaging/exam, direct the user to review classic examples and explicitly include a URL (e.g., Radiopaedia at https://radiopaedia.org).

${specificGuardrails}${nutritionAddendum}

UNIVERSAL HARD RULES (DO NOT VIOLATE):
- STRICT BIOLOGICAL DEMOGRAPHICS: You must rigidly adhere to the patient's assigned sex. Male patients MUST NOT have female-specific medications, anatomies, or states. The same applies in reverse. Do NOT write phrases like "denies oral contraceptive use" for a male patient; simply omit it. Every pertinent negative must be biologically possible.
- HIT Anticoagulation: Argatroban is hepatically cleared. Bivalirudin/Fondaparinux are renally cleared.
- DKA/HHS: K+ must be known (>3.3) before insulin start.
- Thyroid Storm: Thionamide (PTU) MUST precede Iodine by at least 1 hour.

EXPLANATION LETTER REFERENCES: When referencing distractors in the explanation, use ONLY these exact formats: "Choice X", "choice X", "Option X", "answer X", or "(X)" where X is A–E.`;

  const userText = `Write 1 highly complex vignette specifically about: ${promptTopic}.
CRITICAL INSTRUCTION 1: The actual question posed at the very end of the vignette stem MUST ask for ${promptQType}.
CRITICAL INSTRUCTION 2: The patient in the vignette MUST be exactly a ${randomAge}-year-old ${randomSex}. You must use this exact age and sex.
CRITICAL INSTRUCTION 3: The clinical setting of this vignette MUST be ${promptSetting}. Ensure the acuity of the presentation matches this setting.
CRITICAL INSTRUCTION 4: Every pertinent negative you include must be biologically possible for a ${randomSex}. Do not list negatives for conditions, medications, anatomies, or states that this patient cannot biologically have.

JSON Format: {"demographic_check":"I confirm the patient is a ${randomSex}. I will not include any physiologically impossible medications, conditions, or pertinent negatives.","stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"..."}`;

  return { systemText, userText, randomSex };
}

// ============================================================
// NETLIFY HANDLER (v4.9 — unchanged except category pass-through)
// ============================================================
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  try {
    const b = JSON.parse(event.body);
    if (b.warmup) return { statusCode: 200, body: "{}" };
    if (!b.level || !b.topic) return { statusCode: 400, body: JSON.stringify({ error: "Request body must include 'level' and 'topic'." }) };
    if (!VALID_LEVELS.includes(b.level)) return { statusCode: 400, body: JSON.stringify({ error: `Invalid exam level: "${b.level}". Valid options: ${VALID_LEVELS.join(", ")}` }) };
    if (typeof b.topic !== "string" || b.topic.length > 200) return { statusCode: 400, body: JSON.stringify({ error: "Topic must be a string under 200 characters." }) };

    // v5.0: resolve nutrition injection before buildPrompt
    const topicResult = pickTopicForLevel(b.level, b.topic);
    const resolvedTopic = topicResult.topic;
    const isNutrition   = topicResult.isNutrition;

    const pd = buildPrompt(b.level, resolvedTopic, isNutrition);

    let p;
    let isValid = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!isValid && attempts < maxAttempts) {
      attempts++;
      let res;
      try { res = await callClaude(pd.systemText, pd.userText); }
      catch (apiError) { throw new Error(`AI Network Failure: ${apiError.message}`); }

      p = extractJSON(res);
      if (!p.stem || !p.choices || !p.correct || !p.explanation) throw new Error("AI response is missing required fields.");

      isValid = validateDemographics(p.stem, pd.randomSex);
      if (!isValid) {
        console.warn(`Attempt ${attempts} failed demographic check. Patient is ${pd.randomSex} but biologically incongruous terms were found.`);
        if (attempts === maxAttempts) {
          console.warn("Switching to Gemini Fallback for final attempt...");
          res = await callGemini(pd.systemText, pd.userText);
          p = extractJSON(res);
          isValid = validateDemographics(p.stem, pd.randomSex);
          if (!isValid) throw new Error("Failed biological consistency check across all models.");
        }
      }
    }

    p.topic = resolvedTopic;

    // Shuffle choices and rewrite explanation letters (v4.7 — unchanged)
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const correctIndex = letters.indexOf(p.correct);

    const optionsArray = letters.map((letter, i) => ({
      originalLetter: letter,
      text: p.choices[letter],
      isCorrect: i === correctIndex
    })).filter(opt => opt.text != null);

    for (let i = optionsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
    }

    const shuffledChoices = {};
    const letterMap = {};
    let newCorrectLetter = 'A';
    optionsArray.forEach((item, index) => {
      const newLetter = letters[index];
      shuffledChoices[newLetter] = item.text;
      letterMap[item.originalLetter] = newLetter;
      if (item.isCorrect) newCorrectLetter = newLetter;
    });

    p.choices      = shuffledChoices;
    p.correct      = newCorrectLetter;
    p.explanation  = rewriteExplanationLetters(p.explanation, letterMap);

    // v5.0: pass category to Supabase
    saveMcqToSupabase(p, b.level, isNutrition ? "Nutrition" : null).catch(() => {});
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
