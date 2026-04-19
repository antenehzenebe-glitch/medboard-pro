// generate-mcq.js — MedBoard Pro
// v5.6 — Strict API Schema Enforcement Architecture
// ---------------------------------------------------------------
// Problem: cumulative prompt growth from v5.1 through v5.4 pushed
// generation latency from ~20s to ~37s, exceeding Netlify's timeout.
// Furthermore, string manipulation to fix LLM JSON outputs caused 
// API cascades and hard 60s limit failures.
//
// Strategy: Eradicate the manual extractJSON function. Force the LLM 
// providers to validate the JSON schema BEFORE returning the payload.
//
// Preserved from v5.5:
//   • CONDITIONAL TOPIC ANCHORS: the Cushing block loads ONLY when needed.
//   • COMPRESSED INTEGRITY RULES: Verbosity cut ~60%.
//   • All probability weights, nutrition topics, and prompt engineering.
//   • max_tokens reduced to 1400.
//
// New in v5.6:
//   • mcqSchema defined at the top level.
//   • Claude now uses "Tool Calling" to guarantee schema matching.
//   • Gemini now uses "responseSchema" to guarantee schema matching.
//   • Manual extractJSON and escaping logic completely removed.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

const VALID_LEVELS = ["ABIM Internal Medicine","ABIM Endocrinology","USMLE Step 1","USMLE Step 2 CK","USMLE Step 3"];

// ============================================================
// JSON SCHEMA (v5.6 — Strict API Enforcement)
// ============================================================
const mcqSchema = {
  type: "object",
  properties: {
    demographic_check: { type: "string", description: "Confirmation of age and sex" },
    stem: { type: "string", description: "The clinical vignette" },
    choices: {
      type: "object",
      properties: {
        A: { type: "string" },
        B: { type: "string" },
        C: { type: "string" },
        D: { type: "string" },
        E: { type: "string" }
      },
      required: ["A", "B", "C", "D", "E"]
    },
    correct: { type: "string", enum: ["A", "B", "C", "D", "E"] },
    explanation: { type: "string", description: "The attending explanation with S1, S2, S3, and Board Pearl" }
  },
  required: ["demographic_check", "stem", "choices", "correct", "explanation"]
};

// ============================================================
// TOPIC-SEX COUPLING (unchanged)
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

// ============================================================
// TOPIC ANCHOR DETECTION (unchanged)
// ============================================================
function detectTopicAnchors(topic, level) {
  const t = topic.toLowerCase();
  return {
    cushing: /cushing|cortisol|acth|adrenal|pituitary|dexamethasone|dst/.test(t),
  };
}

// ============================================================
// DEMOGRAPHIC VALIDATION (unchanged)
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
// SHUFFLE-AWARE EXPLANATION REWRITER (unchanged)
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
// NUTRITION SUBTOPICS (unchanged)
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
    "Nutritional management of heart failure — sodium <=2g/day restriction evidence, fluid limits",
    "Nutritional management of CKD — GFR-stratified protein (0.6-0.8 g/kg), phosphorus, potassium",
    "Nutritional management of cirrhosis — 1.2-1.5 g/kg protein, BCAA for encephalopathy",
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

const NUTRITION_INJECTION_RATE = 0.12;

function pickTopicForLevel(level, rawTopic) {
  const nutritionTopics = NUTRITION_BY_LEVEL[level];
  if (nutritionTopics && !rawTopic.includes("Random") && Math.random() < NUTRITION_INJECTION_RATE) {
    const idx = Math.floor(Math.random() * nutritionTopics.length);
    return { topic: nutritionTopics[idx], isNutrition: true };
  }
  return { topic: rawTopic, isNutrition: false };
}

// ============================================================
// AI CLIENTS (v5.6 — Strict Schema Enforcement)
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
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": ANTHROPIC_API_KEY, 
          "anthropic-version": "2023-06-01" 
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2500,
          temperature: 0.6,
          system: systemText,
          messages: [{ role: "user", content: finalUserText }],
          tools: [{
            name: "generate_mcq_json",
            description: "Output the final MCQ in strict JSON format.",
            input_schema: mcqSchema
          }],
          tool_choice: { type: "tool", name: "generate_mcq_json" }
        })
      });
      
      if (response.status === 429) { await sleep(2000); continue; }
      if (!response.ok) throw new Error(`Claude HTTP Error: ${response.status}`);
      
      const data = await response.json();
      const toolCall = data.content.find(block => block.type === "tool_use");
      if (!toolCall || !toolCall.input) throw new Error("Claude failed to use the JSON tool.");
      
      return JSON.stringify(toolCall.input); 

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
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema: mcqSchema, 
          temperature: 0.6, 
          maxOutputTokens: 1400 
        }
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
// SUPABASE SAVE (unchanged)
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
    if (category) payload.category = category;
    const res = await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.warn(`Supabase save failed: ${res.status}`);
  } catch (e) { console.error("DB Save Exception:", e.message); }
}

