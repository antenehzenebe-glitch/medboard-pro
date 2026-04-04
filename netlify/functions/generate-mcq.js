// generate-mcq.js — MedBoard Pro
// Model: claude-sonnet-4-6
// Rebuilt: April 2026 — Dr. Anteneh Zenebe, MD, FACE
// Howard University College of Medicine

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function callClaude(systemText, userText) {
  var maxRetries = 3;
  var retryDelays = [800, 1500, 2500];
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  var finalUserText = userText + "\n\n[Seed: " + entropySeed + " — Generate a completely unique vignette.]";

  for (var attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(retryDelays[attempt - 1]);

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 750,
        temperature: 0.6,
        system: systemText,
        messages: [{ role: "user", content: finalUserText }]
      })
    });

    if (response.status === 529 || response.status === 503 || response.status === 502) {
      if (attempt === maxRetries - 1) throw new Error("API busy. Please try again.");
      continue;
    }
    if (!response.ok) {
      var err = await response.text();
      throw new Error("API error " + response.status + ": " + err);
    }

    var data = await response.json();
    if (!data.content || !data.content.length) throw new Error("Unexpected API response format");
    var textBlock = data.content.find(function(b) { return b.type === "text"; });
    if (!textBlock || !textBlock.text) throw new Error("No text content in response");
    return textBlock.text;
  }
}

// ─── ALL 20 EXEMPLARS indexed by tag ─────────────────────────────────────────

