const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── ABIM INTERNAL MEDICINE BLUEPRINT ───────────────────────────────────────
const ABIM_IM_BLUEPRINT = [
  { weight: 14, category: "Cardiovascular Disease", topics: ["Coronary artery disease and ACS (STEMI, NSTEMI, UA)", "Heart failure (HFrEF, HFpEF) — diagnosis and management", "Atrial fibrillation and flutter — rate vs rhythm control", "Valvular heart disease (aortic stenosis, mitral regurgitation)", "Hypertension — diagnosis, staging, pharmacotherapy", "Dyslipidemia and statin therapy", "Pulmonary hypertension", "Peripheral artery disease", "Aortic aneurysm and dissection", "Cardiac arrhythmias (SVT, VT, heart blocks)", "Pericarditis and myocarditis", "Infective endocarditis — Duke criteria, management"] },
  { weight: 9, category: "Pulmonary Disease", topics: ["COPD — GOLD staging, pharmacotherapy, exacerbations", "Asthma — step therapy, severe exacerbation management", "Community-acquired pneumonia — severity scoring, antibiotics", "Hospital-acquired and ventilator-associated pneumonia", "Pulmonary embolism — diagnosis, anticoagulation, thrombolysis", "Interstitial lung disease — IPF, sarcoidosis, hypersensitivity pneumonitis", "Obstructive sleep apnea", "Pleural effusion — Light's criteria, transudates vs exudates", "ARDS — Berlin criteria, lung-protective ventilation", "Lung cancer — screening, staging, treatment", "Pneumothorax"] },
  { weight: 9, category: "Endocrinology, Diabetes, and Metabolism", topics: ["Type 2 diabetes — ADA treatment algorithm, GLP-1 RA, SGLT2i", "Type 1 diabetes — insulin regimens, diabetic ketoacidosis", "Hypothyroidism — diagnosis, levothyroxine dosing", "Hyperthyroidism and Graves disease — RAI, thionamides", "Adrenal insufficiency — primary vs secondary, steroid dosing", "Cushing syndrome — diagnosis, dexamethasone suppression test", "Primary aldosteronism — screening, subtype differentiation", "Pheochromocytoma — biochemical diagnosis, perioperative management", "Osteoporosis — FRAX, bisphosphonates, denosumab", "Hypercalcemia — primary hyperparathyroidism, malignancy", "Pituitary adenomas — prolactinoma, acromegaly", "Metabolic syndrome and obesity management"] },
  { weight: 9, category: "Gastroenterology", topics: ["Inflammatory bowel disease — Crohn's vs UC, biologics", "Cirrhosis — Child-Pugh, MELD score, complications", "GI bleeding — upper vs lower, endoscopy timing", "Hepatitis B — serology interpretation, antiviral therapy", "Hepatitis C — DAA therapy, cure rates", "Acute pancreatitis — Ranson criteria, management", "NAFLD and NASH — diagnosis, lifestyle, emerging therapies", "Colorectal cancer — screening, Lynch syndrome", "Peptic ulcer disease — H. pylori eradication", "Celiac disease — serology, gluten-free diet", "Acute liver failure — etiology, management"] },
  { weight: 9, category: "Infectious Disease", topics: ["Sepsis and septic shock — Surviving Sepsis bundle", "HIV — ART initiation, OI prophylaxis, drug interactions", "Tuberculosis — latent vs active, treatment regimens", "Infective endocarditis — organisms, Duke criteria, surgery indications", "Urinary tract infections — uncomplicated, complicated, catheter-associated", "Skin and soft tissue infections — cellulitis, necrotizing fasciitis", "Pneumonia organisms — typical, atypical, aspiration", "C. difficile — diagnosis, fidaxomicin, fecal transplant", "Antibiotic stewardship — beta-lactams, vancomycin, aminoglycosides", "COVID-19 — antivirals, immunomodulators, post-COVID", "Meningitis — empiric antibiotics, LP interpretation"] },
  { weight: 9, category: "Rheumatology and Orthopedics", topics: ["Rheumatoid arthritis — DMARDs, biologics, treat-to-target", "Systemic lupus erythematosus — ACR criteria, organ involvement", "Gout — acute management, urate-lowering therapy targets", "Pseudogout — calcium pyrophosphate deposition", "Giant cell arteritis — ESR, temporal artery biopsy, steroids", "Polymyalgia rheumatica — clinical features, steroid response", "Ankylosing spondylitis — HLA-B27, NSAIDs, anti-TNF", "Systemic sclerosis — limited vs diffuse, ILD, PAH", "Vasculitis — GPA, EGPA, polyarteritis nodosa", "Antiphospholipid syndrome — thrombosis, anticoagulation", "Septic arthritis — joint aspiration, empiric antibiotics"] },
  { weight: 6, category: "Hematology", topics: ["Iron deficiency anemia — diagnosis, IV iron, transfusion thresholds", "B12 and folate deficiency — neurologic manifestations", "Hemolytic anemia — Coombs test, causes, management", "Thrombocytopenia — ITP, TTP, HIT", "Sickle cell disease — vaso-occlusive crisis, hydroxyurea", "DVT and PE — DOAC selection, duration of anticoagulation", "Heparin-induced thrombocytopenia — 4T score, argatroban", "Myelodysplastic syndrome — IPSS-R scoring", "Polycythemia vera — JAK2 mutation, phlebotomy", "Disseminated intravascular coagulation — causes, labs, management"] },
  { weight: 6, category: "Nephrology and Urology", topics: ["Acute kidney injury — KDIGO staging, prerenal vs intrinsic vs postrenal", "CKD — staging, slowing progression, SGLT2i in CKD", "Glomerulonephritis — nephritic vs nephrotic syndrome", "Hyponatremia — SIADH vs hypovolemic, correction rate", "Hyperkalemia — EKG changes, acute management", "Metabolic acidosis — anion gap, delta-delta ratio", "Metabolic alkalosis — causes, chloride-responsive vs resistant", "Nephrotic syndrome — minimal change, membranous, FSGS", "Renal replacement therapy — hemodialysis vs peritoneal", "Nephrolithiasis — stone types, prevention"] },
  { weight: 6, category: "Medical Oncology", topics: ["Lung cancer — NSCLC vs SCLC, targeted therapies, immunotherapy", "Breast cancer — hormone receptor status, HER2, treatment", "Colorectal cancer — staging, FOLFOX, bevacizumab", "Prostate cancer — PSA, Gleason score, ADT", "Lymphoma — Hodgkin vs non-Hodgkin, CHOP, R-CHOP", "Leukemia — AML, CML, CLL, TKI therapy", "Multiple myeloma — CRAB criteria, proteasome inhibitors", "Paraneoplastic syndromes — SIADH, hypercalcemia, Eaton-Lambert", "Oncologic emergencies — SVC syndrome, tumor lysis, spinal cord compression", "Immunotherapy toxicities — checkpoint inhibitor adverse effects"] },
  { weight: 4, category: "Neurology", topics: ["Ischemic stroke — tPA eligibility, thrombectomy window, secondary prevention", "Hemorrhagic stroke — ICH, subarachnoid hemorrhage", "Seizures and epilepsy — first-line AEDs, status epilepticus", "Multiple sclerosis — relapsing-remitting, disease-modifying therapy", "Parkinson disease — dopaminergic therapy, motor fluctuations", "Dementia — Alzheimer's, vascular, Lewy body differentiation", "Headache — migraine prophylaxis, cluster headache", "Myasthenia gravis — Tensilon test, thymectomy", "Guillain-Barré syndrome — IVIG, plasmapheresis", "Meningitis and encephalitis"] },
  { weight: 4, category: "Psychiatry", topics: ["Major depressive disorder — SSRI selection, treatment-resistant depression", "Bipolar disorder — mood stabilizers, lithium toxicity", "Schizophrenia — antipsychotics, metabolic side effects", "Anxiety disorders — GAD, panic disorder, PTSD pharmacotherapy", "Alcohol use disorder — CIWA, thiamine, naltrexone", "Opioid use disorder — buprenorphine, methadone, naloxone", "Delirium — causes, prevention, non-pharmacologic management", "Somatoform and functional disorders"] },
  { weight: 3, category: "Dermatology", topics: ["Cellulitis vs erysipelas — treatment, MRSA coverage", "Psoriasis — topical vs systemic, biologics", "Melanoma — ABCDE criteria, staging, immunotherapy", "Drug hypersensitivity reactions — SJS, TEN, DRESS", "Acne vulgaris — isotretinoin, antibiotic stewardship", "Skin manifestations of systemic disease"] },
  { weight: 3, category: "Obstetrics and Gynecology", topics: ["Preeclampsia — diagnostic criteria, magnesium, delivery timing", "Gestational diabetes — screening, insulin vs metformin", "Ectopic pregnancy — risk factors, methotrexate criteria", "Cervical cancer screening — Pap smear intervals, HPV co-testing", "Menopause and HRT — indications, contraindications", "Polycystic ovary syndrome — diagnosis, metformin, clomiphene"] },
  { weight: 3, category: "Geriatric Syndromes", topics: ["Falls prevention — Beers criteria, polypharmacy", "Delirium in elderly — hyperactive vs hypoactive", "Frailty — assessment, sarcopenia", "Urinary incontinence — stress, urge, overflow types", "Pressure ulcers — staging, prevention", "Dementia management — behavioral symptoms, caregiver support"] },
  { weight: 2, category: "Allergy and Immunology", topics: ["Anaphylaxis — epinephrine dosing, biphasic reactions", "Common variable immunodeficiency — recurrent sinopulmonary infections", "Hereditary angioedema — C1 esterase inhibitor deficiency", "Drug allergy — penicillin cross-reactivity, desensitization", "Allergic rhinitis — step therapy"] },
  { weight: 2, category: "Miscellaneous and High-Value Care", topics: ["Preventive medicine — cancer screening guidelines, USPSTF recommendations", "Biostatistics — sensitivity, specificity, PPV, NPV, NNT", "Medical ethics — informed consent, capacity, advance directives", "Patient safety — medication errors, handoff communication", "Health disparities — social determinants of health"] },
  { weight: 1, category: "Ophthalmology", topics: ["Diabetic retinopathy — screening intervals, anti-VEGF", "Glaucoma — open-angle vs angle-closure", "Giant cell arteritis and anterior ischemic optic neuropathy", "Hypertensive retinopathy"] },
  { weight: 1, category: "Otolaryngology and Dental Medicine", topics: ["Sinusitis — viral vs bacterial, antibiotic indications", "Hearing loss — conductive vs sensorineural", "Obstructive sleep apnea — polysomnography, CPAP"] },
];

