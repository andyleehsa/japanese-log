(function () {
  function supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
  }

  function pickVoice() {
    if (!supported()) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    var exact = voices.find(function (voice) { return String(voice.lang || "").toLowerCase() === "ja-jp"; });
    if (exact) return exact;
    return voices.find(function (voice) { return String(voice.lang || "").toLowerCase().indexOf("ja") === 0; }) || null;
  }

  function speak(text) {
    if (!supported()) return;
    var value = String(text || "").trim();
    if (!value) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "ja-JP";
    utterance.rate = 0.92;
    var voice = pickVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function cancel() {
    if (supported()) window.speechSynthesis.cancel();
  }

  if (supported()) {
    window.speechSynthesis.addEventListener("voiceschanged", function () {});
  }

  window.JPSpeech = {
    supported: supported,
    speak: speak,
    cancel: cancel
  };
})();
