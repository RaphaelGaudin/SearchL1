import { Link } from 'react-router-dom';
import { LargeTitle, NavBar } from '../components/Glass.tsx';
import { Card } from '../components/ui.tsx';

export function Soon({ title, what }: { title: string; what: string }) {
  return (
    <div className="page">
      <NavBar title={title} back="Retour" fallback="/" />
      <LargeTitle>{title}</LargeTitle>
      <Card>
        <p>{what} : prochaine étape.</p>
        <p className="small muted">En attendant, la recherche et la saison de chaque club sont dans l'onglet Matchs.</p>
        <Link to="/matchs" className="textlink">Aller aux matchs ›</Link>
      </Card>
    </div>
  );
}