// ─── ABIM ENDOCRINOLOGY SUBSPECIALTY BLUEPRINT ──────────────────────────────
const ABIM_ENDO_BLUEPRINT = [
  { weight: 24, category: "Diabetes Mellitus and Hypoglycemia", topics: ["ADA 2025 Standards of Care — glycemic targets, individualization", "Type 2 diabetes pharmacotherapy — GLP-1 RA, SGLT2i, DPP-4i, TZD, sulfonylureas", "Tirzepatide (GIP/GLP-1) — mechanism, weight loss, CV outcomes", "Type 1 diabetes — MDI vs insulin pump, closed-loop AID systems", "CGM — time in range, ambulatory glucose profile interpretation", "Diabetic ketoacidosis — diagnosis, fluids, insulin protocol", "Hyperosmolar hyperglycemic state — key differences from DKA", "Hypoglycemia — unawareness, prevention, glucagon use", "Inpatient glycemic management — basal-bolus insulin", "Microvascular complications — nephropathy (SGLT2i, finerenone), retinopathy, neuropathy", "Macrovascular complications — ASCVD risk reduction, GLP-1 RA and SGLT2i CVOT data", "MODY and LADA — genetic testing, clinical differentiation", "Gestational diabetes — HAPO trial, postpartum screening", "Bariatric surgery — metabolic outcomes, hypoglycemia post-surgery"] },
  { weight: 15, category: "Thyroid Disorders", topics: ["Hypothyroidism — primary vs central, TSH interpretation, levothyroxine dosing", "Hashimoto thyroiditis — TPO antibodies, subclinical hypothyroidism management", "Hyperthyroidism — Graves disease, toxic multinodular goiter, toxic adenoma", "Thyroid storm — Burch-Wartofsky score, PTU vs methimazole, beta-blockade", "Thyroid nodule evaluation — ATA ultrasound risk stratification, FNA indications", "Thyroid cancer — papillary, follicular, medullary, anaplastic — staging, RAI, TSH suppression", "Thyroiditis — subacute (de Quervain), postpartum, silent, Riedel", "Thyroid disease in pregnancy — TSH targets, fetal considerations", "Amiodarone-induced thyroid disease — type 1 vs type 2", "Central hypothyroidism — isolated vs pan-hypopituitarism"] },
  { weight: 15, category: "Calcium and Bone Disorders", topics: ["Hypercalcemia — etiology (PTH vs PTHrP vs vitamin D mediated), acute management", "Primary hyperparathyroidism — surgical criteria (guidelines), pre-op localization", "Hypoparathyroidism — post-surgical, autoimmune, Chvostek and Trousseau signs", "Osteoporosis — DXA interpretation, FRAX, bisphosphonates, denosumab, romosozumab, teriparatide", "Vitamin D deficiency — 25-OH vs 1,25-OH, supplementation protocols", "Paget's disease of bone — ALP, bisphosphonate therapy", "Hypocalcemia — causes, acute IV calcium, chronic management", "FGF23 disorders — X-linked hypophosphatemia, tumor-induced osteomalacia", "Osteogenesis imperfecta", "Malignancy-associated hypercalcemia — PTHrP, osteolytic metastases"] },
  { weight: 12, category: "Lipids, Obesity, and Nutrition", topics: ["Dyslipidemia — ACC/AHA risk calculator, statin intensity, LDL targets by risk category", "PCSK9 inhibitors — evolocumab, alirocumab — indications and CVOT evidence", "Familial hypercholesterolemia — diagnostic criteria, aggressive therapy", "Hypertriglyceridemia — fibrates, omega-3, pancreatitis risk", "Obesity management — BMI classification, GLP-1 RA (semaglutide, tirzepatide) for weight", "Bariatric surgery — types, metabolic outcomes, nutritional deficiencies", "Nutritional deficiencies — B12, thiamine, iron, zinc post-bariatric", "Eating disorders — anorexia nervosa — endocrine complications", "Metabolic syndrome — IDF vs ATP III criteria, treatment"] },
  { weight: 10, category: "Adrenal Disorders", topics: ["Primary adrenal insufficiency (Addison's) — autoimmune, biochemical diagnosis, stress dosing", "Secondary adrenal insufficiency — ACTH stimulation test, glucocorticoid-induced", "Adrenal crisis — recognition, IV hydrocortisone, prevention", "Cushing syndrome — endogenous vs exogenous, UFC, late-night salivary cortisol, LDDST", "Cushing disease vs ectopic ACTH — HDDST, IPSS, bilateral adrenalectomy", "Primary aldosteronism — PAC/PRA ratio, CT, adrenal vein sampling, adrenalectomy vs spironolactone", "Pheochromocytoma — biochemical diagnosis (metanephrines), pre-op alpha then beta-blockade", "Adrenal incidentaloma — imaging characterization, hormonal workup", "Congenital adrenal hyperplasia — 21-hydroxylase deficiency, 17-OHP", "Adrenocortical carcinoma — staging, mitotane"] },
  { weight: 10, category: "Pituitary Disorders", topics: ["Pituitary adenoma classification — micro vs macro, functioning vs nonfunctional", "Prolactinoma — dopamine agonists (cabergoline vs bromocriptine), pregnancy management", "Acromegaly — IGF-1, OGTT GH suppression, somatostatin analogs, pegvisomant", "Cushing disease — ACTH-dependent, petrosal sinus sampling, transsphenoidal surgery", "Central diabetes insipidus — water deprivation test, desmopressin", "SIADH — euvolemic hyponatremia, fluid restriction, vaptans", "Hypopituitarism — panhypopituitarism, replacement priorities (cortisol first)", "Pituitary apoplexy — hemorrhage, visual field defects, emergency management", "TSH-secreting adenoma — rare, elevated T4 with non-suppressed TSH", "Empty sella syndrome"] },
  { weight: 7, category: "Female Reproduction", topics: ["PCOS — Rotterdam criteria, metabolic complications, OCP, metformin, letrozole", "Menopause — FSH, vasomotor symptoms, HRT indications and contraindications", "Premature ovarian insufficiency — etiology, hormone replacement, fertility", "Amenorrhea — primary vs secondary, workup algorithm", "Hyperprolactinemia — differential (drugs, pituitary, hypothyroidism)", "Turner syndrome — 45,X, short stature, cardiac screening, estrogen replacement", "Hypothalamic amenorrhea — functional (athletes, eating disorders)"] },
  { weight: 7, category: "Male Reproduction", topics: ["Male hypogonadism — primary vs secondary, testosterone therapy indications", "Klinefelter syndrome — 47,XXY, testosterone replacement, fertility", "Male infertility — azoospermia, FSH/LH/testosterone interpretation", "Testosterone therapy — formulations, monitoring, contraindications (erythrocytosis, fertility)", "Erectile dysfunction — organic vs psychogenic, PDE5 inhibitors", "Delayed puberty vs constitutional growth delay"] },
];

