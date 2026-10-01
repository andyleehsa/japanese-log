(function () {
  var lastRate = 1;
  var listeners = [];
  var HINT = "呢部機未有日文語音，所以讀唔到。請去 iPhone「設定」→「輔助使用」→「朗讀內容」→「聲音」→「日文」，下載日文聲音，再返嚟撳。用電腦嘅話，請喺系統語音加日文。";

  function supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
  }

  function voices() {
    if (!supported()) return [];
    return window.speechSynthesis.getVoices() || [];
  }

  function pickVoice() {
    var list = voices();
    var exact = null;
    var prefix = null;
    for (var i = 0; i < list.length; i++) {
      var lang = String(list[i].lang || "").toLowerCase();
      if (lang === "ja-jp") exact = list[i];
      else if (!prefix && lang.indexOf("ja") === 0) prefix = list[i];
    }
    return exact || prefix;
  }

  function voiceState() {
    if (!supported()) return "unsupported";
    if (!voices().length) return "unknown";
    return pickVoice() ? "ready" : "missing";
  }

  function publish() {
    var state = voiceState();
    listeners.forEach(function (fn) {
      try { fn(state); } catch (err) { /* UI updates must not break speech. */ }
    });
  }

  function ensureVoices() {
    if (!supported()) return Promise.resolve();
    if (voices().length) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener("voiceschanged", finish);
        resolve();
      }
      window.speechSynthesis.addEventListener("voiceschanged", finish);
      window.speechSynthesis.getVoices();
      setTimeout(finish, 800);
    });
  }

  function speakNow(value, speed, voice) {
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "ja-JP";
    utterance.rate = speed;
    if (voice) utterance.voice = voice;
    lastRate = speed;
    window.speechSynthesis.speak(utterance);
  }

  function speak(text, rate) {
    var value = String(text || "").trim();
    var speed = rate == null ? 1 : rate;
    if (!value) return { ok: false, reason: "empty" };
    if (!supported()) {
      publish();
      return { ok: false, reason: "unsupported" };
    }
    var state = voiceState();
    if (state === "missing") {
      publish();
      return { ok: false, reason: "missing" };
    }
    var voice = pickVoice();
    speakNow(value, speed, voice);
    if (state === "unknown") {
      ensureVoices().then(function () {
        var found = pickVoice();
        publish();
        if (!found) {
          cancel();
          return;
        }
        if (found !== voice) speakNow(value, speed, found);
      });
    }
    return { ok: true, rate: speed };
  }

  function replay(text) {
    return speak(text, lastRate || 1);
  }

  function cancel() {
    if (supported()) window.speechSynthesis.cancel();
  }

  if (supported()) {
    window.speechSynthesis.addEventListener("voiceschanged", publish);
    publish();
  }

  window.JPSpeech = {
    supported: supported,
    voiceState: voiceState,
    hint: function () { return HINT; },
    speak: speak,
    replay: replay,
    cancel: cancel,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
