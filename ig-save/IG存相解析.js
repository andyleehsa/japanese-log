// IG存相解析.js — Scriptable（IG 相／輪播）
// v1.9：Timer.timeInterval 係毫秒。之前把 60 當秒，實際 60 毫秒就超時。
// Request.timeoutInterval 仍然係秒，唔好乘 1000。讀頁仍然等 60 秒，失敗再試。
// v1.9.4：存相簿用 Image.fromData 再 Photos.save。只存呢篇嘅相。
// 單張直接存。輪播可以全部存，或者睇住細圖揀邊啲先存。
// https://docs.scriptable.app/image/  https://docs.scriptable.app/photos/
// https://docs.scriptable.app/uitable/

const VERSION = "1.9.4-ig-photos";
const FETCH_SECONDS = 60;

// Scriptable Timer.timeInterval is milliseconds.
// https://docs.scriptable.app/timer/
// Request.timeoutInterval is seconds. Do not pass timerMs() to a Request.
function timerMs(seconds) {
  return seconds * 1000;
}

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
    timer.timeInterval = timerMs(seconds);
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


function decodeEscapedUrl(value) {
  let t = String(value || "");
  for (let i = 0; i < 3; i++) {
    const next = t
      .replace(/\\u0026/gi, "&")
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .replace(/\\"/g, '"')
      .replace(/\\%/g, "%")
      .replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
        return String.fromCharCode(parseInt(h, 16));
      });
    if (next === t) break;
    t = next;
  }
  return t.trim();
}

function widthHint(url) {
  const m = String(url || "").match(/s(\d{3,4})x\d{3,4}/i);
  return m ? parseInt(m[1], 10) : 0;
}

function widthRank(width) {
  const w = width || 0;
  if (w >= 720 && w <= 1280) return Math.abs(w - 1080);
  if (w > 1280 && w <= 1440) return 200 + (w - 1280);
  if (w >= 480 && w < 720) return 400 + (720 - w);
  if (w > 1440) return 2000 + w;
  if (w > 0) return 800 + Math.abs(480 - w);
  return 3000;
}

function keepImageUrl(u) {
  if (!u || u.indexOf("data:") === 0) return false;
  if (/\.(mp4|m3u8)(\?|$)/i.test(u)) return false;
  if (/rsrc\.php|static\.cdninstagram|profile_pic|emoji/i.test(u)) return false;
  if (/\/t51\.[^/]+-19\//.test(u)) return false;
  const tiny = u.match(/[/_]s(\d{2,4})x\d{2,4}/i);
  if (tiny && parseInt(tiny[1], 10) <= 150) return false;
  if (!/cdninstagram|fbcdn|scontent/i.test(u)) return false;
  return true;
}

function orderGroup(items) {
  const ranked = items.map(function (it) {
    const width = it.width || widthHint(it.url);
    return { url: it.url, width: width, rank: widthRank(width) };
  });
  ranked.sort(function (a, b) {
    return a.rank - b.rank || b.width - a.width;
  });
  const urls = [];
  const seen = {};
  ranked.forEach(function (it) {
    if (seen[it.url]) return;
    seen[it.url] = true;
    urls.push(it.url);
  });
  return urls;
}

function addUrl(groups, keyIndex, url, width, forceIndex) {
  const u = decodeEscapedUrl(url);
  if (/\.(mp4|m3u8)(\?|$)/i.test(u)) return { idx: null, video: true };
  if (!keepImageUrl(u)) return { idx: null, video: false };
  const key = u.split("?")[0];
  let idx = Object.prototype.hasOwnProperty.call(keyIndex, key) ? keyIndex[key] : null;
  if (idx == null) idx = forceIndex;
  if (idx == null || !groups[idx]) {
    idx = groups.length;
    groups.push([]);
  }
  if (!Object.prototype.hasOwnProperty.call(keyIndex, key)) keyIndex[key] = idx;
  const list = groups[idx];
  for (let i = 0; i < list.length; i++) {
    if (list[i].url === u) {
      if (width && !list[i].width) list[i].width = width;
      return { idx: idx, video: false };
    }
  }
  list.push({ url: u, width: width || widthHint(u) || 0 });
  return { idx: idx, video: false };
}

function candidateBlocks(text) {
  const blocks = [];
  const re = /"candidates"\s*:\s*\[/g;
  let m;
  while ((m = re.exec(text))) {
    const pre = text.slice(Math.max(0, m.index - 80), m.index);
    if (pre.indexOf("image_versions2") < 0) continue;
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < text.length && depth > 0 && i - start < 20000) {
      const c = text.charAt(i);
      if (c === "[") depth++;
      else if (c === "]") depth--;
      i++;
    }
    blocks.push(text.slice(start, i - 1));
  }
  return blocks;
}

function indexOfKey(text, name, from, escaped) {
  const form = escaped ? '\\"' + name + '\\"' : '"' + name + '"';
  return text.indexOf(form, from || 0);
}

function extractBalanced(raw, openIndex, openChar, closeChar, escaped) {
  let depth = 0;
  let inStr = false;
  const limit = Math.min(raw.length, openIndex + 300000);
  let i = openIndex;
  while (i < limit) {
    const c = raw.charAt(i);
    if (escaped && c === "\\" && i + 1 < limit) {
      const n = raw.charAt(i + 1);
      if (n === '"') {
        inStr = !inStr;
        i += 2;
        continue;
      }
      if (n === "\\" && inStr && i + 2 < limit && raw.charAt(i + 2) === '"') {
        i += 3;
        continue;
      }
      i += 2;
      continue;
    }
    if (inStr) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      i++;
      continue;
    }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return raw.slice(openIndex, i + 1);
    }
    i++;
  }
  return "";
}

