// generate-mcq.js — MedBoard Pro (v2.0 — Logic Guardrail Edition)
// Enforces Clinical Realism & Cognitive Trap Analysis
// Final Build Date: April 2026

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
  var systemText = `You are a Fellowship Program Director writing high-yield Board Exam QBank items for ${level}. 
  
  CLINICAL GUARDRAILS:
  1. SETTING VALIDATION: If the vignette involves hypotension (SBP < 90), tachycardia (HR > 100), acute severe metabolic derangement (pH < 7.2), or requires IV drips (insulin, non-heparin anticoagulants), you MUST place the patient in the EMERGENCY DEPARTMENT or INPATIENT WARD. Do not manage ICU-level care in a clinic.
  2. DISTRACTOR LOGIC: Every distractor (wrong answer) must be plausible and represent one of these cognitive errors: Anchoring, Premature Closure, or Availability Bias. 
  3. EXPLANATION: 3-sentence rule. 
     - S1: Why the correct answer is right + official society citation (e.g., ADA, ATA, ASH, ACC/AHA).
     - S2: Why tempting wrong answers fail, explicitly naming the cognitive trap (e.g. "Option B is an anchoring trap").
     - S3: THE BOARD PEARL. A hard clinical rule or cutoff (e.g. QTc > 500ms).
  
  CLINICAL FOCUS: 
  - HIT: Argatroban (liver) vs Bivalirudin (renal). 
  - DKA: K+ must be known (>3.3) before insulin start.
  - UC: Fecal calpro > 1500 + tachycardia = biologic induction.`;

  var userText = `Write 1 vignette about ${topic}. JSON Format: {"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"${topic}"}`;
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
    saveMcqToSupabase(p, b.level).catch(() => {});
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch(e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
