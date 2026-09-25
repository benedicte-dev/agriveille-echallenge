# AgriVeille — Spécification de référence (contrat entre agents)

Plateforme de soutien à la production agricole au Bénin. Challenge « Agriculture intelligente »
(ministère du Numérique et de la Digitalisation). Livraison : dépôt GitHub + plateforme déployée
sur Vercel, testable en live. Délai total : 15 h.

Critères d'évaluation : profondeur de la réflexion sur les usages, design, fonctionnement, analyse du code.
Minimum non négociable : solution fonctionnelle et inclusive ; interface claire, accessible, pensée
pour une connectivité limitée ; **monitoring qui marche vraiment de bout en bout** (climat +
phytosanitaire + récolte) ; gestion de contenu.

Ce document est le **contrat**. Aucun agent ne s'en écarte sans le signaler dans son rapport.

---

## 1. Stack (figée)

- Next.js **16** App Router, React 19, TypeScript strict, Tailwind CSS v4. `src/` layout, alias `@/*`.
  Next 16 : lire `node_modules/next/dist/docs/` avant d'utiliser une API (ex. `proxy.ts` remplace
  `middleware.ts`, `params`/`searchParams`/`cookies()` sont asynchrones).
- PostgreSQL 16 + Prisma 6 (`prisma/schema.prisma`). Dev : `DATABASE_URL` dans `.env`
  (conteneur Docker `agriveille-db`, port 5440). Prod : Neon via Vercel.
- Validation : `zod` v4 sur **toute** entrée (Server Actions, route handlers, searchParams).
- Hachage PIN : `@node-rs/argon2`. Sessions en base (jeton aléatoire 32 octets, seul le SHA-256 est stocké),
  cookie `av_session` httpOnly, Secure en prod, SameSite=Lax, 30 jours.
- QR : `qrcode`. Carte : `leaflet` + `react-leaflet` (chargées dynamiquement, seulement sur les pages carte).
- Tests : `vitest` (unitaires, `src/**/*.test.ts`), `@playwright/test` (e2e, `e2e/`).
- Gestionnaire : **pnpm**. Toutes les dépendances sont déjà installées. **Aucun agent ne modifie
  `package.json`** sauf l'agent fondation (scripts). Besoin d'une dépendance → le signaler.
- Machine limitée (4 cœurs, 6 Go) : **ne pas lancer `next build` ni `next dev`** sauf consigne explicite.
  Vérifier avec `pnpm exec tsc --noEmit` et `pnpm exec vitest run <fichiers>`.

## 2. Acteurs et rôles (RBAC vérifié côté serveur, jamais seulement dans l'UI)

| Rôle (`Role`) | Qui | Peut |
|---|---|---|
| `FARMER` | exploitant·e agricole | gérer ses parcelles & cultures, voir météo/alertes de ses parcelles, accuser réception, signaler un ravageur (photo/voix), publier des annonces, répondre aux offres, déclarer une vente/redevance et obtenir sa quittance, lire la réglementation |
| `BUYER` | acheteur local ou exportateur | parcourir le marché, faire une offre, suivre ses offres |
| `AGENT` | agent de l'État (DDAEP / ministère, service phytosanitaire, recettes) | valider/rejeter les signalements, émettre des alertes de zone, lancer l'analyse climatique, voir le tableau de bord (carte, stats, recettes), valider les déclarations |
| `ADMIN` | administrateur de contenu | tout ce qu'AGENT peut + CMS (cultures, ravageurs, fiches réglementaires, prix de référence, taux de redevance, utilisateurs) + journal d'audit |

Public (non connecté) : accueil, réglementation, prix de référence du marché, vérification d'une quittance par QR.

## 3. Modèle de données (source de vérité → `prisma/schema.prisma`)

