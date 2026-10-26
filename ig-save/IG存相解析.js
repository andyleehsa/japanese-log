// IG存相解析.js — Scriptable（IG 相／輪播）
// v1.4：捷徑有相就直接入相簿。呢度只係「有貼文連結」先開。
// 由捷徑開但冇連結：短提示後停止，唔再彈長「貼上連結」。

const VERSION = "1.4.0-ig-photos";

function queryBag() {
  try {
    return args.queryParameters || null;
  } catch (e) {
    return null;
  }
}

function paramText(q) {
  if (!q) return "";
  const keys = ["url", "text", "input", "link"];
  for (let i = 0; i < keys.length; i++) {
    const v = q[keys[i]];
    if (v != null && String(v).trim()) return String(v);
  }
  return "";
}

function openedFromShortcut(q) {
  if (q && (q.scriptName || q.url || q.text || q.input || q.link)) return true;
  try {
    if (args.urls && args.urls.length && String(args.urls[0]).indexOf("scriptable:") === 0) {
      return true;
    }
  } catch (e) {}
  return false;
}

function extractUrl(text) {
  if (!text) return "";
  let t = String(text).trim();
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(t);
      if (decoded === t) break;
      t = decoded;
    } catch (e) {
      break;
    }
  }
  if (/instagram\.com|instagr\.am/i.test(t) && !/^https?:/i.test(t)) {
    t = "https://" + t.replace(/^\/\//, "");
  }
  const m = t.match(
    /https?:\/\/(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am)\/[^\s<>"'\u3000]+/i
  );
  return m ? m[0].replace(/[)\].,，。！？]+$/u, "") : "";
}

function firstUseful() {
  const q = queryBag();
  const chunks = [];
  const fromQuery = paramText(q);
  if (fromQuery) chunks.push(fromQuery);
  try {
    if (args.shortcutParameter != null && String(args.shortcutParameter).trim()) {
      chunks.push(String(args.shortcutParameter));
    }
  } catch (e) {}
  try {
    if (args.plainTexts && args.plainTexts.length) {
      for (let i = 0; i < args.plainTexts.length; i++) chunks.push(String(args.plainTexts[i]));
    }
  } catch (e) {}
  try {
    if (args.urls && args.urls.length) {
      for (let i = 0; i < args.urls.length; i++) chunks.push(String(args.urls[i]));
    }
  } catch (e) {}
  for (let i = 0; i < chunks.length; i++) {
    const found = extractUrl(chunks[i]);
    if (found) return found;
  }
  if (openedFromShortcut(q)) return "";
  try {
    return extractUrl(Pasteboard.pasteString() || "");
  } catch (e) {
    return "";
  }
}

function normalizeUrl(url) {
  let u = String(url || "").trim();
  try {
    u = decodeURIComponent(u);
  } catch (e) {}
  u = u.replace(/[?&](igshid|igsh|utm_[^=]+|img_index)=[^&]*/gi, "");
  u = u.replace(/\?&/, "?").replace(/[?&]$/, "");
  return u;
}

function isReelOrVideoPath(url) {
  return /instagram\.com\/(reel|tv|stories)\//i.test(url);
}

async function say(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("知道");
  await a.present();
}

async function askUrl() {
  const a = new Alert();
  a.title = "貼上 IG 連結";
  a.message = "呢個只係喺 Scriptable 入面自己打開先用。貼 instagram 貼文連結。";
  a.addTextField("https://www.instagram.com/p/…");
  a.addAction("下載");
  a.addCancelAction("取消");
  const idx = await a.present();
  if (idx == -1) return "";
  return normalizeUrl(extractUrl(a.textFieldValue(0) || ""));
}

function withTimeout(promise, seconds, label) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = new Timer();
    timer.timeInterval = seconds;
    timer.schedule(() => {
      if (done) return;
      done = true;
      try { timer.invalidate(); } catch (e) {}
      reject(new Error(label || "timeout"));
    });
    promise.then(
      (v) => {
        if (done) return;
        done = true;
        try { timer.invalidate(); } catch (e) {}
        resolve(v);
      },
      (err) => {
        if (done) return;
        done = true;
        try { timer.invalidate(); } catch (e) {}
        reject(err);
      }
    );
  });
}

