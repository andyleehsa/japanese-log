#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds /workspace/jp-content/unit-n5-12.json (pilot unit N5-12). All Chinese = 書面語."""
import json, re, sys

OUT = "/workspace/jp-content/unit-n5-12.json"
PART_TTS = {"は": "わ", "へ": "え", "を": "お"}
PUNCT = "。、！？「」・…"

# ---------------------------------------------------------------- helpers
def jp(*toks, zh=None):
    """token spec: 'わたし' | 'は~' (particle) | '食べる/たべる' (surface/reading) | punctuation."""
    ja = rd = tt = ""
    parts = []
    for t in toks:
        if t in PUNCT or all(c in PUNCT for c in t):
            ja += t; rd += t; tt += t; continue
        if t.endswith("~"):
            s = t[:-1]
            parts.append({"surface": s, "index": len(rd), "ttsAs": PART_TTS[s], "role": "助詞" + ("（主題）" if s == "は" else "")})
            ja += s; rd += s; tt += PART_TTS[s]; continue
        if "/" in t:
            s, r = t.split("/")
        else:
            s = r = t
        ja += s; rd += r; tt += r
    d = {"ja": ja, "reading": rd, "tts": tt, "particles": parts}
    if zh is not None:
        d["zh"] = zh
    return d

GROUP_DETAIL = {"一類": "一類（五段）", "二類": "二類（一段）", "三類": "三類（不規則）"}
# id: (kana, kanji, zh, group, note, lesson)
WORDS = {
 1: ("たべる", "食べる", "吃", "二類", None, 1),
 2: ("のむ", "飲む", "喝；飲用", "一類", None, 1),
 3: ("いく", "行く", "去", "一類", None, 1),
 4: ("みる", "見る", "看", "二類", None, 1),
 5: ("する", None, "做；進行", "三類", None, 1),
 6: ("くる", "来る", "來", "三類", None, 2),
 7: ("おきる", "起きる", "起床", "二類", None, 2),
 8: ("ねる", "寝る", "睡覺", "二類", None, 2),
 9: ("おしえる", "教える", "教；告知", "二類", None, 2),
 10: ("でかける", "出かける", "外出", "二類", None, 2),
 11: ("かう", "買う", "買", "一類", None, 3),
 12: ("まつ", "待つ", "等待", "一類", None, 3),
 13: ("かえる", "帰る", "回去；回家", "一類", "一類（看似二類）", 3),
 14: ("はいる", "入る", "進入", "一類", "一類（看似二類）", 3),
 15: ("はなす", "話す", "說話；交談", "一類", None, 3),
}
def wid(n): return "w-n5-12-%03d" % n
def surf(n): return WORDS[n][1] or WORDS[n][0]

def V(n):
    """verb as an item (ja/reading/zh/tts)"""
    k, kj, zh, g, note, l = WORDS[n]
    return {"ja": kj or k, "reading": k, "zh": zh, "tts": k, "particles": [], "wordId": wid(n)}

DAN_I = "いきしちにひみりぎじびぢ"
DAN_E = "えけせてねへめれげぜべで"
def dan(ch):
    return "い段" if ch in DAN_I else ("え段" if ch in DAN_E else "（其他段）")

# ---------------------------------------------------------------- counters
class Ctr:
    q = 0; e = 0; s = 0
def qid():
    Ctr.q += 1; return "q-n5-12-%03d" % Ctr.q
def eid():
    Ctr.e += 1; return "e-n5-12-%03d" % Ctr.e
def sid():
    Ctr.s += 1; return "s-n5-12-%03d" % Ctr.s

def ex(item, note=None, highlight=None):
    d = {"id": eid(), "type": "example"}
    d.update(item)
    d["highlight"] = highlight or []
    d["audio"] = None
    if note: d["note"] = note
    return d

# ---------------------------------------------------------------- question builders
def txt(i, text): return {"id": i, "text": text}
def optv(i, n): d = V(n); d["id"] = i; return d
GROUP_OPTS = [txt("a", "一類（五段）"), txt("b", "二類（一段）"), txt("c", "三類（不規則）")]
GK = {"一類": "a", "二類": "b", "三類": "c"}

def group_rule(n):
    k, kj, zh, g, note, l = WORDS[n]
    last = k[-1]; prev = k[-2]
    sk = kj or k
    if g == "三類":
        return ("三類動詞只有「する」和「来る」（くる）兩個，沒有規則可循，必須逐個記住。",
                ("「%s」是三類動詞。" % sk) if sk == k else ("「%s」（%s）是三類動詞。" % (sk, k)))
    if g == "二類":
        return ("辭書形以「る」結尾，而且「る」前面的假名屬於い段或え段（例外除外），就是二類動詞。",
                "「%s」（%s）以「る」結尾，「る」前面的「%s」屬於%s，因此是二類動詞。" % (sk, k, prev, dan(prev)))
    if note:
        return ("「帰る」「入る」等少數動詞，「る」前面雖是い段或え段，看似二類，其實屬於一類，必須逐個記住。",
                "「%s」（%s）的「る」前面是「%s」（%s），看似二類，但屬於例外，是一類（五段）動詞。" % (sk, k, prev, dan(prev)))
    return ("辭書形若不是以「る」結尾，就必定是一類動詞。",
            "「%s」（%s）以「%s」結尾，不是「る」，因此是一類動詞。" % (sk, k, last))

def q_group(n, grammar, lesson, prompt="這個動詞屬於哪一類？", source="new", srcref=None, extra_prompt=""):
    g = WORDS[n][3]
    rule, expl = group_rule(n)
    d = {"id": qid(), "type": "choice", "kind": "verb-group", "lesson": lesson, "grammar": grammar,
         "prompt": prompt + extra_prompt, "stem": V(n), "options": GROUP_OPTS, "shuffle": False,
         "answer": GK[g], "answerDisplay": GROUP_DETAIL[g],
         "rule": rule, "explanation": expl, "source": source}
    if srcref: d["sourceRef"] = srcref
    return d

def q_meaning(n, wrong, grammar, lesson, pos):
    opts = []
    zhs = [WORDS[n][2]] + [WORDS[m][2] for m in wrong]
    order = pos
    # pos: list of indices into zhs giving display order; answer position of index 0
    for i, idx in enumerate(order):
        opts.append(txt("abcd"[i], zhs[idx]))
    ans = "abcd"[order.index(0)]
    k, kj = WORDS[n][0], WORDS[n][1]
    return {"id": qid(), "type": "choice", "kind": "vocab-meaning", "lesson": lesson, "grammar": grammar,
            "prompt": "這個動詞的意思是什麼？", "stem": V(n), "options": opts, "shuffle": False, "answer": ans,
            "answerDisplay": WORDS[n][2],
            "rule": "請記住「%s」（%s）的意思：%s。" % (kj or k, k, WORDS[n][2]),
            "explanation": "「%s」（%s）意思是「%s」，屬於%s動詞。" % (kj or k, k, WORDS[n][2], WORDS[n][3]), "source": "new"}

def q_match(grammar, lesson, pairs, prompt, rule, expl, kind="match-verb-meaning", right_key="zh"):
    left = []; right = []; ans = {}
    for i, (n, rtext) in enumerate(pairs):
        lid = "l%d" % (i + 1)
        li = V(n); li["id"] = lid; left.append(li)
    rtexts = sorted(set(r for _, r in pairs), key=lambda x: [r for _, r in pairs].index(x))
    rid = {t: "r%d" % (i + 1) for i, t in enumerate(rtexts)}
    right = [txt(rid[t], t) for t in rtexts]
    for i, (n, rtext) in enumerate(pairs):
        ans["l%d" % (i + 1)] = rid[rtext]
    return {"id": qid(), "type": "match", "kind": kind, "lesson": lesson, "grammar": grammar,
            "prompt": prompt, "left": left, "right": right, "answer": ans,
            "answerDisplay": " ｜ ".join("%s → %s" % (surf(n), r) for n, r in pairs),
            "rule": rule, "explanation": expl, "source": "new"}

