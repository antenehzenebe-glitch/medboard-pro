#!/usr/bin/env python3
# MedBoard Pro - cardiorenal mis-key WARN -> HARD-REJECT promotion (BOTH generators).
# Fixes H1 (was a no-op: resolved key from p.correct_answer, unset at validation; now
# uses p.correct) and adds a weight/glycemia tie-break so a GLP-1 legitimately keyed
# for weight loss in an HFrEF patient is NOT hard-rejected. flagCardiorenalMiskey is
# replaced byte-identically in both files (parity).
# TWO-PHASE / all-or-nothing: validates BOTH files first; writes neither unless both
# pass (or are already applied). Idempotent. Deploy B2 FIRST (gen-mcq anchors on it).
import base64, sys, pathlib
D = lambda k: base64.b64decode(k).decode("utf-8")
FN_OLD=D("ZnVuY3Rpb24gZmxhZ0NhcmRpb3JlbmFsTWlza2V5KHApIHsKICBpZiAoIXApIHJldHVybiBbXTsKICBjb25zdCB3YXJucyA9IFtdOwogIGNvbnN0IHN0ZW0gPSBTdHJpbmcocC5zdGVtIHx8ICIiKTsKICBjb25zdCBleHBsID0gU3RyaW5nKHAuZXhwbGFuYXRpb24gfHwgIiIpOwogIGNvbnN0IGNob2ljZXNPYmogPSAocC5jaG9pY2VzICYmIHR5cGVvZiBwLmNob2ljZXMgPT09ICJvYmplY3QiICYmICFBcnJheS5pc0FycmF5KHAuY2hvaWNlcykpID8gcC5jaG9pY2VzIDogbnVsbDsKICBjb25zdCBjaG9pY2VzQXJyID0gQXJyYXkuaXNBcnJheShwLmNob2ljZXMpID8gcC5jaG9pY2VzIDogKGNob2ljZXNPYmogPyBPYmplY3QudmFsdWVzKHAuY2hvaWNlcykgOiBbXSk7CiAgY29uc3QgY2hvaWNlc1RleHQgPSBjaG9pY2VzQXJyLmpvaW4oIiB8ICIpOwogIGxldCBrZXlUZXh0ID0gIiI7CiAgaWYgKHAuY29ycmVjdF9hbnN3ZXIgIT0gbnVsbCkgewogICAgaWYgKGNob2ljZXNPYmogJiYgY2hvaWNlc09ialtwLmNvcnJlY3RfYW5zd2VyXSAhPSBudWxsKSB7CiAgICAgIGtleVRleHQgPSBTdHJpbmcoY2hvaWNlc09ialtwLmNvcnJlY3RfYW5zd2VyXSk7CiAgICB9IGVsc2UgaWYgKC9eW0EtRV0kL2kudGVzdChTdHJpbmcocC5jb3JyZWN0X2Fuc3dlcikpKSB7CiAgICAgIGNvbnN0IF9pID0gU3RyaW5nKHAuY29ycmVjdF9hbnN3ZXIpLnRvVXBwZXJDYXNlKCkuY2hhckNvZGVBdCgwKSAtIDY1OwogICAgICBpZiAoY2hvaWNlc0FycltfaV0gIT0gbnVsbCkga2V5VGV4dCA9IFN0cmluZyhjaG9pY2VzQXJyW19pXSk7CiAgICB9IGVsc2UgewogICAgICBrZXlUZXh0ID0gU3RyaW5nKHAuY29ycmVjdF9hbnN3ZXIpOwogICAgfQogIH0KICBjb25zdCBoZnJlZiA9IC9IRnJFRnxyZWR1Y2VkIGVqZWN0aW9uIGZyYWN0aW9ufEVGIFxiWzEtM11cZFxifE5ZSEEgY2xhc3MgKElJSXxJVikvaS50ZXN0KHN0ZW0pOwogIGNvbnN0IFNHTFQySSA9IC9lbXBhZ2xpZmxvemlufGRhcGFnbGlmbG96aW58Y2FuYWdsaWZsb3ppbnxlcnR1Z2xpZmxvemlufFNHTFQyL2k7CiAgY29uc3QgR0xQMSA9IC9zZW1hZ2x1dGlkZXxkdWxhZ2x1dGlkZXxsaXJhZ2x1dGlkZXxleGVuYXRpZGV8dGlyemVwYXRpZGV8R0xQLTEvaTsKICBpZiAoaGZyZWYgJiYgU0dMVDJJLnRlc3QoY2hvaWNlc1RleHQpICYmIEdMUDEudGVzdChrZXlUZXh0KSkgewogICAgd2FybnMucHVzaCgicG9zc2libGUgU0dMVDJpLWRlcHJpb3JpdGl6YXRpb24gbWlzLWtleSBpbiBIRnJFRiAtLSBTR0xUMmkgaXMgQ2xhc3MgSSAoRU1QRVJPUi1SZWR1Y2VkL0RBUEEtSEYpOyB2ZXJpZnkga2V5LiIpOwogIH0KICBpZiAoL1NHTFQyW14uXXswLDYwfWh5cGVya2FsZW18aHlwZXJrYWxlbVteLl17MCw2MH1TR0xUMi9pLnRlc3QoZXhwbCkpIHsKICAgIHdhcm5zLnB1c2goIlNHTFQyaSBhcmUgSy1uZXV0cmFsL2xvd2VyaW5nIC0tIHZlcmlmeSBhbnkgaHlwZXJrYWxlbWlhIGNsYWltIGF0dHJpYnV0aW5nIHJpc2sgdG8gYW4gU0dMVDJpLiIpOwogIH0KICByZXR1cm4gd2FybnM7Cn0="); FN_NEW=D("ZnVuY3Rpb24gZmxhZ0NhcmRpb3JlbmFsTWlza2V5KHApIHsKICBpZiAoIXApIHJldHVybiBbXTsKICBjb25zdCB3YXJucyA9IFtdOwogIGNvbnN0IHN0ZW0gPSBTdHJpbmcocC5zdGVtIHx8ICIiKTsKICBjb25zdCBleHBsID0gU3RyaW5nKHAuZXhwbGFuYXRpb24gfHwgIiIpOwogIGNvbnN0IGNob2ljZXNPYmogPSAocC5jaG9pY2VzICYmIHR5cGVvZiBwLmNob2ljZXMgPT09ICJvYmplY3QiICYmICFBcnJheS5pc0FycmF5KHAuY2hvaWNlcykpID8gcC5jaG9pY2VzIDogbnVsbDsKICBjb25zdCBjaG9pY2VzQXJyID0gQXJyYXkuaXNBcnJheShwLmNob2ljZXMpID8gcC5jaG9pY2VzIDogKGNob2ljZXNPYmogPyBPYmplY3QudmFsdWVzKHAuY2hvaWNlcykgOiBbXSk7CiAgY29uc3QgY2hvaWNlc1RleHQgPSBjaG9pY2VzQXJyLmpvaW4oIiB8ICIpOwogIC8vIFJlc29sdmUgdGhlIGtleWVkIGFuc3dlcidzIFRFWFQuIEF0IHZhbGlkYXRpb24gdGltZSB0aGUgcGFyc2VkIG9iamVjdCBjYXJyaWVzCiAgLy8gcC5jb3JyZWN0ICh0aGUgbGV0dGVyIEEtRSk7IHAuY29ycmVjdF9hbnN3ZXIgaXMgb25seSBhdHRhY2hlZCBsYXRlciB3aGVuIHRoZSBEQgogIC8vIHJlY29yZCBpcyBhc3NlbWJsZWQuIFByZWZlciB3aGljaGV2ZXIgaXMgcHJlc2VudCBzbyB0aGUgSDEga2V5IGNoZWNrIGlzIGxpdmUuCiAgY29uc3Qga2V5UmVmID0gKHAuY29ycmVjdF9hbnN3ZXIgIT0gbnVsbCkgPyBwLmNvcnJlY3RfYW5zd2VyIDogKHAuY29ycmVjdCAhPSBudWxsID8gcC5jb3JyZWN0IDogbnVsbCk7CiAgbGV0IGtleVRleHQgPSAiIjsKICBpZiAoa2V5UmVmICE9IG51bGwpIHsKICAgIGlmIChjaG9pY2VzT2JqICYmIGNob2ljZXNPYmpba2V5UmVmXSAhPSBudWxsKSB7CiAgICAgIGtleVRleHQgPSBTdHJpbmcoY2hvaWNlc09ialtrZXlSZWZdKTsKICAgIH0gZWxzZSBpZiAoL15bQS1FXSQvaS50ZXN0KFN0cmluZyhrZXlSZWYpKSkgewogICAgICBjb25zdCBfaSA9IFN0cmluZyhrZXlSZWYpLnRvVXBwZXJDYXNlKCkuY2hhckNvZGVBdCgwKSAtIDY1OwogICAgICBpZiAoY2hvaWNlc0FycltfaV0gIT0gbnVsbCkga2V5VGV4dCA9IFN0cmluZyhjaG9pY2VzQXJyW19pXSk7CiAgICB9IGVsc2UgewogICAgICBrZXlUZXh0ID0gU3RyaW5nKGtleVJlZik7CiAgICB9CiAgfQogIGNvbnN0IGhmcmVmID0gL0hGckVGfHJlZHVjZWQgZWplY3Rpb24gZnJhY3Rpb258RUYgXGJbMS0zXVxkXGJ8TllIQSBjbGFzcyAoSUlJfElWKS9pLnRlc3Qoc3RlbSk7CiAgY29uc3QgU0dMVDJJID0gL2VtcGFnbGlmbG96aW58ZGFwYWdsaWZsb3ppbnxjYW5hZ2xpZmxvemlufGVydHVnbGlmbG96aW58U0dMVDIvaTsKICBjb25zdCBHTFAxID0gL3NlbWFnbHV0aWRlfGR1bGFnbHV0aWRlfGxpcmFnbHV0aWRlfGV4ZW5hdGlkZXx0aXJ6ZXBhdGlkZXxHTFAtMS9pOwogIC8vIFRpZS1icmVhazogYSBHTFAtMSBSQSBjYW4gYmUgdGhlIGxlZ2l0aW1hdGUga2V5IGluIGFuIEhGckVGIHBhdGllbnQgd2hlbiB0aGUKICAvLyBxdWVzdGlvbiBpcyBleHBsaWNpdGx5IGFib3V0IGdseWNlbWljIGVmZmljYWN5IG9yIHdlaWdodCBsb3NzIChub3QgSEYgdGhlcmFweSksCiAgLy8gc28gSDEgaXMgc3VwcHJlc3NlZCBmb3IgdGhvc2UgbGVhZC1pbnMgdG8gYXZvaWQgZmFsc2UgaGFyZC1yZWplY3RzLgogIGNvbnN0IHdlaWdodEdseWNlbWljRm9jdXMgPSAvXGIod2VpZ2h0IGxvc3N8d2VpZ2h0IHJlZHVjdGlvbnxsb3NlIHdlaWdodHxtb3N0IHdlaWdodHxncmVhdGVzdCB3ZWlnaHR8Z2x5Y2VtaWMgY29udHJvbHxnbHVjb3NlLWxvd2VyaW5nfGdsdWNvc2UgbG93ZXJpbmd8aGVtb2dsb2JpbiBhMWN8aGJhMWN8YTFjIHJlZHVjdGlvbnxncmVhdGVzdCBhMWN8bG93ZXIoPzppbmcpPyAoPzp0aGUgKT9hMWMpXGIvaS50ZXN0KHN0ZW0pOwogIGlmIChoZnJlZiAmJiBTR0xUMkkudGVzdChjaG9pY2VzVGV4dCkgJiYgR0xQMS50ZXN0KGtleVRleHQpICYmICF3ZWlnaHRHbHljZW1pY0ZvY3VzKSB7CiAgICB3YXJucy5wdXNoKCJwb3NzaWJsZSBTR0xUMmktZGVwcmlvcml0aXphdGlvbiBtaXMta2V5IGluIEhGckVGIC0tIFNHTFQyaSBpcyBDbGFzcyBJIChFTVBFUk9SLVJlZHVjZWQvREFQQS1IRik7IHZlcmlmeSBrZXkuIik7CiAgfQogIGlmICgvU0dMVDJbXi5dezAsNjB9aHlwZXJrYWxlbXxoeXBlcmthbGVtW14uXXswLDYwfVNHTFQyL2kudGVzdChleHBsKSkgewogICAgd2FybnMucHVzaCgiU0dMVDJpIGFyZSBLLW5ldXRyYWwvbG93ZXJpbmcgLS0gdmVyaWZ5IGFueSBoeXBlcmthbGVtaWEgY2xhaW0gYXR0cmlidXRpbmcgcmlzayB0byBhbiBTR0xUMmkuIik7CiAgfQogIHJldHVybiB3YXJuczsKfQ==")
BBO=D("ICAvLyBTR0xUMmktZGVwcmlvcml0aXphdGlvbiBjYXJkaW9yZW5hbCBtaXMta2V5ICh3YXJuLW1vZGUpIC0tIG5vbi1ibG9ja2luZwogIHsgY29uc3QgX2NybWsgPSBmbGFnQ2FyZGlvcmVuYWxNaXNrZXkocCk7IGlmIChfY3Jtay5sZW5ndGgpIHsgZHJvcFRhbGx5Ll93YXJuQ2FyZGlvcmVuYWwrKzsgZm9yIChjb25zdCBfdyBvZiBfY3JtaykgY29uc29sZS53YXJuKCJbd2Fybl0gY2FyZGlvcmVuYWwgbWlzLWtleToiLCBfdyk7IH0gfQ=="); BBN=D("ICAvLyBTR0xUMmktZGVwcmlvcml0aXphdGlvbiBjYXJkaW9yZW5hbCBtaXMta2V5IChIQVJELVJFSkVDVCDigJQgcHJvbW90ZWQgZnJvbSB3YXJuOyBIMSBrZXktcmVzb2x1dGlvbiBmaXhlZCArIHdlaWdodC9nbHljZW1pYSB0aWUtYnJlYWspCiAgeyBjb25zdCBfY3JtayA9IGZsYWdDYXJkaW9yZW5hbE1pc2tleShwKTsgaWYgKF9jcm1rLmxlbmd0aCkgeyBjb25zb2xlLndhcm4oJ1tSRUpFQ1RdIGNhcmRpb3JlbmFsIG1pcy1rZXkgOjogJyArIF9jcm1rLmpvaW4oJzsgJykgKyAnIDo6ICInICsgU3RyaW5nKHAuc3RlbXx8JycpLnNsaWNlKDAsODApICsgJyInKTsgcmV0dXJuIHJlY29yZERyb3AoJ19jYXJkaW9yZW5hbFJlamVjdGVkJyk7IH0gfQ=="); GT=D("ICAgICAgY29uc3QgdG9waWNPayAgICAgICA9ICgoKSA9PiB7IGNvbnN0IF90bSA9IGZsYWdUb3BpY01pc21hdGNoKHApOyBpZiAoX3RtLmhhcmRSZWplY3QpIGNvbnNvbGUud2FybignW1JFSkVDVF0gJyArIF90bS5yZWFzb24gKyAnIDo6ICInICsgU3RyaW5nKHAuc3RlbXx8JycpLnNsaWNlKDAsODApICsgJyInKTsgcmV0dXJuICFfdG0uaGFyZFJlamVjdDsgfSkoKTsgLy8gQjIgaGFyZCBnYXRlIChwYXJpdHkp"); GC=D("CiAgICAgIGNvbnN0IGNhcmRpb3JlbmFsT2sgPSAoKCkgPT4geyBjb25zdCBfY3JtayA9IGZsYWdDYXJkaW9yZW5hbE1pc2tleShwKTsgaWYgKF9jcm1rLmxlbmd0aCkgY29uc29sZS53YXJuKCdbUkVKRUNUXSBjYXJkaW9yZW5hbCBtaXMta2V5OiAnICsgX2NybWsuam9pbignOyAnKSArICcgOjogIicgKyBTdHJpbmcocC5zdGVtfHwnJykuc2xpY2UoMCw4MCkgKyAnIicpOyByZXR1cm4gX2NybWsubGVuZ3RoID09PSAwOyB9KSgpOyAvLyBjYXJkaW9yZW5hbCBoYXJkIGdhdGUgKHBhcml0eSwgcHJvbW90ZWQgZnJvbSB3YXJuKQ=="); GWO=D("ICAgIHsgY29uc3QgX2NybWsgPSBmbGFnQ2FyZGlvcmVuYWxNaXNrZXkocCk7IGlmIChfY3Jtay5sZW5ndGgpIHsgZm9yIChjb25zdCBfdyBvZiBfY3JtaykgY29uc29sZS53YXJuKCJbd2Fybl0gY2FyZGlvcmVuYWwgbWlzLWtleToiLCBfdyk7IH0gfQ==")
BULK="scripts/bulk-generate.js"; GM="netlify/functions/generate-mcq.js"
GM_PRIM_O="             && citationOk && phantomOk && topicOk;"
GM_PRIM_N="             && citationOk && phantomOk && topicOk && cardiorenalOk;"
GM_FB_O="               && !flagTopicMismatch(p).hardReject; // B2 hard gate (parity)"
GM_FB_N="               && !flagTopicMismatch(p).hardReject && flagCardiorenalMiskey(p).length === 0; // B2 + cardiorenal hard gates (parity)"
GM_WARN_N="    // cardiorenal mis-key now hard-reject gated upstream in isValid (PART 2 warn retired)"

