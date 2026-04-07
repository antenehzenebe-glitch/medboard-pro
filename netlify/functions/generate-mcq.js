// generate-mcq.js — MedBoard Pro (v3.3 — The Master Blueprint + Grok Shuffle + Weighted Settings)
// Official ABIM/NBME Weights, Ethics Integration, Forced Demographics, Weighted Settings, and Bulletproof Option Shuffling

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callClaude(systemText, userText) {
  var maxRetries = 3;
  var retryDelays = [1000, 2000, 3000];
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  var finalUserText = userText + "\n\n[Seed: " + entropySeed + "]";

  for (var attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(retryDelays[attempt - 1]);
    try {
      var response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          temperature: 0.6,
          system: systemText,
          messages: [{ role: "user", content: finalUserText }]
        })
      });

      if (response.status >= 500) {
        if (attempt === maxRetries - 1) return await callGemini(systemText, finalUserText);
        continue;
      }
      var data = await response.json();
      return data.content.find(b => b.type === "text").text;
    } catch(e) { if (attempt === maxRetries -1) throw e; }
  }
}

async function callGemini(systemText, userText) {
  var response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: 1024 }
      })
    });
  var data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

const SUPABASE_URL = "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

async function saveMcqToSupabase(p, level) {
  try {
    await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({ exam_level: level, topic: p.topic, stem: p.stem, choices: p.choices, correct_answer: p.correct, explanation: p.explanation })
    });
  } catch (e) { console.log("DB Save Failed:", e.message); }
}

// Helper: Roulette Wheel for Weighted Arrays
function pickWeighted(blueprint) {
  let totalWeight = blueprint.reduce((acc, curr) => acc + curr.w, 0);
  let randomNum = Math.random() * totalWeight;
  let sum = 0;
  for (let item of blueprint) {
    sum += item.w;
    if (randomNum <= sum) return item.s;
  }
  return blueprint[0].s;
}