// ─── USMLE STEP 1 BLUEPRINT ─────────────────────────────────────────────────
const USMLE_STEP1_BLUEPRINT = [
  { weight: 16, category: "Reproductive & Endocrine Systems", topics: ["Hypothalamic-pituitary-gonadal axis — feedback loops", "Menstrual cycle physiology — follicular, ovulation, luteal phase", "Spermatogenesis and testosterone synthesis", "Thyroid hormone synthesis — steps, iodination, coupling", "Adrenal cortex — zona glomerulosa, fasciculata, reticularis hormones", "Insulin and glucagon — fed vs fasted state physiology", "Diabetes mellitus type 1 — autoimmune destruction, HLA-DR3/DR4", "Congenital adrenal hyperplasia — enzyme deficiencies and hormonal consequences", "Amenorrhea — primary vs secondary causes", "Androgen insensitivity syndrome", "5-alpha reductase deficiency", "GnRH, LH, FSH — pulsatility and feedback"] },
  { weight: 13, category: "Behavioral Health & Nervous Systems", topics: ["Sleep stages — NREM vs REM, disorders", "Neurotransmitters — dopamine, serotonin, GABA, glutamate", "Antidepressants — mechanism of SSRIs, SNRIs, TCAs, MAOIs", "Antipsychotics — D2 blockade, EPS, tardive dyskinesia", "Mood stabilizers — lithium mechanism and toxicity", "Opioid pharmacology — mu receptor, tolerance, withdrawal", "Autonomic pharmacology — alpha, beta agonists and antagonists", "CNS tumors — glioblastoma, meningioma, medulloblastoma", "Stroke syndromes — MCA, PCA, PICA territories", "Neurodegenerative diseases — Parkinson, Huntington, ALS pathology"] },
  { weight: 13, category: "Respiratory & Renal/Urinary Systems", topics: ["Pulmonary function tests — obstructive vs restrictive patterns", "Hypoxemia mechanisms — V/Q mismatch, shunt, diffusion impairment", "Acid-base disorders — metabolic vs respiratory, compensation", "Renal tubular physiology — PCT, loop, DCT transport", "Glomerular filtration — GFR determinants, filtration fraction", "Diuretics — mechanism by segment, electrolyte effects", "RAAS — angiotensin II effects, aldosterone", "Nephritic vs nephrotic syndrome — pathologic types", "Renal cell carcinoma — VHL mutation, paraneoplastic features", "Respiratory physiology — dead space, compliance, surfactant"] },
  { weight: 11, category: "Cardiovascular System", topics: ["Cardiac action potential — pacemaker vs ventricular cell", "Frank-Starling law — preload, afterload, contractility", "Antiarrhythmics — Vaughan-Williams classification", "Atherosclerosis — foam cells, fatty streaks, fibrous plaque", "Myocardial infarction — biomarkers, ECG changes by territory", "Congenital heart defects — VSD, ASD, PDA, TOF", "Cardiac drugs — digoxin mechanism and toxicity", "Hypertension — essential vs secondary causes", "Heart failure pathophysiology — neurohormonal activation"] },
  { weight: 10, category: "Blood & Lymphoreticular/Immune Systems", topics: ["Hematopoiesis — cell lineages, growth factors", "Anemia classification — microcytic, normocytic, macrocytic", "Clotting cascade — intrinsic vs extrinsic pathway", "Hypersensitivity reactions — Type I–IV mechanisms and examples", "Immunodeficiencies — B vs T cell, combined", "Lymphoma vs leukemia histopathology", "Complement system — classical vs alternative pathway", "MHC class I vs II — antigen presentation"] },
  { weight: 10, category: "Musculoskeletal, Skin & Subcutaneous Tissue", topics: ["Muscle physiology — sliding filament, neuromuscular junction", "Bone metabolism — osteoblasts vs osteoclasts, RANK-RANKL", "Rheumatoid arthritis pathogenesis — pannus, anti-CCP antibodies", "SLE — ANA, anti-dsDNA, anti-Smith antibodies", "Crystal arthropathies — monosodium urate vs calcium pyrophosphate", "Muscular dystrophies — Duchenne, Becker, dystrophin", "Skin layers and wound healing phases"] },
  { weight: 9, category: "Gastrointestinal System", topics: ["GI hormones — gastrin, secretin, CCK, GIP, motilin", "Liver metabolism — glycolysis, gluconeogenesis, urea cycle", "Bilirubin metabolism — prehepatic, hepatic, posthepatic jaundice", "H. pylori — virulence factors, peptic ulcer disease", "Inflammatory bowel disease pathology — Crohn's vs UC", "Pancreatic enzymes — exocrine function, pancreatitis", "Hepatitis viruses — A, B, C, D, E — transmission, serologies"] },
  { weight: 11, category: "Multisystem Processes & Disorders", topics: ["Neoplasia — oncogenes, tumor suppressors, carcinogens", "Cell injury and death — apoptosis vs necrosis", "Inflammation — acute vs chronic, mediators", "Shock — hypovolemic, distributive, cardiogenic, obstructive", "Sepsis pathophysiology — cytokine cascade", "Coagulation disorders — hemophilia, vWD, DIC"] },
  { weight: 5, category: "Biostatistics & Epidemiology", topics: ["Sensitivity and specificity — ROC curve", "PPV and NPV — prevalence effect", "Bias types — selection, information, confounding", "Study designs — RCT, cohort, case-control, cross-sectional", "Relative risk vs odds ratio", "Number needed to treat and number needed to harm", "Screening test characteristics"] },
  { weight: 8, category: "Social Sciences & Communication", topics: ["Informed consent — capacity, exceptions", "Confidentiality and its limits — mandatory reporting", "Advance directives — living will, healthcare proxy", "Medical ethics — autonomy, beneficence, nonmaleficence, justice", "Cultural competency and health literacy"] },
  { weight: 2, category: "Human Development", topics: ["Embryology — germ layers, organ development", "Teratogens — thalidomide, isotretinoin, alcohol", "Fetal circulation — ductus arteriosus, foramen ovale", "Neonatal physiology — jaundice, respiratory distress syndrome"] },
];