def q_fill(grammar, lesson, n, blank_pos, options, answer_idx, rule, expl):
    k, kj, zh = WORDS[n][0], WORDS[n][1], WORDS[n][2]
    ch = k[blank_pos]
    stem = k[:blank_pos] + "＿" + k[blank_pos + 1:]
    assert options[answer_idx] == ch, (k, options, answer_idx)
    return {"id": qid(), "type": "fill", "kind": "dictionary-form-ending", "lesson": lesson, "grammar": grammar,
            "prompt": "請選出正確的假名，補全動詞的辭書形（意思：%s）。" % zh,
            "stem": {"ja": stem, "reading": stem, "blank": True, "zh": zh, "tts": None, "particles": [],
                     "full": {"ja": kj or k, "reading": k, "tts": k, "particles": []}, "wordId": wid(n)},
            "options": [txt("abcd"[i], o) for i, o in enumerate(options)], "shuffle": False,
            "answer": "abcd"[answer_idx], "answerDisplay": "%s（%s）" % (k, kj or k) if kj else k,
            "rule": rule, "explanation": expl, "source": "new"}

def q_reorder(grammar, lesson, pieces, spec, zh, rule, expl):
    """pieces: list of fragment tuples (text) in a display (scrambled) order; spec = tokens of correct sentence"""
    tgt = jp(*spec, zh=zh)
    return {"id": qid(), "type": "reorder", "kind": "sentence-order", "lesson": lesson, "grammar": grammar,
            "prompt": "請把下面的詞語排成正確的日語（意思：%s）。" % zh.rstrip("。"),
            "pieces": [{"id": "p%d" % (i + 1), "text": p, "fragment": True} for i, p in enumerate(pieces)],
            "answerOrder": [], "target": tgt, "answerDisplay": tgt["ja"],
            "rule": rule, "explanation": expl, "source": "new"}

def fix_reorder(q, correct_texts):
    # compute answerOrder (piece ids in correct order) from correct sequence of piece texts
    ids = {}
    for p in q["pieces"]:
        ids.setdefault(p["text"], []).append(p["id"])
    order = []
    for t in correct_texts:
        order.append(ids[t].pop(0))
    q["answerOrder"] = order
    return q

def q_listen(grammar, lesson, tts_item, prompt, options, answer, reveal, rule, expl, kind="listen-choice",
             real=False, note=None, slow=False, stem=None, new_id=None):
    d = {"id": qid(), "type": "listen-choice", "kind": kind, "lesson": lesson, "grammar": grammar,
         "prompt": prompt, "audio": {"ttsText": tts_item["tts"], "engine": "ios-tts", "rate": "normal", "file": None},
         "showStem": False, "options": options, "shuffle": False, "answer": answer,
         "reveal": {k: v for k, v in reveal.items() if k != "id"},
         "answerDisplay": reveal["ja"] if reveal["ja"] == reveal["reading"] else reveal["ja"] + "（" + reveal["reading"] + "）",
         "rule": rule, "explanation": expl, "source": "new",
         "needsRealDeviceCheck": real, "listeningNote": note}
    if kind == "listen-group":
        d["answerDisplay"] = [o["text"] for o in options if o["id"] == answer][0]
    if stem is not None:
        d["showStem"] = True
        d["stem"] = {k: v for k, v in stem.items() if k != "id"}
    if new_id:
        d["id"] = new_id
    return d

def lopt(i, n): return optv(i, n)

