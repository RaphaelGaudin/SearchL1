import { LargeTitle, NavBar, SuperSubBadge } from '../components/Glass.tsx';
import { Card, Group, Row, Section } from '../components/ui.tsx';
import { BAREME } from '../lib/scoring.ts';

const POS = ['G', 'D', 'M', 'A'] as const;

export function Bareme() {
  const B = BAREME;
  const line = (label: string, v: Record<(typeof POS)[number], number>) => (
    <tr><td className="l">{label}</td>{POS.map(p => <td key={p}>{v[p] > 0 ? '+' : ''}{v[p]}</td>)}</tr>
  );
  return (
    <div className="page">
      <NavBar title="Calcul des points" back="Plus" fallback="/" />
      <LargeTitle>Calcul des points</LargeTitle>
      <p className="small muted">Barème du Championnat des Étoiles (L'Équipe), règlement 2018-19 : dernière version publique trouvée. Les points affichés dans l'app sont des estimations.</p>
      <Section title="Points d'équipe" meta="au prorata des minutes / 90">
        <Group>
          <Row><span className="grow">Domicile : victoire / nul / défaite</span><span className="num-sm">{B.team.h.V} / {B.team.h.N} / {B.team.h.D}</span></Row>
          <Row><span className="grow">Extérieur : victoire / nul / défaite</span><span className="num-sm">{B.team.a.V} / {B.team.a.N} / {B.team.a.D}</span></Row>
          <Row><span className="grow">Par but d'écart</span><span className="num-sm">± {B.team.gd}</span></Row>
          <Row><span className="grow">Clean sheet (60 min minimum) : gardien / défenseur</span><span className="num-sm">{B.cleanSheet.G} / {B.cleanSheet.D}</span></Row>
        </Group>
      </Section>
      <Section title="Points joueur">
        <Card className="flush">
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th className="l">Action</th><th>G</th><th>D</th><th>M</th><th>A</th></tr></thead>
              <tbody>
                {line('But', B.goal)}
                {line('But sur penalty', B.penalty)}
                {line('Passe décisive', B.assist)}
                {line('Tacle réussi', B.tackle)}
                {line('But encaissé', B.conceded)}
              </tbody>
            </table>
          </div>
        </Card>
        <Group>
          <Row><span className="grow">Note L'Équipe : 2 × (note − 5), non noté sous 20 min = 0</span></Row>
          <Row><span className="grow">Contre-son-camp / jaune / rouge</span><span className="num-sm">{B.ownGoal} / {B.yellow} / {B.red}</span></Row>
        </Group>
      </Section>
      <Section title="Note L'Équipe estimée">
        <Card><p className="small">On ne dispose que de la note Sofascore r. Estimation : note = arrondi de 5 + 1,5 × (r − 6,7), bornée entre 1 et 9, sans note sous 20 minutes de jeu.</p></Card>
      </Section>
      <Section title="Bonus du jeu">
        <Group>
          <Row><span className="grow">Capitaine</span><span className="num-sm">× {B.captain.mult} + {B.captain.bonus}</span></Row>
          <Row><span className="grow">Remplaçant</span><span className="num-sm">× ½</span></Row>
          <Row><span className="grow">SuperSub, s'il entre en jeu</span><span className="num-sm">× {B.superSub}</span></Row>
        </Group>
        <Card><p className="small"><SuperSubBadge small /> L'éclair signale un bon supersub : au moins 2 entrées en jeu et une moyenne par entrée parmi les 10 % meilleures de L1 (6 points minimum).</p></Card>
      </Section>
    </div>
  );
}
