# Code-Review GachaDashboard (Stand 0.1.9, Commit dc0c82b)

Review vom 04.11.2026 auf Branch `review/code-review`. Der Code wurde statisch gelesen; zusätzlich liefen `npm run typecheck` (fehlerfrei), `npm test` (77/77 Tests in 11 Dateien grün), `npm run build` (erfolgreich, eine Warnung, siehe N-14), `cargo test` (3/3 grün) sowie unter Windows 11 ein Start der Web-Variante (`npm run dev`, Einrichtungsseite ohne Konsolenfehler) und der Desktop-App (`npx tauri dev`, Prozess läuft; Fenster nicht inhaltlich geprüft). Android-Build und Logins mit echten Konten wurden nicht ausgeführt.

Schweregrade: **H** hoch (Datenverlust, Sicherheitslücke mit realistischem Angriffsweg), **M** mittel (falsches Verhalten oder Absturz in erreichbarem Pfad), **N** niedrig (Robustheit, Wartbarkeit, Barrierefreiheit). Ein Befund mit „Belegt“ wurde am Code nachgelesen; „Unsicher“ heißt, die Ursache ist im Code sichtbar, das Auftreten hängt aber von externem Verhalten ab, das hier nicht geprüft wurde.

Ein Befund der Stufe H wurde nicht gefunden.

## Proxy (Browser-Modus)

| ID | Stufe | Fundstelle | Befund | Vorschlag |
|---|---|---|---|---|
| M-1 | M | [proxy/login.ts:133](../proxy/login.ts) | `rmSync` läuft im `setTimeout` ohne `try/catch`. `force` unterdrückt nur `ENOENT`; hält ein Edge-Hilfsprozess das Profil unter Windows länger als die Retries, wirft der Timer eine unbehandelte Ausnahme und beendet den Proxy-Prozess. Belegt. | In `try/catch` fassen, Fehler loggen. |
| M-2 | M | [proxy/login.ts:74-87](../proxy/login.ts) | `cdpGetCookies` hat weder Timeout noch `close`/`error`-Handler. Schließt der Browser zwischen zwei Abfragen den Socket, bleibt das Promise ewig offen, `running` bleibt `true`, und jeder weitere Login meldet „läuft bereits“ bis zum Neustart. Belegt. | `close`/`error` auf `reject` legen, Timeout je Abfrage, `ws.close()` im `finally`. |
| M-3 | M | [proxy/login.ts:96-111](../proxy/login.ts) | `running = true` steht vor `mkdtempSync`/`freePort()`, aber außerhalb des `try`; wirft einer davon, bleibt die Sperre gesetzt. `spawn` hat keinen `error`-Listener; ein ungültiger `BROWSER_PATH` erzeugt ein unbehandeltes `error`-Event und beendet den Prozess. Belegt. | `try` direkt hinter `running = true`; `child.once("error", …)` mit Abbruch der Schleife. |
| M-4 | M | [proxy/server.ts:155-176](../proxy/server.ts) | `GET /` liefert die Seite mit eingesetztem Token ohne Prüfung aus, die Token-Datei wird mit Standardrechten geschrieben. Jeder lokale Prozess kann so das Token holen und über `/api/credentials/*` die HoYoLAB-/Kuro-Tokens im Klartext lesen. Websites sind durch Same-Origin-Policy und Host-Prüfung geschützt; betroffen sind Mehrbenutzer-Rechner und lokale Schadsoftware. Belegt. | Token-Datei mit `mode: 0o600`; prüfen, ob `GET /credentials` Klartext an den Browser liefern muss; Einsatzgrenze (Einzelbenutzer) in README/SECURITY dokumentieren. |
| N-1 | N | [proxy/server.ts:155-168](../proxy/server.ts) | Keine Security-Header (CSP, `frame-ancestors`, `X-Content-Type-Options`) im Browser-Modus; die CSP aus `tauri.conf.json` gilt nur in der App. Clickjacking per iframe ist möglich. | Hono-Middleware `secureHeaders()` plus CSP analog zu Tauri. |
| N-2 | N | [proxy/server.ts:69-89](../proxy/server.ts) | `/fetch` ohne Upstream-Timeout, ohne Größenlimit, Client-Abbruch wird nicht weitergereicht. | `AbortSignal.any([AbortSignal.timeout(…), c.req.raw.signal])`. |
| N-3 | N | [proxy/server.ts:133-138](../proxy/server.ts) | `PUT /settings` schreibt nicht atomar; ein abgebrochener Schreibvorgang hinterlässt kaputtes JSON, an dem `loadState` beim nächsten Start scheitert. Belegt. | In Temp-Datei schreiben, dann `renameSync`. |
| N-4 | N | [proxy/server.ts:108-114](../proxy/server.ts) | Synchrone Keyring-Aufrufe blockieren die Event-Loop; `setPassword`-Fehler landen ungefangen im Standard-500. Belegt. | Async-Varianten von `@napi-rs/keyring` nutzen `[UNGEPRUEFT: Name der Async-Methoden in @napi-rs/keyring]`, Fehler in Klartext-Meldung übersetzen. |