function buildPrompt(level, topic) {
  var promptTopic = topic;
  
  // ======================================================================
  // 1. THE MASTER BLUEPRINT ROUTER
  // ======================================================================
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
    } 
    else if (level === "USMLE Step 1") {
      promptTopic = pickWeighted([
        { s: "Systemic Pathology and Pathophysiology", w: 30 },
        { s: "Pharmacology, Pharmacokinetics, and Adverse Effects", w: 20 },
        { s: "Physiology and Clinical Biochemistry", w: 20 },
        { s: "Microbiology, Virology, and Immunology", w: 15 },
        { s: "Anatomy, Neuroanatomy, and Embryology", w: 5 },
        { s: "Behavioral Science, Medical Ethics, and Biostatistics", w: 10 }
      ]);
    }
    else if (level === "USMLE Step 2 CK" || level === "USMLE Step 3") {
      promptTopic = pickWeighted([
        { s: "Internal Medicine (Cardio, Pulm, GI, Renal, Endo, ID)", w: 45 },
        { s: "General Surgery and Trauma Management", w: 15 },
        { s: "Pediatrics and Congenital Issues", w: 10 },
        { s: "Obstetrics and Gynecology", w: 10 },
        { s: "Psychiatry and Substance Abuse", w: 10 },
        { s: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", w: 10 }
      ]);
    }
    else {
      // Default: ABIM Internal Medicine
      promptTopic = pickWeighted([
        { s: "Cardiology (e.g., ACS, Heart Failure, Arrhythmias)", w: 14 },
        { s: "Hematology and Oncology", w: 12 },
        { s: "Pulmonology", w: 9 }, { s: "Gastroenterology and Hepatology", w: 9 },
        { s: "Infectious Disease", w: 9 }, { s: "Rheumatology", w: 9 },
        { s: "Endocrinology", w: 9 }, { s: "Nephrology", w: 9 },
        { s: "Neurology", w: 4 }, { s: "General Internal Medicine", w: 10 },
        { s: "Medical Ethics, HIPAA Compliance, Patient Counseling, and Palliative/End-of-Life Care", w: 6 }
      ]);
    }
  }

  // ======================================================================
  // 2. EXAM-SPECIFIC QUESTION TYPE CALIBRATION
  // ======================================================================
  let qTypePool = [];
  
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA")) {
    qTypePool = [
      "the most appropriate NEXT STEP IN PATIENT COUNSELING OR COMMUNICATION",
      "the LEGAL OR ETHICAL REQUIREMENT in this scenario (e.g., HIPAA, surrogate decision-making, autonomy)",
      "the most appropriate approach to PALLIATIVE OR END-OF-LIFE CARE for this patient"
    ];
  } else if (level === "USMLE Step 1") {
    qTypePool = [
      "the UNDERLYING MECHANISM, ENZYME DEFICIENCY, OR PATHOPHYSIOLOGY of the condition",
      "the MECHANISM OF ACTION, PHARMACODYNAMICS, OR TOXICITY of the appropriate drug",
      "the MOST LIKELY HISTOLOGICAL, GROSS ANATOMICAL, OR BIOCHEMICAL finding"
    ];
  } else {
    qTypePool = [
      "the most appropriate NEXT STEP IN DIAGNOSIS OR INITIAL WORKUP (e.g., what lab/imaging to order)",
      "the MOST LIKELY DIAGNOSIS",
      "the most appropriate NEXT STEP IN MANAGEMENT OR TREATMENT",
      "the STRONGEST RISK FACTOR or expected PROGNOSIS for this condition"
    ];
  }
  const promptQType = qTypePool[Math.floor(Math.random() * qTypePool.length)];

  // ======================================================================
  // 3. DEMOGRAPHICS & WEIGHTED CLINICAL SETTING
  // ======================================================================
  const randomAge = Math.floor(Math.random() * 66) + 20; 
  const randomSex = Math.random() > 0.5 ? "man" : "woman";

  let settingBlueprint = [
    { s: "a routine chronic outpatient clinic follow-up", w: 40 },
    { s: "an inpatient hospital ward admission", w: 30 },
    { s: "an acute emergency department presentation", w: 20 }
  ];

  if (level === "USMLE Step 3" || level.includes("ABIM")) {
    settingBlueprint.push({ s: "an intensive care unit (ICU) transfer", w: 5 });
    settingBlueprint.push({ s: "a telephone consult or telemedicine follow-up", w: 5 });
  }

  const promptSetting = pickWeighted(settingBlueprint);

  // ======================================================================
  // 4. THE PROMPT COMPILER
  // ======================================================================
  var systemRole = level.includes("USMLE") ? "an NBME Senior Item Writer for the USMLE" : "an ABIM Fellowship Program Director";
  
  var systemText = `You are ${systemRole} writing high-yield Board Exam QBank items for ${level}. Do NOT argue with yourself in the explanation. Output confident, accurate facts.
  
  CLINICAL & ETHICAL GUARDRAILS:
  1. ETHICS/HIPAA: If testing ethics, test complex autonomy, capacity vs. competence, surrogate decision-making ladders, strict HIPAA exceptions (e.g., reportable diseases), or advanced directives. Do not make the correct answer "call the ethics committee."
  2. SETTING VALIDATION: Ensure the patient's vital signs and presentation perfectly match their clinical setting. A clinic patient should generally be stable.
  3. DISTRACTOR LOGIC: Every distractor (wrong answer) must be plausible and represent a cognitive error: Anchoring, Premature Closure, or Availability Bias. 
  4. EXPLANATION: 3-sentence rule. 
     - S1: Why the correct answer is right + official society citation.
     - S2: Why tempting wrong answers fail, explicitly naming the cognitive trap.
     - S3: THE BOARD PEARL. A hard clinical rule or cutoff.
  5. VISUAL DIAGNOSIS: If the vignette relies on imaging/exam, direct the user to review classic examples and explicitly include a URL (e.g., Radiopaedia at https://radiopaedia.org).
  
  HARD CLINICAL RULES (DO NOT VIOLATE): 
  - HIT Anticoagulation: Argatroban is hepatically cleared. Bivalirudin/Fondaparinux are renally cleared.
  - DKA/HHS: K+ must be known (>3.3) before insulin start.
  - Thyroid Storm: Thionamide (PTU) MUST precede Iodine by at least 1 hour.`;

  var userText = `Write 1 highly complex vignette specifically about: ${promptTopic}. 
  CRITICAL INSTRUCTION 1: The actual question posed at the very end of the vignette stem MUST ask for ${promptQType}.
  CRITICAL INSTRUCTION 2: The patient in the vignette MUST be exactly a ${randomAge}-year-old ${randomSex}. You must use this exact age and sex.
  CRITICAL INSTRUCTION 3: The clinical setting of this vignette MUST be ${promptSetting}. Ensure the acuity of the presentation matches this setting.
  
  JSON Format: {"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"..."}`;
  
  return { systemText, userText };
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  try {
    var b = JSON.parse(event.body);
    if (b.warmup) return { statusCode: 200, body: "{}" };
    
    var pd = buildPrompt(b.level, b.topic);
    var res = await callClaude(pd.systemText, pd.userText);
    var cleaned = res.substring(res.indexOf("{"), res.lastIndexOf("}") + 1);
    
    var p = JSON.parse(cleaned);
    
    if (p.stem && p.choices && p.correct && p.explanation) {
      p.topic = b.topic; 
      
      // ======================================================================
      // THE GROK FIX: FISHER-YATES POST-GENERATION SHUFFLE
      // ======================================================================
      // 1. Extract the options into an array
      const optionsArray = [
        { text: p.choices.A },
        { text: p.choices.B },
        { text: p.choices.C },
        { text: p.choices.D },
        { text: p.choices.E }
      ].filter(opt => opt.text); 
      
      // 2. Capture the actual text of the correct answer before we shuffle
      const correctText = p.choices[p.correct];

      // 3. Perform the Fisher-Yates Shuffle
      for (let i = optionsArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
      }

      // 4. Rebuild the choices object (A through E) and identify the new correct letter
      const shuffledChoices = {};
      let newCorrectLetter = 'A';
      const letters = ['A', 'B', 'C', 'D', 'E'];

      optionsArray.forEach((item, index) => {
        const currentLetter = letters[index];
        shuffledChoices[currentLetter] = item.text;
        
        // If this shuffled item matches our original correct text, save this letter!
        if (item.text === correctText) {
          newCorrectLetter = currentLetter;
        }
      });

      // 5. Overwrite the QBank engine's original output with our newly shuffled data
      p.choices = shuffledChoices;
      p.correct = newCorrectLetter;
      // ======================================================================

      saveMcqToSupabase(p, b.level).catch(() => {});
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
    } else {
      throw new Error("Invalid QBank generation format.");
    }
  } catch(e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
