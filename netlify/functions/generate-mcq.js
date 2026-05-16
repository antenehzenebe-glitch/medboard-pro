// generate-mcq.js — MedBoard Pro
// v7.5.4 — Randomization Fix & Serverless Optimization
// ---------------------------------------------------------------
// CHANGELOG:
// - FIXED (v7.5.4): Restored missing NUTRITION_INJECTION_RATE variable to prevent ReferenceError.
// - FIXED: Dynamic routing ensures no hallucination/repetition on "Random" topics.
// - OPTIMIZED: Maintained "fire-and-forget" DB save to prevent Netlify 504 Timeouts.

const crypto = require("crypto");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemVlc2todmt1amlodXZkZGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTQ1MzIsImV4cCI6MjA5MDM5MDUzMn0.xfStX1rfwDc4LpuC--krAEuEFq2RHNac58OIbOm__d0";

const VALID_LEVELS = ["ABIM Internal Medicine","ABIM Endocrinology","USMLE Step 1","USMLE Step 2 CK","USMLE Step 3"];

// ============================================================
// TOPIC GUARDRAIL MAP (Layer 1 + Layer 2 per topic)
// ============================================================
const TOPIC_GUARDRAILS = [
  // ─── ENDOCRINOLOGY: DIABETES CLUSTER ──────────────────────────────────────
  {
    keywords: ["dka", "hhs", "diabetic ketoacidosis", "hyperglycemic hyperosmolar"],
    l1: `DKA/HHS FOUNDATIONAL ANCHORS (ADA 2026):
- Insulin held until K+ ≥3.3 mEq/L. Replace K+ first.
- DKA resolution: glucose <200 + TWO of: AG ≤12, bicarb ≥15, pH ≥7.3.
- Bicarbonate ONLY if pH <6.9.
- Euglycemic DKA on SGLT2i: glucose may be near-normal despite true DKA — anion gap is the key.
- HHS: osmolality typically >320 mOsm/kg, glucose >600 mg/dL, minimal ketosis. Fluid resuscitation primary.`,
    l2: `DKA/HHS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Patient with DKA + K+ 2.9 — what next?", "First step in DKA?", "Best fluid for DKA?"
REQUIRED Tier 3+ angles (pick one):
- IV-to-SQ insulin transition timing post-resolution (overlap duration required)
- Euglycemic DKA recognition on SGLT2i with normal-ish glucose
- Identifying the precipitant in a previously well-controlled T1DM
- Cerebral edema during pediatric DKA management
- HHS vs DKA differentiation in mixed-feature presentation
- Restarting home insulin regimen during the IV-to-SQ transition`
  },
  {
    keywords: ["hypoglycemia", "insulinoma", "whipple"],
    l1: `HYPOGLYCEMIA FOUNDATIONAL ANCHORS (Endocrine Society 2009 Hypoglycemia Guideline, still current):
- Whipple triad required: symptoms + plasma glucose <55 mg/dL + relief with glucose.
- Endogenous hyperinsulinism panel (drawn during a documented hypoglycemic episode, spontaneous or 72-hour fast):
  * Glucose <55 mg/dL
  * Insulin ≥3 µU/mL (≥18 pmol/L)
  * C-peptide ≥0.6 ng/mL (≥0.2 nmol/L)
  * Proinsulin ≥5 pmol/L  (UNITS ARE pmol/L, NOT ng/mL)
  * β-hydroxybutyrate ≤2.7 mmol/L
  * Sulfonylurea/meglitinide screen NEGATIVE
- Insulinoma pattern: insulin ↑, C-peptide ↑, proinsulin ↑, β-OHB suppressed.
- Surreptitious insulin (factitious): insulin ↑ BUT C-peptide SUPPRESSED.
- Surreptitious sulfonylurea: biochemically mimics insulinoma EXCEPT sulfonylurea screen is POSITIVE.
- Non-islet-cell tumor hypoglycemia (big-IGF-2): insulin low, C-peptide low, IGF-1 low, IGF-2 elevated, IGF-2:IGF-1 ratio >10 — usually a large mesenchymal tumor.
- Insulinoma localization: pancreas-protocol CT/MRI first; endoscopic ultrasound if non-localizing; selective arterial calcium stimulation if imaging is negative.
- Post-bariatric (post-RYGB) hypoglycemia is POSTPRANDIAL (not fasting); driven by exaggerated GLP-1 / nesidioblastosis; treat with low-carb diet, acarbose, or GLP-1 antagonist trials.`,
    l2: `HYPOGLYCEMIA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Patient with insulinoma — what is the diagnosis?", "Whipple triad — what does it mean?"
REQUIRED Tier 3+ angles (pick one):
- Insulinoma vs surreptitious sulfonylurea — both have ↑ insulin AND ↑ C-peptide. Sulfonylurea screen is the only test that separates them.
- Insulinoma vs exogenous insulin — both have ↑ insulin. C-peptide separates them (suppressed in exogenous).
- Post-RYGB postprandial hypoglycemia — timing (1–3 hr post meal) and reactive nature.
- Non-islet-cell tumor hypoglycemia — large mesenchymal/hepatic tumor with hypoglycemia and SUPPRESSED insulin/C-peptide.
- Localization sequence when first-line imaging is negative.
- Whipple-triad documentation requirement before workup — patients with unconfirmed symptoms get a 72-hour fast, not a panel during a normoglycemic state.`
  },
  {
    keywords: ["glp-1", "glp1", "semaglutide", "tirzepatide", "liraglutide", "dulaglutide", "wegovy", "ozempic", "mounjaro", "zepbound"],
    l1: `GLP-1 RA FOUNDATIONAL ANCHORS:
- Black Box: contraindicated with personal/family history MTC or MEN2.
- Pancreatitis history = relative contraindication.
- Tirzepatide is dual GIP/GLP-1 agonist.
- Semaglutide has FDA approval for ASCVD risk reduction in T2DM.
- Hold pre-operatively per ASA 2023 (1 week for weekly agents) for aspiration risk.`,
    l2: `GLP-1 RA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Side effects of GLP-1?", "First-line for T2DM with obesity?"
REQUIRED Tier 3+ angles:
- Choosing among agents based on cardiorenal-obesity profile
- Perioperative holding strategy and aspiration risk
- Transitioning between GLP-1 RAs or to dual GIP/GLP-1
- Recognizing gastroparesis precipitated by GLP-1 RA
- Managing GLP-1 RA in CKD across eGFR ranges`
  },
  {
    keywords: ["sglt2", "sglt-2", "empagliflozin", "dapagliflozin", "canagliflozin", "ertugliflozin"],
    l1: `SGLT2 INHIBITOR FOUNDATIONAL ANCHORS (KDIGO 2024):
- eGFR ≥20 + UACR >200 mg/g = Class 1A for renoprotection, INDEPENDENT of T2DM or glycemic indication.
- NEVER dismiss SGLT2i solely on "glycemic inefficacy at low eGFR" when the question concerns cardiorenal benefit.
- eGFR <20: do not initiate; continue if already established and tolerated.
- Hold ≥3-4 days perioperatively (euglycemic DKA risk).
- Mycotic genital infections common; rare Fournier's gangrene reported.`,
    l2: `SGLT2 INHIBITOR COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Mechanism of SGLT2i?", "First-line for T2DM with HF?"
REQUIRED Tier 3+ angles:
- Cardiorenal benefit at low eGFR despite glycemic ineffectiveness
- Choosing among empagliflozin/dapagliflozin/canagliflozin by indication
- Perioperative holding timing and rationale
- Euglycemic DKA recognition during illness or surgery
- Initiation in non-diabetic CKD with proteinuria`
  },
  {
    keywords: ["type 2", "t2dm", "type ii diabetes", "type-2"],
    l1: `T2DM FOUNDATIONAL ANCHORS (ADA 2026):
- Diagnosis: HbA1c ≥6.5%, FPG ≥126 mg/dL, OGTT 2h ≥200 mg/dL, or random ≥200 + symptoms. Confirm on repeat unless symptomatic.
- Cardiorenal-driven add-on: SGLT2i if HF/CKD, GLP-1 RA if ASCVD/obesity (regardless of A1c).
- Metformin: avoid if eGFR <30. Reduce dose at eGFR 30-44.
- Avoid: sulfonylureas in elderly with hypoglycemia; TZDs in NYHA III/IV.`,
    l2: `T2DM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Newly diagnosed T2DM, what to start?", "Diagnosis of T2DM?"
REQUIRED Tier 3+ angles:
- Drug selection in multi-comorbidity (HF + CKD + obesity + ASCVD)
- Deprescribing in elderly with hypoglycemia or limited life expectancy
- Interpreting CGM time-in-range and ambulatory glucose profile
- Adding GLP-1 RA to existing basal insulin regimen
- Steroid-induced hyperglycemia management strategy`
  },
  {
    keywords: ["type 1", "t1dm", "type i diabetes", "type-1", "insulin therapy"],
    l1: `T1DM INSULIN THERAPY FOUNDATIONAL ANCHORS:
- MDI: basal (glargine/degludec) + prandial (lispro/aspart/glulisine).
- Insulin pump: physiologic basal rates with adjustable hourly profile.
- Honeymoon phase reduces insulin needs temporarily but is not remission.
- DKA risk on insulin omission — never tell a T1DM patient to stop basal insulin.`,
    l2: `T1DM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Best basal insulin for T1DM?", "Initial insulin regimen for T1DM?"
REQUIRED Tier 3+ angles:
- Insulin pump-to-MDI transition during hospitalization
- Dawn phenomenon vs Somogyi effect differentiation
- Sick day rules and DKA prevention during illness
- Exercise-induced hypoglycemia prevention for athletes
- Closed-loop AID system troubleshooting`
  },
  {
    keywords: ["cgm", "continuous glucose", "aid system", "closed loop", "ambulatory glucose"],
    l1: `CGM/AID FOUNDATIONAL ANCHORS:
- Time-in-range goal ≥70% (70-180 mg/dL).
- Time-below-range <4% (<70 mg/dL); time below 54 <1%.
- AID systems require accurate basal rates and carb ratios for safe operation.
- Sensor accuracy degraded in DKA, severe dehydration, certain medications (acetaminophen high-dose for older sensors).`,
    l2: `CGM/AID COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is CGM?", "Benefits of CGM?"
REQUIRED Tier 3+ angles:
- Interpreting AGP report with specific glycemic patterns
- Troubleshooting AID system glycemic instability
- Sensor accuracy concerns in DKA or post-operative settings
- Choosing CGM vs flash glucose monitoring by clinical scenario`
  },

  // ─── ENDOCRINOLOGY: THYROID CLUSTER ───────────────────────────────────────
  {
    keywords: ["subclinical hypothyroid", "subclinical hypothyroidism"],
    l1: `SUBCLINICAL HYPOTHYROIDISM FOUNDATIONAL ANCHORS (ATA 2014 + TRUST trial, Stott NEJM 2017):
- DEFINITION: TSH above the reference range with FREE T4 NORMAL.
- CONFIRM WITH REPEAT TESTING in 2–3 months before treating — transient TSH elevations are common (recovery from non-thyroidal illness, recent infection, lab variation).
- TREAT WITH LEVOTHYROXINE IF:
  * TSH >10 mIU/L (any age), OR
  * TSH 7–10 mIU/L AND any of: pregnant or planning pregnancy, hypothyroid symptoms, positive anti-TPO antibodies, age <70 with cardiovascular risk factors.
- DO NOT ROUTINELY TREAT:
  * TSH 4.5–7 mIU/L in adults >70 — TRUST trial showed no benefit, with risk of overtreatment, atrial fibrillation, and bone loss.
  * Mildly elevated TSH during recovery from acute illness — recheck after recovery.
- IN PREGNANCY: trimester-specific TSH targets.
  * First trimester: <2.5 mIU/L.
  * Second/third trimester: <3.0 mIU/L.
  * Treat if TSH > trimester-specific upper limit (typically ~4.0) AND anti-TPO positive, OR TSH >10 regardless of antibodies.
- LEVOTHYROXINE STARTING DOSE:
  * Young, otherwise healthy: full replacement (~1.6 µg/kg/day lean body weight).
  * Elderly or known coronary disease: low and slow (12.5–25 µg/day, titrate).
- ABSORPTION INTERACTIONS (separate by ≥4 hours): PPIs, calcium, iron, soy, coffee. Take levothyroxine on empty stomach, 30–60 min before breakfast.
- DOSE ADJUSTMENTS IN PREGNANCY: increase by ~30% as soon as pregnancy is confirmed in a known hypothyroid patient.`,
    l2: `SUBCLINICAL HYPOTHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Patient with TSH 8 — start levothyroxine?" without nuance.
REQUIRED Tier 3+ angles (pick one):
- 75-YEAR-OLD WITH TSH 6.8 and vague fatigue: per TRUST, do NOT treat. Classic distractor: "Start low-dose levothyroxine."
- PREGNANT PATIENT, TSH 3.2 + anti-TPO POSITIVE: treat to trimester-specific target.
- 32-YEAR-OLD PLANNING PREGNANCY, TSH 4.8: treat to TSH <2.5 BEFORE conception.
- KNOWN HYPOTHYROID PATIENT WITH NEWLY CONFIRMED PREGNANCY: increase dose ~30% immediately, don't wait for next TSH.
- RECOVERY FROM NON-THYROIDAL ILLNESS: mild TSH elevation right after ICU stay — do NOT start replacement; recheck in 2–3 months.
- LEVOTHYROXINE MALABSORPTION WORKUP when TSH won't normalize despite escalating dose: separate PPI/calcium/iron by 4 hours, check celiac and H. pylori, consider liquid or soft-gel formulation.`
  },
  {
    keywords: ["hypothyroidism", "hashimoto", "levothyroxine", "central hypothyroidism", "myxedema"],
    l1: `HYPOTHYROIDISM FOUNDATIONAL ANCHORS:
- Overt hypothyroidism = elevated TSH + LOW free T4.
- Subclinical = elevated TSH + NORMAL free T4. TSH >10 with normal free T4 is still subclinical (grade 2).
- Non-pregnant adult TSH target: 0.4-4.0 mIU/L.
- Pregnancy first trimester TSH target: <2.5 mIU/L.
- Levothyroxine absorption affected by PPI, calcium, iron, soy, food. Take 30-60 min before breakfast.
- TPO antibodies confirm Hashimoto etiology.`,
    l2: `HYPOTHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of hypothyroidism?", "First-line for hypothyroidism?"
REQUIRED Tier 3+ angles:
- Stable patient on levo develops rising TSH — cause hunt (malabsorption, non-compliance, drug interaction, pregnancy, weight gain)
- Levothyroxine dose adjustment in pregnancy
- Central hypothyroidism recognition (low TSH + low free T4)
- Myxedema coma management priorities
- Subclinical treatment threshold for elderly vs young pregnancy-planning patient`
  },
  {
    keywords: ["hyperthyroidism", "graves", "thyrotoxicosis", "methimazole", "propylthiouracil", "ptu", "radioiodine", "rai", "thyroiditis"],
    l1: `HYPERTHYROIDISM FOUNDATIONAL ANCHORS:
- TRAb confirms Graves disease.
- Methimazole first-line for most adults. PTU preferred in T1 pregnancy and thyroid storm only.
- RAI contraindicated in pregnancy, lactation, and active moderate-severe ophthalmopathy.
- Beta-blocker (propranolol or atenolol) for symptom control during workup.
- Subacute thyroiditis: RAIU LOW, often painful goiter, post-viral.`,
    l2: `HYPERTHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of hyperthyroidism?", "First-line for Graves?"
REQUIRED Tier 3+ angles:
- Subacute thyroiditis vs Graves vs factitious differentiation using RAIU
- Antithyroid drug agranulocytosis recognition and management
- RAI-associated worsening of ophthalmopathy mitigation (steroid prophylaxis criteria)
- Postpartum thyroiditis triphasic course recognition
- Choosing definitive therapy: surgery vs RAI vs prolonged ATD`
  },
  {
    keywords: ["thyroid nodule", "thyroid biopsy", "tirads", "bethesda", "fine needle aspiration", "fna thyroid"],
    l1: `THYROID NODULE FOUNDATIONAL ANCHORS (ATA 2015 / TIRADS):
- TSH first. If suppressed → radionuclide scan (hot nodule rarely malignant).
- Ultrasound + ACR TIRADS for all nodules; size + TIRADS category guides FNA.
- Bethesda system guides management:
   I: non-diagnostic — repeat
   II: benign — surveillance
   III: AUS — molecular testing or repeat FNA
   IV: FN/SFN — molecular testing or lobectomy
   V: suspicious for malignancy — surgery
   VI: malignant — surgery`,
    l2: `THYROID NODULE COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Next step in thyroid nodule?", "When to biopsy a nodule?"
REQUIRED Tier 3+ angles:
- Bethesda III/IV management decision (molecular testing vs repeat FNA vs lobectomy)
- Incidentally found nodule in patient already on levothyroxine
- Hot nodule management (toxic adenoma) treatment options
- Nodule in pregnancy management and timing`
  },
  {
    keywords: ["thyroid cancer", "papillary thyroid", "follicular thyroid", "medullary thyroid", "anaplastic thyroid", "differentiated thyroid", "thyroglobulin", "rair", "lenvatinib", "sorafenib", "vandetanib", "cabozantinib", "selpercatinib"],
    l1: `THYROID CANCER FOUNDATIONAL ANCHORS (ATA 2025):
- RAIR (radioiodine-refractory) requires DOCUMENTED RAI failure or ineligibility: no uptake, progression within 12mo, or cumulative ≥600 mCi. Patient REFUSAL of RAI is NOT RAIR.
- Kinase inhibitors require RECIST 1.1 measurable STRUCTURAL disease — NEVER initiate for biochemically occult disease (rising Tg, no structural lesion).
- Vandetanib and cabozantinib: MTC only. Selpercatinib: RET fusion/mutation confirmed only.
- ATA and ESMO are SEPARATE organizations; do NOT cite "ATA/ESMO joint guidelines" — they do not exist.`,
    l2: `THYROID CANCER COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First-line for papillary thyroid cancer?", "Treatment of MTC?"
REQUIRED Tier 3+ angles:
- ATA 2025 TSH suppression de-escalation for low-risk patients
- Biochemical recurrence (rising Tg) with NEGATIVE structural imaging — workup, NOT immediate kinase inhibitor
- MTC family screening cascade and prophylactic thyroidectomy timing
- Anaplastic vs poorly differentiated management urgency
- Choosing between lenvatinib and sorafenib in true RAIR-DTC with structural disease`
  },
  {
    keywords: ["thyroid storm", "thyrotoxic crisis", "burch-wartofsky"],
    l1: `THYROID STORM FOUNDATIONAL ANCHORS (American Thyroid Association 2016 — still current):
- DIAGNOSIS IS CLINICAL. Burch–Wartofsky score ≥45 highly suggestive; 25–44 suggestive. Do NOT delay treatment for confirmatory labs.
- SEQUENCE OF PHARMACOLOGIC THERAPY — ORDER MATTERS BECAUSE OF MECHANISM:
  1. BLOCK SYNTHESIS: thionamide first.
     * PTU preferred in storm — 500–1000 mg load, then 250 mg PO/NG q4h. PTU also blocks peripheral T4→T3 conversion (D1 deiodinase inhibition).
     * Methimazole acceptable if PTU unavailable (60–80 mg/day).
  2. BLOCK RELEASE: iodine — SSKI 5 drops PO q6h or Lugol's solution. Give AT LEAST 30–60 MINUTES AFTER the thionamide.
     RATIONALE: giving iodine before blocking synthesis triggers Jod-Basedow / paradoxical hormone release from preformed stores in the gland.
  3. BLOCK ADRENERGIC TONE & PERIPHERAL CONVERSION:
     * Propranolol IV 0.5–1 mg or PO 60–80 mg q4h (non-selective; also blocks T4→T3 conversion).
     * Esmolol if hemodynamically tenuous or reduced LVEF.
  4. CORTICOSTEROIDS: hydrocortisone 100 mg IV q8h. Covers possible relative adrenal insufficiency AND blocks peripheral T4→T3 conversion.
  5. SUPPORTIVE & PRECIPITANT: cooling for hyperpyrexia; aggressive volume resuscitation; identify and treat precipitant (infection, surgery, iodine contrast, untreated DKA, missed thionamide).
- PTU IS PREFERRED IN STORM AND IN FIRST-TRIMESTER PREGNANCY (methimazole → aplasia cutis / methimazole embryopathy).
- METHIMAZOLE IS PREFERRED in non-storm second/third-trimester pregnancy and in non-pregnant outpatients (PTU has hepatotoxicity risk).`,
    l2: `THYROID STORM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First step in thyroid storm?", "Best treatment for thyroid storm?"
REQUIRED Tier 3+ angles (pick one):
- THE SEQUENCE: thionamide BEFORE iodine — and WHY (synthesis must be blocked before release). Distractor: "Give SSKI immediately."
- WHY PTU OVER METHIMAZOLE IN STORM: additional block of T4→T3 conversion.
- APATHETIC THYROID STORM in the elderly: presents as cardiac decompensation (CHF, AF with RVR, weight loss) WITHOUT classic hyperthermia or agitation. Easy to miss.
- AMIODARONE-INDUCED THYROTOXICOSIS:
  * Type 1 (iodine-induced, underlying nodular disease, ↑ vascularity on Doppler) → thionamide.
  * Type 2 (destructive thyroiditis, no vascularity) → corticosteroids.
  * When uncertain, treat for BOTH.
- BETA-BLOCKER CHOICE when LVEF is reduced: esmolol > propranolol; in decompensated HF, beta-blockade can precipitate cardiogenic shock.
- REFRACTORY STORM: plasmapheresis or emergency thyroidectomy after at least 5–7 days of medical therapy.`
  },

  // ─── ENDOCRINOLOGY: ADRENAL CLUSTER ───────────────────────────────────────
  {
    keywords: ["cushing", "hypercortisolism", "ectopic acth", "bipss", "petrosal sinus"],
    l1: `CUSHING'S FOUNDATIONAL ANCHORS:
- Screening tests: 1mg overnight DST OR 24h UFC OR late-night salivary cortisol.
- 8mg DST is NOT a standard screening test (legacy localization tool, largely obsolete).
- ACTH <10 pg/mL = ACTH-independent (adrenal source).
- ACTH >20 pg/mL = ACTH-dependent (pituitary or ectopic).
- BIPSS required for localization when MRI shows lesion <6mm or no lesion: central:peripheral ACTH ratio ≥2 basal or ≥3 post-CRH = pituitary source.
- MRI finding of ≥10mm microadenoma does NOT replace BIPSS for localization.
- Pseudo-Cushing's mimics: depression, alcohol use, severe obesity.`,
    l2: `CUSHING'S COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of Cushing's?", "Screening for Cushing's?"
REQUIRED Tier 3+ angles:
- Cyclic Cushing's recognition with intermittently normal screens
- Ectopic ACTH workup when BIPSS shows no central:peripheral gradient
- Post-op cortisol management after pituitary surgery (replacement, recovery timeline)
- Recurrence after transsphenoidal surgery — surgical re-exploration vs medical therapy
- Discriminating pseudo-Cushing's from mild Cushing's with dexamethasone-CRH test`
  },
  {
    keywords: ["primary aldosteronism", "hyperaldosteronism", "conn syndrome", "adrenal vein sampling", "avs", "spironolactone", "eplerenone"],
    l1: `PRIMARY ALDOSTERONISM FOUNDATIONAL ANCHORS:
- Screening: ARR >30 (ng/dL per ng/mL/hr).
- Confirmatory test required before AVS: oral salt loading, IV saline infusion, fludrocortisone suppression, or captopril challenge.
- AVS required pre-surgery in ALL patients >35 years to lateralize. CT alone insufficient.
- Spironolactone interferes with ARR — washout 4-6 weeks before testing.
- Unilateral adenoma → adrenalectomy. Bilateral hyperplasia → MRA (spironolactone or eplerenone).`,
    l2: `PRIMARY ALDOSTERONISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Screening test for PA?", "Treatment of Conn syndrome?"
REQUIRED Tier 3+ angles:
- AVS interpretation: lateralization ratio ≥4:1 post-ACTH stimulation
- Failed AVS (non-dominant vein cannulation) — repeat vs alternative options
- Spironolactone-on-board patient — washout vs MRA-sparing testing
- Refractory PA on max MRA — adding amiloride vs surgical reconsideration
- Familial hyperaldosteronism types and genetic testing`
  },
  {
    keywords: ["pheochromocytoma", "paraganglioma", "metanephrine", "phenoxybenzamine", "doxazosin", "men2 pheo", "vhl pheo", "sdh"],
    l1: `PHEOCHROMOCYTOMA FOUNDATIONAL ANCHORS:
- Biochemical first-line: plasma free metanephrines OR 24h urine fractionated metanephrines.
- Alpha blockade (phenoxybenzamine or doxazosin) MUST precede beta blockade by 10-14 days.
- Starting beta-blocker first → unopposed alpha → hypertensive crisis. Never do this.
- Volume expansion preoperatively (high-salt diet, sometimes IV fluids).
- Genetic testing in ALL pheo/paraganglioma patients: MEN2 (RET), VHL, SDH-related, NF1.`,
    l2: `PHEOCHROMOCYTOMA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of pheochromocytoma?", "Diagnosis of pheo?"
REQUIRED Tier 3+ angles:
- Pheo crisis management acute blockade strategy
- Paraganglioma vs pheo workup and imaging differences (DOTATATE PET for paraganglioma)
- Pregnancy management timing of surgery
- MEN2 surveillance protocol after RET mutation identification
- Incidentaloma workup distinguishing pheo from non-functioning adenoma`
  },
  {
    keywords: ["adrenal incidentaloma", "adrenal mass", "adrenal nodule", "incidental adrenal"],
    l1: `ADRENAL INCIDENTALOMA FOUNDATIONAL ANCHORS (AACE/ACE/ESE 2023 update):
- Definition: ≥1 cm adrenal mass found on imaging done for another reason.
- IMAGING CHARACTERIZATION (non-contrast CT):
  * ≤10 Hounsfield units → lipid-rich benign adenoma. No further imaging.
  * 11–20 HU → indeterminate; do absolute washout (>60% = benign) OR chemical-shift MRI.
  * >20 HU + low washout → suspicious; pursue biochemical workup AND consider resection.
- BIOCHEMICAL WORKUP — perform on EVERY adrenal incidentaloma regardless of HU:
  * 1 mg overnight dexamethasone suppression test: cortisol >1.8 µg/dL = possible mild autonomous cortisol secretion (MACS); >5 µg/dL = autonomous secretion.
  * Plasma free metanephrines OR 24-hour urine metanephrines — rule out pheochromocytoma.
  * Plasma aldosterone-to-renin ratio — ONLY if patient is hypertensive or hypokalemic.
  * DHEA-S — only when imaging suggests adrenocortical carcinoma (heterogeneous, >4 cm, high HU).
- SURGICAL INDICATIONS (any one):
  * Size >4 cm.
  * Imaging features suspicious for malignancy: heterogeneous, >20 HU, washout <60%, growth >5 mm/year.
  * Biochemically functional: pheo, primary aldosteronism, Cushing.
- PHEOCHROMOCYTOMA PRE-OP RULE: ALPHA-blockade (phenoxybenzamine or doxazosin) for 7–14 days BEFORE beta-blockade and BEFORE surgery. NEVER beta-block first — unopposed alpha tone causes hypertensive crisis.
- DO NOT biopsy an adrenal mass without ruling out pheochromocytoma first (catecholamine storm risk). Biopsy is generally reserved for suspected metastasis in a patient with a known extra-adrenal primary.`,
    l2: `ADRENAL INCIDENTALOMA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is the most likely diagnosis?" when the case obviously states "incidentaloma."
REQUIRED Tier 3+ angles (pick one):
- MILD AUTONOMOUS CORTISOL SECRETION (MACS): 1-mg DST cortisol 1.9–5.0 µg/dL. Decision to resect vs. monitor turns on cardiometabolic comorbidities (HTN, T2DM, osteoporosis, dyslipidemia).
- PRE-OPERATIVE PHEOCHROMOCYTOMA BLOCKADE: sequence (alpha first), duration (7–14 days), volume expansion, target BP, role of calcium-channel blocker only if BP still high after adequate alpha-blockade.
- BILATERAL adrenal masses → CAH, bilateral metastases, primary bilateral macronodular hyperplasia, infiltrative disease — different workup.
- ADRENOCORTICAL CARCINOMA suspicion: >4 cm, heterogeneous, >20 HU, rapid growth, mixed functional pattern (cortisol + DHEA-S + androgens).
- WHY NOT BIOPSY FIRST: rule out pheo first; biopsy almost never changes management in primary adrenal disease.`
  },
  {
    keywords: ["adrenal insufficiency", "addison", "cortisol deficiency", "secondary adrenal", "acth stim test", "cosyntropin"],
    l1: `ADRENAL INSUFFICIENCY FOUNDATIONAL ANCHORS:
- Primary (Addison): ↓cortisol, ↑ACTH, ↑renin, ↓aldosterone, hyperpigmentation, hyponatremia + hyperkalemia.
- Secondary: ↓cortisol, ↓ACTH, NORMAL aldosterone (RAAS intact), no hyperpigmentation.
- ACTH stimulation test confirms primary (cortisol <18 µg/dL at 30/60 min).
- Adrenal crisis: stress-dose hydrocortisone (100mg IV) IMMEDIATELY — do not wait for confirmation.
- Steroid-induced HPA suppression: any chronic exogenous steroid >3 weeks.`,
    l2: `ADRENAL INSUFFICIENCY COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of Addison's?", "Treatment of adrenal crisis?"
REQUIRED Tier 3+ angles:
- Steroid-induced HPA suppression recovery timeline and tapering
- Stress dosing rules for surgery, illness, dental procedures
- Adrenal crisis precipitants in known AI patient (missed dose, infection, surgery)
- Mineralocorticoid replacement adjustment with hot weather/exercise
- Distinguishing primary vs secondary AI in newly diagnosed patient`
  },

  // ─── ENDOCRINOLOGY: PITUITARY CLUSTER ─────────────────────────────────────
  {
    keywords: ["prolactinoma", "hyperprolactinemia", "cabergoline", "bromocriptine", "macroprolactin", "stalk effect"],
    l1: `PROLACTINOMA FOUNDATIONAL ANCHORS:
- Cabergoline first-line (better tolerability and efficacy than bromocriptine; bromocriptine preferred in pregnancy planning due to longer safety record).
- Stalk effect from non-prolactinoma compressing stalk: prolactin elevated but typically <100 ng/mL.
- Hook effect at very high prolactin (>1000): assay underestimates — must dilute sample.
- Macroprolactin: inactive complex causing lab elevation without clinical disease.
- Macroadenoma >1 cm; surveillance with MRI.`,
    l2: `PROLACTINOMA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First-line for prolactinoma?", "Diagnosis of prolactinoma?"
REQUIRED Tier 3+ angles:
- Cabergoline-resistant macroadenoma — surgery vs higher-dose vs alternative agent
- Pregnancy management of macroprolactinoma (when to stop, surveillance)
- Dopamine agonist withdrawal criteria after biochemical and radiologic remission
- Valve disease screening on long-term high-dose cabergoline
- Hook effect recognition in massively elevated prolactin`
  },
  {
    keywords: ["acromegaly", "growth hormone excess", "octreotide", "lanreotide", "pegvisomant", "igf-1 elevation"],
    l1: `ACROMEGALY FOUNDATIONAL ANCHORS:
- GH nadir <1 ng/mL on 75g OGTT diagnoses acromegaly.
- IGF-1 used for diagnosis and monitoring.
- Transsphenoidal surgery first-line for most.
- Somatostatin analogs (octreotide, lanreotide) for post-op residual or non-surgical candidates.
- Pegvisomant (GH receptor antagonist) for resistant cases — IGF-1 monitoring, NOT GH (pegvisomant interferes with GH assay).`,
    l2: `ACROMEGALY COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of acromegaly?", "First-line for acromegaly?"
REQUIRED Tier 3+ angles:
- Post-op residual disease management algorithm
- Somatostatin analog resistance — pegvisomant vs pasireotide vs surgery re-exploration
- Cardiac and colon cancer screening recommendations
- Monitoring acromegaly on pegvisomant (IGF-1 only)
- Pituitary apoplexy presenting in undiagnosed acromegaly`
  },
  {
    keywords: ["hypopituitarism", "panhypopituitarism", "sheehan", "pituitary apoplexy", "empty sella"],
    l1: `HYPOPITUITARISM FOUNDATIONAL ANCHORS:
- Replace cortisol BEFORE thyroid hormone (giving levothyroxine first can precipitate adrenal crisis by accelerating cortisol clearance).
- Sheehan syndrome: postpartum pituitary infarction following severe hemorrhage and hypotension.
- Empty sella usually asymptomatic and incidental.
- Pituitary apoplexy: acute headache + visual change + hypopituitarism = neurosurgical emergency requiring stress-dose steroids first.`,
    l2: `HYPOPITUITARISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is hypopituitarism?", "Hormone replacement order?"
REQUIRED Tier 3+ angles:
- Pituitary apoplexy recognition and immediate management priorities
- GH replacement decision in adults — when indicated, monitoring
- Post-radiation pituitary failure timeline (years to decades)
- Hormone replacement adjustment during pregnancy
- Sheehan presenting years later with subtle features`
  },
  {
    keywords: ["diabetes insipidus", "avp-d", "avp-r", "central di", "nephrogenic di", "desmopressin", "ddavp", "copeptin", "water deprivation"],
    l1: `DIABETES INSIPIDUS FOUNDATIONAL ANCHORS:
- Hypertonic saline-stimulated copeptin >6.4 pmol/L confirms AVP-R (nephrogenic DI).
- Hypertonic saline-stimulated copeptin <4.9 pmol/L confirms AVP-D (central DI).
- Desmopressin response distinguishes central (responds) from nephrogenic (does not).
- Hypertonic saline-stimulated copeptin has largely replaced classic water deprivation test in many centers.
- Lithium causes nephrogenic DI; gestational DI from placental vasopressinase.`,
    l2: `DIABETES INSIPIDUS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of DI?", "Treatment of central DI?"
REQUIRED Tier 3+ angles:
- Primary polydipsia vs partial central DI differentiation
- Post-pituitary-surgery triphasic response recognition (DI → SIADH → permanent DI)
- Lithium-induced nephrogenic DI management without stopping lithium
- Gestational DI management and postpartum resolution
- Adipsic central DI (osmoreceptor dysfunction) management challenges`
  },

  // ─── ENDOCRINOLOGY: BONE & CALCIUM CLUSTER ────────────────────────────────
  {
    keywords: ["hyperparathyroidism", "primary hyperparathyroidism", "parathyroidectomy", "fhh", "familial hypocalciuric"],
    l1: `HYPERPARATHYROIDISM FOUNDATIONAL ANCHORS:
- Primary HPT: ↑Ca + ↑PTH (or inappropriately normal PTH for the calcium level).
- 24h urine calcium DISTINGUISHES primary HPT from FHH (calcium/creatinine clearance ratio <0.01 in FHH).
- Surgery indications (any one): symptomatic, age <50, Ca >1 mg/dL above ULN, eGFR <60, T-score ≤-2.5, vertebral fracture, kidney stones, 24h urine Ca >400.
- Sestamibi scan + neck ultrasound for preoperative localization.
- Hungry bone syndrome post-parathyroidectomy: severe hypocalcemia from rapid bone uptake.`,
    l2: `HYPERPARATHYROIDISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of primary hyperparathyroidism?"
REQUIRED Tier 3+ angles:
- Normocalcemic primary hyperparathyroidism workup and treatment threshold
- FHH differentiation when 24h urine calcium is borderline
- Post-parathyroidectomy hungry bone syndrome management
- Calcimimetics (cinacalcet) in non-surgical candidates or parathyroid carcinoma
- Tertiary hyperparathyroidism in CKD or post-transplant`
  },
  {
    keywords: ["hypercalcemia", "malignant hypercalcemia", "pthrp", "calcitonin", "denosumab hypercalcemia", "milk alkali"],
    l1: `HYPERCALCEMIA FOUNDATIONAL ANCHORS:
- PTH-mediated (high or inappropriately normal PTH): primary HPT, FHH, lithium.
- PTH-independent (low PTH): malignancy (PTHrP, osteolytic, 1,25-D), granulomatous (1,25-D), vitamin D toxicity, milk-alkali, immobilization.
- Treatment: IV fluids first, then bisphosphonate (4-7 day onset) + calcitonin (rapid but tachyphylaxis at 48h).
- Denosumab if renal failure (bisphosphonate contraindicated at low eGFR).
- Granulomatous hypercalcemia (sarcoid, TB) responds to corticosteroids.`,
    l2: `HYPERCALCEMIA COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First step in hypercalcemia?", "Treatment of malignant hypercalcemia?"
REQUIRED Tier 3+ angles:
- Hypercalcemia in CKD — denosumab vs cinacalcet vs reduced bisphosphonate dosing
- Refractory malignant hypercalcemia after bisphosphonate failure
- Granulomatous disease (1,25-D mediated) recognition and steroid response
- Milk-alkali syndrome differentiation from primary HPT
- Hypercalcemia of immobilization in young patient with spinal cord injury`
  },
  {
    keywords: ["osteoporosis", "fracture risk", "frax", "bisphosphonate", "denosumab", "teriparatide", "abaloparatide", "romosozumab", "atypical femur fracture"],
    l1: `OSTEOPOROSIS FOUNDATIONAL ANCHORS (AACE 2025):
- Treatment threshold: T-score ≤-2.5, OR T -1.0 to -2.5 + FRAX 10-yr major osteoporotic fracture ≥20% or hip fracture ≥3%.
- Bisphosphonate holiday: after 5 years oral / 3 years IV zoledronic acid — reassess. High-risk patients continue.
- Denosumab discontinuation REQUIRES bridging with bisphosphonate to prevent rebound vertebral fractures.
- Romosozumab BLACK BOX: contraindicated if MI or stroke within prior 12 months.
- Teriparatide and abaloparatide: maximum 2 years lifetime use.
- Sequential therapy: anabolic (teriparatide/abaloparatide/romosozumab) → followed by antiresorptive to maintain gains.`,
    l2: `OSTEOPOROSIS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of osteoporosis?", "When to start bisphosphonate?"
REQUIRED Tier 3+ angles:
- Sequential therapy after 2 years of teriparatide — what comes next
- Denosumab-to-bisphosphonate transition timing (within 6 months of last dose)
- Atypical femur fracture on long-term bisphosphonate — drug change strategy
- Treatment in CKD G4-G5 (denosumab vs reduced-dose bisphosphonate)
- Romosozumab eligibility decision in patient with prior MI`
  },

  // ─── ENDOCRINOLOGY: REPRODUCTIVE CLUSTER ──────────────────────────────────
  {
    keywords: ["pcos", "polycystic ovary"],
    l1: `PCOS FOUNDATIONAL ANCHORS (2023 International Guideline):
- Rotterdam criteria: 2 of 3 — oligo/anovulation, clinical/biochemical hyperandrogenism, polycystic ovaries on ultrasound.
- Metformin for insulin resistance.
- Combined OC (preferring non-androgenic progestogen) for menstrual regulation and androgen suppression.
- Spironolactone for hirsutism (with reliable contraception due to teratogenicity).
- Letrozole first-line for ovulation induction (superior to clomiphene).
- BP ≥140/90 = relative contraindication to estrogen-containing contraceptives.
- Avoid androgenic progestogens (levonorgestrel) in metabolically complex PCOS.`,
    l2: `PCOS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of PCOS?", "First-line for PCOS?"
REQUIRED Tier 3+ angles:
- Drug selection in metabolically complex PCOS (CKD, dyslipidemia, hypertension)
- Ovulation induction failure escalation (letrozole → clomiphene → gonadotropins → IVF)
- NIH vs Rotterdam phenotype implications for cardiometabolic risk
- Post-fertility transition management (long-term endometrial protection)
- Choosing OC formulation when androgenic burden is concerning`
  },
  {
    keywords: ["male hypogonadism", "low testosterone", "trt", "testosterone replacement", "kallmann", "klinefelter"],
    l1: `MALE HYPOGONADISM FOUNDATIONAL ANCHORS (Endocrine Society 2018):
- TWO morning total testosterone measurements (conventional threshold ~300 ng/dL).
- LH/FSH distinguishes primary (elevated) from secondary (low or inappropriately normal).
- Iron studies for hemochromatosis if secondary.
- SHBG affects total T interpretation — measure free T or calculated free T when SHBG abnormal.
- TRT contraindications: untreated polycythemia (Hct >54%), prostate cancer, severe LUTS, untreated severe OSA, breast cancer, planned fertility.`,
    l2: `MALE HYPOGONADISM COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of hypogonadism?", "First-line for low T?"
REQUIRED Tier 3+ angles:
- Fertility-preserving alternatives to TRT (clomiphene, hCG, aromatase inhibitors)
- Monitoring during TRT (Hct, PSA, lipids, T levels)
- Age-appropriate testosterone targets and treatment threshold debate
- Klinefelter management beyond testosterone (cardiometabolic, fertility counseling)
- Distinguishing primary vs secondary hypogonadism workup`
  },

  // ─── ENDOCRINOLOGY: MEN & NET CLUSTER ─────────────────────────────────────
  {
    keywords: ["men1", "multiple endocrine neoplasia type 1", "wermer"],
    l1: `MEN1 FOUNDATIONAL ANCHORS:
- Triad: parathyroid hyperplasia (>90%), pituitary tumors, pancreatic NETs (gastrinoma most common).
- Genetic testing index case + first-degree relatives.
- Parathyroidectomy = SUBTOTAL (3.5 gland) due to multi-gland hyperplasia, not adenoma.
- Annual screening: calcium/PTH, prolactin, IGF-1, gastrin, fasting insulin/glucose, cross-sectional pancreas imaging.`,
    l2: `MEN1 COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is MEN1?", "Triad of MEN1?"
REQUIRED Tier 3+ angles:
- Surveillance interval choices for asymptomatic mutation carriers
- Family member screening cascade and age to start
- Gastrinoma management within MEN1 (often multifocal, surgery debate)
- Pituitary tumor management nuances when MEN1 versus sporadic`
  },
  {
    keywords: ["men2", "men 2a", "men 2b", "ret mutation", "prophylactic thyroidectomy"],
    l1: `MEN2 FOUNDATIONAL ANCHORS:
- RET proto-oncogene mutation. MTC universal — prophylactic thyroidectomy required.
- MEN2B: aggressive MTC + mucosal neuromas + marfanoid habitus → thyroidectomy in INFANCY (before 1 year).
- MEN2A: pheochromocytoma (40%), primary hyperparathyroidism. Prophylactic thyroidectomy timing per RET codon risk stratification.
- Pheo screening MANDATORY before any surgery or pregnancy in known MEN2.
- Calcitonin and CEA surveillance post-thyroidectomy.`,
    l2: `MEN2 COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is MEN2?", "Genetics of MEN2?"
REQUIRED Tier 3+ angles:
- Prophylactic thyroidectomy timing based on RET codon ATA risk category
- Pre-operative pheochromocytoma workup as mandatory step
- Post-thyroidectomy calcitonin/CEA surveillance interpretation
- Family genetic counseling cascade and pediatric screening
- Selpercatinib in RET-mutant advanced MTC`
  },

  // ─── INTERNAL MEDICINE CLUSTER (high-error topics) ────────────────────────
  {
    keywords: ["acs", "stemi", "nstemi", "acute coronary", "myocardial infarction"],
    l1: `ACS FOUNDATIONAL ANCHORS (ACC/AHA 2025):
- STEMI: PCI within 90 minutes (door-to-balloon). Fibrinolysis if PCI unavailable within 120 min.
- NSTEMI high-risk: early invasive strategy within 24 hours.
- DAPT (aspirin + P2Y12 inhibitor) for 12 months minimum post-ACS unless prohibitive bleeding.
- HIT: argatroban (hepatic clearance) preferred if renal impairment; bivalirudin or fondaparinux for renal impairment without HIT. NEVER heparin in confirmed HIT.`,
    l2: `ACS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of STEMI?", "Treatment of NSTEMI?"
REQUIRED Tier 2-3 angles:
- Antiplatelet selection by bleeding risk (HBR criteria, ARC-HBR)
- PCI vs CABG decision in multivessel disease
- DAPT duration shortening in HBR patients
- Post-ACS GDMT optimization (statin + ACEi/ARB + BB + MRA in HFrEF)`
  },
  {
    keywords: ["heart failure", "hfref", "hfpef", "cardiomyopathy", "arni", "sacubitril"],
    l1: `HEART FAILURE FOUNDATIONAL ANCHORS (ACC/AHA 2022):
- HFrEF (EF <40%): Four pillars = ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i.
- ARNI superior to ACEi alone — DO NOT combine ARNI with ACEi (angioedema risk; 36-hour washout required).
- HFpEF (EF ≥50%): SGLT2i Class 2a recommendation.
- Avoid in HFrEF: NSAIDs, non-DHP CCBs (verapamil/diltiazem), TZDs (pioglitazone) in NYHA III/IV.`,
    l2: `HEART FAILURE COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of HFrEF?", "What is HFpEF?"
REQUIRED Tier 2-3 angles:
- GDMT optimization in CKD/hypotension/hyperkalemia (titration order, finerenone option)
- ARNI initiation timing post-decompensation
- ICD/CRT eligibility decision based on EF, QRS, and clinical course
- Advanced HF transition criteria for transplant/LVAD evaluation`
  },
  {
    keywords: ["atrial fibrillation", "afib", "anticoagulation af", "doac", "cha2ds2", "ablation"],
    l1: `ATRIAL FIBRILLATION FOUNDATIONAL ANCHORS:
- CHA2DS2-VASc ≥2 (men) or ≥3 (women) → anticoagulation indicated.
- DOACs preferred over warfarin EXCEPT mechanical valves and moderate-to-severe mitral stenosis (warfarin only).
- Rate vs rhythm: most patients fine with rate control; early rhythm control benefit shown in EAST-AFNET 4.
- Reversal: idarucizumab for dabigatran; andexanet alfa for apixaban/rivaroxaban.`,
    l2: `ATRIAL FIBRILLATION COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Anticoagulation in AF?", "Rate vs rhythm in AF?"
REQUIRED Tier 2-3 angles:
- DOAC dose selection in CKD or hemodialysis
- Peri-procedural management (when to hold and bridge)
- Recurrent AF after ablation — repeat ablation vs antiarrhythmic
- Stroke despite anticoagulation — workup and management change`
  },
  {
    keywords: ["sepsis", "septic shock", "norepinephrine", "vasopressin", "ssc"],
    l1: `SEPSIS FOUNDATIONAL ANCHORS (SSC 2021/2025):
- Norepinephrine = first-line vasopressor.
- Add vasopressin (up to 0.03 units/min) BEFORE escalating to epinephrine or dopamine.
- Hydrocortisone ONLY for refractory septic shock (not responding to adequate fluids + 2 vasopressors).
- Cultures before antibiotics — but do NOT delay antibiotics >1 hour to obtain cultures.
- Procalcitonin guides antibiotic de-escalation, not initiation.`,
    l2: `SEPSIS COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First step in sepsis?", "First-line vasopressor?"
REQUIRED Tier 2-3 angles:
- Vasopressor escalation sequence and indications for each
- Fluid resuscitation modification in HF or cirrhosis
- Source control failure recognition and re-evaluation
- Antibiotic de-escalation timing using procalcitonin and clinical course`
  },
  {
    keywords: ["lipid", "dyslipidemia", "statin", "ascvd", "pcsk9", "ezetimibe", "bempedoic"],
    l1: `LIPID FOUNDATIONAL ANCHORS (AHA 2024):
- Use PREVENT calculator (race-neutral, includes kidney function). PCE (2013) is LEGACY.
- LDL not at goal on max-tolerated statin: add ezetimibe → add PCSK9i.
- Bempedoic acid: option for statin-intolerant patients.
- Statin myopathy: CK >10x ULN = discontinue. Always rechallenge with alternate statin before declaring complete intolerance.
- Inclisiran: siRNA, q6-monthly dosing after two initial doses.`,
    l2: `LIPID COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "First-line for hyperlipidemia?", "Diagnosis of FH?"
REQUIRED Tier 2-3 angles:
- Statin intolerance workup and structured rechallenge
- Familial hypercholesterolemia management with PCSK9i
- Elevated lp(a) management strategy
- Lipid management in pregnancy when statin contraindicated`
  },
  {
    keywords: ["ckd", "chronic kidney disease", "kdigo"],
    l1: `CKD FOUNDATIONAL ANCHORS (KDIGO 2024):
- SGLT2i for eGFR ≥20 + UACR >200 mg/g — Class 1A regardless of T2DM.
- RAS blockade titrated to maximum tolerated dose for proteinuria.
- Finerenone for T2DM + CKD + albuminuria (FIDELIO/FIGARO).
- Hyperkalemia mitigation: patiromer or sodium zirconium cyclosilicate ALLOWS continuation of RAS blockade.
- Avoid: NSAIDs, contrast when possible.`,
    l2: `CKD COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Treatment of CKD?", "Stages of CKD?"
REQUIRED Tier 2-3 angles:
- Multi-drug optimization (RAS + SGLT2i + finerenone) sequencing
- Hyperkalemia mitigation strategies to preserve RAS blockade
- Dialysis initiation criteria and modality choice
- Anemia, mineral-bone, acidosis management priorities`
  },
  {
    keywords: ["acute kidney injury", "aki", "ain", "atn", "fena", "contrast nephropathy"],
    l1: `AKI FOUNDATIONAL ANCHORS:
- Pre-renal vs intrinsic vs post-renal classification.
- FENa <1% pre-renal, >2% ATN — UNRELIABLE on diuretics (use FEUrea instead: <35% pre-renal).
- Contrast nephropathy peaks 3-5 days post-exposure.
- Nephrology consult: stage 3 AKI, refractory hyperkalemia, uremia, refractory volume overload.`,
    l2: `AKI COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "Diagnosis of AKI?", "Cause of AKI?"
REQUIRED Tier 2-3 angles:
- Acute interstitial nephritis recognition and management (stop offending drug, steroids if biopsy-proven)
- Hepatorenal syndrome management (terlipressin, albumin, transplant evaluation)
- RRT timing decisions (early vs delayed start)
- Contrast prophylaxis evidence-based approach`
  },
  {
    keywords: ["hit", "heparin-induced thrombocytopenia", "argatroban hit", "bivalirudin hit", "fondaparinux hit"],
    l1: `HIT FOUNDATIONAL ANCHORS:
- 4Ts score for pre-test probability.
- Stop ALL heparin including line flushes immediately on suspicion.
- Argatroban (hepatic clearance) for renal impairment.
- Bivalirudin or fondaparinux for hepatic dysfunction.
- NEVER warfarin alone — venous gangrene risk; bridge with non-heparin parenteral anticoagulant first.
- Confirmatory testing: PF4-heparin antibody (ELISA), serotonin release assay.`,
    l2: `HIT COGNITIVE COMPLEXITY:
FORBIDDEN basic stems: "What is HIT?", "Treatment of HIT?"
REQUIRED Tier 2-3 angles:
- Mixed renal-hepatic dysfunction agent choice
- Transition to oral anticoagulation timing (after platelets >150 and adequate non-heparin overlap)
- HIT in pregnancy (fondaparinux preferred)
- HIT antibody persistence and re-exposure risk in subsequent surgery`
  }
];

