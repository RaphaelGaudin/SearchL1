// Parcours principaux sur iPhone 13. Les captures vont dans screenshots/ (une par écran).
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });

async function noHorizontalOverflow(page: Page) {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(w);
}

test('Accueil : prochaine journée, compte à rebours, listes et clubs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Prochaine journée')).toBeVisible();
  await expect(page.locator('.countdown b').first()).toHaveText(/\d+/);
  // Sans favori, la rubrique Favoris ne s'affiche pas (la carte de bienvenue explique l'étoile).
  await expect(page.getByRole('heading', { name: 'Favoris', exact: true })).toHaveCount(0);
  for (const h of ['Joueurs à suivre', 'Absents qui comptent', 'Classement', 'Clubs']) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  }
  await expect(page.locator('.rail-item')).toHaveCount(18);
  await noHorizontalOverflow(page);
  await shot(page, '1-accueil');
});

test('Matchs : bande de journées, flèches, probabilités qui somment à 100', async ({ page }) => {
  await page.goto('/');
  for (const t of ['Supersubs', 'Gardiens', 'Défenseurs', 'En forme']) {
    await page.getByRole('tab', { name: t }).click();
    await expect(page.getByRole('tab', { name: t })).toHaveAttribute('aria-selected', 'true');
  }
  await page.getByRole('link', { name: /Voir les \d+ matchs/ }).click();
  await expect(page).toHaveURL(/#\/matchs\?j=\d+/);
  const current = page.locator('.rd.on .num-sm');
  const j = Number((await current.textContent())!.slice(1));
  await expect(page.getByRole('heading', { name: `Journée ${j}` })).toBeVisible();
  // Premier match pas encore joué de la journée (les matchs joués n'ont plus de probabilités).
  const row = page.locator('.match-row:has(.mr-probs)').first();
  const pcts = (await row.locator('.mr-probs').innerText()).match(/\d+/g)!.map(Number);
  expect(pcts.reduce((s, x) => s + x, 0)).toBe(100);
  await noHorizontalOverflow(page);
  await shot(page, '2-matchs');

  await page.getByRole('button', { name: 'Journée précédente' }).click();
  await expect(page.getByRole('heading', { name: `Journée ${j - 1}` })).toBeVisible();
  await expect(page.locator('.match-row .score').first()).toBeVisible();
  await page.getByRole('button', { name: 'Journée suivante' }).click();
  await expect(page.getByRole('heading', { name: `Journée ${j}` })).toBeVisible();
});

test('Fiche match à venir : pronostic expliqué, onglets, retour à la même position', async ({ page }) => {
  await page.goto('/#/matchs');
  const rows = page.locator('.match-row');
  await rows.nth(5).scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(100);
  await rows.nth(5).click();
  await expect(page).toHaveURL(/#\/match\/\d+/);
  await expect(page.getByRole('heading', { name: 'Pronostic' })).toBeVisible();
  const tri = (await page.locator('.tri').first().innerText()).match(/(\d+) %/g)!.map(s => parseInt(s));
  expect(tri.reduce((s, x) => s + x, 0)).toBe(100);
  await expect(page.getByText('Pronostic final')).toBeVisible();
  await expect(page.locator('.step')).toHaveCount(7);
  await noHorizontalOverflow(page);
  await shot(page, '3-fiche-match');

  // Un onglet = un contenu ; l'onglet touché est celui qui est marqué.
  const tabs = page.locator('.subnav');
  for (const [t, h] of [['Joueurs', 'Joueurs clés et absents'], ['Saison', 'Comparatif de saison'], ['Coupes', 'Coupes autour du match'], ['Face-à-face', 'Face-à-face']]) {
    await tabs.getByRole('tab', { name: t }).click();
    await expect(page.getByRole('heading', { name: h })).toBeInViewport();
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText(t);
  }
  await expect(page.getByRole('heading', { name: 'Pronostic' })).toHaveCount(0);

  // Position dans la journée (« 3/9 ») : le match suivant avance d'un cran, quelles que soient les données.
  const pos = page.locator('.glass-group .num-sm');
  const [k, n] = (await pos.innerText()).split('/').map(Number);
  test.skip(k >= n, 'dernier match de la journée');
  await page.getByRole('button', { name: 'Match suivant de la journée' }).click();
  await expect(pos).toHaveText(`${k + 1}/${n}`);
  // Le match suivant s'ouvre sur le même onglet.
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText('Face-à-face');

  await page.getByRole('button', { name: /^Retour/ }).click();
  await expect(page).toHaveURL(/#\/matchs/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 40);
});

test('Fiche match joué : feuille de match, détail des points par source', async ({ page }) => {
  await page.goto('/#/matchs?j=1');
  await page.locator('.match-row').first().click();
  await expect(page.locator('.hero-mid .num-xl')).toHaveText(/\d+ – \d+/);
  // Feuille de match : onze titulaires sur le terrain pour chaque équipe, remplaçants, déroulé.
  const tabs = page.locator('.subnav');
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText('Feuille de match');
  await expect(page.locator('.pitch .pp')).toHaveCount(11);
  await expect(page.locator('.pitch .pp-note').first()).toHaveText(/^\d+\.\d$/);
  await page.locator('.sheet-seg').getByRole('tab').nth(1).click();
  await expect(page.locator('.sheet-seg').getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pitch .pp')).toHaveCount(11);
  await expect(page.getByRole('heading', { name: 'Remplaçants' })).toBeVisible();
  await expect(page.locator('.timeline .tl-row').first()).toBeAttached();
  // Le score affiché au dernier but du déroulé est le score final.
  const final = (await page.locator('.hero-mid .num-xl').innerText()).replace(/\s/g, '').replace('–', '-');
  const goals = page.locator('.timeline .tl-row.goal b');
  if (await goals.count()) await expect(goals.last()).toHaveText(final);
  await noHorizontalOverflow(page);
  await shot(page, '4-feuille-de-match');

  await tabs.getByRole('tab', { name: 'Pronostic' }).click();
  await expect(page.getByText('calculé la veille du match')).toBeVisible();
  await tabs.getByRole('tab', { name: 'Points' }).click();
  const first = page.locator('.row-details').first();
  await first.locator('summary').click();
  for (const k of ['Équipe', "Note L'Équipe estimée", 'Actions', 'Défense', 'Cartons']) await expect(first.getByText(k, { exact: false }).first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, '4-points-match');
});

test('Saison d\'un club : L1 et coupes, repère « Aujourd\'hui »', async ({ page }) => {
  await page.goto('/#/matchs');
  await page.locator('select').selectOption('Lens');
  await expect(page.getByRole('heading', { name: 'Saison de Lens' })).toBeVisible();
  await expect(page.locator('.today')).toBeInViewport();
  await expect(page.locator('.cup-row').first()).toBeAttached();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: 'screenshots/5-saison-club.png' });
});

test('Navigation : onglets, Plus, recherche, classement', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tabbar').getByRole('link', { name: 'Classement' }).click();
  await expect(page.locator('table tbody tr')).toHaveCount(18);
  // Simple : place et équipe, matchs, différence, points. Détaillé : toutes les colonnes et la forme.
  await page.getByRole('tab', { name: 'Simple' }).click();
  await expect(page.locator('table thead th')).toHaveText(['Équipe', 'J', 'Diff.', 'Pts']);
  await page.getByRole('tab', { name: 'Détaillé' }).click();
  await expect(page.locator('table thead th')).toHaveCount(10);
  await page.reload();
  await expect(page.locator('table thead th')).toHaveCount(10);
  await page.getByRole('tab', { name: 'Simple' }).click();
  await noHorizontalOverflow(page);
  await shot(page, '6-classement');

  // Plus de recherche ni de « Plus » dans la barre du bas : tous deux sont en haut.
  await expect(page.locator('.tabbar .tb')).toHaveCount(5);
  await page.getByRole('button', { name: 'Plus de rubriques' }).click();
  const more = page.getByRole('dialog', { name: 'Plus de rubriques' });
  await expect(more).toBeVisible();
  for (const r of ['Équipes', 'Historique', 'Calcul des points', 'Actualiser les données']) await expect(more.getByText(r)).toBeVisible();
  // Le menu s'ouvre sous le bouton, en haut de l'écran.
  expect((await more.boundingBox())!.y).toBeLessThan(120);
  // Thème : forcé sombre puis clair, gardé après rechargement, retour en automatique.
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await more.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).toBe('rgb(14, 20, 17)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).toBe('rgb(14, 20, 17)');
  await page.getByRole('button', { name: 'Plus de rubriques' }).click();
  await expect(more.getByRole('radio', { name: 'Sombre' })).toHaveAttribute('aria-checked', 'true');
  await more.getByRole('radio', { name: 'Clair' }).click();
  expect(await bg()).toBe('rgb(236, 239, 234)');
  await more.getByRole('radio', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  await page.keyboard.press('Escape');
  await expect(more).toHaveCount(0);
  await page.locator('.navbar-glass').getByRole('button', { name: 'Rechercher' }).click();
  const input = page.getByPlaceholder('Joueur, club ou match');
  await expect(input).toBeFocused();
  // 16 px minimum : iOS ne zoome pas sur le champ.
  expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await input.fill('lens');
  await page.locator('.search-res .row').first().click();
  await expect(page).toHaveURL(/#\/club\/Lens/);
  await expect(page.getByRole('heading', { name: 'Lens', level: 1 })).toBeVisible();
});

test('Barre du bas : glisser le doigt pour changer d\'onglet, un simple toucher marche toujours', async ({ page }) => {
  await page.goto('/');
  const bar = page.locator('.tabbar');
  const center = async (name: string) => { const b = (await bar.getByRole('link', { name }).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const from = await center('Accueil'), to = await center('Infirmerie');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, to.y, { steps: 5 });
  await expect(bar).toHaveClass(/dragging/);
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await expect(bar.locator('.tb.active')).toHaveText('Infirmerie');
  await page.mouse.up();
  await expect(page).toHaveURL(/#\/infirmerie/);
  await expect(bar).not.toHaveClass(/dragging/);
  // Retour en glissant vers la gauche, puis un toucher simple.
  const back = await center('Matchs'), now = await center('Infirmerie');
  await page.mouse.move(now.x, now.y);
  await page.mouse.down();
  await page.mouse.move(back.x, back.y, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/#\/matchs/);
  await bar.getByRole('link', { name: 'Classement' }).click();
  await expect(page).toHaveURL(/#\/classement/);
  await expect(bar.locator('.tb.active')).toHaveText('Classement');
});

test('Comparer deux joueurs depuis une fiche, départs et palmarès', async ({ page }) => {
  const palm = JSON.parse(fs.readFileSync('public/data/palmares.json', 'utf8'));
  const season = JSON.parse(fs.readFileSync('public/data/season.json', 'utf8'));
  const byGoals = [...season.players].sort((x: { logs: { g: number }[] }, y: { logs: { g: number }[] }) =>
    y.logs.reduce((s, L) => s + L.g, 0) - x.logs.reduce((s, L) => s + L.g, 0));
  const [a, b] = byGoals.filter((p: { id: number }) => !palm.moves?.[p.id]);
  await page.goto(`/#/joueur/${a.id}`);
  await page.getByRole('link', { name: /^Comparer/ }).click();
  // Le choix du second joueur s'ouvre tout seul.
  const pick = page.getByRole('dialog', { name: 'Choisir un joueur' });
  await expect(pick).toBeVisible();
  await pick.getByRole('searchbox').fill(b.n.split(' ').at(-1));
  await pick.getByRole('button', { name: new RegExp(b.n.split(' ').at(-1)) }).first().click();
  await expect(page).toHaveURL(new RegExp(`a=${a.id}.*b=${b.id}`));
  await expect(page.locator('.cmp-head')).toHaveCount(2);
  await expect(page.locator('.cmp-stat')).not.toHaveCount(0);
  // Buts : le meilleur des deux est en gras.
  const goals = page.locator('.cmp-stat', { hasText: 'Buts' }).first();
  await expect(goals.locator('.strong')).toHaveCount(1);
  await page.getByRole('button', { name: '5 dernières J' }).click();
  await expect(page.getByRole('button', { name: '5 dernières J' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.duo svg path')).toHaveCount(2);
  await noHorizontalOverflow(page);
  await shot(page, '13-comparer');

  // Un joueur parti en cours de saison n'est plus dans l'effectif de son club, mais dans « Partis ».
  const goneId = Object.keys(palm.moves ?? {})[0];
  test.skip(!goneId, 'aucun départ connu');
  const gone = season.players.find((p: { id: number }) => String(p.id) === goneId);
  await page.goto(`/#/club/${encodeURIComponent(gone.club)}?t=effectif`);
  const departed = page.locator('.day', { has: page.getByRole('heading', { name: 'Partis en cours de saison' }) });
  await expect(departed.getByText(gone.n, { exact: true })).toBeVisible();
  await expect(page.locator('.day', { hasNot: page.getByRole('heading', { name: 'Partis en cours de saison' }) }).getByText(gone.n, { exact: true })).toHaveCount(0);
  await page.goto(`/#/joueur/${goneId}`);
  await expect(page.getByText(`A quitté ${gone.club}`)).toBeVisible();
});

test('Accueil : logo, nom et journée dans la barre du haut, carte de bienvenue à la première visite', async ({ page }) => {
  await page.goto('/');
  const bar = page.locator('.navbar-glass');
  await expect(bar.getByText('SearchL1')).toBeVisible();
  await expect(bar.getByText(/^J\d+ jouée$/)).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Plus de rubriques' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Rechercher' })).toBeVisible();
  const welcome = page.locator('.welcome');
  await expect(welcome.getByRole('heading', { name: 'Bienvenue sur SearchL1' })).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, '1b-bienvenue');
  await welcome.getByRole('button', { name: 'Compris' }).click();
  await expect(welcome).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.welcome')).toHaveCount(0);
});

test('Prix du Championnat des Étoiles : fiche joueur, bonnes affaires, comparaison', async ({ page }) => {
  const prix = JSON.parse(fs.readFileSync('public/data/prix.json', 'utf8'));
  test.skip(!Object.keys(prix.players).length, 'pas de prix');
  await page.goto('/#/joueur/155995');
  await expect(page.getByText(/Prix au jeu/)).toBeVisible();
  await expect(page.getByText('points par étoile (qualité-prix)')).toBeVisible();
  // Vue « Bonnes affaires » : triée par points par étoile, du meilleur au moins bon.
  await page.goto('/#/joueurs?vue=affaires');
  await expect(page.getByRole('tab', { name: 'Bonnes affaires' })).toHaveAttribute('aria-selected', 'true');
  const vals = (await page.locator('.pcard .right-stack .num-md').allInnerTexts()).slice(0, 10).map(t => Number(t.replace(',', '.')));
  expect(vals.length).toBeGreaterThan(3);
  for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
  await noHorizontalOverflow(page);
  await shot(page, '14-bonnes-affaires');
  // Filtre « Prix au jeu (maximum) » : aucun joueur au-dessus du plafond.
  await page.goto('/#/joueurs');
  await page.getByRole('button', { name: /Filtres/ }).click();
  await page.getByRole('radio', { name: '9 ★' }).click();
  await page.getByRole('button', { name: /^Voir \d+ joueurs/ }).click();
  await expect(page.getByRole('button', { name: 'Retirer le filtre 9 ★ max' })).toBeVisible();
  const prices = (await page.locator('.pcard .price').allInnerTexts()).map(t => Number(t.replace('★', '').replace(',', '.')));
  expect(prices.length).toBeGreaterThan(0);
  for (const v of prices) expect(v).toBeLessThanOrEqual(9);
  // Accueil : liste « Bonnes affaires », prix sur les lignes de joueurs.
  await page.goto('/');
  await page.getByRole('tab', { name: 'Bonnes affaires' }).click();
  await expect(page.locator('.row', { hasText: '★' }).first()).toBeVisible();
});

test('Glisser depuis le bord gauche revient à la page d\'avant, même quand iOS fait déjà le retour', async ({ page }) => {
  const swipe = (native: boolean) => page.evaluate(async native => {
    // WebKit ne laisse pas construire de Touch : un événement simple avec les mêmes champs suffit au gestionnaire.
    const fire = (type: string, x: number) => {
      const e = new Event(type);
      const t = [{ clientX: x, clientY: 400 }];
      Object.defineProperties(e, { touches: { value: type === 'touchend' ? [] : t }, changedTouches: { value: t } });
      window.dispatchEvent(e);
    };
    fire('touchstart', 10);
    fire('touchend', 200);
    if (native) history.back(); // le retour fait par iOS lui-même
    await new Promise(r => setTimeout(r, 700));
  }, native);
  for (const native of [false, true]) {
    await page.goto('/#/joueurs');
    await page.locator('.tabbar').getByRole('link', { name: 'Accueil' }).click();
    await page.locator('a[href^="#/joueur/"]').first().click();
    await expect(page).toHaveURL(/#\/joueur\/\d+/);
    await swipe(native);
    await expect(page).toHaveURL(/#\/$/);
  }
});

test('Alerte compo : bouton sur la fiche joueur, message clair quand les notifications ne sont pas possibles', async ({ page }) => {
  const season = JSON.parse(fs.readFileSync('public/data/season.json', 'utf8'));
  const next = season.matches.find((m: { status: string }) => m.status === 'notstarted');
  const p = season.players.find((x: { club: string; logs: unknown[] }) => x.club === next.h && x.logs.length > 3);
  // Le navigateur de test n'a pas l'autorisation des notifications : le serveur ne doit pas être appelé.
  let called = false;
  await page.route('**/searchl1-alertes.**', route => { called = true; return route.abort(); });
  await page.goto(`/#/joueur/${p.id}`);
  const btn = page.getByRole('button', { name: /Me prévenir quand la compo sort/ });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByRole('alert')).toContainText(/Notifications|notifications/);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  expect(called).toBe(false);
});

test('Cibles tactiles d\'au moins 44 px', async ({ page }) => {
  await page.goto('/#/matchs');
  await expect(page.locator('.tabbar')).toBeVisible();
  for (const sel of ['.tabbar .tb', '.navbar-glass .glass-btn', '.iconbtn', '.select select', '.rd']) {
    // Seuls les éléments affichés comptent (la barre du haut est masquée sur iPhone).
    const sizes = await page.locator(sel).evaluateAll(els => els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0).map(r => Math.min(r.width, r.height)));
    expect(sizes.length, sel).toBeGreaterThan(0);
    for (const s of sizes) expect(s, sel).toBeGreaterThanOrEqual(44);
  }
});

test('Favoris : un joueur et un club ajoutés depuis leur fiche apparaissent sur l\'Accueil', async ({ page }) => {
  await page.goto('/#/joueurs');
  const first = page.locator('.pcard').first();
  const name = (await first.locator('.pname .strong').innerText()).trim();
  await first.click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: `Ajouter ${name} aux favoris` }).click();
  await expect(page.getByRole('button', { name: `Retirer ${name} des favoris` })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#/club/Lens');
  await page.getByRole('button', { name: 'Ajouter Lens aux favoris' }).click();
  await page.locator('.tabbar').getByRole('link', { name: 'Accueil' }).click();
  await expect(page.locator('.fav-club', { hasText: 'Lens' })).toBeVisible();
  await expect(page.locator('.section', { hasText: 'Favoris' }).getByText(name)).toBeVisible();
  await page.reload();
  await expect(page.locator('.fav-club', { hasText: 'Lens' })).toBeVisible();
  await shot(page, '7-accueil-favoris');
});

test('Joueurs : filtres, badge supersub, vue Forme', async ({ page }) => {
  await page.goto('/#/joueurs');
  await expect(page.locator('.pcard').first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, '8-joueurs');
  await page.getByRole('button', { name: /^Filtres/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtrer les joueurs' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /Bons supersubs/ }).click();
  await sheet.getByRole('button', { name: /^Voir \d+ joueurs/ }).click();
  await expect(page.locator('.filter-btn .badge-count')).toHaveText('1');
  const n = await page.locator('.pcard').count();
  expect(n).toBeGreaterThan(0);
  await expect(page.locator('.pcard .ss-badge')).toHaveCount(n);
  await page.getByRole('button', { name: 'Retirer le filtre Bons supersubs' }).click();
  await expect(page.locator('.filter-btn .badge-count')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Forme' }).click();
  await expect(page.locator('.pcard .formgrid').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Gardiens' }).click();
  await expect(page.locator('.pcard').first()).toContainText('Gardien');
  await page.getByRole('button', { name: /^Tri|pts par match/ }).first().click();
  const tri = page.getByRole('dialog', { name: 'Trier les joueurs' });
  await tri.getByRole('button', { name: 'arrêts' }).click();
  await expect(page.locator('.pcard .right-stack .tiny').first()).toHaveText('arrêts');
});

test('Fiche joueur et fiche club : sections, graphique, changer de coéquipier ou de club', async ({ page }) => {
  await page.goto('/#/joueurs');
  await page.locator('.pcard').first().click();
  await expect(page.getByRole('heading', { name: 'Résumé' })).toBeVisible();
  const tabs = page.locator('.subnav');
  for (const [t, h] of [['Match par match', 'Match par match'], ['À venir', 'Prochains matchs'], ['Points', 'Points par match']]) {
    await tabs.getByRole('tab', { name: t, exact: true }).click();
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText(t);
  }
  await expect(page.locator('.pchart svg rect').first()).toBeAttached();
  await noHorizontalOverflow(page);
  await shot(page, '9-fiche-joueur');
  // Comparatif au poste : centiles, changement de stat, toucher un point du nuage.
  await tabs.getByRole('tab', { name: 'Comparatif' }).click();
  const cmp = page.locator('#compare');
  await expect(cmp.locator('.pct-row')).not.toHaveCount(0);
  for (const t of await cmp.locator('.pct-num').allInnerTexts()) if (t !== '—') expect(Number(t)).toBeGreaterThanOrEqual(0), expect(Number(t)).toBeLessThanOrEqual(100);
  await cmp.locator('.pct-row').nth(1).click();
  await expect(cmp.locator('.pct-row').nth(1)).toHaveAttribute('aria-pressed', 'true');
  const swarm = cmp.locator('.swarm');
  await swarm.evaluate(el => el.scrollIntoView({ block: 'center' }));
  const dot = await cmp.locator('.sw-dot').first().boundingBox();
  await page.mouse.click(dot!.x + dot!.width / 2, dot!.y + dot!.height / 2);
  await expect(cmp.locator('.sw-tip')).toBeVisible();
  await cmp.screenshot({ path: 'screenshots/11-comparatif-poste.png' });

  const before = page.url();
  await tabs.getByRole('tab', { name: 'Coéquipiers' }).click();
  await page.locator('.rail.people .rail-item').first().click();
  await expect(page).not.toHaveURL(before);
  await expect(page).toHaveURL(/#\/joueur\/\d+/);

  await page.goto('/#/club/Marseille');
  for (const h of ['Résumé', 'Derniers résultats', 'À venir', 'Joueurs clés']) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, '10-fiche-club');
  // Chaque onglet n'affiche que sa rubrique, et c'est lui qui est marqué (plus « Résumé » en permanence).
  const clubTabs = page.locator('.subnav');
  for (const h of ['Calendrier', 'Effectif', 'Coupes', 'Infirmerie', 'Palmarès', 'Historique']) {
    await clubTabs.getByRole('tab', { name: new RegExp(`^${h}`) }).click();
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
    await expect(clubTabs.getByRole('tab', { selected: true })).toHaveText(new RegExp(`^${h}`));
    await expect(page.getByRole('heading', { name: 'Résumé', exact: true })).toHaveCount(0);
  }
  // Calendrier : à venir par défaut, résultats du plus récent au plus ancien.
  await clubTabs.getByRole('tab', { name: 'Calendrier' }).click();
  await page.getByRole('button', { name: 'Résultats' }).click();
  await expect(page.locator('.match-row .score').first()).toBeVisible();
  // Changer d'onglet après avoir fait défiler : on revient au début du contenu, la barre d'onglets collée en haut.
  await page.getByRole('button', { name: 'Toute la saison' }).click();
  await page.evaluate(() => window.scrollTo(0, 2500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await clubTabs.getByRole('tab', { name: /^Effectif/ }).click();
  await expect(page.getByRole('heading', { name: 'Effectif', exact: true })).toBeInViewport();
  expect(await clubTabs.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(120);
  await clubTabs.getByRole('tab', { name: 'Calendrier' }).click();
  await expect(page).toHaveURL(/t=calendrier/);
  // Changer de club garde l'onglet ouvert.
  await page.locator('.club-rail .rail-item', { hasText: 'Lyon' }).click();
  await expect(page.getByRole('heading', { name: 'Lyon', level: 1 })).toBeVisible();
  await expect(clubTabs.getByRole('tab', { selected: true })).toHaveText('Calendrier');
});

test('Infirmerie : compteurs, filtre club en un geste, recherche, absents groupés par club', async ({ page }) => {
  await page.goto('/');
  // L'infirmerie est un onglet de la barre du bas ; les six libellés tiennent en entier.
  for (const el of await page.locator('.tabbar .tb span').all()) expect(await el.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.locator('.tabbar').getByRole('link', { name: 'Infirmerie' }).click();
  await expect(page.getByRole('heading', { name: 'Infirmerie', level: 1 })).toBeVisible();
  await expect(page.locator('.tabbar .tb.active')).toHaveText('Infirmerie');
  const total = await page.locator('#root .row').count();
  expect(total).toBeGreaterThan(0);
  const counts = (await page.locator('.inj-tile b').allInnerTexts()).map(Number);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(total);
  await noHorizontalOverflow(page);
  await shot(page, '12-infirmerie');

  const withAbs = page.locator('.inj-rail .rail-item:not(.none)').nth(1);
  const club = (await withAbs.locator('.tiny').innerText()).trim();
  const n = Number(await withAbs.locator('.inj-count').innerText());
  await withAbs.click();
  await expect(page.locator('.inj-club')).toHaveCount(1);
  await expect(page.locator('.inj-club')).toContainText(club);
  await expect(page.locator('#root .row')).toHaveCount(n);
  await page.locator('.inj-rail .rail-item', { hasText: 'Tous' }).click();

  await page.locator('.inj-tile.t-B').click();
  await expect(page.locator('#root .row .chip-down', { hasText: 'Suspendu' })).toHaveCount(0);
  await page.locator('.inj-tile.t-B').click();
  const name = (await page.locator('#root .row .strong').first().innerText()).trim();
  await page.getByPlaceholder('Joueur ou club').fill(name);
  await expect(page.locator('#root .row').first()).toContainText(name);
});

test('La barre d\'onglets se réduit quand on fait défiler vers le bas et revient en remontant', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.dock')).not.toHaveClass(/compact/);
  for (const y of [200, 500, 900]) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
  await expect(page.locator('.dock')).toHaveClass(/compact/);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.locator('.dock')).not.toHaveClass(/compact/);
});

test('Logos officiels des clubs, avec repli sur l\'écusson stylisé', async ({ page }) => {
  // Logo de Lens introuvable : l'écusson stylisé doit prendre le relais.
  await page.route('**/logos/1648.png', r => r.fulfill({ status: 404 }));
  await page.goto('/#/classement');
  const logos = page.locator('table .crest-logo img');
  await expect(logos.first()).toBeVisible();
  await expect.poll(() => logos.evaluateAll(imgs => imgs.filter(i => (i as HTMLImageElement).naturalWidth > 0).length)).toBe(17);
  await expect(page.locator('table svg.crest[aria-label="Lens"]')).toBeVisible();
  await shot(page, '13-logos-classement');
});

test('Photos des joueurs, avec repli sur les initiales', async ({ page }) => {
  // Toutes les photos manquent sauf celles qui se chargent : on en casse une et on vérifie les initiales à sa place.
  await page.route('**/photos/2011326.webp', r => r.fulfill({ status: 404 }));
  await page.goto('/#/joueurs');
  const photos = page.locator('.avatar-photo img');
  await expect(photos.first()).toBeVisible();
  await expect.poll(() => photos.evaluateAll(imgs => imgs.filter(i => (i as HTMLImageElement).naturalWidth > 0).length)).toBeGreaterThan(3);
  await page.goto('/#/joueur/2011326');
  await expect(page.locator('.entity-head .avatar:not(.avatar-photo)')).toHaveText('NK');
  await page.goto('/#/joueur/1409700');
  await expect(page.locator('.entity-head .avatar-photo img')).toHaveJSProperty('complete', true);
  await shot(page, '14-photo-joueur');
});

test('Historique : courbe des clubs choisis et classement final de chaque saison', async ({ page }) => {
  await page.goto('/#/historique');
  await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible();
  // Quatre clubs par défaut, une courbe chacun ; un cinquième remplace le plus ancien.
  await expect(page.locator('.club-rail [aria-pressed="true"]')).toHaveCount(4);
  await page.locator('.club-rail button', { hasText: 'Lens' }).click();
  await expect(page.locator('.club-rail [aria-pressed="true"]')).toHaveCount(4);
  await expect(page.locator('.bump-legend')).toContainText('Lens');
  await page.locator('.bump-dot').first().click();
  await expect(page.locator('.bump-tip strong')).toBeVisible();
  // Saison arrêtée : classement aux points par match, PSG champion.
  await page.getByRole('tab', { name: '2019-20' }).click();
  await expect(page.locator('.hist-summary')).toContainText('PSG');
  await expect(page.getByText('Saison arrêtée')).toBeVisible();
  await page.getByRole('tab', { name: '2025-26' }).click();
  await expect(page.locator('table.standings tbody tr')).toHaveCount(18);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await shot(page, '15-historique');
});
