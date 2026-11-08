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
  /** Nom complet, date de naissance (AAAA-MM-JJ), nationalité (code pays), taille en cm. */
  full?: string;
  dob?: string;
  nat?: string;
  h?: number;
}

/** Palmarès : titres par joueur (TheSportsDB) et par club (Wikidata). */
export interface Honour { title: string; season: string; team?: string }
export interface ClubTitle { comp: string; seasons: string[] }
/** Prix du Championnat des Étoiles (en étoiles), moyenne de points et % de sélection dans le jeu. */
export interface PrixFile { updatedAt: string; players: Record<string, { prix: number; moy: number | null; sel: number | null }> }
/** Joueur parti de son club de L1 (club actuel d'après Wikidata ; null : sans club connu). */
export interface Move { team: string | null; since?: string }
export interface PalmaresFile {
  updatedAt: string;
  players: Record<string, Honour[]>;
  clubs: Record<string, ClubTitle[]>;
  moves?: Record<string, Move>;
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

/** Feuille de match : compositions, remplacements, cartons (fichier sheets.json, chargé à la demande). */
export interface SheetPlayer {
  id: number;
  n: string;
  num?: number;
  pos: Position;
  /** Minutes jouées (0 : remplaçant non entré). */
  min: number;
  r: number | null;
  g: number;
  a: number;
  og: number;
  y: number;
  rc: number;
  /** Minute d'entrée en jeu ou de sortie. */
  in?: number;
  out?: number;
}
export interface SheetSide {
  formation?: string;
  /** Couleurs du maillot (fond, numéro). */
  color?: string;
  ink?: string;
  /** Titulaires dans l'ordre Sofascore : gardien, puis chaque ligne de droite à gauche. */
  xi: SheetPlayer[];
  bench: SheetPlayer[];
}
export interface SheetEvent {
  min: number;
  home: boolean;
  kind: 'goal' | 'pen' | 'og' | 'yellow' | 'red' | 'sub';
  player: string;
  /** Passeur (but) ou joueur sorti (remplacement). */
  other?: string;
}
export interface MatchSheet {
  home?: SheetSide;
  away?: SheetSide;
  events: SheetEvent[];
}
export type SheetsFile = Record<string, MatchSheet>;

/** Historique : une saison = liste compacte [journée, date, domicile, extérieur, buts dom., buts ext.]. */
export type HistoryRow = [number, string, string, string, number, number];
export interface HistoryFile {
  seasons: { s: string; m: HistoryRow[] }[];
}

export interface MetaFile {
  /** Dernière mise à jour, complète ou des seuls scores. */
  updatedAt: string;
  /** Dernière mise à jour complète (absente : updatedAt). */
  fullAt?: string;
  /** « scores » : seuls les matchs qui venaient de finir ont été récupérés. */
  kind?: 'full' | 'scores';
  season: string;
  lastRound: number;
  nextRound: number | null;
  sources: Record<string, string>;
  warnings: string[];
}
