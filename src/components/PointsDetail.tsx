import { num } from '../lib/format.ts';
import type { ScoredLog } from '../lib/model.ts';
import type { Position } from '../lib/types.ts';

/** Détail des points d'un match, source par source. */
export function PointsDetail({ L, pos }: { L: ScoredLog; pos: Position }) {
  if (L.P.partial) return <p className="small muted detail-pad">Feuille de match incomplète : seuls buts, passes et cartons sont comptés ({num(L.P.total, 0)} pts).</p>;
  return (
    <dl className="kv detail">
      <div><dt>Équipe (résultat, écart{L.ga === 0 && L.min >= 60 && (pos === 'G' || pos === 'D') ? ', clean sheet' : ''}) · {L.min}'</dt><dd>{num(L.P.team, 1)}</dd></div>
      <div><dt>Note L'Équipe estimée {L.P.noteLE ?? 'n.n.'} (Sofascore {L.r != null ? num(L.r) : '—'})</dt><dd>{num(L.P.note, 0)}</dd></div>
      <div><dt>Actions ({L.g} but{L.g > 1 ? 's' : ''}{L.pen ? ` dont ${L.pen} pen.` : ''}, {L.a} passe{L.a > 1 ? 's' : ''}{L.og ? `, ${L.og} csc` : ''})</dt><dd>{num(L.P.actions, 0)}</dd></div>
      <div><dt>Défense ({L.tk} tacle{L.tk > 1 ? 's' : ''} réussi{L.tk > 1 ? 's' : ''}{pos === 'G' ? `, ${L.ga} encaissé${L.ga > 1 ? 's' : ''}` : ''})</dt><dd>{num(L.P.defense, 1)}</dd></div>
      <div><dt>Cartons{L.y ? ` (${L.y} jaune)` : ''}{L.rc ? ' (rouge)' : ''}</dt><dd>{num(L.P.cards, 0)}</dd></div>
    </dl>
  );
}
