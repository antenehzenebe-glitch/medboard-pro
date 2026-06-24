// ExamComplete.jsx — end-of-exam score summary screen.
import React from "react";
import { NAVY, GOLD, CARD, BDR } from "../constants.js";

export default function ExamComplete({ score, examSecs, onReview, onNew }) {
  var pct = score.t > 0 ? Math.round(score.c / score.t * 100) : 0;
  var passed = pct >= 70;
  var mins = Math.floor(examSecs / 60);
  var secs = examSecs % 60;
  return (
    <div className="fade" style={{ background: CARD, border: "2px solid " + (passed ? GOLD : BDR), borderRadius: 20, padding: "40px 32px", textAlign: "center", marginBottom: 24 }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{passed ? "🎓" : "📚"}</div>
      <h2 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Exam Complete</h2>
      <div style={{ fontSize: 68, fontWeight: 900, color: passed ? "#10b981" : "#f59e0b", lineHeight: 1, margin: "16px 0" }}>{pct}%</div>
      <p style={{ color: "#94a3b8", fontSize: 16, marginBottom: 4 }}>{score.c} correct out of {score.t} question{score.t !== 1 ? "s" : ""}</p>
      {examSecs > 0 && <p style={{ color: "#475569", fontSize: 13, marginBottom: 4 }}>Time: {mins}m {secs < 10 ? "0" : ""}{secs}s</p>}
      <p style={{ color: passed ? "#10b981" : "#f59e0b", fontWeight: 700, fontSize: 15, marginBottom: 28 }}>{passed ? "✓ Above 70% passing threshold" : "✗ Below 70% — review weak areas"}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onReview} style={{ background: "linear-gradient(135deg," + NAVY + ",#1a4a9a)", border: "1px solid " + GOLD, color: "#fff", padding: "12px 28px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Review Answers</button>
        <button onClick={onNew} style={{ background: "rgba(201,168,76,0.1)", border: "1px solid " + GOLD, color: GOLD, padding: "12px 28px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Next QBank Item</button>
      </div>
    </div>
  );
}
