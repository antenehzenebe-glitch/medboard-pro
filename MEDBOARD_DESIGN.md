# MEDBOARD_DESIGN.md — MedBoard Pro Design System

> Source of truth for visual identity and component design.
> Read this before making any UI change to `public/index.html`.
> Last updated: May 19, 2026

---

## 1. Identity

**MedBoard Pro** is a fellowship-program-director-built medical board prep platform. The visual identity must reflect:

- **Clinical rigor** — this is high-stakes preparation for the ABIM, ABIM Endocrinology subspecialty, and USMLE Step 1/2 CK/3. The UI should never feel gamified, playful, or "consumer health app."
- **Academic credibility** — navy + gold evokes academic tradition (Howard University, classical institutional branding) without being literal university-branded.
- **Quiet seriousness on a dark canvas** — dark theme is intentional: it reduces eye fatigue during multi-hour study sessions and signals "professional tool," not "marketing site."

What the platform competes on: Endocrinology depth, clinical rigor, founder credibility. What it does NOT compete on: breadth, gamification, social features.

**Tone of voice in UI copy:** senior attending walking a junior colleague through a case. Rigorous but never condescending. Active voice. Clinical terminology when accurate; plain language when clarity matters more.

---

## 2. Color tokens

### Brand primitives

```
NAVY        #002868    // Primary brand color; sparingly used; signals frame
GOLD        #C9A84C    // Primary accent; selected state, key CTAs, brand marks
```

### Surface tokens (dark theme)

```
BG          #0a0a0f    // Page background — near-black with subtle navy bias
CARD        rgba(255, 255, 255, 0.04)    // Card surface; ultra-low-opacity white
BDR         #1e293b    // Default border (slate-800)
BDR_HOVER   #334155    // Hover border (slate-700)
```

### Text colors

```
TEXT_PRIMARY     #f1f5f9    // Primary text (slate-50)
TEXT_SECONDARY   #cbd5e1    // Body text (slate-300)
TEXT_MUTED       #94a3b8    // Muted/meta (slate-400)
TEXT_DISABLED    #64748b    // Disabled / footnote (slate-500)
```

### Semantic state colors

```
CORRECT     #10b981    // Green — correct answer, success, validated
INCORRECT   #ef4444    // Red — incorrect answer selected, validation error
WARNING     #f59e0b    // Amber — pending review, caution
INFO        #3b82f6    // Blue — informational, neutral notification
```

### Tier-specific (subscription pricing)

```
TIER_STUDENT      #3B82F6    // Blue
TIER_RESIDENT     #8B5CF6    // Purple (the "Most Popular" tier)
TIER_INSTITUTION  #10B981    // Green
```

### Color rules

