#!/usr/bin/env node
"use strict";

const assert = require("assert");
const logic = require("../js/logic");

assert.strictEqual(logic.normalizeAnswer(" は "), "は");
assert.strictEqual(logic.normalizeAnswer("Ａ１"), "A1");
assert.strictEqual(logic.normalizeAnswer("は\u3000は"), "はは");
assert.strictEqual(logic.answersMatch(" ハ ", ["は"]), false);
assert.strictEqual(logic.answersMatch("は", ["は"]), true);
assert.strictEqual(logic.answersMatch("", ["は"]), false);
assert.strictEqual(logic.answersMatch(" は ", ["は"]), true);

assert.strictEqual(logic.addDays("2026-01-31", 1), "2026-02-01");
assert.strictEqual(logic.addDays("2026-03-01", -1), "2026-02-28");
assert.strictEqual(logic.addDays("2024-02-28", 1), "2024-02-29");
assert.strictEqual(logic.addDays("2024-02-29", 1), "2024-03-01");

assert.strictEqual(logic.currentStreak(["2026-09-29", "2026-09-30", "2026-10-01"], "2026-10-01"), 3);
assert.strictEqual(logic.currentStreak(["2026-09-30", "2026-10-01"], "2026-10-02"), 2);
assert.strictEqual(logic.currentStreak(["2026-10-01"], "2026-10-03"), 0);
assert.strictEqual(logic.longestStreak(["2026-09-28", "2026-09-29", "2026-10-01"]), 2);
assert.strictEqual(logic.longestStreak([]), 0);

const first = { id: "a", timestamp: "2026-10-01T10:00:00+08:00", localDate: "2026-10-01" };
const second = { id: "b", timestamp: "2026-10-01T11:00:00+08:00", localDate: "2026-10-01" };
const rewritten = { id: "a", timestamp: "2026-10-02T10:00:00+08:00", userAnswer: "changed" };
const merged = logic.mergeAttempts([[first], [second, rewritten]]);
assert.strictEqual(merged.length, 2);
assert.strictEqual(merged[0].id, "a");
assert.strictEqual(merged[0].localDate, "2026-10-01");
assert.strictEqual(merged[1].id, "b");
assert.strictEqual(logic.mergeAttempts([[rewritten], [first]])[0].userAnswer, "changed");
assert.strictEqual(logic.mergeAttempts([[first, second], [second, first]]).length, 2);

const choice = {
  id: "day-001-q1",
  type: "choice",
  choices: ["我係學生。", "我係老師。"],
  answer: 0,
  tags: ["は"]
};
assert.strictEqual(logic.grade(choice, 0), true);
assert.strictEqual(logic.grade(choice, 1), false);
assert.strictEqual(logic.userAnswerText(choice, 0), "我係學生。");
assert.strictEqual(logic.correctAnswerText(choice), "我係學生。");

const verbGroup = {
  id: "day-001-q7",
  type: "choice",
  kind: "verb-group",
  choices: ["一類", "二類", "三類", "唔係動詞"],
  answer: 1
};
assert.strictEqual(logic.grade(verbGroup, 1), true);
assert.strictEqual(logic.grade(verbGroup, 0), false);
assert.strictEqual(logic.correctAnswerText(verbGroup), "二類");
const verbForm = {
  id: "day-001-q8",
  type: "choice",
  kind: "verb-form",
  choices: ["食べて", "食べた", "食べない", "食べます"],
  answer: 0
};
assert.strictEqual(logic.userAnswerText(verbForm, 1), "食べた");
assert.strictEqual(logic.examplePendingVerify({ jp: "水を飲む。", verified: false }), true);
assert.strictEqual(logic.examplePendingVerify({ jp: "水を飲む。", verified: true }), false);
assert.strictEqual(logic.examplePendingVerify({ jp: "水を飲む。" }), false);
assert.strictEqual(logic.examplePendingVerify(null), false);
assert.strictEqual(logic.entryPendingVerify({ verified: false }), true);
assert.strictEqual(logic.entryPendingVerify({ verified: true, example: { verified: false } }), false);
assert.strictEqual(logic.entryPendingVerify({ japanese: "参加する" }), false);
assert.strictEqual(logic.entryPendingVerify(null), false);

const fill = { id: "day-001-q2", type: "fill", accepted: ["は"], tags: ["は"] };
assert.strictEqual(logic.grade(fill, " は "), true);
assert.strictEqual(logic.grade(fill, "わ"), false);

const attempts = [
  { id: "1", questionId: "q1", lessonId: "day-001", tags: ["は"], userAnswer: "x", correct: false, timestamp: "2026-10-01T10:00:00+08:00", localDate: "2026-10-01", attemptNo: 1 },
  { id: "2", questionId: "q1", lessonId: "day-001", tags: ["は"], userAnswer: "は", correct: true, timestamp: "2026-10-01T10:05:00+08:00", localDate: "2026-10-01", attemptNo: 2 },
  { id: "3", questionId: "q2", lessonId: "day-001", tags: ["これ"], userAnswer: "x", correct: false, timestamp: "2026-10-02T10:00:00+08:00", localDate: "2026-10-02", attemptNo: 1 }
];
const stats = logic.computeStats(attempts, { today: "2026-10-02", lessonTitles: { "day-001": "題" } });
assert.strictEqual(stats.overall.attempts, 3);
assert.strictEqual(stats.overall.correct, 1);
assert.strictEqual(stats.streak.current, 2);
assert.strictEqual(stats.mistakes.length, 1);
assert.strictEqual(stats.mistakes[0].questionId, "q2");
assert.ok(stats.weakTags.some((tag) => tag.tag === "これ"));
assert.strictEqual(stats.perLesson[0].title, "題");
assert.strictEqual(logic.lessonProgress({ id: "day-001", questions: [{ id: "q1" }, { id: "q2" }] }, attempts).completed, true);
assert.strictEqual(logic.nextAttemptNo(attempts, "q1"), 3);

const stamped = logic.formatLocalTimestamp(new Date(2026, 9, 1, 8, 5, 6));
assert.strictEqual(stamped.localDate, "2026-10-01");
assert.ok(stamped.timestamp.startsWith("2026-10-01T08:05:06"));
assert.deepStrictEqual(Object.keys(logic.groupAttemptsByMonth(attempts)), ["2026-10"]);

const doneLesson = {
  id: "day-001",
  title: "は",
  questions: [{ id: "q1" }, { id: "q2" }]
};
const perfect = [
  { questionId: "q1", lessonId: "day-001", correct: true },
  { questionId: "q2", lessonId: "day-001", correct: true }
];
const mixed = [
  { questionId: "q1", lessonId: "day-001", correct: true },
  { questionId: "q1", lessonId: "day-001", correct: false },
  { questionId: "q2", lessonId: "day-001", correct: true }
];
assert.strictEqual(logic.lessonIsDone(doneLesson, perfect), true);
assert.strictEqual(logic.lessonIsDone(doneLesson, mixed), false);
assert.strictEqual(logic.lessonIsDone(doneLesson, perfect.slice(0, 1)), false);

const curriculum = {
  completionAccuracy: 0.8,
  levels: [
    {
      level: "N5",
      topics: [
        { id: "n5-a", title: "甲", description: "甲", level: "N5", lessonIds: ["day-001"], planned: 2 },
        { id: "n5-b", title: "乙", description: "乙", level: "N5", lessonIds: [], planned: 1 }
      ]
    }
  ]
};
const report = logic.curriculumReport(curriculum, { "day-001": doneLesson }, perfect);
assert.strictEqual(report.levels[0].topics[0].doneCount, 1);
assert.strictEqual(report.levels[0].topics[0].percent, 0.5);
assert.strictEqual(report.levels[0].topics[0].complete, false);
assert.strictEqual(report.levels[0].topics[1].percent, 0);
assert.strictEqual(report.levels[0].percent, 0.25);
const finished = logic.curriculumReport({
  levels: [{
    level: "N5",
    topics: [{ id: "n5-a", title: "甲", level: "N5", lessonIds: ["day-001"], planned: 1 }]
  }]
}, { "day-001": doneLesson }, perfect);
assert.strictEqual(finished.levels[0].topics[0].complete, true);
assert.strictEqual(finished.levels[0].percent, 1);

