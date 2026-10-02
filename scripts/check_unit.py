#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reusable structural / language checker for unit JSON files (pilot format unit-v1-pilot).
Usage: python3 check_unit.py unit-n5-12.json [--strict-warn]
Checks: valid JSON; required fields; id uniqueness + format; every question has existing grammar ids;
        reading is hiragana; tts/particles consistency (は/へ/を); listening flags; colloquial-Cantonese scan.
Exit code 0 = no errors."""
import json, re, sys, collections

HARD_CHARS = "嘅咗唔喺啲嘢冇俾佢哋咁嚟睇嗰啱乜𠵼咩嚿呢㗎喎囉噉揀掣撳仲"
HARD_WORDS = ["點解", "邊個", "而家", "邊度", "幾多", "點樣", "好似", "係"]
SOFT_WORDS = ["同埋", "返去", "返回", "不用", "幫手", "同"]   # review manually (e.g. 同 may be 同樣 = legit)
PART = {"は": "わ", "へ": "え", "を": "お"}

ID_PATTERNS = {
    "u": r"^u-n\d-\d{2}$", "l": r"^l-n\d-\d{2}-\d$", "g": r"^g-n\d-\d{2}-\d{2}$", "w": r"^w-n\d-\d{2}-\d{3}$",
    "q": r"^q-n\d-\d{2}-\d{3}$", "e": r"^e-n\d-\d{2}-\d{3}$", "s": r"^s-n\d-\d{2}-\d{3}$",
    "st": r"^st-n\d-\d{2}(-[rsl])?$", "sp": r"^sp-n\d-\d{2}-\d{2}$", "qz": r"^qz-n\d-\d{2}$",
    "tip": r"^tip-n\d-\d{2}(-\w+)?$", "tbl": r"^tbl-n\d-\d{2}-\d+$",
}
LOCAL_KEYS = {"options", "left", "right", "pieces", "nodes", "edges"}

errors, warns = [], []
def err(p, m): errors.append("%s: %s" % (p, m))
def warn(p, m): warns.append("%s: %s" % (p, m))

def walk(o, path="$", under_local=False):
    yield path, o, under_local
    if isinstance(o, dict):
        for k, v in o.items():
            yield from walk(v, "%s.%s" % (path, k), under_local or k in LOCAL_KEYS)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, "%s[%d]" % (path, i), under_local)

def prefix(i):
    m = re.match(r"^([a-z]+)-", i)
    return m.group(1) if m else None

def is_hira(s):
    return re.fullmatch(r"[ぁ-ゟー。、！？「」・…＿\s]*", s) is not None

def main(path, strict=False):
    try:
        raw = open(path, encoding="utf-8").read()
        data = json.loads(raw)
    except Exception as e:
        print("INVALID JSON:", e); return 2
    u = data
    for k in ["schemaVersion", "id", "level", "number", "title", "theme", "prerequisites", "lessons", "tips", "story", "quiz", "grammarIndex"]:
        if k not in u: err("$", "missing unit field " + k)
    # ids
    seen = collections.Counter()
    for p, o, loc in walk(u):
        if isinstance(o, dict) and "id" in o and not loc:
            i = o["id"]
            if not isinstance(i, str): err(p, "id not string"); continue
            pf = prefix(i)
            if pf not in ID_PATTERNS: err(p, "unknown id prefix " + i); continue
            if not re.match(ID_PATTERNS[pf], i): err(p, "bad id format " + i)
            seen[i] += 1
    for i, c in seen.items():
        if c > 1: err("ids", "duplicate id %s x%d" % (i, c))
    gset = set(u.get("grammarIndex", []))
    gdef = set()
    for l in u.get("lessons", []):
        for k in ["id", "number", "title", "prerequisites", "vocab", "grammar", "exercises", "listening"]:
            if k not in l: err(l.get("id", "lesson"), "missing lesson field " + k)
        pts = l.get("grammar", {}).get("points", [])
        if not (1 <= len(pts) <= 2): err(l.get("id"), "grammar points must be 1-2, got %d" % len(pts))
        for g in pts:
            gdef.add(g["id"])
            for k in ["id", "title", "blocks"]:
                if k not in g: err(g.get("id", "grammar"), "missing " + k)
        nv = len(l.get("vocab", []))
        if not (5 <= nv <= 6): warn(l.get("id"), "new vocab count %d (target 5-6)" % nv)
        for v in l.get("vocab", []):
            for k in ["id", "kana", "reading", "zh", "tts", "particles", "group"]:
                if k not in v: err(v.get("id", "vocab"), "missing vocab field " + k)
            if v.get("group") not in ("一類", "二類", "三類"): err(v.get("id"), "bad group")
    if gset != gdef: err("grammarIndex", "grammarIndex %s != defined %s" % (sorted(gset), sorted(gdef)))
    # questions
    qids = []
    def is_q(o): return isinstance(o, dict) and "prompt" in o and "type" in o and "answer" in o
    nlisten = nreal = 0
    for p, o, loc in walk(u):
        if is_q(o):
            qids.append(o.get("id"))
            if not o.get("id", "").startswith("q-"): err(p, "question id format")
            g = o.get("grammar")
            if not g or not isinstance(g, list): err(o.get("id"), "grammar tag missing")
            else:
                for x in g:
                    if x not in gdef: err(o.get("id"), "grammar tag %s not defined" % x)
            for k in ["rule", "explanation", "answerDisplay", "source"]:
                if not o.get(k): err(o.get("id"), "missing " + k)
            if o.get("source", "").startswith("reused") and not o.get("sourceRef"): err(o["id"], "reused without sourceRef")
            if o["type"] == "listen-choice":
                nlisten += 1
                if "needsRealDeviceCheck" not in o: err(o["id"], "listening needs needsRealDeviceCheck")
                if o.get("needsRealDeviceCheck"):
                    nreal += 1
                    if not o.get("listeningNote"): err(o["id"], "needsRealDeviceCheck without listeningNote")
                if not (o.get("audio") or {}).get("ttsText"): err(o["id"], "listening without audio.ttsText")
                if not o.get("reveal"): err(o["id"], "listening without reveal")
            if o["type"] in ("choice", "listen-choice", "fill"):
                ids = [x["id"] for x in o.get("options", [])]
                if o["answer"] not in ids: err(o["id"], "answer not in options")
                else:
                    ao = [x for x in o["options"] if x["id"] == o["answer"]][0]
                    if "ja" in ao and not o["answerDisplay"].startswith(ao["ja"].rstrip("。")):
                        err(o["id"], "answerDisplay %r does not match answer option %r" % (o["answerDisplay"], ao["ja"]))
                    if "text" in ao and o["type"] == "choice" and ao["text"] != o["answerDisplay"] and not (o["kind"] == "verb-group" and o["answerDisplay"].startswith(ao["text"][:2])):
                        err(o["id"], "answerDisplay %r != answer option text %r" % (o["answerDisplay"], ao["text"]))
                if len(ids) != len(set(ids)): err(o["id"], "dup option ids")
    dups = [i for i, c in collections.Counter(qids).items() if c > 1]
    if dups: err("questions", "duplicate question ids %s" % dups)
    # Japanese item checks (reading hiragana, tts/particles, zh)
    for p, o, loc in walk(u):
        if isinstance(o, dict) and "ja" in o and "reading" in o:
            if o.get("fragment"): continue
            r = o["reading"]
            if not is_hira(r): err(p, "reading not hiragana: %r" % r)
            if "zh" not in o and "blank" not in o: err(p, "Japanese item without zh: %r" % o["ja"])
            if "particles" not in o: err(p, "missing particles key: %r" % o["ja"])
            tts = o.get("tts")
            if tts is None:
                if not o.get("blank"): err(p, "missing tts")
                continue
            exp = list(r)
            for pt in o.get("particles", []):
                i = pt["index"]
                if r[i:i + 1] != pt["surface"]: err(p, "particle index mismatch in %r" % r)
                else: exp[i] = PART[pt["surface"]]
            if "".join(exp) != tts: err(p, "tts %r != expected %r (reading %r)" % (tts, "".join(exp), r))
            if "を" in tts: err(p, "tts still contains を: %r" % tts)
            if "を" in r and not any(pt["surface"] == "を" for pt in o.get("particles", [])): err(p, "を not declared as particle")
        if isinstance(o, dict) and "tts" in o and "reading" not in o and "ttsText" not in o and "ja" not in o:
            pass
    # colloquial scan over all strings and keys
    hits = []
    for p, o, loc in walk(u):
        strs = []
        if isinstance(o, str): strs.append(o)
        if isinstance(o, dict): strs += [k for k in o.keys()]
        for s in strs:
            for ch in s:
                if ch in HARD_CHARS: hits.append((p, ch, s[:30]))
            for w in HARD_WORDS:
                if w == "係":
                    for m in re.finditer("係", s):
                        if s[max(0, m.start() - 1):m.start()] != "關": hits.append((p, "係", s[:30]))
                elif w in s: hits.append((p, w, s[:30]))
            for w in SOFT_WORDS:
                for m in re.finditer(w, s):
                    nxt = s[m.end():m.end() + 1]
                    prev = s[max(0, m.start() - 1):m.start()]
                    if w == "同" and (nxt in "樣時步一" or prev in "不相"): continue
                    warn(p, "check word %r in %r" % (w, s[:40]))
    for h in hits: err("colloquial", "%s found %r in %r at %s" % (h[0], h[1], h[2], h[0]))
    stats = {"lessons": len(u["lessons"]), "grammarPoints": len(gdef),
             "vocab": sum(len(l["vocab"]) for l in u["lessons"]),
             "questions": len(set(qids)), "listeningQuestions": nlisten, "needsRealDeviceCheck": nreal,
             "colloquialHits": len(hits)}
    print("STATS", json.dumps(stats, ensure_ascii=False))
    for w in warns: print("WARN", w)
    for e in errors: print("ERROR", e)
    print("RESULT", "FAIL" if errors else "PASS", "(%d errors, %d warnings)" % (len(errors), len(warns)))
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "/workspace/jp-content/unit-n5-12.json"))
