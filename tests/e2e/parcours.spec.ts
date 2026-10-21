// Parcours principaux sur iPhone 13. Les captures vont dans screenshots/ (une par écran).
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
  for (const h of ['En forme', 'Supersubs', 'Gardiens et défenseurs', 'Absents qui comptent', 'Classement', 'Clubs']) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  }
  await expect(page.locator('.rail-item')).toHaveCount(18);
  await noHorizontalOverflow(page);
  await shot(page, '1-accueil');
});

test('Matchs : bande de journées, flèches, probabilités qui somment à 100', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Voir les \d+ matchs/ }).click();
  await expect(page).toHaveURL(/#\/matchs\?j=\d+/);
  const current = page.locator('.rd.on .num-sm');
  const j = Number((await current.textContent())!.slice(1));
  await expect(page.getByRole('heading', { name: `Journée ${j}` })).toBeVisible();
  const row = page.locator('.match-row').first();
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

test('Fiche match à venir : pronostic expliqué, sommaire, retour à la même position', async ({ page }) => {
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
  for (const h of ['Coupes autour du match', 'Face-à-face', 'Comparatif de saison', 'Joueurs clés et absents']) {
    await expect(page.getByRole('heading', { name: h })).toBeAttached();
  }
  await noHorizontalOverflow(page);
  await shot(page, '3-fiche-match');

  await page.locator('.subnav a', { hasText: 'Face-à-face' }).click();
  await expect(page.getByRole('heading', { name: 'Face-à-face' })).toBeInViewport();
  // Le sommaire reste collé en haut.
  expect(await page.locator('.subnav').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(60);

  await page.getByRole('button', { name: 'Match suivant de la journée' }).click();
  await expect(page.locator('.navbar-right .num-sm')).toHaveText(/7 \/ \d+/);

  await page.getByRole('button', { name: 'Matchs' }).click();
  await expect(page).toHaveURL(/#\/matchs/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 40);
});

test('Fiche match joué : buteurs et détail des points par source', async ({ page }) => {
  await page.goto('/#/matchs?j=1');
  await page.locator('.match-row').first().click();
  await expect(page.locator('.hero-mid .num-xl')).toHaveText(/\d+ – \d+/);
  await expect(page.getByText('calculé la veille du match')).toBeVisible();
  const first = page.locator('.row-details').first();
  await first.locator('summary').click();
  for (const k of ['Équipe', "Note L'Équipe estimée", 'Actions', 'Défense', 'Cartons']) await expect(first.getByText(k, { exact: false }).first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, '4-match-joue');
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
  await noHorizontalOverflow(page);
  await shot(page, '6-classement');

  await page.locator('.tabbar').getByRole('button', { name: 'Plus' }).click();
  await expect(page.getByRole('dialog', { name: 'Plus de rubriques' })).toBeVisible();
  await page.getByRole('button', { name: /Rechercher/ }).click();
  const input = page.getByPlaceholder('Joueur, club ou match');
  await expect(input).toBeFocused();
  // 16 px minimum : iOS ne zoome pas sur le champ.
  expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await input.fill('lens');
  await page.locator('.search-res .row').first().click();
  await expect(page.getByRole('heading', { name: 'Saison de Lens' })).toBeVisible();
});

test('Cibles tactiles d\'au moins 44 px', async ({ page }) => {
  await page.goto('/#/matchs');
  await expect(page.locator('.tabbar')).toBeVisible();
  for (const sel of ['.tabbar .tb', '.iconbtn', '.select select', '.rd']) {
    // Seuls les éléments affichés comptent (la barre du haut est masquée sur iPhone).
    const sizes = await page.locator(sel).evaluateAll(els => els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0).map(r => Math.min(r.width, r.height)));
    expect(sizes.length, sel).toBeGreaterThan(0);
    for (const s of sizes) expect(s, sel).toBeGreaterThanOrEqual(44);
  }
});
