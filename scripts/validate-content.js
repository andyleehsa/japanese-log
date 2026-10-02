#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HARD_CHARS = "嘅咗唔喺啲嘢冇俾佢哋咁嚟睇嗰啱乜𠵼咩嚿呢㗎喎囉噉揀掣撳仲";
const HARD_WORDS = ["點解", "邊個", "而家", "邊度", "幾多", "點樣", "好似", "係"];
const SOFT_WORDS = ["同埋", "返去", "返回", "不用", "幫手", "同"];
const PART = { "は": "わ", "へ": "え", "を": "お" };
const ID_PATTERNS = {
  u: /^u-n\d-\d{2}$/,
  l: /^l-n\d-\d{2}-\d$/,
  g: /^g-n\d-\d{2}-\d{2}$/,
  w: /^w-n\d-\d{2}-\d{3}$/,
  q: /^q-n\d-\d{2}-\d{3}$/,
  e: /^e-n\d-\d{2}-\d{3}$/,
  s: /^s-n\d-\d{2}-\d{3}$/,
  st: /^st-n\d-\d{2}(-[rsl])?$/,
  sp: /^sp-n\d-\d{2}-\d{2}$/,
  qz: /^qz-n\d-\d{2}$/,
  tip: /^tip-n\d-\d{2}(-\w+)?$/,
  tbl: /^tbl-n\d-\d{2}-\d+$/
};
const LOCAL_KEYS = { options: true, left: true, right: true, pieces: true, nodes: true, edges: true };
const ROOT = path.join(__dirname, "..");

function prefix(id) {
  const match = /^([a-z]+)-/.exec(id);
  return match ? match[1] : null;
}

function isHira(value) {
  return /^[ぁ-ゟー。、！？「」・…＿\s]*$/.test(value);
}

function rstripPeriod(value) {
  let out = String(value);
  while (out.endsWith("。")) out = out.slice(0, -1);
  return out;
}

function walk(node, visit, nodePath, underLocal) {
  const here = nodePath || "$";
  const local = !!underLocal;
  visit(here, node, local);
  if (Array.isArray(node)) {
    node.forEach(function (child, index) {
      walk(child, visit, here + "[" + index + "]", local);
    });
    return;
  }
  if (node && typeof node === "object") {
    Object.keys(node).forEach(function (key) {
      walk(node[key], visit, here + "." + key, local || !!LOCAL_KEYS[key]);
    });
  }
}

