# Sicherheitsrichtlinie

## Unterstützte Versionen

Sicherheitsupdates gibt es nur für die jeweils neueste veröffentlichte Version. Die Desktop-App aktualisiert sich über den eingebauten Updater selbst.

## Sicherheitslücke melden

Bitte **kein öffentliches Issue** anlegen. Meldungen bitte vertraulich über
[„Report a vulnerability“](https://github.com/Vipertox/GachaDashboard/security/advisories/new) einreichen.

Hilfreich sind:

- betroffene Version und Plattform (Windows, Android, Browser)
- Schritte zum Nachstellen
- mögliche Auswirkungen

Ich bestätige den Eingang in der Regel innerhalb von 7 Tagen und melde mich mit einer Einschätzung, sobald das Problem geprüft ist.

## Besonders relevant

- Umgang mit Zugangsdaten (HoYoLAB-Cookies, Kuro-`oauthCode`) in App und lokalem Proxy. Bekannte Grenze: Der Browser-Modus schützt nicht gegen andere Benutzer desselben Rechners (siehe README, „Lokaler Proxy“); Meldungen dazu bitte nur, wenn sie darüber hinausgehen
- Die Liste der erlaubten Hosts in `proxy/server.ts` und `src-tauri/capabilities/default.json`. Das Wuthering Waves Wiki wird ohne Zugangsdaten abgefragt
- Der Auto-Updater und die Signatur der Releases
- Abhängigkeiten mit bekannten Schwachstellen

Bitte niemals echte Cookies oder Tokens in Issues, Pull Requests oder Logs posten.
