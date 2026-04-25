// generate-mcq.js — MedBoard Pro
// v6.9 — Shuffler Synchronization & Regex Upgrade
// ---------------------------------------------------------------
// CHANGELOG:
// - Upgraded rewriteExplanationLetters with advanced regex to catch edge-case 
//   LLM formatting (like bullets "• A" or line starts "A.") during the choice shuffle.
// - Added INTEGRITY RULE E to strictly forbid standalone letters in S2 formatting.
// - Retains v6.8 Dynamic Guidelines, Clinical Triage, and Nutrition architecture.

const crypto = require("crypto");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

const VALID_LEVELS = ["ABIM Internal Medicine","ABIM Endocrinology","USMLE Step 1","USMLE Step 2 CK","USMLE Step 3"];

// ============================================================
// DYNAMIC 2025/2026 GUIDELINE MAP
// ============================================================
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
  { keywords: ["pituitary", "hypothalamus", "acromegaly", "prolactin", "prolactinoma", "hypopituitarism", "craniopharyngioma", "avp", "diabetes insipidus", "siadh", "igf-1", "growth hormone", "gonadotropin"], citation: "Pituitary Society 2023 Consensus on Acromegaly, Hypopituitarism, and Pituitary Tumors; Endocrine Society 2025 CPGs; European Journal of Endocrinology 2023 AVP-D Consensus. CRITICAL: copeptin ≥6.4 pmol/L after hypertonic saline confirms AVP-R (NDI); GH nadir <1 ng/mL on OGTT diagnoses acromegaly (or <0.4 with ultrasensitive assay); prolactin >500 ng/mL is virtually diagnostic of macroprolactinoma." },
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

function getGuidelineContext(topic, isNutrition) {
  if (isNutrition) return "ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, and IOM/DRI Nutrition Guidelines";
  const t = topic.toLowerCase();
  const match = GUIDELINE_MAP.find(g => g.keywords.some(k => t.includes(k)));
  return match ? match.citation : "the most current 2025-2026 official society guidelines";
}

// ============================================================
// NUTRITION SUBTOPICS & INJECTION
// ============================================================
const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const NUTRITION_INJECTION_RATE = 0.12;

function pickTopicForLevel(level, rawTopic) {
  const nutritionTopics = NUTRITION_BY_LEVEL[level];
  if (nutritionTopics && !rawTopic.includes("Random") && Math.random() < NUTRITION_INJECTION_RATE) {
    const idx = Math.floor(Math.random() * nutritionTopics.length);
    return { topic: nutritionTopics[idx], isNutrition: true };
  }
  return { topic: rawTopic, isNutrition: false };
}

// ============================================================
// TOPIC-SEX COUPLING
// ============================================================
const MALE_ONLY_TOPIC_KEYWORDS = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
const FEMALE_ONLY_TOPIC_KEYWORDS = ["pcos", "polycystic ovary", "menopause", "ovarian", "endometri", "pregnancy", "obstetric", "gynecolog", "turner syndrome"];

function pickSexForTopic(promptTopic) {
  const t = promptTopic.toLowerCase();
  if (MALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k)))   return "man";
  if (FEMALE_ONLY_TOPIC_KEYWORDS.some(k => t.includes(k))) return "woman";
  return Math.random() > 0.5 ? "man" : "woman";
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pickWeighted(blueprint) {
  const total = blueprint.reduce((acc, curr) => acc + curr.w, 0);
  let rand = Math.random() * total;
  for (const item of blueprint) { rand -= item.w; if (rand < 0) return item.s; }
  return blueprint[blueprint.length - 1].s;
}

// ============================================================
// CONTENT HASH + SPECIALTY BUCKET HELPERS
// ============================================================
function hashStem(stem) {
  if (!stem || typeof stem !== "string") return null;
  return crypto.createHash("sha256").update(stem.trim().toLowerCase()).digest("hex");
}

