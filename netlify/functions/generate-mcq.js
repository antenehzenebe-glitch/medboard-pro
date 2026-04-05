// generate-mcq.js — MedBoard Pro
// Model: claude-sonnet-4-6
// Definitive build — April 2026
// Dr. Anteneh Zenebe, MD, FACE — Howard University College of Medicine

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function callClaude(systemText, userText) {
  var maxRetries = 3;
  var retryDelays = [1000, 2000, 3000];
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  var finalUserText = userText + "\n\n[Seed: " + entropySeed + "]";

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
        max_tokens: 1024,
        temperature: 0.6,
        system: systemText,
        messages: [{ role: "user", content: finalUserText }]
      })
    });

    if (response.status === 529 || response.status === 503 || response.status === 502) {
      if (attempt === maxRetries - 1) {
        // Claude is overloaded — fall back to Gemini
        console.log("Claude overloaded — falling back to Gemini 2.0 Flash");
        return await callGemini(systemText, finalUserText);
      }
      continue;
    }
    if (!response.ok) {
      var errText = await response.text();
      throw new Error("API error " + response.status + ": " + errText.substring(0, 200));
    }

    var data = await response.json();
    if (!data.content || !data.content.length) throw new Error("Empty API response");

    var textBlock = data.content.find(function(b) { return b.type === "text"; });
    if (!textBlock || !textBlock.text) throw new Error("No text in response");
    return textBlock.text;
  }
  throw new Error("All retries failed");
}

async function callGemini(systemText, userText) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key not configured");

  var response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.6,
          maxOutputTokens: 1024
        }
      })
    }
  );

  if (!response.ok) {
    var errText = await response.text();
    throw new Error("Gemini API error " + response.status + ": " + errText.substring(0, 200));
  }

  var data = await response.json();
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Empty Gemini response");
  }
  return data.candidates[0].content.parts[0].text;
}

// ─── SUPABASE ASYNC SAVE ─────────────────────────────────────────────────────
// Saves generated MCQ to database in background — user never waits for this

const SUPABASE_URL = "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

async function saveMcqToSupabase(parsed, level) {
  try {
    await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        exam_level: level,
        topic: parsed.topic || "",
        stem: parsed.stem || "",
        choices: parsed.choices || {},
        correct_answer: parsed.correct || "",
        explanation: parsed.explanation || ""
      })
    });
  } catch (e) {
    // Silent fail — never block user experience
    console.log("Supabase save skipped:", e.message);
  }
}

// ─── EXEMPLARS ────────────────────────────────────────────────────────────────
// Stored separately, selected by topic+level for speed (3-4 per request max)

