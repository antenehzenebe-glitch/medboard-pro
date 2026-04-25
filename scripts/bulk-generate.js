// bulk-generate.js — MedBoard Pro
// Standalone Node.js script for pre-populating Supabase via Anthropic Batch API
// Usage:
//   node bulk-generate.js                          # 500 questions, all levels/topics
//   node bulk-generate.js --count 200              # 200 questions
//   node bulk-generate.js --level "ABIM Endocrinology" --count 100
//   node bulk-generate.js --level "USMLE Step 1" --topic "Diabetes" --count 50
//   node bulk-generate.js --mode standard          # skip batch API, use concurrent calls
//
// Required env vars:
//   ANTHROPIC_API_KEY=sk-ant-...
//   SUPABASE_URL=https://xxx.supabase.co          (optional, has fallback)
//   SUPABASE_ANON_KEY=eyJ...                      (optional, has fallback)

"use strict";
const crypto = require("crypto");

// ─── ENV ──────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

if (!ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY is required. Set it as an environment variable.");
  process.exit(1);
}

// ─── CLI ARGS ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}
// Env vars take priority over CLI flags (avoids shell quoting issues in GitHub Actions)
const TARGET_COUNT  = parseInt(process.env.BULK_COUNT  || getArg("--count", "500"), 10);
const FILTER_LEVEL  = (process.env.BULK_LEVEL  || getArg("--level", "")).trim()  || null;
const FILTER_TOPIC  = (process.env.BULK_TOPIC  || getArg("--topic", "")).trim()  || null;
const MODE          = (process.env.BULK_MODE   || getArg("--mode", "batch")).trim();
const CONCURRENCY   = parseInt(process.env.BULK_CONCURRENCY || getArg("--concurrency", "6"), 10);

// ─── SHARED CONSTANTS (mirrored from generate-mcq.js) ────────────────────────
const VALID_LEVELS = [
  "ABIM Internal Medicine",
  "ABIM Endocrinology",
  "USMLE Step 1",
  "USMLE Step 2 CK",
  "USMLE Step 3"
];

