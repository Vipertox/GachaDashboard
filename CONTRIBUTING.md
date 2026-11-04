# Mitwirken

Beiträge laufen über Forks und Pull Requests gegen `main`.

1. Repository forken und einen Branch von `main` anlegen, z. B. `feature/<kurzname>`.
2. Änderung umsetzen und lokal prüfen:

   ```bash
   npm ci
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

   Bei Änderungen am Rust-Teil zusätzlich `cargo test --manifest-path src-tauri/Cargo.toml`.
3. Pull Request gegen `main` öffnen und kurz beschreiben, was und warum.

Die CI für Pull Requests aus Forks startet erst nach Freigabe durch den Maintainer.

- Neue Abhängigkeiten nur mit Begründung.
- Linter ist [oxlint](https://oxc.rs) (`.oxlintrc.json`), nicht ESLint: `typescript-eslint` unterstützt TypeScript 7 nicht. Fehler brechen die CI ab, Warnungen nicht.
- Keine echten Cookies, Tokens oder Schlüssel committen – auch nicht in Tests.
- Sicherheitslücken nicht als Issue melden, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

Mit deinem Beitrag stimmst du zu, dass er unter der [MIT-Lizenz](LICENSE) veröffentlicht wird.
