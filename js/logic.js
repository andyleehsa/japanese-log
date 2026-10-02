(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JPLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var WEAK_THRESHOLD = 0.8;
  var COMPLETION_ACCURACY = 0.7;

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

  var REVIEW_INTERVALS = [2, 5, 10];

  function reviewInterval(wrongStreak) {
    var index = Math.min(Math.max(wrongStreak, 1), REVIEW_INTERVALS.length) - 1;
    return REVIEW_INTERVALS[index];
  }

  function dueReviews(attempts, today) {
    var day = today || todayLocalDate();
    var byQuestion = new Map();
    (attempts || []).forEach(function (attempt) {
      if (!attempt || !attempt.questionId) return;
      if (!byQuestion.has(attempt.questionId)) byQuestion.set(attempt.questionId, []);
      byQuestion.get(attempt.questionId).push(attempt);
    });
    var due = [];
    byQuestion.forEach(function (list, questionId) {
      var sorted = list.slice().sort(function (a, b) {
        return String(a.timestamp || "").localeCompare(String(b.timestamp || "")) || String(a.id || "").localeCompare(String(b.id || ""));
      });
      var last = sorted[sorted.length - 1];
      if (!last || last.correct) return;
      var streak = 0;
      for (var i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].correct) break;
        streak += 1;
      }
      var from = last.localDate || String(last.timestamp || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return;
      var interval = reviewInterval(streak);
      var dueDate = addDays(from, interval);
      if (dueDate > day) return;
      due.push({
        questionId: questionId,
        lessonId: last.lessonId || "",
        due: dueDate,
        interval: interval,
        wrongStreak: streak,
        lastAt: last.timestamp || ""
      });
    });
    due.sort(function (a, b) {
      return String(a.due).localeCompare(String(b.due)) || String(a.questionId).localeCompare(String(b.questionId));
    });
    return due;
  }

  function makeAttempt(options) {
    var question = options.question;
    var when = formatLocalTimestamp(options.now || new Date());
    var attempt = {
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
    if (options.review) attempt.review = true;
    return attempt;
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

  function latestCompletePass(lesson, attempts) {
    var questions = lesson && Array.isArray(lesson.questions) ? lesson.questions : [];
    var ids = [];
    var seen = {};
    questions.forEach(function (question) {
      if (!question || !question.id || seen[question.id]) return;
      seen[question.id] = true;
      ids.push(question.id);
    });
    var needed = ids.length;
    if (!needed || !lesson) return { complete: false, accuracy: null, correct: 0, total: needed };
    var allowed = {};
    ids.forEach(function (id) { allowed[id] = true; });
    var related = [];
    (attempts || []).forEach(function (attempt, index) {
      if (!attempt || attempt.lessonId !== lesson.id || !allowed[attempt.questionId]) return;
      related.push({ attempt: attempt, index: index });
    });
    related.sort(function (a, b) {
      var at = String(a.attempt.timestamp || "");
      var bt = String(b.attempt.timestamp || "");
      if (at !== bt) return at < bt ? -1 : 1;
      return a.index - b.index;
    });
    var last = null;
    var open = {};
    var count = 0;
    related.forEach(function (item) {
      var qid = item.attempt.questionId;
      if (Object.prototype.hasOwnProperty.call(open, qid)) {
        open = {};
        count = 0;
      }
      open[qid] = !!item.attempt.correct;
      count += 1;
      if (count === needed) {
        var correct = 0;
        ids.forEach(function (id) { if (open[id]) correct += 1; });
        last = { correct: correct, total: needed, accuracy: correct / needed };
        open = {};
        count = 0;
      }
    });
    if (!last) return { complete: false, accuracy: null, correct: 0, total: needed };
    return { complete: true, accuracy: last.accuracy, correct: last.correct, total: last.total };
  }

  function lessonStanding(lesson, attempts, threshold) {
    var pass = latestCompletePass(lesson, attempts);
    var progress = lessonProgress(lesson, attempts);
    var limit = threshold == null ? COMPLETION_ACCURACY : threshold;
    return {
      done: !!(pass.complete && pass.accuracy != null && pass.accuracy >= limit),
      complete: pass.complete,
      accuracy: pass.complete ? pass.accuracy : null,
      correct: pass.correct,
      total: pass.total,
      attempts: progress.attempts,
      answered: progress.answered,
      questionTotal: progress.total
    };
  }

  function lessonIsDone(lesson, attempts, threshold) {
    return lessonStanding(lesson, attempts, threshold).done;
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
          var standing = lesson ? lessonStanding(lesson, attempts, threshold) : { done: false, complete: false, attempts: 0, correct: 0, accuracy: null, total: 0 };
          return {
            lessonId: lessonId,
            title: (lesson && lesson.title) || lessonId,
            done: standing.done,
            completed: !!standing.complete,
            attempts: standing.attempts,
            correct: standing.correct,
            questionTotal: standing.complete ? standing.total : 0,
            accuracy: standing.accuracy
          };
        });
        var doneCount = lessons.filter(function (lesson) { return lesson.done; }).length;
        var poolCorrect = 0;
        var poolTotal = 0;
        lessons.forEach(function (lesson) {
          if (!lesson.completed || !(lesson.questionTotal > 0)) return;
          poolCorrect += lesson.correct;
          poolTotal += lesson.questionTotal;
        });
        var accuracy = poolTotal > 0 ? poolCorrect / poolTotal : null;
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
      rule: "A lesson is done when the latest complete pass (every question answered once in that pass; an unfinished pass does not replace it) has accuracy of at least completionAccuracy. Topic accuracy pools each linked lesson's latest complete pass (sum of correct answers ÷ sum of question counts; lessons with no complete pass are omitted; null if none). Topic percent = done lessons / planned (planned defaults to linked lesson count). A topic is complete when done lessons reach planned. Level percent is the average of topic percents. Review is never blocked by order.",
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

  function examplePendingVerify(example) {
    return !!(example && example.verified === false);
  }

  function entryPendingVerify(entry) {
    return !!(entry && entry.verified === false);
  }

  function formatPercent(accuracy) {
    if (accuracy == null) return "未有紀錄";
    return Math.round(accuracy * 100) + "%";
  }

  function dayHeading(title) {
    var text = String(title || "");
    var head = text.split("：")[0];
    return head || text;
  }

  function homeLessonPlan(lessons, attempts, skippedIds, threshold) {
    var list = Array.isArray(lessons) ? lessons : [];
    var skipped = {};
    (skippedIds || []).forEach(function (id) {
      if (id) skipped[id] = true;
    });
    var limit = threshold == null ? COMPLETION_ACCURACY : threshold;
    var rows = list.map(function (lesson) {
      var standing = lessonStanding(lesson, attempts || [], limit);
      return {
        id: lesson && lesson.id,
        title: (lesson && lesson.title) || (lesson && lesson.id) || "",
        done: standing.done,
        accuracy: standing.accuracy,
        attempts: standing.attempts || 0
      };
    }).filter(function (row) { return row.id; });
    if (!rows.length) return { kind: "empty" };
    if (rows.every(function (row) { return row.done; })) return { kind: "done" };
    var open = rows.filter(function (row) { return !row.done && !skipped[row.id]; });
    if (!open.length) open = rows.filter(function (row) { return !row.done; });
    var current = open[0];
    var mode = current.attempts > 0 ? "retry" : "new";
    return {
      kind: "lesson",
      lessonId: current.id,
      title: current.title,
      mode: mode,
      accuracy: current.accuracy,
      button: mode === "retry" ? "再練一次" : "開始今日課堂",
      heading: mode === "retry"
        ? dayHeading(current.title) + "再練一次（上次 " + formatPercent(current.accuracy) + "）"
        : current.title,
      skipLessonId: open.length > 1 ? open[1].id : null
    };
  }

  function formatDateLabel(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return String(iso || "");
    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  var FONT_STEPS = ["standard", "large", "xlarge"];
  var FONT_LABELS = { standard: "標準", large: "大", xlarge: "特大" };
  var CHOICE_GRID_MAX = 6;
  var MIN_JP = { flash: 32, practice: 24 };
  var COLORS = {
    brand: "#F5A623",
    brandInk: "#3A2600",
    bg: "#FAF7F2",
    paper: "#FFFFFF",
    ink: "#222222",
    muted: "#6B6B6B",
    accent: "#A85600",
    ok: "#2E9E5B",
    okText: "#1F7A43",
    okBg: "#E5F6EC",
    okTick: "#0E2416",
    bad: "#D64545",
    badText: "#C13B3B",
    badBg: "#FDECEC",
    example: "#C0392B",
    codeBg: "#FFF8EE",
    disabled: "#E6E2DA",
    tableHead: "#9A3412",
    tableHeadText: "#FFFFFF",
    line: "#E4DFD6"
  };

  function normalizeFontSize(value) {
    return FONT_STEPS.indexOf(value) === -1 ? "standard" : value;
  }

  function stepFontSize(value, delta) {
    var index = FONT_STEPS.indexOf(normalizeFontSize(value));
    var next = index + (Number(delta) || 0);
    if (next < 0) next = 0;
    if (next >= FONT_STEPS.length) next = FONT_STEPS.length - 1;
    return FONT_STEPS[next];
  }

  function choiceLayout(choices) {
    var list = Array.isArray(choices) ? choices : [];
    if (list.length < 2) return "stack";
    var long = list.some(function (choice) {
      return String(choice == null ? "" : choice).trim().length > CHOICE_GRID_MAX;
    });
    return long ? "stack" : "grid";
  }

  function confirmReady(state) {
    var current = state || {};
    if (current.locked) return false;
    if (current.mode === "choice") return typeof current.picked === "number" && current.picked >= 0;
    if (current.mode === "fill") return String(current.text == null ? "" : current.text).trim().length > 0;
    return false;
  }

  function feedbackPanel(input) {
    var data = input || {};
    var correct = !!data.correct;
    var answer = data.answer == null ? "" : String(data.answer);
    var rule = String(data.rule == null ? "" : data.rule).trim();
    var explanation = String(data.explanation == null ? "" : data.explanation).trim();
    if (correct) {
      return { tone: "ok", title: "正確", lines: [], detail: explanation };
    }
    var ruleText = rule || explanation;
    var detail = rule && explanation && explanation !== rule ? explanation : "";
    return {
      tone: "bad",
      title: "再睇下",
      lines: [
        { label: "正確答案", text: answer },
        { label: "規則", text: ruleText }
      ],
      detail: detail
    };
  }

  function roadmapStatus(standing, isNext) {
    if (standing && standing.done) return "passed";
    if (isNext) return "next";
    return "todo";
  }

  function roadmapMarks(lessons, attempts, threshold) {
    var list = Array.isArray(lessons) ? lessons : [];
    var limit = threshold == null ? COMPLETION_ACCURACY : threshold;
    var rows = list.map(function (lesson) {
      var standing = lessonStanding(lesson, attempts || [], limit);
      return { id: lesson && lesson.id, done: !!standing.done };
    }).filter(function (row) { return row.id; });
    var nextId = null;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].done) {
        nextId = rows[i].id;
        break;
      }
    }
    return rows.map(function (row) {
      return { id: row.id, status: roadmapStatus({ done: row.done }, row.id === nextId) };
    });
  }

  function channelLuma(value) {
    var s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  function hexLuminance(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n) || h.length !== 6) return 0;
    return 0.2126 * channelLuma((n >> 16) & 255) + 0.7152 * channelLuma((n >> 8) & 255) + 0.0722 * channelLuma(n & 255);
  }

  function contrastRatio(foreground, background) {
    var a = hexLuminance(foreground);
    var b = hexLuminance(background);
    var hi = Math.max(a, b);
    var lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }

  return {
    WEAK_THRESHOLD: WEAK_THRESHOLD,
    COMPLETION_ACCURACY: COMPLETION_ACCURACY,
    REVIEW_INTERVALS: REVIEW_INTERVALS,
    reviewInterval: reviewInterval,
    dueReviews: dueReviews,
    lessonIsDone: lessonIsDone,
    lessonStanding: lessonStanding,
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
    examplePendingVerify: examplePendingVerify,
    homeLessonPlan: homeLessonPlan,
    entryPendingVerify: entryPendingVerify,
    formatPercent: formatPercent,
    formatDateLabel: formatDateLabel,
    studyDates: studyDates,
    currentStreak: currentStreak,
    longestStreak: longestStreak,
    FONT_STEPS: FONT_STEPS,
    FONT_LABELS: FONT_LABELS,
    CHOICE_GRID_MAX: CHOICE_GRID_MAX,
    MIN_JP: MIN_JP,
    COLORS: COLORS,
    normalizeFontSize: normalizeFontSize,
    stepFontSize: stepFontSize,
    choiceLayout: choiceLayout,
    confirmReady: confirmReady,
    feedbackPanel: feedbackPanel,
    roadmapStatus: roadmapStatus,
    roadmapMarks: roadmapMarks,
    contrastRatio: contrastRatio
  };
});
