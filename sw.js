// Offline helper for My Planner.
// It tries the internet first (so your edits show), and uses saved copies when there is no internet.
const CACHE = "planner-v1";
const FILES = ["./", "index.html", "style.css", "script.js", "manifest.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(function (response) {
      const copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (found) { return found || caches.match("index.html"); });
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (list) {
      if (list.length > 0) return list[0].focus();
      return self.clients.openWindow("./");
    })
  );
});
