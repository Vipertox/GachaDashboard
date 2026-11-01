# GachaDashboard

Cross-Platform Gacha Dashboard: zeigt auf einen Blick, wie voll die regenerierenden Ressourcen in Genshin Impact, Honkai: Star Rail, Zenless Zone Zero und Wuthering Waves sind und wann sie überlaufen.

Eine Codebasis für Android, Windows und den lokalen Browser.

## Funktionen

- **Dashboard:** Eine Karte pro Spiel mit Hauptressource, Zeit bis voll und wichtigster Tagesaufgabe
- **Detailseite, Tab Übersicht:** Alle Live-Werte des Spiels, gruppiert nach Täglich, Wöchentlich, Laufend und Weitere
- **Detailseite, Tab Figuren:** Raster aller Figuren mit Element, Duplikaten, Stufe und Waffe, filter- und sortierbar. Ein Tipp öffnet Waffe, Ausrüstung mit Haupt- und Nebenwerten, Sets, Talente und Werte. Hinweise zeigen Lücken in der Ausrüstung
- **Detailseite, Tab Herausforderungen:** Wiederkehrende Endgame-Modi wie Spiral Abyss, Pure Fiction oder Shiyu Defense mit Stand und Restlaufzeit, umschaltbar auf die vorherige Periode. Eine Kurzfassung steht in der Übersicht unter Wöchentlich
- **Profile:** Mehrere HoYoLAB-Logins mit Wechsel per Tipp

| Spiel | Live-Werte | Figuren | Herausforderungen |
| --- | --- | --- | --- |
| Genshin Impact | ✓ | ✓ | Spiral Abyss, Imaginarium Theater, Stygian Onslaught |
| Honkai: Star Rail | ✓ | ✓ | Memory of Chaos, Pure Fiction, Apocalyptic Shadow, Anomaly Arbitration |
| Zenless Zone Zero | ✓ | ✓, Details beim Antippen | Shiyu Defense, Deadly Assault, Threshold Simulation |
| Wuthering Waves | ✓, dazu Sammlung (Musikalben, Fahrzeug, Schatztruhen) und Konto (Union-Stufe, Weltstufe, aktive Tage) | Nur Anzahl der Resonatoren, die Kuro-Schnittstelle liefert keine Figurendaten | –, die Kuro-Schnittstelle liefert dazu keine Daten |

## Stack

React + TypeScript, Vite, Tailwind CSS, TanStack Query, Tauri 2

## Status

Version 1 ist implementiert (Konzept: [docs/Konzept.md](docs/Konzept.md)). Der Browser-Modus ist getestet, der Tauri-Teil (Windows, Android) ist geschrieben, aber noch nicht gebaut oder auf einem Gerät geprüft.

## Starten

Voraussetzung: Node 22.

```bash
npm install
npm run dev      # Proxy + Vite, http://127.0.0.1:5173
```

Ohne Dev-Server (gebautes Frontend, vom Proxy ausgeliefert):

```bash
npm start        # http://127.0.0.1:8787
```

Weitere Befehle: `npm test`, `npm run typecheck`, `npm run build`.

Für die Tauri-App werden zusätzlich Rust und die [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/) benötigt: `npm run tauri dev` bzw. `npm run tauri build`. Die Builds für Windows und Android laufen auch über GitHub Actions (`.github/workflows/build.yml`).

## Einrichtung

1. **Konten** > **Profil anlegen**
2. HoYoLAB-Cookies `ltuid_v2` und `ltoken_v2` nach der Anmeldung auf hoyolab.com eintragen (in der App alternativ „Mit HoYoLAB anmelden“) und **Prüfen**
3. Optional für Wuthering Waves den Kuro-`oauthCode` eintragen (unter Windows „Aus Launcher übernehmen“)
4. In HoYoLAB die Echtzeit-Notizen aktivieren und für die Tabs Figuren und Herausforderungen unter Datenschutz die Charakterdetails und die Kampfchronik freigeben
5. **Profil speichern**

Bilder für Spiele und Ressourcen sind nicht eingecheckt, siehe [src/assets/README.md](src/assets/README.md). Ohne sie zeigt die App Ersatzsymbole. Bilder von Figuren, Waffen und Ausrüstung kommen direkt aus der API.

## Hinweis

Rein private App ohne eigenen Server und ohne Store-Veröffentlichung. Gespeichert werden nur HoYoLAB-Tokens und der Kuro-Code (im sicheren Speicher des Betriebssystems) sowie Profil-Einstellungen, keine Spieldaten. Filter und Sortierung des Figurenrasters merkt sich der Browser bzw. Webview im `localStorage`.

## Mitwirken & Lizenz

Beiträge sind willkommen, siehe [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitsprobleme bitte wie in [SECURITY.md](SECURITY.md) beschrieben vertraulich melden.

Veröffentlicht unter der [MIT-Lizenz](LICENSE).