const GUIDELINE_MAP = [
  { keywords: ["diabetes", "hypoglycemia", "dka", "hhs", "insulin"], citation: "ADA Standards of Medical Care in Diabetes—2026" },
  { keywords: ["thyroid", "nodule", "graves", "hashimoto", "hypothyroid", "hyperthyroid", "tsh", "free t4", "levothyroxine", "methimazole", "propylthiouracil", "radioiodine", "thyroiditis", "thyrotoxicosis", "goiter", "trab", "tpo", "thyroglobulin", "tg"], citation: `ATA 2014 Guidelines for Hypothyroidism in Adults (Jonklaas et al., Thyroid 2014) — PRIMARY REFERENCE for hypothyroidism; ATA 2016 Guidelines for Thyroid Nodules and Differentiated Thyroid Cancer; ATA 2016 Guidelines for Hyperthyroidism; AACE 2022 Thyroid Nodule Clinical Practice Guidelines; ES 2016 Thyroid Dysfunction in Pregnancy Guidelines.

⚠️ FABRICATED CITATION WARNING: "ATA 2025 Guidelines" DOES NOT EXIST as of April 2026. The last comprehensive ATA hypothyroidism guideline is Jonklaas et al. 2014. Do NOT invent guideline years. If uncertain, cite "per ATA recommendations" without a year, or cite the 2014 document explicitly.

CRITICAL THYROID ANCHORS — ABIM ENDOCRINOLOGY (MANDATORY ACCURACY):

1. OVERT vs SUBCLINICAL HYPOTHYROIDISM — EXACT DEFINITIONS (DO NOT DEVIATE):
   - OVERT hypothyroidism = elevated TSH + LOW free T4 (REGARDLESS of TSH numeric value).
   - SUBCLINICAL hypothyroidism = elevated TSH + NORMAL free T4.
   - TSH >10 with NORMAL free T4 = still subclinical (grade 2 subclinical); treatment generally recommended.
   - TSH 9.8 + LOW free T4 = OVERT hypothyroidism — because free T4 is low, NOT because TSH >10.
   - CRITICAL ERROR TO AVOID: Do NOT define overt hypothyroidism as "TSH >10" alone. The free T4 status determines overt vs subclinical.

2. TSH TARGET RANGES — EXACT VALUES (DO NOT CONFUSE):
   - General adult (non-pregnant): TSH target 0.4–4.0 mIU/L (ATA 2014 — lab reference range).
   - Elderly patients (>65): target slightly higher, 1.0–4.0 mIU/L acceptable.
   - Pregnancy / preconception: TSH target 0.1–2.5 mIU/L (first trimester), 0.2–3.0 (second), 0.3–3.0 (third).
   - FORBIDDEN ERROR: Do NOT cite 0.5–2.5 mIU/L as the general adult target — this is the PREGNANCY target. Using it for a non-pregnant adult is a factual error.
   - Differentiated thyroid cancer post-thyroidectomy: TSH suppression target depends on risk stratum (low-risk: 0.5–2.0; high-risk: <0.1).

3. LEVOTHYROXINE DOSING:
   - Full replacement: 1.6 mcg/kg/day — acceptable in young, healthy adults without cardiac disease (ATA 2014).
   - Low-and-slow (25–50 mcg starting dose): preferred in elderly patients, patients with CAD, or long-standing severe hypothyroidism.
   - In a young healthy adult (e.g., 34-year-old without cardiac disease), full weight-based dosing IS defensible — the explanation must acknowledge this nuance rather than calling it wrong.
   - Recheck TSH 6–8 weeks after any dose change.

4. SUBCLINICAL HYPOTHYROIDISM — TREATMENT THRESHOLDS:
   - TSH >10: treat (strong recommendation, ATA 2014).
   - TSH 4.5–10 + symptoms: treat (individualize).
   - TSH 4.5–10 + asymptomatic: observe, recheck in 6 months.
   - TSH 4.5–10 + pregnancy or trying to conceive: TREAT.
   - TPO antibody positive: increases risk of progression — favor treatment.

5. GRAVES DISEASE MANAGEMENT:
   - Three options: antithyroid drugs (methimazole first-line), radioactive iodine (RAI), or thyroidectomy.
   - Methimazole > PTU for most adults (less hepatotoxic); PTU preferred in first trimester of pregnancy and thyroid storm.
   - TRAb (TSH receptor antibodies): diagnostic for Graves, also predicts remission — negative TRAb after 12–18 months ATD = consider stopping.
   - Ophthalmopathy: RAI can worsen — prefer methimazole or surgery in active moderate-severe GO.

6. THYROID NODULE WORKUP (AACE 2022 / ATA 2016):
   - TSH first: if suppressed → radionuclide scan (hot nodule = rarely malignant).
   - Ultrasound: characterize all nodules; TIRADS or ATA US pattern guides FNA decision.
   - FNA: recommended based on US pattern + size thresholds (not all nodules need FNA).
   - Molecular testing (ThyroSeq, Afirma): for indeterminate FNA (Bethesda III/IV).

7. THYROID CANCER POST-THYROIDECTOMY:
   - RAI remnant ablation: NOT routine for low-risk DTC (ATA 2015 guidelines revised this).
   - Thyroglobulin (Tg) + anti-Tg antibodies: surveillance markers.
   - TSH suppression: high-risk → TSH <0.1; low-risk → TSH 0.5–2.0.

8. COGNITIVE LEVEL FOR ABIM ENDOCRINOLOGY THYROID QUESTIONS:
   - FORBIDDEN: "Patient has TSH 9.8 + low T4 — start levothyroxine?" (Tier 1 — every MS3 knows this).
   - REQUIRED Tier 3+: "Patient on stable levothyroxine develops elevated TSH — what is the most likely cause?" (malabsorption, drug interaction, non-compliance, change in formulation).
   - REQUIRED Tier 4: "Post-thyroidectomy for papillary thyroid cancer — TSH 1.2, Tg undetectable, anti-Tg rising — what is the interpretation and next step?"
   - REQUIRED Tier 5: "Graves disease in first trimester — methimazole vs PTU; when to switch back post-partum?"` },
  { keywords: ["lipid", "dyslipidemia", "cholesterol", "statin", "ascvd", "pcsk9", "ezetimibe", "triglyceride", "lpa", "lp(a)", "familial hypercholesterolemia", "bempedoic", "inclisiran", "fenofibrate"], citation: `2018 AHA/ACC/Multisociety Cholesterol Guideline (Grundy et al., Circulation 2019); 2019 ACC/AHA Primary Prevention Guideline (Arnett et al.); 2022 ACC Expert Consensus on Non-Statin Therapies (Lloyd-Jones et al.); 2024 AHA Scientific Statement on PREVENT Calculator.

CRITICAL LIPID ANCHORS:

1. RISK CALCULATOR — USE PREVENT, NOT PCE:
   - The PREVENT calculator (AHA 2023) is NOW the recommended ASCVD risk tool — race-neutral, includes kidney function, broader age range 30–79 years.
   - Pooled Cohort Equations (PCE, 2013) are LEGACY — overestimate risk in many populations; do NOT cite PCE as current standard.
   - Use neutral language when appropriate: "validated 10-year ASCVD risk calculator (PREVENT or equivalent)".

2. RISK CATEGORIES & STATIN THRESHOLDS (2018 AHA/ACC):
   - ASCVD ≥7.5% → high-intensity statin indicated.
   - ASCVD 5–<7.5% → intermediate risk; risk discussion + risk-enhancing factors guide decision.
   - ASCVD <5% → low risk; lifestyle first.
   - Risk-enhancing factors: Lp(a) ≥125 nmol/L, hsCRP ≥2, ABI <0.9, family history premature ASCVD.
   - Coronary artery calcium (CAC) score: CAC=0 → defer statin (unless DM, smoker, strong FH); CAC≥100 → treat.

3. NON-STATIN THERAPIES — ABIM IM TIER 4 TERRITORY:
   - Add ezetimibe first when LDL not at goal on max-tolerated statin (NNT favorable, oral, cheap).
   - Add PCSK9 inhibitor (evolocumab/alirocumab) when LDL still not at goal or statin-intolerant with high ASCVD risk.
   - Bempedoic acid: ATP-citrate lyase inhibitor; option for statin-intolerant patients (CLEAR Outcomes 2023 — reduced MACE).
   - Inclisiran: siRNA PCSK9 inhibitor; twice-yearly injection; same efficacy as PCSK9i mAbs.
   - Icosapentaenoic acid (EPA, Vascepa): for TG ≥150 + high CV risk on statin (REDUCE-IT trial); DHA-containing formulations NOT proven.

4. STATIN INTOLERANCE:
   - True myopathy: CK >10× ULN + symptoms → discontinue.
   - Rechallenge with alternate statin (rosuvastatin, pravastatin) or every-other-day dosing before declaring intolerance.
   - Statin-intolerant + very high risk → bempedoic acid + ezetimibe → PCSK9i.

5. FORBIDDEN CITATIONS — DO NOT USE:
   - "AACE 2026 Lipid Guidelines" — DOES NOT EXIST. Last comprehensive AACE lipid guideline: Jellinger et al. 2017.
   - Do NOT cite AACE/ACE for lipids without specifying it is the 2017 document.` },
  { keywords: ["obesity", "bariatric", "metabolic syndrome", "GLP-1", "wegovy", "tirzepatide", "semaglutide obesity"], citation: "AHA/ACC 2023 Obesity Guideline; AACE 2023 Obesity Algorithm; ADA 2025/2026 Standards of Care." },
  { keywords: ["pcos", "polycystic"], citation: "International Evidence-based PCOS Guideline 2023" },
  { keywords: ["cardio", "acs", "arrhythmia", "heart failure"], citation: "ACC/AHA 2025-2026 Guidelines" },
  { keywords: ["hypertension", "blood pressure"], citation: "ACC/AHA 2025 Hypertension Guidelines" },
  { keywords: ["nephro", "renal", "ckd"], citation: "KDIGO 2025 Guidelines" },
  { keywords: ["gastro", "hepat", "cirrhosis", "ibd", "crohn", "colitis", "ulcerative", "inflammatory bowel", "infliximab", "adalimumab", "vedolizumab", "ustekinumab", "risankizumab", "tofacitinib", "upadacitinib", "biologic", "anti-tnf", "fistula", "perianal", "colonoscopy", "budesonide", "mesalamine", "azathioprine", "methotrexate ibd"], citation: `ACG 2024 Crohn's Disease Guidelines (Lichtenstein et al.); AGA 2021 Moderate-to-Severe Crohn's Guideline; ACG 2019 UC Guidelines; ECCO 2022 IBD Guidelines; AASLD 2025 Practice Guidance (hepatology); MKSAP 19 GI/Hepatology.

CRITICAL IBD ANCHORS — ABIM IM TIER 3–4:

1. THERAPEUTIC DRUG MONITORING (TDM) — ANTI-TNF:
   - Infliximab trough goal: ≥5 mcg/mL (induction), ≥3–5 mcg/mL (maintenance).
   - Anti-drug antibodies (ATI) present + low trough → switch biologic CLASS (primary immunogenicity).
   - Subtherapeutic trough + no ATI → dose optimize (increase dose or shorten interval).
   - Secondary loss of response: check trough + ATI before switching.

2. TREATMENT STRATEGY — TOP-DOWN VS STEP-UP:
   - Moderate-to-severe CD: early biologic + immunomodulator combination (top-down) — SONIC trial shows superiority over step-up.
   - SONIC trial (NEJM 2010): infliximab + azathioprine > infliximab monotherapy > azathioprine alone for steroid-free remission in CD.
   - Anti-TNF monotherapy vs combination: combination superior for CD (SONIC); UC data less definitive.

3. BIOLOGIC SWITCHING RULES:
   - Primary non-response (never responded) → switch to DIFFERENT MECHANISM CLASS (e.g., anti-TNF → vedolizumab or ustekinumab).
   - Secondary loss of response (responded then lost) → TDM first; if ATI+ → switch class; if low trough/no ATI → dose optimize same agent.

4. PRE-BIOLOGIC SCREENING (MANDATORY):
   - TB: CXR + IGRA (QuantiFERON-TB Gold); treat LTBI before starting biologic.
   - HBV: HBsAg, anti-HBc, anti-HBs; if HBsAg+ → antiviral prophylaxis (entecavir) before biologic.
   - Varicella IgG: vaccinate if seronegative (live vaccine — give BEFORE biologic, not during).
   - HPV vaccine: recommended for all IBD patients on immunosuppression up to age 45.
   - Pneumococcal, influenza, COVID vaccines: give before or during (non-live okay during).

5. CANCER SURVEILLANCE:
   - UC: colonoscopy every 1–2 years starting 8–10 years after diagnosis.
   - CD with colonic involvement: same surveillance intervals as UC.
   - Primary sclerosing cholangitis (PSC) + IBD: annual colonoscopy from time of PSC diagnosis.

6. PERIANAL DISEASE:
   - Workup: EUA (exam under anesthesia) + MRI pelvis (best for fistula mapping).
   - Treatment: infliximab has BEST perianal fistula data; surgical drainage + seton BEFORE biologic.
   - Avoid: systemic corticosteroids in perianal fistulizing disease (worsen).

7. FISTULIZING DISEASE:
   - Staged approach: surgical drainage first → antibiotics (metronidazole/ciprofloxacin) → biologic (infliximab).
   - Avoid corticosteroids in fistulizing disease.
   - Combination biologic + immunomodulator preferred.

8. PREGNANCY IN IBD:
   - Anti-TNF agents (infliximab, adalimumab): SAFE throughout pregnancy; continue.
   - Vedolizumab: likely safe; data emerging.
   - Methotrexate: CONTRAINDICATED in pregnancy (teratogenic) — stop 3–6 months before conception.
   - Thalidomide: absolutely contraindicated.
   - Active IBD during pregnancy is more dangerous than biologic exposure.

9. SMOKING IN IBD:
   - Crohn's disease: smoking WORSENS disease course, increases surgery risk — cessation critical.
   - Ulcerative colitis: smoking paradoxically PROTECTIVE — but NOT a reason to recommend smoking.

10. SURGICAL CONSIDERATIONS:
    - LIR!C trial: ileocecal resection non-inferior to infliximab for short-segment ileal CD — surgical option preferred in some patients.
    - UC refractory to medical therapy → colectomy (curative).

11. IMAGING:
    - CT enterography vs MR enterography: MRE PREFERRED in young patients (avoids radiation).
    - MRE better for perianal disease, small bowel wall inflammation.

12. STEROID CHOICES:
    - Budesonide: preferred for mild-moderate ileal/right-sided CD (first-pass hepatic metabolism, less systemic effect).
    - Prednisone: for more extensive or severe disease; avoid long-term use.

13. BIOLOGIC AGENTS — MECHANISM AND TIER:
    - Anti-TNF: infliximab, adalimumab, certolizumab (CD), golimumab (UC).
    - Vedolizumab (anti-α4β7): gut-selective integrin inhibitor; safer profile, slower onset; preferred when systemic immunosuppression a concern.
    - Ustekinumab (anti-IL-12/23), risankizumab (anti-IL-23): options for CD; risankizumab approved 2022.
    - Tofacitinib, upadacitinib (JAK inhibitors): UC; BLACK BOX WARNING: cardiovascular risk, malignancy, thrombosis — use with caution in patients >50 with CV risk factors.` },
  { keywords: ["parathyroid", "calcium", "bone", "osteoporosis"], citation: "Endocrine Society 2022 Primary Hyperparathyroidism Guideline & AACE 2025 Osteoporosis Guideline" },
  { keywords: ["menopause", "hrt", "reproductive"], citation: "Endocrine Society Menopause Guidelines 2022 & NAMS 2025" },
  { keywords: ["pituitary", "hypothalamus", "acromegaly", "prolactin", "prolactinoma", "hypopituitarism", "craniopharyngioma", "avp", "diabetes insipidus", "siadh", "igf-1", "growth hormone", "gonadotropin"], citation: "Pituitary Society 2023 Consensus on Acromegaly, Hypopituitarism, and Pituitary Tumors; Endocrine Society 2025 CPGs; European Journal of Endocrinology 2023 AVP-D Consensus. CRITICAL: copeptin >=6.4 pmol/L after hypertonic saline confirms AVP-R (NDI); GH nadir <1 ng/mL on OGTT diagnoses acromegaly (or <0.4 with ultrasensitive assay); prolactin >500 ng/mL is virtually diagnostic of macroprolactinoma." },
  { keywords: ["sepsis", "septic shock", "infectious", "antibiotic", "bacteremia", "pneumonia", "pyelonephritis", "meningitis", "endocarditis", "esbl", "carbapenem", "vasopressor", "norepinephrine", "vasopressin", "hydrocortisone", "source control", "lactate", "procalcitonin"], citation: `Surviving Sepsis Campaign (SSC) 2021 International Guidelines; IDSA 2024 Antibiotic Stewardship Guidelines; IDSA/SCCM 2025 Sepsis Bundle Updates.

CRITICAL CLINICAL ANCHORS FOR SEPSIS/ID QUESTIONS:

1. PRESSORS & HEMODYNAMIC SUPPORT:
   - Norepinephrine is FIRST-LINE vasopressor (SSC 2021, strong recommendation).
   - Add VASOPRESSIN (0.03 units/min) when norepinephrine dose ≥0.25 mcg/kg/min to reduce catecholamine load — NOT dopamine.
   - Dopamine only in select bradycardic patients; associated with higher arrhythmia risk.
   - Epinephrine: third-line adjunct in refractory shock.

2. STEROID USE IN SEPTIC SHOCK:
   - IV hydrocortisone 200 mg/day ONLY if hemodynamically unstable despite adequate fluids AND vasopressors (SSC 2021).
   - Do NOT use steroids in sepsis WITHOUT shock.
   - ACTH stimulation test NOT required before initiating steroids in septic shock.
   - Taper steroids when vasopressors no longer needed.

3. ANTIBIOTIC STEWARDSHIP — ESBL & CARBAPENEM INDICATIONS:
   - Empiric carbapenem (meropenem/ertapenem) indicated: known ESBL colonization/prior infection, high-risk travel exposure, recurrent UTI with prior ESBL, or septic shock with no time for cultures.
   - De-escalate carbapenem to cephalosporin/quinolone once ESBL susceptibility confirmed — stewardship priority.
   - Piperacillin-tazobactam NOT reliable for ESBL bacteremia (MERINO trial 2018 — higher mortality vs meropenem).
   - Ceftolozane-tazobactam or ceftazidime-avibactam for MDR Pseudomonas or KPC-producing organisms.

4. SOURCE CONTROL — OBSTRUCTIVE PYELONEPHRITIS:
   - Obstructive pyelonephritis with sepsis = UROLOGIC EMERGENCY.
   - Ureteral stent or percutaneous nephrostomy within 6–12 hours — antibiotics alone are INSUFFICIENT.
   - Do NOT delay decompression for additional imaging if clinical picture is clear.
   - Cystoscopy + stent placement preferred if expertise available; nephrostomy if not.

5. REFRACTORY SHOCK — ESCALATION LADDER:
   - Refractory shock = MAP <65 despite norepinephrine ≥0.25 mcg/kg/min + adequate volume resuscitation.
   - Step 1: Add vasopressin 0.03 units/min.
   - Step 2: Add hydrocortisone 200 mg/day IV.
   - Step 3: Add epinephrine as third-line agent.
   - Consider angiotensin II (Giapreza) in catecholamine-refractory vasodilatory shock.

6. ICU TRANSFER CRITERIA — LACTATE & VASOPRESSOR ESCALATION:
   - Lactate ≥4 mmol/L = high-risk; immediate ICU admission regardless of BP.
   - Lactate 2–4 mmol/L = intermediate risk; reassess at 2 hours — failure to clear ≥10% = ICU transfer.
   - Vasopressor requirement at any dose = ICU-level care mandatory.
   - Lactate clearance ≥10% at 2 hours = favorable prognostic sign; do NOT use lactate normalization alone as ICU discharge criterion.` },
  { keywords: ["cushing", "adrenal", "aldosterone", "pheochromocytoma", "paraganglioma"], citation: "Endocrine Society 2024 CPG on Cushing Syndrome & Adrenal Incidentaloma; Pituitary Society 2023 Consensus on Cushing Disease. CRITICAL: MRI->BIPSS threshold >=6mm; 1mg DST is screening; ACTH <10 pg/mL = independent, >20 pg/mL = dependent; bilateral adrenal hyperplasia with suppressed renin = rule out KCNJ5 mutation." }
];