var ALL_EXEMPLARS = {
  adrenal: "EX(Adrenal mass): 54yo man, resistant HTN, 15kg gain, DM, bruising, 3.8cm left adrenal mass, atrophic right adrenal, aldosterone 14/renin<0.6. CORRECT: Plasma metanephrines + 1mg DST before surgery. WHY: >2.4cm adrenal tumor requires excluding pheo AND hypercortisolism — contralateral atrophy suggests ACTH-independent Cushing. Surgery without cortisol testing risks adrenal crisis. PEARL: Adrenal tumor >2.4cm = complete hormonal workup before any intervention.\n",

  pituitary: "EX(Pituitary incidentaloma): 28yo woman, 9mm pituitary adenoma abutting optic chiasm, normal labs, wants pregnancy. CORRECT: Surgical referral. WHY: Pituitary enlarges 3-fold in pregnancy — chiasm compression risk requires pre-conception surgery per Endocrine Society. PEARL: Nonfunctioning adenoma near chiasm + planned pregnancy = surgical referral before conception.\n",

  thyroid_dx: "EX(TSH resistance): 42yo man, TSH 12.1, free T4 normal, negative antibodies, normal US, child has same labs. CORRECT: TSH receptor resistance (TSHR inactivating variant). WHY: Elevated TSH + normal T4 + negative antibodies + family pattern excludes Hashimoto. RTH causes elevated T4 not normal T4. PEARL: Subclinical hypothyroid pattern + negative antibodies + family history = think TSHR gene mutation.\n",

  diabetes_screening: "EX(T1DM screening): 21yo woman, T1DM x3 years, HbA1c 6.8%, two consecutive normal eye exams. CORRECT: Fasting lipid profile. WHY: ADA — annual lipid profile from T1DM diagnosis day one. Nephropathy and neuropathy screening begin 5 years post-diagnosis. Two consecutive normal eye exams extend ophthalmology interval to 2 years. PEARL: Microvascular screening begins 5 years post-T1DM; lipid profile from day one.\n",

  virilization: "EX(Virilization): 38yo woman, rapid virilization 9 months, deepening voice, clitoromegaly, DHEAS 910 mcg/dL, testosterone 97. CORRECT: Abdominal CT first. WHY: DHEAS >700 = adrenal source. Pelvic US only when testosterone >200 with normal DHEAS. Venous sampling only after imaging. PEARL: DHEAS >700 with rapid virilization = adrenal carcinoma until proven otherwise — CT first.\n",

  thyroid_tx: "EX(Elderly hyperthyroidism): 83yo woman, overt hyperthyroidism confirmed x2, toxic MNG, CAD, osteoporosis. CORRECT: Start methimazole. WHY: Must achieve euthyroidism before RAI per ATA. Watchful waiting risks AFib and bone loss in CAD patient. PEARL: Elderly CAD + overt hyperthyroidism = methimazole first, never RAI without euthyroidism.\n",

  levothyroxine: "EX(Elderly hypothyroidism): 81yo man, CAD, TSH 25, FT4 0.5, bradycardia, delayed reflexes. CORRECT: Levothyroxine 25 mcg/day. WHY: ATA — start low go slow in elderly CAD regardless of TSH severity. Full dose risks MI from increased cardiac O2 demand and oxygen consumption. PEARL: Elderly + CAD + hypothyroidism = 25 mcg/day start always.\n",

  dka: "EX(DKA management): Patient with DKA in ED, BP 92/58, K+ 5.8, glucose 487, pH 7.22, on SGLT2i, fever, pyuria. CORRECT: IV NS 0.9% 1–1.5 L/hr FIRST, then check K+, then insulin 0.1 units/kg/hr only after K+ ≥3.5, hold SGLT2i entire episode, blood cultures. WHY: Fluids before insulin always — hypovolemia is immediate threat. K+ below 3.5 = hold insulin or fatal arrhythmia. PEARL: Fluids first, check K+ before insulin, SGLT2i hold until full biochemical resolution.\n",

  dka_outpatient: "EX(DKA outpatient setting): 42yo woman with T1DM presents to outpatient primary care clinic with 2 days nausea, vomiting, glucose 524, pH 7.18, bicarbonate 10, strongly positive ketones. CORRECT: Administer IV 0.9% NS and transfer to emergency department immediately. WHY: Outpatient clinic cannot safely manage DKA — patient needs inpatient IV insulin drip, continuous monitoring, electrolyte replacement. A 500 mL NS bolus alone before transfer is appropriate to stabilize, but starting insulin infusion in clinic is dangerous without monitoring capability. PEARL: DKA in outpatient setting = stabilize and transfer to ED. Never manage DKA in clinic.\n",

  cgm: "EX(CGM before insulin adjustment): 45yo man, T2DM, HbA1c 8.5%, symptomatic hypoglycemia at unpredictable times, on MDI metformin+glargine+lispro. CORRECT: Initiate CGM. WHY: Never adjust insulin blindly — ADA recommends CGM for all insulin users with hypoglycemia or above-target A1c. Increasing glargine worsens hypoglycemia without knowing timing. PEARL: Above-target HbA1c + hypoglycemia on insulin = CGM first.\n",

  agp: "EX(AGP interpretation): 28yo woman, T1DM on CSII pump (no AID), TBR 6%, nocturnal hypoglycemia 55–65 mg/dL at 2–4 AM, rebound morning hyperglycemia 190–230 mg/dL. CORRECT: Decrease nocturnal basal rate 12–4 AM. WHY: Fix TBR >4% before any hyperglycemia adjustment — golden rule. Morning hyperglycemia is Somogyi rebound. Increasing morning basal worsens the underlying hypoglycemia. PEARL: Always look at TBR first on AGP.\n",

  aid: "EX(AID micro-treat): 34yo man, T1DM on hybrid closed-loop AID system, treats CGM alert at 65 mg/dL with 15g carbs (Rule of 15 from MDI training), glucose skyrockets to >250 two hours later. CORRECT: AID algorithm suspended basal via PLGS 20–45 min before low — advise 5–8g carbs only. WHY: By the time CGM alerts at 65, pump already applied the brakes. 15g on suspended insulin = rebound. PEARL: Rule of 15 obsolete on AID systems. Micro-treat mild lows with 5–8g carbs.\n",

  lipids: "EX(Lipids — REDUCE-IT sequencing): 54yo Black man, T2DM, LDL 118, TG 285, no prior statin, poor dietary adherence. CORRECT: High-intensity statin + lifestyle first, recheck 4–12 weeks, THEN add IPE only if TG ≥150 on stable statin. WHY: REDUCE-IT required stable statin x4 weeks — cannot diagnose persistent hypertriglyceridemia without treating first. Lp(a) 62 nmol/L is mildly elevated — high risk threshold is >125 nmol/L per ESC/EAS. PEARL: Statin first, IPE only after confirming persistent hypertriglyceridemia on stable statin.\n",

  t2dm_dual: "EX(T2DM dual therapy): 51yo Hispanic woman, HbA1c 8.9%, UACR 42, eGFR 78, BMI 32, no CVD, on lisinopril. CORRECT: Metformin + semaglutide starting at 0.25 mg weekly (NOT 0.5 mg — FDA labeling requires 0.25 mg initiation to mitigate GI side effects). WHY: ADA — dual therapy when HbA1c >8.5% with cardiorenal risk. SGLT2i also indicated for albuminuria — note in explanation. PEARL: Semaglutide ALWAYS starts 0.25 mg weekly x4 weeks. Never 0.5 mg at initiation.\n",

  hfref_sglt2: "EX(HFrEF + T2DM): 64yo man, HFrEF LVEF 35%, HbA1c 7.4%, eGFR 58, on metformin+lisinopril+carvedilol+furosemide, euvolemic. CORRECT: Add empagliflozin 10 mg daily regardless of HbA1c. WHY: ADA — SGLT2i mandatory in HFrEF (LVEF <40%) regardless of glycemic control per EMPEROR-Reduced and DAPA-HF. Pioglitazone absolutely contraindicated in HF. GLP-1 RA has ASCVD benefit but NOT HF hospitalization reduction. PEARL: HFrEF + diabetes = SGLT2i non-negotiable regardless of A1c.\n",

  catabolic_dm: "EX(Catabolic T2DM): 48yo man, no prior DM, HbA1c 11.8%, 15-lb weight loss, glucose 345, trace ketones, normal anion gap, stable vitals, outpatient clinic. CORRECT: Basal insulin glargine 10 units daily. WHY: ADA — insulin first when HbA1c >10%, glucose ≥300, OR active catabolism. GLP-1 RA contraindicated in active catabolic state — promotes weight loss worsening catabolism. SGLT2i risks euglycemic DKA with trace ketones. PEARL: Weight loss + polyuria + HbA1c >10% = insulin first. Active catabolism = absolute insulin deficiency.\n",

  pancreatitis: "EX(Acute pancreatitis): 22yo woman, lipase 1240, TG 1500 (HTG-induced), meets Revised Atlanta criteria. CORRECT: Moderate goal-directed IV Lactated Ringer's 1.5 mL/kg/hr. WHY: WATERFALL trial (NEJM 2022) — aggressive NS halted early due to higher volume overload with no outcome benefit. LR preferred over NS to avoid hyperchloremic acidosis worsening SIRS. Antibiotics only for confirmed infected necrosis. PEARL: Moderate LR not aggressive NS. WATERFALL 2022 ended the aggressive fluid dogma.\n",

  thyroid_ca: "EX(Papillary thyroid cancer): 61yo man, 2.6cm PTC, extrathyroidal extension, 2/8 positive central nodes (ATA intermediate risk). Q: Greatest long-term clinical risk associated with the underlying malignancy? CORRECT: Locoregional recurrence in cervical lymph nodes (15–20% ATA intermediate risk). KEY TRAP: Hypoparathyroidism is a SURGICAL complication not a cancer complication. PHRASING RULE: Use 'greatest long-term clinical risk associated with the underlying malignancy' not 'complication of this condition'. PEARL: ATA intermediate risk = 15–20% locoregional recurrence — lifelong neck US surveillance mandatory.\n",

  osa: "EX(OSA management): 31yo woman, BMI 29, AHI 32, CPAP titration scheduled next week. CORRECT: Defer all pharmacotherapy and await CPAP titration. WHY: CPAP = definitive first-line. Tirzepatide FDA-approved adjunct (SURMOUNT-OSA 2024) but NOT CPAP replacement — weight loss takes months while patient needs airway protection now. Modafinil only after CPAP optimized, never before. Zolpidem contraindicated in untreated OSA. PEARL: OSA has no pharmacologic cure. CPAP is definitive first-line.\n",

  sheehan: "EX(Sheehan syndrome): 35yo woman, 14 months post-massive PPH, amenorrhea, fatigue, 10-lb weight loss, hypotension, loss of axillary/pubic hair, NO hyperpigmentation, Na 131, K 4.1 (normal), TSH 0.4, free T4 0.5 — central hypothyroidism confirmed. Q: Most critical next step BEFORE starting levothyroxine? CORRECT: Check 8AM serum cortisol or cosyntropin stimulation test. FATAL TRAP: Levothyroxine before cortisol replacement precipitates acute adrenal crisis. Normal K+ confirms central (not primary) AI — RAAS intact. PEARL: Hypopituitarism = CORTISOL FIRST, THYROID SECOND. This rule saves lives.\n",

  hypoparathyroid: "EX(Hypoparathyroidism): 29yo woman, post-thyroidectomy, carpopedal spasm, calcium 7.2, PTH undetectable. On calcium carbonate 2500mg TID (= 1000mg elemental TID = 3g elemental/day, above 2.5g threshold), calcitriol 0.5mcg BID (at ceiling). 24-hr urine calcium 410 mg/day (above 300 mg/day threshold). CORRECT: Add palopegteriparatide (Yorvipath) — FDA approved August 2024. NEVER rhPTH 1-84 (Natpara — recalled FDA 2019, globally discontinued). CALCIUM MATH: Carbonate is 40% elemental — 1000mg carbonate = 400mg elemental. ALWAYS calculate elemental not salt weight. PEARL: Conventional therapy ceiling = 24hr urine Ca >300 mg/day on >2.5g elemental + calcitriol >0.5mcg BID. Modern answer is Yorvipath.\n",

  ibd: "EX(UC refractory to 5-ASA): 64yo woman, moderate-to-severe UC (8–10 bloody stools/day), on optimized mesalamine 4.8g/day + mesalamine enemas x6 weeks with initial response but progressive worsening, CRP 48, fecal calprotectin 1840, albumin 2.8, HR 102. CORRECT: Discontinue mesalamine and initiate infliximab induction therapy with IV methylprednisolone bridging. WHY: Active inflammation despite optimized 5-ASA (CRP 48, fecal calprotectin >1800, hypoalbuminemia, tachycardia) = moderate-to-severe UC refractory to 5-ASA — biologic induction per ACG guidelines (Rubin et al. 2019). Adding oral prednisone alone (Option B) is the steroid bridge without definitive therapy — represents steroid dependence trap. Budesonide MMX (Option C) is for mild-to-moderate UC only — no role in this acuity. DISEASE ACUITY RULE: Match treatment intensity to disease severity. Fecal calprotectin >1500 + hypoalbuminemia + tachycardia = biologic induction, not another 5-ASA escalation. PEARL: 5-ASA has no role in a UC patient on optimized 5-ASA with fecal calprotectin >1500 plus hypoalbuminemia — the next step is biologic induction, not another steroid course.\n",

  step1_mechanism: "STEP 1 EXEMPLAR (Two-step mechanism): 19yo man, DKA, glucose 520, pH 7.21, 4+ ketones. Q: Overactivity of which enzyme provides primary precursors for ketonuria? CORRECT: Hormone-sensitive lipase. WHY: In insulin deficiency, HSL is uninhibited in adipose tissue — breaks down triglycerides into free fatty acids → overwhelms TCA cycle → ketone body formation. Lipoprotein lipase is DECREASED in insulin deficiency (common trap). Acetyl-CoA carboxylase is rate-limiting for fatty acid SYNTHESIS — also inhibited in DKA. PEARL: Step 1 — diagnose first, then go to biochemistry. Never ask what drug to give.\n",

  step3_context: "STEP 3 EXEMPLAR (Context-change management): 28yo woman, 7 weeks gestation, 2-year Graves disease on methimazole 10mg, currently euthyroid (TSH 1.2, free T4 1.3). CORRECT: Switch methimazole to PTU immediately. WHY: Methimazole is teratogenic in first trimester (aplasia cutis congenita, methimazole embryopathy) — switch to PTU even when euthyroid. RAI is absolute contraindication in pregnancy. Discontinuing therapy risks thyroid storm and fetal loss. Note: Switch back to methimazole in second trimester due to PTU hepatotoxicity risk. PEARL: Step 3 — management changes when clinical CONTEXT changes. Euthyroid status does not override teratogenicity risk.\n"
};

