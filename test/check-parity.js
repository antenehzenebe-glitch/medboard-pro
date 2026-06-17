// check-parity.js — fail CI if the parity-locked blocks drift between the two
// generators. Per CLAUDE.md, TOPIC_GUARDRAILS / GUIDELINE_MAP /
// ALLOWED_GUIDELINE_CITATIONS / BANNED_CITATION_PATTERNS / INTERCHANGEABLE_AGENT_CLASSES /
// ALLOWED_LEAD_INS_BY_LEVEL
// and the shared validator functions must stay byte-identical across:
//   scripts/bulk-generate.js  and  netlify/functions/generate-mcq.js
const fs = require("fs");
const path = require("path");

const BULK = fs.readFileSync(path.join(__dirname, "..", "scripts", "bulk-generate.js"), "utf8");
const GEN  = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "generate-mcq.js"), "utf8");

// Extract a top-level `const NAME = ... ;` or `function NAME(...) { ... }` block by
// brace/bracket matching from the first occurrence of an anchor.
function extractBlock(src, anchorRe) {
  const m = src.match(anchorRe);
  if (!m) return null;
  let i = m.index;
  // find first opening brace/bracket after the anchor
  while (i < src.length && src[i] !== "{" && src[i] !== "[") i++;
  if (i >= src.length) return null;
  const open = src[i], close = open === "{" ? "}" : "]";
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { j++; break; } }
  }
  // normalize: strip line comments + collapse whitespace so a comment-only
  // difference (e.g. a section header) does not fail parity
  return src.slice(i, j)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SHARED = [
  ["TOPIC_GUARDRAILS",              /const\s+TOPIC_GUARDRAILS\s*=/],
  ["GUIDELINE_MAP",                 /const\s+GUIDELINE_MAP\s*=/],
  ["ALLOWED_GUIDELINE_CITATIONS",   /const\s+ALLOWED_GUIDELINE_CITATIONS\s*=/],
  ["BANNED_CITATION_PATTERNS",      /const\s+BANNED_CITATION_PATTERNS\s*=/],
  ["INTERCHANGEABLE_AGENT_CLASSES", /const\s+INTERCHANGEABLE_AGENT_CLASSES\s*=/],
  ["ALLOWED_LEAD_INS_BY_LEVEL",     /const\s+ALLOWED_LEAD_INS_BY_LEVEL\s*=/],
  ["flagTopicMismatch",             /function\s+flagTopicMismatch\s*\(/],
  ["flagCardiorenalMiskey",         /function\s+flagCardiorenalMiskey\s*\(/],
  ["flagT1DCardiorenal",            /function\s+flagT1DCardiorenal\s*\(/],
  ["flagInterchangeableAgents",     /function\s+flagInterchangeableAgents\s*\(/],
  ["validateNoPhantomCitations",    /function\s+validateNoPhantomCitations\s*\(/],
  ["validateChoiceCompleteness",    /function\s+validateChoiceCompleteness\s*\(/],
  ["detectAntiCueingViolation",     /function\s+detectAntiCueingViolation\s*\(/],
  ["flagMetforminEgfr",             /function\s+flagMetforminEgfr\s*\(/],
  ["flagSlidingScaleInsulin",       /function\s+flagSlidingScaleInsulin\s*\(/],
  ["flagGdmCoherence",              /function\s+flagGdmCoherence\s*\(/],
  ["flagDrugCurrency",              /function\s+flagDrugCurrency\s*\(/],
];

let failures = 0;
for (const [name, re] of SHARED) {
  const b = extractBlock(BULK, re);
  const g = extractBlock(GEN, re);
  if (b === null || g === null) {
    console.error(`✗ ${name}: not found in ${b === null ? "bulk-generate.js" : "generate-mcq.js"}`);
    failures++; continue;
  }
  if (b !== g) { console.error(`✗ ${name}: PARITY DRIFT between the two generators`); failures++; }
  else console.log(`✓ ${name}`);
}
if (failures) { console.error(`\nPARITY CHECK FAILED: ${failures} block(s) drifted.`); process.exit(1); }
console.log("\nParity OK — all shared blocks identical.");
