import { Link } from 'react-router-dom';
import { useData } from '../lib/data.tsx';
import { CUP_LONG, CUP_SHORT, dayShort, time } from '../lib/format.ts';
import type { Match } from '../lib/types.ts';
import { Crest } from './Crest.tsx';
import { pcts } from './ui.tsx';

/**
 * Une ligne de match sur deux rangées : équipes et score (ou horaire), puis les probabilités alignées
 * sous chaque issue. Une coupe à ± 7 jours s'affiche en petite étiquette sous le club concerné.
 */
export function MatchRow({ m, showDate = false }: { m: Match; showDate?: boolean }) {
  const { predictions, cupsAround } = useData();
  const p = predictions.get(m.id);
  const played = m.status === 'finished';
  const [H, D, A] = p ? pcts(p) : [0, 0, 0];
  const fav = Math.max(H, D, A);
  const tags = (club: string) => cupsAround(club, m.d).map(c => (
    <span key={c.d} className={`cup-tag t-${c.comp}`} title={`${CUP_LONG[c.comp]}, ${c.stage}, ${Math.abs(c.gap)} jours ${c.gap < 0 ? 'avant' : 'après'}`}>
      {CUP_SHORT[c.comp]} {c.gap < 0 ? '−' : '+'}{Math.abs(c.gap)} j
    </span>
  ));
  const side = (club: string, win: boolean, end = false) => (
    <span className={`mr-side${end ? ' end' : ''}`}>
      {!end && <Crest club={club} size={22} />}
      <span className="mr-name-col">
        <span className={`mr-name${win ? ' win' : ''}`}>{club}</span>
        <span className="mr-tags">{tags(club)}</span>
      </span>
      {end && <Crest club={club} size={22} />}
    </span>
  );
  const label = `${m.h} contre ${m.a}, ${played ? `${m.hg} à ${m.ag}` : `${dayShort(m.d)} ${time(m.d)}`}${p && !played ? `, victoire ${m.h} ${H} %, nul ${D} %, victoire ${m.a} ${A} %` : ''}`;
  return (
    <Link to={`/match/${m.id}`} className="row link match-row" aria-label={label}>
      <div className="mr-teams">
        {side(m.h, played && m.hg! > m.ag!)}
        <span className="mr-mid">
          {played ? <span className="score">{m.hg}<i>–</i>{m.ag}</span>
            : m.status === 'postponed' ? <span className="small muted">reporté</span>
            : <span className="num-md">{time(m.d)}</span>}
          {showDate && <span className="tiny muted">{dayShort(m.d)}</span>}
        </span>
        {side(m.a, played && m.ag! > m.hg!, true)}
      </div>
      {p && !played && (
        <div className="mr-probs" aria-hidden="true">
          <span className={H === fav ? 'fav' : ''}>{H} %</span>
          <span className={`mid${D === fav ? ' fav' : ''}`}>nul {D} %</span>
          <span className={`end${A === fav ? ' fav' : ''}`}>{A} %</span>
        </div>
      )}
      {played && m.incomplete && <span className="tiny muted">Feuille de match incomplète</span>}
    </Link>
  );
}
