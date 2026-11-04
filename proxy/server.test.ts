import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp, isAllowedUrl, isLocalHost, writePrivateFile } from "./server";

describe("Proxy-Sicherheit", () => {
  it("erlaubt nur bekannte https-Hosts", () => {
    expect(isAllowedUrl("https://bbs-api-os.hoyolab.com/x")).toBe(true);
    expect(isAllowedUrl("http://bbs-api-os.hoyolab.com/x")).toBe(false);
    expect(isAllowedUrl("https://wutheringwaves.fandom.com/api.php?action=query")).toBe(true);
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

describe("Security-Header", () => {
  const h = { host: "127.0.0.1:8787" };

  it("setzt CSP, Einbettungsverbot und nosniff auf Seite und API", async () => {
    const app = createApp("secret");
    for (const res of [
      await app.request("/", { headers: h }),
      await app.request("/api/settings", { headers: { ...h, "x-proxy-token": "secret" } }),
      await app.request("/api/settings", { headers: h }),
    ]) {
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("strict-transport-security")).toBeNull();
    }
  });
});

describe("Private Dateien", () => {
  it.skipIf(process.platform === "win32")("sind nur für den eigenen Benutzer lesbar, auch wenn sie schon existierten", () => {
    const dir = mkdtempSync(join(tmpdir(), "gacha-proxy-test-"));
    try {
      const file = join(dir, "token");
      writeFileSync(file, "alt", { mode: 0o644 });
      writePrivateFile(file, "neu");
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(readFileSync(file, "utf8")).toBe("neu");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
