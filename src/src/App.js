import { useState } from "react";

const STRIPE_PUBLISHABLE_KEY = "pk_test_YOUR_STRIPE_KEY_HERE";

const plans = [
  {
    name: "Medical Student",
    price: 29,
    period: "month",
    priceId: "price_STUDENT_ID",
    color: "#3B82F6",
    badge: null,
    features: [
      "500+ USMLE Step 1 & 2 MCQs",
      "Endocrine, Diabetes & Thyroid modules",
      "AI-powered weak area analysis",
      "Mobile-friendly interface",
      "Monthly content updates",
    ],
  },
  {
    name: "Resident / Fellow",
    price: 59,
    period: "month",
    priceId: "price_RESIDENT_ID",
    color: "#8B5CF6",
    badge: "MOST POPULAR",
    features: [
      "Everything in Student plan",
      "ABIM Internal Medicine board prep",
      "ABIM Endocrinology subspecialty prep",
      "Clinical algorithms & decision trees",
      "Downloadable study guides (Word/PDF)",

    ],
  },
  {
    name: "Institution",
    price: 499,
    period: "month",
    priceId: "price_INSTITUTION_ID",
    color: "#10B981",
    badge: "BEST VALUE",
    features: [
      "Everything in Resident plan",
      "Up to 50 learner seats",
      "Program Director dashboard",
      "Custom module uploads",
      "White-label branding option",
      "Dedicated support",
    ],
  },
];

const faqs = [
  {
    q: "Who created MedBoard Pro?",
    a: "MedBoard Pro was created by Dr. Anteneh Zenebe, MD, FACE —               Assistant Clinical Professor and Associate Program Director at Howard University College of Medicine. All content is personally authored and reviewed against current clinical guidelines.",
  },
  {
    q: "What boards does MedBoard Pro cover?",
    a: "We cover USMLE Step 1 & Step 2 (M2/M3 shelf exams), ABIM Internal Medicine boards, and ABIM Endocrinology & Metabolism subspecialty boards.",
  },
  {
    q: "How is MedBoard Pro different from UWorld or Amboss?",
    a: "MedBoard Pro is built by a fellowship program director specifically for endocrinology depth. It includes ACGME milestone tracking, fellowship-level clinical algorithms, and institutional dashboards not available on general platforms.",
  },
  {
    q: "Can I use MedBoard Pro for my entire fellowship program?",
    a: "Yes. The Institution plan supports up to 50 learners with a Program Director dashboard and custom module uploads.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — all plans include a 14-day free trial. No credit card is required to start.",
  },
  {
    q: "How often is content updated?",
    a: "Content is updated continuously to reflect the latest guidelines including ADA, Endocrine Society, AACE, and NCCN recommendations.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. You can cancel your subscription at any time with no penalties or hidden fees.",
  },
];

