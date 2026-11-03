/**
 * Ressourcen-Icons aus dem HoYoWiki, ermittelt über
 * `sg-wiki-api-static.hoyolab.com/hoyowiki/<wiki>/wapi/entry_page?entry_page_id=<id>` (Feld `icon_url`).
 * Die Eintrags-ID steht jeweils dahinter, falls eine URL neu nachgeschlagen werden muss.
 * Wuthering Waves nutzt das Fandom-Wiki (CC BY-SA), dahinter steht der Dateiname; die URL liefert
 * `wutheringwaves.fandom.com/api.php?action=query&prop=imageinfo&iiprop=url&titles=File:<Name>`.
 * Das Spiel-Icon von Wuthering Waves ist das App-Icon aus Google Play (die HoYoLAB-Spielkarte kennt das Spiel nicht).
 * Ohne passenden Eintrag (Genshin-Aufträge, ZZZ-Engagement und -Survey Points, Waveplate Crystal)
 * bleibt es beim Ersatzsymbol.
 */
export const WIKI_ICONS: Record<string, string> = {
  // genshin 2970 "Original Resin"
  "genshin/resin":
    "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/07/03/237301566/4328202cd795d7c4a7d5cd54e331c43b_1224981524026882289.png",
  // genshin 3678 "Realm Currency"
  "genshin/realm":
    "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/03/29/194600931/853777b20dff4c545de10c30b8f4543c_3219915689637833360.png",
  // hsr 179 "Trailblaze Power"
  "starrail/power":
    "https://upload-static.hoyoverse.com/hoyowiki/2023/02/21/cf473d0c355b9f6d4cc5930681217e82_3238642280712712661.png",
  // hsr 1902 "Reserved Trailblaze Power"
  "starrail/reserve":
    "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/01/12/167256510/c1a1a7ad271af28e969a4b46d8cdd16c_4779666026305602445.png",
  // hsr 154 "Activity" (Tägliches Training)
  "starrail/training":
    "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/04/27/445751243/18f5ef48a6b94a528943756b919874ab_6884728134998625305.png",
  // hsr 587 "Simulated Universe"
  "starrail/rogue":
    "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/07/19/167256510/e064d187dfc91f0c6be21c77733fa301_569915280178231186.png",
  // hsr 8442 "Divergent Universe: Collections"
  "starrail/divergent":
    "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2026/08/04/c734433003051eccbd18d2726676432c_7412232274536865190.png",
  // zzz 593 "Battery Charge"
  "zzz/battery":
    "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/02/08/167256510/d863d49f931ca0dbac3b0ec563657368_2411518699554855175.png",
  // Google Play, App com.kurogame.wutheringwaves.global (Feld og:image, "=s128" für 128 px)
  "games/wuwa":
    "https://play-lh.googleusercontent.com/S4HjezIFmL17FpPu7Z8VzxZvFMABYUjfLkcrDSEKxpjCYIL3tWLQK76_16SDOTiZlVHm_KeoMawvC7BPcyW_=s128",
  // wuwa "Item Waveplate.png"
  "wuwa/waveplate":
    "https://static.wikia.nocookie.net/wutheringwaves/images/e/e9/Item_Waveplate.png/revision/latest/scale-to-width-down/128?cb=20240712182653",
  // wuwa "Item Activity Points.png"
  "wuwa/activity":
    "https://static.wikia.nocookie.net/wutheringwaves/images/4/49/Item_Activity_Points.png/revision/latest/scale-to-width-down/128?cb=20250125202020",
  // wuwa "Icon Pioneer Podcast.png"
  "wuwa/podcast":
    "https://static.wikia.nocookie.net/wutheringwaves/images/8/84/Icon_Pioneer_Podcast.png/revision/latest?cb=20250907182402",
  // wuwa "Item Melody Box.png" (sammelt im Spiel die Musiktitel)
  "wuwa/album":
    "https://static.wikia.nocookie.net/wutheringwaves/images/a/a7/Item_Melody_Box.png/revision/latest/scale-to-width-down/128?cb=20250112144015",
  // wuwa "Icon Expedition Motorbike.png" (MotorData ist das Motorrad aus Lahai-Roi)
  "wuwa/vehicle":
    "https://static.wikia.nocookie.net/wutheringwaves/images/b/bb/Icon_Expedition_Motorbike.png/revision/latest?cb=20260501173804",
};
