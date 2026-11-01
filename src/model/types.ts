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

export interface DetailSection {
  kind: "daily" | "weekly" | "running" | "other";
  resources: Resource[];
  tasks: Task[];
  flags: Flag[];
  timers: Countdown[];
}

export interface GameStatus {
  game: GameId;
  uid: string;
  nickname: string;
  primary: Resource;
  secondary: Resource[];
  tasks: Task[];
  sections: DetailSection[];
  fetchedAt: Date;
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
