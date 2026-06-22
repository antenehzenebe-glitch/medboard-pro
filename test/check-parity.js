// check-parity.js — fail CI if the parity-locked blocks drift between the two
// generators. Per CLAUDE.md, TOPIC_GUARDRAILS / GUIDELINE_MAP /
// ALLOWED_GUIDELINE_CITATIONS / BANNED_CITATION_PATTERNS / INTERCHANGEABLE_AGENT_CLASSES /
// ALLOWED_LEAD_INS_BY_LEVEL / maxTokens ladder / VIGNETTE DIVERSITY
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

// Like extractBlock, but for a non-braced expression terminated by the first
// semicolon after the anchor (e.g. the `const maxTokens = … ;` ternary ladder).
function extractExpr(src, anchorRe) {
  const m = src.match(anchorRe);
  if (!m) return null;
  const semi = src.indexOf(";", m.index);
  if (semi === -1) return null;
  return src.slice(m.index, semi + 1)
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
  ["pickDemographicSeed",          /function\s+pickDemographicSeed\s*\(/],
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

// Block 18 — maxTokens ladder. It is a bare ternary (no braces), so extractBlock
// cannot reach it; lock it with extractExpr instead. Guards the per-level token
// budgets — notably Step 2 CK = 2800 — against silent one-sided drift.
{
  const re = /const\s+maxTokens\s*=/;
  const b = extractExpr(BULK, re);
  const g = extractExpr(GEN, re);
  if (b === null || g === null) {
    console.error(`✗ maxTokens ladder: not found in ${b === null ? "bulk-generate.js" : "generate-mcq.js"}`);
    failures++;
  } else if (b !== g) {
    console.error(`✗ maxTokens ladder: PARITY DRIFT between the two generators`);
    failures++;
  } else {
    console.log(`✓ maxTokens ladder`);
  }
}

// Block 19 — VIGNETTE DIVERSITY constraint must appear in all five level blocks
// of BOTH generators. levelRules uses a different encoding per file (backtick
// template in generate-mcq.js vs escaped-newline string in bulk-generate.js), so a
// byte-identical block compare is impossible; assert instead that the diversity
// directive and the opening-sentence clause each appear the same number of times
// (one per level = 5) in both files.
{
  const countOf = (src, needle) => src.split(needle).length - 1;
  const diversityChecks = [
    ["VIGNETTE DIVERSITY directive", "VIGNETTE DIVERSITY: do not default to the single most stereotyped teaching case"],
    ["opening-sentence clause",      "Do not reuse a near-identical opening sentence across items"],
  ];
  for (const [label, needle] of diversityChecks) {
    const b = countOf(BULK, needle);
    const g = countOf(GEN, needle);
    if (b !== g) {
      console.error(`✗ diversity (${label}): one-sided drift — bulk=${b}, gen=${g}`);
      failures++;
    } else if (b < 5) {
      console.error(`✗ diversity (${label}): expected >=5 (one per level), found ${b} in both`);
      failures++;
    } else {
      console.log(`✓ diversity (${label}) — ${b}x in both`);
    }
  }
}

if (failures) { console.error(`\nPARITY CHECK FAILED: ${failures} block(s) drifted.`); process.exit(1); }
console.log("\nParity OK — all shared blocks identical.");
