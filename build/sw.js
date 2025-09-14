const CACHE='sonoria-v1';
self.addEventListener('install',e=>
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/index.html','/css/main.css','/src/main.js','/assets/icon.png'])))
);
self.addEventListener('fetch',e=>
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))
);