Identifiants `String @id @default(cuid())`. Dates `DateTime`. Montants en **FCFA entiers** (`Int`).
Quantités en kg (`Int`). Coordonnées `Float`. Textes multilingues : champs `xxxFr`, `xxxFon`, `xxxYo`
(fon/yoruba nullables, remplis par l'API 229langues).

- **User** : id, phone (unique, format béninois normalisé `+229XXXXXXXXXX`, 10 chiffres après +229), pinHash,
  fullName, role (`Role`), locale (`Locale` = `fr|fon|yo`, défaut `fr`), communeId?, organization?
  (acheteur/agent), isActive, failedLogins, lockedUntil?, createdAt, lastLoginAt?
- **Session** : id, tokenHash (unique), userId, expiresAt, createdAt, userAgent?
- **Commune** : id, name, department (12 départements du Bénin), lat, lon, agroZone (`AgroZone` : 8 pôles de
  développement agricole, ex. `PDA1`…`PDA7`, simplifier en enum libellée)
- **Crop** (culture, CMS) : id, slug, nameFr/Fon/Yo, icon (clé pictogramme), cycleDays, sowingMonths (Int[]),
  harvestMonths (Int[]), minRainMm, optimalTempMin, optimalTempMax, notes?
- **Pest** (ravageur/maladie, CMS) : id, slug, nameFr/Fon/Yo, kind (`PEST|DISEASE`), cropIds (relation n-n Crop),
  symptomsFr/Fon/Yo, preventionFr/Fon/Yo, treatmentFr/Fon/Yo, riskTempMin?, riskTempMax?, riskHumidityMin?, imageKey?
- **Parcel** : id, ownerId(User FARMER), name, communeId, lat, lon, areaHa (Float), createdAt
- **Planting** (culture sur parcelle) : id, parcelId, cropId, sowingDate, expectedHarvestDate, status
  (`PLANNED|GROWING|HARVESTED`), estimatedYieldKg?
- **WeatherSnapshot** : id, parcelId, fetchedAt, source (`open-meteo`), payload (Json : daily 7 jours
  tmax, tmin, précipitations, humidité moyenne, vent max, ET0), expiresAt
- **Alert** : id, type (`AlertType` = `DROUGHT|HEAVY_RAIN|HEAT|WIND|PEST_RISK|PEST_OUTBREAK|SOWING_WINDOW|HARVEST_WINDOW`),
  severity (`INFO|WARNING|CRITICAL`), source (`AUTO_WEATHER|PEST_REPORT|AGENT_MANUAL`),
  titleFr/Fon/Yo, messageFr/Fon/Yo, adviceFr/Fon/Yo, parcelId?, communeId?, lat?, lon?, radiusKm?,
  pestId?, reportId?, validFrom, validUntil, createdById?, createdAt, dedupKey (unique : évite les doublons
  d'alertes auto — ex. `DROUGHT:<parcelId>:<yyyy-mm-dd>`)
- **AlertDelivery** : id, alertId, userId, channel (`IN_APP|SMS_SIM|USSD_SIM|PUSH`), status (`SENT|READ|ACKNOWLEDGED`),
  sentAt, readAt?, acknowledgedAt?  — unique(alertId,userId,channel)
- **PestReport** (signalement) : id, reporterId, parcelId?, communeId, lat, lon, pestId? (si identifié),
  description?, voiceTranscript?, voiceLang?, photo (Bytes, ≤ 300 Ko, webp/jpeg vérifié par signature),
  photoMime, status (`PENDING|CONFIRMED|REJECTED`), reviewedById?, reviewedAt?, reviewNote?, createdAt,
  clientId? (unique, idempotence pour la file hors ligne)
- **Listing** (annonce marché) : id, sellerId, cropId, title, quantityKg, pricePerKgFcfa, market (`LOCAL|EXPORT`),
  communeId, availableFrom, qualityNote?, certification? (ex. bio, GlobalG.A.P.), status (`OPEN|RESERVED|SOLD|CLOSED`), createdAt
- **Offer** : id, listingId, buyerId, quantityKg, pricePerKgFcfa, message?, status (`PENDING|ACCEPTED|REJECTED|WITHDRAWN`), createdAt
- **ReferencePrice** (CMS) : id, cropId, communeId? (null = national), market, pricePerKgFcfa, observedAt
- **LevyRate** (CMS, barème redevance) : id, code, labelFr/Fon/Yo, basis (`PER_KG|PERCENT_VALUE|FLAT`), rate (Int ; pour PERCENT
  exprimé en points de base), active
- **Declaration** (déclaration de vente/redevance) : id, farmerId, levyRateId, cropId?, quantityKg?, declaredValueFcfa?,
  amountDueFcfa (calculé serveur, jamais fourni par le client), status (`SUBMITTED|PAID|VALIDATED|REJECTED`),
  receiptNumber (unique, `AV-2026-000123`), verificationCode (unique, 12 caractères aléatoires, dans le QR),
  paidAt?, validatedById?, createdAt
  Paiement : **pas de flux réel** (décision 4b). Marquage « payé » = encaissement déclaré au guichet par un AGENT,
  ou bouton « Payer (démo) » étiqueté *simulation*. La quittance QR pointe vers `/verifier/<verificationCode>` (public).
- **Regulation** (fiche réglementaire, CMS) : id, slug, category (`PHYTO|SEEDS|EXPORT|TAX|LAND|ORGANIC`),
  titleFr/Fon/Yo, summaryFr/Fon/Yo, bodyFr (markdown simple), bodyFon?, bodyYo?, sourceRef? (texte de loi réel si connu,
  sinon omis — **ne jamais inventer une référence légale**), published, updatedAt
- **SmsOutbox** (simulateur SMS/USSD, étiqueté DÉMO) : id, toPhone, body, lang, alertId?, createdAt
- **AuditLog** : id, actorId?, action, entity, entityId?, meta (Json), ip?, createdAt
- **TranslationCache** : id, sourceHash (unique = sha256(lang+texte)), lang, source, text, createdAt
- **AudioCache** : id, key (unique = sha256(lang+texte)), lang, mime, data (Bytes), createdAt

## 4. Monitoring de bout en bout (cœur évalué)

Chaîne : `Parcel(lat,lon)` → **Open-Meteo** `https://api.open-meteo.com/v1/forecast` (gratuit, sans clé ; daily :
temperature_2m_max, temperature_2m_min, precipitation_sum, relative_humidity_2m_mean, wind_speed_10m_max,
et0_fao_evapotranspiration ; timezone Africa/Porto-Novo ; 7 jours) → `WeatherSnapshot` (cache 3 h) →
**moteur de règles pur** `src/lib/monitoring/rules.ts` (entrée : prévisions + plantings + pests ; sortie : liste
d'alertes candidates avec dedupKey) → `Alert` (traduites fon/yo, repli fr si l'API échoue) → `AlertDelivery`
(IN_APP + SMS_SIM pour les fermiers concernés) → l'utilisateur **lit** puis **accuse réception** → le tableau de bord
AGENT voit le taux d'accusés.

Déclencheurs : (1) cron Vercel quotidien `GET /api/cron/monitoring` protégé par `Authorization: Bearer $CRON_SECRET` ;
(2) ouverture d'une parcelle par son propriétaire si snapshot expiré ; (3) bouton AGENT « Lancer l'analyse ».

Règles (seuils documentés dans le code, inspirés des pratiques agronomiques) :
- DROUGHT : cumul pluie 7 j < 10 mm ET ET0 cumulée > 25 mm sur culture GROWING → WARNING (CRITICAL si < 3 mm).
- HEAVY_RAIN : un jour ≥ 50 mm → WARNING, ≥ 80 mm → CRITICAL.
- HEAT : tmax ≥ 38 °C → WARNING, ≥ 40 °C → CRITICAL.
- WIND : vent max ≥ 50 km/h → WARNING.
- PEST_RISK : pour chaque Pest lié à une culture GROWING, ≥ 3 jours dans la fenêtre temp/humidité du ravageur → WARNING
  (ex. chenille légionnaire d'automne sur maïs ; mildiou).
- SOWING_WINDOW : culture PLANNED, mois courant ∈ sowingMonths et ≥ 20 mm prévus sur 7 j → INFO « bon moment pour semer ».
- HARVEST_WINDOW : expectedHarvestDate dans ≤ 10 j ET 3 jours secs consécutifs prévus → INFO « récoltez ces jours-là ».
- PEST_OUTBREAK : créée quand un AGENT **confirme** un PestReport → alerte de zone (radiusKm défaut 15) livrée à tous les
  FARMER dont une parcelle est dans le rayon (haversine).

## 5. Langues et inclusion (non négociable)

- Trois langues d'interface : **fr, fon, yo**. Dictionnaire `src/lib/i18n/messages/{fr,fon,yo}.json`, clés plates
  (`nav.home`, `alert.ack`…). Fon/yo générés par l'API 229langues via script, puis figés dans le dépôt.
- API 229langues : base `LANGUES_API_BASE`, en-têtes `Authorization: Bearer $LANGUES_HF_TOKEN` et `X-API-Key: $LANGUES_API_KEY`.
  `POST /api/v1/translate` `{text, from_lang:"fr", to_lang:"fon"|"yo"}` → `data.text`.
  `POST /api/v1/tts` `{text, language:"fon"|"yoruba"}` → audio (wav fon, mp3 yoruba). `POST /api/v1/stt` (multipart audio,
  langue fon/yoruba) → transcription. Premier appel lent (jusqu'à 60 s) : timeouts, cache, repli. **Jamais de secret côté client** :
  proxys serveur `/api/voice/tts`, `/api/voice/stt`.
- Français parlé : Web Speech API du navigateur (`speechSynthesis`, fr-FR), sans réseau.
- Chaque écran FARMER : pictogramme + libellé court + bouton 🔊 « Écouter ». Cibles tactiles ≥ 48 px, contraste AA,
  3 gestes max pour les tâches clés, aucun texte obligatoire à taper hors téléphone/PIN (choix par pictogrammes).
- Connexion : téléphone + PIN 4 chiffres (pavé numérique géant). Blocage 15 min après 5 échecs. Pas d'e-mail.

## 6. Connectivité limitée

- PWA : `public/manifest.webmanifest`, service worker `public/sw.js` (pré-cache coquille + pages clés, stale-while-revalidate
  pour les GET, page hors ligne), bandeau « Hors ligne ».
- File d'attente hors ligne (IndexedDB) pour signalements et accusés de réception, rejouée au retour du réseau
  (idempotence via `clientId`).
- Poids : JS de la page d'accueil fermier < 150 Ko gz, pas d'images lourdes (SVG), photos compressées côté client (≤ 1280 px, webp q 0.7).
- Mode « économie de données » : pas de tuiles de carte par défaut pour FARMER (liste), carte pour AGENT.

## 7. Routes (App Router, `src/app`)

Public : `/` (accueil + choix langue), `/connexion`, `/inscription`, `/reglementation`, `/reglementation/[slug]`,
`/marche` (annonces + prix de référence, lecture seule), `/verifier/[code]`, `/hors-ligne`, `/modelisation` (UML).
FARMER : `/app` (tableau de bord pictos), `/app/parcelles`, `/app/parcelles/nouvelle`, `/app/parcelles/[id]`
(météo 7 j + alertes + calendrier), `/app/alertes`, `/app/signaler`, `/app/marche` (mes annonces, offres reçues),
`/app/marche/nouvelle`, `/app/redevances` (déclarer, mes quittances), `/app/quittance/[id]`, `/app/profil`.
BUYER : `/acheteur` (marché + mes offres).
AGENT : `/agent` (carte + KPI), `/agent/signalements`, `/agent/signalements/[id]`, `/agent/alertes` (émettre),
`/agent/recettes`, `/agent/sms` (simulateur SMS/USSD — DÉMO).
ADMIN : `/admin` + `/admin/{cultures,ravageurs,reglementation,prix,redevances,utilisateurs,audit}`.
API : `/api/cron/monitoring`, `/api/voice/tts`, `/api/voice/stt`, `/api/reports/[id]/photo` (autorisé),
`/api/offline/sync`, `/api/health`.

Mutations : **Server Actions** avec zod + contrôle de rôle et de propriété (`requireRole`, `requireOwner`).

## 8. Sécurité (bloquant pour la livraison)

Contrôle d'accès à chaque action et à chaque objet (IDOR interdit) ; zod partout ; PIN argon2id ; rate-limit en base
(login, signalement, STT) ; en-têtes (CSP stricte, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
autorisant micro/géoloc sur self) via `next.config.ts` ; upload : taille ≤ 2 Mo avant parsing, signature magique vérifiée,
jamais servi depuis `public/` ; aucun secret dans le code ni dans le client ; `.env` ignoré ; `AuditLog` sur actions AGENT/ADMIN ;
erreurs génériques côté client, détail en log serveur ; données personnelles minimales (pas de CNI).

## 9. Données de démonstration (fictives, ancrées au Bénin)

Communes réelles avec coordonnées (Cotonou, Abomey-Calavi, Porto-Novo, Bohicon, Abomey, Parakou, Djougou, Natitingou,
Kandi, Malanville, Savè, Dassa-Zoumè, Lokossa, Aplahoué, Pobè, Kétou, Ouidah, Allada, Banikoara, Tanguiéta…).
Cultures : maïs, manioc, igname, coton, soja, riz, anacarde, ananas, niébé, tomate, piment, arachide.
Ravageurs/maladies : chenille légionnaire d'automne, mouche des fruits, criquet, mildiou, striure du maïs, mosaïque du manioc,
cochenille farineuse du manioc, bruche du niébé, aleurode.
Comptes démo (PIN `1234` sauf mention) : agricultrice `+2290197000001` (Ablawa, Bohicon, 3 parcelles), agriculteur `+2290197000002`
(Parakou), acheteur `+2290197000010`, agent `+2290197000020`, admin `+2290197000099` (PIN `9876`). Tous les noms sont fictifs.

## 10. Livrables documentaires

`docs/SPEC.md` (ce fichier), `docs/ARCHITECTURE.md`, `docs/uml/` (cas d'utilisation, classes, séquence « alerte climatique
automatique », séquence « signalement ravageur → validation → alerte de zone ») en Mermaid + page `/modelisation`,
`docs/DESIGN.md`, `docs/SECURITY.md`, `README.md` (démarrage, comptes démo, parcours de démo), `docs/DEMO.md`.

## 11. Propriété des fichiers (vague 1 — écritures disjointes)

| Agent | Écrit uniquement dans |
|---|---|
| fondation (database/backend) | `prisma/`, `src/lib/db.ts`, `src/lib/auth/`, `src/lib/security/`, `src/lib/validation/`, `src/proxy.ts`, `next.config.ts`, `package.json` (scripts), `.env.example`, `vitest.config.ts` |
| design (ui-ux) | `src/app/globals.css`, `src/components/ui/`, `src/components/icons/`, `src/app/layout.tsx`, `docs/DESIGN.md`, `public/manifest.webmanifest`, `public/icons/` |
| monitoring (backend) | `src/lib/monitoring/` (pur TS + tests, sans Prisma direct : interfaces d'entrée/sortie) |
| langues (backend) | `src/lib/i18n/`, `src/lib/langues/`, `scripts/i18n/`, `public/audio/` |
| modélisation (architecte) | `docs/ARCHITECTURE.md`, `docs/uml/` |

Toute écriture hors de sa zone est interdite ; un besoin chez un autre → noter dans son rapport final.
Pas de commit git : l'orchestrateur commit.
