// App.jsx — root application component (post-auth shell + QBank engine).
// Ported verbatim from the original single-file app; only module wiring changed
// (imports for sb, constants, and child components; the ReactDOM render now lives in main.jsx).
import React from "react";
import { sb } from "./supabaseClient.js";
import { NAVY, GOLD, BG, CARD, BDR, PORTAL_URL, SECS, LEVELS, GROUPS, GUIDES, fmtTime } from "./constants.js";
import LandingPage from "./components/LandingPage.jsx";
import LegalModal from "./components/LegalModal.jsx";
import ExamComplete from "./components/ExamComplete.jsx";
import LabPanel from "./components/LabPanel.jsx";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function saveResponse(question, choice, isCorrect) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    let mcqId = (question._source === "db") ? question.id : null;
    if (!mcqId) {
      const mcqRes = await sb.from("mcqs").select("id").eq("stem", question.stem).limit(1);
      mcqId = mcqRes.data?.[0]?.id;
    }
    if (!mcqId) { console.error("saveResponse: could not resolve mcq_id", { source: question._source, id: question.id }); return; }
    await sb.from("user_responses").upsert({ user_id: session.user.id, mcq_id: mcqId, selected_choice: choice, is_correct: isCorrect }, { onConflict: "user_id,mcq_id", ignoreDuplicates: true });
  } catch (e) {
    console.error(e);
  }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = React.useState(null);
  const [tab, setTab] = React.useState("home");
  const [topic, setTopic] = React.useState("Random -- All Specialties");
  const [lvl, setLvl] = React.useState(LEVELS[3]);
  const [appState, setAppState] = React.useState("idle");
  const [question, setQuestion] = React.useState(null);
  const [preloadedQ, setPreloadedQ] = React.useState(null);
  const [sel, setSel] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);
  const [revealText, setRevealText] = React.useState("");
  const [history, setHistory] = React.useState({ t: 0, c: 0 });
  const [score, setScore] = React.useState({ t: 0, c: 0 });
  const [showAuth, setShowAuth] = React.useState(false);
  const [legalModal, setLegalModal] = React.useState(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [examMode, setExamMode] = React.useState(false);
  const [examSel, setExamSel] = React.useState("");
  const [examCorrect, setExamCorrect] = React.useState(false);
  const [err, setErr] = React.useState("");

  const [tLeft, setTLeft] = React.useState(null);
  const [examStartMs, setExamStartMs] = React.useState(0);
  const [examSecs, setExamSecs] = React.useState(0);
  const timerRef = React.useRef(null);
  const typeRef = React.useRef(null);

  const [authMode, setAuthMode] = React.useState("login");
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [nm, setNm] = React.useState("");
  const [authErr, setAuthErr] = React.useState("");

  React.useEffect(() => {
    sb.auth.getSession().then((res) => {
      if (res.data.session) { setUser(res.data.session.user); fetchHistory(res.data.session.user.id); }
    });
    const sub = sb.auth.onAuthStateChange((_, s) => {
      setUser(s?.user || null);
      if (s?.user) { setTab("home"); fetchHistory(s.user.id); }
    });
    return () => { sub.data?.subscription?.unsubscribe(); };
  }, []);

  React.useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      var map = { a: "A", b: "B", c: "C", d: "D", e: "E" };
      var letter = map[e.key.toLowerCase()];
      if (letter) {
        if (appState === "studying" && !revealed) setSel(letter);
        if (appState === "exam_running" && !examSel) setSel(letter);
      }
      if (e.key === "Enter") {
        if (appState === "studying" && !revealed && sel) submitStudy();
        if (appState === "exam_running" && !examSel && sel) submitExam();
      }
      if ((e.key === "n" || e.key === "N") && (appState === "studying" || appState === "idle" || appState === "exam_review")) handleLoadNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appState, revealed, sel, examSel, question]);

  function startTimer() {
    clearInterval(timerRef.current);
    setExamStartMs(Date.now()); setTLeft(SECS);
    timerRef.current = setInterval(() => {
      setTLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); endExam(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function endExam() {
    clearInterval(timerRef.current);
    setExamSecs(Math.floor((Date.now() - examStartMs) / 1000));
    setAppState("exam_done");
  }

  function endSession() {
    clearInterval(timerRef.current);
    clearInterval(typeRef.current);
    setAppState("idle");
    setScore({ t: 0, c: 0 });
    setSel("");
    setExamSel("");
    setRevealed(false);
    setRevealText("");
    setQuestion(null);
    setPreloadedQ(null);
  }

  async function fetchHistory(uid) {
    const { data } = await sb.from("user_responses").select("is_correct").eq("user_id", uid);
    if (data) setHistory({ t: data.length, c: data.filter((r) => r.is_correct).length });
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthErr("");
    try {
      if (authMode === "signup") {
        const { error } = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: nm } } });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        setShowAuth(false);
      }
    } catch (ex) { setAuthErr(ex.message); }
  }

  async function fetchOne(targetTopic, targetLvl) {
    // ── DB-first path (sub-second when bank has unseen approved match) ──
    try {
      const user = (await sb.auth.getUser()).data?.user;
      const { data: dbRows, error: rpcErr } = await sb.rpc("serve_next_mcq", {
        p_exam_level: targetLvl,
        p_topic: targetTopic || null,
        p_user_id: user?.id || null,
      });
      if (!rpcErr && dbRows && dbRows.length > 0) {
        const r = dbRows[0];
        return {
          id: r.id,
          stem: r.stem,
          choices: r.choices,
          correct: r.correct_answer,
          explanation: r.explanation,
          topic: r.blueprint_tag,
          exam_level: r.exam_level,
          _source: "db",
        };
      }
    } catch (dbEx) {
      // Fall through to AI generation on any DB-side failure
    }
    // ── Fallback: AI generation (~22s, only when DB has no match) ──
    const res = await fetch("/.netlify/functions/generate-mcq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: targetTopic, level: targetLvl }),
    });
    if (!res.ok) throw new Error("Connection failed");
    const items = await res.json();
    const item = items[0];
    item._source = "ai";
    return item;
  }

  function handleLoadNext() {
    clearInterval(timerRef.current);
    clearInterval(typeRef.current);
    setErr(""); setSel(""); setExamSel(""); setRevealed(false); setRevealText("");

    let q = preloadedQ;
    setPreloadedQ(null);

    if (!q) {
      setAppState("generating");
      fetchOne(topic, lvl.v).then((newQ) => {
        setQuestion(newQ);
        startQ(newQ);
      }).catch((ex) => {
        setErr("Unable to connect to QBank. Please retry."); setAppState("idle");
      });
    } else {
      setQuestion(q);
      startQ(q);
    }
  }

  function startQ(q) {
    if (examMode) {
      setAppState("exam_running");
      setRevealText(q.stem);
      startTimer();
    } else {
      setAppState("studying");
      let words = q.stem.split(" "), wi = 0;
      let currentText = "";
      typeRef.current = setInterval(() => {
        if (wi >= words.length) {
          clearInterval(typeRef.current);
          setRevealText(q.stem);
          return;
        }
        currentText += (wi === 0 ? "" : " ") + words[wi];
        setRevealText(currentText);
        wi++;
      }, 15);
    }
  }

  function submitStudy() {
    if (!sel || !question || revealed) return;
    const ok = sel === question.correct;
    clearInterval(typeRef.current);
    setRevealText(question.stem);
    setRevealed(true);
    setScore((s) => ({ t: s.t + 1, c: s.c + (ok ? 1 : 0) }));
    setHistory((h) => ({ t: h.t + 1, c: h.c + (ok ? 1 : 0) }));
    saveResponse(question, sel, ok).catch(() => {});
    fetchOne(topic, lvl.v).then((q) => setPreloadedQ(q)).catch(() => {});
  }

  function submitExam() {
    if (!sel || !question || examSel) return;
    const ok = sel === question.correct;
    setExamSel(sel); setExamCorrect(ok);
    setScore((s) => ({ t: s.t + 1, c: s.c + (ok ? 1 : 0) }));
    setHistory((h) => ({ t: h.t + 1, c: h.c + (ok ? 1 : 0) }));
    saveResponse(question, sel, ok).catch(() => {});
    setTimeout(endExam, 400);
  }

  function choiceColor(letter) {
    if (!question) return BDR;
    var isReview = appState === "exam_review" || revealed;
    if (isReview) {
      if (letter === question.correct) return "#10b981";
      if (letter === (examSel || sel) && letter !== question.correct) return "#ef4444";
      return BDR;
    }
    if (letter === sel) return GOLD;
    return BDR;
  }

  function choiceTextColor(letter) {
    if (!question) return "#cbd5e1";
    var isReview = appState === "exam_review" || revealed;
    if (isReview) {
      if (letter === question.correct) return "#10b981";
      if (letter === (examSel || sel) && letter !== question.correct) return "#ef4444";
      return "#94a3b8";
    }
    return "#cbd5e1";
  }

  // ── Derive display name from the actual logged-in user ──────────────────────
  // NEVER fall back to a hardcoded name — use email prefix or generic "Doctor"
  function getDisplayName() {
    if (user.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user.email) return user.email.split("@")[0];
    return "Doctor";
  }
  function getFirstName() {
    return getDisplayName().split(" ")[0];
  }

  if (!user) return (
    <>
      <LandingPage
        showAuth={showAuth}
        setShowAuth={setShowAuth}
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        pw={pw}
        setPw={setPw}
        nm={nm}
        setNm={setNm}
        authErr={authErr}
        handleAuth={handleAuth}
        googleLogin={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://medboardpro.org" } })}
        setLegalModal={setLegalModal}
      />
      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}
      {showAuth && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={(e) => e.target === e.currentTarget && setShowAuth(false)}>
          <div style={{ background: "#0f172a", padding: 40, borderRadius: 20, border: "1px solid " + BDR, width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h3 style={{ color: "#f1f5f9", fontSize: 22 }}>{authMode === "signup" ? "Create Account" : "Welcome Back"}</h3>
              <button onClick={() => setShowAuth(false)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>
            <button onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://medboardpro.org" } })} style={{ width: "100%", padding: "12px", background: "#fff", color: "#000", borderRadius: 10, fontWeight: 800, cursor: "pointer", border: "none", marginBottom: 20 }}>Continue with Google</button>
            <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, marginBottom: 20 }}>OR EMAIL</div>
            <form onSubmit={handleAuth}>
              {authMode === "signup" && <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Full Name" required style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid " + BDR, background: "rgba(255,255,255,0.05)", color: "#fff", marginBottom: 12 }} />}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid " + BDR, background: "rgba(255,255,255,0.05)", color: "#fff", marginBottom: 12 }} />
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" required style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid " + BDR, background: "rgba(255,255,255,0.05)", color: "#fff", marginBottom: 12 }} />
              {authErr && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{authErr}</p>}
              <button type="submit" style={{ width: "100%", padding: 12, borderRadius: 8, background: NAVY, border: "1px solid " + GOLD, color: "#fff", fontWeight: 800, cursor: "pointer", marginTop: 10 }}>{authMode === "signup" ? "Sign Up" : "Sign In"}</button>
            </form>
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} style={{ background: "none", border: "none", color: GOLD, cursor: "pointer", fontSize: 13 }}>{authMode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "0 5%", height: 80, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid " + BDR, position: "sticky", top: 0, background: "rgba(10,10,15,0.95)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setTab("home")}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: NAVY, border: "1px solid " + GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: GOLD }}>M</div>
          <span style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 18, display: window.innerWidth > 600 ? "block" : "none" }}>MedBoardPro</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: "100%" }}>
          {[{ id: "home", i: "H", l: "Home" }, { id: "mcq", i: "Q", l: "MCQ Bank" }, { id: "guides", i: "G", l: "Guides" }, { id: "progress", i: "P", l: "Progress" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? "nav-btn active" : "nav-btn"} style={{ height: "100%", justifyContent: "center" }}>
              <span className="nav-icon">{t.i}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{t.l}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {appState === "exam_running" && tLeft !== null && (
            <span style={{ fontSize: 15, fontWeight: 800, color: tLeft < 30 ? "#ef4444" : tLeft < 60 ? "#f59e0b" : "#10b981", fontFamily: "monospace", background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 6, border: "1px solid " + (tLeft < 30 ? "#ef4444" : BDR) }}>
              {fmtTime(tLeft)}
            </span>
          )}
          <div style={{ textAlign: "right", display: window.innerWidth > 900 ? "block" : "none" }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>{getDisplayName()}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>{user.email}</div>
          </div>
          <button onClick={() => window.open(PORTAL_URL, "_blank")} className="gold-outline-btn">💳 Manage Plan</button>
          <button onClick={() => sb.auth.signOut().then(() => window.location.reload())} style={{ color: "#94a3b8", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ flex: 1, padding: "40px 5%", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {tab === "home" && (
          <div className="fade">
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Welcome back, {getFirstName()}! 👋</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Premium Medical QBank · Academic Dashboard</p>

            <div style={{ background: "rgba(201,168,76,0.05)", border: "1px solid " + GOLD, borderRadius: 16, padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 20 }}>
              <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                <div><p style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>ALL-TIME ITEMS</p><div style={{ fontSize: 22, fontWeight: 900 }}>{history.t}</div></div>
                <div><p style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>ACCURACY</p><div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{history.t > 0 ? Math.round(history.c / history.t * 100) + "%" : "—"}</div></div>
              </div>
              <button onClick={() => setTab("mcq")} style={{ background: GOLD, color: "#000", padding: "10px 20px", borderRadius: 8, fontWeight: 800, border: "none", cursor: "pointer" }}>Start Practice Session</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16, marginBottom: 40 }}>
              <div className="quick-card" onClick={() => setTab("mcq")}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>🎯</div>
                <h3 style={{ color: "#6366f1", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Premium QBank</h3>
                <p style={{ color: "#64748b", fontSize: 13 }}>Case-based board review</p>
              </div>
              <div className="quick-card" onClick={() => setTab("guides")}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>📚</div>
                <h3 style={{ color: "#10b981", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Guidelines</h3>
                <p style={{ color: "#64748b", fontSize: 13 }}>ATA, ADA, Endocrine Society</p>
              </div>
              <div className="quick-card" onClick={() => setTab("progress")}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>📊</div>
                <h3 style={{ color: GOLD, fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Performance</h3>
                <p style={{ color: "#64748b", fontSize: 13 }}>Weakness and accuracy tracking</p>
              </div>
            </div>
          </div>
        )}

        {tab === "mcq" && (
          <div className="fade">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, minHeight: 40 }}>
              <div style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 700, alignItems: "center" }}>
                {score.t > 0 && <>
                  <span style={{ color: "#94a3b8" }}>Answered: <span style={{ color: "#f1f5f9" }}>{score.t}</span></span>
                  <span style={{ color: score.c / score.t >= 0.7 ? "#10b981" : "#f59e0b" }}>{Math.round(score.c / score.t * 100)}% correct</span>
                </>}
                {appState === "exam_running" && <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 800, border: "1px solid #f59e0b", padding: "3px 10px", borderRadius: 6 }}>EXAM MODE</span>}
              </div>
              {(appState === "studying" || appState === "exam_running" || appState === "exam_done" || appState === "exam_review" || appState === "generating") && (
                <button onClick={endSession} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", padding: "6px 16px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>End Session</button>
              )}
            </div>

            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid " + BDR, borderRadius: 8, color: "#f1f5f9", fontWeight: 700, marginBottom: 20, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>⚙ {lvl.l} — <span style={{ color: "#f1f5f9" }}>{topic}</span></span>
              <span style={{ color: "#f1f5f9" }}>{sidebarOpen ? "▲ Close Options" : "▼ Options"}</span>
            </button>

            {sidebarOpen && (
              <div className="fade" style={{ background: "rgba(0,0,0,0.3)", padding: 24, borderRadius: 12, marginBottom: 24, border: "1px solid " + BDR }}>
                <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>Exam Level</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>{LEVELS.map((l) => <button key={l.v} onClick={() => setLvl(l)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + (lvl.v === l.v ? GOLD : BDR), background: lvl.v === l.v ? GOLD : "transparent", color: lvl.v === l.v ? "#000" : "#fff", cursor: "pointer", fontWeight: 700 }}>{l.l}</button>)}</div>

                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  <button onClick={() => setExamMode(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid " + (!examMode ? GOLD : BDR), background: !examMode ? "rgba(201,168,76,0.1)" : "transparent", color: !examMode ? GOLD : "#94a3b8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>📚 Study Mode</button>
                  <button onClick={() => setExamMode(true)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid " + (examMode ? GOLD : BDR), background: examMode ? "rgba(201,168,76,0.1)" : "transparent", color: examMode ? GOLD : "#94a3b8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>⏱ Exam Mode</button>
                </div>

                <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>Topic Selection</p>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>{Object.entries(GROUPS).map(([g, ts]) => <div key={g}><p style={{ fontSize: 12, color: GOLD, marginTop: 12, marginBottom: 8, fontWeight: 800 }}>{g}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{ts.map((t) => <button key={t} onClick={() => { setTopic(t); setSidebarOpen(false); }} style={{ fontSize: 12, padding: "8px 12px", background: topic === t ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)", border: "1px solid " + (topic === t ? GOLD : BDR), color: topic === t ? GOLD : "#fff", cursor: "pointer", borderRadius: 6, fontWeight: topic === t ? 700 : 400 }}>{t}</button>)}</div></div>)}</div>

                <LabPanel />
              </div>
            )}

            {err && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "14px 18px", marginBottom: 16, color: "#fca5a5", fontSize: 14 }}>{err}</div>}

            {appState === "idle" && <button onClick={handleLoadNext} style={{ width: "100%", padding: 20, background: NAVY, border: "1px solid " + GOLD, color: "#fff", fontWeight: 900, fontSize: 18, borderRadius: 12, cursor: "pointer" }}>{examMode ? "Start Exam Mode ⏱" : "Load Next QBank Item ▶"}</button>}

            {appState === "generating" && <div style={{ textAlign: "center", padding: 40 }}><div style={{ width: 40, height: 40, border: "4px solid " + GOLD, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div><p style={{ color: "#94a3b8", fontWeight: 600 }}>Loading QBank Item...</p></div>}

            {appState === "exam_done" && question && <ExamComplete score={score} examSecs={examSecs} onReview={() => { setAppState("exam_review"); setRevealed(true); }} onNew={handleLoadNext} />}

            {question && appState !== "exam_done" && (
              <div className="fade" style={{ background: CARD, padding: 32, borderRadius: 16, border: "1px solid " + (revealed || appState === "exam_review" ? GOLD : BDR) }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
                  <span style={{ background: "transparent", border: "1px solid " + GOLD, color: GOLD, borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 800 }}>Question {score.t + (revealed ? 0 : 1)}</span>
                  <span style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{question.topic || topic}</span>
                </div>

                <p style={{ fontSize: 17, lineHeight: 1.8, marginBottom: 25, color: "#f1f5f9" }}>{revealText || question.stem}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {Object.entries(question.choices).map(([letter, text]) => {
                    var isAnswered = revealed || appState === "exam_review" || (appState === "exam_running" && !!examSel);
                    var borderColor = choiceColor(letter); var textColor = choiceTextColor(letter);
                    return (
                      <button key={letter} onClick={() => { if (appState === "studying" && !revealed) setSel(letter); if (appState === "exam_running" && !examSel) setSel(letter); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", padding: "16px 20px", borderRadius: 8, cursor: isAnswered ? "default" : "pointer", border: "1px solid " + borderColor, background: isAnswered && borderColor !== BDR ? borderColor + "18" : "rgba(255,255,255,0.02)", color: textColor, fontWeight: sel === letter || examSel === letter ? 700 : 400, fontSize: 15 }}>
                        <div>
                          <strong style={{ color: sel === letter || examSel === letter || (isAnswered && letter === question.correct) ? textColor : "#64748b", marginRight: 10 }}>{letter}.</strong> {text}
                        </div>
                        {(revealed || appState === "exam_review") && letter === question.correct && <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981", whiteSpace: "nowrap", marginLeft: 16 }}>Correct answer</span>}
                        {(revealed || appState === "exam_review") && (sel === letter || examSel === letter) && letter !== question.correct && <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap", marginLeft: 16 }}>Your answer</span>}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 25 }}>
                  {appState === "studying" && !revealed && <button onClick={submitStudy} disabled={!sel} style={{ background: sel ? "linear-gradient(135deg," + NAVY + ",#1a4a9a)" : "#1e293b", border: "1px solid " + (sel ? GOLD : BDR), color: sel ? "#fff" : "#475569", padding: "14px 32px", borderRadius: 10, cursor: sel ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 15 }}>Submit Answer</button>}
                  {appState === "exam_running" && !examSel && <button onClick={submitExam} disabled={!sel} style={{ background: sel ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "#1e293b", border: "1px solid " + (sel ? "#8b5cf6" : BDR), color: sel ? "#fff" : "#475569", padding: "14px 32px", borderRadius: 10, cursor: sel ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 15 }}>Submit & Continue ⏱</button>}
                  {(revealed || appState === "exam_review") && <button onClick={handleLoadNext} style={{ background: "rgba(201,168,76,0.1)", border: "1px solid " + GOLD, color: GOLD, padding: "14px 28px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 15 }}>Next QBank Item (N)</button>}
                </div>

                {(revealed || appState === "exam_review") && (
                  <div className="fade" style={{ marginTop: 25, padding: 24, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid " + BDR }}>
                    <p style={{ color: GOLD, fontWeight: 800, marginBottom: 12, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>Attending Explanation</p>
                    <p style={{ lineHeight: 1.7, fontSize: 15, color: "#e2e8f0" }}>{question.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "guides" && (
          <div className="fade" style={{ paddingTop: 20 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>Clinical Guidelines</h2>
            <p style={{ color: "#94a3b8", fontSize: 16, marginBottom: 32 }}>Direct links to official specialty society guidelines</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
              {GUIDES.map((g) => <a key={g.id} href={g.u} target="_blank" rel="noopener noreferrer" style={{ background: CARD, border: "1px solid " + BDR, borderRadius: 12, padding: "16px 20px", textDecoration: "none", display: "flex", alignItems: "center", gap: 16, transition: "border-color 0.2s" }}><div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(0,40,104,0.3)", border: "1px solid #1e40af", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{g.i}</div><div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>{g.t}</p><p style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{g.s}</p></div></a>)}
            </div>
          </div>
        )}

        {tab === "progress" && (
          <div className="fade" style={{ paddingTop: 20 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>Performance Analytics</h2>
            <p style={{ color: "#94a3b8", fontSize: 16, marginBottom: 32 }}>Historical analytics tracked via Supabase</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20 }}>
              <div style={{ background: CARD, padding: 25, borderRadius: 16, textAlign: "center", border: "1px solid " + BDR }}><div style={{ fontSize: 42, fontWeight: 900, color: "#3b82f6" }}>{history.t}</div><p style={{ color: "#94a3b8", marginTop: 8, fontWeight: 600 }}>Items Answered</p></div>
              <div style={{ background: CARD, padding: 25, borderRadius: 16, textAlign: "center", border: "1px solid " + BDR }}><div style={{ fontSize: 42, fontWeight: 900, color: "#10b981" }}>{history.c}</div><p style={{ color: "#94a3b8", marginTop: 8, fontWeight: 600 }}>Correct Answers</p></div>
              <div style={{ background: CARD, padding: 25, borderRadius: 16, textAlign: "center", border: "1px solid " + BDR }}><div style={{ fontSize: 42, fontWeight: 900, color: GOLD }}>{history.t > 0 ? Math.round(history.c / history.t * 100) + "%" : "—"}</div><p style={{ color: "#94a3b8", marginTop: 8, fontWeight: 600 }}>Mastery Score</p></div>
            </div>
          </div>
        )}
      </div>

      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}

      <footer style={{ padding: "40px 5%", background: "#050508", borderTop: "1px solid " + BDR, color: "#64748b", fontSize: 13, lineHeight: 1.6, textAlign: "center", marginTop: "auto" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <p style={{ marginBottom: 20 }}><strong>Medical Disclaimer:</strong> MedBoard Pro is an educational platform designed exclusively to assist medical professionals in preparing for board examinations. All content is provided for educational and informational purposes only. MedBoard Pro is <strong>NOT</strong> a substitute for professional medical judgment, diagnosis, or treatment. Users must rely on their own clinical training and consult official, current society guidelines. MedBoard Pro, Dr. Anteneh Zenebe, and affiliated authors assume no responsibility or liability for patient care decisions or clinical errors.</p>
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
