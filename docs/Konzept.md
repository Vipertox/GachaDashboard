# Konzept: Gacha-Ressourcen-Dashboard (React + TypeScript + Tauri 2)

Oct 29, 2026 · @Hannah

## Ziel und Umfang

Die App zeigt auf einen Blick, wie voll die regenerierenden Ressourcen in jedem Spiel sind und wann sie überlaufen. Sie ist für das Smartphone optimiert, läuft aber auch unter Windows und lokal im Browser aus derselben Codebasis.

In Version 1 enthalten:

- Dashboard mit einer Karte pro Spiel: Stand, Maximum, Zeit bis voll
- Zusatzinfos pro Spiel: Dailies, Expeditionen bzw. Aufträge, Wochenbosse
- Manuelles Aktualisieren (Pull-to-Refresh) und automatisches Neuladen im Vordergrund
- Mehrere Profile mit eigenen HoYoLAB-Tokens und Kuro-Code und Wechsel per Tipp

Grundsätze:

- Gespeichert werden nur Anmeldedaten und Profil-Einstellungen. Alle Spieldaten werden zur Laufzeit geladen und nur im Arbeitsspeicher gehalten.
- Rein private App: kein eigener Server, kein Hosting, keine Veröffentlichung im Store. Die App spricht direkt mit den Schnittstellen der Anbieter.

Nicht in Version 1: Gacha-Historie und Pity-Zähler, Push-Benachrichtigungen, automatischer Check-in. Sie sind als spätere Ausbaustufen vorgesehen.

## Datenquellen pro Spiel

Die drei Hoyoverse-Spiele liefern alle Ressourcen live über HoYoLAB. Wuthering Waves liefert sie über die Schnittstelle, die auch die Infokarte im PC-Launcher nutzt.

| Spiel | Hauptressource (Max.) | Weitere Werte | Endpunkt | Authentifizierung |
| --- | --- | --- | --- | --- |
| Genshin Impact | Original Resin (200) | Realm Currency, Expeditionen, Daily Commissions, Wochenboss-Rabatte, Transformer | `bbs-api-os.hoyolab.com/game_record/genshin/api/dailyNote` | HoYoLAB-Cookie + DS-Header |
| Honkai: Star Rail | Trailblaze Power (300), Reserve (2400) | Daily Training, Echo of War, Assignments | `bbs-api-os.hoyolab.com/game_record/hkrpg/api/note` | HoYoLAB-Cookie + DS-Header |
| Zenless Zone Zero | Battery Charge (240) | Engagement, Scratch Card, Video Store | `sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/note` | HoYoLAB-Cookie + DS-Header |
| Wuthering Waves | Waveplates (240), Waveplate Crystal (480) | Tagesaktivität, Wochenboss, Pioneer Podcast | `pc-launcher-sdk-api.kurogame.net/game/queryRole` | Kuro-`oauthCode` im Body |

Vorgeschaltet ist ein Aufruf von `api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie`. Er liefert für das angemeldete HoYoLAB-Konto alle verknüpften Spielkonten mit UID und Server. Die App zeigt danach automatisch nur die Spiele an, die der Nutzer tatsächlich spielt.

Alle Endpunkte sind inoffiziell. Maximalwerte und Endpunkte stammen aus dem Stand der Community-Tools (Referenz: genshin.py, Starward) und müssen vor der Umsetzung geprüft werden.

**Wuthering Waves:** Der PC-Launcher (ab Version 3.0) zeigt eine Infokarte mit Live-Werten des Kontos. Seine Weboberfläche ruft dafür zwei Endpunkte auf, die die App genauso nutzt:

| Schritt | Aufruf | Body | Ergebnis |
| --- | --- | --- | --- |
| 1 | `POST pc-launcher-sdk-api.kurogame.net/game/queryPlayerInfo?_t=<unix>` | `{ oauthCode }` | `data` mit dem Server als Schlüssel, z. B. `"Europe"`, darin die Spieler-ID |
| 2 | `POST pc-launcher-sdk-api.kurogame.net/game/queryRole?_t=<unix>` | `{ oauthCode, playerId, region }` | `data.<region>` ist ein JSON-String mit `Base`, `BattlePass` und weiteren Blöcken |

Mögliche Server sind `America`, `Asia`, `Europe`, `HMT` und `SEA`. Schritt 1 läuft nur beim Anlegen des Profils, danach stehen Spieler-ID und Server im Profil. Der Wert von `data.<region>` muss ein zweites Mal geparst werden.

