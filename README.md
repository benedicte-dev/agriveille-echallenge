# AgriVeille

AgriVeille aide les exploitant·es agricoles du Bénin à agir avant que la météo ou un ravageur ne détruise leur récolte : alertes calculées sur la météo réelle de chaque parcelle, en français, en fon et en yoruba, avec lecture audio. La même plateforme relie les producteurs aux acheteurs, aux agents de l'État et aux règles qui encadrent la filière.

Projet présenté au challenge « Agriculture intelligente » du ministère du Numérique et de la Digitalisation du Bénin. Ce document s'adresse au jury et aux développeurs.

## Problème et usagers

Les producteurs apprennent souvent trop tard une sécheresse, une pluie violente ou l'arrivée d'une chenille légionnaire. Beaucoup lisent peu le français, utilisent un téléphone Android d'entrée de gamme et ont une connexion intermittente.

| Usager | Rôle | Besoin |
|---|---|---|
| Exploitant·e, parfois peu alphabétisé·e | `FARMER` | savoir quoi faire sur sa parcelle cette semaine, signaler un ravageur, vendre, payer sa redevance |
| Acheteur local ou exportateur | `BUYER` | trouver des lots et faire une offre |
| Agent de l'État (DDAEP, phytosanitaire, recettes) | `AGENT` | valider les signalements, alerter une zone, suivre les accusés de réception et les recettes |
| Administrateur de contenu | `ADMIN` | tenir à jour cultures, ravageurs, réglementation, prix, barèmes, utilisateurs |

## Fonctionnalités par module

- **Monitoring climat et phytosanitaire, de bout en bout.** Coordonnées de la parcelle, puis prévisions Open-Meteo sur 7 jours (cache de 3 h), puis moteur de règles pur (`src/lib/monitoring/rules.ts` : sécheresse, fortes pluies, chaleur, vent, risque ravageur, fenêtres de semis et de récolte), puis alerte traduite, puis livraison dans l'application et par SMS simulé, puis lecture et accusé de réception, et enfin taux d'accusés visible par l'agent. Il y a trois déclencheurs : le cron quotidien, l'ouverture d'une parcelle dont le cache a expiré, et le bouton agent « Lancer l'analyse ».
- **Signalement de ravageur.** Photo (signature vérifiée, 300 Ko au maximum), description ou dictée vocale, fonctionne hors ligne. Quand l'agent le confirme, une alerte de zone `PEST_OUTBREAK` part vers tous les producteurs dont une parcelle se trouve dans le rayon (15 km par défaut).
- **Calendrier cultural.** Mois de semis et de récolte par culture, avec les alertes `SOWING_WINDOW` et `HARVEST_WINDOW`.
- **Marché local et export.** Annonces des producteurs, offres des acheteurs (accepter, refuser, retirer), prix de référence publics sur `/marche`.
- **Redevances et quittance QR.** Montant toujours calculé par le serveur à partir du barème, numéro de quittance `AV-2026-000123`, QR qui pointe vers la page publique `/verifier/<code>`.
- **Réglementation.** Fiches publiques par catégorie (phytosanitaire, semences, export, fiscalité, foncier, bio) sur `/reglementation`.
- **CMS.** `/admin` : cultures, ravageurs, fiches réglementaires, prix, taux de redevance, utilisateurs, journal d'audit.
- **Simulateur SMS/USSD, étiqueté DÉMO.** `/agent/sms` affiche la boîte d'envoi SMS simulée et un simulateur USSD `*229*1#`. Aucun SMS réel n'est envoyé.
- **Fon et yoruba avec audio.** Contenus traduits par l'API 229langues (traduction, synthèse et reconnaissance vocales), mis en cache en base. Des fichiers audio pré-générés pour l'interface se trouvent dans `public/audio/`. En cas d'échec, l'affichage revient au français.
- **PWA hors ligne.** Service worker (`public/sw.js`), pages en cache, file IndexedDB pour les signalements et les accusés, synchronisés par `/api/offline/sync`.

## Inclusion

- Connexion par numéro de téléphone et code PIN à 4 chiffres, sans e-mail ni mot de passe.
- Pictogrammes sur chaque action et bouton « Écouter » : l'application s'utilise sans savoir lire.
- Trois langues (fr, fon, yo), à choisir dans le profil.
- Pages légères, carte chargée seulement là où elle sert, fonctionnement dégradé sans réseau.
- Canal USSD/SMS prévu pour les téléphones basiques (simulé dans cette version).

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, PostgreSQL 16 et Prisma 6, zod v4, argon2id (`@node-rs/argon2`), Leaflet, `qrcode`, Vitest et Playwright, pnpm.

## Architecture

1. Un monolithe Next.js déployé sur Vercel, avec une base PostgreSQL (Neon en production) accédée par Prisma.
2. Les pages sont des Server Components. Chaque mutation passe par une Server Action qui applique, dans l'ordre, la validation zod, `requireRole` et le contrôle de propriété.
3. Le domaine vit dans `src/lib` (auth, security, monitoring, i18n, langues, offline) et dans `src/server` (alerts, reports, market, levies, content).
4. Les services externes (Open-Meteo, 229langues) sont appelés côté serveur uniquement, avec délai borné et repli.
5. Le client est une PWA : service worker, file IndexedDB, synthèse vocale locale en secours.

