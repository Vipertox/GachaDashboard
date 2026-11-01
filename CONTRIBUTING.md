# Mitwirken

Danke für dein Interesse! Beiträge laufen ausschließlich über Forks und Pull Requests.

## Branch-Modell (Git Flow)

| Branch | Zweck | Ziel des PRs |
| --- | --- | --- |
| `main` | nur veröffentlichte, getaggte Releases | – |
| `develop` | Integrationszweig, Default-Branch | – |
| `feature/<kurzname>` | eine Änderung | `develop` |
| `release/<X.Y.Z>` | Release vorbereiten (nur Maintainer) | `main`, danach zurück nach `develop` |
| `hotfix/<X.Y.Z>` | dringender Fix aus `main` (nur Maintainer) | `main`, danach zurück nach `develop` |

Pull Requests von außen gehen immer gegen **`develop`**.

## Ablauf

1. Repository forken und einen Branch `feature/<kurzname>` von `develop` anlegen.
2. Änderung umsetzen, lokal prüfen:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

   Bei Änderungen am Rust-Teil zusätzlich `cargo test --manifest-path src-tauri/Cargo.toml`.
3. Pull Request gegen `develop` öffnen und die Vorlage ausfüllen.

Die CI für Pull Requests aus Forks startet erst nach Freigabe durch einen Maintainer. Gemergt wird per Squash.

## Regeln

- Ein PR, ein Thema. Kleine PRs werden schneller geprüft.
- Neue Abhängigkeiten nur mit Begründung im PR.
- Änderungen an `.github/`, `src-tauri/tauri.conf.json` und Build-Skripten werden besonders genau geprüft.
- Keine echten Cookies, Tokens oder Schlüssel committen – auch nicht in Tests.
- Sicherheitslücken nicht als Issue melden, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

Mit deinem Beitrag stimmst du zu, dass er unter der [MIT-Lizenz](LICENSE) veröffentlicht wird.
