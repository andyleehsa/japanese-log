#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const FILE_RE = /^lessons\/[A-Za-z0-9._-]+\.json$/;

function validateContent(rootDir) {
  const errors = [];
  const fail = (message) => errors.push(message);

  function readJson(rel) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) {
      fail(rel + ": file not found");
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch (err) {
      fail(rel + ": invalid JSON (" + err.message + ")");
      return null;
    }
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function assertKeys(obj, allowed, label) {
    Object.keys(obj).forEach((key) => {
      if (!allowed.includes(key)) fail(label + ': unknown field "' + key + '"');
    });
  }

  function assertString(value, label) {
    if (typeof value !== "string" || !value.trim()) fail(label + " must be a non-empty string");
  }

  function assertTags(value, label) {
    if (!Array.isArray(value) || value.length === 0) {
      fail(label + " must be a non-empty array of strings");
      return [];
    }
    value.forEach((tag, index) => {
      if (typeof tag !== "string" || !tag.trim()) fail(label + "[" + index + "] must be a non-empty string");
    });
    return value;
  }

  function optionalString(obj, key, label) {
    if (obj[key] == null) return;
    if (typeof obj[key] !== "string" || !obj[key].trim()) fail(label + "." + key + " must be a non-empty string");
  }

  function validAudio(url, label) {
    if (typeof url !== "string" || !url.trim()) {
      fail(label + " must be a non-empty string");
      return;
    }
    if (/^\s*javascript:/i.test(url) || url.includes("..")) fail(label + " is not a safe audio URL");
  }

  ["schema/lesson.schema.json", "schema/index.schema.json", "schema/attempts.schema.json", "schema/summary.schema.json"].forEach((rel) => {
    readJson(rel);
  });

  const index = readJson("content/index.json");
  if (!index) return errors;
  if (!isObject(index)) {
    fail("content/index.json must be an object");
    return errors;
  }
  assertKeys(index, ["schemaVersion", "lessons"], "content/index.json");
  if (index.schemaVersion !== 1) fail("content/index.json schemaVersion must be 1");
  if (!Array.isArray(index.lessons)) {
    fail("content/index.json lessons must be an array");
    return errors;
  }

  const seenIds = new Set();
  const seenQuestionIds = new Set();
  const lessonsDir = path.resolve(rootDir, "content", "lessons");

  index.lessons.forEach((item, indexNo) => {
    const label = "content/index.json lessons[" + indexNo + "]";
    if (!isObject(item)) {
      fail(label + " must be an object");
      return;
    }
    assertKeys(item, ["id", "title", "date", "file", "tags", "sample"], label);
    assertString(item.id, label + ".id");
    if (item.id && !ID_RE.test(item.id)) fail(label + ".id must match " + ID_RE);
    assertString(item.title, label + ".title");
    if (!DATE_RE.test(item.date || "")) fail(label + ".date must be YYYY-MM-DD");
    if (!FILE_RE.test(item.file || "")) fail(label + ".file must look like lessons/<id>.json");
    if (item.file && item.id && item.file !== "lessons/" + item.id + ".json") {
      fail(label + ".file must be lessons/" + item.id + ".json");
    }
    assertTags(item.tags, label + ".tags");
    if (item.sample != null && typeof item.sample !== "boolean") fail(label + ".sample must be boolean");
    if (item.id && seenIds.has(item.id)) fail(label + " duplicate lesson id " + item.id);
    if (item.id) seenIds.add(item.id);

    if (!item.file || !FILE_RE.test(item.file)) return;
    const abs = path.resolve(rootDir, "content", item.file);
    if (abs !== path.join(lessonsDir, path.basename(abs))) {
      fail(label + " file escapes content/lessons");
      return;
    }
    const lesson = readJson(path.join("content", item.file));
    if (!lesson) return;
    checkLesson(lesson, item, path.join("content", item.file));
  });

  function sortedTags(tags) {
    return JSON.stringify([].concat(tags || []).map(String).sort());
  }

  function checkLesson(lesson, item, rel) {
    if (!isObject(lesson)) {
      fail(rel + " must be an object");
      return;
    }
    assertKeys(lesson, ["id", "title", "date", "level", "tags", "teaching", "questions", "sample", "sampleNote"], rel);
    if (lesson.id !== item.id) fail(rel + ".id must match index id " + item.id);
    if (lesson.title !== item.title) fail(rel + ".title must match index title");
    if (lesson.date !== item.date) fail(rel + ".date must match index date");
    assertString(lesson.level, rel + ".level");
    const tags = assertTags(lesson.tags, rel + ".tags");
    if (sortedTags(tags) !== sortedTags(item.tags)) fail(rel + ".tags must match index tags");
    if (lesson.sample != null && typeof lesson.sample !== "boolean") fail(rel + ".sample must be boolean");
    if (item.sample != null && lesson.sample !== item.sample) fail(rel + ".sample must match index");
    optionalString(lesson, "sampleNote", rel);
    if (!Array.isArray(lesson.teaching) || lesson.teaching.length === 0) fail(rel + ".teaching must be a non-empty array");
    else lesson.teaching.forEach((block, blockNo) => checkBlock(block, rel + " teaching[" + blockNo + "]"));
    if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) fail(rel + ".questions must be a non-empty array");
    else lesson.questions.forEach((question, questionNo) => checkQuestion(question, lesson, rel + " questions[" + questionNo + "]"));
  }

  function checkBlock(block, label) {
    if (!isObject(block)) {
      fail(label + " must be an object");
      return;
    }
    if (block.type === "heading" || block.type === "paragraph" || block.type === "tip") {
      assertKeys(block, ["type", "text", "speak", "audio"], label);
      assertString(block.text, label + ".text");
    } else if (block.type === "vocab") {
      assertKeys(block, ["type", "caption", "items"], label);
      optionalString(block, "caption", label);
      if (!Array.isArray(block.items) || block.items.length === 0) fail(label + ".items must be a non-empty array");
      else block.items.forEach((row, rowNo) => {
        const rowLabel = label + ".items[" + rowNo + "]";
        if (!isObject(row)) {
          fail(rowLabel + " must be an object");
          return;
        }
        assertKeys(row, ["word", "reading", "meaning", "speak"], rowLabel);
        assertString(row.word, rowLabel + ".word");
        assertString(row.reading, rowLabel + ".reading");
        assertString(row.meaning, rowLabel + ".meaning");
        optionalString(row, "speak", rowLabel);
      });
    } else if (block.type === "example") {
      assertKeys(block, ["type", "jp", "reading", "zh", "speak", "note", "audio"], label);
      assertString(block.jp, label + ".jp");
      assertString(block.zh, label + ".zh");
      optionalString(block, "reading", label);
      optionalString(block, "note", label);
    } else {
      fail(label + '.type "' + block.type + '" is not supported');
      return;
    }
    optionalString(block, "speak", label);
    if (block.audio != null) validAudio(block.audio, label + ".audio");
  }

  function checkQuestion(question, lesson, label) {
    if (!isObject(question)) {
      fail(label + " must be an object");
      return;
    }
    const common = ["id", "type", "prompt", "explanation", "tags", "speak", "audio", "hint"];
    assertString(question.id, label + ".id");
    if (question.id && !ID_RE.test(question.id)) fail(label + ".id must match " + ID_RE);
    if (question.id && lesson.id && !question.id.startsWith(lesson.id + "-")) {
      fail(label + ".id must start with " + lesson.id + "-");
    }
    if (question.id && seenQuestionIds.has(question.id)) fail(label + " duplicate question id " + question.id);
    if (question.id) seenQuestionIds.add(question.id);
    assertString(question.prompt, label + ".prompt");
    assertString(question.explanation, label + ".explanation");
    assertTags(question.tags, label + ".tags");
    optionalString(question, "speak", label);
    optionalString(question, "hint", label);
    if (question.audio != null) validAudio(question.audio, label + ".audio");

    if (question.type === "choice") {
      assertKeys(question, common.concat(["choices", "answer"]), label);
      checkChoices(question, label);
    } else if (question.type === "fill") {
      assertKeys(question, common.concat(["accepted"]), label);
      checkAccepted(question, label);
      if (typeof question.prompt === "string" && !question.prompt.includes("___")) {
        fail(label + '.prompt must include the blank marker "___"');
      }
    } else if (question.type === "listening") {
      assertKeys(question, common.concat(["choices", "answer", "accepted"]), label);
      if (!question.speak && !question.audio) fail(label + " needs speak or audio");
      const hasChoices = Array.isArray(question.choices);
      const hasAccepted = Array.isArray(question.accepted);
      if (hasChoices === hasAccepted) fail(label + " must use either choices+answer or accepted, not both");
      if (hasChoices) checkChoices(question, label);
      if (hasAccepted) {
        checkAccepted(question, label);
        if (typeof question.prompt === "string" && !question.prompt.includes("___")) {
          fail(label + '.prompt must include the blank marker "___"');
        }
      }
    } else {
      fail(label + '.type "' + question.type + '" is not supported');
    }
  }

  function checkChoices(question, label) {
    if (!Array.isArray(question.choices) || question.choices.length < 2) {
      fail(label + ".choices must contain at least 2 strings");
      return;
    }
    question.choices.forEach((choice, choiceNo) => assertString(choice, label + ".choices[" + choiceNo + "]"));
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) {
      fail(label + ".answer must be an index into choices");
    }
  }

  function checkAccepted(question, label) {
    if (!Array.isArray(question.accepted) || question.accepted.length === 0) {
      fail(label + ".accepted must be a non-empty array");
      return;
    }
    question.accepted.forEach((answer, answerNo) => assertString(answer, label + ".accepted[" + answerNo + "]"));
  }

  return errors;
}

if (require.main === module) {
  const errors = validateContent(path.join(__dirname, ".."));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("content ok");
}

module.exports = { validateContent };
