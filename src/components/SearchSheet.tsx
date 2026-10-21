import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLUBS } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { dayShort, norm, num, POSITION } from '../lib/format.ts';
import { Crest } from './Crest.tsx';
import { Icon } from './Icon.tsx';

type Hit = { key: string; to: string; title: string; sub: string; club?: string };

/** Recherche globale : clubs, joueurs, matchs. */
export function SearchSheet({ onClose }: { onClose: () => void }) {
  const { players, matches } = useData();
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const hits = useMemo<Hit[]>(() => {
    const s = norm(q.trim());
    if (s.length < 2) return [];
    const words = s.split(/\s+/);
    const has = (txt: string) => words.every(w => norm(txt).includes(w));
    const clubs: Hit[] = CLUBS.filter(c => has(`${c.name} ${c.full} ${c.abbr}`)).map(c => ({ key: 'c' + c.name, to: `/club/${encodeURIComponent(c.name)}`, title: c.name, sub: c.full, club: c.name }));
    const ps: Hit[] = players.filter(p => p.apps > 0 && has(p.n)).sort((a, b) => b.pts - a.pts).slice(0, 12)
      .map(p => ({ key: 'p' + p.id, to: `/joueur/${p.id}`, title: p.n, sub: `${POSITION[p.pos]} · ${p.club} · ${num(p.ptsAvg)} pts/match`, club: p.club }));
    const ms: Hit[] = words.length >= 1 ? matches.filter(m => has(`${m.h} ${m.a}`) && (words.length > 1 || clubs.length)).slice(0, 8)
      .map(m => ({ key: 'm' + m.id, to: `/match/${m.id}`, title: `${m.h} – ${m.a}`, sub: `J${m.j} · ${m.hg != null ? `${m.hg}-${m.ag}` : dayShort(m.d)}` })) : [];
    return [...clubs, ...ps, ...ms];
  }, [q, players, matches]);

  const go = (h: Hit) => { onClose(); navigate(h.to); };
  return (
    <div className="sheet-backdrop top" onClick={onClose}>
      <div className="search" role="dialog" aria-label="Recherche" onClick={e => e.stopPropagation()}>
        <div className="search-head">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input ref={input} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Joueur, club ou match"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go"
              onKeyDown={e => { if (e.key === 'Enter' && hits[0]) go(hits[0]); }} />
          </label>
          <button className="textbtn" onClick={onClose}>Annuler</button>
        </div>
        <div className="search-res">
          {q.trim().length >= 2 && !hits.length && <p className="muted small pad">Aucun résultat.</p>}
          {hits.length > 0 && (
            <div className="group">
              {hits.map(h => (
                <button key={h.key} className="row link" onClick={() => go(h)}>
                  {h.club ? <Crest club={h.club} size={22} /> : <Icon name="calendar" size={20} />}
                  <span className="grow">{h.title}<small className="muted block">{h.sub}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
