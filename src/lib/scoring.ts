// Barème du Championnat des Étoiles (L'Équipe), règlement 2018-19 : dernière version publique trouvée.
import { resultOf } from './standings.ts';
import type { PlayerLog, Position } from './types.ts';

type ByPos = Record<Position, number>;

export const BAREME = {
  team: { h: { V: 8, N: 2, D: -2 }, a: { V: 12, N: 6, D: 2 }, gd: 2 },
  cleanSheet: { G: 12, D: 4, M: 0, A: 0 } as ByPos,
  /** Minutes minimum pour le bonus clean sheet. */
  cleanSheetMin: 60,
  conceded: { G: -3, D: 0, M: 0, A: 0 } as ByPos,
  goal: { G: 25, D: 18, M: 15, A: 12 } as ByPos,
  penalty: { G: 14, D: 10, M: 8, A: 6 } as ByPos,
  assist: { G: 15, D: 10, M: 8, A: 6 } as ByPos,
  tackle: { G: 3, D: 3, M: 2, A: 2 } as ByPos,
  ownGoal: -5,
  yellow: -3,
  red: -5,
  captain: { mult: 2, bonus: 20 },
  bench: 0.5,
  superSub: 3,
};

/**
 * Note L'Équipe estimée à partir de la note Sofascore r : L'Équipe note en entiers autour de 5,
 * Sofascore autour de 6,7 et plus resserrée. Non noté sous 20 minutes, comme dans le journal.
 */
export function noteLEquipe(r: number | null, min: number): number | null {
  if (r == null || min < 20) return null;
  return Math.max(1, Math.min(9, Math.round(5 + 1.5 * (r - 6.7))));
}

export interface MatchPoints {
  total: number;
  /** Résultat de l'équipe, écart et clean sheet, au prorata du temps de jeu. */
  team: number;
  /** 2 × (note − 5). */
  note: number;
  /** Buts, penalties, passes décisives, contre-son-camp. */
  actions: number;
  /** Tacles réussis et buts encaissés (gardien). */
  defense: number;
  cards: number;
  noteLE: number | null;
  /** Vrai quand la feuille de match manque : seuls actions et cartons sont comptés. */
  partial: boolean;
}

export function matchPoints(L: PlayerLog, pos: Position): MatchPoints {
  const B = BAREME;
  const actions = (L.g - L.pen) * B.goal[pos] + L.pen * B.penalty[pos] + L.a * B.assist[pos] + L.og * B.ownGoal;
  const cards = L.y * B.yellow + L.rc * B.red;
  if (!L.lu) return { total: actions + cards, team: 0, note: 0, actions, defense: 0, cards, noteLE: null, partial: true };
  const share = Math.min(1, L.min / 90);
  const res = resultOf(L.gf, L.ga);
  const side = L.home ? 'h' : 'a';
  const cs = L.ga === 0 && L.min >= B.cleanSheetMin ? B.cleanSheet[pos] : 0;
  // Le clean sheet fait partie des points d'équipe : proratisé comme eux.
  const team = (B.team[side][res] + B.team.gd * (L.gf - L.ga) + cs) * share;
  const noteLE = noteLEquipe(L.r, L.min);
  const note = noteLE == null ? 0 : 2 * (noteLE - 5);
  const defense = L.tk * B.tackle[pos] + B.conceded[pos] * L.ga * share;
  return { total: team + note + actions + defense + cards, team, note, actions, defense, cards, noteLE, partial: false };
}

/** Points d'un joueur selon son rôle dans l'équipe du jeu. */
export function gamePoints(pts: number, role: 'titulaire' | 'capitaine' | 'remplaçant' | 'supersub', entered = true): number {
  const B = BAREME;
  if (role === 'capitaine') return pts * B.captain.mult + B.captain.bonus;
  if (role === 'remplaçant') return pts * B.bench;
  if (role === 'supersub') return entered ? pts * B.superSub : 0;
  return pts;
}