function findRawMedia(raw) {
  let from = 0;
  while (from < raw.length) {
    const plain = raw.indexOf('"shortcode_media"', from);
    const esc = raw.indexOf('\\"shortcode_media\\"', from);
    let at = -1;
    let escaped = false;
    if (plain >= 0 && (esc < 0 || plain < esc)) at = plain;
    else if (esc >= 0) {
      at = esc;
      escaped = true;
    } else return null;
    const brace = raw.indexOf("{", at);
    if (brace < 0 || brace - at > 80) {
      from = at + 16;
      continue;
    }
    const obj = extractBalanced(raw, brace, "{", "}", escaped);
    if (obj && /display_url|edge_sidecar_to_children|is_video|image_versions2|carousel_media/.test(obj)) {
      return { raw: obj, escaped: escaped };
    }
    from = brace + 1;
  }
  return null;
}

function objectNodes(raw, key, escaped) {
  const nodes = [];
  let from = 0;
  while (from < raw.length) {
    const at = indexOfKey(raw, key, from, escaped);
    if (at < 0) break;
    const brace = raw.indexOf("{", at);
    if (brace < 0 || brace - at > 40) {
      from = at + key.length;
      continue;
    }
    const node = extractBalanced(raw, brace, "{", "}", escaped);
    if (!node) break;
    nodes.push(node);
    from = brace + node.length;
  }
  return nodes;
}

function topObjects(raw, escaped) {
  const items = [];
  let from = 0;
  while (from < raw.length) {
    const brace = raw.indexOf("{", from);
    if (brace < 0) break;
    const node = extractBalanced(raw, brace, "{", "}", escaped);
    if (!node) break;
    items.push(node);
    from = brace + node.length;
  }
  return items;
}

function findRawSlides(media) {
  const sideAt = indexOfKey(media.raw, "edge_sidecar_to_children", 0, media.escaped);
  if (sideAt >= 0) {
    const brace = media.raw.indexOf("{", sideAt);
    const region = brace >= 0 ? extractBalanced(media.raw, brace, "{", "}", media.escaped) : "";
    const nodes = region ? objectNodes(region, "node", media.escaped) : [];
    if (nodes.length) return nodes;
  }
  const carAt = indexOfKey(media.raw, "carousel_media", 0, media.escaped);
  if (carAt >= 0) {
    const br = media.raw.indexOf("[", carAt);
    const arr = br >= 0 && br - carAt < 40 ? extractBalanced(media.raw, br, "[", "]", media.escaped) : "";
    const items = arr ? topObjects(arr, media.escaped) : [];
    if (items.length) return items;
  }
  return [media.raw];
}

function nodeIsVideo(decoded) {
  const flagAt = decoded.indexOf("display_url");
  const zone = decoded.slice(0, flagAt > 0 ? flagAt : 500);
  if (/GraphVideo/.test(zone)) return true;
  if (/"is_video"\s*:\s*true/.test(zone)) return true;
  if (/"media_type"\s*:\s*2\b/.test(zone)) return true;
  return false;
}

