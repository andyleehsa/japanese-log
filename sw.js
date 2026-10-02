var CACHE = "jp-log-v14";
var SHELL = [
  "index.html",
  "css/app.css",
  "js/logic.js",
  "js/store.js",
  "js/speech.js",
  "js/sync.js",
  "js/app.js",
  "manifest.json",
  "icons/icon-32.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "content/index.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(precache().then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
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
    var indexResponse = await fresh("content/index.json");
    if (!indexResponse.ok) return;
    var index = await indexResponse.json();
    await cache.put("content/index.json", new Response(JSON.stringify(index), {
      headers: { "Content-Type": "application/json" }
    }));
    var extra = [
      "content/curriculum.json",
      "content/vocab/n5.json",
      "content/vocab/n4.json",
      "content/vocab/n3.json"
    ];
    await Promise.all(extra.map(async function (url) {
      var extraResponse = await fresh(url);
      if (extraResponse.ok) await cache.put(url, extraResponse);
    }));
    var lessons = Array.isArray(index.lessons) ? index.lessons : [];
    await Promise.all(lessons.map(async function (lesson) {
      if (!lesson || !/^lessons\/[A-Za-z0-9._-]+\.json$/.test(lesson.file || "")) return;
      var lessonUrl = "content/" + lesson.file;
      var response = await fresh(lessonUrl);
      if (response.ok) await cache.put(lessonUrl, response);
    }));
  } catch (err) {
    /* Shell is already cached. New lessons are stored when the app fetches them. */
  }
  try {
    var page = await cache.match("index.html");
    if (page) {
      await cache.put("./", page.clone());
      await cache.put(".", page.clone());
    }
  } catch (err) {
    /* Some servers do not allow caching the directory URL. index.html is enough. */
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
    return new Response("離線，而且未有快取。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
