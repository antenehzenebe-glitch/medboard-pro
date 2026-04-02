const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Helper to pick random items for variety
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- 1. THE ANTHROPIC PIPELINE ---
async function callClaude(systemText, userText) {
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31" 
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      temperature: 0.85,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText + "\n\nSeed: " + entropySeed }]
    })
  });
  if (!response.ok) throw new Error("Anthropic Error: " + response.status);
  const data = await response.json();
  return data.content[0].text;
}

// --- 2. THE GEMINI PIPELINE (Primary for Speed) ---
async function callGemini(systemText, userText) {
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: userText + "\n\nSeed: " + entropySeed }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1500,
        responseMimeType: "application/json"
      }
    })
  });
  if (!response.ok) throw new Error("Gemini Error: " + response.status);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// --- 3. PROMPT ARCHITECTURE ---
function buildPrompt(level, topic) {
  const boardTasks = [
    "most likely diagnosis",
    "most appropriate next step in management",
    "most appropriate initial pharmacotherapy",
    "most appropriate diagnostic study",
    "best long-term monitoring strategy"
  ];
  const selectedTask = pickRandom(boardTasks);

  let levelNote = "";
  if (level.includes("Internal Medicine")) {
    levelNote = "Adhere to ABIM blueprint. Focus on high-value care and specific treatment thresholds (e.g., ADA, ACC/AHA guidelines).";
  } else if (level.includes("Endocrinology")) {
    levelNote = "Fellowship level. Integrate metabolic vasculopathy, insulin resistance pathways, and AACE/Endocrine Society 2025 standards.";
  }

  const systemText = `You are a Senior Academic Physician and Board Examiner. 
  Level: ${level}. ${levelNote}
  
  RULES:
  1. Generate ONE clinical vignette.
  2. STEM: 4-5 sentences with vitals and labs. Final sentence MUST be: "Which of the following is the ${selectedTask}?"
  3. CHOICES: Exactly 5 (A-E).
  4. EXPLANATION: Deconstruct each wrong answer and provide one high-yield clinical pearl.
  5. FORMAT: Return valid JSON only.`;

  const jsonTemplate = `{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"${topic}"}`;

  return {
    systemText: systemText + "\n\nJSON Template: " + jsonTemplate,
    userText: `Generate a high-yield question about: ${topic}`
  };
}

// --- 4. NETLIFY HANDLER ---
exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { level, topic } = JSON.parse(event.body);
    const { systemText, userText } = buildPrompt(level, topic);
    
    // SWITCH TO GEMINI FOR SPEED
    const activeAI = "gemini"; 
    
    let raw;
    if (activeAI === "gemini") {
      raw = await callGemini(systemText, userText);
    } else {
      raw = await callClaude(systemText, userText);
    }

    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([JSON.parse(cleaned)])
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
