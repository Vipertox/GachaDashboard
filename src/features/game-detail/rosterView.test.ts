import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "./rosterView";

const stored = (value: string | null) => vi.stubGlobal("localStorage", { getItem: () => value });

afterEach(() => vi.unstubAllGlobals());

describe("Gespeicherte Figuren-Einstellungen", () => {
  it("übernimmt gültige Werte", () => {
    stored(JSON.stringify({ sort: "rarity", element: "Pyro", role: "" }));
    expect(loadPrefs("genshin")).toEqual({ sort: "rarity", element: "Pyro", role: "" });
  });

  it("setzt unbekannte und falsch getypte Werte einzeln auf den Standard", () => {
    stored(JSON.stringify({ sort: "toString", element: 5, role: null }));
    expect(loadPrefs("genshin")).toEqual({ sort: "level", element: "", role: "" });
  });

  it("verträgt kaputtes JSON, null und fehlenden Speicher", () => {
    for (const raw of ["{kaputt", "null", null]) {
      stored(raw);
      expect(loadPrefs("zzz")).toEqual({ sort: "level", element: "", role: "" });
    }
  });
});