- **NAVY is a frame color.** Use it for the brand mark, top navigation hairlines, and any element that needs to feel "institutional." Never use NAVY for body text or large fills.
- **GOLD is for emphasis.** Selected state on choice buttons, the primary CTA on the landing page, the brand mark accent letter. Limit GOLD to no more than 2-3 elements per visible screen — overuse destroys its signaling power.
- **CORRECT/INCORRECT are non-negotiable.** Never use any other green or red for grading states. Users have built muscle memory: green = right, red = wrong.
- **Never use pure white (#FFFFFF).** Always use TEXT_PRIMARY (#f1f5f9) or a near-white slate. Pure white on dark is harsh and not what's deployed.
- **Never introduce a fifth brand color** without updating this document. Two brand colors + state colors is the whole palette.

---

## 3. Typography

### Font stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

System fonts only. No web fonts. Reasons: faster load, no FOUT/FOIT, native feel on every device, no external font dependency.

### Serif accent (used sparingly)

`Georgia, "Times New Roman", serif` — for the founder's name in the About section and any element that needs to feel "letterhead." Do not use serif for body copy.

### Size scale

| Use | Size | Weight | Notes |
|---|---|---|---|
| Display / hero headline | 48px | 800 | Landing page hero only |
| Page title (H1) | 32px | 800 | One per screen |
| Section header (H2) | 24px | 700 | Card headers, major dividers |
| Subsection (H3) | 20px | 700 | Inside cards |
| Subsection (H4) | 16px | 700 | Inline emphasis in long-form text |
| Body | 14-15px | 400 | Default UI text |
| Body strong | 14-15px | 600-700 | Emphasized inline text |
| Caption / meta | 12-13px | 400 | Timestamps, helper text |
| Brand letter mark | 16px | 900 | "M" in the navbar logo block |
| Choice button text | 15px | 400 (unselected) / 700 (selected) | Answer choices |
| Clinical citation | 13px | 600 | Trial names, guideline years |

### Line height

- Body and explanation text: `line-height: 1.6-1.8`
- Headers: `line-height: 1.2-1.3`
- Tight UI labels (buttons, badges): `line-height: 1`

### Letter spacing

Default — no custom letter-spacing on body text. Only use `letter-spacing: 0.05em` on all-caps badges and small section labels (e.g., "MOST POPULAR").

---

## 4. Layout & spacing

### Spacing scale (use multiples of 4px)

```
4    8    12    16    20    24    32    40    48    64
```

Do not invent intermediate values (no 18px, no 22px). Stick to the scale.

### Containers

- **Page max-width:** 1200px, centered with `margin: 0 auto`.
- **Reading-width max:** 720px for long-form clinical explanations.
- **Modal max-width:** 600px for legal/policy modals, 480px for confirmation dialogs.
- **Side padding:** 5% on the landing page (nav and hero), 24px on app pages.

### Z-index scale

```
0      Default flow
10     Floating buttons (e.g., scroll-to-top)
50     Sticky navigation
100    Modal backdrop
110    Modal content
200    Toast/notification
```

---

## 5. Components

### 5.1 Buttons

**Primary CTA (gold)** — used for the most important action on screen: "Start Free Trial," "Next Question," subscription tier CTAs.

```
background:  GOLD (#C9A84C)
color:       #000 (black on gold for contrast)
font-weight: 700
padding:     12px 24px
border-radius: 8px
border:      none
```

**Secondary CTA (navy outline)** — for important but non-primary actions.

```
background:  transparent
color:       NAVY (#002868)
border:      1px solid NAVY
font-weight: 700
padding:     10px 20px
border-radius: 8px
```

**Tertiary / inline button** — for footer links and de-emphasized actions.

```
background:  transparent
color:       GOLD
border:      none
font-weight: 600
text-decoration: none (underline on hover)
```

**Destructive button** — for delete, end session, sign out.

```
background:  transparent
color:       INCORRECT (#ef4444)
border:      1px solid currentColor at 0.5 opacity
```

### 5.2 Cards

```
background:    CARD (rgba(255, 255, 255, 0.04))
border:        1px solid BDR (#1e293b)
border-radius: 12px
padding:       20px (compact) / 24-32px (default) / 40px (feature card)
```

On hover (interactive cards only):

```
background:    rgba(255, 255, 255, 0.08)
border-color:  BDR_HOVER (#334155)
transform:     translateY(-2px)
transition:    0.2s ease
```

### 5.3 Question card (the most-viewed component)

The question card is the heart of the platform. Strict rules:

- **Stem text:** TEXT_SECONDARY (#cbd5e1), 15-16px, line-height 1.7-1.8, reading-width capped at 720px.
- **Lab values inside stem:** keep inline; do NOT separate into a table or info box. The cognitive load of finding the relevant value is part of the test.
- **The question prompt** (final sentence of stem ending with `?`): same styling as stem; do not bold it or visually separate it. NBME doesn't.
- **Spacing between stem and choices:** 24px.

### 5.4 Answer choices

Each choice is a full-width button. States, from lowest to highest priority:

| State | Border | Background | Text color | Weight |
|---|---|---|---|---|
| Default (idle) | BDR | rgba(255,255,255,0.02) | TEXT_PRIMARY | 400 |
| Hover | BDR_HOVER | rgba(255,255,255,0.04) | TEXT_PRIMARY | 400 |
| Selected (pre-submit) | GOLD | rgba(201,168,76,0.08) | TEXT_PRIMARY | 700 |
| Correct (post-submit) | CORRECT | rgba(16,185,129,0.10) | TEXT_PRIMARY | 700 |
| User's incorrect (post-submit) | INCORRECT | rgba(239,68,68,0.10) | TEXT_PRIMARY | 700 |
| Unselected (post-submit) | BDR | rgba(255,255,255,0.02) | TEXT_MUTED | 400 |

**Letter label** (A, B, C, D, E): bold, 16px, padded 4px right of left edge of button. Same color as button text.

**Layout:** vertical stack, 12px gap between choices, padding 16px 20px per choice, border-radius 8px.

### 5.5 Explanation block

The explanation appears below the question after submission. It uses three required emoji-marked sections (enforced by `validateChoiceCompleteness` in `generate-mcq.js`):

```
🩺 Why this is the correct answer:
[Clinical reasoning. Cite the most recent guideline.]

🚫 Why the other choices fail:
Choice A: [reason]
Choice B: [reason]
... (only the 4 incorrect choices)

💎 Board Pearl:
[One high-yield fact to remember.]
```

**Visual treatment:**

- Background: CARD with subtle GOLD-tinted left border (4px solid `rgba(201,168,76,0.4)`)
- Padding: 24px
- Headers (the lines with emoji): TEXT_PRIMARY, 16px, 700, with 12px space below
- Body: TEXT_SECONDARY, 14-15px, line-height 1.7
- Citations (trial names, guideline years): TEXT_PRIMARY, 13px, 600 — never italicize, never put in parentheses unless mid-sentence

**Numeric anchor rule:** Every numeric value in the explanation MUST exactly match the stem. This is enforced by the consistency validator in code. Don't override it manually.

### 5.6 Modals

Used for: Terms of Service, Privacy Policy, Contact, confirmation dialogs.

```
backdrop:      rgba(0, 0, 0, 0.8) with backdrop-filter: blur(8px)
modal:         CARD background, BDR border, border-radius 16px
max-width:     600px (legal) / 480px (confirmation)
padding:       32px
close button:  top-right, color TEXT_MUTED, font-size 32px, no background
```

Modal header (H2 style) sits at top; body is scrollable if overflows. Modals do NOT animate slide-in — they fade in (200ms ease) to feel deliberate, not playful.

### 5.7 Navigation / top bar

```
height:           72px
background:       rgba(10, 10, 15, 0.97) with backdrop-filter: blur(12px)
border-bottom:    1px solid BDR
position:         sticky (z-index 50)
padding:          0 5%
```

Brand mark on left (M-block + wordmark), nav links + auth button on right. Hide nav links below 768px viewport width; auth button always visible.

### 5.8 Sidebar (topic picker)

Right-side overlay panel, 320px wide on desktop, full-width on mobile.

```
background:      BG (#0a0a0f)
border-left:     1px solid BDR
padding:         24px
```

Topic group labels: GOLD, 12px, 800. Topic buttons: 12px font, 8px 12px padding, BDR border, GOLD border + faint gold background when selected. See `public/index.html` line ~846 for the canonical implementation.

---

## 6. State patterns

State priority (later wins over earlier):

1. **Disabled** — opacity 0.4, cursor not-allowed
2. **Loading** — spinner overlay, content dimmed to 0.6 opacity
3. **Selected** — GOLD treatment
4. **Hover** — only applies when not in 1, 2, or 3
5. **Default**

Post-submission grading state (correct/incorrect) overrides everything except disabled.

---

## 7. Clinical content formatting

### Lab value presentation

- **In stems:** always include the unit (e.g., "TSH 9.8 mIU/L", "calcium 11.2 mg/dL"). Never bare numbers.
- **In explanations:** match the stem exactly (consistency validator enforces this).
- **Reference ranges:** include when relevant; format as parenthetical (e.g., "TSH 9.8 mIU/L (normal 0.4–4.0)").
- **Use mathematical en-dash for ranges:** `0.4–4.0`, never `0.4-4.0`.
- **Greater/less than:** prefer `>` and `<` over "greater than" / "less than".

### Citation presentation

- **Format:** "ATA 2025", "ADA 2026", "KDIGO 2024", "TRUST trial" — short, inline, no italics.
- **Never fabricate dates.** If unsure, write "current guidelines" without a year. The Topic Guardrails in `generate-mcq.js` enforce specific anchors per topic.
- **Trial names:** keep capitalization as published (e.g., "EMPA-KIDNEY", "PARADIGM-HF", "PREVENT calculator").

### Drug names

- **First mention in a stem:** generic name with brand in parentheses if widely recognized (e.g., "semaglutide (Wegovy)").
- **Subsequent mentions:** generic only.
- **In explanations:** generic name only; class name (e.g., "GLP-1 receptor agonist") is preferred for management discussions.

---

## 8. Voice & tone

### UI copy rules

- **Imperative for actions:** "Next Question", "Submit Answer", "Start Free Trial" — not "Click here to..."
- **Use the second person sparingly:** "Your answer" is correct; "Welcome back, friend!" is not.
- **No exclamation marks** in functional UI. Reserve for marketing copy on landing page only, and even there, sparingly.
- **No emojis** in UI labels or buttons. Emojis are reserved for the explanation block markers (🩺 🚫 💎) where they have a structural purpose.
- **Numbers > words for percentages and scores:** "10% correct" not "ten percent correct."

### Microcopy patterns

| Situation | Use | Don't use |
|---|---|---|
| Empty state | "No questions match this filter." | "Oops! Nothing here." |
| Error | "Unable to load. Please retry." | "Something went wrong 😢" |
| Confirmation | "End this session?" | "Are you sure you want to leave?" |
| Loading | "Loading..." | "Hold on a sec..." |
| Success | "Saved." | "Yay! All done!" |

### Founder voice (About section, marketing)

Serif (Georgia) when referencing the founder's name. First-person clinical authority: "I built this because the prep I wanted didn't exist." Never sales-pitch tone. Credentials are stated factually, not boastfully.

---

## 9. Accessibility

- **Contrast:** TEXT_PRIMARY on BG passes WCAG AAA (>7:1). TEXT_SECONDARY on BG passes AA (>4.5:1). Verify any new text color against the dark BG before shipping.
- **Focus rings:** GOLD outline at 2px offset 2px for keyboard navigation. Never `outline: none` without a replacement.
- **Hit targets:** minimum 44x44px on touch. Choice buttons exceed this comfortably.
- **Color is not the only signal:** correct/incorrect grading uses color (green/red) but also reinforces with a small icon and bolder text weight.

---

## 10. What NOT to do

- **Don't introduce a new color** without updating this document.
- **Don't use gradient text** anywhere. We use solid GOLD or TEXT_PRIMARY.
- **Don't add box-shadows for elevation.** The dark theme uses borders and subtle background brightness shifts instead.
- **Don't animate on every state change.** Hover transitions are 0.2s. Modal fades are 0.2s. Nothing else animates unless it's a loading spinner.
- **Don't introduce a build step.** The whole frontend is a single Babel-in-the-browser `public/index.html`. CSS-in-JS (inline `style={{}}`) is the pattern. Don't add Tailwind, Styled Components, or any other system.
- **Don't add tracking pixels or third-party analytics widgets** without explicit founder approval. This is a clinical-content platform; users expect privacy.
- **Don't make the question card "fun."** No confetti on correct answers. No streak counters. No animated badges. The reward is the next high-quality question, not a dopamine sprinkle.

---

## 11. How to use this document with Claude

When asking Claude to make a UI change:

1. **Reference this document explicitly** in your prompt: "Per MEDBOARD_DESIGN.md, the selected state for choice buttons uses GOLD border and 700 weight."
2. **Cite the section number** when relevant: "Update the explanation block per §5.5."
3. **If a change requires breaking a rule here**, say so explicitly: "I want to override §10's 'no animation' rule for the question transition; let's discuss."
4. **When making non-trivial changes**, update this document in the same commit. The design system and the code stay in sync.

---

*End of MEDBOARD_DESIGN.md*