// Generic fallback for topics without specific guardrails
const GENERIC_GUARDRAILS = {
  l1: `GENERAL CLINICAL ANCHORS:
- Cite only data explicitly present in the stem.
- Use current officially published society guidelines, not legacy criteria. Do not invent recent dates for older guidelines.
- Numeric values in explanation must match stem exactly (Integrity Rule G).`,
  l2: `COGNITIVE COMPLEXITY EXPECTATION:
FORBIDDEN: "What is the most likely diagnosis?" as the question type for ABIM-level questions.
REQUIRED: Question must test management decision, drug selection, or workup escalation — not basic recognition.`
};

function getTopicGuardrails(level, topic) {
  const t = (topic || "").toLowerCase();
  const match = TOPIC_GUARDRAILS.find(g => g.keywords.some(k => t.includes(k)));
  if (match) return { l1: match.l1, l2: match.l2 };
  return GENERIC_GUARDRAILS;
}

// ============================================================
// DYNAMIC GUIDELINE MAP
// ============================================================
const GUIDELINE_MAP = [
  { keywords: ["diabetes", "hypoglycemia", "dka", "hhs", "insulin"], citation: `ADA Standards of Medical Care in Diabetes 2026; ADA/EASD Consensus Report 2022.

CRITICAL DIABETES ANCHORS — ADA 2026:
1. CARDIORENAL-DRIVEN PRESCRIBING (mandatory framework):
   - Established ASCVD or high ASCVD risk → GLP-1 RA with proven CV benefit (semaglutide, liraglutide, dulaglutide) OR SGLT2i with proven CV benefit (empagliflozin, canagliflozin).
   - Heart failure (HFrEF or HFpEF) → SGLT2i (Class 1A regardless of HbA1c).
   - CKD (eGFR ≥20 + UACR >200 mg/g) → SGLT2i (Class 1A regardless of HbA1c). Add finerenone if T2DM + albuminuria persists.
   - Obesity priority → tirzepatide or semaglutide preferred for weight loss.
2. METFORMIN: avoid if eGFR <30 mL/min. Reduce dose at eGFR 30-44. Hold periprocedurally if contrast risk.
3. SULFONYLUREAS: avoid in elderly, frequent hypoglycemia, or low HbA1c — high risk of severe hypoglycemia. Glipizide preferred over glyburide if must use.
4. INSULIN: do not stop basal insulin in T1DM (DKA risk). Sick day rules: continue basal, adjust prandial.
5. DKA: insulin held until K+ ≥3.3. Resolution = glucose <200 + 2 of (AG ≤12, bicarb ≥15, pH ≥7.3). Bicarbonate ONLY if pH <6.9.
6. HHS: osmolality >320 mOsm/kg, glucose >600 mg/dL, minimal ketosis. Fluids primary. Slower correction than DKA to avoid cerebral edema.
7. EUGLYCEMIC DKA: SGLT2i, pregnancy, recent surgery — anion gap is the key diagnostic finding when glucose is near-normal.
8. HYPOGLYCEMIA: Whipple triad. Endogenous hyperinsulinism: glucose <55 + insulin ≥3 + C-peptide ≥0.6 + sulfonylurea screen negative. Factitious insulin: insulin ↑, C-peptide LOW. Sulfonylurea: insulin ↑, C-peptide ↑, screen POSITIVE.

DEPRESCRIBING IN ELDERLY: HbA1c <7.0 + history of hypoglycemia → deprescribe sulfonylurea or insulin BEFORE adding new agents. Target HbA1c relaxed to <8.0 or <8.5 in frail elderly per ADA 2026.` },
  { keywords: ["thyroid", "nodule", "graves", "hashimoto", "hypothyroid", "hyperthyroid", "tsh", "free t4", "levothyroxine", "methimazole", "propylthiouracil", "radioiodine", "thyroiditis", "thyrotoxicosis", "goiter", "trab", "tpo", "thyroglobulin", "tg", "papillary", "follicular", "medullary", "anaplastic", "rair", "lenvatinib", "sorafenib", "vandetanib", "cabozantinib", "selpercatinib"], citation: `ATA 2025 Guidelines for Differentiated Thyroid Cancer (Ringel/Sosa); ATA 2015 Guidelines for Thyroid Nodules (Haugen); ATA 2014 Hypothyroidism (Jonklaas); ATA 2016 Hyperthyroidism (Ross); Endocrine Society 2016 Thyroid in Pregnancy.

⚠️ CITATION DATE LOCKS:
- Use "ATA 2025" EXCLUSIVELY for Differentiated Thyroid Cancer (Papillary/Follicular).
- DO NOT cite "ATA 2025" for Nodules (use 2015) or Hypothyroidism (use 2014).
- "ATA/ESMO Joint Guidelines" DO NOT EXIST.

CRITICAL THYROID ANCHORS:

1. OVERT vs SUBCLINICAL:
   - OVERT = ↑TSH + LOW free T4 (regardless of TSH value).
   - SUBCLINICAL = ↑TSH + NORMAL free T4. TSH >10 with normal free T4 is still subclinical.

2. TSH TARGETS (ATA 2025 DTC Update):
   - DTC long-term surveillance: TSH suppression is NO LONGER recommended for low- or intermediate-risk patients without evidence of recurrence (target lower reference range 0.5–2.0 mIU/L).
   - General adult hypothyroid: 0.4–4.0 mIU/L. Pregnancy: 0.1–2.5 (T1).

3. DTC SURGERY (ATA 2025 Update):
   - Lobectomy is the preferred option for low-risk unifocal cancers ≤4 cm without extrathyroidal extension or nodal spread.

4. THYROID CANCER — RAIR HARD RULES:
   - RAIR requires DOCUMENTED RAI failure: no uptake on scan, OR progression within 12mo of RAI, OR cumulative RAI ≥600 mCi. Patient REFUSAL is NOT RAIR.
   - Kinase inhibitors require RECIST 1.1 STRUCTURAL disease.
   - Vandetanib/cabozantinib: MTC only. Selpercatinib: RET-confirmed only.

5. THYROID STORM: PTU BEFORE iodine. Beta-blocker (propranolol). Hydrocortisone.

6. COGNITIVE LEVEL:
   - FORBIDDEN Tier 1: "TSH 9.8 + low T4 — start levo?"
   - REQUIRED Tier 3+: "Stable patient on levo develops elevated TSH — most likely cause?"
   - REQUIRED Tier 4: "Post-thyroidectomy DTC — TSH 1.2, Tg undetectable, anti-Tg rising — interpretation?"` },
  { keywords: ["lipid", "dyslipidemia", "cholesterol", "statin", "ascvd", "pcsk9", "ezetimibe", "triglyceride", "lpa", "lp(a)", "familial hypercholesterolemia", "bempedoic", "inclisiran", "fenofibrate"], citation: `2018 AHA/ACC/Multisociety Cholesterol Guideline (Grundy et al., Circulation 2019); 2019 ACC/AHA Primary Prevention Guideline (Arnett et al.); 2022 ACC Expert Consensus on Non-Statin Therapies (Lloyd-Jones et al.); 2024 AHA Scientific Statement on PREVENT Calculator.

⚠️ FABRICATED CITATION WARNING:
- "AACE 2026 Lipid Guidelines" DOES NOT EXIST. Last comprehensive AACE lipid guideline: Jellinger et al. 2017.

CRITICAL LIPID ANCHORS:
1. RISK CALCULATOR — USE PREVENT, NOT PCE:
   - PREVENT calculator (AHA 2023) is current ASCVD risk tool — race-neutral, includes kidney function, age 30–79.
   - Pooled Cohort Equations (PCE, 2013) are LEGACY — overestimate risk in many populations.
2. RISK CATEGORIES (2018 AHA/ACC):
   - ASCVD ≥7.5% → high-intensity statin.
   - ASCVD 5–<7.5% → intermediate; risk-enhancers guide decision.
   - Risk enhancers: Lp(a) ≥125 nmol/L, hsCRP ≥2, ABI <0.9, premature ASCVD family history, CKD.
   - CAC: 0 → defer (unless DM, smoker, FH); ≥100 → treat.
3. NON-STATIN ESCALATION:
   - LDL not at goal on max statin → ezetimibe FIRST.
   - Still not at goal → PCSK9i.
   - Statin-intolerant + high risk → bempedoic acid + ezetimibe → PCSK9i.
   - Inclisiran: siRNA, 2x/year after 2 initial doses.
4. STATIN INTOLERANCE: CK >10× ULN → discontinue. Always rechallenge with alternate statin before declaring complete intolerance.
5. PREGNANCY: statins contraindicated.` },
  { keywords: ["obesity", "bariatric", "metabolic syndrome", "wegovy", "tirzepatide weight", "semaglutide obesity"], citation: `AHA/ACC 2023 Obesity Guideline; AACE 2023 Obesity Algorithm; ADA 2026 Standards of Care.

CRITICAL OBESITY ANCHORS:
1. PHARMACOTHERAPY ELIGIBILITY: BMI ≥30, OR BMI ≥27 + weight-related comorbidity.
2. SEMAGLUTIDE (Wegovy) and TIRZEPATIDE (Zepbound) FDA-approved for chronic weight management.
3. CONTRAINDICATIONS for GLP-1 RAs: personal/family MTC, MEN2 (BLACK BOX). Pancreatitis history relative.
4. POST-BARIATRIC MICRONUTRIENT MONITORING (mandatory): B12, iron, folate, vitamin D, calcium, thiamine — lifelong.
5. POST-BARIATRIC HYPOGLYCEMIA: late dumping syndrome, nesidioblastosis. Acarbose or diazoxide may help.` },
  { keywords: ["pcos", "polycystic"], citation: `International Evidence-based PCOS Guideline 2023 (Teede et al.); Endocrine Society PCOS CPGs.

CRITICAL PCOS ANCHORS:
1. ROTTERDAM CRITERIA: 2 of 3 — oligo/anovulation, clinical or biochemical hyperandrogenism, polycystic ovaries on US.
2. METFORMIN: first-line for insulin resistance.
3. COMBINED OC: menstrual regulation. Prefer NON-androgenic progestogens (drospirenone, norgestimate). AVOID levonorgestrel in metabolically complex PCOS.
4. SPIRONOLACTONE: hirsutism. Requires RELIABLE contraception (teratogenic).
5. LETROZOLE: FIRST-LINE for ovulation induction (superior to clomiphene per 2023 Guideline).
6. BP ≥140/90: relative contraindication to estrogen-containing contraceptives.
7. METABOLICALLY COMPLEX PCOS: avoid androgenic progestogens. Consider non-hormonal alternatives.
8. PIOGLITAZONE: second-line insulin sensitizer when metformin contraindicated. WARNING: causes fluid retention via PPAR-γ — contraindicated in NYHA III/IV HF; use caution in CKD with hypertension/edema.` },
  { keywords: ["cardio", "acs", "stemi", "nstemi", "acute coronary", "myocardial infarction"], citation: `ACC/AHA 2025 ACS Guidelines; ACC/AHA/SCAI 2021 Coronary Revascularization Guideline.

CRITICAL ACS ANCHORS:
1. STEMI: PCI within 90 min (door-to-balloon). Fibrinolysis if PCI unavailable within 120 min.
2. NSTEMI high-risk (elevated troponin, dynamic ECG, hemodynamic instability): early invasive within 24h.
3. DAPT: aspirin + P2Y12 inhibitor (ticagrelor or prasugrel preferred over clopidogrel) for 12 months minimum post-ACS.
4. HBR (high bleeding risk) patients: shorten DAPT to 1-3 months, then aspirin alone.
5. POST-ACS GDMT: high-intensity statin + ACEi/ARB + beta-blocker. Add MRA if HFrEF.
6. HIT: argatroban (hepatic clearance) preferred for renal impairment. Bivalirudin or fondaparinux for hepatic dysfunction. NEVER heparin in confirmed HIT.
7. CARDIOGENIC SHOCK: IABP routine support not recommended (IABP-SHOCK II). Impella or VA-ECMO in select cases.` },
  { keywords: ["heart failure", "hfref", "hfpef", "cardiomyopathy", "arni", "sacubitril"], citation: `ACC/AHA/HFSA 2022 Heart Failure Guideline (Heidenreich et al.).

CRITICAL HEART FAILURE ANCHORS:
1. HFrEF (EF <40%): FOUR PILLARS = ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i. All four are Class 1A.
2. ARNI (sacubitril/valsartan) SUPERIOR to ACEi alone (PARADIGM-HF). 36-hour washout required when switching from ACEi (angioedema risk). DO NOT combine ARNI with ACEi.
3. HFpEF (EF ≥50%): SGLT2i Class 2a recommendation (EMPEROR-Preserved, DELIVER).
4. AVOID in HFrEF: NSAIDs, non-DHP CCBs (verapamil, diltiazem), TZDs (pioglitazone) in NYHA III/IV.
5. ICD: primary prevention if EF ≤35% on optimized GDMT for ≥3 months (NYHA II-III).
6. CRT: EF ≤35% + LBBB + QRS ≥150ms + NYHA II-IV on optimized GDMT.
7. ACUTE DECOMPENSATION: IV loop diuretic. Dose at home dose × 2 IV.
8. CARDIOGENIC SHOCK: norepinephrine first-line (SOAP II); avoid dopamine.` },
  { keywords: ["atrial fibrillation", "afib", "anticoagulation af", "doac", "cha2ds2", "ablation"], citation: `ACC/AHA/ACCP/HRS 2023 Atrial Fibrillation Guideline (Joglar et al.).

CRITICAL ATRIAL FIBRILLATION ANCHORS:
1. CHA2DS2-VASc ≥2 (men) / ≥3 (women) → anticoagulation indicated.
2. DOACs preferred OVER warfarin EXCEPT mechanical valves and moderate-severe MS (warfarin only).
3. Apixaban: preferred in CKD (5 mg BID; 2.5 BID if 2 of: age ≥80, weight ≤60, Cr ≥1.5).
4. Rate vs rhythm: many patients fine with rate. Early rhythm control benefit (EAST-AFNET 4).
5. DOAC reversal: idarucizumab for dabigatran; andexanet alfa for apixaban/rivaroxaban.
6. PERIPROCEDURAL: hold DOAC 24-48h pre-low-bleeding-risk, 48-72h pre-high-bleeding-risk procedure. Bridge only mechanical valves.
7. RECURRENT AF AFTER ABLATION within 3 months = blanking period; reassess at 6 months.` },
  { keywords: ["arrhythmia", "tachycardia", "bradycardia", "vt", "vf", "svt"], citation: "ACC/AHA/HRS 2017 Ventricular Arrhythmia Guideline; AHA 2020 ACLS Updates." },
  { keywords: ["hypertension", "blood pressure"], citation: `ACC/AHA 2017 Hypertension Guideline (Whelton et al.) + 2024 ACC/AHA Updates.

CRITICAL HYPERTENSION ANCHORS:
1. BP THRESHOLD: stage 1 = 130-139/80-89; stage 2 = ≥140/90.
2. TREATMENT THRESHOLD: stage 2 OR stage 1 + ASCVD risk ≥10%.
3. BP TARGET: <130/80 most patients (SPRINT-derived).
4. FIRST-LINE: thiazide, ACEi/ARB, or DHP-CCB. AVOID beta-blockers as first-line unless compelling indication (post-MI, HFrEF).
5. RESISTANT HYPERTENSION: 3 drugs at max-tolerated dose including diuretic. Add spironolactone (PATHWAY-2). Workup: aldosterone, renal artery stenosis, OSA, secondary causes.
6. PREGNANCY: methyldopa, labetalol, nifedipine. AVOID ACEi/ARB (teratogenic).` },
  { keywords: ["nephro", "renal", "ckd", "kidney disease", "egfr", "albuminuria", "uacr", "finerenone"], citation: `KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD; KDIGO 2022 Diabetes Management in CKD.

CRITICAL CKD ANCHORS:

1. SGLT2i — CARDIORENAL ANCHOR (CRITICAL ANTI-HALLUCINATION):
   - eGFR ≥20 + UACR >200 mg/g = Class 1A for renoprotection, INDEPENDENT of T2DM or glycemic indication.
   - DAPA-CKD, EMPA-KIDNEY trials confirm renoprotection in non-diabetic CKD.
   - NEVER dismiss SGLT2i solely on "glycemic inefficacy at low eGFR" when question concerns cardiorenal benefit.
   - eGFR <20: do not initiate; continue if already established and tolerated.

2. RAS BLOCKADE: ACEi or ARB titrated to maximum tolerated dose for proteinuria. Continue despite mild creatinine rise (≤30%).

3. FINERENONE: nonsteroidal MRA for T2DM + CKD + albuminuria (FIDELIO-DKD, FIGARO-DKD). Reduces CV events and CKD progression.

4. HYPERKALEMIA MITIGATION: patiromer or sodium zirconium cyclosilicate ALLOWS continuation of RAS blockade rather than discontinuation. New paradigm post-AMBER trial.

5. AKI WORKUP:
   - Pre-renal vs intrinsic vs post-renal classification.
   - FENa <1% prerenal vs >2% ATN — UNRELIABLE on diuretics (use FEUrea: <35% prerenal).
   - Contrast nephropathy peaks 3-5 days post-exposure.
   - AIN: triad of fever + rash + eosinophilia present in <30%; urine eosinophils unreliable.

6. NEPHROLOGY CONSULT: stage 3 AKI, refractory hyperkalemia, uremia, refractory volume overload, RRT consideration.

7. CONTRAST NEPHROPATHY PROPHYLAXIS: IV isotonic saline; sodium bicarbonate not superior. N-acetylcysteine NOT recommended (no benefit per PRESERVE trial).

8. DIALYSIS INITIATION: AEIOU mnemonic — Acidosis, Electrolytes, Intoxications, Overload, Uremia. Not based on eGFR alone.` },
  { keywords: ["gastro", "hepat", "cirrhosis", "ibd", "crohn", "colitis", "ulcerative", "inflammatory bowel", "infliximab", "adalimumab", "vedolizumab", "ustekinumab", "risankizumab", "tofacitinib", "upadacitinib", "biologic", "anti-tnf", "fistula", "perianal", "colonoscopy", "budesonide", "mesalamine", "azathioprine"], citation: `ACG 2024 Crohn Disease Guidelines (Lichtenstein et al.); AGA 2021 Moderate-to-Severe Crohn Guideline; ACG 2019 UC Guidelines; ECCO 2022 IBD Guidelines; AASLD 2025 Practice Guidance.

CRITICAL IBD ANCHORS:
1. THERAPEUTIC DRUG MONITORING (TDM) — ANTI-TNF:
   - Infliximab trough goal: ≥5 mcg/mL induction, ≥3-5 mcg/mL maintenance.
   - ATI + low trough → switch CLASS (primary immunogenicity).
   - Subtherapeutic trough + no ATI → dose optimize.
2. TOP-DOWN VS STEP-UP:
   - Moderate-to-severe CD: early biologic + immunomodulator combination.
   - SONIC trial: infliximab + azathioprine > infliximab alone > azathioprine alone for CD.
3. BIOLOGIC SWITCHING:
   - Primary non-response → switch CLASS.
   - Secondary loss of response → TDM first.
4. PRE-BIOLOGIC SCREENING (mandatory):
   - TB: CXR + IGRA. Treat LTBI before biologic.
   - HBV: HBsAg, anti-HBc, anti-HBs. If HBsAg+ → entecavir prophylaxis.
   - Varicella IgG: vaccinate if seronegative BEFORE biologic (live vaccine).
5. CANCER SURVEILLANCE: UC and colonic CD — colonoscopy q1-2y from 8-10y after diagnosis. PSC + IBD: annual.
6. PERIANAL DISEASE: EUA + MRI pelvis. Infliximab has best perianal data. Surgical drainage + seton BEFORE biologic. AVOID systemic corticosteroids.
7. PREGNANCY:
   - Anti-TNF (infliximab, adalimumab): SAFE; continue.
   - Methotrexate: CONTRAINDICATED (teratogenic). Stop 3-6 months before conception.
8. JAK INHIBITORS (tofacitinib, upadacitinib): BLACK BOX — CV events, malignancy, thrombosis.
9. CIRRHOSIS:
   - SBP prophylaxis after first episode: norfloxacin or ciprofloxacin.
   - HRS-AKI: terlipressin + albumin first-line.
   - HE: lactulose + rifaximin.
   - HCC screening: q6mo US ± AFP in cirrhosis.` },
  { keywords: ["parathyroid", "calcium", "bone", "osteoporosis", "hyperparathyroidism", "hypercalcemia", "bisphosphonate", "denosumab", "teriparatide", "abaloparatide", "romosozumab", "frax", "pthrp", "calcimimetic", "cinacalcet"], citation: `Endocrine Society 2022 Primary Hyperparathyroidism Guideline (Bilezikian et al.); AACE 2020 Postmenopausal Osteoporosis Guideline + 2024 Updates.

CRITICAL BONE/PTH ANCHORS:

1. PRIMARY HYPERPARATHYROIDISM:
   - Diagnosis: ↑Ca + ↑PTH (or inappropriately normal PTH).
   - 24h urine calcium DISTINGUISHES from FHH (Ca/Cr clearance ratio <0.01 = FHH).
   - Surgery indications (any one): symptomatic, age <50, Ca >1 above ULN, eGFR <60, T-score ≤-2.5, vertebral fracture, kidney stones, 24h urine Ca >400.
   - Sestamibi + neck US for localization.
   - Hungry bone syndrome: post-op severe hypocalcemia.

2. HYPERCALCEMIA — CRITICAL ANTI-HALLUCINATION RULES:
   - Treatment sequence: IV fluids first → calcitonin (rapid, tachyphylaxis 48h) → BISPHOSPHONATE (4-7 day onset).
   - BISPHOSPHONATES DO LOWER SERUM CALCIUM via osteoclast inhibition. NEVER state "alendronate does not lower calcium" — this is FALSE.
   - Denosumab: alternative when bisphosphonate contraindicated (renal failure).
   - Cinacalcet: severe primary HPT or parathyroid carcinoma not amenable to surgery.
   - Granulomatous (sarcoid, TB) hypercalcemia: corticosteroids effective (1,25-D mediated).

3. OSTEOPOROSIS TREATMENT THRESHOLD:
   - T-score ≤-2.5, OR T -1.0 to -2.5 + FRAX MOF ≥20% or hip ≥3%.

4. BISPHOSPHONATE FACTS:
   - Alendronate, risedronate, zoledronic acid: ALL LOWER SERUM CALCIUM and improve BMD.
   - Drug holiday: 5 years oral / 3 years IV — high-risk continue.
   - Alendronate: NOT RECOMMENDED at eGFR <35 (FDA labeling); not absolutely contraindicated, use clinical judgment.
   - Atypical femur fracture risk after long-term use → consider holiday.

5. DENOSUMAB:
   - DISCONTINUATION REQUIRES bisphosphonate bridge (within 6 months of last dose) — rebound vertebral fractures otherwise.
   - Approved at any eGFR (no renal dose adjustment).

6. ANABOLIC AGENTS:
   - Teriparatide and abaloparatide: MAX 2 YEARS lifetime.
   - Romosozumab: BLACK BOX — contraindicated if MI or stroke within prior 12 months (ARCH trial signal).
   - Sequential therapy: anabolic first, then antiresorptive to maintain gains.

7. DRUG-INDUCED OSTEOPOROSIS:
   - Glucocorticoids: prednisone ≥5 mg/day ≥3 months → consider treatment.
   - Aromatase inhibitors, GnRH agonists, AR-blockers: monitor BMD.
   - Long-term PPI: ?modest fracture risk; not a contraindication.` },
  { keywords: ["menopause", "hrt", "hormone therapy", "vasomotor", "estrogen replacement", "reproductive"], citation: `Endocrine Society 2022 Menopause Guideline; NAMS 2022 Hormone Therapy Position Statement.

CRITICAL MENOPAUSE ANCHORS:
1. HORMONE THERAPY: most beneficial when initiated <60 years or <10 years from menopause onset (timing hypothesis).
2. CONTRAINDICATIONS: history of breast cancer, CHD, stroke, VTE, active liver disease, undiagnosed vaginal bleeding.
3. ROUTE: transdermal preferred for VTE risk (avoids first-pass hepatic effect).
4. PROGESTOGEN: required if intact uterus (endometrial protection). Continuous combined or sequential.
5. NON-HORMONAL OPTIONS: SSRIs (paroxetine FDA-approved for VMS), SNRIs (venlafaxine), gabapentin, fezolinetant (NK3R antagonist, 2023 FDA approval).
6. GENITOURINARY SYNDROME: low-dose vaginal estrogen safe even in many breast cancer survivors after specialist discussion.` },
  { keywords: ["pituitary", "hypothalamus", "acromegaly", "prolactin", "prolactinoma", "hypopituitarism", "craniopharyngioma", "avp", "diabetes insipidus", "siadh", "igf-1", "growth hormone", "gonadotropin", "sheehan", "apoplexy", "cabergoline", "octreotide", "lanreotide", "pegvisomant", "desmopressin", "copeptin"], citation: `Pituitary Society 2023 Consensus on Acromegaly, Hypopituitarism, and Pituitary Tumors; Endocrine Society 2025 CPGs; European Journal of Endocrinology 2023 AVP-D Consensus.

CRITICAL PITUITARY ANCHORS:

1. PROLACTINOMA:
   - Cabergoline first-line.
   - Bromocriptine preferred during planned pregnancy.
   - Stalk effect (non-prolactinoma compressing stalk): prolactin typically <100 ng/mL.
   - Hook effect at very high prolactin (>1000): assay underestimates — must dilute.

2. ACROMEGALY:
   - GH nadir <1 ng/mL on 75g OGTT (or <0.4 with ultrasensitive assay).
   - IGF-1 used for diagnosis and monitoring.
   - Transsphenoidal surgery first-line.
   - Pegvisomant (GH receptor antagonist): IGF-1 monitoring only — interferes with GH assay.

3. HYPOPITUITARISM:
   - REPLACE CORTISOL BEFORE THYROID HORMONE.
   - Sheehan syndrome: postpartum pituitary infarction.
   - Pituitary apoplexy: acute headache + visual change + hypopituitarism = neurosurgical emergency. Stress-dose steroids FIRST.

4. AVP-D vs AVP-R:
   - Hypertonic saline-stimulated copeptin >6.4 pmol/L confirms AVP-R.
   - Hypertonic saline-stimulated copeptin <4.9 pmol/L confirms AVP-D.
   - Largely replaced classic water deprivation test.
   - Lithium → nephrogenic DI; gestational DI → placental vasopressinase.

5. POST-PITUITARY-SURGERY TRIPHASIC: DI → SIADH → permanent DI.

6. SIADH:
   - Euvolemic hyponatremia + concentrated urine + low serum osmolality.
   - Fluid restriction first. Tolvaptan or demeclocycline second-line.
   - Correction <8 mEq/L per 24h to prevent osmotic demyelination.` },
  { keywords: ["sepsis", "septic shock", "infectious", "antibiotic", "bacteremia", "pneumonia", "pyelonephritis", "meningitis", "endocarditis", "esbl", "carbapenem", "vasopressor", "norepinephrine", "vasopressin", "hydrocortisone", "source control", "lactate", "procalcitonin"], citation: `Surviving Sepsis Campaign (SSC) 2021 International Guidelines; IDSA 2024 Antibiotic Stewardship Guidelines.

CRITICAL SEPSIS/ID ANCHORS:

1. PRESSORS:
   - Norepinephrine = FIRST-LINE.
   - Add VASOPRESSIN 0.03 units/min when norepinephrine ≥0.25 mcg/kg/min — NOT dopamine.
   - Dopamine: select bradycardic patients only; higher arrhythmia risk.
   - Epinephrine: third-line in refractory shock.

2. STEROIDS IN SEPTIC SHOCK:
   - IV hydrocortisone 200 mg/day ONLY if hemodynamically unstable despite adequate fluids AND vasopressors.
   - Do NOT use steroids in sepsis WITHOUT shock.
   - ACTH stim test NOT required.

3. ANTIBIOTIC STEWARDSHIP:
   - Empiric carbapenem (meropenem/ertapenem): known ESBL, prior ESBL, recurrent UTI with prior ESBL, septic shock without time for cultures.
   - Pip-tazo NOT reliable for ESBL bacteremia (MERINO 2018 — higher mortality).
   - De-escalate carbapenem to cephalosporin/quinolone once susceptibility known.
   - Ceftolozane-tazobactam or ceftazidime-avibactam: MDR Pseudomonas or KPC.

4. SOURCE CONTROL:
   - Obstructive pyelonephritis with sepsis = UROLOGIC EMERGENCY. Decompression within 6-12 hours.
   - Necrotizing fasciitis: surgical debridement is the source control.

5. REFRACTORY SHOCK ESCALATION:
   - MAP <65 despite norepinephrine ≥0.25 mcg/kg/min + adequate fluids.
   - Step 1: vasopressin. Step 2: hydrocortisone. Step 3: epinephrine.

6. ICU TRANSFER:
   - Lactate ≥4: immediate ICU.
   - Lactate 2-4: reassess at 2h — failure to clear ≥10% = ICU.
   - Vasopressor at any dose: ICU mandatory.

7. PROCALCITONIN: guides DE-ESCALATION, not initiation.

8. ENDOCARDITIS:
   - Modified Duke Criteria.
   - Native valve viridans/Strep gallolyticus: penicillin/ceftriaxone.
   - Native valve Staph: nafcillin (MSSA), vancomycin (MRSA).
   - Prosthetic valve: vancomycin + gentamicin + rifampin.` },
  { keywords: ["men1", "multiple endocrine neoplasia type 1", "wermer", "men2", "men 2a", "men 2b", "ret mutation", "prophylactic thyroidectomy"], citation: `Endocrine Society Clinical Practice Guidelines for MEN1 (2012) and MEN2/MTC (2015). Do not cite guidelines newer than these.` },
  { keywords: ["cushing", "adrenal", "aldosterone", "pheochromocytoma", "paraganglioma", "addison", "cortisol", "acth", "metanephrine", "phenoxybenzamine", "spironolactone adrenal", "eplerenone"], citation: `Endocrine Society 2008 Cushing Syndrome Diagnostic CPG (Nieman et al.) + 2015 Treatment CPG; Pituitary Society 2023 Consensus on Cushing Disease; Endocrine Society 2016 Primary Aldosteronism CPG; Endocrine Society 2014 Pheochromocytoma/Paraganglioma CPG.

CRITICAL ADRENAL ANCHORS:

1. CUSHING'S SCREENING:
   - 1mg overnight DST OR 24h UFC OR late-night salivary cortisol.
   - 8mg DST is NOT a standard screening test (legacy localization tool, largely obsolete).
   - ACTH <10 pg/mL = ACTH-INDEPENDENT (adrenal source).
   - ACTH >20 pg/mL = ACTH-DEPENDENT (pituitary or ectopic).

2. CUSHING'S LOCALIZATION:
   - BIPSS required when MRI shows lesion <6mm or no lesion.
   - Central:peripheral ACTH ratio ≥2 basal or ≥3 post-CRH = pituitary source.
   - MRI finding of ≥10mm microadenoma does NOT replace BIPSS for localization in ambiguous cases.

3. PRIMARY ALDOSTERONISM:
   - Screening: aldosterone-renin ratio (ARR) >30 (ng/dL per ng/mL/hr).
   - Confirmation required before AVS: salt loading, IV saline, fludrocortisone suppression, or captopril challenge.
   - AVS required pre-surgery in ALL patients >35 years to lateralize. CT alone insufficient.
   - Spironolactone interferes — washout 4-6 weeks before testing.
   - Unilateral adenoma → adrenalectomy. Bilateral hyperplasia → MRA (spironolactone or eplerenone).

4. PHEOCHROMOCYTOMA:
   - Plasma free metanephrines OR 24h urine fractionated metanephrines first-line.
   - ALPHA BLOCKADE (phenoxybenzamine or doxazosin) MUST PRECEDE BETA BLOCKADE by 10-14 days.
   - Starting beta-blocker first → unopposed alpha → hypertensive crisis. Never do this.
   - Volume expansion preoperatively (high-salt diet, sometimes IV fluids).
   - Genetic testing in ALL patients: MEN2 (RET), VHL, SDH-related, NF1.

5. ADRENAL INSUFFICIENCY:
   - Primary (Addison): ↓cortisol, ↑ACTH, ↑renin, ↓aldosterone, hyperpigmentation.
   - Secondary: ↓cortisol, ↓ACTH, NORMAL aldosterone, no hyperpigmentation.
   - ACTH stim test confirms primary (cortisol <18 µg/dL at 30/60 min).
   - Adrenal crisis: hydrocortisone 100mg IV IMMEDIATELY — do not wait for confirmation.
   - Steroid-induced HPA suppression: any chronic exogenous steroid >3 weeks.

6. ADRENAL INCIDENTALOMA:
   - Workup: 1mg DST (Cushing screen), plasma metanephrines (pheo screen), aldosterone-renin (PA screen if hypertensive).
   - Imaging features: HU <10 = lipid-rich adenoma; HU >10 with washout >50% absolute or >40% relative = adenoma; HU >10 with poor washout = suspicious.
   - Surgery: functional tumor, >4 cm, suspicious imaging features.` }
];

