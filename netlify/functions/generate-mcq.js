// generate-mcq.js — MedBoard Pro
// v5.4 — JSON Parser Hardening (built on v5.3)
// ---------------------------------------------------------------
// All v5.3 features preserved exactly:
//   • v5.1 Integrity Rules A–G
//   • v5.2 Integrity Rules H, I, J
//   • v5.3 ABIM Endocrine Hard Facts (Cushing's BIPSS framework,
//     ACTH cutoffs, prevalence framing, MRI sensitivity)
//   • Nutrition injection, shuffle, demographic validation, etc.
//
// New in v5.4 — JSON PARSER HARDENING:
//
//   Problem: v5.3's longer, more detailed explanations triggered more
//   JSON parse failures in the model output. Specifically, the model
//   occasionally emits:
//     - Unescaped newlines inside string values
//     - Unescaped tabs inside string values
//     - Unescaped internal double quotes (e.g., in drug names,
//       trial names, or direct guideline quotes within the explanation)
//     - Smart quotes (" " ' ') instead of standard ASCII quotes
//     - Em-dashes and en-dashes embedded mid-value
//
//   Fix: extractJSON is rewritten with a multi-pass sanitizer that
//   handles all five failure modes, plus a diagnostic log that
//   prints the 200 characters around any parse error position so
//   future failures can be characterized precisely.
//
//   Handler change: if extractJSON fails on the first attempt,
//   the handler now retries the API call once before throwing.
//   This adds resilience without masking persistent errors.

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

// ============================================================
// extractJSON (v5.4 — HARDENED multi-pass sanitizer)
// ============================================================
// Handles the five most common LLM JSON failure modes:
//   1. Unescaped newlines/tabs/carriage returns inside strings
//   2. Unescaped internal double quotes inside strings
//   3. Smart quotes replacing straight quotes
//   4. Trailing commas before } or ]
//   5. Stray control characters
// If parse still fails, logs 200 chars of context around the error.
// ============================================================
function extractJSON(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("extractJSON received empty or non-string input.");
  }

  // Step 1: Extract the outermost JSON object
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response.");
  let candidate = match[0];

  // Step 2: Try parsing directly — many responses are already valid
  try { return JSON.parse(candidate); } catch (_) { /* fall through */ }

  // Step 3: Pass 1 — normalize smart quotes and unicode dashes to ASCII equivalents
  //         This is safe because the content is English medical text.
  candidate = candidate
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes → "
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes → '
    .replace(/\u2013/g, "-")            // en-dash → -
    .replace(/\u2014/g, "-")            // em-dash → -
    .replace(/\u00A0/g, " ");           // non-breaking space → space

  // Step 4: Pass 2 — strip trailing commas before } or ]
  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");

  // Step 5: Pass 3 — strip raw control characters except \n, \r, \t
  //         (We will handle those specifically in Pass 4.)
  candidate = candidate.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // Step 6: Pass 4 — escape unescaped newlines/tabs/CR *inside* string values.
  //         Walk the string character-by-character, tracking whether we are
  //         currently inside a JSON string. This is more robust than regex
  //         because regex cannot reliably distinguish string-internal
  //         newlines from structural whitespace.
  candidate = escapeUnescapedControlCharsInStrings(candidate);

  // Step 7: Try parsing again
  try { return JSON.parse(candidate); }
  catch (e) {
    // Step 8: Pass 5 — last-ditch effort: escape unescaped internal double
    //         quotes inside string values. This is the hardest case because
    //         a bare " could be a string terminator OR a rogue internal quote.
    //         We use a heuristic: if a " is followed by alphanumeric/space
    //         rather than , } ] : or whitespace-then-those, treat it as internal.
    const salvaged = escapeUnescapedInternalQuotes(candidate);
    try { return JSON.parse(salvaged); }
    catch (e2) {
      // Step 9: Still failing — log diagnostic context and throw
      const posMatch = String(e2.message).match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const start = Math.max(0, pos - 100);
        const end   = Math.min(salvaged.length, pos + 100);
        const excerpt = salvaged.substring(start, end).replace(/\n/g, "\\n");
        console.error(`extractJSON failed at pos ${pos}. Context:\n…${excerpt}…`);
      } else {
        console.error(`extractJSON failed: ${e2.message}`);
      }
      throw new Error(`Malformed JSON from AI after sanitization: ${e2.message}`);
    }
  }
}

