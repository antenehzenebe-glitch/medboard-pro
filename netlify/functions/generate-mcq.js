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
        max_tokens: 900,
        temperature: 0.6,
        system: systemText,
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: 1,
            allowed_domains: [
              "diabetes.org", "ada.org", "endocrine.org", "thyroid.org",
              "acc.org", "heart.org", "chest.org", "thoracic.org",
              "kdigo.org", "rheumatology.org", "aasld.org", "gi.org",
              "idsa.org", "aafp.org", "acponline.org", "aace.com",
              "nof.org", "aasm.org", "hematology.org", "asco.org",
              "nccn.org", "aan.com", "survivingsepsis.org",
              "shm.org", "hospitalmedicine.org",
              "nejm.org", "jamanetwork.com", "thelancet.com",
              "annals.org", "bmj.com",
              "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov",
              "nih.gov", "cdc.gov", "fda.gov",
              "uptodate.com", "medscape.com"
            ]
          }
        ],
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
    if (!data.content || !data.content.length) {
      throw new Error("Unexpected API response format");
    }

    var textBlock = data.content.find(function(block) {
      return block.type === "text";
    });
    if (!textBlock || !textBlock.text) {
      throw new Error("No text content in response");
    }
    return textBlock.text;
  }
}

// ─── BLUEPRINTS ───────────────────────────────────────────────────────────────

var ABIM_IM_BLUEPRINT = [
  { weight:14, category:"Cardiovascular Disease", topics:["Coronary artery disease and ACS (STEMI, NSTEMI)","Heart failure (HFrEF, HFpEF)","Atrial fibrillation - rate vs rhythm control","Valvular heart disease","Hypertension - staging and pharmacotherapy","Dyslipidemia and statin therapy","Pulmonary embolism","Infective endocarditis","Cardiac arrhythmias","Pericarditis and myocarditis","Aortic dissection"] },
  { weight:9,  category:"Pulmonary Disease", topics:["COPD - GOLD staging and exacerbations","Asthma - step therapy","Community-acquired pneumonia","Hospital-acquired pneumonia","Interstitial lung disease and IPF","Obstructive sleep apnea","Pleural effusion - Light criteria","ARDS - Berlin criteria","Pulmonary hypertension","Pneumothorax"] },
  { weight:9,  category:"Endocrinology, Diabetes, and Metabolism", topics:["Type 2 diabetes - GLP-1 RA and SGLT2i","Type 1 diabetes - insulin regimens and DKA","Hypothyroidism - diagnosis and levothyroxine","Hyperthyroidism and Graves disease","Adrenal insufficiency - primary vs secondary","Cushing syndrome","Primary aldosteronism","Pheochromocytoma","Osteoporosis - FRAX and bisphosphonates","Hypercalcemia and hyperparathyroidism","Prolactinoma and acromegaly"] },
  { weight:9,  category:"Gastroenterology", topics:["Inflammatory bowel disease - Crohn vs UC","Cirrhosis - Child-Pugh, MELD, complications","GI bleeding - upper vs lower","Hepatitis B - serology and antivirals","Hepatitis C - DAA therapy","Acute pancreatitis","NAFLD and NASH","Peptic ulcer disease and H. pylori","Acute liver failure"] },
  { weight:9,  category:"Infectious Disease", topics:["Sepsis and septic shock","HIV - ART initiation and OI prophylaxis","Tuberculosis - latent vs active","Urinary tract infections","Skin and soft tissue infections","C. difficile colitis","Meningitis - empiric antibiotics","COVID-19 antivirals"] },
  { weight:9,  category:"Rheumatology", topics:["Rheumatoid arthritis - DMARDs and biologics","Systemic lupus erythematosus","Gout - acute management and ULT","Giant cell arteritis and PMR","Ankylosing spondylitis","Vasculitis - GPA and polyarteritis nodosa","Antiphospholipid syndrome"] },
  { weight:6,  category:"Hematology", topics:["Iron deficiency anemia","Hemolytic anemia","Thrombocytopenia - ITP, TTP, HIT","Sickle cell disease","DVT and PE - DOAC selection","Heparin-induced thrombocytopenia"] },
  { weight:6,  category:"Nephrology", topics:["Acute kidney injury - KDIGO staging","CKD - staging and SGLT2i","Glomerulonephritis - nephritic vs nephrotic","Hyponatremia - SIADH and correction","Hyperkalemia - EKG changes and management","Metabolic acidosis - anion gap"] },
  { weight:6,  category:"Medical Oncology", topics:["Lung cancer - targeted therapies","Breast cancer - hormone receptor and HER2","Lymphoma - Hodgkin vs non-Hodgkin","Leukemia - CML and TKI therapy","Multiple myeloma - CRAB criteria","Oncologic emergencies"] },
  { weight:4,  category:"Neurology", topics:["Ischemic stroke - tPA and thrombectomy","Seizures - AED selection","Multiple sclerosis - DMT","Parkinson disease","Dementia - Alzheimer vs vascular vs Lewy body","Myasthenia gravis"] },
  { weight:4,  category:"Psychiatry", topics:["Major depressive disorder - SSRI selection","Bipolar disorder - mood stabilizers","Alcohol use disorder - CIWA and thiamine","Opioid use disorder - buprenorphine","Delirium - causes and management"] },
  { weight:3,  category:"Preventive Medicine", topics:["Cancer screening - USPSTF recommendations","Biostatistics - sensitivity, specificity, NNT","Medical ethics - informed consent and capacity","Health disparities and social determinants"] },
];

