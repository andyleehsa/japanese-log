(function () {
  var lastRate = 1;
  var listeners = [];
  var voicesSettled = false;
  var VOICE_WAIT_MS = 1500;
  var HINT = "你部手機冇日文語音，請到 iPhone 設定 > 輔助使用 > 朗讀內容 > 語音 加日文語音";

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
    if (!voices().length) return voicesSettled ? "missing" : "unknown";
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
    if (voices().length) {
      voicesSettled = true;
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        voicesSettled = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve();
      }
      function onVoices() {
        if (voices().length) finish();
      }
      window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      window.speechSynthesis.getVoices();
      setTimeout(finish, VOICE_WAIT_MS);
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
    if (state === "missing" || state === "unknown") {
      ensureVoices().then(function () {
        var found = pickVoice();
        publish();
        if (found) speakNow(value, speed, found);
      });
      publish();
      return { ok: false, reason: "missing" };
    }
    speakNow(value, speed, pickVoice());
    return { ok: true, rate: speed };
  }

  function replay(text) {
    return speak(text, lastRate || 1);
  }

  function cancel() {
    if (supported()) window.speechSynthesis.cancel();
  }

  if (supported()) {
    window.speechSynthesis.addEventListener("voiceschanged", function () {
      if (voices().length) voicesSettled = true;
      publish();
    });
    ensureVoices().then(publish);
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
