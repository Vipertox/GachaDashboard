import { describe, expect, it } from "vitest";
import { findBrowser, pickTokens } from "./login";

describe("HoYoLAB-Browser-Login", () => {
  it("liest beide Tokens nur von hoyolab.com", () => {
    const c = (name: string, value: string, domain: string) => ({ name, value, domain });
    expect(pickTokens([c("ltuid_v2", "1", ".hoyolab.com"), c("ltoken_v2", "t", ".hoyolab.com")])).toEqual({ ltuid: "1", ltoken: "t" });
    expect(pickTokens([c("ltuid_v2", "1", ".hoyolab.com")])).toBeNull();
    expect(pickTokens([c("ltuid_v2", "1", ".evil.com"), c("ltoken_v2", "t", ".evil.com")])).toBeNull();
    expect(pickTokens([c("ltuid_v2", "1", "evilhoyolab.com"), c("ltoken_v2", "t", "evilhoyolab.com")])).toBeNull();
    expect(pickTokens([c("ltuid_v2", "1", "hoyolab.com"), c("ltoken_v2", "t", "sg-public-api.hoyolab.com")])).toEqual({ ltuid: "1", ltoken: "t" });
  });
  it("findet Edge oder Chrome auf diesem System", () => {
    expect(findBrowser()).toBeTruthy();
  });
});