## Tauri / Rust / Android

| ID | Stufe | Fundstelle | Befund | Vorschlag |
|---|---|---|---|---|
| M-5 | M | [src-tauri/src/hoyolab_login.rs:31-61](../src-tauri/src/hoyolab_login.rs) | Ein zweiter Aufruf schließt das vorhandene Fenster asynchron und baut sofort eines mit demselben Label. Die erste Schleife findet danach über `get_webview_window(LABEL)` das neue Fenster und läuft mit einem toten Handle weiter. Ob `build()` mit „label already exists“ scheitert: Unsicher. | Vorhandenes Fenster fokussieren und „läuft bereits“ melden, oder `AtomicBool` als Sperre. |
| N-5 | N | [src-tauri/src/hoyolab_login.rs:81-83](../src-tauri/src/hoyolab_login.rs) | Fehler aus `cookies_for_url` kehrt per `?` zurück, ohne das Login-Fenster zu schließen. Belegt. | Fenster vor der Rückgabe schließen (Guard oder explizit). |
| N-6 | N | [src-tauri/src/hoyolab_login.rs:55](../src-tauri/src/hoyolab_login.rs) | `ends_with("hoyolab.com")` akzeptiert auch `evilhoyolab.com`; setzt nur das Lade-Flag, daher folgenarm. Belegt. | `h == "hoyolab.com" \|\| h.ends_with(".hoyolab.com")`. |
| N-7 | N | [src-tauri/src/hoyolab_login.rs:93-95](../src-tauri/src/hoyolab_login.rs) | Gelöscht werden nur Cookies von `https://www.hoyolab.com`. Ob SSO-Cookies anderer Domains den nächsten Profil-Login ins alte Konto führen: Unsicher. | Mit zwei Konten testen; ggf. alle Cookies des Login-Webviews löschen. |
| N-8 | N | [AndroidManifest.xml:8](../src-tauri/gen/android/app/src/main/AndroidManifest.xml) | `android:allowBackup` ist nicht gesetzt; Webview-Cookies und Einstellungen können per Backup das Gerät verlassen. Belegt. | `android:allowBackup="false"` bzw. `dataExtractionRules`. |
| N-9 | N | [file_paths.xml:3](../src-tauri/gen/android/app/src/main/res/xml/file_paths.xml) | FileProvider deckt den ganzen externen Speicher ab (Tauri-Vorlage, Provider nicht exportiert). | Pfad eingrenzen oder Provider entfernen, falls ungenutzt. |
| N-10 | N | `src-tauri/Cargo.toml`, `package.json` | `tauri-plugin-secure-keystore` 0.0.2 hält alle Tokens; sehr junges Drittanbieter-Paket mit `^`-Range. | Exakt pinnen, Quelltext einmal sichten. |

## CI / Release

| ID | Stufe | Fundstelle | Befund | Vorschlag |
|---|---|---|---|---|
| N-11 | N | [.github/workflows/release.yml:52-101](../.github/workflows/release.yml) | Release-Jobs mit Signier-Secrets stellen npm- und Rust-Caches wieder her (Cache-Poisoning nur über kompromittierten `main`-Lauf). Belegt. | Caches im Release-Workflow abschalten. |
| N-12 | N | [.github/workflows/release.yml:68](../.github/workflows/release.yml) | `releaseDraft: false`: Release samt `latest.json` ist öffentlich, bevor die APK hochgeladen ist. Belegt. | Als Draft anlegen, im letzten Job veröffentlichen. |

## API-Schicht

