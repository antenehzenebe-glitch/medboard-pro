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

// ─── ALL 20 EXEMPLARS — indexed by tag ───────────────────────────────────────

var ALL_EXEMPLARS = {

  adrenal: "EX1(Adrenal mass): 54yo man, resistant HTN, 15kg gain, DM, bruising, 3.8cm left adrenal mass, atrophic right adrenal, aldosterone 14/renin<0.6. CORRECT: Plasma metanephrines + 1mg DST before surgery. WHY: >2.4cm adrenal tumor requires excluding pheo AND hypercortisolism — contralateral atrophy suggests ACTH-independent Cushing. Surgery without cortisol testing risks adrenal crisis. PEARL: Adrenal tumor >2.4cm = complete hormonal workup before any intervention.\n",

  pituitary: "EX2(Pituitary incidentaloma): 28yo woman, 9mm pituitary adenoma abutting optic chiasm, normal labs, wants pregnancy. CORRECT: Surgical referral. WHY: Pituitary enlarges 3-fold in pregnancy — chiasm compression risk. PEARL: Nonfunctioning adenoma near chiasm + planned pregnancy = surgical referral before conception.\n",

  thyroid_dx: "EX3(TSH resistance): 42yo man, TSH 12.1, free T4 normal, negative antibodies, normal US, child has same labs. CORRECT: TSH receptor resistance (TSHR inactivating variant). WHY: Elevated TSH + normal T4 + negative antibodies + family pattern excludes Hashimoto. PEARL: Subclinical hypothyroid pattern + negative antibodies + family history = think TSHR gene mutation.\n",

  diabetes_screening: "EX4(T1DM screening): 21yo woman, T1DM x3 years, HbA1c 6.8%, two consecutive normal eye exams. Q: What is indicated now? CORRECT: Fasting lipid profile. WHY: ADA — annual lipid profile from T1DM diagnosis day one. Nephropathy and neuropathy screening begin 5 years post-diagnosis. Two normal eye exams extend interval to 2 years. PEARL: Microvascular screening begins 5 years post-T1DM; lipid profile from day one.\n",

  virilization: "EX5(Virilization): 38yo woman, rapid virilization, deepening voice, clitoromegaly, DHEAS 910 mcg/dL. CORRECT: Abdominal CT first. WHY: DHEAS >700 = adrenal source. Pelvic US only when testosterone >200 with normal DHEAS. PEARL: DHEAS >700 with rapid virilization = adrenal carcinoma until proven otherwise — CT first.\n",

  thyroid_tx: "EX6(Elderly hyperthyroidism): 83yo woman, overt hyperthyroidism confirmed x2, toxic MNG, CAD, osteoporosis. CORRECT: Start methimazole. WHY: Must achieve euthyroidism before RAI per ATA. Watchful waiting risks AFib and bone loss. PEARL: Elderly CAD + overt hyperthyroidism = methimazole first, never RAI without euthyroidism.\n",

  cgm: "EX7(CGM before insulin adjustment): 45yo man, T2DM, HbA1c 8.5%, symptomatic hypoglycemia at unpredictable times, on MDI. CORRECT: Initiate CGM. WHY: Never adjust insulin blindly — ADA recommends CGM for all insulin users with hypoglycemia or above-target A1c. PEARL: Above-target HbA1c + hypoglycemia on insulin = CGM first.\n",

  levothyroxine: "EX8(Elderly hypothyroidism): 81yo man, CAD, TSH 25, FT4 0.5, bradycardia. CORRECT: Levothyroxine 25 mcg/day. WHY: ATA — start low go slow in elderly CAD regardless of TSH severity. Full dose risks MI from increased cardiac O2 demand. PEARL: Elderly + CAD + hypothyroidism = 25 mcg/day start.\n",

  dka: "EX9(DKA management): Patient with DKA, BP 92/58, K+ 5.8, glucose 487, pH 7.22, on SGLT2i, fever, pyuria. CORRECT: IV NS 0.9% 1–1.5 L/hr FIRST, then check K+, then insulin infusion 0.1 units/kg/hr only after K+ ≥3.5, hold SGLT2i entire episode, blood cultures. WHY: Fluids before insulin always. K+ below 3.5 = hold insulin or fatal arrhythmia. PEARL: Fluids first, check K+ before insulin, SGLT2i hold until full biochemical resolution.\n",

  lipids: "EX10(Lipids — REDUCE-IT sequencing): 54yo Black man, T2DM, LDL 118, TG 285, no prior statin. CORRECT: High-intensity statin + lifestyle first, recheck 4–12 weeks, THEN add IPE only if TG ≥150 on stable statin. WHY: REDUCE-IT required stable statin x4 weeks — cannot diagnose persistent hypertriglyceridemia without first treating. Starting both simultaneously jumps the gun. PEARL: Statin first, IPE only after confirming persistent hypertriglyceridemia on stable statin.\n",

  t2dm_dual: "EX11(T2DM dual therapy): 51yo Hispanic woman, HbA1c 8.9%, UACR 42, eGFR 78, no CVD. CORRECT: Metformin + semaglutide starting at 0.25 mg weekly (NOT 0.5 mg). WHY: ADA — dual therapy when HbA1c >8.5% with cardiorenal risk. FDA labeling requires semaglutide start at 0.25 mg x4 weeks before titrating. SGLT2i also indicated for albuminuria — note in explanation. PEARL: Semaglutide ALWAYS starts 0.25 mg weekly. Never 0.5 mg at initiation.\n",

  hfref_sglt2: "EX12(HFrEF + T2DM): 64yo man, HFrEF LVEF 35%, HbA1c 7.4%, eGFR 58, on metformin+lisinopril+carvedilol. CORRECT: Add empagliflozin 10 mg daily regardless of HbA1c. WHY: ADA — SGLT2i mandatory in HFrEF (LVEF <40%) regardless of glycemic control. EMPEROR-Reduced and DAPA-HF reduce HF hospitalizations and CV death. Pioglitazone absolutely contraindicated in HF. PEARL: HFrEF + diabetes = SGLT2i non-negotiable regardless of A1c.\n",

  catabolic_dm: "EX13(Catabolic T2DM): 48yo man, no prior DM, HbA1c 11.8%, 15-lb weight loss, glucose 345, trace ketones, normal anion gap. CORRECT: Basal insulin glargine 10 units daily. WHY: ADA — insulin first when HbA1c >10%, glucose ≥300, OR active catabolism. GLP-1 RA contraindicated in active catabolic state — promotes weight loss worsening catabolism. SGLT2i risks euglycemic DKA with trace ketones. PEARL: Weight loss + polyuria + HbA1c >10% = insulin first. Active catabolism = absolute insulin deficiency.\n",

  agp: "EX14(AGP interpretation): 28yo woman, T1DM on CSII pump (no AID), TBR 6%, nocturnal hypoglycemia 55–65 mg/dL at 2–4 AM, rebound fasting hyperglycemia 190–230 mg/dL at 8 AM. CORRECT: Decrease nocturnal basal rate 12–4 AM. WHY: Golden rule — fix TBR >4% before any hyperglycemia adjustment. Morning hyperglycemia is Somogyi rebound from nocturnal low. Increasing morning basal worsens the underlying hypoglycemia. PEARL: Always look at TBR first on AGP. Fix hypoglycemia before hyperglycemia.\n",

  aid: "EX15(AID micro-treat): 34yo man, T1DM on hybrid closed-loop AID system, treats CGM alert at 65 mg/dL with 15g carbs (old Rule of 15), glucose skyrockets to >250 mg/dL two hours later. CORRECT: AID algorithm suspended basal insulin via PLGS 20–45 min before the low — advise micro-treat with 5–8g carbs only. WHY: By the time CGM alerts at 65, pump already applying brakes. Adding 15g on suspended insulin = rebound hyperglycemia. PEARL: Rule of 15 obsolete on AID systems. Micro-treat mild lows with 5–8g carbs.\n",

  pancreatitis: "EX16(Acute pancreatitis): 22yo woman, lipase 1240, TG 1500 (HTG-induced), meets Revised Atlanta criteria. CORRECT: Moderate goal-directed IV Lactated Ringer's 1.5 mL/kg/hr. WHY: WATERFALL trial (NEJM 2022) — aggressive NS halted early due to higher volume overload with no outcome benefit. LR preferred over NS to avoid hyperchloremic acidosis worsening SIRS. Antibiotics only for confirmed infected necrosis, never prophylactic. PEARL: Moderate LR not aggressive NS. WATERFALL 2022 ended the aggressive fluid dogma.\n",

  thyroid_ca: "EX17(Papillary thyroid cancer): 61yo man, 2.6cm PTC, extrathyroidal extension, 2/8 positive central nodes (ATA intermediate risk), post-thyroidectomy. Q: Greatest long-term clinical risk associated with the underlying malignancy? CORRECT: Locoregional recurrence in cervical lymph nodes (15–20% ATA intermediate risk). KEY TRAP: Hypoparathyroidism is a SURGICAL complication not a cancer complication. PHRASING RULE: Always use 'greatest long-term clinical risk associated with the underlying malignancy' not 'complication of this condition'. PEARL: ATA intermediate risk = 15–20% locoregional recurrence — lifelong neck US surveillance mandatory.\n",

  osa: "EX18(OSA management): 31yo woman, BMI 29, AHI 32, CPAP titration scheduled next week. CORRECT: Defer all pharmacotherapy and await CPAP titration. WHY: CPAP = definitive first-line. Tirzepatide FDA-approved adjunct (SURMOUNT-OSA 2024) but NOT CPAP replacement — weight loss takes months while patient needs airway protection now. Modafinil only after CPAP optimized, never before. Zolpidem contraindicated in untreated OSA — worsens upper airway collapse. PEARL: OSA has no pharmacologic cure. CPAP is definitive first-line.\n",

  sheehan: "EX19(Sheehan syndrome): 35yo woman, 14 months post-massive PPH requiring transfusion, amenorrhea, fatigue, 10-lb weight loss, hypotension, loss of axillary/pubic hair, NO hyperpigmentation. Lab: Na 131, K 4.1 (normal), TSH 0.4, free T4 0.5 — central hypothyroidism. Q: Most critical next step BEFORE starting levothyroxine? CORRECT: Check 8AM serum cortisol or cosyntropin stimulation test. FATAL TRAP: Levothyroxine before cortisol replacement precipitates acute adrenal crisis — thyroid hormone increases cortisol clearance and raises metabolic rate, rapidly depleting deficient cortisol. Normal K+ 4.1 confirms central not primary AI (RAAS intact). PEARL: Hypopituitarism = CORTISOL FIRST, THYROID SECOND. This rule saves lives.\n",

  hypoparathyroid: "EX20(Hypoparathyroidism): 29yo woman, 8 months post-thyroidectomy, symptomatic hypocalcemia, carpopedal spasm. On calcium carbonate 2500 mg TID (= 1000 mg elemental TID = 3g elemental/day, above 2.5g threshold), calcitriol 0.5 mcg BID (at ceiling). 24-hr urine calcium 410 mg/day (above 300 mg/day threshold). CORRECT: Add palopegteriparatide (Yorvipath) — FDA approved August 2024 for chronic hypoparathyroidism refractory to conventional therapy. NEVER rhPTH 1-84 (Natpara — recalled FDA 2019, globally discontinued, Special Use Program closed December 2025). CALCIUM MATH: Carbonate is 40% elemental — 1000mg carbonate = 400mg elemental. ALWAYS calculate elemental not salt weight. PEARL: Conventional therapy ceiling = 24hr urine Ca >300 mg/day on >2.5g elemental + calcitriol >0.5mcg BID. Modern answer is Yorvipath.\n"
};