function getGuidelineContext(topic, isNutrition) {
  if (isNutrition) return "ASPEN 2023, ADA 2026, Endocrine Society, KDIGO, IOM/DRI Nutrition Guidelines";
  const t = topic.toLowerCase();
  const match = GUIDELINE_MAP.find(g => g.keywords.some(k => t.includes(k)));
  return match ? match.citation : "the most recent applicable society guidelines (do not fabricate publication years)";
}

// ============================================================
// NUTRITION & TOPIC DISTRIBUTIONS
// ============================================================
const NUTRITION_INJECTION_RATE = 0.12;

const NUTRITION_BY_LEVEL = {
  "USMLE Step 1": ["Vitamin D deficiency — rickets vs. osteomalacia", "Thiamine (B1) deficiency — Wernicke encephalopathy", "Vitamin B12 deficiency", "Refeeding syndrome pathophysiology", "Starvation biochemistry"],
  "USMLE Step 2 CK": ["Enteral vs parenteral nutrition indications", "Refeeding syndrome recognition", "Obesity pharmacotherapy", "Bariatric surgery outcomes", "Celiac disease management", "DASH/Mediterranean diet evidence"],
  "USMLE Step 3": ["Chronic disease nutrition management", "Food insecurity screening", "ICU nutrition — ASPEN/ESPEN 2023", "Post-bariatric monitoring"],
  "ABIM Internal Medicine": ["Refeeding syndrome protocol", "TPN complications — IFALD", "Nutritional management of CKD/Cirrhosis", "Malabsorption workup", "Mediterranean diet PREDIMED evidence"],
  "ABIM Endocrinology": ["Medical nutrition therapy for T1DM/T2DM (ADA 2026)", "Nutritional causes of secondary osteoporosis", "Post-bariatric micronutrient protocol", "Ketogenic diet mechanisms", "Selenium/Zinc deficiency"]
};

