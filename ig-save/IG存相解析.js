// IG存相解析.js  — Scriptable（IG 相／輪播專用，免費、無伺服器）
// 由捷徑「IG存相」呼叫：用你部機嘅 Instagram 登入狀態開頁 → 抽出相 → 直接存入相簿。
// 範圍：單相 + 輪播。Reel／片會略過。唔處理 Threads。

const VERSION = "1.0.0-ig-photos";
const SCRIPT_NAME = "IG存相解析";

function firstArg() {
  if (args.urls && args.urls.length) return String(args.urls[0]);
  if (args.plainTexts && args.plainTexts.length) return String(args.plainTexts[0]);
  if (args.shortcutParameter != null) return String(args.shortcutParameter);
  const pb = Pasteboard.pasteString();
  return pb ? String(pb) : "";
}

function extractUrl(text) {
  if (!text) return "";
  const m = String(text).match(
    /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s<>"']+/i
  );
  return m ? m[0].replace(/[)\].,，。！？]+$/, "") : "";
}

function normalizeUrl(url) {
  let u = url.trim();
  u = u.replace(/[?&](igshid|igsh|utm_[^=]+|img_index)=[^&]*/gi, "");
  u = u.replace(/\?&/, "?").replace(/[?&]$/, "");
  return u;
}

function isReelOrVideoPath(url) {
  return /instagram\.com\/(reel|tv|stories)\//i.test(url);
}