// ─── SELECT RELEVANT EXEMPLARS BY TOPIC ──────────────────────────────────────

function selectExemplars(topic) {
  var t = topic.toLowerCase();
  var selected = [];

  // Always include 1 endocrine and 1 general medicine exemplar
  // Pick topic-relevant ones first, then fill with variety
  var tagMap = [
    { tags: ["adrenal","cushing","aldoster","pheochro","cortisol"], key: "adrenal" },
    { tags: ["pituitary","prolactin","acromegaly","apoplexy","sheehan"], key: "pituitary" },
    { tags: ["sheehan","postpartum","hypopituit","panhypopituit"], key: "sheehan" },
    { tags: ["thyroid","hashimoto","graves","hypothyroid","hyperthyroid","tsh"], key: "thyroid_dx" },
    { tags: ["thyroid cancer","papillary","ptc","ata risk"], key: "thyroid_ca" },
    { tags: ["methimazole","rai","thyrotoxic","toxic nodule"], key: "thyroid_tx" },
    { tags: ["levothyroxine","levo","hypothyroid","myxedema"], key: "levothyroxine" },
    { tags: ["dka","diabetic ketoacidosis","ketoacidosis"], key: "dka" },
    { tags: ["cgm","ambulatory glucose","agp","time in range","tir"], key: "cgm" },
    { tags: ["agp","time in range","tir","tbr","sensor"], key: "agp" },
    { tags: ["aid","closed loop","insulin pump","hybrid"], key: "aid" },
    { tags: ["type 2 diabetes","t2dm","semaglutide","glp-1","sglt2","metformin","tirzepatide"], key: "t2dm_dual" },
    { tags: ["heart failure","hfref","lvef","empagliflozin","dapagliflozin"], key: "hfref_sglt2" },
    { tags: ["catabolism","catabolic","weight loss","glucose 300","hba1c 10"], key: "catabolic_dm" },
    { tags: ["lipid","statin","triglyceride","icosapent","pcsk9","dyslipidemia"], key: "lipids" },
    { tags: ["pancreatitis","lipase","amylase"], key: "pancreatitis" },
    { tags: ["osa","sleep apnea","cpap","apnea"], key: "osa" },
    { tags: ["calcium","parathyroid","hypoparathyroid","yorvipath","natpara"], key: "hypoparathyroid" },
    { tags: ["virilization","dheas","androgen","hirsutism"], key: "virilization" },
    { tags: ["t1dm","type 1 diabetes","screening","microvascular"], key: "diabetes_screening" },
  ];

  // Find matching exemplars
  for (var i = 0; i < tagMap.length; i++) {
    for (var j = 0; j < tagMap[i].tags.length; j++) {
      if (t.includes(tagMap[i].tags[j])) {
        if (selected.indexOf(tagMap[i].key) === -1) {
          selected.push(tagMap[i].key);
        }
        break;
      }
    }
  }

  // Always add a variety of exemplars if fewer than 3 matched
  var fallbacks = ["dka", "lipids", "thyroid_dx", "hfref_sglt2", "pancreatitis", "osa", "sheehan", "hypoparathyroid"];
  for (var k = 0; k < fallbacks.length && selected.length < 3; k++) {
    if (selected.indexOf(fallbacks[k]) === -1) {
      selected.push(fallbacks[k]);
    }
  }

  // Cap at 4 exemplars max for speed
  selected = selected.slice(0, 4);

  var result = "Study these exemplars for clinical depth, reasoning style, and distractor logic:\n\n";
  for (var m = 0; m < selected.length; m++) {
    if (ALL_EXEMPLARS[selected[m]]) {
      result += ALL_EXEMPLARS[selected[m]] + "\n";
    }
  }
  return result;
}

