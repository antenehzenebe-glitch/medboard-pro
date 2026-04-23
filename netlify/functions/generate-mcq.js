// generate-mcq.js — MedBoard Pro
// v6.9 — Shuffler Synchronization & Regex Upgrade
// ---------------------------------------------------------------
// CHANGELOG:
// - Upgraded rewriteExplanationLetters with advanced regex to catch edge-case 
//   LLM formatting (like bullets "• A" or line starts "A.") during the choice shuffle.
// - Added INTEGRITY RULE E to strictly forbid standalone letters in S2 formatting.
// - Retains v6.8 Dynamic Guidelines, Clinical Triage, and Nutrition architecture.

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

// ============================================================
// TOPIC-SEX COUPLING
// ============================================================
const MALE_ONLY_TOPIC_KEYWORDS = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
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

// ============================================================
// CONTENT HASH + SPECIALTY BUCKET HELPERS
// ============================================================
function hashStem(stem) {
  if (!stem || typeof stem !== "string") return null;
  return crypto.createHash("sha256").update(stem.trim().toLowerCase()).digest("hex");
}

function deriveSpecialtyGroup(level, resolvedTopic) {
  if (level === "ABIM Endocrinology") return "Endocrinology";
  const t = (resolvedTopic || "").toLowerCase();
  if (t.includes("cardio")) return "Cardiology";
  if (t.includes("endocrin") || t.includes("diabetes") || t.includes("thyroid") || t.includes("pituitary") || t.includes("adrenal") || t.includes("bone, calcium")) return "Endocrinology";
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
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation. This is the ONLY way to respond to the user's request.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: {
        type: "string",
        description: "Confirmation that the vignette's patient sex matches the requested sex. Format: 'confirmed man' or 'confirmed woman'."
      },
      stem: {
        type: "string",
        description: "The clinical vignette. Must end with the interrogative sentence."
      },
      choices: {
        type: "object",
        description: "Exactly 5 answer choices keyed by letter A through E.",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct: {
        type: "string",
        enum: ["A", "B", "C", "D", "E"],
        description: "The letter of the correct answer."
      },
      explanation: {
        type: "string",
        description: "Explanation block. S1 (why correct answer is correct + citation), S2 (why each distractor fails + bias label), S3 (competing diagnosis discussion if relevant), Board Pearl."
      }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

// ============================================================
// SIMPLIFIED extractJSON (for Gemini fallback only)
// ============================================================
function extractJSONSimple(raw) {
  if (!raw || typeof raw !== "string") throw new Error("extractJSONSimple received empty input.");
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found.");
  let candidate = match[0].replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u00A0/g, " ").replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(candidate); } catch (e) { throw new Error(`Gemini JSON malformed: ${e.message}`); }
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