const older = { id: "w1", status: "unknown", updatedAt: "2026-10-01T10:00:00+08:00", level: "N5", category: "n5-verb" };
const newer = { id: "w1", status: "known", updatedAt: "2026-10-02T10:00:00+08:00", level: "N5", category: "n5-verb" };
const marks = logic.mergeVocabMarks([[newer], [older, { id: "w2", status: "unknown", updatedAt: "2026-10-01T09:00:00+08:00" }]]);
assert.strictEqual(marks.length, 2);
assert.strictEqual(marks[0].status, "known");
assert.strictEqual(logic.mergeVocabMarks([[{ id: "bad", status: "maybe" }]]).length, 0);

const vocab = logic.vocabReport([
  {
    level: "N5",
    categories: [{
      id: "n5-verb",
      title: "動詞",
      entries: [
        { id: "w1", japanese: "行く", reading: "いく", meaning: "去", level: "N5", category: "n5-verb" },
        { id: "w2", japanese: "食べる", reading: "たべる", meaning: "食", level: "N5", category: "n5-verb" }
      ]
    }]
  }
], marks);
assert.strictEqual(vocab.byLevel[0].known, 1);
assert.strictEqual(vocab.byLevel[0].unknown, 1);
assert.strictEqual(vocab.byLevel[0].percent, 0.5);
assert.strictEqual(vocab.unknown[0].id, "w2");
assert.strictEqual(vocab.unknown[0].meaning, "食");

assert.deepStrictEqual(logic.REVIEW_INTERVALS, [2, 5, 10]);
assert.strictEqual(logic.reviewInterval(1), 2);
assert.strictEqual(logic.reviewInterval(2), 5);
assert.strictEqual(logic.reviewInterval(3), 10);
assert.strictEqual(logic.reviewInterval(6), 10);

function wrongAttempt(id, questionId, date, correct) {
  return {
    id: id,
    questionId: questionId,
    lessonId: "day-001",
    correct: !!correct,
    timestamp: date + "T10:00:00+08:00",
    localDate: date
  };
}
assert.strictEqual(logic.dueReviews([wrongAttempt("a", "q1", "2026-10-01", false)], "2026-10-02").length, 0);
const verbDue = logic.dueReviews([wrongAttempt("verb-1", "day-001-q8", "2026-10-01", false)], "2026-10-03");
assert.strictEqual(verbDue.length, 1);
assert.strictEqual(verbDue[0].interval, 2);
assert.strictEqual(verbDue[0].questionId, "day-001-q8");
const dueOnce = logic.dueReviews([wrongAttempt("a", "q1", "2026-10-01", false)], "2026-10-03");
assert.strictEqual(dueOnce.length, 1);
assert.strictEqual(dueOnce[0].interval, 2);
assert.strictEqual(dueOnce[0].due, "2026-10-03");
const twice = [
  wrongAttempt("a", "q1", "2026-10-01", false),
  wrongAttempt("b", "q1", "2026-10-03", false)
];
assert.strictEqual(logic.dueReviews(twice, "2026-10-07").length, 0);
assert.strictEqual(logic.dueReviews(twice, "2026-10-08")[0].interval, 5);
const cleared = twice.concat([wrongAttempt("c", "q1", "2026-10-08", true)]);
assert.strictEqual(logic.dueReviews(cleared, "2026-10-20").length, 0);
const again = cleared.concat([wrongAttempt("d", "q1", "2026-10-09", false)]);
assert.strictEqual(logic.dueReviews(again, "2026-10-11")[0].interval, 2);

const plainAttempt = logic.makeAttempt({
  question: { id: "q1", tags: ["は"] },
  lessonId: "day-001",
  userAnswerText: "は",
  correct: true,
  attemptNo: 1,
  now: new Date(2026, 9, 1, 8, 0, 0)
});
assert.strictEqual(plainAttempt.review, undefined);
const reviewAttempt = logic.makeAttempt({
  question: { id: "q1", tags: ["は"] },
  lessonId: "day-001",
  userAnswerText: "わ",
  correct: false,
  attemptNo: 2,
  review: true,
  now: new Date(2026, 9, 3, 8, 0, 0)
});
assert.strictEqual(reviewAttempt.review, true);

const homeA = { id: "n5w1-d1", title: "第 1 日：長音", questions: [{ id: "a1" }, { id: "a2" }] };
const homeB = { id: "n5w1-d1v", title: "第 1 日（動詞篇）：辭書形", questions: [{ id: "b1" }, { id: "b2" }] };
const homeC = { id: "n5w1-d2", title: "第 2 日：助詞", questions: [{ id: "c1" }] };
function homeAttempts(lesson, flags) {
  return lesson.questions.map(function (question, index) {
    return { questionId: question.id, lessonId: lesson.id, correct: !!flags[index] };
  });
}
const homePassed = homeAttempts(homeA, [true, true]);
let homePlan = logic.homeLessonPlan([homeA, homeB], homePassed, []);
assert.strictEqual(homePlan.kind, "lesson");
assert.strictEqual(homePlan.lessonId, "n5w1-d1v");
assert.strictEqual(homePlan.mode, "new");
assert.strictEqual(homePlan.button, "開始今日課堂");
const homeHalf = homeAttempts(homeA, [true, false]);
homePlan = logic.homeLessonPlan([homeA, homeB], homeHalf, []);
assert.strictEqual(homePlan.lessonId, "n5w1-d1");
assert.strictEqual(homePlan.mode, "retry");
assert.strictEqual(homePlan.button, "再練一次");
assert.strictEqual(homePlan.heading, "第 1 日再練一次（上次 50%）");
assert.strictEqual(homePlan.skipLessonId, "n5w1-d1v");
homePlan = logic.homeLessonPlan([homeA, homeB, homeC], homeHalf, ["n5w1-d1"]);
assert.strictEqual(homePlan.lessonId, "n5w1-d1v");
assert.strictEqual(homePlan.mode, "new");
assert.strictEqual(homePlan.button, "開始今日課堂");
assert.strictEqual(homePlan.skipLessonId, "n5w1-d2");
const homeFour = {
  id: "n5w1-d1",
  title: "第 1 日：長音",
  questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }]
};
homePlan = logic.homeLessonPlan([homeFour, homeB], homeAttempts(homeFour, [true, true, true, false]), []);
assert.strictEqual(homePlan.lessonId, "n5w1-d1v");
assert.strictEqual(homePlan.mode, "new");
const homeFive = {
  id: "n5w1-d1",
  title: "第 1 日：長音",
  questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }, { id: "q5" }]
};
homePlan = logic.homeLessonPlan([homeFive, homeB], homeAttempts(homeFive, [true, true, true, true, false]), []);
assert.strictEqual(homePlan.lessonId, "n5w1-d1v");
assert.strictEqual(homePlan.mode, "new");
homePlan = logic.homeLessonPlan([homeA], homeHalf, []);
assert.strictEqual(homePlan.skipLessonId, null);
homePlan = logic.homeLessonPlan([homeA, homeB], homePassed.concat(homeAttempts(homeB, [true, true])), []);
assert.strictEqual(homePlan.kind, "done");
const homeSkippedDone = logic.homeLessonPlan(
  [homeA, homeB, homeC],
  homeHalf.concat(homeAttempts(homeB, [true, true])),
  []
);
assert.strictEqual(homeSkippedDone.lessonId, "n5w1-d1");
assert.strictEqual(homeSkippedDone.skipLessonId, "n5w1-d2");

