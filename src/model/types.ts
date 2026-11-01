export type GameId = "genshin" | "starrail" | "zzz" | "wuwa";

export const GAME_IDS: GameId[] = ["genshin", "starrail", "zzz", "wuwa"];

export interface Resource {
  label: string;
  current: number;
  max: number;
  /** Zeitpunkt, an dem die Ressource voll ist. Fehlt, wenn sie nicht regeneriert. */
  fullAt?: Date;
  /** Sekunden pro Punkt, fuer das lokale Weiterzaehlen. */
  regenSeconds?: number;
  iconKey: string;
}

export interface Task {
  label: string;
  done: number;
  total: number;
  iconKey?: string;
}

export interface Countdown {
  label: string;
  readyAt: Date;
  iconUrl?: string;
}

export interface Flag {
  label: string;
  done: boolean;
  text?: string;
}

/** Fester Kennwert ohne Fortschritt, z. B. "Union-Stufe: 80". */
export interface Fact {
  label: string;
  value: string;
}

export interface DetailSection {
  kind: "daily" | "weekly" | "running" | "other" | "collection" | "account";
  resources: Resource[];
  tasks: Task[];
  flags: Flag[];
  timers: Countdown[];
  facts: Fact[];
}

export interface GameStatus {
  game: GameId;
  uid: string;
  nickname: string;
  primary: Resource;
  secondary: Resource[];
  tasks: Task[];
  sections: DetailSection[];
  /** Anzahl der Figuren, wenn das Spiel keine Figurendaten liefert (Wuthering Waves). */
  characterCount?: number;
  fetchedAt: Date;
}

export interface Stat {
  /** Schlüssel für Sortierung und Vergleich, z. B. die property_type-ID oder der Name. */
  key: string;
  label: string;
  /** Fertig formatiert, z. B. "62,4%". */
  value: string;
  /** Anzahl der Erhöhungen bei Nebenwerten. */
  rolls?: number;
}

export interface Weapon {
  name: string;
  iconUrl?: string;
  rarity: number;
  level: number;
  /** 1–5, Präfix aus GameTerms. */
  refinement: number;
  mainStat?: Stat;
  subStat?: Stat;
}

export interface GearPiece {
  /** 1-basiert, Reihenfolge wie im Spiel. */
  slot: number;
  name: string;
  setName?: string;
  iconUrl?: string;
  rarity: number;
  level: number;
  maxLevel: number;
  mainStat?: Stat;
  subStats: Stat[];
}

export interface GearSet {
  name: string;
  /** Angelegte Teile. */
  count: number;
  /** Teilezahlen der Boni mit Text, z. B. 2 und 4. */
  bonuses: { pieces: number; text?: string }[];
}

export interface CharacterSummary {
  id: string;
  name: string;
  /** Schlüssel, z. B. "pyro", für Farbe und Filter. */
  element: string;
  /** Pfad (Star Rail) oder Rolle (ZZZ). */
  role?: string;
  rarity: number;
  level: number;
  /** Konstellation, Eidolon, Mindscape: 0–6. */
  dupes: number;
  iconUrl?: string;
  weapon?: Pick<Weapon, "name" | "iconUrl" | "rarity" | "refinement">;
}

export interface Skill {
  label: string;
  level: number;
}

export interface Character extends CharacterSummary {
  imageUrl?: string;
  weapon?: Weapon;
  gear: GearPiece[];
  sets: GearSet[];
  skills: Skill[];
  /** Wichtigste Werte zuerst, die übrigen erscheinen erst nach dem Aufklappen. */
  stats: Stat[];
  moreStats: Stat[];
  companion?: { name: string; iconUrl?: string };
}

export interface Roster {
  characters: CharacterSummary[];
  /** Wenn die Liste schon alle Details enthält (Star Rail). */
  details?: Character[];
}

export interface CharacterAdapter {
  game: GameId;
  /** Details aller Figuren nach der Liste vorladen; sonst erst beim Antippen einer Figur. */
  prefetchDetails: boolean;
  fetchRoster(account: Account, signal?: AbortSignal): Promise<Roster>;
  fetchDetails(account: Account, ids: string[], signal?: AbortSignal): Promise<Character[]>;
}

export type ChallengePeriod = "current" | "previous";

/** Stand eines wiederkehrenden Endgame-Modus in einer Periode, z. B. Spiral Abyss oder Pure Fiction. */
export interface Challenge {
  /** Name der Saison, sofern die API ihn liefert. */
  season?: string;
  start?: Date;
  end?: Date;
  /** `locked`: Modus nicht freigeschaltet, `empty`: in dieser Periode nicht gespielt. */
  state: "ok" | "locked" | "empty";
  progress?: { current: number; max: number; unit: string };
  /** Kurzform für die Übersicht, z. B. "30/36 Sterne". */
  summary?: string;
  facts: Fact[];
}

export interface ChallengeMode {
  key: string;
  label: string;
  fetch(account: Account, period: ChallengePeriod, signal?: AbortSignal): Promise<Challenge>;
}

export interface GameTerms {
  character: string;
  characters: string;
  dupePrefix: string;
  weapon: string;
  refinePrefix: string;
  gear: string;
  skills: string;
  /** Platznamen in Spielreihenfolge. */
  slots: string[];
  /** `short` ersetzt den Anfangsbuchstaben, wenn sich zwei Elemente einen teilen. */
  elements: Record<string, { label: string; color: string; short?: string }>;
  roleLabel?: string;
  roles?: Record<string, string>;
}

export interface GameMeta {
  game: GameId;
  name: string;
  iconKey: string;
  artworkKey: string;
  accentColor: string;
}

/** Zugangsdaten und Konto fuer genau einen Abruf. */
export interface Account {
  profileId: string;
  game: GameId;
  uid: string;
  region: string;
  nickname?: string;
  ltuid?: string;
  ltoken?: string;
  oauthCode?: string;
}

export interface GameAdapter {
  game: GameId;
  fetchStatus(account: Account, signal?: AbortSignal): Promise<GameStatus>;
}

export interface GameAccountRef {
  game: GameId;
  uid: string;
  region: string;
  nickname?: string;
  visible: boolean;
  order: number;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  games: GameAccountRef[];
}

export interface ProfileState {
  profiles: Profile[];
  activeProfileId: string;
}

export interface AppSettings {
  refreshMinutes: number;
  theme: "system" | "light" | "dark";
}

export const DEFAULT_SETTINGS: AppSettings = { refreshMinutes: 10, theme: "system" };
