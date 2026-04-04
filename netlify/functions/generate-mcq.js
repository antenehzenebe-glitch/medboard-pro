// generate-mcq.js — MedBoard Pro
// Model: claude-haiku-4-5-20251001
// Clean rebuild — no patches

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function callClaude(systemText, userText) {
  var maxRetries = 3;
  var retryDelays = [800, 1500, 2500];
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  var finalUserText = userText + "\n\n[Seed: " + entropySeed + " - Generate a completely unique vignette.]";

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1100,
        temperature: 0.7,
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
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error("Unexpected API response format");
    }
    return data.content[0].text;
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
  { weight:24, category:"Diabetes Mellitus and Hypoglycemia", topics:["ADA 2025 Standards - glycemic targets","Type 2 diabetes - GLP-1 RA, SGLT2i, DPP-4i, tirzepatide","Type 1 diabetes - MDI vs AID systems and CGM","DKA and HHS - diagnosis and management","Hypoglycemia unawareness - prevention","Inpatient glycemic management","CVOT data - GLP-1 RA and SGLT2i in ASCVD, HF, CKD","Gestational diabetes - HAPO trial","MODY and LADA - genetic testing"] },
  { weight:15, category:"Thyroid Disorders", topics:["Hypothyroidism - primary vs central, TSH interpretation","Hashimoto thyroiditis - TPO antibodies, subclinical management","Hyperthyroidism - Graves disease, toxic nodular goiter","Thyroid storm - Burch-Wartofsky score","Thyroid nodule - ATA ultrasound risk stratification and FNA","Thyroid cancer - RAI and TSH suppression","Thyroid disease in pregnancy - TSH targets","Amiodarone-induced thyroid disease","Central hypothyroidism"] },
  { weight:15, category:"Calcium and Bone Disorders", topics:["Hypercalcemia - PTH vs PTHrP vs vitamin D mediated","Primary hyperparathyroidism - surgical criteria","Hypoparathyroidism - post-surgical management","Osteoporosis - DXA, FRAX, bisphosphonates, denosumab, romosozumab","Vitamin D deficiency - supplementation protocols","Paget disease of bone","Hypocalcemia - acute IV calcium and chronic management"] },
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
  "Cushing's Syndrome": "https://radiopaedia.org/search?q=adrenal+adenoma+cushing+CT&lang=us",
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
  "Hypothyroidism and Hashimotos": "https://radiopaedia.org/search?q=hashimoto+thyroiditis+ultrasound+heterogeneous&lang=us",
  "Hyperthyroidism and Graves": "https://radiopaedia.org/search?q=graves+disease+thyroid+scan+diffuse+uptake&lang=us",
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

// ─── FEW-SHOT EXEMPLARS (Dr. Anteneh Zenebe, MD, FACE) ───────────────────────