var ALL_EXEMPLARS = {
  adrenal: "EX(Adrenal mass): 54yo man, resistant HTN, 3.8cm left adrenal mass, atrophic right adrenal, aldosterone 14/renin<0.6. CORRECT: Plasma metanephrines + 1mg DST before surgery. WHY: >2.4cm tumor requires excluding pheo AND hypercortisolism — contralateral atrophy = ACTH-independent Cushing. Surgery without cortisol testing risks adrenal crisis. PEARL: Adrenal tumor >2.4cm = complete hormonal workup before any intervention.\n",
  pituitary: "EX(Pituitary + pregnancy): 28yo woman, 9mm adenoma abutting optic chiasm, normal labs, wants pregnancy. CORRECT: Surgical referral before conception. WHY: Pituitary enlarges 3-fold in pregnancy — chiasm compression risk. PEARL: Nonfunctioning adenoma near chiasm + planned pregnancy = surgery first.\n",
  thyroid_dx: "EX(TSH resistance): 42yo man, TSH 12.1, free T4 normal, negative antibodies, child has same labs. CORRECT: TSH receptor resistance. WHY: Elevated TSH + normal T4 + negative antibodies + family pattern = TSHR inactivating variant. PEARL: Subclinical hypothyroid + negative antibodies + family history = TSHR gene mutation.\n",
  thyroid_tx: "EX(Elderly hyperthyroidism): 83yo woman, overt hyperthyroidism, toxic MNG, CAD, osteoporosis. CORRECT: Methimazole first. WHY: Must achieve euthyroidism before RAI per ATA. Watchful waiting risks AFib and bone loss. PEARL: Elderly CAD + overt hyperthyroidism = methimazole first always.\n",
  levothyroxine: "EX(Elderly hypothyroidism): 81yo man, CAD, TSH 25, FT4 0.5. CORRECT: Levothyroxine 25 mcg/day. WHY: ATA — start low go slow in elderly CAD. Full dose risks MI. PEARL: Elderly + CAD + hypothyroidism = 25 mcg/day start regardless of TSH.\n",
  dka_inpatient: "EX(DKA in ED): BP 92/58, K+ 5.8, glucose 487, pH 7.22, on SGLT2i, fever. CORRECT: IV NS 1-1.5 L/hr FIRST, check K+, insulin only if K+≥3.5, hold SGLT2i entire episode, blood cultures. WHY: Fluids before insulin always — K+ below 3.5 = fatal arrhythmia if insulin given. PEARL: DKA = fluids first, check K+ before insulin.\n",
  dka_outpatient: "EX(DKA in clinic): 42yo T1DM in outpatient clinic, glucose 524, pH 7.18, positive ketones. CORRECT: IV access + stabilizing bolus then TRANSFER TO ED immediately. WHY: Outpatient clinic cannot manage DKA — needs inpatient monitoring, insulin drip, electrolyte replacement. PEARL: DKA in outpatient = stabilize and transfer to ED. Never start insulin drip in clinic.\n",
  cgm: "EX(CGM before adjustment): 45yo T2DM, HbA1c 8.5%, symptomatic hypoglycemia on MDI. CORRECT: Initiate CGM. WHY: Never adjust insulin blindly. PEARL: Above-target HbA1c + hypoglycemia on insulin = CGM first.\n",
  agp: "EX(AGP): 28yo T1DM on pump, TBR 6%, nocturnal lows 2-4AM, rebound morning hyperglycemia. CORRECT: Decrease nocturnal basal rate 12-4AM. WHY: Fix TBR >4% before any hyperglycemia adjustment. PEARL: AGP = look at TBR first always.\n",
  aid: "EX(AID Rule of 15): 34yo T1DM on AID, treats 65 mg/dL with 15g carbs, skyrockets to 250. CORRECT: 5-8g carbs only — AID suspended basal 20-45min before via PLGS. WHY: Rule of 15 obsolete on AID systems. PEARL: AID = micro-treat lows with 5-8g carbs.\n",
  lipids: "EX(REDUCE-IT): 54yo, T2DM, TG 285, no prior statin. CORRECT: High-intensity statin + lifestyle first, THEN IPE only if TG≥150 after 4+ weeks stable statin. WHY: REDUCE-IT required stable statin x4 weeks. PEARL: Never start IPE simultaneously with statin.\n",
  t2dm: "EX(T2DM dual): 51yo, HbA1c 8.9%, UACR 42, eGFR 78. CORRECT: Metformin + semaglutide 0.25mg weekly (NOT 0.5mg). WHY: ADA dual therapy when HbA1c>8.5% with cardiorenal risk. FDA requires 0.25mg initiation. PEARL: Semaglutide always starts 0.25mg weekly x4 weeks.\n",
  hfref: "EX(HFrEF): 64yo, LVEF 35%, HbA1c 7.4%. CORRECT: Add empagliflozin regardless of HbA1c. WHY: EMPEROR-Reduced/DAPA-HF — SGLT2i mandatory in HFrEF. Pioglitazone contraindicated in HF. PEARL: HFrEF + diabetes = SGLT2i non-negotiable regardless of A1c.\n",
  catabolic: "EX(Catabolic DM): 48yo, HbA1c 11.8%, 15-lb weight loss, glucose 345, trace ketones. CORRECT: Basal insulin glargine. WHY: Insulin first when HbA1c>10%, glucose≥300, OR active catabolism. GLP-1 RA worsens catabolism. PEARL: Weight loss + polyuria + HbA1c>10% = insulin first.\n",
  pancreatitis: "EX(Pancreatitis): Lipase 1240, TG 1500. CORRECT: Moderate goal-directed IV LR 1.5 mL/kg/hr. WHY: WATERFALL 2022 — aggressive NS causes volume overload with no benefit. PEARL: Moderate LR not aggressive NS — WATERFALL 2022 ended that dogma.\n",
  thyroid_ca: "EX(Papillary thyroid cancer): 2.6cm PTC, extrathyroidal extension, 2/8 positive nodes, post-thyroidectomy. Q: Greatest long-term clinical risk of the MALIGNANCY? CORRECT: Locoregional recurrence 15-20%. TRAP: Hypoparathyroidism is surgical complication not cancer complication. PEARL: Use 'greatest long-term clinical risk associated with the underlying malignancy' — not 'complication of this condition'.\n",
  osa: "EX(OSA): BMI 29, AHI 32, CPAP scheduled. CORRECT: Await CPAP — no pharmacotherapy. WHY: Tirzepatide adjunct (SURMOUNT-OSA 2024) not replacement. Modafinil only after CPAP optimized. Zolpidem contraindicated. PEARL: OSA = CPAP first always.\n",
  sheehan: "EX(Sheehan): 35yo, 14mo post-PPH, amenorrhea, central hypothyroidism, Na 131, K 4.1 (normal). Q: Before levothyroxine? CORRECT: Check 8AM cortisol or cosyntropin stim first. FATAL TRAP: Levothyroxine before cortisol = adrenal crisis. Normal K+ = central not primary AI. PEARL: Hypopituitarism = CORTISOL FIRST, THYROID SECOND.\n",
  hypoparathyroid: "EX(Hypoparathyroid): Carbonate 2500mg TID (=3g elemental), calcitriol 0.5mcg BID, 24hr urine Ca 410 (>300 threshold). CORRECT: Palopegteriparatide (Yorvipath) — FDA Aug 2024. NEVER Natpara (recalled 2019, discontinued). CALCIUM MATH: Carbonate=40% elemental. PEARL: Conventional ceiling = 24hr urine Ca>300 + >2.5g elemental + calcitriol>0.5mcg BID.\n",
  ibd: "EX(UC refractory): CRP 48, fecal calprotectin 1840, albumin 2.8, tachycardia, on optimized 5-ASA. CORRECT: Infliximab induction + IV methylprednisolone bridging. WHY: Active inflammation despite optimized 5-ASA = moderate-severe UC — biologic induction per ACG. Oral prednisone alone = steroid dependence trap. DISEASE ACUITY: Fecal calprotectin>1500 + hypoalbuminemia = biologic induction, not another steroid course.\n",
  step1_mech: "STEP 1 EX(Mechanism): 19yo DKA, glucose 520, pH 7.21, ketones. Q: Which enzyme overactivity provides precursors for ketonuria? CORRECT: Hormone-sensitive lipase. WHY: Insulin deficiency → HSL uninhibited → triglycerides → FFAs → ketones. Lipoprotein lipase DECREASES in insulin deficiency (trap). PEARL: Step 1 = diagnose first, then find the biochemical mechanism — never ask management.\n",
  step3_context: "STEP 3 EX(Context change): 28yo euthyroid Graves on methimazole 10mg, 7 weeks pregnant. CORRECT: Switch to PTU immediately. WHY: Methimazole teratogenic first trimester (aplasia cutis). Switch back to methimazole in second trimester (PTU hepatotoxicity). PEARL: Step 3 = management changes when CONTEXT changes, not just when disease changes.\n"
};