const EXTRACT_JS = `
(() => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
  const og = (p) => {
    const el = document.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]');
    return el ? (el.getAttribute('content') || '') : '';
  };
  const unescapeJson = (s) => {
    try { return JSON.parse('"' + s + '"'); } catch (e) {
      return s.replace(/\\\\n/g,'\\n').replace(/\\\\"/g,'"').replace(/\\\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
    }
  };

  let blobText = '';
  for (const s of document.querySelectorAll('script')) {
    const t = s.textContent || '';
    if (t.length > 200 && /(image_versions2|carousel_media|display_uri|og:image|cdninstagram)/.test(t)) {
      blobText += '\\n' + t;
    }
  }
  try { blobText += '\\n' + (document.documentElement ? document.documentElement.innerHTML : ''); } catch (e) {}

  let username = '';
  const um = blobText.match(/"username"\\s*:\\s*"([A-Za-z0-9._]+)"/);
  if (um) username = um[1];

  let images = [];
  let skippedVideo = 0;
  let m;
  const reVid = /"video_versions"\\s*:\\s*\\[/g;
  while ((m = reVid.exec(blobText))) skippedVideo++;

  const reImg = /"image_versions2"\\s*:\\s*\\{\\s*"candidates"\\s*:\\s*\\[\\s*\\{[\\s\\S]*?"url"\\s*:\\s*"(https:[^"]+)"/g;
  while ((m = reImg.exec(blobText))) images.push(unescapeJson(m[1]));

  if (images.length == 0) {
    const reDisp = /"display_uri"\\s*:\\s*"(https:[^"]+)"/g;
    while ((m = reDisp.exec(blobText))) images.push(unescapeJson(m[1]));
  }

  if (images.length == 0) {
    [...document.querySelectorAll('img')].forEach(i => {
      const s = i.currentSrc || i.src;
      if (s && /cdninstagram|fbcdn|scontent/i.test(s) && !/profile_pic|emoji|rsrc/i.test(s)) {
        images.push(abs(s));
      }
    });
    const ogi = og('og:image');
    if (ogi && images.length == 0) images.push(ogi);
  }

  const seen = new Set();
  images = images.filter(u => {
    if (!u || u.startsWith('data:')) return false;
    if (/\\.(mp4|m3u8)(\\?|$)/i.test(u)) { skippedVideo++; return false; }
    if (/rsrc\\.php|static\\.cdninstagram|profile_pic|emoji/i.test(u)) return false;
    const key = u.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  const bodyText = document.body ? (document.body.innerText || '') : '';
  const loginWall = /Log in|登入|Sign up|註冊/i.test(bodyText) && images.length == 0;
  const pathReel = /\\/(reel|tv|stories)\\//i.test(location.pathname);

  return JSON.stringify({
    ok: !loginWall && images.length > 0,
    loginWall,
    isReelPath: pathReel,
    url: location.href,
    username,
    images,
    skippedVideo,
    title: document.title || '',
    version: '1.4.0-ig-photos'
  });
})();
`;

async function extractWithWebView(url) {
  const wv = new WebView();
  let loadState = "ok";
  try {
    await withTimeout(wv.loadURL(url), 15, "load_timeout");
  } catch (e) {
    loadState = String(e && e.message ? e.message : e);
  }

  await wv.present(true);

  try {
    await withTimeout(
      wv.evaluateJavaScript("await new Promise(r => setTimeout(r, 600)); true"),
      5,
      "wait_timeout"
    );
  } catch (e) {}

  let raw;
  try {
    raw = await withTimeout(wv.evaluateJavaScript(EXTRACT_JS), 10, "extract_timeout");
  } catch (e) {
    return { ok: false, error: "extract_timeout", message: String(e), url };
  }

  let data;
  try {
    data = typeof raw == "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    data = { ok: false, error: "parse_failed", message: String(e), url };
  }

  if ((!data.images || !data.images.length) && (data.loginWall || loadState !== "ok")) {
    const again = new Alert();
    again.title = "仲未見到相";
    again.message = "可能未登入或頁面未載入完。再開一次？";
    again.addAction("再開");
    again.addCancelAction("取消");
    if ((await again.present()) == -1) {
      data.ok = false;
      data.error = data.loginWall ? "login_wall" : "no_images";
      return data;
    }
    try {
      await withTimeout(wv.loadURL(url), 15, "load_timeout");
    } catch (e) {}
    await wv.present(true);
    try {
      raw = await withTimeout(wv.evaluateJavaScript(EXTRACT_JS), 10, "extract_timeout");
      data = typeof raw == "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      return { ok: false, error: "extract_timeout", url };
    }
  }

  data.url = data.url || url;
  if (data.images && data.images.length) data.ok = true;
  return data;
}

