import { useEffect, useState } from "react";
import { ApiError, ERROR_TEXT } from "../../api/errors";
import { fetchGameRoles } from "../../api/hoyolab";
import { queryPlayerInfo } from "../../api/kuro";
import { loadSecrets } from "../../credentials";
import { btn, btnPrimary, fieldCls, fieldStyle } from "../../components/ui";
import { hoyolabWebviewLogin, isWindowsApp, readLauncherCode } from "../../lib/native";
import { GAME_META } from "../../model/games";
import type { GameAccountRef, GameId, Profile } from "../../model/types";
import { useApp } from "../../app/state";

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const HOYO_GAMES: GameId[] = ["genshin", "starrail", "zzz"];

type FoundAccount = { game: GameId; uid: string; region: string; nickname?: string };

/** Ersetzt die Konten der Spiele in `replace` durch die gefundenen; Sichtbarkeit und Reihenfolge bleiben erhalten. */
export function mergeGames(cur: GameAccountRef[], found: FoundAccount[], replace: GameId[]): GameAccountRef[] {
  const kept = cur.filter((g) => !replace.includes(g.game));
  const added = found.map((f, i): GameAccountRef => {
    const old = cur.find((g) => g.game === f.game && g.uid === f.uid);
    return old
      ? { ...old, region: f.region, nickname: f.nickname ?? old.nickname }
      : { game: f.game, uid: f.uid, region: f.region, nickname: f.nickname, visible: true, order: cur.length + i };
  });
  return [...kept, ...added].sort((a, b) => a.order - b.order).map((g, i) => ({ ...g, order: i }));
}

const sameAccount = (a: GameAccountRef, b: GameAccountRef) => a.game === b.game && a.uid === b.uid;

