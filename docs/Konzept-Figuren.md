# Konzept: Figurenübersicht auf der Detailseite

Nov 1, 2026 · @Hannah

Ergänzung zu [Konzept.md](Konzept.md), Abschnitt "Detailseite pro Spiel".

## Ziel und Umfang

Die Detailseite eines Spiels bekommt neben den Live-Werten eine Übersicht über alle Figuren des Kontos. Sie zeigt auf einen Blick, welche Waffe und welche Ausrüstung jede Figur trägt, und bei Bedarf alle Details dazu.

Enthalten:

- Figurenliste pro Spielkonto als Raster mit Bild, Stufe, Duplikaten und Waffe
- Detailansicht pro Figur: Waffe, Ausrüstung mit Haupt- und Nebenwerten, Set-Boni, Talente, Duplikate, wichtigste Werte
- Filtern und Sortieren der Liste
- Hinweise auf Lücken in der Ausrüstung, z. B. ein fehlendes Teil oder ein unvollständiges Set

Die Grundsätze aus dem Hauptkonzept gelten unverändert: Figurendaten werden zur Laufzeit geladen und nur im Arbeitsspeicher gehalten. Bilder kommen als URL aus der API und liegen nur im Bild-Cache des Webviews.

Nicht enthalten: Schadensrechner, Bewertung der Artefakte mit Punktzahl, Vergleich mit Builds aus Guides, Planung von Materialien. Sie bleiben spätere Ausbaustufen.

## Begriffe pro Spiel

Die vier Spiele nennen dieselben Konzepte unterschiedlich. Die Oberfläche nutzt die Begriffe des jeweiligen Spiels, das Datenmodell ist für alle gleich.

| Konzept | Genshin Impact | Honkai: Star Rail | Zenless Zone Zero | Wuthering Waves |
| --- | --- | --- | --- | --- |
| Figur | Charakter | Charakter | Agent | Resonator |
| Duplikate | Konstellation C0–C6 | Eidolon E0–E6 | Mindscape M0–M6 | Resonanzkette S0–S6 |
| Waffe | Waffe | Lichtkegel | W-Engine | Waffe |
| Waffen-Duplikate | Veredelung R1–R5 | Überlagerung S1–S5 | Stufe R1–R5 | Syntonisierung R1–R5 |
| Ausrüstung | 5 Artefakte | 4 Relikte + 2 Planar-Ornamente | 6 Drive Discs | 5 Echos (Kosten max. 12) |
| Sets | 2er- und 4er-Boni | 2er- und 4er-Boni, Ornamente 2er | 2er- und 4er-Boni | 2er- und 5er-Boni (Sonaten) |
| Talente | 3 Talente | 4 Fähigkeiten + Spuren | 6 Fertigkeiten | 5 Fertigkeiten + Knoten |
| Begleiter | – | Memosprite (Erinnerungspfad) | Bangboo | – |

## Datenquellen pro Spiel

Für die drei Hoyoverse-Spiele gibt es eigene Endpunkte der Battle Chronicle. Sie nutzen dieselbe Authentifizierung wie die Notizen (HoYoLAB-Cookie + DS-Header). Mit dem Header `x-rpc-language: de-de` liefert HoYoLAB Namen und Werte auf Deutsch.

| Spiel | Liste | Details | Bemerkung |
| --- | --- | --- | --- |
| Genshin Impact | `POST bbs-api-os.hoyolab.com/game_record/genshin/api/character/list` mit `{ role_id, server }` | `POST …/genshin/api/character/detail` mit `{ role_id, server, character_ids: [] }` | Details für mehrere Figuren in einem Aufruf |
| Honkai: Star Rail | `GET bbs-api-os.hoyolab.com/game_record/hkrpg/api/avatar/info?server=&role_id=&need_wiki=true` | Gleiche Antwort | Ein Aufruf liefert alles |
| Zenless Zone Zero | `GET sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/avatar/basic?server=&role_id=` | `GET …/zzz/avatar/info?server=&role_id=&id_list[]=…&need_wiki=true` | Details für mehrere Figuren in einem Aufruf |
| Wuthering Waves | Keine bekannte Quelle, siehe unten | – | Launcher-API liefert nur die Anzahl |

Wie bei den Notizen sind alle Endpunkte inoffiziell. Pfade und Feldnamen stammen aus der Community-Bibliothek genshin.py und müssen beim Durchstich mit einer echten Antwort geprüft werden.