// ─── SELECT RELEVANT EXEMPLARS BY TOPIC AND LEVEL ────────────────────────────

function selectExemplars(topic, level) {
  var t = topic.toLowerCase();
  var selected = [];

  var tagMap = [
    { tags: ["adrenal","cushing","aldoster","pheochro","cortisol","virilism"], key: "adrenal" },
    { tags: ["virilization","dheas","androgen","hirsutism","clitoromegaly"], key: "virilization" },
    { tags: ["pituitary","prolactin","acromegaly","apoplexy"], key: "pituitary" },
    { tags: ["sheehan","postpartum hemorrhage","hypopituit","panhypopituit"], key: "sheehan" },
    { tags: ["thyroid nodule","thyroid cancer","ptc","papillary","ata risk","thyroidectomy"], key: "thyroid_ca" },
    { tags: ["methimazole","rai","thyrotoxic","toxic nodule","graves","hyperthyroid"], key: "thyroid_tx" },
    { tags: ["levothyroxine","hypothyroid","myxedema","tsh elevated"], key: "levothyroxine" },
    { tags: ["tsh resistance","tshr","thyroid gene"], key: "thyroid_dx" },
    { tags: ["dka","diabetic ketoacidosis","ketoacidosis"], key: "dka" },
    { tags: ["cgm","ambulatory glucose","sensor","time in range"], key: "cgm" },
    { tags: ["agp","tbr","tir","tar","gmi","nocturnal hypoglycemia"], key: "agp" },
    { tags: ["aid","closed loop","insulin pump","hybrid closed"], key: "aid" },
    { tags: ["t1dm","type 1 diabetes","microvascular screening"], key: "diabetes_screening" },
    { tags: ["type 2 diabetes","t2dm","semaglutide","glp-1","sglt2","metformin","tirzepatide","dual therapy"], key: "t2dm_dual" },
    { tags: ["heart failure","hfref","lvef","empagliflozin","dapagliflozin"], key: "hfref_sglt2" },
    { tags: ["catabolic","catabolism","weight loss polyuria","hba1c 11","glucose 300"], key: "catabolic_dm" },
    { tags: ["lipid","statin","triglyceride","icosapent","pcsk9","dyslipidemia","lp(a)"], key: "lipids" },
    { tags: ["pancreatitis","lipase","amylase","waterfall"], key: "pancreatitis" },
    { tags: ["sleep apnea","cpap","osa","apnea hypopnea"], key: "osa" },
    { tags: ["calcium","parathyroid","hypoparathyroid","yorvipath","natpara","calcitriol"], key: "hypoparathyroid" },
    { tags: ["ulcerative colitis","crohn","ibd","inflammatory bowel","mesalamine","infliximab","biologic"], key: "ibd" },
  ];

  for (var i = 0; i < tagMap.length; i++) {
    for (var j = 0; j < tagMap[i].tags.length; j++) {
      if (t.includes(tagMap[i].tags[j])) {
        if (selected.indexOf(tagMap[i].key) === -1) selected.push(tagMap[i].key);
        break;
      }
    }
  }

  // Fill to 3 with variety if needed
  var fallbacks = ["dka", "lipids", "sheehan", "hfref_sglt2", "pancreatitis", "ibd", "thyroid_ca", "hypoparathyroid"];
  for (var k = 0; k < fallbacks.length && selected.length < 3; k++) {
    if (selected.indexOf(fallbacks[k]) === -1) selected.push(fallbacks[k]);
  }

  // Cap at 4 for speed
  selected = selected.slice(0, 4);

  var result = "Study these exemplars for clinical depth, reasoning style, and distractor logic:\n\n";
  for (var m = 0; m < selected.length; m++) {
    if (ALL_EXEMPLARS[selected[m]]) result += ALL_EXEMPLARS[selected[m]] + "\n";
  }

  // Add level-specific exemplar
  if (level && level.includes("Step 1")) {
    result += ALL_EXEMPLARS["step1_mechanism"] + "\n";
  } else if (level && level.includes("Step 3")) {
    result += ALL_EXEMPLARS["step3_context"] + "\n";
  }

  return result;
}

// ─── BLUEPRINTS ───────────────────────────────────────────────────────────────

var ABIM_IM_BLUEPRINT = [
  { weight:14, category:"Cardiovascular Disease", topics:["Coronary artery disease and ACS","Heart failure (HFrEF, HFpEF)","Atrial fibrillation","Valvular heart disease","Hypertension","Dyslipidemia and statin therapy","Pulmonary embolism","Infective endocarditis","Cardiac arrhythmias","Pericarditis and myocarditis","Aortic dissection"] },
  { weight:9,  category:"Pulmonary Disease", topics:["COPD - GOLD staging","Asthma - step therapy","Community-acquired pneumonia","Interstitial lung disease and IPF","Obstructive sleep apnea","Pleural effusion - Light criteria","ARDS","Pulmonary hypertension","Pneumothorax"] },
  { weight:9,  category:"Endocrinology, Diabetes, and Metabolism", topics:["Type 2 diabetes - GLP-1 RA and SGLT2i","Type 1 diabetes and DKA","Hypothyroidism","Hyperthyroidism and Graves disease","Adrenal insufficiency","Cushing syndrome","Primary aldosteronism","Pheochromocytoma","Osteoporosis","Hypercalcemia and hyperparathyroidism","Prolactinoma and acromegaly"] },
  { weight:9,  category:"Gastroenterology", topics:["Inflammatory bowel disease - Crohn vs UC","Cirrhosis - Child-Pugh, MELD, complications","GI bleeding - upper vs lower","Hepatitis B - serology and antivirals","Hepatitis C - DAA therapy","Acute pancreatitis - WATERFALL 2022","NAFLD and NASH","Peptic ulcer disease and H. pylori","Acute liver failure"] },
  { weight:9,  category:"Infectious Disease", topics:["Sepsis and septic shock","HIV - ART initiation","Tuberculosis - latent vs active","Urinary tract infections","Skin and soft tissue infections","C. difficile colitis","Meningitis - empiric antibiotics"] },
  { weight:9,  category:"Rheumatology", topics:["Rheumatoid arthritis - DMARDs and biologics","Systemic lupus erythematosus","Gout - acute management and ULT","Giant cell arteritis and PMR","Ankylosing spondylitis","Vasculitis - GPA","Antiphospholipid syndrome"] },
  { weight:6,  category:"Hematology", topics:["Iron deficiency anemia","Hemolytic anemia","Thrombocytopenia - ITP, TTP, HIT","Sickle cell disease","DVT and PE - DOAC selection","Heparin-induced thrombocytopenia"] },
  { weight:6,  category:"Nephrology", topics:["Acute kidney injury - KDIGO staging","CKD - staging and SGLT2i","Glomerulonephritis - nephritic vs nephrotic","Hyponatremia - SIADH and correction","Hyperkalemia - EKG changes and management","Metabolic acidosis - anion gap"] },
  { weight:6,  category:"Medical Oncology", topics:["Lung cancer - targeted therapies","Breast cancer - hormone receptor and HER2","Lymphoma - Hodgkin vs non-Hodgkin","Leukemia - CML and TKI therapy","Multiple myeloma - CRAB criteria","Oncologic emergencies"] },
  { weight:4,  category:"Neurology", topics:["Ischemic stroke - tPA and thrombectomy","Seizures - AED selection","Multiple sclerosis - DMT","Parkinson disease","Dementia - Alzheimer vs vascular vs Lewy body","Myasthenia gravis"] },
  { weight:4,  category:"Psychiatry", topics:["Major depressive disorder - SSRI selection","Bipolar disorder - mood stabilizers","Alcohol use disorder - CIWA and thiamine","Opioid use disorder - buprenorphine","Delirium - causes and management"] },
  { weight:3,  category:"Preventive Medicine", topics:["Cancer screening - USPSTF","Biostatistics - NNT, sensitivity, specificity","Medical ethics - informed consent","Health disparities and social determinants"] },
];

