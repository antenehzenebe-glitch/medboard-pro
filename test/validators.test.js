// validators.test.js — unit tests for the pure clinical validators, loaded out of
// the live generator without modifying it. Codifies the behaviors documented in
// CLAUDE.md so a regression fails CI. Uses Node's built-in test runner (no deps).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Load named function/const sources from generate-mcq.js into a sandbox.
const SRC = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "generate-mcq.js"), "utf8");
function grab(src, re) {
  const m = src.match(re); if (!m) throw new Error("anchor not found: " + re);
  let i = m.index;
  while (i < src.length && src[i] !== "{" && src[i] !== "[") i++;
  const open = src[i], close = open === "{" ? "}" : "]";
  let d = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c===open) d++; else if (c===close){ d--; if(!d){j++;break;} } }
  return src.slice(m.index, j);
}
const pieces = [
  grab(SRC, /const\s+INTERCHANGEABLE_AGENT_CLASSES\s*=/),
  grab(SRC, /const\s+BANNED_CITATION_PATTERNS\s*=/),
  grab(SRC, /function\s+_guardKeyText\s*\(/),
  grab(SRC, /function\s+flagCardiorenalMiskey\s*\(/),
  grab(SRC, /function\s+flagGdmCoherence\s*\(/),
  grab(SRC, /function\s+validateNoPhantomCitations\s*\(/),
  grab(SRC, /function\s+flagTopicMismatch\s*\(/),
];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(pieces.join("\n") +
  "\nthis.flagCardiorenalMiskey=flagCardiorenalMiskey;this.flagGdmCoherence=flagGdmCoherence;" +
  "this.validateNoPhantomCitations=validateNoPhantomCitations;this.flagTopicMismatch=flagTopicMismatch;", ctx);

test("flagCardiorenalMiskey H1: GLP-1 keyed over an offered SGLT2i in HFrEF -> hard reject", () => {
  const p = {
    stem: "A 62-year-old man with HFrEF (LVEF 30%) and type 2 diabetes. Which is the most appropriate add-on?",
    choices: { A: "Dapagliflozin (an SGLT2i)", B: "Semaglutide (a GLP-1 receptor agonist)", C: "Glipizide", D: "Sitagliptin", E: "Pioglitazone" },
    correct: "B",
    explanation: "GLP-1 RA chosen."
  };
  const r = ctx.flagCardiorenalMiskey(p);
  assert.ok(r.hard.length > 0, "expected a hard-reject for GLP-1-over-SGLT2i in HFrEF");
});

test("flagCardiorenalMiskey: SGLT2i correctly keyed in HFrEF -> no hard reject", () => {
  const p = {
    stem: "A 62-year-old man with HFrEF (LVEF 30%) and type 2 diabetes. Which is the most appropriate add-on?",
    choices: { A: "Dapagliflozin (an SGLT2i)", B: "Semaglutide (a GLP-1 receptor agonist)", C: "Glipizide", D: "Sitagliptin", E: "Pioglitazone" },
    correct: "A",
    explanation: "SGLT2i is Class I in HFrEF."
  };
  assert.strictEqual(ctx.flagCardiorenalMiskey(p).hard.length, 0);
});

test("flagGdmCoherence: male patient in a Gestational Diabetes stem -> flagged", () => {
  const p = { topic: "Gestational Diabetes", stem: "A 45-year-old man presents for evaluation of hyperglycemia." };
  assert.ok(ctx.flagGdmCoherence(p).length > 0);
});

test("flagGdmCoherence: genuine pregnancy GDM stem -> not flagged", () => {
  const p = { topic: "Gestational Diabetes", stem: "A 29-year-old woman at 28 weeks gestation has an abnormal glucose tolerance test." };
  assert.strictEqual(ctx.flagGdmCoherence(p).length, 0);
});

test("validateNoPhantomCitations: fabricated 'ES 2024 pheochromocytoma' tuple -> rejected", () => {
  const p = { explanation: "Per the 2024 Endocrine Society pheochromocytoma guideline, obtain plasma metanephrines." };
  assert.strictEqual(ctx.validateNoPhantomCitations(p), false);
});

test("flagTopicMismatch: male in an obstetric/gestational stem -> hardReject", () => {
  const p = { topic: "Gestational Diabetes", stem: "A 50-year-old man at 30 weeks gestation ..." };
  const r = ctx.flagTopicMismatch(p);
  assert.ok(r.hardReject === true || r.hard === true || (r.reason && /male|gestational|obstetric/i.test(r.reason)));
});