Pour le détail, voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), les diagrammes UML dans [docs/uml/](docs/uml/README.md) et la page `/modelisation` de l'application. La spécification de référence se trouve dans [docs/SPEC.md](docs/SPEC.md), le script de démonstration dans [docs/DEMO.md](docs/DEMO.md) et les mesures de sécurité dans [docs/SECURITY.md](docs/SECURITY.md).

## Démarrage local

Prérequis : Node.js, pnpm 10 et Docker.

```bash
pnpm install                     # lance aussi prisma generate
docker run -d --name agriveille-db -p 127.0.0.1:5440:5432 \
  -e POSTGRES_USER=agriveille -e POSTGRES_PASSWORD=<mot-de-passe-local> -e POSTGRES_DB=agriveille \
  postgres:16
cp .env.example .env             # puis renseigner DATABASE_URL, au minimum
pnpm db:migrate
pnpm db:seed
pnpm dev                         # http://localhost:3000
```

Exemple de `DATABASE_URL` locale : `postgresql://agriveille:<mot-de-passe-local>@127.0.0.1:5440/agriveille`. Sans les variables `LANGUES_*`, l'application fonctionne en français. `pnpm db:reset` réinitialise la base.

## Tests

```bash
pnpm test         # tests unitaires Vitest (src/**/*.test.ts)
pnpm typecheck    # tsc --noEmit
pnpm test:e2e     # Playwright (e2e/)
```

## Comptes de démo

Ils sont créés par `prisma/seed.ts`. Relancer `pnpm db:seed` remet les PIN et les verrous dans leur état initial.

| Rôle | Nom | Téléphone | PIN | Espace |
|---|---|---|---|---|
| Exploitante | Ablawa Houénou (Bohicon) | +229 01 97 00 00 01 | 1234 | `/app` |
| Exploitant | Issa Bani (Parakou) | +229 01 97 00 00 02 | 1234 | `/app` |
| Acheteuse | Carine Agossou, Agossou Négoce | +229 01 97 00 00 10 | 1234 | `/acheteur` |
| Agent | Marcel Dossou, DDAEP Zou | +229 01 97 00 00 20 | 1234 | `/agent` |
| Administrateur | Administrateur AgriVeille | +229 01 97 00 00 99 | 9876 | `/admin` |

Ces comptes n'existent que pour la démonstration. La page `/connexion` les affiche, sauf si `NEXT_PUBLIC_DEMO_MODE=false`.

## Déploiement (Vercel et Neon)

1. Créez une base Neon et reliez-la au projet Vercel.
2. Renseignez les variables d'environnement dans Vercel (noms seulement, jamais dans le dépôt) :
   - `DATABASE_URL` (obligatoire)
   - `CRON_SECRET` (obligatoire, sinon la route cron répond 401)
   - `LANGUES_API_BASE`, `LANGUES_API_KEY`, `LANGUES_HF_TOKEN` (fon, yoruba et audio)
   - `NEXT_PUBLIC_APP_URL` (origine publique inscrite dans les QR ; à défaut, l'hôte de la requête)
   - `NEXT_PUBLIC_DEMO_MODE` (`false` masque les comptes de démo)
   - `NEXT_PUBLIC_REPO_URL` (lien vers le dépôt sur `/modelisation`)
3. Migrations : le script `vercel-build` (`scripts/vercel-build.sh`) lance `prisma migrate deploy` à chaque déploiement, par la connexion directe `DATABASE_URL_UNPOOLED`. Pour charger les données de démo, définissez `SEED_ON_DEPLOY=1` le temps d'un déploiement, puis retirez-la.
4. Cron : `vercel.json` appelle `GET /api/cron/monitoring` tous les jours à 06:00 UTC (07:00 à Cotonou). Vercel envoie `Authorization: Bearer $CRON_SECRET`. La route purge aussi les compteurs de limitation de débit.

`.env.example` contient aussi `SESSION_SECRET` et `LANGUES_PROJECT_ID`, que le code actuel ne lit pas : les sessions reposent sur des jetons aléatoires stockés en base.

## Limites connues

- **Traductions automatiques.** Les textes fon et yoruba et l'audio viennent de l'API 229langues et n'ont pas été relus par des locuteurs natifs. Une relecture est nécessaire avant tout usage réel.
- **SMS et USSD simulés.** Rien n'est envoyé à un opérateur : les messages sont écrits dans une table `SmsOutbox` et affichés sur `/agent/sms`.
- **Paiement simulé.** Il n'existe pas de flux de paiement réel. Le statut « payé » vient d'un bouton de démonstration étiqueté ou d'un encaissement déclaré par un agent.
- Les seuils agronomiques sont indicatifs. Ils sont documentés dans `src/lib/monitoring/rules.ts` et doivent être validés par des agronomes.
- Les fiches réglementaires ne citent un texte de loi que lorsque la référence est connue. Elles ne constituent pas un avis juridique.
