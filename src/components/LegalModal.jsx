// LegalModal.jsx — terms of service / privacy policy / contact modal.
import React from "react";
import { GOLD } from "../constants.js";

export default function LegalModal({ type, onClose }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
      <div className="fade" style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: "32px 40px", width: "100%", maxWidth: 800, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid #1e293b", paddingBottom: 16 }}>
          <h2 style={{ color: GOLD, fontSize: 24, fontWeight: 800 }}>
            {type === "terms" ? "Terms of Service" : type === "privacy" ? "Privacy Policy" : "Contact Support"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 32, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.8 }}>
          {type === "terms" && (
            <div>
              <p style={{ marginBottom: 16 }}>Last Updated: April 2026</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>1. Acceptance of Terms</h4>
              <p style={{ marginBottom: 16 }}>By accessing and using MedBoard Pro, you accept and agree to be bound by the terms and provision of this agreement.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>2. Medical Disclaimer & No Medical Advice</h4>
              <p style={{ marginBottom: 16 }}>MedBoard Pro is an educational platform designed exclusively to assist medical students, residents, and fellows in preparing for medical board examinations. All content is provided for educational and informational purposes only. MedBoard Pro is NOT a substitute for professional medical judgment, diagnosis, or treatment.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>3. Ownership & Proprietary Rights</h4>
              <p style={{ marginBottom: 16 }}>All content, features, and functionality of MedBoard Pro are the exclusive property of MedBoard Pro and are protected by United States and international copyright, trademark, and other intellectual property laws.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>4. Grant of Limited License</h4>
              <p style={{ marginBottom: 16 }}>Subject to your compliance with these Terms, MedBoard Pro grants you a limited, revocable, non-exclusive, non-transferable license to access and use the Qbank strictly for your personal, non-commercial, educational use.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>5. Prohibited Conduct</h4>
              <p style={{ marginBottom: 8 }}>You strictly agree not to copy, distribute, share credentials, scrape data, or reverse engineer any portion of the platform.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>6. Limitation of Liability</h4>
              <p style={{ marginBottom: 16 }}>In no event shall MedBoard Pro or its founder be liable for any indirect, punitive, incidental, or consequential damages.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>7. Subscription and Billing</h4>
              <p style={{ marginBottom: 16 }}>Subscriptions are billed recursively based on the chosen plan. The 14-day free trial requires a valid credit card, and users will be automatically billed on the 15th day unless canceled prior.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>8. Governing Law</h4>
              <p style={{ marginBottom: 16 }}>These Terms shall be governed and construed in accordance with the laws of the State of Maryland, United States.</p>
            </div>
          )}
          {type === "privacy" && (
            <div>
              <p style={{ marginBottom: 16 }}>Last Updated: April 2026</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>1. Information We Collect</h4>
              <p style={{ marginBottom: 16 }}>We collect information you provide directly when you register, including your name, email address, and professional training level.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>2. How We Use Information</h4>
              <p style={{ marginBottom: 16 }}>Your data is used to provide, maintain, and improve the MedBoard Pro platform and generate personalized analytics.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>3. Data Security</h4>
              <p style={{ marginBottom: 16 }}>Your account data is securely stored using Supabase with industry-standard encryption protocols.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>4. Third-Party Sharing</h4>
              <p style={{ marginBottom: 16 }}>We do not sell your personal data to third parties. We only share information with trusted service providers strictly necessary to operate our service.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>5. California Privacy Rights (CCPA/CPRA)</h4>
              <p style={{ marginBottom: 16 }}>MedBoard Pro does not sell or share your personal information for cross-context behavioral advertising. Contact antenehzenebe@gmail.com to exercise CCPA rights.</p>
              <h4 style={{ color: "#f1f5f9", marginTop: 20, marginBottom: 8 }}>6. European Union Privacy Rights (GDPR)</h4>
              <p style={{ marginBottom: 16 }}>EU residents have the Right to be Forgotten, Right to Data Portability, and Right to Restrict Processing.</p>
            </div>
          )}
          {type === "contact" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
              <h3 style={{ color: "#f1f5f9", fontSize: 20, marginBottom: 16 }}>We are here to help.</h3>
              <p style={{ marginBottom: 32 }}>For technical support, billing inquiries, or clinical content feedback, please email the Academic Director directly.</p>
              <div style={{ background: "rgba(201,168,76,0.1)", border: "1px solid " + GOLD, borderRadius: 12, padding: "20px", display: "inline-block" }}>
                <p style={{ color: GOLD, fontSize: 18, fontWeight: 800, margin: 0 }}>antenehzenebe@gmail.com</p>
              </div>
              <p style={{ marginTop: 32, fontSize: 13, color: "#64748b" }}>Average response time: 24-48 hours.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
