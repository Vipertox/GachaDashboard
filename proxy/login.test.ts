import { afterEach, describe, expect, it, vi } from "vitest";
import { cdpGetCookies, findBrowser, pickTokens, removeProfileLater } from "./login";

/** Minimaler DevTools-Socket: antwortet optional auf jede Anfrage mit denselben Cookies. */
class FakeSocket extends EventTarget {
  readyState: number = WebSocket.OPEN;
  sent: string[] = [];
  constructor(private reply?: (request: { id: number }) => unknown) {
    super();
  }
  send(data: string) {
    this.sent.push(data);
    const request = JSON.parse(data) as { id: number };
    if (this.reply) queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(this.reply!(request)) })));
  }
  listenerCount = 0;
  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    this.listenerCount++;
    super.addEventListener(...args);
  }
  override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
    this.listenerCount--;
    super.removeEventListener(...args);
  }
}
const asSocket = (s: FakeSocket) => s as unknown as WebSocket;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

describe("DevTools-Cookie-Abfrage", () => {
  it("liefert die Cookies der passenden Antwort und räumt die Listener auf", async () => {
    const cookies = [{ name: "ltuid_v2", value: "1", domain: ".hoyolab.com" }];
    const socket = new FakeSocket((request) => ({ id: request.id, result: { cookies } }));
    await expect(cdpGetCookies(asSocket(socket))).resolves.toEqual(cookies);
    expect(socket.listenerCount).toBe(0);
  });

  it("bricht ab, wenn die Verbindung schließt", async () => {
    const socket = new FakeSocket();
    const pending = cdpGetCookies(asSocket(socket));
    socket.dispatchEvent(new Event("close"));
    await expect(pending).rejects.toThrow("getrennt");
    expect(socket.listenerCount).toBe(0);
  });

  it("sendet nichts über einen geschlossenen Socket", async () => {
    const socket = new FakeSocket();
    socket.readyState = WebSocket.CLOSED;
    await expect(cdpGetCookies(asSocket(socket))).rejects.toThrow("getrennt");
    expect(socket.sent).toHaveLength(0);
  });

  it("bricht nach dem Timeout ab, wenn der Browser nicht antwortet", async () => {
    vi.useFakeTimers();
    const pending = cdpGetCookies(asSocket(new FakeSocket()), 5_000);
    const assertion = expect(pending).rejects.toThrow("antwortet nicht");
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("übergeht fremde und unlesbare Nachrichten", async () => {
    const socket = new FakeSocket();
    const pending = cdpGetCookies(asSocket(socket));
    const { id } = JSON.parse(socket.sent[0]) as { id: number };
    socket.dispatchEvent(new MessageEvent("message", { data: "kein JSON" }));
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ id: id + 1, result: { cookies: [] } }) }));
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ id, error: { message: "verweigert" } }) }));
    await expect(pending).rejects.toThrow("verweigert");
  });
});

describe("Aufräumen des Browserprofils", () => {
  it("lässt einen Löschfehler nicht als Ausnahme durch", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const remove = vi.fn(() => {
      throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
    });
    removeProfileLater("C:/tmp/gacha-login-test", remove);
    expect(remove).not.toHaveBeenCalled();
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(remove).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EBUSY"));
  });
});
