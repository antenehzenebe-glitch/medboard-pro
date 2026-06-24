// LandingPage.jsx — pre-auth marketing landing page.
// NOTE: the founder photo was an inline base64 data URI in the original single-file app.
// It is replaced here with the public asset /image/founder-Zenebe.jpg (already referenced
// by the JSON-LD in index.html). Place the JPG at public/image/founder-Zenebe.jpg.
import React from "react";
import { NAVY, GOLD, BG, CARD, BDR, PLANS } from "../constants.js";
import DailyQuestionWidget from "./DailyQuestionWidget.jsx";

export default function LandingPage(props) {
  var { showAuth, setShowAuth, authMode, setAuthMode, email, setEmail, pw, setPw, nm, setNm, authErr, handleAuth, googleLogin, setLegalModal } = props;

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "0 5%", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid " + BDR, position: "sticky", top: 0, background: "rgba(10,10,15,0.97)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg," + NAVY + ",#1a4a9a)", border: "1px solid " + GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: GOLD, fontSize: 16 }}>M</div>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#f1f5f9" }}><span style={{ color: GOLD }}>Med</span>Board<span style={{ color: GOLD, fontStyle: "italic", marginLeft: 2 }}>Pro</span></span>
        </div>
        <div style={{ gap: 24, color: "#94a3b8", fontSize: 14, fontWeight: 600, display: window.innerWidth > 768 ? "flex" : "none" }}>
          <a href="#how" style={{ color: "inherit", textDecoration: "none" }}>Features</a>
          <a href="#about" style={{ color: "inherit", textDecoration: "none" }}>About</a>
          <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing</a>
        </div>
        <button onClick={() => { setAuthMode("signup"); setShowAuth(true); }} style={{ background: "linear-gradient(135deg," + NAVY + ",#1a4a9a)", border: "1px solid #3b82f6", color: "#fff", padding: "10px 24px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(0,40,104,0.4)" }}>
          Sign In / Start Trial
        </button>
      </nav>

      <div style={{ flex: 1 }}>
        <section style={{ padding: "100px 5% 80px", textAlign: "center", maxWidth: 1000, margin: "0 auto" }}>
          <div className="hero-tag">🏥 Created by the Associate Program Director of the Endocrinology Fellowship at Howard University Hospital</div>
          <h1 style={{ fontSize: "clamp(36px,6vw,64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24, color: "#f1f5f9", letterSpacing: "-1px" }}>
            Board Prep That Actually <br /><span style={{ color: GOLD }}>Understands Medicine</span>
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", marginBottom: 16, fontWeight: 600 }}>USMLE Step 1, 2 & 3 · ABIM Internal Medicine · ABIM Endocrinology Subspecialty</p>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 48, lineHeight: 1.6 }}>
            Built by <strong style={{ color: "#f1f5f9" }}>Dr. Anteneh Zenebe, MD, FACE</strong> — Associate Program Director, Endocrinology, Diabetes & Metabolism Fellowship,<br />Howard University Hospital
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
            <button onClick={() => { setAuthMode("signup"); setShowAuth(true); }} style={{ background: "linear-gradient(135deg," + NAVY + ",#1a4a9a)", border: "2px solid #3b82f6", color: "#fff", padding: "16px 40px", borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,40,104,0.5)" }}>Start 14-Day Free Trial →</button>
            <button onClick={() => { setAuthMode("login"); setShowAuth(true); }} style={{ background: "transparent", border: "1px solid " + BDR, color: "#e2e8f0", padding: "16px 40px", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Sign In</button>
          </div>
          <p style={{ fontSize: 12, color: "#475569", marginBottom: 64 }}>Credit card required · No charge until Day 15 · Cancel anytime before trial ends</p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
            <div className="exam-pill"><span style={{ color: "#3b82f6", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>USMLE Step 1</span><span style={{ color: "#64748b", fontSize: 11 }}>M2 Students</span></div>
            <div className="exam-pill"><span style={{ color: "#8b5cf6", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>USMLE Step 2 CK</span><span style={{ color: "#64748b", fontSize: 11 }}>M3/M4</span></div>
            <div className="exam-pill"><span style={{ color: "#6366f1", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>USMLE Step 3</span><span style={{ color: "#64748b", fontSize: 11 }}>PGY-1/2</span></div>
            <div className="exam-pill"><span style={{ color: "#10b981", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>ABIM IM</span><span style={{ color: "#64748b", fontSize: 11 }}>Residents</span></div>
            <div className="exam-pill"><span style={{ color: GOLD, fontWeight: 800, fontSize: 14, marginBottom: 4 }}>ABIM Endo</span><span style={{ color: "#64748b", fontSize: 11 }}>Fellows</span></div>
          </div>
        </section>
        <DailyQuestionWidget />
        <section id="how" style={{ padding: "100px 5%", background: "linear-gradient(180deg, #0a0a0f 0%, #111827 100%)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <h2 style={{ fontSize: 42, fontWeight: 800, color: "#f1f5f9", marginBottom: 16 }}>Everything you need to pass</h2>
              <p style={{ color: "#94a3b8", fontSize: 18 }}>From USMLE Step 1 to subspecialty boards — one platform covers the full training continuum</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
              {[
                { icon: "🎯", title: "Premium QBank", desc: "Thousands of board-style clinical vignettes written to NBME and ABIM item-writing standards. Each question simulates real-world clinical decision-making." },
                { icon: "📚", title: "16+ Medical Society Guidelines", desc: "Stop hunting for answers. Every explanation cites specific, up-to-date guidelines from ADA, ATA, ACC/AHA, Endocrine Society, KDIGO, and 20+ other official specialty societies." },
                { icon: "🧪", title: "Integrated Labs & Med Calcs", desc: "Access comprehensive normal lab value references across 7 categories and 20+ critical medical calculators (Anion Gap, MELD, FENa, CHA2DS2-VASc) directly inside the testing interface." },
                { icon: "⏱", title: "Study & Exam Modes", desc: "Study mode provides instant feedback, attending-level explanations, and cognitive error analysis. Exam mode runs a live 90-second countdown timer to simulate real testing conditions." },
              ].map((feature, i) => (
                <div key={i} style={{ background: CARD, border: "1px solid " + BDR, borderRadius: 20, padding: "32px", transition: "transform 0.2s" }}>
                  <div style={{ fontSize: 32, marginBottom: 20 }}>{feature.icon}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>{feature.title}</h3>
                  <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7 }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" style={{ padding: "100px 5%", background: "#0f172a" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#f1f5f9", marginBottom: 40, textAlign: "center" }}>About the Founder</h2>
            <div style={{ background: CARD, border: "1px solid " + BDR, borderRadius: 24, padding: "48px", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 32, flexWrap: "wrap" }}>
                <img
                  src="/image/founder-Zenebe.jpg"
                  alt="Dr. Anteneh Zenebe, MD, FACE"
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    border: "3px solid " + GOLD,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 0 4px rgba(0,40,104,0.3)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <h3 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>Dr. Anteneh Zenebe, MD, FACE</h3>
                  <p style={{ color: GOLD, fontSize: 15, fontWeight: 700 }}>Associate Program Director · Endocrinology, Diabetes & Metabolism Fellowship · Howard University Hospital</p>
                </div>
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 16, lineHeight: 1.8 }}>
                <p style={{ marginBottom: 16 }}>Hi, I am Dr. Anteneh Zenebe. I am an academic endocrinologist, Assistant Clinical Professor of Medicine, and the Associate Program Director for the Endocrinology, Diabetes, and Metabolism Fellowship at Howard University College of Medicine. Board-certified in Internal Medicine and in Endocrinology, Diabetes & Metabolism, my career has been driven by a passion for training the next generation of endocrinologists and closing the real gap between textbook medicine and confident clinical decision-making.</p>
                <p style={{ marginBottom: 16 }}>I built MedBoard Pro because I saw a critical need for a board prep tool that understands medicine the way a fellowship program director thinks about it — anchored in current society guidelines, grounded in pathophysiology, and focused on the clinical reasoning that examiners and attendings actually want to see.</p>
                <p>My goal is simple: to create resources that move beyond test-taking tricks and give trainees the kind of preparation that translates directly into better patient care.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" style={{ padding: "100px 5%" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>Simple, Transparent Pricing</h2>
              <p style={{ color: "#64748b", fontSize: 16 }}>14-day free trial · No charge until Day 15 · Cancel anytime</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
              {PLANS.map((plan) => (
                <div key={plan.key} style={{ background: CARD, border: "1px solid " + (plan.badge === "MOST POPULAR" ? GOLD : BDR), borderRadius: 24, padding: "40px 32px", position: "relative" }}>
                  {plan.badge && <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#fff", fontSize: 12, fontWeight: 800, padding: "6px 16px", borderRadius: 20, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>{plan.badge}</div>}
                  <h3 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{plan.name}</h3>
                  <div style={{ color: GOLD, marginBottom: 24 }}>
                    <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-1px" }}>${plan.price}</span>
                    <span style={{ color: "#64748b", fontSize: 16, fontWeight: 600 }}>/{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: "none", marginBottom: 32 }}>
                    {plan.features.map((f) => <li key={f} style={{ color: "#94a3b8", fontSize: 15, padding: "6px 0", display: "flex", alignItems: "flex-start", gap: 12, lineHeight: 1.4 }}><span style={{ color: "#10b981", fontSize: 14, marginTop: 2 }}>✓</span>{f}</li>)}
                  </ul>
                  <button onClick={() => { setAuthMode("signup"); setShowAuth(true); }} style={{ width: "100%", padding: "14px", borderRadius: 12, background: plan.badge ? "linear-gradient(135deg," + NAVY + ",#1a4a9a)" : "transparent", border: "1px solid " + (plan.badge ? "#3b82f6" : BDR), color: plan.badge ? "#fff" : "#e2e8f0", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Start Free Trial</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer style={{ padding: "40px 5%", background: "#050508", borderTop: "1px solid " + BDR, color: "#64748b", fontSize: 13, lineHeight: 1.6, textAlign: "center", marginTop: "auto" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <p style={{ marginBottom: 20 }}><strong>Medical Disclaimer:</strong> MedBoard Pro is an educational platform for board exam preparation only. NOT a substitute for clinical judgment. MedBoard Pro and Dr. Anteneh Zenebe assume no liability for patient care decisions.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => setLegalModal("terms")} className="footer-link">Terms of Service</button>
            <button onClick={() => setLegalModal("privacy")} className="footer-link">Privacy Policy</button>
            <button onClick={() => setLegalModal("contact")} className="footer-link">Contact Support</button>
          </div>
          <p>© {new Date().getFullYear()} MedBoard Pro by Dr. Anteneh Zenebe. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