var ABIM_ENDO_BLUEPRINT = [
  { weight:24, category:"Diabetes Mellitus and Hypoglycemia", topics:["ADA Standards - glycemic targets","Type 2 diabetes - GLP-1 RA, SGLT2i, DPP-4i, tirzepatide","Type 1 diabetes - MDI vs AID systems and CGM","DKA and HHS - diagnosis and management","Hypoglycemia unawareness - prevention","Inpatient glycemic management","CVOT data - GLP-1 RA and SGLT2i in ASCVD, HF, CKD","Gestational diabetes - HAPO trial","MODY and LADA - genetic testing"] },
  { weight:15, category:"Thyroid Disorders", topics:["Hypothyroidism - primary vs central, TSH interpretation","Hashimoto thyroiditis - TPO antibodies, subclinical management","Hyperthyroidism - Graves disease, toxic nodular goiter","Thyroid storm - Burch-Wartofsky score","Thyroid nodule - ATA ultrasound risk stratification and FNA","Thyroid cancer - RAI and TSH suppression","Thyroid disease in pregnancy - TSH targets","Amiodarone-induced thyroid disease","Central hypothyroidism"] },
  { weight:15, category:"Calcium and Bone Disorders", topics:["Hypercalcemia - PTH vs PTHrP vs vitamin D mediated","Primary hyperparathyroidism - surgical criteria","Hypoparathyroidism - palopegteriparatide (Yorvipath)","Osteoporosis - DXA, FRAX, bisphosphonates, denosumab, romosozumab","Vitamin D deficiency - supplementation protocols","Paget disease of bone","Hypocalcemia - acute IV calcium and chronic management"] },
  { weight:12, category:"Lipids, Obesity, and Nutrition", topics:["Dyslipidemia - ACC/AHA risk calculator and statin intensity","PCSK9 inhibitors - indications and CVOT evidence","Familial hypercholesterolemia","Hypertriglyceridemia - fibrates and omega-3","Obesity management - GLP-1 RA for weight loss","Bariatric surgery - metabolic outcomes","Metabolic syndrome"] },
  { weight:10, category:"Adrenal Disorders", topics:["Primary adrenal insufficiency - autoimmune and stress dosing","Secondary adrenal insufficiency - ACTH stimulation test","Adrenal crisis - recognition and IV hydrocortisone","Cushing syndrome - UFC, late-night salivary cortisol, LDDST","Cushing disease vs ectopic ACTH - HDDST and IPSS","Primary aldosteronism - PAC/PRA ratio, CT, adrenal vein sampling","Pheochromocytoma - plasma metanephrines, alpha then beta blockade","Adrenal incidentaloma - imaging characterization and hormonal workup","Congenital adrenal hyperplasia - 21-hydroxylase deficiency"] },
  { weight:10, category:"Pituitary Disorders", topics:["Pituitary adenoma - micro vs macro, functioning vs nonfunctional","Prolactinoma - cabergoline vs bromocriptine and pregnancy","Acromegaly - IGF-1, OGTT GH suppression, somatostatin analogs","Cushing disease - ACTH-dependent, petrosal sinus sampling","Central diabetes insipidus - water deprivation test and desmopressin","SIADH - euvolemic hyponatremia and vaptans","Hypopituitarism - replacement priorities","Pituitary apoplexy - emergency management"] },
  { weight:7,  category:"Female Reproduction", topics:["PCOS - Rotterdam criteria, OCP and metformin","Menopause - vasomotor symptoms and HRT","Premature ovarian insufficiency","Amenorrhea - primary vs secondary workup","Hyperprolactinemia - differential diagnosis","Turner syndrome - 45X and estrogen replacement"] },
  { weight:7,  category:"Male Reproduction", topics:["Male hypogonadism - primary vs secondary, testosterone therapy","Klinefelter syndrome - 47XXY","Male infertility - azoospermia workup","Testosterone therapy - formulations and monitoring","Delayed puberty vs constitutional growth delay"] },
];

var USMLE_STEP1_BLUEPRINT = [
  { weight:16, category:"Reproductive and Endocrine Systems", topics:["Hypothalamic-pituitary-gonadal axis - feedback loops","Thyroid hormone synthesis - iodination and coupling steps","Adrenal cortex - zona glomerulosa, fasciculata, reticularis","Insulin and glucagon - fed vs fasted state physiology","Type 1 diabetes - autoimmune destruction, HLA-DR3/DR4","Congenital adrenal hyperplasia - enzyme deficiencies","Androgen insensitivity syndrome","5-alpha reductase deficiency"] },
  { weight:13, category:"Behavioral Health and Nervous Systems", topics:["Neurotransmitters - dopamine, serotonin, GABA, glutamate","Antidepressants - SSRI, SNRI, TCA, MAOI mechanisms","Antipsychotics - D2 blockade and EPS","Mood stabilizers - lithium mechanism and toxicity","Opioid pharmacology - mu receptor and withdrawal","Autonomic pharmacology - alpha and beta agonists","Stroke syndromes - MCA, PCA, PICA territories"] },
  { weight:13, category:"Respiratory and Renal Systems", topics:["Pulmonary function tests - obstructive vs restrictive","Hypoxemia mechanisms - V/Q mismatch and shunt","Acid-base disorders - metabolic vs respiratory compensation","Renal tubular physiology - PCT, loop, DCT transport","Diuretics - mechanism by segment","RAAS - angiotensin II and aldosterone effects","Nephritic vs nephrotic syndrome - pathologic types"] },
  { weight:11, category:"Cardiovascular System", topics:["Cardiac action potential - pacemaker vs ventricular","Frank-Starling law - preload and afterload","Antiarrhythmics - Vaughan-Williams classification","Atherosclerosis - foam cells and fibrous plaque","Myocardial infarction - biomarkers and ECG changes","Congenital heart defects - VSD, ASD, PDA, TOF"] },
  { weight:10, category:"Blood and Immune Systems", topics:["Anemia classification - microcytic, normocytic, macrocytic","Clotting cascade - intrinsic vs extrinsic pathway","Hypersensitivity reactions - Type I through IV","Immunodeficiencies - B vs T cell and combined","Complement system - classical vs alternative"] },
  { weight:9,  category:"Gastrointestinal System", topics:["GI hormones - gastrin, secretin, CCK, GIP","Liver metabolism - glycolysis and gluconeogenesis","Bilirubin metabolism - prehepatic, hepatic, posthepatic","H. pylori - virulence factors and peptic ulcer disease","Hepatitis viruses - A, B, C, D, E serology"] },
  { weight:5,  category:"Biostatistics and Epidemiology", topics:["Sensitivity and specificity - ROC curve","PPV and NPV - prevalence effect","Study designs - RCT, cohort, case-control","Number needed to treat calculation"] },
];