function sizedUrls(text) {
  const found = [];
  function push(url, width) {
    if (url) found.push({ url: url, width: width || widthHint(url) || 0 });
  }
  const cut = text.search(/"owner"\s*:/);
  const body = cut > 0 ? text.slice(0, cut) : text;
  const du = body.match(/"display_url"\s*:\s*"(https:[^"]+)"/);
  if (du) push(du[1], 0);
  const ts = body.match(/"thumbnail_src"\s*:\s*"(https:[^"]+)"/);
  if (ts) push(ts[1], 0);
  function absorb(arrText) {
    const re = /"(?:src|url)"\s*:\s*"(https:[^"]+)"/g;
    let m;
    while ((m = re.exec(arrText))) {
      const objStart = arrText.lastIndexOf("{", m.index);
      const objEnd = arrText.indexOf("}", m.index);
      const around = arrText.slice(objStart < 0 ? m.index : objStart, objEnd < 0 ? m.index + 20 : objEnd + 1);
      const wm = around.match(/"(?:config_width|width)"\s*:\s*(\d+)/);
      push(m[1], wm ? parseInt(wm[1], 10) : 0);
    }
  }
  ["display_resources", "thumbnail_resources"].forEach(function (name) {
    const at = body.indexOf('"' + name + '"');
    if (at < 0) return;
    const br = body.indexOf("[", at);
    if (br < 0 || br - at > 40) return;
    const arr = extractBalanced(body, br, "[", "]", false);
    if (arr) absorb(arr);
  });
  candidateBlocks(body).forEach(absorb);
  return found;
}

function embeddedImageUrls(text) {
  const found = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(text))) {
    const tag = m[0];
    if (!/EmbeddedMediaImage/i.test(tag)) continue;
    const src = tag.match(/src=["'](https:[^"']+)["']/i);
    if (src) found.push(src[1]);
  }
  return found;
}