# ================================================================ LESSON 1
def lesson1():
    L = "l-n5-12-1"
    vocab = []
    for n in range(1, 6):
        k, kj, zh, g, note, l = WORDS[n]
        vocab.append(n)
    ex_by_word = {
     1: jp("いま", "食べる/たべる", "。", zh="現在吃。"),
     2: jp("いま", "飲む/のむ", "。", zh="現在喝。"),
     3: jp("あした", "行く/いく", "。", zh="明天去。"),
     4: jp("ちょっと", "見る/みる", "。", zh="稍微看一下。"),
     5: jp("ちょっと", "する", "。", zh="稍微做一下。"),
    }
    # grammar
    g1 = {"id": "g-n5-12-01", "title": "動詞與辭書形（結尾為う段）", "blocks": [
      {"type": "text", "text": "動詞是表示**動作**的詞，例如「吃」「喝」「去」「看」。日語動詞有許多變化形，而所有變化形都從**辭書形**出發。因此學動詞，**一定先學辭書形**。"},
      {"type": "term", "ja": "辞書形", "reading": "じしょけい", "tts": "じしょけい", "particles": [], "zh": "辭書形（查辭典時看到的動詞原形）"},
      {"type": "text", "text": "辭書形的**最後一個假名，一定屬於う段**，即以下九個之一：`う・く・ぐ・す・つ・ぬ・ぶ・む・る`。"},
      {"type": "text", "text": "補充：五十音表中，直列稱為「段」（あ段、い段、う段、え段、お段），橫列稱為「行」（以一般橫排的五十音表而言）。例如「く」屬於か行、う段。"},
      {"type": "table", "title": "本課動詞的最後一個假名", "headers": ["辭書形", "最後的假名", "屬於"], "rows": [
         [{"ja": "食べる", "reading": "たべる", "tts": "たべる", "particles": []}, "る", "う段"],
         [{"ja": "飲む", "reading": "のむ", "tts": "のむ", "particles": []}, "む", "う段"],
         [{"ja": "行く", "reading": "いく", "tts": "いく", "particles": []}, "く", "う段"],
         [{"ja": "見る", "reading": "みる", "tts": "みる", "particles": []}, "る", "う段"],
         [{"ja": "する", "reading": "する", "tts": "する", "particles": []}, "る", "う段"]]},
      {"type": "text", "text": "辭書形也可以**直接放在句末**，用於備忘、日記或熟人之間的簡短說話。禮貌的說法（ます形）會在單元 13 學習，本單元先不使用。"},
      ex(jp("いま", "食べる/たべる", "。", zh="現在吃。"), "辭書形直接結束句子。", ["る"]),
      ex(jp("わたし", "は~", "あした", "行く/いく", "。", zh="我明天去。"), "「は」作助詞時讀作「わ」；日語常省略不必要的詞語。", ["は", "く"]),
    ]}
    g2 = {"id": "g-n5-12-02", "title": "動詞的三大分類（總覽）", "blocks": [
      {"type": "text", "text": "日語動詞分為**三類**。之後學到的所有變化，都要先判斷動詞屬於哪一類，所以必須先學會分類。"},
      {"type": "table", "title": "三類動詞總覽", "headers": ["類別", "別稱", "特徵", "本課的例子"], "rows": [
         ["一類", "五段動詞", "二類、三類以外的所有動詞", [{"ja": "飲む", "reading": "のむ", "tts": "のむ", "particles": []}, {"ja": "行く", "reading": "いく", "tts": "いく", "particles": []}]],
         ["二類", "一段動詞", "以「る」結尾，「る」前面是い段或え段", [{"ja": "食べる", "reading": "たべる", "tts": "たべる", "particles": []}, {"ja": "見る", "reading": "みる", "tts": "みる", "particles": []}]],
         ["三類", "不規則動詞", "只有「する」和「来る」兩個", [{"ja": "する", "reading": "する", "tts": "する", "particles": []}]]]},
      {"type": "text", "text": "本課先認識分類的名稱，並記住五個動詞各屬哪一類。三類與二類的判斷方法在**第 2 課**詳述，一類與例外在**第 3 課**詳述。"},
      {"type": "text", "text": "本課五個動詞：**二類**＝`たべる`、`みる`；**一類**＝`のむ`、`いく`；**三類**＝`する`。"},
    ]}
    exercises = []
    # E1 choice: which is a dictionary form
    exercises.append({"id": qid(), "type": "choice", "kind": "dictionary-form", "lesson": 1, "grammar": ["g-n5-12-01"],
        "prompt": "下列哪一個是動詞「喝」的辭書形？", "stem": None,
        "options": [dict(id="a", ja="のま", reading="のま", zh="（不是辭書形）", tts="のま", particles=[], nonWord=True),
                    dict(id="b", ja="のみ", reading="のみ", zh="（不是辭書形）", tts="のみ", particles=[], nonWord=True),
                    dict(id="c", ja="飲む", reading="のむ", zh="喝；飲用", tts="のむ", particles=[], wordId=wid(2)),
                    dict(id="d", ja="のめ", reading="のめ", zh="（不是辭書形）", tts="のめ", particles=[], nonWord=True)],
        "shuffle": False, "answer": "c", "answerDisplay": "飲む（のむ）",
        "rule": "辭書形的最後一個假名一定屬於う段。「む」屬於う段，「ま」「み」「め」不屬於。",
        "explanation": "「の・む」最後的「む」屬於う段，所以「飲む」（のむ）是辭書形。", "source": "new"})
    exercises.append(q_fill(["g-n5-12-01"], 1, 3, 1, ["か", "き", "く", "け"], 2,
        "辭書形的最後一個假名一定屬於う段，而「か・き・く・け」之中屬於う段的是「く」。",
        "「い・く」（行く）的最後一個假名是「く」，屬於う段。"))
    exercises.append(q_match(["g-n5-12-01"], 1, [(1, "吃"), (2, "喝；飲用"), (3, "去"), (4, "看"), (5, "做；進行")],
        "請把日語動詞與意思配對。",
        "請記住每個動詞的辭書形與意思。", "食べる＝吃、飲む＝喝、行く＝去、見る＝看、する＝做。"))
    exercises.append(q_group(4, ["g-n5-12-02"], 1, source="reused", srcref="batch1-n5-day1-7/content/lessons/n5w1-d1v.json#n5w1-d1v-q1",
                             prompt="請判斷這個動詞屬於哪一類。"))
    exercises[-1]["sourceNote"] = "題幹沿用舊題（見る），解說以書面中文重寫，並刪去本單元未教的例外詞。"
    exercises.append(q_group(2, ["g-n5-12-02"], 1))
    exercises.append(q_group(5, ["g-n5-12-02"], 1))
    r = q_reorder(["g-n5-12-01"], 1, ["べ", "る", "た"], ["食べる/たべる"], "吃",
        "請按讀音順序排列假名，組成辭書形。", "「た・べ・る」是辭書形，最後的「る」屬於う段。")
    r["target"] = {"ja": "食べる", "reading": "たべる", "zh": "吃", "tts": "たべる", "particles": [], "wordId": wid(1)}
    r["answerDisplay"] = "たべる"
    fix_reorder(r, ["た", "べ", "る"])
    exercises.append(r)
    exercises.append({"id": qid(), "type": "choice", "kind": "concept", "lesson": 1, "grammar": ["g-n5-12-01"],
        "prompt": "學習動詞變化時，一切都應該從哪一個形式出發？", "stem": None,
        "options": [txt("a", "辭書形"), txt("b", "最後一個音"), txt("c", "隨意一個形式"), txt("d", "漢字的筆畫")],
        "shuffle": False, "answer": "a", "answerDisplay": "辭書形",
        "rule": "動詞的所有變化形，都從辭書形出發。", "explanation": "辭書形是動詞的原形，判斷類別與變形都以它為起點。", "source": "new"})
    exercises.append({"id": qid(), "type": "choice", "kind": "dictionary-form", "lesson": 1, "grammar": ["g-n5-12-01"],
        "prompt": "下列哪一個詞不是動詞？", "stem": None,
        "options": [optv("a", 1), optv("b", 3),
                    dict(id="c", ja="わたし", reading="わたし", zh="我", tts="わたし", particles=[]),
                    optv("d", 2)],
        "shuffle": False, "answer": "c", "answerDisplay": "わたし（我）",
        "rule": "動詞表示動作，辭書形以う段結尾；「わたし」是名詞，結尾「し」屬於い段。",
        "explanation": "「わたし」是「我」，是名詞，不是動詞。", "source": "new"})
    listening = [
      q_listen(["g-n5-12-01"], 1, V(2), "請聽音頻，選出你聽到的動詞。",
        [lopt("a", 2), lopt("b", 4), lopt("c", 3), lopt("d", 1)], "a", V(2),
        "辭書形的最後一個假名屬於う段，注意每個動詞開頭的假名不同。", "聽到「の・む」，是「飲む」（のむ）。「みる」開頭是「み」，「いく」開頭是「い」。"),
      q_listen(["g-n5-12-01"], 1, V(1), "請聽音頻，選出動詞的意思。",
        [txt("a", "看"), txt("b", "吃"), txt("c", "去"), txt("d", "喝；飲用")], "b", V(1),
        "「た・べ・る」＝吃。", "聽到「たべる」，是「食べる」，意思是「吃」。", kind="listen-meaning"),
      q_listen(["g-n5-12-02"], 1, V(3), "請聽音頻，判斷這個動詞屬於哪一類。",
        GROUP_OPTS, "a", V(3),
        "辭書形不是以「る」結尾的動詞，一定是一類。", "聽到「いく」，是「行く」。最後的「く」不是「る」，所以是一類動詞。", kind="listen-group"),
    ]
    return L, vocab, ex_by_word, [g1, g2], exercises, listening

