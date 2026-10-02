(function () {
  var ATTEMPTS = "jp-log-attempts-v1";
  var TOKEN = "jp-log-token";
  var LAST = "jp-log-last-synced";
  var PENDING = "jp-log-pending-sync";
  var VOCAB = "jp-log-vocab-v1";
  var HOME_SKIP = "jp-log-home-skip-v1";
  var FONT = "jp-log-font-size";
  var memory = {};
  var persistent = true;

  function storage() {
    try {
      var key = "__jp_log_probe__";
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

  function loadAttempts() {
    var raw = readRaw(ATTEMPTS);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveAttempts(attempts) {
    writeRaw(ATTEMPTS, JSON.stringify(attempts || []));
  }

  function normalizeToken(value) {
    return String(value || "").trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, "");
  }

  window.JPStore = {
    persistent: function () { return persistent; },
    loadAttempts: loadAttempts,
    saveAttempts: saveAttempts,
    addAttempt: function (attempt) {
      var all = loadAttempts();
      all.push(attempt);
      saveAttempts(all);
      return all;
    },
    getToken: function () {
      return normalizeToken(readRaw(TOKEN) || "");
    },
    setToken: function (token) {
      writeRaw(TOKEN, normalizeToken(token));
    },
    clearToken: function () {
      writeRaw(TOKEN, null);
    },
    tokenHint: function () {
      var token = normalizeToken(readRaw(TOKEN) || "");
      if (!token) return "";
      return "已儲存（尾 " + token.slice(-4) + "）";
    },
    getLastSynced: function () {
      return readRaw(LAST) || "";
    },
    setLastSynced: function (iso) {
      writeRaw(LAST, iso || "");
    },
    isPending: function () {
      return readRaw(PENDING) === "1";
    },
    setPending: function (pending) {
      writeRaw(PENDING, pending ? "1" : "0");
    },
    clearProgress: function () {
      writeRaw(ATTEMPTS, "[]");
      writeRaw(VOCAB, "{}");
      writeRaw(PENDING, "0");
      writeRaw(HOME_SKIP, "[]");
    },
    loadHomeSkips: function () {
      var raw = readRaw(HOME_SKIP);
      if (!raw) return [];
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(function (id) { return typeof id === "string" && id; }) : [];
      } catch (err) {
        return [];
      }
    },
    skipHomeLesson: function (id) {
      var list = this.loadHomeSkips();
      if (id && list.indexOf(id) === -1) list.push(id);
      writeRaw(HOME_SKIP, JSON.stringify(list));
      return list;
    },
    loadVocabMarks: function () {
      var raw = readRaw(VOCAB);
      if (!raw) return {};
      try {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (err) {
        return {};
      }
    },
    saveVocabMarks: function (marks) {
      writeRaw(VOCAB, JSON.stringify(marks || {}));
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
    setVocabMark: function (entry, status) {
      var marks = this.loadVocabMarks();
      var when = window.JPLogic.formatLocalTimestamp(new Date());
      marks[entry.id] = {
        id: entry.id,
        level: entry.level,
        category: entry.category,
        status: status,
        updatedAt: when.timestamp
      };
      this.saveVocabMarks(marks);
      writeRaw(PENDING, "1");
      return marks[entry.id];
    }
  };
})();
