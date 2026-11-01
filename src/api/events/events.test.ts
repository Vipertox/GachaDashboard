import { describe, expect, it } from "vitest";
import { parseGenshinEvents } from "./genshin";
import { parseStarRailEvents } from "./starrail";
import { parseZzzBanners, parseZzzEvents } from "./zzz";

// Fixtures nach den Feldnamen aus genshin.py, gekürzt. Beim Durchstich durch echte Antworten ersetzen.

const now = new Date("2026-11-01T12:00:00Z");
const ts = (days: number) => Math.floor(now.getTime() / 1000) + days * 86400;

describe("Genshin", () => {
  const data = {
    act_list: [
      {
        id: 1,
        name: "Lanternen-Ritus",
        desc: "Zeile 1\\n<color=#f00>Zeile 2</color>",
        start_timestamp: String(ts(-3)),
        end_timestamp: String(ts(5)),
        is_finished: false,
        reward_list: [{ name: "Primogems", icon: "p.png", num: 420 }],
        explore_detail: { explore_percent: 62.5, is_finished: false },
      },
      { id: 2, name: "Doppelte Drops", start_timestamp: ts(-1), end_timestamp: ts(2), double_detail: { total: 3, left: 1 } },
      { id: 3, name: "Vorbei", start_timestamp: ts(-20), end_timestamp: ts(-1) },
      { id: 4, name: "Bald", start_timestamp: ts(2), end_timestamp: ts(10) },
    ],
    avatar_card_pool_list: [
      {
        pool_id: 9,
        pool_name: "Charakter-Aktionsgebet",
        start_timestamp: ts(-5),
        end_timestamp: ts(15),
        avatars: [{ name: "Furina", icon: "f.png", rarity: 5 }],
        weapon: [],
      },
    ],
  };

  it("liest Events mit Fortschritt, Beschreibung und Belohnungen", () => {
    const { events } = parseGenshinEvents(data, now);
    expect(events.map((e) => e.name)).toEqual(["Lanternen-Ritus", "Doppelte Drops", "Bald"]);
    expect(events[0]).toMatchObject({
      status: "running",
      progress: { current: 63, max: 100, unit: "%" },
      description: "Zeile 1\nZeile 2",
      rewards: [{ name: "Primogems", count: 420 }],
    });
    expect(events[1]).toMatchObject({ tag: "Doppelt", progress: { current: 2, max: 3 } });
    expect(events[2].status).toBe("upcoming");
  });

  it("erkennt Primogems an Name oder Item-ID, erledigt heißt eingesammelt", () => {
    const { events } = parseGenshinEvents(
      {
        act_list: [
          { id: 1, name: "Offen", end_timestamp: ts(5), reward_list: [{ name: "Primogems", num: 420 }, { name: "Mora", num: 1000 }] },
          { id: 2, name: "Fertig", end_timestamp: ts(5), is_finished: true, reward_list: [{ item_id: 201, name: "Urgestein", num: 300 }] },
          { id: 3, name: "Ohne", end_timestamp: ts(5), reward_list: [{ name: "Mora", num: 1000 }] },
        ],
      },
      now,
    );
    expect(events.map((e) => e.currency)).toEqual([
      { name: "Primogems", total: 420, remaining: 420, iconUrl: undefined },
      { name: "Primogems", total: 300, remaining: 0, iconUrl: undefined },
      undefined,
    ]);
  });

  it("liest Banner", () => {
    const { banners } = parseGenshinEvents(data, now);
    expect(banners).toMatchObject([
      { name: "Charakter-Aktionsgebet", kind: "character", status: "running", items: [{ name: "Furina", rarity: 5 }] },
    ]);
  });
});