# ================================================================ LESSON 2
def lesson2():
    L = "l-n5-12-2"
    vocab = [6, 7, 8, 9, 10]
    ex_by_word = {
     6: jp("あした", "来る/くる", "。", zh="明天來。"),
     7: jp("あさ", "起きる/おきる", "。", zh="早上起床。"),
     8: jp("いま", "寝る/ねる", "。", zh="現在睡覺。"),
     9: jp("あした", "教える/おしえる", "。", zh="明天教（或告知）。"),
     10: jp("きょう", "出かける/でかける", "。", zh="今天外出。"),
    }
    g3 = {"id": "g-n5-12-03", "title": "三類動詞：する・来る（くる）", "blocks": [
      {"type": "text", "text": "三類動詞**只有兩個**：`する`（做）和`来る`（來，讀作「くる」）。它們的變化不規則，沒有規則可套用，必須**逐個記住**。"},
      {"type": "table", "title": "三類動詞", "headers": ["辭書形", "讀音", "意思", "類別"], "rows": [
        [{"ja": "する", "reading": "する", "tts": "する", "particles": []}, "する", "做；進行", "三類"],
        [{"ja": "来る", "reading": "くる", "tts": "くる", "particles": []}, "くる", "來", "三類"]]},
      {"type": "text", "text": "注意：「来る」在之後的變化中，讀音會有所改變，所以要特別留意；變化形會在單元 13 起學習，現在只需記住辭書形「くる」。"},
      ex(jp("あした", "来る/くる", "。", zh="明天來。"), "「来る」讀作「くる」，是三類動詞。", ["来る"]),
      ex(jp("ちょっと", "する", "。", zh="稍微做一下。"), "「する」是三類動詞。", ["する"]),
    ]}
    g4 = {"id": "g-n5-12-04", "title": "二類動詞：「る」前面是い段或え段", "blocks": [
      {"type": "text", "text": "二類動詞（一段動詞）的判斷方法：辭書形**以「る」結尾**，而且「る」**前面的假名屬於い段或え段**。"},
      {"type": "text", "text": "`い段`：い・き・し・ち・に・ひ・み・り（及其濁音）　`え段`：え・け・せ・て・ね・へ・め・れ（及其濁音）"},
      {"type": "table", "title": "二類動詞的「る」前面", "headers": ["辭書形", "讀音", "「る」前面", "屬於", "意思"], "rows": [
        [{"ja": "食べる", "reading": "たべる", "tts": "たべる", "particles": []}, "べ", "え段", "吃"],
        [{"ja": "見る", "reading": "みる", "tts": "みる", "particles": []}, "み", "い段", "看"],
        [{"ja": "起きる", "reading": "おきる", "tts": "おきる", "particles": []}, "き", "い段", "起床"],
        [{"ja": "寝る", "reading": "ねる", "tts": "ねる", "particles": []}, "ね", "え段", "睡覺"],
        [{"ja": "教える", "reading": "おしえる", "tts": "おしえる", "particles": []}, "え", "え段", "教；告知"],
        [{"ja": "出かける", "reading": "でかける", "tts": "でかける", "particles": []}, "け", "え段", "外出"]]},
      {"type": "text", "text": "**小心**：「る」前面是い段或え段，只是判斷的**條件**，不是百分之百準確；少數動詞形狀相同卻屬於一類，會在第 3 課學習。"},
      ex(jp("あさ", "起きる/おきる", "。", zh="早上起床。"), "「き」屬於い段，所以「起きる」是二類動詞。", ["き"]),
      ex(jp("わたし", "は~", "いま", "寝る/ねる", "。", zh="我現在睡覺。"), "「ね」屬於え段，所以「寝る」是二類動詞。", ["ね"]),
    ]}
    ex_ = []
    ex_.append(q_group(6, ["g-n5-12-03"], 2, source="reused", srcref="batch1-n5-day1-7/content/lessons/n5w1-d1v.json#n5w1-d1v-q3"))
    ex_[-1]["sourceNote"] = "題幹沿用舊題（来る），解說以書面中文重寫。"
    ex_.append({"id": qid(), "type": "choice", "kind": "concept", "lesson": 2, "grammar": ["g-n5-12-03"],
        "prompt": "下列哪一組兩個動詞都是三類動詞？", "stem": None,
        "options": [dict(id="a", ja="する・来る", reading="する・くる", zh="做・來", tts="する・くる", particles=[]),
                    dict(id="b", ja="食べる・見る", reading="たべる・みる", zh="吃・看", tts="たべる・みる", particles=[]),
                    dict(id="c", ja="行く・飲む", reading="いく・のむ", zh="去・喝", tts="いく・のむ", particles=[]),
                    dict(id="d", ja="寝る・起きる", reading="ねる・おきる", zh="睡覺・起床", tts="ねる・おきる", particles=[])],
        "shuffle": False, "answer": "a", "answerDisplay": "する・来る（する・くる）",
        "rule": "三類動詞只有「する」和「来る」（くる）兩個。", "explanation": "其餘三組分別是二類與一類動詞。", "source": "new"})
    ex_.append(q_group(7, ["g-n5-12-04"], 2))
    ex_.append({"id": qid(), "type": "choice", "kind": "dan", "lesson": 2, "grammar": ["g-n5-12-04"],
        "prompt": "「寝る」（ねる）的「る」前面的假名「ね」，屬於哪一段？", "stem": V(8),
        "options": [txt("a", "あ段"), txt("b", "い段"), txt("c", "う段"), txt("d", "え段")],
        "shuffle": False, "answer": "d", "answerDisplay": "え段",
        "rule": "二類動詞的「る」前面是い段或え段。", "explanation": "「ね」屬於な行、え段，所以「寝る」是二類動詞。", "source": "new"})
    ex_.append(q_match(["g-n5-12-03", "g-n5-12-04"], 2,
        [(6, "三類"), (7, "二類"), (5, "三類"), (8, "二類"), (4, "二類")],
        "請把動詞與它所屬的類別配對。", "三類只有「する」「来る」；以「る」結尾且前面是い段或え段的，一般是二類。",
        "する・くる＝三類；おきる・ねる・みる＝二類。", kind="match-verb-group"))
    ex_.append(q_fill(["g-n5-12-04"], 2, 9, 2, ["え", "あ", "う", "お"], 0,
        "二類動詞「る」前面的假名屬於い段或え段，所以應填え段的「え」。",
        "「お・し・え・る」（教える）的「る」前面是「え」，屬於え段。"))
    r = q_reorder(["g-n5-12-03", "g-n5-12-04"], 2, ["出かける", "きょう", "は", "わたし"], ["わたし", "は~", "きょう", "出かける/でかける", "。"],
        "我今天外出。", "助詞「は」接在主題之後，動詞放在句末。", "正確順序：わたしは　きょう　出かける。")
    r["pieces"] = [{"id": "p1", "text": "出かける", "fragment": True}, {"id": "p2", "text": "きょう", "fragment": True},
                   {"id": "p3", "text": "は", "fragment": True, "particle": True}, {"id": "p4", "text": "わたし", "fragment": True}]
    r["answerOrder"] = ["p4", "p3", "p2", "p1"]
    r["answerDisplay"] = "わたしはきょう出かける。"
    ex_.append(r)
    ex_.append(q_meaning(9, [4, 7, 8], ["g-n5-12-04"], 2, [2, 0, 1, 3]))
    ex_.append({"id": qid(), "type": "choice", "kind": "concept", "lesson": 2, "grammar": ["g-n5-12-04"],
        "prompt": "「見る」（みる）和「食べる」（たべる）為什麼是二類動詞？", "stem": None,
        "options": [txt("a", "兩者的「る」前面分別是い段的「み」和え段的「べ」"), txt("b", "因為它們以「く」結尾"),
                    txt("c", "因為它們是三類動詞"), txt("d", "因為它們只有兩個假名")],
        "shuffle": False, "answer": "a", "answerDisplay": "兩者的「る」前面分別是い段的「み」和え段的「べ」",
        "rule": "二類動詞：辭書形以「る」結尾，而且「る」前面是い段或え段。", "explanation": "「み」屬於い段，「べ」屬於え段，兩者都符合二類的條件。", "source": "new"})
    listening = [
      q_listen(["g-n5-12-03"], 2, V(6), "請聽音頻，選出動詞的意思。",
        [txt("a", "去"), txt("b", "回去；回家"), txt("c", "來"), txt("d", "做；進行")], "c", V(6),
        "「く・る」＝來；注意不要與「いく」（去）混淆。", "聽到「くる」，是「来る」，意思是「來」，屬於三類動詞。", kind="listen-meaning"),
      q_listen(["g-n5-12-04"], 2, V(7), "請聽音頻，選出你聽到的動詞。",
        [lopt("a", 9), lopt("b", 8), lopt("c", 10), lopt("d", 7)], "d", V(7),
        "「おきる」有三拍：お・き・る；「おしえる」有四拍。", "聽到「お・き・る」，是「起きる」。「おしえる」是「お・し・え・る」，「ねる」只有兩拍。"),
      q_listen(["g-n5-12-02"], 2, {"tts": "おばあさん"}, "（長音複習）請聽音頻，選出詞語的意思。",
        [txt("a", "祖母；老婆婆"), txt("b", "叔伯姑姨輩的女性（阿姨）")], "a",
        {"ja": "おばあさん", "reading": "おばあさん", "zh": "祖母；老婆婆", "tts": "おばあさん", "particles": []},
        "「おばあさん」的「あ」要拉長，比「おばさん」多一拍。", "聽到「お・ばあ・さん」，有長音，是「おばあさん」（祖母）。沒有長音的「おばさん」指阿姨。",
        kind="listen-long-vowel-review", real=True,
        note="檢查：iPhone 語音是否把「ばあ」讀成清楚的長音（4 拍：お・ば・あ・さ・ん 共 5 拍，其中「あ」要拉長）；若與「おばさん」聽起來幾乎一樣，此題需改用預錄音檔。同時確認「ば」是濁音，沒有被讀成「ぱ」或「は」。"),
    ]
    # fix note (beat count wording)
    listening[2]["listeningNote"] = "檢查：（1）iPhone 語音是否把「ばあ」的「あ」拉長，與「おばさん」有明顯差別（おばあさん 共 5 拍，おばさん 共 4 拍）；（2）「ば」是否清晰的濁音，沒有讀成「ぱ」或「は」。若兩者聽起來幾乎一樣，此題需改用預錄音檔。"
    return L, vocab, ex_by_word, [g3, g4], ex_, listening