function imagesFromHtml(html) {
  const raw = String(html || "");
  const text = decodeEscapedUrl(raw);
  let skippedVideo = 0;
  const groups = [];
  const keyIndex = {};
  let authoritative = false;
  let username = "";

  function take(url, width, forceIndex) {
    const added = addUrl(groups, keyIndex, url, width, forceIndex);
    if (added.video) skippedVideo++;
    return added.idx;
  }

  function addPhoto(items) {
    let force = null;
    (items || []).forEach(function (it) {
      const idx = take(it.url, it.width, force);
      if (idx != null && force == null) force = idx;
    });
  }

  function addBlocks(blocks) {
    blocks.forEach(function (block) {
      const found = [];
      const reUrl = /"url"\s*:\s*"(https:[^"]+)"/g;
      let um;
      while ((um = reUrl.exec(block))) {
        const objStart = block.lastIndexOf("{", um.index);
        const objEnd = block.indexOf("}", um.index);
        const around = block.slice(objStart < 0 ? um.index : objStart, objEnd < 0 ? um.index + um[0].length : objEnd + 1);
        const wm = around.match(/"width"\s*:\s*(\d+)/);
        found.push({ url: um[1], width: wm ? parseInt(wm[1], 10) : widthHint(um[1]) });
      }
      addPhoto(found);
    });
  }

  const media = findRawMedia(raw);
  if (media) {
    authoritative = true;
    const decodedMedia = decodeEscapedUrl(media.raw);
    const um = decodedMedia.match(/"owner"\s*:\s*\{[\s\S]{0,800}?"username"\s*:\s*"([A-Za-z0-9._]+)"/);
    if (um) username = um[1];
    findRawSlides(media).forEach(function (nodeRaw) {
      const node = decodeEscapedUrl(nodeRaw);
      if (nodeIsVideo(node)) {
        skippedVideo++;
        return;
      }
      addPhoto(sizedUrls(node));
    });
    if (!groups.length && !skippedVideo) {
      embeddedImageUrls(text).forEach(function (url) {
        take(url, 0, null);
      });
    }
  } else {
    const blocks = candidateBlocks(text);
    if (blocks.length) {
      addBlocks(blocks);
    } else {
      const embedded = embeddedImageUrls(text);
      if (embedded.length) {
        embedded.forEach(function (url) {
          take(url, 0, null);
        });
      } else {
        const og = text.match(/property=["']og:image["'][^>]*content=["'](https:[^"']+)["']/i)
          || text.match(/content=["'](https:[^"']+)["'][^>]*property=["']og:image["']/i);
        if (og) take(og[1], 0, null);
        else {
          const du = text.match(/"(?:display_url|display_uri)"\s*:\s*"(https:[^"]+)"/);
          if (du) take(du[1], 0, null);
        }
      }
    }
  }

  const images = [];
  const fallbacks = [];
  groups.forEach(function (items) {
    if (!items || !items.length || images.length >= 20) return;
    const ordered = orderGroup(items);
    if (!ordered.length) return;
    images.push(ordered[0]);
    fallbacks.push(ordered.slice(1, 4));
  });
  const loginWall = images.length === 0 && !skippedVideo && /log in|login|登入|sign up|註冊|accounts\/login/i.test(text);
  if (!username) {
    const um = text.match(/"username"\s*:\s*"([A-Za-z0-9._]+)"/);
    if (um) username = um[1];
  }
  return {
    images: images,
    fallbacks: fallbacks,
    skippedVideo: skippedVideo,
    loginWall: loginWall,
    username: username,
    authoritative: authoritative
  };
}

function withStp(url, stp) {
  if (/[?&]stp=/.test(url)) return url.replace(/([?&]stp=)[^&]*/, "$1" + stp);
  if (url.indexOf("?") >= 0) return url + "&stp=" + stp;
  return url + "?stp=" + stp;
}

function downloadPlan(url, extras) {
  const ordered = [];
  function push(raw) {
    const u = decodeEscapedUrl(raw);
    if (!keepImageUrl(u) || ordered.indexOf(u) >= 0) return;
    ordered.push(u);
  }
  push(url);
  const extraList = extras || [];
  for (let i = 0; i < extraList.length; i++) push(extraList[i]);
  const seeds = ordered.slice();
  for (let i = 0; i < seeds.length; i++) {
    push(withStp(seeds[i], "dst-jpg_e35_s1080x1080_tt6"));
    push(withStp(seeds[i], "dst-jpg_e35_s640x640_tt6"));
  }
  return ordered.slice(0, 4);
}

function previewUrl(url, extras) {
  const list = [];
  function push(raw) {
    const u = decodeEscapedUrl(raw);
    if (!u || list.indexOf(u) >= 0) return;
    list.push(u);
  }
  push(url);
  const extraList = extras || [];
  for (let i = 0; i < extraList.length; i++) push(extraList[i]);
  let best = "";
  let bestW = 99999;
  for (let i = 0; i < list.length; i++) {
    const w = widthHint(list[i]);
    if (w >= 160 && w <= 480 && w < bestW) {
      best = list[i];
      bestW = w;
    }
  }
  if (best) return best;
  const seed = list[0] || "";
  if (!seed) return "";
  return withStp(seed, "dst-jpg_e35_s320x320_tt6");
}

function attemptSequence(plan) {
  const seq = [];
  if (!plan || !plan.length) return seq;
  seq.push(plan[0]);
  seq.push(plan[0]);
  if (plan.length > 1) seq.push(plan[1]);
  else seq.push(plan[0]);
  return seq;
}

function imageHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
    "Accept": "image/jpeg,image/png,image/webp,image/*;q=0.8,*/*;q=0.5",
    "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.instagram.com/"
  };
}

function saveFailureMessage(errors) {
  const list = (errors || []).map(function (e) {
    return String(e || "");
  });
  const download = list.some(function (e) {
    return /download_timeout|timeout|timed out|empty|NSURLError|network|offline|could not connect|lost connection|socket/i.test(e);
  });
  const refused = list.some(function (e) {
    return /HTTP 40[0-9]|HTTP 5[0-9]|forbidden/i.test(e);
  });
  const badImage = list.some(function (e) {
    return /not_image/i.test(e);
  });
  const photo = list.some(function (e) {
    return /PHPhoto|not authorized|authorization status|permission denied|權限/i.test(e);
  });
  const api = list.some(function (e) {
    return /is not a function|is undefined|TypeError|ReferenceError|not defined|Can't find variable/i.test(e);
  });
  const detail = list[0] || "";
  if (api && !photo) {
    return {
      title: "存相出錯",
      message:
        "相已經下載到，但係存入相簿嗰步程式出錯。呢個唔係 IG 拒絕圖片，亦唔係網絡超時。\n" +
        "請刷新安裝頁，重新複製最新腳本再試。\n" +
        detail
    };
  }
  if (badImage && !photo && !api) {
    return {
      title: "下載失敗",
      message:
        "下載到嘅內容讀唔成圖片，可能 IG 冇畀到真正嘅相。\n" +
        "請返 IG 重新撳「複製連結」，再喺 Scriptable 撳播放。\n" +
        detail
    };
  }
  if (refused && !photo && !api) {
    return {
      title: "下載失敗",
      message:
        "IG 拒絕咗圖片，或者條圖片網址已經失效。\n" +
        "請返 IG 重新撳「複製連結」，再喺 Scriptable 撳播放。\n" +
        detail
    };
  }
  if (download && !photo) {
    return {
      title: "下載失敗",
      message:
        "搵到相，但係圖片下載超時或者網絡失敗，張相未存到。\n" +
        "請轉 Wi‑Fi，再撳播放試一次。\n" +
        detail
    };
  }
  if (download && photo) {
    return {
      title: "未存完",
      message:
        "有圖片下載超時，亦有相存唔入相簿。\n" +
        "超時：轉 Wi‑Fi 再撳播放。\n" +
        "存唔入相簿：去 iPhone 設定 → Scriptable → 相片，改成「所有相片」。\n" +
        detail
    };
  }
  if (photo) {
    return {
      title: "存唔入相簿",
      message:
        "相下載到，但係存唔入相簿。\n" +
        "請去 iPhone 設定 → Scriptable → 相片，改成「所有相片」。\n" +
        detail
    };
  }
  return {
    title: "下載失敗",
    message: "搵到相但未存到。請轉 Wi‑Fi 再撳播放試一次。\n" + detail
  };
}

const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";

function shortcodeOf(text) {
  const s = String(text || "");
  const m = s.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)
    || s.match(/"shortcode"\s*:\s*"([A-Za-z0-9_-]+)"/);
  if (!m) return "";
  if (/^(p|reel|reels|tv)$/i.test(m[1])) return "";
  return m[1];
}

function httpTargets(url) {
  const clean = String(url || "").trim().replace(/#.*$/, "");
  const out = [];
  function push(u) {
    if (u && out.indexOf(u) < 0) out.push(u);
  }
  const code = shortcodeOf(clean);
  const video = /instagram\.com\/(?:reel|reels|tv|stories)\//i.test(clean);
  if (code && !video) {
    push("https://www.instagram.com/p/" + code + "/embed/captioned/");
    push("https://www.instagram.com/p/" + code + "/embed/");
  }
  push(clean);
  return out;
}

function missingReason(info) {
  const item = info || {};
  if (item.skippedVideo && !(item.images && item.images.length)) return "呢篇係影片，呢版只存相（單相／輪播）。";
  if (item.isReelPath) return "呢頁好似係影片，呢版只存相。";
  if (item.loginWall) return "公開貼文先得。呢條可能係私人、已刪除，或者要登入先睇到。";
  if (item.fetched) return "讀到 IG 回覆，但係入面冇相片網址。請用公開相嘅「複製連結」再試（Reel 唔存）。";
  if (/fetch_timeout|timeout/i.test(item.lastError || "")) {
    return "連線超時，讀唔到 IG。流動數據可能較慢。\n請轉 Wi‑Fi，或者再撳播放試一次。\n" + item.lastError;
  }
  return "連線失敗，讀唔到 IG。請轉 Wi‑Fi，或者再撳播放試一次。" + (item.lastError ? "\n" + item.lastError : "");
}

function chosenIndices(count, mode, picked) {
  const n = count || 0;
  if (n <= 0 || mode === "cancel") return [];
  if (mode === "all" || n === 1) {
    const all = [];
    for (let i = 0; i < n; i++) all.push(i);
    return all;
  }
  const out = [];
  const src = picked || [];
  for (let i = 0; i < src.length; i++) {
    const idx = src[i];
    if (idx >= 0 && idx < n && out.indexOf(idx) < 0) out.push(idx);
  }
  out.sort(function (a, b) { return a - b; });
  return out;
}

function subsetPairs(images, fallbacks, indices) {
  const urls = [];
  const alts = [];
  const imgs = images || [];
  const fb = fallbacks || [];
  const order = indices || [];
  for (let i = 0; i < order.length; i++) {
    const idx = order[i];
    if (!imgs[idx]) continue;
    urls.push(imgs[idx]);
    alts.push(fb[idx] || []);
  }
  return { images: urls, fallbacks: alts };
}

function htmlHeaders() {
  return {
    "User-Agent": SAFARI_UA,
    "Accept": "text/html,application/xhtml+xml,application/json",
    "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.instagram.com/"
  };
}

async function fetchText(url, headers) {
  const req = new Request(String(url).split("#")[0]);
  req.timeoutInterval = FETCH_SECONDS;
  req.headers = headers || htmlHeaders();
  let finalUrl = String(url);
  try {
    req.onRedirect = function (next) {
      try {
        if (next && next.url) finalUrl = String(next.url);
      } catch (e) {}
    };
  } catch (e) {}
  const body = await withTimeout(req.loadString(), FETCH_SECONDS, "fetch_timeout");
  let setCookie = "";
  let status = 0;
  try {
    status = statusOf(req);
    const h = req.response && req.response.headers;
    setCookie = String((h && (h["Set-Cookie"] || h["set-cookie"])) || "");
    if (req.url && shortcodeOf(req.url)) finalUrl = String(req.url);
  } catch (e) {}
  return { body: body || "", status: status, setCookie: setCookie, url: finalUrl };
}

async function fetchGraphql(shortcode, lsd, csrf) {
  const req = new Request("https://www.instagram.com/api/graphql");
  req.method = "POST";
  req.timeoutInterval = FETCH_SECONDS;
  req.headers = {
    "User-Agent": SAFARI_UA,
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
    "X-IG-App-ID": "936619743392459",
    "X-CSRFToken": csrf || "missing",
    "X-FB-LSD": lsd || "",
    "Referer": "https://www.instagram.com/p/" + shortcode + "/",
    "Origin": "https://www.instagram.com",
    "Cookie": csrf ? "csrftoken=" + csrf : ""
  };
  const variables = JSON.stringify({
    shortcode: shortcode,
    __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false
  });
  req.body = "variables=" + encodeURIComponent(variables)
    + "&doc_id=27128499623469141&server_timestamps=true&lsd=" + encodeURIComponent(lsd || "");
  return await withTimeout(req.loadString(), FETCH_SECONDS, "fetch_timeout");
}

async function extractByRequest(url) {
  const queue = httpTargets(url);
  const seen = {};
  let best = { images: [], fallbacks: [], skippedVideo: 0, loginWall: false, username: "", authoritative: false };
  let fetched = 0;
  let lastError = "";
  let csrf = "";
  let lsd = "";
  for (let i = 0; i < queue.length && i < 5; i++) {
    const page = queue[i];
    if (!page || seen[page]) continue;
    seen[page] = true;
    if (/instagram\.com\/(?:reel|reels|tv|stories)\//i.test(page)) {
      return { ok: false, images: [], isReelPath: true, via: "request", fetched: fetched };
    }
    let res = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetchText(page);
        break;
      } catch (e) {
        lastError = String(e && e.message ? e.message : e);
        res = null;
        if (attempt === 0) {
          try { await sleepSeconds(1.5); } catch (err) {}
        }
      }
    }
    if (!res) continue;
    fetched++;
    const cookieMatch = String(res.setCookie || "").match(/csrftoken=([^;,\s]+)/);
    if (cookieMatch) csrf = cookieMatch[1];
    const lsdMatch = String(res.body || "").match(/"LSD",\[\],\{"token":"([^"]+)"/);
    if (lsdMatch) lsd = lsdMatch[1];
    const landed = res.url || page;
    if (/instagram\.com\/(?:reel|reels|tv|stories)\//i.test(landed)) {
      return { ok: false, images: [], isReelPath: true, via: "request", fetched: fetched };
    }
    const code = shortcodeOf(landed) || shortcodeOf(page) || shortcodeOf(res.body);
    if (code) {
      const embed = "https://www.instagram.com/p/" + code + "/embed/captioned/";
      const light = "https://www.instagram.com/p/" + code + "/embed/";
      if (!seen[embed]) queue.push(embed);
      if (!seen[light]) queue.push(light);
    }
    const parsed = imagesFromHtml(res.body || "");
    if (parsed.authoritative) {
      best = parsed;
      break;
    }
    if (parsed.images.length > best.images.length) best = parsed;
    if (best.images.length) break;
    if (parsed.loginWall) best.loginWall = true;
  }
  if (!best.images.length && !best.authoritative) {
    const code = shortcodeOf(url) || shortcodeOf(queue.join("\n"));
    if (code) {
      for (let attempt = 0; attempt < 2 && !best.images.length; attempt++) {
        try {
          const json = await fetchGraphql(code, lsd, csrf);
          fetched++;
          const parsed = imagesFromHtml(json || "");
          if (parsed.images.length) best = parsed;
          break;
        } catch (e) {
          lastError = String(e && e.message ? e.message : e);
          if (attempt === 0) {
            try { await sleepSeconds(1.5); } catch (err) {}
          }
        }
      }
    }
  }
  return {
    ok: best.images.length > 0,
    images: best.images || [],
    fallbacks: best.fallbacks || [],
    skippedVideo: best.skippedVideo || 0,
    loginWall: !!best.loginWall,
    username: best.username || "",
    fetched: fetched,
    lastError: lastError,
    via: "request"
  };
}