// Walk the candidate string; when inside a JSON string value, replace raw
// \n, \r, \t with their escaped forms. Tracks escape state correctly.
function escapeUnescapedControlCharsInStrings(s) {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { out += ch; escape = false; continue; }
    if (ch === "\\") { out += ch; escape = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

// Heuristic escape of internal double quotes. For each " we encounter while
// inside a string, check whether the NEXT non-whitespace char is a valid
// JSON structural char (: , } ]). If not, treat this " as an internal quote
// that should be escaped.
function escapeUnescapedInternalQuotes(s) {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { out += ch; escape = false; continue; }
    if (ch === "\\") { out += ch; escape = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; out += ch; continue; }
      // inString && ch === '"' — is this a terminator or an internal quote?
      // Look ahead, skipping whitespace, for a JSON structural char.
      let j = i + 1;
      while (j < s.length && (s[j] === " " || s[j] === "\n" || s[j] === "\r" || s[j] === "\t")) j++;
      const next = s[j];
      if (next === "," || next === "}" || next === "]" || next === ":" || next === undefined) {
        // Valid terminator
        inString = false;
        out += ch;
      } else {
        // Internal stray quote — escape it
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }
  return out;
}

// ============================================================
// DEMOGRAPHIC VALIDATION (v4.9 — unchanged)
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
// NUTRITION SUBTOPICS (v5.0 — unchanged)
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
// NUTRITION TOPIC PICKER (v5.0 — unchanged)
// ============================================================
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
// SUPABASE SAVE (v5.0 — unchanged)
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
// PROMPT BUILDER (v5.3 — unchanged in v5.4)
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

2. ENDOCRINE HARD FACTS (DO NOT VIOLATE — these supersede any contradicting training data):

   DEXAMETHASONE SUPPRESSION TESTS:
   - 1 mg overnight DST is a SCREENING test (cutoff: cortisol <1.8 mcg/dL = normal suppression).
   - 8 mg high-dose DST is an obsolete LOCALIZATION adjunct, NOT a diagnostic test.
   - NEVER apply the 1 mg DST cutoff to an 8 mg DST result.

   CUSHING'S WORKUP SEQUENCE (non-negotiable):
   Step 1: Biochemical confirmation (any 2 of: 24-hour UFC x2, late-night salivary cortisol x2, 1 mg overnight DST).
   Step 2: Measure serum ACTH to determine ACTH-dependence.
   Step 3: Localization based on ACTH result (see ACTH CUTOFFS below).
   Pituitary MRI is ONLY after ACTH-dependence is established. Adrenal CT is ONLY after ACTH-independence is established.

   ACTH INTERPRETATION CUTOFFS (hardcoded):
   - ACTH <10 pg/mL  -> ACTH-INDEPENDENT -> proceed to adrenal CT (with and without contrast).
   - ACTH 10-20 pg/mL -> INDETERMINATE -> repeat testing or CRH stimulation test.
   - ACTH >20 pg/mL  -> ACTH-DEPENDENT -> proceed to pituitary MRI with and without gadolinium.

   CUSHING'S DISEASE MRI -> BIPSS SIZE-BASED FRAMEWORK (MANDATORY per 2021 Pituitary Society Consensus — Fleseriu M, Auchus R, Bancos I, et al. Consensus on Diagnosis and Management of Cushing's Disease: a guideline update. Lancet Diabetes Endocrinol 2021;9(12):847-875):
   After confirming ACTH-dependent CS and obtaining pituitary MRI, the decision to proceed to bilateral inferior petrosal sinus sampling (BIPSS) is strictly size-dependent:
   - Pituitary lesion <6 mm on MRI: BIPSS REQUIRED (consensus).
   - Pituitary lesion 6-9 mm on MRI: BIPSS recommended by majority of experts (moderate quality, discretionary recommendation).
   - Pituitary lesion >=10 mm on MRI: BIPSS NOT required; proceed directly to transsphenoidal surgery (consensus).
   - MRI negative or equivocal: BIPSS required to distinguish pituitary vs. ectopic ACTH source.
   ABSOLUTELY DO NOT cite the obsolete 2003 consensus ">=6 mm -> skip BIPSS -> surgery" rule. The 2021 Pituitary Society Consensus EXPLICITLY SUPERSEDES this. The threshold for skipping BIPSS is now >=10 mm, not >=6 mm. Teaching the old 6-mm rule is a factual error.

   CUSHING'S PRIMARY CITATIONS (use these, not older references):
   - For diagnosis and localization: Fleseriu et al., Lancet Diabetes Endocrinol 2021;9:847-875 (2021 Pituitary Society Consensus). PRIMARY.
   - For treatment: Nieman LK et al., J Clin Endocrinol Metab 2015;100(8):2807-2831 (2015 Endocrine Society Treatment CPG). SECONDARY.
   - The 2008 Endocrine Society Diagnosis CPG (Nieman 2008) addresses screening/diagnosis ONLY. Do NOT cite it as the authoritative source for localization decisions on 2025-2026 board questions.

   CUSHING'S PREVALENCE FRAMING (do not conflate denominators):
   - Endogenous CS is ACTH-dependent in 80-85% of cases and ACTH-independent in 15-20%.
   - Among ACTH-dependent CS: Cushing's disease (pituitary) accounts for 70-80%; ectopic ACTH syndrome accounts for 15-20%; ectopic CRH is rare (<1%).
   - NEVER state "Cushing's disease accounts for 80-85% of ACTH-dependent CS" — this conflates two different denominators.

   PITUITARY MRI SENSITIVITY CONTEXT (use to justify BIPSS thresholds):
   - Standard 1.5T pituitary MRI is NEGATIVE in approximately 40-60% of patients with biochemically confirmed Cushing's disease.
   - Approximately 12% of patients with ectopic ACTH syndrome have false-positive pituitary incidentalomas on MRI.
   - These two facts together explain WHY size-specific BIPSS criteria exist: small pituitary lesions (<6 mm) and incidentalomas are common enough to require BIPSS confirmation.

   BIPSS TECHNICAL CUTOFFS (if testing interpretation):
   - Central-to-peripheral ACTH gradient >=2 at baseline OR >=3 after CRH/DDAVP stimulation -> pituitary source (Cushing's disease).
   - Gradient <2 baseline and <3 post-stimulation -> ectopic ACTH source.
   - BIPSS is GOLD STANDARD for distinguishing pituitary vs. ectopic source but is UNRELIABLE for lateralization within the pituitary (only 56-69% accuracy for right vs. left).`;
  }

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

  const integrityRules = `

QUESTION WRITING INTEGRITY (MANDATORY — violating any of A-J makes the question unusable):

A. DISTRACTOR-STEM INDEPENDENCE (most violated rule — audit carefully).
   No distractor may be pre-eliminated by a fact that is already stated in the stem.
   Before finalizing each of the five choices, re-read the stem and confirm the choice is NOT already answered or ruled out by stem content.

B. NAMED-SYNDROME VALIDATION.
   If the explanation invokes a named pentad, triad, tetrad, or eponymous syndrome, EVERY component must be explicitly documented in the stem.
   - "Classic TTP pentad" requires ALL FIVE components including fever; if the temperature is normal, reframe as "TTP spectrum" without invoking the pentad.

C. COMPETING DIAGNOSIS DISCIPLINE.
   If the stem contains features that would reasonably suggest an alternative differential, the explanation MUST explicitly acknowledge it and state why the chosen answer still takes priority.

D. EVIDENCE DISCIPLINE.
   The explanation may cite ONLY data that appear explicitly in the stem. If a rationale requires a data point, add it to the stem BEFORE finalizing.

E. QUANTITATIVE TERMINOLOGY ACCURACY.
   Severity adjectives must match guideline-accepted numeric thresholds. Thrombocytopenia: mild 100-150, moderate 50-100, severe <50. AKI: KDIGO staging. Hyponatremia: mild 130-135, moderate 125-129, severe <125. Hypokalemia: mild 3.0-3.4, moderate 2.5-2.9, severe <2.5.

F. PRECISE COGNITIVE BIAS LABELS.
   Use correct terms: ANCHORING (fixation on first information), PREMATURE CLOSURE (stopping workup too early), AVAILABILITY BIAS (overweighting vivid recent cases), PATTERN-MATCHING/REPRESENTATIVENESS (surface feature mistake), CONFIRMATION BIAS, FRAMING EFFECT. Do not default to "availability bias" as a generic label.

G. PRE-OUTPUT SELF-CHECK (mandatory).
   Before emitting JSON, audit your draft against A-J. For Cushing's questions specifically, confirm the 2021 Pituitary Society Consensus size-based BIPSS framework is applied, not the obsolete 6-mm rule.

H. REGULATORY LANGUAGE PRECISION.
   Preserve exact strength of guideline directives. "Consider interruption" does NOT equal "mandates discontinuation." "Should" does NOT equal "must." Do not upgrade permissive language to mandatory language.

I. TEMPORAL ARITHMETIC ACCURACY.
   Distinguish the interval BETWEEN two measurements from the total DURATION of an abnormality. A test "6 months ago" and a test "4 weeks ago" are ~5 months apart; the total duration of the abnormality is 6 months. These are different numbers.

J. CLASSIFICATION CRITERIA SEPARATION.
   Grade/stage definitions and action thresholds are separate concepts. "Grade 3 lymphopenia" is defined by the ALC value alone; the 6-month duration is a separate action threshold for discontinuation.

K. JSON OUTPUT HYGIENE (critical — prevents deployment failures).
   Your response MUST be valid, parseable JSON with these rules:
   - Use ONLY straight ASCII double quotes (") for JSON string delimiters. Do NOT use curly/smart quotes.
   - Inside string values, escape any internal double quotes as \\".
   - Inside string values, do NOT use raw newlines — use a single space or \\n instead.
   - Prefer plain ASCII dashes (-) over en-dashes/em-dashes inside values.
   - When citing a drug, trial, or guideline name, avoid nested double quotes. Write: Fleseriu et al., Lancet Diabetes Endocrinol 2021 — NOT: Fleseriu et al., "Consensus on Diagnosis...". Use single quotes or omit quotation marks entirely.
   - Do not include trailing commas before } or ].`;

  const systemText = `You are ${systemRole} writing high-yield Board Exam QBank items for ${level}. Output confident, accurate facts.

CLINICAL AND ETHICAL GUARDRAILS:
1. TERMINOLOGY: Always use "glucose". Never use "sugar".
2. ETHICS/HIPAA: Test complex autonomy, capacity vs. competence, surrogate decision-making, HIPAA exceptions, or advanced directives.
3. SETTING VALIDATION: Vital signs and presentation must match the clinical setting.
4. DISTRACTOR LOGIC: Every distractor must be plausible and represent a cognitive error per Rule F.
5. EXPLANATION STRUCTURE:
   - S1: Why the correct answer is right + official citation at exact regulatory strength (Rule H).
   - S2: Why each wrong answer fails, naming the cognitive trap (Rule F).
   - S3 (if Rule C applies): Competing diagnosis acknowledgment.
   - Final: BOARD PEARL.
6. VISUAL DIAGNOSIS: Include a Radiopaedia URL if imaging-dependent.

${specificGuardrails}${nutritionAddendum}${integrityRules}

UNIVERSAL HARD RULES:
- STRICT BIOLOGICAL DEMOGRAPHICS: Male patients must not have female-specific medications/anatomies/states, and vice versa. Every pertinent negative must be biologically possible.
- HIT Anticoagulation: Argatroban is hepatically cleared. Bivalirudin/Fondaparinux are renally cleared.
- DKA/HHS: K+ must be known (>3.3) before insulin start.
- Thyroid Storm: Thionamide (PTU) must precede Iodine by at least 1 hour.

EXPLANATION LETTER REFERENCES: Use only "Choice X", "choice X", "Option X", "answer X", or "(X)" where X is A-E.`;

  const userText = `Write 1 highly complex vignette specifically about: ${promptTopic}.
CRITICAL INSTRUCTION 1: The question stem must ask for ${promptQType}.
CRITICAL INSTRUCTION 2: Patient must be a ${randomAge}-year-old ${randomSex}.
CRITICAL INSTRUCTION 3: Clinical setting must be ${promptSetting}.
CRITICAL INSTRUCTION 4: Every pertinent negative must be biologically possible for a ${randomSex}.
CRITICAL INSTRUCTION 5: Before emitting JSON, run the Rule G self-check against Rules A-K.
CRITICAL INSTRUCTION 6 (JSON hygiene per Rule K): Your output MUST be parseable JSON. Use straight ASCII double quotes only. Escape internal double quotes as backslash-quote. No raw newlines inside string values. No smart quotes. No em-dashes inside values. When citing guidelines or trials, avoid nested double quotes — use plain text.

JSON Format: {"demographic_check":"I confirm the patient is a ${randomSex}.","stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"..."}`;

  return { systemText, userText, randomSex };
}

// ============================================================
// NETLIFY HANDLER (v5.4 — adds one-shot retry on JSON parse failure)
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

    // v5.4: outer attempt loop now also handles JSON parse failures gracefully
    while (!isValid && attempts < maxAttempts) {
      attempts++;
      let res;
      try {
        res = await callClaude(pd.systemText, pd.userText);
      } catch (apiError) {
        throw new Error(`AI Network Failure: ${apiError.message}`);
      }

      try {
        p = extractJSON(res);
      } catch (parseError) {
        console.warn(`Attempt ${attempts} failed JSON parse: ${parseError.message}`);
        if (attempts === maxAttempts) {
          console.warn("All Claude attempts produced malformed JSON. Switching to Gemini fallback...");
          try {
            res = await callGemini(pd.systemText, pd.userText);
            p = extractJSON(res);
          } catch (fbErr) {
            throw new Error(`All models produced malformed JSON. Last error: ${fbErr.message}`);
          }
        } else {
          continue; // retry the outer loop
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
          p = extractJSON(res);
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