function countedLesson(count) {
  var questions = [];
  for (var i = 0; i < count; i++) questions.push({ id: "q" + i });
  return { id: "n5w1-d1", title: "第 1 日：測", questions: questions };
}
function countedAttempts(lesson, correctCount, stamp) {
  return lesson.questions.map(function (question, index) {
    return {
      questionId: question.id,
      lessonId: lesson.id,
      correct: index < correctCount,
      timestamp: stamp + String(index).padStart(2, "0")
    };
  });
}
const ten = countedLesson(10);
const at70 = logic.lessonStanding(ten, countedAttempts(ten, 7, "2026-10-01T10:00:"));
assert.strictEqual(at70.accuracy, 0.7);
assert.strictEqual(at70.done, true);
assert.strictEqual(logic.homeLessonPlan([ten, homeB], countedAttempts(ten, 7, "2026-10-01T10:00:"), []).lessonId, "n5w1-d1v");
const hundred = countedLesson(100);
const at69 = logic.lessonStanding(hundred, countedAttempts(hundred, 69, "2026-10-01T10:00:"));
assert.ok(at69.accuracy < 0.7);
assert.strictEqual(Math.round(at69.accuracy * 100), 69);
assert.strictEqual(at69.done, false);
const plan69 = logic.homeLessonPlan([hundred, homeB], countedAttempts(hundred, 69, "2026-10-01T10:00:"), []);
assert.strictEqual(plan69.lessonId, "n5w1-d1");
assert.strictEqual(plan69.mode, "retry");
assert.strictEqual(plan69.heading, "第 1 日再練一次（上次 69%）");
const highThenLow = countedAttempts(ten, 10, "2026-10-01T10:00:").concat(countedAttempts(ten, 5, "2026-10-02T10:00:"));
const dropped = logic.lessonStanding(ten, highThenLow);
assert.strictEqual(dropped.accuracy, 0.5);
assert.strictEqual(dropped.done, false);
const dropPlan = logic.homeLessonPlan([ten, homeB], highThenLow, []);
assert.strictEqual(dropPlan.lessonId, "n5w1-d1");
assert.strictEqual(dropPlan.heading, "第 1 日再練一次（上次 50%）");
const unfinished = countedAttempts(ten, 10, "2026-10-01T10:00:").concat([
  { questionId: "q0", lessonId: "n5w1-d1", correct: false, timestamp: "2026-10-03T10:00:00" }
]);
const kept = logic.lessonStanding(ten, unfinished);
assert.strictEqual(kept.done, true);
assert.strictEqual(kept.accuracy, 1);
assert.strictEqual(logic.homeLessonPlan([ten, homeB], unfinished, []).lessonId, "n5w1-d1v");
const report70 = logic.curriculumReport({
  completionAccuracy: 0.7,
  levels: [{ level: "N5", topics: [{ id: "n5-a", title: "甲", level: "N5", lessonIds: ["n5w1-d1"], planned: 1 }] }]
}, { "n5w1-d1": ten }, countedAttempts(ten, 7, "2026-10-01T10:00:"));
assert.strictEqual(report70.levels[0].topics[0].doneCount, 1);
assert.strictEqual(report70.levels[0].percent, 1);
const report69 = logic.curriculumReport({
  completionAccuracy: 0.7,
  levels: [{ level: "N5", topics: [{ id: "n5-a", title: "甲", level: "N5", lessonIds: ["n5w1-d1"], planned: 1 }] }]
}, { "n5w1-d1": hundred }, countedAttempts(hundred, 69, "2026-10-01T10:00:"));
assert.strictEqual(report69.levels[0].topics[0].doneCount, 0);
assert.strictEqual(report69.levels[0].percent, 0);

function topicStamp(lessonId, questionId, correct, stamp) {
  return { lessonId: lessonId, questionId: questionId, correct: correct, timestamp: stamp };
}
const topicA = { id: "la", title: "甲課", questions: [{ id: "a1" }, { id: "a2" }] };
const topicB = { id: "lb", title: "乙課", questions: [{ id: "b1" }, { id: "b2" }, { id: "b3" }] };
const topicCurriculum = {
  completionAccuracy: 0.7,
  levels: [{
    level: "N5",
    topics: [{ id: "n5-pool", title: "池", level: "N5", lessonIds: ["la", "lb"], planned: 2 }]
  }]
};
const olderWrongs = [
  topicStamp("la", "a1", false, "2026-10-01T10:00:00"),
  topicStamp("la", "a2", false, "2026-10-01T10:00:01"),
  topicStamp("lb", "b1", false, "2026-10-01T10:00:02"),
  topicStamp("lb", "b2", false, "2026-10-01T10:00:03"),
  topicStamp("lb", "b3", false, "2026-10-01T10:00:04")
];
const latestPasses = [
  topicStamp("la", "a1", true, "2026-10-02T10:00:00"),
  topicStamp("la", "a2", true, "2026-10-02T10:00:01"),
  topicStamp("lb", "b1", true, "2026-10-02T10:00:02"),
  topicStamp("lb", "b2", true, "2026-10-02T10:00:03"),
  topicStamp("lb", "b3", false, "2026-10-02T10:00:04")
];
const pooled = logic.curriculumReport(topicCurriculum, { la: topicA, lb: topicB }, olderWrongs.concat(latestPasses));
const pooledTopic = pooled.levels[0].topics[0];
assert.strictEqual(pooledTopic.lessons[0].accuracy, 1);
assert.strictEqual(pooledTopic.lessons[1].accuracy, 2 / 3);
assert.strictEqual(pooledTopic.lessons[0].questionTotal, 2);
assert.strictEqual(pooledTopic.lessons[1].questionTotal, 3);
assert.strictEqual(pooledTopic.accuracy, 0.8);
assert.notStrictEqual(pooledTopic.accuracy, 0.4);
const unfinishedTopic = logic.curriculumReport(topicCurriculum, { la: topicA, lb: topicB }, olderWrongs.concat(latestPasses, [
  topicStamp("la", "a1", false, "2026-10-03T10:00:00")
]));
assert.strictEqual(unfinishedTopic.levels[0].topics[0].accuracy, 0.8);
assert.strictEqual(unfinishedTopic.levels[0].topics[0].lessons[0].accuracy, 1);
const noneComplete = logic.curriculumReport(topicCurriculum, { la: topicA, lb: topicB }, [
  topicStamp("la", "a1", true, "2026-10-01T10:00:00"),
  topicStamp("lb", "b1", false, "2026-10-01T10:00:01")
]);
assert.strictEqual(noneComplete.levels[0].topics[0].accuracy, null);
assert.strictEqual(noneComplete.levels[0].topics[0].lessons[0].accuracy, null);
assert.strictEqual(noneComplete.levels[0].topics[0].lessons[0].questionTotal, 0);
const onlyOne = logic.curriculumReport(topicCurriculum, { la: topicA, lb: topicB }, latestPasses.filter(function (item) {
  return item.lessonId === "la";
}));
assert.strictEqual(onlyOne.levels[0].topics[0].accuracy, 1);

assert.deepStrictEqual(logic.FONT_STEPS, ["standard", "large", "xlarge"]);
assert.strictEqual(logic.FONT_LABELS.standard, "標準");
assert.strictEqual(logic.FONT_LABELS.large, "大");
assert.strictEqual(logic.FONT_LABELS.xlarge, "特大");
assert.strictEqual(logic.normalizeFontSize("large"), "large");
assert.strictEqual(logic.normalizeFontSize("nope"), "standard");
assert.strictEqual(logic.normalizeFontSize(""), "standard");
assert.strictEqual(logic.stepFontSize("standard", 1), "large");
assert.strictEqual(logic.stepFontSize("large", 1), "xlarge");
assert.strictEqual(logic.stepFontSize("xlarge", 1), "xlarge");
assert.strictEqual(logic.stepFontSize("standard", -1), "standard");
assert.strictEqual(logic.stepFontSize("xlarge", -1), "large");
assert.strictEqual(logic.MIN_JP.flash, 32);
assert.strictEqual(logic.MIN_JP.practice, 24);