// ─── USMLE STEP 2 CK BLUEPRINT ──────────────────────────────────────────────
const USMLE_STEP2_BLUEPRINT = [
  { weight: 13, category: "Renal, Urinary & Reproductive Systems", topics: ["Acute kidney injury — prerenal vs intrinsic, management", "CKD complications — anemia, hyperkalemia, metabolic acidosis", "Glomerulonephritis — post-strep, IgA nephropathy, MPGN", "Hyponatremia — SIADH, cerebral salt wasting, correction", "UTI — uncomplicated, pyelonephritis, catheter-associated", "Nephrolithiasis — stone types, prevention, lithotripsy", "Prostate cancer — PSA screening, Gleason score", "Cervical cancer screening — Pap smear, colposcopy", "Ovarian cancer — CA-125, BRCA mutation", "Testicular cancer — germ cell vs non-germ cell"] },
  { weight: 12, category: "Cardiovascular System", topics: ["Chest pain evaluation — ACS rule-out, HEART score", "STEMI management — door-to-balloon, thrombolytics", "Heart failure management — GDMT, diuresis, CRT", "Atrial fibrillation — CHA2DS2-VASc score, anticoagulation selection", "Hypertensive urgency vs emergency", "Peripheral artery disease — ABI, revascularization", "Aortic stenosis — valve area, TAVR vs SAVR criteria", "Syncope evaluation — cardiac vs neurally mediated", "Pericardial effusion and tamponade — Beck's triad, pericardiocentesis"] },
  { weight: 13, category: "Legal/Ethical Issues & Patient Safety", topics: ["Informed consent — exceptions, capacity assessment", "Confidentiality breaches — duty to warn, mandatory reporting", "End-of-life care — withdrawal of care, futility", "Medical errors — disclosure, just culture", "Advance directives — DNR, POLST", "Health disparities — implicit bias, structural racism", "Patient safety — SBAR, read-backs, checklists"] },
  { weight: 10, category: "Behavioral Health", topics: ["Suicide risk assessment — Columbia protocol", "Major depression — PHQ-9, SSRI initiation and switching", "Bipolar disorder — mood stabilizer selection, lithium monitoring", "Schizophrenia — positive vs negative symptoms, antipsychotic side effects", "Substance use disorders — CAGE questionnaire, SBIRT", "Eating disorders — refeeding syndrome, medical complications", "PTSD — trauma-focused CBT, prazosin for nightmares", "Delirium vs dementia vs depression — differentiating in clinic"] },
  { weight: 10, category: "Nervous System & Special Senses", topics: ["Stroke — NIHSS, tPA eligibility, mechanical thrombectomy window", "Seizure — first unprovoked seizure workup, AED selection", "Headache — migraine vs tension vs cluster vs secondary causes", "Multiple sclerosis — McDonald criteria, disease-modifying therapies", "Vertigo — BPPV (Dix-Hallpike), central vs peripheral", "Neuropathy — diabetic, B12 deficiency, Guillain-Barré", "Lumbar stenosis and radiculopathy — imaging, surgical criteria"] },
  { weight: 9, category: "Musculoskeletal & Skin", topics: ["Low back pain — red flags, imaging indications", "Knee pain — meniscal tear, ACL injury, osteoarthritis", "Shoulder — rotator cuff tear, frozen shoulder, impingement", "Gout — acute management, allopurinol timing", "Cellulitis — MRSA risk, antibiotic selection", "Melanoma — biopsy technique, sentinel lymph node", "Psoriasis — PASI scoring, biologics for moderate-severe"] },
  { weight: 8, category: "Respiratory System", topics: ["Pneumonia — PORT/PSI score, outpatient vs inpatient antibiotics", "COPD exacerbation — bronchodilators, steroids, antibiotics, NIV", "Asthma exacerbation — SABA, ipratropium, magnesium", "Pulmonary embolism — Wells score, CTPA, anticoagulation", "Pleural effusion — thoracentesis, Light's criteria", "Lung cancer — screening (LDCT), staging, targeted therapy"] },
  { weight: 7, category: "Pregnancy, Childbirth & Puerperium", topics: ["Preeclampsia — BP criteria, proteinuria, management", "Gestational diabetes — GCT, OGTT, insulin vs metformin", "Placenta previa vs abruptio placentae", "Preterm labor — tocolysis, betamethasone", "Postpartum hemorrhage — causes, oxytocin, uterine massage", "Ectopic pregnancy — transvaginal US, beta-hCG, methotrexate criteria", "Group B Strep — screening, intrapartum prophylaxis"] },
  { weight: 7, category: "Endocrine System", topics: ["Diabetes management — A1c targets, insulin adjustment", "Thyroid nodule — ultrasound features, FNA indications", "Adrenal insufficiency — stress dosing, sick day rules", "Cushing syndrome — screening tests, causes", "Hyperthyroidism — Graves vs toxic nodular goiter, treatment options", "Calcium disorders — hypercalcemia workup, hypoparathyroidism management", "Diabetes insipidus — central vs nephrogenic, desmopressin"] },
  { weight: 6, category: "Gastrointestinal System", topics: ["Upper GI bleeding — Rockall score, endoscopy timing", "Lower GI bleeding — diverticular vs AVM vs IBD", "Acute pancreatitis — BISAP score, fluid resuscitation", "Cirrhosis complications — SBP, hepatorenal syndrome, hepatic encephalopathy", "IBD management — 5-ASA, steroids, biologics", "Colorectal cancer screening — colonoscopy intervals"] },
  { weight: 5, category: "Blood & Immune System", topics: ["Transfusion thresholds — symptomatic vs asymptomatic anemia", "Anticoagulation reversal — warfarin, DOAC, heparin", "TTP vs HUS — ADAMTS13, plasma exchange", "Sickle cell — acute chest syndrome, pain crisis management", "Neutropenic fever — empiric antibiotics, G-CSF"] },
  { weight: 5, category: "Biostatistics & Epidemiology", topics: ["Clinical trial interpretation — intention-to-treat, NNT, ARR", "Screening principles — lead time bias, length bias", "Diagnostic test characteristics — LR+, LR-, pre-test probability", "Cohort vs case-control vs RCT — appropriate study design selection"] },
  { weight: 4, category: "Human Development & Immune", topics: ["Pediatric milestones — gross motor, fine motor, language, social", "Childhood vaccinations — schedule, contraindications", "Common variable immunodeficiency vs IgA deficiency", "Neonatal jaundice — physiologic vs pathologic"] },
  { weight: 3, category: "Pregnancy Complications", topics: ["HELLP syndrome — lab findings, management", "Peripartum cardiomyopathy", "Thyroid disease in pregnancy — TSH targets", "Hyperemesis gravidarum"] },
];