# ================================================================ LESSON 3
def lesson3():
    L = "l-n5-12-3"
    vocab = [11, 12, 13, 14, 15]
    ex_by_word = {
     11: jp("あした", "買う/かう", "。", zh="明天買。"),
     12: jp("ちょっと", "待つ/まつ", "。", zh="稍等一下。"),
     13: jp("きょう", "帰る/かえる", "。", zh="今天回去。"),
     14: jp("いま", "入る/はいる", "。", zh="現在進去。"),
     15: jp("ちょっと", "話す/はなす", "。", zh="稍微說一下。"),
    }
    g5 = {"id": "g-n5-12-05", "title": "一類動詞：其餘全部（五段）", "blocks": [
      {"type": "text", "text": "一類動詞（五段動詞）就是**二類、三類以外的所有動詞**。判斷時有一條最好用的規則：**辭書形不是以「る」結尾的動詞，一定是一類**。"},
      {"type": "table", "title": "一類動詞的結尾（辭書形最後一個假名）", "headers": ["最後的假名", "例子", "讀音", "意思"], "rows": [
        ["う", {"ja": "買う", "reading": "かう", "tts": "かう", "particles": []}, "かう", "買"],
        ["く", {"ja": "行く", "reading": "いく", "tts": "いく", "particles": []}, "いく", "去"],
        ["す", {"ja": "話す", "reading": "はなす", "tts": "はなす", "particles": []}, "はなす", "說話；交談"],
        ["つ", {"ja": "待つ", "reading": "まつ", "tts": "まつ", "particles": []}, "まつ", "等待"],
        ["む", {"ja": "飲む", "reading": "のむ", "tts": "のむ", "particles": []}, "のむ", "喝；飲用"]]},
      {"type": "text", "text": "此外，一類動詞還可能以「ぐ・ぬ・ぶ・る」結尾；這些例子會在之後的單元學習。"},
      {"type": "text", "text": "**記法**：先看是否為「する」「来る」（三類）→ 再看是否以「る」結尾 → 不是「る」就是一類。"},
      ex(jp("あした", "買う/かう", "。", zh="明天買。"), "「う」結尾，不是「る」，是一類動詞。", ["う"]),
      ex(jp("ちょっと", "待つ/まつ", "。", zh="稍等一下。"), "「つ」結尾，是一類動詞。", ["つ"]),
    ]}
    g6 = {"id": "g-n5-12-06", "title": "形似二類的一類動詞（例外）", "blocks": [
      {"type": "text", "text": "有少數動詞，「る」前面雖然是い段或え段，**看起來像二類，其實是一類**。這些動詞要**逐個記住**。本單元要認識的有：`帰る`、`入る`（另有`切る`，只作認識）。"},
      {"type": "table", "title": "形似二類的一類動詞", "headers": ["辭書形", "讀音", "「る」前面", "意思", "類別"], "rows": [
        [{"ja": "帰る", "reading": "かえる", "tts": "かえる", "particles": []}, "え（え段）", "回去；回家", "一類（看似二類）"],
        [{"ja": "入る", "reading": "はいる", "tts": "はいる", "particles": []}, "い（い段）", "進入", "一類（看似二類）"],
        [{"ja": "切る", "reading": "きる", "tts": "きる", "particles": [], "exposureOnly": True}, "き（い段）", "切；剪", "一類（看似二類）"]]},
      {"type": "table", "title": "對比：外形相似，類別不同", "headers": ["辭書形", "讀音", "類別"], "rows": [
        [{"ja": "食べる", "reading": "たべる", "tts": "たべる", "particles": []}, "たべる", "二類"],
        [{"ja": "帰る", "reading": "かえる", "tts": "かえる", "particles": []}, "かえる", "一類（看似二類）"],
        [{"ja": "見る", "reading": "みる", "tts": "みる", "particles": []}, "みる", "二類"],
        [{"ja": "入る", "reading": "はいる", "tts": "はいる", "particles": []}, "はいる", "一類（看似二類）"]]},
      {"type": "text", "text": "**重點**：看到以「る」結尾又符合「い段／え段＋る」的動詞，先想一想它是否屬於例外。之後的單元（單元 13 起）變形時，例外動詞要按一類的規則變化。"},
      ex(jp("きょう", "帰る/かえる", "。", zh="今天回去。"), "「帰る」看似二類，其實是一類動詞。", ["帰る"]),
      ex(jp("わたし", "は~", "いま", "入る/はいる", "。", zh="我現在進去。"), "「入る」讀作「はいる」，是一類動詞（看似二類）。注意：「はいる」的「は」屬於詞語本身，讀「は」；只有助詞「は」才讀「わ」。", ["入る"]),
    ]}
    e = []
    e.append(q_group(11, ["g-n5-12-05"], 3))
    e.append(q_group(15, ["g-n5-12-05"], 3))
    e.append(q_group(13, ["g-n5-12-06"], 3, source="reused", srcref="batch1-n5-day1-7/content/lessons/n5w1-d1v.json#n5w1-d1v-q2",
                     extra_prompt="（留意：形似二類）"))
    e[-1]["sourceNote"] = "題幹沿用舊題（帰る），解說以書面中文重寫，並刪去本單元未教的例外詞。"
    e.append(q_group(14, ["g-n5-12-06"], 3, extra_prompt="（留意：形似二類）"))
    e.append(q_match(["g-n5-12-05", "g-n5-12-06"], 3,
        [(13, "一類"), (1, "二類"), (12, "一類"), (6, "三類"), (14, "一類")],
        "請把動詞與它所屬的類別配對。", "「帰る」「入る」是一類（看似二類）；「食べる」是二類；「来る」是三類。",
        "かえる・まつ・はいる＝一類；たべる＝二類；くる＝三類。", kind="match-verb-group"))
    e.append({"id": qid(), "type": "choice", "kind": "concept", "lesson": 3, "grammar": ["g-n5-12-06"],
        "prompt": "下列哪一組兩個動詞都是「形似二類的一類動詞」？", "stem": None,
        "options": [dict(id="a", ja="帰る・入る", reading="かえる・はいる", zh="回去・進入", tts="かえる・はいる", particles=[]),
                    dict(id="b", ja="食べる・見る", reading="たべる・みる", zh="吃・看", tts="たべる・みる", particles=[]),
                    dict(id="c", ja="する・来る", reading="する・くる", zh="做・來", tts="する・くる", particles=[]),
                    dict(id="d", ja="飲む・行く", reading="のむ・いく", zh="喝・去", tts="のむ・いく", particles=[])],
        "shuffle": False, "answer": "a", "answerDisplay": "帰る・入る（かえる・はいる）",
        "rule": "「帰る」「入る」的「る」前面是え段、い段，看似二類，但屬於一類。",
        "explanation": "「食べる・見る」是二類，「する・来る」是三類，「飲む・行く」是一般的一類（結尾不是「る」）。", "source": "new"})
    e.append(q_fill(["g-n5-12-05"], 3, 12, 1, ["る", "つ", "う", "く"], 1,
        "「待つ」（まつ）是一類動詞，辭書形以う段的「つ」結尾。",
        "「ま・つ」（待つ）的最後一個假名是「つ」。"))
    r = q_reorder(["g-n5-12-05"], 3, ["待つ", "ちょっと"], ["ちょっと", "待つ/まつ", "。"], "稍等一下。",
        "副詞「ちょっと」放在動詞之前。", "正確順序：ちょっと　待つ。")
    r["pieces"] = [{"id": "p1", "text": "待つ", "fragment": True}, {"id": "p2", "text": "ちょっと", "fragment": True}]
    r["answerOrder"] = ["p2", "p1"]
    r["answerDisplay"] = "ちょっと待つ。"
    e.append(r)
    e.append(q_meaning(14, [11, 12, 15], ["g-n5-12-06"], 3, [1, 2, 0, 3]))
    e.append({"id": qid(), "type": "choice", "kind": "concept", "lesson": 3, "grammar": ["g-n5-12-06"],
        "prompt": "關於「食べる」（たべる）和「帰る」（かえる），下列哪一項正確？", "stem": None,
        "options": [txt("a", "兩者都是二類動詞"), txt("b", "食べる是二類，帰る是一類"), txt("c", "食べる是一類，帰る是二類"), txt("d", "兩者都是三類動詞")],
        "shuffle": False, "answer": "b", "answerDisplay": "食べる是二類，帰る是一類",
        "rule": "「帰る」的「る」前面雖是え段，但屬於例外，是一類動詞。", "explanation": "「食べる」符合二類條件；「帰る」是形似二類的一類，須逐個記住。", "source": "new"})
    listening = [
      q_listen(["g-n5-12-05"], 3, V(11), "請聽音頻，選出動詞的意思。",
        [txt("a", "吃"), txt("b", "等待"), txt("c", "買"), txt("d", "說話；交談")], "c", V(11),
        "「か・う」＝買。", "聽到「かう」，是「買う」，意思是「買」，結尾是「う」，屬於一類動詞。", kind="listen-meaning"),
      q_listen(["g-n5-12-06"], 3, V(13), "請看漢字「帰る」（意思：回去、回家），再聽音頻，選出讀音相符的假名。",
        [txt("a", "かう"), txt("b", "はいる"), txt("c", "かえる"), txt("d", "はなす")], "c", V(13),
        "「かえる」有三拍：か・え・る。與「かう」（兩拍）不同。", "「帰る」讀作「かえる」，意思是回去。它看似二類，其實是一類動詞。",
        kind="listen-reading", stem=V(13), new_id="q-n5-12-060",
        note="（非長音題）本題題幹已顯示漢字「帰る」與中文提示，不要求辨別同音詞；只確認語音讀出的是「か・え・る」三拍。若 TTS 把「かえる」讀成「蛙」的音調，請在此記錄。"),
      q_listen(["g-n5-12-06"], 3, V(14), "請聽音頻，判斷這個動詞屬於哪一類。",
        GROUP_OPTS, "a", V(14),
        "「はいる」看似二類，其實是一類。", "聽到「はいる」，是「入る」，屬於一類動詞（看似二類）。", kind="listen-group"),
    ]
    return L, vocab, ex_by_word, [g5, g6], e, listening