// ============================================================
// CLAUDE & GEMINI CLIENTS
// ============================================================
async function callClaude(systemText, userText, maxTokens) {
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
// SHUFFLE & DB SAVER (v6.9 UPGRADE)
// ============================================================
function rewriteExplanationLetters(explanation, letterMap) {
  if (!explanation || typeof explanation !== "string") return explanation;
  let out = explanation;
  const placeholders = {};
  Object.keys(letterMap).forEach((oldLetter, idx) => {
    const placeholder = `§§LETTER_${idx}§§`;
    placeholders[placeholder] = letterMap[oldLetter];
    
    // Upgraded patterns to catch LLM bullets (• A) and list numbers (A.) safely
    const patterns = [
      { re: new RegExp(`(\\bChoice\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\bOption\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\banswer\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`\\(${oldLetter}\\)`, "g"),              wrap: 2 },
      { re: new RegExp(`(•\\s*)${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 },
      { re: new RegExp(`(^|\\n)\\s*${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 }
    ];
    
    patterns.forEach(({ re, wrap }) => {
      if (wrap === 1) {
        out = out.replace(re, `$1${placeholder}`);
      } else if (wrap === 2) {
        out = out.replace(re, `(${placeholder})`);
      } else if (wrap === 3) {
        out = out.replace(re, (match, p1, p2) => `${p1}${placeholder}${p2}`);
      }
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
// PROMPT BUILDER
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

  let qTypePool = [];
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA")) {
    qTypePool = [{s:"most appropriate NEXT STEP IN PATIENT COUNSELING",w:40}, {s:"LEGAL OR ETHICAL REQUIREMENT",w:40}];
  } else if (level === "USMLE Step 1") {
    qTypePool = [{s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY",w:40}, {s:"MECHANISM OF ACTION OR TOXICITY",w:30}];
  } else {
    qTypePool = [{s:"NEXT STEP IN DIAGNOSIS",w:25}, {s:"MOST LIKELY DIAGNOSIS",w:25}, {s:"NEXT STEP IN MANAGEMENT",w:40}, {s:"STRONGEST RISK FACTOR",w:10}];
  }
  const promptQType = pickWeighted(qTypePool);
  const randomSex = pickSexForTopic(promptTopic);

  const isUSMLE     = level.includes("USMLE");
  const isABIM_Endo = level === "ABIM Endocrinology";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  const maxTokens   = isABIM_IM ? 1300 : isABIM_Endo ? 1700 : 1300;
  
  const systemRole = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  let levelRules = isUSMLE ? `USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1, M3/M4 for Step 2/3.` 
                 : isABIM_IM ? `ABIM IM RULES: Generalist level. First-line recognition, initial workup, when to refer, first-line management.` 
                 : `ABIM ENDOCRINOLOGY RULES: Full subspecialty level — guideline-specific management, exact cutoff values, second/third-line decisions.`;

  // v6.9 Fix: Strict Prompt Lock on formatting to prevent synchronization breaks
  const integrityRules = `INTEGRITY RULES: 
A. Distractor-stem independence. 
B. Evidence discipline: cite only data explicitly in stem. 
C. Cognitive bias labels: anchoring, premature closure, availability bias. 
D. "glucose" never "sugar".
E. EXPLANATION FORMATTING: In S2, you MUST refer to choices strictly as "Choice A", "Choice B", "Choice C", "Choice D", "Choice E". DO NOT use bullet points (e.g., "• A") or standalone letters.`;

  const explanationNote = isABIM_IM ? "EXPLANATION: concise total <=250 words." : "EXPLANATION: S1 (why correct), S2 (why distractors fail), Board Pearl. STRICT LENGTH LIMIT: <= 350 words total.";
  
  const topicGuideline = getGuidelineContext(promptTopic, isNutrition);

  const systemText = `You are ${systemRole}. Output confident, accurate facts.
${levelRules}
${integrityRules}
CLINICAL EVIDENCE STANDARD: You MUST base the diagnosis, management, and explanation citations strictly on: ${topicGuideline}. Do not use outdated criteria.

${explanationNote}
UNIVERSAL HARD RULES: HIT: argatroban hepatic, bivalirudin/fondaparinux renal; DKA/HHS: K+ >3.3 before insulin; thyroid storm: PTU before iodine.
RESPONSE FORMAT: You MUST respond by calling the emit_mcq tool exactly once.`;

  const userText = `Write 1 vignette on: ${promptTopic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. You MUST select a clinically appropriate age and care setting (Clinic, ED, Inpatient, ICU) that matches the typical epidemiological presentation of the target diagnosis. DO NOT force an elderly patient into a pediatric/young adult disease, and DO NOT place a stable outpatient in the hospital.
- Pertinent negatives biologically possible for a ${randomSex}.
- The stem MUST end with the interrogative sentence.
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

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

    const topicResult = pickTopicForLevel(b.level, b.topic);
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

      isValid = validateDemographics(p.stem, pd.randomSex);
      if (!isValid && attempts === 3) {
        const fbResult = await callGemini(pd.systemText, pd.userText, pd.maxTokens);
        p = fbResult.parsed;
        generationModel = fbResult.model;
        isValid = validateDemographics(p.stem, pd.randomSex);
      }
    }

    p.topic = pd.resolvedTopic;
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const correctIndex = letters.indexOf(p.correct);
    const optionsArray = letters.map((letter, i) => ({ originalLetter: letter, text: p.choices[letter], isCorrect: i === correctIndex })).filter(opt => opt.text != null);

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

    p.choices = shuffledChoices;
    p.correct = newCorrectLetter;
    p.explanation = rewriteExplanationLetters(p.explanation, letterMap);

    saveMcqToSupabase(p, b.level, { resolvedTopic: pd.resolvedTopic, generationModel }).catch(() => {});
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