| ID | Stufe | Fundstelle | Befund | Vorschlag |
|---|---|---|---|---|
| M-6 | M | [src/api/characters/util.ts:4](../src/api/characters/util.ts) | `str = z.coerce.string()` macht aus `undefined`/`null` die Texte `"undefined"`/`"null"` (gegen zod 4.6 geprüft). Fehlende Pflichtfelder wie `id` lösen keinen Schemafehler aus; bei umbenanntem Feld kollidieren alle Figuren unter der ID `"undefined"`. | `z.union([z.string(), z.number()]).transform(String)`. |
| M-7 | M | [src/api/adapters/util.ts:7-8](../src/api/adapters/util.ts) | `num`/`optNum` machen aus `null` und `""` still `0` (geprüft). `current_resin: null` zeigt 0/200 statt „Schnittstelle geändert“. | Union aus Zahl und Zahl-String mit Regex, `optNum` nullable mit Abbildung auf `undefined`. |
| M-8 | M | [src/api/events/zzz.ts:118-120](../src/api/events/zzz.ts) | Kommentar sagt, die Kanäle dürfen fehlen; `.catch` deckt aber nur den Abruf ab, `parseZzzBanners` wirft bei Schemaänderung und lässt den ganzen Kalender ausfallen. Gleichzeitig werden `auth`/`rate_limit` still verschluckt. Belegt. | Parsen in den Fallback aufnehmen, Fehler als Hinweis an die UI geben. |
| M-9 | M | [src/api/challenges/util.ts:59-61](../src/api/challenges/util.ts) | `pickPeriod` wählt nur per Index (0 = aktuell). Liefert die API die Liste anders sortiert, zeigt „aktuell“ die alte Periode. Annahme zur Sortierung: Unsicher. | Nach Startzeit sortieren oder über `start <= now < end` wählen; Test mit unsortierter Fixture. |
| N-13 | N | `src/api/hoyolab.ts:67-136`, `src/api/kuro.ts:23-29`, `src/api/http.ts:45` | Antworthüllen und Rollenliste per `as`-Cast statt zod; `first.region!` (hoyolab.ts:118). | Envelope-Schemas mit `parseOrThrow`. |
| – | N | diverse | Duplikate mit abweichendem Verhalten: `toRarity` (characters/zzz.ts:31 vs. events/util.ts:44), `fmt`/`fmtNum`, `mode()`; Schema-Bausteine über drei `util.ts` verstreut; URL-Parameter `region`/`uid` unkodiert; „morgen“ in `src/lib/time.ts:53` per +86 400 000 ms (falsch am Tag der Zeitumstellung); `fandom.ts:20` bildet `ratelimited` auf `unknown` ab; `ApiError` ohne `cause`. | Gemeinsames `src/api/shared/` für Schemas und Formatierung; `URLSearchParams`; `setDate(+1)`. |

## UI-Schicht

| ID | Stufe | Fundstelle | Befund | Vorschlag |
|---|---|---|---|---|
| M-10 | M | [Roster.tsx:155](../src/features/game-detail/Roster.tsx), [hooks.ts:179](../src/app/hooks.ts) | „Neu laden“ ruft nur `roster.refetch()`. Der Detail-Key enthält nur die IDs; bleiben sie gleich, werden Details (Ausrüstung, Warnungen) bis zu 30 min nicht aktualisiert. Belegt. | Zusätzlich `invalidateQueries(["characters", …])` oder `dataUpdatedAt` in den Key. |
| M-11 | M | [src/components/ui.tsx:189-204](../src/components/ui.tsx) | `BottomSheet` mit `aria-modal`, aber ohne Escape, Fokussetzung, Fokusfalle, Fokus-Rückgabe und `inert`-Hintergrund. Belegt. | Natives `<dialog>` mit `showModal()`. |
| M-12 | M | [src/app/App.tsx:55-117](../src/app/App.tsx) | Profilmenü mit `role="menu"`, aber ohne Pfeiltasten und Fokussteuerung; Backdrop-Button vor den Einträgen in der Tab-Reihenfolge. | Menü-Rollen entfernen (Disclosure) oder Pattern vollständig umsetzen. |
| N-15 | N | [src/app/state.tsx:34-53](../src/app/state.tsx) | `latest.current` wird nur beim Rendern gesetzt; zwei Mutationen im selben Handler lesen denselben alten Stand, die zweite überschreibt die erste. Speicherfehler landen in `loadError` und werden nie zurückgesetzt. Belegt. | `latest.current` in `commit` sofort setzen; eigener `saveError`. |
| N-16 | N | [timelineView.ts:180-186](../src/features/timeline/timelineView.ts), `rosterView.ts:21-28` | Gespeicherte Anzeige-Einstellungen werden ungeprüft übernommen; `{"hiddenKinds":null}` lässt die Zeitleiste abstürzen. Belegt. | `Array.isArray`-Prüfung mit Rückfall auf Standard. |
| N-17 | N | `src/main.tsx`, `src/app/App.tsx` | Keine Error Boundary; jeder Renderfehler ergibt einen weißen Bildschirm. Belegt (keine Fundstelle für `ErrorBoundary`). | Boundary um `<Routes>`. |
| N-18 | N | [Challenges.tsx:146](../src/features/game-detail/Challenges.tsx) | `qc.isFetching()` abonniert nichts; stimmt nur, weil der Eltern-Baum per `useNow` sekündlich rendert. Belegt. | `useIsFetching({ queryKey })`. |
| – | N | diverse | Kein `onTouchCancel` beim Pull-to-Refresh; Block-Elemente in `<button>` (Challenges.tsx:193, Events.tsx:49); unvollständiges Tab-Pattern (GameDetail.tsx:245); `aria-label` verdeckt sichtbaren Namen (CharacterView.tsx:300); `.sort()` ohne Vergleichsfunktion (Events.tsx:270); sekündliches Neuberechnen ganzer Bäume (Timeline, GameDetail). | Einzeln, siehe Fundstellen. |
| N-14 | N | Build | Haupt-Chunk 536,68 kB (Vite-Warnung > 500 kB). | Routen per `lazy()` laden. |
| N-19 | N | [vite.config.ts](../vite.config.ts) | Vite beobachtet auch `src-tauri/`; bei `npx tauri dev` unter Windows erscheinen `EBUSY`-Watcher-Fehler auf `target/debug/*.exe`/`*.pdb`, und Rust-Builds lösen unnötige Reloads aus. Beim Start beobachtet. | `server: { watch: { ignored: ["**/src-tauri/**"] } }`. |