# ================================================================ assemble
def build():
    lessons = []
    titles = {1: "什麼是動詞：辭書形", 2: "三類與二類動詞", 3: "一類動詞與例外"}
    descs = {1: "認識動詞與辭書形，並初步認識三大分類。", 2: "學習三類動詞（する・来る）與二類動詞的判斷方法。", 3: "學習一類動詞，以及形似二類的一類動詞。"}
    for i, f in enumerate([lesson1, lesson2, lesson3], 1):
        L, vocab, exw, gps, exercises, listening = f()
        vlist = []
        for n in vocab:
            k, kj, zh, g, note, l = WORDS[n]
            vlist.append({"id": wid(n), "kana": k, "kanji": kj, "reading": k, "zh": zh, "tts": k, "particles": [],
                          "pos": "動詞", "group": g, "groupDetail": GROUP_DETAIL[g], "groupNote": note,
                          "audio": None, "example": dict(id=eid(), **ex_by_word_get(exw, n)),
                          "addedBeyondOutline": n in (9, 10)})
        lesson = {"id": L, "number": i, "title": titles[i], "description": descs[i],
                  "estimatedMinutes": 10,
                  "prerequisites": ["l-n5-11-3"] if i == 1 else ["l-n5-12-%d" % (i - 1)],
                  "vocab": vlist,
                  "reviewVocab": [wid(4), wid(1)] if i == 2 else [],
                  "grammar": {"points": gps},
                  "exercises": exercises, "listening": listening}
        lessons.append(lesson)
    return lessons

def ex_by_word_get(exw, n):
    return exw[n]

def tips():
    flow = {
      "id": "tip-n5-12-flow", "type": "flowchart", "title": "三類動詞分類流程圖",
      "nodes": [
        {"id": "n1", "text": "辭書形是「する」或「来る」（くる）嗎？"},
        {"id": "n2", "text": "辭書形是否以「る」結尾？"},
        {"id": "n3", "text": "「る」前面的假名是い段或え段嗎？"},
        {"id": "n4", "text": "是否為例外（帰る、入る、切る等）？"},
        {"id": "r3", "text": "三類動詞", "result": "三類"},
        {"id": "r1a", "text": "一類動詞（結尾不是「る」）", "result": "一類"},
        {"id": "r1b", "text": "一類動詞（「る」前面不是い段或え段）", "result": "一類"},
        {"id": "r1c", "text": "一類動詞（看似二類）", "result": "一類"},
        {"id": "r2", "text": "二類動詞", "result": "二類"}],
      "edges": [
        {"from": "n1", "to": "r3", "label": "是"}, {"from": "n1", "to": "n2", "label": "否"},
        {"from": "n2", "to": "r1a", "label": "否"}, {"from": "n2", "to": "n3", "label": "是"},
        {"from": "n3", "to": "r1b", "label": "否"}, {"from": "n3", "to": "n4", "label": "是"},
        {"from": "n4", "to": "r1c", "label": "是"}, {"from": "n4", "to": "r2", "label": "否"}],
      "stepsText": ["第一步：是「する」或「来る」嗎？是→三類。", "第二步：不以「る」結尾→一類。",
                    "第三步：以「る」結尾，但「る」前面不是い段或え段→一類。",
                    "第四步：「る」前面是い段或え段→先檢查是否為例外（帰る、入る、切る）：是→一類；否→二類。"]}
    def cell(ja, rd): return {"ja": ja, "reading": rd, "tts": rd, "particles": []}
    t1 = {"id": "tbl-n5-12-1", "title": "三類動詞比較表", "headers": ["類別", "別稱", "判斷方法", "例子"], "rows": [
        ["一類", "五段動詞", "結尾不是「る」；或形似二類的例外", [cell("飲む", "のむ"), cell("買う", "かう"), cell("帰る", "かえる")]],
        ["二類", "一段動詞", "以「る」結尾，前面是い段或え段（非例外）", [cell("食べる", "たべる"), cell("起きる", "おきる"), cell("見る", "みる")]],
        ["三類", "不規則動詞", "只有兩個", [cell("する", "する"), cell("来る", "くる")]]]}
    t2 = {"id": "tbl-n5-12-2", "title": "形似二類的一類動詞", "headers": ["辭書形", "讀音", "意思", "類別"], "rows": [
        [cell("帰る", "かえる"), "かえる", "回去；回家", "一類（看似二類）"],
        [cell("入る", "はいる"), "はいる", "進入", "一類（看似二類）"],
        [dict(cell("切る", "きる"), exposureOnly=True), "きる", "切；剪", "一類（看似二類）"]]}
    sections = [
      {"id": "tip-n5-12-1", "title": "核心原則：動詞一定由辭書形出發", "blocks": [
        {"type": "text", "text": "學動詞時，**第一步永遠是辭書形**：先認得辭書形，再判斷它屬於哪一類，之後的所有變化（單元 13 起）才能正確推導。"},
        {"type": "text", "text": "辭書形的**最後一個假名一定屬於う段**：`う・く・ぐ・す・つ・ぬ・ぶ・む・る`。"},
        ex(jp("いま", "食べる/たべる", "。", zh="現在吃。"), "辭書形可直接結束簡短的句子。", ["る"])]},
      {"id": "tip-n5-12-2", "title": "三類動詞分類流程圖", "blocks": [{"type": "flowchart", "ref": "tip-n5-12-flow"}]},
      {"id": "tip-n5-12-3", "title": "形似二類的一類動詞（帰る、入る、切る）", "blocks": [
        {"type": "table_ref", "ref": "tbl-n5-12-2"},
        {"type": "text", "text": "**記憶方法**：把它們當作「必須單獨記住的名單」，遇到「い段／え段＋る」的動詞時，先查這份名單。"},
        ex(jp("きょう", "帰る/かえる", "。", zh="今天回去。"), "一類（看似二類）。", ["帰る"]),
        ex(jp("いま", "入る/はいる", "。", zh="現在進去。"), "一類（看似二類）。", ["入る"])]},
      {"id": "tip-n5-12-4", "title": "助詞「は」的讀音提醒", "blocks": [
        {"type": "text", "text": "作為助詞的「は」讀作「わ」，但詞語本身的「は」維持原音。例如「わたし**は**」讀作「わたしわ」，而「**は**いる」仍讀作「はいる」。"},
        ex(jp("わたし", "は~", "あした", "来る/くる", "。", zh="我明天來。"), "第一個「は」是助詞，讀作「わ」；其餘詞語沒有助詞。", ["は"])]},
    ]
    return {"sections": sections, "tables": [t1, t2], "flowcharts": [flow]}

