// IG存相解析.js — Scriptable（IG 相／輪播）
// v1.2：每步有提示；會打開 IG 頁俾你睇；唔會静静卡住。

const VERSION = "1.2.0-ig-photos";

function firstArg() {
  if (args.urls && args.urls.length) return String(args.urls[0]);
  if (args.plainTexts && args.plainTexts.length) return String(args.plainTexts[0]);
  if (args.shortcutParameter != null) return String(args.shortcutParameter);
  try {
    if (args.queryParameters) {
      const q = args.queryParameters;
      if (q.text) return String(q.text);
      if (q.url) return String(q.url);
      if (q.input) return String(q.input);
    }
  } catch (e) {}
  const pb = Pasteboard.pasteString();
  return pb ? String(pb) : "";
}

function extractUrl(text) {
  if (!text) return "";
  let t = String(text);
  if (/instagram\.com|instagr\.am/i.test(t) && !/^https?:/i.test(t.trim())) {
    t = "https://" + t.trim().replace(/^\/\//, "");
  }
  const m = t.match(
    /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s<>"'\u3000]+/i
  );
  return m ? m[0].replace(/[)\].,，。！？]+$/u, "") : "";
}

function normalizeUrl(url) {
  let u = String(url || "").trim();
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
  a.addAction("繼續");
  await a.present();
}

async function askUrl() {
  const a = new Alert();
  a.title = "貼上 IG 連結";
  a.message = "喺 IG 撳「複製連結」，再貼喺下面。";
  a.addTextField("https://www.instagram.com/p/…", firstArg() || "");
  a.addAction("下載");
  a.addCancelAction("取消");
  const idx = await a.present();
  if (idx == -1) return "";
  return normalizeUrl(extractUrl(a.textFieldValue(0) || ""));
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
    version: '${VERSION}'
  });
})();
`;

async function extractWithWebView(url) {
  const wv = new WebView();

  // 先載入，再呈現俾用家睇（唔會背景卡死無反應）
  try {
    await wv.loadURL(url);
  } catch (e) {
    return { ok: false, error: "load_failed", message: String(e), url };
  }

  const open = new Alert();
  open.title = "請睇 IG 頁";
  open.message =
    "下一頁會打開 Instagram。\n" +
    "若要登入就登入；見到貼文相之後，撳右上角關閉／完成，就會開始存相。";
  open.addAction("打開頁面");
  open.addCancelAction("取消");
  if ((await open.present()) == -1) {
    return { ok: false, error: "cancelled", url };
  }

  await wv.present(true);

  // 關閉後再抽一次資料
  await wv.evaluateJavaScript("await new Promise(r => setTimeout(r, 800)); true");
  let raw = await wv.evaluateJavaScript(EXTRACT_JS);
  let data;
  try {
    data = typeof raw == "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    data = { ok: false, error: "parse_failed", message: String(e), url };
  }

  if ((!data.images || !data.images.length) && data.loginWall) {
    const again = new Alert();
    again.title = "仲未見到相";
    again.message = "可能未登入或頁面未載入完。再開一次頁面？";
    again.addAction("再開");
    again.addCancelAction("取消");
    if ((await again.present()) == -1) {
      data.ok = false;
      data.error = "login_wall";
      return data;
    }
    await wv.loadURL(url);
    await wv.present(true);
    raw = await wv.evaluateJavaScript(EXTRACT_JS);
    try {
      data = typeof raw == "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      data = { ok: false, error: "parse_failed", url };
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
      const data = await req.load();
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
  let url = normalizeUrl(extractUrl(firstArg()) || extractUrl(Pasteboard.pasteString() || ""));
  if (!url) {
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

  await say("開始", "下一歩會打開 IG 頁。\n連結：\n" + url);

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
      extracted.error == "load_failed"
        ? "載入 IG 失敗：" + (extracted.message || "")
        : extracted.error == "login_wall" || extracted.loginWall
          ? "登入牆或私人／刪除貼文，讀唔到相。"
          : extracted.isReelPath
            ? "呢頁好似係影片，呢版只存相。"
            : "讀唔到相片。可試：確認已登入 IG、用公開單相／輪播、關閉頁面前等相出現。";
    await say("存唔到", msg);
    return;
  }

  await say("搵到相", "搵到 " + extracted.images.length + " 張，而家存入相簿…");

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