const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const NUTRITION_INJECTION_RATE = 0.12;

const MALE_ONLY_TOPIC_KEYWORDS   = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
const FEMALE_ONLY_TOPIC_KEYWORDS = ["pcos", "polycystic ovary", "menopause", "ovarian", "endometri", "pregnancy", "obstetric", "gynecolog", "turner syndrome"];

// ─── TOPIC DISTRIBUTION MAP ───────────────────────────────────────────────────
// Defines how many questions per topic per level in a balanced 500-question run.
// Adjust weights to match your curriculum priorities.
const TOPIC_DISTRIBUTION = {
  "ABIM Endocrinology": [
    { topic: "Type 2 Diagnosis and Management",    weight: 8 },
    { topic: "Type 1 Insulin Therapy",             weight: 6 },
    { topic: "DKA and HHS",                        weight: 5 },
    { topic: "Hypoglycemia",                       weight: 5 },
    { topic: "GLP-1 Receptor Agonists",            weight: 5 },
    { topic: "SGLT2 Inhibitors",                   weight: 4 },
    { topic: "CGM and AID Systems",                weight: 3 },
    { topic: "Hypothyroidism and Hashimotos",      weight: 5 },
    { topic: "Hyperthyroidism and Graves",         weight: 5 },
    { topic: "Thyroid Nodule Evaluation",          weight: 4 },
    { topic: "Thyroid Cancer",                     weight: 3 },
    { topic: "Thyroid Storm",                      weight: 3 },
    { topic: "Cushing Syndrome",                   weight: 5 },
    { topic: "Primary Aldosteronism",              weight: 4 },
    { topic: "Pheochromocytoma",                   weight: 3 },
    { topic: "Adrenal Insufficiency",              weight: 4 },
    { topic: "Prolactinoma",                       weight: 4 },
    { topic: "Acromegaly",                         weight: 3 },
    { topic: "Hypopituitarism",                    weight: 3 },
    { topic: "Diabetes Insipidus",                 weight: 3 },
    { topic: "Hyperparathyroidism",                weight: 4 },
    { topic: "Hypercalcemia",                      weight: 3 },
    { topic: "Osteoporosis",                       weight: 4 },
    { topic: "PCOS",                               weight: 4 },
    { topic: "Male Hypogonadism",                  weight: 3 },
    { topic: "MEN1",                               weight: 2 },
    { topic: "MEN2A and MEN2B",                    weight: 2 },
    { topic: "Insulinoma",                         weight: 2 },
  ],
  "ABIM Internal Medicine": [
    { topic: "ACS STEMI NSTEMI",                   weight: 7 },
    { topic: "Heart Failure",                      weight: 6 },
    { topic: "Atrial Fibrillation",                weight: 6 },
    { topic: "Hypertension",                       weight: 5 },
    { topic: "Lipid Disorders",                    weight: 4 },
    { topic: "Asthma and COPD",                    weight: 5 },
    { topic: "Pneumonia",                          weight: 4 },
    { topic: "Pulmonary Embolism",                 weight: 5 },
    { topic: "Acute Kidney Injury",               weight: 5 },
    { topic: "CKD",                               weight: 4 },
    { topic: "Electrolyte Disorders",             weight: 5 },
    { topic: "Acid-Base Disorders",               weight: 4 },
    { topic: "IBD Crohns and UC",                 weight: 4 },
    { topic: "Cirrhosis",                         weight: 4 },
    { topic: "Sepsis and Septic Shock",           weight: 5 },
    { topic: "HIV",                               weight: 3 },
    { topic: "Anemia",                            weight: 4 },
    { topic: "DVT and Anticoagulation",           weight: 4 },
    { topic: "Rheumatoid Arthritis",              weight: 3 },
    { topic: "SLE",                               weight: 3 },
    { topic: "Type 2 Diagnosis and Management",   weight: 4 },
    { topic: "Hypothyroidism and Hashimotos",     weight: 3 },
    { topic: "Informed Consent",                  weight: 2 },
    { topic: "End-of-Life Care",                  weight: 2 },
  ],
  "USMLE Step 1": [
    { topic: "Systemic Pathology and Pathophysiology",    weight: 10 },
    { topic: "Pharmacology, Pharmacokinetics, and Adverse Effects", weight: 8 },
    { topic: "Physiology and Clinical Biochemistry",      weight: 8 },
    { topic: "Microbiology, Virology, and Immunology",    weight: 7 },
    { topic: "Anatomy, Neuroanatomy, and Embryology",     weight: 4 },
    { topic: "Behavioral Science, Medical Ethics, and Biostatistics", weight: 5 },
    { topic: "Vitamin D deficiency — rickets vs. osteomalacia", weight: 3 },
    { topic: "Thiamine (B1) deficiency — Wernicke encephalopathy", weight: 3 },
  ],
  "USMLE Step 2 CK": [
    { topic: "ACS STEMI NSTEMI",                          weight: 6 },
    { topic: "Heart Failure",                             weight: 5 },
    { topic: "Pneumonia",                                 weight: 5 },
    { topic: "Sepsis and Septic Shock",                   weight: 5 },
    { topic: "Acute Kidney Injury",                      weight: 5 },
    { topic: "Type 2 Diagnosis and Management",           weight: 5 },
    { topic: "Gestational Diabetes",                      weight: 4 },
    { topic: "Obstetrics and Gynecology",                 weight: 5 },
    { topic: "Pediatrics and Congenital Issues",          weight: 5 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 5 },
    { topic: "Psychiatry and Substance Abuse",            weight: 4 },
    { topic: "General Surgery and Trauma Management",     weight: 5 },
  ],
  "USMLE Step 3": [
    { topic: "ACS STEMI NSTEMI",                          weight: 5 },
    { topic: "Sepsis and Septic Shock",                   weight: 5 },
    { topic: "Pulmonary Embolism",                        weight: 4 },
    { topic: "CKD",                                       weight: 4 },
    { topic: "Type 2 Diagnosis and Management",           weight: 4 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 6 },
    { topic: "Psychiatry and Substance Abuse",            weight: 4 },
    { topic: "Obstetrics and Gynecology",                 weight: 4 },
    { topic: "ICU nutrition — ASPEN/ESPEN 2023",          weight: 3 },
    { topic: "Chronic disease nutrition management",      weight: 3 },
  ],
};

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────
function getGuidelineContext(topic, isNutrition) {
  if (isNutrition) return "ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, and IOM/DRI Nutrition Guidelines";
  const t = topic.toLowerCase();
  const match = GUIDELINE_MAP.find(g => g.keywords.some(k => t.includes(k)));
  return match ? match.citation : "the most current 2025-2026 official society guidelines";
}