def story():
    lines_spec = [
      (jp("あさ", "起きる/おきる", "。", zh="早上起床。"), 7),
      (jp("いま", "食べる/たべる", "。", zh="現在吃。"), 1),
      (jp("ちょっと", "飲む/のむ", "。", zh="稍微喝一點。"), 2),
      (jp("きょう", "出かける/でかける", "。", zh="今天外出。"), 10),
      (jp("あした", "行く/いく", "。", zh="明天去。"), 3),
      (jp("ちょっと", "待つ/まつ", "。", zh="稍等一下。"), 12),
      (jp("いま", "入る/はいる", "。", zh="現在進去。"), 14),
      (jp("ちょっと", "見る/みる", "。", zh="稍微看一下。"), 4),
      (jp("ちょっと", "話す/はなす", "。", zh="稍微說幾句。"), 15),
      (jp("あした", "買う/かう", "。", zh="明天買。"), 11),
      (jp("わたし", "は~", "あした", "来る/くる", "。", zh="我明天會來。"), 6),
      (jp("きょう", "帰る/かえる", "。", zh="今天回去。"), 13),
      (jp("あした", "教える/おしえる", "。", zh="明天教（或告知）。"), 9),
      (jp("ちょっと", "する", "。", zh="稍微做一下。"), 5),
      (jp("いま", "寝る/ねる", "。", zh="現在睡覺。"), 8),
    ]
    lines = []
    for sp, n in lines_spec:
        d = {"id": sid()}; d.update(sp)
        d["verbWordId"] = wid(n)
        d["audio"] = None
        lines.append(d)
    # lookup helper
    by_n = {n: lines[i] for i, (_, n) in enumerate(lines_spec)}
    def sopt(i, n): d = dict(by_n[n]); d["id"] = i; return d
    rq = []
    def rq_choice(prompt, opts, ans, disp, rule, expl, g, kind="story-reading"):
        return {"id": qid(), "type": "choice", "kind": kind, "lesson": None, "grammar": g, "prompt": prompt, "stem": None,
                "options": opts, "shuffle": False, "answer": ans, "answerDisplay": disp, "rule": rule,
                "explanation": expl, "source": "new"}
    rq.append(rq_choice("第一行「あさ起きる。」的動詞，屬於哪一類？", GROUP_OPTS, "b", "二類（一段）",
        "以「る」結尾，「る」前面的「き」屬於い段，是二類動詞。", "「起きる」（おきる）是二類動詞。", ["g-n5-12-04"]))
    rq.append(rq_choice("哪一行的動詞是三類動詞，意思是「來」？",
        [dict(by_n[12], id="a"), dict(by_n[6], id="b"), dict(by_n[4], id="c"), dict(by_n[7], id="d")], "b", "わたしはあした来る。",
        "三類動詞只有「する」和「来る」；「来る」的意思是「來」。", "「来る」（くる）是三類動詞，意思是「來」。", ["g-n5-12-03"]))
    rq.append(rq_choice("哪一行的動詞是「形似二類的一類動詞」？（四個選項中只有一個）",
        [dict(by_n[7], id="a"), dict(by_n[1], id="b"), dict(by_n[13], id="c"), dict(by_n[8], id="d")], "c", "きょう帰る。",
        "「帰る」的「る」前面是え段，看似二類，其實是一類。", "「帰る」（かえる）是一類（看似二類）。", ["g-n5-12-06"]))
    rq.append(rq_choice("第七行「いま入る。」的動詞是「入る」（はいる），它屬於哪一類？", GROUP_OPTS, "a", "一類（五段）",
        "「入る」的「る」前面是い段，看似二類，但屬於例外，是一類。", "「入る」（はいる）是一類（看似二類）。", ["g-n5-12-06"]))
    rq.append(rq_choice("第十一行「わたしはあした来る。」的「は」，應該怎樣讀？",
        [txt("a", "わ"), txt("b", "は"), txt("c", "ば"), txt("d", "ぱ")], "a", "わ",
        "作為助詞的「は」讀作「わ」。", "「わたしは」讀作「わたしわ」；這個「は」是主題助詞。", ["g-n5-12-01"], kind="story-particle"))
    rq.append(q_match(["g-n5-12-02"], None, [(7, "二類"), (6, "三類"), (11, "一類"), (13, "一類")],
        "請把故事中的動詞與類別配對。", "二類＝以「る」結尾且前面是い段或え段（非例外）；三類＝する・来る；其餘是一類。",
        "おきる＝二類；くる＝三類；かう＝一類；かえる＝一類（看似二類）。", kind="match-verb-group"))
    rq[-1]["lesson"] = None

    # listening of story
    def sl(g, item, prompt, options, ans, reveal, rule, expl, kind):
        return q_listen(g, None, item, prompt, options, ans, reveal, rule, expl, kind=kind)
    sl_list = []
    sl_list.append(sl(["g-n5-12-04"], by_n[4], "請聽故事中的一句，選出這句話的意思。",
        [txt("a", "稍微看一下。"), txt("b", "稍等一下。"), txt("c", "稍微說幾句。"), txt("d", "稍微做一下。")], "a", by_n[4],
        "先抓住動詞：み・る＝看。", "聽到「ちょっとみる」，意思是「稍微看一下」。", "listen-sentence-meaning"))
    sl_list.append(q_listen(["g-n5-12-06"], None, by_n[13],
        "請看句子「きょう帰る。」（意思：今天回去），再聽音頻，判斷句中的動詞屬於哪一類。", GROUP_OPTS, "a", by_n[13],
        "「帰る」的「る」前面是え段，看似二類，但屬於例外，是一類。", "「帰る」（かえる）是一類（五段）動詞，只是看似二類。",
        kind="listen-group", stem=by_n[13], new_id="q-n5-12-061"))
    sl_list.append(sl(["g-n5-12-03"], by_n[6], "請聽故事中的一句，選出你聽到的句子（注意助詞「は」讀作「わ」）。",
        [sopt("a", 6), sopt("b", 11), sopt("c", 13), sopt("d", 10)], "a", by_n[6],
        "「わたしわ」的「わ」是助詞「は」的讀音。", "聽到「わたしわ　あした　くる」，是「わたしはあした来る。」",
        "listen-sentence"))
    sl_list[-1]["options"][0] = dict(by_n[6], id="a")
    sl_list[-1]["options"][1] = dict(by_n[10], id="b")
    sl_list[-1]["options"][2] = dict(by_n[13], id="c")
    sl_list[-1]["options"][3] = dict(by_n[4], id="d")
    sl_list[-1]["listeningNote"] = "（非長音題）確認 TTS 把助詞「は」讀作「わ」；若 TTS 以文字「は」輸入而讀成「は」，請使用 tts 欄位（已轉為「わ」）。"
    story_ = {
      "id": "st-n5-12", "title": "分辨我的一天的動詞",
      "intro": "以下是一份備忘錄，每一行都以動詞的辭書形結束。請逐行閱讀，找出動詞，並判斷它屬於哪一類。",
      "reading": {"id": "st-n5-12-r", "title": "讀：備忘錄裡的動詞", "lines": lines, "questions": rq,
                  "task": "閱讀每一行，找出動詞，並判斷類別（一類／二類／三類）。"},
      "speaking": {"id": "st-n5-12-s", "title": "說：朗讀與分類", "tasks": [
          {"id": "sp-n5-12-01", "prompt": "逐行朗讀備忘錄，每行讀兩次：第一次慢讀，第二次正常速度。", "targets": [l["id"] for l in lines],
           "selfCheck": ["是否清楚讀出每個動詞的最後一拍？", "「わたしは」的「は」是否讀作「わ」？"]},
          {"id": "sp-n5-12-02", "prompt": "看著每一行，先讀出動詞，再用中文說出它屬於哪一類。", "targets": [l["id"] for l in lines],
           "selfCheck": ["「帰る」「入る」是否說成「一類（看似二類）」？", "「する」「来る」是否說成三類？"]}],
        "note": "此部分為自我練習，不自動評分。"},
      "listening": {"id": "st-n5-12-l", "title": "聽：辨認句子與動詞類別", "questions": sl_list},
    }
    return story_