async function presentLogin(webview) {
  const alert = new Alert();
  alert.title = "需要登入一次";
  alert.message =
    "請喺下一個視窗用 Instagram 官方頁面登入。\n" +
    "密碼只會留喺你部手機，唔會送到其他伺服器。\n登入完撳右上角關閉就得。";
  alert.addAction("去登入");
  alert.addCancelAction("取消");
  const idx = await alert.present();
  if (idx == -1) return true;
  await webview.present(true);
  return false;
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
    if (t.length > 400 && /(image_versions2|carousel_media|xdt_api|display_uri)/.test(t)) {
      blobText += '\\n' + t;
    }
  }

  let username = '';
  const um = blobText.match(/"username"\\s*:\\s*"([A-Za-z0-9._]+)"/);
  if (um) username = um[1];
  if (!username) {
    const pm = location.pathname.match(/\\/@([A-Za-z0-9._]+)/);
    if (pm) username = pm[1];
  }

  // Prefer carousel_media blocks first (keeps slide order), then image_versions2.
  let images = [];
  let skippedVideo = 0;
  let m;

  // Count video_versions as skipped (we do not save video).
  const reVid = /"video_versions"\\s*:\\s*\\[/g;
  while ((m = reVid.exec(blobText))) skippedVideo++;

  // Carousel: each media node often has image_versions2; collect candidate URLs in order.
  const reImg = /"image_versions2"\\s*:\\s*\\{\\s*"candidates"\\s*:\\s*\\[\\s*\\{[\\s\\S]*?"url"\\s*:\\s*"(https:[^"]+)"/g;
  while ((m = reImg.exec(blobText))) {
    images.push(unescapeJson(m[1]));
  }

  if (images.length == 0) {
    const reDisp = /"display_uri"\\s*:\\s*"(https:[^"]+)"/g;
    while ((m = reDisp.exec(blobText))) images.push(unescapeJson(m[1]));
  }

  if (images.length == 0) {
    [...document.querySelectorAll('img')].forEach(i => {
      const s = i.currentSrc || i.src;
      if (s && /cdninstagram|fbcdn/i.test(s) && !/profile_pic|emoji|rsrc/i.test(s)) {
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
    if (/rsrc\\.php|static\\.cdninstagram\\.com\\/rsrc|profile_pic|emoji/i.test(u)) return false;
    const key = u.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  const bodyText = document.body ? (document.body.innerText || '') : '';
  const loginWall = /Log in with your Instagram|用 Instagram 帳戶登入/i.test(bodyText)
    && images.length == 0;

  const pathReel = /\\/(reel|tv|stories)\\//i.test(location.pathname);

  return JSON.stringify({
    ok: !loginWall && images.length > 0,
    loginWall,
    isReelPath: pathReel,
    url: location.href,
    username,
    images,
    skippedVideo,
    title: document.title || og('og:title') || '',
    version: '${VERSION}'
  });
})();
`;

async function extractWithWebView(url) {
  const wv = new WebView();
  await wv.loadURL(url);
  await wv.evaluateJavaScript("await new Promise(r => setTimeout(r, 2800)); true");

  let html = "";
  try { html = await wv.getHTML(); } catch (e) { html = ""; }
  const looksLogin =
    /Log in with your Instagram|用 Instagram 帳戶登入/i.test(html) &&
    !(/image_versions2/.test(html) || html.indexOf("cdninstagram.com/v/") >= 0);
  if (looksLogin) {
    const cancelled = await presentLogin(wv);
    if (cancelled) return { ok: false, error: "user_cancelled_login", url };
    await wv.loadURL(url);
    await wv.evaluateJavaScript("await new Promise(r => setTimeout(r, 3000)); true");
  }

  let raw = await wv.evaluateJavaScript(EXTRACT_JS);
  let data;
  try { data = typeof raw == "string" ? JSON.parse(raw) : raw; }
  catch (e) { data = { ok: false, error: "parse_failed", message: String(e) }; }

  if (data.loginWall) {
    const alert = new Alert();
    alert.title = "睇唔到貼文";
    alert.message = "可能係私人帳號、已刪除，或者仲未登入。可以再試登入。";
    alert.addAction("再試登入");
    alert.addCancelAction("取消");
    if ((await alert.present()) == -1) {
      data.ok = false;
      data.error = "login_wall";
      return data;
    }
    await wv.present(true);
    await wv.loadURL(url);
    await wv.evaluateJavaScript("await new Promise(r => setTimeout(r, 3000)); true");
    raw = await wv.evaluateJavaScript(EXTRACT_JS);
    try { data = typeof raw == "string" ? JSON.parse(raw) : raw; }
    catch (e) { data = { ok: false, error: "parse_failed" }; }
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
      errors.push(String(e).slice(0, 80));
    }
  }
  return { saved, errors };
}

async function finish(result) {
  const json = JSON.stringify(result);
  Pasteboard.copy(json);
  Script.setShortcutOutput(json);
  return result;
}

async function main() {
  const rawIn = firstArg();
  const url = normalizeUrl(extractUrl(rawIn) || extractUrl(Pasteboard.pasteString() || ""));
  if (!url) {
    const out = { ok: false, error: "no_url", message: "搵唔到 Instagram 連結", version: VERSION };
    const a = new Alert();
    a.title = "搵唔到連結";
    a.message = "請由 IG 貼文分享表單打開「IG存相」，或者先複製貼文連結再跑。";
    a.addAction("知道");
    await a.present();
    return finish(out);
  }

  if (!/instagram\.com|instagr\.am/i.test(url)) {
    return finish({ ok: false, error: "unsupported", url, message: "只支援 Instagram", version: VERSION });
  }

  if (isReelOrVideoPath(url)) {
    const out = {
      ok: false,
      error: "reel_skipped",
      url,
      message: "呢個係 Reel／Story／IGTV，本捷徑只存相（單相／輪播）。",
      version: VERSION
    };
    const a = new Alert();
    a.title = "略過影片";
    a.message = out.message;
    a.addAction("知道");
    await a.present();
    return finish(out);
  }

  let extracted;
  try {
    extracted = await extractWithWebView(url);
  } catch (e) {
    return finish({ ok: false, error: "exception", message: String(e), url, version: VERSION });
  }

  if (!extracted.ok || !extracted.images || !extracted.images.length) {
    const msg =
      extracted.error == "login_wall" || extracted.loginWall
        ? "登入牆或私人／刪除貼文，讀唔到相。"
        : extracted.isReelPath
          ? "呢頁好似係影片，本捷徑只存相。"
          : "讀唔到相片（可能係私人貼文或頁面未載入完）。";
    const a = new Alert();
    a.title = "存唔到";
    a.message = msg;
    a.addAction("知道");
    await a.present();
    return finish({
      ok: false,
      error: extracted.error || "no_images",
      url,
      username: extracted.username || "",
      skippedVideo: extracted.skippedVideo || 0,
      message: msg,
      version: VERSION
    });
  }

  const { saved, errors } = await saveImages(extracted.images);
  const out = {
    ok: saved > 0,
    url: extracted.url || url,
    username: extracted.username || "",
    found: extracted.images.length,
    saved,
    skippedVideo: extracted.skippedVideo || 0,
    errors,
    version: VERSION
  };

  const a = new Alert();
  if (saved > 0) {
    a.title = "已存相 ✓";
    a.message =
      "已存 " + saved + " 張入相簿" +
      (extracted.username ? "（@" + extracted.username + "）" : "") +
      (extracted.skippedVideo ? "\n（略過 " + extracted.skippedVideo + " 段影片）" : "") +
      (errors.length ? "\n有 " + errors.length + " 張下載失敗" : "");
  } else {
    a.title = "下載失敗";
    a.message = "搵到相但存唔入相簿。請檢查網絡同相簿權限。";
  }
  a.addAction("知道");
  await a.present();
  return finish(out);
}

await main();