function pickSexForTopic(promptTopic) {
  const t = promptTopic.toLowerCase();
  if (MALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k)))   return "man";
  if (FEMALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k))) return "woman";
  return Math.random() > 0.5 ? "man" : "woman";
}

function pickWeighted(blueprint) {
  const total = blueprint.reduce((acc, curr) => acc + curr.w, 0);
  let rand = Math.random() * total;
  for (const item of blueprint) { rand -= item.w; if (rand < 0) return item.s; }
  return blueprint[blueprint.length - 1].s;
}

function hashStem(stem) {
  if (!stem || typeof stem !== "string") return null;
  return crypto.createHash("sha256").update(stem.trim().toLowerCase()).digest("hex");
}

function deriveSpecialtyGroup(level, resolvedTopic) {
  if (level === "ABIM Endocrinology") return "Endocrinology";
  const t = (resolvedTopic || "").toLowerCase();
  if (t.includes("cardio") || t.includes("acs") || t.includes("heart failure") || t.includes("atrial")) return "Cardiology";
  if (t.includes("endocrin") || t.includes("diabetes") || t.includes("thyroid") || t.includes("pituitary") || t.includes("adrenal") || t.includes("bone") || t.includes("calcium")) return "Endocrinology";
  if (t.includes("nephro") || t.includes("renal") || t.includes("ckd") || t.includes("kidney")) return "Nephrology";
  if (t.includes("pulm") || t.includes("copd") || t.includes("asthma") || t.includes("pneumonia")) return "Pulmonology";
  if (t.includes("gastro") || t.includes("hepat") || t.includes("cirrhosis") || t.includes("ibd")) return "Gastroenterology";
  if (t.includes("hematol") || t.includes("oncolog") || t.includes("anemia") || t.includes("dvt")) return "Hematology/Oncology";
  if (t.includes("rheumatol") || t.includes("arthritis") || t.includes("sle") || t.includes("lupus")) return "Rheumatology";
  if (t.includes("infectious") || t.includes("sepsis") || t.includes("hiv") || t.includes("antibiotic")) return "Infectious Disease";
  if (t.includes("neurolog") || t.includes("stroke") || t.includes("seizure")) return "Neurology";
  if (t.includes("ethics") || t.includes("hipaa") || t.includes("palliative") || t.includes("end-of-life") || t.includes("consent")) return "Ethics/Communication";
  if (t.includes("psychi") || t.includes("substance")) return "Psychiatry";
  if (t.includes("pediat") || t.includes("congenital")) return "Pediatrics";
  if (t.includes("obstet") || t.includes("gynec") || t.includes("gestational")) return "OB/GYN";
  if (t.includes("surg") || t.includes("trauma")) return "Surgery";
  if (t.includes("pharmac")) return "Pharmacology";
  if (t.includes("nutrition") || t.includes("vitamin") || t.includes("thiamine") || t.includes("refeeding")) return "Nutrition";
  return "General Internal Medicine";
}

