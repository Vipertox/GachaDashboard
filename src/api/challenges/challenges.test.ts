import { describe, expect, it } from "vitest";
import { parseAbyss, parseStygian, parseTheater } from "./genshin";
import { parseFloors, parsePeak } from "./starrail";
import { parseAssault, parseShiyu, parseThreshold } from "./zzz";
import { pickPeriod, plain, serverDate, serverOffset } from "./util";

describe("Namen", () => {
  it("entfernt Tags und verschachtelte Reste", () => {
    expect(plain("Ewige <unbreak>Melodie</unbreak>")).toBe("Ewige Melodie");
    expect(plain("<scr<script>ipt>x")).toBe("x");
  });
});

// Fixtures nach den Feldnamen aus genshin.py, gekürzt. Beim Durchstich durch echte Antworten ersetzen.

describe("Serverzeit", () => {
  it("ordnet Regionen ihre Abweichung zu", () => {
    expect(serverOffset("os_usa")).toBe(-5);
    expect(serverOffset("prod_official_eur")).toBe(1);
    expect(serverOffset("prod_gf_eu")).toBe(1);
    expect(serverOffset("prod_gf_jp")).toBe(8);
  });

  it("rechnet Datumsteile in UTC um", () => {
    const d = serverDate({ year: 2026, month: 11, day: 3, hour: 4, minute: 0 }, 1);
    expect(d?.toISOString()).toBe("2026-11-03T03:00:00.000Z");
  });
});

describe("Genshin", () => {
  it("liest den Spiral Abyss", () => {
    const c = parseAbyss({
      is_unlock: true,
      start_time: "1761951600",
      end_time: "1764543600",
      total_star: 33,
      max_floor: "12-3",
      total_battle_times: 14,
      total_win_times: 12,
      floors: [
        { index: 12, star: 6, max_star: 9 },
        { index: 8, star: 9, max_star: 9 },
        { index: 11, star: 9, max_star: 9 },
      ],
    });
    expect(c).toMatchObject({ state: "ok", progress: { current: 33, max: 36 }, summary: "33/36 Sterne" });
    expect(c.end?.getTime()).toBe(1764543600 * 1000);
    expect(c.facts.map((f) => f.label)).toEqual(["Tiefste Kammer", "Kämpfe gewonnen", "Etage 11", "Etage 12"]);
  });

  it("meldet einen nicht freigeschalteten oder nicht gespielten Abyss", () => {
    expect(parseAbyss({ is_unlock: false }).state).toBe("locked");
    expect(parseAbyss({ is_unlock: true, total_battle_times: 0 }).state).toBe("empty");
  });

  it("wählt im Imaginarium Theater die Periode", () => {
    const data = {
      is_unlock: true,
      data: [
        { has_data: true, schedule: { start_time: 2, end_time: 3 }, stat: { difficulty_id: 4, max_round_id: 8, medal_num: 7, coin_num: 20 } },
        { has_data: true, schedule: { start_time: 1, end_time: 2 }, stat: { difficulty_id: 3, max_round_id: 8, medal_num: 8, coin_num: 5 } },
      ],
    };
    expect(parseTheater(data, "current")).toMatchObject({ progress: { current: 8, max: 10 }, summary: "Akt 8/10" });
    expect(parseTheater(data, "previous")).toMatchObject({ progress: { current: 8, max: 8 } });
    expect(parseTheater({ is_unlock: true, data: [] }, "current").state).toBe("empty");
  });

  it("liest Stygian Onslaught ohne ungültige Einträge", () => {
    const c = parseStygian(
      {
        is_unlock: true,
        data: [
          { schedule: { is_valid: false } },
          {
            schedule: { name: "Saison 3", start_time: 1, end_time: 2, is_valid: true },
            single: { has_data: true, best: { difficulty: 5, second: 98 } },
            mp: { has_data: false, best: null },
          },
        ],
      },
      "current",
    );
    expect(c).toMatchObject({ season: "Saison 3", summary: "Stufe 5 · 98 s", facts: [{ label: "Bestwert allein" }] });
  });
});

