import { describe, expect, it } from "vitest";
import { generateDs, pickRoles } from "../hoyolab";
import { findPlayerId } from "../kuro";
import { liveValue } from "../../lib/time";
import { parseGenshin } from "./genshin";
import { parseStarRail } from "./starrail";
import { parseWuwa } from "./wuwa";
import { parseZzz } from "./zzz";
import type { Account } from "../../model/types";

const now = new Date("2026-11-01T12:00:00Z");
const acc = (game: Account["game"]): Account => ({ profileId: "p", game, uid: "1", region: "os_euro" });

describe("DS-Header", () => {
  it("bildet salt, t und r wie genshin.py", () => {
    expect(generateDs(1700000000, "abcdef")).toMatch(/^1700000000,abcdef,[0-9a-f]{32}$/);
  });
});

describe("Genshin", () => {
  const raw = {
    current_resin: 120,
    max_resin: 200,
    resin_recovery_time: "38400",
    finished_task_num: 3,
    total_task_num: 4,
    is_extra_task_reward_received: false,
    remain_resin_discount_num: 2,
    resin_discount_num_limit: 3,
    current_home_coin: 1000,
    max_home_coin: 2400,
    home_coin_recovery_time: "86400",
    expeditions: [{ avatar_side_icon: "x", status: "Ongoing", remained_time: "3600" }],
    transformer: { obtained: true, recovery_time: { Day: 3, Hour: 4, Minute: 0, Second: 0, reached: false } },
  };
  const s = parseGenshin(raw, acc("genshin"), now);

  it("rechnet Restzeit in fullAt um", () => {
    expect(s.primary.fullAt?.getTime()).toBe(now.getTime() + 38400_000);
    expect(s.primary.regenSeconds).toBe(480);
  });
  it("zählt den Stand lokal weiter", () => {
    expect(liveValue(s.primary, now.getTime())).toBe(120);
    expect(liveValue(s.primary, now.getTime() + 480_000 * 5)).toBe(125);
    expect(liveValue(s.primary, now.getTime() + 38400_000)).toBe(200);
  });
  it("füllt Abschnitte", () => {
    expect(s.sections.map((x) => x.kind)).toEqual(["daily", "weekly", "running", "other"]);
  });
  it("meldet Schnittstellenänderung", () => {
    expect(() => parseGenshin({ foo: 1 }, acc("genshin"), now)).toThrow(/Schnittstelle/);
  });
});

describe("Star Rail", () => {
  it("liest Stamina und Zuweisungen", () => {
    const s = parseStarRail(
      {
        current_stamina: 240,
        max_stamina: 300,
        stamina_recover_time: 21600,
        current_reserve_stamina: 100,
        current_train_score: 400,
        max_train_score: 500,
        weekly_cocoon_cnt: 1,
        weekly_cocoon_limit: 3,
        accepted_epedition_num: 4,
        total_expedition_num: 4,
        expeditions: [{ name: "A", avatars: ["u"], status: "Ongoing", remaining_time: 100 }],
      },
      acc("starrail"),
      now,
    );
    expect(s.primary.regenSeconds).toBe(360);
    expect(s.secondary[0].current).toBe(100);
    expect(s.sections.find((x) => x.kind === "weekly")?.flags[0].text).toBe("1 von 3 übrig");
  });
});

describe("ZZZ", () => {
  it("liest Battery Charge", () => {
    const s = parseZzz(
      {
        energy: { progress: { current: 100, max: 240 }, restore: 50400 },
        vitality: { current: 300, max: 400 },
        card_sign: "CardSignDone",
        vhs_sale: { sale_state: "SaleStateDone" },
      },
      acc("zzz"),
      now,
    );
    expect(s.primary.max).toBe(240);
    expect(s.sections[0].flags.map((f) => f.done)).toEqual([true, true]);
  });
});

describe("Wuthering Waves", () => {
  const base = { Energy: 200, MaxEnergy: 240, StoreEnergy: 480, MaxStoreEnergy: 480, Liveness: 80, LivenessMaxCount: 100, LivenessUnlock: true, WeeklyInstCount: 2 };
  it("nutzt EnergyRecoverTime als Zeitpunkt in ms", () => {
    const at = now.getTime() + 40 * 360_000;
    const s = parseWuwa({ Base: { ...base, EnergyRecoverTime: at }, BattlePass: { IsOpen: true, Level: 5, WeekExp: 10, WeekMaxExp: 100 } }, acc("wuwa"), now);
    expect(s.primary.fullAt?.getTime()).toBe(at);
    expect(liveValue(s.primary, now.getTime())).toBe(200);
    expect(s.sections.map((x) => x.kind)).toEqual(["daily", "weekly"]);
    expect(s.secondary.map((r) => r.label)).toEqual(["Waveplate Crystal"]);
  });
  it("0 bedeutet voll", () => {
    const s = parseWuwa({ Base: { ...base, Energy: 240, EnergyRecoverTime: 0 } }, acc("wuwa"), now);
    expect(s.primary.fullAt).toBeUndefined();
    expect(liveValue(s.primary, now.getTime())).toBe(240);
  });
});

describe("HoYoLAB-Spielkonten", () => {
  it("nimmt pro Spiel das erste Konto und ignoriert fremde Spiele", () => {
    const roles = pickRoles([
      { game_biz: "bh3_global", game_uid: "9", region: "x" },
      { game_biz: "hk4e_global", game_uid: 700000001, region: "os_euro", nickname: "A", level: 60 },
      { game_biz: "hk4e_global", game_uid: "800000001", region: "os_asia" },
      { game_biz: "nap_global", game_uid: "1500000001", region: "prod_gf_eu" },
    ]);
    expect(roles.map((r) => [r.game, r.uid, r.region])).toEqual([
      ["genshin", "700000001", "os_euro"],
      ["zzz", "1500000001", "prod_gf_eu"],
    ]);
  });
});

describe("Kuro queryPlayerInfo", () => {
  it("findet die Spieler-ID tolerant", () => {
    expect(findPlayerId({ playerId: 123 })).toBe("123");
    expect(findPlayerId('{"x":{"Id":"456"}}')).toBe("456");
  });
});
