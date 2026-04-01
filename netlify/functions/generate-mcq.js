// No external dependencies - uses Node 22 built-in fetch

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error("Anthropic API error " + response.status + ": " + err);
  }
  const data = await response.json();
  return data.content[0].text;
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
  // Check direct match first
  for (var key in RADIOPAEDIA_CASES) {
    if (topic.toLowerCase().includes(key.toLowerCase())) {
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
    topicInstruction = "The topic is: \"" + specificTopic + "\". Generate a question specifically and rigorously about this topic.";
  } else {
    var cat = result.blueprintCat;
    specificTopic = pickRandom(cat.topics);
    topicInstruction = "The exam category is: \"" + cat.category + "\" (" + cat.weight + "% of the " + level + " exam). The specific subtopic is: \"" + specificTopic + "\". Generate a question directly and rigorously about this subtopic.";
  }

  // Check if this topic warrants an imaging reference
  var radiopaediaLink = getRadiopaediaLink(specificTopic);
  var imagingInstruction = radiopaediaLink
    ? "IMAGING NOTE: This is an image-based topic. In the stem, describe the imaging findings in precise radiological language exactly as a radiologist or clinician would dictate them (e.g., 'A chest X-ray shows a right lower lobe opacity with air bronchograms and blunting of the right costophrenic angle'). At the very end of the stem, add this exact line on a new paragraph: 'View reference imaging: " + radiopaediaLink + "'"
    : "IMAGING NOTE: This topic does not require imaging. Do not include an imaging link.";

  // Level-specific instructions
  var levelNote = "";
  if (level.includes("Step 1")) {
    levelNote = "Focus on BASIC SCIENCE mechanisms — pathophysiology, pharmacology, biochemistry, embryology. Questions must test deep understanding of WHY, not just WHAT. Include molecular and cellular mechanisms where relevant. Distractors must be based on common mechanistic misconceptions.";
  } else if (level.includes("Step 2")) {
    levelNote = "Focus on CLINICAL DECISION MAKING — diagnosis, next best step, management in the acute and outpatient setting. Vignettes must include complete clinical context: age, sex, relevant history, vital signs, physical exam findings, and key laboratory or imaging data. Distractors must represent plausible but incorrect clinical decisions.";
  } else if (level.includes("Step 3")) {
    levelNote = "Focus on MANAGEMENT of established diagnoses, outpatient follow-up, preventive care, biostatistics, medical ethics, and population health. Vignettes must reflect real-world independent physician decision-making including transitions of care and chronic disease management.";
  } else if (level.includes("ABIM Internal Medicine")) {
    levelNote = "Focus on DIAGNOSIS and MANAGEMENT of internal medicine conditions per current ACC/AHA, ADA, IDSA, ACR, KDIGO, and USPSTF guidelines. Include exact guideline thresholds (e.g., LDL targets, BP goals, A1c targets, CrCl cutoffs). Questions must reflect the rigor of actual ABIM board examination.";
  } else if (level.includes("ABIM Endocrinology")) {
    levelNote = "Focus on SUBSPECIALTY-LEVEL ENDOCRINOLOGY per the ABIM Endocrinology Blueprint. Reference ADA 2025 Standards of Care, Endocrine Society Clinical Practice Guidelines, and AACE guidelines. Questions must reflect fellowship-level nuance — e.g., distinguishing Cushing disease from ectopic ACTH, adrenal vein sampling indications, CGM time-in-range interpretation, AID system troubleshooting, bone turnover marker interpretation.";
  }

  // CGM/pump data instruction for relevant topics
  var cgmInstruction = "";
  if (specificTopic.toLowerCase().includes("cgm") ||
      specificTopic.toLowerCase().includes("aid") ||
      specificTopic.toLowerCase().includes("insulin") ||
      specificTopic.toLowerCase().includes("pump") ||
      specificTopic.toLowerCase().includes("glucose")) {
    cgmInstruction = "CGM/PUMP DATA: If this topic involves CGM or insulin pump management, include realistic CGM metrics in the stem: Time in Range 70-180 mg/dL (TIR%), Time Below Range <70 mg/dL (TBR%), Time Above Range >180 mg/dL (TAR%), Glucose Management Indicator (GMI), Coefficient of Variation (CV%), and mean glucose. Present these as the clinician would review them at a patient visit. Example: 'Her 14-day CGM report shows TIR 52%, TBR 11%, TAR 37%, GMI 7.9%, CV 48%, mean glucose 196 mg/dL with recurrent 2-4am hypoglycemia events.' This tests the learner's ability to interpret real-world diabetes technology data.";
  }

  return "You are Dr. Anteneh Zenebe, MD, FACE — Assistant Clinical Professor and Associate Program Director for the Endocrinology, Diabetes and Metabolism Fellowship at Howard University College of Medicine. You are writing a board examination question for " + level + " with the rigor, depth, and educational clarity you bring to your fellowship teaching at Howard University.\n\n" +
    topicInstruction + "\n\n" +
    "EXAM LEVEL INSTRUCTIONS:\n" + levelNote + "\n\n" +
    imagingInstruction + "\n\n" +
    (cgmInstruction ? cgmInstruction + "\n\n" : "") +
    "STEM REQUIREMENTS:\n" +
    "- Write a rich, realistic clinical vignette of 4-6 sentences minimum\n" +
    "- Include: patient age, sex, race/ethnicity when clinically relevant, chief complaint, duration of symptoms, relevant past medical history, current medications, pertinent positives and negatives on review of systems\n" +
    "- Include complete vital signs when relevant (BP, HR, RR, Temp, O2 sat, BMI)\n" +
    "- Include relevant laboratory values with units (e.g., TSH 0.02 mIU/L, Free T4 2.8 ng/dL, Cortisol 1.2 ug/dL post-1mg dexamethasone)\n" +
    "- Include physical exam findings that are diagnostically meaningful\n" +
    "- End with a clear, unambiguous clinical question\n" +
    "- Do NOT reveal the diagnosis or topic in the stem — let the clinical data speak\n\n" +
    "ANSWER CHOICES:\n" +
    "- Provide exactly 5 choices labeled A through E\n" +
    "- All distractors must be clinically plausible — no obviously wrong answers\n" +
    "- Distractors should represent: wrong diagnosis, wrong drug for right diagnosis, right drug at wrong dose/timing, common clinical error, or guideline-inconsistent choice\n" +
    "- Only ONE answer is definitively correct per current guidelines\n\n" +
    "EXPLANATION REQUIREMENTS (your teaching voice as an attending educator):\n" +
    "- Write 6-8 sentences minimum\n" +
    "- Start with WHY the correct answer is right, citing the specific guideline (e.g., 'Per ADA 2025 Standards of Care Section 9...' or 'Per the 2023 Endocrine Society guideline on...')\n" +
    "- Address each wrong answer individually — explain why it is incorrect or less appropriate\n" +
    "- Include the key teaching pearl that a fellow or resident must remember for boards\n" +
    "- If imaging is involved, explain what the imaging findings mean clinically\n" +
    "- If CGM data is involved, explain how to interpret each metric and what clinical action it drives\n" +
    "- Write as you would teach on rounds at Howard University — clear, rigorous, and clinically grounded\n\n" +
    "Return ONLY this JSON with no markdown, no preamble, no extra text:\n" +
    "{\"stem\": \"...\", \"choices\": {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\", \"E\": \"...\"}, \"correct\": \"A\", \"explanation\": \"...\", \"topic\": \"" + specificTopic + "\", \"imageUrl\": " + (radiopaediaLink ? "\"" + radiopaediaLink + "\"" : "null") + "}";
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  var topic, level;
  try {
    var body = JSON.parse(event.body);
    topic = body.topic;
    level = body.level;
    if (!topic || !level) throw new Error("Missing topic or level");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  try {
    var prompt = buildPrompt(level, topic);
    var raw = await callClaude(prompt);

    var cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error:", cleaned);
      return { statusCode: 500, body: JSON.stringify({ error: "AI returned invalid JSON. Please try again." }) };
    }

    var required = ["stem", "choices", "correct", "explanation", "topic"];
    // imageUrl is optional - set to null if missing
    if (!parsed.imageUrl) parsed.imageUrl = null;
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
