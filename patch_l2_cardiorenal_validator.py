#!/usr/bin/env python3
"""
patch_l2_cardiorenal_validator.py  — Layer 2 of the SGLT2i-deprioritization mis-key guardrail.

Adds the warn-mode validator `flagCardiorenalMiskey(p)` to BOTH generator files, wires a
non-blocking call in immediately after the existing `flagInterchangeableAgents(...)` call
(so the MCQ object is in scope), and (bulk only) adds a `_warnCardiorenal` counter to dropTally.

Design (mirrors flagInterchangeableAgents, warn-only, never drops):
  H1  HFrEF stem + an SGLT2i offered + the keyed answer is a GLP-1 RA  -> warn
  H2  explanation asserts SGLT2i cause/worsen hyperkalemia            -> warn
Each warn is printed via console.warn at the call site on BOTH paths, so warns are visible
in every run even though the dropTally summary line is bulk-only/optional.

Robustness:
  - Function insertion is byte-anchored on `function flagInterchangeableAgents(p) {`.
  - dropTally counter is byte-anchored on `_warnInterchange: 0 };` (bulk file only).
  - The call wiring SELF-LOCATES the single non-comment, non-definition line that calls
    flagInterchangeableAgents(<arg>), captures <arg>, and inserts a mirrored block after it.
    Aborts (writes nothing) if that call is not found exactly once on a single line.
  - Idempotent: re-running is a no-op.

Run from the repo root:
    python3 patch_l2_cardiorenal_validator.py
    node --check netlify/functions/generate-mcq.js
    node --check scripts/bulk-generate.js
    git diff            # eyeball the inserted call block + function, then single-purpose commit
"""
import io, re, sys

FILES = [
    "netlify/functions/generate-mcq.js",
    "scripts/bulk-generate.js",
]

ANCHOR_FN = "function flagInterchangeableAgents(p) {"
COUNTER_ANCHOR = "_warnInterchange: 0 };"
COUNTER_NEW = "_warnInterchange: 0, _warnCardiorenal: 0 };"

# The validator + its comment header. Inserted immediately before flagInterchangeableAgents.
FUNC_JS = r'''// -- Cardiorenal SGLT2i-deprioritization mis-key flag (warn-mode, both paths; added 2026-06-06) --
// Non-blocking. H1: HFrEF stem keying a GLP-1 RA while an SGLT2i is offered. H2: explanation
// asserting SGLT2i cause/worsen hyperkalemia (they are potassium-neutral to K-lowering).
// Mirrors flagInterchangeableAgents. Backtest 2026-06-06: recall 3/3 (ec94b12a, c6714248,
// 12f5f085); approved-bank false positives 0 (H1) + 1 benign (H2). Keep warn-mode for >=2
// batches; promote to hard-reject only after multi-batch precision/recall data.
function flagCardiorenalMiskey(p) {
  if (!p) return [];
  const warns = [];
  const stem = String(p.stem || "");
  const expl = String(p.explanation || "");
  const choicesObj = (p.choices && typeof p.choices === "object" && !Array.isArray(p.choices)) ? p.choices : null;
  const choicesArr = Array.isArray(p.choices) ? p.choices : (choicesObj ? Object.values(p.choices) : []);
  const choicesText = choicesArr.join(" | ");
  let keyText = "";
  if (p.correct_answer != null) {
    if (choicesObj && choicesObj[p.correct_answer] != null) {
      keyText = String(choicesObj[p.correct_answer]);
    } else if (/^[A-E]$/i.test(String(p.correct_answer))) {
      const _i = String(p.correct_answer).toUpperCase().charCodeAt(0) - 65;
      if (choicesArr[_i] != null) keyText = String(choicesArr[_i]);
    } else {
      keyText = String(p.correct_answer);
    }
  }
  const hfref = /HFrEF|reduced ejection fraction|EF \b[1-3]\d\b|NYHA class (III|IV)/i.test(stem);
  const SGLT2I = /empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|SGLT2/i;
  const GLP1 = /semaglutide|dulaglutide|liraglutide|exenatide|tirzepatide|GLP-1/i;
  if (hfref && SGLT2I.test(choicesText) && GLP1.test(keyText)) {
    warns.push("possible SGLT2i-deprioritization mis-key in HFrEF -- SGLT2i is Class I (EMPEROR-Reduced/DAPA-HF); verify key.");
  }
  if (/SGLT2[^.]{0,60}hyperkalem|hyperkalem[^.]{0,60}SGLT2/i.test(expl)) {
    warns.push("SGLT2i are K-neutral/lowering -- verify any hyperkalemia claim attributing risk to an SGLT2i.");
  }
  return warns;
}

'''

