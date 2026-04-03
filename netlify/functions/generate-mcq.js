// No external dependencies - uses Node 22 built-in fetch

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function callClaude(systemText, userText) {
  var maxRetries = 3;
  var retryDelays = [800, 1500, 2500];

  // Entropy seed goes ONLY in userText so it never breaks the system cache
  var entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  var randomizedUserText = userText + "\n\n[Internal Generator Seed (Ignore): " + entropySeed + " - Ensure this specific vignette is completely unique.]";

  console.log("Calling Claude | system:", systemText.length, "chars | user:", randomizedUserText.length, "chars");

  for (var attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      console.log("Retry attempt " + attempt + " after overload...");
      await sleep(retryDelays[attempt - 1]);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1200,
        temperature: 0.8,
        system: [
          {
            type: "text",
            text: systemText,
            cache_control: { type: "ephemeral" }
          }
        ],
        messages: [{ role: "user", content: randomizedUserText }]
      })
    });

    if (response.status === 529 || response.status === 503 || response.status === 502) {
      console.log("API overloaded (status " + response.status + "), will retry...");
      if (attempt === maxRetries - 1) {
        throw new Error("Anthropic API is currently busy. Please try again in a moment.");
      }
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      throw new Error("Anthropic API error " + response.status + ": " + err);
    }

    const data = await response.json();
    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error("Unexpected API response:", JSON.stringify(data));
      throw new Error("Unexpected API response format");
    }
    console.log("Response length:", data.content[0].text.length, "| stop_reason:", data.stop_reason);
    return data.content[0].text;
  }
}

// ABIM INTERNAL MEDICINE BLUEPRINT
const ABIM_IM_BLUEPRINT = [
  { weight: 14, category: "Cardiovascular Disease", topics: ["Coronary artery disease and ACS (STEMI, NSTEMI, UA)", "Heart failure (HFrEF, HFpEF) - diagnosis and management", "Atrial fibrillation and flutter - rate vs rhythm control", "Valvular heart disease (aortic stenosis, mitral regurgitation)", "Hypertension - diagnosis, staging, pharmacotherapy", "Dyslipidemia and statin therapy", "Pulmonary hypertension", "Peripheral artery disease", "Aortic aneurysm and dissection", "Cardiac arrhythmias (SVT, VT, heart blocks)", "Pericarditis and myocarditis", "Infective endocarditis - Duke criteria, management"] },
  { weight: 9, category: "Pulmonary Disease", topics: ["COPD - GOLD staging, pharmacotherapy, exacerbations", "Asthma - step therapy, severe exacerbation management", "Community-acquired pneumonia - severity scoring, antibiotics", "Hospital-acquired and ventilator-associated pneumonia", "Pulmonary embolism - diagnosis, anticoagulation, thrombolysis", "Interstitial lung disease - IPF, sarcoidosis, hypersensitivity pneumonitis", "Obstructive sleep apnea", "Pleural effusion - Light's criteria, transudates vs exudates", "ARDS - Berlin criteria, lung-protective ventilation", "Lung cancer - screening, staging, treatment", "Pneumothorax"] },
  { weight: 9, category: "Endocrinology, Diabetes, and Metabolism", topics: ["Type 2 diabetes - ADA treatment algorithm, GLP-1 RA, SGLT2i", "Type 1 diabetes - insulin regimens, diabetic ketoacidosis", "Hypothyroidism - diagnosis, levothyroxine dosing", "Hyperthyroidism and Graves disease - RAI, thionamides", "Adrenal insufficiency - primary vs secondary, steroid dosing", "Cushing syndrome - diagnosis, dexamethasone suppression test", "Primary aldosteronism - screening, subtype differentiation", "Pheochromocytoma - biochemical diagnosis, perioperative management", "Osteoporosis - FRAX, bisphosphonates, denosumab", "Hypercalcemia - primary hyperparathyroidism, malignancy", "Pituitary adenomas - prolactinoma, acromegaly", "Metabolic syndrome and obesity management"] },
  { weight: 9, category: "Gastroenterology", topics: ["Inflammatory bowel disease - Crohn's vs UC, biologics", "Cirrhosis - Child-Pugh, MELD score, complications", "GI bleeding - upper vs lower, endoscopy timing", "Hepatitis B - serology interpretation, antiviral therapy", "Hepatitis C - DAA therapy, cure rates", "Acute pancreatitis - Ranson criteria, management", "NAFLD and NASH - diagnosis, lifestyle, emerging therapies", "Colorectal cancer - screening, Lynch syndrome", "Peptic ulcer disease - H. pylori eradication", "Celiac disease - serology, gluten-free diet", "Acute liver failure - etiology, management"] },
  { weight: 9, category: "Infectious Disease", topics: ["Sepsis and septic shock - Surviving Sepsis bundle", "HIV - ART initiation, OI prophylaxis, drug interactions", "Tuberculosis - latent vs active, treatment regimens", "Infective endocarditis - organisms, Duke criteria, surgery indications", "Urinary tract infections - uncomplicated, complicated, catheter-associated", "Skin and soft tissue infections - cellulitis, necrotizing fasciitis", "Pneumonia organisms - typical, atypical, aspiration", "C. difficile - diagnosis, fidaxomicin, fecal transplant", "Antibiotic stewardship - beta-lactams, vancomycin, aminoglycosides", "COVID-19 - antivirals, immunomodulators, post-COVID", "Meningitis - empiric antibiotics, LP interpretation"] },
  { weight: 9, category: "Rheumatology and Orthopedics", topics: ["Rheumatoid arthritis - DMARDs, biologics, treat-to-target", "Systemic lupus erythematosus - ACR criteria, organ involvement", "Gout - acute management, urate-lowering therapy targets", "Pseudogout - calcium pyrophosphate deposition", "Giant cell arteritis - ESR, temporal artery biopsy, steroids", "Polymyalgia rheumatica - clinical features, steroid response", "Ankylosing spondylitis - HLA-B27, NSAIDs, anti-TNF", "Systemic sclerosis - limited vs diffuse, ILD, PAH", "Vasculitis - GPA, EGPA, polyarteritis nodosa", "Antiphospholipid syndrome - thrombosis, anticoagulation", "Septic arthritis - joint aspiration, empiric antibiotics"] },
  { weight: 6, category: "Hematology", topics: ["Iron deficiency anemia - diagnosis, IV iron, transfusion thresholds", "B12 and folate deficiency - neurologic manifestations", "Hemolytic anemia - Coombs test, causes, management", "Thrombocytopenia - ITP, TTP, HIT", "Sickle cell disease - vaso-occlusive crisis, hydroxyurea", "DVT and PE - DOAC selection, duration of anticoagulation", "Heparin-induced thrombocytopenia - 4T score, argatroban", "Myelodysplastic syndrome - IPSS-R scoring", "Polycythemia vera - JAK2 mutation, phlebotomy", "Disseminated intravascular coagulation - causes, labs, management"] },
  { weight: 6, category: "Nephrology and Urology", topics: ["Acute kidney injury - KDIGO staging, prerenal vs intrinsic vs postrenal", "CKD - staging, slowing progression, SGLT2i in CKD", "Glomerulonephritis - nephritic vs nephrotic syndrome", "Hyponatremia - SIADH vs hypovolemic, correction rate", "Hyperkalemia - EKG changes, acute management", "Metabolic acidosis - anion gap, delta-delta ratio", "Metabolic alkalosis - causes, chloride-responsive vs resistant", "Nephrotic syndrome - minimal change, membranous, FSGS", "Renal replacement therapy - hemodialysis vs peritoneal", "Nephrolithiasis - stone types, prevention"] },
  { weight: 6, category: "Medical Oncology", topics: ["Lung cancer - NSCLC vs SCLC, targeted therapies, immunotherapy", "Breast cancer - hormone receptor status, HER2, treatment", "Colorectal cancer - staging, FOLFOX, bevacizumab", "Prostate cancer - PSA, Gleason score, ADT", "Lymphoma - Hodgkin vs non-Hodgkin, CHOP, R-CHOP", "Leukemia - AML, CML, CLL, TKI therapy", "Multiple myeloma - CRAB criteria, proteasome inhibitors", "Paraneoplastic syndromes - SIADH, hypercalcemia, Eaton-Lambert", "Oncologic emergencies - SVC syndrome, tumor lysis, spinal cord compression", "Immunotherapy toxicities - checkpoint inhibitor adverse effects"] },
  { weight: 4, category: "Neurology", topics: ["Ischemic stroke - tPA eligibility, thrombectomy window, secondary prevention", "Hemorrhagic stroke - ICH, subarachnoid hemorrhage", "Seizures and epilepsy - first-line AEDs, status epilepticus", "Multiple sclerosis - relapsing-remitting, disease-modifying therapy", "Parkinson disease - dopaminergic therapy, motor fluctuations", "Dementia - Alzheimer's, vascular, Lewy body differentiation", "Headache - migraine prophylaxis, cluster headache", "Myasthenia gravis - Tensilon test, thymectomy", "Guillain-Barre syndrome - IVIG, plasmapheresis", "Meningitis and encephalitis"] },
  { weight: 4, category: "Psychiatry", topics: ["Major depressive disorder - SSRI selection, treatment-resistant depression", "Bipolar disorder - mood stabilizers, lithium toxicity", "Schizophrenia - antipsychotics, metabolic side effects", "Anxiety disorders - GAD, panic disorder, PTSD pharmacotherapy", "Alcohol use disorder - CIWA, thiamine, naltrexone", "Opioid use disorder - buprenorphine, methadone, naloxone", "Delirium - causes, prevention, non-pharmacologic management", "Somatoform and functional disorders"] },
  { weight: 3, category: "Dermatology", topics: ["Cellulitis vs erysipelas - treatment, MRSA coverage", "Psoriasis - topical vs systemic, biologics", "Melanoma - ABCDE criteria, staging, immunotherapy", "Drug hypersensitivity reactions - SJS, TEN, DRESS", "Acne vulgaris - isotretinoin, antibiotic stewardship", "Skin manifestations of systemic disease"] },
  { weight: 3, category: "Obstetrics and Gynecology", topics: ["Preeclampsia - diagnostic criteria, magnesium, delivery timing", "Gestational diabetes - screening, insulin vs metformin", "Ectopic pregnancy - risk factors, methotrexate criteria", "Cervical cancer screening - Pap smear intervals, HPV co-testing", "Menopause and HRT - indications, contraindications", "Polycystic ovary syndrome - diagnosis, metformin, clomiphene"] },
  { weight: 3, category: "Geriatric Syndromes", topics: ["Falls prevention - Beers criteria, polypharmacy", "Delirium in elderly - hyperactive vs hypoactive", "Frailty - assessment, sarcopenia", "Urinary incontinence - stress, urge, overflow types", "Pressure ulcers - staging, prevention", "Dementia management - behavioral symptoms, caregiver support"] },
  { weight: 2, category: "Allergy and Immunology", topics: ["Anaphylaxis - epinephrine dosing, biphasic reactions", "Common variable immunodeficiency - recurrent sinopulmonary infections", "Hereditary angioedema - C1 esterase inhibitor deficiency", "Drug allergy - penicillin cross-reactivity, desensitization", "Allergic rhinitis - step therapy"] },
  { weight: 2, category: "Miscellaneous and High-Value Care", topics: ["Preventive medicine - cancer screening guidelines, USPSTF recommendations", "Biostatistics - sensitivity, specificity, PPV, NPV, NNT", "Medical ethics - informed consent, capacity, advance directives", "Patient safety - medication errors, handoff communication", "Health disparities - social determinants of health"] },
  { weight: 1, category: "Ophthalmology", topics: ["Diabetic retinopathy - screening intervals, anti-VEGF", "Glaucoma - open-angle vs angle-closure", "Giant cell arteritis and anterior ischemic optic neuropathy", "Hypertensive retinopathy"] },
  { weight: 1, category: "Otolaryngology", topics: ["Sinusitis - viral vs bacterial, antibiotic indications", "Hearing loss - conductive vs sensorineural", "Obstructive sleep apnea - polysomnography, CPAP"] }
];

