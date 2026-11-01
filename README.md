# GachaDashboard

Cross-Platform Gacha Dashboard: zeigt auf einen Blick, wie voll die regenerierenden Ressourcen in Genshin Impact, Honkai: Star Rail, Zenless Zone Zero und Wuthering Waves sind und wann sie überlaufen.

Eine Codebasis für Android, Windows und den lokalen Browser.

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
4. In HoYoLAB die Echtzeit-Notizen aktivieren
5. **Profil speichern**

Bilder für Spiele und Ressourcen sind nicht eingecheckt, siehe [src/assets/README.md](src/assets/README.md). Ohne sie zeigt die App Ersatzsymbole.

## Hinweis

Rein private App ohne eigenen Server und ohne Store-Veröffentlichung. Gespeichert werden nur HoYoLAB-Tokens (im sicheren Speicher des Betriebssystems) und Profil-Einstellungen, keine Spieldaten.

## Mitwirken & Lizenz

Beiträge sind willkommen, siehe [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitsprobleme bitte wie in [SECURITY.md](SECURITY.md) beschrieben vertraulich melden.

Veröffentlicht unter der [MIT-Lizenz](LICENSE).