function selectExemplars(topic, level) {
  var t = topic.toLowerCase();
  var selected = [];

  var tagMap = [
    { tags:["adrenal","cushing","aldoster","pheochro"], key:"adrenal" },
    { tags:["virilization","dheas"], key:"adrenal" },
    { tags:["pituitary","prolactin","acromegaly","apoplexy"], key:"pituitary" },
    { tags:["sheehan","postpartum","hypopituit","panhypopituit"], key:"sheehan" },
    { tags:["thyroid cancer","papillary","ptc","thyroidectomy"], key:"thyroid_ca" },
    { tags:["methimazole","rai","graves","toxic nodule","hyperthyroid"], key:"thyroid_tx" },
    { tags:["levothyroxine","hypothyroid","myxedema"], key:"levothyroxine" },
    { tags:["tsh resistance","tshr"], key:"thyroid_dx" },
    { tags:["dka","ketoacidosis"], key:"dka_inpatient" },
    { tags:["cgm","sensor","time in range"], key:"cgm" },
    { tags:["agp","tbr","tir","nocturnal hypoglycemia"], key:"agp" },
    { tags:["aid","closed loop","insulin pump"], key:"aid" },
    { tags:["t1dm","type 1","microvascular screening"], key:"cgm" },
    { tags:["type 2 diabetes","t2dm","semaglutide","glp-1","sglt2","metformin","tirzepatide"], key:"t2dm" },
    { tags:["heart failure","hfref","lvef","empagliflozin"], key:"hfref" },
    { tags:["catabolic","weight loss","hba1c 11","glucose 300"], key:"catabolic" },
    { tags:["lipid","statin","triglyceride","icosapent","dyslipidemia"], key:"lipids" },
    { tags:["pancreatitis","lipase"], key:"pancreatitis" },
    { tags:["sleep apnea","cpap","osa"], key:"osa" },
    { tags:["calcium","parathyroid","hypoparathyroid","calcitriol"], key:"hypoparathyroid" },
    { tags:["ulcerative colitis","crohn","ibd","mesalamine","infliximab"], key:"ibd" },
  ];

  for (var i = 0; i < tagMap.length; i++) {
    for (var j = 0; j < tagMap[i].tags.length; j++) {
      if (t.includes(tagMap[i].tags[j])) {
        if (selected.indexOf(tagMap[i].key) === -1) selected.push(tagMap[i].key);
        break;
      }
    }
  }

  // Fill to 3 with relevant fallbacks
  var fallbacks = ["dka_inpatient","sheehan","ibd","pancreatitis","thyroid_ca","hypoparathyroid","lipids","osa"];
  for (var k = 0; k < fallbacks.length && selected.length < 3; k++) {
    if (selected.indexOf(fallbacks[k]) === -1) selected.push(fallbacks[k]);
  }

  selected = selected.slice(0, 3); // Cap at 3 for speed

  var result = "EXEMPLARS — study for clinical reasoning, distractor logic, and phrasing:\n\n";
  for (var m = 0; m < selected.length; m++) {
    if (ALL_EXEMPLARS[selected[m]]) result += ALL_EXEMPLARS[selected[m]] + "\n";
  }

  // Add level-specific exemplar
  if (level && level.includes("Step 1")) result += ALL_EXEMPLARS["step1_mech"] + "\n";
  else if (level && level.includes("Step 3")) result += ALL_EXEMPLARS["step3_context"] + "\n";

  return result;
}

// ─── BLUEPRINTS ───────────────────────────────────────────────────────────────

var ABIM_IM_BLUEPRINT = [
  {weight:14,category:"Cardiovascular Disease",topics:["Coronary artery disease and ACS","Heart failure (HFrEF, HFpEF)","Atrial fibrillation","Valvular heart disease","Hypertension","Dyslipidemia and statin therapy","Pulmonary embolism","Infective endocarditis","Cardiac arrhythmias","Aortic dissection"]},
  {weight:9,category:"Pulmonary Disease",topics:["COPD - GOLD staging","Asthma - step therapy","Community-acquired pneumonia","Interstitial lung disease","Obstructive sleep apnea","Pleural effusion","ARDS","Pulmonary hypertension"]},
  {weight:9,category:"Endocrinology, Diabetes, and Metabolism",topics:["Type 2 diabetes - GLP-1 RA and SGLT2i","Type 1 diabetes and DKA","Hypothyroidism","Hyperthyroidism and Graves disease","Adrenal insufficiency","Cushing syndrome","Primary aldosteronism","Pheochromocytoma","Osteoporosis","Hypercalcemia and hyperparathyroidism"]},
  {weight:9,category:"Gastroenterology",topics:["Inflammatory bowel disease - Crohn vs UC","Cirrhosis complications","GI bleeding","Hepatitis B","Hepatitis C","Acute pancreatitis","NAFLD and NASH","Peptic ulcer disease"]},
  {weight:9,category:"Infectious Disease",topics:["Sepsis and septic shock","HIV","Tuberculosis","Urinary tract infections","Skin and soft tissue infections","C. difficile colitis","Meningitis"]},
  {weight:9,category:"Rheumatology",topics:["Rheumatoid arthritis","Systemic lupus erythematosus","Gout","Giant cell arteritis and PMR","Ankylosing spondylitis","Vasculitis","Antiphospholipid syndrome"]},
  {weight:6,category:"Hematology",topics:["Iron deficiency anemia","Hemolytic anemia","Thrombocytopenia - ITP, TTP, HIT","Sickle cell disease","DVT and PE","Heparin-induced thrombocytopenia"]},
  {weight:6,category:"Nephrology",topics:["Acute kidney injury","CKD and SGLT2i","Glomerulonephritis","Hyponatremia","Hyperkalemia","Metabolic acidosis"]},
  {weight:6,category:"Medical Oncology",topics:["Lung cancer","Breast cancer","Lymphoma","Leukemia","Multiple myeloma","Oncologic emergencies"]},
  {weight:4,category:"Neurology",topics:["Ischemic stroke","Seizures","Multiple sclerosis","Parkinson disease","Dementia","Myasthenia gravis"]},
  {weight:4,category:"Psychiatry",topics:["Major depressive disorder","Bipolar disorder","Alcohol use disorder","Opioid use disorder","Delirium"]},
  {weight:3,category:"Preventive Medicine",topics:["Cancer screening - USPSTF","Biostatistics - NNT, sensitivity, specificity","Medical ethics","Health disparities"]},
];