// ─── BLUEPRINTS ───────────────────────────────────────────────────────────────

var ABIM_IM_BLUEPRINT = [
  { weight:14, category:"Cardiovascular Disease", topics:["Coronary artery disease and ACS","Heart failure (HFrEF, HFpEF)","Atrial fibrillation","Valvular heart disease","Hypertension","Dyslipidemia and statin therapy","Pulmonary embolism","Infective endocarditis","Cardiac arrhythmias","Pericarditis and myocarditis","Aortic dissection"] },
  { weight:9,  category:"Pulmonary Disease", topics:["COPD - GOLD staging","Asthma - step therapy","Community-acquired pneumonia","Interstitial lung disease and IPF","Obstructive sleep apnea","Pleural effusion","ARDS","Pulmonary hypertension","Pneumothorax"] },
  { weight:9,  category:"Endocrinology, Diabetes, and Metabolism", topics:["Type 2 diabetes - GLP-1 RA and SGLT2i","Type 1 diabetes and DKA","Hypothyroidism","Hyperthyroidism and Graves disease","Adrenal insufficiency","Cushing syndrome","Primary aldosteronism","Pheochromocytoma","Osteoporosis","Hypercalcemia and hyperparathyroidism","Prolactinoma and acromegaly"] },
  { weight:9,  category:"Gastroenterology", topics:["Inflammatory bowel disease","Cirrhosis complications","GI bleeding","Hepatitis B","Hepatitis C","Acute pancreatitis","NAFLD and NASH","Peptic ulcer disease"] },
  { weight:9,  category:"Infectious Disease", topics:["Sepsis and septic shock","HIV","Tuberculosis","Urinary tract infections","Skin and soft tissue infections","C. difficile colitis","Meningitis"] },
  { weight:9,  category:"Rheumatology", topics:["Rheumatoid arthritis","Systemic lupus erythematosus","Gout","Giant cell arteritis and PMR","Ankylosing spondylitis","Vasculitis","Antiphospholipid syndrome"] },
  { weight:6,  category:"Hematology", topics:["Iron deficiency anemia","Hemolytic anemia","Thrombocytopenia - ITP, TTP, HIT","Sickle cell disease","DVT and PE","Heparin-induced thrombocytopenia"] },
  { weight:6,  category:"Nephrology", topics:["Acute kidney injury","CKD and SGLT2i","Glomerulonephritis","Hyponatremia","Hyperkalemia","Metabolic acidosis"] },
  { weight:6,  category:"Medical Oncology", topics:["Lung cancer","Breast cancer","Lymphoma","Leukemia","Multiple myeloma","Oncologic emergencies"] },
  { weight:4,  category:"Neurology", topics:["Ischemic stroke","Seizures","Multiple sclerosis","Parkinson disease","Dementia","Myasthenia gravis"] },
  { weight:4,  category:"Psychiatry", topics:["Major depressive disorder","Bipolar disorder","Alcohol use disorder","Opioid use disorder","Delirium"] },
  { weight:3,  category:"Preventive Medicine", topics:["Cancer screening - USPSTF","Biostatistics - NNT, sensitivity, specificity","Medical ethics","Health disparities"] },
];