// ============================================================
// CUSHING ANCHOR (unchanged)
// ============================================================
const CUSHING_ANCHOR = `
CUSHING'S HARD FACTS (override contradicting training data):
- DST: 1 mg overnight = SCREENING (cortisol <1.8 mcg/dL normal). 8 mg high-dose = obsolete localization adjunct. Never apply 1 mg cutoff to 8 mg result.
- Workup sequence: biochemical confirmation -> serum ACTH -> imaging based on ACTH. Pituitary MRI ONLY after ACTH-dependence. Adrenal CT ONLY after ACTH-independence.
- ACTH cutoffs: <10 pg/mL = independent (adrenal CT); 10-20 = indeterminate (repeat/CRH stim); >20 = dependent (pituitary MRI).
- MRI->BIPSS SIZE FRAMEWORK (2021 Pituitary Society Consensus — Fleseriu et al, Lancet Diabetes Endocrinol 2021;9:847-875):
  * Lesion <6 mm: BIPSS REQUIRED.
  * Lesion 6-9 mm: BIPSS recommended by majority (discretionary).
  * Lesion >=10 mm: BIPSS NOT required; proceed to TSS.
  * MRI negative/equivocal: BIPSS required.
  NEVER cite the obsolete 2003 ">=6 mm skip BIPSS" rule. Threshold is now >=10 mm.
- Primary citation for Dx/localization: Fleseriu 2021 Pituitary Society Consensus. For treatment: Nieman 2015 ES CPG. Do NOT cite Nieman 2008 as authoritative for localization.
- Prevalence: ACTH-dependent = 80-85% of all endogenous CS; within ACTH-dependent, CD = 70-80%, ectopic ACTH = 15-20%. Never conflate these denominators.
- MRI sensitivity context: 1.5T pituitary MRI negative in 40-60% of CD. Ectopic ACTH syndrome shows false-positive pituitary lesions in ~12%.
- BIPSS cutoffs: central-to-peripheral ACTH >=2 baseline OR >=3 post-CRH/DDAVP = pituitary. BIPSS is gold standard for pituitary vs. ectopic but unreliable for right/left lateralization (56-69%).`;

