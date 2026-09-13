/* =========================================================================
   Service Worker — sorgt dafür, dass der Vokabelkasten auch ohne Netz startet.

   VORLAGE. Diese Datei wird nicht ausgeliefert: build_pwa.ps1 setzt unten die
   Fassungsnummer ein und schreibt das Ergebnis nach pwa\sw.js.

   Ein Service Worker ist ein kleines Programm, das der Browser neben der Seite
   laufen lässt. Er fängt jede Anfrage ab und entscheidet, ob sie aus dem Netz
   oder aus einem Zwischenspeicher beantwortet wird. Genau dadurch startet die
   App im Bus ohne Internet.

   WARUM DIESE DATEI EINMAL FALSCH WAR — ein lehrreicher Fehler:

   Die erste Fassung schaute IMMER zuerst in den Zwischenspeicher und fragte
   das Netz nur, wenn dort nichts lag ("cache first"). Dazu hieß der Speicher
   in jeder Fassung gleich, wurde also nie geräumt. Beides zusammen ergab:
   Wer die App einmal installiert hatte, blieb für immer auf dieser Version.
   Kein Update kam je an — und weil beim Entwickeln jedes Mal ein frischer
   Browser startet, fiel es dort nie auf.

   Die Lehre: Ein Zwischenspeicher, der nie veraltet, ist kein Zwischenspeicher,
   sondern ein Gefängnis. Er braucht immer einen Weg hinaus.

   SO ARBEITET ER JETZT:

   * Die Seite selbst (index.html) wird ZUERST AUS DEM NETZ geholt. Klappt das
     nicht — kein Empfang —, kommt sie aus dem Speicher. Damit ist man online
     immer aktuell und offline trotzdem startfähig.
   * Bilder und Manifest kommen weiter zuerst aus dem Speicher; sie ändern sich
     selten, und so bleibt der Start schnell.
   * Der Speichername enthält die Fassungsnummer. Eine neue Fassung legt einen
     neuen Speicher an und löscht den alten.
   ========================================================================= */

/* Wird beim Bauen durch den Zeitstempel ersetzt. */
const FASSUNG = "2026-09-14-0118";
const SPEICHER = "vokabelkasten-" + FASSUNG;

const DATEIEN = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

/* Installation: Grundbestand einlagern und sofort übernehmen, statt zu warten,
   bis alle alten Fenster geschlossen sind. */
self.addEventListener("install", function (ereignis) {
  ereignis.waitUntil(
    caches.open(SPEICHER)
      .then(function (speicher) { return speicher.addAll(DATEIEN); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* Aktivierung: alle Speicher früherer Fassungen wegräumen. */
self.addEventListener("activate", function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(
        namen.filter(function (n) { return n !== SPEICHER; })
             .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* Ist die Anfrage die Seite selbst? Das sind die Fälle, in denen eine veraltete
   Antwort wirklich schadet. */
function istSeite(anfrage) {
  if (anfrage.mode === "navigate") return true;
  const pfad = new URL(anfrage.url).pathname;
  return pfad.endsWith("/") || pfad.endsWith("/index.html");
}

/* Netz zuerst, Speicher als Rückfalllinie. */
function netzZuerst(anfrage) {
  return fetch(anfrage).then(function (antwort) {
    if (antwort && antwort.status === 200 && antwort.type === "basic") {
      const kopie = antwort.clone();
      caches.open(SPEICHER).then(function (s) { s.put(anfrage, kopie); });
    }
    return antwort;
  }).catch(function () {
    return caches.match(anfrage).then(function (treffer) {
      return treffer || caches.match("./index.html");
    });
  });
}

/* Speicher zuerst, Netz als Nachschub. */
function speicherZuerst(anfrage) {
  return caches.match(anfrage).then(function (treffer) {
    if (treffer) return treffer;
    return fetch(anfrage).then(function (antwort) {
      if (antwort && antwort.status === 200 && antwort.type === "basic") {
        const kopie = antwort.clone();
        caches.open(SPEICHER).then(function (s) { s.put(anfrage, kopie); });
      }
      return antwort;
    });
  });
}

self.addEventListener("fetch", function (ereignis) {
  if (ereignis.request.method !== "GET") return;
  ereignis.respondWith(
    istSeite(ereignis.request) ? netzZuerst(ereignis.request) : speicherZuerst(ereignis.request)
  );
});

/* Die Seite darf nachfragen, welche Fassung gerade ausgeliefert wird. */
self.addEventListener("message", function (ereignis) {
  if (ereignis.data === "fassung?" && ereignis.source) {
    ereignis.source.postMessage({ fassung: FASSUNG });
  }
});
