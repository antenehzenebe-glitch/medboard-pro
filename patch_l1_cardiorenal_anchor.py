#!/usr/bin/env python3
"""
patch_l1_cardiorenal_anchor.py  — Layer 1 of the SGLT2i-deprioritization mis-key guardrail.

Adds an HFrEF / eGFR-20 / potassium-neutral cardiorenal anchor to the Type 2 diabetes
management L1 TOPIC_GUARDRAILS block, in BOTH generator files (parity-identical).
Byte-anchored on a unique existing line, single-occurrence-asserted, idempotent.

Run from the repo root:
    python3 patch_l1_cardiorenal_anchor.py
    node --check netlify/functions/generate-mcq.js
    node --check scripts/bulk-generate.js
    git diff            # eyeball, then single-purpose commit
"""
import io, sys

FILES = [
    "netlify/functions/generate-mcq.js",
    "scripts/bulk-generate.js",
]

# Byte-exact existing line (TOPIC_GUARDRAILS, Type 2 diabetes management L1).
ANCHOR = "- Cardiorenal-driven add-on: SGLT2i if HF/CKD, GLP-1 RA if ASCVD/obesity (regardless of A1c)."

# Idempotency sentinel — a distinctive phrase from the inserted text.
SENTINEL = "CLASS I for HFrEF (EMPEROR-Reduced"

# Inserted bullets (continuation of the same L1 backtick template literal; plain text only).
INSERT = (
    "\n- SGLT2i (empagliflozin, dapagliflozin) are CLASS I for HFrEF (EMPEROR-Reduced, DAPA-HF) "
    "and are initiated/continued down to eGFR 20; reduced GLYCEMIC efficacy below eGFR 45 does NOT "
    "remove the HF/cardiorenal indication. In a T2D + HFrEF stem an SGLT2i is preferred over a "
    "GLP-1 RA for the HF indication; GLP-1 RAs reduce ASCVD events but do NOT reduce HF hospitalization."
    "\n- SGLT2i are potassium-NEUTRAL to mildly K-LOWERING and do NOT cause/worsen hyperkalemia "
    "(an advantage over MRAs/finerenone). Do NOT key a GLP-1 RA over an SGLT2i in an HFrEF stem on the "
    "basis of a hyperkalemia or a sub-eGFR-45 glycemic argument."
    "\n- Finerenone, the SGLT2i GLYCEMIC indication, and GLP-1 renal indications are T2D-SPECIFIC "
    "(do NOT extrapolate to T1D)."
)


def patch(path):
    with io.open(path, "r", encoding="utf-8") as f:
        src = f.read()
    if SENTINEL in src:
        print(f"  SKIP (already patched): {path}")
        return True
    n = src.count(ANCHOR)
    if n != 1:
        print(f"  ABORT: anchor found {n}x (expected 1) in {path} — no change written.")
        return False
    new = src.replace(ANCHOR, ANCHOR + INSERT, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"  OK: L1 cardiorenal anchor inserted in {path}")
    return True


def main():
    ok = True
    for p in FILES:
        try:
            ok = patch(p) and ok
        except FileNotFoundError:
            print(f"  ABORT: file not found: {p} (run from repo root)")
            ok = False
    print("-" * 60)
    if not ok:
        print("FAILED — fix anchors before retry. Nothing partially corrupted (abort-before-write).")
        sys.exit(1)
    print("L1 done. node --check both files, diff, then commit (single-purpose).")


if __name__ == "__main__":
    main()