var ABIM_ENDO_BLUEPRINT = [
  {weight:24,category:"Diabetes Mellitus and Hypoglycemia",topics:["ADA Standards - glycemic targets","Type 2 diabetes - GLP-1 RA, SGLT2i, tirzepatide","Type 1 diabetes - MDI vs AID systems","DKA and HHS","Hypoglycemia unawareness","Inpatient glycemic management","CVOT data - SGLT2i and GLP-1 RA","Gestational diabetes","MODY and LADA"]},
  {weight:15,category:"Thyroid Disorders",topics:["Hypothyroidism - primary vs central","Hashimoto thyroiditis","Hyperthyroidism - Graves disease","Thyroid storm","Thyroid nodule - ATA risk stratification","Thyroid cancer - RAI and surveillance","Thyroid disease in pregnancy","Amiodarone-induced thyroid disease"]},
  {weight:15,category:"Calcium and Bone Disorders",topics:["Hypercalcemia - PTH vs PTHrP","Primary hyperparathyroidism","Hypoparathyroidism - Yorvipath","Osteoporosis - DXA, FRAX, bisphosphonates","Vitamin D deficiency","Paget disease","Hypocalcemia"]},
  {weight:12,category:"Lipids, Obesity, and Nutrition",topics:["Dyslipidemia - ACC/AHA statin intensity","PCSK9 inhibitors","Familial hypercholesterolemia","Hypertriglyceridemia","Obesity - GLP-1 RA","Bariatric surgery","Metabolic syndrome"]},
  {weight:10,category:"Adrenal Disorders",topics:["Primary adrenal insufficiency","Secondary adrenal insufficiency","Adrenal crisis","Cushing syndrome","Cushing disease vs ectopic ACTH","Primary aldosteronism","Pheochromocytoma","Adrenal incidentaloma","Congenital adrenal hyperplasia"]},
  {weight:10,category:"Pituitary Disorders",topics:["Pituitary adenoma","Prolactinoma","Acromegaly","Cushing disease - IPSS","Central diabetes insipidus","SIADH","Hypopituitarism","Pituitary apoplexy","Sheehan syndrome"]},
  {weight:7,category:"Female Reproduction",topics:["PCOS","Menopause and HRT","Premature ovarian insufficiency","Amenorrhea workup","Hyperprolactinemia","Turner syndrome"]},
  {weight:7,category:"Male Reproduction",topics:["Male hypogonadism","Klinefelter syndrome","Male infertility","Testosterone therapy","Delayed puberty"]},
];

var USMLE_STEP1_BLUEPRINT = [
  {weight:16,category:"Reproductive and Endocrine Systems",topics:["HPG axis - feedback loops","Thyroid hormone synthesis","Adrenal cortex zones","Insulin and glucagon physiology","Type 1 diabetes - HLA-DR3/DR4","CAH - enzyme deficiencies","Androgen insensitivity","5-alpha reductase deficiency"]},
  {weight:13,category:"Behavioral Health and Nervous Systems",topics:["Neurotransmitters - dopamine, serotonin, GABA","Antidepressant mechanisms - SSRI, TCA, MAOI","Antipsychotics - D2 blockade and EPS","Lithium mechanism and toxicity","Opioid pharmacology - mu receptor","Autonomic pharmacology","Stroke syndromes - MCA, PCA, PICA"]},
  {weight:13,category:"Respiratory and Renal Systems",topics:["PFTs - obstructive vs restrictive","Hypoxemia - V/Q mismatch vs shunt","Acid-base compensation","Renal tubular physiology","Diuretics by segment","RAAS physiology","Nephritic vs nephrotic pathology"]},
  {weight:11,category:"Cardiovascular System",topics:["Cardiac action potential","Frank-Starling law","Antiarrhythmics - Vaughan-Williams","Atherosclerosis pathology","MI biomarkers and ECG","Congenital heart defects"]},
  {weight:10,category:"Blood and Immune Systems",topics:["Anemia classification","Clotting cascade","Hypersensitivity Type I-IV","Immunodeficiencies","Complement system"]},
  {weight:9,category:"Gastrointestinal System",topics:["GI hormones","Liver metabolism","Bilirubin metabolism","H. pylori virulence","Hepatitis serology"]},
  {weight:5,category:"Biostatistics",topics:["Sensitivity and specificity","PPV and NPV - prevalence effect","Study designs","NNT calculation"]},
];