async function saveImages(urls) {
  let saved = 0;
  const errors = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const req = new Request(urls[i]);
      req.timeoutInterval = 45;
      const data = await withTimeout(req.load(), 45, "download_timeout");
      if (!data || data.byteLength < 200) {
        errors.push("empty_" + (i + 1));
        continue;
      }
      await Photos.fromData(data);
      saved++;
    } catch (e) {
      errors.push(String(e).slice(0, 100));
    }
  }
  return { saved, errors };
}

async function main() {
  const fromShortcut = openedFromShortcut(queryBag());
  let url = normalizeUrl(firstUseful() || "");
  if (!url) {
    if (fromShortcut) {
      await say(
        "冇帶到連結",
        "捷徑冇傳 IG 連結，已停止。\n" +
          "單張相：IG 分享 → 揀 IG存相。\n" +
          "輪播或要更清：喺 IG 撳複製連結，再開捷徑 App 撳一次 IG存相。"
      );
      return;
    }
    url = await askUrl();
  }
  if (!url) {
    await say("已取消", "冇貼文連結，已停止。");
    return;
  }

  if (!/instagram\.com|instagr\.am/i.test(url)) {
    await say("唔支援", "只支援 Instagram 連結。\n你貼嘅係：\n" + url);
    return;
  }

  if (isReelOrVideoPath(url)) {
    await say("略過影片", "呢個係 Reel／Story／IGTV，呢版只存相（單相／輪播）。");
    return;
  }

  let extracted;
  try {
    extracted = await extractWithWebView(url);
  } catch (e) {
    await say("出錯", "打開／讀取 IG 時失敗：\n" + String(e));
    return;
  }

  if (extracted.error == "cancelled") {
    await say("已取消", "你取消咗，冇下載。");
    return;
  }

  if (!extracted.ok || !extracted.images || !extracted.images.length) {
    const msg =
      extracted.error == "load_failed" || extracted.error == "load_timeout"
        ? "載入 IG 太慢或失敗。"
        : extracted.error == "login_wall" || extracted.loginWall
          ? "登入牆或私人／刪除貼文，讀唔到相。"
          : extracted.isReelPath
            ? "呢頁好似係影片，呢版只存相。"
            : "讀唔到相片。可試：確認已登入 IG、用公開單相／輪播、關閉頁面前等相出現。";
    await say("存唔到", msg);
    return;
  }

  let saved = 0;
  let errors = [];
  try {
    const r = await saveImages(extracted.images);
    saved = r.saved;
    errors = r.errors;
  } catch (e) {
    await say("存相出錯", String(e) + "\n（請喺設定允許 Scriptable 存取相片）");
    return;
  }

  if (saved > 0) {
    await say(
      "已存相 ✓",
      "已存 " +
        saved +
        " 張入相簿" +
        (extracted.username ? "（@" + extracted.username + "）" : "") +
        (extracted.skippedVideo ? "\n（略過 " + extracted.skippedVideo + " 段影片）" : "") +
        (errors.length ? "\n有 " + errors.length + " 張失敗" : "")
    );
  } else {
    await say(
      "下載失敗",
      "搵到相但存唔入。請去 iPhone 設定 → Scriptable → 相片，改成「所有相片」。\n" +
        (errors[0] || "")
    );
  }
}

try {
  await main();
} catch (e) {
  const a = new Alert();
  a.title = "程式錯誤";
  a.message = String(e);
  a.addAction("知道");
  await a.present();
}
Script.complete();