assert.strictEqual(logic.confirmReady({ mode: "choice", picked: null, locked: false }), false);
assert.strictEqual(logic.confirmReady({ mode: "choice", picked: 0, locked: false }), true);
assert.strictEqual(logic.confirmReady({ mode: "choice", picked: 2, locked: false }), true);
assert.strictEqual(logic.confirmReady({ mode: "choice", picked: 1, locked: true }), false);
assert.strictEqual(logic.confirmReady({ mode: "fill", text: "  ", locked: false }), false);
assert.strictEqual(logic.confirmReady({ mode: "fill", text: "", locked: false }), false);
assert.strictEqual(logic.confirmReady({ mode: "fill", text: "は", locked: false }), true);
assert.strictEqual(logic.confirmReady({ mode: "fill", text: "は", locked: true }), false);
assert.strictEqual(logic.confirmReady({ mode: "other", text: "は" }), false);

assert.strictEqual(logic.choiceLayout(["ば", "ぱ", "わ", "ほ"]), "grid");
assert.strictEqual(logic.choiceLayout(["3 拍", "4 拍", "5 拍", "6 拍"]), "grid");
assert.strictEqual(logic.choiceLayout(["安くなかったです", "安くないです", "安かったです", "いです"]), "stack");
assert.strictEqual(logic.choiceLayout(["只有一個"]), "stack");
assert.strictEqual(logic.choiceLayout([]), "stack");
const storySentences = ["あさ起きる。", "いま食べる。", "きょう帰る。", "いま寝る。"];
assert.strictEqual(logic.choiceLayout(storySentences, logic.choiceGridLimit(390, 32)), "stack");
assert.strictEqual(logic.choiceLayout(storySentences, logic.choiceGridLimit(360, 28)), "stack");
assert.strictEqual(logic.choiceLayout(storySentences, logic.choiceGridLimit(360, 32)), "stack");
assert.strictEqual(logic.choiceLayout(storySentences, logic.choiceGridLimit(430, 32)), "stack");
assert.strictEqual(logic.choiceLayout(["ば", "ぱ", "わ", "ほ"], logic.choiceGridLimit(360, 32)), "grid");

const wrongPanel = logic.feedbackPanel({ correct: false, answer: "ぱ", reading: "ぱ", jp: "ぱ", rule: "半濁音加圈。", explanation: "「ば」先係濁音。" });
assert.strictEqual(wrongPanel.tone, "bad");
assert.strictEqual(wrongPanel.title, "再看一下");
assert.strictEqual(wrongPanel.lines.length, 2);
assert.strictEqual(wrongPanel.lines[0].label, "正確答案");
assert.strictEqual(wrongPanel.lines[0].text, "ぱ");
assert.strictEqual(wrongPanel.lines[0].reading, "ぱ");
assert.strictEqual(wrongPanel.lines[1].label, "規則");
assert.strictEqual(wrongPanel.lines[1].text, "半濁音加圈。");
assert.strictEqual(wrongPanel.detail, "「ば」先係濁音。");
const listenGuide = logic.answerGuide({
  type: "listening",
  jp: "おばあさん",
  reading: "おばあさん",
  choices: ["おばさん（阿姨）", "おばあさん（婆婆）"],
  answer: 1
}, {});
assert.strictEqual(listenGuide.answer, "おばあさん");
assert.strictEqual(listenGuide.reading, "おばあさん");
const readingMap = logic.readingIndex([
  { japanese: "飲む", reading: "のむ", forms: { "て形": { japanese: "飲んで", reading: "のんで" } } },
  { word: "公園", reading: "こうえん" }
]);
const formGuide = logic.answerGuide({
  type: "choice",
  kind: "verb-form",
  verb: "飲む",
  reading: "のむ",
  form: "て形",
  choices: ["飲んで", "飲いて", "飲って", "飲して"],
  answer: 0
}, readingMap);
assert.strictEqual(formGuide.answer, "飲んで");
assert.strictEqual(formGuide.reading, "のんで");
assert.strictEqual(formGuide.extraJp, "飲む");
assert.strictEqual(formGuide.extraReading, "のむ");
const groupGuide = logic.answerGuide({
  type: "choice",
  kind: "verb-group",
  verb: "見る",
  reading: "みる",
  choices: ["一類", "二類", "三類", "唔係動詞"],
  answer: 1
}, {});
assert.strictEqual(groupGuide.answer, "二類");
assert.strictEqual(groupGuide.jp, "見る");
assert.strictEqual(groupGuide.reading, "みる");
const fillGuide = logic.answerGuide({ type: "fill", accepted: ["で"] }, {});
assert.strictEqual(fillGuide.answer, "で");
assert.strictEqual(fillGuide.reading, "で");
const lookedUp = logic.answerGuide({
  type: "choice",
  choices: ["公園", "映画"],
  answer: 0
}, readingMap);
assert.strictEqual(lookedUp.jp, "公園");
assert.strictEqual(lookedUp.reading, "こうえん");
const kanaGuide = logic.answerGuide({
  type: "choice",
  choices: ["こうえん", "こえん"],
  answer: 0
}, {});
assert.strictEqual(kanaGuide.reading, "こうえん");
const beside = logic.answerGuide({
  type: "choice",
  choices: ["部屋で寝る。", "部屋に寝る。"],
  answer: 0,
  explanation: "動作發生嘅地點用「で」：部屋で寝る（へやでねる）。"
}, {});
assert.strictEqual(beside.reading, "へやでねる");
const missingGuide = logic.answerGuide({
  type: "choice",
  choices: ["部屋で寝る。", "部屋に寝る。"],
  answer: 0
}, {});
assert.strictEqual(missingGuide.jp, "部屋で寝る。");
assert.strictEqual(missingGuide.reading, "");
const wrongRuleOnly = logic.feedbackPanel({ correct: false, answer: "で", rule: "", explanation: "第一個音係濁音。" });
assert.strictEqual(wrongRuleOnly.lines[1].text, "第一個音係濁音。");
assert.strictEqual(wrongRuleOnly.detail, "");
const rightPanel = logic.feedbackPanel({ correct: true, answer: "ぱ", rule: "唔顯示", explanation: "啱。" });
assert.strictEqual(rightPanel.tone, "ok");
assert.strictEqual(rightPanel.title, "正確");
assert.strictEqual(rightPanel.lines.length, 0);
assert.strictEqual(rightPanel.detail, "啱。");

assert.strictEqual(logic.roadmapStatus({ done: true }, false), "passed");
assert.strictEqual(logic.roadmapStatus({ done: true }, true), "passed");
assert.strictEqual(logic.roadmapStatus({ done: false }, true), "next");
assert.strictEqual(logic.roadmapStatus({ done: false }, false), "todo");
const roadLessons = [
  { id: "n5w1-d1", questions: [{ id: "q1" }] },
  { id: "n5w1-d1v", questions: [{ id: "q2" }] },
  { id: "n5w1-d2", questions: [{ id: "q3" }] }
];
const roadAttempts = [{ questionId: "q1", lessonId: "n5w1-d1", correct: true }];
assert.deepStrictEqual(logic.roadmapMarks(roadLessons, roadAttempts), [
  { id: "n5w1-d1", status: "passed" },
  { id: "n5w1-d1v", status: "next" },
  { id: "n5w1-d2", status: "todo" }
]);
const lowPass = [{ questionId: "q1", lessonId: "n5w1-d1", correct: false }];
assert.strictEqual(logic.roadmapMarks(roadLessons, lowPass)[0].status, "next");