describe("Star Rail", () => {
  it("liest Events, Login-Kennzeichen und Sprünge", () => {
    const c = parseStarRailEvents(
      {
        act_list: [
          {
            id: 1,
            name: "Gala\\nim Express",
            act_type: "ActivityTypeOther",
            act_status: "OtherActStatusUnFinish",
            time_info: { start_ts: String(ts(-2)), end_ts: String(ts(1)) },
            current_progress: 3,
            total_progress: 5,
            reward_list: [{ name: "Stellarjade", num: 800 }],
          },
          {
            id: 2,
            name: "Login",
            act_type: "ActivityTypeSign",
            act_status: "SignStatusFinish",
            time_info: { start_ts: ts(-2), end_ts: ts(6) },
            all_finished: true,
          },
          {
            id: 3,
            name: "Gesperrt",
            act_type: "ActivityTypeOther",
            act_status: "OtherActStatusUnopened",
            time_info: { start_ts: ts(-1), end_ts: ts(9) },
          },
        ],
        avatar_card_pool_list: [
          {
            id: 7,
            name: "Sprung",
            time_info: { start_ts: ts(-1), end_ts: ts(20) },
            avatar_list: [{ item_name: "Firefly", icon_url: "ff.png", rarity: "5" }],
          },
        ],
        equip_card_pool_list: [
          {
            id: 7,
            name: "",
            time_info: { start_ts: ts(-1), end_ts: ts(20) },
            equip_list: [{ item_name: "Wiedersehen am Abend", item_url: "lc.png", rarity: 5 }],
          },
        ],
      },
      now,
    );
    expect(c.events.map((e) => [e.name, e.status, e.tag])).toEqual([
      ["Gala im Express", "running", undefined],
      ["Login", "done", "Login"],
      ["Gesperrt", "upcoming", undefined],
    ]);
    expect(c.events[0].progress).toEqual({ current: 3, max: 5 });
    expect(c.events[0].currency).toMatchObject({ name: "Stellarjade", total: 800, remaining: 800 });
    expect(c.banners[0].items).toEqual([{ name: "Firefly", iconUrl: "ff.png", rarity: 5 }]);
    // Allgemeiner oder fehlender Name wird durch den Typ ersetzt; gleiche IDs in beiden Listen bleiben unterscheidbar.
    expect(c.banners.map((b) => [b.id, b.name, b.kind])).toEqual([
      ["character-7", "Charakter-Aktionssprung", "character"],
      ["lightCone-7", "Lichtkegel-Aktionssprung", "weapon"],
    ]);
  });
});

describe("ZZZ", () => {
  it("liest Events mit Polychrome", () => {
    const events = parseZzzEvents(
      {
        activity_list: [
          { activity_id: 1, name: "Jagd", state: "STATE_IN_PROGRESS", start_ts: ts(-1), end_ts: ts(9), monochrome_got_cnt: 40, monochrome_cnt: 120 },
          { activity_id: 2, name: "Fertig", state: "STATE_COMPLETED", start_ts: ts(-1), end_ts: ts(9), monochrome_cnt: 0 },
          { activity_id: 3, name: "Bald", state: "STATE_NOT_START", start_ts: ts(3), end_ts: ts(9) },
        ],
      },
      now,
    );
    expect(events.map((e) => e.status)).toEqual(["running", "done", "upcoming"]);
    expect(events[0].progress).toEqual({ current: 40, max: 120, unit: "Polychrome" });
    expect(events[1].progress).toBeUndefined();
    expect(events[0].currency).toEqual({ name: "Polychrome", total: 120, remaining: 80 });
  });

  it("liest Kanäle mit Buchstaben-Seltenheit", () => {
    const [b] = parseZzzBanners(
      {
        avatar_gacha_schedule_list: [
          { gacha_type: "GACHA_TYPE_CHARACTER_UP", start_ts: ts(-1), end_ts: ts(10), avatar_list: [{ avatar_name: "Miyabi", full_name: "Hoshimi Miyabi", icon: "m.png", rarity: "S" }] },
        ],
        weapon_gacha_schedule_list: [{ gacha_type: "GACHA_TYPE_WEAPON_UP", start_ts: ts(-30), end_ts: ts(-2) }],
      },
      now,
    );
    expect(b).toMatchObject({ name: "Exklusiver Kanal", kind: "character", items: [{ name: "Hoshimi Miyabi", rarity: 5 }] });
  });

  it("ordnet Kanäle nach Typ ein, unbekannte nach ihrer Liste", () => {
    const banners = parseZzzBanners(
      {
        avatar_gacha_schedule_list: [{ gacha_type: "GACHA_TYPE_NEU", start_ts: ts(-1), end_ts: ts(10) }],
        weapon_gacha_schedule_list: [
          { gacha_type: "GACHA_TYPE_WEAPON_RETURN", start_ts: ts(-1), end_ts: ts(10) },
          { gacha_type: "GACHA_TYPE_BANGBOO", start_ts: ts(-1), end_ts: ts(10) },
        ],
      },
      now,
    );
    expect(banners.map((b) => b.kind)).toEqual(["character", "weapon", "other"]);
  });
});