// ─── USMLE STEP 3 BLUEPRINT ─────────────────────────────────────────────────
const USMLE_STEP3_BLUEPRINT = [
  { weight: 13, category: "Biostatistics & Population Health", topics: ["Evidence-based medicine — meta-analysis, systematic review interpretation", "Screening test statistics — sensitivity, specificity, predictive values", "Clinical decision making — pre-test probability, Bayes theorem", "Study design selection — RCT vs observational, bias", "Absolute vs relative risk reduction — NNT calculation", "Public health — outbreak investigation, herd immunity", "Quality improvement — PDSA cycle, run charts", "Cost-effectiveness — QALY, incremental cost-effectiveness ratio"] },
  { weight: 11, category: "Cardiovascular System", topics: ["Outpatient heart failure management — GDMT titration, LVEF monitoring", "Ambulatory arrhythmia management — Holter, event monitor, ablation", "Secondary prevention post-MI — aspirin, statin, beta-blocker, ACEi", "Hypertension management — JNC/ACC-AHA targets, drug selection by comorbidity", "Atrial fibrillation — long-term anticoagulation, rate vs rhythm strategy", "Peripheral vascular disease — ABI, claudication, revascularization", "Aortic aneurysm — surveillance intervals, repair thresholds"] },
  { weight: 10, category: "Nervous System & Special Senses", topics: ["Outpatient stroke follow-up — secondary prevention, antiplatelet vs anticoagulation", "Epilepsy management — drug selection by seizure type, driving restrictions", "Parkinson disease — motor fluctuations, non-motor features, device therapy", "Dementia — Alzheimer's vs vascular vs Lewy body — cholinesterase inhibitors", "Headache management — migraine prophylaxis (topiramate, amitriptyline, CGRP mAbs)", "Neuropathic pain — gabapentin, duloxetine, TCAs", "Bell's palsy — steroids, antivirals, eye protection"] },
  { weight: 9, category: "Communication & Ethics", topics: ["Informed consent — decision-making capacity, surrogate decision makers", "Advance care planning — DNR, POLST, goals of care conversations", "Breaking bad news — SPIKES protocol", "Medical errors — disclosure, apology, root cause analysis", "Confidentiality — exceptions, mandatory reporting", "End-of-life care — palliative vs hospice, symptom management", "Professionalism — boundaries, conflicts of interest"] },
  { weight: 9, category: "Respiratory System", topics: ["COPD — LABA/LAMA combinations, roflumilast, oxygen therapy criteria", "Asthma — step-up therapy, biologics (dupilumab, omalizumab)", "Obstructive sleep apnea — CPAP adherence, cardiovascular consequences", "Lung cancer — surveillance post-treatment, targeted therapy toxicities", "Sarcoidosis — staging, steroid indications", "Idiopathic pulmonary fibrosis — antifibrotic therapy, lung transplant criteria"] },
  { weight: 8, category: "Immune, Blood & Multisystem", topics: ["HIV — opportunistic infection prophylaxis thresholds, ART regimens", "Autoimmune disease flares — lupus, RA, vasculitis — immunosuppression adjustment", "Coagulation disorders — long-term anticoagulation decisions, reversal", "Lymphoma — maintenance therapy, surveillance imaging", "Transplant medicine — rejection, immunosuppression protocols, infections"] },
  { weight: 7, category: "Pregnancy & Female Reproductive", topics: ["Preconception counseling — folic acid, medication safety, disease optimization", "Antenatal care — screening timeline, glucose challenge test, GBS", "Postpartum care — contraception, depression screening, lactation", "Abnormal uterine bleeding — PALM-COEIN classification, management", "Contraception — efficacy rates, medical eligibility criteria"] },
  { weight: 6, category: "Gastrointestinal System", topics: ["Surveillance colonoscopy — adenoma follow-up intervals", "Hepatitis C — DAA therapy, sustained virologic response, cirrhosis surveillance", "Cirrhosis — HCC surveillance, SBP prophylaxis, beta-blockers for varices", "Celiac disease — gluten-free diet, follow-up serology", "IBD — maintenance therapy, dysplasia surveillance"] },
  { weight: 6, category: "Renal/Urinary & Male Reproductive", topics: ["CKD management — BP targets, RAAS blockade, SGLT2i in CKD", "Proteinuria — workup, ACEi/ARB titration", "BPH — alpha-blockers, 5-alpha reductase inhibitors, surgical options", "Nephrolithiasis — metabolic workup, dietary modifications", "Urinary incontinence — behavioral therapy, pharmacotherapy"] },
  { weight: 6, category: "Skin & Subcutaneous Tissue", topics: ["Skin cancer surveillance — melanoma follow-up, dermoscopy", "Chronic wound management — pressure ulcer staging, debridement", "Psoriasis — biologic selection, monitoring", "Acne — isotretinoin monitoring — iPLEDGE, liver enzymes, lipids", "Drug reactions — fixed drug eruption vs DRESS vs SJS"] },
  { weight: 6, category: "Behavioral Health", topics: ["Outpatient depression management — augmentation strategies", "Anxiety disorders — CBT, medication management, benzodiazepine risks", "Substance use — motivational interviewing, medication-assisted treatment", "ADHD in adults — stimulant therapy, non-stimulant alternatives", "Eating disorder outpatient management"] },
  { weight: 5, category: "Musculoskeletal System", topics: ["Osteoarthritis — non-pharmacologic, NSAID risks, intra-articular injections", "RA monitoring — DAS28, methotrexate toxicity screening, biologic safety", "Gout prophylaxis — allopurinol titration, febuxostat", "Fibromyalgia — multimodal treatment, duloxetine, pregabalin", "Osteoporosis — DEXA surveillance, medication holidays (bisphosphonate)"] },
  { weight: 5, category: "Endocrine System", topics: ["Diabetes — A1c targets by age/comorbidity, deprescribing in elderly", "Thyroid nodule — long-term surveillance, recurrence after treatment", "Adrenal incidentaloma — follow-up imaging, annual biochemical testing", "Pituitary adenoma — post-surgical surveillance, hormone replacement", "Metabolic syndrome — lifestyle intervention, pharmacotherapy"] },
  { weight: 2, category: "Human Development", topics: ["Well-child visits — developmental screening tools", "Childhood obesity — BMI percentiles, intervention", "Geriatric assessment — cognitive screening, fall prevention"] },
  { weight: 1, category: "Skin misc", topics: ["Rosacea — topical vs systemic", "Seborrheic dermatitis management"] },
];

