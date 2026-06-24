// DailyQuestionWidget.jsx — mounts the external /medboard-widget.js free-question widget.
// The widget script lives in public/ and is copied to the site root by Vite unchanged.
import React from "react";
import { GOLD } from "../constants.js";

export default function DailyQuestionWidget() {
  React.useEffect(function () {
    if (document.getElementById("mbp-widget-script")) return;
    var s = document.createElement("script");
    s.id = "mbp-widget-script";
    s.src = "/medboard-widget.js";
    s.setAttribute("data-checkout", "https://medboardpro.org/");
    s.setAttribute("data-endpoint", "");
    s.setAttribute("data-placement", "landing-hero");
    s.setAttribute("data-theme", "dark");
    document.body.appendChild(s);
  }, []);
  return (
    <div style={{ padding: "10px 5% 50px", maxWidth: 620, margin: "0 auto", width: "100%" }}>
      <p style={{ textAlign: "center", color: GOLD, fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>Try a free board question</p>
      <div id="medboard-widget"></div>
    </div>
  );
}
