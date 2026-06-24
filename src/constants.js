// constants.js — shared design tokens, catalog data, and small helpers.
// Extracted verbatim from the original single-file app so behavior is identical.

export const NAVY = "#002868";
export const GOLD = "#C9A84C";
export const BG = "#0a0a0f";
export const CARD = "rgba(255,255,255,0.04)";
export const BDR = "#1e293b";

export const PORTAL_URL = "https://billing.stripe.com/p/login/fZufZ9fDJ4NVbNM5iS2sM00";
export const PAYMENT_LINKS = {
  student: "https://buy.stripe.com/8x24gr9flcgn9FE4eO2sM03",
  resident: "https://buy.stripe.com/8x228j0IPfszcRQ8v42sM04",
  institution: "https://buy.stripe.com/cNidR19flbcjbNM5iS2sM05",
};
export const SECS = 90;

export const PLANS = [
  { key: "student", name: "Medical Student", price: 29, period: "month", color: "#3B82F6", badge: null, features: ["USMLE Step 1, 2 & 3", "Premium QBank Access", "Official society guidelines", "Study & exam modes", "Integrated Lab & Calcs"] },
  { key: "resident", name: "Resident / Fellow", price: 59, period: "month", color: "#8B5CF6", badge: "MOST POPULAR", features: ["Everything in Student", "ABIM Internal Medicine", "ABIM Endocrinology subspecialty", "Timed exam mode", "Progress tracking"] },
  { key: "institution", name: "Institution", price: 2999, period: "year", color: "#10B981", badge: "BEST VALUE", features: ["Up to 20 learner seats", "Full access all content", "ADA, ES, AACE, ACC/AHA, ESC", "Personal onboarding", "~$250/mo flat"] },
];

export const LEVELS = [
  { v: "USMLE Step 1", l: "USMLE Step 1" },
  { v: "USMLE Step 2 CK", l: "USMLE Step 2 CK" },
  { v: "USMLE Step 3", l: "USMLE Step 3" },
  { v: "ABIM Internal Medicine", l: "ABIM Internal Medicine" },
  { v: "ABIM Endocrinology", l: "ABIM Endocrine Boards" },
];

export const GROUPS = {
  "Random": ["Random -- All Specialties", "Random -- Endocrinology Only", "Random -- ABIM IM Blueprint", "Random -- USMLE High-Yield"],
  "Diabetes": ["Type 2 Diagnosis and Management", "Type 1 Insulin Therapy", "DKA and HHS", "Hypoglycemia", "Microvascular Complications", "Macrovascular Complications", "Gestational Diabetes", "LADA and MODY", "CGM and AID Systems", "GLP-1 Receptor Agonists", "SGLT2 Inhibitors", "Inpatient Glycemic Management"],
  "Thyroid": ["Hypothyroidism and Hashimotos", "Hyperthyroidism and Graves", "Thyroid Storm", "Thyroid Nodule Evaluation", "Thyroid Cancer", "Thyroid in Pregnancy", "Subacute Thyroiditis"],
  "Adrenal": ["Adrenal Insufficiency", "Cushings Syndrome", "Primary Aldosteronism", "Pheochromocytoma", "Adrenal Crisis", "Congenital Adrenal Hyperplasia"],
  "Pituitary": ["Hypopituitarism", "Prolactinoma", "Acromegaly", "Diabetes Insipidus", "Pituitary Apoplexy", "Cushings Disease"],
  "Bone and Calcium": ["Hypercalcemia", "Hyperparathyroidism", "Osteoporosis", "Vitamin D Deficiency", "Pagets Disease", "Hypoparathyroidism"],
  "Reproductive Endo": ["PCOS", "Male Hypogonadism", "Menopause and HRT", "Precocious Puberty", "Turner and Klinefelter"],
  "NETs and MEN": ["Carcinoid Tumors", "Insulinoma", "Gastrinoma", "MEN1", "MEN2A and MEN2B"],
  "Cardiology": ["ACS STEMI NSTEMI", "Heart Failure", "Atrial Fibrillation", "Hypertension", "Valvular Disease", "Lipid Disorders", "Pulmonary Embolism"],
  "Pulmonology": ["Asthma and COPD", "Pneumonia", "Interstitial Lung Disease", "ARDS", "Sleep Apnea", "Pulmonary Function Tests"],
  "Nephrology": ["Acute Kidney Injury", "CKD", "Glomerulonephritis", "Electrolyte Disorders", "Acid-Base Disorders", "Nephrotic Syndrome"],
  "GI and Hepatology": ["IBD Crohns and UC", "Cirrhosis", "Hepatitis B and C", "GI Bleeding", "Acute Pancreatitis", "NAFLD NASH"],
  "Neurology": ["Ischemic Stroke", "Seizures and Epilepsy", "Multiple Sclerosis", "Meningitis", "Parkinsons Disease", "Headache"],
  "Infectious Disease": ["Sepsis and Septic Shock", "HIV", "Tuberculosis", "Infective Endocarditis", "Antibiotic Stewardship", "COVID-19"],
  "Hematology": ["Anemia", "Sickle Cell Disease", "Thrombocytopenia", "DVT and Anticoagulation", "Leukemia and Lymphoma", "Multiple Myeloma"],
  "Rheumatology": ["Rheumatoid Arthritis", "SLE", "Gout and Pseudogout", "Giant Cell Arteritis", "Vasculitis", "Ankylosing Spondylitis"],
  "Pharmacology": ["Antibiotic Classes", "Cardiovascular Drugs", "Diabetes Medications", "Anticoagulants", "Immunosuppressants", "Drug Interactions"],
  "Ethics": ["Informed Consent", "Advance Directives", "End-of-Life Care", "Medical Errors", "Health Disparities", "High-Value Care"],
};