const colors = logic.COLORS;
function atLeast(fg, bg, name) {
  const ratio = logic.contrastRatio(fg, bg);
  assert.ok(ratio >= 4.5, name + " " + ratio.toFixed(2));
}
atLeast(colors.brandInk, colors.brand, "button text");
atLeast(colors.accent, colors.paper, "accent on card");
atLeast(colors.accent, colors.bg, "accent on page");
atLeast(colors.accent, colors.okBg, "accent on correct sheet");
atLeast(colors.accent, colors.badBg, "accent on wrong sheet");
atLeast(colors.accent, colors.codeBg, "accent on code chip");
atLeast(colors.ink, colors.bg, "body on page");
atLeast(colors.ink, colors.paper, "body on card");
atLeast(colors.muted, colors.bg, "secondary on page");
atLeast(colors.muted, colors.paper, "secondary on card");
atLeast(colors.okText, colors.paper, "correct text on card");
atLeast(colors.okText, colors.okBg, "correct text on sheet");
atLeast(colors.okText, colors.bg, "correct text on page");
atLeast(colors.okTick, colors.ok, "tick on green node");
atLeast(colors.badText, colors.paper, "wrong text on card");
atLeast(colors.badText, colors.badBg, "wrong text on sheet");
atLeast(colors.badText, colors.bg, "wrong text on page");
atLeast(colors.example, colors.paper, "example on card");
atLeast(colors.example, colors.bg, "example on page");
atLeast(colors.example, colors.badBg, "example on wrong sheet");
atLeast(colors.brandInk, colors.disabled, "disabled button");
atLeast(colors.tableHeadText, colors.tableHead, "table header");
atLeast(colors.ink, colors.codeBg, "code chip");
atLeast(colors.brandInk, colors.paper, "brown on white");
assert.ok(logic.contrastRatio(colors.brand, colors.paper) < 4.5, "amber is a fill, not body text");
assert.ok(logic.contrastRatio("#B45F00", colors.bg) < 4.5, "#B45F00 is too light on the page background");

