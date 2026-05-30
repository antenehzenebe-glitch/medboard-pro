/* ============================================================================
   MedBoard Pro — Daily Board Question Widget  (v1.0)
   ----------------------------------------------------------------------------
   Embeddable, dependency-free lead-capture widget.

   USAGE (paste anywhere on any site):
     <div id="medboard-widget"></div>
     <script src="https://medboardpro.org/widget/medboard-widget.js"
             data-checkout="https://medboardpro.org/?utm_source=widget"
             data-endpoint="https://medboardpro.org/api/capture-lead"
             data-placement="youtube-desc"
             data-feed=""          (optional JSON feed of questions)
             data-theme="light"    (light | dark)
             defer></script>

   Funnel:
     1. Show a real board question (zero friction).
     2. User answers -> instant correct/incorrect + 1-line teaser.
     3. Soft email gate to unlock the full explanation.
     4. After email -> full explanation + strong trial CTA.
     5. Returning users (email already given) skip the gate -> keep coming back.
   ========================================================================== */
(function () {
  "use strict";

  // ---- locate this script tag + read config ------------------------------
  var thisScript =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var CFG = {
    checkout:
      attr("data-checkout") || "https://medboardpro.org/",
    endpoint: attr("data-endpoint") || "",
    placement: attr("data-placement") || "embed",
    feed: attr("data-feed") || "",
    theme: (attr("data-theme") || "light").toLowerCase(),
    brand: "MedBoard Pro"
  };

  function attr(name) {
    return thisScript ? thisScript.getAttribute(name) : null;
  }

  var LS_EMAIL = "mbp_lead_email";
  var LS_DONE = "mbp_unlocked";

  // ---- bundled seed questions (replace via data-feed) ---------------------
  // Each: { id, topic, stem, options[{k,text}], answer, teaser, explanation }
  var SEED = [
    {
      id: "endo-aldo",
      topic: "Endocrinology · Adrenal",
      stem:
        "A 49-year-old woman has blood pressure of 168/104 mmHg despite three antihypertensive agents. Serum potassium is 2.9 mEq/L and bicarbonate is 31 mEq/L. Plasma aldosterone is markedly elevated with a suppressed plasma renin activity (elevated aldosterone-to-renin ratio). Which is the most likely diagnosis?",
      options: [
        { k: "A", text: "Primary hyperaldosteronism" },
        { k: "B", text: "Pheochromocytoma" },
        { k: "C", text: "Cushing syndrome" },
        { k: "D", text: "Renovascular hypertension" },
        { k: "E", text: "Liddle syndrome" }
      ],
      answer: "A",
      teaser:
        "Resistant hypertension + hypokalemic metabolic alkalosis + high aldosterone with a suppressed renin is a classic triad.",
      explanation:
        "The hallmark is hypertension with hypokalemic metabolic alkalosis, an elevated aldosterone, and a SUPPRESSED renin — i.e., a high aldosterone-to-renin ratio (ARR), the screening test for primary hyperaldosteronism (Conn syndrome). " +
        "Renovascular hypertension (D) raises BOTH renin and aldosterone (secondary hyperaldosteronism), so renin is high, not suppressed. " +
        "Liddle syndrome (E) mimics the electrolytes but aldosterone AND renin are both LOW (a constitutively active ENaC channel). " +
        "Pheochromocytoma (B) causes episodic/paroxysmal hypertension with elevated catecholamines/metanephrines, not this electrolyte pattern. " +
        "Cushing syndrome (C) would show additional cortisol-excess features. Board pearl: low K + low renin + high aldosterone = primary aldosteronism until proven otherwise."
    },
    {
      id: "endo-pth",
      topic: "Endocrinology · Calcium",
      stem:
        "A 56-year-old man is found on routine labs to have a calcium of 11.4 mg/dL and phosphate of 2.3 mg/dL. Intact PTH is 88 pg/mL (inappropriately elevated). 24-hour urine calcium is elevated, and he has a history of nephrolithiasis. Which is the most likely diagnosis?",
      options: [
        { k: "A", text: "Familial hypocalciuric hypercalcemia" },
        { k: "B", text: "Primary hyperparathyroidism" },
        { k: "C", text: "Malignancy-associated hypercalcemia" },
        { k: "D", text: "Vitamin D toxicity" },
        { k: "E", text: "Milk-alkali syndrome" }
      ],
      answer: "B",
      teaser:
        "Hypercalcemia with an inappropriately non-suppressed PTH and HIGH urine calcium points to one place.",
      explanation:
        "Hypercalcemia with an inappropriately elevated (non-suppressed) PTH and a LOW phosphate is primary hyperparathyroidism, usually a single adenoma; stones and bone disease are classic. " +
        "The key discriminator from familial hypocalciuric hypercalcemia (A) is urine calcium: FHH shows LOW urinary calcium (calcium-to-creatinine clearance ratio <0.01) due to an inactivating CaSR mutation — here urine calcium is HIGH, ruling FHH out. " +
        "Malignancy-associated hypercalcemia (C) suppresses PTH (PTHrP-mediated). " +
        "Vitamin D toxicity (D) and milk-alkali (E) also suppress PTH. Board pearl: high Ca + high PTH = primary hyperparathyroidism; always check urine Ca to exclude FHH before recommending surgery."
    },
    {
      id: "endo-graves",
      topic: "Endocrinology · Thyroid",
      stem:
        "A 31-year-old woman reports a 12-lb weight loss, palpitations, and heat intolerance. She has a diffusely enlarged, non-tender goiter with a bruit and proptosis. TSH is suppressed, free T4 elevated, and radioactive iodine uptake is diffusely increased. Which is the most likely diagnosis?",
      options: [
        { k: "A", text: "Toxic multinodular goiter" },
        { k: "B", text: "Subacute (de Quervain) thyroiditis" },
        { k: "C", text: "Graves disease" },
        { k: "D", text: "Toxic adenoma" },
        { k: "E", text: "Factitious thyrotoxicosis" }
      ],
      answer: "C",
      teaser:
        "A diffuse goiter, eye disease, and diffusely INCREASED uptake travel together.",
      explanation:
        "Graves disease is the answer: diffuse goiter, orbitopathy (proptosis), and a DIFFUSELY increased radioiodine uptake driven by stimulating TSH-receptor antibodies (TSI). " +
        "Toxic MNG (A) and toxic adenoma (D) show focal/patchy uptake and no orbitopathy. " +
        "Subacute thyroiditis (B) is painful, post-viral, with LOW uptake (gland is leaking preformed hormone). " +
        "Factitious thyrotoxicosis (E) shows LOW uptake and a LOW thyroglobulin. Board pearl: thyrotoxicosis + ophthalmopathy + diffuse uptake = Graves; the uptake scan separates the high-uptake causes from the destructive/low-uptake causes."
    },
    {
      id: "im-siadh",
      topic: "Internal Medicine · Sodium",
      stem:
        "A 68-year-old man with small cell lung cancer has a serum sodium of 122 mEq/L. He is clinically euvolemic. Serum osmolality is 255 mOsm/kg, urine osmolality is 480 mOsm/kg, and urine sodium is 60 mEq/L. Thyroid, renal, and adrenal function are normal. Which is the most likely diagnosis?",
      options: [
        { k: "A", text: "Syndrome of inappropriate antidiuretic hormone (SIADH)" },
        { k: "B", text: "Cerebral salt wasting" },
        { k: "C", text: "Primary (psychogenic) polydipsia" },
        { k: "D", text: "Adrenal insufficiency" },
        { k: "E", text: "Thiazide-induced hyponatremia" }
      ],
      answer: "A",
      teaser:
        "Euvolemia + inappropriately concentrated urine + a known small cell tumor is a familiar combination.",
      explanation:
        "This is SIADH: euvolemic hypotonic hyponatremia with an inappropriately concentrated urine (urine osm > serum osm) and urine sodium >30 mEq/L, in a patient with small cell lung cancer (a classic ectopic ADH source). " +
        "Cerebral salt wasting (B) presents with HYPOvolemia (true volume depletion). " +
        "Primary polydipsia (C) produces a maximally DILUTE urine (urine osm typically <100). " +
        "Adrenal insufficiency (D) and hypothyroidism are excluded here by normal testing. " +
        "Thiazide-induced hyponatremia (E) would require an offending diuretic. Board pearl: euvolemic + concentrated urine + normal thyroid/adrenal = SIADH; treat the cause and restrict water."
    },
    {
      id: "im-dka",
      topic: "Internal Medicine · Emergencies",
      stem:
        "A 22-year-old with type 1 diabetes presents after missing insulin doses. Glucose is 480 mg/dL, arterial pH 7.18, bicarbonate 12 mEq/L, serum ketones positive, and potassium 5.2 mEq/L. Which is the most appropriate INITIAL step in management?",
      options: [
        { k: "A", text: "Begin intravenous isotonic saline" },
        { k: "B", text: "Give an intravenous insulin bolus before fluids" },
        { k: "C", text: "Replace potassium before starting insulin" },
        { k: "D", text: "Administer intravenous sodium bicarbonate" },
        { k: "E", text: "Start oral hydration and observe" }
      ],
      answer: "A",
      teaser:
        "Before insulin does its work, one intervention takes priority in every DKA pathway.",
      explanation:
        "Aggressive intravenous isotonic fluid resuscitation is the initial step in DKA; these patients have a large total-body water and volume deficit, and fluids alone lower glucose and improve perfusion. " +
        "Insulin (B) follows fluid initiation — but is HELD only if potassium is <3.3 mEq/L; here K is 5.2, so insulin can proceed after fluids are running. " +
        "Pre-emptive potassium (C) is unnecessary at K 5.2 (you add K once it falls below ~5.2–5.3 with adequate urine output). " +
        "Bicarbonate (D) is reserved for severe acidemia (pH <6.9). " +
        "Oral hydration (E) is inadequate for this degree of acidosis. Board pearl: in DKA think Fluids → Insulin → Potassium, and always check K before insulin."
    }
  ];

  // ---- theme tokens (Howard University identity) --------------------------
  var NAVY = "#002868";
  var RED = "#E60026";
  var dark = CFG.theme === "dark";

  var T = dark
    ? {
        bg: "#0b1530",
        card: "#0f1d3f",
        ink: "#eef2fb",
        sub: "#aab6d6",
        line: "rgba(255,255,255,0.12)",
        optBg: "rgba(255,255,255,0.04)",
        optHover: "rgba(255,255,255,0.09)",
        accent: "#7fa0ff",
        navy: "#9db4ff",
        red: RED
      }
    : {
        bg: "#ffffff",
        card: "#ffffff",
        ink: "#0c1733",
        sub: "#5a6780",
        line: "rgba(0,40,104,0.14)",
        optBg: "#f6f8fd",
        optHover: "#eef2fb",
        accent: NAVY,
        navy: NAVY,
        red: RED
      };

  // ---- build host + shadow root -------------------------------------------
  var host = document.getElementById("medboard-widget");
  if (!host) {
    host = document.createElement("div");
    host.id = "medboard-widget";
    if (thisScript && thisScript.parentNode) {
      thisScript.parentNode.insertBefore(host, thisScript.nextSibling);
    } else {
      document.body.appendChild(host);
    }
  }
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var style = document.createElement("style");
  style.textContent = css();
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "mbp";
  root.appendChild(wrap);

  // ---- state --------------------------------------------------------------
  var QUESTIONS = SEED.slice();
  var current = null;
  var selected = null;
  var unlocked = safeGet(LS_DONE) === "1";

  // ---- init: optional remote feed, else seed ------------------------------
  if (CFG.feed) {
    fetchJSON(CFG.feed)
      .then(function (data) {
        if (Array.isArray(data) && data.length) QUESTIONS = data;
      })
      .catch(function () {})
      .then(start);
  } else {
    start();
  }

  function start() {
    current = pickDaily(QUESTIONS);
    selected = null;
    renderQuestion();
  }

  // ---- daily rotation (same question all day, rotates each day) -----------
  function pickDaily(list) {
    var now = new Date();
    var dayOfYear = Math.floor(
      (now - new Date(now.getFullYear(), 0, 0)) / 86400000
    );
    return list[dayOfYear % list.length];
  }

  // ---- renderers ----------------------------------------------------------
  function renderQuestion() {
    var optsHTML = current.options
      .map(function (o) {
        return (
          '<button class="opt" data-k="' +
          o.k +
          '"><span class="key">' +
          o.k +
          "</span><span class=\"txt\">" +
          esc(o.text) +
          "</span></button>"
        );
      })
      .join("");

    wrap.innerHTML =
      header() +
      '<div class="topic">' +
      esc(current.topic) +
      "</div>" +
      '<p class="stem">' +
      esc(current.stem) +
      "</p>" +
      '<div class="opts">' +
      optsHTML +
      "</div>" +
      footer();

    qsa(".opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onAnswer(btn.getAttribute("data-k"));
      });
    });
    bindFooter();
  }

  function onAnswer(k) {
    selected = k;
    var correct = k === current.answer;

    qsa(".opt").forEach(function (btn) {
      var bk = btn.getAttribute("data-k");
      btn.disabled = true;
      if (bk === current.answer) btn.classList.add("right");
      else if (bk === selected) btn.classList.add("wrong");
    });

    var verdict =
      '<div class="verdict ' +
      (correct ? "ok" : "no") +
      '"><strong>' +
      (correct ? "Correct." : "Not quite.") +
      "</strong> The answer is " +
      current.answer +
      '. <span class="teaser">' +
      esc(current.teaser) +
      "</span></div>";

    var body;
    if (unlocked) {
      body = explanationBlock() + ctaBlock();
    } else {
      body = gateBlock();
    }

    // insert after opts
    var anchor = qs(".opts");
    var holder = document.createElement("div");
    holder.innerHTML = verdict + body;
    anchor.parentNode.insertBefore(holder, anchor.nextSibling);

    if (unlocked) bindCTA();
    else bindGate();
  }

  function gateBlock() {
    return (
      '<div class="gate">' +
      '<div class="gate-h">Unlock the full explanation</div>' +
      '<div class="gate-s">Get the complete answer breakdown plus a new high-yield board question every day. Free.</div>' +
      '<div class="gate-row">' +
      '<input class="email" type="email" inputmode="email" autocomplete="email" placeholder="you@medschool.edu" />' +
      '<button class="unlock">Unlock</button>' +
      "</div>" +
      '<div class="err" hidden></div>' +
      '<div class="fine">No spam. One question a day. Unsubscribe anytime.</div>' +
      "</div>"
    );
  }

  function explanationBlock() {
    return (
      '<div class="exp">' +
      '<div class="exp-h">Full explanation</div>' +
      "<p>" +
      esc(current.explanation) +
      "</p>" +
      "</div>"
    );
  }

  function ctaBlock() {
    var url = withUTM(CFG.checkout);
    var plansUrl = withUTM(CFG.checkout, "plans");
    return (
      '<div class="cta">' +
      '<div class="cta-h">Master the boards one question at a time</div>' +
      '<div class="cta-s">MedBoard Pro generates unlimited, exam-calibrated questions with explanations like this — for USMLE, ABIM Internal Medicine, and Endocrinology.</div>' +
      '<div class="cta-row">' +
      '<a class="btn primary" href="' +
      url +
      '" target="_blank" rel="noopener">Start your free trial</a>' +
      '<a class="btn ghost" href="' +
      plansUrl +
      '" target="_blank" rel="noopener">See plans</a>' +
      "</div>" +
      "</div>"
    );
  }

  // ---- bindings -----------------------------------------------------------
  function bindGate() {
    var input = qs(".email");
    var btn = qs(".unlock");
    var err = qs(".err");
    if (!btn) return;

    function submit() {
      var email = (input.value || "").trim();
      if (!validEmail(email)) {
        err.hidden = false;
        err.textContent = "Please enter a valid email address.";
        input.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "Unlocking…";
      captureLead(email).then(function () {
        safeSet(LS_EMAIL, email);
        safeSet(LS_DONE, "1");
        unlocked = true;
        var gate = qs(".gate");
        var holder = document.createElement("div");
        holder.innerHTML = explanationBlock() + ctaBlock();
        gate.parentNode.replaceChild(holder, gate);
        bindCTA();
      });
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });
  }

  function bindCTA() {
    qsa(".btn").forEach(function (a) {
      a.addEventListener("click", function () {
        track("cta_click", { href: a.getAttribute("href") });
      });
    });
  }

  function bindFooter() {
    var f = qs(".pw");
    if (f)
      f.addEventListener("click", function () {
        track("footer_click", {});
      });
  }

  // ---- networking ---------------------------------------------------------
  function captureLead(email) {
    track("lead_submit", { email: email });
    if (!CFG.endpoint) return Promise.resolve();
    return fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        placement: CFG.placement,
        question_id: current ? current.id : null,
        source_url: location.href,
        referrer: document.referrer || null,
        ts: new Date().toISOString()
      })
    })
      .then(function () {})
      .catch(function () {}); // never block the unlock on a network error
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      return r.json();
    });
  }

  // ---- helpers ------------------------------------------------------------
  function header() {
    return (
      '<div class="head">' +
      '<div class="brand"><span class="mark">M</span>' +
      esc(CFG.brand) +
      "</div>" +
      '<div class="badge">Daily Board Question</div>' +
      "</div>"
    );
  }

  function footer() {
    return (
      '<a class="pw" href="' +
      withUTM(CFG.checkout, "footer") +
      '" target="_blank" rel="noopener">Powered by ' +
      esc(CFG.brand) +
      " — a new question every day →</a>"
    );
  }

  function withUTM(base, content) {
    var sep = base.indexOf("?") > -1 ? "&" : "?";
    var p =
      "utm_source=widget&utm_medium=embed&utm_campaign=daily_mcq&utm_content=" +
      encodeURIComponent(CFG.placement + (content ? ":" + content : ""));
    return base + sep + p;
  }

  function track(event, data) {
    try {
      if (window.dataLayer) window.dataLayer.push({ event: "mbp_" + event });
      if (typeof window.gtag === "function")
        window.gtag("event", "mbp_" + event, data || {});
    } catch (e) {}
  }

  function validEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function qs(sel) {
    return wrap.querySelector(sel);
  }
  function qsa(sel) {
    return Array.prototype.slice.call(wrap.querySelectorAll(sel));
  }
  function safeGet(k) {
    try {
      return window.localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function safeSet(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch (e) {}
  }

  // ---- styles -------------------------------------------------------------
  function css() {
    return (
      ".mbp{box-sizing:border-box;max-width:540px;margin:0 auto;background:" +
      T.card +
      ";color:" +
      T.ink +
      ";border:1px solid " +
      T.line +
      ";border-top:4px solid " +
      T.red +
      ";border-radius:14px;padding:22px 22px 16px;font-family:Georgia,'Times New Roman',serif;line-height:1.5;box-shadow:0 10px 30px rgba(0,40,104,0.10);}" +
      ".mbp *{box-sizing:border-box;}" +
      ".head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;}" +
      ".brand{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.2px;color:" +
      T.navy +
      ";font-size:15px;}" +
      ".mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:" +
      T.navy +
      ";color:#fff;font-weight:800;font-family:Georgia,serif;}" +
      ".badge{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:" +
      T.red +
      ";border:1px solid " +
      T.red +
      ";border-radius:999px;padding:4px 10px;}" +
      ".topic{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:" +
      T.sub +
      ";margin-bottom:8px;}" +
      ".stem{font-size:16px;margin:0 0 16px;}" +
      ".opts{display:flex;flex-direction:column;gap:8px;}" +
      ".opt{display:flex;align-items:flex-start;gap:11px;width:100%;text-align:left;cursor:pointer;background:" +
      T.optBg +
      ";border:1px solid " +
      T.line +
      ";border-radius:10px;padding:11px 13px;color:" +
      T.ink +
      ";font-family:Georgia,serif;font-size:15px;transition:background .15s,border-color .15s,transform .05s;}" +
      ".opt:hover:not(:disabled){background:" +
      T.optHover +
      ";border-color:" +
      T.navy +
      ";}" +
      ".opt:active:not(:disabled){transform:translateY(1px);}" +
      ".opt:disabled{cursor:default;}" +
      ".key{flex:0 0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:800;font-size:13px;width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:" +
      T.navy +
      ";color:#fff;margin-top:1px;}" +
      ".opt.right{border-color:#1a7f37;background:rgba(26,127,55,.12);}" +
      ".opt.right .key{background:#1a7f37;}" +
      ".opt.wrong{border-color:" +
      T.red +
      ";background:rgba(230,0,38,.10);}" +
      ".opt.wrong .key{background:" +
      T.red +
      ";}" +
      ".verdict{margin:16px 0 4px;font-size:15px;}" +
      ".verdict.ok strong{color:#1a7f37;}" +
      ".verdict.no strong{color:" +
      T.red +
      ";}" +
      ".teaser{display:block;margin-top:6px;color:" +
      T.sub +
      ";font-style:italic;}" +
      ".gate{margin-top:14px;background:" +
      T.optBg +
      ";border:1px dashed " +
      T.navy +
      ";border-radius:12px;padding:16px;}" +
      ".gate-h{font-weight:700;font-size:16px;color:" +
      T.navy +
      ";margin-bottom:4px;}" +
      ".gate-s{font-size:14px;color:" +
      T.sub +
      ";margin-bottom:12px;}" +
      ".gate-row{display:flex;gap:8px;flex-wrap:wrap;}" +
      ".email{flex:1 1 200px;min-width:0;padding:11px 12px;border:1px solid " +
      T.line +
      ";border-radius:9px;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:" +
      T.card +
      ";color:" +
      T.ink +
      ";}" +
      ".email:focus{outline:none;border-color:" +
      T.navy +
      ";box-shadow:0 0 0 3px rgba(0,40,104,.15);}" +
      ".unlock{flex:0 0 auto;cursor:pointer;border:0;border-radius:9px;padding:11px 20px;font-weight:800;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:" +
      T.red +
      ";color:#fff;transition:filter .15s;}" +
      ".unlock:hover{filter:brightness(1.06);}" +
      ".unlock:disabled{opacity:.6;cursor:default;}" +
      ".err{color:" +
      T.red +
      ";font-size:13px;margin-top:8px;font-family:-apple-system,sans-serif;}" +
      ".fine{color:" +
      T.sub +
      ";font-size:12px;margin-top:10px;font-family:-apple-system,sans-serif;}" +
      ".exp{margin-top:16px;padding-top:14px;border-top:1px solid " +
      T.line +
      ";}" +
      ".exp-h,.cta-h{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:" +
      T.red +
      ";margin-bottom:8px;}" +
      ".exp p{margin:0;font-size:15px;}" +
      ".cta{margin-top:16px;background:" +
      T.navy +
      ";border-radius:12px;padding:18px;color:#fff;}" +
      ".cta-h{color:#fff;font-family:Georgia,serif;text-transform:none;letter-spacing:0;font-size:18px;font-weight:700;}" +
      ".cta-s{font-size:14px;color:rgba(255,255,255,.85);margin:6px 0 14px;}" +
      ".cta-row{display:flex;gap:10px;flex-wrap:wrap;}" +
      ".btn{flex:1 1 auto;text-align:center;text-decoration:none;border-radius:9px;padding:12px 16px;font-weight:800;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}" +
      ".btn.primary{background:" +
      T.red +
      ";color:#fff;}" +
      ".btn.primary:hover{filter:brightness(1.06);}" +
      ".btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);}" +
      ".btn.ghost:hover{background:rgba(255,255,255,.1);}" +
      ".pw{display:block;margin-top:16px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12.5px;color:" +
      T.sub +
      ";text-decoration:none;}" +
      ".pw:hover{color:" +
      T.navy +
      ";}" +
      "@media(max-width:480px){.mbp{padding:18px 16px 14px;}.stem{font-size:15px;}}"
    );
  }
})();