function describe(e: unknown): string {
  if (e instanceof ApiError) return `${ERROR_TEXT[e.kind]}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block space-y-1">
      <span className="text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <div className="flex gap-2">
        <input
          className={fieldCls}
          style={fieldStyle}
          type={show ? "text" : "password"}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        <button type="button" className={btn} style={{ background: "var(--surface-2)" }} onClick={() => setShow(!show)}>
          {show ? "Verbergen" : "Anzeigen"}
        </button>
      </div>
    </label>
  );
}

export function ProfileEditor({
  profile,
  onDone,
  onCancel,
}: {
  profile?: Profile;
  onDone: (created: boolean) => void;
  onCancel: () => void;
}) {
  const { saveProfile } = useApp();
  const [id] = useState(() => profile?.id ?? crypto.randomUUID());
  const [name, setName] = useState(profile?.name ?? "");
  const [color, setColor] = useState(profile?.color ?? COLORS[0]);
  const [ltuid, setLtuid] = useState("");
  const [ltoken, setLtoken] = useState("");
  const [kuro, setKuro] = useState("");
  // Zuletzt erfolgreich geprüfte Werte; "Profil speichern" prüft nur, was sich seitdem geändert hat.
  const [checkedHoyo, setCheckedHoyo] = useState("");
  const [checkedKuro, setCheckedKuro] = useState("");
  const [games, setGames] = useState<GameAccountRef[]>(profile?.games ?? []);
  const [loading, setLoading] = useState(!!profile);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    if (!profile) return;
    loadSecrets(profile.id)
      .then((s) => {
        setLtuid(s.ltuid);
        setLtoken(s.ltoken);
        setKuro(s.kuroOauth);
        setCheckedHoyo(`${s.ltuid}|${s.ltoken}`);
        setCheckedKuro(s.kuroOauth);
      })
      .catch((e) => setMessage({ ok: false, text: describe(e) }))
      .finally(() => setLoading(false));
  }, [profile]);

  const hoyoKey = `${ltuid}|${ltoken}`;
  const hasHoyo = !!ltuid && !!ltoken;

  /** Busy-Anzeige, Meldung und Fehlertext für alle Schaltflächen gleich. */
  const run = async (what: string, action: () => Promise<string | void>) => {
    setBusy(what);
    setMessage(undefined);
    try {
      const text = await action();
      if (text) setMessage({ ok: true, text });
    } catch (e) {
      setMessage({ ok: false, text: describe(e) });
    } finally {
      setBusy(undefined);
    }
  };

  const verifyHoyo = async (cur: GameAccountRef[]) => {
    const roles = await fetchGameRoles({ ltuid, ltoken });
    setCheckedHoyo(hoyoKey);
    const text = roles.length
      ? `Gefunden: ${roles.map((r) => `${GAME_META[r.game].name} (${r.nickname}, ${r.uid})`).join(", ")}`
      : "Anmeldung gültig, aber keine Spielkonten verknüpft.";
    return { games: mergeGames(cur, roles, HOYO_GAMES), text };
  };

  const verifyKuro = async (cur: GameAccountRef[]) => {
    const player = await queryPlayerInfo(kuro);
    setCheckedKuro(kuro);
    return {
      games: mergeGames(cur, [{ game: "wuwa", uid: player.playerId, region: player.region }], ["wuwa"]),
      text: `Wuthering Waves: Spieler-ID ${player.playerId}, Server ${player.region}`,
    };
  };

  const checkHoyo = () =>
    run("hoyo", async () => {
      const r = await verifyHoyo(games);
      setGames(r.games);
      return r.text;
    });

  const checkKuro = () =>
    run("kuro", async () => {
      const r = await verifyKuro(games);
      setGames(r.games);
      return r.text;
    });

  const webviewLogin = () =>
    run("login", async () => {
      const t = await hoyolabWebviewLogin();
      setLtuid(t.ltuid);
      setLtoken(t.ltoken);
      return "Tokens übernommen. Jetzt prüfen und speichern.";
    });

  const fromLauncher = () =>
    run("launcher", async () => {
      setKuro(await readLauncherCode());
      return "Kuro-Code aus dem Launcher übernommen.";
    });

  const move = (idx: number, dir: -1 | 1) =>
    setGames((cur) => {
      const next = [...cur].sort((a, b) => a.order - b.order);
      const j = idx + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((g, i) => ({ ...g, order: i }));
    });

  // Laut Konzept prüft die App die Tokens beim Speichern; ungültige Tokens werden nicht gespeichert.
  const save = () =>
    run("save", async () => {
      let next = games;
      if (hasHoyo && hoyoKey !== checkedHoyo) next = (await verifyHoyo(next)).games;
      if (kuro && kuro !== checkedKuro) next = (await verifyKuro(next)).games;
      setGames(next);
      await saveProfile({ id, name: name.trim() || "Profil", color, games: next }, { ltuid, ltoken, kuroOauth: kuro });
      onDone(!profile);
    });

  const sorted = [...games].sort((a, b) => a.order - b.order);

  if (loading) return <p>Lade …</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{profile ? "Profil bearbeiten" : "Profil anlegen"}</h1>

      <label className="block space-y-1">
        <span className="text-sm" style={{ color: "var(--muted)" }}>Name</span>
        <input className={fieldCls} style={fieldStyle} value={name} placeholder="Hauptkonto" onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="space-y-1">
        <span className="text-sm" style={{ color: "var(--muted)" }}>Farbe</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Farbe ${c}`}
              onClick={() => setColor(c)}
              className="w-11 h-11 rounded-full"
              style={{ background: c, outline: color === c ? "3px solid var(--text)" : "none", outlineOffset: 2 }}
            />
          ))}
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold mb-1">HoYoLAB</legend>
        <SecretField label="ltuid_v2" value={ltuid} onChange={setLtuid} />
        <SecretField label="ltoken_v2" value={ltoken} onChange={setLtoken} />
        <div className="flex flex-wrap gap-2">
          <button className={btn} style={{ background: "var(--surface-2)" }} disabled={!!busy} onClick={webviewLogin}>
            {busy === "login" ? "Warte auf Anmeldung …" : "Mit HoYoLAB anmelden"}
          </button>
          <button className={btn} style={{ background: "var(--surface-2)" }} disabled={!hasHoyo || !!busy} onClick={checkHoyo}>
            {busy === "hoyo" ? "Prüfe …" : "Prüfen"}
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold mb-1">Wuthering Waves (optional)</legend>
        <SecretField label="Kuro-Code (oauthCode)" value={kuro} onChange={setKuro} />
        <div className="flex flex-wrap gap-2">
          {isWindowsApp() && (
            <button className={btn} style={{ background: "var(--surface-2)" }} disabled={!!busy} onClick={fromLauncher}>
              Aus Launcher übernehmen
            </button>
          )}
          <button className={btn} style={{ background: "var(--surface-2)" }} disabled={!kuro || !!busy} onClick={checkKuro}>
            {busy === "kuro" ? "Prüfe …" : "Prüfen"}
          </button>
        </div>
      </fieldset>

      {message && (
        <p className="text-sm rounded-xl p-3" style={{ background: "var(--surface-2)", color: message.ok ? "var(--color-ok)" : "var(--color-danger)" }}>
          {message.text}
        </p>
      )}

      {sorted.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="font-semibold mb-1">Spiele und Reihenfolge</legend>
          {sorted.map((g, i) => (
            <div key={`${g.game}-${g.uid}`} className="flex items-center gap-2 rounded-xl px-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <label className="flex items-center gap-3 flex-1 min-h-11">
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={g.visible}
                  onChange={(e) => setGames((cur) => cur.map((x) => (sameAccount(x, g) ? { ...x, visible: e.target.checked } : x)))}
                />
                <span className="truncate">
                  {GAME_META[g.game].name} <span style={{ color: "var(--muted)" }}>{g.uid}</span>
                </span>
              </label>
              <button className={btn} aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className={btn} aria-label="Nach unten" disabled={i === sorted.length - 1} onClick={() => move(i, 1)}>↓</button>
            </div>
          ))}
        </fieldset>
      )}

      <div className="flex gap-2">
        <button className={btnPrimary} disabled={!!busy} onClick={save}>
          {busy === "save" ? "Speichere …" : "Profil speichern"}
        </button>
        <button className={btn} style={{ background: "var(--surface-2)" }} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Alle Token-Felder sind optional und können später unter Konten nachgetragen werden. Tokens liegen nur im sicheren Speicher, nie in der Einstellungsdatei. Hat ein Login mehrere Server, wird das erste Konto je Spiel verwendet.
      </p>
    </div>
  );
}