var ABIM_ENDO_BLUEPRINT = [
  { weight:24, category:"Diabetes Mellitus and Hypoglycemia", topics:["ADA Standards - glycemic targets","Type 2 diabetes - GLP-1 RA, SGLT2i, tirzepatide","Type 1 diabetes - MDI vs AID systems and CGM","DKA and HHS - diagnosis and management","Hypoglycemia unawareness - prevention","Inpatient glycemic management","CVOT data - GLP-1 RA and SGLT2i","Gestational diabetes","MODY and LADA - genetic testing"] },
  { weight:15, category:"Thyroid Disorders", topics:["Hypothyroidism - primary vs central","Hashimoto thyroiditis - TPO antibodies","Hyperthyroidism - Graves disease, toxic nodular goiter","Thyroid storm - Burch-Wartofsky score","Thyroid nodule - ATA ultrasound risk stratification","Thyroid cancer - RAI and TSH suppression","Thyroid disease in pregnancy","Amiodarone-induced thyroid disease","Central hypothyroidism"] },
  { weight:15, category:"Calcium and Bone Disorders", topics:["Hypercalcemia - PTH vs PTHrP vs vitamin D","Primary hyperparathyroidism - surgical criteria","Hypoparathyroidism - palopegteriparatide (Yorvipath)","Osteoporosis - DXA, FRAX, bisphosphonates, denosumab, romosozumab","Vitamin D deficiency","Paget disease of bone","Hypocalcemia - acute IV calcium and chronic management"] },
  { weight:12, category:"Lipids, Obesity, and Nutrition", topics:["Dyslipidemia - ACC/AHA statin intensity","PCSK9 inhibitors - CVOT evidence","Familial hypercholesterolemia","Hypertriglyceridemia - fibrates and omega-3","Obesity management - GLP-1 RA for weight loss","Bariatric surgery - metabolic outcomes","Metabolic syndrome"] },
  { weight:10, category:"Adrenal Disorders", topics:["Primary adrenal insufficiency - autoimmune","Secondary adrenal insufficiency - ACTH stimulation test","Adrenal crisis - IV hydrocortisone","Cushing syndrome - UFC, late-night salivary cortisol","Cushing disease vs ectopic ACTH - IPSS","Primary aldosteronism - PAC/PRA, AVS","Pheochromocytoma - plasma metanephrines","Adrenal incidentaloma - hormonal workup","Congenital adrenal hyperplasia"] },
  { weight:10, category:"Pituitary Disorders", topics:["Pituitary adenoma - micro vs macro","Prolactinoma - cabergoline and pregnancy","Acromegaly - IGF-1, somatostatin analogs","Cushing disease - petrosal sinus sampling","Central diabetes insipidus - desmopressin","SIADH - euvolemic hyponatremia","Hypopituitarism - replacement priorities","Pituitary apoplexy","Sheehan syndrome"] },
  { weight:7,  category:"Female Reproduction", topics:["PCOS - Rotterdam criteria","Menopause - vasomotor symptoms and HRT","Premature ovarian insufficiency","Amenorrhea - primary vs secondary workup","Hyperprolactinemia","Turner syndrome - estrogen replacement"] },
  { weight:7,  category:"Male Reproduction", topics:["Male hypogonadism - primary vs secondary","Klinefelter syndrome - 47XXY","Male infertility - azoospermia workup","Testosterone therapy - monitoring","Delayed puberty vs constitutional growth delay"] },
];

var USMLE_STEP1_BLUEPRINT = [
  { weight:16, category:"Reproductive and Endocrine Systems", topics:["Hypothalamic-pituitary-gonadal axis - feedback loops","Thyroid hormone synthesis - iodination steps","Adrenal cortex zones - glomerulosa, fasciculata, reticularis","Insulin and glucagon - fed vs fasted state physiology","Type 1 diabetes - HLA-DR3/DR4, autoimmune destruction","CAH - 21-hydroxylase deficiency enzyme block","Androgen insensitivity syndrome - 46XY female phenotype","5-alpha reductase deficiency - ambiguous genitalia"] },
  { weight:13, category:"Behavioral Health and Nervous Systems", topics:["Neurotransmitters - dopamine, serotonin, GABA, glutamate","Antidepressants - SSRI, SNRI, TCA, MAOI mechanisms","Antipsychotics - D2 receptor blockade and EPS","Mood stabilizers - lithium mechanism and toxicity","Opioid pharmacology - mu receptor and naloxone","Autonomic pharmacology - alpha and beta receptors","Stroke syndromes - MCA, PCA, PICA territories"] },
  { weight:13, category:"Respiratory and Renal Systems", topics:["PFTs - obstructive vs restrictive patterns","Hypoxemia mechanisms - V/Q mismatch vs shunt","Acid-base disorders - compensatory responses","Renal tubular physiology - PCT, loop, DCT transport","Diuretics - site of action by segment","RAAS - angiotensin II and aldosterone effects","Nephritic vs nephrotic - pathologic types"] },
  { weight:11, category:"Cardiovascular System", topics:["Cardiac action potential - pacemaker vs ventricular","Frank-Starling law - preload and afterload","Antiarrhythmics - Vaughan-Williams classification","Atherosclerosis - foam cells and fibrous plaque","MI biomarkers - troponin, CK-MB timing","Congenital heart defects - VSD, ASD, PDA, TOF"] },
  { weight:10, category:"Blood and Immune Systems", topics:["Anemia classification - microcytic, normocytic, macrocytic","Clotting cascade - intrinsic vs extrinsic pathway","Hypersensitivity reactions - Type I through IV","Immunodeficiencies - B vs T cell and combined","Complement system - classical vs alternative pathway"] },
  { weight:9,  category:"Gastrointestinal System", topics:["GI hormones - gastrin, secretin, CCK, GIP actions","Liver metabolism - glycolysis and gluconeogenesis","Bilirubin metabolism - prehepatic, hepatic, posthepatic","H. pylori - urease and virulence factors","Hepatitis viruses - A, B, C, D, E serology patterns"] },
  { weight:5,  category:"Biostatistics and Epidemiology", topics:["Sensitivity vs specificity - ROC curve","PPV and NPV - prevalence effect","Study designs - RCT, cohort, case-control","NNT and NNH calculation"] },
];