// ABIM ENDOCRINOLOGY SUBSPECIALTY BLUEPRINT
const ABIM_ENDO_BLUEPRINT = [
  { weight: 24, category: "Diabetes Mellitus and Hypoglycemia", topics: ["ADA 2025 Standards of Care - glycemic targets, individualization", "Type 2 diabetes pharmacotherapy - GLP-1 RA, SGLT2i, DPP-4i, TZD, sulfonylureas", "Tirzepatide (GIP/GLP-1) - mechanism, weight loss, CV outcomes", "Type 1 diabetes - MDI vs insulin pump, closed-loop AID systems", "CGM - time in range, ambulatory glucose profile interpretation", "Diabetic ketoacidosis - diagnosis, fluids, insulin protocol", "Hyperosmolar hyperglycemic state - key differences from DKA", "Hypoglycemia - unawareness, prevention, glucagon use", "Inpatient glycemic management - basal-bolus insulin", "Microvascular complications - nephropathy, retinopathy, neuropathy", "Macrovascular complications - ASCVD risk reduction, GLP-1 RA and SGLT2i CVOT data", "MODY and LADA - genetic testing, clinical differentiation", "Gestational diabetes - HAPO trial, postpartum screening", "Bariatric surgery - metabolic outcomes, hypoglycemia post-surgery"] },
  { weight: 15, category: "Thyroid Disorders", topics: ["Hypothyroidism - primary vs central, TSH interpretation, levothyroxine dosing", "Hashimoto thyroiditis - TPO antibodies, subclinical hypothyroidism management", "Hyperthyroidism - Graves disease, toxic multinodular goiter, toxic adenoma", "Thyroid storm - Burch-Wartofsky score, PTU vs methimazole, beta-blockade", "Thyroid nodule evaluation - ATA ultrasound risk stratification, FNA indications", "Thyroid cancer - papillary, follicular, medullary, anaplastic - staging, RAI, TSH suppression", "Thyroiditis - subacute, postpartum, silent, Riedel", "Thyroid disease in pregnancy - TSH targets, fetal considerations", "Amiodarone-induced thyroid disease - type 1 vs type 2", "Central hypothyroidism - isolated vs pan-hypopituitarism"] },
  { weight: 15, category: "Calcium and Bone Disorders", topics: ["Hypercalcemia - etiology (PTH vs PTHrP vs vitamin D mediated), acute management", "Primary hyperparathyroidism - surgical criteria, pre-op localization", "Hypoparathyroidism - post-surgical, autoimmune, Chvostek and Trousseau signs", "Osteoporosis - DXA interpretation, FRAX, bisphosphonates, denosumab, romosozumab, teriparatide", "Vitamin D deficiency - 25-OH vs 1,25-OH, supplementation protocols", "Paget's disease of bone - ALP, bisphosphonate therapy", "Hypocalcemia - causes, acute IV calcium, chronic management", "FGF23 disorders - X-linked hypophosphatemia, tumor-induced osteomalacia"] },
  { weight: 12, category: "Lipids, Obesity, and Nutrition", topics: ["Dyslipidemia - ACC/AHA risk calculator, statin intensity, LDL targets by risk category", "PCSK9 inhibitors - evolocumab, alirocumab - indications and CVOT evidence", "Familial hypercholesterolemia - diagnostic criteria, aggressive therapy", "Hypertriglyceridemia - fibrates, omega-3, pancreatitis risk", "Obesity management - BMI classification, GLP-1 RA for weight loss", "Bariatric surgery - types, metabolic outcomes, nutritional deficiencies", "Metabolic syndrome - IDF vs ATP III criteria, treatment"] },
  { weight: 10, category: "Adrenal Disorders", topics: ["Primary adrenal insufficiency (Addison's) - autoimmune, biochemical diagnosis, stress dosing", "Secondary adrenal insufficiency - ACTH stimulation test, glucocorticoid-induced", "Adrenal crisis - recognition, IV hydrocortisone, prevention", "Cushing syndrome - endogenous vs exogenous, UFC, late-night salivary cortisol, LDDST", "Cushing disease vs ectopic ACTH - HDDST, IPSS, bilateral adrenalectomy", "Primary aldosteronism - PAC/PRA ratio, CT, adrenal vein sampling, adrenalectomy vs spironolactone", "Pheochromocytoma - biochemical diagnosis (metanephrines), pre-op alpha then beta-blockade", "Adrenal incidentaloma - imaging characterization, hormonal workup", "Congenital adrenal hyperplasia - 21-hydroxylase deficiency, 17-OHP"] },
  { weight: 10, category: "Pituitary Disorders", topics: ["Pituitary adenoma classification - micro vs macro, functioning vs nonfunctional", "Prolactinoma - dopamine agonists (cabergoline vs bromocriptine), pregnancy management", "Acromegaly - IGF-1, OGTT GH suppression, somatostatin analogs, pegvisomant", "Cushing disease - ACTH-dependent, petrosal sinus sampling, transsphenoidal surgery", "Central diabetes insipidus - water deprivation test, desmopressin", "SIADH - euvolemic hyponatremia, fluid restriction, vaptans", "Hypopituitarism - panhypopituitarism, replacement priorities (cortisol first)", "Pituitary apoplexy - hemorrhage, visual field defects, emergency management"] },
  { weight: 7, category: "Female Reproduction", topics: ["PCOS - Rotterdam criteria, metabolic complications, OCP, metformin, letrozole", "Menopause - FSH, vasomotor symptoms, HRT indications and contraindications", "Premature ovarian insufficiency - etiology, hormone replacement, fertility", "Amenorrhea - primary vs secondary, workup algorithm", "Hyperprolactinemia - differential (drugs, pituitary, hypothyroidism)", "Turner syndrome - 45,X, short stature, cardiac screening, estrogen replacement"] },
  { weight: 7, category: "Male Reproduction", topics: ["Male hypogonadism - primary vs secondary, testosterone therapy indications", "Klinefelter syndrome - 47,XXY, testosterone replacement, fertility", "Male infertility - azoospermia, FSH/LH/testosterone interpretation", "Testosterone therapy - formulations, monitoring, contraindications", "Delayed puberty vs constitutional growth delay"] }
];

// USMLE STEP 1 BLUEPRINT
const USMLE_STEP1_BLUEPRINT = [
  { weight: 16, category: "Reproductive and Endocrine Systems", topics: ["Hypothalamic-pituitary-gonadal axis - feedback loops", "Menstrual cycle physiology - follicular, ovulation, luteal phase", "Thyroid hormone synthesis - steps, iodination, coupling", "Adrenal cortex hormones - zona glomerulosa, fasciculata, reticularis", "Insulin and glucagon - fed vs fasted state physiology", "Type 1 diabetes - autoimmune destruction, HLA-DR3/DR4", "Congenital adrenal hyperplasia - enzyme deficiencies", "Androgen insensitivity syndrome", "5-alpha reductase deficiency", "GnRH, LH, FSH - pulsatility and feedback"] },
  { weight: 13, category: "Behavioral Health and Nervous Systems", topics: ["Neurotransmitters - dopamine, serotonin, GABA, glutamate", "Antidepressants - mechanism of SSRIs, SNRIs, TCAs, MAOIs", "Antipsychotics - D2 blockade, EPS, tardive dyskinesia", "Mood stabilizers - lithium mechanism and toxicity", "Opioid pharmacology - mu receptor, tolerance, withdrawal", "Autonomic pharmacology - alpha, beta agonists and antagonists", "CNS tumors - glioblastoma, meningioma, medulloblastoma", "Stroke syndromes - MCA, PCA, PICA territories", "Neurodegenerative diseases - Parkinson, Huntington, ALS pathology"] },
  { weight: 13, category: "Respiratory and Renal Systems", topics: ["Pulmonary function tests - obstructive vs restrictive patterns", "Hypoxemia mechanisms - V/Q mismatch, shunt, diffusion impairment", "Acid-base disorders - metabolic vs respiratory, compensation", "Renal tubular physiology - PCT, loop, DCT transport", "Glomerular filtration - GFR determinants, filtration fraction", "Diuretics - mechanism by segment, electrolyte effects", "RAAS - angiotensin II effects, aldosterone", "Nephritic vs nephrotic syndrome - pathologic types"] },
  { weight: 11, category: "Cardiovascular System", topics: ["Cardiac action potential - pacemaker vs ventricular cell", "Frank-Starling law - preload, afterload, contractility", "Antiarrhythmics - Vaughan-Williams classification", "Atherosclerosis - foam cells, fatty streaks, fibrous plaque", "Myocardial infarction - biomarkers, ECG changes by territory", "Congenital heart defects - VSD, ASD, PDA, TOF", "Cardiac drugs - digoxin mechanism and toxicity"] },
  { weight: 10, category: "Blood and Immune Systems", topics: ["Hematopoiesis - cell lineages, growth factors", "Anemia classification - microcytic, normocytic, macrocytic", "Clotting cascade - intrinsic vs extrinsic pathway", "Hypersensitivity reactions - Type I-IV mechanisms", "Immunodeficiencies - B vs T cell, combined", "Complement system - classical vs alternative pathway"] },
  { weight: 10, category: "Musculoskeletal and Skin", topics: ["Bone metabolism - osteoblasts vs osteoclasts, RANK-RANKL", "Rheumatoid arthritis pathogenesis - pannus, anti-CCP antibodies", "SLE - ANA, anti-dsDNA, anti-Smith antibodies", "Crystal arthropathies - monosodium urate vs calcium pyrophosphate", "Muscular dystrophies - Duchenne, Becker, dystrophin"] },
  { weight: 9, category: "Gastrointestinal System", topics: ["GI hormones - gastrin, secretin, CCK, GIP, motilin", "Liver metabolism - glycolysis, gluconeogenesis, urea cycle", "Bilirubin metabolism - prehepatic, hepatic, posthepatic jaundice", "H. pylori - virulence factors, peptic ulcer disease", "Hepatitis viruses - A, B, C, D, E - transmission, serologies"] },
  { weight: 5, category: "Biostatistics and Epidemiology", topics: ["Sensitivity and specificity - ROC curve", "PPV and NPV - prevalence effect", "Bias types - selection, information, confounding", "Study designs - RCT, cohort, case-control, cross-sectional", "Number needed to treat and number needed to harm"] },
  { weight: 2, category: "Human Development", topics: ["Embryology - germ layers, organ development", "Teratogens - thalidomide, isotretinoin, alcohol", "Fetal circulation - ductus arteriosus, foramen ovale"] }
];

