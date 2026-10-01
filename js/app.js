(function () {
  var state = {
    index: null,
    lessons: [],
    error: "",
    loading: true
  };
  var session = null;
  var syncing = false;
  var ui = { syncError: "" };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/\r\n/g, "\n")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function jaSpan(value) {
    var text = String(value == null ? "" : value);
    var ja = /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
    return "<span" + (ja ? " class=\"jp\" lang=\"ja\"" : "") + ">" + escapeHtml(text) + "</span>";
  }

  function safeAudio(url) {
    if (typeof url !== "string") return "";
    var value = url.trim();
    if (!value || /javascript:/i.test(value) || value.indexOf("..") !== -1) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[A-Za-z0-9._/-]+$/.test(value)) return value;
    return "";
  }

  function speakButton(text) {
    if (!text || !window.JPSpeech.supported()) return "";
    return "<button type=\"button\" class=\"speak\" data-speak=\"" + escapeHtml(text) + "\">讀出嚟</button>";
  }

  function audioElement(url) {
    var src = safeAudio(url);
    if (!src) return "";
    return "<audio controls preload=\"none\" src=\"" + escapeHtml(src) + "\"></audio>";
  }

  function renderTags(tags) {
    return (tags || []).map(function (tag) {
      return "<span class=\"tag\">" + escapeHtml(tag) + "</span>";
    }).join("");
  }

  function formatClock(iso) {
    if (!iso) return "未同步過";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("zh-HK", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function lessonById(id) {
    for (var i = 0; i < state.lessons.length; i++) {
      if (state.lessons[i] && state.lessons[i].id === id) return state.lessons[i];
    }
    return null;
  }

  function indexItem(id) {
    var items = (state.index && state.index.lessons) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function lessonTitles() {
    var titles = {};
    ((state.index && state.index.lessons) || []).forEach(function (item) {
      titles[item.id] = item.title;
    });
    state.lessons.forEach(function (lesson) {
      if (lesson && lesson.id && lesson.title) titles[lesson.id] = lesson.title;
    });
    return titles;
  }

  function findQuestion(questionId) {
    for (var i = 0; i < state.lessons.length; i++) {
      var lesson = state.lessons[i];
      var questions = (lesson && lesson.questions) || [];
      for (var j = 0; j < questions.length; j++) {
        if (questions[j].id === questionId) {
          return { lesson: lesson, question: questions[j] };
        }
      }
    }
    return null;
  }

  function lookupQuestion(questionId) {
    var found = findQuestion(questionId);
    if (!found) return null;
    return {
      prompt: found.question.prompt || "",
      correctAnswer: window.JPLogic.correctAnswerText(found.question),
      lessonTitle: found.lesson.title || found.lesson.id
    };
  }

  function parseRoute() {
    var raw = (location.hash || "#/").replace(/^#/, "");
    var parts = raw.split("/").filter(Boolean).map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    });
    var name = parts[0] || "home";
    if (name === "lesson" || name === "practice") return { name: name, id: parts[1] || "" };
    if (name === "log" || name === "mistakes" || name === "settings") return { name: name };
    return { name: "home" };
  }

  function renderBlock(block) {
    if (!block || typeof block !== "object") return "";
    if (block.type === "heading") return "<h2>" + inline(block.text || "") + "</h2>";
    if (block.type === "paragraph") {
      return "<p>" + inline(block.text || "") + "</p>" + speakButton(block.speak);
    }
    if (block.type === "tip") {
      return "<aside class=\"tip\"><p>" + inline(block.text || "") + "</p>" + speakButton(block.speak) + "</aside>";
    }
    if (block.type === "example") {
      return "<figure class=\"example\">"
        + "<p class=\"jp\" lang=\"ja\">" + escapeHtml(block.jp || "") + "</p>"
        + (block.reading ? "<p class=\"reading\" lang=\"ja\">" + escapeHtml(block.reading) + "</p>" : "")
        + (block.zh ? "<figcaption>" + escapeHtml(block.zh) + "</figcaption>" : "")
        + (block.note ? "<p class=\"note\">" + inline(block.note) + "</p>" : "")
        + speakButton(block.speak)
        + audioElement(block.audio)
        + "</figure>";
    }
    if (block.type === "vocab") {
      var rows = (block.items || []).map(function (item) {
        return "<li><span class=\"jp\" lang=\"ja\">" + escapeHtml(item.word || "") + "</span>"
          + "<span class=\"reading\" lang=\"ja\">" + escapeHtml(item.reading || "") + "</span>"
          + "<span class=\"meaning\">" + escapeHtml(item.meaning || "") + "</span>"
          + speakButton(item.speak)
          + "</li>";
      }).join("");
      return "<section class=\"vocab\"><h2>" + escapeHtml(block.caption || "詞彙") + "</h2><ul>" + rows + "</ul></section>";
    }
    return "";
  }

  function statusLine() {
    var text = "上次同步：" + formatClock(window.JPStore.getLastSynced());
    if (window.JPStore.isPending() && window.JPStore.getToken()) text += " · 有紀錄未同步";
    if (!navigator.onLine) text += " · 離線";
    return text;
  }

  function banner() {
    var bits = [];
    if (!navigator.onLine) bits.push("離線模式：睇到之前載入過嘅課題。");
    if (!window.JPStore.persistent()) bits.push("呢部機可能儲存唔到紀錄。請關閉私密瀏覽，再用普通 Safari 開。");
    if (state.error) bits.push(state.error);
    if (!bits.length && !ui.syncError) return "";
    var html = "";
    if (bits.length) html += "<div class=\"banner\" id=\"net-banner\">" + bits.map(escapeHtml).join("<br>") + "</div>";
    if (ui.syncError) html += "<div class=\"banner is-bad\">" + escapeHtml(ui.syncError) + "</div>";
    return html;
  }

  function renderPrompt(text) {
    return inline(text).replace(/___/g, "<span class=\"blank\" role=\"presentation\"></span>");
  }

  function questionMode(question) {
    if (question.type === "listening") return Array.isArray(question.choices) ? "choice" : "fill";
    return question.type;
  }

  function renderHome() {
    var attempts = window.JPStore.loadAttempts();
    var stats = window.JPLogic.computeStats(attempts, { lessonTitles: lessonTitles() });
    var todayItem = pickToday(attempts);
    var todayLesson = todayItem ? lessonById(todayItem.id) : null;
    var todayHtml;
    if (!todayItem) {
      todayHtml = "<section class=\"card\"><h1>未有課題</h1><p>老師未放課題。放咗之後撳下面「重新載入課題」。</p></section>";
    } else {
      var progress = todayLesson ? window.JPLogic.lessonProgress(todayLesson, attempts) : null;
      var label = todayItem.date === window.JPLogic.todayLocalDate() ? "今日課題" : (progress && progress.completed ? "最新課題" : "下一課");
      todayHtml = "<a class=\"card today\" href=\"#/lesson/" + encodeURIComponent(todayItem.id) + "\">"
        + "<p class=\"kicker\">" + escapeHtml(label) + (isSample(todayLesson, todayItem) ? " · 樣本" : "") + "</p>"
        + "<h1 class=\"jp\" lang=\"ja\">" + escapeHtml(todayItem.title) + "</h1>"
        + "<p class=\"meta\">" + escapeHtml(window.JPLogic.formatDateLabel(todayItem.date)) + "</p>"
        + "<p class=\"tags\">" + renderTags(todayItem.tags) + "</p>"
        + "<p class=\"meta\">" + progressText(progress) + "</p>"
        + "<span class=\"btn\">開始溫習</span>"
        + "</a>";
    }
    var list = ((state.index && state.index.lessons) || []).map(function (item) {
      var lesson = lessonById(item.id);
      var progress = lesson ? window.JPLogic.lessonProgress(lesson, attempts) : null;
      return "<a class=\"card lesson-row\" href=\"#/lesson/" + encodeURIComponent(item.id) + "\">"
        + "<span class=\"row-title jp\" lang=\"ja\">" + escapeHtml(item.title) + "</span>"
        + "<span class=\"meta\">" + escapeHtml(window.JPLogic.formatDateLabel(item.date))
        + (isSample(lesson, item) ? " · 樣本" : "") + "</span>"
        + "<span class=\"tags\">" + renderTags(item.tags) + "</span>"
        + "<span class=\"meta\">" + progressText(progress) + "</span>"
        + "</a>";
    }).join("");
    return banner()
      + "<section class=\"stats\">"
      + statBox(String(stats.streak.current), "連續打卡（日）")
      + statBox(window.JPLogic.formatPercent(stats.overall.accuracy), "整體正確率", stats.overall.accuracy == null)
      + "</section>"
      + "<p class=\"meta\">最長連續 " + stats.streak.longest + " 日"
      + (stats.lastStudyDate ? " · 上次溫習 " + escapeHtml(window.JPLogic.formatDateLabel(stats.lastStudyDate)) : "")
      + "</p>"
      + todayHtml
      + "<p class=\"meta sync-line\">" + escapeHtml(statusLine()) + "</p>"
      + "<button type=\"button\" class=\"btn secondary\" data-action=\"sync\"" + (syncing ? " disabled" : "") + ">"
      + (syncing ? "同步緊……" : "同步畀老師") + "</button>"
      + "<button type=\"button\" class=\"btn ghost\" data-action=\"reload\">重新載入課題</button>"
      + "<h2>全部課題</h2>"
      + (list || "<p>未有課題。</p>");
  }

  function statBox(num, label, empty) {
    return "<div class=\"stat\"><span class=\"stat-num" + (empty ? " is-empty" : "") + "\">" + escapeHtml(num) + "</span><span class=\"stat-label\">" + escapeHtml(label) + "</span></div>";
  }

  function progressText(progress) {
    if (!progress || !progress.total) return "未有練習";
    if (!progress.attempts) return "未開始 · " + progress.total + " 題";
    var done = progress.completed ? "已完成" : (progress.answered + "/" + progress.total + " 題做過");
    return done + " · 正確率 " + window.JPLogic.formatPercent(progress.accuracy);
  }

  function isSample(lesson, item) {
    return !!((lesson && lesson.sample) || (item && item.sample));
  }

  function pickToday(attempts) {
    var items = (state.index && state.index.lessons) || [];
    if (!items.length) return null;
    var today = window.JPLogic.todayLocalDate();
    for (var i = 0; i < items.length; i++) {
      if (items[i].date === today) return items[i];
    }
    for (var j = 0; j < items.length; j++) {
      var lesson = lessonById(items[j].id);
      if (!lesson || lesson.loadError) continue;
      if (!window.JPLogic.lessonProgress(lesson, attempts).completed) return items[j];
    }
    return items[items.length - 1];
  }

  function renderLesson(id) {
    var item = indexItem(id);
    var lesson = lessonById(id);
    if (!item && !lesson) {
      return "<section class=\"panel\"><h1>搵唔到呢課</h1><p>可能老師未放，或者你離線未載入過。</p><a class=\"btn\" href=\"#/\">返回主頁</a></section>";
    }
    var title = (lesson && lesson.title) || (item && item.title) || id;
    var date = (lesson && lesson.date) || (item && item.date) || "";
    var level = lesson && lesson.level ? lesson.level : "";
    if (lesson && lesson.loadError) {
      return "<a class=\"back\" href=\"#/\">返回</a><h1 class=\"jp\" lang=\"ja\">" + escapeHtml(title) + "</h1><div class=\"banner is-bad\">呢課載入唔到。請駁返網絡再試。</div>";
    }
    var blocks = ((lesson && lesson.teaching) || []).map(renderBlock).join("");
    var count = lesson && lesson.questions ? lesson.questions.length : 0;
    return "<a class=\"back\" href=\"#/\">返回</a>"
      + "<p class=\"kicker\">" + escapeHtml(level ? level + " · " : "") + escapeHtml(window.JPLogic.formatDateLabel(date))
      + (isSample(lesson, item) ? " · 樣本課題" : "") + "</p>"
      + "<h1 class=\"jp\" lang=\"ja\">" + escapeHtml(title) + "</h1>"
      + "<div class=\"tags\">" + renderTags((lesson && lesson.tags) || (item && item.tags) || []) + "</div>"
      + "<article class=\"teaching\">" + blocks + "</article>"
      + (count ? "<a class=\"btn\" href=\"#/practice/" + encodeURIComponent(lesson.id) + "\">開始練習（" + count + " 題）</a>" : "<p>呢課未有練習。</p>");
  }

  function renderPractice() {
    if (!session || session.phase === "missing") {
      return "<section class=\"panel\"><h1>搵唔到呢課</h1><p>可能老師未放，或者你離線未載入過。</p><a class=\"btn\" href=\"#/\">返回主頁</a></section>";
    }
    if (session.phase === "empty") {
      return "<section class=\"panel\"><h1>" + escapeHtml(session.title || "練習") + "</h1><p>未有可以練嘅題。</p><a class=\"btn\" href=\"#/mistakes\">返回錯題本</a></section>";
    }
    if (session.phase === "done") return renderDone();
    var question = session.questions[session.index];
    var mode = questionMode(question);
    var total = session.questions.length;
    var answerUi;
    if (mode === "choice" && Array.isArray(question.choices)) answerUi = renderChoices(question);
    else if (mode === "fill") answerUi = renderFill(question);
    else answerUi = "<div class=\"banner\">呢種題目（" + escapeHtml(question.type || "") + "）暫時未支援。</div>"
      + "<button type=\"button\" class=\"btn secondary\" data-action=\"skip\">跳過呢題</button>";
    var feedback = "";
    if (session.locked && mode !== "unsupported") {
      var correct = session.results[session.results.length - 1].correct;
      var right = window.JPLogic.correctAnswerText(question);
      feedback = "<div class=\"feedback " + (correct ? "is-ok" : "is-bad") + "\" role=\"status\">"
        + "<p class=\"feedback-title\">" + (correct ? "啱！" : "錯咗") + "</p>"
        + (correct ? "" : "<p>正確答案：" + jaSpan(right) + "</p>")
        + "<p>" + inline(question.explanation || "") + "</p>"
        + "</div>";
    }
    var next = session.locked ? "<button type=\"button\" class=\"btn sticky-next\" data-action=\"next\">"
      + (session.index + 1 >= total ? "完成" : "下一題") + "</button>" : "";
    return "<div class=\"practice-head\"><a class=\"back\" href=\"#/\">離開</a>"
      + "<h1>第 " + (session.index + 1) + " / " + total + " 題</h1></div>"
      + "<progress max=\"" + total + "\" value=\"" + (session.index + (session.locked ? 1 : 0)) + "\"></progress>"
      + "<p class=\"prompt\">" + renderPrompt(question.prompt || "") + "</p>"
      + (question.hint && !session.locked ? "<p class=\"hint\">提示：" + inline(question.hint) + "</p>" : "")
      + "<div class=\"media\">" + audioElement(question.audio) + speakButton(question.speak) + "</div>"
      + answerUi
      + feedback
      + next;
  }

  function renderChoices(question) {
    return "<div class=\"choices\">" + question.choices.map(function (choice, index) {
      var cls = "choice";
      var mark = "";
      if (session.locked) {
        if (index === question.answer) {
          cls += " is-correct";
          mark = "<em>正確</em>";
        } else if (index === session.picked) {
          cls += " is-wrong";
          mark = "<em>你揀咗</em>";
        }
      }
      return "<button type=\"button\" class=\"" + cls + "\" data-choice=\"" + index + "\"" + (session.locked ? " disabled" : "") + ">"
        + "<span class=\"choice-key\">" + (index + 1) + "</span>"
        + jaSpan(choice)
        + mark
        + "</button>";
    }).join("") + "</div>";
  }

  function renderFill(question) {
    if (session.locked) {
      var typed = session.picked == null || String(session.picked).trim() === "" ? "（空）" : String(session.picked);
      return "<p class=\"your-answer\">你嘅答案：" + jaSpan(typed) + "</p>";
    }
    return "<form data-fill-form>"
      + "<label for=\"fill-answer\">答案</label>"
      + "<input id=\"fill-answer\" name=\"answer\" lang=\"ja\" inputmode=\"text\" autocomplete=\"off\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\" placeholder=\"用平假名輸入\">"
      + "<button class=\"btn\" type=\"submit\">提交</button>"
      + "</form>";
  }

  function renderDone() {
    var messages = {
      syncing: "同步緊……",
      ok: "已同步畀老師。",
      fail: "同步未成功。紀錄留喺呢部機，遲啲可以再試。",
      offline: "而家離線。紀錄留喺呢部機，有網會再同步。",
      notoken: "未設定金鑰，所以未同步。可以去設定頁貼上，或者匯出 JSON。"
    };
    var note = messages[session.syncState] || "";
    return "<section class=\"panel\">"
      + "<h1>完成練習</h1>"
      + "<p class=\"score\">" + (session.score.total ? ("今次 " + session.score.correct + " / " + session.score.total + " 題啱") : "今次未有計分題目") + "</p>"
      + (note ? "<p>" + escapeHtml(note) + "</p>" : "")
      + "<p class=\"meta\">" + escapeHtml(statusLine()) + "</p>"
      + "<a class=\"btn\" href=\"#/\">返回主頁</a>"
      + "<a class=\"btn secondary\" href=\"#/mistakes\">去錯題本</a>"
      + "</section>";
  }

  function renderLog() {
    var stats = window.JPLogic.computeStats(window.JPStore.loadAttempts(), { lessonTitles: lessonTitles() });
    var lessons = ((state.index && state.index.lessons) || []).map(function (item) {
      var found = null;
      stats.perLesson.forEach(function (row) {
        if (row.lessonId === item.id) found = row;
      });
      var accuracy = found ? found.accuracy : null;
      var attempts = found ? found.attempts : 0;
      return "<li><span class=\"jp\" lang=\"ja\">" + escapeHtml(item.title) + "</span><span>"
        + attempts + " 次 · " + escapeHtml(window.JPLogic.formatPercent(accuracy)) + "</span></li>";
    }).join("");
    var tags = stats.perTag.map(function (tag) {
      return "<li><span>" + escapeHtml(tag.tag) + "</span><span>"
        + tag.correct + "/" + tag.attempts + " · " + escapeHtml(window.JPLogic.formatPercent(tag.accuracy)) + "</span></li>";
    }).join("");
    var days = stats.byDate.slice().reverse().slice(0, 21).map(function (day) {
      return "<li><span>" + escapeHtml(window.JPLogic.formatDateLabel(day.date)) + "</span><span>"
        + day.attempts + " 次 · " + escapeHtml(window.JPLogic.formatPercent(day.accuracy)) + "</span></li>";
    }).join("");
    return banner()
      + "<h1>紀錄</h1>"
      + "<section class=\"stats\">"
      + statBox(String(stats.streak.current), "而家連續")
      + statBox(String(stats.streak.longest), "最長連續")
      + "</section>"
      + "<p class=\"meta\">整體正確率 " + escapeHtml(window.JPLogic.formatPercent(stats.overall.accuracy))
      + " · " + stats.overall.correct + "/" + stats.overall.attempts + " 次</p>"
      + renderMonth(stats.today, stats.streak.studyDates)
      + "<h2>溫習日子</h2>"
      + (days ? "<ul class=\"plain\">" + days + "</ul>" : "<p>未有溫習紀錄。</p>")
      + "<h2>每課正確率</h2>"
      + (lessons ? "<ul class=\"plain\">" + lessons + "</ul>" : "<p>未有課題。</p>")
      + "<h2>每個主題</h2>"
      + "<p class=\"meta\">正確率低過 " + Math.round(window.JPLogic.WEAK_THRESHOLD * 100) + "% 會當弱項。計法係答對次數除以總作答次數。</p>"
      + (tags ? "<ul class=\"plain\">" + tags + "</ul>" : "<p>做完練習先有主題紀錄。</p>");
  }

  function renderMonth(today, studyDates) {
    var studied = new Set(studyDates || []);
    var parts = String(today).split("-").map(Number);
    var year = parts[0];
    var month = parts[1];
    var firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var html = "<section class=\"cal\"><h2>" + year + "年" + month + "月</h2><div class=\"cal-grid\">";
    ["日", "一", "二", "三", "四", "五", "六"].forEach(function (label) {
      html += "<span class=\"dow\">" + label + "</span>";
    });
    for (var i = 0; i < firstDow; i++) html += "<span class=\"day is-empty\"></span>";
    for (var d = 1; d <= days; d++) {
      var iso = year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      var cls = "day";
      if (studied.has(iso)) cls += " is-studied";
      if (iso === today) cls += " is-today";
      html += "<span class=\"" + cls + "\">" + d + "</span>";
    }
    html += "</div></section>";
    return html;
  }

  function renderMistakes() {
    var mistakes = window.JPLogic.computeStats(window.JPStore.loadAttempts(), { lessonTitles: lessonTitles() }).mistakes;
    if (!mistakes.length) {
      return "<h1>錯題本</h1><section class=\"card\"><p>未有錯題。最近一次答啱嘅題唔會留喺度。</p></section>";
    }
    var cards = mistakes.map(function (item) {
      var found = findQuestion(item.questionId);
      var prompt = found ? found.question.prompt : "呢題已經唔喺課題入面（可能老師換咗內容）。";
      var correct = found ? window.JPLogic.correctAnswerText(found.question) : "";
      var explanation = found ? found.question.explanation : "";
      return "<article class=\"card\">"
        + "<p class=\"meta\">" + escapeHtml((found && found.lesson.title) || item.lessonId) + "</p>"
        + "<h2 class=\"prompt\">" + renderPrompt(prompt) + "</h2>"
        + "<p>你上次答：" + jaSpan(item.lastUserAnswer || "（空）") + "</p>"
        + (correct ? "<p>正確答案：" + jaSpan(correct) + "</p>" : "")
        + (explanation ? "<p>" + inline(explanation) + "</p>" : "")
        + "<p class=\"tags\">" + renderTags(item.tags) + "</p>"
        + "<p class=\"meta\">錯過 " + item.wrongCount + " 次 · 錯誤率 " + Math.round((item.errorRate || 0) * 100) + "%</p>"
        + "</article>";
    }).join("");
    return "<h1>錯題本</h1>"
      + "<p>最近一次仍然答錯嘅題會留喺度。答啱一次就會拎走。</p>"
      + "<a class=\"btn\" href=\"#/practice/mistakes\">再練全部錯題（" + mistakes.length + "）</a>"
      + cards;
  }

  function renderSettings() {
    var hint = window.JPStore.tokenHint();
    var warning = "";
    var token = window.JPStore.getToken();
    if (token && token.indexOf("github_pat_") !== 0) {
      warning = "<p class=\"banner\">已儲存嘅金鑰唔似 fine-grained token（開頭應係 github_pat_）。建議跟教學重新產生一條。</p>";
    }
    return banner()
      + "<h1>設定</h1>"
      + "<section class=\"panel\">"
      + "<h2>同步畀老師</h2>"
      + "<p>金鑰只留喺呢部機嘅 localStorage，唔會寫入 repo，亦唔會跟匯出檔走。</p>"
      + "<p class=\"meta\">" + escapeHtml(hint || "未儲存金鑰") + "</p>"
      + "<p class=\"meta\">" + escapeHtml(statusLine()) + "</p>"
      + warning
      + "<label for=\"token-input\">GitHub fine-grained token</label>"
      + "<textarea id=\"token-input\" rows=\"3\" autocomplete=\"off\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\" placeholder=\"github_pat_...\"></textarea>"
      + "<button type=\"button\" class=\"btn\" data-action=\"save-token\">儲存金鑰</button>"
      + "<button type=\"button\" class=\"btn secondary\" data-action=\"clear-token\">清除金鑰</button>"
      + "<button type=\"button\" class=\"btn secondary\" data-action=\"sync\"" + (syncing ? " disabled" : "") + ">"
      + (syncing ? "同步緊……" : "而家同步") + "</button>"
      + "<p class=\"meta\">Repo：andyleehsa/japanese-log · 分支 main</p>"
      + "</section>"
      + "<section class=\"panel\">"
      + "<h2>匯出 JSON</h2>"
      + "<p>同步唔到嘅時候，可以用呢個檔留底，或者傳畀老師。iPhone 會優先開分享畫面。</p>"
      + "<button type=\"button\" class=\"btn\" data-action=\"export\">匯出 JSON</button>"
      + "</section>"
      + "<section class=\"panel\">"
      + "<h2>點樣設定</h2>"
      + "<p><a href=\"https://github.com/andyleehsa/japanese-log/blob/main/docs/SETUP_FOR_ANDY.md\" target=\"_blank\" rel=\"noopener\">打開 Andy 設定步驟</a></p>"
      + "<p><a href=\"https://github.com/andyleehsa/japanese-log/blob/main/docs/CONTENT_FORMAT.md\" target=\"_blank\" rel=\"noopener\">課題格式（畀老師）</a></p>"
      + "<p><a href=\"https://github.com/andyleehsa/japanese-log/blob/main/docs/LOGBOOK_FORMAT.md\" target=\"_blank\" rel=\"noopener\">進度檔格式（畀老師）</a></p>"
      + "</section>"
      + "<details class=\"panel\">"
      + "<summary>進階：清除呢部機嘅練習紀錄</summary>"
      + "<p>唔會刪 GitHub 上面已經同步嘅紀錄，亦唔會清金鑰。</p>"
      + "<button type=\"button\" class=\"btn danger\" data-action=\"clear-progress\">清除練習紀錄</button>"
      + "</details>"
      + "<p class=\"meta\">日文日誌 v1 · 單人用</p>";
  }

  function render() {
    var route = parseRoute();
    if (route.name !== "practice") session = null;
    else if (!session || session.key !== route.id) session = createSession(route.id);

    var taglines = {
      home: "Andy，今日 10 分鐘就得。",
      lesson: "先睇教學，再做練習。",
      practice: "一題一題嚟。",
      log: "睇下自己邊度穩，邊度要再練。",
      mistakes: "錯過嘅題，可以再練一次。",
      settings: "金鑰留喺呢部機，同步先至畀老師。"
    };
    var tagline = document.getElementById("tagline");
    if (tagline) tagline.textContent = taglines[route.name] || taglines.home;

    document.body.classList.toggle("in-practice", route.name === "practice" && session && session.phase === "question");
    document.querySelectorAll("#tabbar a").forEach(function (link) {
      var tab = route.name === "lesson" || route.name === "practice" ? "home" : route.name;
      var on = link.getAttribute("data-tab") === tab;
      link.classList.toggle("is-active", on);
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    var app = document.getElementById("app");
    if (state.loading && !state.index) {
      app.innerHTML = "<p class=\"boot\">載入緊課題……</p>";
      return;
    }
    var html = "";
    if (route.name === "lesson") html = renderLesson(route.id);
    else if (route.name === "practice") html = renderPractice();
    else if (route.name === "log") html = renderLog();
    else if (route.name === "mistakes") html = renderMistakes();
    else if (route.name === "settings") html = renderSettings();
    else html = renderHome();
    app.innerHTML = html;
    var fill = app.querySelector("#fill-answer");
    var fill = app.querySelector("#fill-answer");
    if (fill) {
      try { fill.focus({ preventScroll: true }); } catch (err) { fill.focus(); }
      return;
    }
    var heading = app.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      var active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      try { heading.focus({ preventScroll: true }); } catch (err) { heading.focus(); }
    }
  }

  function createSession(id) {
    if (id === "mistakes") {
      var mistakes = window.JPLogic.computeStats(window.JPStore.loadAttempts(), { lessonTitles: lessonTitles() }).mistakes;
      var questions = [];
      mistakes.forEach(function (item) {
        var found = findQuestion(item.questionId);
        if (found) questions.push(found.question);
      });
      return baseSession("mistakes", "再練錯題", questions, "mistakes");
    }
    var lesson = lessonById(id);
    if (!lesson || lesson.loadError) {
      return { key: id, phase: "missing", questions: [], results: [] };
    }
    return baseSession(lesson.id, lesson.title, lesson.questions || [], lesson.id);
  }

  function baseSession(key, title, questions, lessonId) {
    return {
      key: key,
      lessonId: lessonId,
      title: title,
      questions: questions,
      index: 0,
      locked: false,
      phase: questions.length ? "question" : "empty",
      results: [],
      picked: null,
      syncState: "",
      score: null
    };
  }

  function lessonIdFor(question) {
    if (session && session.lessonId && session.key !== "mistakes") return session.lessonId;
    var found = findQuestion(question.id);
    return found ? found.lesson.id : "";
  }

  function lockIn(question, userText, correct, picked) {
    var attempts = window.JPStore.loadAttempts();
    var attempt = window.JPLogic.makeAttempt({
      question: question,
      lessonId: lessonIdFor(question),
      userAnswerText: userText,
      correct: correct,
      attemptNo: window.JPLogic.nextAttemptNo(attempts, question.id),
      now: new Date()
    });
    window.JPStore.addAttempt(attempt);
    window.JPStore.setPending(true);
    session.locked = true;
    session.picked = picked;
    session.results.push({ questionId: question.id, correct: correct });
    render();
  }

  function submitChoice(index) {
    if (!session || session.locked || session.phase !== "question") return;
    var question = session.questions[session.index];
    if (questionMode(question) !== "choice") return;
    window.JPSpeech.cancel();
    lockIn(question, window.JPLogic.userAnswerText(question, index), window.JPLogic.grade(question, index), index);
  }

  function submitFill(value) {
    if (!session || session.locked || session.phase !== "question") return;
    var question = session.questions[session.index];
    if (questionMode(question) !== "fill") return;
    window.JPSpeech.cancel();
    lockIn(question, String(value || "").trim(), window.JPLogic.grade(question, value), String(value || "").trim());
  }

  function canFullRender() {
    var active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return false;
    if (session && session.phase === "question" && !session.locked) return false;
    return true;
  }

  function nextQuestion() {
    if (!session || !session.locked) return;
    window.JPSpeech.cancel();
    session.index += 1;
    session.locked = false;
    session.picked = null;
    if (session.index >= session.questions.length) {
      finishSession();
      return;
    }
    render();
    window.scrollTo(0, 0);
  }

  function syncPayload() {
    return { titles: lessonTitles(), lookup: lookupQuestion };
  }

  async function manualSync() {
    if (syncing) return;
    syncing = true;
    ui.syncError = "";
    render();
    try {
      await window.JPSync.syncAll(syncPayload());
      ui.syncError = "";
      showToast("同步成功。老師而家可以睇到你嘅進度。");
    } catch (err) {
      if (!err || err.code !== "NO_TOKEN") window.JPStore.setPending(true);
      ui.syncError = window.JPSync.friendlyError(err);
      showToast(ui.syncError);
    } finally {
      syncing = false;
      render();
    }
  }

  function skipQuestion() {
    if (!session || session.phase !== "question" || session.locked) return;
    session.index += 1;
    if (session.index >= session.questions.length) {
      finishSession();
      return;
    }
    render();
    window.scrollTo(0, 0);
  }

  function finishSession() {
    var correct = session.results.filter(function (item) { return item.correct; }).length;
    session.phase = "done";
    session.score = { correct: correct, total: session.results.length };
    render();
    window.scrollTo(0, 0);
    tryAutoSync();
  }

  async function tryAutoSync() {
    function paint() {
      if (canFullRender()) render();
    }
    if (!window.JPStore.getToken()) {
      if (session) session.syncState = "notoken";
      paint();
      return;
    }
    if (!navigator.onLine) {
      window.JPStore.setPending(true);
      if (session) session.syncState = "offline";
      paint();
      return;
    }
    if (session) session.syncState = "syncing";
    paint();
    try {
      await window.JPSync.syncAll(syncPayload());
      if (session) session.syncState = "ok";
      showToast("已同步畀老師");
    } catch (err) {
      window.JPStore.setPending(true);
      if (session) session.syncState = "fail";
    }
    paint();
  }

  function saveToken() {
    var input = document.getElementById("token-input");
    var token = String(input && input.value || "").trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, "");
    if (token.length < 20) {
      showToast("金鑰太短，請貼晒成條。");
      return;
    }
    window.JPStore.setToken(token);
    if (input) input.value = "";
    if (token.indexOf("github_pat_") !== 0) showToast("已儲存。呢條唔似 fine-grained token（開頭應係 github_pat_）。");
    else showToast("金鑰已儲存喺呢部機。");
    render();
  }

  function clearToken() {
    if (!window.JPStore.getToken()) return;
    if (!window.confirm("清除呢部機入面嘅 GitHub 金鑰？")) return;
    window.JPStore.clearToken();
    showToast("已清除金鑰。");
    render();
  }

  function clearProgress() {
    if (!window.confirm("清除呢部機嘅練習紀錄？GitHub 上面已同步嘅紀錄會保留。")) return;
    window.JPStore.clearProgress();
    showToast("已清除呢部機嘅練習紀錄。");
    render();
  }

  async function exportJson() {
    var attempts = window.JPStore.loadAttempts();
    var stats = window.JPLogic.computeStats(attempts, { lessonTitles: lessonTitles() });
    var summary = window.JPLogic.buildSummary(stats, {
      lookup: lookupQuestion,
      titles: lessonTitles(),
      exportedAt: new Date().toISOString()
    });
    var payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      attempts: attempts,
      summary: summary
    };
    var text = JSON.stringify(payload, null, 2);
    var filename = "japanese-log-" + window.JPLogic.todayLocalDate() + ".json";
    var file = new File([text], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "日文日誌紀錄" });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    var link = document.createElement("a");
    var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
    showToast("已開始下載。");
  }

  function showToast(text) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { el.hidden = true; }, 3600);
  }

  function onClick(event) {
    var speak = event.target.closest && event.target.closest("[data-speak]");
    if (speak) {
      event.preventDefault();
      window.JPSpeech.speak(speak.getAttribute("data-speak"));
      return;
    }
    var choice = event.target.closest && event.target.closest("[data-choice]");
    if (choice && !choice.disabled) {
      submitChoice(Number(choice.getAttribute("data-choice")));
      return;
    }
    var action = event.target.closest && event.target.closest("[data-action]");
    if (!action) return;
    var name = action.getAttribute("data-action");
    if (name === "next") nextQuestion();
    if (name === "skip") skipQuestion();
    if (name === "sync") manualSync();
    if (name === "save-token") saveToken();
    if (name === "clear-token") clearToken();
    if (name === "export") exportJson();
    if (name === "clear-progress") clearProgress();
    if (name === "reload") location.reload();
  }

  function onSubmit(event) {
    var form = event.target && event.target.getAttribute && event.target.getAttribute("data-fill-form") != null
      ? event.target
      : null;
    if (!form) return;
    event.preventDefault();
    var input = form.querySelector("input");
    submitFill(input ? input.value : "");
  }

  function onNet() {
    var active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
    render();
    if (navigator.onLine && window.JPStore.isPending() && window.JPStore.getToken()) tryAutoSync();
  }

  async function reloadContent() {
    state.loading = true;
    try {
      var response = await fetch("content/index.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("index");
      var index = await response.json();
      var items = Array.isArray(index.lessons) ? index.lessons : [];
      var lessons = await Promise.all(items.map(async function (item) {
        try {
          if (!/^lessons\/[A-Za-z0-9._-]+\.json$/.test(item.file || "")) throw new Error("file");
          var lessonResponse = await fetch("content/" + item.file, { cache: "no-cache" });
          if (!lessonResponse.ok) throw new Error("lesson");
          return await lessonResponse.json();
        } catch (err) {
          return {
            id: item.id,
            title: item.title,
            date: item.date,
            tags: item.tags || [],
            questions: [],
            teaching: [],
            loadError: true
          };
        }
      }));
      state.index = index;
      state.lessons = lessons;
      state.error = "";
    } catch (err) {
      if (!state.index) state.index = { lessons: [] };
      state.error = "載入唔到課題。如果係第一次開，請駁住網絡再試。";
    } finally {
      state.loading = false;
    }
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").then(function (registration) {
      registration.update();
    }).catch(function () {});
  }

  function bind() {
    document.body.addEventListener("click", onClick);
    document.body.addEventListener("submit", onSubmit);
    window.addEventListener("hashchange", function () {
      window.JPSpeech.cancel();
      render();
      window.scrollTo(0, 0);
    });
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
  }

  async function boot() {
    bind();
    registerSW();
    await reloadContent();
    render();
    if (window.JPStore.getToken() && window.JPStore.isPending() && navigator.onLine) tryAutoSync();
  }

  boot().catch(function () {
    var app = document.getElementById("app");
    if (app) app.textContent = "程式啟動唔到。請重新開啟。";
  });
})();