function sleepSeconds(seconds) {
  return new Promise(function (resolve) {
    const timer = new Timer();
    timer.timeInterval = timerMs(seconds);
    timer.schedule(function () {
      try { timer.invalidate(); } catch (e) {}
      resolve();
    });
  });
}

function statusOf(req) {
  try {
    return (req.response && req.response.statusCode) || 0;
  } catch (e) {
    return 0;
  }
}

async function loadImageOnce(url) {
  const req = new Request(url);
  req.timeoutInterval = 60;
  req.headers = imageHeaders();
  let data = null;
  try {
    data = await withTimeout(req.load(), 60, "download_timeout");
  } catch (e) {
    const status = statusOf(req);
    if (status >= 400) throw new Error("HTTP " + status);
    throw e;
  }
  const status = statusOf(req);
  if (status >= 400) throw new Error("HTTP " + status);
  if (!data || data.byteLength < 200) throw new Error(status ? "empty HTTP " + status : "empty");
  return data;
}

async function loadPreviewImage(url) {
  if (!url) return null;
  try {
    const req = new Request(url);
    req.timeoutInterval = 8;
    req.headers = imageHeaders();
    const data = await withTimeout(req.load(), 8, "preview_timeout");
    if (!data || data.byteLength < 200) return null;
    return Image.fromData(data) || null;
  } catch (e) {
    return null;
  }
}

