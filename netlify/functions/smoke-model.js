// netlify/functions/smoke-model.js
// ---------------------------------------------------------------------------
// MedBoard Pro - single-shot model compatibility probe.
//
// WHY: model bumps (e.g. claude-sonnet-4-6 -> claude-sonnet-5) can silently
// break the generators because both force `tool_choice:{type:"tool"}` AND set
// temperature != 1 -- the exact two params that become illegal once a model
// runs extended thinking. This endpoint reproduces the generators' request
// shape against an allowlisted model so the compatibility question can be
// settled with ONE GET, BEFORE any bulk dispatch. The ANTHROPIC_API_KEY never
// leaves the server.
//
// The synchronous /v1/messages path is sufficient: the Batch API validates the
// same per-request params (model, tool_choice, temperature, thinking) the same
// way, so a clean sync probe clears the batch path too.
//
// ENV REQUIRED:
//   ANTHROPIC_API_KEY   (already set for generate-mcq)
//   SMOKE_TOKEN         (any random string; rotatable; low blast radius)
//
// USAGE (faithful production shape = key + model only):
//   /.netlify/functions/smoke-model?key=SMOKE_TOKEN&model=claude-sonnet-5
//
// DIAGNOSTIC KNOBS (only for bisecting a failure):
//   &tc=auto        tool_choice -> {type:"auto"} instead of forced
//   &temp=1         override temperature (clamped to [0,1])
//   &effort=high    send explicit effort (low|medium|high)
//   &think=off      send thinking:{type:"disabled"} to isolate the constraint
//
// Always returns HTTP 200 at the wrapper level (so web_fetch gets the body);
// the real Anthropic status is in `http_status`.
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SMOKE_TOKEN       = process.env.SMOKE_TOKEN;

// Only these models may be probed (blocks typos / abuse).
const MODEL_ALLOWLIST = new Set([
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-opus-4-8",
  "claude-haiku-4-5",
]);
const EFFORT_ALLOWLIST = new Set(["low", "medium", "high"]);
const HARD_MAX_TOKENS  = 2048; // caps cost/probe (~$0.02 at Sonnet 5 intro rates)

// Minimal emit_mcq-shaped tool. The compatibility surface (forced tool_choice +
// temp!=1 + effort/thinking on the target model) is identical regardless of
// schema richness, so we avoid coupling to the production MCQ_TOOL.
const MCQ_TOOL = {
  name: "emit_mcq",
  description: "Emit a single board-style multiple-choice question.",
  input_schema: {
    type: "object",
    properties: {
      stem: { type: "string" },
      choices: {
        type: "object",
        properties: {
          A: { type: "string" }, B: { type: "string" }, C: { type: "string" },
          D: { type: "string" }, E: { type: "string" },
        },
        required: ["A", "B", "C", "D", "E"],
      },
      correct_answer: { type: "string", enum: ["A", "B", "C", "D", "E"] },
      explanation: { type: "string" },
    },
    required: ["stem", "choices", "correct_answer", "explanation"],
  },
};

const PROMPT =
  "Write one ABIM Internal Medicine board-style single-best-answer MCQ on the " +
  "acute management of diabetic ketoacidosis. Five options A-E, exactly one " +
  "correct. Call emit_mcq exactly once.";

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj, null, 2),
  };
}

exports.handler = async (event) => {
  const t0 = Date.now();
  const q = (event && event.queryStringParameters) || {};

  // --- gate ---
  if (!ANTHROPIC_API_KEY) return json(500, { ok: false, error: "server missing ANTHROPIC_API_KEY" });
  if (!SMOKE_TOKEN)       return json(500, { ok: false, error: "server missing SMOKE_TOKEN" });
  if (q.key !== SMOKE_TOKEN) return json(401, { ok: false, error: "bad or missing key" });

  // --- validated knobs (defaults reproduce the production generation shape) ---
  const model = q.model || "claude-sonnet-5";
  if (!MODEL_ALLOWLIST.has(model)) {
    return json(400, { ok: false, error: "model not allowlisted", allowed: [...MODEL_ALLOWLIST] });
  }

  const tcMode = (q.tc || "tool").toLowerCase();
  if (!["tool", "auto"].includes(tcMode)) return json(400, { ok: false, error: "tc must be tool|auto" });
  const tool_choice = tcMode === "tool" ? { type: "tool", name: "emit_mcq" } : { type: "auto" };

  let temperature = q.temp === undefined ? 0.6 : Number(q.temp);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
    return json(400, { ok: false, error: "temp must be a number in [0,1]" });
  }

  const body = {
    model,
    max_tokens: HARD_MAX_TOKENS,
    temperature,
    tools: [MCQ_TOOL],
    tool_choice,
    messages: [{ role: "user", content: PROMPT }],
  };

  // optional effort passthrough (the untested Sonnet-5 variable; omitted by
  // default so the probe matches production, which sets no effort)
  if (q.effort !== undefined) {
    if (!EFFORT_ALLOWLIST.has(q.effort)) return json(400, { ok: false, error: "effort must be low|medium|high" });
    body.effort = q.effort;
  }

  // optional thinking disable (to isolate a tool_choice/temperature conflict)
  if (q.think === "off") body.thinking = { type: "disabled" };

  // --- single call ---
  let res, data, apiErrText;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json(200, { ok: false, phase: "fetch", error: String(e), ms: Date.now() - t0 });
  }

  const rawText = await res.text();
  try { data = JSON.parse(rawText); } catch { apiErrText = rawText; }

  const out = {
    ok: res.ok,
    probe: {
      model,
      tool_choice: tcMode,
      temperature,
      effort: body.effort || "(unset -> model default)",
      thinking: body.thinking ? "disabled" : "(unset)",
    },
    http_status: res.status,
    ms: Date.now() - t0,
  };

  if (!res.ok) {
    out.api_error = (data && data.error) || apiErrText || "(no body)";
    const errStr = JSON.stringify(out.api_error);
    out.hint =
      /temperature/i.test(errStr)               ? "temperature vs thinking conflict"      :
      /tool_choice|thinking/i.test(errStr)      ? "forced tool_choice vs thinking conflict" :
      /not_found|model/i.test(errStr)           ? "model id not found"                    :
      /rate/i.test(errStr)                      ? "rate limited"                          : undefined;
    return json(200, out);
  }

  const blocks = Array.isArray(data.content) ? data.content : [];
  const toolBlock = blocks.find((b) => b.type === "tool_use" && b.name === "emit_mcq");
  out.stop_reason          = data.stop_reason;
  out.content_block_types  = blocks.map((b) => b.type);
  out.emit_mcq_present     = !!toolBlock;
  out.usage                = data.usage;   // input/output tokens -> gauge effort=high cost
  out.model_echo           = data.model;
  if (toolBlock) {
    const mcq = toolBlock.input || {};
    out.sample = {
      correct_answer: mcq.correct_answer,
      stem_head: (mcq.stem || "").slice(0, 90),
      choice_count: mcq.choices ? Object.keys(mcq.choices).length : 0,
      has_explanation: !!mcq.explanation,
    };
  }
  return json(200, out);
};