## Testlücken

- Proxy: Pfad-Traversal im Static-Handler, `KEY_PATTERN`, fremder `localhost`-Port als Origin; `login.test.ts:14` hängt davon ab, dass Chrome/Edge installiert ist.
- API: `hoyoRequest`/`mapRetcode`, Kuro-Retry, `http.ts`, `formatCountdown`/`formatDuration`, `null`/`""` bei Coerce-Feldern, unsortierte Perioden, Fehlerpfad der ZZZ-Kanäle.
- UI: keine Komponententests; ungetestete reine Funktionen `mergeGames`, `applyPrefs`, `loadPrefs`, `loadTimelinePrefs`; kein Regressionstest für M-10.
- Rust: keine Tests für `hoyolab_login.rs`.

## Was gut gelöst ist

- Proxy bindet nur an `127.0.0.1`, prüft Host-Header (gegen DNS-Rebinding), Origin und ein Zufallstoken mit `timingSafeEqual`; `/fetch` hat eine HTTPS-Host-Allowlist mit Test gegen Suffix-Tricks und `redirect: "manual"`.
- Tokens liegen ausschließlich im OS-Schlüsselspeicher; enge Tauri-Capabilities, das Login-Fenster hat keinen IPC-Zugriff; CSP gesetzt; Updater signiert.
- CI: Actions per SHA gepinnt, `persist-credentials: false`, minimale Rechte, Dependency-Review, Release mit Environment-Freigabe.
- API: Parsen und Abrufen getrennt, `now` injiziert und testbar, einheitliche Fehlertaxonomie mit `ApiErrorKind`, `AbortSignal` durchgängig.
- UI: vollständige Query-Keys inklusive Profil, Cache-Verwurf beim Profilwechsel, gemeinsamer Sekundentakt über `useSyncExternalStore`, saubere Unterscheidung von Lade-, Fehler- und Stale-Zuständen, `prefers-reduced-motion` beachtet.

## Empfohlene Reihenfolge

1. M-1 bis M-3 (Proxy-Stabilität beim Login) – klein, lokal, gut testbar. **Behoben** auf diesem Branch, mit Tests in `proxy/login.test.ts`.
2. M-6, M-7, M-8 (Schema-Strenge) – verhindert stille Falschanzeigen bei API-Änderungen. **Behoben** auf diesem Branch, mit Tests in `adapters.test.ts` und `events.test.ts`; gegen echte API-Antworten noch nicht geprüft.
3. M-10 (Neu laden) und N-16/N-17 (Absturzschutz). **Behoben** auf diesem Branch; N-16 mit Tests, M-10 und N-17 ohne Komponententests und ohne Lauf mit echtem Konto.
4. M-4 und N-1 (Härtung Browser-Modus), M-5 (Rust-Login).
5. Barrierefreiheit M-11/M-12, danach die Aufräumpunkte.