// USMLE STEP 2 BLUEPRINT
const USMLE_STEP2_BLUEPRINT = [
  { weight: 13, category: "Renal, Urinary and Reproductive Systems", topics: ["Acute kidney injury - prerenal vs intrinsic, management", "CKD complications - anemia, hyperkalemia, metabolic acidosis", "Glomerulonephritis - post-strep, IgA nephropathy, MPGN", "Hyponatremia - SIADH, correction", "UTI - uncomplicated, pyelonephritis, catheter-associated", "Ovarian cancer - CA-125, BRCA mutation", "Testicular cancer - germ cell vs non-germ cell"] },
  { weight: 12, category: "Cardiovascular System", topics: ["Chest pain evaluation - ACS rule-out, HEART score", "STEMI management - door-to-balloon, thrombolytics", "Heart failure management - GDMT, diuresis", "Atrial fibrillation - CHA2DS2-VASc score, anticoagulation", "Hypertensive urgency vs emergency", "Aortic stenosis - valve area, TAVR vs SAVR criteria", "Syncope evaluation - cardiac vs neurally mediated"] },
  { weight: 13, category: "Legal, Ethical Issues and Patient Safety", topics: ["Informed consent - exceptions, capacity assessment", "Confidentiality breaches - duty to warn, mandatory reporting", "End-of-life care - withdrawal of care, futility", "Medical errors - disclosure", "Advance directives - DNR, POLST", "Health disparities - implicit bias"] },
  { weight: 10, category: "Behavioral Health", topics: ["Suicide risk assessment", "Major depression - PHQ-9, SSRI initiation", "Bipolar disorder - mood stabilizer selection", "Schizophrenia - positive vs negative symptoms", "Substance use disorders - CAGE questionnaire", "Eating disorders - refeeding syndrome"] },
  { weight: 10, category: "Nervous System and Special Senses", topics: ["Stroke - NIHSS, tPA eligibility, thrombectomy window", "Seizure - first unprovoked seizure workup, AED selection", "Headache - migraine vs tension vs cluster", "Multiple sclerosis - McDonald criteria", "Vertigo - BPPV (Dix-Hallpike), central vs peripheral", "Neuropathy - diabetic, B12 deficiency, Guillain-Barre"] },
  { weight: 9, category: "Musculoskeletal and Skin", topics: ["Low back pain - red flags, imaging indications", "Gout - acute management, allopurinol timing", "Cellulitis - MRSA risk, antibiotic selection", "Melanoma - biopsy technique, sentinel lymph node", "Psoriasis - PASI scoring, biologics"] },
  { weight: 8, category: "Respiratory System", topics: ["Pneumonia - PORT/PSI score, outpatient vs inpatient antibiotics", "COPD exacerbation - bronchodilators, steroids, antibiotics, NIV", "Asthma exacerbation - SABA, ipratropium, magnesium", "Pulmonary embolism - Wells score, CTPA, anticoagulation", "Lung cancer - screening (LDCT), staging, targeted therapy"] },
  { weight: 7, category: "Pregnancy, Childbirth and Puerperium", topics: ["Preeclampsia - BP criteria, proteinuria, management", "Gestational diabetes - GCT, OGTT, insulin vs metformin", "Placenta previa vs abruptio placentae", "Postpartum hemorrhage - causes, oxytocin", "Ectopic pregnancy - transvaginal US, beta-hCG, methotrexate criteria"] },
  { weight: 7, category: "Endocrine System", topics: ["Diabetes management - A1c targets, insulin adjustment", "Thyroid nodule - ultrasound features, FNA indications", "Adrenal insufficiency - stress dosing, sick day rules", "Cushing syndrome - screening tests, causes", "Calcium disorders - hypercalcemia workup, hypoparathyroidism"] },
  { weight: 6, category: "Gastrointestinal System", topics: ["Upper GI bleeding - Rockall score, endoscopy timing", "Acute pancreatitis - BISAP score, fluid resuscitation", "Cirrhosis complications - SBP, hepatorenal syndrome", "IBD management - 5-ASA, steroids, biologics"] },
  { weight: 5, category: "Biostatistics and Epidemiology", topics: ["Clinical trial interpretation - intention-to-treat, NNT, ARR", "Screening principles - lead time bias, length bias", "Diagnostic test characteristics - LR+, LR-, pre-test probability"] }
];

// USMLE STEP 3 BLUEPRINT
const USMLE_STEP3_BLUEPRINT = [
  { weight: 13, category: "Biostatistics and Population Health", topics: ["Evidence-based medicine - meta-analysis, systematic review interpretation", "Screening test statistics - sensitivity, specificity, predictive values", "Clinical decision making - pre-test probability, Bayes theorem", "Study design selection - RCT vs observational, bias", "Absolute vs relative risk reduction - NNT calculation", "Quality improvement - PDSA cycle"] },
  { weight: 11, category: "Cardiovascular System", topics: ["Outpatient heart failure management - GDMT titration, LVEF monitoring", "Secondary prevention post-MI - aspirin, statin, beta-blocker, ACEi", "Hypertension management - drug selection by comorbidity", "Atrial fibrillation - long-term anticoagulation, rate vs rhythm strategy", "Peripheral vascular disease - ABI, claudication, revascularization"] },
  { weight: 10, category: "Nervous System and Special Senses", topics: ["Outpatient stroke follow-up - secondary prevention", "Epilepsy management - drug selection by seizure type, driving restrictions", "Parkinson disease - motor fluctuations, non-motor features", "Dementia - Alzheimer's vs vascular vs Lewy body", "Headache management - migraine prophylaxis"] },
  { weight: 9, category: "Communication and Ethics", topics: ["Informed consent - decision-making capacity, surrogate decision makers", "Advance care planning - DNR, POLST, goals of care conversations", "Breaking bad news - SPIKES protocol", "Medical errors - disclosure, apology, root cause analysis", "End-of-life care - palliative vs hospice, symptom management"] },
  { weight: 9, category: "Respiratory System", topics: ["COPD - LABA/LAMA combinations, roflumilast, oxygen therapy criteria", "Asthma - step-up therapy, biologics (dupilumab, omalizumab)", "Obstructive sleep apnea - CPAP adherence, cardiovascular consequences", "Idiopathic pulmonary fibrosis - antifibrotic therapy, lung transplant criteria"] },
  { weight: 8, category: "Immune, Blood and Multisystem", topics: ["HIV - opportunistic infection prophylaxis thresholds, ART regimens", "Autoimmune disease flares - lupus, RA, vasculitis", "Coagulation disorders - long-term anticoagulation decisions", "Lymphoma - maintenance therapy, surveillance imaging"] },
  { weight: 7, category: "Pregnancy and Female Reproductive", topics: ["Preconception counseling - folic acid, medication safety", "Antenatal care - screening timeline, glucose challenge test", "Postpartum care - contraception, depression screening", "Abnormal uterine bleeding - PALM-COEIN classification"] },
  { weight: 6, category: "Gastrointestinal System", topics: ["Surveillance colonoscopy - adenoma follow-up intervals", "Hepatitis C - DAA therapy, cirrhosis surveillance", "Cirrhosis - HCC surveillance, SBP prophylaxis", "IBD - maintenance therapy, dysplasia surveillance"] },
  { weight: 6, category: "Renal and Urinary", topics: ["CKD management - BP targets, RAAS blockade, SGLT2i in CKD", "BPH - alpha-blockers, 5-alpha reductase inhibitors", "Nephrolithiasis - metabolic workup, dietary modifications"] },
  { weight: 6, category: "Behavioral Health", topics: ["Outpatient depression management - augmentation strategies", "Anxiety disorders - CBT, medication management, benzodiazepine risks", "Substance use - motivational interviewing, medication-assisted treatment", "ADHD in adults - stimulant therapy, non-stimulant alternatives"] },
  { weight: 5, category: "Musculoskeletal System", topics: ["Osteoarthritis - non-pharmacologic, NSAID risks, intra-articular injections", "RA monitoring - DAS28, methotrexate toxicity screening", "Gout prophylaxis - allopurinol titration, febuxostat", "Osteoporosis - DEXA surveillance, medication holidays"] },
  { weight: 5, category: "Endocrine System", topics: ["Diabetes - A1c targets by age/comorbidity, deprescribing in elderly", "Thyroid nodule - long-term surveillance, recurrence after treatment", "Adrenal incidentaloma - follow-up imaging, annual biochemical testing", "Metabolic syndrome - lifestyle intervention, pharmacotherapy"] },
  { weight: 5, category: "Skin and Subcutaneous Tissue", topics: ["Skin cancer surveillance - melanoma follow-up", "Chronic wound management - pressure ulcer staging, debridement", "Psoriasis - biologic selection, monitoring"] }
];

