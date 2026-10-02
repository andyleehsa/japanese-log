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

  ["schema/lesson.schema.json", "schema/index.schema.json", "schema/attempts.schema.json", "schema/summary.schema.json", "schema/curriculum.schema.json", "schema/vocab.schema.json", "schema/vocab-log.schema.json"].forEach((rel) => {
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
  const sampleLessonIds = new Set();
  const seenQuestionIds = new Set();
  const lessonTopics = new Map();
  const lessonsDir = path.resolve(rootDir, "content", "lessons");
  const HIRAGANA_RE = /^[\u3040-\u309f\u30fc\s]+$/;
  const READING_RE = /^[\u3040-\u30ff\u30fc\s、。！？]+$/;
  const VERB_GROUPS = ["一類", "二類", "三類"];
  const VERB_FORMS = ["ます形", "て形", "ない形", "た形"];

  index.lessons.forEach((item, indexNo) => {
    const label = "content/index.json lessons[" + indexNo + "]";
    if (!isObject(item)) {
      fail(label + " must be an object");
      return;
    }
    assertKeys(item, ["id", "title", "date", "file", "tags", "topics", "sample"], label);
    assertString(item.id, label + ".id");
    if (item.id && !ID_RE.test(item.id)) fail(label + ".id must match " + ID_RE);
    assertString(item.title, label + ".title");
    if (!DATE_RE.test(item.date || "")) fail(label + ".date must be YYYY-MM-DD");
    if (!FILE_RE.test(item.file || "")) fail(label + ".file must look like lessons/<id>.json");
    if (item.file && item.id && item.file !== "lessons/" + item.id + ".json") {
      fail(label + ".file must be lessons/" + item.id + ".json");
    }
    assertTags(item.tags, label + ".tags");
    lessonTopics.set(item.id, assertIdList(item.topics, label + ".topics", true));
    if (item.sample != null && typeof item.sample !== "boolean") fail(label + ".sample must be boolean");
    if (item.sample === true && item.id) sampleLessonIds.add(item.id);
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
    assertKeys(lesson, ["id", "title", "date", "level", "tags", "topics", "teaching", "questions", "sample", "sampleNote"], rel);
    if (lesson.id !== item.id) fail(rel + ".id must match index id " + item.id);
    if (lesson.title !== item.title) fail(rel + ".title must match index title");
    if (lesson.date !== item.date) fail(rel + ".date must match index date");
    assertString(lesson.level, rel + ".level");
    const tags = assertTags(lesson.tags, rel + ".tags");
    if (sortedTags(tags) !== sortedTags(item.tags)) fail(rel + ".tags must match index tags");
    const lessonTopicIds = assertIdList(lesson.topics, rel + ".topics", true);
    if (sortedTags(lessonTopicIds) !== sortedTags(lessonTopics.get(item.id) || [])) {
      fail(rel + ".topics must match index topics");
    }
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
      assertKeys(block, ["type", "jp", "reading", "zh", "speak", "note", "audio", "verified"], label);
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
    checkVerified(block, label);
  }

  function checkVerified(obj, label) {
    if (obj.verified == null) return;
    if (typeof obj.verified !== "boolean") fail(label + ".verified must be boolean");
  }

  function checkVocabExample(example, label, readingOptional) {
    if (!isObject(example)) {
      fail(label + " must be an object");
      return;
    }
    assertKeys(example, ["jp", "reading", "zh", "verified"], label);
    assertString(example.jp, label + ".jp");
    assertString(example.zh, label + ".zh");
    if (!readingOptional || example.reading != null) assertString(example.reading, label + ".reading");
    if (typeof example.reading === "string" && example.reading && !READING_RE.test(example.reading)) {
      fail(label + ".reading must be kana");
    }
    checkVerified(example, label);
  }

  function checkQuestion(question, lesson, label) {
    if (!isObject(question)) {
      fail(label + " must be an object");
      return;
    }
    const common = ["id", "type", "prompt", "explanation", "tags", "speak", "audio", "hint", "example"];
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
    if (question.example != null) checkVocabExample(question.example, label + ".example", true);

    if (question.type === "choice") {
      assertKeys(question, common.concat(["choices", "answer", "kind", "rule", "verb", "reading", "form"]), label);
      checkChoices(question, label);
      checkVerbChoice(question, label);
    } else if (question.type === "fill") {
      assertKeys(question, common.concat(["accepted"]), label);
      checkAccepted(question, label);
      if (typeof question.prompt === "string" && !question.prompt.includes("___")) {
        fail(label + '.prompt must include the blank marker "___"');
      }
    } else if (question.type === "listening") {
      assertKeys(question, common.concat(["choices", "answer", "accepted", "jp", "reading", "meaning"]), label);
      if (!question.speak && !question.audio) fail(label + " needs speak or audio");
      assertString(question.jp, label + ".jp");
      assertString(question.reading, label + ".reading");
      assertString(question.meaning, label + ".meaning");
      if (typeof question.prompt === "string" && question.jp && question.prompt.includes(question.jp)) {
        fail(label + ".prompt must not show the Japanese sentence before the answer");
      }
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

  function checkVerbChoice(question, label) {
    const verbFields = question.kind != null || question.rule != null || question.verb != null || question.reading != null || question.form != null;
    if (!verbFields) return;
    if (question.kind !== "verb-group" && question.kind !== "verb-form") {
      fail(label + ".kind must be verb-group or verb-form");
      return;
    }
    assertString(question.rule, label + ".rule");
    assertString(question.verb, label + ".verb");
    assertString(question.reading, label + ".reading");
    if (typeof question.reading === "string" && !HIRAGANA_RE.test(question.reading)) {
      fail(label + ".reading must be hiragana");
    }
    if (!Array.isArray(question.choices) || question.choices.length !== 4) {
      fail(label + ".choices must contain exactly 4 strings");
    }
    if (question.kind === "verb-form") {
      if (!VERB_FORMS.includes(question.form)) fail(label + ".form must be ます形, て形, ない形, or た形");
    } else if (question.form != null) {
      fail(label + ".form is only for kind verb-form");
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

  function assertIdList(value, label, optional) {
    if (value == null && optional) return [];
    if (!Array.isArray(value)) {
      fail(label + " must be an array of ids");
      return [];
    }
    value.forEach((id, index) => {
      if (typeof id !== "string" || !ID_RE.test(id)) fail(label + "[" + index + "] must be an id");
    });
    return value;
  }

  function checkCurriculum() {
    const curriculum = readJson("content/curriculum.json");
    if (!curriculum || !isObject(curriculum)) return;
    assertKeys(curriculum, ["schemaVersion", "sample", "completionAccuracy", "levels"], "content/curriculum.json");
    if (curriculum.schemaVersion !== 1) fail("content/curriculum.json schemaVersion must be 1");
    if (curriculum.sample != null && typeof curriculum.sample !== "boolean") fail("content/curriculum.json sample must be boolean");
    if (curriculum.completionAccuracy !== 0.7) fail("content/curriculum.json completionAccuracy must be 0.7");
    if (!Array.isArray(curriculum.levels)) {
      fail("content/curriculum.json levels must be an array");
      return;
    }
    const levelOrder = curriculum.levels.map((level) => level && level.level);
    if (JSON.stringify(levelOrder) !== JSON.stringify(["N5", "N4", "N3"])) {
      fail("content/curriculum.json levels must be N5, N4, N3 in that order");
    }
    const topicIds = new Set();
    const topicLessons = new Map();
    curriculum.levels.forEach((level, levelNo) => {
      const label = "content/curriculum.json levels[" + levelNo + "]";
      if (!isObject(level)) {
        fail(label + " must be an object");
        return;
      }
      assertKeys(level, ["level", "topics"], label);
      if (!["N5", "N4", "N3"].includes(level.level)) fail(label + ".level must be N5, N4, or N3");
      if (!Array.isArray(level.topics) || level.topics.length === 0) fail(label + ".topics must be a non-empty array");
      (level.topics || []).forEach((topic, topicNo) => {
        const topicLabel = label + ".topics[" + topicNo + "]";
        if (!isObject(topic)) {
          fail(topicLabel + " must be an object");
          return;
        }
        assertKeys(topic, ["id", "title", "description", "level", "lessonIds", "planned"], topicLabel);
        assertString(topic.id, topicLabel + ".id");
        if (topic.id && !ID_RE.test(topic.id)) fail(topicLabel + ".id must match " + ID_RE);
        if (topic.id && topicIds.has(topic.id)) fail(topicLabel + " duplicate topic id " + topic.id);
        if (topic.id) topicIds.add(topic.id);
        assertString(topic.title, topicLabel + ".title");
        assertString(topic.description, topicLabel + ".description");
        if (topic.level !== level.level) fail(topicLabel + ".level must match parent level");
        const lessonIds = assertIdList(topic.lessonIds, topicLabel + ".lessonIds", false);
        lessonIds.forEach((lessonId) => {
          if (!seenIds.has(lessonId)) fail(topicLabel + " lesson " + lessonId + " is not in content/index.json");
          if (!topicLessons.has(lessonId)) topicLessons.set(lessonId, []);
          topicLessons.get(lessonId).push(topic.id);
        });
        if (!Number.isInteger(topic.planned) || topic.planned < 1) fail(topicLabel + ".planned must be an integer >= 1");
        if (Number.isInteger(topic.planned) && topic.planned < lessonIds.length) {
          fail(topicLabel + ".planned must be at least the number of linked lessons");
        }
      });
    });
    seenIds.forEach((lessonId) => {
      const fromLesson = (lessonTopics.get(lessonId) || []).slice();
      const sample = sampleLessonIds.has(lessonId);
      const known = [];
      fromLesson.forEach((topicId) => {
        if (topicIds.has(topicId)) known.push(topicId);
        else if (!sample) fail("lesson " + lessonId + " topics includes unknown topic " + topicId);
      });
      known.sort();
      const fromCurriculum = (topicLessons.get(lessonId) || []).slice().sort();
      if (JSON.stringify(known) !== JSON.stringify(fromCurriculum)) {
        fail("lesson " + lessonId + " topics must match curriculum lessonIds both ways");
      }
    });
  }

  function checkVocab() {
    const entryIds = new Set();
    const categoryIds = new Set();
    ["n5", "n4", "n3"].forEach((slug) => {
      const rel = "content/vocab/" + slug + ".json";
      const bank = readJson(rel);
      if (!bank || !isObject(bank)) return;
      const level = slug.toUpperCase();
      assertKeys(bank, ["schemaVersion", "level", "sample", "categories"], rel);
      if (bank.schemaVersion !== 1) fail(rel + " schemaVersion must be 1");
      if (bank.level !== level) fail(rel + ".level must be " + level);
      if (bank.sample != null && typeof bank.sample !== "boolean") fail(rel + ".sample must be boolean");
      if (!Array.isArray(bank.categories)) {
        fail(rel + ".categories must be an array");
        return;
      }
      bank.categories.forEach((category, categoryNo) => {
        const label = rel + " categories[" + categoryNo + "]";
        if (!isObject(category)) {
          fail(label + " must be an object");
          return;
        }
        assertKeys(category, ["id", "title", "entries"], label);
        assertString(category.id, label + ".id");
        if (category.id && !ID_RE.test(category.id)) fail(label + ".id must match " + ID_RE);
        if (category.id && categoryIds.has(category.id)) fail(label + " duplicate category id " + category.id);
        if (category.id) categoryIds.add(category.id);
        assertString(category.title, label + ".title");
        if (!Array.isArray(category.entries)) {
          fail(label + ".entries must be an array");
          return;
        }
        category.entries.forEach((entry, entryNo) => {
          const entryLabel = label + ".entries[" + entryNo + "]";
          if (!isObject(entry)) {
            fail(entryLabel + " must be an object");
            return;
          }
          assertKeys(entry, ["id", "japanese", "reading", "meaning", "level", "category", "example", "tags", "speak", "verbGroup", "forms", "verified"], entryLabel);
          assertString(entry.id, entryLabel + ".id");
          if (entry.id && !ID_RE.test(entry.id)) fail(entryLabel + ".id must match " + ID_RE);
          if (entry.id && entryIds.has(entry.id)) fail(entryLabel + " duplicate vocab id " + entry.id);
          if (entry.id) entryIds.add(entry.id);
          assertString(entry.japanese, entryLabel + ".japanese");
          assertString(entry.reading, entryLabel + ".reading");
          if (typeof entry.reading === "string" && !HIRAGANA_RE.test(entry.reading)) {
            fail(entryLabel + ".reading must be hiragana");
          }
          assertString(entry.meaning, entryLabel + ".meaning");
          if (entry.level !== level) fail(entryLabel + ".level must be " + level);
          if (entry.category !== category.id) fail(entryLabel + ".category must match parent category id");
          optionalString(entry, "speak", entryLabel);
          checkVerified(entry, entryLabel);
          if (entry.tags != null) assertTags(entry.tags, entryLabel + ".tags");
          if (entry.verbGroup != null && !VERB_GROUPS.includes(entry.verbGroup)) {
            fail(entryLabel + ".verbGroup must be 一類, 二類, or 三類");
          }
          if (entry.forms != null) {
            if (!isObject(entry.forms)) fail(entryLabel + ".forms must be an object");
            else {
              assertKeys(entry.forms, VERB_FORMS, entryLabel + ".forms");
              VERB_FORMS.forEach((name) => {
                const form = entry.forms[name];
                const formLabel = entryLabel + ".forms." + name;
                if (!isObject(form)) {
                  fail(formLabel + " is required when forms is present");
                  return;
                }
                assertKeys(form, ["japanese", "reading"], formLabel);
                assertString(form.japanese, formLabel + ".japanese");
                assertString(form.reading, formLabel + ".reading");
                if (typeof form.reading === "string" && !HIRAGANA_RE.test(form.reading)) {
                  fail(formLabel + ".reading must be hiragana");
                }
              });
            }
          }
          if (entry.example != null) {
            if (!isObject(entry.example)) fail(entryLabel + ".example must be an object");
            else {
              checkVocabExample(entry.example, entryLabel + ".example", false);
            }
          }
        });
      });
    });
  }

  checkCurriculum();
  checkVocab();

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