const TOPIC_DISTRIBUTION = {
  "ABIM Endocrinology": [
    { topic: "Type 2 Diagnosis and Management",  weight: 8 },
    { topic: "Type 1 Insulin Therapy",           weight: 6 },
    { topic: "DKA and HHS",                      weight: 5 },
    { topic: "Hypoglycemia",                     weight: 5 },
    { topic: "GLP-1 Receptor Agonists",          weight: 5 },
    { topic: "SGLT2 Inhibitors",                 weight: 4 },
    { topic: "CGM and AID Systems",              weight: 3 },
    { topic: "Hypothyroidism and Hashimotos",    weight: 5 },
    { topic: "Hyperthyroidism and Graves",       weight: 5 },
    { topic: "Thyroid Nodule Evaluation",        weight: 4 },
    { topic: "Thyroid Cancer",                   weight: 3 },
    { topic: "Thyroid Storm",                    weight: 3 },
    { topic: "Cushing Syndrome",                 weight: 5 },
    { topic: "Primary Aldosteronism",            weight: 4 },
    { topic: "Pheochromocytoma",                 weight: 3 },
    { topic: "Adrenal Insufficiency",            weight: 4 },
    { topic: "Prolactinoma",                     weight: 4 },
    { topic: "Acromegaly",                       weight: 3 },
    { topic: "Hypopituitarism",                  weight: 3 },
    { topic: "Diabetes Insipidus",               weight: 3 },
    { topic: "Hyperparathyroidism",              weight: 4 },
    { topic: "Hypercalcemia",                    weight: 3 },
    { topic: "Osteoporosis",                     weight: 4 },
    { topic: "PCOS",                             weight: 4 },
    { topic: "Male Hypogonadism",                weight: 3 },
    { topic: "MEN1",                             weight: 2 },
    { topic: "MEN2A and MEN2B",                  weight: 2 },
    { topic: "Insulinoma",                       weight: 2 },
  ],
  "ABIM Internal Medicine": [
    { topic: "ACS STEMI NSTEMI",                 weight: 7 },
    { topic: "Heart Failure",                    weight: 6 },
    { topic: "Atrial Fibrillation",              weight: 6 },
    { topic: "Hypertension",                     weight: 5 },
    { topic: "Lipid Disorders",                  weight: 4 },
    { topic: "Asthma and COPD",                  weight: 5 },
    { topic: "Pneumonia",                        weight: 4 },
    { topic: "Pulmonary Embolism",               weight: 5 },
    { topic: "Acute Kidney Injury",              weight: 5 },
    { topic: "CKD",                              weight: 4 },
    { topic: "Electrolyte Disorders",            weight: 5 },
    { topic: "Acid-Base Disorders",              weight: 4 },
    { topic: "IBD Crohns and UC",                weight: 4 },
    { topic: "Cirrhosis",                        weight: 4 },
    { topic: "Sepsis and Septic Shock",          weight: 5 },
    { topic: "HIV",                              weight: 3 },
    { topic: "Anemia",                           weight: 4 },
    { topic: "DVT and Anticoagulation",          weight: 4 },
    { topic: "Rheumatoid Arthritis",             weight: 3 },
    { topic: "SLE",                              weight: 3 },
    { topic: "Type 2 Diagnosis and Management",  weight: 4 },
    { topic: "Hypothyroidism and Hashimotos",    weight: 3 },
    { topic: "Informed Consent",                 weight: 2 },
    { topic: "End-of-Life Care",                 weight: 2 },
  ],
  "USMLE Step 1": [
    { topic: "Systemic Pathology and Pathophysiology",              weight: 10 },
    { topic: "Pharmacology, Pharmacokinetics, and Adverse Effects", weight: 8 },
    { topic: "Physiology and Clinical Biochemistry",                weight: 8 },
    { topic: "Microbiology, Virology, and Immunology",              weight: 7 },
    { topic: "Anatomy, Neuroanatomy, and Embryology",               weight: 4 },
    { topic: "Behavioral Science, Medical Ethics, and Biostatistics", weight: 5 },
    { topic: "Vitamin D deficiency — rickets vs. osteomalacia",     weight: 3 },
    { topic: "Thiamine (B1) deficiency — Wernicke encephalopathy",  weight: 3 },
  ],
  "USMLE Step 2 CK": [
    { topic: "ACS STEMI NSTEMI",                                    weight: 6 },
    { topic: "Heart Failure",                                       weight: 5 },
    { topic: "Pneumonia",                                           weight: 5 },
    { topic: "Sepsis and Septic Shock",                             weight: 5 },
    { topic: "Acute Kidney Injury",                                 weight: 5 },
    { topic: "Type 2 Diagnosis and Management",                     weight: 5 },
    { topic: "Gestational Diabetes",                                weight: 4 },
    { topic: "Obstetrics and Gynecology",                           weight: 5 },
    { topic: "Pediatrics and Congenital Issues",                    weight: 5 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 5 },
    { topic: "Psychiatry and Substance Abuse",                      weight: 4 },
    { topic: "General Surgery and Trauma Management",               weight: 5 },
  ],
  "USMLE Step 3": [
    { topic: "ACS STEMI NSTEMI",                                    weight: 5 },
    { topic: "Sepsis and Septic Shock",                             weight: 5 },
    { topic: "Pulmonary Embolism",                                  weight: 4 },
    { topic: "CKD",                                                 weight: 4 },
    { topic: "Type 2 Diagnosis and Management",                     weight: 4 },
    { topic: "Patient Safety, Medical Ethics, HIPAA Law, and End-of-Life Care", weight: 6 },
    { topic: "Psychiatry and Substance Abuse",                      weight: 4 },
    { topic: "Obstetrics and Gynecology",                           weight: 4 },
    { topic: "ICU nutrition — ASPEN/ESPEN 2023",                    weight: 3 },
    { topic: "Chronic disease nutrition management",                weight: 3 },
  ]
};

