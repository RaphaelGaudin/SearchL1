import { Crest } from '../components/Crest.tsx';
import { LargeTitle, NavBar, Star } from '../components/Glass.tsx';
import { Form, Group, Row } from '../components/ui.tsx';
import { clubByName } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { useFavorites } from '../lib/favorites.ts';

export function Teams() {
  const d = useData();
  const fav = useFavorites();
  return (
    <div className="page">
      <NavBar title="Équipes" back="Plus" fallback="/" />
      <LargeTitle sub="Touchez l'étoile pour ajouter un club à vos favoris">Équipes</LargeTitle>
      <Group>
        {[...d.table].sort((a, b) => a.club.localeCompare(b.club, 'fr')).map(r => (
          <div key={r.club} className="row-with-action">
            <Row to={`/club/${encodeURIComponent(r.club)}`}>
              <Crest club={r.club} size={30} />
              <span className="grow ellipsis"><span className="strong">{r.club}</span><small className="muted block">{clubByName.get(r.club)?.full} · {r.rank}{r.rank === 1 ? 'er' : 'e'} · {r.pts} pts</small></span>
              <Form results={r.form} n={3} />
            </Row>
            <button className={`star-btn${fav.isClub(r.club) ? ' on' : ''}`} onClick={() => fav.toggleClub(r.club)} aria-pressed={fav.isClub(r.club)}
              aria-label={fav.isClub(r.club) ? `Retirer ${r.club} des favoris` : `Ajouter ${r.club} aux favoris`}><Star filled={fav.isClub(r.club)} /></button>
          </div>
        ))}
      </Group>
    </div>
  );
}