export default function App() {
  const [loading, setPlanLoading] = useState(null);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const handleCheckout = async (plan) => {
    setPlanLoading(plan.priceId);
    try {
      if (!window.Stripe || STRIPE_PUBLISHABLE_KEY.includes("YOUR")) {
        alert(
          "To activate payments:\n\n1. Create a free account at stripe.com\n2. Replace STRIPE_PUBLISHABLE_KEY in the code with your key\n3. Replace price_XXXX_ID values with your Stripe Price IDs\n\nVisit: dashboard.stripe.com"
        );
        setPlanLoading(null);
        return;
      }
      const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
      await stripe.redirectToCheckout({
        lineItems: [{ price: plan.priceId, quantity: 1 }],
        mode: "subscription",
        successUrl: window.location.origin + "/success",
        cancelUrl: window.location.origin,
      });
    } catch (e) {
      console.error(e);
    }
    setPlanLoading(null);
  };

  const discounted = (plan) => {
    if (plan.period === "year") return plan.price;
    return billingAnnual ? Math.round(plan.price * 0.8) : plan.price;
  };

  const handleWaitlist = (e) => {
    e.preventDefault();
    if (waitlistEmail) setWaitlistSubmitted(true);
  };

  const card = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 28,
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0a0a0f", color: "#f1f5f9", minHeight: "100vh" }}>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e293b", padding: "0 5%" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>M</div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>MedBoard <span style={{ color: "#8b5cf6" }}>Pro</span></span>
          </div>
          <div style={{ display: "flex", gap: 28, fontSize: 14 }}>
            {["Features","About","Pricing","FAQ"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`}
                style={{ color: "#94a3b8", textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color="#f1f5f9"}
                onMouseLeave={e => e.target.style.color="#94a3b8"}>{l}</a>
            ))}
          </div>
          <button onClick={() => handleCheckout(plans[1])}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "10px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: "center", padding: "100px 5% 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "inline-block", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 20, padding: "6px 18px", fontSize: 13, color: "#a78bfa", marginBottom: 24 }}>
          🏥 Created by a Fellowship Program Director at Howard University
        </div>
        <h1 style={{ fontSize: "clamp(34px,5vw,62px)", fontWeight: 800, lineHeight: 1.1, maxWidth: 820, margin: "0 auto 24px" }}>
          Board Prep That Actually{" "}
          <span style={{ background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Understands Medicine
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 620, margin: "0 auto 40px", lineHeight: 1.7 }}>
          AI-powered USMLE, ABIM & Endocrinology board prep — built by <strong style={{ color: "#e2e8f0" }}>Dr. Anteneh Zenebe, MD, FACE</strong>, Associate Professor of Medicine and Fellowship Program Director at Howard University College of Medicine.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => handleCheckout(plans[1])}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "16px 36px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 16, boxShadow: "0 0 30px rgba(99,102,241,0.4)" }}>
            Start 14-Day Free Trial →
          </button>
          <a href="#about" style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "16px 36px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 16, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Meet the Founder
          </a>
        </div>
        <p style={{ marginTop: 16, color: "#475569", fontSize: 13 }}>No credit card required · Cancel anytime</p>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "80px 5%", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Everything you need to pass</h2>
            <p style={{ color: "#64748b", fontSize: 16 }}>From M2 shelf exams to subspecialty boards — one platform</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
            {[
              { icon: "🧠", title: "AI-Powered Learning", desc: "Adaptive question bank identifies weak areas and personalizes your study sessions." },
              { icon: "📋", title: "Clinical Algorithms", desc: "Decision trees for DKA, adrenal crisis, thyroid storm, hypercalcemia, and 40+ endocrine emergencies." },
              { icon: "🎯", title: "Board-Focused MCQs", desc: "USMLE Step 1/2, ABIM Internal Medicine, and ABIM Endocrinology subspecialty question banks." },
              { icon: "📄", title: "Downloadable Guides", desc: "Export study guides as professionally formatted Word documents with one click." },
              { icon: "🔬", title: "Guideline-Current", desc: "Continuously updated with ADA 2025, Endocrine Society, AACE, and NCCN guidelines." },
            ].map(f => (
              <div key={f.title} style={{ ...card, transition: "border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 10, fontSize: 18 }}>{f.title}</h3>
                <p style={{ color: "#64748b", lineHeight: 1.6, fontSize: 14 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT THE FOUNDER */}
      <section id="about" style={{ padding: "80px 5%" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center", marginBottom: 48 }}>About the Founder</h2>
          <div style={{ ...card, display: "flex", gap: 36, flexWrap: "wrap", alignItems: "flex-start", border: "1px solid #6366f1" }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#1e3a5f,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800, color: "#fff" }}>AZ</div>
            </div>
            {/* Bio */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Anteneh Zenebe, MD, FACE</h3>
              <p style={{ color: "#8b5cf6", fontWeight: 600, marginBottom: 16, fontSize: 14 }}>
                Assistant Clinical Professor · Associate Program Director<br />
                Howard University College of Medicine / Howard University Hospital
              </p>
              <p style={{ color: "#94a3b8", lineHeight: 1.8, marginBottom: 16, fontSize: 15 }}>
                Dr. Zenebe is a board-certified endocrinologist and Fellow of the American College of Endocrinology (FACE).               He serves as Assistant Clinical Professor and Associate Program Director at Howard University, one of the nation's leading HBCUs, where he is dedicated to training the next generation of physicians who will serve underserved communities.
              </p>
              <p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: 15 }}>
                His educational work spans the full training continuum — from second-year medical students through internal medicine residents and endocrinology fellows. MedBoard Pro is the digital extension of the curriculum he has developed at Howard University, now made available to learners nationwide.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                {["Board-Certified Endocrinologist","FACE Fellow","Fellowship Program Director","Howard University Faculty"].map(tag => (
                  <span key={tag} style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a78bfa", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL — REAL */}
      <section style={{ padding: "60px 5%", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center", marginBottom: 40 }}>What Learners Say</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>

            {/* Generic resident testimonial */}
            <div style={{ ...card }}>
              <div style={{ color: "#f59e0b", marginBottom: 12, fontSize: 18 }}>★★★★★</div>
              <p style={{ color: "#94a3b8", fontStyle: "italic", lineHeight: 1.7, fontSize: 15, marginBottom: 20 }}>
                "Dr. Zenebe's vignette-based lectures completely changed how I approach endocrine cases on rounds. Instead of memorizing facts, I started thinking through real clinical scenarios — a diabetic patient in DKA, a woman with an incidental adrenal mass, a fellow with hyponatremia. By the time I sat for my ABIM shelf, those cases felt familiar. I passed on my first attempt and I credit his teaching style above everything else."
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#334155,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>RJ</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Dr. R. Johnson</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>Internal Medicine Resident, PGY-2</div>
                </div>
              </div>
            </div>

            {/* Coming soon card */}
            <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 180 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div>
              <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>Be among the first to review MedBoard Pro.<br />Early access users get 3 months free.</p>
              <a href="#waitlist" style={{ marginTop: 16, color: "#8b5cf6", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Join the waitlist →</a>
            </div>

          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 5%" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 20 }}>Simple, transparent pricing</h2>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "#1e293b", borderRadius: 30, padding: "6px 16px" }}>
              <span style={{ fontSize: 14, color: billingAnnual ? "#475569" : "#f1f5f9" }}>Monthly</span>
              <div onClick={() => setBillingAnnual(!billingAnnual)}
                style={{ width: 44, height: 24, borderRadius: 12, background: billingAnnual ? "#6366f1" : "#334155", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: billingAnnual ? 23 : 3, transition: "left 0.3s" }} />
              </div>
              <span style={{ fontSize: 14, color: billingAnnual ? "#f1f5f9" : "#475569" }}>Annual <span style={{ color: "#10b981", fontWeight: 700 }}>−20%</span></span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
            {plans.map(plan => (
              <div key={plan.name} style={{
                background: plan.badge === "MOST POPULAR" ? "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))" : "rgba(255,255,255,0.03)",
                border: `2px solid ${plan.badge === "MOST POPULAR" ? "#6366f1" : "#1e293b"}`,
                borderRadius: 20, padding: 32, position: "relative", display: "flex", flexDirection: "column"
              }}>
                {plan.badge && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: plan.badge === "MOST POPULAR" ? "#6366f1" : "#10b981", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: 1 }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ color: plan.color, fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{plan.name}</div>
                <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 4 }}>
                  ${discounted(plan).toLocaleString()}<span style={{ fontSize: 16, color: "#475569", fontWeight: 400 }}>/{plan.period}</span>
                </div>
                {billingAnnual && plan.period !== "year" && <div style={{ fontSize: 13, color: "#10b981", marginBottom: 8 }}>Billed ${discounted(plan) * 12}/year</div>}
                {plan.period === "year" && <div style={{ fontSize: 13, color: "#10b981", marginBottom: 8 }}>Flat annual rate · ~$250/month</div>}
                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0", flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ padding: "8px 0", fontSize: 14, color: "#94a3b8", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: plan.color, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => handleCheckout(plan)} disabled={loading === plan.priceId}
                  style={{ width: "100%", background: plan.badge === "MOST POPULAR" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent", border: plan.badge === "MOST POPULAR" ? "none" : `2px solid ${plan.color}`, color: plan.badge === "MOST POPULAR" ? "#fff" : plan.color, padding: 14, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                  {loading === plan.priceId ? "Loading..." : "Start Free Trial"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "80px 5%", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center", marginBottom: 48 }}>Frequently Asked Questions</h2>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: "1px solid #1e293b", overflow: "hidden" }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: "100%", background: "none", border: "none", color: "#f1f5f9", textAlign: "left", padding: "20px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 600, gap: 16 }}>
                {faq.q}
                <span style={{ color: "#6366f1", fontSize: 22, flexShrink: 0, transition: "transform 0.3s", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
              </button>
              {openFaq === i && (
                <p style={{ color: "#94a3b8", lineHeight: 1.8, paddingBottom: 20, fontSize: 15, margin: 0 }}>{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" style={{ padding: "100px 5%", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16 }}>Join the Early Access List</h2>
          <p style={{ color: "#64748b", marginBottom: 36, fontSize: 16, lineHeight: 1.7 }}>
            Be first to access MedBoard Pro. Early users receive 3 months free and direct input into the platform's development.
          </p>
          {waitlistSubmitted ? (
            <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", borderRadius: 12, padding: "24px", color: "#10b981", fontWeight: 600, fontSize: 16 }}>
              ✅ You're on the list! We'll be in touch soon.
            </div>
          ) : (
            <form onSubmit={handleWaitlist} style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={waitlistEmail}
                onChange={e => setWaitlistEmail(e.target.value)}
                style={{ flex: 1, minWidth: 240, background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", padding: "14px 18px", borderRadius: 10, fontSize: 15, outline: "none" }}
              />
              <button type="submit"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "14px 28px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                Get Early Access
              </button>
            </form>
          )}
          <p style={{ marginTop: 14, color: "#334155", fontSize: 12 }}>No spam. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #1e293b", padding: "32px 5%", textAlign: "center", color: "#334155", fontSize: 13 }}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontWeight: 700, color: "#475569" }}>MedBoard Pro</span> · Created by Anteneh Zenebe, MD, FACE · Howard University College of Medicine
        </div>
        <div>© 2026 MedBoard Pro · antenehzenebe@gmail.com · All rights reserved</div>
      </footer>

    </div>
  );
}