async function loadPreviews(images, fallbacks) {
  const imgs = images || [];
  const fb = fallbacks || [];
  const jobs = [];
  for (let i = 0; i < imgs.length; i++) jobs.push(loadPreviewImage(previewUrl(imgs[i], fb[i])));
  try {
    return await Promise.all(jobs);
  } catch (e) {
    const empty = [];
    for (let i = 0; i < imgs.length; i++) empty.push(null);
    return empty;
  }
}

async function saveDownloadedImage(data) {
  // Photos 冇 fromData。官方係 Image.fromData(data) 再 Photos.save(image)。
  const image = Image.fromData(data);
  if (!image) throw new Error("not_image");
  await Photos.save(image);
}

async function saveImages(urls, fallbacks) {
  let saved = 0;
  const errors = [];
  const list = urls || [];
  const alts = fallbacks || [];
  for (let i = 0; i < list.length; i++) {
    const seq = attemptSequence(downloadPlan(list[i], alts[i]));
    let data = null;
    let lastError = "download_timeout";
    for (let t = 0; t < seq.length; t++) {
      try {
        data = await loadImageOnce(seq[t]);
        lastError = "";
        break;
      } catch (e) {
        lastError = String(e && e.message ? e.message : e);
        if (t < seq.length - 1) {
          try { await sleepSeconds(1.2); } catch (err) {}
        }
      }
    }
    if (!data) {
      errors.push(lastError || "download_timeout");
      continue;
    }
    try {
      await saveDownloadedImage(data);
      saved++;
    } catch (e) {
      errors.push(String(e && e.message ? e.message : e).slice(0, 180));
    }
  }
  return { saved, errors };
}

