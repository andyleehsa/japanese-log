(function () {
  var OWNER = "andyleehsa";
  var REPO = "japanese-log";
  var BRANCH = "main";

  var MESSAGES = {
    OFFLINE: "而家冇網絡，同步唔到。練習紀錄已經留喺呢部機，有網再試。",
    NO_TOKEN: "未有金鑰。請去設定頁貼上 GitHub 金鑰。",
    BAD_TOKEN: "金鑰唔啱，或者已經過期。請檢查係咪 fine-grained token，然後再貼一次。",
    FORBIDDEN: "GitHub 拒絕咗。請確認呢條金鑰只可以存取 japanese-log，而且 Contents 係 Read and write。",
    NOT_FOUND: "搵唔到 japanese-log。請確認金鑰嘅 resource owner 係你自己，而且只揀咗呢一個 repo。",
    CONFLICT: "同步撞到同時更新，重試幾次都未得。請等一陣再試。",
    NETWORK: "連唔到 GitHub。請檢查網絡再試。紀錄仍然喺呢部機。",
    UNKNOWN: "同步失敗。請遲啲再試，或者先用「匯出 JSON」。"
  };

  function fail(code, detail) {
    var error = new Error(detail || code);
    error.code = code;
    return error;
  }

  function friendlyError(error) {
    if (!error) return MESSAGES.UNKNOWN;
    if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
    return MESSAGES.UNKNOWN;
  }

  function bytesToBase64(bytes) {
    var bin = "";
    var size = 0x8000;
    for (var i = 0; i < bytes.length; i += size) {
      var slice = bytes.subarray(i, i + size);
      var chunk = new Array(slice.length);
      for (var j = 0; j < slice.length; j++) chunk[j] = slice[j];
      bin += String.fromCharCode.apply(null, chunk);
    }
    return btoa(bin);
  }

  function encodeJson(value) {
    var text = JSON.stringify(value, null, 2) + "\n";
    return bytesToBase64(new TextEncoder().encode(text));
  }

  function decodeJson(file) {
    if (!file || !file.content) return null;
    var binary = atob(String(file.content).replace(/\n/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function api(token, path, options) {
    var method = (options && options.method) || "GET";
    var url = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path;
    if (method === "GET") url += "?ref=" + encodeURIComponent(BRANCH);
    var headers = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (options && options.json) headers["Content-Type"] = "application/json";
    var response;
    try {
      response = await fetch(url, {
        method: method,
        headers: headers,
        body: options && options.json ? JSON.stringify(options.json) : undefined
      });
    } catch (err) {
      throw fail("NETWORK");
    }
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) {
      var message = "";
      try {
        var body = await response.json();
        message = body && body.message ? String(body.message) : "";
      } catch (err) {
        message = "";
      }
      if (token && message.indexOf(token) !== -1) message = message.split(token).join("…");
      if ((response.status === 409 || response.status === 422) && /identical/i.test(message)) {
        var same = fail("IDENTICAL", message);
        same.identical = true;
        throw same;
      }
      var code = response.status === 401 ? "BAD_TOKEN"
        : response.status === 403 ? "FORBIDDEN"
        : response.status === 404 ? "NOT_FOUND"
        : response.status === 409 ? "CONFLICT"
        : "UNKNOWN";
      throw fail(code, message);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function putJson(token, path, build, message) {
    var lastError = null;
    for (var attempt = 0; attempt < 4; attempt++) {
      var existing = await api(token, path, { method: "GET" });
      var current = null;
      if (existing && !Array.isArray(existing)) {
        try {
          current = decodeJson(existing);
        } catch (err) {
          throw fail("UNKNOWN", "remote JSON is invalid: " + path);
        }
      }
      var next = build(current);
      var body = {
        message: message,
        content: encodeJson(next),
        branch: BRANCH
      };
      if (existing && existing.sha) body.sha = existing.sha;
      try {
        await api(token, path, { method: "PUT", json: body });
        return next;
      } catch (err) {
        if (err.code === "IDENTICAL") return next;
        lastError = err;
        if (err.code !== "CONFLICT") throw err;
      }
    }
    throw lastError || fail("CONFLICT");
  }

  async function listMonthFiles(token) {
    var listed = await api(token, "logs/attempts", { method: "GET" });
    if (!listed) return [];
    if (!Array.isArray(listed)) return [];
    return listed
      .map(function (file) { return file && file.name; })
      .filter(function (name) { return /^\d{4}-\d{2}\.json$/.test(name || ""); });
  }

  async function syncAll(options) {
    var opts = options || {};
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw fail("OFFLINE");
    var token = window.JPStore.getToken();
    if (!token) throw fail("NO_TOKEN");
    var local = window.JPStore.loadAttempts();
    var localByMonth = window.JPLogic.groupAttemptsByMonth(local);
    var remoteNames = [];
    try {
      remoteNames = await listMonthFiles(token);
    } catch (err) {
      if (err.code !== "NOT_FOUND") throw err;
    }
    var months = new Set(Object.keys(localByMonth));
    remoteNames.forEach(function (name) { months.add(name.replace(/\.json$/, "")); });
    var mergedAll = [];
    var monthList = Array.from(months).sort();
    for (var i = 0; i < monthList.length; i++) {
      var month = monthList[i];
      var written = await putJson(token, "logs/attempts/" + month + ".json", function (remoteJson) {
        var remoteAttempts = remoteJson && Array.isArray(remoteJson.attempts) ? remoteJson.attempts : [];
        return {
          schemaVersion: 1,
          month: month,
          attempts: window.JPLogic.mergeAttempts([remoteAttempts, localByMonth[month] || []])
        };
      }, "sync: attempts " + month);
      mergedAll = mergedAll.concat(written.attempts || []);
    }
    var finalAttempts = window.JPLogic.mergeAttempts([mergedAll, local]);
    var storedMarks = window.JPStore.loadVocabMarks();
    var localMarks = Object.keys(storedMarks).map(function (id) { return storedMarks[id]; });
    var vocabFile = await putJson(token, "logs/vocab.json", function (remoteJson) {
      var remoteMarks = remoteJson && Array.isArray(remoteJson.marks) ? remoteJson.marks : [];
      return {
        schemaVersion: 1,
        marks: window.JPLogic.mergeVocabMarks([remoteMarks, localMarks])
      };
    }, "sync: vocab");
    var finalMarks = vocabFile.marks || [];
    var markMap = {};
    finalMarks.forEach(function (mark) { markMap[mark.id] = mark; });
    window.JPStore.saveVocabMarks(markMap);
    var now = new Date().toISOString();
    var stats = window.JPLogic.computeStats(finalAttempts, {
      lessonTitles: (opts && opts.titles) || {}
    });
    var curriculum = window.JPLogic.curriculumReport(opts.curriculum, opts.lessonMap || {}, finalAttempts);
    var vocabStats = window.JPLogic.vocabReport(opts.vocabBanks || [], finalMarks);
    vocabStats.marks = finalMarks.map(function (mark) {
      return {
        id: mark.id,
        level: mark.level,
        category: mark.category,
        status: mark.status,
        updatedAt: mark.updatedAt
      };
    });
    var summary = window.JPLogic.buildSummary(stats, {
      lookup: opts.lookup,
      titles: opts.titles || {},
      generatedAt: now,
      lastSyncedAt: now,
      curriculum: curriculum,
      vocab: vocabStats
    });
    await putJson(token, "logs/summary.json", function () { return summary; }, "sync: summary");
    window.JPStore.saveAttempts(finalAttempts);
    window.JPStore.setLastSynced(now);
    window.JPStore.setPending(false);
    return summary;
  }

  window.JPSync = {
    OWNER: OWNER,
    REPO: REPO,
    BRANCH: BRANCH,
    MESSAGES: MESSAGES,
    syncAll: syncAll,
    friendlyError: friendlyError,
    encodeJson: encodeJson,
    decodeJson: decodeJson
  };
})();
