(function () {
  var UNIT_ICONS = { "u-n5-12": "assets/units/unit-12-verbs.png" };
  var app = document.getElementById("app");
  var state = { index: null, levels: [], files: {}, error: "", leaveOpen: false, pendingHash: "" };
  var session = null;
  var ignoreHash = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rich(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function hasJp(value) {
    return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
  }

  function uiText(file, key, fallback) {
    var ui = file && file.ui;
    return ui && ui[key] ? ui[key] : fallback;
  }

  function mascot(name) {
    return '<img class="mascot" src="assets/mascot/' + name + '.png" alt="" width="160" height="160" data-fallback="mascot">';
  }

  function face(large) {
    var size = large ? 160 : 48;
    return '<img class="mascot-face' + (large ? " is-lg" : "") + '" src="assets/mascot/cat-face.png" alt="" width="' + size + '" height="' + size + '" data-fallback="face">';
  }

  function bookIcon() {
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M8 10h18a6 6 0 0 1 6 6v24H14a6 6 0 0 0-6 6z"/><path fill="#fff" d="M16 10h20v26H16a4 4 0 0 0-4 4V14a4 4 0 0 1 4-4z" opacity=".85"/></svg>';
  }

  function unitIcon(unit) {
    var src = unit.icon || UNIT_ICONS[unit.id];
    if (!src) return bookIcon();
    return '<img class="unit-icon" src="' + escapeHtml(src) + '" alt="" width="48" height="48" data-fallback="unit">';
  }

  function groupLevels(index) {
    var order = [];
    var map = {};
    ((index && index.units) || []).forEach(function (unit) {
      var id = String(unit.level || "");
      if (!id) return;
      if (!map[id]) {
        map[id] = { id: id, title: id, units: [] };
        order.push(map[id]);
      }
      map[id].units.push(unit);
    });
    return order;
  }

  function currentLevel() {
    var levels = state.levels || [];
    var route = parseRoute();
    if (route.levelId) {
      var routed = levels.filter(function (level) { return level.id === route.levelId; })[0];
      if (routed) return routed;
    }
    var saved = window.JPStore.getLevel();
    var found = levels.filter(function (level) { return level.id === saved; })[0];
    return found || levels[0] || { id: "", title: "", units: [] };
  }

  function lessonIds(unit) {
    var file = state.files[unit.id];
    if (!file || !Array.isArray(file.lessons)) return [];
    return file.lessons.map(function (lesson) { return lesson.id; }).filter(Boolean);
  }

  function progressSpec(level) {
    return (level.units || []).map(function (unit) {
      return { id: unit.id, lessonCount: unit.lessonCount, lessonIds: lessonIds(unit) };
    });
  }

  function unitProgress(unit) {
    return window.JPLogic.levelProgress(window.JPStore.loadCompleted(), [{
      lessonCount: unit.lessonCount,
      lessonIds: lessonIds(unit)
    }]);
  }

  function findUnit(id) {
    var found = null;
    (state.levels || []).forEach(function (level) {
      (level.units || []).forEach(function (unit) {
        if (unit.id === id) found = unit;
      });
    });
    return found;
  }

  function findLesson(id) {
    var found = null;
    Object.keys(state.files).forEach(function (unitId) {
      var file = state.files[unitId];
      (file.lessons || []).forEach(function (lesson) {
        if (lesson.id === id) found = { unitId: unitId, file: file, lesson: lesson, indexUnit: findUnit(unitId) };
      });
    });
    return found;
  }

  function wordById(file, id) {
    var found = null;
    (file.lessons || []).forEach(function (lesson) {
      (lesson.vocab || []).forEach(function (word) {
        if (word.id === id) found = word;
      });
    });
    return found;
  }

  function catalog() {
    var list = [];
    Object.keys(state.files).forEach(function (unitId) {
      var file = state.files[unitId];
      (file.lessons || []).forEach(function (lesson) {
        (lesson.exercises || []).concat(lesson.listening || []).forEach(function (question) {
          list.push({ question: question, lessonId: lesson.id });
        });
      });
      var story = file.story || {};
      ["reading", "listening"].forEach(function (part) {
        var block = story[part];
        if (!block || !block.questions) return;
        block.questions.forEach(function (question) {
          list.push({ question: question, lessonId: lessonIdForQuestion(file, question) || story.id || "" });
        });
      });
      if (file.quiz && file.quiz.questions) {
        file.quiz.questions.forEach(function (question) {
          list.push({ question: question, lessonId: file.quiz.id || "" });
        });
      }
    });
    return list;
  }

  function lessonIdForQuestion(file, question) {
    var found = "";
    (file.lessons || []).forEach(function (lesson) {
      (lesson.exercises || []).concat(lesson.listening || []).forEach(function (item) {
        if (item.id === question.id) found = lesson.id;
      });
    });
    return found;
  }

  function questionById(id) {
    var found = null;
    catalog().forEach(function (item) {
      if (item.question.id === id) found = item;
    });
    return found;
  }

  function parseRoute() {
    var raw = (location.hash || "#/").replace(/^#/, "");
    var bits = raw.split("?");
    var parts = bits[0].split("/").filter(Boolean);
    var query = new URLSearchParams(bits[1] || "");
    var route = { name: "learn", id: "", part: "", skip: query.get("skip") === "1", levelId: "" };
    if (!parts.length) return route;
    if (parts[0] === "review") route.name = "review";
    else if (parts[0] === "me") route.name = "me";
    else if (parts[0] === "unit" && parts[1]) { route.name = "unit"; route.id = decodeURIComponent(parts[1]); }
    else if (parts[0] === "lesson" && parts[1]) { route.name = "lesson"; route.id = decodeURIComponent(parts[1]); }
    else if (parts[0] === "tips" && parts[1]) { route.name = "tips"; route.id = decodeURIComponent(parts[1]); }
    else if (parts[0] === "story" && parts[1]) {
      route.name = "story";
      route.id = decodeURIComponent(parts[1]);
      route.part = parts[2] || "reading";
    } else if (parts[0] === "quiz" && parts[1]) { route.name = "quiz"; route.id = decodeURIComponent(parts[1]); }
    else if (parts[0] === "level" && parts[1]) route.levelId = decodeURIComponent(parts[1]);
    return route;
  }

  function tabName(route) {
    if (route.name === "review") return "review";
    if (route.name === "me") return "me";
    return "learn";
  }

  function syncTabs(route) {
    var name = tabName(route);
    document.querySelectorAll("#tabbar a").forEach(function (link) {
      var on = link.getAttribute("data-tab") === name;
      link.classList.toggle("is-active", on);
      var img = link.querySelector("img");
      if (img) img.setAttribute("src", on ? img.getAttribute("data-active") : img.getAttribute("data-inactive"));
    });
    document.body.classList.toggle("in-practice", !!(session && (route.name === "lesson" || route.name === "quiz" || route.name === "story" || route.name === "review")));
  }

  function bindFallbacks(root) {
    (root || document).querySelectorAll("img[data-fallback]").forEach(function (img) {
      if (img.dataset.bound) return;
      img.dataset.bound = "1";
      img.addEventListener("error", function () {
        var span = document.createElement("span");
        if (img.getAttribute("data-fallback") === "unit") {
          span.className = "unit-icon";
          span.innerHTML = bookIcon();
        } else {
          span.className = "mascot-fallback";
          if (img.classList.contains("mascot-face")) span.classList.add("is-face");
          if (img.classList.contains("is-lg")) span.classList.add("is-lg");
        }
        img.replaceWith(span);
      });
    });
  }

  function applyFont(value) {
    document.documentElement.setAttribute("data-font", window.JPLogic.normalizeFontSize(value));
  }

  function voiceMissing() {
    if (!window.JPSpeech) return false;
    var state = window.JPSpeech.voiceState();
    return state === "missing" || state === "unsupported";
  }

  function speechHintClosed() {
    if (state.speechHintDismissed) return true;
    try { return sessionStorage.getItem("jpn5-v1-speech-hint-dismissed") === "1"; } catch (err) { return false; }
  }

  function applySpeechHint() {
    var banner = document.getElementById("speech-hint");
    if (!banner || !window.JPSpeech) return;
    var voice = window.JPSpeech.voiceState();
    var missing = voice === "missing" || voice === "unsupported";
    var pending = voice === "unknown";
    if (speechHintClosed() || (!missing && !pending)) {
      banner.hidden = true;
      banner.classList.remove("is-reserved");
      banner.textContent = "";
      return;
    }
    banner.hidden = false;
    if (pending) {
      banner.classList.add("is-reserved");
      banner.setAttribute("aria-hidden", "true");
      banner.innerHTML = "";
      return;
    }
    banner.classList.remove("is-reserved");
    banner.removeAttribute("aria-hidden");
    banner.innerHTML = "<p>" + escapeHtml(window.JPSpeech.hint()) + "</p>"
      + '<button type="button" class="icon-btn speech-dismiss" data-action="dismiss-speech" aria-label="關閉提示">×</button>';
  }

  function speakFrom(tts, file, rate) {
    var source = window.JPLogic.speechSource({ tts: tts, audio: { file: file || null, ttsText: tts } });
    if (source.mode === "audio") {
      var audio = new Audio(source.audio);
      audio.playbackRate = rate || 1;
      audio.play().catch(function () {
        if (source.text) window.JPSpeech.speak(source.text, rate || 1);
      });
      return;
    }
    if (source.mode === "speech") window.JPSpeech.speak(source.text, rate || 1);
    applySpeechHint();
  }

  function speakButtons(item, file) {
    var source = window.JPLogic.speechSource(item || {});
    if (source.mode === "none") return "";
    var normal = uiText(file, "normal", "正常速度");
    var slow = uiText(file, "slow", "慢速");
    var tts = source.text;
    var fileUrl = source.audio || "";
    return '<div class="speak-row">'
      + '<button type="button" class="speak" data-action="speak" data-rate="1" data-tts="' + escapeHtml(tts) + '" data-file="' + escapeHtml(fileUrl) + '">'
      + '<img src="assets/ui/icon-speaker.png" alt="" width="28" height="28">' + escapeHtml(normal) + "</button>"
      + '<button type="button" class="speak" data-action="speak" data-rate="0.7" data-tts="' + escapeHtml(tts) + '" data-file="' + escapeHtml(fileUrl) + '">'
      + '<img src="assets/ui/icon-turtle.png" alt="" width="28" height="28">' + escapeHtml(slow) + "</button>"
      + "</div>";
  }

  function lookupMaps(file) {
    var tables = {};
    var flows = {};
    function take(node) {
      if (!node || typeof node !== "object") return;
      if (node.type === "table" && node.id) tables[node.id] = node;
      if (Array.isArray(node.rows) && node.headers && node.id) tables[node.id] = node;
      if (node.stepsText && node.id) flows[node.id] = node;
      Object.keys(node).forEach(function (key) {
        var value = node[key];
        if (Array.isArray(value)) value.forEach(take);
        else if (value && typeof value === "object") take(value);
      });
    }
    take(file);
    return { tables: tables, flows: flows };
  }

  function renderCell(cell, file) {
    if (Array.isArray(cell)) return cell.map(function (item) { return renderCell(item, file); }).join("");
    if (cell && typeof cell === "object") {
      var main = cell.ja || cell.text || "";
      return '<span class="cell-jp jp" lang="ja">' + escapeHtml(main) + "</span>"
        + (cell.reading ? '<span class="cell-reading" lang="ja">' + escapeHtml(cell.reading) + "</span>" : "")
        + (cell.zh ? "<span>" + escapeHtml(cell.zh) + "</span>" : "")
        + speakButtons(cell, file);
    }
    return rich(cell);
  }

  function renderTable(table, file) {
    var head = (table.headers || []).map(function (header) { return "<th>" + rich(header) + "</th>"; }).join("");
    var body = (table.rows || []).map(function (row) {
      return "<tr>" + (row || []).map(function (cell) { return "<td>" + renderCell(cell, file) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<div class="table-scroll teaching"><table><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function renderFlow(flow) {
    var steps = flow.stepsText || [];
    return "<section class=\"panel\">"
      + (flow.title ? "<h2>" + escapeHtml(flow.title) + "</h2>" : "")
      + "<ol>" + steps.map(function (step) { return "<li>" + rich(step) + "</li>"; }).join("") + "</ol>"
      + "</section>";
  }

  function renderBlocks(blocks, file) {
    var maps = lookupMaps(file);
    return (blocks || []).map(function (block) {
      if (!block) return "";
      if (block.type === "text") return "<p>" + rich(block.text) + "</p>";
      if (block.type === "term") {
        return "<section class=\"panel\">"
          + '<p class="jp" lang="ja">' + escapeHtml(block.ja || "") + "</p>"
          + (block.reading ? '<p class="reading" lang="ja">' + escapeHtml(block.reading) + "</p>" : "")
          + (block.zh ? "<p>" + escapeHtml(block.zh) + "</p>" : "")
          + speakButtons(block, file)
          + "</section>";
      }
      if (block.type === "example") {
        return '<div class="example-sentence">'
          + '<p class="jp" lang="ja">' + escapeHtml(block.ja || "") + "</p>"
          + (block.reading ? '<p class="reading" lang="ja">' + escapeHtml(block.reading) + "</p>" : "")
          + (block.zh ? "<p>" + escapeHtml(block.zh) + "</p>" : "")
          + (block.note ? "<p class=\"meta\">" + escapeHtml(block.note) + "</p>" : "")
          + speakButtons(block, file)
          + "</div>";
      }
      if (block.type === "table") return (block.title ? "<h3>" + escapeHtml(block.title) + "</h3>" : "") + renderTable(block, file);
      if (block.type === "table_ref") {
        var table = maps.tables[block.ref];
        return table ? renderTable(table, file) : "";
      }
      if (block.type === "flowchart") {
        var flow = block.stepsText ? block : maps.flows[block.ref];
        return flow ? renderFlow(flow) : "";
      }
      return "";
    }).join("");
  }

  function optionLabel(option) {
    if (!option) return "";
    if (option.ja) {
      var same = option.reading && String(option.reading).replace(/\s/g, "") === String(option.ja).replace(/\s/g, "");
      return '<span class="jp" lang="ja">' + escapeHtml(option.ja) + "</span>"
        + (option.reading && !same ? '<span class="reading" lang="ja">' + escapeHtml(option.reading) + "</span>" : "");
    }
    return escapeHtml(option.text || option.zh || "");
  }

  function orderedOptions(question) {
    var options = (question.options || []).slice();
    if (!question.shuffle) return options;
    if (!session.optionOrder) session.optionOrder = {};
    if (!session.optionOrder[question.id]) {
      var ids = options.map(function (option) { return option.id; });
      for (var i = ids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var swap = ids[i];
        ids[i] = ids[j];
        ids[j] = swap;
      }
      session.optionOrder[question.id] = ids;
    }
    var byId = {};
    options.forEach(function (option) { byId[option.id] = option; });
    return session.optionOrder[question.id].map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function readyDraft(question) {
    if (!question || session.locked) return false;
    if (question.type === "match") {
      var draft = session.draft || {};
      return (question.left || []).every(function (item) { return draft[item.id]; });
    }
    if (question.type === "reorder") {
      return Array.isArray(session.draft) && session.draft.length === (question.pieces || []).length && session.draft.length > 0;
    }
    if (question.type === "choice" || question.type === "listen-choice" || (question.type === "fill" && question.options)) {
      return typeof session.draft === "string" && !!session.draft;
    }
    return window.JPLogic.confirmReady({ mode: "fill", text: session.draft, locked: false });
  }

  function choiceFitLimit() {
    var raw = window.getComputedStyle(document.documentElement).getPropertyValue("--jp-practice");
    var px = parseFloat(raw);
    if (!isFinite(px)) px = 24;
    return window.JPLogic.choiceGridLimit(window.innerWidth, px);
  }

  function renderChoices(question) {
    var options = orderedOptions(question);
    var labels = options.map(function (option) {
      var main = String((option && (option.ja || option.text)) || "");
      var reading = option && option.reading ? String(option.reading) : "";
      return reading.length > main.length ? reading : main;
    });
    var layout = window.JPLogic.choiceLayout(labels, choiceFitLimit());
    return '<div class="choices is-' + layout + '">' + options.map(function (option) {
      var picked = session.draft === option.id;
      return '<button type="button" class="choice' + (picked ? " is-picked" : "") + '" data-action="pick" data-id="' + escapeHtml(option.id) + '"' + (session.locked ? " disabled" : "") + ">"
        + optionLabel(option) + "</button>";
    }).join("") + "</div>";
  }

  function renderQuestion(step) {
    var question = step.question;
    var file = session.file;
    var html = '<p class="prompt' + (hasJp(question.prompt) ? " jp" : "") + '">' + escapeHtml(question.prompt || "") + "</p>";
    if (question.type === "listen-choice") {
      var stemHtml = "";
      if (question.showStem === true && question.stem && (question.stem.ja || question.stem.zh)) {
        var visible = window.JPLogic.stemFields(question.stem, false);
        stemHtml = '<div class="listen-stem">'
          + (visible.ja ? '<p class="jp" lang="ja">' + escapeHtml(visible.ja) + "</p>" : "")
          + (visible.reading ? '<p class="reading" lang="ja">' + escapeHtml(visible.reading) + "</p>" : "")
          + (visible.zh ? "<p>" + escapeHtml(visible.zh) + "</p>" : "")
          + "</div>";
      }
      var fallback = "";
      if (voiceMissing() && question.showStem !== true) {
        if (session.revealListen) {
          var heard = question.reveal || {};
          var heardJa = heard.ja || (question.audio && question.audio.ttsText) || "";
          fallback = '<div class="listen-fallback card"><p class="jp" lang="ja">' + escapeHtml(heardJa) + "</p>"
            + (heard.reading ? '<p class="reading" lang="ja">' + escapeHtml(heard.reading) + "</p>" : "")
            + "</div>";
        } else {
          fallback = '<button type="button" class="btn secondary" data-action="reveal-listen">顯示文字</button>';
        }
      }
      html = mascot("cat-headphone") + html
        + '<div class="listen-play">' + speakButtons({ audio: question.audio, tts: question.audio && question.audio.ttsText }, file) + stemHtml + "</div>"
        + fallback + renderChoices(question);
      return html;
    }
    if (question.stem && question.stem.ja && question.showStem !== false) {
      html += '<p class="jp" lang="ja">' + escapeHtml(question.stem.ja) + "</p>";
    }
    if (question.type === "match") {
      var draft = session.draft || {};
      html += (question.left || []).map(function (item) {
        var options = (question.right || []).map(function (right) {
          var selected = draft[item.id] === right.id ? " selected" : "";
          return '<option value="' + escapeHtml(right.id) + '"' + selected + ">" + escapeHtml(right.text || right.ja || "") + "</option>";
        }).join("");
        return '<label class="match-row"><span class="jp" lang="ja">' + escapeHtml(item.ja || "") + "</span>"
          + (item.reading ? '<span class="reading" lang="ja">' + escapeHtml(item.reading) + "</span>" : "")
          + speakButtons(item, file)
          + '<select data-action="match" data-left="' + escapeHtml(item.id) + '"' + (session.locked ? " disabled" : "") + ">"
          + '<option value="">請選擇</option>' + options + "</select></label>";
      }).join("");
      return html;
    }
    if (question.type === "reorder") {
      var picked = Array.isArray(session.draft) ? session.draft : [];
      var byId = {};
      (question.pieces || []).forEach(function (piece) { byId[piece.id] = piece; });
      var used = {};
      picked.forEach(function (id) { used[id] = true; });
      html += '<div class="reorder-built">' + picked.map(function (id) {
        var piece = byId[id];
        return '<button type="button" class="piece" data-action="reorder-remove" data-id="' + escapeHtml(id) + '">' + escapeHtml(piece ? piece.text : id) + "</button>";
      }).join("") + "</div>";
      html += '<div class="piece-row">' + (question.pieces || []).filter(function (piece) { return !used[piece.id]; }).map(function (piece) {
        return '<button type="button" class="piece" data-action="reorder-add" data-id="' + escapeHtml(piece.id) + '"' + (session.locked ? " disabled" : "") + ">" + escapeHtml(piece.text || "") + "</button>";
      }).join("") + "</div>";
      return html;
    }
    if (question.options) return html + renderChoices(question);
    return html + '<input id="fill-answer" value="' + escapeHtml(session.draft || "") + '"' + (session.locked ? " disabled" : "") + ">";
  }

  function renderAnswerGuide(line) {
    if (!line) return "";
    var html = '<p class="sheet-answer">' + escapeHtml(line.label) + "：" + escapeHtml(line.text || "") + "</p>";
    if (line.jp && String(line.jp) !== String(line.text)) html += '<p class="sheet-jp jp" lang="ja">' + escapeHtml(line.jp) + "</p>";
    if (line.reading) html += '<p class="sheet-reading" lang="ja">' + escapeHtml(line.reading) + "</p>";
    return html;
  }

  function renderSheet(question) {
    var correct = !!session.lastCorrect;
    var reveal = !correct && question.type === "listen-choice" ? question.reveal : null;
    var hiddenReading = question.stem && question.stem.hideReading && question.stem.reading ? question.stem.reading : "";
    var guide = window.JPLogic.answerGuide(question, {});
    var panel = window.JPLogic.feedbackPanel({
      correct: correct,
      answer: question.answerDisplay || guide.answer,
      jp: reveal ? reveal.ja : "",
      reading: (reveal && reveal.reading) || (!correct ? hiddenReading : ""),
      rule: question.rule || "",
      explanation: question.explanation || ""
    });
    var answerLine = panel.lines.filter(function (line) { return line.label === "正確答案"; })[0];
    var ruleLine = panel.lines.filter(function (line) { return line.label === "規則"; })[0];
    var title = correct ? session.correctLabel : session.wrongLabel;
    var head = '<div class="sheet-head">' + (correct ? mascot("cat-happy") : mascot("cat-encourage"))
      + '<p class="sheet-title">' + escapeHtml(title || panel.title) + "</p></div>";
    var body = "";
    if (!correct) {
      body += renderAnswerGuide(answerLine);
      if (ruleLine && ruleLine.text) body += '<p class="sheet-answer sheet-rule-label">規則</p><p class="sheet-rule">' + rich(ruleLine.text) + "</p>";
      if (panel.detail) body += "<p>" + rich(panel.detail) + "</p>";
    } else {
      if (hiddenReading) body += '<p class="sheet-reading" lang="ja">' + escapeHtml(hiddenReading) + "</p>";
      if (panel.detail) body += "<p>" + rich(panel.detail) + "</p>";
    }
    return '<aside class="sheet is-' + panel.tone + '" id="answer-feedback" role="status"><div class="sheet-scroll">'
      + head + body + "</div>"
      + '<button type="button" class="btn sheet-next" data-action="next">' + escapeHtml(uiText(session.file, "continue", "繼續")) + "</button></aside>";
  }

  function markLabel(id) {
    var mark = window.JPStore.loadVocabMarks()[id];
    if (!mark) return "";
    return mark.status === "known" ? "已標記：認識" : "已標記：不認識";
  }

  function renderVocab(step) {
    var word = step.word;
    var shown = word.kanji || word.kana || "";
    var reading = word.reading || "";
    return '<p class="kicker">' + escapeHtml(step.kicker || "生詞") + "</p>"
      + '<article class="card word-card flash-card">'
      + '<p class="flash-jp jp" lang="ja">' + escapeHtml(shown) + "</p>"
      + (reading ? '<p class="flash-reading reading" lang="ja">' + escapeHtml(reading) + "</p>" : "")
      + '<p class="flash-meaning">' + escapeHtml(word.zh || "") + "</p>"
      + (word.group ? '<p class="verb-group">' + escapeHtml(word.groupNote || word.groupDetail || word.group) + "</p>" : "")
      + (word.example ? '<div class="example-sentence"><p class="jp" lang="ja">' + escapeHtml(word.example.ja || "") + "</p>"
        + (word.example.reading ? '<p class="reading" lang="ja">' + escapeHtml(word.example.reading) + "</p>" : "")
        + (word.example.zh ? "<p>" + escapeHtml(word.example.zh) + "</p>" : "")
        + speakButtons(word.example, session.file) + "</div>" : "")
      + speakButtons(word, session.file)
      + (markLabel(word.id) ? '<p class="meta">' + escapeHtml(markLabel(word.id)) + "</p>" : "")
      + '<button type="button" class="btn" data-action="vocab-known" data-id="' + escapeHtml(word.id) + '">認識</button>'
      + '<button type="button" class="btn secondary" data-action="vocab-unknown" data-id="' + escapeHtml(word.id) + '">不認識</button>'
      + "</article>";
  }

  function renderStep() {
    var step = session.steps[session.index];
    var count = session.steps.length;
    var head = '<div class="practice-top"><button type="button" class="close-btn" data-action="ask-leave" aria-label="離開">×</button>'
      + "<p class=\"kicker\">" + (session.index + 1) + " / " + count + "</p></div>";
    if (!step || step.kind === "done") {
      if (session.completeIds && session.completeIds.length) window.JPStore.completeLessons(session.completeIds);
      session.phase = "done";
      var level = currentLevel();
      var progress = window.JPLogic.levelProgress(window.JPStore.loadCompleted(), progressSpec(level));
      var heading = "這一部分完成了";
      if (session.kind === "lesson") heading = "這一課完成了";
      if (step && step.quiz) heading = "小測完成了";
      var back = session.kind === "review" ? "#/review" : "#/unit/" + encodeURIComponent(session.unitId);
      var backLabel = session.kind === "review" ? "返回錯題本" : "返回單元";
      return mascot("cat-celebrate")
        + "<h1>" + heading + "</h1>"
        + '<p class="meta">' + progress.done + " / " + progress.total + " · " + progress.percent + "%</p>"
        + '<a class="btn" href="' + back + '">' + backLabel + "</a>";
    }
    var body = "";
    if (step.kind === "vocab") body = renderVocab(step);
    else if (step.kind === "grammar") {
      body = "<h1>" + escapeHtml(step.point.title || "文法") + "</h1>" + renderBlocks(step.point.blocks, session.file);
    } else if (step.kind === "lines") {
      body = "<h1>" + escapeHtml(step.title || "讀") + "</h1>" + (step.lines || []).map(function (line, index) {
        return '<article class="card"><p class="meta">第 ' + (index + 1) + " 行</p>"
          + '<p class="jp" lang="ja">' + escapeHtml(line.ja || "") + "</p>"
          + (line.reading ? '<p class="reading" lang="ja">' + escapeHtml(line.reading) + "</p>" : "")
          + (line.zh ? "<p>" + escapeHtml(line.zh) + "</p>" : "")
          + speakButtons(line, session.file) + "</article>";
      }).join("");
    } else if (step.kind === "speaking") {
      var block = step.block;
      var targetIds = [];
      (block.tasks || []).forEach(function (task) {
        (task.targets || []).forEach(function (id) { targetIds.push(id); });
      });
      body = "<h1>" + escapeHtml(block.title || "說") + "</h1>"
        + (block.note ? "<p>" + escapeHtml(block.note) + "</p>" : "")
        + linesForTargets(session.file, targetIds).map(function (line) {
          var number = lineNumber(session.file, line.id);
          return '<article class="card">'
            + (number ? '<p class="meta">第 ' + number + " 行</p>" : "")
            + '<p class="jp" lang="ja">' + escapeHtml(line.ja || "") + "</p>"
            + (line.reading ? '<p class="reading" lang="ja">' + escapeHtml(line.reading) + "</p>" : "")
            + (line.zh ? "<p>" + escapeHtml(line.zh) + "</p>" : "")
            + speakButtons(line, session.file) + "</article>";
        }).join("")
        + (block.tasks || []).map(function (task) {
          return "<section class=\"panel\"><p>" + escapeHtml(task.prompt || "") + "</p><ul>"
            + (task.selfCheck || []).map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("")
            + "</ul></section>";
        }).join("");
    } else     if (step.kind === "question") {
      body += renderQuestion(step);
      if (session.locked) body += renderSheet(step.question);
    }
    var dock = "";
    if (!(step.kind === "question" && session.locked)) {
      var label = step.kind === "question" ? uiText(session.file, "check", "確認") : uiText(session.file, "continue", "繼續");
      var action = step.kind === "question" ? "confirm" : "next";
      var disabled = step.kind === "question" && !readyDraft(step.question) ? " disabled" : "";
      dock = '<div class="dock" id="answer-dock"><button type="button" class="btn" data-action="' + action + '"' + disabled + ">" + escapeHtml(label) + "</button></div>";
    }
    return head + body + '<div class="dock-spacer" id="dock-spacer"></div>' + dock + leaveModal();
  }

  function leaveModal() {
    if (!state.leaveOpen) return "";
    return '<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">'
      + mascot("cat-keep")
      + "<h2>離開這一課？</h2><p>這一課尚未完成。離開後要重新開始。</p>"
      + '<button type="button" class="btn" data-action="leave-stay">留下</button>'
      + '<button type="button" class="btn secondary" data-action="leave-go">離開</button>'
      + "</div></div>";
  }

  function startSession(spec) {
    session = {
      hash: location.hash,
      phase: "run",
      steps: spec.steps,
      index: 0,
      locked: false,
      draft: null,
      lastCorrect: false,
      feedbackAt: null,
      revealListen: false,
      title: spec.title || "",
      lessonId: spec.lessonId || "",
      unitId: spec.unitId,
      file: spec.file,
      completeIds: spec.completeIds || [],
      correctLabel: uiText(spec.file, "correct", "答對了"),
      wrongLabel: uiText(spec.file, "incorrect", "再看一下"),
      optionOrder: {}
    };
  }

  function questionSteps(list, listening) {
    return (list || []).map(function (question) {
      return { kind: "question", question: question, listening: !!listening || question.type === "listen-choice" };
    });
  }

  function openLesson(id) {
    var found = findLesson(id);
    if (!found) return missing("找不到這一課");
    if (!session || session.lessonId !== id || session.kind !== "lesson") {
      var lesson = found.lesson;
      var steps = [];
      (lesson.vocab || []).forEach(function (word) {
        if (word.exposureOnly) return;
        steps.push({ kind: "vocab", word: word, kicker: uiText(found.file, "newWords", "新詞") });
      });
      (lesson.reviewVocab || []).forEach(function (wordId) {
        var word = wordById(found.file, wordId);
        if (!word || word.exposureOnly) return;
        steps.push({ kind: "vocab", word: word, kicker: uiText(found.file, "review", "複習") });
      });
      ((lesson.grammar && lesson.grammar.points) || []).forEach(function (point) {
        steps.push({ kind: "grammar", point: point });
      });
      steps = steps.concat(questionSteps(lesson.exercises, false)).concat(questionSteps(lesson.listening, true));
      steps.push({ kind: "done" });
      startSession({
        steps: steps,
        title: lesson.title,
        lessonId: lesson.id,
        unitId: found.file.id,
        file: found.file,
        completeIds: [lesson.id]
      });
      session.kind = "lesson";
    }
    return renderStep();
  }

  function openQuiz(id, skip) {
    var file = state.files[id];
    var unit = findUnit(id);
    if (!file || !file.quiz) return missing("找不到小測");
    var key = "quiz:" + id + ":" + (skip ? "1" : "0");
    if (!session || session.key !== key) {
      var steps = questionSteps(file.quiz.questions, false);
      steps.push({ kind: "done", quiz: true });
      var ids = [];
      if (skip && unit && unit.number <= 3) ids = (file.lessons || []).map(function (lesson) { return lesson.id; });
      startSession({
        steps: steps,
        title: file.quiz.title || "小測",
        lessonId: file.quiz.id,
        unitId: file.id,
        file: file,
        completeIds: ids
      });
      session.key = key;
      session.kind = "quiz";
    }
    return renderStep();
  }

  function openStory(id, part) {
    var file = state.files[id];
    var story = file && file.story;
    var block = story && story[part];
    if (!block) return missing("這一部分尚未放入");
    var key = "story:" + id + ":" + part;
    if (!session || session.key !== key) {
      var steps = [];
      if (part === "reading") {
        steps.push({ kind: "lines", title: block.title, lines: block.lines || [] });
        steps = steps.concat(questionSteps(block.questions, false));
      } else if (part === "speaking") steps.push({ kind: "speaking", block: block });
      else steps = steps.concat(questionSteps(block.questions, true));
      steps.push({ kind: "done" });
      startSession({ steps: steps, title: block.title || "", lessonId: block.id || "", unitId: file.id, file: file, completeIds: [] });
      session.key = key;
      session.kind = "story";
    }
    return renderStep();
  }

  function storyLines(file) {
    return (file && file.story && file.story.reading && file.story.reading.lines) || [];
  }

  function lineNumber(file, id) {
    var lines = storyLines(file);
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] && lines[i].id === id) return i + 1;
    }
    return 0;
  }

  function linesForTargets(file, targets) {
    var byId = {};
    storyLines(file).forEach(function (line) {
      if (line && line.id) byId[line.id] = line;
    });
    var seen = {};
    var out = [];
    (targets || []).forEach(function (id) {
      if (seen[id] || !byId[id]) return;
      seen[id] = true;
      out.push(byId[id]);
    });
    return out;
  }

  function safeAttempts() {
    return window.JPLogic.dropUnknownQuestions(window.JPStore.loadAttempts());
  }

  function cleanStoredAttempts() {
    var raw = window.JPStore.loadAttempts();
    var clean = window.JPLogic.dropUnknownQuestions(raw);
    if (clean.length !== raw.length) window.JPStore.saveAttempts(clean);
  }

  function grammarTitles(ids) {
    var map = {};
    Object.keys(state.files).forEach(function (unitId) {
      var file = state.files[unitId];
      (file.lessons || []).forEach(function (lesson) {
        ((lesson.grammar && lesson.grammar.points) || []).forEach(function (point) {
          if (point && point.id && point.title) map[point.id] = point.title;
        });
      });
    });
    var titles = [];
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      if (typeof id === "string" && map[id] && titles.indexOf(map[id]) === -1) titles.push(map[id]);
    });
    return titles;
  }

  function questionBody(question) {
    if (!question) return "";
    var bits = [];
    if (question.prompt) bits.push(question.prompt);
    if (question.stem && question.stem.ja) {
      bits.push(question.stem.ja + (question.stem.reading ? "（" + question.stem.reading + "）" : ""));
    } else if (question.type === "listen-choice" && question.reveal && question.reveal.ja) {
      bits.push(question.reveal.ja + (question.reveal.reading ? "（" + question.reveal.reading + "）" : ""));
    }
    if (question.type === "match") {
      (question.left || []).forEach(function (item) {
        if (item && item.ja) bits.push(item.ja + (item.reading ? "（" + item.reading + "）" : ""));
      });
    } else if (question.options) {
      var labels = question.options.map(function (option) {
        if (!option) return "";
        if (option.ja) return option.ja + (option.reading ? "（" + option.reading + "）" : "");
        return option.text || "";
      }).filter(Boolean);
      if (labels.length) bits.push(labels.join("／"));
    }
    return bits.join("\n");
  }

  function openReviewPractice() {
    var rows = window.JPLogic.mistakeNotebook(safeAttempts());
    var steps = [];
    rows.forEach(function (row) {
      var found = questionById(row.questionId);
      if (found) steps.push({ kind: "question", question: found.question, listening: found.question.type === "listen-choice", lessonId: found.lessonId });
    });
    if (!steps.length) return "<h1>錯題本</h1>" + mascot("cat-think") + "<p>錯題本還沒有可以練習的題目。</p>";
    steps.push({ kind: "done" });
    if (!session || session.kind !== "review") {
      startSession({ steps: steps, title: "錯題本", lessonId: "", unitId: "", file: state.files["u-n5-12"] || null, completeIds: [] });
      session.kind = "review";
      session.reviewLessons = {};
      steps.forEach(function (step) {
        if (step.lessonId) session.reviewLessons[step.question.id] = step.lessonId;
      });
    }
    return renderStep();
  }

  function missing(text) {
    return mascot("cat-think") + "<h1>" + escapeHtml(text) + "</h1>" + '<a class="btn" href="#/">返回學習</a>';
  }

  function prereqHint(unit, file) {
    var names = [];
    (unit.prerequisites || []).forEach(function (id) {
      var other = findUnit(id);
      if (!other) return;
      var progress = unitProgress(other);
      if (progress.total && progress.done < progress.total) names.push(other.title);
    });
    if (!names.length) return "";
    var template = uiText(file, "prerequisiteHint", "建議先完成：{name}");
    return '<p class="hint">' + escapeHtml(template.replace("{name}", names.join("、"))) + "</p>";
  }

  function renderRoadmap() {
    var level = currentLevel();
    var progress = window.JPLogic.levelProgress(window.JPStore.loadCompleted(), progressSpec(level));
    var max = progress.total || 1;
    var switcher = "";
    if (state.levels.length > 1) {
      switcher = '<label class="level-switch">等級<select id="level-switch">' + state.levels.map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '"' + (item.id === level.id ? " selected" : "") + ">" + escapeHtml(item.title) + "</option>";
      }).join("") + "</select></label>";
    }
    var nodes = (level.units || []).map(function (unit) {
      var frac = unitProgress(unit);
      var soon = unit.status !== "ready" ? '<span class="meta">準備中</span>' : "";
      return '<a class="unit-node" href="#/unit/' + encodeURIComponent(unit.id) + '">'
        + '<span class="node-circle">' + unitIcon(unit) + "</span>"
        + '<span class="unit-copy"><span class="row-title">' + escapeHtml(unit.number + " " + unit.title) + "</span>"
        + '<span class="meta">' + frac.done + " / " + frac.total + "</span>" + soon + "</span></a>";
    }).join("");
    return switcher
      + '<section class="panel"><div class="level-meter"><span class="level-meter-label">' + escapeHtml(level.title || "") + "</span>"
      + '<progress max="' + max + '" value="' + progress.done + '"></progress><span>' + progress.percent + "%</span></div>"
      + '<p class="meta">' + progress.done + " / " + progress.total + "</p></section>"
      + '<div class="roadmap">' + nodes + "</div>";
  }

  function renderUnit(id) {
    var unit = findUnit(id);
    if (!unit) return missing("找不到這個單元");
    var file = state.files[unit.id];
    if (unit.status !== "ready" || !file) {
      return '<a class="back" href="#/">返回</a>' + mascot("cat-think")
        + "<h1>" + escapeHtml(unit.title) + "</h1>"
        + prereqHint(unit, null)
        + '<section class="panel"><h2>內容準備中</h2><p>這一單元的課文尚未放入。你可以先學習其他已經開放的單元。</p></section>';
    }
    var lessons = (file.lessons || []).map(function (lesson) {
      var done = window.JPStore.loadCompleted().indexOf(lesson.id) !== -1;
      var minutes = lesson.estimatedMinutes ? "約 " + lesson.estimatedMinutes + " 分鐘" : "";
      return '<a class="card lesson-row" href="#/lesson/' + encodeURIComponent(lesson.id) + '">'
        + '<span class="row-title">' + escapeHtml(lesson.title) + "</span>"
        + '<span class="meta">' + escapeHtml(minutes) + (done ? " · 已完成" : "") + "</span></a>";
    }).join("");
    var story = "";
    var parts = [];
    if (file.story && file.story.reading) parts.push({ id: "reading", title: file.story.reading.title || uiText(file, "storyRead", "讀") });
    if (file.story && file.story.speaking) parts.push({ id: "speaking", title: file.story.speaking.title || uiText(file, "storySpeak", "說") });
    if (file.story && file.story.listening) parts.push({ id: "listening", title: file.story.listening.title || uiText(file, "storyListen", "聽") });
    if (parts.length) {
      story = '<h2>情境故事</h2>' + parts.map(function (part) {
        return '<a class="card story-card" href="#/story/' + encodeURIComponent(unit.id) + "/" + part.id + '"><span class="row-title">' + escapeHtml(part.title) + "</span></a>";
      }).join("");
    }
    var skip = "";
    if (unit.number <= 3 && file.quiz) {
      skip = '<a class="btn secondary" href="#/quiz/' + encodeURIComponent(unit.id) + '?skip=1">已經認識，以小測跳過</a>';
    }
    return '<a class="back" href="#/">返回</a>' + mascot("cat-happy")
      + "<h1>" + escapeHtml(file.title || unit.title) + "</h1>"
      + (file.theme ? '<p class="meta">' + escapeHtml(file.theme) + "</p>" : "")
      + prereqHint(unit, file)
      + skip
      + "<h2>基礎知識</h2>" + lessons
      + '<a class="card tips-card" href="#/tips/' + encodeURIComponent(unit.id) + '"><span class="row-title">' + escapeHtml(uiText(file, "tipsCard", "學習小貼士")) + "</span></a>"
      + story
      + (file.quiz ? '<a class="card" href="#/quiz/' + encodeURIComponent(unit.id) + '"><span class="row-title">' + escapeHtml(file.quiz.title || uiText(file, "quiz", "小測")) + "</span></a>" : "");
  }

  function renderTips(id) {
    var file = state.files[id];
    if (!file || !file.tips) return missing("小貼士尚未放入");
    var sections = (file.tips.sections || []).map(function (section) {
      return "<section class=\"panel\"><h2>" + escapeHtml(section.title || "") + "</h2>" + renderBlocks(section.blocks, file) + "</section>";
    }).join("");
    var tables = (file.tips.tables || []).map(function (table) {
      return "<h2>" + escapeHtml(table.title || "") + "</h2>" + renderTable(table, file);
    }).join("");
    var flows = (file.tips.flowcharts || []).map(renderFlow).join("");
    return '<a class="back" href="#/unit/' + encodeURIComponent(id) + '">返回</a><h1>' + escapeHtml(uiText(file, "tipsCard", "學習小貼士")) + "</h1>" + sections + tables + flows;
  }

  function renderReview() {
    if (session && session.kind === "review" && parseRoute().name === "review" && location.hash.indexOf("practice") !== -1) return renderStep();
    var rows = window.JPLogic.mistakeNotebook(safeAttempts());
    if (!rows.length) {
      return "<h1>錯題本</h1>" + mascot("cat-think") + "<p>答錯的題目會留在這裡，方便稍後再練習。</p>";
    }
    var list = rows.map(function (row) {
      var found = questionById(row.questionId);
      var prompt = found ? questionBody(found.question) : "這題已從課程中移除";
      var when = row.dueNow ? "今日可以複習" : "將於 " + window.JPLogic.formatDateLabel(row.due) + " 再練習";
      var attemptGrammar = [];
      safeAttempts().forEach(function (attempt) {
        if (attempt && attempt.questionId === row.questionId && Array.isArray(attempt.grammar)) attemptGrammar = attempt.grammar;
      });
      var titles = grammarTitles(attemptGrammar);
      var tags = titles.length ? '<span class="meta">' + escapeHtml(titles.join("、")) + "</span>" : "";
      return '<article class="card"><p class="notebook-q">' + escapeHtml(prompt) + "</p><p class=\"meta\">" + escapeHtml(when) + "</p>" + tags + "</article>";
    }).join("");
    return "<h1>錯題本</h1>" + list + '<a class="btn" href="#/review?practice=1">練習錯題</a>';
  }

  function renderMe() {
    var level = currentLevel();
    var progress = window.JPLogic.levelProgress(window.JPStore.loadCompleted(), progressSpec(level));
    var font = window.JPStore.getFontSize();
    var steps = window.JPLogic.FONT_STEPS.map(function (step) {
      return '<button type="button" class="btn' + (step === font ? "" : " secondary") + '" data-action="font-set" data-font="' + step + '">'
        + escapeHtml(window.JPLogic.FONT_LABELS[step]) + "</button>";
    }).join("");
    return face(true)
      + "<h1>我的</h1>"
      + '<section class="panel"><h2>' + escapeHtml(level.title || "") + " 進度</h2>"
      + '<progress max="' + (progress.total || 1) + '" value="' + progress.done + '"></progress>'
      + "<p>" + progress.done + " / " + progress.total + " · " + progress.percent + "%</p></section>"
      + "<h2>字體大小</h2>" + steps
      + '<section class="panel"><p>進度只保存在這部裝置。加入主畫面之後，沒有網絡也可以打開已經載入的課程。</p>'
      + (window.JPStore.persistent() ? "" : "<p>這部瀏覽器未能保存進度。離開頁面之後，練習紀錄可能會消失。</p>")
      + (voiceMissing() && window.JPSpeech ? "<p>" + escapeHtml(window.JPSpeech.hintDetail()) + "</p>" : "")
      + "</section>"
      + '<button type="button" class="btn secondary" data-action="clear-progress">清除本機進度</button>';
  }

  function render() {
    var route = parseRoute();
    if (!state.index) {
      app.innerHTML = state.error
        ? mascot("cat-think") + "<h1>" + escapeHtml(state.error) + "</h1>"
        : mascot("cat-think") + "<p class=\"boot\">載入中……</p>";
      bindFallbacks(app);
      syncTabs(route);
      return;
    }
    var html = "";
    if (route.name === "learn") html = renderRoadmap();
    else if (route.name === "unit") html = renderUnit(route.id);
    else if (route.name === "lesson") html = openLesson(route.id);
    else if (route.name === "tips") html = renderTips(route.id);
    else if (route.name === "story") html = openStory(route.id, route.part);
    else if (route.name === "quiz") html = openQuiz(route.id, route.skip);
    else if (route.name === "review") {
      if (route && location.hash.indexOf("practice=1") !== -1) html = openReviewPractice();
      else html = renderReview();
    } else if (route.name === "me") html = renderMe();
    app.innerHTML = html;
    bindFallbacks(app);
    syncTabs(route);
    layoutDock();
    applySpeechHint();
    if (session && session.locked) requestAnimationFrame(nudgeCoveredRows);
    var fill = document.getElementById("fill-answer");
    if (fill && !session.locked) {
      try { fill.focus({ preventScroll: true }); } catch (err) { fill.focus(); }
    }
  }

  function advance() {
    session.locked = false;
    session.draft = null;
    session.lastCorrect = false;
    session.feedbackAt = null;
    session.revealListen = false;
    session.index += 1;
    if (session.index >= session.steps.length) session.index = session.steps.length - 1;
    render();
  }

  function confirmAnswer() {
    var step = session.steps[session.index];
    if (!step || step.kind !== "question" || session.locked) return;
    var question = step.question;
    var userAnswer = session.draft;
    if (question.type === "fill" && !question.options) userAnswer = (document.getElementById("fill-answer") || {}).value || "";
    var correct = window.JPLogic.gradeQuestion(question, userAnswer);
    var lessonId = session.lessonId;
    if (session.kind === "review" && session.reviewLessons) lessonId = session.reviewLessons[question.id] || lessonId;
    var attempt = window.JPLogic.makeAttempt({
      question: question,
      lessonId: lessonId,
      userAnswerText: typeof userAnswer === "string" ? userAnswer : JSON.stringify(userAnswer),
      correct: correct,
      attemptNo: window.JPLogic.nextAttemptNo(safeAttempts(), question.id),
      now: new Date(),
      review: session.kind === "review"
    });
    window.JPLogic.applyGrammarTags(attempt, question);
    window.JPStore.addAttempt(attempt);
    session.locked = true;
    session.lastCorrect = correct;
    session.feedbackAt = Date.now();
    render();
  }

  function onClick(event) {
    var action = event.target.closest("[data-action]");
    if (!action) return;
    var name = action.getAttribute("data-action");
    if (name === "speak") {
      speakFrom(action.getAttribute("data-tts"), action.getAttribute("data-file"), Number(action.getAttribute("data-rate")) || 1);
      return;
    }
    if (name === "pick") {
      if (session && !session.locked) session.draft = action.getAttribute("data-id");
      render();
      return;
    }
    if (name === "reorder-add" && session && !session.locked) {
      if (!Array.isArray(session.draft)) session.draft = [];
      session.draft.push(action.getAttribute("data-id"));
      render();
      return;
    }
    if (name === "reorder-remove" && session && !session.locked) {
      var id = action.getAttribute("data-id");
      session.draft = (session.draft || []).filter(function (item) { return item !== id; });
      render();
      return;
    }
    if (name === "dismiss-speech") {
      state.speechHintDismissed = true;
      try { sessionStorage.setItem("jpn5-v1-speech-hint-dismissed", "1"); } catch (err) { /* session only */ }
      applySpeechHint();
      return;
    }
    if (name === "reveal-listen" && session && !session.locked) {
      session.revealListen = true;
      render();
      return;
    }
    if (name === "confirm") { confirmAnswer(); return; }
    if (name === "next") {
      if (session && !window.JPLogic.continueAllowed(session.feedbackAt, Date.now())) return;
      advance();
      return;
    }
    if (name === "vocab-known" || name === "vocab-unknown") {
      var step = session && session.steps[session.index];
      if (step && step.word && step.word.id === action.getAttribute("data-id")) {
        window.JPStore.setVocabMark(step.word, name === "vocab-known" ? "known" : "unknown");
        render();
      }
      return;
    }
    if (name === "font-set") {
      applyFont(window.JPStore.setFontSize(action.getAttribute("data-font")));
      render();
      return;
    }
    if (name === "clear-progress") {
      if (window.confirm("清除這部裝置上的學習進度？")) {
        window.JPStore.clearProgress();
        render();
      }
      return;
    }
    if (name === "ask-leave") {
      state.leaveOpen = true;
      state.pendingHash = "#/unit/" + encodeURIComponent(session.unitId || "");
      render();
      return;
    }
    if (name === "leave-stay") {
      state.leaveOpen = false;
      render();
      return;
    }
    if (name === "leave-go") {
      var next = state.pendingHash || "#/";
      state.leaveOpen = false;
      session = null;
      ignoreHash = true;
      location.hash = next;
      render();
    }
  }

  function onChange(event) {
    var target = event.target;
    if (target.id === "level-switch") {
      window.JPStore.setLevel(target.value);
      render();
      return;
    }
    if (target.getAttribute("data-action") === "match" && session && !session.locked) {
      if (!session.draft || typeof session.draft !== "object" || Array.isArray(session.draft)) session.draft = {};
      session.draft[target.getAttribute("data-left")] = target.value;
      render();
      return;
    }
    if (target.id === "fill-answer" && session) session.draft = target.value;
  }

  function viewportBottomInset() {
    var forced = document.documentElement.getAttribute("data-keyboard");
    if (forced != null && forced !== "") {
      var parsed = Number(forced);
      if (isFinite(parsed) && parsed >= 0) return parsed;
    }
    var vv = window.visualViewport;
    if (!vv) return 0;
    return Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
  }

  function nudgeCoveredRows() {
    var sheet = document.getElementById("answer-feedback");
    if (!sheet) return;
    var rows = document.querySelectorAll(".match-row");
    if (!rows.length) return;
    var last = rows[rows.length - 1];
    var gap = last.getBoundingClientRect().bottom - (sheet.getBoundingClientRect().top - 12);
    if (gap > 0) window.scrollBy(0, gap);
  }

  function layoutDock() {
    var inset = viewportBottomInset();
    document.documentElement.style.setProperty("--vv-bottom", inset + "px");
    var panel = document.getElementById("answer-feedback") || document.getElementById("answer-dock");
    var spacer = document.getElementById("dock-spacer");
    var panelHeight = 0;
    if (panel) panelHeight = panel.getBoundingClientRect().height;
    var height = panelHeight + inset + (panel && panel.id === "answer-feedback" ? 24 : 0);
    document.documentElement.style.setProperty("--dock-h", height + "px");
    if (spacer) spacer.style.height = height + "px";
  }

  function onHash() {
    if (ignoreHash) {
      ignoreHash = false;
      render();
      return;
    }
    var route = parseRoute();
    var inRun = session && session.phase !== "done" && (route.name === "learn" || route.name === "me" || route.name === "unit" || route.name === "tips" || (session.kind === "lesson" && route.name !== "lesson") || (session.kind === "quiz" && route.name !== "quiz") || (session.kind === "story" && route.name !== "story") || (session.kind === "review" && location.hash.indexOf("practice=1") === -1));
    if (session && session.phase !== "done" && location.hash !== session.hash) {
      state.pendingHash = location.hash;
      state.leaveOpen = true;
      ignoreHash = true;
      location.hash = session.hash;
      return;
    }
    if (!session || session.phase === "done") session = null;
    if (inRun) return;
    render();
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(function () {});
  }

  function boot() {
    applyFont(window.JPStore.getFontSize());
    bindFallbacks(document);
    applySpeechHint();
    if (window.JPSpeech) window.JPSpeech.onChange(function () {
      var y = window.scrollY;
      applySpeechHint();
      var route = parseRoute();
      var step = session && session.steps ? session.steps[session.index] : null;
      var listen = step && step.kind === "question" && step.question && step.question.type === "listen-choice";
      if (route.name === "me" || listen) {
        render();
        window.scrollTo(0, y);
      }
    });
    document.body.addEventListener("click", onClick);
    document.body.addEventListener("change", onChange);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("resize", layoutDock);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", layoutDock);
      window.visualViewport.addEventListener("scroll", layoutDock);
    }
    registerSW();
    fetch("content/units-index.json", { cache: "reload" }).then(function (res) {
      if (!res.ok) throw new Error("index");
      return res.json();
    }).then(function (index) {
      state.index = index;
      state.levels = groupLevels(index);
      var jobs = (index.units || []).filter(function (unit) { return unit.status === "ready" && unit.file; }).map(function (unit) {
        return fetch("content/units/" + unit.file, { cache: "reload" }).then(function (res) {
          if (!res.ok) throw new Error(unit.file);
          return res.json();
        }).then(function (data) { state.files[unit.id] = data; });
      });
      return Promise.all(jobs);
    }).then(function () {
      cleanStoredAttempts();
      render();
    }).catch(function () {
      state.error = "暫時無法載入課程。";
      render();
    });
  }

  boot();
})();