const fs = require("fs");
const css = fs.readFileSync(require("path").join(__dirname, "../css/app.css"), "utf8");
Object.keys(colors).forEach((key) => {
  assert.ok(css.indexOf(colors[key]) !== -1, "css missing " + key + " " + colors[key]);
});
assert.ok(css.indexOf("--jp-flash: 32px") !== -1);
assert.ok(css.indexOf("--jp-practice: 24px") !== -1);
assert.ok(css.indexOf("max(24px, var(--jp-practice))") !== -1);
assert.ok(css.indexOf("position: sticky") !== -1);
assert.ok(css.indexOf("prefers-reduced-motion") !== -1);
assert.ok(css.indexOf("scroll-pad") === -1);
assert.ok(/\.toast\s*\{[^}]*pointer-events:\s*none/.test(css));
const sw = fs.readFileSync(require("path").join(__dirname, "../sw.js"), "utf8");
assert.ok(sw.indexOf("jpn5-shell-v4") !== -1);
assert.ok(sw.indexOf("jpn5-shell-v3") === -1);
assert.ok(sw.indexOf("jpn5-shell-v2") === -1);
assert.ok(sw.indexOf("jpn5-shell-v1") === -1);
assert.ok(/\.choice \.jp, \.choice \.reading \{[^}]*overflow-wrap:\s*anywhere/.test(css));
assert.ok(css.indexOf("max(14px, 0.8rem)") !== -1);
assert.ok(!/\.tabbar a \{[^}]*font-size:\s*11px/.test(css));
assert.ok(sw.indexOf('key.indexOf(CACHE_PREFIX) === 0') !== -1);
assert.ok(sw.indexOf("if (isIgSavePath(url.pathname)) return;") !== -1);
const isIgSavePath = new Function(sw.slice(sw.indexOf("function isIgSavePath"), sw.indexOf("function fresh")) + "\nreturn isIgSavePath;")();
assert.strictEqual(isIgSavePath("/japanese-log/ig-save/"), true);
assert.strictEqual(isIgSavePath("/japanese-log/ig-save"), true);
assert.strictEqual(isIgSavePath("/japanese-log/ig-save/index.html"), true);
assert.strictEqual(isIgSavePath("/japanese-log/ig-save/IG%E5%AD%98%E7%9B%B8%E8%A7%A3%E6%9E%90.js"), true);
assert.strictEqual(isIgSavePath("/japanese-log/"), false);
assert.strictEqual(isIgSavePath("/japanese-log/index.html"), false);
assert.strictEqual(isIgSavePath("/japanese-log/sw.js"), false);
assert.strictEqual(isIgSavePath("/japanese-log/js/app.js"), false);
const igHtml = fs.readFileSync(require("path").join(__dirname, "../ig-save/index.html"), "utf8");
const igJs = fs.readFileSync(require("path").join(__dirname, "../ig-save/IG存相解析.js"), "utf8");
const igScript = igHtml.match(/<textarea id="script"[^>]*>([\s\S]*?)<\/textarea>/);
assert.ok(igScript, "install page must embed the script");
const igDecoded = igScript[1]
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#x27;/g, "'")
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&");
assert.strictEqual(igDecoded, igJs);
assert.strictEqual(igJs.includes('const VERSION = "1.9.3-ig-photos"'), true);
assert.strictEqual(igJs.includes("1.9.2-ig-photos"), false);
assert.strictEqual(igJs.includes("1.9.1-ig-photos"), false);
assert.strictEqual(igJs.includes("1.9.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.8.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.7.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.6.1-ig-photos"), false);
assert.strictEqual(igJs.includes("1.6.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.5.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.4.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.3.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.2.0-ig-photos"), false);
assert.strictEqual(igJs.includes("1.0.0-ig-photos"), false);
assert.ok(igJs.indexOf("q.url") !== -1 && igJs.indexOf("q.url") < igJs.indexOf("Pasteboard.pasteString"));
const igMain = igJs.slice(igJs.indexOf("async function main"));
assert.ok(igMain.indexOf('say("IG存相 " + VERSION') !== -1);
assert.ok(igMain.indexOf('say("IG存相 " + VERSION') < igMain.indexOf("Pasteboard.pasteString"));
assert.ok(igMain.indexOf("Pasteboard.pasteString") < igMain.indexOf("if (fromShortcut)"));
assert.ok(igMain.indexOf("if (fromShortcut)") < igMain.indexOf("url = await askUrl()"));
assert.strictEqual(igJs.includes("冇帶到連結"), true);
assert.strictEqual(igJs.includes("請睇 IG 頁"), false);
assert.strictEqual(igJs.includes('a.addAction("繼續")'), false);
assert.strictEqual(igJs.includes("WebView"), false);
assert.strictEqual(igJs.includes("loadURL"), false);
assert.strictEqual(igJs.includes("#weblink"), false);
assert.strictEqual(igJs.includes("loadString()"), true);
assert.strictEqual(igJs.includes("function extractByRequest"), true);
assert.strictEqual(igJs.includes("embed/captioned/"), true);
assert.strictEqual(igJs.includes("const FETCH_SECONDS = 60"), true);
assert.strictEqual(igJs.includes("return seconds * 1000"), true);
assert.strictEqual(igJs.includes("timer.timeInterval = timerMs(seconds)"), true);
assert.strictEqual(igJs.includes("timer.timeInterval = seconds"), false);
assert.strictEqual(igJs.includes("req.timeoutInterval = FETCH_SECONDS"), true);
assert.strictEqual(igJs.includes("attempt < 2"), true);
{
  const withFn = igJs.slice(igJs.indexOf("function withTimeout"), igJs.indexOf("function decodeEscapedUrl"));
  const sleepFn = igJs.slice(igJs.indexOf("function sleepSeconds"), igJs.indexOf("function statusOf"));
  assert.ok(withFn.includes("timer.timeInterval = timerMs(seconds)"));
  assert.ok(sleepFn.includes("timer.timeInterval = timerMs(seconds)"));
  assert.strictEqual(withFn.includes("timer.timeInterval = seconds"), false);
  assert.strictEqual(sleepFn.includes("timer.timeInterval = seconds"), false);
}
assert.strictEqual(igJs.includes("function imagesFromHtml"), true);
assert.strictEqual(igJs.includes("function shortcodeOf"), true);
assert.strictEqual(igJs.includes("唔會打開 IG App"), true);
assert.strictEqual(igJs.includes('req.timeoutInterval = 60'), true);
assert.strictEqual(igJs.includes("function attemptSequence"), true);
assert.strictEqual(igJs.includes("Photos.fromData"), false);
assert.strictEqual(igJs.includes("Image.fromData(data)"), true);
assert.strictEqual(igJs.includes("Photos.save(image)"), true);
assert.strictEqual(igJs.includes("shortcode_media"), true);
assert.strictEqual(igJs.includes("edge_sidecar_to_children"), true);
assert.strictEqual(igJs.includes("EmbeddedMediaImage"), true);
assert.strictEqual(igJs.includes("const reAny"), false);
assert.strictEqual(igJs.includes("張失敗"), false);
assert.strictEqual(igJs.includes("張未存到"), true);
assert.strictEqual(igJs.includes("搵到 "), true);
assert.strictEqual(igJs.includes("全部存"), true);
assert.strictEqual(igJs.includes("揀邊啲存"), true);
assert.strictEqual(igJs.includes("new UITable()"), true);
assert.strictEqual(igJs.includes("dismissOnSelect = false"), true);
assert.strictEqual(igJs.includes("存已揀嘅相"), true);
{
  const chooseFn = igJs.slice(igJs.indexOf("async function chooseImages"), igJs.indexOf("async function main"));
  assert.ok(chooseFn.indexOf("count <= 1") !== -1);
  assert.ok(chooseFn.indexOf("count <= 1") < chooseFn.indexOf("askCarouselMode"));
}
assert.strictEqual(igJs.includes("搵到相但存唔入。請去 iPhone 設定"), false);
assert.strictEqual(igJs.includes("Script.complete();"), true);
{
  const vm = require("vm");
  const pureStart = igJs.indexOf("function decodeEscapedUrl");
  const pureEnd = igJs.indexOf("async function fetchText");
  const sandbox = {};
  vm.runInNewContext(
    igJs.slice(pureStart, pureEnd) +
      "\nthis.imagesFromHtml = imagesFromHtml;" +
      "\nthis.shortcodeOf = shortcodeOf;" +
      "\nthis.httpTargets = httpTargets;" +
      "\nthis.missingReason = missingReason;" +
      "\nthis.downloadPlan = downloadPlan;" +
      "\nthis.attemptSequence = attemptSequence;" +
      "\nthis.imageHeaders = imageHeaders;" +
      "\nthis.saveFailureMessage = saveFailureMessage;" +
      "\nthis.chosenIndices = chosenIndices;" +
      "\nthis.subsetPairs = subsetPairs;",
    sandbox
  );
  const sample =
    '<meta property="og:image" content="https://scontent.cdninstagram.com/v/photo.jpg?_nc=1" />' +
    '<script>{"display_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/disp.jpg","video_versions":[{"url":"https://cdn.example/v.mp4"}],"image_versions2":{"candidates":[{"url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/cand.jpg"}]}}</script>' +
    '<img src="https://static.cdninstagram.com/rsrc.php/asset.png" />' +
    '<img src="https://scontent.cdninstagram.com/v/img.jpg" />';
  const parsed = sandbox.imagesFromHtml(sample);
  assert.strictEqual(parsed.images.length, 1);
  assert.strictEqual(parsed.images[0], "https://scontent.cdninstagram.com/v/cand.jpg");
  assert.ok(parsed.images.every((u) => u.indexOf("rsrc.php") === -1 && u.indexOf("static.cdninstagram") === -1));
  assert.strictEqual(parsed.skippedVideo, 0);
  assert.strictEqual(sandbox.shortcodeOf("https://www.instagram.com/p/AbC123/?igsh=1"), "AbC123");
  assert.strictEqual(sandbox.shortcodeOf("https://www.instagram.com/share/ZZZ"), "");
  const targets = sandbox.httpTargets("https://www.instagram.com/p/AbC123/?igsh=1");
  assert.strictEqual(targets[0], "https://www.instagram.com/p/AbC123/embed/captioned/");
  assert.strictEqual(targets[1], "https://www.instagram.com/p/AbC123/embed/");
  const slow = sandbox.missingReason({ fetched: 0, lastError: "fetch_timeout" });
  assert.ok(slow.indexOf("再撳播放") !== -1);
  assert.strictEqual(slow.indexOf("關 IG"), -1);
  const embedHtml =
    '<img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/t51.71878-15/a_n.jpg?stp=dst-jpg_e15_s480x480_tt6&amp;_nc_cat=1" />' +
    '<img src="https://scontent.cdninstagram.com/v/t51.2885-19/p_n.jpg?stp=dst-jpg_s100x100_tt6&amp;_nc_cat=1" />';
  const emb = sandbox.imagesFromHtml(embedHtml);
  assert.strictEqual(emb.images.length, 1);
  assert.ok(emb.images[0].indexOf("s480x480") !== -1);
  assert.strictEqual(emb.images[0].indexOf("&amp;"), -1);
  assert.ok(sandbox.missingReason({ fetched: 1 }).indexOf("冇相片") !== -1);
  const refused = sandbox.saveFailureMessage(["HTTP 403"]);
  assert.strictEqual(refused.title, "下載失敗");
  assert.ok(refused.message.indexOf("拒絕") !== -1);
  assert.strictEqual(refused.message.indexOf("所有相片"), -1);
  const sized =
    '{"image_versions2":{"candidates":[' +
    '{"width":2160,"url":"https://scontent.cdninstagram.com/v/big.jpg?stp=dst-jpg_e35","estimated_scans_sizes":[10,20]},' +
    '{"width":1080,"url":"https://scontent.cdninstagram.com/v/mid.jpg?stp=dst-jpg_e35_s1080x1080"},' +
    '{"width":640,"url":"https://scontent.cdninstagram.com/v/small.jpg"}]}}';
  const sizedParsed = sandbox.imagesFromHtml(sized);
  assert.strictEqual(sizedParsed.images[0], "https://scontent.cdninstagram.com/v/mid.jpg?stp=dst-jpg_e35_s1080x1080");
  assert.strictEqual(sizedParsed.fallbacks[0][0], "https://scontent.cdninstagram.com/v/small.jpg");
  assert.strictEqual(sizedParsed.fallbacks[0][1], "https://scontent.cdninstagram.com/v/big.jpg?stp=dst-jpg_e35");
  const plan = sandbox.downloadPlan(sizedParsed.images[0], sizedParsed.fallbacks[0]);
  assert.strictEqual(plan[0], sizedParsed.images[0]);
  assert.ok(plan.indexOf("https://scontent.cdninstagram.com/v/small.jpg") !== -1);
  const seq = sandbox.attemptSequence(plan);
  assert.strictEqual(seq[0], plan[0]);
  assert.strictEqual(seq[1], plan[0]);
  assert.strictEqual(seq[2], plan[1]);
  assert.strictEqual(seq.length, 3);
  assert.strictEqual(sandbox.imageHeaders().Referer, "https://www.instagram.com/");
  const timeoutMsg = sandbox.saveFailureMessage(["Error: download_timeout"]);
  assert.strictEqual(timeoutMsg.title, "下載失敗");
  assert.ok(timeoutMsg.message.indexOf("超時") !== -1);
  assert.strictEqual(timeoutMsg.message.indexOf("所有相片"), -1);
  const photoMsg = sandbox.saveFailureMessage(["PHPhotosErrorDomain not authorized"]);
  assert.strictEqual(photoMsg.title, "存唔入相簿");
  assert.ok(photoMsg.message.indexOf("所有相片") !== -1);
  const apiMsg = sandbox.saveFailureMessage([
    "Photos.fromData is not a function. (In 'Photos.fromData(data)', 'Photos.fromData' is undefined)"
  ]);
  assert.strictEqual(apiMsg.title, "存相出錯");
  assert.ok(apiMsg.message.indexOf("唔係 IG 拒絕") !== -1);
  assert.strictEqual(apiMsg.message.indexOf("拒絕咗圖片"), -1);
  assert.strictEqual(apiMsg.message.indexOf("所有相片"), -1);
  assert.strictEqual(apiMsg.message.indexOf("轉 Wi"), -1);
  const badImg = sandbox.saveFailureMessage(["not_image"]);
  assert.strictEqual(badImg.title, "下載失敗");
  assert.ok(badImg.message.indexOf("讀唔成圖片") !== -1);
  assert.strictEqual(badImg.message.indexOf("所有相片"), -1);
  assert.strictEqual(badImg.message.indexOf("存相出錯"), -1);
  const post = sandbox.imagesFromHtml(
    '<img class="HoverCardPhotos" src="https://scontent.cdninstagram.com/v/t51.82787-15/junk_n.jpg?stp=dst-jpg_e15_s240x240" />' +
    '<script>{"shortcode_media":{"__typename":"GraphSidecar","is_video":false,"display_url":"https://scontent.cdninstagram.com/v/parent.jpg",' +
    '"edge_media_to_caption":{"edges":[{"node":{"text":"hello } world"}}]},' +
    '"edge_sidecar_to_children":{"edges":[' +
    '{"node":{"__typename":"GraphImage","is_video":false,"display_url":"https://scontent.cdninstagram.com/v/slide1.jpg","display_resources":[{"src":"https://scontent.cdninstagram.com/v/slide1.jpg?stp=dst-jpg_e35_s1080x1080","config_width":1080},{"src":"https://scontent.cdninstagram.com/v/slide1.jpg?stp=s640x640","config_width":640}]}},' +
    '{"node":{"__typename":"GraphVideo","is_video":true,"display_url":"https://scontent.cdninstagram.com/v/cover.jpg"}},' +
    '{"node":{"__typename":"GraphImage","is_video":false,"display_url":"https://scontent.cdninstagram.com/v/slide2.jpg"}}' +
    ']},"owner":{"username":"lilasikuta","profile_pic_url":"https://scontent.cdninstagram.com/v/t51.2885-19/p.jpg"}}}</script>' +
    '<img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/onlyembed.jpg" />' +
    '"video_versions":[{},{},{},{}]' +
    'https://scontent.cdninstagram.com/v/extra.jpg'
  );
  assert.strictEqual(post.images.length, 2);
  assert.ok(post.images[0].indexOf("s1080x1080") !== -1);
  assert.strictEqual(post.images[1], "https://scontent.cdninstagram.com/v/slide2.jpg");
  assert.strictEqual(post.skippedVideo, 1);
  assert.strictEqual(post.username, "lilasikuta");
  assert.ok(post.images.every((u) => u.indexOf("junk") === -1 && u.indexOf("extra.jpg") === -1 && u.indexOf("cover.jpg") === -1 && u.indexOf("parent.jpg") === -1 && u.indexOf("onlyembed") === -1));
  const one = sandbox.imagesFromHtml(
    '"username":"someoneelse"' +
    '{"shortcode_media":{"__typename":"GraphImage","is_video":false,"display_url":"https://scontent.cdninstagram.com/v/only.jpg","display_resources":[{"src":"https://scontent.cdninstagram.com/v/only.jpg?stp=s1080x1080","config_width":1080},{"src":"https://scontent.cdninstagram.com/v/only.jpg?stp=s640x640","config_width":640}],"owner":{"username":"lilasikuta"}}}' +
    '<img src="https://scontent.cdninstagram.com/v/other.jpg?stp=s320x320" />'
  );
  assert.strictEqual(one.images.length, 1);
  assert.ok(one.images[0].indexOf("s1080x1080") !== -1);
  assert.strictEqual(one.username, "lilasikuta");
  const video = sandbox.imagesFromHtml(
    '{"shortcode_media":{"__typename":"GraphVideo","is_video":true,"display_url":"https://scontent.cdninstagram.com/v/coverframe.jpg","owner":{"username":"diegoquinteiro"}}}' +
    '<img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/coverframe.jpg" />' +
    '<img src="https://scontent.cdninstagram.com/v/hover.jpg?stp=s240x240" />'
  );
  assert.strictEqual(video.images.length, 0);
  assert.strictEqual(video.skippedVideo, 1);
  assert.strictEqual(video.authoritative, true);
  const loose = sandbox.imagesFromHtml(
    '<img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/real.jpg?stp=s1080x1080" />' +
    '<img class="HoverCardPhotos" src="https://scontent.cdninstagram.com/v/hover.jpg?stp=s240x240" />' +
    '"video_versions":[{},{},{},{}]https://scontent.cdninstagram.com/v/extra.jpg'
  );
  assert.strictEqual(loose.images.length, 1);
  assert.ok(loose.images[0].indexOf("real.jpg") !== -1);
  assert.strictEqual(loose.skippedVideo, 0);
  const allIdx = sandbox.chosenIndices(1, "all", []);
  assert.strictEqual(allIdx.length, 1);
  assert.strictEqual(allIdx[0], 0);
  const pickedIdx = sandbox.chosenIndices(4, "pick", [2, 0, 2]);
  assert.strictEqual(pickedIdx.length, 2);
  assert.strictEqual(pickedIdx[0], 0);
  assert.strictEqual(pickedIdx[1], 2);
  assert.strictEqual(sandbox.chosenIndices(4, "cancel", [1]).length, 0);
  const subset = sandbox.subsetPairs(["a", "b", "c"], [["a1"], ["b1"], ["c1"]], [0, 2]);
  assert.strictEqual(subset.images.length, 2);
  assert.strictEqual(subset.images[0], "a");
  assert.strictEqual(subset.images[1], "c");
  assert.strictEqual(subset.fallbacks[1][0], "c1");
}
assert.strictEqual(igJs.includes("IG存相 解析"), false);
assert.strictEqual(igHtml.includes(">IG存相解析<"), true);
assert.strictEqual(igHtml.includes("複製腳本"), true);
assert.strictEqual(igHtml.includes('lang="zh-Hant"'), true);
assert.strictEqual(igHtml.includes('href="IG-save.shortcut"'), true);
assert.strictEqual(igHtml.includes("刪走舊嘅「IG存相」"), true);
assert.strictEqual(igHtml.includes("複製連結"), true);
assert.strictEqual(igHtml.includes("最穩陣方法"), true);
assert.strictEqual(igHtml.includes("撳播放"), true);
assert.strictEqual(igHtml.includes("1.9.3-ig-photos"), true);
assert.strictEqual(igHtml.includes("1.9.2-ig-photos"), false);
assert.strictEqual(igHtml.includes("1.9.1-ig-photos"), false);
assert.strictEqual(igHtml.includes("揀邊啲存"), true);
assert.strictEqual(igHtml.includes("1.9.0-ig-photos"), false);
assert.strictEqual(igHtml.includes("1.8.0-ig-photos"), false);
assert.strictEqual(igHtml.includes("1.7.0-ig-photos"), false);
assert.strictEqual(igHtml.includes("1.6.1-ig-photos"), false);
assert.strictEqual(igHtml.includes("1.6.0-ig-photos"), false);
assert.strictEqual(igHtml.includes("唔會打開 IG App"), true);
assert.strictEqual(igHtml.includes("1.5.0-ig-photos"), false);
assert.strictEqual(igHtml.includes("1.4.0-ig-photos"), false);
const igShortcut = fs.readFileSync(require("path").join(__dirname, "../ig-save/IG-save.shortcut"));
assert.strictEqual(igShortcut.subarray(0, 4).toString("utf8"), "AEA1");
require("child_process").execFileSync("python3", [
  require("path").join(__dirname, "../ig-save/generate_shortcut.py"),
  "--check"
], { stdio: "pipe" });
assert.strictEqual(igHtml.includes("sw.js"), false);
assert.strictEqual(igHtml.includes("manifest.json"), false);
assert.ok(sw.indexOf("jp-log-v15") === -1);
assert.ok(sw.indexOf("js/sync.js") === -1);
assert.ok(sw.indexOf("cache.addAll") === -1);
assert.ok(sw.indexOf('cache: "reload"') !== -1);
const appSource = fs.readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
assert.ok(appSource.indexOf('updateViaCache: "none"') !== -1);
assert.ok(appSource.indexOf('cache: "reload"') !== -1);
assert.ok(appSource.indexOf("getBoundingClientRect().height") !== -1);
assert.ok(appSource.indexOf("fitRuleLine") === -1);
assert.ok(appSource.indexOf("size > 17") === -1);
assert.ok(appSource.indexOf("answerGuide") !== -1);
assert.ok(!/\b66\b/.test(appSource), "app must not hard-code 66");
assert.ok(!/\b22\b/.test(appSource), "app must not hard-code 22");

