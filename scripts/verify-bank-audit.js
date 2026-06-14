#!/usr/bin/env node
// scripts/verify-bank-audit.js — MedBoard Pro
// Offline bank audit: run the SAME blind verify-pass (verifyKeyConsistency) used by the
// generation pipeline over already-APPROVED/servable items, to measure the verifier's
// disagreement rate (candidate mis-keys / false positives) BEFORE promoting verify-pass
// from warn -> reject. Verifier logic is copied verbatim from bulk-generate.js so the
// measured rate reflects exactly what an in-pipeline hard-reject would do.
//
// Env:
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY   (same as the generator)
//   VERIFY_MODEL        verifier model id (default claude-opus-4-8 = cross-model)
//   AUDIT_LEVEL         exam_level filter ("" or "all" = every servable level)
//   AUDIT_LIMIT         cap items for a pilot run (default 0 = whole bank)
//   AUDIT_CONCURRENCY   parallel verifier calls (default 6)
//
// Output: per-disagreement lines + per-level summary to stdout, plus a JSON report
// (verify-bank-audit-report.json) in the working directory.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const VERIFY_MODEL      = process.env.VERIFY_MODEL || "claude-opus-4-8";
const AUDIT_LEVEL_RAW   = (process.env.AUDIT_LEVEL || "").trim();
const LEVEL_FILTER      = (AUDIT_LEVEL_RAW && AUDIT_LEVEL_RAW.toLowerCase() !== "all") ? AUDIT_LEVEL_RAW : "";
const AUDIT_LIMIT       = parseInt(process.env.AUDIT_LIMIT || "0", 10) || 0;
const AUDIT_CONCURRENCY = parseInt(process.env.AUDIT_CONCURRENCY || "6", 10) || 6;

if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY env var is required");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY env vars are required");

const fs = require("fs");