// ─── WEIGHTED RANDOM SELECTION ───────────────────────────────────────────────
function weightedRandomCategory(blueprint) {
  const total = blueprint.reduce((sum, b) => sum + b.weight, 0);
  let rand = Math.random() * total;
  for (const b of blueprint) {
    rand -= b.weight;
    if (rand <= 0) return b;
  }
  return blueprint[blueprint.length - 1];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getBlueprintAndContext(level, requestedTopic) {
  const isRandom = requestedTopic.toLowerCase().includes("random");

  // If user picked a specific topic (not random), use that topic directly
  if (!isRandom) {
    return { blueprint: null, forcedTopic: requestedTopic };
  }

  // Random — pick blueprint based on exam level
  if (level.includes("ABIM Endocrinology")) {
    const cat = weightedRandomCategory(ABIM_ENDO_BLUEPRINT);
    return { blueprint: cat, forcedTopic: null };
  }
  if (level.includes("ABIM Internal Medicine")) {
    const cat = weightedRandomCategory(ABIM_IM_BLUEPRINT);
    return { blueprint: cat, forcedTopic: null };
  }
  if (level.includes("Step 1")) {
    const cat = weightedRandomCategory(USMLE_STEP1_BLUEPRINT);
    return { blueprint: cat, forcedTopic: null };
  }
  if (level.includes("Step 2")) {
    const cat = weightedRandomCategory(USMLE_STEP2_BLUEPRINT);
    return { blueprint: cat, forcedTopic: null };
  }
  if (level.includes("Step 3")) {
    const cat = weightedRandomCategory(USMLE_STEP3_BLUEPRINT);
    return { blueprint: cat, forcedTopic: null };
  }

  // Fallback — ABIM IM
  const cat = weightedRandomCategory(ABIM_IM_BLUEPRINT);
  return { blueprint: cat, forcedTopic: null };
}

function buildPrompt(level, requestedTopic) {
  const { blueprint, forcedTopic } = getBlueprintAndContext(level, requestedTopic);

  let topicInstruction = "";
  let specificTopic = "";

  if (forcedTopic) {
    // User selected a specific topic — generate on exactly that
    specificTopic = forcedTopic;
    topicInstruction = `The topic is: "${forcedTopic}". Generate a question specifically and directly about this topic.`;
  } else {
    // Blueprint-weighted random selection
    const chosenSubtopic = pickRandom(blueprint.topics);
    specificTopic = chosenSubtopic;
    topicInstruction = `
The exam category is: "${blueprint.category}" (${blueprint.weight}% of the ${level} exam).
The specific subtopic for this question is: "${chosenSubtopic}".
Generate a question directly about this subtopic. Do NOT drift into other topics.`;
  }

  const levelInstructions = {
    "USMLE Step 1": `
- Focus on BASIC SCIENCE mechanisms: pathophysiology, pharmacology, biochemistry, embryology, histology.
- Questions test understanding of WHY, not just WHAT.
- Reference USMLE Step 1 Content Specifications.
- Include a distractor based on a common mechanistic misconception.`,
    "USMLE Step 2 CK": `
- Focus on CLINICAL DECISION MAKING: diagnosis, next best step, management.
- Use clinical vignettes with vital signs, labs, and physical exam findings.
- Reference USMLE Step 2 CK Content Specifications and NBME clinical reasoning standards.
- Distractors should represent plausible but incorrect clinical decisions.`,
    "USMLE Step 3": `
- Focus on MANAGEMENT of established diagnoses, outpatient follow-up, and population health.
- Include biostatistics, ethics, and preventive medicine where relevant.
- Reference USMLE Step 3 Content Specifications.
- Questions should reflect independent physician decision-making.`,
    "ABIM Internal Medicine": `
- Focus on DIAGNOSIS and MANAGEMENT of internal medicine conditions.
- Follow current ACC/AHA, ADA, IDSA, ACR, KDIGO, and USPSTF guidelines.
- Reference the ABIM Internal Medicine Blueprint weighting.
- Include guideline-specific thresholds (BP targets, A1c goals, LDL targets, etc.).`,
    "ABIM Endocrinology": `
- Focus on ENDOCRINOLOGY SUBSPECIALTY content per the ABIM Endocrinology Blueprint.
- Reference ADA Standards of Care 2025, Endocrine Society guidelines, AACE guidelines.
- Include nuanced clinical distinctions that fellows must master (e.g., DKA vs HHS, Cushing workup, adrenal vein sampling indications).
- Questions should be at fellowship/subspecialty level, not general IM level.`,
  };

  const levelKey = Object.keys(levelInstructions).find(k => level.includes(k)) || "ABIM Internal Medicine";
  const levelSpecific = levelInstructions[levelKey];

  return `You are an expert medical board exam question writer for ${level}.

${topicInstruction}

EXAM LEVEL INSTRUCTIONS:
${levelSpecific}

STRICT CONTENT RULES:
1. Generate EXACTLY ONE high-quality clinical vignette MCQ.
2. The stem must be 3–6 sentences with a realistic patient presentation including age, sex, symptoms, vital signs, relevant labs or imaging findings, and clinical context.
3. Provide EXACTLY 5 answer choices labeled A through E.
4. Only ONE answer is correct. The others must be plausible distractors representing common mistakes or alternative diagnoses.
5. The correct answer must be evidence-based and cite the specific guideline or recommendation (e.g., "per ADA 2025 Standards of Care, Section 9" or "per ABIM IM Blueprint — Cardiovascular Disease domain").
6. The explanation must be 4–8 sentences covering: why the correct answer is right, why each wrong answer is incorrect, and the key teaching point.
7. Do NOT include the topic label in the question stem — only reveal it in the explanation.
8. The topic field should name the specific clinical concept tested (e.g., "Primary Aldosteronism — Adrenal Vein Sampling Indications").

RESPONSE FORMAT — return ONLY this JSON, no markdown, no preamble:
{
  "stem": "...",
  "choices": {"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."},
  "correct": "A",
  "explanation": "...",
  "topic": "${specificTopic}"
}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let topic, level;
  try {
    ({ topic, level } = JSON.parse(event.body));
    if (!topic || !level) throw new Error("Missing topic or level");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  try {
    const prompt = buildPrompt(level, topic);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].text.trim();

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error:", cleaned);
      return { statusCode: 500, body: JSON.stringify({ error: "AI returned invalid JSON. Please try again." }) };
    }

    // Validate structure
    const required = ["stem", "choices", "correct", "explanation", "topic"];
    for (const field of required) {
      if (!parsed[field]) {
        return { statusCode: 500, body: JSON.stringify({ error: `Missing field: ${field}` }) };
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([parsed]), // wrap in array for frontend compatibility
    };

  } catch (e) {
    console.error("Anthropic API error:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate question. Please try again." }),
    };
  }
};