function styleChoiceCell(cell, on) {
  try {
    cell.titleFont = Font.boldSystemFont(22);
    cell.subtitleFont = Font.systemFont(16);
    if (on === true) cell.titleColor = Color.green();
    else if (on === false) cell.titleColor = Color.gray();
  } catch (e) {}
}

async function askCarouselMode(count) {
  const a = new Alert();
  a.title = "搵到 " + count + " 張相";
  a.message = "可以全部存，或者揀邊啲先存。";
  a.addAction("全部存");
  a.addAction("揀邊啲存");
  a.addCancelAction("取消");
  const idx = await a.present();
  if (idx === -1) return "cancel";
  if (idx === 0) return "all";
  return "pick";
}

async function pickByLooking(count, previews) {
  const picked = [];
  const shots = previews || [];
  for (let i = 0; i < count; i++) {
    const shot = shots[i] || null;
    if (shot) {
      try {
        if (typeof QuickLook !== "undefined") await QuickLook.present(shot, true);
      } catch (e) {}
    }
    const a = new Alert();
    a.title = shot ? ("第 " + (i + 1) + "／" + count + " 張") : ("第 " + (i + 1) + " 張（預覽失敗）");
    a.message = shot ? "頭先睇到嗰張，存唔存？" : "預覽唔到，仍然可以揀存唔存。";
    a.addAction("存呢張");
    a.addAction("唔存呢張");
    a.addAction("之後全部都存");
    a.addCancelAction("取消");
    const idx = await a.present();
    if (idx === -1) return null;
    if (idx === 0) picked.push(i);
    if (idx === 2) {
      for (let j = i; j < count; j++) picked.push(j);
      break;
    }
  }
  return picked;
}