function deriveSpecialtyGroup(level, resolvedTopic) {
  if (level === "ABIM Endocrinology") return "Endocrinology";
  const t = (resolvedTopic || "").toLowerCase();
  if (t.includes("cardio")) return "Cardiology";
  if (t.includes("endocrin") || t.includes("diabetes") || t.includes("thyroid") || t.includes("pituitary") || t.includes("adrenal") || t.includes("bone, calcium")) return "Endocrinology";
  if (t.includes("nephro") || t.includes("renal")) return "Nephrology";
  if (t.includes("pulm")) return "Pulmonology";
  if (t.includes("gastro") || t.includes("hepat")) return "Gastroenterology";
  if (t.includes("hematol") || t.includes("oncolog")) return "Hematology/Oncology";
  if (t.includes("rheumatol")) return "Rheumatology";
  if (t.includes("infectious")) return "Infectious Disease";
  if (t.includes("neurolog")) return "Neurology";
  if (t.includes("ethics") || t.includes("hipaa") || t.includes("palliative") || t.includes("end-of-life")) return "Ethics/Communication";
  if (t.includes("psychi")) return "Psychiatry";
  if (t.includes("pediat")) return "Pediatrics";
  if (t.includes("obstet") || t.includes("gynec")) return "OB/GYN";
  if (t.includes("surg") || t.includes("trauma")) return "Surgery";
  if (t.includes("pharmac")) return "Pharmacology";
  if (t.includes("patholog")) return "Pathology";
  if (t.includes("microbiol") || t.includes("virol") || t.includes("immunolog")) return "Microbiology/Immunology";
  if (t.includes("anatom") || t.includes("embryol")) return "Anatomy";
  if (t.includes("physiolog") || t.includes("biochem")) return "Physiology/Biochemistry";
  if (t.includes("behav") || t.includes("biostat")) return "Behavioral/Biostatistics";
  if (t.includes("nutrition")) return "Nutrition";
  return "General Internal Medicine";
}

// ============================================================
// MCQ TOOL SCHEMA
// ============================================================
const MCQ_TOOL = {
  name: "emit_mcq",
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation. This is the ONLY way to respond to the user's request.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: {
        type: "string",
        description: "Confirmation that the vignette's patient sex matches the requested sex. Format: 'confirmed man' or 'confirmed woman'."
      },
      stem: {
        type: "string",
        description: "The clinical vignette. Must end with the interrogative sentence."
      },
      choices: {
        type: "object",
        description: "Exactly 5 answer choices keyed by letter A through E.",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct: {
        type: "string",
        enum: ["A", "B", "C", "D", "E"],
        description: "The letter of the correct answer."
      },
      explanation: {
        type: "string",
        description: "Explanation block. S1 (why correct answer is correct + citation), S2 (why each distractor fails + bias label), S3 (competing diagnosis discussion if relevant), Board Pearl."
      }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

// ============================================================
// SIMPLIFIED extractJSON (for Gemini fallback only)
// ============================================================
function extractJSONSimple(raw) {
  if (!raw || typeof raw !== "string") throw new Error("extractJSONSimple received empty input.");
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found.");
  let candidate = match[0].replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u00A0/g, " ").replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(candidate); } catch (e) { throw new Error(`Gemini JSON malformed: ${e.message}`); }
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