var ABIM_ENDO_BLUEPRINT = [
  { weight:24, category:"Diabetes Mellitus and Hypoglycemia", topics:["ADA Standards - glycemic targets","Type 2 diabetes - GLP-1 RA, SGLT2i, tirzepatide","Type 1 diabetes - MDI vs AID systems","DKA and HHS","Hypoglycemia unawareness","Inpatient glycemic management","CVOT data - GLP-1 RA and SGLT2i","Gestational diabetes","MODY and LADA"] },
  { weight:15, category:"Thyroid Disorders", topics:["Hypothyroidism - primary vs central","Hashimoto thyroiditis","Hyperthyroidism - Graves disease","Thyroid storm","Thyroid nodule - ATA risk stratification","Thyroid cancer - RAI and surveillance","Thyroid disease in pregnancy","Amiodarone-induced thyroid disease","Central hypothyroidism"] },
  { weight:15, category:"Calcium and Bone Disorders", topics:["Hypercalcemia - PTH vs PTHrP","Primary hyperparathyroidism","Hypoparathyroidism - palopegteriparatide (Yorvipath)","Osteoporosis - DXA, FRAX, bisphosphonates","Vitamin D deficiency","Paget disease of bone","Hypocalcemia"] },
  { weight:12, category:"Lipids, Obesity, and Nutrition", topics:["Dyslipidemia - ACC/AHA statin intensity","PCSK9 inhibitors","Familial hypercholesterolemia","Hypertriglyceridemia","Obesity management - GLP-1 RA","Bariatric surgery","Metabolic syndrome"] },
  { weight:10, category:"Adrenal Disorders", topics:["Primary adrenal insufficiency","Secondary adrenal insufficiency","Adrenal crisis","Cushing syndrome","Cushing disease vs ectopic ACTH","Primary aldosteronism","Pheochromocytoma","Adrenal incidentaloma","Congenital adrenal hyperplasia"] },
  { weight:10, category:"Pituitary Disorders", topics:["Pituitary adenoma","Prolactinoma","Acromegaly","Cushing disease","Central diabetes insipidus","SIADH","Hypopituitarism - replacement priorities","Pituitary apoplexy","Sheehan syndrome"] },
  { weight:7,  category:"Female Reproduction", topics:["PCOS","Menopause and HRT","Premature ovarian insufficiency","Amenorrhea workup","Hyperprolactinemia","Turner syndrome"] },
  { weight:7,  category:"Male Reproduction", topics:["Male hypogonadism","Klinefelter syndrome","Male infertility","Testosterone therapy","Delayed puberty"] },
];

