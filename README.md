# SearchL1

Web app (PWA installable sur iPhone) pour consulter les stats de la Ligue 1 2026-27 et choisir ses joueurs au **Championnat des Étoiles** (L'Équipe). Consultation seulement : pas de prix, pas de constructeur d'équipe.

Écrans : Accueil (avec vos favoris), Matchs (journées J1 → J34, saison d'un club), fiche match avec pronostic expliqué, Joueurs (filtres, tri, 8 vues), fiche joueur, Équipes et fiche club, classement, barème, recherche. Infirmerie et historique complet arrivent ensuite.

Design pensé pour l'iPhone, façon **Liquid Glass** (iOS 26) : barre d'onglets flottante en verre avec un bouton recherche séparé, barre du haut en verre dont le titre apparaît au défilement, boutons ronds, feuilles en verre. Le verre est réservé à la navigation ; le contenu reste sur des surfaces pleines. Si « Réduire la transparence » est activé, le verre devient opaque.

- **Favoris** : l'étoile en haut d'une fiche joueur ou club. Les favoris s'affichent en tête de l'Accueil et sont gardés sur le téléphone.
- **Bon supersub** : l'éclair vert à côté du nom. Au moins 2 entrées en jeu et une moyenne par entrée parmi les 10 % meilleures de L1 (6 points minimum).

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
   - en secours du Mac, le **lundi à 19 h 30 et le vendredi à 9 h (heure de Paris)** si le Mac n'a rien poussé, met d'abord les données à jour, lance les tests, commit `public/data/` si quelque chose a changé, puis déploie ;
   - se lance aussi à la main : onglet **Actions → Données et déploiement → Run workflow**.

L'app est alors servie à `https://<ton-compte>.github.io/SearchL1/`.

> Sofascore bloque les serveurs de GitHub (constaté le 22 octobre 2026). Dans ce cas, le log de l'Action l'indique et les résultats viennent d'openfootball. Pour avoir les stats joueurs à jour, lance `npm run data` sur ton Mac, puis commit et pousse `public/data/`.

## Actualisation des données dans l'app

Les données sont mises à jour **le lundi à 18 h 30 et le vendredi à 8 h** (heure de Paris). L'app recharge toute seule les nouvelles données la première fois qu'elle est ouverte (ou revient au premier plan) après un de ces créneaux. Bouton « Actualiser les données » dans l'onglet Plus.

Une app installée depuis Safari ne peut pas tourner en arrière-plan sur iOS, et Sofascore refuse les requêtes venant d'un autre site que le sien : le téléphone ne peut donc pas interroger Sofascore lui-même. Les fichiers de données sont produits par `npm run data` (sur le Mac, d'où Sofascore répond) ou, pour les scores seulement, par la GitHub Action.

### Mise à jour automatique depuis le Mac

```bash
zsh scripts/mac/install.sh
```

Installe une tâche macOS (launchd) qui, **le lundi à 18 h 30 et le vendredi à 8 h**, récupère les nouvelles données, commite `public/data` et pousse sur GitHub, ce qui redéploie le site. Si le Mac dort à l'heure dite, la tâche tourne à son réveil ; s'il est éteint, elle saute ce créneau. Journal : `~/Library/Logs/searchl1-donnees.log`. macOS interdisant aux tâches de fond de lire `~/Documents`, la tâche travaille dans sa propre copie du dépôt (`~/Library/Application Support/SearchL1/depot`) : fais `git pull` dans ton dossier pour y récupérer les données qu'elle a poussées. La GitHub Action passe une heure plus tard en secours (scores seulement) si le Mac n'a rien poussé.

Désinstaller : `launchctl bootout gui/$(id -u)/com.searchl1.donnees`, puis supprimer `~/Library/LaunchAgents/com.searchl1.donnees.plist` et `~/Library/Application Support/SearchL1`.

## Ajouter l'app à l'écran d'accueil de l'iPhone

Gratuit, sans compte développeur Apple ni App Store : c'est une web app installable (PWA).


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