var USMLE_STEP2_BLUEPRINT = [
  { weight:13, category:"Cardiovascular System", topics:["Chest pain - ACS evaluation and HEART score","STEMI management - door-to-balloon time","Heart failure - GDMT and diuresis","Atrial fibrillation - CHA2DS2-VASc anticoagulation","Hypertensive urgency vs emergency","Aortic stenosis - TAVR vs SAVR criteria"] },
  { weight:12, category:"Renal, Urinary, and Reproductive Systems", topics:["Acute kidney injury - prerenal vs intrinsic","CKD complications - anemia and hyperkalemia","Hyponatremia - SIADH and correction rate","UTI - uncomplicated vs pyelonephritis","Ovarian cancer - CA-125 and BRCA","Testicular cancer - germ cell workup"] },
  { weight:11, category:"Legal, Ethical Issues, and Patient Safety", topics:["Informed consent - capacity assessment","Confidentiality - duty to warn","End-of-life care - withdrawal and futility","Medical errors - disclosure","Advance directives - DNR and POLST"] },
  { weight:10, category:"Behavioral Health", topics:["Suicide risk assessment - protective factors","Major depression - PHQ-9 and SSRI","Bipolar disorder - mood stabilizer selection","Substance use disorders - CAGE questionnaire","Eating disorders - refeeding syndrome"] },
  { weight:10, category:"Nervous System", topics:["Stroke - NIHSS and tPA eligibility window","Seizure - first unprovoked workup","Headache - migraine vs tension vs cluster","Multiple sclerosis - McDonald criteria","Vertigo - BPPV vs central causes"] },
  { weight:9,  category:"Musculoskeletal and Skin", topics:["Low back pain - red flags and imaging","Gout - acute management and allopurinol timing","Cellulitis - MRSA risk and antibiotics","Melanoma - biopsy and sentinel lymph node"] },
  { weight:8,  category:"Respiratory System", topics:["Pneumonia - PORT/PSI and antibiotic selection","COPD exacerbation - bronchodilators and NIV","Pulmonary embolism - Wells score","Lung cancer - LDCT screening and targeted therapy"] },
  { weight:7,  category:"Endocrine System", topics:["Diabetes - A1c targets and insulin adjustment","Thyroid nodule - ultrasound features and FNA","Adrenal insufficiency - stress dosing","Cushing syndrome - screening tests","Calcium disorders - hypercalcemia workup"] },
  { weight:7,  category:"Pregnancy and Childbirth", topics:["Preeclampsia - BP criteria and management","Gestational diabetes - GCT and OGTT","Placenta previa vs abruptio placentae","Postpartum hemorrhage - oxytocin protocol","Ectopic pregnancy - beta-hCG and methotrexate"] },
  { weight:6,  category:"Gastrointestinal System", topics:["Upper GI bleeding - Rockall score and endoscopy","Acute pancreatitis - BISAP and fluid resuscitation","Cirrhosis complications - SBP and hepatorenal syndrome","IBD - disease acuity and biologic escalation"] },
];