var USMLE_STEP1_BLUEPRINT = [
  { weight:16, category:"Reproductive and Endocrine Systems", topics:["HPG axis - feedback loops","Thyroid hormone synthesis","Adrenal cortex zones","Insulin and glucagon physiology","Type 1 diabetes - HLA-DR3/DR4","CAH - enzyme deficiencies","Androgen insensitivity","5-alpha reductase deficiency"] },
  { weight:13, category:"Behavioral Health and Nervous Systems", topics:["Neurotransmitters","Antidepressant mechanisms","Antipsychotics - D2 blockade","Mood stabilizers - lithium","Opioid pharmacology","Autonomic pharmacology","Stroke syndromes"] },
  { weight:13, category:"Respiratory and Renal Systems", topics:["PFTs - obstructive vs restrictive","Hypoxemia mechanisms","Acid-base disorders","Renal tubular physiology","Diuretics by segment","RAAS","Nephritic vs nephrotic"] },
  { weight:11, category:"Cardiovascular System", topics:["Cardiac action potential","Frank-Starling law","Antiarrhythmics - Vaughan-Williams","Atherosclerosis","MI biomarkers and ECG","Congenital heart defects"] },
  { weight:10, category:"Blood and Immune Systems", topics:["Anemia classification","Clotting cascade","Hypersensitivity reactions","Immunodeficiencies","Complement system"] },
  { weight:9,  category:"Gastrointestinal System", topics:["GI hormones","Liver metabolism","Bilirubin metabolism","H. pylori","Hepatitis viruses serology"] },
  { weight:5,  category:"Biostatistics and Epidemiology", topics:["Sensitivity and specificity","PPV and NPV","Study designs","NNT calculation"] },
];