def die(m): sys.exit("ABORT: " + m + "  (no files written)")
def need1(src, anchor, label, path):
    c = src.count(anchor)
    if c != 1: die("[%s] anchor %r matched %d times (expected 1)" % (path, label, c))

plan = {}  # path -> ("write", newsrc) | ("skip", reason)

# ---- BULK (no B2 dependency) ----
pb = pathlib.Path(BULK)
if not pb.exists(): die("%s not found (run from repo root)" % BULK)
sb = pb.read_text(encoding="utf-8")
if "_cardiorenalRejected" in sb:
    plan[BULK] = ("skip", "already promoted (sentinel _cardiorenalRejected)")
else:
    need1(sb, FN_OLD, "flagCardiorenalMiskey()", BULK)
    need1(sb, "_warnCardiorenal: 0,", "dropTally _warnCardiorenal", BULK)
    need1(sb, BBO, "cardiorenal warn block", BULK)
    nb = sb.replace(FN_OLD, FN_NEW, 1)
    nb = nb.replace("_warnCardiorenal: 0,", "_warnCardiorenal: 0, _cardiorenalRejected: 0,", 1)
    nb = nb.replace(BBO, BBN, 1)
    plan[BULK] = ("write", nb)

# ---- GEN-MCQ (requires B2) ----
pg = pathlib.Path(GM)
if not pg.exists(): die("%s not found (run from repo root)" % GM)
sg = pg.read_text(encoding="utf-8")
if "cardiorenalOk" in sg:
    plan[GM] = ("skip", "already promoted (sentinel cardiorenalOk)")
else:
    if "topicOk" not in sg: die("[%s] B2 not detected (topicOk missing). Deploy B2 first." % GM)
    need1(sg, FN_OLD, "flagCardiorenalMiskey()", GM)
    need1(sg, GT, "topicOk line", GM)
    need1(sg, GM_PRIM_O, "primary isValid chain", GM)
    need1(sg, GM_FB_O, "fallback isValid chain", GM)
    need1(sg, GWO, "PART 2 cardiorenal warn", GM)
    ng = sg.replace(FN_OLD, FN_NEW, 1).replace(GT, GT + GC, 1)
    ng = ng.replace(GM_PRIM_O, GM_PRIM_N, 1).replace(GM_FB_O, GM_FB_N, 1).replace(GWO, GM_WARN_N, 1)
    plan[GM] = ("write", ng)

# ---- Phase 2: write only after BOTH validated ----
for path, (action, payload) in plan.items():
    if action == "skip":
        print("SKIP %s — %s" % (path, payload))
    else:
        pathlib.Path(path).write_text(payload, encoding="utf-8")
        print("OK   %s — cardiorenal hard-reject applied (function fixed + parity preserved)" % path)
print("Done. flagCardiorenalMiskey byte-identical across both files (parity).")