async function pickWithTable(count, previews) {
  const selected = [];
  const shots = previews || [];
  for (let i = 0; i < count; i++) selected.push(true);
  let decision = "cancel";
  let imageApiBroken = false;
  const table = new UITable();
  table.showSeparators = true;

  function rebuild(live) {
    table.removeAllRows();
    const hint = new UITableRow();
    const hintCell = hint.addText("揀要存嘅相", "左邊係細圖。撳一行就轉存唔存。");
    styleChoiceCell(hintCell);
    table.addRow(hint);
    for (let i = 0; i < count; i++) {
      const row = new UITableRow();
      try { row.height = 110; } catch (e) {}
      row.dismissOnSelect = false;
      row.onSelect = function (index) {
        selected[index] = !selected[index];
        rebuild(true);
      }.bind(null, i);
      let failed = !shots[i];
      if (shots[i] && !imageApiBroken) {
        try {
          const imgCell = row.addImage(shots[i]);
          imgCell.widthWeight = 36;
          failed = false;
        } catch (e) {
          imageApiBroken = true;
          failed = true;
        }
      }
      const on = selected[i];
      const cell = row.addText(
        (on ? "✓  存  第 " : "○  唔存  第 ") + (i + 1) + " 張" + (failed ? "（預覽失敗）" : ""),
        on ? "撳一下就唔存呢張" : "撳一下就存呢張"
      );
      cell.widthWeight = failed ? 100 : 64;
      styleChoiceCell(cell, on);
      table.addRow(row);
    }
    const allRow = new UITableRow();
    allRow.dismissOnSelect = false;
    allRow.onSelect = function () {
      for (let n = 0; n < count; n++) selected[n] = true;
      rebuild(true);
    };
    const allCell = allRow.addText("全選", "全部打勾");
    styleChoiceCell(allCell);
    table.addRow(allRow);
    const saveRow = new UITableRow();
    saveRow.dismissOnSelect = true;
    saveRow.onSelect = function () { decision = "save"; };
    const saveCell = saveRow.addText("存已揀嘅相", "撳呢行就開始下載大圖");
    styleChoiceCell(saveCell, true);
    table.addRow(saveRow);
    const cancelRow = new UITableRow();
    cancelRow.dismissOnSelect = true;
    cancelRow.onSelect = function () { decision = "cancel"; };
    const cancelCell = cancelRow.addText("取消", "唔存，返回");
    styleChoiceCell(cancelCell, false);
    table.addRow(cancelRow);
    if (live) table.reload();
  }

  rebuild(false);
  if (imageApiBroken) throw new Error("table_image");
  await table.present(true);
  if (decision !== "save") return null;
  const picked = [];
  for (let i = 0; i < count; i++) if (selected[i]) picked.push(i);
  return picked;
}

async function pickIndices(images, fallbacks) {
  const count = (images || []).length;
  const previews = await loadPreviews(images, fallbacks);
  try {
    if (typeof UITable !== "function") return await pickByLooking(count, previews);
    return await pickWithTable(count, previews);
  } catch (e) {
    return await pickByLooking(count, previews);
  }
}

async function chooseImages(images, fallbacks) {
  const count = (images || []).length;
  if (count <= 1) {
    return { images: images || [], fallbacks: fallbacks || [], cancelled: false };
  }
  const mode = await askCarouselMode(count);
  if (mode === "cancel") return { images: [], fallbacks: [], cancelled: true, reason: "cancel" };
  if (mode === "all") return { images: images, fallbacks: fallbacks || [], cancelled: false };
  const picked = await pickIndices(images, fallbacks);
  if (!picked) return { images: [], fallbacks: [], cancelled: true, reason: "cancel" };
  const indices = chosenIndices(count, "pick", picked);
  if (!indices.length) return { images: [], fallbacks: [], cancelled: true, reason: "none" };
  const subset = subsetPairs(images, fallbacks, indices);
  return { images: subset.images, fallbacks: subset.fallbacks, cancelled: false };
}

async function main() {
  await say("IG存相 " + VERSION, "腳本已開始。只會用網絡讀相，唔會打開 IG App。");
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
    extracted = await extractByRequest(url);
  } catch (e) {
    await say("存唔到", missingReason({ fetched: 0, lastError: String(e && e.message ? e.message : e) }));
    return;
  }

  if (extracted.isReelPath) {
    await say("略過影片", "呢個係 Reel／Story／IGTV，呢版只存相（單相／輪播）。");
    return;
  }

  if (!extracted.ok || !extracted.images || !extracted.images.length) {
    if (extracted.skippedVideo) await say("略過影片", missingReason(extracted));
    else await say("存唔到", missingReason(extracted));
    return;
  }

  const choice = await chooseImages(extracted.images, extracted.fallbacks);
  if (choice.cancelled) {
    if (choice.reason === "none") await say("未揀相", "冇揀任何相，已取消。");
    else await say("已取消", "冇存相。");
    return;
  }

  let saved = 0;
  let errors = [];
  try {
    const r = await saveImages(choice.images, choice.fallbacks);
    saved = r.saved;
    errors = r.errors;
  } catch (e) {
    const fail = saveFailureMessage([String(e && e.message ? e.message : e)]);
    await say(fail.title, fail.message);
    return;
  }

  if (saved > 0) {
    let savedText = "已存 " + saved + " 張入相簿";
    if (extracted.username) savedText += "（@" + extracted.username + "）";
    if (extracted.skippedVideo) savedText += "\n（呢篇另外有 " + extracted.skippedVideo + " 段影片，冇存）";
    if (errors.length) savedText += "\n有 " + errors.length + " 張未存到";
    await say("已存相 ✓", savedText);
  } else {
    const fail = saveFailureMessage(errors);
    await say(fail.title, fail.message);
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