def quiz():
    q = []
    q.append(q_group(1, ["g-n5-12-04"], None))
    q.append(q_group(11, ["g-n5-12-05"], None))
    q.append(q_group(6, ["g-n5-12-03"], None))
    q.append(q_group(14, ["g-n5-12-06"], None))
    q.append(q_match(["g-n5-12-03", "g-n5-12-05", "g-n5-12-06"], None,
        [(6, "三類"), (8, "二類"), (12, "一類"), (13, "一類"), (5, "三類")],
        "請把動詞與它所屬的類別配對。", "三類只有する・来る；二類是以る結尾且前面是い段或え段（非例外）；其餘是一類。",
        "くる・する＝三類；ねる＝二類；まつ・かえる＝一類。", kind="match-verb-group"))
    q.append(q_fill(["g-n5-12-04"], None, 10, 2, ["か", "け", "く", "こ"], 1,
        "二類動詞「る」前面是い段或え段，所以應填え段的「け」。", "「で・か・け・る」（出かける）的「る」前面是「け」，屬於え段。"))
    r = q_reorder(["g-n5-12-01"], None, ["行く", "あした", "は", "わたし"], ["わたし", "は~", "あした", "行く/いく", "。"],
        "我明天去。", "助詞「は」接在主題之後，辭書形放在句末。", "正確順序：わたしは　あした　行く。")
    r["pieces"] = [{"id": "p1", "text": "行く", "fragment": True}, {"id": "p2", "text": "あした", "fragment": True},
                   {"id": "p3", "text": "は", "fragment": True, "particle": True}, {"id": "p4", "text": "わたし", "fragment": True}]
    r["answerOrder"] = ["p4", "p3", "p2", "p1"]; r["answerDisplay"] = "わたしはあした行く。"
    q.append(r)
    q.append(q_meaning(15, [2, 3, 12], ["g-n5-12-05"], None, [3, 0, 1, 2]))
    q.append({"id": qid(), "type": "choice", "kind": "concept", "lesson": None, "grammar": ["g-n5-12-05"],
        "prompt": "辭書形「不是以『る』結尾」的動詞，屬於哪一類？", "stem": None,
        "options": [txt("a", "二類"), txt("b", "三類"), txt("c", "一類"), txt("d", "無法判斷")],
        "shuffle": False, "answer": "c", "answerDisplay": "一類",
        "rule": "辭書形若不是以「る」結尾，就必定是一類動詞。", "explanation": "二類與三類動詞的辭書形都以「る」結尾，所以不以「る」結尾的只能是一類。", "source": "new"})
    q.append({"id": qid(), "type": "choice", "kind": "dictionary-form", "lesson": None, "grammar": ["g-n5-12-01"],
        "prompt": "下列哪一個不是動詞的辭書形（最後一個假名不屬於う段）？", "stem": None,
        "options": [dict(id="a", ja="飲む", reading="のむ", zh="喝；飲用", tts="のむ", particles=[], wordId=wid(2)),
                    dict(id="b", ja="のま", reading="のま", zh="（不是辭書形）", tts="のま", particles=[], nonWord=True),
                    dict(id="c", ja="待つ", reading="まつ", zh="等待", tts="まつ", particles=[], wordId=wid(12)),
                    dict(id="d", ja="食べる", reading="たべる", zh="吃", tts="たべる", particles=[], wordId=wid(1))],
        "shuffle": False, "answer": "b", "answerDisplay": "のま",
        "rule": "辭書形的最後一個假名一定屬於う段。", "explanation": "「ま」屬於あ段，不屬於う段，所以「のま」不是辭書形。", "source": "new"})
    # listening
    q.append(q_listen(["g-n5-12-05"], None, V(12), "請聽音頻，選出你聽到的動詞。",
        [lopt("a", 11), lopt("b", 12), lopt("c", 15), lopt("d", 3)], "b", V(12),
        "「ま・つ」＝等待。", "聽到「まつ」，是「待つ」。「かう」「はなす」「いく」的第一個音不同。"))
    q.append(q_listen(["g-n5-12-02"], None, {"tts": "おばあさん"}, "（長音複習）請聽音頻，選出詞語的意思。",
        [txt("a", "叔伯姑姨輩的女性（阿姨）"), txt("b", "祖母；老婆婆")], "b",
        {"ja": "おばあさん", "reading": "おばあさん", "zh": "祖母；老婆婆", "tts": "おばあさん", "particles": []},
        "有長音「ばあ」的是「おばあさん」；沒有長音的「おばさん」指阿姨。", "聽到「お・ばあ・さん」，有長音，是「おばあさん」（祖母）。",
        kind="listen-long-vowel-review", real=True,
        note="檢查：（1）iPhone 語音是否把「ばあ」的「あ」拉長，與「おばさん」有明顯差別；（2）「ば」是否清晰的濁音。與第 2 課聆聽題為同一組詞，請在真機上一併測試。"))
    q.append(q_listen(["g-n5-12-02"], None, V(8), "請聽音頻，判斷這個動詞屬於哪一類。",
        GROUP_OPTS, "b", V(8),
        "「ねる」以「る」結尾，前面的「ね」屬於え段，是二類。", "聽到「ねる」，是「寝る」，屬於二類動詞。", kind="listen-group"))
    return {"id": "qz-n5-12", "title": "單元 12 小測", "passRate": 0.8, "questions": q,
            "note": "全部題目只使用單元 1–11 及本單元已教的詞彙與文法。"}

def fill_zh(o, zhmap):
    if isinstance(o, dict):
        if "ja" in o and "reading" in o and "zh" not in o and not o.get("fragment") and not o.get("blank"):
            if o["reading"] in zhmap: o["zh"] = zhmap[o["reading"]]
        for v in o.values(): fill_zh(v, zhmap)
    elif isinstance(o, list):
        for v in o: fill_zh(v, zhmap)

def main():
    lessons = build()
    t = tips()
    st = story()
    qz = quiz()
    ui = {"check": "確認", "continue": "繼續", "correctAnswer": "正確答案", "rule": "規則",
          "correct": "答對了", "incorrect": "答錯了", "slow": "慢速", "normal": "正常速度",
          "showReading": "顯示讀音", "tipsCard": "學習小貼士", "lessonN": "第 {n} 課", "storyRead": "讀",
          "storySpeak": "說", "storyListen": "聽", "prerequisiteHint": "建議先完成：{name}", "quiz": "小測",
          "group1": "一類（五段）", "group2": "二類（一段）", "group3": "三類（不規則）",
          "bookmark": "加入書籤", "retry": "再試一次", "newWords": "新詞", "review": "複習"}
    grammar_index = [g["id"] for l in lessons for g in l["grammar"]["points"]]
    unit = {
      "schemaVersion": "unit-v1-pilot",
      "id": "u-n5-12", "level": "N5", "number": 12,
      "title": "動詞入門：辭書形與三類動詞", "theme": "辭書形與三類",
      "prerequisites": ["u-n5-11"],
      "ttsConvention": "tts 欄位為發音文字：助詞「は／へ／を」轉為「わ／え／お」；詞語本身的「は／へ」保持原樣；助詞位置記錄於 particles。",
      "markup": "文字內 **粗體** 表示重點（橙色）；反引號 `…` 表示公式／標籤（淺底）。",
      "ui": ui,
      "grammarIndex": grammar_index,
      "lessons": lessons,
      "tips": t,
      "story": st,
      "quiz": qz,
    }
    def fix_answers(o):
        if isinstance(o, dict):
            if o.get("type") == "reorder": o["answer"] = list(o["answerOrder"])
            for v in o.values(): fix_answers(v)
        elif isinstance(o, list):
            for v in o: fix_answers(v)
    fix_answers(unit)
    zhmap = {w[0]: w[2] for w in WORDS.values()}
    zhmap["きる"] = "切；剪"
    fill_zh(unit, zhmap)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(unit, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("written", OUT)

if __name__ == "__main__":
    main()
