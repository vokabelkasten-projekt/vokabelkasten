/* Service Worker — sorgt dafür, dass der Vokabelkasten auch ohne Netz startet.
   Prinzip: Beim ersten Besuch legen wir alles Nötige in einen Zwischenspeicher.
   Danach wird immer zuerst dort nachgesehen ("cache first"). Die Lerndaten
   selbst liegen ohnehin im Browser und brauchen kein Netz. */

const SPEICHER = "vokabelkasten-v2";

const DATEIEN = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

/* Installation: Grundbestand einlagern. */
self.addEventListener("install", function (ereignis) {
  ereignis.waitUntil(
    caches.open(SPEICHER).then(function (speicher) { return speicher.addAll(DATEIEN); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* Aktivierung: alte Zwischenspeicher aufräumen, damit kein Altbestand hängen bleibt. */
self.addEventListener("activate", function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.filter(function (n) { return n !== SPEICHER; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Jede Anfrage: erst im Zwischenspeicher nachsehen, sonst aus dem Netz holen
   und für das nächste Mal ablegen. Schlägt beides fehl, geben wir die
   Startseite zurück — dann startet die App wenigstens. */
self.addEventListener("fetch", function (ereignis) {
  if (ereignis.request.method !== "GET") return;
  ereignis.respondWith(
    caches.match(ereignis.request).then(function (treffer) {
      if (treffer) return treffer;
      return fetch(ereignis.request).then(function (antwort) {
        if (antwort && antwort.status === 200 && antwort.type === "basic") {
          const kopie = antwort.clone();
          caches.open(SPEICHER).then(function (s) { s.put(ereignis.request, kopie); });
        }
        return antwort;
      }).catch(function () { return caches.match("./index.html"); });
    })
  );
});
