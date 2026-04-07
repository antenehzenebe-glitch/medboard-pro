// generate-mcq.js — MedBoard Pro (v2.5 — Randomizer Interceptor Update)
// Enforces Clinical Realism, Cognitive Traps, Strict Clearance Rules, Imaging URLs & True Randomization

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

function buildPrompt(level, topic) {
  // --- THE RANDOMIZER INTERCEPTOR ---
  var promptTopic = topic;
  
  if (topic.includes("Random -- All Specialties") || topic.includes("ABIM IM Blueprint") || topic.includes("USMLE High-Yield")) {
    const allSpecs = [
      "Cardiology (e.g., Acute Coronary Syndrome, Heart Failure, Arrhythmias)",
      "Pulmonology (e.g., Asthma exacerbation, COPD, Pulmonary Embolism, ILD)",
      "Gastroenterology (e.g., Cirrhosis complications, IBD, Pancreatitis)",
      "Nephrology (e.g., AKI, Glomerulonephritis, Severe Acid-Base disorders)",
      "Infectious Disease (e.g., Endocarditis, Opportunistic HIV infections, Meningitis)",
      "Hematology/Oncology (e.g., Sickle Cell crisis, Leukemia, Bleeding disorders)",
      "Rheumatology (e.g., Rheumatoid Arthritis, SLE, Systemic Vasculitis)",
      "Endocrinology (e.g., Diabetic emergencies, Thyroid Storm, Adrenal Crisis)",
      "Neurology (e.g., Stroke syndromes, Seizures, Multiple Sclerosis)"
    ];
    promptTopic = allSpecs[Math.floor(Math.random() * allSpecs.length)];
  } else if (topic.includes("Random -- Endocrinology Only")) {
    const endoSpecs = [
      "Type 2 Diabetes Pharmacotherapy", "Type 1 Diabetes and DKA", "Hyperthyroidism and Graves", 
      "Hypothyroidism and Myxedema", "Adrenal Insufficiency", "Cushing's Syndrome", 
      "Pituitary Adenomas", "Hypercalcemia and Primary Hyperparathyroidism", "PCOS and Hypogonadism"
    ];
    promptTopic = endoSpecs[Math.floor(Math.random() * endoSpecs.length)];
  }

  var systemText = `You are a Fellowship Program Director writing high-yield Board Exam QBank items for ${level}. Do NOT argue with yourself in the explanation. Output confident, accurate facts.
  
  CLINICAL GUARDRAILS:
  1. SETTING VALIDATION: If the vignette involves hypotension (SBP < 90), tachycardia (HR > 100), acute severe metabolic derangement (pH < 7.2), or requires IV drips, you MUST place the patient in the EMERGENCY DEPARTMENT or INPATIENT WARD.
  2. DISTRACTOR LOGIC: Every distractor (wrong answer) must be plausible and represent one of these cognitive errors: Anchoring, Premature Closure, or Availability Bias. 
  3. EXPLANATION: 3-sentence rule. 
     - S1: Why the correct answer is right + official society citation.
     - S2: Why tempting wrong answers fail, explicitly naming the cognitive trap.
     - S3: THE BOARD PEARL. A hard clinical rule or cutoff.
  4. VISUAL DIAGNOSIS: If the vignette relies heavily on imaging or a classic physical exam finding, include a sentence in the explanation directing the user to review classic examples and explicitly include the full URL (e.g., "Review classic examples on Radiopaedia at https://radiopaedia.org or the NEJM Image Challenge at https://www.nejm.org/image-challenge").
  5. PATIENT VARIATION: Strictly vary the age and sex of the patient (e.g., 22-year-old woman, 74-year-old man) to prevent repetitive vignette stems.
  
  HARD CLINICAL RULES (DO NOT VIOLATE): 
  - HIT Anticoagulation: Argatroban is hepatically cleared (USE in renal failure, AVOID in hepatic failure). Bivalirudin/Fondaparinux are renally cleared (USE in hepatic failure, AVOID in severe renal failure).
  - DKA/HHS: K+ must be known (>3.3) before insulin start.
  - Thyroid Storm: Thionamide (PTU) MUST precede Iodine by at least 1 hour. Beta-blockers can worsen cardiogenic shock if severe hypotension is present.
  - UC: Fecal calpro > 1500 + tachycardia = biologic induction.`;

  // We feed the AI the 'promptTopic', but we force it to output the original 'topic' so your UI stays consistent.
  var userText = `Write 1 highly complex vignette specifically about: ${promptTopic}. JSON Format: {"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"${topic}"}`;
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
    
    // UI Safety Check: Prevents "undefined" from showing up
    if (p.stem && p.choices && p.correct && p.explanation) {
      saveMcqToSupabase(p, b.level).catch(() => {});
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
    } else {
      throw new Error("Invalid QBank generation format.");
    }
  } catch(e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