var USMLE_STEP2_BLUEPRINT = [
  { weight:13, category:"Cardiovascular System", topics:["Chest pain - ACS and HEART score","STEMI management","Heart failure - GDMT","Atrial fibrillation - CHA2DS2-VASc","Hypertensive urgency vs emergency","Aortic stenosis - TAVR vs SAVR"] },
  { weight:12, category:"Renal, Urinary, and Reproductive Systems", topics:["Acute kidney injury","CKD complications","Hyponatremia - SIADH","UTI and pyelonephritis","Ovarian cancer","Testicular cancer"] },
  { weight:11, category:"Legal, Ethical Issues, and Patient Safety", topics:["Informed consent","Confidentiality","End-of-life care","Medical errors","Advance directives"] },
  { weight:10, category:"Behavioral Health", topics:["Suicide risk assessment","Major depression","Bipolar disorder","Substance use disorders","Eating disorders - refeeding"] },
  { weight:10, category:"Nervous System", topics:["Stroke - tPA eligibility","Seizure workup","Headache types","Multiple sclerosis","Vertigo - BPPV vs central"] },
  { weight:9,  category:"Musculoskeletal and Skin", topics:["Low back pain - red flags","Gout - acute management","Cellulitis - MRSA","Melanoma workup"] },
  { weight:8,  category:"Respiratory System", topics:["Pneumonia - PORT/PSI","COPD exacerbation","Pulmonary embolism - Wells","Lung cancer - screening"] },
  { weight:7,  category:"Endocrine System", topics:["Diabetes - A1c targets","Thyroid nodule - FNA","Adrenal insufficiency stress dosing","Cushing screening","Hypercalcemia workup"] },
  { weight:7,  category:"Pregnancy and Childbirth", topics:["Preeclampsia","Gestational diabetes","Placenta previa vs abruption","Postpartum hemorrhage","Ectopic pregnancy"] },
  { weight:6,  category:"Gastrointestinal System", topics:["Upper GI bleeding - Rockall","Acute pancreatitis - BISAP","Cirrhosis - SBP and hepatorenal","IBD management"] },
];