const indexFile = JSON.parse(fs.readFileSync(require("path").join(__dirname, "../content/units-index.json"), "utf8"));
function specFrom(units) {
  return units.filter((unit) => unit.level === "N5").map((unit) => ({
    id: unit.id,
    lessonCount: unit.lessonCount,
    lessonIds: unit.id === "u-n5-12" ? ["l-n5-12-1", "l-n5-12-2", "l-n5-12-3"] : []
  }));
}
const baseSpec = specFrom(indexFile.units);
const oneDone = logic.levelProgress(["l-n5-12-1"], baseSpec);
const summed = baseSpec.reduce((sum, unit) => sum + unit.lessonCount, 0);
assert.strictEqual(oneDone.total, summed);
assert.strictEqual(oneDone.done, 1);
assert.strictEqual(oneDone.percent, Math.round(100 / summed));
const grown = baseSpec.map((unit) => Object.assign({}, unit, {
  lessonCount: unit.lessonCount + (unit.id === "u-n5-22" ? unit.lessonCount : 0)
}));
const grownDone = logic.levelProgress(["l-n5-12-1"], grown);
assert.notStrictEqual(grownDone.total, oneDone.total);
assert.notStrictEqual(grownDone.percent, oneDone.percent);
assert.strictEqual(logic.levelProgress(["l-n5-12-1", "l-n5-12-1", "not-a-lesson"], baseSpec).done, 1);

