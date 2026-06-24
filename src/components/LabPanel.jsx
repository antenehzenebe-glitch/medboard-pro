// LabPanel.jsx — collapsible lab-values + medical-calculator reference panel.
import React from "react";
import { GOLD, BDR } from "../constants.js";

export default function LabPanel() {
  const [labTab, setLabTab] = React.useState("labs");
  const [openCat, setOpenCat] = React.useState(null);
  const LAB_DATA = [
    { cat: "Chemistry", color: "#3B82F6", labs: [
      { n: "Sodium", v: "136-145 mEq/L" }, { n: "Potassium", v: "3.5-5.0 mEq/L" }, { n: "Chloride", v: "98-106 mEq/L" },
      { n: "Bicarbonate", v: "22-29 mEq/L" }, { n: "BUN", v: "7-20 mg/dL" }, { n: "Creatinine", v: "0.6-1.2 mg/dL" },
      { n: "eGFR", v: ">60 mL/min/1.73m2" }, { n: "Glucose fasting", v: "70-99 mg/dL" }, { n: "Calcium total", v: "8.5-10.5 mg/dL" },
      { n: "Phosphorus", v: "2.5-4.5 mg/dL" }, { n: "Magnesium", v: "1.7-2.2 mg/dL" }, { n: "Albumin", v: "3.5-5.0 g/dL" },
      { n: "ALT", v: "7-56 U/L" }, { n: "AST", v: "10-40 U/L" }, { n: "Alk Phos", v: "44-147 U/L" },
      { n: "Total Bilirubin", v: "0.1-1.2 mg/dL" }, { n: "Troponin I", v: "<0.04 ng/mL" }, { n: "BNP", v: "<100 pg/mL" },
      { n: "CRP", v: "<1.0 mg/L" }, { n: "Lactate", v: "0.5-2.2 mmol/L" }, { n: "Serum Osmolality", v: "275-295 mOsm/kg" },
      { n: "Anion Gap", v: "8-12 mEq/L" }, { n: "Ferritin male", v: "24-336 ng/mL" }, { n: "B12", v: "200-900 pg/mL" },
    ] },
    { cat: "Hematology", color: "#EF4444", labs: [
      { n: "WBC", v: "4500-11000/uL" }, { n: "Hgb male", v: "13.5-17.5 g/dL" }, { n: "Hgb female", v: "12.0-15.5 g/dL" },
      { n: "Hct male", v: "41-53%" }, { n: "MCV", v: "80-100 fL" }, { n: "Platelets", v: "150-400k/uL" },
      { n: "Neutrophils", v: "50-70%" }, { n: "Lymphocytes", v: "20-40%" }, { n: "PT", v: "11-13.5 sec" },
      { n: "INR", v: "0.8-1.2" }, { n: "aPTT", v: "25-35 sec" }, { n: "D-dimer", v: "<0.5 ug/mL" },
      { n: "Fibrinogen", v: "200-400 mg/dL" }, { n: "Haptoglobin", v: "30-200 mg/dL" },
    ] },
    { cat: "Endocrinology", color: "#C9A84C", labs: [
      { n: "TSH", v: "0.4-4.0 mIU/L" }, { n: "Free T4", v: "0.8-1.8 ng/dL" }, { n: "Free T3", v: "2.3-4.2 pg/mL" },
      { n: "HbA1c normal", v: "<5.7%" }, { n: "HbA1c prediabetes", v: "5.7-6.4%" }, { n: "HbA1c DM target", v: "<7.0%" },
      { n: "Fasting insulin", v: "2-25 uIU/mL" }, { n: "C-peptide", v: "0.5-2.0 ng/mL" },
      { n: "Cortisol AM", v: "6-23 ug/dL" }, { n: "ACTH", v: "10-60 pg/mL" }, { n: "UFC 24hr", v: "<50 ug/24hr" },
      { n: "LDDST post dex", v: "<1.8 ug/dL" }, { n: "Aldosterone upright", v: "4-31 ng/dL" },
      { n: "Plasma metanephrines", v: "<0.5 nmol/L" }, { n: "PTH intact", v: "10-65 pg/mL" },
      { n: "25-OH Vit D", v: "30-100 ng/mL" }, { n: "Prolactin male", v: "2-18 ng/mL" },
      { n: "IGF-1 adult 20-40yr", v: "115-355 ng/mL" }, { n: "Testosterone male", v: "300-1000 ng/dL" },
      { n: "LH male", v: "1.7-8.6 IU/L" }, { n: "FSH male", v: "1.5-12.4 IU/L" },
    ] },
    { cat: "Lipidology", color: "#10B981", labs: [
      { n: "Total cholesterol", v: "<200 mg/dL" }, { n: "LDL optimal", v: "<100 mg/dL" },
      { n: "LDL high risk", v: "<70 mg/dL" }, { n: "HDL male", v: ">40 mg/dL" }, { n: "HDL female", v: ">50 mg/dL" },
      { n: "TG normal", v: "<150 mg/dL" }, { n: "TG high", v: "200-499 mg/dL" }, { n: "Non-HDL target", v: "<130 mg/dL" },
      { n: "Apo B", v: "<90 mg/dL" }, { n: "Lp(a)", v: "<30 mg/dL" },
    ] },
    { cat: "ABG / Acid-Base", color: "#EC4899", labs: [
      { n: "pH", v: "7.35-7.45" }, { n: "PaCO2", v: "35-45 mmHg" }, { n: "PaO2", v: "75-100 mmHg" },
      { n: "HCO3", v: "22-26 mEq/L" }, { n: "O2 sat", v: "95-100%" }, { n: "Base excess", v: "-2 to +2" },
      { n: "Anion gap", v: "8-12 mEq/L" }, { n: "P/F normal", v: ">400" }, { n: "P/F mild ARDS", v: "200-300" },
    ] },
    { cat: "Rheumatology", color: "#F59E0B", labs: [
      { n: "ANA screening", v: "<1:40 negative" }, { n: "Anti-dsDNA", v: "<30 IU/mL" },
      { n: "RF IgM", v: "<14 IU/mL" }, { n: "Anti-CCP", v: "<20 U/mL" },
      { n: "C3 complement", v: "90-180 mg/dL" }, { n: "C4 complement", v: "16-47 mg/dL" },
      { n: "Uric acid gout target", v: "<6.0 mg/dL" },
    ] },
    { cat: "CSF", color: "#14B8A6", labs: [
      { n: "Opening pressure", v: "70-180 mmH2O" }, { n: "WBC", v: "0-5 cells/uL" },
      { n: "Protein", v: "15-45 mg/dL" }, { n: "Glucose", v: "45-80 mg/dL" },
      { n: "CSF:serum glucose", v: ">0.6" },
    ] },
  ];
  const CALCS = [
    { n: "Anion Gap", f: "Na - (Cl + HCO3)", v: "Normal 8-12 mEq/L", note: "Corrected AG = AG + 2.5 x (4 - albumin)" },
    { n: "Corrected Calcium", f: "Ca + 0.8 x (4 - albumin)", v: "Normal 8.5-10.5 mg/dL", note: "Add 0.8 per 1 g/dL drop in albumin below 4" },
    { n: "Corrected Sodium", f: "Na + 2.4 x [(glucose-100)/100]", v: "Normal 136-145 mEq/L", note: "For hyperglycemia correction" },
    { n: "CrCl Cockcroft-Gault", f: "[(140-age) x wt] / [72 x SCr] x 0.85 female", v: ">60 mL/min normal", note: "Use ideal body weight in obese" },
    { n: "FENa", f: "(uNa x pCr) / (pNa x uCr) x 100", v: "<1% prerenal / >2% intrinsic", note: "Unreliable with diuretics" },
    { n: "Osmolal Gap", f: "Measured Osm - [2xNa + glucose/18 + BUN/2.8]", v: "Normal <10 mOsm/kg", note: ">10 = toxic alcohols" },
    { n: "Winters Formula", f: "Expected PaCO2 = 1.5 x HCO3 + 8 +/- 2", v: "Validates resp compensation" },
    { n: "A-a Gradient", f: "(FiO2 x 713 - PaCO2/0.8) - PaO2", v: "Normal < Age/4 + 4 mmHg" },
    { n: "Delta-Delta Ratio", f: "(AG - 12) / (24 - HCO3)", v: "1-2 = pure AGMA", note: "<1 = non-AG acidosis; >2 = met alkalosis" },
    { n: "MELD Score", f: "3.78xln(bili) + 11.2xln(INR) + 9.57xln(Cr) + 6.43", v: ">=15 consider transplant" },
    { n: "CHA2DS2-VASc", f: "CHF+HTN+Age>=75(x2)+DM+Stroke(x2)+Vasc+Age65-74+Female", v: ">=2 anticoagulate" },
    { n: "HAS-BLED", f: "HTN+Renal/liver+Stroke+Bleed+INR+Elderly+Drugs", v: ">=3 high bleeding risk" },
    { n: "Wells Score PE", f: "DVT signs(3)+Alt dx(3)+HR>100(1.5)+Immob(1.5)+Prior PE(1.5)+Hemoptysis(1)+Cancer(1)", v: "<2 low / 2-6 mod / >6 high" },
    { n: "CURB-65", f: "Confusion+BUN>19+RR>=30+BP<90/60+Age>=65", v: "0-1 outpt / 2 admit / >=3 ICU" },
    { n: "SOFA Score", f: "Resp+Coag+Liver+Cardiovascular+CNS+Renal", v: ">=2 increase = organ dysfunction" },
    { n: "FRAX Score", f: "Age+Sex+BMI+Prior Fx+Parent hip Fx+Smoking+Steroids+RA+Alcohol+BMD", v: "10-yr fracture risk" },
    { n: "Corrected QTc", f: "QT / sqrt(RR in seconds)", v: "<440ms male / <460ms female", note: ">500ms = high risk Torsades" },
    { n: "BMI", f: "Weight(kg) / Height(m)2", v: "Normal 18.5-24.9" },
    { n: "Ideal Body Weight M", f: "50 kg + 2.3 kg per inch over 5 feet", v: "Drug dosing reference" },
    { n: "P/F Ratio", f: "PaO2 / FiO2", v: ">400 normal", note: "ARDS: mild 200-300 / mod 100-200 / severe <100" },
  ];
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid " + BDR, paddingTop: 16 }}>
      <p style={{ fontSize: 11, color: GOLD, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Reference Materials</p>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setLabTab("labs")} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid " + (labTab === "labs" ? GOLD : BDR), background: labTab === "labs" ? "rgba(201,168,76,0.1)" : "transparent", color: labTab === "labs" ? GOLD : "#e2e8f0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Labs</button>
        <button onClick={() => setLabTab("calcs")} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid " + (labTab === "calcs" ? GOLD : BDR), background: labTab === "calcs" ? "rgba(201,168,76,0.1)" : "transparent", color: labTab === "calcs" ? GOLD : "#e2e8f0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Calcs</button>
      </div>
      {labTab === "labs" && (
        <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 5 }}>
          {LAB_DATA.map((section) => (
            <div key={section.cat} style={{ marginBottom: 4 }}>
              <button onClick={() => setOpenCat(openCat === section.cat ? null : section.cat)} style={{ width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6, border: "1px solid " + (openCat === section.cat ? section.color : BDR), background: openCat === section.cat ? section.color + "18" : "transparent", color: openCat === section.cat ? section.color : "#f1f5f9", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                <span>{section.cat}</span><span style={{ fontSize: 9 }}>{openCat === section.cat ? "hide" : "show"}</span>
              </button>
              {openCat === section.cat && (
                <div style={{ padding: "4px 0" }}>
                  {section.labs.map((lab) => (
                    <div key={lab.n} style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ fontSize: 11, color: "#e2e8f0", flex: 1 }}>{lab.n}</span>
                      <span style={{ fontSize: 11, color: "#f1f5f9", fontWeight: 600, textAlign: "right", marginLeft: 4 }}>{lab.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {labTab === "calcs" && (
        <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 5 }}>
          {CALCS.map((c) => (
            <div key={c.n} style={{ marginBottom: 6, background: "rgba(255,255,255,0.02)", border: "1px solid " + BDR, borderRadius: 6, padding: "6px 8px" }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: GOLD, marginBottom: 2 }}>{c.n}</p>
              <p style={{ fontSize: 11, color: "#e2e8f0", marginBottom: 2, lineHeight: 1.4 }}>{c.f}</p>
              <p style={{ fontSize: 11, color: "#10b981", marginBottom: c.note ? 2 : 0 }}>{c.v}</p>
              {c.note && <p style={{ fontSize: 10, color: "#cbd5e1", lineHeight: 1.3 }}>{c.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
