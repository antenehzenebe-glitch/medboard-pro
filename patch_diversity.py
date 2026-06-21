#!/usr/bin/env python3
# patch_diversity.py — port the VIGNETTE DIVERSITY constraint to ALL FIVE level
# blocks in BOTH generators, and add parity Block #19 to the checker.
#
# Byte-anchored + idempotent-safe: asserts exactly ONE occurrence of every OLD
# anchor before replacing; aborts (no write) if any anchor count != 1, so a
# partial/garbled match changes nothing.
#
#   Run from the repo ROOT:   python3 patch_diversity.py
#   DO NOT COMMIT this script. Delete it after the commit.
import sys

GEN_PATH    = "netlify/functions/generate-mcq.js"   # backtick templates, REAL \n
BULK_PATH   = "scripts/bulk-generate.js"            # dquoted strings, ESCAPED \n
PARITY_PATH = "test/check-parity.js"

# ---------------------------------------------------------------------------
# The generalized, level-agnostic diversity bullet (byte-identical plain text in
# both files). Examples dropped so one wording serves all five levels; the new
# final clause curbs repeated opening sentences (the CK stroke-twin failure).
GEN_BULLET = (
    "- VIGNETTE DIVERSITY: do not default to the single most stereotyped teaching "
    "case for the topic. Vary patient age across plausible bands, sex, "
    "occupation/setting, and the precipitating event. Where a topic has one "
    "canonical vignette, choose a less-stereotyped but equally valid presentation "
    "in the majority of items. Do not reuse a near-identical opening sentence "
    "across items."
)

# The existing Step 1 bullet (example-laden) that GEN_BULLET replaces. Identical
# plain text in both files. Arrows as \u2192 to avoid any encoding ambiguity.
OLD_S1 = (
    "- VIGNETTE DIVERSITY: do not default to the single most stereotyped teaching "
    "case for the topic. Vary patient age across plausible bands, sex, "
    "occupation/setting, and the precipitating event. Where a topic has one "
    "canonical vignette (forearm crush \u2192 median/ulnar injury; organophosphate "
    "\u2192 cholinergic crisis; classic Hashimoto panel), choose a less-stereotyped "
    "but equally valid presentation in the majority of items."
)

# Parity Block #19 (no backslashes in this text; unicode marks as \u escapes).
BLOCK19 = (
"""// Block 19 — VIGNETTE DIVERSITY constraint must appear in all five level blocks
// of BOTH generators. levelRules uses a different encoding per file (backtick
// template in generate-mcq.js vs escaped-newline string in bulk-generate.js), so a
// byte-identical block compare is impossible; assert instead that the diversity
// directive and the opening-sentence clause each appear the same number of times
// (one per level = 5) in both files.
{
  const countOf = (src, needle) => src.split(needle).length - 1;
  const diversityChecks = [
    ["VIGNETTE DIVERSITY directive", "VIGNETTE DIVERSITY: do not default to the single most stereotyped teaching case"],
    ["opening-sentence clause",      "Do not reuse a near-identical opening sentence across items"],
  ];
  for (const [label, needle] of diversityChecks) {
    const b = countOf(BULK, needle);
    const g = countOf(GEN, needle);
    if (b !== g) {
      console.error(`\u2717 diversity (${label}): one-sided drift \u2014 bulk=${b}, gen=${g}`);
      failures++;
    } else if (b < 5) {
      console.error(`\u2717 diversity (${label}): expected >=5 (one per level), found ${b} in both`);
      failures++;
    } else {
      console.log(`\u2713 diversity (${label}) \u2014 ${b}x in both`);
    }
  }
}
""")

GEN_OPS = [
    (OLD_S1, GEN_BULLET,                                            "gen : Step 1 bullet -> generalized"),
    ("posterior decision.`",  "posterior decision.\n"  + GEN_BULLET + "`", "gen : Step 2 CK append"),
    ("clinically relevant.`", "clinically relevant.\n" + GEN_BULLET + "`", "gen : Step 3 append"),
    ("cirrhosis, frailty).`", "cirrhosis, frailty).\n" + GEN_BULLET + "`", "gen : ABIM IM append"),
    ("endocrine disease.`",   "endocrine disease.\n"   + GEN_BULLET + "`", "gen : ABIM Endo append"),
]

BULK_OPS = [
    (OLD_S1, GEN_BULLET,                                              "bulk: Step 1 bullet -> generalized"),
    ('posterior decision.";',  'posterior decision.\\n'  + GEN_BULLET + '";', "bulk: Step 2 CK append"),
    ('clinically relevant.";', 'clinically relevant.\\n' + GEN_BULLET + '";', "bulk: Step 3 append"),
    ('cirrhosis, frailty).";', 'cirrhosis, frailty).\\n' + GEN_BULLET + '";', "bulk: ABIM IM append"),
    ('endocrine disease.";',   'endocrine disease.\\n'   + GEN_BULLET + '";', "bulk: ABIM Endo append"),
]

PARITY_OPS = [
    ("// ALLOWED_LEAD_INS_BY_LEVEL / maxTokens ladder",
     "// ALLOWED_LEAD_INS_BY_LEVEL / maxTokens ladder / VIGNETTE DIVERSITY",
     "parity: header comment"),
    ("if (failures) { console.error(",
     BLOCK19 + "\nif (failures) { console.error(",
     "parity: insert Block 19"),
]


def apply_ops(path, ops):
    with open(path, "rb") as f:
        text = f.read().decode("utf-8")
    for old, new, label in ops:
        c = text.count(old)
        if c != 1:
            sys.stderr.write(
                "  ABORT [%s] expected exactly 1 occurrence of anchor, found %d "
                "(NO FILE WRITTEN)\n" % (label, c))
            sys.exit(1)
        text = text.replace(old, new, 1)
        sys.stdout.write("  ok   [%s]\n" % label)
    with open(path, "wb") as f:
        f.write(text.encode("utf-8"))


def main():
    print("== generate-mcq.js ==");  apply_ops(GEN_PATH,  GEN_OPS)
    print("== bulk-generate.js =="); apply_ops(BULK_PATH, BULK_OPS)
    print("== check-parity.js ==");  apply_ops(PARITY_PATH, PARITY_OPS)

    # built-in post-patch sanity: directive + clause must be 5x in each generator
    pref = "VIGNETTE DIVERSITY: do not default to the single most stereotyped teaching case"
    claus = "Do not reuse a near-identical opening sentence across items"
    g = open(GEN_PATH, encoding="utf-8").read()
    b = open(BULK_PATH, encoding="utf-8").read()
    print("\npost-patch counts (expect 5 / 5):")
    print("  gen : directive=%d clause=%d" % (g.count(pref), g.count(claus)))
    print("  bulk: directive=%d clause=%d" % (b.count(pref), b.count(claus)))
    ok = (g.count(pref) == 5 == b.count(pref)) and (g.count(claus) == 5 == b.count(claus))
    print("RESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
