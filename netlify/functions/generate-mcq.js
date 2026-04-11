// generate-mcq.js — MedBoard Pro (v4.7 — Shuffle-Aware Explanation Rewriter + Cushing's Workup Fixes)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

const SUPABASE_URL      = process.env.SUPABASE_URL || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

const VALID_LEVELS = ["ABIM Internal Medicine","ABIM Endocrinology","USMLE Step 1","USMLE Step 2 CK","USMLE Step 3"];

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
// SHUFFLE-AWARE EXPLANATION REWRITER (v4.7)
// Two-pass placeholder substitution prevents double-replacement
// (e.g. A→C followed by C→E corrupting the result).
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

async function saveMcqToSupabase(p, level) {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify({ exam_level: level, topic: p.topic, stem: p.stem, choices: p.choices, correct_answer: p.correct, explanation: p.explanation })
    });
    if (!res.ok) console.warn(`Supabase save failed: ${res.status}`);
  } catch (e) { console.error("DB Save Exception:", e.message); }
}

function buildPrompt(level, topic) {
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
  const randomSex = Math.random() > 0.5 ? "man" : "woman";

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

  const systemRole = level.includes("USMLE") ? "an NBME Senior Item Writer for the USMLE" : "an ABIM Fellowship Program Director";

  const systemText = `You are ${systemRole} writing high-yield Board Exam QBank items for ${level}. Do NOT argue with yourself in the explanation. Output confident, accurate facts.

CLINICAL & ETHICAL GUARDRAILS:
1. ETHICS/HIPAA: If testing ethics, test complex autonomy, capacity vs. competence, surrogate decision-making ladders, strict HIPAA exceptions (e.g., reportable diseases), or advanced directives. Do not make the correct answer "call the ethics committee."
2. SETTING VALIDATION: Ensure the patient's vital signs and presentation perfectly match their clinical setting.
3. DISTRACTOR LOGIC: Every distractor (wrong answer) must be plausible and represent a cognitive error: Anchoring, Premature Closure, or Availability Bias.
4. EXPLANATION: 3-sentence rule.
   - S1: Why the correct answer is right + official society citation.
   - S2: Why tempting wrong answers fail, explicitly naming the cognitive trap.
   - S3: THE BOARD PEARL. A hard clinical rule or cutoff.
5. VISUAL DIAGNOSIS: If the vignette relies on imaging/exam, direct the user to review classic examples and explicitly include a URL (e.g., Radiopaedia at https://radiopaedia.org).

HARD CLINICAL RULES (DO NOT VIOLATE):
- STRICT BIOLOGICAL DEMOGRAPHICS: You must rigidly adhere to the patient's assigned sex. Male patients MUST NOT have female-specific medications (e.g., oral contraceptives, HRT, progesterone), anatomies (e.g., ovaries, uterus), or states (e.g., pregnancy, menopause) — NOT EVEN AS PERTINENT NEGATIVES. Do NOT write phrases like "denies oral contraceptive use" or "no history of HRT" for a male patient; simply omit the irrelevant negative entirely. The same rule applies in reverse: female patients MUST NOT have prostate/BPH medications, PSA levels, or testicular references, even phrased as negatives. Every pertinent negative in the stem must be biologically possible for the patient's assigned sex.
- DEXAMETHASONE SUPPRESSION TESTS: The 1 mg overnight DST is a SCREENING test for Cushing's syndrome (cutoff: serum cortisol <1.8 mcg/dL the next morning = normal suppression; >1.8 mcg/dL = positive screen). The 8 mg high-dose DST is a LOCALIZATION test used AFTER ACTH-dependence is established, to distinguish pituitary Cushing's disease from ectopic ACTH (criterion: >50% suppression of baseline serum cortisol favors pituitary source; failure to suppress favors ectopic). NEVER apply the 1 mg DST cutoff (<1.8 mcg/dL) to interpret an 8 mg DST result, and never conflate the purposes of these two tests.
- CUSHING'S WORKUP SEQUENCE: After biochemical confirmation of hypercortisolism (any two of: 24-hr UFC, late-night salivary cortisol, 1 mg DST), measurement of plasma ACTH is the MANDATORY next step to classify the disease as ACTH-dependent vs ACTH-independent. Pituitary MRI is appropriate ONLY after ACTH-dependence is established. Adrenal CT is appropriate ONLY after ACTH-independence is established. IPSS is reserved for ACTH-dependent cases with negative or equivocal pituitary MRI.
- HIT Anticoagulation: Argatroban is hepatically cleared. Bivalirudin/Fondaparinux are renally cleared.
- DKA/HHS: K+ must be known (>3.3) before insulin start.
- Thyroid Storm: Thionamide (PTU) MUST precede Iodine by at least 1 hour.

EXPLANATION LETTER REFERENCES: When you reference distractors in the explanation, use ONLY these exact formats: "Choice X", "choice X", "Option X", "answer X", or "(X)" where X is A–E. Do not invent other forms (no "the first option", no "letter B", no "A and C"). The system will automatically rewrite letter references after shuffling, so you may write naturally using your original A–E ordering.`;

  const userText = `Write 1 highly complex vignette specifically about: ${promptTopic}.
CRITICAL INSTRUCTION 1: The actual question posed at the very end of the vignette stem MUST ask for ${promptQType}.
CRITICAL INSTRUCTION 2: The patient in the vignette MUST be exactly a ${randomAge}-year-old ${randomSex}. You must use this exact age and sex.
CRITICAL INSTRUCTION 3: The clinical setting of this vignette MUST be ${promptSetting}. Ensure the acuity of the presentation matches this setting.
CRITICAL INSTRUCTION 4: Every pertinent negative you include must be biologically possible for a ${randomSex}. Do not list negatives for conditions, medications, anatomies, or states that this patient cannot biologically have.

JSON Format: {"demographic_check":"I confirm the patient is a ${randomSex}. I will not include any physiologically impossible medications, conditions, or pertinent negatives.","stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"..."}`;

  return { systemText, userText, randomSex };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  try {
    const b = JSON.parse(event.body);
    if (b.warmup) return { statusCode: 200, body: "{}" };
    if (!b.level || !b.topic) return { statusCode: 400, body: JSON.stringify({ error: "Request body must include 'level' and 'topic'." }) };
    if (!VALID_LEVELS.includes(b.level)) return { statusCode: 400, body: JSON.stringify({ error: `Invalid exam level: "${b.level}". Valid options: ${VALID_LEVELS.join(", ")}` }) };
    if (typeof b.topic !== "string" || b.topic.length > 200) return { statusCode: 400, body: JSON.stringify({ error: "Topic must be a string under 200 characters." }) };

    const pd = buildPrompt(b.level, b.topic);
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
      if (!p.stem || !p.choices || !p.correct || !p.explanation) throw new Error("AI response is missing required fields.");console.log("=== RAW FROM AI ===");
      console.log(JSON.stringify(p, null, 2));
      console.log("=== END RAW ===");

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

    p.topic = b.topic;

    // ============================================================
    // SHUFFLE CHOICES + REWRITE EXPLANATION LETTERS (v4.7)
    // ============================================================
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

    p.choices = shuffledChoices;
    p.correct = newCorrectLetter;
    p.explanation = rewriteExplanationLetters(p.explanation, letterMap);console.log("=== AFTER SHUFFLE + REWRITE ===");
    console.log("Letter map:", JSON.stringify(letterMap));
    console.log(JSON.stringify(p, null, 2));
    console.log("=== END AFTER ===");

    saveMcqToSupabase(p, b.level).catch(() => {});
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