// ── Verbatim copy of the generator's blind verifier (bulk-generate.js) ──
const VERIFY_TOOL = {
  name: "emit_answer",
  description: "Emit the single best answer letter for the multiple-choice question.",
  input_schema: { type: "object", properties: { answer: { type: "string", enum: ["A","B","C","D","E"] } }, required: ["answer"] }
};
async function verifyKeyConsistency(record) {
  if (!record || !record.stem || !record.choices || !record.correct_answer) return null;
  const letters = ["A","B","C","D","E"];
  const lines = letters.filter(L => record.choices[L] != null).map(L => `${L}. ${record.choices[L]}`).join("\n");
  const sys = "You are an independent board examiner. Using current clinical practice guidelines, choose the single best answer to the multiple-choice question. Do not explain. Call emit_answer exactly once with only the letter.";
  const usr = `${record.stem}\n\n${lines}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: VERIFY_MODEL, max_tokens: 64, temperature: 0,
        tools: [VERIFY_TOOL], tool_choice: { type: "tool", name: "emit_answer" },
        system: sys, messages: [{ role: "user", content: usr }]
      })
    });
    if (!res.ok) return null;                          // fail-open
    const data = await res.json();
    const tb = data.content?.find(b => b.type === "tool_use" && b.name === "emit_answer");
    const ans = tb?.input?.answer;
    if (!ans || !/^[A-E]$/.test(ans)) return null;
    return { disagree: ans !== record.correct_answer, modelAnswer: ans, keyed: record.correct_answer };
  } catch (e) {
    return null;                                       // fail-open
  }
}
// one retry to keep transient verifier errors from inflating the skipped count
async function verifyWithRetry(record) {
  let r = await verifyKeyConsistency(record);
  if (r === null) { await new Promise(s => setTimeout(s, 800)); r = await verifyKeyConsistency(record); }
  return r;
}

async function fetchApproved() {
  const lvl = LEVEL_FILTER ? `&exam_level=eq.${encodeURIComponent(LEVEL_FILTER)}` : "";
  const cap = AUDIT_LIMIT > 0 ? `&limit=${AUDIT_LIMIT}` : `&limit=20000`;
  const url = `${SUPABASE_URL}/rest/v1/mcqs?select=id,exam_level,topic,stem,choices,correct_answer`
            + `&status=eq.approved&cueing_flag=not.is.true${lvl}&order=id.asc${cap}`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  for (const r of rows) { if (typeof r.choices === "string") { try { r.choices = JSON.parse(r.choices); } catch {} } }
  return rows;
}

async function pool(items, n, worker) {
  let idx = 0, done = 0;
  const out = new Array(items.length);
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await worker(items[i], i);
      done++;
      if (done % 25 === 0 || done === items.length) process.stdout.write(`\r  verified ${done}/${items.length}...`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  process.stdout.write("\n");
  return out;
}

(async () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   MedBoard Pro — Verify-Pass Bank Audit          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Verifier model: ${VERIFY_MODEL}`);
  console.log(`  Scope:          ${LEVEL_FILTER || "ALL servable levels"}${AUDIT_LIMIT ? `  (limit ${AUDIT_LIMIT})` : ""}`);
  console.log(`  Concurrency:    ${AUDIT_CONCURRENCY}`);

  const rows = await fetchApproved();
  console.log(`\n  Loaded ${rows.length} approved/servable item(s). Running blind verify-pass...\n`);

  const results = await pool(rows, AUDIT_CONCURRENCY, async (r) => {
    const v = await verifyWithRetry(r);
    return { id: r.id, exam_level: r.exam_level, topic: r.topic, stem: r.stem, v };
  });

  const disagreements = [];
  let answered = 0, skipped = 0;
  const perLevel = {};
  for (const row of results) {
    const L = row.exam_level || "(none)";
    perLevel[L] = perLevel[L] || { audited: 0, answered: 0, disagree: 0 };
    perLevel[L].audited++;
    if (!row.v) { skipped++; continue; }
    answered++; perLevel[L].answered++;
    if (row.v.disagree) {
      perLevel[L].disagree++;
      disagreements.push({ id: row.id, exam_level: L, topic: row.topic, keyed: row.v.keyed, verifier: row.v.modelAnswer, stem: row.stem });
    }
  }

  console.log("\n──────────────── DISAGREEMENTS (candidate mis-keys) ────────────────");
  if (!disagreements.length) {
    console.log("  none — verifier agreed with every keyed answer.");
  } else {
    for (const d of disagreements) {
      console.log(`[DISAGREE] ${d.exam_level} | ${d.topic} | keyed ${d.keyed} vs verifier ${d.verifier} | ${String(d.id).slice(0,8)} | "${String(d.stem||"").slice(0,90)}"`);
    }
  }

  console.log("\n──────────────── SUMMARY ────────────────");
  console.log(`  Audited:        ${results.length}`);
  console.log(`  Answered:       ${answered}`);
  console.log(`  Skipped (err):  ${skipped}`);
  const rate = answered ? (100 * disagreements.length / answered) : 0;
  console.log(`  Disagreements:  ${disagreements.length}  (${rate.toFixed(1)}% of answered)`);
  console.log("\n  Per level (disagree / answered):");
  for (const [L, s] of Object.entries(perLevel).sort()) {
    const pr = s.answered ? (100 * s.disagree / s.answered).toFixed(1) : "0.0";
    console.log(`    ${L.padEnd(26)} ${String(s.disagree).padStart(3)} / ${String(s.answered).padStart(4)}  (${pr}%)`);
  }
  if (disagreements.length) {
    console.log("\n  Disagreement IDs (for review):");
    console.log("  " + disagreements.map(d => d.id).join(","));
  }

  const report = { generated_at: new Date().toISOString(), model: VERIFY_MODEL, scope: LEVEL_FILTER || "ALL",
                   limit: AUDIT_LIMIT || null, audited: results.length, answered, skipped,
                   disagreements: disagreements.length, rate_pct: Number(rate.toFixed(2)), per_level: perLevel, items: disagreements };
  fs.writeFileSync("verify-bank-audit-report.json", JSON.stringify(report, null, 2));
  console.log("\n  Full report written to verify-bank-audit-report.json");
})().catch(e => { console.error("AUDIT FAILED:", e); process.exit(1); });