// WEIGHTED RANDOM SELECTION
function weightedRandomCategory(blueprint) {
  const total = blueprint.reduce(function(sum, b) { return sum + b.weight; }, 0);
  let rand = Math.random() * total;
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
  const isRandom = requestedTopic.toLowerCase().includes("random");
  if (!isRandom) {
    return { forcedTopic: requestedTopic };
  }
  if (level.includes("ABIM Endocrinology")) {
    return { blueprintCat: weightedRandomCategory(ABIM_ENDO_BLUEPRINT) };
  }
  if (level.includes("ABIM Internal Medicine")) {
    return { blueprintCat: weightedRandomCategory(ABIM_IM_BLUEPRINT) };
  }
  if (level.includes("Step 1")) {
    return { blueprintCat: weightedRandomCategory(USMLE_STEP1_BLUEPRINT) };
  }
  if (level.includes("Step 2")) {
    return { blueprintCat: weightedRandomCategory(USMLE_STEP2_BLUEPRINT) };
  }
  if (level.includes("Step 3")) {
    return { blueprintCat: weightedRandomCategory(USMLE_STEP3_BLUEPRINT) };
  }
  return { blueprintCat: weightedRandomCategory(ABIM_IM_BLUEPRINT) };
}

// ── IMAGE-BASED TOPIC DETECTION ─────────────────────────────────────────────
// Maps image-heavy clinical topics to verified public Radiopaedia case URLs
var RADIOPAEDIA_CASES = {
  // Pulmonary / CXR
  "Pneumonia": "https://radiopaedia.org/search?q=pneumonia&lang=us",
  "ARDS": "https://radiopaedia.org/search?q=ARDS+acute+respiratory+distress&lang=us",
  "Pleural Effusion": "https://radiopaedia.org/search?q=pleural+effusion&lang=us",
  "Pneumothorax": "https://radiopaedia.org/search?q=pneumothorax&lang=us",
  "Pulmonary Embolism": "https://radiopaedia.org/search?q=pulmonary+embolism+CT&lang=us",
  "Interstitial Lung Disease": "https://radiopaedia.org/search?q=interstitial+lung+disease+HRCT&lang=us",
  "Lung Cancer": "https://radiopaedia.org/search?q=lung+cancer+mass&lang=us",
  "COPD": "https://radiopaedia.org/search?q=COPD+emphysema+chest+xray&lang=us",
  "Sarcoidosis": "https://radiopaedia.org/search?q=sarcoidosis+chest&lang=us",
  // Cardiology
  "Heart Failure": "https://radiopaedia.org/search?q=heart+failure+cardiomegaly&lang=us",
  "Aortic Dissection": "https://radiopaedia.org/search?q=aortic+dissection+CT&lang=us",
  "Pericarditis": "https://radiopaedia.org/search?q=pericarditis+pericardial+effusion&lang=us",
  "Valvular Disease": "https://radiopaedia.org/search?q=aortic+stenosis+valvular&lang=us",
  "Pulmonary Hypertension": "https://radiopaedia.org/search?q=pulmonary+hypertension+xray&lang=us",
  // Neurology
  "Ischemic Stroke": "https://radiopaedia.org/search?q=ischemic+stroke+MRI+DWI&lang=us",
  "Hemorrhagic Stroke": "https://radiopaedia.org/search?q=intracranial+hemorrhage+CT&lang=us",
  "Multiple Sclerosis": "https://radiopaedia.org/search?q=multiple+sclerosis+MRI+lesions&lang=us",
  "Meningitis": "https://radiopaedia.org/search?q=meningitis+MRI+enhancement&lang=us",
  "Subarachnoid Hemorrhage": "https://radiopaedia.org/search?q=subarachnoid+hemorrhage+CT&lang=us",
  // Endocrinology imaging
  "Thyroid Nodule Evaluation": "https://radiopaedia.org/search?q=thyroid+nodule+ultrasound&lang=us",
  "Thyroid Cancer": "https://radiopaedia.org/search?q=thyroid+cancer+papillary+ultrasound&lang=us",
  "Cushing's Syndrome": "https://radiopaedia.org/search?q=adrenal+adenoma+cushing+CT&lang=us",
  "Primary Aldosteronism": "https://radiopaedia.org/search?q=adrenal+adenoma+CT+aldosteronoma&lang=us",
  "Pheochromocytoma": "https://radiopaedia.org/search?q=pheochromocytoma+adrenal+MRI&lang=us",
  "Acromegaly": "https://radiopaedia.org/search?q=pituitary+macroadenoma+acromegaly+MRI&lang=us",
  "Prolactinoma": "https://radiopaedia.org/search?q=prolactinoma+pituitary+MRI&lang=us",
  "Diabetes Insipidus": "https://radiopaedia.org/search?q=diabetes+insipidus+pituitary+MRI&lang=us",
  "Osteoporosis": "https://radiopaedia.org/search?q=osteoporosis+compression+fracture+DXA&lang=us",
  "Hyperparathyroidism": "https://radiopaedia.org/search?q=hyperparathyroidism+sestamibi+scan&lang=us",
  "Paget's Disease": "https://radiopaedia.org/search?q=paget+disease+bone+xray&lang=us",
  "Adrenal Insufficiency": "https://radiopaedia.org/search?q=adrenal+atrophy+CT+addison&lang=us",
  "Cushing's Disease": "https://radiopaedia.org/search?q=pituitary+adenoma+cushing+MRI&lang=us",
  "Pituitary Apoplexy": "https://radiopaedia.org/search?q=pituitary+apoplexy+MRI+hemorrhage&lang=us",
  "Hypopituitarism": "https://radiopaedia.org/search?q=empty+sella+pituitary+MRI&lang=us",
  // Abdominal / GI
  "Cirrhosis": "https://radiopaedia.org/search?q=cirrhosis+liver+CT+nodular&lang=us",
  "Acute Pancreatitis": "https://radiopaedia.org/search?q=acute+pancreatitis+CT+necrosis&lang=us",
  "NAFLD/NASH": "https://radiopaedia.org/search?q=hepatic+steatosis+fatty+liver+CT&lang=us",
  // Renal
  "Nephrolithiasis": "https://radiopaedia.org/search?q=kidney+stones+CT+urogram&lang=us",
  "Glomerulonephritis": "https://radiopaedia.org/search?q=glomerulonephritis+kidney+ultrasound&lang=us",
  // Musculoskeletal / Rheumatology
  "Rheumatoid Arthritis": "https://radiopaedia.org/search?q=rheumatoid+arthritis+joint+xray&lang=us",
  "Ankylosing Spondylitis": "https://radiopaedia.org/search?q=ankylosing+spondylitis+sacroiliac+MRI&lang=us",
  "Gout": "https://radiopaedia.org/search?q=gout+tophus+joint+xray&lang=us",
  "Osteoarthritis": "https://radiopaedia.org/search?q=osteoarthritis+joint+space+narrowing&lang=us",
  // Pulmonary Function Tests
  "Pulmonary Function Tests": "https://radiopaedia.org/search?q=pulmonary+function+test+spirometry+obstructive+restrictive&lang=us",
  "Asthma & COPD": "https://radiopaedia.org/search?q=spirometry+FEV1+FVC+obstructive+pattern&lang=us",
  "Restrictive Lung Disease": "https://radiopaedia.org/search?q=restrictive+lung+disease+pulmonary+function+test&lang=us",
  "Obstructive Lung Disease": "https://radiopaedia.org/search?q=obstructive+spirometry+FEV1+reduced&lang=us",
  "Sleep Apnea": "https://radiopaedia.org/search?q=obstructive+sleep+apnea+polysomnography&lang=us",
  "Pleural Disease": "https://radiopaedia.org/search?q=pleural+disease+mesothelioma+CT&lang=us",
  // ECG / Cardiology
  "ACS": "https://radiopaedia.org/search?q=ST+elevation+myocardial+infarction+ECG&lang=us",
  "ACS — STEMI/NSTEMI": "https://radiopaedia.org/search?q=STEMI+ECG+ST+elevation&lang=us",
  "Atrial Fibrillation": "https://radiopaedia.org/search?q=atrial+fibrillation+ECG+irregularly+irregular&lang=us",
  "Heart Blocks": "https://radiopaedia.org/search?q=heart+block+ECG+PR+interval&lang=us",
  "Hypertension": "https://radiopaedia.org/search?q=hypertensive+heart+disease+LVH+echocardiogram&lang=us",
  "Lipid Disorders": "https://radiopaedia.org/search?q=xanthoma+xanthelasma+familial+hypercholesterolemia&lang=us",
  "Infective Endocarditis": "https://radiopaedia.org/search?q=endocarditis+echocardiogram+vegetation&lang=us",
  "Pericardial Effusion": "https://radiopaedia.org/search?q=pericardial+effusion+tamponade+echo&lang=us",
  // Nuclear Medicine / Endocrine scans
  "Thyroid in Pregnancy": "https://radiopaedia.org/search?q=thyroid+ultrasound+nodule+pregnancy&lang=us",
  "Subacute Thyroiditis": "https://radiopaedia.org/search?q=thyroiditis+thyroid+scan+uptake&lang=us",
  "Hyperthyroidism & Graves'": "https://radiopaedia.org/search?q=graves+disease+thyroid+scan+diffuse+uptake&lang=us",
  "Hypothyroidism & Hashimoto's": "https://radiopaedia.org/search?q=hashimoto+thyroiditis+ultrasound+heterogeneous&lang=us",
  "Thyroid Storm": "https://radiopaedia.org/search?q=thyroid+storm+imaging+graves&lang=us",
  "MEN1": "https://radiopaedia.org/search?q=MEN1+pituitary+pancreatic+parathyroid+imaging&lang=us",
  "MEN2A & MEN2B": "https://radiopaedia.org/search?q=MEN2+medullary+thyroid+pheochromocytoma+imaging&lang=us",
  "Carcinoid Tumors": "https://radiopaedia.org/search?q=carcinoid+tumor+octreotide+scan+NET&lang=us",
  "Insulinoma": "https://radiopaedia.org/search?q=insulinoma+pancreatic+MRI+CT&lang=us",
  "Gastrinoma": "https://radiopaedia.org/search?q=gastrinoma+pancreatic+CT+Zollinger+Ellison&lang=us",
  // Bone / DXA
  "Vitamin D Deficiency": "https://radiopaedia.org/search?q=rickets+osteomalacia+xray+vitamin+D&lang=us",
  "Hypoparathyroidism": "https://radiopaedia.org/search?q=hypoparathyroidism+basal+ganglia+calcification+CT&lang=us",
  "Hypercalcemia": "https://radiopaedia.org/search?q=hypercalcemia+bone+resorption+xray+PTH&lang=us",
  "Calcium and Bone": "https://radiopaedia.org/search?q=bone+density+DXA+osteoporosis+fracture&lang=us",
  // GI / Hepatology
  "IBD — Crohn's & UC": "https://radiopaedia.org/search?q=Crohn+disease+CT+enterography+bowel&lang=us",
  "GI Bleeding": "https://radiopaedia.org/search?q=GI+bleeding+angiography+nuclear+scan&lang=us",
  "Hepatitis B & C": "https://radiopaedia.org/search?q=liver+cirrhosis+hepatocellular+carcinoma+CT&lang=us",
  // Renal / Urology
  "CKD": "https://radiopaedia.org/search?q=chronic+kidney+disease+small+kidneys+ultrasound&lang=us",
  "Acute Kidney Injury": "https://radiopaedia.org/search?q=acute+kidney+injury+renal+ultrasound&lang=us",
  "Nephrotic Syndrome": "https://radiopaedia.org/search?q=nephrotic+syndrome+kidney+biopsy+imaging&lang=us",
  "Electrolyte Disorders": "https://radiopaedia.org/search?q=hyperkalemia+ECG+peaked+T+waves&lang=us",
  "Acid-Base Disorders": "https://radiopaedia.org/search?q=arterial+blood+gas+interpretation+acid+base&lang=us",
  // Hematology
  "Anemia": "https://radiopaedia.org/search?q=sickle+cell+anemia+bone+xray+avascular+necrosis&lang=us",
  "Sickle Cell Disease": "https://radiopaedia.org/search?q=sickle+cell+disease+avascular+necrosis+MRI&lang=us",
  "Multiple Myeloma": "https://radiopaedia.org/search?q=multiple+myeloma+lytic+lesions+skull+xray&lang=us",
  "Leukemia & Lymphoma": "https://radiopaedia.org/search?q=lymphoma+CT+mediastinal+mass+lymphadenopathy&lang=us",
  "DVT & Anticoagulation": "https://radiopaedia.org/search?q=deep+vein+thrombosis+ultrasound+compression&lang=us",
  "Thrombocytopenia": "https://radiopaedia.org/search?q=thrombocytopenia+splenomegaly+imaging&lang=us",
  // Rheumatology
  "SLE": "https://radiopaedia.org/search?q=lupus+nephritis+joint+imaging+SLE&lang=us",
  "Giant Cell Arteritis": "https://radiopaedia.org/search?q=giant+cell+arteritis+temporal+artery+PET+CT&lang=us",
  "Vasculitis": "https://radiopaedia.org/search?q=vasculitis+angiography+CT+aortitis&lang=us",
  "Gout & Pseudogout": "https://radiopaedia.org/search?q=gout+tophi+joint+xray+DECT&lang=us",
  // Neurology
  "Seizures & Epilepsy": "https://radiopaedia.org/search?q=epilepsy+MRI+temporal+lobe+sclerosis&lang=us",
  "Parkinson's Disease": "https://radiopaedia.org/search?q=parkinson+disease+DAT+scan+dopamine&lang=us",
  "Headache": "https://radiopaedia.org/search?q=migraine+MRI+white+matter+lesions&lang=us",
  // Infectious Disease
  "Sepsis & Septic Shock": "https://radiopaedia.org/search?q=sepsis+source+CT+abscess+empyema&lang=us",
  "HIV": "https://radiopaedia.org/search?q=HIV+AIDS+opportunistic+infection+CT+PCP&lang=us",
  "Tuberculosis": "https://radiopaedia.org/search?q=tuberculosis+chest+xray+cavitation+upper+lobe&lang=us",
  // Reproductive / PCOS
  "PCOS": "https://radiopaedia.org/search?q=polycystic+ovary+syndrome+ultrasound+necklace&lang=us",
  "Male Hypogonadism": "https://radiopaedia.org/search?q=testicular+ultrasound+hypogonadism&lang=us",
  // Dermatology
  "Melanoma": "https://radiopaedia.org/search?q=melanoma+dermoscopy+CT+staging&lang=us",
};