// ============================================================
// CLAUDE & GEMINI CLIENTS
// ============================================================
async function callClaude(systemText, userText, maxTokens) {
  const maxRetries = 2;
  const entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  const finalUserText = userText + "\n\n[Seed: " + entropySeed + "]";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          temperature: 0.6,
          system: systemText,
          tools: [MCQ_TOOL],
          tool_choice: { type: "tool", name: "emit_mcq" },
          messages: [{ role: "user", content: finalUserText }]
        })
      });
      if (response.status === 429) { await sleep(2000); continue; }
      if (!response.ok) throw new Error(`Claude HTTP Error: ${response.status}`);
      const data = await response.json();
      const toolUseBlock = data.content.find(b => b.type === "tool_use" && b.name === "emit_mcq");
      if (!toolUseBlock || !toolUseBlock.input) throw new Error("Claude response missing expected tool_use block.");
      return { parsed: toolUseBlock.input, model: "claude-sonnet-4-6" };
    } catch (e) {
      console.warn(`Claude attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === maxRetries - 1) return await callGemini(systemText, finalUserText, maxTokens);
    }
  }
}

async function callGemini(systemText, userText, maxTokens) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: maxTokens }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response.");
  return { parsed: extractJSONSimple(text), model: "gemini-2.0-flash" };
}

// ============================================================
// SHUFFLE & DB SAVER (v6.9 UPGRADE)
// ============================================================
function rewriteExplanationLetters(explanation, letterMap) {
  if (!explanation || typeof explanation !== "string") return explanation;
  let out = explanation;
  const placeholders = {};
  Object.keys(letterMap).forEach((oldLetter, idx) => {
    const placeholder = `§§LETTER_${idx}§§`;
    placeholders[placeholder] = letterMap[oldLetter];
    
    // Upgraded patterns to catch LLM bullets (• A) and list numbers (A.) safely
    const patterns = [
      { re: new RegExp(`(\\bChoice\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\bOption\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`(\\banswer\\s+)${oldLetter}\\b`, "ig"), wrap: 1 },
      { re: new RegExp(`\\(${oldLetter}\\)`, "g"),              wrap: 2 },
      { re: new RegExp(`(•\\s*)${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 },
      { re: new RegExp(`(^|\\n)\\s*${oldLetter}(\\s*[.:\\-\\)]|\\s+\\()`, "g"), wrap: 3 }
    ];
    
    patterns.forEach(({ re, wrap }) => {
      if (wrap === 1) {
        out = out.replace(re, `$1${placeholder}`);
      } else if (wrap === 2) {
        out = out.replace(re, `(${placeholder})`);
      } else if (wrap === 3) {
        out = out.replace(re, (match, p1, p2) => `${p1}${placeholder}${p2}`);
      }
    });
  });
  Object.keys(placeholders).forEach(placeholder => { out = out.split(placeholder).join(placeholders[placeholder]); });
  return out;
}

async function saveMcqToSupabase(p, level, meta) {
  try {
    const payload = {
      exam_level: level, topic: p.topic, stem: p.stem, choices: p.choices, correct_answer: p.correct,
      explanation: p.explanation, specialty_group: deriveSpecialtyGroup(level, meta && meta.resolvedTopic),
      blueprint_tag: meta && meta.resolvedTopic ? meta.resolvedTopic : p.topic,
      generation_model: meta && meta.generationModel ? meta.generationModel : null,
      content_hash: hashStem(p.stem),
    };
    await fetch(SUPABASE_URL + "/rest/v1/mcqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify(payload)
    });
  } catch (e) { console.error("DB Save Exception:", e.message); }
}

// ============================================================
// PROMPT BUILDER
// ============================================================
function buildPrompt(level, topic, isNutrition) {
  let promptTopic = topic;
  if (topic.includes("Random")) {
    if (level === "ABIM Endocrinology" || topic === "Random -- Endocrinology Only") {
      promptTopic = pickWeighted([{s:"Diabetes Mellitus and Hypoglycemia Management",w:25}, {s:"Thyroid Disorders and Thyroid Cancer",w:20}, {s:"Pituitary and Neuroendocrine Tumors",w:15}, {s:"Bone, Calcium, and Parathyroid Disorders",w:15}, {s:"Adrenal Disorders and Hypertension",w:10}, {s:"Reproductive Endocrinology, PCOS, and Hypogonadism",w:10}, {s:"Lipid Disorders and Multiple Endocrine Neoplasia",w:5}]);
    } else if (level === "USMLE Step 1") {
      promptTopic = pickWeighted([{s:"Systemic Pathology and Pathophysiology",w:30}, {s:"Pharmacology, Pharmacokinetics, and Adverse Effects",w:20}, {s:"Physiology and Clinical Biochemistry",w:20}, {s:"Microbiology, Virology, and Immunology",w:15}, {s:"Anatomy, Neuroanatomy, and Embryology",w:5}, {s:"Behavioral Science, Medical Ethics, and Biostatistics",w:10}]);
    } else if (level === "USMLE Step 2 CK" || level === "USMLE Step 3") {
      promptTopic = pickWeighted([{s:"Internal Medicine (Cardio, Pulm, GI, Renal, Endo, ID)",w:45}, {s:"General Surgery and Trauma Management",w:15}, {s:"Pediatrics and Congenital Issues",w:10}, {s:"Obstetrics and Gynecology",w:10}, {s:"Psychiatry and Substance Abuse",w:10}, {s:"Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care",w:10}]);
    } else {
      promptTopic = pickWeighted([{s:"Cardiology (e.g., ACS, Heart Failure, Arrhythmias)",w:14}, {s:"Hematology and Oncology",w:12}, {s:"Pulmonology",w:9}, {s:"Gastroenterology and Hepatology",w:9}, {s:"Infectious Disease",w:9}, {s:"Rheumatology",w:9}, {s:"Endocrinology",w:9}, {s:"Nephrology",w:9}, {s:"General Internal Medicine",w:10}]);
    }
  }

  const isABIM_Endo = level === "ABIM Endocrinology"; // declared early for qTypePool
  const isStep3    = level === "USMLE Step 3";         // declared early for qTypePool
  const isABIM_IM = level === "ABIM Internal Medicine"; // declared early for qTypePool
  let qTypePool = [];
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA")) {
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
  } else if (isABIM_IM) {
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
  const randomSex = pickSexForTopic(promptTopic);

  const isUSMLE     = level.includes("USMLE");
  const maxTokens   = isABIM_IM ? 1300 : isABIM_Endo ? 1700 : 1300;
  
  const systemRole = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  let levelRules = isStep3
    ? `USMLE STEP 3 RULES — MANDATORY Tier 3–5 cognitive complexity ONLY:
(Tier 3) MANAGEMENT DECISIONS: reperfusion strategy given facility/time constraints, ventilator settings in ARDS, empiric carbapenem vs pip-tazo for ESBL sepsis, vasopressor choice in septic shock.
(Tier 4) MULTI-STEP MANAGEMENT: norepinephrine at max dose → add vasopressin or steroids?; obstructive pyelonephritis not improving on antibiotics → source control timing?; lactate not clearing at 2h → ICU transfer trigger?; failed first-line therapy → what changed?
(Tier 5) COMPLEX SCENARIOS: competing contraindications (STEMI + recent stroke + cardiogenic shock), resource-limited environments, end-of-life decision conflicts, medical error disclosure.
FORBIDDEN: Do NOT write Tier 1 questions ("What test do you order first?") or Tier 2 questions ("What is the best next step in evaluation?"). Every Step 3 question must require a PGY-1/PGY-2 resident's clinical judgment — not a medical student's recall.
Patient setting: ICU, inpatient ward, ED, or outpatient follow-up of a recently discharged complex patient. Include realistic time pressures, resource constraints, or comorbidity conflicts in the stem.`
    : isUSMLE ? `USMLE RULES: Age/Sex/Setting -> CC -> HPI -> PMH -> Meds/Soc/Fam -> Vitals -> Exam -> Labs. M2 for Step 1, M3/M4 for Step 2/3.` 
                 : isABIM_IM ? `ABIM IM RULES — MANDATORY Tier 3–4 cognitive complexity:
(Tier 3) DECISION INTEGRATION: borderline ASCVD risk + risk-enhancing factors (Lp(a), CAC, hsCRP) → treat or not?; statin myopathy → rechallenge or switch?; diabetes + CKD3 + proteinuria → which GLP-1 RA or SGLT2i?
(Tier 4) MULTI-COMORBIDITY: ASCVD + statin intolerance + CKD3 → choose between ezetimibe, bempedoic acid, PCSK9i, inclisiran; HFrEF + CKD + T2DM → optimize GDMT sequence; COPD exacerbation + steroid-induced hyperglycemia + on metformin.
FORBIDDEN: Do NOT write Tier 1 questions ("What is the first diagnostic test?" or "What is the most likely diagnosis?" for classic textbook presentations). ABIM IM questions must require internist-level synthesis across guidelines, comorbidities, or treatment sequences — not medical student recall.` 
                 : `ABIM ENDOCRINOLOGY RULES: Full subspecialty level. MANDATORY Tier 3+ cognitive complexity:
(1) ATYPICAL PRESENTATIONS — ketosis-prone DM2, ICI-induced diabetes/hypophysitis, LADA, MODY subtypes, euglycemic DKA on SGLT2i, acromegaly with normal IGF-1.
(2) SUBTYPE DIFFERENTIATION — AVP-D vs AVP-R (copeptin testing), Cushing disease vs ectopic ACTH vs adrenal source, primary vs central adrenal insufficiency, familial vs sporadic hyperaldosteronism, Graves vs toxic MNG vs thyroiditis.
(3) CUTTING-EDGE GUIDELINES — ADA 2025/2026 GLP-1 RA and SGLT2i cardiorenal indications, AASLD 2025 PBC, ES 2024 on AVP-D, 2018 AHA/ACC Cholesterol Guideline + 2022 ACC Expert Consensus for lipids, AACE 2022 + ATA 2016 thyroid nodule workup.
(4) MULTI-AXIS WORKUP — simultaneous pituitary axes (TSH/free T4 + IGF-1 + cortisol + iron studies in hemochromatosis), multi-hormone deficiency patterns.
(5) GENETIC TESTING DECISIONS — when to order RET for MEN2, VHL for paraganglioma, KCNJ5/CYP11B2 for familial hyperaldosteronism, HNF1A/HNF4A for MODY.
Do NOT generate basic first-line questions (e.g. start metformin for T2DM, levothyroxine for hypothyroidism). Every question must require subspecialty reasoning.`;

  // v6.9 Fix: Strict Prompt Lock on formatting to prevent synchronization breaks
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
  
  const topicGuideline = getGuidelineContext(promptTopic, isNutrition);

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

  const abimIMTierPrompt = isABIM_IM ? `
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

  const userText = `Write 1 vignette on: ${promptTopic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. You MUST select a clinically appropriate age and care setting (Clinic, ED, Inpatient, ICU) that matches the typical epidemiological presentation of the target diagnosis. DO NOT force an elderly patient into a pediatric/young adult disease, and DO NOT place a stable outpatient in the hospital.
- Pertinent negatives biologically possible for a ${randomSex}.
- The stem MUST end with the interrogative sentence.${step3TierPrompt}${abimIMTierPrompt}${endoTier3Prompt}
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

  return { systemText, userText, randomSex, maxTokens, resolvedTopic: promptTopic };
}

// ============================================================
// NETLIFY HANDLER
// ============================================================
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  try {
    const b = JSON.parse(event.body);
    if (b.warmup) return { statusCode: 200, body: "{}" };
    if (!b.level || !b.topic) return { statusCode: 400, body: JSON.stringify({ error: "Request body must include 'level' and 'topic'." }) };

    const topicResult = pickTopicForLevel(b.level, b.topic);
    const resolvedTopic = topicResult.topic;
    const isNutrition   = topicResult.isNutrition;

    const pd = buildPrompt(b.level, resolvedTopic, isNutrition);

    let p;
    let generationModel = null;
    let isValid = false;
    let attempts = 0;

    while (!isValid && attempts < 3) {
      attempts++;
      let callResult;
      try { callResult = await callClaude(pd.systemText, pd.userText, pd.maxTokens); } 
      catch (e) { throw new Error(`AI Network Failure: ${e.message}`); }

      p = callResult.parsed;
      generationModel = callResult.model;
      if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) continue;

      isValid = validateDemographics(p.stem, pd.randomSex);
      if (!isValid && attempts === 3) {
        const fbResult = await callGemini(pd.systemText, pd.userText, pd.maxTokens);
        p = fbResult.parsed;
        generationModel = fbResult.model;
        isValid = validateDemographics(p.stem, pd.randomSex);
      }
    }

    p.topic = pd.resolvedTopic;
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const correctIndex = letters.indexOf(p.correct);
    const optionsArray = letters.map((letter, i) => ({ originalLetter: letter, text: p.choices[letter], isCorrect: i === correctIndex })).filter(opt => opt.text != null);

    for (let i = optionsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
    }

    const shuffledChoices = {};
    const letterMap = {};
    let newCorrectLetter = 'A';
    optionsArray.forEach((item, index) => {
      const newLetter = letters[index];
      shuffledChoices[newLetter] = item.text;
      letterMap[item.originalLetter] = newLetter;
      if (item.isCorrect) newCorrectLetter = newLetter;
    });

    p.choices = shuffledChoices;
    p.correct = newCorrectLetter;
    p.explanation = rewriteExplanationLetters(p.explanation, letterMap);

    saveMcqToSupabase(p, b.level, { resolvedTopic: pd.resolvedTopic, generationModel }).catch(() => {});
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