const spoken = logic.speechSource({ ja: "私は", reading: "わたしは", tts: "わたしわ", audio: { file: null } });
assert.strictEqual(spoken.mode, "speech");
assert.strictEqual(spoken.text, "わたしわ");
const silent = logic.speechSource({ ja: "食べる", reading: "たべる" });
assert.strictEqual(silent.mode, "none");
assert.strictEqual(silent.text, "");
const filed = logic.speechSource({ ja: "飲む", reading: "のむ", tts: "のむ", audio: { file: "audio/nomu.mp3", ttsText: "のむ" } });
assert.strictEqual(filed.mode, "audio");
assert.strictEqual(filed.audio, "audio/nomu.mp3");
assert.strictEqual(filed.text, "のむ");
const heard = logic.speechSource({ prompt: "請聽", audio: { ttsText: "のむ", file: null } });
assert.strictEqual(heard.mode, "speech");
assert.strictEqual(heard.text, "のむ");

assert.strictEqual(logic.gradeQuestion({ type: "choice", options: [{ id: "a" }, { id: "c" }], answer: "c" }, "c"), true);
assert.strictEqual(logic.gradeQuestion({ type: "choice", options: [{ id: "a" }, { id: "c" }], answer: "c" }, "a"), false);
assert.strictEqual(logic.gradeQuestion({ type: "listen-choice", options: [{ id: "a" }], answer: "a" }, "a"), true);
assert.strictEqual(logic.gradeQuestion({ type: "fill", options: [{ id: "c", text: "く" }], answer: "c" }, "c"), true);
assert.strictEqual(logic.gradeQuestion({ type: "match", answer: { l1: "r1", l2: "r2" } }, { l2: "r2", l1: "r1" }), true);
assert.strictEqual(logic.gradeQuestion({ type: "match", answer: { l1: "r1" } }, { l1: "r2" }), false);
assert.strictEqual(logic.gradeQuestion({ type: "reorder", answer: ["p3", "p1", "p2"] }, ["p3", "p1", "p2"]), true);
assert.strictEqual(logic.gradeQuestion({ type: "reorder", answer: ["p3", "p1"] }, ["p1", "p3"]), false);
const tagged = logic.applyGrammarTags({ tags: [] }, { id: "q-n5-12-001", grammar: ["g-n5-12-01"] });
assert.deepStrictEqual(tagged.grammar, ["g-n5-12-01"]);
assert.deepStrictEqual(tagged.tags, ["g-n5-12-01"]);

assert.strictEqual(logic.continueAllowed(1000, 1000), false);
assert.strictEqual(logic.continueAllowed(1000, 1399), false);
assert.strictEqual(logic.continueAllowed(1000, 1400), true);
assert.strictEqual(logic.continueAllowed(1000, 2000), true);
assert.strictEqual(logic.continueAllowed(null, 2000), true);
assert.strictEqual(logic.nextAttemptNo([null, { questionId: "q1" }, null], "q1"), 2);

const retiredRecords = [
  null,
  { questionId: "q-n5-12-036", correct: false },
  { questionId: "q-n5-12-045", correct: false },
  { questionId: "q-n5-12-001", correct: false },
  { note: "missing id" }
];
const retiredDropped = logic.dropUnknownQuestions(retiredRecords);
assert.deepStrictEqual(retiredDropped.map((row) => row.questionId), ["q-n5-12-001"]);
const knownOnly = logic.dropUnknownQuestions(retiredRecords.concat([{ questionId: "q-old", correct: false }]), ["q-n5-12-001"]);
assert.deepStrictEqual(knownOnly.map((row) => row.questionId), ["q-n5-12-001"]);
assert.doesNotThrow(() => logic.mistakeNotebook(retiredRecords, "2026-10-02"));
assert.doesNotThrow(() => logic.nextAttemptNo(retiredRecords, "q-n5-12-060"));

const unit12 = JSON.parse(fs.readFileSync(require("path").join(__dirname, "../content/units/unit-n5-12.json"), "utf8"));
function findQuestion(id) {
  let found = null;
  (function walk(node) {
    if (!node || found) return;
    if (Array.isArray(node)) node.forEach(walk);
    else if (typeof node === "object") {
      if (node.id === id && node.stem) found = node;
      Object.keys(node).forEach((key) => walk(node[key]));
    }
  })(unit12);
  return found;
}
const q060 = findQuestion("q-n5-12-060");
const q061 = findQuestion("q-n5-12-061");
assert.strictEqual(q060.stem.hideReading, true);
const before060 = logic.stemFields(q060.stem, false);
assert.strictEqual(before060.ja, "帰る");
assert.strictEqual(before060.zh, "回去；回家");
assert.strictEqual(before060.reading, "");
const after060 = logic.stemFields(q060.stem, true);
assert.strictEqual(after060.reading, "かえる");
const before061 = logic.stemFields(q061.stem, false);
assert.strictEqual(before061.ja, q061.stem.ja);
assert.strictEqual(before061.reading, q061.stem.reading);
assert.notStrictEqual(before061.reading, "");
assert.strictEqual(q061.stem.hideReading, undefined);

console.log("logic tests ok");