var USMLE_STEP3_BLUEPRINT = [
  { weight:13, category:"Biostatistics and Population Health", topics:["Evidence-based medicine","Screening statistics","Clinical decision making - pre-test probability","Study design","NNT and ARR","Quality improvement - PDSA"] },
  { weight:11, category:"Cardiovascular System", topics:["Outpatient heart failure - GDMT titration","Secondary prevention post-MI","Hypertension by comorbidity","Atrial fibrillation - anticoagulation","Peripheral vascular disease"] },
  { weight:10, category:"Nervous System", topics:["Stroke secondary prevention","Epilepsy - driving restrictions","Parkinson disease","Dementia types","Migraine prophylaxis"] },
  { weight:9,  category:"Communication and Ethics", topics:["Informed consent - capacity","Advance care planning","Breaking bad news - SPIKES","Medical errors disclosure","Palliative vs hospice"] },
  { weight:9,  category:"Respiratory System", topics:["COPD - LABA/LAMA","Asthma biologics","OSA - CPAP adherence","IPF - antifibrotic therapy"] },
  { weight:8,  category:"Endocrine System", topics:["Diabetes - A1c by age and comorbidity","Thyroid nodule surveillance","Adrenal incidentaloma follow-up","Metabolic syndrome"] },
  { weight:7,  category:"Gastrointestinal System", topics:["Colonoscopy surveillance intervals","Hepatitis C - DAA and cirrhosis surveillance","IBD maintenance therapy"] },
  { weight:6,  category:"Renal and Urinary", topics:["CKD - BP targets and SGLT2i","BPH management","Nephrolithiasis workup"] },
  { weight:6,  category:"Behavioral Health", topics:["Depression - augmentation","Anxiety - CBT and medication","Substance use - MAT","ADHD in adults"] },
  { weight:5,  category:"Musculoskeletal System", topics:["Osteoarthritis - non-pharmacologic","RA monitoring - DAS28","Gout prophylaxis","Osteoporosis - medication holidays"] },
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

  // Level instruction
  var levelNote = "";
  if (level.includes("Step 1")) levelNote = "LEVEL: USMLE Step 1 — Test pathophysiology and mechanisms. WHY things happen, not management.";
  else if (level.includes("Step 2")) levelNote = "LEVEL: USMLE Step 2 CK — Test clinical decision-making, next best step, differential diagnosis.";
  else if (level.includes("Step 3")) levelNote = "LEVEL: USMLE Step 3 — Outpatient management, chronic disease, preventive care, ethics, biostatistics.";
  else if (level.includes("ABIM Internal Medicine")) levelNote = "LEVEL: ABIM Internal Medicine — Guideline-driven management. Include inpatient and outpatient scenarios. Reference SHM for inpatient topics.";
  else if (level.includes("ABIM Endocrinology")) levelNote = "LEVEL: ABIM Endocrinology subspecialty — Fellowship-level nuance per ADA, Endocrine Society, AACE, ATA.";

  // Society mapping
  var societyMap = "";
  if (t.includes("thyroid") || t.includes("hashimoto") || t.includes("graves") || t.includes("hypothyroid") || t.includes("hyperthyroid")) societyMap = "Cite ATA and/or Endocrine Society. NEVER cite ADA for thyroid disorders.";
  else if (t.includes("diabetes") || t.includes("insulin") || t.includes("cgm") || t.includes("glucose") || t.includes("dka") || t.includes("glp-1") || t.includes("sglt2") || t.includes("metformin") || t.includes("tirzepatide")) societyMap = "Cite current ADA Standards and/or AACE for diabetes.";
  else if (t.includes("osteoporosis") || t.includes("bone") || t.includes("calcium") || t.includes("parathyroid") || t.includes("vitamin d") || t.includes("hypoparathyroid")) societyMap = "Cite Endocrine Society and/or BHOF for bone and calcium disorders.";
  else if (t.includes("adrenal") || t.includes("cushing") || t.includes("aldosteronism") || t.includes("pheochromocytoma")) societyMap = "Cite Endocrine Society Clinical Practice Guidelines for adrenal disorders.";
  else if (t.includes("pituitary") || t.includes("acromegaly") || t.includes("prolactinoma") || t.includes("sheehan")) societyMap = "Cite Endocrine Society Clinical Practice Guidelines for pituitary disorders.";
  else if (t.includes("heart failure") || t.includes("acs") || t.includes("stemi") || t.includes("atrial fibrillation") || t.includes("hypertension") || t.includes("dyslipidemia")) societyMap = "Cite ACC/AHA guidelines. Reference GDMT principles for heart failure.";
  else if (t.includes("copd") || t.includes("asthma") || t.includes("pneumonia") || t.includes("ards") || t.includes("sleep apnea") || t.includes("osa")) societyMap = "Cite GOLD for COPD, GINA for asthma, IDSA/ATS for pneumonia, AASM for OSA.";
  else if (t.includes("kidney") || t.includes("renal") || t.includes("ckd") || t.includes("aki")) societyMap = "Cite KDIGO guidelines.";
  else if (t.includes("rheumatoid") || t.includes("lupus") || t.includes("gout") || t.includes("vasculitis")) societyMap = "Cite ACR and/or EULAR guidelines.";
  else if (t.includes("sepsis") || t.includes("hiv") || t.includes("tuberculosis") || t.includes("meningitis")) societyMap = "Cite Surviving Sepsis Campaign, DHHS, or IDSA as appropriate.";
  else if (t.includes("pancreatitis")) societyMap = "Cite ACG guidelines and WATERFALL trial (NEJM 2022).";
  else if (t.includes("gi bleeding") || t.includes("cirrhosis") || t.includes("hepatitis")) societyMap = "Cite AASLD and ACG guidelines.";
  else if (t.includes("hospital") || t.includes("inpatient")) societyMap = "Cite Society of Hospital Medicine (SHM) guidelines.";
  else societyMap = "Cite the most current relevant specialty society guideline.";

  // Board task rotation
  var boardTasks;
  if (level.includes("Step 1")) {
    boardTasks = [
      "most likely underlying mechanism of this patient's condition",
      "most likely diagnosis",
      "most appropriate diagnostic study",
      "most likely pathophysiologic explanation for these findings",
      "most likely cause of this patient's presentation",
    ];
  } else if (level.includes("Step 3")) {
    boardTasks = [
      "most appropriate next step in management",
      "most appropriate long-term management strategy",
      "most appropriate preventive recommendation",
      "most appropriate monitoring strategy",
      "most likely diagnosis",
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

  // Select only relevant exemplars for this topic
  var exemplars = selectExemplars(specificTopic);

  // ─── SYSTEM TEXT ────────────────────────────────────────────────────────────

  var systemText =
    "You are a senior ABIM item-writing committee member, fellowship program director, and academic physician.\n\n" +

    "CORE PHILOSOPHY: You test CLINICAL REASONING and JUDGMENT — not drug recall. Every question forces the learner to think through a problem the way a master clinician does at the bedside.\n\n" +

    "QUESTION TYPES — rotate equally across all specialties:\n" +
    "Diagnosis | Next best step | Monitoring | Mechanism | Interpretation | Complication | Management\n\n" +

    "EXPLANATION STYLE: Brilliant attending teaching on rounds — not a textbook. Name the cognitive trap each wrong answer represents. One guideline citation only. Board pearl = insight that changes thinking, never a restatement of the answer.\n\n" +

    "PHRASING RULES:\n" +
    "- NEVER use 'most appropriate initial pharmacotherapy' — use 'most appropriate next step in management'\n" +
    "- Cancer complications: use 'greatest long-term clinical risk associated with the underlying malignancy'\n" +
    "- Non-drug correct answers (fluids, CPAP, monitoring, surgery): use 'most appropriate next step in management'\n\n" +

    "CLINICAL ACCURACY RULES:\n" +
    "1. Labs MUST match diagnosis. Overt hypothyroidism = TSH >10 AND free T4 below range. Subclinical = TSH 4.5–10 AND normal T4. Overt hyperthyroidism = TSH <0.01 AND free T4 above range.\n" +
    "2. DKA sequence: FLUIDS FIRST (NS 1–1.5 L/hr) → check K+ → insulin only if K+ ≥3.5 → dextrose when glucose 200–250 → hold SGLT2i entire episode. NEVER insulin before fluids.\n" +
    "3. Primary AI: low cortisol + HIGH ACTH + hyperkalemia + hyperpigmentation. Secondary AI: low cortisol + low ACTH + normal K+ + no hyperpigmentation.\n" +
    "4. Semaglutide SC: ALWAYS start 0.25 mg weekly x4 weeks. NEVER 0.5 mg at initiation.\n" +
    "5. Tirzepatide: start 2.5 mg weekly x4 weeks.\n" +
    "6. SGLT2i in HFrEF: mandatory regardless of HbA1c when LVEF <40%.\n" +
    "7. Pioglitazone: ABSOLUTELY CONTRAINDICATED in heart failure.\n" +
    "8. Insulin first when: HbA1c >10% OR glucose ≥300 OR active catabolism.\n" +
    "9. Pancreatitis: moderate goal-directed LR 1.5 mL/kg/hr (WATERFALL 2022) — NOT aggressive NS.\n" +
    "10. Calcium carbonate = 40% elemental calcium. 1000 mg carbonate = 400 mg elemental.\n" +
    "11. Natpara (rhPTH 1-84): RECALLED 2019, DISCONTINUED. Use palopegteriparatide (Yorvipath) FDA approved August 2024.\n" +
    "12. Hypoparathyroidism PTH replacement threshold: >2.5g ELEMENTAL calcium/day + 24hr urine Ca >300 mg/day.\n" +
    "13. Hypopituitarism: CORTISOL FIRST, THYROID SECOND — levothyroxine before cortisol = fatal adrenal crisis.\n" +
    "14. REDUCE-IT: statin + lifestyle first → recheck 4–12 weeks → IPE only if TG ≥150 on stable statin.\n" +
    "15. OSA: CPAP definitive first-line. Tirzepatide adjunct (SURMOUNT-OSA 2024), not replacement. Modafinil only after CPAP optimized. Zolpidem contraindicated.\n" +
    "16. AGP: fix TBR >4% before any hyperglycemia adjustment.\n" +
    "17. AID systems: micro-treat mild lows with 5–8g carbs (not Rule of 15).\n" +
    "18. GI bleeding: restrictive transfusion (Hgb threshold 7 g/dL).\n" +
    "19. " + societyMap + "\n\n" +

    exemplars;

  var userText =
    levelNote + "\n\n" +
    topicInstruction + "\n\n" +
    "STEM: 3–4 sentences." + imagingNote + cgmNote + " End with: Which of the following is the " + selectedTask + "?\n" +
    "CHOICES: 5 options (A–E). One clearly correct. Four plausible distractors — real cognitive traps.\n" +
    "EXPLANATION: 3 sentences only. (1) Why correct + one guideline citation. (2) Why 2 most tempting wrong answers are wrong + cognitive trap named. (3) Board pearl — insight that changes thinking.\n\n" +
    "Return ONLY valid JSON with all closing brackets. No markdown. No text outside JSON:\n" +
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
