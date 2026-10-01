(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JPLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var WEAK_THRESHOLD = 0.8;
  var COMPLETION_ACCURACY = 0.8;

  function normalizeAnswer(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .trim();
  }

  function answersMatch(userAnswer, accepted) {
    var normalized = normalizeAnswer(userAnswer);
    if (!normalized) return false;
    var list = Array.isArray(accepted) ? accepted : [];
    for (var i = 0; i < list.length; i++) {
      if (normalizeAnswer(list[i]) === normalized) return true;
    }
    return false;
  }

  function grade(question, userAnswer) {
    if (!question) return false;
    if (question.type === "choice" || (question.type === "listening" && Array.isArray(question.choices))) {
      return Number(userAnswer) === question.answer;
    }
    if (question.type === "fill" || question.type === "listening") {
      return answersMatch(userAnswer, question.accepted);
    }
    return false;
  }

  function correctAnswerText(question) {
    if (!question) return "";
    if ((question.type === "choice" || question.type === "listening") && Array.isArray(question.choices)) {
      var choice = question.choices[question.answer];
      return choice == null ? "" : String(choice);
    }
    if (Array.isArray(question.accepted) && question.accepted.length) return String(question.accepted[0]);
    return "";
  }

  function userAnswerText(question, userAnswer) {
    if ((question.type === "choice" || (question.type === "listening" && Array.isArray(question.choices))) && Array.isArray(question.choices)) {
      var choice = question.choices[Number(userAnswer)];
      return choice == null ? String(userAnswer) : String(choice);
    }
    return String(userAnswer == null ? "" : userAnswer).trim();
  }

  function mergeAttempts(lists) {
    var map = new Map();
    (lists || []).forEach(function (list) {
      (list || []).forEach(function (attempt) {
        if (!attempt || !attempt.id) return;
        if (!map.has(attempt.id)) map.set(attempt.id, attempt);
      });
    });
    return Array.from(map.values()).sort(function (a, b) {
      return String(a.timestamp || "").localeCompare(String(b.timestamp || "")) || String(a.id).localeCompare(String(b.id));
    });
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatLocalTimestamp(date) {
    var y = date.getFullYear();
    var m = pad(date.getMonth() + 1);
    var d = pad(date.getDate());
    var hh = pad(date.getHours());
    var mm = pad(date.getMinutes());
    var ss = pad(date.getSeconds());
    var offMin = -date.getTimezoneOffset();
    var sign = offMin >= 0 ? "+" : "-";
    var abs = Math.abs(offMin);
    var localDate = y + "-" + m + "-" + d;
    return {
      timestamp: localDate + "T" + hh + ":" + mm + ":" + ss + sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60),
      localDate: localDate
    };
  }

  function todayLocalDate(now) {
    return formatLocalTimestamp(now || new Date()).localDate;
  }

  function addDays(isoDate, delta) {
    var parts = String(isoDate).split("-").map(Number);
    var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  function monthKey(attempt) {
    var date = attempt && (attempt.localDate || String(attempt.timestamp || "").slice(0, 10));
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
  }

  function groupAttemptsByMonth(attempts) {
    var groups = {};
    (attempts || []).forEach(function (attempt) {
      var key = monthKey(attempt);
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(attempt);
    });
    return groups;
  }

  function newId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function uniqueStrings(list) {
    var out = [];
    var seen = new Set();
    (list || []).forEach(function (item) {
      if (typeof item !== "string" || seen.has(item)) return;
      seen.add(item);
      out.push(item);
    });
    return out;
  }

  function makeAttempt(options) {
    var question = options.question;
    var when = formatLocalTimestamp(options.now || new Date());
    return {
      id: options.id || newId(),
      questionId: question.id,
      lessonId: options.lessonId,
      tags: uniqueStrings(question.tags),
      userAnswer: options.userAnswerText,
      correct: !!options.correct,
      timestamp: when.timestamp,
      localDate: when.localDate,
      attemptNo: options.attemptNo
    };
  }

  function tally(list) {
    var total = list.length;
    var correct = 0;
    list.forEach(function (attempt) {
      if (attempt && attempt.correct) correct += 1;
    });
    return {
      attempts: total,
      correct: correct,
      accuracy: total ? correct / total : null,
      errorRate: total ? (total - correct) / total : null
    };
  }

  function studyDates(attempts) {
    var set = new Set();
    (attempts || []).forEach(function (attempt) {
      var date = attempt.localDate || String(attempt.timestamp || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) set.add(date);
    });
    return Array.from(set).sort();
  }

  function currentStreak(dates, today) {
    var set = new Set(dates);
    var cursor = today;
    if (!set.has(cursor)) {
      cursor = addDays(today, -1);
      if (!set.has(cursor)) return 0;
    }
    var count = 0;
    while (set.has(cursor)) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  function longestStreak(dates) {
    if (!dates.length) return 0;
    var best = 1;
    var run = 1;
    for (var i = 1; i < dates.length; i++) {
      if (addDays(dates[i - 1], 1) === dates[i]) {
        run += 1;
        if (run > best) best = run;
      } else if (dates[i] !== dates[i - 1]) {
        run = 1;
      }
    }
    return best;
  }

  function computeStats(attempts, options) {
    var opts = options || {};
    var today = opts.today || todayLocalDate();
    var titles = opts.lessonTitles || {};
    var list = Array.isArray(attempts) ? attempts : [];
    var dates = studyDates(list);
    var byLesson = new Map();
    var byTag = new Map();
    var byQuestion = new Map();

    list.forEach(function (attempt) {
      if (!attempt) return;
      var lessonId = attempt.lessonId || "";
      if (!byLesson.has(lessonId)) byLesson.set(lessonId, []);
      byLesson.get(lessonId).push(attempt);
      uniqueStrings(attempt.tags).forEach(function (tag) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push(attempt);
      });
      if (!attempt.questionId) return;
      if (!byQuestion.has(attempt.questionId)) byQuestion.set(attempt.questionId, []);
      byQuestion.get(attempt.questionId).push(attempt);
    });

    var perLesson = Array.from(byLesson.entries()).map(function (entry) {
      return Object.assign({ lessonId: entry[0], title: titles[entry[0]] || entry[0] }, tally(entry[1]));
    }).sort(function (a, b) {
      return String(a.lessonId).localeCompare(String(b.lessonId));
    });

    var perTag = Array.from(byTag.entries()).map(function (entry) {
      return Object.assign({ tag: entry[0] }, tally(entry[1]));
    }).sort(function (a, b) {
      return (b.errorRate || 0) - (a.errorRate || 0) || b.attempts - a.attempts || String(a.tag).localeCompare(String(b.tag));
    });

    var perQuestion = Array.from(byQuestion.entries()).map(function (entry) {
      var sorted = entry[1].slice().sort(function (a, b) {
        return String(a.timestamp || "").localeCompare(String(b.timestamp || ""));
      });
      var last = sorted[sorted.length - 1];
      var stats = tally(sorted);
      return Object.assign({
        questionId: entry[0],
        lessonId: last.lessonId || "",
        tags: uniqueStrings(last.tags),
        lastCorrect: !!last.correct,
        lastUserAnswer: last.userAnswer,
        lastAt: last.timestamp,
        wrongCount: sorted.filter(function (attempt) { return !attempt.correct; }).length
      }, stats);
    });

    var weakTags = perTag.filter(function (tag) {
      return tag.attempts > 0 && tag.accuracy < WEAK_THRESHOLD;
    });
    var weakQuestions = perQuestion.filter(function (question) {
      return !question.lastCorrect;
    }).sort(function (a, b) {
      return (b.errorRate || 0) - (a.errorRate || 0) || b.attempts - a.attempts;
    });

    var byDate = dates.map(function (date) {
      return Object.assign({ date: date }, tally(list.filter(function (attempt) {
        return (attempt.localDate || String(attempt.timestamp || "").slice(0, 10)) === date;
      })));
    });

    return {
      schemaVersion: 1,
      today: today,
      lastStudyDate: dates.length ? dates[dates.length - 1] : null,
      streak: {
        current: currentStreak(dates, today),
        longest: longestStreak(dates),
        studyDates: dates
      },
      overall: tally(list),
      perLesson: perLesson,
      perTag: perTag,
      weakThreshold: WEAK_THRESHOLD,
      weakTags: weakTags,
      weakQuestions: weakQuestions,
      mistakes: weakQuestions.map(function (question) {
        return {
          questionId: question.questionId,
          lessonId: question.lessonId,
          tags: question.tags,
          lastUserAnswer: question.lastUserAnswer,
          lastAt: question.lastAt,
          wrongCount: question.wrongCount,
          attempts: question.attempts,
          correct: question.correct,
          accuracy: question.accuracy,
          errorRate: question.errorRate
        };
      }),
      byDate: byDate
    };
  }

  function lessonProgress(lesson, attempts) {
    var questions = lesson && Array.isArray(lesson.questions) ? lesson.questions : [];
    var related = (attempts || []).filter(function (attempt) {
      return attempt.lessonId === lesson.id;
    });
    var done = new Set(related.map(function (attempt) { return attempt.questionId; }));
    var answered = questions.filter(function (question) { return done.has(question.id); }).length;
    return Object.assign({
      answered: answered,
      total: questions.length,
      completed: questions.length > 0 && answered === questions.length
    }, tally(related));
  }

  function nextAttemptNo(attempts, questionId) {
    var count = 0;
    (attempts || []).forEach(function (attempt) {
      if (attempt.questionId === questionId) count += 1;
    });
    return count + 1;
  }

  function lessonIsDone(progress, threshold) {
    var limit = threshold == null ? COMPLETION_ACCURACY : threshold;
    return !!(progress && progress.total > 0 && progress.completed && progress.accuracy != null && progress.accuracy >= limit);
  }

  function curriculumReport(curriculum, lessonMap, attempts) {
    var source = curriculum && Array.isArray(curriculum.levels) ? curriculum : { levels: [] };
    var threshold = typeof source.completionAccuracy === "number" ? source.completionAccuracy : COMPLETION_ACCURACY;
    var levels = source.levels.map(function (level) {
      var topics = (level.topics || []).map(function (topic) {
        var lessonIds = Array.isArray(topic.lessonIds) ? topic.lessonIds : [];
        var planned = topic.planned == null ? lessonIds.length : topic.planned;
        var lessons = lessonIds.map(function (lessonId) {
          var lesson = lessonMap && lessonMap[lessonId];
          var progress = lesson ? lessonProgress(lesson, attempts) : { attempts: 0, correct: 0, accuracy: null, completed: false, total: 0 };
          return {
            lessonId: lessonId,
            title: (lesson && lesson.title) || lessonId,
            done: lessonIsDone(progress, threshold),
            completed: !!progress.completed,
            attempts: progress.attempts,
            correct: progress.correct,
            accuracy: progress.accuracy
          };
        });
        var doneCount = lessons.filter(function (lesson) { return lesson.done; }).length;
        var related = (attempts || []).filter(function (attempt) {
          return lessonIds.indexOf(attempt.lessonId) !== -1;
        });
        var accuracy = tally(related).accuracy;
        return {
          id: topic.id,
          title: topic.title,
          description: topic.description || "",
          level: topic.level || level.level,
          planned: planned,
          lessonIds: lessonIds,
          lessons: lessons,
          doneCount: doneCount,
          percent: planned > 0 ? doneCount / planned : 0,
          complete: planned > 0 && doneCount >= planned,
          accuracy: accuracy
        };
      });
      var percent = topics.length ? topics.reduce(function (sum, topic) { return sum + topic.percent; }, 0) / topics.length : 0;
      return {
        level: level.level,
        percent: percent,
        topicCount: topics.length,
        completeTopics: topics.filter(function (topic) { return topic.complete; }).length,
        topics: topics
      };
    });
    return {
      completionAccuracy: threshold,
      rule: "A lesson is done when every question has at least one attempt and accuracy is at least completionAccuracy. Topic percent = done lessons / planned (planned defaults to linked lesson count). A topic is complete when done lessons reach planned. Level percent is the average of topic percents. Review is never blocked by order.",
      levels: levels
    };
  }

  function mergeVocabMarks(lists) {
    var map = new Map();
    (lists || []).forEach(function (list) {
      (list || []).forEach(function (mark) {
        if (!mark || !mark.id || (mark.status !== "known" && mark.status !== "unknown")) return;
        var prev = map.get(mark.id);
        if (!prev || String(mark.updatedAt || "") > String(prev.updatedAt || "")) map.set(mark.id, mark);
      });
    });
    return Array.from(map.values()).sort(function (a, b) {
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function vocabReport(banks, marks) {
    var byId = {};
    (marks || []).forEach(function (mark) {
      if (mark && mark.id) byId[mark.id] = mark;
    });
    var byLevel = [];
    var unknown = [];
    (banks || []).forEach(function (bank) {
      var knownCount = 0;
      var unknownCount = 0;
      var total = 0;
      (bank.categories || []).forEach(function (category) {
        (category.entries || []).forEach(function (entry) {
          total += 1;
          var mark = byId[entry.id];
          if (!mark) return;
          if (mark.status === "known") knownCount += 1;
          if (mark.status === "unknown") {
            unknownCount += 1;
            unknown.push({
              id: entry.id,
              level: entry.level || bank.level,
              category: entry.category || category.id,
              categoryTitle: category.title || "",
              japanese: entry.japanese || "",
              reading: entry.reading || "",
              meaning: entry.meaning || "",
              status: "unknown",
              updatedAt: mark.updatedAt || ""
            });
          }
        });
      });
      byLevel.push({
        level: bank.level,
        total: total,
        known: knownCount,
        unknown: unknownCount,
        unmarked: total - knownCount - unknownCount,
        percent: total ? knownCount / total : null
      });
    });
    unknown.sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt)) || String(a.id).localeCompare(String(b.id));
    });
    return { byLevel: byLevel, unknown: unknown };
  }

  function buildSummary(stats, extras) {
    var info = extras || {};
    var lookup = info.lookup || function () { return null; };
    function enrich(item) {
      var found = lookup(item.questionId) || {};
      return {
        questionId: item.questionId,
        lessonId: item.lessonId,
        lessonTitle: found.lessonTitle || info.titles && info.titles[item.lessonId] || item.lessonId,
        prompt: found.prompt || "",
        correctAnswer: found.correctAnswer || "",
        tags: item.tags || [],
        lastUserAnswer: item.lastUserAnswer,
        lastAt: item.lastAt,
        wrongCount: item.wrongCount,
        attempts: item.attempts,
        correct: item.correct,
        accuracy: item.accuracy,
        errorRate: item.errorRate
      };
    }
    return {
      schemaVersion: 1,
      generatedAt: info.generatedAt || null,
      lastSyncedAt: info.lastSyncedAt || null,
      lastStudyDate: stats.lastStudyDate,
      timezoneNote: "attempt.timestamp carries the device offset; lastSyncedAt is UTC.",
      streak: stats.streak,
      overall: stats.overall,
      perLesson: stats.perLesson,
      perTag: stats.perTag,
      weakThreshold: stats.weakThreshold,
      weakTags: stats.weakTags,
      weakQuestions: stats.weakQuestions.map(enrich),
      mistakes: stats.mistakes.map(enrich),
      curriculum: info.curriculum || null,
      vocab: info.vocab || null
    };
  }

  function formatPercent(accuracy) {
    if (accuracy == null) return "未有紀錄";
    return Math.round(accuracy * 100) + "%";
  }

  function formatDateLabel(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return String(iso || "");
    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  return {
    WEAK_THRESHOLD: WEAK_THRESHOLD,
    COMPLETION_ACCURACY: COMPLETION_ACCURACY,
    lessonIsDone: lessonIsDone,
    curriculumReport: curriculumReport,
    mergeVocabMarks: mergeVocabMarks,
    vocabReport: vocabReport,
    normalizeAnswer: normalizeAnswer,
    answersMatch: answersMatch,
    grade: grade,
    correctAnswerText: correctAnswerText,
    userAnswerText: userAnswerText,
    mergeAttempts: mergeAttempts,
    formatLocalTimestamp: formatLocalTimestamp,
    todayLocalDate: todayLocalDate,
    addDays: addDays,
    monthKey: monthKey,
    groupAttemptsByMonth: groupAttemptsByMonth,
    newId: newId,
    makeAttempt: makeAttempt,
    computeStats: computeStats,
    lessonProgress: lessonProgress,
    nextAttemptNo: nextAttemptNo,
    buildSummary: buildSummary,
    formatPercent: formatPercent,
    formatDateLabel: formatDateLabel,
    studyDates: studyDates,
    currentStreak: currentStreak,
    longestStreak: longestStreak
  };
});
