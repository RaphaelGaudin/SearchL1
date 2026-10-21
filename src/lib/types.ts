// Formats des fichiers JSON de public/data, partagés par les scripts et l'app.

export type Position = 'G' | 'D' | 'M' | 'A';
export type CupCode = 'LDC' | 'LE' | 'LC' | 'CDF';

/** Un match de L1 de la saison en cours. Dates en ISO UTC. */
export interface Match {
  id: number;
  j: number;
  d: string;
  h: string;
  a: string;
  hg: number | null;
  ag: number | null;
  status: 'notstarted' | 'finished' | 'postponed' | 'live' | 'canceled';
  /** Vrai quand la feuille de match (compositions ou stats) manque ou ne colle pas au score. */
  incomplete?: boolean;
  /** Buteurs et passeurs, dans l'ordre du match. */
  goals?: GoalEvent[];
}

export interface GoalEvent {
  min: number;
  home: boolean;
  scorer: string;
  assist?: string;
  kind: 'regular' | 'penalty' | 'own';
}

/** Une ligne de stats d'un joueur pour un match de L1. */
export interface PlayerLog {
  j: number;
  match: number;
  home: boolean;
  /** Buts pour / contre de son équipe sur le match. */
  gf: number;
  ga: number;
  /** Faux si la feuille de match est incomplète : seuls buts et cartons sont fiables. */
  lu: boolean;
  sub: boolean;
  min: number;
  /** Note Sofascore (null si non noté). */
  r: number | null;
  g: number;
  pen: number;
  a: number;
  og: number;
  y: number;
  rc: number;
  tk: number;
  int: number;
  kp: number;
  xg: number;
  xa: number;
  sav: number;
  gp: number;
}

export interface Player {
  id: number;
  n: string;
  club: string;
  pos: Position;
  logs: PlayerLog[];
}

export interface Absence {
  club: string;
  player: string;
  playerId?: number;
  type: 'B' | 'S' | 'D' | 'C';
  why: string;
  /** Date de retour prévue (ISO), si la source la donne. */
  until?: string;
  source: string;
}

export interface CupMatch {
  club: string;
  comp: CupCode;
  d: string;
  stage: string;
  opp: string | null;
  home: boolean | null;
  gf: number | null;
  ga: number | null;
  /** Adversaire pas encore tiré au sort. */
  tbd?: boolean;
  /** Vrai si le club a été éliminé sur ce match. */
  out?: boolean;
}

export interface SeasonFile {
  season: string;
  matches: Match[];
  players: Player[];
  absences: Absence[];
  cups: CupMatch[];
}

/** Historique : une saison = liste compacte [journée, date, domicile, extérieur, buts dom., buts ext.]. */
export type HistoryRow = [number, string, string, string, number, number];
export interface HistoryFile {
  seasons: { s: string; m: HistoryRow[] }[];
}

export interface MetaFile {
  updatedAt: string;
  season: string;
  lastRound: number;
  nextRound: number | null;
  sources: Record<string, string>;
  warnings: string[];
}