function pickTopicForLevel(level, rawTopic) {
  const nutritionTopics = NUTRITION_BY_LEVEL[level];
  if (nutritionTopics && rawTopic.includes("Random") && Math.random() < NUTRITION_INJECTION_RATE) {
    const idx = Math.floor(Math.random() * nutritionTopics.length);
    return { topic: nutritionTopics[idx], isNutrition: true };
  }
  return { topic: rawTopic, isNutrition: false };
}

const MALE_ONLY_TOPIC_KEYWORDS   = ["male hypogonadism", "prostate", "bph", "erectile dysfunction", "testicular"];
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

// ============================================================
// MCQ TOOL SCHEMA
// ============================================================
const MCQ_TOOL = {
  name: "emit_mcq",
  description: "Emit a single board-style multiple-choice question with exactly 5 answer choices (A-E), one correct answer, and an explanation.",
  input_schema: {
    type: "object",
    properties: {
      demographic_check: { type: "string" },
      stem: { type: "string", description: "The clinical vignette. Must end with the interrogative sentence." },
      choices: {
        type: "object",
        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
        required: ["A", "B", "C", "D", "E"]
      },
      correct: { type: "string", enum: ["A", "B", "C", "D", "E"] },
      explanation: { type: "string", description: "Use provided formatting rules for the explanation." }
    },
    required: ["demographic_check", "stem", "choices", "correct", "explanation"]
  }
};

