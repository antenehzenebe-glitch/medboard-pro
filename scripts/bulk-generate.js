// ============================================================
// bulk-generate.js — v7.3 PATCH GUIDE
// Apply these 3 surgical changes to bulk-generate.js v7.2
// ============================================================

// ─────────────────────────────────────────────────────────────
// CHANGE 1 of 3 — Add after the validateDemographics() function
// (after the closing brace of validateDemographics, before rewriteExplanationLetters)
// ─────────────────────────────────────────────────────────────

// v7.3 — HALLUCINATION GUARD (identical to generate-mcq.js)
const LAB_VALUE_PATTERN = /\b(tsh|free\s*t4|free\s*t3|total\s*t4|total\s*t3|hba1c|a1c|fasting\s*glucose|glucose|sodium|potassium|creatinine|egfr|calcium|phosphorus|cortisol|acth|igf-1|igf1|prolactin|lh|fsh|testosterone|estradiol|aldosterone|plasma\s*renin|renin|creatine\s*kinase|ck\b|alt|ast|alp|tbili|bilirubin|hemoglobin|hgb|hematocrit|wbc|platelets|inr|ptt|bun|bicarbonate|bicarb|co2|pco2|po2|ldl|hdl|triglyceride|total\s*cholesterol|cholesterol|trab|tpo\s*antibody|vitamin\s*d|25-oh\s*vitamin|pth|parathyroid\s*hormone|urine\s*cortisol|urine\s*albumin|albumin|ferritin|b12|folate|tsh\s*receptor\s*antibod)\s+(?:of\s+|was\s+|is\s+|:?\s*)(\d+\.?\d*)/gi;

function extractLabValues(text) {
  const values = {};
  LAB_VALUE_PATTERN.lastIndex = 0;
  let m;
  while ((m = LAB_VALUE_PATTERN.exec(text)) !== null) {
    const labName = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    if (!(labName in values)) values[labName] = m[2];
  }
  return values;
}

function validateConsistency(p) {
  if (!p || !p.stem || !p.explanation) return true;
  const stemValues = extractLabValues(p.stem);
  const explValues = extractLabValues(p.explanation);
  for (const lab of Object.keys(explValues)) {
    if (stemValues[lab] !== undefined && stemValues[lab] !== explValues[lab]) {
      console.warn(`[validateConsistency] Mismatch — ${lab}: stem="${stemValues[lab]}" vs explanation="${explValues[lab]}"`);
      return false;
    }
  }
  return true;
}


// ─────────────────────────────────────────────────────────────
// CHANGE 2 of 3 — In buildPrompt(), replace the maxTokens line
// ─────────────────────────────────────────────────────────────

// FIND (v7.2):
//   const maxTokens   = isABIM_Endo ? 1800 : isABIM_IM ? 1700 : isStep3 ? 1700 : 1400;

// REPLACE WITH (v7.3):
  const maxTokens   = isABIM_Endo ? 2400 : (isABIM_IM || isStep3) ? 2200 : 1800;


// ─────────────────────────────────────────────────────────────
// CHANGE 3 of 3 — In buildPrompt(), replace integrityRules
// ─────────────────────────────────────────────────────────────

// FIND (v7.2):
//   const integrityRules = `INTEGRITY RULES:
// A. Evidence discipline: cite only data explicitly in stem.
// B. "glucose" never "sugar".
// C. VLDL/LDL: ...
// D. COMPETITIVE DISTRACTORS ...
// E. EXPLANATION FORMATTING ...
// F. EXPLANATION-CHOICE CONSISTENCY ...`;

// REPLACE WITH (v7.3) — adds Rule G:
  const integrityRules = `INTEGRITY RULES:
A. Evidence discipline: cite only data explicitly in stem.
B. "glucose" never "sugar".
C. VLDL/LDL: You MUST accurately distinguish between VLDL and LDL.
D. COMPETITIVE DISTRACTORS (TIER 3 REQUIREMENT): Every wrong choice MUST be a highly plausible action or mechanism for a related, competing diagnosis. 
E. EXPLANATION FORMATTING (MANDATORY TO AVOID SHUFFLE BUGS): 
   - In the 🩺 section, YOU ARE FORBIDDEN FROM NAMING THE LETTER OF THE CORRECT CHOICE. Do not write "Choice A is correct". Simply explain the clinical reasoning.
   - In the 🚫 section, YOU MUST start each explanation EXACTLY with "Choice A:", "Choice B:", etc. Do not use bullets.
F. EXPLANATION-CHOICE CONSISTENCY: The explanation MUST strictly match the text of the corresponding choice.
G. STEM-EXPLANATION NUMERIC LOCK: Every lab value, vital sign, and numeric result cited in your explanation MUST be identical to the value stated in the stem. You are STRICTLY FORBIDDEN from writing a different number in the explanation than what appears in the stem. Before calling emit_mcq, re-read your stem and verify every number in your explanation matches exactly.`;


// ─────────────────────────────────────────────────────────────
// CHANGE 4 of 3 — In processRawMcq(), add validateConsistency
// ─────────────────────────────────────────────────────────────

// FIND (v7.2):
//   if (!validateDemographics(p.stem, p._sex || "man", topic)) return null;

// REPLACE WITH (v7.3):
  if (!validateDemographics(p.stem, p._sex || "man", topic)) return null;
  if (!validateConsistency(p)) return null;


// ─────────────────────────────────────────────────────────────
// Also update the file header comment from v7.2 to v7.3
// ─────────────────────────────────────────────────────────────

// FIND:
//   // bulk-generate.js — MedBoard Pro
//   // v7.2 — Stem Economy Fix: Pertinent Negative Sanity (B-hCG/PSA Trap)

// REPLACE WITH:
//   // bulk-generate.js — MedBoard Pro
//   // v7.3 — Truncation Budget Increase & Stem-Explanation Hallucination Guard