// Keywords that flag a topic as image-based
var IMAGE_KEYWORDS = [
  // Radiology modalities
  "nodule", "mass", "lesion", "imaging", "radiograph", "x-ray", "xray",
  "ct scan", "ct ", "mri", "ultrasound", "echo", "echocardiogram",
  "nuclear", "scan", "pet", "scintigraphy", "sestamibi", "octreotide",
  "angiography", "fluoroscopy", "biopsy",
  // Pulmonary function
  "spirometry", "pulmonary function", "fev1", "fvc", "dlco",
  "flow volume", "peak flow", "bronchoprovocation", "methacholine",
  "polysomnography", "sleep study",
  // ECG / cardiac
  "ecg", "ekg", "electrocardiogram", "st elevation", "st depression",
  "pr interval", "qt interval", "t wave", "arrhythmia", "holter",
  // Endocrine specific
  "thyroid nodule", "thyroid scan", "uptake", "adrenal", "pituitary",
  "dxa", "bone density", "dexa", "sestamibi", "parathyroid scan",
  // Pathology
  "bone", "fracture", "pneumonia", "effusion", "pneumothorax",
  "stroke", "hemorrhage", "pericarditis", "dissection", "sarcoidosis",
  "ild", "ipf", "cancer", "tumor", "carcinoma", "lymphoma",
  "pancreatitis", "cirrhosis", "osteoporosis", "paget",
  "hyperparathyroidism", "acromegaly", "prolactinoma", "cushing",
  "pheochromocytoma", "aldosteronism", "dvt", "thrombosis",
  "anemia", "myeloma", "lymphadenopathy", "abscess", "empyema",
  "cavitation", "fibrosis", "consolidation", "atelectasis",
  "cardiomegaly", "pleural", "pericardial", "aortic",
];