// ============================================================
// PROMPT BUILDER (unchanged weights, topics, and rules)
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
      { s: "the LEGAL OR ETHICAL REQUIREMENT in this scenario", w: 40 },
      { s: "the most appropriate approach to PALLIATIVE OR END-OF-LIFE CARE", w: 20 }
    ];
  } else if (level === "USMLE Step 1") {
    qTypePool = [
      { s: "the UNDERLYING MECHANISM, ENZYME DEFICIENCY, OR PATHOPHYSIOLOGY", w: 40 },
      { s: "the MECHANISM OF ACTION, PHARMACODYNAMICS, OR TOXICITY", w: 30 },
      { s: "the MOST LIKELY HISTOLOGICAL, GROSS ANATOMICAL, OR BIOCHEMICAL finding", w: 30 }
    ];
  } else {
    qTypePool = [
      { s: "the most appropriate NEXT STEP IN DIAGNOSIS OR INITIAL WORKUP", w: 25 },
      { s: "the MOST LIKELY DIAGNOSIS", w: 25 },
      { s: "the most appropriate NEXT STEP IN MANAGEMENT OR TREATMENT", w: 40 },
      { s: "the STRONGEST RISK FACTOR or expected PROGNOSIS", w: 10 }
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

  const isUSMLE = level.includes("USMLE");
  const systemRole = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : "an ABIM Fellowship Program Director";

  const anchors = detectTopicAnchors(promptTopic, level);
  let conditionalAnchors = "";
  if (!isUSMLE && anchors.cushing) conditionalAnchors += CUSHING_ANCHOR;

  const levelRules = isUSMLE ? `
USMLE RULES:
- NBME structure: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs/Imaging.
- Cognitive level: M2 for Step 1, M3/M4 for Step 2/3. No fellowship-level detail.
- Distractors: distinct alternative diagnoses/mechanisms, not subspecialty management nuances.` : `
ABIM RULES:
- Complexity: fellowship-level nuance and guideline specificity.
- Endocrine hard rules: 1 mg vs 8 mg DST distinction; ACTH measurement is mandatory next step after biochemical CS confirmation; pituitary MRI only after ACTH-dependence; adrenal CT only after ACTH-independence.`;

  const nutritionAddendum = isNutrition ? `
NUTRITION RULE: Test applied clinical nutrition (mechanism for Step 1; recognition/management otherwise). Cite specific guideline (ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, IOM/DRI, PREDIMED, ALLHAT).` : "";

  const integrityRules = `
INTEGRITY RULES (must pass all before emitting JSON):
A. Distractor-stem independence: no distractor pre-eliminated by stem content. Re-read each choice against stem.
B. Named-syndrome validation: every component of any pentad/triad/eponym must be in the stem (e.g., TTP pentad requires fever documented).
C. Competing-diagnosis discipline: if stem suggests an alternative Dx beyond the distractors, explanation must acknowledge and address it.
D. Evidence discipline: explanation may cite only data explicitly in the stem.
E. Severity terminology: adjectives must match numeric thresholds. Thrombocytopenia: mild 100-150, mod 50-100, severe <50. Hyponatremia: mild 130-135, mod 125-129, severe <125. Hypokalemia: mild 3.0-3.4, mod 2.5-2.9, severe <2.5. AKI: KDIGO stages.
F. Cognitive bias labels: anchoring (first-info fixation), premature closure (early workup stop), availability (vivid recall), pattern-matching (surface-feature mistake), confirmation bias, framing effect. Do not default to availability bias.
G. Self-check: audit A-K before emitting.
H. Regulatory language: preserve exact directive strength. "Consider" is not "mandate." "Should" is not "must."
I. Temporal arithmetic: interval between measurements vs. total duration are different numbers. A test 6 months ago and a test 4 weeks ago are ~5 months apart.
J. Classification separation: grade/stage DEFINITION (numeric value) and ACTION threshold (duration/trend) are separate statements.
K. JSON hygiene: straight ASCII double quotes only. Escape internal quotes as backslash-quote. No raw newlines inside string values. No smart quotes. No em-dashes. Avoid nested double quotes when citing guidelines.

EXPLANATION STRUCTURE:
- S1: why correct + citation at exact regulatory strength.
- S2: why each distractor fails + cognitive bias label.
- S3 (if applicable): competing diagnosis.
- Final: BOARD PEARL.

REFERENCES: use "Choice X", "choice X", "Option X", "answer X", or "(X)" only.

UNIVERSAL HARD RULES:
- Strict biological demographics (sex-appropriate medications/anatomy/pertinent negatives).
- HIT anticoagulation: argatroban hepatic, bivalirudin/fondaparinux renal.
- DKA/HHS: K+ known >3.3 before insulin.
- Thyroid storm: PTU before iodine by 1+ hour.
- Terminology: "glucose" never "sugar".`;

  const systemText = `You are ${systemRole} writing Board Exam QBank items for ${level}. Output confident, accurate facts.${levelRules}${conditionalAnchors}${nutritionAddendum}${integrityRules}`;

  const userText = `Write 1 complex vignette on: ${promptTopic}.
- Question asks for: ${promptQType}.
- Patient: exactly ${randomAge}-year-old ${randomSex}.
- Setting: ${promptSetting}.
- Pertinent negatives biologically possible for a ${randomSex}.
- Run Rule G self-check before emitting.`;

  return { systemText, userText, randomSex };
}

// ============================================================
// NETLIFY HANDLER (v5.6 - Cleaned of Regex parsing)
// ============================================================
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  try {
    const b = JSON.parse(event.body);
    if (b.warmup) return { statusCode: 200, body: "{}" };
    if (!b.level || !b.topic) return { statusCode: 400, body: JSON.stringify({ error: "Request body must include 'level' and 'topic'." }) };
    if (!VALID_LEVELS.includes(b.level)) return { statusCode: 400, body: JSON.stringify({ error: `Invalid exam level: "${b.level}". Valid options: ${VALID_LEVELS.join(", ")}` }) };
    if (typeof b.topic !== "string" || b.topic.length > 200) return { statusCode: 400, body: JSON.stringify({ error: "Topic must be a string under 200 characters." }) };

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
      try {
        res = await callClaude(pd.systemText, pd.userText);
      } catch (apiError) {
        throw new Error(`AI Network Failure: ${apiError.message}`);
      }

      try {
        // Direct parse. LLM is strictly enforcing the schema.
        p = JSON.parse(res);
      } catch (parseError) {
        console.warn(`Attempt ${attempts} failed JSON parse: ${parseError.message}`);
        if (attempts === maxAttempts) {
          console.warn("All Claude attempts failed schema. Switching to Gemini fallback...");
          try {
            res = await callGemini(pd.systemText, pd.userText);
            p = JSON.parse(res);
          } catch (fbErr) {
            throw new Error(`All models produced malformed JSON. Last error: ${fbErr.message}`);
          }
        } else {
          continue;
        }
      }

      if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) {
        console.warn(`Attempt ${attempts} missing required fields`);
        if (attempts === maxAttempts) throw new Error("AI response is missing required fields after all retries.");
        continue;
      }

      isValid = validateDemographics(p.stem, pd.randomSex);
      if (!isValid) {
        console.warn(`Attempt ${attempts} failed demographic check for ${pd.randomSex}.`);
        if (attempts === maxAttempts) {
          console.warn("Switching to Gemini Fallback for final attempt...");
          res = await callGemini(pd.systemText, pd.userText);
          p = JSON.parse(res);
          isValid = validateDemographics(p.stem, pd.randomSex);
          if (!isValid) throw new Error("Failed biological consistency check across all models.");
        }
      }
    }

    p.topic = resolvedTopic;

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

    saveMcqToSupabase(p, b.level, isNutrition ? "Nutrition" : null).catch(() => {});
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