var USMLE_STEP3_BLUEPRINT = [
  { weight:13, category:"Biostatistics and Population Health", topics:["Evidence-based medicine - meta-analysis interpretation","Screening statistics - sensitivity and specificity","Clinical decision making - pre-test probability","Study design selection","Absolute vs relative risk reduction and NNT","Quality improvement - PDSA cycle"] },
  { weight:11, category:"Cardiovascular System", topics:["Outpatient heart failure - GDMT titration","Secondary prevention post-MI","Hypertension management - drug by comorbidity","Atrial fibrillation - long-term anticoagulation","Peripheral vascular disease - ABI"] },
  { weight:10, category:"Nervous System", topics:["Outpatient stroke - secondary prevention","Epilepsy - driving restrictions","Parkinson disease - motor fluctuations","Dementia - Alzheimer vs vascular vs Lewy body","Migraine prophylaxis"] },
  { weight:9,  category:"Communication and Ethics", topics:["Informed consent - capacity and surrogates","Advance care planning - DNR and goals of care","Breaking bad news - SPIKES protocol","Medical errors - disclosure and apology","Palliative vs hospice"] },
  { weight:9,  category:"Respiratory System", topics:["COPD - LABA/LAMA combinations and oxygen criteria","Asthma - step-up therapy and biologics","OSA - CPAP adherence and adjunct therapy","IPF - antifibrotic therapy"] },
  { weight:8,  category:"Endocrine System", topics:["Diabetes - A1c targets by age and comorbidity","Thyroid nodule - long-term surveillance","Adrenal incidentaloma - follow-up imaging","Metabolic syndrome - lifestyle intervention"] },
  { weight:7,  category:"Gastrointestinal System", topics:["Surveillance colonoscopy - adenoma intervals","Hepatitis C - DAA and cirrhosis surveillance","IBD - maintenance therapy and dysplasia surveillance"] },
  { weight:6,  category:"Renal and Urinary", topics:["CKD management - BP targets and SGLT2i","BPH - alpha-blockers and 5-alpha reductase inhibitors","Nephrolithiasis - metabolic workup"] },
  { weight:6,  category:"Behavioral Health", topics:["Depression - augmentation strategies","Anxiety - CBT and medication management","Substance use - motivational interviewing and MAT","ADHD in adults - stimulant therapy"] },
  { weight:5,  category:"Musculoskeletal System", topics:["Osteoarthritis - non-pharmacologic and NSAID risks","RA monitoring - DAS28 and methotrexate toxicity","Gout prophylaxis - allopurinol titration","Osteoporosis - DEXA surveillance and medication holidays"] },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function weightedRandom(blueprint) {
  var total = blueprint.reduce(function(s, b) { return s + b.weight; }, 0);
  var rand = Math.random() * total;
  for (var i = 0; i < blueprint.length; i++) {
    rand -= blueprint[i].weight;
    if (rand <= 0) return blueprint[i];
  }
  return blueprint[blueprint.length - 1];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRadiopaediaLink(topic) {
  var links = {
    "pneumonia": "https://radiopaedia.org/search?q=pneumonia&lang=us",
    "ards": "https://radiopaedia.org/search?q=ARDS&lang=us",
    "pleural": "https://radiopaedia.org/search?q=pleural+effusion&lang=us",
    "pneumothorax": "https://radiopaedia.org/search?q=pneumothorax&lang=us",
    "pulmonary embolism": "https://radiopaedia.org/search?q=pulmonary+embolism+CT&lang=us",
    "interstitial lung": "https://radiopaedia.org/search?q=interstitial+lung+disease+HRCT&lang=us",
    "heart failure": "https://radiopaedia.org/search?q=heart+failure+cardiomegaly&lang=us",
    "aortic dissection": "https://radiopaedia.org/search?q=aortic+dissection+CT&lang=us",
    "stroke": "https://radiopaedia.org/search?q=ischemic+stroke+MRI+DWI&lang=us",
    "multiple sclerosis": "https://radiopaedia.org/search?q=multiple+sclerosis+MRI&lang=us",
    "thyroid nodule": "https://radiopaedia.org/search?q=thyroid+nodule+ultrasound&lang=us",
    "thyroid cancer": "https://radiopaedia.org/search?q=thyroid+cancer+ultrasound&lang=us",
    "cushing": "https://radiopaedia.org/search?q=adrenal+adenoma+cushing+CT&lang=us",
    "aldosteronism": "https://radiopaedia.org/search?q=adrenal+adenoma+CT&lang=us",
    "pheochromocytoma": "https://radiopaedia.org/search?q=pheochromocytoma+MRI&lang=us",
    "acromegaly": "https://radiopaedia.org/search?q=pituitary+macroadenoma+MRI&lang=us",
    "prolactinoma": "https://radiopaedia.org/search?q=prolactinoma+pituitary+MRI&lang=us",
    "osteoporosis": "https://radiopaedia.org/search?q=osteoporosis+compression+fracture&lang=us",
    "hyperparathyroidism": "https://radiopaedia.org/search?q=hyperparathyroidism+sestamibi&lang=us",
    "cirrhosis": "https://radiopaedia.org/search?q=cirrhosis+liver+CT&lang=us",
    "pancreatitis": "https://radiopaedia.org/search?q=acute+pancreatitis+CT&lang=us",
    "nephrolithiasis": "https://radiopaedia.org/search?q=kidney+stones+CT&lang=us",
    "rheumatoid arthritis": "https://radiopaedia.org/search?q=rheumatoid+arthritis+xray&lang=us",
    "ankylosing": "https://radiopaedia.org/search?q=ankylosing+spondylitis+MRI&lang=us",
    "gout": "https://radiopaedia.org/search?q=gout+joint+xray&lang=us",
    "tuberculosis": "https://radiopaedia.org/search?q=tuberculosis+chest+xray&lang=us",
    "pcos": "https://radiopaedia.org/search?q=polycystic+ovary+ultrasound&lang=us",
    "graves": "https://radiopaedia.org/search?q=graves+disease+thyroid+scan&lang=us",
    "hashimoto": "https://radiopaedia.org/search?q=hashimoto+thyroid+ultrasound&lang=us",
  };
  var t = topic.toLowerCase();
  for (var key in links) {
    if (t.includes(key)) return links[key];
  }
  return null;
}

// ─── BUILD PROMPT ─────────────────────────────────────────────────────────────

function buildPrompt(level, requestedTopic) {
  var isRandom = requestedTopic.toLowerCase().includes("random");
  var specificTopic, topicInstruction;

  if (!isRandom) {
    specificTopic = requestedTopic;
    topicInstruction = "TOPIC: " + specificTopic;
  } else {
    var bp;
    if (level.includes("ABIM Endocrinology")) bp = weightedRandom(ABIM_ENDO_BLUEPRINT);
    else if (level.includes("ABIM Internal Medicine")) bp = weightedRandom(ABIM_IM_BLUEPRINT);
    else if (level.includes("Step 1")) bp = weightedRandom(USMLE_STEP1_BLUEPRINT);
    else if (level.includes("Step 2")) bp = weightedRandom(USMLE_STEP2_BLUEPRINT);
    else if (level.includes("Step 3")) bp = weightedRandom(USMLE_STEP3_BLUEPRINT);
    else bp = weightedRandom(ABIM_IM_BLUEPRINT);
    specificTopic = pickRandom(bp.topics);
    topicInstruction = "TOPIC: " + specificTopic + " (" + bp.category + " — " + bp.weight + "% of blueprint)";
  }

  var t = specificTopic.toLowerCase();
  var radiopaediaLink = getRadiopaediaLink(specificTopic);

  // ─── LEVEL-SPECIFIC PHILOSOPHY ────────────────────────────────────────────

  var levelNote = "";
  if (level.includes("Step 1")) {
    levelNote =
      "LEVEL: USMLE Step 1 — TWO-STEP REASONING. This is a basic science and pathophysiology exam.\n" +
      "Step 1: Diagnose the patient from the vignette.\n" +
      "Step 2: Answer a question about the UNDERLYING MECHANISM, BIOCHEMISTRY, ENZYME, RECEPTOR, PHARMACOLOGY, or CELLULAR PATHOLOGY of that diagnosis.\n" +
      "NEVER ask 'most appropriate next step in management' on Step 1.\n" +
      "NEVER ask which drug to prescribe.\n" +
      "ASK: Which enzyme? Which receptor? Which pathway? Why does this happen biochemically?\n" +
      "EXAMPLE TASKS: 'most likely underlying mechanism', 'most likely pathophysiologic explanation', 'overactivity of which enzyme', 'most likely cause of this lab finding'\n" +
      "Distractors = related pathways, enzymes, or receptors that are wrong in this specific context.";
  } else if (level.includes("Step 2")) {
    levelNote =
      "LEVEL: USMLE Step 2 CK — CLINICAL DIAGNOSIS AND NEXT BEST STEP.\n" +
      "Test the algorithmic approach: which test first, which treatment is indicated NOW vs later.\n" +
      "Distractors = correct tests or treatments in the WRONG SEQUENCE.\n" +
      "CRITICAL OUTPATIENT SETTING RULE: If patient is in outpatient clinic, urgent care, or primary care and has a condition requiring hospital-level care (DKA, sepsis, STEMI, stroke, adrenal crisis, thyroid storm, hypertensive emergency) — the correct answer is TRANSFER TO ED or ADMIT. NEVER answer 'start IV insulin infusion' or 'start IV fluids protocol' for a patient still sitting in clinic. The correct management of DKA in the outpatient setting is to give a brief stabilizing IV bolus and transfer to the ED immediately.";
  } else if (level.includes("Step 3")) {
    levelNote =
      "LEVEL: USMLE Step 3 — INDEPENDENT PRACTICE AND NUANCED MANAGEMENT.\n" +
      "Test transitions of care, drug safety in special populations (pregnancy, renal failure, elderly), long-term monitoring, and management changes when clinical context shifts.\n" +
      "KEY CONCEPT: A patient who is stable on therapy may still need a medication CHANGE based on a new context (e.g., pregnancy, new organ failure, new comorbidity).\n" +
      "Example: Euthyroid Graves patient on methimazole who becomes pregnant in first trimester = switch to PTU immediately even though she is well controlled.\n" +
      "Distractors = failure to recognize context changes, or correct drug at wrong timing.";
  } else if (level.includes("ABIM Internal Medicine")) {
    levelNote =
      "LEVEL: ABIM Internal Medicine — Guideline-driven clinical judgment at the attending level.\n" +
      "Test BOTH inpatient and outpatient management with equal frequency.\n" +
      "Reference Society of Hospital Medicine (SHM) guidelines for inpatient hospital medicine topics.\n" +
      "DISEASE ACUITY RULE: Match treatment intensity to disease severity. Moderate-to-severe disease warrants escalation even if milder options are technically correct for mild disease.\n" +
      "Example: UC with CRP 48, albumin 2.8, fecal calprotectin >1800 on optimized 5-ASA = biologic induction (infliximab), not another 5-ASA dose increase or another steroid course.";
  } else if (level.includes("ABIM Endocrinology")) {
    levelNote =
      "LEVEL: ABIM Endocrinology subspecialty — Fellowship-level nuance per ADA, Endocrine Society, AACE, ATA.\n" +
      "Test guideline thresholds, drug sequencing, monitoring intervals, special populations, and multi-comorbidity scenarios.\n" +
      "Include complex cases where the diagnosis is known but the question tests WHAT TO DO NEXT given specific lab thresholds, imaging findings, or comorbidities.";
  }

  // ─── SOCIETY MAPPING ──────────────────────────────────────────────────────

  var societyMap = "";
  if (t.includes("thyroid") || t.includes("hashimoto") || t.includes("graves") || t.includes("hypothyroid") || t.includes("hyperthyroid")) societyMap = "Cite ATA and/or Endocrine Society. NEVER cite ADA for thyroid disorders.";
  else if (t.includes("diabetes") || t.includes("insulin") || t.includes("cgm") || t.includes("glucose") || t.includes("dka") || t.includes("glp-1") || t.includes("sglt2") || t.includes("metformin") || t.includes("tirzepatide")) societyMap = "Cite current ADA Standards of Care and/or AACE for diabetes.";
  else if (t.includes("osteoporosis") || t.includes("bone") || t.includes("calcium") || t.includes("parathyroid") || t.includes("vitamin d") || t.includes("hypoparathyroid")) societyMap = "Cite Endocrine Society and/or BHOF for bone and calcium disorders.";
  else if (t.includes("adrenal") || t.includes("cushing") || t.includes("aldosteronism") || t.includes("pheochromocytoma")) societyMap = "Cite Endocrine Society Clinical Practice Guidelines for adrenal disorders.";
  else if (t.includes("pituitary") || t.includes("acromegaly") || t.includes("prolactinoma") || t.includes("sheehan")) societyMap = "Cite Endocrine Society Clinical Practice Guidelines for pituitary disorders.";
  else if (t.includes("heart failure") || t.includes("acs") || t.includes("stemi") || t.includes("atrial fibrillation") || t.includes("hypertension") || t.includes("dyslipidemia")) societyMap = "Cite ACC/AHA guidelines. Reference GDMT principles for heart failure.";
  else if (t.includes("copd") || t.includes("asthma") || t.includes("pneumonia") || t.includes("ards")) societyMap = "Cite GOLD for COPD, GINA for asthma, IDSA/ATS for pneumonia.";
  else if (t.includes("sleep apnea") || t.includes("osa")) societyMap = "Cite AASM guidelines for sleep disorders.";
  else if (t.includes("kidney") || t.includes("renal") || t.includes("ckd") || t.includes("aki")) societyMap = "Cite KDIGO guidelines for kidney disease.";
  else if (t.includes("rheumatoid") || t.includes("lupus") || t.includes("gout") || t.includes("vasculitis")) societyMap = "Cite ACR and/or EULAR guidelines for rheumatologic conditions.";
  else if (t.includes("sepsis") || t.includes("septic") || t.includes("meningitis")) societyMap = "Cite Surviving Sepsis Campaign guidelines.";
  else if (t.includes("hiv")) societyMap = "Cite DHHS HIV treatment guidelines.";
  else if (t.includes("tuberculosis")) societyMap = "Cite ATS/CDC/IDSA tuberculosis guidelines.";
  else if (t.includes("pancreatitis")) societyMap = "Cite ACG guidelines and WATERFALL trial (NEJM 2022) for acute pancreatitis.";
  else if (t.includes("gi bleeding") || t.includes("cirrhosis") || t.includes("hepatitis") || t.includes("liver")) societyMap = "Cite AASLD and ACG guidelines for liver and GI disorders.";
  else if (t.includes("inflammatory bowel") || t.includes("crohn") || t.includes("ulcerative colitis") || t.includes("ibd")) societyMap = "Cite ACG Clinical Guidelines on UC and Crohn disease (Rubin et al. 2019 for UC, Lichtenstein et al. for Crohn).";
  else if (t.includes("hospital") || t.includes("inpatient")) societyMap = "Cite Society of Hospital Medicine (SHM) guidelines for inpatient management.";
  else societyMap = "Cite the most current relevant specialty society guideline.";

  // ─── BOARD TASK ROTATION ──────────────────────────────────────────────────

  var boardTasks;
  if (level.includes("Step 1")) {
    boardTasks = [
      "most likely underlying mechanism of this patient's condition",
      "most likely pathophysiologic explanation for these findings",
      "most likely cause of this laboratory abnormality",
      "most likely underlying cause of this patient's presentation",
      "most likely diagnosis",
      "most appropriate initial diagnostic study to confirm the diagnosis",
    ];
  } else if (level.includes("Step 3")) {
    boardTasks = [
      "most appropriate next step in management",
      "most appropriate long-term management strategy",
      "most appropriate preventive recommendation",
      "most appropriate monitoring strategy",
      "most likely diagnosis",
      "most appropriate change in management given this new clinical development",
    ];
  } else {
    boardTasks = [
      "most appropriate next step in management",
      "most appropriate next step in management",
      "most appropriate next step in management",
      "most likely diagnosis",
      "most likely diagnosis",
      "most appropriate diagnostic study",
      "most appropriate monitoring strategy",
      "most likely underlying mechanism or etiology",
      "most appropriate initial treatment",
      "greatest long-term clinical risk associated with the underlying condition",
      "most appropriate change in management",
      "most likely cause of this patient's presentation",
    ];
  }
  var selectedTask = boardTasks[Math.floor(Math.random() * boardTasks.length)];

  var imagingNote = radiopaediaLink ? " Describe key imaging findings as a clinician would dictate." : "";
  var cgmNote = (t.includes("cgm") || t.includes("aid") || t.includes("insulin pump") || t.includes("ambulatory glucose")) ? " Include CGM metrics: TIR%, TBR%, TAR%, GMI." : "";

  var jsonSchema = '{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"' + specificTopic + '","imageUrl":' + (radiopaediaLink ? '"' + radiopaediaLink + '"' : 'null') + ',"showImageButton":false}';

  var exemplars = selectExemplars(specificTopic, level);

  // ─── SYSTEM TEXT ────────────────────────────────────────────────────────────

  var systemText =
    "You are a senior ABIM item-writing committee member, fellowship program director, and academic physician at a major academic medical center.\n\n" +

    "CORE PHILOSOPHY: You test CLINICAL REASONING and JUDGMENT — not drug recall or fact retrieval. Every question forces the learner to think through a clinical problem the way a master clinician does at the bedside.\n\n" +

    "QUESTION TYPES — rotate equally across ALL specialties and topics:\n" +
    "Diagnosis | Next best step | Monitoring | Mechanism | Interpretation | Complication | Management\n" +
    "Do NOT default to management questions. Actively rotate through diagnosis, mechanism, monitoring, and interpretation.\n\n" +

    "EXPLANATION STYLE:\n" +
    "Write like a brilliant attending teaching on rounds — not a textbook reciting statistics.\n" +
    "Sentence 1: Why the correct answer is right + one guideline citation.\n" +
    "Sentence 2: Why the 2 most tempting wrong answers are wrong + name the cognitive trap each represents.\n" +
    "Sentence 3: Board pearl — a clinical insight that changes how the learner thinks. Never restate the correct answer.\n\n" +

    "PHRASING RULES:\n" +
    "- NEVER use 'most appropriate initial pharmacotherapy' as the lead-in question\n" +
    "- Use 'most appropriate next step in management' for all clinical decision questions\n" +
    "- For cancer/disease complications: use 'greatest long-term clinical risk associated with the underlying malignancy'\n" +
    "- For outpatient patients with conditions requiring hospital care: answer is TRANSFER or ADMIT — never inpatient protocols in an outpatient setting\n\n" +

    "CLINICAL ACCURACY RULES — ALL MUST BE FOLLOWED:\n" +
    "1. Labs MUST match diagnosis. Overt hypothyroidism = TSH >10 AND free T4 below range. Subclinical = TSH 4.5–10 AND normal T4. Overt hyperthyroidism = TSH <0.01 AND free T4 above range.\n" +
    "2. DKA in ED or inpatient: FLUIDS FIRST (NS 0.9% 1–1.5 L/hr) → check K+ → insulin only if K+ ≥3.5 → dextrose when glucose 200–250 → hold SGLT2i entire episode. NEVER start insulin before fluids.\n" +
    "3. DKA in OUTPATIENT setting: stabilize with brief IV access and bolus if available, then TRANSFER TO ED immediately. Never manage DKA in outpatient clinic.\n" +
    "4. Primary AI: low cortisol + HIGH ACTH + hyperkalemia + hyperpigmentation. Secondary AI: low cortisol + low ACTH + normal K+ + no hyperpigmentation (RAAS intact).\n" +
    "5. Semaglutide SC (Ozempic): ALWAYS start 0.25 mg weekly x4 weeks, then 0.5 mg. NEVER 0.5 mg at initiation.\n" +
    "6. Tirzepatide: start 2.5 mg weekly x4 weeks, increase by 2.5 mg every 4 weeks.\n" +
    "7. SGLT2i in HFrEF: mandatory regardless of HbA1c when LVEF <40% (EMPEROR-Reduced, DAPA-HF).\n" +
    "8. Pioglitazone: ABSOLUTELY CONTRAINDICATED in heart failure — causes sodium and water retention.\n" +
    "9. Insulin first when: HbA1c >10%, glucose ≥300 mg/dL, OR active catabolism (weight loss + polyuria + polydipsia).\n" +
    "10. GLP-1 RA: DO NOT use in active catabolic state — promotes weight loss worsening catabolism.\n" +
    "11. Pancreatitis: moderate goal-directed LR 1.5 mL/kg/hr (WATERFALL 2022 NEJM) — NOT aggressive NS. Antibiotics only for confirmed infected necrosis.\n" +
    "12. Calcium carbonate = 40% elemental calcium. 1000 mg carbonate = 400 mg elemental. ALWAYS calculate elemental, not salt weight.\n" +
    "13. Natpara (rhPTH 1-84): RECALLED FDA 2019, globally DISCONTINUED. Current PTH replacement = palopegteriparatide (Yorvipath), FDA approved August 2024.\n" +
    "14. Hypopituitarism: CORTISOL FIRST, THYROID SECOND — levothyroxine before cortisol = fatal adrenal crisis.\n" +
    "15. REDUCE-IT sequencing: statin + lifestyle first → recheck 4–12 weeks → IPE only if TG ≥150 on stable statin x4 weeks.\n" +
    "16. OSA: CPAP = definitive first-line. Tirzepatide = adjunct only (SURMOUNT-OSA 2024). Modafinil only after CPAP optimized. Zolpidem = contraindicated in untreated OSA.\n" +
    "17. AGP: fix TBR >4% before any hyperglycemia adjustment. AID systems: micro-treat mild lows with 5–8g carbs (Rule of 15 is obsolete).\n" +
    "18. IBD acuity: fecal calprotectin >1500 + hypoalbuminemia + tachycardia on optimized 5-ASA = biologic induction (infliximab), not another steroid course.\n" +
    "19. GI bleeding: restrictive transfusion strategy — Hgb threshold 7 g/dL per TRICC/TRIGGER trials.\n" +
    "20. Sepsis: 30 mL/kg crystalloid then reassess dynamically — Surviving Sepsis Campaign 2021.\n" +
    "21. Methimazole in pregnancy: TERATOGENIC in first trimester (aplasia cutis congenita, methimazole embryopathy) — switch to PTU in first trimester even if euthyroid. Switch back to methimazole in second trimester due to PTU hepatotoxicity.\n" +
"22. " + societyMap + "\n\n" +
    "STRUCTURAL ITEM-WRITING RULES (ABIM STANDARD):\n" +
    "A. COVER-THE-OPTIONS TEST: The stem + lead-in must point to the correct answer domain WITHOUT seeing the choices. If a test-taker can eliminate all wrong answers just by matching a keyword in the stem to a matching keyword in the correct answer, the item is structurally flawed. Example of FLAWED cueing: stem asks for a CLINICAL risk, only one option is a clinical outcome — test-taker matches the word clinical and bypasses reasoning. Fix: all 5 options must be from the same category (all clinical outcomes, all ethical principles, all management steps).\n" +
    "B. NEVER PATHOLOGIZE CULTURAL PRACTICES: Do not frame a patient's cultural preference, religious belief, family decision-making style, or communication practice as the 'underlying condition'. These are NOT medical conditions. If a vignette involves cultural competency, the question must ask about clinical communication, the physician's appropriate response, or the ethical principle at stake — not the patient's background as a disease entity.\n" +
    "C. NO FABRICATED URGENCY: Do not invent clinical urgency that does not exist in evidence-based medicine to force a correct answer. Example of FLAWED urgency: claiming that delaying a routine asymptomatic screening colonoscopy by one week creates meaningful cancer risk. The adenoma-to-carcinoma sequence takes YEARS. A one-week delay in an asymptomatic screening colonoscopy has ZERO measurable long-term clinical risk. Only use urgency when it genuinely exists clinically.\n" +
    "D. HOMOGENEOUS ANSWER CHOICES: All 5 options must be from the same category. If the question asks about a clinical outcome, ALL 5 options must be clinical outcomes. If the question asks about next step in management, ALL 5 options must be management steps. NEVER mix clinical outcomes with ethical principles with interpersonal risks in the same option set.\n" +
    "E. MATCH QUESTION TYPE TO VIGNETTE FOCUS: If the vignette narrative focuses on physician-patient communication, cultural dynamics, and medical ethics — the question should test those domains. Do NOT pivot suddenly to oncology staging in a vignette that was entirely about communication. The question type must match the dominant clinical theme of the vignette.\n\n" +

    exemplars;

  var userText =
    levelNote + "\n\n" +
    topicInstruction + "\n\n" +
    "STEM: Write a 3–4 sentence clinical vignette." + imagingNote + cgmNote + "\n" +
    "End the stem with exactly: Which of the following is the " + selectedTask + "?\n\n" +
    "CHOICES: 5 options (A–E). One clearly correct answer per current guidelines. Four plausible distractors representing real cognitive traps (anchoring bias, premature closure, wrong sequence, wrong disease subtype).\n\n" +
    "EXPLANATION: Exactly 3 sentences.\n" +
    "Sentence 1: Why correct answer is right + one guideline citation.\n" +
    "Sentence 2: Why the 2 most tempting wrong answers are wrong + name the cognitive trap each represents.\n" +
    "Sentence 3: Board pearl — insight that changes clinical thinking, not a restatement.\n\n" +
    "Return ONLY valid JSON — complete with all closing brackets. No markdown, no text outside JSON:\n" +
    jsonSchema;

  return { systemText, userText, radiopaediaLink, specificTopic };
}

// ─── NETLIFY HANDLER ──────────────────────────────────────────────────────────

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  var topic, level, warmup;
  try {
    var body = JSON.parse(event.body);
    topic = body.topic;
    level = body.level;
    warmup = body.warmup || false;
    if (!topic || !level) throw new Error("Missing topic or level");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (warmup) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warm: true }) };
  }

  try {
    var ages = [22,26,29,31,34,37,39,42,45,48,51,54,57,61,64,67,71,74,78];
    var sexes = ["man","woman","woman","man","woman","man"];
    var races = ["White","Black","Hispanic","Asian","Native American","Middle Eastern","South Asian","White","Black","Hispanic"];
    var settings = ["outpatient primary care clinic","endocrinology outpatient clinic","emergency department","inpatient medicine ward","urgent care center","internal medicine resident clinic","endocrine subspecialty consult service"];

    var randAge = ages[Math.floor(Math.random() * ages.length)];
    var randSex = sexes[Math.floor(Math.random() * sexes.length)];
    var randRace = races[Math.floor(Math.random() * races.length)];
    var randSetting = settings[Math.floor(Math.random() * settings.length)];
    var patientSeed = "Patient demographics: " + randAge + "-year-old " + randRace + " " + randSex + " presenting to a " + randSetting + ". Use these demographics exactly.";

    var promptData = buildPrompt(level, topic);
    var enrichedUserText = patientSeed + "\n\n" + promptData.userText;

    var raw = await callClaude(promptData.systemText, enrichedUserText);

    // Robust JSON extraction
    var cleaned = raw.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
    var firstBrace = cleaned.indexOf("{");
    var lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON found in response");
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    if (!cleaned.includes('"stem"') || !cleaned.includes('"choices"') || !cleaned.includes('"correct"')) {
      throw new Error("AI returned invalid JSON. Please try again.");
    }

    var parsed = JSON.parse(cleaned);
    parsed.imageUrl = parsed.imageUrl || promptData.radiopaediaLink || null;
    parsed.showImageButton = parsed.showImageButton || false;
    parsed.topic = parsed.topic || promptData.specificTopic;

    var required = ["stem", "choices", "correct", "explanation"];
    for (var i = 0; i < required.length; i++) {
      if (!parsed[required[i]]) throw new Error("Missing field: " + required[i]);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([parsed])
    };

  } catch (e) {
    console.error("Generation error:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate question. Please try again." })
    };
  }
};