function getRadiopaediaLink(topic) {
  // Normalize - remove apostrophes and hyphens for matching
  var topicNorm = topic.toLowerCase().replace(/['\-]/g, " ").replace(/\s+/g, " ");
  // Check direct match first
  for (var key in RADIOPAEDIA_CASES) {
    var keyNorm = key.toLowerCase().replace(/['\-]/g, " ").replace(/\s+/g, " ");
    if (topicNorm.includes(keyNorm) || keyNorm.includes(topicNorm.split(" ")[0])) {
      return RADIOPAEDIA_CASES[key];
    }
  }
  // Check image keywords
  var topicLower = topic.toLowerCase();
  for (var i = 0; i < IMAGE_KEYWORDS.length; i++) {
    if (topicLower.includes(IMAGE_KEYWORDS[i])) {
      return "https://radiopaedia.org/search?q=" + encodeURIComponent(topic.replace(/[&]/g, "and").split(" ").slice(0,4).join("+")) + "&lang=us";
    }
  }
  return null;
}

function buildPrompt(level, requestedTopic) {
  var result = getBlueprintCategory(level, requestedTopic);
  var specificTopic, topicInstruction;

  if (result.forcedTopic) {
    specificTopic = result.forcedTopic;
    topicInstruction = "Topic: " + specificTopic;
  } else {
    var cat = result.blueprintCat;
    specificTopic = pickRandom(cat.topics).split(' - ')[0].split(' — ')[0];
    topicInstruction = "Topic: " + specificTopic + " (" + cat.category + " - " + cat.weight + "% of " + level + ")";
  }

  var radiopaediaLink = getRadiopaediaLink(specificTopic);

  var levelNote = "";
  if (level.includes("Step 1")) {
    levelNote = "Focus on basic science mechanisms, pathophysiology, and pharmacology. Frame the vignette to test WHY a process occurs (e.g., the underlying cellular pathways or receptor-level mechanisms), not just WHAT it is. Test understanding of convergent pathways across systems.";
  } else if (level.includes("Step 2")) {
    levelNote = "Focus on clinical decision-making. Require the learner to differentiate between closely related conditions using subtle clues in the physical exam or lab panels before choosing the next best step. Avoid obvious presentations -- use realistic, complex clinical scenarios.";
  } else if (level.includes("Step 3")) {
    levelNote = "Focus on outpatient management, chronic disease progression, and high-value preventive care. Emphasize complex multi-system patient presentations and transitions of care. Test population health and chronic disease management decisions.";
  } else if (level.includes("ABIM Internal Medicine")) {
    levelNote = "Diagnosis and management must adhere strictly to ACC/AHA, ADA, IDSA, ACR, and KDIGO guidelines. Test the specific thresholds and contraindications that separate a competent resident from a master clinician. Include scenarios where subtle lab findings (e.g., borderline AKI, mild hyperkalemia) change the management decision.";
  } else if (level.includes("ABIM Endocrinology")) {
    levelNote = "This is for advanced Endocrinology Fellows. Require highly nuanced distinctions per ADA 2025, Endocrine Society, and AACE guidelines. Where relevant, integrate advanced metabolic concepts such as the converging pathways of insulin resistance, diabetes, and atherosclerosis (metabolic vasculopathy), or the impact of the gut microbiome on incretin-based pharmacotherapy. Challenge them as if they are on clinical rounds with an academic program director. Test synthesis and clinical judgment, not memorization.";
  }

  // Hard clinical accuracy rules - society mapping per specialty
  var societyMap = "";
  var topicLower = specificTopic.toLowerCase();

  // Endocrinology
  if (topicLower.includes("thyroid") || topicLower.includes("hashimoto") || topicLower.includes("graves") || topicLower.includes("hypothyroid") || topicLower.includes("hyperthyroid") || topicLower.includes("thyroiditis")) {
    societyMap = "Cite ONLY the American Thyroid Association (ATA) and/or Endocrine Society for thyroid disorders. NEVER cite ADA for thyroid management.";
  } else if (topicLower.includes("diabetes") || topicLower.includes("insulin") || topicLower.includes("cgm") || topicLower.includes("glucose") || topicLower.includes("dka") || topicLower.includes("hhs") || topicLower.includes("hypoglycemi") || topicLower.includes("gestational") || topicLower.includes("sglt2") || topicLower.includes("glp-1") || topicLower.includes("metformin")) {
    societyMap = "Cite ADA 2025 Standards of Care and/or AACE for diabetes management. The ADA is the primary authority for all diabetes pharmacotherapy decisions.";
  } else if (topicLower.includes("osteoporosis") || topicLower.includes("bone density") || topicLower.includes("fracture") || topicLower.includes("bisphosphonat") || topicLower.includes("denosumab") || topicLower.includes("calcium") || topicLower.includes("vitamin d") || topicLower.includes("parathyroid") || topicLower.includes("paget")) {
    societyMap = "Cite Endocrine Society and/or National Osteoporosis Foundation (NOF/BHOF) for bone and calcium disorders. For hyperparathyroidism cite the Fourth International Workshop guidelines.";
  } else if (topicLower.includes("adrenal") || topicLower.includes("cushing") || topicLower.includes("aldosteronism") || topicLower.includes("pheochromocytoma") || topicLower.includes("adrenal insufficiency") || topicLower.includes("congenital adrenal")) {
    societyMap = "Cite Endocrine Society Clinical Practice Guidelines for adrenal disorders. For primary aldosteronism cite the 2016 Endocrine Society PA guidelines.";
  } else if (topicLower.includes("pituitary") || topicLower.includes("acromegaly") || topicLower.includes("prolactinoma") || topicLower.includes("hypopituitar") || topicLower.includes("diabetes insipidus") || topicLower.includes("pituitary apoplexy")) {
    societyMap = "Cite Endocrine Society Clinical Practice Guidelines for pituitary disorders. For acromegaly cite the 2014 Endocrine Society acromegaly guidelines (updated 2024).";
  } else if (topicLower.includes("pcos") || topicLower.includes("polycystic") || topicLower.includes("hypogonadism") || topicLower.includes("testosterone") || topicLower.includes("menopause") || topicLower.includes("hrt") || topicLower.includes("hormone replacement")) {
    societyMap = "Cite Endocrine Society and/or AACE for reproductive endocrinology. For menopause cite The Menopause Society (formerly NAMS) guidelines.";
  } else if (topicLower.includes("obesity") || topicLower.includes("weight loss") || topicLower.includes("bariatric") || topicLower.includes("tirzepatide") || topicLower.includes("semaglutide")) {
    societyMap = "Cite Obesity Society (TOS), AACE, and/or ADA guidelines for obesity management. For GLP-1/GIP agonists in obesity cite the Endocrine Society obesity guidelines.";

  // Cardiology
  } else if (topicLower.includes("heart failure") || topicLower.includes("hfref") || topicLower.includes("hfpef") || topicLower.includes("cardiomyopathy")) {
    societyMap = "Cite ACC/AHA 2022 Heart Failure Guidelines and/or ESC 2021 Heart Failure Guidelines.";
  } else if (topicLower.includes("acs") || topicLower.includes("stemi") || topicLower.includes("nstemi") || topicLower.includes("unstable angina") || topicLower.includes("myocardial infarction")) {
    societyMap = "Cite ACC/AHA ACS guidelines and ESC NSTE-ACS/STEMI guidelines. For antithrombotic therapy cite ACC/AHA/ACCP guidelines.";
  } else if (topicLower.includes("atrial fibrillation") || topicLower.includes("afib") || topicLower.includes("flutter")) {
    societyMap = "Cite 2023 ACC/AHA/ACCP/HRS Atrial Fibrillation Guidelines. For anticoagulation cite CHA2DS2-VASc scoring per these guidelines.";
  } else if (topicLower.includes("hypertension")) {
    societyMap = "Cite 2017 ACC/AHA Hypertension Guidelines (BP target <130/80 for most adults) and/or JNC 8 for specific populations.";
  } else if (topicLower.includes("lipid") || topicLower.includes("cholesterol") || topicLower.includes("statin") || topicLower.includes("dyslipidemia")) {
    societyMap = "Cite 2018 ACC/AHA Cholesterol Guidelines and/or AACE/ACE Dyslipidemia Guidelines. LDL targets vary by risk category.";
  } else if (topicLower.includes("valvular") || topicLower.includes("aortic stenosis") || topicLower.includes("mitral") || topicLower.includes("endocarditis")) {
    societyMap = "Cite 2021 ACC/AHA Valvular Heart Disease Guidelines. For endocarditis cite AHA/IDSA infective endocarditis guidelines.";
  } else if (topicLower.includes("pulmonary embolism") || topicLower.includes("dvt") || topicLower.includes("venous thromboembolism") || topicLower.includes("anticoagul")) {
    societyMap = "Cite ACCP/ASH VTE guidelines and/or ESC PE guidelines. For DOAC selection cite ACC/AHA guidance.";

  // Pulmonology
  } else if (topicLower.includes("copd") || topicLower.includes("emphysema") || topicLower.includes("chronic obstructive")) {
    societyMap = "Cite GOLD (Global Initiative for Chronic Obstructive Lung Disease) guidelines for COPD staging and management.";
  } else if (topicLower.includes("asthma")) {
    societyMap = "Cite GINA (Global Initiative for Asthma) guidelines and/or NAEPP EPR-4 for asthma step therapy.";
  } else if (topicLower.includes("pneumonia") || topicLower.includes("community acquired") || topicLower.includes("hospital acquired") || topicLower.includes("ventilator associated")) {
    societyMap = "Cite IDSA/ATS 2019 Community-Acquired Pneumonia Guidelines. For HAP/VAP cite 2016 IDSA/ATS guidelines.";
  } else if (topicLower.includes("interstitial lung") || topicLower.includes("ipf") || topicLower.includes("sarcoidosis") || topicLower.includes("pulmonary fibrosis")) {
    societyMap = "Cite ATS/ERS/JRS/ALAT IPF guidelines. For sarcoidosis cite ATS/ERS/WASOG statement.";
  } else if (topicLower.includes("pulmonary hypertension")) {
    societyMap = "Cite ESC/ERS 2022 Pulmonary Hypertension Guidelines and WHO PH classification.";
  } else if (topicLower.includes("sleep apnea") || topicLower.includes("obstructive sleep")) {
    societyMap = "Cite AASM (American Academy of Sleep Medicine) clinical practice guidelines for OSA diagnosis and management.";
  } else if (topicLower.includes("ards") || topicLower.includes("acute respiratory distress")) {
    societyMap = "Cite Berlin Definition of ARDS and ATS/ESICM guidelines for lung-protective ventilation.";

  // Nephrology
  } else if (topicLower.includes("kidney") || topicLower.includes("renal") || topicLower.includes("ckd") || topicLower.includes("aki") || topicLower.includes("glomerulo") || topicLower.includes("nephrotic") || topicLower.includes("nephritic")) {
    societyMap = "Cite KDIGO (Kidney Disease Improving Global Outcomes) guidelines. For AKI cite KDIGO 2012 AKI guidelines. For CKD cite KDIGO 2024 CKD guidelines.";
  } else if (topicLower.includes("electrolyte") || topicLower.includes("hyponatremia") || topicLower.includes("hyperkalemia") || topicLower.includes("hypokalemia") || topicLower.includes("acid-base") || topicLower.includes("acidosis") || topicLower.includes("alkalosis")) {
    societyMap = "Cite KDIGO guidelines and/or published expert consensus for electrolyte and acid-base disorders management.";

  // Gastroenterology and Hepatology
  } else if (topicLower.includes("ibd") || topicLower.includes("crohn") || topicLower.includes("ulcerative colitis") || topicLower.includes("inflammatory bowel")) {
    societyMap = "Cite ACG (American College of Gastroenterology) and/or AGA (American Gastroenterological Association) IBD guidelines.";
  } else if (topicLower.includes("cirrhosis") || topicLower.includes("hepatitis") || topicLower.includes("liver") || topicLower.includes("nafld") || topicLower.includes("nash") || topicLower.includes("masld")) {
    societyMap = "Cite AASLD (American Association for the Study of Liver Diseases) guidelines. For MASLD/NASH cite AASLD/EASL/APASL guidelines.";
  } else if (topicLower.includes("pancreatitis")) {
    societyMap = "Cite ACG Clinical Guideline for Acute Pancreatitis. Severity classified per Revised Atlanta Classification.";
  } else if (topicLower.includes("gi bleeding") || topicLower.includes("gastrointestinal bleeding") || topicLower.includes("peptic ulcer") || topicLower.includes("h. pylori")) {
    societyMap = "Cite ACG and/or ASGE guidelines for GI bleeding management. For H. pylori cite ACG H. pylori guidelines.";

  // Rheumatology
  } else if (topicLower.includes("rheumatoid arthritis")) {
    societyMap = "Cite ACR (American College of Rheumatology) 2021 Rheumatoid Arthritis Treatment Guidelines. Treat-to-target approach per ACR/EULAR recommendations.";
  } else if (topicLower.includes("sle") || topicLower.includes("lupus")) {
    societyMap = "Cite ACR 2019 SLE Classification Criteria and EULAR/ACR recommendations for SLE management.";
  } else if (topicLower.includes("gout") || topicLower.includes("pseudogout") || topicLower.includes("uric acid")) {
    societyMap = "Cite ACR 2020 Gout Management Guidelines. ULT target uric acid <6 mg/dL (or <5 mg/dL in tophaceous gout).";
  } else if (topicLower.includes("giant cell arteritis") || topicLower.includes("polymyalgia") || topicLower.includes("vasculitis")) {
    societyMap = "Cite ACR/EULAR 2022 Giant Cell Arteritis Classification Criteria and ACR vasculitis guidelines.";
  } else if (topicLower.includes("ankylosing") || topicLower.includes("spondyloarthritis") || topicLower.includes("psoriatic arthritis")) {
    societyMap = "Cite ACR/NPF 2018 Psoriatic Arthritis Guidelines and ASAS/EULAR recommendations for axial spondyloarthritis.";
  } else if (topicLower.includes("osteoarthritis")) {
    societyMap = "Cite ACR 2019 Osteoarthritis Management Guidelines and OARSI recommendations.";

  // Infectious Disease
  } else if (topicLower.includes("sepsis") || topicLower.includes("septic shock")) {
    societyMap = "Cite Surviving Sepsis Campaign (SSC) 2021 International Guidelines. Sepsis-3 definition: SOFA score increase >=2.";
  } else if (topicLower.includes("hiv") || topicLower.includes("antiretroviral")) {
    societyMap = "Cite DHHS Guidelines for the Use of Antiretroviral Agents in Adults and Adolescents (updated regularly at aidsinfo.nih.gov).";
  } else if (topicLower.includes("tuberculosis") || topicLower.includes("tb ")) {
    societyMap = "Cite ATS/CDC/IDSA 2016 Treatment of Drug-Susceptible Tuberculosis guidelines and CDC TB resources.";
  } else if (topicLower.includes("endocarditis")) {
    societyMap = "Cite 2015 AHA Infective Endocarditis Guidelines and IDSA/ESC endocarditis recommendations.";
  } else if (topicLower.includes("c. difficile") || topicLower.includes("cdiff") || topicLower.includes("clostridioides")) {
    societyMap = "Cite IDSA/SHEA 2021 C. difficile Clinical Practice Guidelines.";
  } else if (topicLower.includes("uti") || topicLower.includes("urinary tract infection")) {
    societyMap = "Cite IDSA guidelines for uncomplicated and complicated UTI management.";
  } else if (topicLower.includes("covid") || topicLower.includes("sars-cov")) {
    societyMap = "Cite NIH COVID-19 Treatment Guidelines (covid19treatmentguidelines.nih.gov) and IDSA COVID-19 guidelines.";

  // Hematology and Oncology
  } else if (topicLower.includes("anemia") || topicLower.includes("iron deficiency") || topicLower.includes("b12") || topicLower.includes("folate") || topicLower.includes("hemolytic")) {
    societyMap = "Cite ASH (American Society of Hematology) guidelines for anemia management and transfusion thresholds.";
  } else if (topicLower.includes("anticoagulat") || topicLower.includes("warfarin") || topicLower.includes("doac") || topicLower.includes("heparin") || topicLower.includes("hit")) {
    societyMap = "Cite ACCP/ASH anticoagulation guidelines. For HIT cite ASH 2018 HIT guidelines. For reversal agents cite ACC/AHA guidance.";
  } else if (topicLower.includes("myeloma") || topicLower.includes("lymphoma") || topicLower.includes("leukemia")) {
    societyMap = "Cite NCCN (National Comprehensive Cancer Network) Oncology Guidelines for the specific malignancy.";
  } else if (topicLower.includes("sickle cell")) {
    societyMap = "Cite ASH 2020 Sickle Cell Disease Guidelines and NHLBI evidence-based management recommendations.";
  } else if (topicLower.includes("thrombocytopenia") || topicLower.includes("itp") || topicLower.includes("ttp") || topicLower.includes("hit")) {
    societyMap = "Cite ASH guidelines for ITP management and TTP/HIT per respective ASH guidelines.";

  // Neurology
  } else if (topicLower.includes("stroke") || topicLower.includes("tia") || topicLower.includes("cerebrovascular")) {
    societyMap = "Cite AHA/ASA 2019 Acute Ischemic Stroke Guidelines and 2021 TIA/stroke prevention guidelines.";
  } else if (topicLower.includes("seizure") || topicLower.includes("epilepsy")) {
    societyMap = "Cite AES (American Epilepsy Society) and ILAE guidelines for seizure and epilepsy management.";
  } else if (topicLower.includes("multiple sclerosis")) {
    societyMap = "Cite AAN (American Academy of Neurology) Practice Guidelines for Multiple Sclerosis disease-modifying therapy.";
  } else if (topicLower.includes("parkinson") || topicLower.includes("parkinsonism")) {
    societyMap = "Cite AAN Practice Guidelines for Parkinson Disease and MDS (Movement Disorder Society) recommendations.";
  } else if (topicLower.includes("dementia") || topicLower.includes("alzheimer")) {
    societyMap = "Cite AAN Practice Guidelines for dementia and Alzheimer disease. For new anti-amyloid therapies cite FDA approval criteria and AAN guidance.";
  } else if (topicLower.includes("headache") || topicLower.includes("migraine")) {
    societyMap = "Cite AHS (American Headache Society) and AAN guidelines for migraine acute and preventive treatment.";

  // Preventive Medicine and Ethics
  } else if (topicLower.includes("screening") || topicLower.includes("preventive") || topicLower.includes("uspstf") || topicLower.includes("cancer screening")) {
    societyMap = "Cite USPSTF recommendations as the primary authority for preventive care and cancer screening intervals.";
  } else if (topicLower.includes("biostatistics") || topicLower.includes("sensitivity") || topicLower.includes("specificity") || topicLower.includes("nnt") || topicLower.includes("likelihood ratio")) {
    societyMap = "Use standard biostatistics definitions. Sensitivity = TP/(TP+FN). Specificity = TN/(TN+FP). PPV and NPV depend on prevalence.";
  } else if (topicLower.includes("ethics") || topicLower.includes("informed consent") || topicLower.includes("advance directive") || topicLower.includes("capacity")) {
    societyMap = "Cite AMA Code of Medical Ethics and standard bioethics principles (autonomy, beneficence, non-maleficence, justice) per Beauchamp and Childress.";
  } else {
    societyMap = "Cite the most relevant and current specialty society guidelines for this topic.";
  }

  var hardRules = "CLINICAL ACCURACY RULES (MANDATORY):\n" +
    "1. NEVER use the word 'pathognomonic' for ultrasound or imaging findings. Use 'highly characteristic' or 'consistent with' instead.\n" +
    "2. NEVER cite the ADA for non-diabetes conditions such as thyroid, adrenal, pituitary, or bone disorders.\n" +
    "3. Levothyroxine dosing must follow current ATA/Endocrine Society guidelines exactly as published. Do not fabricate doses or titration schedules.\n" +
    "4. 'Start low and go slow' for levothyroxine applies ONLY to elderly patients (>65) or those with coronary artery disease per ATA guidelines.\n" +
    "6. Always cite the correct society for each topic. " + (societyMap || "Cite the most relevant specialty society.") + "\n" +
    "7. Drug doses, lab thresholds, and guideline citations must be accurate and current. Do not hallucinate guideline recommendations.\n" +
    "DISTRACTOR QUALITY RULE: Distractors must not be random or obviously wrong. Each distractor must represent a common resident or fellow pitfall such as:\n" +
    "   - Premature closure (stopping at the first plausible diagnosis without considering all data)\n" +
    "   - Anchoring bias (fixating on one diagnosis and ignoring contradictory findings)\n" +
    "   - Failure to adjust drug dosing for renal or hepatic impairment\n" +
    "   - Applying the correct drug for the wrong disease subtype\n" +
    "   - Confusing subclinical with overt disease management thresholds\n" +
    "   - Applying a guideline correctly but in the wrong clinical context\n" +
    "   - Choosing a reasonable but outdated or guideline-discordant approach\n" +
    "8. LAB VALUE INTERNAL CONSISTENCY (CRITICAL): All laboratory values in the stem must be internally consistent with the diagnosis being tested. Examples:\n" +
    "   - Overt hypothyroidism requires free T4 BELOW the reference range (e.g., 0.3-0.6 ng/dL), not at the lower limit of normal.\n" +
    "   - Subclinical hypothyroidism has elevated TSH with NORMAL free T4 within reference range.\n" +
    "   - Overt hyperthyroidism requires free T4 ABOVE reference range with suppressed TSH <0.1 mIU/L.\n" +
    "   - Subclinical hyperthyroidism has suppressed TSH with NORMAL free T4.\n" +
    "   - DKA requires glucose typically >250 mg/dL with pH <7.3 and bicarbonate <18 mEq/L.\n" +
    "   - Primary adrenal insufficiency has LOW cortisol with HIGH ACTH. Secondary has LOW cortisol with LOW/normal ACTH.\n" +
    "   - Primary aldosteronism has HIGH aldosterone with LOW renin (ARR >30).\n" +
    "   - Cushing syndrome requires UFC >3x ULN or midnight cortisol >1.8 mcg/dL or failed LDDST (post-dex cortisol >1.8 mcg/dL).\n" +
    "   - NEVER write lab values that contradict the diagnosis in the explanation. The stem data must support the correct answer.\n" +
    "9. If the stem describes a condition as overt (e.g., overt hypothyroidism), the relevant lab value(s) MUST be clearly outside the reference range, not borderline or at the limit of normal.\n" +
    "10. DIAGNOSIS-FIRST RULE: Before writing the stem, decide EXACTLY which condition you are testing. Then generate lab values that unambiguously match that diagnosis:\n" +
    "    - Testing OVERT hypothyroidism: TSH must be >10 mIU/L AND free T4 must be BELOW 0.8 ng/dL (e.g., 0.3-0.6 ng/dL).\n" +
    "    - Testing SUBCLINICAL hypothyroidism: TSH must be 4.5-10 mIU/L AND free T4 must be WITHIN normal range (0.8-1.8 ng/dL).\n" +
    "    - Testing OVERT hyperthyroidism: TSH must be <0.01 mIU/L AND free T4 must be ABOVE 1.8 ng/dL (e.g., 2.8-4.2 ng/dL).\n" +
    "    - Testing SUBCLINICAL hyperthyroidism: TSH must be <0.4 mIU/L AND free T4 must be WITHIN normal range.\n" +
    "    - The explanation MUST match the diagnosis defined by the labs in the stem. NEVER call a patient with normal free T4 an overt case.\n" +
    "    - The lead-in question and correct answer MUST be appropriate for the actual diagnosis defined by the lab values.\n";

  var cgmNote = "";
  if (specificTopic.toLowerCase().includes("cgm") || specificTopic.toLowerCase().includes("aid") || specificTopic.toLowerCase().includes("insulin pump")) {
    cgmNote = " Include CGM metrics: TIR%, TBR%, TAR%, GMI, CV%, mean glucose.";
  }

  var imagingNote = radiopaediaLink
    ? " Describe key imaging findings as a clinician would dictate (e.g. chest X-ray shows right lower lobe consolidation with air bronchograms)."
    : "";

  // JAVASCRIPT-FORCED TASK ROTATION — guarantees varied question types
  // Weighted toward most common ABIM/USMLE task types
  // Level-specific task rotation matching real exam blueprints
  var boardTasks;
  if (level.includes("Step 1")) {
    // Step 1 heavily tests mechanisms and pathophysiology
    boardTasks = [
      "most likely underlying mechanism of this patient's condition",
      "most likely diagnosis",
      "most appropriate diagnostic study",
      "most likely underlying mechanism of this patient's condition",  // weighted higher
      "most likely pathophysiologic explanation for these findings",
      "most likely cause of this patient's presentation",
      "most likely diagnosis",                                          // weighted higher
      "most likely adverse effect of this medication",
    ];
  } else if (level.includes("Step 3")) {
    // Step 3 focuses on outpatient, chronic disease, prevention
    boardTasks = [
      "most appropriate next step in management",
      "most appropriate long-term management strategy",
      "most appropriate preventive recommendation",
      "most appropriate change in management",
      "most appropriate next step in management",    // weighted higher
      "most appropriate monitoring strategy",
      "most likely diagnosis",
      "most appropriate response to the patient",
    ];
  } else {
    // ABIM IM, ABIM Endo, Step 2 - full balanced spectrum
    boardTasks = [
      "most appropriate next step in management",
      "most appropriate initial pharmacotherapy",
      "most likely diagnosis",
      "most appropriate diagnostic study",
      "best long-term monitoring strategy",
      "most appropriate next step in management",       // weighted higher
      "most likely underlying mechanism or etiology",
      "most appropriate initial pharmacotherapy",       // weighted higher
      "most likely diagnosis",                          // weighted higher
      "most appropriate next step in management",       // weighted higher
      "most appropriate response to the patient",
      "most appropriate preventive recommendation",
      "most likely complication of this condition",
      "most appropriate change in management",
      "most likely cause of this patient's presentation",
    ];
  }
  var selectedTask = boardTasks[Math.floor(Math.random() * boardTasks.length)];
  console.log("Selected board task:", selectedTask);

  var stemLine = "STEM: 4-5 sentences. Include patient age, sex, specific symptoms with duration, complete vital signs (BP, HR, RR, Temp, BMI), and 3-4 key laboratory values with exact numbers and units. Include relevant physical exam findings." + imagingNote + cgmNote + " The final sentence MUST be EXACTLY this clinical question: Which of the following is the " + selectedTask + "?";
  var choicesLine = "CHOICES: Exactly 5 (A-E). One correct per current guidelines. Four plausible distractors representing common clinical errors.";
  var explanationLine = "EXPLANATION: 5-6 sentences. (1) State definitively why the correct answer is right, citing the specific guideline by name and year. (2-4) Deconstruct why each wrong answer is incorrect, specifically naming the clinical trap or cognitive error each distractor represents -- for example: anchoring bias, premature closure, failure to adjust for renal impairment, or confusing subclinical with overt disease thresholds. (5) Provide one high-yield clinical pearl that synthesizes the core concept, reflecting the deep insight of an academic endocrinologist or fellowship program director.";
  var jsonLine = "{\"stem\":\"...\",\"choices\":{\"A\":\"...\",\"B\":\"...\",\"C\":\"...\",\"D\":\"...\",\"E\":\"...\"},\"correct\":\"A\",\"explanation\":\"...\",\"topic\":\"" + specificTopic + "\",\"imageUrl\":" + (radiopaediaLink ? "\"" + radiopaediaLink + "\"" : "null") + ",\"showImageButton\":false}";

  var nbmeAbimRules = "NBME/ABIM MCQ QUALITY STANDARDS (MANDATORY):\n" +
    "RANDOMIZATION (CRITICAL -- EVERY QUESTION MUST BE UNIQUE):\n" +
    "- Randomly vary the patient age (20s, 30s, 40s, 50s, 60s, 70s), sex, and race/ethnicity.\n" +
    "- Randomly vary the clinical setting: outpatient clinic, emergency department, inpatient ward, endocrine consult.\n" +
    "- Randomly vary the specific testing point for this topic. For hypothyroidism rotate through:\n" +
    "  * Initial diagnosis and workup\n" +
    "  * Initial pharmacotherapy selection\n" +
    "  * Monitoring and follow-up\n" +
    "  * Management in pregnancy\n" +
    "  * Management in elderly or cardiac patients\n" +
    "  * Subclinical vs overt distinction and management decision\n" +
    "  * Drug interactions affecting levothyroxine absorption\n" +
    "  * Central vs primary hypothyroidism differentiation\n" +
    "- Randomly vary presenting symptoms and chief complaint.\n" +
    "- Randomly vary which lab values are abnormal and by how much.\n" +
    "- NEVER generate a question identical or nearly identical to a previous one on this topic.\n\n" +
    "STEM REQUIREMENTS:\n" +
    "1. Present a clear patient-based clinical vignette with individual patient history, exam findings, vitals, labs, and risk factors.\n" +
    "2. The lead-in must be a single closed-ended question that a competent physician can answer by reading the stem alone WITHOUT looking at the options (cover-the-options rule).\n" +
    "3. Use ONLY positive phrasing. NEVER use negatively worded lead-ins such as 'EXCEPT', 'NOT', or 'all of the following except'.\n" +
    "4. Lead-in must be one of these ABIM-approved task types: most likely diagnosis / most appropriate next step in management / most appropriate pharmacotherapy / most appropriate diagnostic study / mechanism of action / most likely underlying cause / best initial treatment / prognosis / preventive recommendation / most appropriate response to patient.\n" +
    "5. Avoid trivial, obscure, or overly specific details. Test knowledge a physician should know without external references.\n" +
    "6. Prioritize life-threatening or function-threatening conditions and key management decisions.\n" +
    "7. Vignette must simulate authentic clinical practice and reflect conditions seen in real clinical encounters.\n\n" +
    "ANSWER CHOICES REQUIREMENTS:\n" +
    "8. Provide exactly 5 options (A-E). ONE clearly best correct answer. Four plausible, homogeneous distractors.\n" +
    "9. All options must be rank-orderable on a SINGLE dimension (e.g., all diagnoses OR all treatments -- never mix).\n" +
    "10. Distractors must represent common clinical errors or misconceptions that would appear correct to less knowledgeable candidates but NOT to experts.\n" +
    "11. All options must have PARALLEL grammatical structure and SIMILAR length. No option should stand out as obviously longer or uniquely phrased.\n" +
    "12. NEVER use vague terms in options such as 'often', 'usually', 'sometimes'. NEVER use absolute terms such as 'always' or 'never'.\n" +
    "13. NEVER use 'none of the above' or 'all of the above' as an option.\n" +
    "14. Avoid word repetition between the stem and the correct answer (clang clues that cue test-wise examinees).\n" +
    "15. The correct answer must be ABSOLUTELY accurate per current guidelines. It must be defensible and not tricky.\n\n" +
    "EXPLANATION REQUIREMENTS:\n" +
    "16. Explain WHY the correct answer is right using specific guideline citation.\n" +
    "17. Explain WHY each wrong answer is incorrect -- describe the specific misconception or error each distractor targets.\n" +
    "18. End with one high-yield board pearl that reflects synthesis and clinical judgment, not mere recall.\n";

    // STATIC CACHED PART - all heavy rules and formatting
  var systemText =
    "You are a rigorous medical board exam question writer.\n\n" +
    hardRules + "\n" +
    nbmeAbimRules;

  var userText =
    "BOARD LEVEL: " + level + ". " + levelNote + "\n\n" +
    topicInstruction + "\n\n" +
    "Write ONE high-quality clinical vignette MCQ.\n" +
    stemLine + "\n" +
    choicesLine + "\n" +
    explanationLine + "\n\n" +
    "Return ONLY valid JSON matching this exact schema (no markdown, no extra text):\n" +
    jsonLine + "\n" +
    "Set showImageButton:true ONLY if the stem explicitly asks the subscriber to interpret a visual image. Default is false.";

  return { systemText: systemText, userText: userText, radiopaediaLink: radiopaediaLink, specificTopic: specificTopic };
}

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

  // Keep-warm ping - return immediately without generating
  if (warmup) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warm: true }) };
  }

  try {
    // Generate random patient demographics to force unique vignettes every time
    var ages = [22, 26, 29, 31, 34, 37, 39, 42, 45, 48, 51, 54, 57, 61, 64, 67, 71, 74, 78];
    var sexes = ["man", "woman", "woman", "man", "woman", "man"];
    var races = ["White", "Black", "Hispanic", "Asian", "Native American", "Middle Eastern", "South Asian", "White", "Black", "Hispanic"];
    var settings = ["outpatient primary care clinic", "endocrinology outpatient clinic", "emergency department", "inpatient medicine ward", "urgent care center", "internal medicine resident clinic", "endocrine subspecialty consult service"];
    var randAge = ages[Math.floor(Math.random() * ages.length)];
    var randSex = sexes[Math.floor(Math.random() * sexes.length)];
    var randRace = races[Math.floor(Math.random() * races.length)];
    var randSetting = settings[Math.floor(Math.random() * settings.length)];
    var patientSeed = "MANDATORY: This patient MUST be a " + randAge + "-year-old " + randRace + " " + randSex + " presenting to a " + randSetting + ". Use exactly these demographics.";

    var promptData = buildPrompt(level, topic);
    var enrichedUserText = patientSeed + "\n\n" + promptData.userText;
    var raw = await callClaude(promptData.systemText, enrichedUserText);

    var cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    // Fallback: extract JSON if Claude added extra text around it
    var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error:", cleaned.substring(0, 300));
      return { statusCode: 500, body: JSON.stringify({ error: "AI returned invalid JSON. Please try again." }) };
    }

    var required = ["stem", "choices", "correct", "explanation", "topic"];
    // imageUrl: use AI value, fallback to Radiopaedia link, then null
    parsed.imageUrl = parsed.imageUrl || promptData.radiopaediaLink || null;
    for (var i = 0; i < required.length; i++) {
      if (!parsed[required[i]]) {
        return { statusCode: 500, body: JSON.stringify({ error: "Missing field: " + required[i] }) };
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([parsed])
    };

  } catch (e) {
    console.error("Error:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate question. Please try again." })
    };
  }
};