**Genshin Impact**

| Anzeige | API-Feld | Darstellung |
| --- | --- | --- |
| Figur | `list[].id`, `name`, `element`, `rarity`, `level`, `icon` | Porträt mit Elementsymbol |
| Konstellation | `actived_constellation_num` | Plakette "C2" |
| Waffe kurz | `weapon.name`, `weapon.icon`, `weapon.rarity`, `weapon.level`, `weapon.affix_level` | Kleines Symbol mit "R1" |
| Waffe Details | `weapon.main_property`, `weapon.sub_property` | Hauptwert und Nebenwert |
| Artefakte | `relics[]` mit `pos`, `name`, `icon`, `rarity`, `level`, `set.name`, `set.affixes` | Fünf Plätze in fester Reihenfolge |
| Artefakt-Werte | `relics[].main_property`, `relics[].sub_property_list[]` mit `property_type`, `value`, `times` | Hauptwert groß, Nebenwerte mit Anzahl der Erhöhungen |
| Talente | `skills[]` mit `skill_type`, `level` | Drei Stufen, z. B. 9 / 10 / 8 |
| Werte | `selected_properties`, `base_properties`, `extra_properties`, `element_properties` | Wichtigste Werte, Rest aufklappbar |
| Wertenamen | `property_map` in der Antwort | Übersetzung von `property_type` in Name und Symbol |

**Honkai: Star Rail**

| Anzeige | API-Feld | Darstellung |
| --- | --- | --- |
| Figur | `avatar_list[].id`, `name`, `element`, `base_type`, `rarity`, `level`, `icon` | Porträt mit Element und Pfad |
| Eidolon | `rank` | Plakette "E1" |
| Lichtkegel | `equip.name`, `equip.icon`, `equip.rarity`, `equip.level`, `equip.rank` | Kleines Symbol mit "S1" |
| Relikte | `relics[]` mit `pos` 1–4 | Kopf, Hände, Körper, Füße |
| Planar-Ornamente | `ornaments[]` mit `pos` 5–6 | Sphäre, Verbindungsseil |
| Ausrüstungswerte | `main_property`, `properties[]` mit `property_type`, `value`, `times` | Wie bei Genshin |
| Fähigkeiten | `skills[]` mit `point_type`, `level` | Nur die vier Hauptfähigkeiten, Spuren aufklappbar |
| Memosprite | `servant_detail` | Eigene Zeile, nur beim Erinnerungspfad |
| Werte | `properties[]` mit `base`, `add`, `final` | Wichtigste Werte, Rest aufklappbar |
| Wertenamen | `property_map` in der Antwort | Wie bei Genshin |

**Zenless Zone Zero**

| Anzeige | API-Feld | Darstellung |
| --- | --- | --- |
| Agent | `avatar_list[].id`, `name_mi18n`, `element_type`, `avatar_profession`, `rarity`, `level`, `role_square_url` bzw. `hollow_icon_path` | Porträt mit Element und Rolle |
| Mindscape | `rank` | Plakette "M0" |
| W-Engine | `weapon.name`, `weapon.icon`, `weapon.rarity`, `weapon.level`, `weapon.star`, `weapon.main_properties`, `weapon.properties` | Kleines Symbol mit "R1" |
| Drive Discs | `equip[]` mit `equipment_type` 1–6, `name`, `icon`, `rarity`, `level`, `equip_suit.name`, `equip_suit.own` | Sechs Plätze im Kreis wie im Spiel |
| Disc-Werte | `equip[].main_properties`, `equip[].properties[]` mit `property_name`, `base`, `level` | Nebenwerte mit Anzahl der Erhöhungen |
| Fertigkeiten | `skills[]` mit `skill_type`, `level` | Sechs Stufen |
| Werte | `properties[]` mit `property_name`, `base`, `add`, `final` | Wichtigste Werte, Rest aufklappbar |
| Bangboo | `zzz/buddy/info` | Optional, eigene Liste unter den Agenten |

Bei ZZZ ist das Feld für das Porträt nicht eindeutig belegt. Welches Bildfeld die API liefert, ist beim Durchstich zu prüfen.

**Wuthering Waves**

