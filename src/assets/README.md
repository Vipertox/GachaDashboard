# Bilder

Die App braucht keine eigenen Bilddateien. Fehlt hier eine Datei, nimmt sie das Bild aus einer API, und erst wenn es dort keines gibt, ein Ersatzsymbol. Eigene WebP-Dateien in diesem Ordner haben immer Vorrang. Sie sind nicht eingecheckt.

| Schlüssel | Datei | Ersatz aus der API |
| --- | --- | --- |
| Spiel-Icon | `games/<spiel>.webp` (`genshin`, `starrail`, `zzz`, `wuwa`) | `logo` der HoYoLAB-Spielkarte (nicht für `wuwa`) |
| Artwork | `artwork/<spiel>.webp` | `background_image` der HoYoLAB-Spielkarte (nicht für `wuwa`) |
| Ressourcen und Aufgaben | `<spiel>/<name>.webp`, siehe Liste unten | HoYoWiki-Icon aus `wikiIcons.ts` |

Von den Adaptern verwendete Schlüssel (fett: mit HoYoWiki-Icon):

| Spiel | Dateien |
| --- | --- |
| Genshin Impact | **`genshin/resin`**, **`genshin/realm`**, `genshin/commission` |
| Honkai: Star Rail | **`starrail/power`**, **`starrail/reserve`**, **`starrail/training`**, **`starrail/rogue`**, **`starrail/divergent`** |
| Zenless Zone Zero | **`zzz/battery`**, `zzz/engagement`, `zzz/survey` |
| Wuthering Waves | `wuwa/waveplate`, `wuwa/crystal`, `wuwa/activity`, `wuwa/podcast`, `wuwa/album`, `wuwa/vehicle` |

Die HoYoLAB-Spielkarten lädt `useGameArt` einmal am Tag pro Profil, dafür braucht das Profil HoYoLAB-Tokens. Die Wiki-Icons stehen als feste URLs mit Eintrags-ID in `wikiIcons.ts`. Ändert sich eine URL, liefert `sg-wiki-api-static.hoyolab.com/hoyowiki/<wiki>/wapi/entry_page?entry_page_id=<id>` im Feld `icon_url` die neue.

Das Artwork erscheint abgedunkelt als Band im Kartenkopf und als Hintergrund des Detailkopfs.

Für den Figuren-Tab sind keine Dateien nötig. Bilder von Figuren, Waffen und Ausrüstung kommen als URL aus der API und liegen nur im Bild-Cache des Webviews. Elemente erscheinen als farbige Plaketten mit Anfangsbuchstaben, die Farben stehen in `GAME_TERMS` in `src/model/games.ts`.