Belegt ist der Ablauf durch die Logs des Launchers 3.0.1.0 und zwei Community-Quellen ([Feldbeschreibung](https://blog.3irun.moe/2025/11/10/wuwa_api_document/), [Haiyu #69](https://github.com/HaiyuGame/Haiyu/issues/69)). Die Schnittstelle ist inoffiziell und kann sich mit jedem Launcher-Update ändern.

## Architektur

Oberfläche und API-Logik sind für alle Plattformen identisch. Nur die HTTP-Schicht entscheidet, ob ein Aufruf über Tauri oder über den lokalen Proxy läuft.

&#91;embedded content: Architektur · 4 Schichten, 2 Betriebsarten\]

In der App nutzt die API-Schicht das HTTP-Plugin von Tauri, im Browser den lokalen Proxy. Die Tauri-Plugins sind `plugin-http` für die Aufrufe und tauri-plugin-secure-keystore für die Tokens. Ein allgemeiner Dateizugriff ist für Version 1 nicht nötig. Nur unter Windows liest ein eigener Rust-Befehl den Kuro-Code aus der Cache-Datei des Launchers, siehe "Anmeldung und Sicherheit".

## Datenmodell

Jedes Spiel wird über einen Adapter auf denselben Typ abgebildet. Die Oberfläche kennt nur diesen Typ und muss für ein neues Spiel nicht angepasst werden.

```typescript
type GameId = "genshin" | "starrail" | "zzz" | "wuwa";

interface Resource {
  label: string;          // "Original Resin"
  current: number;
  max: number;
  fullAt?: Date;          // aus der Restzeit berechnet
}

interface Task {
  label: string;          // "Daily Commissions"
  done: number;
  total: number;
}

interface GameStatus {
  game: GameId;
  uid: string;
  nickname: string;
  primary: Resource;      // die große Anzeige auf der Karte
  secondary: Resource[];  // Reserve, Realm Currency usw.
  tasks: Task[];
  fetchedAt: Date;
}

interface GameAdapter {
  game: GameId;
  fetchStatus(account: Account): Promise<GameStatus>;
}
```

Die Schnittstellen liefern die Restzeit bis voll in Sekunden. Der Adapter rechnet sie beim Laden in einen festen Zeitpunkt `fullAt` um. Daraus berechnet die Oberfläche den aktuellen Stand lokal weiter, ohne erneut anzufragen (z. B. +1 Resin alle 8 Minuten).

## UI-Konzept für das Smartphone

Das Dashboard ist ein einspaltiger Kartenstapel im Hochformat. Alle wichtigen Aktionen liegen im unteren Bildschirmdrittel und sind mit dem Daumen erreichbar.

&#91;embedded content: Dashboard-Skizze · Smartphone, Hochformat\]

| Screen | Inhalt |
| --- | --- |
| Dashboard | Eine Karte pro Spielkonto: Hauptressource mit Balken, Zeit bis voll, wichtigste Daily-Aufgabe |
| Spieldetail | Alle Live-Werte des Spiels in den Abschnitten Täglich, Wöchentlich, Laufend und Weitere, siehe "Detailseite pro Spiel" |
| Konten | Profile anlegen, bearbeiten und löschen; pro Profil Token-Eingabe, Spiele ein- und ausblenden |
| Einstellungen | Aktualisierungsintervall, helles oder dunkles Design, Sprache |

Gestaltungsregeln:

- Mobile-first mit Tailwind: Basis-Layout für 360 px Breite, ab `md` zwei Spalten für Windows und Browser
- Tippflächen mindestens 44 × 44 px
- Abstände zu Notch und Gestenleiste über `env(safe-area-inset-*)`
- Helles und dunkles Design nach Systemeinstellung
- Jedes Spiel erhält eine eigene Akzentfarbe am Kartenrand, damit die Karten auf einen Blick unterscheidbar sind

## Detailseite pro Spiel

Ein Tipp auf eine Karte öffnet die Detailseite des Spiels. Sie zeigt alle Live-Werte, die der Notizen-Endpunkt liefert, gruppiert nach Täglich, Wöchentlich und Laufend. Es ist kein zusätzlicher Aufruf nötig: Dashboard und Detailseite nutzen dieselbe Antwort, die Detailseite lädt beim Öffnen nur neu.

Aufbau von oben nach unten:

1. **Kopf:** Hauptressource groß mit Balken, Zeit bis voll als Uhrzeit und Countdown
2. **Täglich:** Aufgaben mit Fortschritt und Haken, sobald erledigt
3. **Wöchentlich:** Rabatte und Wochenpunkte mit verbleibender Anzahl
4. **Laufend:** Expeditionen bzw. Aufträge mit eigenem Countdown, nach Restzeit sortiert, fertige oben mit "Fertig"
5. **Weitere Ressourcen:** Nebenwährungen und Abklingzeiten

Alle Restzeiten werden beim Laden in feste Zeitpunkte umgerechnet und lokal im Sekundentakt heruntergezählt, wie auf dem Dashboard. Ein Abschnitt ohne Daten wird ausgeblendet, z. B. wenn ein Spielmodus noch nicht freigeschaltet ist.

**Genshin Impact** ([Feldreferenz](https://seria.is-a.dev/genshin.py/reference/models/genshin/chronicle/notes/))

| Bereich | Anzeige | API-Feld | Darstellung |
| --- | --- | --- | --- |
| Kopf | Original Resin | `current_resin`, `max_resin`, `resin_recovery_time` | Balken, "voll um" und Countdown |
| Täglich | Daily Commissions | `finished_task_num`, `total_task_num` | 3/4, Haken bei 4/4 |
| Täglich | Commission-Belohnung abgeholt | `is_extra_task_reward_received` | Ja/Nein |
| Täglich | Gespeicherte Begegnungspunkte | `daily_task.stored_attendance` | Zahl |
| Wöchentlich | Wochenboss-Rabatte | `remain_resin_discount_num`, `resin_discount_num_limit` | "2 von 3 übrig" |
| Laufend | Expeditionen | `expeditions[]` mit `remained_time`, `avatar_side_icon` | Liste mit Figurenbild und Countdown |
| Weitere | Realm Currency | `current_home_coin`, `max_home_coin`, `home_coin_recovery_time` | Balken, "voll in" |
| Weitere | Parametrischer Transformator | `transformer.recovery_time` | "Bereit" oder "bereit in 3 T 4 h" |

**Honkai: Star Rail** ([Feldreferenz](https://seria.is-a.dev/genshin.py/reference/models/starrail/chronicle/notes/))

| Bereich | Anzeige | API-Feld | Darstellung |
| --- | --- | --- | --- |
| Kopf | Trailblaze Power | `current_stamina`, `max_stamina`, `stamina_recover_time` | Balken, "voll um" und Countdown |
| Kopf | Reserved Trailblaze Power | `current_reserve_stamina`, `is_reserve_stamina_full` | Zahl, Hinweis bei voll |
| Täglich | Daily Training | `current_train_score`, `max_train_score` | 400/500, Haken bei voll |
| Wöchentlich | Echo of War | `remaining_weekly_discounts`, `max_weekly_discounts` | "1 von 3 übrig" |
| Wöchentlich | Simulated Universe | `current_rogue_score`, `max_rogue_score` | Balken |
| Wöchentlich | Divergent Universe, Bonuspunkte | `current_bonus_synchronicity_points`, `max_bonus_synchronicity_points` | Balken, nur wenn `have_bonus_synchronicity_points` |
| Laufend | Assignments | `expeditions[]` mit `name`, `remaining_time`, `avatars` | Liste mit Countdown, Kopf "4/4 vergeben" aus `accepted_expedition_num`, `total_expedition_num` |

**Zenless Zone Zero** ([Feldreferenz](https://thesadru.github.io/genshin.py/pdoc/genshin/models/zzz/chronicle/notes.html))

| Bereich | Anzeige | API-Feld | Darstellung |
| --- | --- | --- | --- |
| Kopf | Battery Charge | `energy.progress`, `energy.restore` | Balken, "voll um" und Countdown |
| Täglich | Engagement | `vitality.current`, `vitality.max` | 300/400, Haken bei voll |
| Täglich | Scratch Card | `card_sign` | Erledigt/Offen |
| Täglich | Video Store | `vhs_sale.sale_state` | Status, z. B. "Umsatz abholbar" |
| Wöchentlich | Bounty Commission | `bounty_commission` | "2 von 4" |
| Wöchentlich | Survey Points | `survey_points` | Balken |

**Wuthering Waves** ([Feldreferenz](https://blog.3irun.moe/2025/11/10/wuwa_api_document/))

| Bereich | Anzeige | API-Feld | Darstellung |
| --- | --- | --- | --- |
| Kopf | Waveplates | `Base.Energy`, `Base.MaxEnergy`, `Base.EnergyRecoverTime` | Balken, "voll um" und Countdown |
| Kopf | Waveplate Crystal | `Base.StoreEnergy`, `Base.MaxStoreEnergy` | Zahl, Hinweis bei voll |
| Täglich | Tagesaktivität | `Base.Liveness`, `Base.LivenessMaxCount` | 80/100, Haken bei voll, nur wenn `Base.LivenessUnlock` |
| Wöchentlich | Wochenboss-Belohnungen | `Base.WeeklyInstCount` | "2 übrig" |
| Wöchentlich | Pioneer Podcast | `BattlePass.WeekExp`, `BattlePass.WeekMaxExp`, `BattlePass.Level` | Balken mit Stufe, nur wenn `BattlePass.IsOpen` |

Anders als bei HoYoLAB liefert `EnergyRecoverTime` keine Restzeit, sondern direkt den Zeitpunkt in Unix-Millisekunden. Der Wert ist 0, wenn die Waveplates schon voll sind. Ein Waveplate lädt alle 6 Minuten, ein Crystal alle 12 Minuten. Laufende Aufträge gibt es in Wuthering Waves nicht, der Abschnitt Laufend entfällt.

Die API-Feldnamen der Hoyoverse-Spiele stammen aus den Rohdaten, die die Community-Bibliothek genshin.py auswertet. Die Feldnamen für Wuthering Waves stammen aus einer echten Antwort im Launcher-Log. Ihre Bedeutung beruht teils auf Annahmen der Community und ist beim Durchstich zu prüfen. Seit Kurzem gibt es in ZZZ eine Backup Battery Charge, ob die API sie liefert, ist beim Durchstich zu prüfen.

Für die Detailseite wird `GameStatus` um Abschnitte erweitert. Die Adapter füllen sie, die Oberfläche rendert sie generisch:

```typescript
interface Countdown {
  label: string;          // "Expedition", Assignment-Name
  readyAt: Date;          // aus der Restzeit berechnet
  iconUrl?: string;       // Figurenbild aus der API
}

interface Flag {
  label: string;          // "Scratch Card"
  done: boolean;
  text?: string;          // z. B. Video-Store-Status
}

interface DetailSection {
  kind: "daily" | "weekly" | "running" | "other";
  resources: Resource[];
  tasks: Task[];
  flags: Flag[];
  timers: Countdown[];
}

interface GameStatus {
  // ... bisherige Felder
  sections: DetailSection[];
}
```

&#91;embedded content: Detailseite-Skizze · Genshin Impact, Smartphone\]

Star Rail, ZZZ und Wuthering Waves folgen demselben Aufbau mit ihren eigenen Feldern aus den Tabellen oben.

## Visuelle Gestaltung

Jede Karte und jeder Wert bekommt ein passendes Bild, damit Spiele und Ressourcen ohne Lesen erkennbar sind. Dazu kommen spielspezifische Farben, Artwork-Hintergründe und dezente Animationen.

**Bilder pro Element:**

| Element | Bild | Quelle | Laden |
| --- | --- | --- | --- |
| Dashboard-Karte, Kopf | Spiel-Icon | Lokal im App-Bundle, `assets/games/<spiel>.webp` | Statisch |
| Hauptressource | Resin, Trailblaze Power, Battery Charge, Waveplates | Lokal, `assets/resources/<spiel>/<ressource>.webp` | Statisch |
| Weitere Ressourcen | z. B. Reserved Trailblaze Power, Realm Currency, Engagement, Transformator, Waveplate Crystal | Lokal, gleiche Ablage | Statisch |
| Kartenhintergrund | Abgedunkeltes Spiel-Artwork | Lokal, `assets/artwork/<spiel>.webp` | Statisch |
| Expeditionen und Assignments | Figurenbilder | URL aus der API (`character_icon`, `avatars`) | Zur Laufzeit |

Die statischen Bilder sind Teil der App, keine gespeicherten Nutzerdaten. Der Grundsatz "nur Anmeldedaten speichern" bleibt damit erhalten. Figurenbilder kommen direkt aus der API-Antwort und liegen nur im Bild-Cache des Webviews.

Die App ist ausschließlich für den privaten Gebrauch gedacht und verwendet die Original-Bilder der Spiele. Eine Veröffentlichung, z. B. im Play Store, ist nicht vorgesehen.

**Weitere optische Verbesserungen:**

- **Akzentfarbe pro Spiel:** Kartenrand, Fortschrittsbalken und Kopf der Detailseite nutzen die Farbe des Spiels. Statusfarben überlagern sie: Warnfarbe ab 90 %, Rot mit pulsierendem Punkt, wenn die Ressource voll ist und überläuft.
- **Artwork-Kopf:** Jede Karte hat oben ein schmales, abgedunkeltes Artwork-Band mit Spiel-Icon und Kontoname. Auf der Detailseite wird daraus ein größerer Kopfbereich.
- **Fortschrittsring auf der Detailseite:** Die Hauptressource erscheint als Ring um ihr Ressourcen-Icon, der Wert steht in großer Schrift daneben.
- **Zusammenfassung oben auf dem Dashboard:** Eine Zeile wie "Als Nächstes voll: Star Rail in 1 h 24 min" zeigt die dringendste Ressource.
- **Aufgaben als Chips:** Tägliche Aufgaben erscheinen als kleine Chips mit Icon, die sich beim Erledigen grün füllen.
- **Figurenbilder bei Expeditionen:** Rund ausgeschnitten, mit Countdown darunter. Fertige Expeditionen bekommen einen Haken.
- **Zahlen und Bewegung:** Zahlen in Tabellenziffern (`font-variant-numeric: tabular-nums`), damit Countdowns nicht springen. Balken füllen sich beim Laden animiert, Zahlen zählen kurz hoch. Beim Laden erscheinen Skelett-Karten statt eines Spinners. Animationen entfallen, wenn das System "Bewegung reduzieren" meldet.
- **Haptik:** Kurzes Vibrationsfeedback bei Pull-to-Refresh und beim Antippen einer Karte auf Android.
- **Dunkles Design zuerst:** Artwork und Icons wirken auf dunklem Grund am besten. Helles Design bleibt über die Systemeinstellung verfügbar.

Für die Bilder bekommt das Datenmodell einen Bildschlüssel pro Ressource und Metadaten pro Spiel:

```typescript
interface Resource {
  // ... bisherige Felder
  iconKey: string;        // "genshin/resin"
}

interface GameMeta {
  game: GameId;
  name: string;
  iconKey: string;        // "games/genshin"
  artworkKey: string;     // "artwork/genshin"
  accentColor: string;    // Tailwind-Token, z. B. "genshin-500"
}
```

Eine zentrale Datei `assets/registry.ts` ordnet jedem Schlüssel die Bilddatei zu. Fehlt ein Bild, z. B. für eine neue Ressource nach einem Spiel-Update, zeigt die Oberfläche ein neutrales Ersatzsymbol.

&#91;embedded content: Gestaltete Dashboard-Karten · Bild-Platzhalter\]

Die Skizze zeigt Platzhalter an den Stellen, an denen die App die Spiel- und Ressourcenbilder einsetzt. Skizzen und Mock-Up zeigen Wuthering Waves noch als "Coming Soon"-Karte. Künftig bekommt das Spiel eine normale Karte wie die anderen Spiele.

### Mock-Up

Das Mock-Up setzt die visuelle Gestaltung im dunklen Design für das Smartphone um. Gestrichelte, beschriftete Flächen markieren die Stellen für die Original-Bilder von Spielen, Ressourcen und Figuren. Alle Werte sind Beispielwerte. Das bearbeitbare Original liegt auf der [Design-Leinwand](https://claude.ai/artifact/FofQjKZucBwNhnKJfahQE7).

**Dashboard**

&#91;image: Mock-Up des Dashboards: Karten für Star Rail, Genshin Impact und Zenless Zone Zero, Wuthering Waves als Coming Soon\]

**Genshin Impact, Detailseite**

&#91;image: Mock-Up der Genshin-Detailseite mit Resin-Ring, täglichen und wöchentlichen Aufgaben, Expeditionen und weiteren Ressourcen\]

## Anmeldung und Sicherheit

Gespeichert werden nur die HoYoLAB-Tokens `ltuid_v2` und `ltoken_v2` und der Kuro-`oauthCode`, niemals ein Passwort. Die Tokens liegen im sicheren Speicher des Betriebssystems und nie im Klartext.

**Token per Hand eintragen:** Im Profil gibt es je ein Feld für die beiden Tokens. Der Nutzer kopiert die Cookie-Werte nach einer Anmeldung auf hoyolab.com hinein. Die App prüft sie sofort mit dem Konten-Endpunkt und zeigt die gefundenen Spielkonten an. Ein Login mit Benutzername und Passwort über die API scheidet aus, weil HoYoLAB dabei ein Captcha verlangt.

**Token per Login auslesen:** Eine Schaltfläche neben den Token-Feldern öffnet die HoYoLAB-Anmeldung in einem Webview. Nach dem Login liest die App die Tokens aus und füllt die Felder automatisch. Im Browser-Modus ist die Schaltfläche ausgeblendet.

Grundlage ist die Cookie-API von Tauri, die seit Version 2.4 auch HTTP-only-Cookies liefert ([Release Notes](https://v2.tauri.app/release/tauri/v2.4.0)). Auf Android funktioniert nur `cookies_for_url()`, `cookies()` liefert dort immer eine leere Liste ([Commit](https://github.com/tauri-apps/tauri/commit/cedb24d494b84111daa3206c05196c8b89f1e994)). Ein Aufruf für eine URL ohne Cookies bringt die App zum Absturz, der Fehler ist in wry 0.57.0 noch offen ([wry #1837](https://github.com/tauri-apps/wry/issues/1837)). `delete_cookie()` gibt es seit Tauri 2.8 ([PR #13661](https://github.com/tauri-apps/tauri/pull/13661)).

Ablauf des Webview-Logins:

1. Ein `WebviewWindow` öffnet die HoYoLAB-Anmeldeseite.
2. Nach jedem Seitenwechsel auf eine hoyolab.com-Adresse ruft der Rust-Teil `cookies_for_url("https://www.hoyolab.com")` auf. Die Domain hat nach dem Laden immer Cookies, dadurch wird der Absturz-Bug vermieden.
3. Sobald `ltuid_v2` und `ltoken_v2` vorhanden sind, werden sie in die Token-Felder des Profils übernommen und das Fenster geschlossen. Gespeichert wird erst mit "Profil speichern".
4. Danach entfernt `delete_cookie()` die HoYoLAB-Cookies, damit der nächste Profil-Login nicht im alten Konto landet. Ob das auf Android greift, ist beim Durchstich zu testen.

Anmeldungen über Google oder Apple können in eingebetteten Webviews blockiert sein. In dem Fall bleibt die Anmeldung per E-Mail und Passwort oder die manuelle Eingabe.

**Kuro-Code für Wuthering Waves:** Die Kuro-Schnittstelle braucht keinen Cookie, sondern den `oauthCode` des Spielkontos. Ihn legt das Login-SDK des Spiels nach der Anmeldung im Launcher ab.

- **Fundort:** `%APPDATA%\KR_G153\A1730\KRSDKUserLauncherCache.json`, ein JSON-Array mit einem Eintrag pro Konto und dem Feld `oauthCode`. Jedes Zeichen ist mit dem Schlüssel `5` per XOR verschleiert. Entschlüsselt ist der Code 36 Zeichen lang.
- **Windows (Tauri):** Die Schaltfläche "Aus Launcher übernehmen" ruft einen Rust-Befehl auf. Er liest nur diese eine Datei, entschlüsselt den Code und füllt das Feld. Die Datei bleibt unverändert, gespeichert wird erst mit "Profil speichern".
- **Android und Browser:** Es gibt keinen Launcher. Der Code wird einmal von Hand eingetragen, z. B. vom Windows-PC übernommen.
- **Gültigkeit:** In den Launcher-Logs blieb derselbe Code über drei Tage und mehrere Launcher-Neustarts gültig. Wann er abläuft, ist unbekannt. Liefert die Schnittstelle "invalid token", zeigt die Karte "Neu anmelden", wie bei HoYoLAB.

Der Code gibt Zugriff auf Kontodaten bis hin zum Geburtsdatum. Er wird deshalb genauso behandelt wie die HoYoLAB-Tokens: Er liegt nur im sicheren Speicher, erscheint nie in Logs und wird nur an `pc-launcher-sdk-api.kurogame.net` gesendet.

| Betriebsart | Ablage der Tokens |
| --- | --- |
| Windows (Tauri) | Windows-Anmeldeinformationsverwaltung, über `tauri-plugin-secure-keystore` |
| Android (Tauri) | Android Keystore, über `tauri-plugin-secure-keystore` |
| Browser (lokal) | Im OS-Schlüsselspeicher des lokalen Proxys, nie im `localStorage` des Browsers |

`tauri-plugin-secure-keystore` deckt genau Windows und Android ab und hat die schlankeste API (`setItem`, `getItem`, `deleteItem`). Das offizielle Stronghold-Plugin scheidet aus, weil es nicht mehr empfohlen wird und mit Tauri 3 entfallen soll ([Diskussion #7846](https://github.zerozr99.workers.dev/orgs/tauri-apps/discussions/7846)). Alle Alternativen sind junge Community-Plugins. Der Zugriff liegt deshalb ausschließlich im Modul `credentials/`, ein Wechsel auf [tauri-plugin-keyring](https://github.com/charlesportwoodii/tauri-plugin-keyring) betrifft dann nur diese Stelle. [tauri-plugin-keyring-store](https://docs.rs/crate/tauri-plugin-keyring-store/latest) wird wegen seiner Export-Funktionen nicht verwendet.

Der lokale Proxy im Browser-Modus lauscht nur auf `127.0.0.1`. Jede Anfrage muss ein Zufallstoken mitschicken, das der Proxy beim Start erzeugt und in die ausgelieferte Seite einsetzt. So kann keine andere Webseite im selben Browser den Proxy missbrauchen.

## Profile und Kontowechsel

Ein Profil entspricht genau einem HoYoLAB-Login mit eigenen Tokens und optional einem Kuro-Code für Wuthering Waves. Der Wechsel zwischen Profilen ist mit zwei Tipps aus dem Dashboard möglich.

**Was ein Profil enthält:**

| Bestandteil | Beispiel | Ablage |
| --- | --- | --- |
| Name und Farbe | "Hauptkonto", Blau | Profil-Einstellungen |
| HoYoLAB-Tokens | `ltuid_v2`, `ltoken_v2` | Sicherer Speicher, Schlüssel `<profilId>/ltoken_v2` |
| Kuro-Code | `oauthCode` für Wuthering Waves, optional | Sicherer Speicher, Schlüssel `<profilId>/kuro_oauth` |
| Spielkonten | UID je Spiel, automatisch aus dem Login ermittelt, für Wuthering Waves über `queryPlayerInfo` | Profil-Einstellungen |
| Anzeige | Reihenfolge der Karten, ausgeblendete Spiele | Profil-Einstellungen |

**Token-Felder im Profil:**

| Element | Verhalten |
| --- | --- |
| Feld `ltuid_v2` | Per Hand eintragen oder automatisch befüllt |
| Feld `ltoken_v2` | Wie oben, als Passwortfeld mit Schalter zum Anzeigen |
| Schaltfläche "Mit HoYoLAB anmelden" | Öffnet den Webview-Login, liest beide Tokens aus und füllt die Felder. Nur in der App sichtbar |
| Schaltfläche "Prüfen" | Ruft den Konten-Endpunkt auf und zeigt die gefundenen Spielkonten |
| Feld Kuro-Code | Passwortfeld mit Schalter zum Anzeigen, optional |
| Schaltfläche "Aus Launcher übernehmen" | Liest den Code aus dem Launcher-Cache und füllt das Feld. Nur unter Windows sichtbar |
| Schaltfläche "Prüfen" (Kuro) | Ruft `queryPlayerInfo` auf und zeigt Spieler-ID und Server |

Gespeichert wird erst mit "Profil speichern". Die App prüft die Tokens und schreibt sie mit `tauri-plugin-secure-keystore` unter `<profilId>/ltuid_v2` und `<profilId>/ltoken_v2` in den sicheren Speicher. In die Einstellungsdatei gelangen nur die Profil-Einstellungen. Beim erneuten Öffnen des Profils liest die App die Felder aus dem sicheren Speicher. Im Browser-Modus speichert der lokale Proxy die Tokens im OS-Schlüsselspeicher.

Mehrere Logins, etwa ein eigenes Konto und ein Zweitkonto, werden als getrennte Profile angelegt. Hat ein Login für ein Spiel Konten auf mehreren Servern, zeigt Version 1 nur das erste gefundene. Eine Auswahl zwischen Servern wie EU und Asia ist vorerst nicht vorgesehen. Die Profil-Einstellungen enthalten keine Spieldaten und keine Tokens. Sie liegen in einer lokalen Einstellungsdatei, in der App über `@tauri-apps/plugin-store`, im Browser-Modus beim lokalen Proxy.

```typescript
interface Profile {
  id: string;              // UUID, Schlüssel für Tokens
  name: string;
  color: string;
  games: GameAccountRef[];
}

interface GameAccountRef {
  game: GameId;
  uid: string;
  region: string;          // vom Login vorgegeben, z. B. "os_euro" oder bei Wuthering Waves "Europe"
  visible: boolean;
  order: number;
}

interface ProfileState {
  profiles: Profile[];
  activeProfileId: string;
}
```

**Abläufe:**

1. **Anlegen:** Name vergeben, Tokens per Hand eintragen oder per HoYoLAB-Login auslesen lassen, die App ruft die verknüpften Spielkonten ab und übernimmt sie automatisch ins Profil. Optional den Kuro-Code eintragen oder aus dem Launcher übernehmen, dann kommt das Wuthering-Waves-Konto dazu.
2. **Wechseln:** Tipp auf den Profilnamen in der Kopfzeile öffnet ein Bottom Sheet mit allen Profilen. Ein Tipp auf ein Profil macht es aktiv und lädt dessen Daten.
3. **Bearbeiten:** Name, Farbe, Spielauswahl und Reihenfolge ändern, Tokens erneuern.
4. **Löschen:** Entfernt die Profil-Einstellungen und die Tokens aus dem sicheren Speicher. Danach wird das nächste Profil aktiv, ohne Profil startet die Einrichtung.

**Verhalten beim Wechsel:**

- Alle TanStack-Query-Schlüssel enthalten die Profil-ID, z. B. `["status", profileId, game, uid]`. Daten verschiedener Profile mischen sich dadurch nie.
- Laufende Anfragen des alten Profils werden abgebrochen, sein Cache wird aus dem Arbeitsspeicher entfernt.
- Nur das aktive Profil wird automatisch neu geladen. Das schont die Rate-Limits von HoYoLAB.
- Das zuletzt aktive Profil wird gemerkt und beim nächsten Start geöffnet.

Profile werden nicht exportiert. Profil-Einstellungen und Tokens bleiben auf dem Gerät, auf dem sie angelegt wurden. Auf einem neuen Gerät entsteht das Profil durch einen neuen Login.

Eine spätere Ausbaustufe kann eine Ansicht "Alle Profile" ergänzen, die die Karten aller Profile untereinander gruppiert zeigt.

## Technologie-Stack und Projektstruktur

Fast der gesamte Code ist TypeScript. Rust wird nur für das Tauri-Grundgerüst, die Token-Ablage und das Auslesen des Kuro-Codes unter Windows gebraucht.

| Bereich | Wahl | Grund |
| --- | --- | --- |
| Build | Vite | Standard für Tauri, schneller Dev-Server |
| UI | React + TypeScript | Gewünscht |
| Styling | Tailwind CSS | Mobile-first-Klassen, kein eigenes CSS-System nötig |
| Datenabruf | TanStack Query | Laden, Caching im Speicher, Neuladen bei Fokus und im Intervall |
| HTTP in der App | `@tauri-apps/plugin-http` | Aufrufe ohne CORS-Einschränkung |
| HTTP im Browser | Lokaler Proxy (Node, Hono) | Leitet Aufrufe weiter und hält die Tokens |
| DS-Header | `md5` aus `js-md5` o. ä. | Signatur für HoYoLAB |
| App-Rahmen | Tauri 2 | Windows und Android aus einer Codebasis |
| Token-Ablage | tauri-plugin-secure-keystore | Windows Credential Manager und Android Keystore |

```
gacha-dashboard/
├─ src/
│  ├─ app/            # Routing, Layout, Provider
│  ├─ features/
│  │  ├─ dashboard/   # Karten, Fortschrittsbalken
│  │  ├─ game-detail/ # Detailansicht pro Spiel
│  │  └─ accounts/    # Einrichtung, Token-Eingabe
│  ├─ api/
│  │  ├─ http.ts      # fetch-Abstraktion: Tauri oder Proxy
│  │  ├─ hoyolab.ts   # DS-Header, Konten-Endpunkt
│  │  ├─ kuro.ts      # queryPlayerInfo, queryRole, doppeltes JSON-Parsen
│  │  └─ adapters/    # genshin.ts, starrail.ts, zzz.ts, wuwa.ts
│  ├─ credentials/    # Token lesen/schreiben je Betriebsart
│  └─ model/          # GameStatus, Resource, Task
├─ proxy/             # lokaler Proxy für den Browser-Modus
└─ src-tauri/         # Tauri-Konfiguration, Rust-Befehle (u. a. Kuro-Code aus dem Launcher-Cache)
```

Die Datei `api/http.ts` ist die einzige Stelle, die zwischen App und Browser unterscheidet. Alle Adapter rufen nur sie auf.

## Fehlerbehandlung und Aktualisierung

Die App fragt die Server sparsam an und rechnet dazwischen lokal weiter. Fehler eines Spiels betreffen nur dessen Karte.

**Aktualisierung:**

- Beim Start und beim Zurückkehren in die App lädt TanStack Query alle Spiele neu.
- Solange die App im Vordergrund ist, lädt sie alle 10 Minuten neu.
- Pull-to-Refresh lädt sofort neu.
- Zwischen zwei Abrufen zählt die Oberfläche den Stand anhand von `fullAt` im Sekundentakt hoch. So wirkt die Anzeige live, ohne die Server zu belasten.

**Fehlerfälle:**

| Fall | Erkennung | Verhalten |
| --- | --- | --- |
| Token abgelaufen | `retcode` -100 oder 10001, bei Kuro `code` 1001 ("invalid token") | Karte zeigt "Neu anmelden", Link zur Einrichtung |
| Kuro-Daten nicht bereit | `code` 1005 ("retrying"), falscher Server oder Daten im Abgleich | Bis zu dreimal nach kurzer Pause erneut versuchen, sonst letzten Stand behalten |
| Live-Notizen nicht freigegeben | `retcode` 10102 | Hinweis, die Echtzeit-Notizen in HoYoLAB zu aktivieren |
| Zu viele Anfragen | `retcode` 10101 | Letzten Stand behalten, später erneut versuchen |
| Netzwerkfehler | Exception | Letzten Stand grau markieren mit Zeitpunkt des Abrufs |
| Unbekannte Antwort | Schema-Prüfung schlägt fehl | Karte zeigt "Schnittstelle geändert" |

Die Retcodes entsprechen den Werten, die Community-Bibliotheken und die Community-Doku zur Kuro-Schnittstelle nennen. Sie müssen bei der Umsetzung geprüft werden. Für die Schema-Prüfung der Antworten eignet sich `zod`, damit Änderungen der inoffiziellen APIs sofort auffallen.

## Umsetzungsplan, Build und offene Punkte

Die Umsetzung beginnt im Browser mit einem Spiel und wird dann schrittweise auf alle Spiele und Plattformen erweitert.

- [x] Projekt anlegen mit `npm create tauri-app` (Vorlage React + TypeScript), Tailwind und TanStack Query ergänzen
- [x] HoYoLAB-Client mit DS-Header und Konten-Endpunkt, im Browser-Modus über den lokalen Proxy testen
- [x] Genshin-Adapter und Dashboard-Karte als erster durchgehender Durchstich
- [x] Adapter für Star Rail und ZZZ ergänzen
- [x] Kuro-Client und Wuthering-Waves-Adapter, Kuro-Code zunächst per Hand eintragen
- [ ] Rust-Befehl "Aus Launcher übernehmen" für Windows
- [ ] Einrichtungsdialog und Token-Ablage für Windows
- [ ] Windows-Build mit `npm run tauri build`
- [ ] Android-Build mit `npm run tauri android build`, Token-Ablage im Keystore
- [ ] Builds über GitHub Actions mit `tauri-action` automatisieren, damit lokal kein Android SDK nötig ist