export const GUIDES = [
  { id: 1, t: "ADA Standards of Medical Care in Diabetes", s: "Endocrinology", i: "D", u: "https://diabetesjournals.org/care/issue/48/Supplement_1" },
  { id: 2, t: "Endocrine Society Clinical Practice Guidelines", s: "Endocrinology", i: "E", u: "https://www.endocrine.org/clinical-practice-guidelines" },
  { id: 3, t: "AACE Clinical Guidance", s: "Endocrinology", i: "A", u: "https://pro.aace.com/clinical-guidance" },
  { id: 4, t: "ACC/AHA Cardiovascular Guidelines", s: "Cardiology", i: "C", u: "https://www.acc.org/guidelines" },
  { id: 5, t: "KDIGO Kidney Disease Guidelines", s: "Nephrology", i: "K", u: "https://kdigo.org/guidelines" },
  { id: 6, t: "USPSTF Preventive Recommendations", s: "Preventive", i: "U", u: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics" },
  { id: 7, t: "ESC Cardiovascular Guidelines", s: "Cardiology", i: "S", u: "https://www.escardio.org/Guidelines" },
  { id: 8, t: "EASD Diabetes Guidelines", s: "Endocrinology", i: "X", u: "https://www.easd.org/guidelines/statements-and-guidelines.html" },
  { id: 9, t: "IDSA Infectious Disease Guidelines", s: "ID", i: "I", u: "https://www.idsociety.org/practice-guideline/alphabetical-guidelines" },
  { id: 10, t: "NCCN Oncology Guidelines", s: "Oncology", i: "N", u: "https://www.nccn.org/guidelines/guidelines-detail" },
  { id: 11, t: "ACR Rheumatology Guidelines", s: "Rheumatology", i: "R", u: "https://www.rheumatology.org/Practice-Quality/Clinical-Support/Clinical-Practice-Guidelines" },
  { id: 12, t: "ATS/ERS Respiratory Guidelines", s: "Pulmonology", i: "P", u: "https://www.thoracic.org/statements" },
  { id: 13, t: "American Thyroid Association Guidelines", s: "Endocrinology", i: "T", u: "https://www.thyroid.org/professionals/ata-professional-guidelines" },
  { id: 14, t: "National Osteoporosis Foundation Guidelines", s: "Bone", i: "B", u: "https://www.bonehealthandosteoporosis.org/clinicians/guidelines" },
  { id: 15, t: "NEJM Image Challenge", s: "Visual Dx", i: "N", u: "https://www.nejm.org/image-challenge" },
  { id: 16, t: "ECG Wave-Maven — Harvard/BIDMC", s: "Cardiology", i: "E", u: "http://ecg.bidmc.harvard.edu" },
  { id: 17, t: "ACG Clinical Guidelines — Gastroenterology", s: "GI", i: "G", u: "https://gi.org/guidelines" },
  { id: 18, t: "AASLD Liver Disease Practice Guidelines", s: "Hepatology", i: "L", u: "https://www.aasld.org/publications/practice-guidelines" },
  { id: 19, t: "AGA Clinical Practice Guidelines", s: "GI", i: "A", u: "https://www.gastro.org/guidelines" },
  { id: 20, t: "GOLD COPD Guidelines", s: "Pulmonology", i: "O", u: "https://goldcopd.org/2024-gold-report" },
  { id: 21, t: "GINA Asthma Guidelines", s: "Pulmonology", i: "G", u: "https://ginasthma.org/reports" },
  { id: 22, t: "Surviving Sepsis Campaign Guidelines", s: "Critical Care", i: "S", u: "https://www.sccm.org/SurvivingSpecialsSepsis/Guidelines" },
  { id: 23, t: "Society of Hospital Medicine — Clinical Guidelines", s: "Hospital Medicine", i: "H", u: "https://www.hospitalmedicine.org/clinical-topics/all-clinical-resources" },
  { id: 24, t: "AASM Sleep Medicine Guidelines", s: "Sleep", i: "Z", u: "https://aasm.org/clinical-resources/practice-standards/practice-guidelines" },
];

export function fmtTime(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}