var FEW_SHOT_PROMPT =
  "Study these 8 exemplars for clinical depth, distractor logic, and guideline citation style:\n\n" +

  "EX1(ABIM-Endo/Adrenal): 54yo man, resistant HTN, 15kg gain, DM, bruising, 3.8cm left adrenal mass, atrophic right adrenal, aldosterone 14/renin<0.6. " +
  "Q:Best next step? A:Spironolactone B:Plasma metanephrines+1mg DST C:Adrenal venous sampling D:Left adrenalectomy E:Saline infusion test. " +
  "CORRECT:B. WHY:Large adrenal tumor(>2.4cm) requires excluding pheochromocytoma AND hypercortisolism before surgery — contralateral atrophy suggests ACTH-independent Cushing. " +
  "Surgery without cortisol testing risks adrenal crisis. Spironolactone(A) treats mineralocorticoid excess only. Venous sampling(C)/saline test(E) premature before full hormonal workup. Adrenalectomy(D) contraindicated without ruling out Cushing and pheo. " +
  "PEARL:Adrenal tumors>2.4cm mandate complete hormonal evaluation(pheo+Cushing) before any intervention.\n\n" +

  "EX2(ABIM-Endo/Pituitary): 28yo woman, 9mm pituitary incidentaloma abutting optic chiasm, normal labs(prolactin 28, IGF-1 normal), wants pregnancy soon. " +
  "Q:Best management? A:Pituitary surgery referral B:Start cabergoline C:Start octreotide D:MRI in 2 years E:Routine MRI first trimester. " +
  "CORRECT:A. WHY:Pituitary enlarges 3-fold in pregnancy — chiasm compression risk requires surgical referral per ES guidelines. " +
  "Cabergoline/octreotide(B,C) not studied for nonfunctioning incidentalomas. MRI in 2 years(D) too long — repeat at 6-12 months for chiasm-adjacent lesions. Routine pregnancy MRI(E) not indicated. " +
  "PEARL:Nonfunctioning adenoma near optic chiasm + planned pregnancy = surgical referral before conception.\n\n" +

  "EX3(ABIM-Endo/Thyroid): 42yo man, TSH 12.1 mIU/L, free T4 normal, TPO/TG antibodies negative, normal thyroid US, child has same labs. " +
  "Q:Most likely diagnosis? A:TSH receptor resistance B:Hashimoto thyroiditis C:Adrenal insufficiency D:Resistance to thyroid hormone E:Selenium excess. " +
  "CORRECT:A. WHY:Elevated TSH+normal T4+negative antibodies+normal US+family pattern = TSHR inactivating variant. " +
  "Hashimoto(B) excluded by negative antibodies+normal US. Adrenal insufficiency(C) causes mild TSH elevation not this degree. RTH(D) causes elevated T4 not normal T4. Selenium(E) does not cause this. " +
  "PEARL:Subclinical hypothyroidism pattern + negative antibodies + family history = think TSHR gene mutation.\n\n" +

  "EX4(ABIM-Endo/T1DM): 21yo woman, T1DM x3 years, HbA1c 6.8%, two normal eye exams(last 1 year ago), BP 116/72, eGFR 91. " +
  "Q:What is indicated now? A:Neuropathy screening(monofilament) B:Urinary albumin/creatinine ratio C:Repeat dilated eye exam D:Resting ECG E:Fasting lipid profile. " +
  "CORRECT:E. WHY:ADA recommends annual lipid profile from T1DM diagnosis. " +
  "Neuropathy(A) and nephropathy(B) screening begin 5 years after T1DM diagnosis. Two consecutive normal eye exams extend to 2-year intervals(C not needed now). ECG(D) not indicated in asymptomatic young patient. " +
  "PEARL:T1DM microvascular screening(nephropathy+neuropathy) begins 5 years post-diagnosis; lipid profile from day one.\n\n" +

  "EX5(ABIM-IM/Adrenal): 38yo woman, 9-month rapid virilization, deepening voice, clitoromegaly, DHEAS 910 mcg/dL, testosterone 97 ng/dL. " +
  "Q:Best next step? A:Abdominal CT B:Adrenal vein sampling C:Ovarian vein sampling D:Pelvic US E:Pituitary MRI. " +
  "CORRECT:A. WHY:DHEAS>700 mcg/dL = adrenal source — abdominal CT is first step. " +
  "Pelvic US(D) for ovarian source only when testosterone>200 with normal/mildly elevated DHEAS. Venous sampling(B,C) after imaging not before. Pituitary MRI(E) for ACTH-dependent adrenal hyperplasia only. " +
  "PEARL:DHEAS>700 mcg/dL with rapid virilization = adrenal carcinoma until proven otherwise — CT first.\n\n" +

  "EX6(ABIM-IM/Thyroid): 83yo woman, confirmed overt hyperthyroidism(TSH 0.05 x2, FT4 2.1), toxic MNG on scan, CAD and osteoporosis. " +
  "Q:Management? A:Repeat TSH 6 weeks B:Start methimazole C:Start prednisone D:Start teprotumumab. " +
  "CORRECT:B. WHY:Overt hyperthyroidism confirmed on serial testing + CAD/osteoporosis = must treat. " +
  "Methimazole to achieve euthyroidism before RAI per ATA 2016. Watchful waiting(A) risks AFib and bone loss. Prednisone(C) for subacute thyroiditis only. Teprotumumab(D) for thyroid eye disease only. " +
  "PEARL:Elderly CAD patient with overt hyperthyroidism — methimazole first, never RAI without achieving euthyroidism.\n\n" +

  "EX7(ABIM-IM/Diabetes): 45yo man, T2DM, HbA1c 8.5%, symptomatic hypoglycemia at unpredictable times, on metformin+glargine+lispro. " +
  "Q:Management? A:Discontinue metformin B:Increase glargine C:Initiate CGM D:Reduce glargine. " +
  "CORRECT:C. WHY:ADA 2025 — CGM for all insulin users with hypoglycemia or above-target HbA1c. " +
  "Increasing glargine(B) worsens hypoglycemia without knowing timing. Reducing glargine(D) worsens HbA1c. Metformin(A) does not cause hypoglycemia — no reason to stop. " +
  "PEARL:Above-target HbA1c + hypoglycemia on insulin = CGM first — never adjust insulin blindly.\n\n" +

  "EX8(ABIM-IM/Thyroid): 81yo man, CAD, overt hypothyroidism(TSH 25, FT4 0.5), bradycardia, delayed reflexes. " +
  "Q:Treatment? A:Levothyroxine 25 mcg/day B:Levothyroxine 100 mcg/day C:Desiccated thyroid 60 mg/day D:Triiodothyronine 50 mcg/day. " +
  "CORRECT:A. WHY:ATA 2016 — start low go slow in elderly CAD patients. Rapid correction increases cardiac O2 demand and risks MI. " +
  "Full dose 100 mcg/day(B) contraindicated with CAD. Desiccated thyroid(C) has T3 component — cardiac risk. T3 monotherapy(D) causes rapid fluctuations — never for routine hypothyroidism. " +
  "PEARL:Elderly + CAD + hypothyroidism = levothyroxine 25 mcg/day — start low go slow regardless of TSH severity.\n\n" +

  "EX9(ABIM-IM/DKA): Patient with DKA, BP 92/58, K+ 5.8, glucose 487, pH 7.22, on SGLT2i. " +
  "Q:Most appropriate next step? " +
  "CORRECT: IV Normal Saline 1-1.5 L/hr FIRST, then insulin infusion 0.1 units/kg/hr after K+ confirmed >=3.5, hold SGLT2i until full DKA resolution, blood cultures for sepsis workup. " +
  "WHY: ADA 2025 DKA protocol mandates fluid resuscitation BEFORE insulin. K+ must be >=3.5 before insulin or fatal arrhythmia risk. SGLT2i held entire episode not just 24 hours. Hypotonic saline contraindicated in hyperosmolar state. " +
  "PEARL: In DKA — fluids first, check potassium before insulin, never restart SGLT2i until full biochemical resolution.\n\n" +
  "EX10(ABIM-IM/Lipids): 54yo Black man, T2DM HbA1c 7.2%, BMI 34, LDL 118, TG 285, HDL 38, Lp(a) 62 nmol/L, eGFR 68, no prior statin. " +
  "Q: Most appropriate next step? " +
  "CORRECT: High-intensity statin (atorvastatin 40-80mg) plus lifestyle modification, recheck lipids in 4-12 weeks, THEN add icosapent ethyl only if TG remains above 150 mg/dL on stable statin. " +
  "WHY: REDUCE-IT required stable statin x4 weeks before adding IPE - cannot diagnose persistent hypertriglyceridemia without first treating with statin. Starting IPE simultaneously (Choice A) jumps the gun on the evidence. Lp(a) 62 nmol/L is mildly elevated - threshold for high risk is 125 nmol/L per ESC/EAS - does not justify PCSK9i yet. Rosuvastatin monotherapy alone (Choice B) misses the opportunity for high-intensity statin in a high-risk T2DM patient with multiple risk factors. " +
  "PEARL: In diabetic dyslipidemia - statin plus lifestyle FIRST, recheck at 4-12 weeks, add icosapent ethyl only if triglycerides remain above 150 mg/dL on stable statin. Never start IPE simultaneously with statin at first visit.\n\n" +
  "Now generate ONE new MCQ matching this exact depth and quality for the specified topic.";

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
    topicInstruction = "TOPIC: " + specificTopic + " (" + cat.category + " — " + cat.weight + "% of " + level + ")";
  }

  var radiopaediaLink = getRadiopaediaLink(specificTopic);

  var levelNote = "";
  if (level.includes("Step 1")) {
    levelNote = "LEVEL: USMLE Step 1 — Test pathophysiology and mechanisms (WHY things happen), not clinical management.";
  } else if (level.includes("Step 2")) {
    levelNote = "LEVEL: USMLE Step 2 CK — Test clinical decision-making, next best step, differential diagnosis with subtle clues.";
  } else if (level.includes("Step 3")) {
    levelNote = "LEVEL: USMLE Step 3 — Test outpatient management, chronic disease, preventive care, ethics, biostatistics.";
  } else if (level.includes("ABIM Internal Medicine")) {
    levelNote = "LEVEL: ABIM Internal Medicine boards — Test guideline-driven management with specific thresholds. Resident-to-attending level judgment.";
  } else if (level.includes("ABIM Endocrinology")) {
    levelNote = "LEVEL: ABIM Endocrinology subspecialty — Fellowship-level nuance per ADA 2025, Endocrine Society, AACE, ATA. Include advanced metabolic concepts where relevant.";
  }

  var societyMap = "";
  var t = specificTopic.toLowerCase();
  if (t.includes("thyroid") || t.includes("hashimoto") || t.includes("graves") || t.includes("hypothyroid") || t.includes("hyperthyroid")) {
    societyMap = "Cite ATA and/or Endocrine Society for thyroid. NEVER cite ADA for thyroid disorders.";
  } else if (t.includes("diabetes") || t.includes("insulin") || t.includes("cgm") || t.includes("glucose") || t.includes("dka") || t.includes("glp-1") || t.includes("sglt2") || t.includes("metformin")) {
    societyMap = "Cite ADA 2025 Standards of Care and/or AACE for diabetes.";
  } else if (t.includes("osteoporosis") || t.includes("bone") || t.includes("fracture") || t.includes("calcium") || t.includes("parathyroid") || t.includes("vitamin d")) {
    societyMap = "Cite Endocrine Society and/or NOF/BHOF for bone and calcium disorders.";
  } else if (t.includes("adrenal") || t.includes("cushing") || t.includes("aldosteronism") || t.includes("pheochromocytoma")) {
    societyMap = "Cite Endocrine Society Clinical Practice Guidelines for adrenal disorders.";
  } else if (t.includes("pituitary") || t.includes("acromegaly") || t.includes("prolactinoma")) {
    societyMap = "Cite Endocrine Society Clinical Practice Guidelines for pituitary disorders.";
  } else if (t.includes("heart failure") || t.includes("acs") || t.includes("stemi") || t.includes("atrial fibrillation") || t.includes("hypertension")) {
    societyMap = "Cite ACC/AHA guidelines for cardiovascular management.";
  } else if (t.includes("copd") || t.includes("asthma") || t.includes("pneumonia") || t.includes("ards")) {
    societyMap = "Cite GOLD guidelines for COPD, GINA for asthma, IDSA/ATS for pneumonia.";
  } else if (t.includes("kidney") || t.includes("renal") || t.includes("ckd") || t.includes("aki")) {
    societyMap = "Cite KDIGO guidelines for kidney disease.";
  } else if (t.includes("rheumatoid") || t.includes("lupus") || t.includes("gout") || t.includes("vasculitis")) {
    societyMap = "Cite ACR and/or EULAR guidelines for rheumatologic conditions.";
  } else if (t.includes("sepsis") || t.includes("hiv") || t.includes("tuberculosis") || t.includes("c. difficile")) {
    societyMap = "Cite Surviving Sepsis Campaign, DHHS, ATS/CDC/IDSA, or IDSA/SHEA as appropriate.";
  } else {
    societyMap = "Cite the most relevant current specialty society guideline.";
  }

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
      "most appropriate initial pharmacotherapy",
      "most likely diagnosis",
      "most appropriate diagnostic study",
      "best long-term monitoring strategy",
      "most appropriate next step in management",
      "most likely underlying mechanism or etiology",
      "most appropriate initial pharmacotherapy",
      "most likely diagnosis",
      "most appropriate next step in management",
      "most appropriate change in management",
      "most likely complication of this condition",
      "most likely cause of this patient's presentation",
    ];
  }
  var selectedTask = boardTasks[Math.floor(Math.random() * boardTasks.length)];

  var imagingNote = radiopaediaLink
    ? " Describe key imaging findings as a clinician would dictate (e.g., chest X-ray shows consolidation with air bronchograms)."
    : "";

  var cgmNote = (t.includes("cgm") || t.includes("aid") || t.includes("insulin pump"))
    ? " Include CGM metrics: TIR%, TBR%, TAR%, GMI."
    : "";

  var jsonSchema = '{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"A","explanation":"...","topic":"' + specificTopic + '","imageUrl":' + (radiopaediaLink ? '"' + radiopaediaLink + '"' : 'null') + ',"showImageButton":false}';

  var systemText =
    "You are a rigorous medical board exam question writer (USMLE/ABIM level).\n\n" +
    "CRITICAL RULES:\n" +
    "1. Labs MUST match diagnosis: overt hypothyroidism = TSH>10 AND free T4 below reference range. Subclinical = TSH 4.5-10 AND normal free T4.\n" +
    "2. Overt hyperthyroidism = TSH<0.01 AND free T4 above reference range.\n" +
    "3. DKA DIAGNOSIS: glucose>250, pH<7.3, HCO3<18, ketonemia. ADA 2025 DKA MANAGEMENT SEQUENCE: STEP 1 is IV Normal Saline 0.9% at 1-1.5 L/hr for first hour - this is the FIRST and IMMEDIATE intervention before anything else. STEP 2 check potassium - if K+ below 3.5 mEq/L hold insulin and replace potassium IV first. STEP 3 start insulin infusion 0.1 units/kg/hr only after fluid resuscitation is underway AND K+ confirmed at or above 3.5 mEq/L. STEP 4 when glucose drops to 200-250 mg/dL add dextrose to IV fluids but continue insulin until anion gap closes. STEP 5 hold SGLT2 inhibitors throughout entire DKA episode - restart only after full biochemical resolution. NEVER start insulin before or simultaneously with fluids as first step. NEVER use 0.45% hypotonic saline as initial fluid. Primary adrenal insufficiency: low cortisol + HIGH ACTH.\n" +
    "LIPID MANAGEMENT SEQUENCE (ACC/AHA + ADA 2025 - CRITICAL):\n" +
    "   Icosapent ethyl (IPE/REDUCE-IT): NEVER start simultaneously with statin. Sequence is: (1) Start statin + lifestyle modification first. (2) Recheck lipids at 4-12 weeks. (3) ONLY add icosapent ethyl 2g BID if triglycerides REMAIN at or above 150 mg/dL on stable statin therapy. REDUCE-IT inclusion required stable statin x4 weeks with persistent TG 135-499 mg/dL.\n" +
    "   Lipoprotein(a): Lp(a) above 125 nmol/L or above 50 mg/dL = high risk threshold per ESC/EAS. Lp(a) 62 nmol/L is only mildly elevated - does NOT justify PCSK9i or cardiology referral at first visit.\n" +
    "   Statin intensity in T2DM age 40+: Moderate-to-high intensity statin (atorvastatin 40-80mg or rosuvastatin 20-40mg) is standard. No race-based statin avoidance - statin efficacy is not race-dependent.\n" +
    "   Lipid recheck after statin initiation: 4-12 weeks per ACC/AHA - NOT 4 weeks alone which is the absolute minimum.\n" +
    "4. NEVER say 'pathognomonic'. NEVER use EXCEPT/NOT phrasing. NEVER use 'always'/'never' in options.\n" +
    "5. One clearly correct answer. Four plausible distractors representing real clinical cognitive errors (anchoring bias, premature closure, wrong subtype).\n" +
    "6. All 5 options must be same type (all diagnoses OR all treatments — never mix).\n" +
    "7. Correct answer MUST be defensible per current guidelines.\n" +
    "8. " + societyMap + "\n\n" +
    FEW_SHOT_PROMPT;

  var userText =
    levelNote + "\n\n" +
    topicInstruction + "\n\n" +
    "STEM: 3-4 sentences." + imagingNote + cgmNote + " End with exactly this question: Which of the following is the " + selectedTask + "?\n" +
    "CHOICES: 5 options (A-E). One correct per current guidelines. Four plausible distractors.\n" +
    "EXPLANATION: 3 sentences max. (1) Why correct answer is right + guideline citation. (2) Why the 2 most tempting wrong answers are wrong + cognitive trap named. (3) One board pearl.\n\n" +
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
    // Random patient demographics
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

    var cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

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