function extractJSONSimple(raw) {
  if (!raw || typeof raw !== "string") throw new Error("extractJSONSimple received empty input.");
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found.");
  let candidate = match[0].replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u00A0/g, " ").replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(candidate); } catch (e) { throw new Error(`Gemini JSON malformed: ${e.message}`); }
}

// ============================================================
// VALIDATORS
// ============================================================
function validateDemographics(stem, sex, topic) {
  const lowerText  = stem.toLowerCase();
  const lowerTopic = (topic || "").toLowerCase();

  if (sex === "man") {
    const femaleTerms = ["oral contraceptive","ocp","pregnant","pregnancy","gravida","menopause","menstrual","menses","amenorrhea","ovary","uterus","endometrial","vaginal","cervical cancer"];
    if (femaleTerms.some(term => lowerText.includes(term))) return false;
  } else {
    const maleTerms = ["prostate","bph","psa level","testicle","testicular","scrotal","sildenafil","erectile dysfunction"];
    if (maleTerms.some(term => lowerText.includes(term))) return false;
  }

  const ageMatch = stem.match(/(\d+)[\s\-]*year[\s\-]*old/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

  if (sex === "woman" && age !== null && age >= 55) {
    const pregTestTerms = ["b-hcg", "beta-hcg", "β-hcg", "pregnancy test", "urine pregnancy", "serum hcg", "qhcg", "quantitative hcg"];
    const isPregnancyRelevantTopic = lowerTopic.includes("pregnancy") || lowerTopic.includes("obstet") || lowerTopic.includes("gestational") || lowerTopic.includes("prolactin") || lowerTopic.includes("hyperprolactin");
    if (!isPregnancyRelevantTopic && pregTestTerms.some(term => lowerText.includes(term))) return false;
  }

  if (sex === "man") {
    const isUrologicalTopic = lowerTopic.includes("prostate") || lowerTopic.includes("urolog") || lowerTopic.includes("bph") || lowerTopic.includes("hypogonadism");
    if (!isUrologicalTopic && (lowerText.includes(" psa ") || lowerText.includes("prostate-specific antigen") || lowerText.includes("psa level") || lowerText.includes("psa is") || lowerText.includes("psa was"))) return false;
  }

  return true;
}

const LAB_VALUE_PATTERN = /\b(tsh|free\s*t4|free\s*t3|total\s*t4|total\s*t3|hba1c|a1c|fasting\s*glucose|glucose|sodium|potassium|creatinine|egfr|calcium|phosphorus|cortisol|acth|igf-1|igf1|prolactin|lh|fsh|testosterone|estradiol|aldosterone|plasma\s*renin|renin|creatine\s*kinase|ck\b|alt|ast|alp|tbili|bilirubin|hemoglobin|hgb|hematocrit|wbc|platelets|inr|ptt|bun|bicarbonate|bicarb|co2|pco2|po2|ldl|hdl|triglyceride|total\s*cholesterol|cholesterol|trab|tpo\s*antibody|vitamin\s*d|25-oh\s*vitamin|pth|parathyroid\s*hormone|urine\s*cortisol|urine\s*albumin|albumin|ferritin|b12|folate|tsh\s*receptor\s*antibod)\s+(?:of\s+|was\s+|is\s+|:?\s*)(\d+\.?\d*)/gi;

function extractLabValues(text) {
  const values = {};
  LAB_VALUE_PATTERN.lastIndex = 0;
  let m;
  while ((m = LAB_VALUE_PATTERN.exec(text)) !== null) {
    const labName = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    if (!(labName in values)) values[labName] = m[2];
  }
  return values;
}

function validateConsistency(p) {
  if (!p || !p.stem || !p.explanation) return true;
  const stemValues = extractLabValues(p.stem);
  const explValues = extractLabValues(p.explanation);
  for (const lab of Object.keys(explValues)) {
    if (stemValues[lab] !== undefined && stemValues[lab] !== explValues[lab]) {
      console.warn(`[validateConsistency] Mismatch — ${lab}: stem="${stemValues[lab]}" vs explanation="${explValues[lab]}"`);
      return false;
    }
  }
  return true;
}

function validateChoiceCompleteness(p) {
  if (!p || !p.choices || !p.stem || !p.explanation) return false;
  
  const letters = ["A", "B", "C", "D", "E"];
  for (const l of letters) {
    if (!p.choices[l] || p.choices[l].trim().length < 3) {
      console.warn(`[validateChoiceCompleteness] Missing or truncated choice: ${l}`);
      return false;
    }
  }
  
  if (!/\?[\s"']*$/.test(p.stem)) {
    console.warn("[validateChoiceCompleteness] Stem does not end with a question mark.");
    return false;
  }
  
  if (!p.explanation.includes("🩺") || !p.explanation.includes("🚫")) {
    console.warn("[validateChoiceCompleteness] Explanation missing 🩺 or 🚫 markers.");
    return false;
  }
  
  if (!letters.includes(p.correct)) {
    console.warn(`[validateChoiceCompleteness] Invalid correct answer letter: ${p.correct}`);
    return false;
  }
  
  return true;
}

// ─── ANTI-CUEING VALIDATOR ────────────────────────────────────────────────────
// Detects pertinent-negative patterns in the stem that telegraph the correct
// therapeutic choice. Returns true if cueing is detected (item should be rejected).
//
// This is a heuristic safety net. Rule H in the system prompt is the primary
// defense; the validator catches slip-throughs. False positives are possible
// (a pertinent negative may legitimately rule out a competing differential that
// happens to share a contraindication with the correct answer); items it flags
// should be human-reviewed rather than silently discarded.
function detectAntiCueingViolation(p) {
  if (!p || !p.stem || !p.choices || !p.correct) return false;

  const stemLower   = p.stem.toLowerCase();
  const correctText = (p.choices[p.correct] || "").toLowerCase();

  const CUEING_PAIRS = [
    {
      label: "SGLT2 inhibitor",
      drugPatterns: [
        /\bsglt[\-\s]?2\b/i,
        /\b(empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|bexagliflozin)\b/i
      ],
      cuePatterns: [
        /\bno\b.{0,40}\b(bladder cancer|recurrent uti|fournier|euglycemic dka)\b/i,
        /\bdenies\b.{0,40}\b(bladder cancer|recurrent uti)\b/i,
        /\bnegative\s+(history\s+)?for\b.{0,40}\bbladder cancer\b/i
      ]
    },
    {
      label: "GLP-1 receptor agonist",
      drugPatterns: [
        /\bglp[\-\s]?1\b/i,
        /\b(liraglutide|semaglutide|dulaglutide|exenatide|tirzepatide|lixisenatide)\b/i
      ],
      cuePatterns: [
        /\bno\b.{0,40}\b(history of pancreatitis|pancreatitis|medullary thyroid|men\s*2|men2)\b/i,
        /\bdenies\b.{0,40}\b(pancreatitis|medullary thyroid)\b/i,
        /\bnegative\s+family\s+history\b.{0,40}\b(medullary thyroid|men\s*2)\b/i
      ]
    },
    {
      label: "Metformin",
      drugPatterns: [/\bmetformin\b/i, /\bglucophage\b/i],
      cuePatterns: [
        /\begfr\b.{0,30}\b(>|>=|greater than)\s*30\b/i,
        /\bno\b.{0,30}\b(iv contrast|lactic acidosis|severe (renal|hepatic))\b/i
      ]
    },
    {
      label: "Thiazolidinedione (pioglitazone)",
      drugPatterns: [/\bpioglitazone\b/i, /\brosiglitazone\b/i, /\bthiazolidinedione\b/i, /\btzd\b/i],
      cuePatterns: [
        /\bno\b.{0,40}\b(heart failure|peripheral edema|history of bladder cancer|history of fracture)\b/i,
        /\bnyha\b.{0,10}\bclass\s*i\b/i
      ]
    },
    {
      label: "Sulfonylurea",
      drugPatterns: [/\bsulfonylurea\b/i, /\b(glipizide|glyburide|glimepiride|gliclazide)\b/i],
      cuePatterns: [
        /\bregular meal pattern\b/i,
        /\bno\b.{0,30}\bskipped meals\b/i,
        /\breliable meal schedule\b/i
      ]
    },
    {
      label: "Insulin",
      drugPatterns: [/\b(insulin glargine|insulin detemir|insulin degludec|basal insulin|nph|regular insulin|lispro|aspart|glulisine)\b/i],
      cuePatterns: [
        /\breliable.{0,30}(self.?care|injection|adherence)\b/i,
        /\bable to\b.{0,20}\b(self.?monitor|inject|adhere)\b/i,
        /\bgood understanding\b.{0,30}\binjection\b/i
      ]
    },
    {
      label: "Sacubitril/Valsartan or ACE-I/ARB",
      drugPatterns: [
        /\b(sacubitril|valsartan|entresto|lisinopril|enalapril|ramipril|losartan|olmesartan|candesartan)\b/i,
        /\b(ace\s*inhibitor|arni|arb)\b/i
      ],
      cuePatterns: [
        /\bno\b.{0,30}\b(angioedema|history of cough on ace)\b/i,
        /\b36.?hour\s+washout\b/i
      ]
    },
    {
      label: "Mineralocorticoid receptor antagonist",
      drugPatterns: [/\b(spironolactone|eplerenone|finerenone|mineralocorticoid receptor antagonist|mra)\b/i],
      cuePatterns: [
        /\bpotassium\b.{0,20}\b(normal|3\.[5-9]|4\.\d)\b/i,
        /\bk\+?\b.{0,15}\b(3\.[5-9]|4\.\d)\b/i
      ]
    },
    {
      label: "Non-selective beta-blocker",
      drugPatterns: [/\b(propranolol|nadolol|carvedilol|labetalol|timolol)\b/i],
      cuePatterns: [/\bno\b.{0,30}\b(asthma|bronchospasm|reactive airway|copd exacerbation)\b/i]
    },
    {
      label: "Thiazide or loop diuretic",
      drugPatterns: [/\b(hydrochlorothiazide|hctz|chlorthalidone|indapamide|furosemide|bumetanide|torsemide|metolazone)\b/i],
      cuePatterns: [/\bno\b.{0,30}\b(history of gout|hyperuricemia)\b/i]
    },
    {
      label: "QT-prolonging agent",
      drugPatterns: [/\b(methadone|ondansetron|haloperidol|sotalol|dofetilide|amiodarone|citalopram|escitalopram|azithromycin|levofloxacin|moxifloxacin)\b/i],
      cuePatterns: [
        /\bqtc\b.{0,15}\b[34]\d{2}\s*ms\b/i,
        /\bno\b.{0,30}\b(qt prolongation|long qt|torsades)\b/i
      ]
    },
    {
      label: "DPP-4 inhibitor",
      drugPatterns: [/\b(sitagliptin|saxagliptin|linagliptin|alogliptin|vildagliptin)\b/i, /\bdpp.?4\b/i],
      cuePatterns: [/\bno\b.{0,30}\b(history of pancreatitis|heart failure)\b/i]
    },
    {
      label: "Bisphosphonate",
      drugPatterns: [/\b(alendronate|risedronate|ibandronate|zoledronic acid|pamidronate)\b/i, /\bbisphosphonate\b/i],
      cuePatterns: [
        /\bno\b.{0,30}\b(esophageal|gastroesophageal|gerd|dental work|jaw)\b/i,
        /\begfr\b.{0,30}\b(>|>=|greater than)\s*35\b/i
      ]
    },
    {
      label: "Denosumab",
      drugPatterns: [/\bdenosumab\b/i, /\bprolia\b/i, /\bxgeva\b/i],
      cuePatterns: [
        /\bcalcium\b.{0,20}\b(normal|9\.\d|10\.\d)\b/i,
        /\bno\b.{0,30}\bhypocalcemia\b/i
      ]
    },
    {
      label: "Levothyroxine dose adjustment",
      drugPatterns: [/\b(increase|decrease|adjust).{0,20}levothyroxine\b/i, /\blevothyroxine\s+dose\b/i],
      cuePatterns: [
        /\bgood adherence\b/i,
        /\btakes (it|levothyroxine) on an empty stomach\b/i,
        /\bno (calcium|iron|ppi|coffee).{0,20}(within|near|around).{0,10}(dose|administration)\b/i
      ]
    }
  ];

  for (const pair of CUEING_PAIRS) {
    const correctMatches = pair.drugPatterns.some(pat => pat.test(correctText));
    if (!correctMatches) continue;
    for (const cuePat of pair.cuePatterns) {
      if (cuePat.test(stemLower)) {
        console.warn(`[detectAntiCueingViolation] CUEING — stem telegraphs "${pair.label}".`);
        return true;
      }
    }
  }
  return false;
}


// ============================================================
// CLAUDE & GEMINI CLIENTS
// ============================================================
async function callClaude(systemText, userText, maxTokens) {
  const maxRetries  = 1; 
  const entropySeed = Date.now().toString() + "-" + Math.floor(Math.random() * 1000000);
  const finalUserText = userText + "\n\n[Seed: " + entropySeed + "]";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000);
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
    if (!response.ok) throw new Error(`Claude HTTP Error: ${response.status}`);
    const data = await response.json();
    const toolUseBlock = data.content.find(b => b.type === "tool_use" && b.name === "emit_mcq");
    if (!toolUseBlock || !toolUseBlock.input) throw new Error("Claude response missing expected tool_use block.");
    return { parsed: toolUseBlock.input, model: "claude-sonnet-4-6" };
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
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema: MCQ_TOOL.input_schema,
          temperature: 0.6, 
          maxOutputTokens: maxTokens 
        }
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
// SHUFFLE & DB SAVER
// ============================================================
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
    // Safe fallback to route specific topic requests if frontend syntax is unique
    let distLevel = level;
    if (topic === "Random -- Endocrinology Only") distLevel = "ABIM Endocrinology";
    
    const dist = TOPIC_DISTRIBUTION[distLevel] || TOPIC_DISTRIBUTION["ABIM Internal Medicine"];
    const mappedBlueprint = dist.map(t => ({ s: t.topic, w: t.weight }));
    promptTopic = pickWeighted(mappedBlueprint);
  }

  const isABIM_Endo = level === "ABIM Endocrinology";
  const isStep3     = level === "USMLE Step 3";
  const isABIM_IM   = level === "ABIM Internal Medicine";
  const isStep1     = level === "USMLE Step 1";

  let qTypePool = [];
  if (promptTopic.includes("Ethics") || promptTopic.includes("Behavioral") || promptTopic.includes("HIPAA") || promptTopic.includes("end-of-life") || promptTopic.includes("consent")) {
    qTypePool = [{s:"most appropriate NEXT STEP IN PATIENT COUNSELING",w:40}, {s:"LEGAL OR ETHICAL REQUIREMENT",w:40}];
  } else if (isStep1) {
    qTypePool = [{s:"UNDERLYING MECHANISM OR PATHOPHYSIOLOGY",w:40}, {s:"MECHANISM OF ACTION OR TOXICITY",w:30}];
  } else if (isStep3) {
    qTypePool = [
      {s:"MOST APPROPRIATE MULTI-STEP MANAGEMENT given facility constraints or patient comorbidities",w:30},
      {s:"NEXT BEST ACTION when initial management has failed or complications arise",w:25},
      {s:"MOST APPROPRIATE DISPOSITION OR TRANSITION OF CARE decision",w:20},
      {s:"MOST LIKELY COMPLICATION of current management and how to address it",w:15},
      {s:"MOST APPROPRIATE INFORMED CONSENT or ethical decision in a complex clinical scenario",w:10}
    ];
  } else if (isABIM_IM) {
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT TREATMENT STEP given organ dysfunction, intolerance, or comorbidity conflict",w:40},
      {s:"MOST APPROPRIATE MANAGEMENT when first-line therapy has failed or is contraindicated",w:35},
      {s:"MOST APPROPRIATE DRUG CHOICE given specific comorbidity profile (CKD, HF, DM, prior ASCVD)",w:20},
      {s:"MOST APPROPRIATE NEXT STEP when risk stratification tools yield borderline or conflicting results",w:5}
    ];
  } else if (isABIM_Endo) {
    qTypePool = [
      {s:"MOST APPROPRIATE NEXT STEP IN MANAGEMENT given an atypical or guideline-edge scenario",w:35},
      {s:"MOST APPROPRIATE PHARMACOLOGIC CHOICE based on cardiorenal or comorbidity profile",w:30},
      {s:"NEXT STEP IN DIAGNOSTIC WORKUP (e.g., dynamic testing, imaging, or genetic screening) to confirm a complex subtype",w:25},
      {s:"MOST APPROPRIATE MODIFICATION to current therapy given a new complication or side effect",w:10}
    ];
  } else {
    qTypePool = [{s:"NEXT STEP IN DIAGNOSIS",w:25}, {s:"MOST LIKELY DIAGNOSIS",w:25}, {s:"NEXT STEP IN MANAGEMENT",w:40}, {s:"STRONGEST RISK FACTOR",w:10}];
  }
  const promptQType = pickWeighted(qTypePool);
  const randomSex   = pickSexForTopic(promptTopic);

  const isUSMLE   = level.includes("USMLE");
  const maxTokens = isABIM_Endo ? 3200 : (isABIM_IM || isStep3) ? 2800 : 2200;

  const systemRole = isUSMLE ? "an NBME Senior Item Writer for the USMLE" : isABIM_Endo ? "an ABIM Endocrinology Fellowship Program Director" : "an ABIM Internal Medicine Board Question Writer";

  const VIGNETTE_STYLE_GUIDE = isStep1 ? "" : `
STRICT VIGNETTE SYNTAX (NBME/ABIM STANDARD):
1. MAXIMUM 130 WORDS for the stem.
2. ZERO INTRODUCTORY FLUFF. Start immediately with age, sex, and chief complaint.
3. HIGH-DENSITY DATA. Combine vitals and physical exam into single sentences. 
4. DO NOT interpret labs. State the raw value.
5. CONCEALMENT RULE: NEVER name the primary diagnosis or underlying mechanism in the stem.`;

  let levelRules;
  if (isStep1) {
    levelRules = `USMLE STEP 1 RULES (M2 LEVEL — BASIC SCIENCE INTEGRATION):
- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs.
- Question type focus: mechanism of disease, pharmacology MOA, biochemistry pathways, genetics, microbiology, pathophysiology, histology, gross anatomy.
- Acceptable lead-ins: "most likely cause", "best explanation for this finding", "mechanism most likely responsible".
- AVOID management-style lead-ins — Step 1 tests UNDERSTANDING, not management decisions.
- Distractors should target the most common student confusions (mechanistically adjacent enzymes/pathways/receptors).
- Shorter stems acceptable (1–2 well-loaded sentences if the case turns on a single mechanism).`;
  } else if (level === "USMLE Step 2 CK") {
    levelRules = `USMLE STEP 2 CK RULES (M3/M4 LEVEL — CLINICAL REASONING):
- Vignette order: Age/Sex/Setting → CC → HPI → PMH → Meds/Soc/Fam → Vitals → Exam → Labs/Imaging.
- Question type focus: most likely diagnosis, best initial diagnostic test, best initial management, most likely cause of an acute clinical finding.
- Test PATTERN RECOGNITION of common conditions over rare ones — bread-and-butter conditions seen on medicine, surgery, peds, OB/GYN, psych, family medicine rotations.
- Distractors are competing diagnoses on the differential — wrong but plausible to a clerkship student.
- Settings: outpatient clinic, ED, inpatient ward, urgent care.
- Bayesian reasoning expected: prior probability + new test result → posterior decision.`;
  } else if (isStep3) {
    levelRules = `USMLE STEP 3 RULES (PGY-1 LEVEL — PRACTICE-READY PHYSICIAN):
- Question type focus: management decisions, disposition (admit vs discharge, ICU vs floor), threshold decisions (treat vs observe), follow-up planning.
- FORBIDDEN: "What is the most likely diagnosis?" — diagnosis must be implied or stated in the stem.
- Distractors should reflect real management forks where a PGY-1 might choose wrong (premature discharge, unnecessary admission, wrong tier of antibiotic, wrong agent in a stepped protocol).
- Multi-system, complex patients are expected; address polypharmacy, comorbidity interactions, code status, goals of care where appropriate.
- Public-health, ethics, and biostatistics integration acceptable when clinically relevant.`;
  } else if (isABIM_IM) {
    levelRules = `ABIM INTERNAL MEDICINE RULES (BOARD-CERTIFYING INTERNIST LEVEL):
- Question type focus: multi-system synthesis, complex comorbidities, drug-drug interactions, treatment failure or intolerance, borderline risk scores requiring judgment.
- FORBIDDEN: "What is the most likely diagnosis?" — synthesis questions require management-level lead-ins.
- Distractors must be options a guideline-aware internist might actually choose; "obviously wrong" distractors are unacceptable at this level.
- Address: when to refer to subspecialty, when to initiate vs withhold treatment, how to adjust for comorbidities (CKD, HF, cirrhosis, frailty).`;
  } else if (isABIM_Endo) {
    levelRules = `ABIM ENDOCRINOLOGY RULES (SUBSPECIALIST LEVEL):
- Question type focus: atypical presentations, guideline-edge cases, complex diagnostic workups (CRH stimulation, IPSS, octreotide/68Ga-DOTATATE scan, genetic panels), therapy modification.
- FORBIDDEN: "What is the most likely diagnosis?" — the stem must test subspecialty management, complex diagnostic workup, or therapy modification.
- Distractors must be options a subspecialty colleague might reasonably propose; items must discriminate between fellow-level and attending-level reasoning.
- Address: dynamic testing protocols, surgical vs medical management, peri-procedural management (adrenalectomy, thyroidectomy), pregnancy considerations for endocrine disease.`;
  } else {
    levelRules = `BOARD-STYLE RULES: Generalist synthesis level.`;
  }

  const integrityRules = `INTEGRITY RULES:
A. Evidence discipline: cite only data explicitly in stem.
B. "glucose" never "sugar".
C. VLDL/LDL: You MUST accurately distinguish between VLDL and LDL.
D. COMPETITIVE DISTRACTORS (TIER 3 REQUIREMENT): Every wrong choice MUST be a highly plausible action or mechanism for a related, competing diagnosis. 
E. EXPLANATION FORMATTING (MANDATORY TO AVOID SHUFFLE BUGS): 
   - In the 🩺 section, YOU ARE FORBIDDEN FROM NAMING THE LETTER OF THE CORRECT CHOICE.
   - In the 🚫 section, YOU MUST start each explanation EXACTLY with "Choice A:", "Choice B:", etc.
F. EXPLANATION-CHOICE CONSISTENCY: The explanation MUST strictly match the text of the corresponding choice.
G. STEM-EXPLANATION NUMERIC LOCK: Every lab value, vital sign, and numeric result cited in your explanation MUST be identical to the value stated in the stem. Re-read your stem before calling emit_mcq.
H. ANTI-CUEING (CRITICAL — VIOLATIONS DISQUALIFY THE ITEM):
   A "pertinent negative" or descriptor in the stem MUST NOT pre-emptively clear a contraindication, side effect, or eligibility marker that is SPECIFIC to the correct answer. FORBIDDEN cueing examples:
   - "no history of bladder cancer" / "no recurrent UTIs" when the correct answer is an SGLT2 inhibitor
   - "no history of pancreatitis" / "no family history of medullary thyroid carcinoma or MEN 2" when the correct answer is a GLP-1 RA
   - "eGFR > 30" stated without diagnostic purpose when the correct answer is metformin
   - "no history of heart failure" / "no peripheral edema" when the correct answer is a TZD/pioglitazone
   - "no history of angioedema" when the correct answer is sacubitril/valsartan or an ACE-I
   - "potassium 4.2" stated without diagnostic purpose when the correct answer is spironolactone/eplerenone
   - "QTc 410 ms" stated without diagnostic purpose when the correct answer is a QT-prolonging drug
   - "no history of asthma or bronchospasm" when the correct answer is a non-selective beta-blocker
   - "no history of gout" when the correct answer is a thiazide or loop diuretic
   - "reliable medication adherence / injection technique" when the correct answer is insulin or a GLP-1 RA

   REMOVAL TEST: For every pertinent negative, mentally remove it.
   - If removing makes a DISTRACTOR more attractive (rules out competing differential) → KEEP.
   - If removing makes only the CORRECT answer less attractive (clears its contraindication) → DELETE.

   Pertinent negatives exist to differentiate among DIAGNOSES on the differential, NOT to clear the path to the THERAPEUTIC answer.`;

  const guardrails = getTopicGuardrails(level, promptTopic);

  const explanationNote = `EXPLANATION FORMAT — use these exact headers:
🩺 Why this is the correct answer: [Explain clinical reasoning without naming the choice letter. Cite the most recent officially published guideline (do not fabricate dates if older)].
🚫 Why the other choices fail: [Explain the 4 INCORRECT choices only, starting exactly with "Choice X:". DO NOT include the correct choice in this section].
💎 Board Pearl: [one high-yield fact].`;

  const topicGuideline = getGuidelineContext(promptTopic, isNutrition);

  const systemText = `You are ${systemRole}. Output confident, accurate facts.
${levelRules}
${VIGNETTE_STYLE_GUIDE}
${integrityRules}

TOPIC-SPECIFIC HARD RULES (CLINICAL ACCURACY ANCHORS):
${guardrails.l1}

CLINICAL EVIDENCE STANDARD: You MUST base the diagnosis, management, and explanation citations strictly on: ${topicGuideline}. Do not use outdated criteria.
${explanationNote}
UNIVERSAL HARD RULES: HIT: argatroban hepatic, bivalirudin/fondaparinux renal; DKA/HHS: K+ >3.3 before insulin; thyroid storm: PTU before iodine.
RESPONSE FORMAT: You MUST respond by calling the emit_mcq tool exactly once.`;

  const step3TierPrompt = isStep3 ? `
USMLE STEP 3 TIER 3-5 REQUIREMENTS:
- FORBIDDEN: "What is the most likely diagnosis?". Diagnosis MUST be implied or stated.
- Must present management decision, disposition, or intervention.
- Build in realistic constraint: facility without cath lab, transfer time >120 min, or failed first-line therapy.
- Distractors must include the Tier 1/2 answer (what a MS3 would choose).` : "";

  const abimIMTierPrompt = isABIM_IM ? `
ABIM INTERNAL MEDICINE TIER 3-4 REQUIREMENTS:
- FORBIDDEN: "What is the most likely diagnosis?". Diagnosis MUST be implied or stated.
- Present synthesis scenario: borderline risk scores, treatment failure, intolerance, multi-comorbidity drug selection.
- Distractors must include the Tier 1 answer (what a MS4 would choose).` : "";

  const endoTier3Prompt = isABIM_Endo ? `
ABIM ENDOCRINOLOGY TIER 3+ REQUIREMENTS:
- FORBIDDEN: "What is the most likely diagnosis?". Question must test subspecialty management, complex diagnostic workup, or therapy modification.
- Present an ATYPICAL, COMPLEX, or GUIDELINE-EDGE scenario.
- Distractors must include the "classic teaching" answer that a non-subspecialist would choose.` : "";

  const selfVerification = `
MANDATORY SELF-VERIFICATION — complete all 5 checks before calling emit_mcq:
1. SCENARIO PLAUSIBILITY: Is the patient age, sex, and diagnosis combination clinically realistic? (e.g., eGFR 28 in a 34yo requires explicit etiology)
2. CORRECT ANSWER DEFENSIBILITY: Does your correct answer remain correct against current guidelines if a subspecialist challenges it?
3. DISTRACTOR AUDIT: Would any distractor actually be chosen by a guideline-following clinician for THIS specific patient profile? If yes, reconsider — distractors must be wrong for a specific, statable reason.
4. NUMERIC CONSISTENCY: Do all lab values in the explanation EXACTLY match the stem?
5. CITATION ACCURACY: Did you cite a real trial with real data? Do not fabricate co-authoring organizations or joint guidelines.`;

  const userText = isStep1
  ? `Write 1 vignette on: ${promptTopic}.
- Question asks for: ${promptQType}.
- Patient Demographics & Setting: Patient is a ${randomSex}. 
- Pertinent Negatives: Include a pertinent negative ONLY if it helps rule out a competing DIAGNOSIS on the differential. A pertinent negative MUST NOT clear a contraindication, side effect, or eligibility marker for the correct THERAPEUTIC choice (see Rule H — Anti-Cueing). Do NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, etc.) unless directly relevant to the diagnosis.
- The stem MUST end with the interrogative sentence.
${selfVerification}
Emit the question by calling the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`
  : `Construct a Tier 3 Board-style puzzle on: ${promptTopic}.
- Lead-in asks for: ${promptQType}.
- Demographics & Setting: Patient is a ${randomSex}. Select a clinically appropriate age and care setting.
- Pertinent Negatives: Include 1-2 pertinent negatives ONLY if they help rule out a competing DIAGNOSIS on the differential. A pertinent negative MUST NOT clear a contraindication, side effect, or eligibility marker for the correct THERAPEUTIC choice (see Rule H — Anti-Cueing). DO NOT include sex-specific screening labs (B-hCG, PSA, menstrual history, prostate exam, pelvic exam, etc.) unless the case turns on them.
- The stem MUST end with the interrogative sentence.

${guardrails.l2}

${step3TierPrompt}${abimIMTierPrompt}${endoTier3Prompt}
${selfVerification}
Execute the generation using the emit_mcq tool. Set demographic_check to "confirmed ${randomSex}".`;

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

    const topicResult   = pickTopicForLevel(b.level, b.topic);
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

      p = callResult?.parsed;
      generationModel = callResult?.model;
      if (!p || !p.stem || !p.choices || !p.correct || !p.explanation) continue;

      const demoOk        = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic);
      const consistencyOk = validateConsistency(p);
      const choicesOk     = validateChoiceCompleteness(p);
      const cueingFree    = !detectAntiCueingViolation(p);
      isValid = demoOk && consistencyOk && choicesOk && cueingFree;

      if (!isValid && attempts === 3) {
        const fbResult  = await callGemini(pd.systemText, pd.userText, pd.maxTokens);
        p               = fbResult.parsed;
        generationModel = fbResult.model;
        isValid = validateDemographics(p.stem, pd.randomSex, pd.resolvedTopic) && validateConsistency(p) && validateChoiceCompleteness(p) && !detectAntiCueingViolation(p);
      }
    }

    if (!isValid) throw new Error("Failed to generate a valid MCQ after maximum retries.");

    p.topic = pd.resolvedTopic;
    const letters      = ['A', 'B', 'C', 'D', 'E'];
    const correctIndex = letters.indexOf(p.correct);
    const optionsArray = letters.map((letter, i) => ({ originalLetter: letter, text: p.choices[letter], isCorrect: i === correctIndex })).filter(opt => opt.text != null);

    for (let i = optionsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
    }

    const shuffledChoices = {};
    const letterMap       = {};
    let newCorrectLetter  = 'A';
    optionsArray.forEach((item, index) => {
      const newLetter = letters[index];
      shuffledChoices[newLetter] = item.text;
      letterMap[item.originalLetter] = newLetter;
      if (item.isCorrect) newCorrectLetter = newLetter;
    });

    p.choices     = shuffledChoices;
    p.correct     = newCorrectLetter;
    p.explanation = rewriteExplanationLetters(p.explanation, letterMap);

    // Kept as a fire-and-forget promise to prevent 502/504 Netlify execution timeouts
    saveMcqToSupabase(p, b.level, { resolvedTopic: pd.resolvedTopic, generationModel }).catch(() => {});
    
    delete p.demographic_check;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([p]) };
  } catch (e) {
    console.error("Handler Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