var USMLE_STEP2_BLUEPRINT = [
  {weight:13,category:"Cardiovascular System",topics:["Chest pain - ACS and HEART score","STEMI management","Heart failure - GDMT","Atrial fibrillation - CHA2DS2-VASc","Hypertensive urgency vs emergency","Aortic stenosis - TAVR vs SAVR"]},
  {weight:12,category:"Renal, Urinary, and Reproductive Systems",topics:["Acute kidney injury","CKD complications","Hyponatremia - SIADH","UTI and pyelonephritis","Ovarian cancer","Testicular cancer"]},
  {weight:11,category:"Legal, Ethical Issues, and Patient Safety",topics:["Informed consent - capacity","Confidentiality - duty to warn","End-of-life care","Medical errors","Advance directives"]},
  {weight:10,category:"Behavioral Health",topics:["Suicide risk assessment","Major depression","Bipolar disorder","Substance use disorders","Eating disorders - refeeding"]},
  {weight:10,category:"Nervous System",topics:["Stroke - tPA eligibility","Seizure workup","Headache types","Multiple sclerosis","Vertigo - BPPV vs central"]},
  {weight:9,category:"Musculoskeletal and Skin",topics:["Low back pain - red flags","Gout - acute and ULT timing","Cellulitis - MRSA","Melanoma workup"]},
  {weight:8,category:"Respiratory System",topics:["Pneumonia - PORT/PSI","COPD exacerbation","Pulmonary embolism - Wells","Lung cancer - screening"]},
  {weight:7,category:"Endocrine System",topics:["Diabetes - A1c targets","Thyroid nodule - FNA criteria","Adrenal insufficiency - stress dosing","Cushing screening","Hypercalcemia workup"]},
  {weight:7,category:"Pregnancy and Childbirth",topics:["Preeclampsia","Gestational diabetes","Placenta previa vs abruption","Postpartum hemorrhage","Ectopic pregnancy"]},
  {weight:6,category:"Gastrointestinal System",topics:["Upper GI bleeding - Rockall","Acute pancreatitis - BISAP","Cirrhosis - SBP and hepatorenal","IBD - biologic escalation"]},
];

