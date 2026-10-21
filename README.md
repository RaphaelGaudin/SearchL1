# SearchL1

Web app (PWA installable sur iPhone) pour consulter les stats de la Ligue 1 2026-27 et choisir ses joueurs au **Championnat des Étoiles** (L'Équipe). Consultation seulement : pas de prix, pas de constructeur d'équipe.

V1 : Accueil, Matchs (journées J1 → J34, saison d'un club), fiche match avec pronostic expliqué, classement, barème, recherche. Joueurs, fiches club, infirmerie et historique arrivent aux étapes suivantes.

## Installation

Node 22 ou plus récent.

```bash
npm install
npx playwright install chromium webkit
```

Chromium sert au script de données (Sofascore), WebKit aux tests iPhone.

## Lancement

```bash
npm run dev
```

Ouvre http://localhost:5173. Pour tester sur ton iPhone en Wi-Fi : `npm run dev -- --host`, puis ouvre l'adresse « Network » affichée.

## Mise à jour des données

```bash
npm run data                  # tout : historique + saison
npm run data -- --no-history  # saison seulement (plus rapide)
```

Le script écrit `public/data/` :

| Fichier | Contenu | Source |
|---|---|---|
| `history.json` | Tous les matchs de L1 depuis 2014-15 | [openfootball](https://github.com/openfootball/europe) |
| `season.json` | Calendrier et résultats, stats joueurs par match, buteurs, absents de la prochaine journée, coupes (LdC, LE, LC, Coupe de France) | Sofascore (API non officielle) |
| `meta.json` | Date de mise à jour, dernière journée jouée, avertissements | — |

- **Sofascore** refuse les clients HTTP simples. Le script ouvre donc le site dans un Chromium headless et appelle l'API depuis la page, avec 450 ms entre les requêtes.
- Les feuilles des matchs terminés depuis plus de 36 h sont gardées en cache dans `.cache/sofascore/` et ne sont plus redemandées.
- **Vérifications** avant d'écrire quoi que ce soit :
  - le classement recalculé doit être identique au classement publié par Sofascore (matchs, points, buts pour et contre) ; sinon le script s'arrête et **les anciennes données restent en place** ;
  - les buts des joueurs plus les contre-son-camp adverses doivent donner le score de chaque match ; sinon le match est marqué « feuille incomplète » et signalé dans le log (rien n'est inventé).
- **Secours** : si Sofascore est inaccessible, les résultats sont repris d'openfootball. Les stats joueurs restent alors celles de la dernière mise à jour réussie.
- Coupe de France : avant le tirage, l'app affiche le prochain tour (calendrier FFF) avec « adversaire à tirer au sort ».

## Tests

```bash
npm test          # Vitest : barème, note estimée, modèle, backtest, lecture openfootball, vérifications
npm run e2e       # Playwright : parcours principaux sur iPhone 13 (WebKit), captures dans screenshots/
```

Le **backtest** refait le pronostic des 918 matchs de 2023-24 à 2025-26, chacun avec les seuls matchs antérieurs. Résultat : RPS 0,208, contre 0,233 pour un pronostic fixe, et un modèle bien calibré. Il est vérifié à chaque `npm test`. Un nouveau facteur ne doit être ajouté que s'il ne dégrade pas ce score.

## Déploiement (GitHub Pages)

1. Crée un dépôt GitHub (par exemple `SearchL1`) et pousse le projet sur la branche `main`.
2. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` :
   - déploie à chaque push sur `main` ;
   - le **lundi et le jeudi à 18 h 30 (heure de Paris)**, met d'abord les données à jour, lance les tests, commit `public/data/` si quelque chose a changé, puis déploie ;
   - se lance aussi à la main : onglet **Actions → Données et déploiement → Run workflow**.

L'app est alors servie à `https://<ton-compte>.github.io/SearchL1/`.

> Sofascore peut bloquer les serveurs de GitHub. Dans ce cas, le log de l'Action l'indique et les résultats viennent d'openfootball. Pour avoir les stats joueurs à jour, lance `npm run data` sur ton Mac, puis commit et pousse `public/data/`.

## Ajouter l'app à l'écran d'accueil de l'iPhone

1. Ouvre l'adresse GitHub Pages dans **Safari**.
2. Touche le bouton **Partager** (carré avec une flèche), puis **Sur l'écran d'accueil**.
3. Garde le nom « SearchL1 » et touche **Ajouter**.

L'app s'ouvre en plein écran et fonctionne hors ligne avec les dernières données chargées.

## Calculs

- **Barème** (`src/lib/scoring.ts`) : règlement 2018-19 du Championnat des Étoiles, dernière version publique trouvée. Le détail est dans l'app, rubrique « Calcul des points ».
- **Note L'Équipe estimée** à partir de la note Sofascore r : `null` sous 20 minutes, sinon `clamp(round(5 + 1,5 × (r − 6,7)), 1, 9)`. Tous les points affichés sont donc des estimations.
- **Pronostic** (`src/lib/predict.ts`), repris du prototype :
  - Poisson à forces attaque/défense pondéré dans le temps (demi-vie 350 jours), avantage du terrain propre à chaque club, correction Dixon-Coles (rho = −0,05) ;
  - corrections légères : forme sur 6 matchs, face-à-face sur 8 matchs, absents de la prochaine journée, match européen 3 jours avant ou moins.
  - La fiche match montre l'effet de chaque facteur.

## Structure

```
scripts/          update-data.ts (point d'entrée), lib/ (Sofascore, openfootball, vérifications)
src/lib/          clubs, types, barème, modèle de pronostic, backtest, classement, calculs dérivés
src/components/   écusson, icônes, ligne de match, listes groupées, recherche
src/pages/        Accueil, Matchs, fiche match, Classement, Barème
tests/unit/       Vitest
tests/e2e/        Playwright (iPhone 13)
public/data/      données générées (commitées)
```

Design : maquette Figma « SearchL1 — maquette iPhone ». Fond craie, accent vert pelouse, vert nuit en mode sombre, police Archivo. Les écussons sont stylisés aux couleurs des clubs (les vrais logos sont des marques déposées).
