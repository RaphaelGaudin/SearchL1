import { ageOf } from '../lib/age.ts';
import type { ClubTitle, Honour, Player } from '../lib/types.ts';
import { Empty, Group } from './ui.tsx';

const REGION = (() => { try { return new Intl.DisplayNames(['fr'], { type: 'region' }); } catch { return null; } })();

/** Ligne « 30 ans · Brésil · 1,83 m » sous le nom du joueur. */
export function PlayerProfile({ p }: { p: Player }) {
  const bits: string[] = [];
  if (p.dob) bits.push(`${ageOf(p.dob)} ans`);
  if (p.nat) bits.push(REGION?.of(p.nat) ?? p.nat);
  if (p.h) bits.push(`${(p.h / 100).toFixed(2).replace('.', ',')} m`);
  if (!bits.length) return null;
  const born = p.dob ? new Date(p.dob + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return <span className="profile-line small muted" title={born ? `Né le ${born}` : undefined}>{bits.join(' · ')}</span>;
}

/** Titres d'un joueur, regroupés par trophée (le plus récent d'abord). */
export function PlayerPalmares({ honours }: { honours: Honour[] | undefined }) {
  if (!honours?.length) return <Empty>Aucun titre recensé pour ce joueur.</Empty>;
  const by = new Map<string, Honour[]>();
  for (const h of honours) by.set(h.title, [...(by.get(h.title) ?? []), h]);
  const groups = [...by.entries()]
    .map(([title, list]) => ({ title, list: list.sort((a, b) => b.season.localeCompare(a.season)) }))
    .sort((a, b) => b.list.length - a.list.length || b.list[0].season.localeCompare(a.list[0].season));
  return (
    <Group>
      {groups.map(g => (
        <div key={g.title} className="row palm-row">
          <span className="palm-count num-md">{g.list.length}</span>
          <span className="grow">
            <span className="strong">{g.title}</span>
            <small className="muted block">{g.list.map(h => `${h.season}${h.team ? ` (${h.team})` : ''}`).join(' · ')}</small>
          </span>
        </div>
      ))}
    </Group>
  );
}

/** Palmarès d'un club, par compétition ; les saisons au-delà des 6 dernières se déplient. */
export function ClubPalmares({ titles }: { titles: ClubTitle[] | undefined }) {
  if (!titles?.length) return <Empty>Aucun titre majeur recensé.</Empty>;
  return (
    <Group>
      {titles.map(t => {
        const recent = t.seasons.slice(0, 6), older = t.seasons.slice(6);
        return (
          <div key={t.comp} className="row palm-row">
            <span className="palm-count num-md">{t.seasons.length}</span>
            <span className="grow">
              <span className="strong">{t.comp}</span>
              <small className="muted block">
                {recent.join(' · ')}
                {older.length > 0 && <details className="palm-more"><summary>et {older.length} autre{older.length > 1 ? 's' : ''}</summary>{older.join(' · ')}</details>}
              </small>
            </span>
          </div>
        );
      })}
    </Group>
  );
}