function validateDemographics(stem, sex) {
  const lowerText = stem.toLowerCase();
  if (sex === "man") {
    const femaleTerms = ["oral contraceptive","ocp","pregnant","pregnancy","gravida","menopause","menstrual","menses","amenorrhea","ovary","uterus","endometrial","vaginal","cervical cancer"];
    return !femaleTerms.some(term => lowerText.includes(term));
  } else {
    const maleTerms = ["prostate","bph","psa level","testicle","testicular","scrotal","sildenafil","erectile dysfunction"];
    return !maleTerms.some(term => lowerText.includes(term));
  }
}

function rewriteExplanationLetters(explanation, letterMap) {
  if (!explanation || typeof explanation !== "string") return explanation;
  let out = explanation;
  const placeholders = {};
  Object.keys(letterMap).forEach((oldLetter, idx) => {
    const placeholder = `§§LETTER_${idx}§§`;
    placeholders[placeholder] = letterMap[oldLetter];
    const patterns = [
      { re: new RegExp(`(\\bChoice\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\bOption\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\banswer\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`\\(${oldLetter}\\)`, "g"),              wrap: 2 },
      { re: new RegExp(`(•\\s*)${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 },
      { re: new RegExp(`(^|\\n)\\s*${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 }
    ];
    patterns.forEach(({ re, wrap }) => {
      if (wrap === 1) out = out.replace(re, `$1${placeholder}`);
      else if (wrap === 2) out = out.replace(re, `(${placeholder})`);
      else if (wrap === 3) out = out.replace(re, (match, p1, p2) => `${p1}${placeholder}${p2}`);
    });
  });
  Object.keys(placeholders).forEach(p => { out = out.split(p).join(placeholders[p]); });
  return out;
}

// ─── MCQ TOOL SCHEMA ──────────────────────────────────────────────────────────
const MCQ_TOOL = {
  name: "emit_mcq",
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation. This is the ONLY way to respond to the user's request.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: { type: "string", description: "Confirmation that the vignette's patient sex matches the requested sex. Format: 'confirmed man' or 'confirmed woman'." },
      stem:              { type: "string", description: "The clinical vignette. Must end with the interrogative sentence." },
      choices: {
        type: "object",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct:      { type: "string", enum: ["A","B","C","D","E"] },
      explanation:  { type: "string", description: "S1 (why correct + citation), S2 (why distractors fail + bias label), Board Pearl." }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────
function buildPrompt(level, topic) {
  const isNutrition = NUTRITION_BY_LEVEL[level]?.includes(topic) ?? false;

  const isABIM_Endo = level === "ABIM Endocrinology"; // early declaration for qTypePool
  const isStep3     = level === "USMLE Step 3";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  let qTypePool = [];
  if (topic.includes("Ethics") || topic.includes("Behavioral") || topic.includes("HIPAA") || topic.includes("end-of-life") || topic.includes("consent")) {
    qTypePool = [{s:"most appropriate NEXT STEP IN PATIENT COUNSELING",w:40}, {s:"LEGAL OR ETHICAL REQUIREMENT",w:40}];
  } else if (level === "USMLE Step 1") {
    qTypePool = [{s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY",w:40}, {s:"MECHANISM OF ACTION OR TOXICITY",w:30}];
  } else if (isStep3) {
    // Tier 3–5 cognitive complexity for USMLE Step 3
    qTypePool = [
      {s:"MOST APPROPRIATE MULTI-STEP MANAGEMENT given facility constraints or patient comorbidities",w:30},
      {s:"NEXT BEST ACTION when initial management has failed or complications arise",w:25},
      {s:"MOST APPROPRIATE DISPOSITION OR TRANSITION OF CARE decision",w:20},
      {s:"MOST LIKELY COMPLICATION of current management and how to address it",w:15},
      {s:"MOST APPROPRIATE INFORMED CONSENT or ethical decision in a complex clinical scenario",w:10}
    ];
  } else if (isABIM_IM_early) {
    // Tier 3-4 cognitive complexity for ABIM Internal Medicine
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT TREATMENT STEP given statin intolerance, organ dysfunction, or comorbidity conflict",w:30},
      {s:"MOST LIKELY DIAGNOSIS in a multi-system or atypical presentation requiring internist synthesis",w:20},
      {s:"MOST APPROPRIATE MANAGEMENT when first-line therapy has failed or is contraindicated",w:25},
      {s:"MOST APPROPRIATE DRUG CHOICE given specific comorbidity profile (CKD, HF, DM, prior ASCVD)",w:20},
      {s:"MOST APPROPRIATE NEXT STEP when risk stratification tools yield borderline or conflicting results",w:5}
    ];
  } else if (isABIM_Endo) {
    // Tier 3+ cognitive complexity for ABIM Endocrinology
    qTypePool = [
      {s:"NEXT STEP IN MANAGEMENT given an atypical or guideline-edge scenario",w:30},
      {s:"MOST LIKELY DIAGNOSIS in an atypical or overlapping presentation",w:25},
      {s:"NEXT STEP IN DIAGNOSIS using biomarker or genetic testing strategy",w:25},
      {s:"MOST APPROPRIATE PHARMACOLOGIC CHOICE based on cardiorenal or comorbidity profile",w:15},
      {s:"MOST LIKELY SUBTYPE based on clinical, biochemical, or genetic features",w:5}
    ];
  } else {
    qTypePool = [{s:"NEXT STEP IN DIAGNOSIS",w:25}, {s:"MOST LIKELY DIAGNOSIS",w:25}, {s:"NEXT STEP IN MANAGEMENT",w:40}, {s:"STRONGEST RISK FACTOR",w:10}];
  }
  const promptQType = pickWeighted(qTypePool);
  const randomSex   = pickSexForTopic(topic);

  const isUSMLE     = level.includes("USMLE");
  const maxTokens   = isABIM_Endo ? 1700 : 1300;

  const systemRole  = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  const levelRules  = isUSMLE
    ? "USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1, M3/M4 for Step 2/3."
    : isABIM_IM
    ? "ABIM IM RULES: Generalist level. First-line recognition, initial workup, when to refer, first-line management."
    : `ABIM ENDOCRINOLOGY RULES: Full subspecialty level. MANDATORY Tier 3+ cognitive complexity:
(1) ATYPICAL PRESENTATIONS — ketosis-prone DM2, ICI-induced diabetes/hypophysitis, LADA, MODY subtypes, euglycemic DKA on SGLT2i, acromegaly with normal IGF-1.
(2) SUBTYPE DIFFERENTIATION — AVP-D vs AVP-R (copeptin testing), Cushing disease vs ectopic ACTH vs adrenal source, primary vs central adrenal insufficiency, familial vs sporadic hyperaldosteronism, Graves vs toxic MNG vs thyroiditis.
(3) CUTTING-EDGE GUIDELINES — ADA 2025/2026 GLP-1 RA and SGLT2i cardiorenal indications, AASLD 2025 PBC, ES 2024 on AVP-D, 2018 AHA/ACC Cholesterol Guideline + 2022 ACC Expert Consensus for lipids, AACE 2022 + ATA 2016 thyroid nodule workup.
(4) MULTI-AXIS WORKUP — simultaneous pituitary axes (TSH/free T4 + IGF-1 + cortisol + iron studies in hemochromatosis), multi-hormone deficiency patterns.
(5) GENETIC TESTING DECISIONS — when to order RET for MEN2, VHL for paraganglioma, KCNJ5/CYP11B2 for familial hyperaldosteronism, HNF1A/HNF4A for MODY.
Do NOT generate basic first-line questions (e.g. start metformin for T2DM, levothyroxine for hypothyroidism). Every question must require subspecialty reasoning.`;

  const integrityRules = `INTEGRITY RULES:
A. Distractor-stem independence.
B. Evidence discipline: cite only data explicitly in stem.
C. Cognitive bias labels: anchoring, premature closure, availability bias.
D. "glucose" never "sugar".
E. EXPLANATION FORMATTING: In S2, you MUST refer to choices strictly as "Choice A", "Choice B", "Choice C", "Choice D", "Choice E". DO NOT use bullet points (e.g., "• A") or standalone letters.
F. GUIDELINE CURRENCY: You MUST cite guidelines from 2023 or later ONLY. Do NOT cite any guideline, criteria, or recommendation older than 2023. If you are uncertain of the year, do not cite it — state the recommending society only (e.g., "per ADA recommendations").
G. EXPLANATION-CHOICE CONSISTENCY (CRITICAL): Before finalizing, perform a self-check — read every sentence in S2 and confirm it matches the actual text of the corresponding choice letter. The explanation MUST NOT describe a choice differently from what is written in the choices field. If you say "Choice B proposes X", then Choice B must literally contain X. NEVER call the correct answer a distractor and NEVER call a distractor the correct answer.`;

  const explanationNote = isABIM_IM
    ? "EXPLANATION: concise total <=250 words. Cite only 2023+ guidelines."
    : `EXPLANATION: S1 (why correct answer is correct — cite the specific 2023–2026 guideline and year), S2 (why each distractor fails — reference each by its exact Choice letter and match its text precisely), Board Pearl (one high-yield exam fact). STRICT LENGTH LIMIT: <= 350 words total. SELF-CHECK BEFORE SUBMITTING: confirm that every choice letter referenced in S2 matches the actual choice text you wrote, and that no guideline cited predates 2023.`;

  const topicGuideline = getGuidelineContext(topic, isNutrition);

  const systemText = `You are ${systemRole}. Output confident, accurate facts.
${levelRules}
${integrityRules}
CLINICAL EVIDENCE STANDARD: You MUST base the diagnosis, management, and explanation citations strictly on: ${topicGuideline}. Do not use outdated criteria.
${explanationNote}
UNIVERSAL HARD RULES: HIT: argatroban hepatic, bivalirudin/fondaparinux renal; DKA/HHS: K+ >3.3 before insulin; thyroid storm: PTU before iodine.
RESPONSE FORMAT: You MUST respond by calling the emit_mcq tool exactly once.`;

  const step3TierPrompt = isStep3 ? `
USMLE STEP 3 TIER 3–5 REQUIREMENTS (MANDATORY):
- The vignette MUST present a management decision, NOT a diagnosis or workup question.
- Build in a realistic constraint: facility without cath lab, transfer time >120 min, patient refusing standard care, two active life threats, or failed first-line therapy.
- Distractors must include the Tier 1/2 answer (what a MS3 would choose) — the correct answer requires resident-level multi-step reasoning.
- Stem must reflect a PGY-1/PGY-2 resident on call or in clinic managing a deteriorating or complex patient.
- Cite the relevant 2023–2026 guideline in S1 of the explanation.` : "";

  const abimIMTierPrompt = isABIM_IM_early ? `
ABIM INTERNAL MEDICINE TIER 3–4 REQUIREMENTS (MANDATORY):
- Do NOT ask "what is the first test?" or "what is the most likely diagnosis?" for a classic presentation.
- Present a scenario requiring synthesis: borderline risk scores + risk-enhancing factors, treatment failure, statin intolerance with high ASCVD risk, or multi-comorbidity drug selection.
- For lipid questions: use PREVENT calculator (not PCE), cite 2018 AHA/ACC or 2022 ACC Expert Consensus, include non-statin options when relevant (ezetimibe, bempedoic acid, PCSK9i).
- Distractors must include the Tier 1 answer (what a MS4 would choose) — the correct answer requires internist-level guideline synthesis.
- Cite the correct, existing guideline with the correct year in S1.` : "";

  const endoTier3Prompt = isABIM_Endo ? `
ABIM ENDOCRINOLOGY TIER 3+ REQUIREMENTS (MANDATORY):
- Present an ATYPICAL, COMPLEX, or GUIDELINE-EDGE scenario — NOT a textbook classic.
- Consider: atypical DM subtypes (LADA, MODY, ketosis-prone, ICI-induced), rare pituitary or adrenal presentations, multi-hormone deficiency, genetic testing decisions, or cardiorenal treatment choices.
- Distractors must include the "classic teaching" answer that a non-subspecialist would choose — the correct answer requires deeper subspecialty reasoning.
- Cite a specific 2024–2026 society guideline (ADA, ES, AACE, AASLD, ACC/AHA, ASCO) in the explanation.
- Board Pearl must contain an exam-ready high-yield fact not obvious from the stem.` : "";

  const userText = `Write 1 vignette on: ${topic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. Select a clinically appropriate age and care setting (Clinic, ED, Inpatient, ICU) that matches the typical epidemiological presentation of the target diagnosis.
- Pertinent negatives biologically possible for a ${randomSex}.
- The stem MUST end with the interrogative sentence.${step3TierPrompt}${abimIMTierPrompt}${endoTier3Prompt}
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

  return { systemText, userText, randomSex, maxTokens, topic };
}

// ─── PROCESS RAW MCQ (shuffle + validate) ────────────────────────────────────
function processRawMcq(p, level, topic) {
  if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) return null;
  if (!validateDemographics(p.stem, p._sex || "man")) return null;

  const letters      = ["A","B","C","D","E"];
  const correctIndex = letters.indexOf(p.correct);
  const optionsArray = letters
    .map((letter, i) => ({ originalLetter: letter, text: p.choices[letter], isCorrect: i === correctIndex }))
    .filter(opt => opt.text != null);

  for (let i = optionsArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
  }

  const shuffledChoices = {};
  const letterMap       = {};
  let newCorrectLetter  = "A";
  optionsArray.forEach((item, index) => {
    const newLetter = letters[index];
    shuffledChoices[newLetter] = item.text;
    letterMap[item.originalLetter] = newLetter;
    if (item.isCorrect) newCorrectLetter = newLetter;
  });

  return {
    topic,
    stem:            p.stem,
    choices:         shuffledChoices,
    correct_answer:  newCorrectLetter,
    explanation:     rewriteExplanationLetters(p.explanation, letterMap),
    content_hash:    hashStem(p.stem),
    exam_level:      level,
    specialty_group: deriveSpecialtyGroup(level, topic),
    blueprint_tag:   topic,
  };
}

// ─── SUPABASE SAVER ───────────────────────────────────────────────────────────
async function saveToSupabase(records) {
  if (!records.length) return { saved: 0, errors: 0 };
  let saved = 0, errors = 0;

  // Insert in chunks of 50 to avoid payload limits
  const CHUNK = 10;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/mcqs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal,resolution=ignore-duplicates"
        },
        body: JSON.stringify(chunk)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`  ⚠️  Supabase chunk error: ${res.status} — ${errText.slice(0, 200)}`);
        errors += chunk.length;
      } else {
        saved += chunk.length;
      }
    } catch (e) {
      console.error(`  ⚠️  Supabase fetch error: ${e.message}`);
      errors += chunk.length;
    }
  }
  return { saved, errors };
}

// ─── BUILD WORK QUEUE ─────────────────────────────────────────────────────────
function buildWorkQueue(count) {
  const levels = FILTER_LEVEL ? [FILTER_LEVEL] : Object.keys(TOPIC_DISTRIBUTION);
  const queue  = [];

  // If a specific topic is requested, just repeat it across allowed levels
  if (FILTER_TOPIC && FILTER_LEVEL) {
    for (let i = 0; i < count; i++) queue.push({ level: FILTER_LEVEL, topic: FILTER_TOPIC });
    return queue;
  }

  // Build a weighted flat list of (level, topic) pairs
  const flat = [];
  for (const level of levels) {
    const topics = TOPIC_DISTRIBUTION[level] || [];
    for (const t of topics) flat.push({ level, topic: t.topic, w: t.weight });
  }
  const totalWeight = flat.reduce((s, f) => s + f.w, 0);

  for (let i = 0; i < count; i++) {
    let rand = Math.random() * totalWeight;
    for (const item of flat) {
      rand -= item.w;
      if (rand < 0) { queue.push({ level: item.level, topic: item.topic }); break; }
    }
  }
  return queue;
}

// ─── COST ESTIMATOR ───────────────────────────────────────────────────────────
function estimateCost(count) {
  const avgInputTokens  = 800;
  const avgOutputTokens = 1100;
  const inputRate  = 3.00  / 1_000_000;  // $3/M
  const outputRate = 15.00 / 1_000_000;  // $15/M
  const discount   = MODE === "batch" ? 0.5 : 1.0;
  const total = count * ((avgInputTokens * inputRate + avgOutputTokens * outputRate) * discount);
  return total.toFixed(2);
}

// ─── SLEEP ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// MODE A — ANTHROPIC BATCH API (cheapest, async)
// ============================================================
async function runBatchMode(queue) {
  console.log(`\n📦  Submitting ${queue.length} requests to Anthropic Batch API...`);

  // Batch API max is 10,000 requests per batch — split if needed
  const BATCH_LIMIT = 10_000;
  const batches = [];
  for (let i = 0; i < queue.length; i += BATCH_LIMIT) {
    batches.push(queue.slice(i, i + BATCH_LIMIT));
  }

  const allRecords = [];

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(`\n  🔵  Batch ${bi + 1}/${batches.length} — ${batch.length} questions`);

    // Build batch requests
    const requests = batch.map((item, idx) => {
      const pd = buildPrompt(item.level, item.topic);
      return {
        custom_id: `mbp-${Date.now()}-${bi}-${idx}`,
        params: {
          model: "claude-sonnet-4-6",
          max_tokens: pd.maxTokens,
          system: pd.systemText,
          tools: [MCQ_TOOL],
          tool_choice: { type: "tool", name: "emit_mcq" },
          messages: [{ role: "user", content: pd.userText + `\n\n[Seed: ${Date.now()}-${idx}]` }],
        },
        // Attach metadata so we can recover level/topic/sex from results
        _meta: { level: item.level, topic: item.topic, sex: pd.randomSex }
      };
    });

    // Separate _meta before sending (not part of API spec)
    const metaMap = {};
    const apiRequests = requests.map(r => {
      metaMap[r.custom_id] = r._meta;
      return { custom_id: r.custom_id, params: r.params };
    });

    // Submit batch
    let batchId;
    try {
      const submitRes = await fetch("https://api.anthropic.com/v1/messages/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "message-batches-2024-09-24"
        },
        body: JSON.stringify({ requests: apiRequests })
      });
      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`Batch submit failed: ${submitRes.status} — ${errText.slice(0, 200)}`);
      }
      const submitData = await submitRes.json();
      batchId = submitData.id;
      console.log(`  ✅  Batch submitted. ID: ${batchId}`);
    } catch (e) {
      console.error(`  ❌  ${e.message}`);
      console.log(`  ↩️  Falling back to standard concurrent mode for this batch...`);
      const fallbackRecords = await runStandardMode(batch, true);
      allRecords.push(...fallbackRecords);
      continue;
    }

    // Poll until complete
    console.log(`  ⏳  Polling for completion (check every 30s)...`);
    let batchStatus = "in_progress";
    let pollCount   = 0;
    while (batchStatus === "in_progress") {
      await sleep(30_000);
      pollCount++;
      try {
        const pollRes  = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
          headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "message-batches-2024-09-24" }
        });
        const pollData = await pollRes.json();
        batchStatus    = pollData.processing_status;
        const counts   = pollData.request_counts || {};
        process.stdout.write(`\r  📊  Poll #${pollCount}: ${counts.succeeded || 0} done, ${counts.processing || 0} processing, ${counts.errored || 0} errored   `);
      } catch (e) {
        console.warn(`\n  ⚠️  Poll error: ${e.message} — retrying...`);
      }
    }
    console.log(`\n  ✅  Batch complete. Fetching results...`);

    // Fetch results (JSONL stream)
    const resultsRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/results`, {
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "message-batches-2024-09-24" }
    });
    const resultsText = await resultsRes.text();
    const lines       = resultsText.trim().split("\n").filter(Boolean);

    let success = 0, failed = 0;
    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.result?.type !== "succeeded") { failed++; continue; }

        const customId = result.custom_id;
        const meta     = metaMap[customId];
        if (!meta) { failed++; continue; }

        const toolBlock = result.result.message?.content?.find(b => b.type === "tool_use" && b.name === "emit_mcq");
        if (!toolBlock?.input) { failed++; continue; }

        const raw = { ...toolBlock.input, _sex: meta.sex };
        const processed = processRawMcq(raw, meta.level, meta.topic);
        if (processed) { allRecords.push(processed); success++; }
        else failed++;
      } catch (e) {
        failed++;
      }
    }
    console.log(`  📋  Parsed: ${success} valid, ${failed} failed/skipped`);
  }

  return allRecords;
}

// ============================================================
// MODE B — STANDARD CONCURRENT CALLS (immediate, no polling)
// ============================================================
async function runStandardMode(queue, silent = false) {
  if (!silent) console.log(`\n⚡  Running ${queue.length} questions with concurrency=${CONCURRENCY}...`);
  const results = [];
  let done = 0;

  async function processItem(item) {
    const pd = buildPrompt(item.level, item.topic);
    const entropySeed = `${Date.now()}-${Math.random()}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: pd.maxTokens,
            temperature: 0.6,
            system: pd.systemText,
            tools: [MCQ_TOOL],
            tool_choice: { type: "tool", name: "emit_mcq" },
            messages: [{ role: "user", content: pd.userText + `\n\n[Seed: ${entropySeed}]` }]
          })
        });
        if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data      = await res.json();
        const toolBlock = data.content?.find(b => b.type === "tool_use" && b.name === "emit_mcq");
        if (!toolBlock?.input) throw new Error("No tool_use block");

        const raw       = { ...toolBlock.input, _sex: pd.randomSex };
        const processed = processRawMcq(raw, item.level, item.topic);
        done++;
        if (!silent) process.stdout.write(`\r  ✅  ${done}/${queue.length} complete   `);
        return processed;
      } catch (e) {
        if (attempt === 1) {
          done++;
          if (!silent) process.stdout.write(`\r  ❌  ${done}/${queue.length} (error: ${e.message.slice(0,40)})   `);
        } else {
          await sleep(2000);
        }
      }
    }
    return null;
  }

  // Process in concurrent windows
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const window  = queue.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(window.map(processItem));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    // Brief pause between windows to avoid sustained rate-limit pressure
    if (i + CONCURRENCY < queue.length) await sleep(2000);
  }

  if (!silent) console.log("");
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     MedBoard Pro — Bulk MCQ Generator            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Mode:         ${MODE === "batch" ? "Anthropic Batch API (50% discount)" : "Standard Concurrent"}`);
  console.log(`  Target count: ${TARGET_COUNT}`);
  console.log(`  Level filter: ${FILTER_LEVEL || "All levels"}`);
  console.log(`  Topic filter: ${FILTER_TOPIC || "Weighted distribution"}`);
  console.log(`  Est. cost:    ~$${estimateCost(TARGET_COUNT)}`);
  console.log("──────────────────────────────────────────────────");

  const queue = buildWorkQueue(TARGET_COUNT);

  // Show distribution preview
  const dist = {};
  queue.forEach(q => { const key = `${q.level} / ${q.topic}`; dist[key] = (dist[key] || 0) + 1; });
  console.log(`\n📊  Question distribution (${queue.length} total):`);
  Object.entries(dist).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([k,v]) => {
    console.log(`     ${v.toString().padStart(3)}x  ${k}`);
  });
  if (Object.keys(dist).length > 15) console.log(`     ... and ${Object.keys(dist).length - 15} more topics`);

  const startMs = Date.now();

  // Generate
  let records;
  if (MODE === "batch") {
    records = await runBatchMode(queue);
  } else {
    records = await runStandardMode(queue);
  }

  const validRecords = records.filter(Boolean);
  console.log(`\n💾  Saving ${validRecords.length} valid questions to Supabase...`);

  const { saved, errors } = await saveToSupabase(validRecords);

  const elapsedSec = Math.round((Date.now() - startMs) / 1000);
  const mins       = Math.floor(elapsedSec / 60);
  const secs       = elapsedSec % 60;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                    SUMMARY                       ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Generated:   ${String(validRecords.length).padEnd(33)}║`);
  console.log(`║  Saved to DB: ${String(saved).padEnd(33)}║`);
  console.log(`║  DB errors:   ${String(errors).padEnd(33)}║`);
  console.log(`║  Time:        ${String(`${mins}m ${secs}s`).padEnd(33)}║`);
  console.log(`║  Est. cost:   $${String(estimateCost(validRecords.length)).padEnd(32)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (errors > 0) {
    console.log("⚠️  Some records failed to save. Check your Supabase RLS policies");
    console.log("   and ensure the 'mcqs' table allows anon INSERT.");
  }
}

main().catch(e => {
  console.error("\n❌  Fatal error:", e.message);
  process.exit(1);
});