var USMLE_STEP2_BLUEPRINT = [
  { weight:13, category:"Cardiovascular System", topics:["Chest pain evaluation - ACS and HEART score","STEMI management - door-to-balloon and thrombolytics","Heart failure management - GDMT and diuresis","Atrial fibrillation - CHA2DS2-VASc and anticoagulation","Hypertensive urgency vs emergency","Aortic stenosis - TAVR vs SAVR criteria"] },
  { weight:12, category:"Renal, Urinary, and Reproductive Systems", topics:["Acute kidney injury - prerenal vs intrinsic","CKD complications - anemia and hyperkalemia","Hyponatremia - SIADH and correction","UTI - uncomplicated and pyelonephritis","Ovarian cancer - CA-125 and BRCA mutation","Testicular cancer - germ cell vs non-germ cell"] },
  { weight:11, category:"Legal, Ethical Issues, and Patient Safety", topics:["Informed consent - capacity assessment","Confidentiality breaches - duty to warn","End-of-life care - withdrawal and futility","Medical errors - disclosure and root cause","Advance directives - DNR and POLST"] },
  { weight:10, category:"Behavioral Health", topics:["Suicide risk assessment","Major depression - PHQ-9 and SSRI","Bipolar disorder - mood stabilizer selection","Substance use disorders - CAGE questionnaire","Eating disorders - refeeding syndrome"] },
  { weight:10, category:"Nervous System", topics:["Stroke - NIHSS and tPA eligibility","Seizure - first unprovoked workup","Headache - migraine vs tension vs cluster","Multiple sclerosis - McDonald criteria","Vertigo - BPPV and central vs peripheral"] },
  { weight:9,  category:"Musculoskeletal and Skin", topics:["Low back pain - red flags and imaging","Gout - acute management and allopurinol timing","Cellulitis - MRSA risk and antibiotics","Melanoma - biopsy and sentinel lymph node"] },
  { weight:8,  category:"Respiratory System", topics:["Pneumonia - PORT/PSI and antibiotic selection","COPD exacerbation - bronchodilators and NIV","Pulmonary embolism - Wells score and anticoagulation","Lung cancer - LDCT screening and targeted therapy"] },
  { weight:7,  category:"Endocrine System", topics:["Diabetes management - A1c targets and insulin adjustment","Thyroid nodule - ultrasound features and FNA","Adrenal insufficiency - stress dosing","Cushing syndrome - screening tests","Calcium disorders - hypercalcemia workup"] },
  { weight:7,  category:"Pregnancy and Childbirth", topics:["Preeclampsia - BP criteria and management","Gestational diabetes - GCT and OGTT","Placenta previa vs abruptio placentae","Postpartum hemorrhage - oxytocin","Ectopic pregnancy - beta-hCG and methotrexate"] },
  { weight:6,  category:"Gastrointestinal System", topics:["Upper GI bleeding - Rockall score and endoscopy","Acute pancreatitis - BISAP and fluid resuscitation","Cirrhosis complications - SBP and hepatorenal","IBD management - 5-ASA and biologics"] },
];

var USMLE_STEP3_BLUEPRINT = [
  { weight:13, category:"Biostatistics and Population Health", topics:["Evidence-based medicine - meta-analysis interpretation","Screening test statistics - sensitivity and specificity","Clinical decision making - pre-test probability","Study design selection - RCT vs observational","Absolute vs relative risk reduction and NNT","Quality improvement - PDSA cycle"] },
  { weight:11, category:"Cardiovascular System", topics:["Outpatient heart failure - GDMT titration","Secondary prevention post-MI - aspirin, statin, beta-blocker, ACEi","Hypertension management - drug selection by comorbidity","Atrial fibrillation - long-term anticoagulation","Peripheral vascular disease - ABI and revascularization"] },
  { weight:10, category:"Nervous System", topics:["Outpatient stroke follow-up and secondary prevention","Epilepsy management - drug selection and driving restrictions","Parkinson disease - motor fluctuations","Dementia - Alzheimer vs vascular vs Lewy body","Headache management - migraine prophylaxis"] },
  { weight:9,  category:"Communication and Ethics", topics:["Informed consent - capacity and surrogate decision makers","Advance care planning - DNR and goals of care","Breaking bad news - SPIKES protocol","Medical errors - disclosure and apology","End-of-life care - palliative vs hospice"] },
  { weight:9,  category:"Respiratory System", topics:["COPD - LABA/LAMA combinations and oxygen criteria","Asthma - step-up therapy and biologics","Obstructive sleep apnea - CPAP adherence","Idiopathic pulmonary fibrosis - antifibrotic therapy"] },
  { weight:8,  category:"Endocrine System", topics:["Diabetes - A1c targets by age and comorbidity","Thyroid nodule - long-term surveillance","Adrenal incidentaloma - follow-up imaging","Metabolic syndrome - lifestyle intervention"] },
  { weight:7,  category:"Gastrointestinal System", topics:["Surveillance colonoscopy - adenoma follow-up intervals","Hepatitis C - DAA therapy and cirrhosis surveillance","IBD - maintenance therapy and dysplasia surveillance"] },
  { weight:6,  category:"Renal and Urinary", topics:["CKD management - BP targets and SGLT2i","BPH - alpha-blockers and 5-alpha reductase inhibitors","Nephrolithiasis - metabolic workup and dietary modifications"] },
  { weight:6,  category:"Behavioral Health", topics:["Depression management - augmentation strategies","Anxiety disorders - CBT and medication management","Substance use - motivational interviewing and MAT","ADHD in adults - stimulant therapy"] },
  { weight:5,  category:"Musculoskeletal System", topics:["Osteoarthritis - non-pharmacologic and NSAID risks","RA monitoring - DAS28 and methotrexate toxicity","Gout prophylaxis - allopurinol titration","Osteoporosis - DEXA surveillance and medication holidays"] },
];

// ─── WEIGHTED RANDOM SELECTION ────────────────────────────────────────────────

