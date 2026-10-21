import { Link } from 'react-router-dom';
import { useData } from '../lib/data.tsx';
import { CUP_LONG, CUP_SHORT, dayShort, time } from '../lib/format.ts';
import type { Match } from '../lib/types.ts';
import { Crest } from './Crest.tsx';
import { Chip, ProbBar, pcts, type Tone } from './ui.tsx';

/** Une ligne de match : équipes, score ou horaire, probabilités et badges de coupe à ± 7 jours. */
export function MatchRow({ m, showDate = false }: { m: Match; showDate?: boolean }) {
  const { predictions, cupsAround } = useData();
  const p = predictions.get(m.id);
  const played = m.status === 'finished';
  const cups = [m.h, m.a].flatMap(c => cupsAround(c, m.d).map(x => ({ ...x, c })));
  const [H, D, A] = p ? pcts(p) : [0, 0, 0];
  return (
    <Link to={`/match/${m.id}`} className="row link match-row">
      <div className="mr-teams">
        <span className="mr-side"><Crest club={m.h} size={22} /><span className={`mr-name${played && m.hg! > m.ag! ? ' win' : ''}`}>{m.h}</span></span>
        <span className="mr-mid">
          {played ? <span className="score">{m.hg}<i>–</i>{m.ag}</span>
            : m.status === 'postponed' ? <span className="small muted">reporté</span>
            : <span className="num-md">{time(m.d)}</span>}
          {showDate && <span className="tiny muted">{dayShort(m.d)}</span>}
        </span>
        <span className="mr-side end"><span className={`mr-name${played && m.ag! > m.hg! ? ' win' : ''}`}>{m.a}</span><Crest club={m.a} size={22} /></span>
      </div>
      {p && !played && (
        <>
          <ProbBar {...p} />
          <div className="mr-probs">
            <span className="num-sm accent-ink">{H} %</span>
            <span className="small muted">nul {D} %</span>
            <span className="num-sm">{A} %</span>
          </div>
        </>
      )}
      {played && m.incomplete && <span className="small muted">Feuille de match incomplète</span>}
      {cups.length > 0 && (
        <div className="mr-cups">
          {cups.map(c => (
            <Chip key={c.c + c.d} tone={c.comp as Tone} title={`${CUP_LONG[c.comp]}, ${c.stage}`}>
              {CUP_SHORT[c.comp]} {Math.abs(c.gap)} j {c.gap < 0 ? 'avant' : 'après'} · {c.c}
            </Chip>
          ))}
        </div>
      )}
    </Link>
  );
}
