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

console.log("logic tests ok");
