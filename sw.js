var CACHE = "jpn5-shell-v3";
var CACHE_PREFIX = "jpn5-";
var SHELL = [
  "index.html",
  "css/app.css",
  "js/logic.js",
  "js/store.js",
  "js/speech.js",
  "js/app.js",
  "manifest.json",
  "icons/icon-32.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "content/units-index.json",
  "content/units/unit-n5-12.json",
  "content/kana-sounds.json",
  "assets/mascot/cat-happy.png",
  "assets/mascot/cat-encourage.png",
  "assets/mascot/cat-celebrate.png",
  "assets/mascot/cat-think.png",
  "assets/mascot/cat-headphone.png",
  "assets/mascot/cat-keep.png",
  "assets/mascot/cat-face.png",
  "assets/units/unit-12-verbs.png",
  "assets/ui/icon-turtle.png",
  "assets/ui/icon-speaker.png",
  "assets/ui/icon-bookmark.png",
  "assets/ui/icon-bookmark-filled.png",
  "assets/tabs/tab-study-active.png",
  "assets/tabs/tab-study-inactive.png",
  "assets/tabs/tab-review-active.png",
  "assets/tabs/tab-review-inactive.png",
  "assets/tabs/tab-me-active.png",
  "assets/tabs/tab-me-inactive.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(precache().then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (key) {
      return key !== CACHE && key.indexOf(CACHE_PREFIX) === 0;
    }).map(function (key) {
      return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

function fresh(url) {
  return fetch(url, { cache: "reload" });
}

async function precache() {
  var cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async function (url) {
    var response = await fresh(url);
    if (!response.ok) throw new Error(url);
    await cache.put(url, response);
  }));
  try {
    var page = await cache.match("index.html");
    if (page) {
      await cache.put("./", page.clone());
      await cache.put(".", page.clone());
    }
  } catch (err) {
    /* index.html is enough when the directory URL cannot be cached. */
  }
}

async function networkFirst(request) {
  var cache = await caches.open(CACHE);
  try {
    var freshResponse = await fresh(request.url);
    if (freshResponse && freshResponse.ok && freshResponse.type === "basic") {
      await cache.put(request, freshResponse.clone());
    }
    return freshResponse;
  } catch (err) {
    var cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      var fallback = (await cache.match("index.html")) || (await cache.match("./"));
      if (fallback) return fallback;
    }
    return new Response("離線，而且尚未有快取。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