describe("Star Rail", () => {
  const group = {
    name_mi18n: "Ewige <unbreak>Melodie</unbreak>",
    begin_time: { year: 2026, month: 10, day: 27, hour: 4, minute: 0 },
    end_time: { year: 2026, month: 12, day: 8, hour: 3, minute: 59 },
  };

  it("liest Pure Fiction mit Saison und Serverzeit", () => {
    const c = parseFloors(
      { groups: [group], star_num: 9, extra_star_num: 0, max_floor: "Stufe 4", battle_num: 5, has_data: true },
      12,
      "prod_official_eur",
    );
    expect(c).toMatchObject({ season: "Ewige Melodie", summary: "9/12 Sterne" });
    expect(c.end?.toISOString()).toBe("2026-12-08T02:59:00.000Z");
  });

  it("meldet eine nicht gespielte Periode", () => {
    expect(parseFloors({ groups: [group], has_data: false }, 36, "prod_official_usa").state).toBe("empty");
  });

  it("liest Anomaly Arbitration", () => {
    const data = {
      challenge_peak_records: [
        { group, boss_info: { name_mi18n: "Boss" }, has_challenge_record: true, battle_num: 4, boss_stars: 3, mob_stars: 9 },
        { group, has_challenge_record: false },
      ],
    };
    expect(parsePeak(data, "current", "prod_official_asia")).toMatchObject({ summary: "12 Sterne" });
    expect(parsePeak(data, "previous", "prod_official_asia").state).toBe("empty");
  });
});

describe("ZZZ", () => {
  const time = (day: number) => ({ year: 2026, month: 11, day, hour: 4, minute: 0, second: 0 });

  it("liest Shiyu Defense in der neuen Fassung", () => {
    const c = parseShiyu(
      {
        hadal_ver: "v2",
        hadal_info_v2: {
          hadal_begin_time: time(1),
          hadal_end_time: time(15),
          pass_fifth_floor: true,
          brief: { score: 52000, max_score: 65000, rank_percent: 123, rating: "S" },
        },
      },
      "prod_gf_eu",
    );
    expect(c.progress).toEqual({ current: 52000, max: 65000, unit: "Punkte" });
    expect(c.facts).toContainEqual({ label: "Rangliste", value: "Top 1,23 %" });
    expect(c.end?.toISOString()).toBe("2026-11-15T03:00:00.000Z");
  });

  it("liest Shiyu Defense in der alten Fassung", () => {
    const c = parseShiyu(
      { hadal_ver: "v1", hadal_info_v1: { has_data: true, max_layer: 7, rating_list: [{ rating: "S", times: 7 }, { rating: "A", times: 0 }] } },
      "prod_gf_us",
    );
    expect(c.facts).toContainEqual({ label: "Bewertungen", value: "S ×7" });
  });

  it("liest Deadly Assault und Threshold Simulation", () => {
    const a = parseAssault({ start_time: time(3), end_time: time(17), has_data: true, total_score: 60000, total_star: 8, rank_percent: 512 }, "prod_gf_jp");
    expect(a).toMatchObject({ summary: "8/9 Sterne" });
    expect(parseAssault({ has_data: false }, "prod_gf_jp").state).toBe("empty");
    const t = parseThreshold({ void_front_battle_abstract_info_brief: { has_ending_record: true, ending_record_name: "Ende A", total_score: 3000, rank_percent: 0 } });
    expect(t.facts.map((f) => f.label)).toEqual(["Punkte", "Ende"]);
  });
});

describe("Periodenwahl", () => {
  interface Entry {
    id: string;
    start?: Date;
  }
  const at = (day: number) => new Date(Date.UTC(2026, 10, day));
  const pick = (list: Entry[], period: "current" | "previous") => pickPeriod(list, period, (e) => e.start)?.id;
  const entries: Entry[] = [{ id: "alt", start: at(1) }, { id: "neu", start: at(15) }, { id: "uralt", start: at(1 - 30) }];

  it("wählt unabhängig von der Reihenfolge der API nach Startzeit", () => {
    expect(pick(entries, "current")).toBe("neu");
    expect(pick(entries, "previous")).toBe("alt");
    expect(pick([...entries].reverse(), "current")).toBe("neu");
  });

  it("stellt Einträge ohne Startzeit hinten an und lässt sonst die Reihenfolge der API stehen", () => {
    expect(pick([{ id: "ohne" }, { id: "mit", start: at(1) }], "current")).toBe("mit");
    expect(pick([{ id: "a" }, { id: "b" }], "current")).toBe("a");
    expect(pick([{ id: "a" }, { id: "b" }], "previous")).toBe("b");
    expect(pick([], "current")).toBeUndefined();
  });

  it("liest Imaginarium Theater auch bei aufsteigend sortierter Antwort richtig", () => {
    const period = (start: number, rounds: number, difficulty: number) => ({
      has_data: true,
      schedule: { start_time: start, end_time: start + 86400 * 30 },
      stat: { difficulty_id: difficulty, max_round_id: rounds, medal_num: 0, coin_num: 0 },
    });
    const data = { is_unlock: true, data: [period(1_700_000_000, 5, 3), period(1_702_600_000, 9, 4)] };
    expect(parseTheater(data, "current")).toMatchObject({ summary: "Akt 9/10" });
    expect(parseTheater(data, "previous")).toMatchObject({ summary: "Akt 5/8" });
  });
});
