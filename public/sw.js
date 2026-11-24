// Service worker mínimo: permite instalar GYM BROS como app.
// No guarda nada en caché, así siempre ves la versión más nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
