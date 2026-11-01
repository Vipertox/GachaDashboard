import { describe, expect, it } from "vitest";
import { createApp, isAllowedUrl, isLocalHost } from "./server";

describe("Proxy-Sicherheit", () => {
  it("erlaubt nur bekannte https-Hosts", () => {
    expect(isAllowedUrl("https://bbs-api-os.hoyolab.com/x")).toBe(true);
    expect(isAllowedUrl("http://bbs-api-os.hoyolab.com/x")).toBe(false);
    expect(isAllowedUrl("https://evil.example.com/")).toBe(false);
    expect(isAllowedUrl("https://bbs-api-os.hoyolab.com.evil.com/")).toBe(false);
  });
  it("akzeptiert nur localhost als Host", () => {
    expect(isLocalHost("127.0.0.1:8787")).toBe(true);
    expect(isLocalHost("evil.com")).toBe(false);
  });
  it("verlangt das Zufallstoken", async () => {
    const app = createApp("secret");
    const h = { host: "127.0.0.1:8787" };
    expect((await app.request("/api/settings", { headers: h })).status).toBe(401);
    expect((await app.request("/api/settings", { headers: { ...h, "x-proxy-token": "nope" } })).status).toBe(401);
    expect((await app.request("/api/settings", { headers: { ...h, "x-proxy-token": "secret", origin: "https://evil.com" } })).status).toBe(403);
  });
  it("lehnt fremde Hosts im Fetch ab", async () => {
    const app = createApp("secret");
    const res = await app.request("/api/fetch", {
      method: "POST",
      headers: { host: "localhost", "x-proxy-token": "secret", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res.status).toBe(400);
  });
});
