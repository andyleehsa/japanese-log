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

const summary = logic.buildSummary(stats, {
  titles: { "day-001": "題" },
  lookup: () => ({ prompt: "題目", correctAnswer: "あれ", lessonTitle: "題" }),
  generatedAt: "2026-10-02T00:00:00.000Z",
  lastSyncedAt: "2026-10-02T00:00:00.000Z"
});
assert.strictEqual(summary.mistakes[0].prompt, "題目");
assert.strictEqual(summary.weakThreshold, 0.8);
assert.strictEqual(summary.lastStudyDate, "2026-10-02");
assert.strictEqual(summary.curriculum, null);
assert.strictEqual(summary.vocab, null);

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

console.log("logic tests ok");