function checkUnit(data) {
  const errors = [];
  const warns = [];
  function err(at, message) { errors.push(at + ": " + message); }
  function warn(at, message) { warns.push(at + ": " + message); }
  const unit = data || {};
  ["schemaVersion", "id", "level", "number", "title", "theme", "prerequisites", "lessons", "tips", "story", "quiz", "grammarIndex"].forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(unit, key)) err("$", "missing unit field " + key);
  });
  const seen = {};
  walk(unit, function (nodePath, node, local) {
    if (!node || typeof node !== "object" || Array.isArray(node) || local || !Object.prototype.hasOwnProperty.call(node, "id")) return;
    const id = node.id;
    if (typeof id !== "string") {
      err(nodePath, "id not string");
      return;
    }
    const kind = prefix(id);
    if (!ID_PATTERNS[kind]) {
      err(nodePath, "unknown id prefix " + id);
      return;
    }
    if (!ID_PATTERNS[kind].test(id)) err(nodePath, "bad id format " + id);
    seen[id] = (seen[id] || 0) + 1;
  });
  Object.keys(seen).forEach(function (id) {
    if (seen[id] > 1) err("ids", "duplicate id " + id + " x" + seen[id]);
  });
  const defined = {};
  (unit.lessons || []).forEach(function (lesson) {
    ["id", "number", "title", "prerequisites", "vocab", "grammar", "exercises", "listening"].forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(lesson, key)) err(lesson.id || "lesson", "missing lesson field " + key);
    });
    const points = lesson.grammar && lesson.grammar.points ? lesson.grammar.points : [];
    if (points.length < 1 || points.length > 2) err(lesson.id, "grammar points must be 1-2, got " + points.length);
    points.forEach(function (point) {
      if (point && point.id) defined[point.id] = true;
      ["id", "title", "blocks"].forEach(function (key) {
        if (!point || !Object.prototype.hasOwnProperty.call(point, key)) err((point && point.id) || "grammar", "missing " + key);
      });
    });
    const vocabCount = (lesson.vocab || []).length;
    if (vocabCount < 5 || vocabCount > 6) warn(lesson.id, "new vocab count " + vocabCount + " (target 5-6)");
    (lesson.vocab || []).forEach(function (word) {
      ["id", "kana", "reading", "zh", "tts", "particles", "group"].forEach(function (key) {
        if (!word || !Object.prototype.hasOwnProperty.call(word, key)) err((word && word.id) || "vocab", "missing vocab field " + key);
      });
      if (!word || ["一類", "二類", "三類"].indexOf(word.group) === -1) err(word && word.id, "bad group");
    });
  });
  const indexed = {};
  (unit.grammarIndex || []).forEach(function (id) { indexed[id] = true; });
  const definedIds = Object.keys(defined).sort();
  const indexIds = Object.keys(indexed).sort();
  if (definedIds.join("\n") !== indexIds.join("\n")) {
    err("grammarIndex", "grammarIndex " + JSON.stringify(indexIds) + " != defined " + JSON.stringify(definedIds));
  }
  const questionIds = [];
  let listeningCount = 0;
  let realDeviceCount = 0;
  walk(unit, function (nodePath, node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    if (!("prompt" in node) || !("type" in node) || !("answer" in node)) return;
    questionIds.push(node.id);
    if (!String(node.id || "").startsWith("q-")) err(nodePath, "question id format");
    if (!Array.isArray(node.grammar) || !node.grammar.length) err(node.id, "grammar tag missing");
    else node.grammar.forEach(function (tag) {
      if (!defined[tag]) err(node.id, "grammar tag " + tag + " not defined");
    });
    ["rule", "explanation", "answerDisplay", "source"].forEach(function (key) {
      if (!node[key]) err(node.id, "missing " + key);
    });
    if (String(node.source || "").startsWith("reused") && !node.sourceRef) err(node.id, "reused without sourceRef");
    if (node.type === "listen-choice") {
      listeningCount += 1;
      if (!("needsRealDeviceCheck" in node)) err(node.id, "listening needs needsRealDeviceCheck");
      if (node.needsRealDeviceCheck) {
        realDeviceCount += 1;
        if (!node.listeningNote) err(node.id, "needsRealDeviceCheck without listeningNote");
      }
      if (!node.audio || !node.audio.ttsText) err(node.id, "listening without audio.ttsText");
      if (!node.reveal) err(node.id, "listening without reveal");
    }
    if (node.type === "choice" || node.type === "listen-choice" || node.type === "fill") {
      const ids = (node.options || []).map(function (option) { return option.id; });
      if (ids.indexOf(node.answer) === -1) err(node.id, "answer not in options");
      else {
        const chosen = node.options.filter(function (option) { return option.id === node.answer; })[0];
        if ("ja" in chosen && !String(node.answerDisplay).startsWith(rstripPeriod(chosen.ja))) {
          err(node.id, "answerDisplay " + JSON.stringify(node.answerDisplay) + " does not match answer option " + JSON.stringify(chosen.ja));
        }
        if ("text" in chosen && node.type === "choice" && chosen.text !== node.answerDisplay && !(node.kind === "verb-group" && String(node.answerDisplay).startsWith(String(chosen.text).slice(0, 2)))) {
          err(node.id, "answerDisplay " + JSON.stringify(node.answerDisplay) + " != answer option text " + JSON.stringify(chosen.text));
        }
      }
      if (ids.length !== new Set(ids).size) err(node.id, "dup option ids");
    }
  });
  const questionCounts = {};
  questionIds.forEach(function (id) { questionCounts[id] = (questionCounts[id] || 0) + 1; });
  const duplicateQuestions = Object.keys(questionCounts).filter(function (id) { return questionCounts[id] > 1; });
  if (duplicateQuestions.length) err("questions", "duplicate question ids " + duplicateQuestions.join(","));
  walk(unit, function (nodePath, node) {
    if (!node || typeof node !== "object" || Array.isArray(node) || !("ja" in node) || !("reading" in node)) return;
    if (node.fragment) return;
    const reading = node.reading;
    if (!isHira(reading)) err(nodePath, "reading not hiragana: " + JSON.stringify(reading));
    if (!("zh" in node) && !node.blank) err(nodePath, "Japanese item without zh: " + JSON.stringify(node.ja));
    if (!("particles" in node)) err(nodePath, "missing particles key: " + JSON.stringify(node.ja));
    if (node.tts == null) {
      if (!node.blank) err(nodePath, "missing tts");
      return;
    }
    const expected = String(reading).split("");
    (node.particles || []).forEach(function (particle) {
      const index = particle.index;
      if (String(reading).slice(index, index + 1) !== particle.surface) err(nodePath, "particle index mismatch in " + JSON.stringify(reading));
      else expected[index] = PART[particle.surface];
    });
    if (expected.join("") !== node.tts) {
      err(nodePath, "tts " + JSON.stringify(node.tts) + " != expected " + JSON.stringify(expected.join("")) + " (reading " + JSON.stringify(reading) + ")");
    }
    if (String(node.tts).indexOf("を") !== -1) err(nodePath, "tts still contains を: " + JSON.stringify(node.tts));
    if (String(reading).indexOf("を") !== -1 && !(node.particles || []).some(function (particle) { return particle.surface === "を"; })) {
      err(nodePath, "を not declared as particle");
    }
  });
  const hits = [];
  walk(unit, function (nodePath, node) {
    const strings = [];
    if (typeof node === "string") strings.push(node);
    if (node && typeof node === "object" && !Array.isArray(node)) strings.push.apply(strings, Object.keys(node));
    strings.forEach(function (value) {
      Array.from(value).forEach(function (character) {
        if (HARD_CHARS.indexOf(character) !== -1) hits.push([nodePath, character, value.slice(0, 30)]);
      });
      HARD_WORDS.forEach(function (word) {
        if (word === "係") {
          for (let i = 0; i < value.length; i++) {
            if (value[i] === "係" && value.slice(Math.max(0, i - 1), i) !== "關") hits.push([nodePath, "係", value.slice(0, 30)]);
          }
        } else if (value.indexOf(word) !== -1) hits.push([nodePath, word, value.slice(0, 30)]);
      });
      SOFT_WORDS.forEach(function (word) {
        let from = 0;
        while (from < value.length) {
          const at = value.indexOf(word, from);
          if (at === -1) break;
          const next = value.slice(at + word.length, at + word.length + 1);
          const prev = value.slice(Math.max(0, at - 1), at);
          if (!(word === "同" && ("樣時步一".indexOf(next) !== -1 || "不相".indexOf(prev) !== -1))) {
            warn(nodePath, "check word " + JSON.stringify(word) + " in " + JSON.stringify(value.slice(0, 40)));
          }
          from = at + word.length;
        }
      });
    });
  });
  hits.forEach(function (hit) {
    err("colloquial", hit[0] + " found " + JSON.stringify(hit[1]) + " in " + JSON.stringify(hit[2]) + " at " + hit[0]);
  });
  return {
    errors: errors,
    warnings: warns,
    stats: {
      lessons: (unit.lessons || []).length,
      grammarPoints: Object.keys(defined).length,
      vocab: (unit.lessons || []).reduce(function (sum, lesson) { return sum + (lesson.vocab || []).length; }, 0),
      questions: new Set(questionIds).size,
      listeningQuestions: listeningCount,
      needsRealDeviceCheck: realDeviceCount,
      colloquialHits: hits.length
    }
  };
}

