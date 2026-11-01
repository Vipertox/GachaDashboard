/**
 * Ressourcen-Icons aus dem HoYoWiki, ermittelt über
 * `sg-wiki-api-static.hoyolab.com/hoyowiki/<wiki>/wapi/entry_page?entry_page_id=<id>` (Feld `icon_url`).
 * Die Eintrags-ID steht jeweils dahinter, falls eine URL neu nachgeschlagen werden muss.
 * Ohne passenden Eintrag (Wuthering Waves, Genshin-Aufträge, ZZZ-Engagement und -Survey Points)
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
};