Die Launcher-Schnittstelle `queryRole` liefert nur `Base.RoleNum`, also die Anzahl der Resonatoren. Waffen, Echos und Resonanzketten enthält sie nicht ([Feldbeschreibung](https://blog.3irun.moe/2025/11/10/wuwa_api_document/)).

Die einzige bekannte Quelle für Figurendaten ist die Community-App Kuro BBS (库街区). Sie braucht eine eigene Anmeldung und ist auf die chinesischen Server ausgerichtet. Ob sie Konten auf den globalen Servern wie `Europe` liefert, ist offen.

Vorgehen:

1. In Version 1 zeigt der Figuren-Tab für Wuthering Waves nur "24 Resonatoren" aus `Base.RoleNum` und den Hinweis, dass Details nicht verfügbar sind.
2. Beim Durchstich wird geprüft, ob Kuro BBS globale Konten unterstützt und mit welchem Token. Erst dann wird ein Adapter ergänzt.
3. Eine manuelle Eingabe der Ausrüstung ist nicht vorgesehen. Sie widerspricht dem Grundsatz, keine Spieldaten zu speichern.

## Datenmodell

Ein neuer Adapter pro Spiel bildet die Antworten auf gemeinsame Typen ab. Die Oberfläche rendert sie generisch, wie bei `GameStatus`. Werte kommen als fertig formatierter Text aus dem Adapter, weil jedes Spiel Prozente und Ganzzahlen anders liefert.

```typescript
interface Stat {
  key: string;            // "crit_rate", für Symbol und Sortierung
  label: string;          // "Krit. Rate"
  value: string;          // "62,4 %"
  rolls?: number;         // Anzahl der Erhöhungen bei Nebenwerten
}

interface Weapon {
  name: string;
  iconUrl?: string;
  rarity: number;
  level: number;
  maxLevel: number;
  refinement: number;     // 1–5, Präfix aus GameTerms
  mainStat?: Stat;
  subStat?: Stat;
}

interface GearPiece {
  slot: number;           // 1-basiert, Reihenfolge wie im Spiel
  slotLabel: string;      // "Blume", "Kopf", "Disc 4"
  name: string;
  setName?: string;
  iconUrl?: string;
  rarity: number;
  level: number;
  maxLevel: number;
  mainStat: Stat;
  subStats: Stat[];
}

interface GearSet {
  name: string;
  count: number;          // angelegte Teile
  activeBonuses: number[];// z. B. [2, 4]
}

interface CharacterSummary {
  id: string;
  name: string;
  element: string;        // Schlüssel, z. B. "pyro", für Symbol und Filter
  role?: string;          // Pfad (Star Rail), Rolle (ZZZ)
  rarity: number;
  level: number;
  dupes: number;          // 0–6
  iconUrl?: string;
  weapon?: Pick<Weapon, "name" | "iconUrl" | "rarity" | "refinement">;
}

interface Character extends CharacterSummary {
  weapon?: Weapon;
  gear: GearPiece[];
  sets: GearSet[];
  skills: { label: string; level: number; boosted?: boolean }[];
  stats: Stat[];          // wichtigste Werte zuerst
  companion?: { name: string; iconUrl?: string; level?: number };
}

interface CharacterAdapter {
  game: GameId;
  fetchRoster(account: Account, signal?: AbortSignal): Promise<CharacterSummary[]>;
  fetchDetails(account: Account, ids: string[], signal?: AbortSignal): Promise<Character[]>;
}
```

Die Begriffe aus der Tabelle oben stehen in `model/games.ts` neben `GAME_META`:

```typescript
interface GameTerms {
  character: string;      // "Agent"
  dupePrefix: string;     // "M"
  weapon: string;         // "W-Engine"
  refinePrefix: string;   // "R"
  gear: string;           // "Drive Discs"
  slots: string[];        // Platznamen in Spielreihenfolge
}
```

Fehlt ein Platz in `gear`, zeigt die Oberfläche ihn als leeren Platz an. So fällt ein fehlendes Teil sofort auf.

## Laden und Aktualisieren

Figurendaten ändern sich selten und sind deutlich größer als die Notizen. Sie werden deshalb getrennt und sparsam geladen.

- **Liste:** Wird erst geladen, wenn der Figuren-Tab geöffnet wird. Query-Schlüssel `["roster", profileId, game, uid]`, `staleTime` 30 Minuten, kein Neuladen im Intervall.
- **Details:** Werden beim Antippen einer Figur geladen. Query-Schlüssel `["character", profileId, game, uid, id]`. Bei Star Rail befüllt die Listenantwort die Details direkt mit, ein zweiter Aufruf entfällt.
- **Vorladen:** Bei Genshin und ZZZ lädt die App nach der Liste die Details in Blöcken zu je 10 Figuren nach, sobald der Tab offen ist. Dann funktionieren auch die Hinweise auf Ausrüstungslücken in der Liste. Ob das die Rate-Limits einhält, ist beim Durchstich zu prüfen. Sonst bleibt es beim Laden auf Antippen.
- **Aktualisieren:** Pull-to-Refresh im Figuren-Tab lädt Liste und geöffnete Details neu. Das automatische Neuladen der Notizen berührt die Figurendaten nicht.
- **Profilwechsel:** Wie bei den Notizen enthalten alle Schlüssel die Profil-ID. Der Cache des alten Profils wird verworfen.

## UI-Konzept

Die Detailseite bekommt unter dem Kopf zwei Tabs: **Übersicht** mit den bisherigen Abschnitten und **Figuren**. Der Kopf mit der Hauptressource bleibt in beiden Tabs sichtbar, aber eingeklappt auf eine Zeile, sobald der Figuren-Tab aktiv ist. Der gewählte Tab steht in der URL (`/game/:game/:uid?tab=figuren`), damit der Zurück-Knopf unter Android wie erwartet funktioniert.

**Figurenliste**

```
┌──────────────────────────────────┐
│ ← Dashboard                      │
│ [Resin ▓▓▓▓▓░ 162/200 · 4 h 56]  │
│ ┌ Übersicht ┐┌ Figuren ┐         │
│ [Alle][Pyro][Hydro][…]  Sort: Lv │
│ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │🔥  C2│ │💧  C0│ │⚡  C6│       │
│ │ Bild │ │ Bild │ │ Bild │       │
│ │Lv 90 │ │Lv 80⚠│ │Lv 90 │       │
│ │   ⚔R1│ │   ⚔R5│ │   ⚔R3│       │
│ └──────┘ └──────┘ └──────┘       │
│ Hu Tao   Furina   Fischl         │
└──────────────────────────────────┘
```

- Raster mit drei Spalten auf dem Smartphone, ab `md` sechs Spalten.
- Jede Kachel: Porträt auf Hintergrund in Seltenheitsfarbe (5 Sterne gold, 4 Sterne violett), Elementsymbol oben links, Duplikate oben rechts, Stufe unten links, Waffensymbol mit Veredelung unten rechts, Name darunter.
- Ein Warnsymbol erscheint, wenn eine Ausrüstungslücke erkannt wurde, siehe unten. Es ist nur sichtbar, wenn die Details bereits geladen sind.
- Filter als Chips: Element, bei Star Rail zusätzlich Pfad, bei ZZZ Rolle. Sortierung nach Stufe (Standard), Seltenheit, Duplikaten oder Name. Filter und Sortierung merkt sich die App pro Spiel im `localStorage`, es sind reine Anzeige-Einstellungen.
- Kopfzeile über dem Raster: "42 Charaktere · 18 auf Stufe 90".

**Figur-Detail**

Ein Tipp auf eine Kachel öffnet eine eigene Route `/game/:game/:uid/figur/:id`. Aufbau von oben nach unten:

1. **Kopf:** Großes Bild, Name, Element, Stufe, Duplikate als sechs Punkte (gefüllt = freigeschaltet).
2. **Waffe:** Symbol, Name, Stufe von Maximum, Veredelung, Haupt- und Nebenwert.
3. **Ausrüstung:** Eine Zeile pro Platz in Spielreihenfolge mit Symbol, Platzname, Stufe, Hauptwert groß und Nebenwerten als kleine Chips. Erhöhungen erscheinen als Punkte am Chip, z. B. "Krit. Schaden 21,0 % ••".
4. **Sets:** Chips mit Set-Name und Teilezahl, aktive Boni farbig. Ein Tipp zeigt den Bonustext.
5. **Talente:** Stufen nebeneinander, durch Duplikate erhöhte Stufen in Akzentfarbe.
6. **Werte:** Die sechs wichtigsten Werte des Spiels, darunter "Alle Werte" zum Aufklappen.
7. **Begleiter:** Memosprite oder Bangboo, nur wenn vorhanden.

Wischen nach links oder rechts wechselt zur nächsten Figur in der aktuellen Sortierung.

**Hinweise auf Ausrüstungslücken**

Die App prüft nur eindeutige Regeln und gibt keine Build-Empfehlungen.

| Hinweis | Regel |
| --- | --- |
| Platz leer | Weniger Teile in `gear` als Plätze |
| Set unvollständig | Ein Set mit 1 bzw. 3 Teilen, also ein knapp verpasster Bonus |
| Ausrüstung nicht ausgebaut | Teil unter Maximalstufe, z. B. Artefakt unter +20 |
| Waffe nicht ausgebaut | Waffenstufe unter Figurenstufe |

Die Hinweise erscheinen im Figur-Detail als kleine Zeilen über der Ausrüstung und als Warnsymbol auf der Kachel.

**Gestaltung:** Es gelten die Regeln aus dem Hauptkonzept. Bilder von Figuren, Waffen und Ausrüstung kommen als URL aus der API. Element- und Pfadsymbole liegen lokal unter `assets/elements/<spiel>/<element>.webp` und sind in `assets/registry.ts` eingetragen. Fehlt ein Bild, erscheint das neutrale Ersatzsymbol. Beim Laden zeigt das Raster Skelett-Kacheln.

## Fehlerfälle

| Fall | Erkennung | Verhalten |
| --- | --- | --- |
| Figurendaten nicht öffentlich | `retcode` 10102 | Hinweis, in HoYoLAB unter Datenschutz die Charakterdetails freizugeben |
| Zu viele Anfragen | `retcode` 10101 | Bereits geladene Details behalten, Vorladen abbrechen |
| Unbekannte Antwort | Schema-Prüfung mit `zod` schlägt fehl | Tab zeigt "Schnittstelle geändert", die Übersicht bleibt nutzbar |
| Unbekannter Wert | `property_type` fehlt in `property_map` | Wert mit roher ID anzeigen statt abzubrechen |
| Wuthering Waves | Kein Adapter | Nur Anzahl der Resonatoren, siehe oben |

Fehler im Figuren-Tab betreffen nie den Übersicht-Tab und die Dashboard-Karte.

## Projektstruktur

```
src/
├─ api/
│  └─ characters/        # neu: genshin.ts, starrail.ts, zzz.ts, index.ts
├─ features/
│  └─ game-detail/
│     ├─ GameDetail.tsx  # Tabs ergänzen
│     ├─ Roster.tsx      # Raster, Filter, Sortierung
│     ├─ CharacterView.tsx
│     └─ gearHints.ts    # Regeln für Ausrüstungslücken, mit Tests
└─ model/
   ├─ types.ts           # Character, Weapon, GearPiece, …
   └─ games.ts           # GAME_TERMS
```

Die Adapter liegen getrennt von den Notiz-Adaptern, weil sie andere Endpunkte und eigene Query-Schlüssel haben. HTTP, DS-Header und Fehlerabbildung kommen aus den vorhandenen Modulen `api/http.ts` und `api/hoyolab.ts`.

## Umsetzungsplan und offene Punkte

- [ ] Durchstich Star Rail: `avatar/info` im Browser-Modus abrufen, echte Antwort als Test-Fixture ablegen, Feldnamen prüfen
- [ ] Datenmodell, `GAME_TERMS` und Star-Rail-Adapter mit Tests
- [ ] Tabs auf der Detailseite, Figurenraster und Figur-Detail
- [ ] Adapter für Genshin (`character/list`, `character/detail`) und ZZZ (`avatar/basic`, `avatar/info`)
- [ ] Hinweise auf Ausrüstungslücken mit Tests
- [ ] Filter, Sortierung und Wischen zwischen Figuren
- [ ] Wuthering Waves: Anzahl aus `Base.RoleNum`, Kuro BBS für globale Konten prüfen

Offene Punkte:

- Feldnamen und Bildfelder aller Endpunkte, besonders das Porträt bei ZZZ
- Ob `x-rpc-language: de-de` für alle drei Spiele deutsche Namen liefert, sonst Englisch als Rückfall
- Rate-Limits beim Vorladen der Details
- Ob Kuro BBS Figurendaten für globale Wuthering-Waves-Konten liefert