CALL_RE = re.compile(r'flagInterchangeableAgents\s*\(\s*([A-Za-z_$][\w$]*)\s*\)')


def wire_call(src, is_bulk):
    """Insert a mirrored flagCardiorenalMiskey call block after the existing
    flagInterchangeableAgents(<arg>) call line. Returns (new_src, msg) or (None, err)."""
    if "flagCardiorenalMiskey(" in src and "_crmk" in src:
        return src, "  SKIP call-wiring (already present)"
    lines = src.split("\n")
    hits = []
    for i, ln in enumerate(lines):
        if ln.lstrip().startswith("//"):
            continue
        if "function flagInterchangeableAgents" in ln:
            continue
        m = CALL_RE.search(ln)
        if m:
            hits.append((i, m.group(1)))
    if len(hits) != 1:
        return None, (f"  ABORT call-wiring: found {len(hits)} single-line "
                      f"flagInterchangeableAgents(<arg>) call(s) (expected 1). "
                      f"Paste the call line and I will byte-anchor it.")
    idx, arg = hits[0]
    indent = lines[idx][:len(lines[idx]) - len(lines[idx].lstrip())]
    tally = "dropTally._warnCardiorenal++; " if is_bulk else ""
    block = (
        f'{indent}// SGLT2i-deprioritization cardiorenal mis-key (warn-mode) -- non-blocking\n'
        f'{indent}{{ const _crmk = flagCardiorenalMiskey({arg}); '
        f'if (_crmk.length) {{ {tally}'
        f'for (const _w of _crmk) console.warn("[warn] cardiorenal mis-key:", _w); }} }}'
    )
    lines.insert(idx + 1, block)
    return "\n".join(lines), f"  OK: call wired after line {idx + 1} (arg='{arg}', bulk={is_bulk})"


def patch(path):
    is_bulk = path.endswith("bulk-generate.js")
    with io.open(path, "r", encoding="utf-8") as f:
        src = f.read()

    # 1) function definition
    if "function flagCardiorenalMiskey" in src:
        print(f"  SKIP fn (already present): {path}")
    else:
        n = src.count(ANCHOR_FN)
        if n != 1:
            print(f"  ABORT: fn anchor found {n}x (expected 1) in {path} — nothing written.")
            return False
        src = src.replace(ANCHOR_FN, FUNC_JS + ANCHOR_FN, 1)

    # 2) dropTally counter (bulk only)
    if is_bulk:
        if "_warnCardiorenal" in src:
            print(f"  SKIP counter (already present): {path}")
        else:
            n = src.count(COUNTER_ANCHOR)
            if n != 1:
                print(f"  ABORT: counter anchor found {n}x (expected 1) in {path} — nothing written.")
                return False
            src = src.replace(COUNTER_ANCHOR, COUNTER_NEW, 1)

    # 3) call wiring (self-located)
    src2, msg = wire_call(src, is_bulk)
    print(msg)
    if src2 is None:
        return False
    src = src2

    with io.open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"  WROTE: {path}")
    return True


def main():
    ok = True
    for p in FILES:
        print(f"== {p}")
        try:
            ok = patch(p) and ok
        except FileNotFoundError:
            print(f"  ABORT: file not found: {p} (run from repo root)")
            ok = False
    print("-" * 60)
    if not ok:
        print("FAILED — see ABORT lines above. Abort-before-write: no partial corruption.")
        sys.exit(1)
    print("L2 done. node --check both files, diff (verify the inserted call block), then commit.")
    print("Note: warns print live via console.warn on BOTH paths. The bulk dropTally summary")
    print("line is optional — if you want the aggregate count shown, add to the bulk summary:")
    print('    cardiorenal mis-key warns: ${dropTally._warnCardiorenal}')


if __name__ == "__main__":
    main()
