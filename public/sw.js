// Minimal service worker so the app can be installed on a phone.
// It does not cache pages: job data always comes fresh from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