var USMLE_STEP3_BLUEPRINT = [
  {weight:13,category:"Biostatistics and Population Health",topics:["Evidence-based medicine","Screening statistics","Pre-test probability","Study design","NNT and ARR","Quality improvement - PDSA"]},
  {weight:11,category:"Cardiovascular System",topics:["Outpatient heart failure - GDMT","Secondary prevention post-MI","Hypertension by comorbidity","Atrial fibrillation anticoagulation","Peripheral vascular disease"]},
  {weight:10,category:"Nervous System",topics:["Stroke secondary prevention","Epilepsy - driving restrictions","Parkinson disease","Dementia types","Migraine prophylaxis"]},
  {weight:9,category:"Communication and Ethics",topics:["Informed consent - capacity","Advance care planning","Breaking bad news - SPIKES","Medical errors disclosure","Palliative vs hospice"]},
  {weight:9,category:"Respiratory System",topics:["COPD - LABA/LAMA","Asthma biologics","OSA - CPAP adherence","IPF - antifibrotic therapy"]},
  {weight:8,category:"Endocrine System",topics:["Diabetes - A1c by age and comorbidity","Thyroid nodule surveillance","Adrenal incidentaloma follow-up","Metabolic syndrome"]},
  {weight:7,category:"Gastrointestinal System",topics:["Colonoscopy surveillance intervals","Hepatitis C - DAA and surveillance","IBD maintenance therapy"]},
  {weight:6,category:"Renal and Urinary",topics:["CKD - BP targets and SGLT2i","BPH management","Nephrolithiasis workup"]},
  {weight:6,category:"Behavioral Health",topics:["Depression augmentation","Anxiety - CBT and medication","Substance use - MAT","ADHD in adults"]},
  {weight:5,category:"Musculoskeletal System",topics:["Osteoarthritis - non-pharmacologic","RA monitoring - DAS28","Gout prophylaxis","Osteoporosis - medication holidays"]},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function weightedRandom(blueprint) {
  var total = blueprint.reduce(function(s,b){return s+b.weight;},0);
  var rand = Math.random()*total;
  for (var i=0;i<blueprint.length;i++){rand-=blueprint[i].weight;if(rand<=0)return blueprint[i];}
  return blueprint[blueprint.length-1];
}
function pickRandom(arr){return arr[Math.floor(Math.random()*arr.length)];}

function getRadiopaediaLink(topic) {
  var links = {
    "pneumonia":"https://radiopaedia.org/search?q=pneumonia&lang=us",
    "ards":"https://radiopaedia.org/search?q=ARDS&lang=us",
    "pleural":"https://radiopaedia.org/search?q=pleural+effusion&lang=us",
    "pneumothorax":"https://radiopaedia.org/search?q=pneumothorax&lang=us",
    "pulmonary embolism":"https://radiopaedia.org/search?q=pulmonary+embolism+CT&lang=us",
    "interstitial lung":"https://radiopaedia.org/search?q=interstitial+lung+disease+HRCT&lang=us",
    "heart failure":"https://radiopaedia.org/search?q=heart+failure+cardiomegaly&lang=us",
    "aortic dissection":"https://radiopaedia.org/search?q=aortic+dissection+CT&lang=us",
    "stroke":"https://radiopaedia.org/search?q=ischemic+stroke+MRI+DWI&lang=us",
    "multiple sclerosis":"https://radiopaedia.org/search?q=multiple+sclerosis+MRI&lang=us",
    "thyroid nodule":"https://radiopaedia.org/search?q=thyroid+nodule+ultrasound&lang=us",
    "thyroid cancer":"https://radiopaedia.org/search?q=thyroid+cancer+ultrasound&lang=us",
    "cushing":"https://radiopaedia.org/search?q=adrenal+adenoma+cushing+CT&lang=us",
    "aldosteronism":"https://radiopaedia.org/search?q=adrenal+adenoma+CT&lang=us",
    "pheochromocytoma":"https://radiopaedia.org/search?q=pheochromocytoma+MRI&lang=us",
    "acromegaly":"https://radiopaedia.org/search?q=pituitary+macroadenoma+MRI&lang=us",
    "prolactinoma":"https://radiopaedia.org/search?q=prolactinoma+pituitary+MRI&lang=us",
    "osteoporosis":"https://radiopaedia.org/search?q=osteoporosis+compression+fracture&lang=us",
    "hyperparathyroidism":"https://radiopaedia.org/search?q=hyperparathyroidism+sestamibi&lang=us",
    "cirrhosis":"https://radiopaedia.org/search?q=cirrhosis+liver+CT&lang=us",
    "pancreatitis":"https://radiopaedia.org/search?q=acute+pancreatitis+CT&lang=us",
    "nephrolithiasis":"https://radiopaedia.org/search?q=kidney+stones+CT&lang=us",
    "rheumatoid arthritis":"https://radiopaedia.org/search?q=rheumatoid+arthritis+xray&lang=us",
    "ankylosing":"https://radiopaedia.org/search?q=ankylosing+spondylitis+MRI&lang=us",
    "gout":"https://radiopaedia.org/search?q=gout+joint+xray&lang=us",
    "tuberculosis":"https://radiopaedia.org/search?q=tuberculosis+chest+xray&lang=us",
    "pcos":"https://radiopaedia.org/search?q=polycystic+ovary+ultrasound&lang=us",
    "graves":"https://radiopaedia.org/search?q=graves+disease+thyroid+scan&lang=us",
    "hashimoto":"https://radiopaedia.org/search?q=hashimoto+thyroid+ultrasound&lang=us",
  };
  var t = topic.toLowerCase();
  for (var key in links){if(t.includes(key))return links[key];}
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

  // Level instruction
  var levelNote = "";
  if (level.includes("Step 1")) {
    levelNote = "LEVEL: USMLE Step 1 — TWO-STEP EXAM. Diagnose the patient, then ask about the underlying MECHANISM, BIOCHEMISTRY, ENZYME, or RECEPTOR. NEVER ask for next step in management. Ask WHY things happen at the molecular/cellular level. Tasks: most likely mechanism, most likely pathophysiologic explanation, most likely enzyme, most likely cause of lab finding.";
  } else if (level.includes("Step 2")) {
    levelNote = "LEVEL: USMLE Step 2 CK — CLINICAL ALGORITHM EXAM. Test next best step and correct sequence of workup/treatment. Distractors = right test or treatment in wrong order. OUTPATIENT RULE: If patient is in outpatient clinic/urgent care with a condition requiring hospital care (DKA, sepsis, STEMI, stroke, adrenal crisis) — correct answer is TRANSFER TO ED. Never manage inpatient protocols in outpatient setting.";
  } else if (level.includes("Step 3")) {
    levelNote = "LEVEL: USMLE Step 3 — CONTEXT-CHANGE EXAM. Test drug safety in pregnancy/renal failure/elderly, transitions of care, management changes when context shifts. Example: euthyroid Graves on methimazole + first trimester pregnancy = switch to PTU immediately even though controlled.";
  } else if (level.includes("ABIM Internal Medicine")) {
    levelNote = "LEVEL: ABIM Internal Medicine — ATTENDING-LEVEL JUDGMENT. Test both inpatient and outpatient management. DISEASE ACUITY RULE: Match treatment intensity to severity. Fecal calprotectin>1500 + hypoalbuminemia + tachycardia on optimized 5-ASA = biologic induction, not another steroid course.";
  } else if (level.includes("ABIM Endocrinology")) {
    levelNote = "LEVEL: ABIM Endocrinology — FELLOWSHIP-LEVEL NUANCE per ADA, Endocrine Society, AACE, ATA. Test guideline thresholds, drug sequencing, special populations, and multi-comorbidity scenarios.";
  }

  // Society citation
  var societyMap = "";
  if (t.includes("thyroid")||t.includes("hashimoto")||t.includes("graves")||t.includes("hypothyroid")||t.includes("hyperthyroid")) societyMap="Cite ATA and/or Endocrine Society. NEVER cite ADA for thyroid.";
  else if (t.includes("diabetes")||t.includes("insulin")||t.includes("cgm")||t.includes("dka")||t.includes("glp-1")||t.includes("sglt2")||t.includes("metformin")||t.includes("tirzepatide")) societyMap="Cite current ADA Standards of Care and/or AACE.";
  else if (t.includes("osteoporosis")||t.includes("bone")||t.includes("calcium")||t.includes("parathyroid")||t.includes("vitamin d")||t.includes("hypoparathyroid")) societyMap="Cite Endocrine Society and/or BHOF.";
  else if (t.includes("adrenal")||t.includes("cushing")||t.includes("aldosteronism")||t.includes("pheochromocytoma")) societyMap="Cite Endocrine Society Clinical Practice Guidelines.";
  else if (t.includes("pituitary")||t.includes("acromegaly")||t.includes("prolactinoma")||t.includes("sheehan")) societyMap="Cite Endocrine Society Clinical Practice Guidelines.";
  else if (t.includes("heart failure")||t.includes("acs")||t.includes("stemi")||t.includes("atrial fibrillation")||t.includes("hypertension")||t.includes("dyslipidemia")) societyMap="Cite ACC/AHA guidelines.";
  else if (t.includes("copd")||t.includes("asthma")) societyMap="Cite GOLD for COPD, GINA for asthma.";
  else if (t.includes("pneumonia")) societyMap="Cite IDSA/ATS pneumonia guidelines.";
  else if (t.includes("sleep apnea")||t.includes("osa")) societyMap="Cite AASM guidelines.";
  else if (t.includes("kidney")||t.includes("renal")||t.includes("ckd")||t.includes("aki")) societyMap="Cite KDIGO guidelines.";
  else if (t.includes("rheumatoid")||t.includes("lupus")||t.includes("gout")||t.includes("vasculitis")) societyMap="Cite ACR and/or EULAR guidelines.";
  else if (t.includes("sepsis")||t.includes("septic")) societyMap="Cite Surviving Sepsis Campaign.";
  else if (t.includes("hiv")) societyMap="Cite DHHS HIV treatment guidelines.";
  else if (t.includes("tuberculosis")) societyMap="Cite ATS/CDC/IDSA TB guidelines.";
  else if (t.includes("pancreatitis")) societyMap="Cite ACG guidelines and WATERFALL trial (NEJM 2022).";
  else if (t.includes("gi bleeding")||t.includes("cirrhosis")||t.includes("hepatitis")||t.includes("liver")) societyMap="Cite AASLD and ACG guidelines.";
  else if (t.includes("inflammatory bowel")||t.includes("crohn")||t.includes("ulcerative colitis")||t.includes("ibd")) societyMap="Cite ACG Guidelines (Rubin et al. 2019 for UC).";
  else if (t.includes("hospital")||t.includes("inpatient")) societyMap="Cite Society of Hospital Medicine (SHM) guidelines.";
  else societyMap="Cite the most current relevant specialty society guideline.";

  // Board task rotation
  var boardTasks;
  if (level.includes("Step 1")) {
    boardTasks = [
      "most likely underlying mechanism of this patient's condition",
      "most likely pathophysiologic explanation for these findings",
      "most likely cause of this laboratory abnormality",
      "most likely underlying cause of this patient's presentation",
      "most likely diagnosis",
    ];
  } else if (level.includes("Step 3")) {
    boardTasks = [
      "most appropriate next step in management",
      "most appropriate long-term management strategy",
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
  var selectedTask = boardTasks[Math.floor(Math.random()*boardTasks.length)];

  var imagingNote = radiopaediaLink ? " Describe key imaging findings as a clinician would dictate." : "";
  var cgmNote = (t.includes("cgm")||t.includes("aid")||t.includes("insulin pump")||t.includes("ambulatory glucose")) ? " Include CGM metrics: TIR%, TBR%, TAR%, GMI." : "";
  var jsonSchema = '{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"'+specificTopic+'","imageUrl":'+(radiopaediaLink?'"'+radiopaediaLink+'"':'null')+',"showImageButton":false}';

  var exemplars = selectExemplars(specificTopic, level);

  // ─── SYSTEM TEXT ──────────────────────────────────────────────────────────

  var systemText =
    "You are a senior ABIM item-writing committee member and fellowship program director.\n\n" +

    "CORE PHILOSOPHY: Test CLINICAL REASONING and JUDGMENT. Every question forces the learner to think like a master clinician — not retrieve memorized facts.\n\n" +

    "QUESTION TYPES — rotate equally across ALL specialties:\n" +
    "Diagnosis | Next best step | Monitoring | Mechanism | Interpretation | Complication | Management\n\n" +

    "EXPLANATION FORMAT — exactly 3 sentences:\n" +
    "1. Why correct answer is right + one guideline citation.\n" +
    "2. Why the 2 most tempting wrong answers are wrong + name the cognitive trap each represents.\n" +
    "3. Board pearl — an insight that changes clinical thinking. Never restate the answer.\n\n" +

    "ABIM ITEM-WRITING STANDARDS:\n" +
    "A. COVER-THE-OPTIONS TEST: Stem + lead-in must point to the correct answer domain WITHOUT seeing the choices. If a test-taker can identify the correct answer by keyword-matching alone (e.g., stem asks for a 'clinical' risk and only one option is clinical), the item is structurally flawed. All 5 options must be from the same category.\n" +
    "B. NEVER PATHOLOGIZE CULTURAL PRACTICES: A patient's cultural preference, family decision-making style, or religious belief is NOT a medical condition or 'underlying condition.' Cultural competency questions test the physician's appropriate response or ethical principle — not the patient's background.\n" +
    "C. NO FABRICATED URGENCY: Do not invent clinical urgency that does not exist. The adenoma-to-carcinoma sequence takes years. A one-week delay in asymptomatic screening colonoscopy has zero measurable clinical risk. Only use urgency when it genuinely exists.\n" +
    "D. HOMOGENEOUS CHOICES: All 5 options must be from the same category. Never mix clinical outcomes with ethical principles with interpersonal risks in the same option set.\n" +
    "E. MATCH QUESTION TO VIGNETTE FOCUS: If the vignette is about communication and cultural dynamics, test those domains. Do not pivot to oncology staging in a vignette focused on physician-patient communication.\n" +
    "F. NEVER use 'most appropriate initial pharmacotherapy' as the lead-in. Use 'most appropriate next step in management.'\n" +
    "G. For cancer complications: use 'greatest long-term clinical risk associated with the underlying malignancy' — not 'complication of this condition' which is ambiguous.\n\n" +

    "CLINICAL ACCURACY RULES:\n" +
    "1. Labs must match diagnosis. Overt hypothyroidism = TSH>10 AND free T4 below range. Subclinical = TSH 4.5-10 AND normal T4.\n" +
    "2. Overt hyperthyroidism = TSH<0.01 AND free T4 above range.\n" +
    "3. DKA IN ED/INPATIENT: Fluids first (NS 1-1.5 L/hr) → check K+ → insulin only if K+≥3.5 → dextrose at glucose 200-250 → hold SGLT2i entire episode.\n" +
    "4. DKA IN OUTPATIENT CLINIC: Stabilize + IV access + bolus → TRANSFER TO ED. Never start insulin drip in clinic.\n" +
    "5. Primary AI: low cortisol + HIGH ACTH + hyperkalemia + hyperpigmentation. Secondary AI: low cortisol + low ACTH + normal K+ + no hyperpigmentation.\n" +
    "6. Semaglutide SC: start 0.25mg weekly x4 weeks. NEVER 0.5mg at initiation.\n" +
    "7. Tirzepatide: start 2.5mg weekly x4 weeks.\n" +
    "8. SGLT2i in HFrEF: mandatory when LVEF<40% regardless of HbA1c (EMPEROR-Reduced, DAPA-HF).\n" +
    "9. Pioglitazone: CONTRAINDICATED in heart failure.\n" +
    "10. Insulin first when: HbA1c>10%, glucose≥300, OR active catabolism.\n" +
    "11. Pancreatitis: moderate goal-directed LR 1.5 mL/kg/hr (WATERFALL 2022) — NOT aggressive NS.\n" +
    "12. Calcium carbonate = 40% elemental. 1000mg carbonate = 400mg elemental.\n" +
    "13. Natpara (rhPTH 1-84): RECALLED 2019, DISCONTINUED. Use palopegteriparatide (Yorvipath) FDA approved August 2024.\n" +
    "14. Hypopituitarism: CORTISOL FIRST, THYROID SECOND — levothyroxine before cortisol = fatal adrenal crisis.\n" +
    "15. REDUCE-IT: statin first → recheck 4-12 weeks → IPE only if TG≥150 on stable statin x4 weeks.\n" +
    "16. OSA: CPAP first-line. Tirzepatide adjunct only (SURMOUNT-OSA 2024). Modafinil only after CPAP optimized.\n" +
    "17. AGP: fix TBR>4% before hyperglycemia. AID: micro-treat lows with 5-8g carbs.\n" +
    "18. Methimazole: teratogenic first trimester — switch to PTU even if euthyroid.\n" +
    "19. IBD acuity: fecal calprotectin>1500 + hypoalbuminemia on optimized 5-ASA = biologic induction.\n" +
    "20. GI bleeding: restrictive transfusion Hgb threshold 7 g/dL.\n" +
    "21. " + societyMap + "\n\n" +

    exemplars;

  var userText =
    levelNote + "\n\n" +
    topicInstruction + "\n\n" +
    "Write a 3-4 sentence clinical vignette." + imagingNote + cgmNote + "\n" +
    "End with: Which of the following is the " + selectedTask + "?\n\n" +
    "CHOICES: 5 options (A-E). One correct per current guidelines. Four plausible distractors representing real cognitive traps. All options must be from the same category.\n\n" +
    "EXPLANATION: Exactly 3 sentences as described above.\n\n" +
    "CRITICAL: Return ONLY valid complete JSON. No markdown. No text outside JSON. Ensure all brackets are closed:\n" +
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

    var randAge = ages[Math.floor(Math.random()*ages.length)];
    var randSex = sexes[Math.floor(Math.random()*sexes.length)];
    var randRace = races[Math.floor(Math.random()*races.length)];
    var randSetting = settings[Math.floor(Math.random()*settings.length)];
    var patientSeed = "Patient: " + randAge + "-year-old " + randRace + " " + randSex + " presenting to a " + randSetting + ". Use these demographics exactly.";

    var promptData = buildPrompt(level, topic);
    var enrichedUserText = patientSeed + "\n\n" + promptData.userText;

    var raw = await callClaude(promptData.systemText, enrichedUserText);

    // Robust JSON extraction — handles any surrounding text or markdown
    var cleaned = raw.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
    var firstBrace = cleaned.indexOf("{");
    var lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No valid JSON object in response");
    }
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);

    // Validate before parsing
    if (!cleaned.includes('"stem"') || !cleaned.includes('"choices"') || !cleaned.includes('"correct"') || !cleaned.includes('"explanation"')) {
      throw new Error("Incomplete JSON — missing required fields");
    }

    var parsed = JSON.parse(cleaned);

    // Validate all required fields exist and are non-empty
    var required = ["stem", "choices", "correct", "explanation"];
    for (var i = 0; i < required.length; i++) {
      if (!parsed[required[i]]) throw new Error("Missing field: " + required[i]);
    }

    // Validate choices A-E all exist
    var choiceKeys = ["A","B","C","D","E"];
    for (var j = 0; j < choiceKeys.length; j++) {
      if (!parsed.choices || !parsed.choices[choiceKeys[j]]) {
        throw new Error("Missing choice " + choiceKeys[j]);
      }
    }

    parsed.imageUrl = parsed.imageUrl || promptData.radiopaediaLink || null;
    parsed.showImageButton = false;
    parsed.topic = parsed.topic || promptData.specificTopic;

    // Save to Supabase asynchronously — does not block response
    saveMcqToSupabase(parsed, level).catch(function(){});

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
