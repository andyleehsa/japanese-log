(function () {
  var PREFIX = "jpn5-v1-";
  var ATTEMPTS = PREFIX + "attempts";
  var FONT = PREFIX + "font";
  var VOCAB = PREFIX + "vocab";
  var DONE = PREFIX + "completed";
  var LEVEL = PREFIX + "level";
  var memory = {};
  var persistent = true;

  function storage() {
    try {
      var key = "__jpn5_probe__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return localStorage;
    } catch (err) {
      persistent = false;
      return null;
    }
  }

  var store = storage();

  function readRaw(key) {
    if (!store) return memory[key] == null ? null : memory[key];
    try {
      return store.getItem(key);
    } catch (err) {
      persistent = false;
      return memory[key] == null ? null : memory[key];
    }
  }

  function writeRaw(key, value) {
    memory[key] = value;
    if (!store) return;
    try {
      if (value == null) store.removeItem(key);
      else store.setItem(key, value);
    } catch (err) {
      persistent = false;
    }
  }

  function readJson(key, fallback) {
    var raw = readRaw(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  window.JPStore = {
    persistent: function () { return persistent; },
    loadAttempts: function () {
      var parsed = readJson(ATTEMPTS, []);
      return Array.isArray(parsed) ? parsed : [];
    },
    saveAttempts: function (attempts) {
      writeRaw(ATTEMPTS, JSON.stringify(attempts || []));
    },
    addAttempt: function (attempt) {
      var all = this.loadAttempts();
      all.push(attempt);
      this.saveAttempts(all);
      return all;
    },
    loadCompleted: function () {
      var parsed = readJson(DONE, []);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (id) { return typeof id === "string" && id; });
    },
    completeLesson: function (id) {
      var list = this.loadCompleted();
      if (id && list.indexOf(id) === -1) list.push(id);
      writeRaw(DONE, JSON.stringify(list));
      return list;
    },
    completeLessons: function (ids) {
      var list = this.loadCompleted();
      (ids || []).forEach(function (id) {
        if (id && list.indexOf(id) === -1) list.push(id);
      });
      writeRaw(DONE, JSON.stringify(list));
      return list;
    },
    loadVocabMarks: function () {
      var parsed = readJson(VOCAB, {});
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    },
    setVocabMark: function (entry, status) {
      var marks = this.loadVocabMarks();
      var when = window.JPLogic.formatLocalTimestamp(new Date());
      marks[entry.id] = {
        id: entry.id,
        status: status,
        updatedAt: when.timestamp
      };
      writeRaw(VOCAB, JSON.stringify(marks));
      return marks[entry.id];
    },
    getFontSize: function () {
      var value = readRaw(FONT) || "";
      return window.JPLogic && window.JPLogic.normalizeFontSize ? window.JPLogic.normalizeFontSize(value) : (value || "standard");
    },
    setFontSize: function (value) {
      var next = window.JPLogic && window.JPLogic.normalizeFontSize ? window.JPLogic.normalizeFontSize(value) : value;
      writeRaw(FONT, next);
      return next;
    },
    getLevel: function () {
      return readRaw(LEVEL) || "";
    },
    setLevel: function (id) {
      writeRaw(LEVEL, id || "");
      return id || "";
    },
    clearProgress: function () {
      writeRaw(ATTEMPTS, "[]");
      writeRaw(VOCAB, "{}");
      writeRaw(DONE, "[]");
    }
  };
})();
