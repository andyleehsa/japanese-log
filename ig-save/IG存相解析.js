// IG存相解析.js — Scriptable（IG 相／輪播）
// v1.6：唔好用 WebView 直接開 instagram.com，否則 iOS 會跳去 IG App 然後停死。
// 先用 Request 讀 HTML。一定要開頁先至加 #weblink（IG 自己排除咗呢個 fragment 嘅 Universal Link）。

const VERSION = "1.6.0-ig-photos";

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

function firstFromArgs() {
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
  return "";
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
    version: '1.6.0-ig-photos'
  });
})();
`;

function decodeEscapedUrl(value) {
  let t = String(value || "");
  t = t.replace(/\\u0026/gi, "&").replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
  t = t.replace(/&amp;/g, "&").replace(/\\"/g, '"');
  return t.trim();
}

function imagesFromHtml(html) {
  const text = decodeEscapedUrl(html);
  const found = [];
  let skippedVideo = 0;
  let m;
  const reVid = /"video_versions"\s*:\s*\[/g;
  while ((m = reVid.exec(text))) skippedVideo++;
  const reOg = /property=["']og:image["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*property=["']og:image["']/gi;
  while ((m = reOg.exec(text))) found.push(m[1] || m[2]);
  const reNamed = /"(?:display_uri|display_url|thumbnail_src|thumbnail_url)"\s*:\s*"(https:[^"]+)"/g;
  while ((m = reNamed.exec(text))) found.push(m[1]);
  const reImg = /"image_versions2"\s*:\s*\{\s*"candidates"\s*:\s*\[\s*\{[\s\S]*?"url"\s*:\s*"(https:[^"]+)"/g;
  while ((m = reImg.exec(text))) found.push(m[1]);
  const reSrc = /<img[^>]+src=["'](https:[^"']+)["']/gi;
  while ((m = reSrc.exec(text))) found.push(m[1]);
  const seen = {};
  const images = [];
  for (let i = 0; i < found.length; i++) {
    const u = decodeEscapedUrl(found[i]);
    if (!u || u.indexOf("data:") === 0) continue;
    if (/\.(mp4|m3u8)(\?|$)/i.test(u)) {
      skippedVideo++;
      continue;
    }
    if (/rsrc\.php|static\.cdninstagram|profile_pic|emoji/i.test(u)) continue;
    if (!/cdninstagram|fbcdn|scontent/i.test(u)) continue;
    const key = u.split("?")[0];
    if (seen[key]) continue;
    seen[key] = true;
    images.push(u);
    if (images.length >= 20) break;
  }
  const loginWall = images.length === 0 && /log in|login|登入|sign up|註冊|accounts\/login/i.test(text);
  let username = "";
  const um = text.match(/"username"\s*:\s*"([A-Za-z0-9._]+)"/);
  if (um) username = um[1];
  return { images: images, skippedVideo: skippedVideo, loginWall: loginWall, username: username };
}

function stayInScriptableUrl(url) {
  const u = String(url || "").trim().replace(/#.*$/, "");
  if (!/instagram\.com|instagr\.am/i.test(u)) return u;
  return u + "#weblink";
}

function pageCandidates(url) {
  const out = [String(url || "")];
  const m = String(url || "").match(/https?:\/\/(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am)\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (m) out.push("https://www.instagram.com/" + m[1] + "/" + m[2] + "/embed/captioned/");
  return out;
}

async function fetchHtml(url) {
  const req = new Request(String(url).split("#")[0]);
  req.timeoutInterval = 25;
  req.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8"
  };
  return await withTimeout(req.loadString(), 25, "fetch_timeout");
}

async function extractByRequest(url) {
  const pages = pageCandidates(url);
  let best = { images: [], skippedVideo: 0, loginWall: false, username: "" };
  for (let i = 0; i < pages.length; i++) {
    let html = "";
    try {
      html = await fetchHtml(pages[i]);
    } catch (e) {
      continue;
    }
    const parsed = imagesFromHtml(html || "");
    if (parsed.images.length > best.images.length) best = parsed;
    if (best.images.length) break;
    if (parsed.loginWall) best.loginWall = true;
  }
  return {
    ok: best.images.length > 0,
    images: best.images,
    skippedVideo: best.skippedVideo,
    loginWall: best.loginWall,
    username: best.username,
    url: url,
    via: "request"
  };
}

async function extractWithWebView(url) {
  const safe = stayInScriptableUrl(url);
  if (safe.indexOf("#weblink") < 0) {
    return { ok: false, error: "blocked_app_link", url: url };
  }
  await say(
    "而家喺 Scriptable 開頁",
    "呢頁留喺 Scriptable，唔係 IG App。\n見到相之後撳右上角「完成」。\n如果電話跳去 IG App，請即刻返嚟，然後刷新安裝頁再複製腳本（要見到 1.6.0-ig-photos）。"
  );
  const wv = new WebView();
  let loadState = "ok";
  try {
    await withTimeout(wv.loadURL(safe), 20, "load_timeout");
  } catch (e) {
    loadState = String(e && e.message ? e.message : e);
  }

  try {
    await wv.present(true);
  } catch (e) {
    return { ok: false, error: "present_failed", message: String(e), url: safe };
  }

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

  data.url = safe;
  if (data.images && data.images.length) data.ok = true;
  else if (!data.error) data.error = loadState !== "ok" ? "load_timeout" : "no_images";
  return data;
}

async function extractPhotos(url) {
  const viaHttp = await extractByRequest(url);
  if (viaHttp.ok && viaHttp.images && viaHttp.images.length) return viaHttp;
  const viaPage = await extractWithWebView(url);
  if (viaPage && viaPage.images && viaPage.images.length) {
    viaPage.ok = true;
    return viaPage;
  }
  if (viaHttp.loginWall && viaPage) viaPage.loginWall = true;
  return viaPage || viaHttp;
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
  await say("IG存相 " + VERSION, "腳本已開始。而家讀相，唔會打開 IG App。");
  const fromShortcut = openedFromShortcut(queryBag());
  let url = normalizeUrl(firstFromArgs() || "");
  if (!url) {
    try {
      url = normalizeUrl(extractUrl(Pasteboard.pasteString() || ""));
    } catch (e) {
      await say("讀唔到剪貼簿", "iPhone 擋住剪貼簿。請先喺 IG 複製連結，再開 Scriptable 撳播放。");
    }
  }
  if (!url) {
    if (fromShortcut) {
      await say(
        "冇帶到連結",
        "捷徑同剪貼簿都冇 IG 連結。\n" +
          "請喺 IG 撳「複製連結」，打開 Scriptable，撳「IG存相解析」播放。"
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
    extracted = await extractPhotos(url);
  } catch (e) {
    await say("出錯", "讀取時失敗，冇打開 IG App。\n" + String(e));
    return;
  }

  if (extracted.error == "cancelled") {
    await say("已取消", "你取消咗，冇下載。");
    return;
  }

  if (!extracted.ok || !extracted.images || !extracted.images.length) {
    const msg =
      extracted.error == "blocked_app_link"
        ? "為咗唔好跳去 IG App，已停止開頁。請刷新安裝頁，確認腳本係 1.6.0-ig-photos。"
        : extracted.error == "present_failed"
          ? "開唔到頁，已留喺 Scriptable。請再撳播放試一次。"
          : extracted.error == "load_failed" || extracted.error == "load_timeout"
            ? "載入 IG 太慢或失敗。冇打開 IG App。"
            : extracted.error == "login_wall" || extracted.loginWall
              ? "登入牆或私人／刪除貼文，讀唔到相。"
              : extracted.isReelPath
                ? "呢頁好似係影片，呢版只存相。"
                : "讀唔到相片。公開貼文先得。如果出過網頁，要撳完成。唔會因為咁跳去 IG App。";
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
