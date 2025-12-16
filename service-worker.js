const CACHE_NAME = "metamorfosis-v2";

const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json",

    // Íconos realmente existentes
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/maskable_icon-192.png",
    "./icons/maskable_icon-512.png"
];

// INSTALACIÓN
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// ACTIVACIÓN
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// FETCH
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) return response;

            return fetch(event.request).catch(() =>
                caches.match("./index.html")
            );
        })
    );
});