function checkIndex(index, readUnit) {
  const errors = [];
  const warnings = [];
  function err(at, message) { errors.push(at + ": " + message); }
  if (!index || !Array.isArray(index.units)) {
    err("$", "units-index missing units array");
    return { errors: errors, warnings: warnings };
  }
  const ids = {};
  index.units.forEach(function (unit, position) {
    const at = unit && unit.id ? unit.id : "units[" + position + "]";
    ["id", "level", "number", "title", "lessonCount", "prerequisites", "status", "file"].forEach(function (key) {
      if (!unit || !Object.prototype.hasOwnProperty.call(unit, key)) err(at, "missing index field " + key);
    });
    if (!unit) return;
    if (ids[unit.id]) err(at, "duplicate unit id");
    ids[unit.id] = true;
    if (unit.status !== "ready" && unit.status !== "planned") err(at, "status must be ready or planned");
    if (!Number.isInteger(unit.lessonCount) || unit.lessonCount < 1) err(at, "lessonCount must be a positive integer");
    if (unit.status === "planned" && unit.file != null) err(at, "planned unit should not have a file");
    if (unit.status === "ready" && typeof unit.file !== "string") err(at, "ready unit missing file");
  });
  index.units.forEach(function (unit) {
    (unit.prerequisites || []).forEach(function (id) {
      if (!ids[id]) err(unit.id, "unknown prerequisite " + id);
    });
    if (unit.status !== "ready") return;
    let data = null;
    try {
      data = readUnit(unit.file);
    } catch (err) {
      errors.push(unit.id + ": cannot read " + unit.file + " (" + err.message + ")");
      return;
    }
    if (!data || data.id !== unit.id) err(unit.id, "file id does not match index");
    const lessons = data && Array.isArray(data.lessons) ? data.lessons : [];
    if (lessons.length !== unit.lessonCount) {
      err(unit.id, "lessonCount " + unit.lessonCount + " != file lessons " + lessons.length);
    }
    const report = checkUnit(data);
    report.errors.forEach(function (message) { errors.push(unit.file + " " + message); });
    report.warnings.forEach(function (message) { warnings.push(unit.file + " " + message); });
  });
  return { errors: errors, warnings: warnings };
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const indexPath = path.join(ROOT, "content", "units-index.json");
  const index = loadJson(indexPath);
  const report = checkIndex(index, function (file) {
    if (!file || file.indexOf("..") !== -1 || file.indexOf("/") !== -1) throw new Error("bad file name");
    return loadJson(path.join(ROOT, "content", "units", file));
  });
  const ready = (index.units || []).filter(function (unit) { return unit.status === "ready"; }).length;
  console.log("INDEX units=" + (index.units || []).length + " ready=" + ready);
  report.warnings.forEach(function (message) { console.log("WARN " + message); });
  report.errors.forEach(function (message) { console.log("ERROR " + message); });
  console.log("RESULT " + (report.errors.length ? "FAIL" : "PASS") + " (" + report.errors.length + " errors, " + report.warnings.length + " warnings)");
  return report.errors.length ? 1 : 0;
}

module.exports = { checkUnit: checkUnit, checkIndex: checkIndex };

if (require.main === module) process.exit(main());