function weightedRandomCategory(blueprint) {
  var total = blueprint.reduce(function(sum, b) { return sum + b.weight; }, 0);
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

function getBlueprintCategory(level, requestedTopic) {
  var isRandom = requestedTopic.toLowerCase().includes("random");
  if (!isRandom) return { forcedTopic: requestedTopic };
  if (level.includes("ABIM Endocrinology")) return { blueprintCat: weightedRandomCategory(ABIM_ENDO_BLUEPRINT) };
  if (level.includes("ABIM Internal Medicine")) return { blueprintCat: weightedRandomCategory(ABIM_IM_BLUEPRINT) };
  if (level.includes("Step 1")) return { blueprintCat: weightedRandomCategory(USMLE_STEP1_BLUEPRINT) };
  if (level.includes("Step 2")) return { blueprintCat: weightedRandomCategory(USMLE_STEP2_BLUEPRINT) };
  if (level.includes("Step 3")) return { blueprintCat: weightedRandomCategory(USMLE_STEP3_BLUEPRINT) };
  return { blueprintCat: weightedRandomCategory(ABIM_IM_BLUEPRINT) };
}

// ─── RADIOPAEDIA IMAGE LINKS ──────────────────────────────────────────────────

var RADIOPAEDIA_CASES = {
  "Pneumonia": "https://radiopaedia.org/search?q=pneumonia&lang=us",
  "ARDS": "https://radiopaedia.org/search?q=ARDS+acute+respiratory+distress&lang=us",
  "Pleural Effusion": "https://radiopaedia.org/search?q=pleural+effusion&lang=us",
  "Pneumothorax": "https://radiopaedia.org/search?q=pneumothorax&lang=us",
  "Pulmonary Embolism": "https://radiopaedia.org/search?q=pulmonary+embolism+CT&lang=us",
  "Interstitial Lung Disease": "https://radiopaedia.org/search?q=interstitial+lung+disease+HRCT&lang=us",
  "Heart Failure": "https://radiopaedia.org/search?q=heart+failure+cardiomegaly&lang=us",
  "Aortic Dissection": "https://radiopaedia.org/search?q=aortic+dissection+CT&lang=us",
  "Ischemic Stroke": "https://radiopaedia.org/search?q=ischemic+stroke+MRI+DWI&lang=us",
  "Hemorrhagic Stroke": "https://radiopaedia.org/search?q=intracranial+hemorrhage+CT&lang=us",
  "Multiple Sclerosis": "https://radiopaedia.org/search?q=multiple+sclerosis+MRI+lesions&lang=us",
  "Thyroid Nodule Evaluation": "https://radiopaedia.org/search?q=thyroid+nodule+ultrasound&lang=us",
  "Thyroid Cancer": "https://radiopaedia.org/search?q=thyroid+cancer+papillary+ultrasound&lang=us",
  "Cushing Syndrome": "https://radiopaedia.org/search?q=adrenal+adenoma+cushing+CT&lang=us",
  "Primary Aldosteronism": "https://radiopaedia.org/search?q=adrenal+adenoma+CT+aldosteronoma&lang=us",
  "Pheochromocytoma": "https://radiopaedia.org/search?q=pheochromocytoma+adrenal+MRI&lang=us",
  "Acromegaly": "https://radiopaedia.org/search?q=pituitary+macroadenoma+acromegaly+MRI&lang=us",
  "Prolactinoma": "https://radiopaedia.org/search?q=prolactinoma+pituitary+MRI&lang=us",
  "Osteoporosis": "https://radiopaedia.org/search?q=osteoporosis+compression+fracture+DXA&lang=us",
  "Hyperparathyroidism": "https://radiopaedia.org/search?q=hyperparathyroidism+sestamibi+scan&lang=us",
  "Cirrhosis": "https://radiopaedia.org/search?q=cirrhosis+liver+CT+nodular&lang=us",
  "Acute Pancreatitis": "https://radiopaedia.org/search?q=acute+pancreatitis+CT+necrosis&lang=us",
  "Nephrolithiasis": "https://radiopaedia.org/search?q=kidney+stones+CT+urogram&lang=us",
  "Rheumatoid Arthritis": "https://radiopaedia.org/search?q=rheumatoid+arthritis+joint+xray&lang=us",
  "Ankylosing Spondylitis": "https://radiopaedia.org/search?q=ankylosing+spondylitis+sacroiliac+MRI&lang=us",
  "Gout": "https://radiopaedia.org/search?q=gout+tophus+joint+xray&lang=us",
  "Tuberculosis": "https://radiopaedia.org/search?q=tuberculosis+chest+xray+cavitation&lang=us",
  "HIV": "https://radiopaedia.org/search?q=HIV+AIDS+opportunistic+infection+CT+PCP&lang=us",
  "PCOS": "https://radiopaedia.org/search?q=polycystic+ovary+syndrome+ultrasound&lang=us",
  "Hypothyroidism": "https://radiopaedia.org/search?q=hashimoto+thyroiditis+ultrasound+heterogeneous&lang=us",
  "Hyperthyroidism": "https://radiopaedia.org/search?q=graves+disease+thyroid+scan+diffuse+uptake&lang=us",
};

function getRadiopaediaLink(topic) {
  var topicNorm = topic.toLowerCase().replace(/['\-]/g, " ");
  for (var key in RADIOPAEDIA_CASES) {
    if (topicNorm.includes(key.toLowerCase().split(" ")[0])) {
      return RADIOPAEDIA_CASES[key];
    }
  }
  return null;
}

// ─── BUILD PROMPT ─────────────────────────────────────────────────────────────

function buildPrompt(level, requestedTopic) {
  var result = getBlueprintCategory(level, requestedTopic);
  var specificTopic, topicInstruction;

  if (result.forcedTopic) {
    specificTopic = result.forcedTopic;
    topicInstruction = "TOPIC: " + specificTopic;
  } else {
    var cat = result.blueprintCat;
    specificTopic = pickRandom(cat.topics).split(" - ")[0].split(" — ")[0];
    topicInstruction = "TOPIC: " + specificTopic + " (" + cat.category + " — " + cat.weight + "% of " + level + " blueprint)";
  }

  var radiopaediaLink = getRadiopaediaLink(specificTopic);

  // ─── LEVEL INSTRUCTION ────────────────────────────────────────────────────

  var levelNote = "";
  if (level.includes("Step 1")) {
    levelNote = "LEVEL: USMLE Step 1 — Test pathophysiology and mechanisms. WHY things happen, not clinical management.";
  } else if (level.includes("Step 2")) {
    levelNote = "LEVEL: USMLE Step 2 CK — Test clinical decision-making, next best step, differential diagnosis.";
  } else if (level.includes("Step 3")) {
    levelNote = "LEVEL: USMLE Step 3 — Test outpatient management, chronic disease, preventive care, ethics, biostatistics.";
  } else if (level.includes("ABIM Internal Medicine")) {
    levelNote = "LEVEL: ABIM Internal Medicine boards — Guideline-driven management. Include both inpatient and outpatient scenarios. Reference Society of Hospital Medicine (SHM) guidelines for inpatient topics.";
  } else if (level.includes("ABIM Endocrinology")) {
    levelNote = "LEVEL: ABIM Endocrinology subspecialty — Fellowship-level nuance. Most current guidelines from ADA, Endocrine Society, AACE, ATA.";
  }

  // ─── SOCIETY MAPPING ──────────────────────────────────────────────────────

  var t = specificTopic.toLowerCase();
  var societyMap = "";
  if (t.includes("thyroid") || t.includes("hashimoto") || t.includes("graves") || t.includes("hypothyroid") || t.includes("hyperthyroid")) {
    societyMap = "Cite ATA and/or Endocrine Society. NEVER cite ADA for thyroid disorders.";
  } else if (t.includes("diabetes") || t.includes("insulin") || t.includes("cgm") || t.includes("glucose") || t.includes("dka") || t.includes("glp-1") || t.includes("sglt2") || t.includes("metformin") || t.includes("tirzepatide")) {
    societyMap = "Cite most current ADA Standards and/or AACE for diabetes.";
  } else if (t.includes("osteoporosis") || t.includes("bone") || t.includes("fracture") || t.includes("calcium") || t.includes("parathyroid") || t.includes("vitamin d") || t.includes("hypoparathyroid")) {
    societyMap = "Cite Endocrine Society and/or BHOF for bone and calcium disorders.";
  } else if (t.includes("adrenal") || t.includes("cushing") || t.includes("aldosteronism") || t.includes("pheochromocytoma")) {
    societyMap = "Cite Endocrine Society Clinical Practice Guidelines for adrenal disorders.";
  } else if (t.includes("pituitary") || t.includes("acromegaly") || t.includes("prolactinoma") || t.includes("sheehan")) {
    societyMap = "Cite Endocrine Society Clinical Practice Guidelines for pituitary disorders.";
  } else if (t.includes("heart failure") || t.includes("acs") || t.includes("stemi") || t.includes("atrial fibrillation") || t.includes("hypertension") || t.includes("dyslipidemia")) {
    societyMap = "Cite ACC/AHA guidelines. Include GDMT principles for heart failure.";
  } else if (t.includes("copd") || t.includes("asthma") || t.includes("pneumonia") || t.includes("ards") || t.includes("sleep apnea") || t.includes("osa")) {
    societyMap = "Cite GOLD for COPD, GINA for asthma, IDSA/ATS for pneumonia, AASM for OSA.";
  } else if (t.includes("kidney") || t.includes("renal") || t.includes("ckd") || t.includes("aki")) {
    societyMap = "Cite KDIGO guidelines for kidney disease.";
  } else if (t.includes("rheumatoid") || t.includes("lupus") || t.includes("gout") || t.includes("vasculitis")) {
    societyMap = "Cite ACR and/or EULAR guidelines for rheumatologic conditions.";
  } else if (t.includes("sepsis") || t.includes("hiv") || t.includes("tuberculosis") || t.includes("c. difficile") || t.includes("meningitis")) {
    societyMap = "Cite Surviving Sepsis Campaign, DHHS, or IDSA/SHEA as appropriate.";
  } else if (t.includes("pancreatitis")) {
    societyMap = "Cite ACG guidelines and WATERFALL trial (NEJM 2022) for acute pancreatitis.";
  } else if (t.includes("gi bleeding") || t.includes("cirrhosis") || t.includes("hepatitis")) {
    societyMap = "Cite AASLD and ACG guidelines for liver and GI disorders.";
  } else if (t.includes("hospital") || t.includes("inpatient") || t.includes("discharge")) {
    societyMap = "Cite Society of Hospital Medicine (SHM) guidelines for inpatient management.";
  } else {
    societyMap = "Cite the most current relevant specialty society guideline.";
  }

  // ─── BOARD TASK ROTATION ──────────────────────────────────────────────────

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
      "most likely complication of this condition",
      "most appropriate change in management",
      "greatest long-term clinical risk associated with the underlying condition",
      "most likely cause of this patient's presentation",
    ];
  }
  var selectedTask = boardTasks[Math.floor(Math.random() * boardTasks.length)];

  var imagingNote = radiopaediaLink
    ? " Describe key imaging findings as a clinician would dictate (e.g., chest X-ray shows bilateral infiltrates with air bronchograms)."
    : "";

  var cgmNote = (t.includes("cgm") || t.includes("aid") || t.includes("insulin pump") || t.includes("ambulatory glucose"))
    ? " Include CGM metrics: TIR%, TBR%, TAR%, GMI."
    : "";

  var jsonSchema = '{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"' + specificTopic + '","imageUrl":' + (radiopaediaLink ? '"' + radiopaediaLink + '"' : 'null') + ',"showImageButton":false}';

  // ─── SYSTEM TEXT ──────────────────────────────────────────────────────────

  var systemText =
    "You are a senior ABIM item-writing committee member, fellowship program director, and academic physician with 20 years of experience writing board examination questions.\n\n" +

    "BEFORE GENERATING ANY QUESTION: Use web search to find the most current guidelines for this topic from the approved sources. Search for the latest updates from the relevant specialty society. Base your question on what you find — not on training data.\n\n" +

    "YOUR CORE PHILOSOPHY:\n" +
    "You do NOT write questions that simply ask what drug to give or what lab value confirms a diagnosis.\n" +
    "You write questions that test CLINICAL REASONING and JUDGMENT — the way a master clinician thinks at the bedside.\n" +
    "Every question must force the learner to think through a clinical problem — not retrieve a memorized fact.\n\n" +

    "QUESTION VARIETY — rotate through ALL of these equally across ALL specialties:\n" +
    "- DIAGNOSIS: subtle presentation requiring synthesis of history, exam, and labs to identify correct diagnosis over plausible alternatives.\n" +
    "- NEXT BEST STEP: a decision point where the right move requires understanding pathophysiology and clinical context — not just guidelines.\n" +
    "- MONITORING: what to check, when, and why — testing understanding of disease progression and treatment response.\n" +
    "- MECHANISM: why a treatment works or why a complication occurs — testing depth of pathophysiologic understanding.\n" +
    "- INTERPRETATION: labs, imaging, or clinical data requiring synthesis and pattern recognition.\n" +
    "- COMPLICATION: identifying when something has gone wrong and what the greatest long-term risk is.\n" +
    "- MANAGEMENT: weighing comorbidities, contraindications, and context — NOT just first-line therapy recitation.\n\n" +

    "EXPLANATION PHILOSOPHY:\n" +
    "Write like a brilliant attending teaching on rounds — not a textbook reciting facts and statistics.\n" +
    "Tell the learner HOW to think about this problem. Name the specific cognitive trap each wrong answer represents.\n" +
    "One guideline citation is sufficient — do NOT list statistics or trial names unless they directly explain WHY.\n" +
    "The board pearl must be a clinical insight that changes how the learner thinks — never a restatement of the correct answer.\n\n" +

    "CRITICAL CLINICAL ACCURACY RULES:\n" +
    "1. Labs MUST match diagnosis: Overt hypothyroidism = TSH >10 AND free T4 below reference range. Subclinical = TSH 4.5–10 AND normal free T4.\n" +
    "2. Overt hyperthyroidism = TSH <0.01 AND free T4 above reference range. Subclinical = suppressed TSH AND normal free T4.\n" +
    "3. DKA DIAGNOSIS: glucose >250, pH <7.3, HCO3 <18, ketonemia. ADA DKA MANAGEMENT SEQUENCE: STEP 1 — IV Normal Saline 0.9% at 1–1.5 L/hr FIRST before any insulin. STEP 2 — Check K+ before insulin. Hold insulin if K+ below 3.5 mEq/L. STEP 3 — Start insulin 0.1 units/kg/hr only after fluids started AND K+ confirmed 3.5 or above. STEP 4 — Add dextrose when glucose 200–250 mg/dL. STEP 5 — Hold SGLT2i entire episode. NEVER use 0.45% saline as first fluid.\n" +
    "4. Primary adrenal insufficiency: low cortisol + HIGH ACTH + hyperkalemia + hyperpigmentation. Secondary AI: low cortisol + low ACTH + normal K+ + no hyperpigmentation.\n" +
    "5. NEVER say 'pathognomonic'. NEVER use EXCEPT/NOT phrasing. NEVER use 'always' or 'never' in answer choices.\n" +
    "6. One clearly correct answer. Four plausible distractors representing real cognitive traps — anchoring bias, premature closure, wrong subtype.\n" +
    "7. All 5 options must be same type — all diagnoses OR all treatments. Never mix.\n" +
    "8. STEM PHRASING: NEVER use 'most appropriate initial pharmacotherapy' as the lead-in. Use 'most appropriate next step in management'. When asking about cancer complications use 'greatest long-term clinical risk associated with the underlying malignancy' not 'complication of this condition'.\n" +
    "9. " + societyMap + "\n\n" +

    "DRUG DOSING RULES — VERIFY THESE WITH WEB SEARCH:\n" +
    "- Semaglutide SC (Ozempic): ALWAYS start 0.25 mg weekly x4 weeks, then 0.5 mg. NEVER start at 0.5 mg.\n" +
    "- Semaglutide oral (Rybelsus): start 3 mg daily x30 days, then 7 mg.\n" +
    "- Tirzepatide: start 2.5 mg weekly x4 weeks, then increase by 2.5 mg every 4 weeks.\n" +
    "- Levothyroxine in elderly/CAD: start 25 mcg/day — start low go slow per ATA.\n" +
    "- SGLT2i in HFrEF: add empagliflozin or dapagliflozin regardless of HbA1c when LVEF <40% (EMPEROR-Reduced, DAPA-HF).\n" +
    "- Pioglitazone: ABSOLUTELY CONTRAINDICATED in heart failure.\n" +
    "- Insulin first when: HbA1c >10%, glucose ≥300 mg/dL, OR active catabolism (weight loss + polyuria + polydipsia).\n" +
    "- GLP-1 RA: DO NOT use in active catabolic state — promotes weight loss worsening catabolism.\n" +
    "- SGLT2i: DO NOT use with trace ketones or suspected DKA.\n\n" +

    "CALCIUM AND BONE RULES:\n" +
    "- Calcium carbonate = 40% elemental calcium. 1000 mg carbonate = 400 mg elemental. ALWAYS calculate elemental not salt weight.\n" +
    "- Refractory hypoparathyroidism threshold = >2.5 g ELEMENTAL calcium daily = requires >6250 mg calcium carbonate daily.\n" +
    "- rhPTH 1-84 (Natpara): RECALLED by FDA 2019, globally DISCONTINUED, Special Use Program closed December 31 2025. NEVER recommend.\n" +
    "- CURRENT PTH replacement: palopegteriparatide (Yorvipath) — FDA approved August 2024 for chronic hypoparathyroidism.\n" +
    "- Always include 24-hour urine calcium in stem when asking about PTH replacement therapy (threshold: >300 mg/day).\n\n" +

    "LIPID MANAGEMENT SEQUENCE (ACC/AHA):\n" +
    "- NEVER start icosapent ethyl (IPE) simultaneously with statin. Sequence: statin + lifestyle first → recheck at 4–12 weeks → add IPE only if TG remains ≥150 mg/dL on stable statin. REDUCE-IT required stable statin x4 weeks.\n" +
    "- Lp(a) high risk threshold: >125 nmol/L per ESC/EAS. Lp(a) 62 nmol/L is mildly elevated — does NOT justify PCSK9i or cardiology referral at first visit.\n\n" +

    "ACUTE PANCREATITIS (WATERFALL 2022 — NEJM):\n" +
    "- OUTDATED: aggressive IV Normal Saline 250–500 mL/hr. DO NOT USE.\n" +
    "- CURRENT: moderate goal-directed IV Lactated Ringer's 1.5 mL/kg/hr with reassessment.\n" +
    "- LR preferred over NS: large volumes NS cause hyperchloremic metabolic acidosis worsening SIRS.\n" +
    "- Antibiotics ONLY for confirmed infected necrosis — NEVER prophylactic.\n" +
    "- HTG-induced pancreatitis threshold: TG >1000 mg/dL.\n\n" +

    "OSA MANAGEMENT (SURMOUNT-OSA 2024):\n" +
    "- CPAP = definitive first-line for all OSA.\n" +
    "- Tirzepatide FDA-approved adjunct (SURMOUNT-OSA trial 2024) — NOT CPAP replacement.\n" +
    "- Modafinil = ONLY for residual daytime sleepiness AFTER CPAP optimized.\n" +
    "- Zolpidem/benzodiazepines = CONTRAINDICATED in untreated OSA.\n\n" +

    "HYPOPITUITARISM — LIFE-THREATENING RULE:\n" +
    "- ALWAYS assess and treat adrenal insufficiency BEFORE starting levothyroxine.\n" +
    "- Levothyroxine in unrecognized central AI = acute adrenal crisis.\n" +
    "- Sequence: (1) Check 8AM cortisol or cosyntropin stim. (2) Replace cortisol if deficient. (3) Then start levothyroxine.\n" +
    "- Sheehan syndrome: postpartum hemorrhage + amenorrhea + loss of pubic/axillary hair + NO hyperpigmentation = central panhypopituitarism.\n\n" +

    "AGP AND AID SYSTEMS:\n" +
    "- AGP: ALWAYS fix TBR >4% BEFORE adjusting for hyperglycemia.\n" +
    "- AID systems: Rule of 15 is obsolete. Micro-treat mild lows with 5–8 g carbs only (PLGS pre-suspends basal insulin).\n\n" +

    "CURRENT EVIDENCE-BASED PRACTICE — ALWAYS USE MOST UPDATED GUIDELINES:\n" +
    "- Heart failure: goal-directed GDMT titration per ACC/AHA.\n" +
    "- GI bleeding: restrictive transfusion strategy (Hgb threshold 7 g/dL per TRICC/TRIGGER trials).\n" +
    "- Sepsis: Surviving Sepsis Campaign — 30 mL/kg crystalloid then reassess dynamically.\n" +
    "- Pneumonia: IDSA/ATS — severity-guided therapy, avoid over-treatment of low-risk CAP.\n" +
    "- ALWAYS prioritize landmark practice-changing trial data over older dogma.\n\n" +

    "FEW-SHOT EXEMPLARS — Study these for clinical depth, distractor logic, and reasoning style:\n\n" +

    "EX1(Adrenal mass): 54yo man, resistant HTN, 15kg gain, DM, bruising, 3.8cm left adrenal mass, atrophic right adrenal, aldosterone 14/renin<0.6. Q:Best next step? CORRECT: Plasma metanephrines + 1mg DST. WHY: Large adrenal tumor >2.4cm requires excluding pheo AND hypercortisolism before surgery — contralateral atrophy suggests ACTH-independent Cushing. Surgery without cortisol testing risks adrenal crisis. PEARL: Adrenal tumors >2.4cm mandate complete hormonal evaluation before any intervention.\n\n" +

    "EX2(Pituitary incidentaloma): 28yo woman, 9mm pituitary incidentaloma abutting optic chiasm, normal labs, wants pregnancy. CORRECT: Pituitary surgery referral. WHY: Pituitary enlarges 3-fold in pregnancy — chiasm compression risk. PEARL: Nonfunctioning adenoma near optic chiasm + planned pregnancy = surgical referral before conception.\n\n" +

    "EX3(TSH resistance): 42yo man, TSH 12.1, free T4 normal, negative antibodies, normal US, child has same labs. CORRECT: TSH receptor resistance. WHY: Elevated TSH + normal T4 + negative antibodies + family pattern = TSHR inactivating variant. PEARL: Subclinical hypothyroid pattern + negative antibodies + family history = think TSHR gene mutation.\n\n" +

    "EX4(T1DM screening): 21yo woman, T1DM x3 years, HbA1c 6.8%, two normal eye exams. Q: What is indicated now? CORRECT: Fasting lipid profile. WHY: ADA recommends annual lipid profile from T1DM diagnosis. Nephropathy and neuropathy screening begin 5 years post-diagnosis. PEARL: T1DM microvascular screening begins 5 years post-diagnosis; lipid profile from day one.\n\n" +

    "EX5(Virilization): 38yo woman, rapid virilization, DHEAS 910 mcg/dL. CORRECT: Abdominal CT. WHY: DHEAS >700 = adrenal source. PEARL: DHEAS >700 with rapid virilization = adrenal carcinoma until proven otherwise.\n\n" +

    "EX6(Elderly hyperthyroidism): 83yo woman, overt hyperthyroidism, toxic MNG, CAD, osteoporosis. CORRECT: Start methimazole. WHY: Must achieve euthyroidism before RAI. PEARL: Elderly CAD + overt hyperthyroidism = methimazole first, never RAI without euthyroidism.\n\n" +

    "EX7(CGM before insulin adjustment): 45yo man, T2DM, HbA1c 8.5%, symptomatic hypoglycemia, on MDI. CORRECT: Initiate CGM. WHY: Never adjust insulin blindly. PEARL: Above-target HbA1c + hypoglycemia on insulin = CGM first.\n\n" +

    "EX8(Elderly hypothyroidism): 81yo man, CAD, TSH 25, FT4 0.5. CORRECT: Levothyroxine 25 mcg/day. WHY: Start low go slow in elderly CAD. PEARL: Elderly + CAD + hypothyroidism = 25 mcg/day regardless of TSH severity.\n\n" +

    "EX9(DKA management): Patient with DKA, BP 92/58, K+ 5.8, glucose 487, pH 7.22, on SGLT2i. CORRECT: IV NS 1–1.5 L/hr FIRST, then check K+, then insulin only if K+ ≥3.5, hold SGLT2i, blood cultures for sepsis. PEARL: Fluids first, check K+ before insulin, never restart SGLT2i until full biochemical resolution.\n\n" +

    "EX10(Lipids — REDUCE-IT sequencing): 54yo Black man, T2DM, LDL 118, TG 285, no prior statin. CORRECT: High-intensity statin + lifestyle first, recheck 4–12 weeks, THEN add IPE only if TG remains ≥150 on stable statin. PEARL: Never start IPE simultaneously with statin — REDUCE-IT required stable statin x4 weeks first.\n\n" +

    "EX11(T2DM dual therapy): 51yo Hispanic woman, HbA1c 8.9%, UACR 42, eGFR 78. CORRECT: Metformin + semaglutide 0.25 mg weekly (NOT 0.5 mg — FDA requires 0.25 mg initiation). PEARL: Semaglutide ALWAYS starts at 0.25 mg weekly x4 weeks.\n\n" +

    "EX12(HFrEF + T2DM): 64yo man, HFrEF LVEF 35%, HbA1c 7.4%, eGFR 58. CORRECT: Add empagliflozin regardless of HbA1c. WHY: EMPEROR-Reduced and DAPA-HF — SGLT2i reduces HF hospitalizations independent of glucose control. PEARL: HFrEF + diabetes = SGLT2i non-negotiable regardless of A1c.\n\n" +

    "EX13(Catabolic T2DM): 48yo man, HbA1c 11.8%, 15-lb weight loss, glucose 345, trace ketones. CORRECT: Basal insulin glargine 10 units. WHY: Active catabolism + HbA1c >10% + glucose ≥300 = insulin first. GLP-1 RA contraindicated in active catabolic state. PEARL: Weight loss + polyuria + HbA1c >10% = start insulin. Active catabolism = absolute insulin deficiency.\n\n" +

    "EX14(AGP interpretation): 28yo woman, T1DM on CSII pump, TBR 6%, nocturnal hypoglycemia 2–4 AM, rebound morning hyperglycemia. CORRECT: Decrease nocturnal basal rate 12–4 AM. WHY: Fix hypoglycemia first — TBR >4% must be addressed before any hyperglycemia adjustment. PEARL: Always look at TBR first on AGP.\n\n" +

    "EX15(AID micro-treat): 34yo man, T1DM on AID system, treats CGM alert at 65 mg/dL with 15g carbs (Rule of 15), glucose skyrockets to >250. CORRECT: AID suspended basal insulin via PLGS — advise 5–8g carbs only. PEARL: Rule of 15 is obsolete on AID systems. Micro-treat mild lows with 5–8g.\n\n" +

    "EX16(Acute pancreatitis): 22yo woman, lipase 1240, TG 1500, meets Atlanta criteria. CORRECT: Moderate goal-directed IV Lactated Ringer's 1.5 mL/kg/hr. WATERFALL 2022 ended aggressive NS dogma. PEARL: Moderate LR not aggressive NS. Antibiotics only for confirmed infected necrosis.\n\n" +

    "EX17(Papillary thyroid cancer): 61yo Black man, 2.6cm PTC, extrathyroidal extension, 2/8 positive central nodes (ATA intermediate risk). CORRECT: Locoregional recurrence in cervical lymph nodes (15–20% ATA intermediate risk). KEY TRAP: Hypoparathyroidism is a surgical complication NOT a cancer complication. PHRASING: Use 'greatest long-term clinical risk associated with the underlying malignancy'.\n\n" +

    "EX18(OSA management): 31yo woman, BMI 29, AHI 32, CPAP scheduled next week. CORRECT: Defer all pharmacotherapy and await CPAP titration. Tirzepatide FDA-approved adjunct (SURMOUNT-OSA 2024) but CPAP is definitive immediate first-line. Modafinil only after CPAP optimized. Zolpidem contraindicated in untreated OSA.\n\n" +

    "EX19(Sheehan syndrome): 35yo woman, 14 months post-PPH, amenorrhea, central hypothyroidism confirmed. CORRECT: Check 8AM cortisol or cosyntropin stim BEFORE starting levothyroxine. FATAL TRAP: Levothyroxine before cortisol replacement = acute adrenal crisis. PEARL: Cortisol first, thyroid second. Always.\n\n" +

    "EX20(Hypoparathyroidism): 29yo woman, post-thyroidectomy, symptomatic hypocalcemia, on calcium carbonate 2500mg TID (= 3g elemental/day), calcitriol 0.5mcg BID at ceiling, 24-hr urine calcium 410 mg/day. CORRECT: Add palopegteriparatide (Yorvipath) — FDA approved August 2024. NEVER rhPTH 1-84 (Natpara — recalled 2019, discontinued). CALCIUM MATH: Carbonate is 40% elemental — always calculate elemental not salt weight. PEARL: Conventional therapy ceiling = 24hr urine Ca >300 mg/day on >2.5g elemental calcium + calcitriol >0.5mcg BID. Modern answer is Yorvipath.\n\n" +

    "Now generate ONE new MCQ matching this exact depth, clinical reasoning, and quality for the specified topic.";

  var userText =
    levelNote + "\n\n" +
    topicInstruction + "\n\n" +
    "FIRST: Use web search to verify the most current guidelines for this topic.\n\n" +
    "STEM: 3-4 sentences of clinical vignette." + imagingNote + cgmNote + " End with exactly: Which of the following is the " + selectedTask + "?\n" +
    "CHOICES: 5 options (A–E). One clearly correct per current guidelines. Four plausible distractors representing real cognitive errors.\n" +
    "EXPLANATION: 3 sentences. (1) Why correct answer is right + one guideline citation. (2) Why the 2 most tempting wrong answers are wrong + cognitive trap named. (3) Board pearl — a clinical insight that changes thinking.\n\n" +
    "Return ONLY valid JSON — complete with all closing brackets. No markdown. No text outside JSON:\n" +
    jsonSchema;

  return { systemText: systemText, userText: userText, radiopaediaLink: radiopaediaLink, specificTopic: specificTopic };
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
    var patientSeed = "MANDATORY: Patient is a " + randAge + "-year-old " + randRace + " " + randSex + " presenting to a " + randSetting + ". Use exactly these demographics.";

    var promptData = buildPrompt(level, topic);
    var enrichedUserText = patientSeed + "\n\n" + promptData.userText;

    var raw = await callClaude(promptData.systemText, enrichedUserText);

    // Robust JSON extraction - handles markdown, extra text, web search artifacts
    var cleaned = raw;
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
    // Find the outermost JSON object
    var firstBrace = cleaned.indexOf("{");
    var lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found in response");
    }
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    // Validate basic structure before parsing
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
