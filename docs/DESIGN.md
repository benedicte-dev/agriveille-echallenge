# AgriVeille — Système de design

Source de vérité des décisions d'interface. Les tokens vivent dans `src/app/globals.css` (`@theme static`,
Tailwind v4), les pictogrammes dans `src/components/icons/`, les composants dans `src/components/ui/`
(catalogue : `src/components/ui/__catalogue.tsx`). Ce document dit **quoi** et **pourquoi** ; le code dit **comment**.

Utilisateurs cibles, par ordre de contrainte :

1. **Exploitant·e agricole**, parfois peu ou pas alphabétisé·e, Android d'entrée de gamme (écran 360 px,
   luminosité faible), en plein soleil, en 2G/3G intermittente, souvent une seule main libre.
2. **Agent de l'État** (DDAEP, phytosanitaire, recettes) sur ordinateur, qui traite des listes et décide.
3. **Acheteur**, **administrateur de contenu** : écrans « bureau » de l'agent.

Identité : terre (latérite), végétation, soleil. Sobre, institutionnel, très lisible. Interdits : dégradés,
glassmorphism, grilles « bento » décoratives, illustrations lourdes, photos d'ambiance, emoji dans l'interface.

---

## 1. Principes

1. **Pictogramme + mot + son.** Chaque action et chaque information importante du parcours fermier porte
   les trois : un pictogramme reconnaissable, un mot court (1 à 2 mots) et un bouton « Écouter »
   (`ListenButton`). Jamais une icône seule, jamais un mot seul sur une tuile.
2. **Trois gestes au plus** pour chaque tâche clé, depuis le tableau de bord fermier :
   | Tâche | Gestes |
   |---|---|
   | Lire et accuser une alerte | tuile Alertes → alerte → « J'ai compris » (3) |
   | Signaler un ravageur | tuile Signaler → photo → « Envoyer » (3 ; la parcelle et la position sont préremplies, la voix est facultative) |
   | Voir la météo d'un champ | tuile Mes champs → champ (2) |
   | Obtenir sa quittance | tuile Payer → quittance (2) |
   | Se connecter | pavé téléphone → pavé PIN (soumission automatique au 4e chiffre) |
3. **Rien à taper** hors téléphone et PIN : choix par pictogrammes, listes, pavé numérique, voix.
4. **Un écran, une décision.** L'action principale est unique, en bas de l'écran à portée de pouce,
   pleine largeur, 64 px de haut. Les actions secondaires sont en `secondary` ou `ghost`.
5. **Le réseau est une option.** Tout écran a un état hors ligne explicite ; les envois sont mis en file
   et le dire rassure (« Tout sera envoyé au retour du réseau »).
6. **La couleur n'est jamais seule** porteuse de sens (sévérité, statut, onglet actif).

## 2. Tokens

Palette par défaut de Tailwind **retirée** (`--color-*: initial`) : `bg-red-500` ne génère rien. On
n'utilise que des rôles. Le thème « contraste élevé » redéfinit les mêmes variables sous
`[data-contrast="high"]` (posé sur `<html>` par le layout depuis le cookie `av_contrast`, basculé par
`ContrastToggle`, sans script inline).

| Rôle | Clair | Contraste élevé | Usage |
|---|---|---|---|
| `canvas` | #f7f3ea | #ffffff | fond de page (papier chaud) |
| `surface` | #ffffff | #ffffff | cartes, champs |
| `sunken` | #efe8da | #f0f0f0 | retrait, squelettes, en-têtes de tableau, bouton désactivé |
| `ink` | #1f1b16 | #000000 | texte principal, anneau de focus (`focus`) |
| `ink-muted` | #5b5146 | #2b2b2b | aide, métadonnées |
| `line` | #ddd4c4 | #000000 | séparateurs **décoratifs** uniquement |
| `line-strong` | #857865 | #000000 | bord des champs et contrôles (≥ 3:1) |
| `primary` / `-hover` / `-soft` | #1e6b3a / #17552e / #e3f0e6 | #0b4a22 / #06331a / #fff | végétation : action principale, lien, actif |
| `earth` / `-hover` / `-soft` | #8f3f14 / #733210 / #f6e6db | #6b2a08 / #4f1f06 / #fff | latérite : marché, vendre |
| `sun` / `sun-ink` / `sun-soft` | #e0a21a / #8a5a00 / #fbefd0 | = / #5c3b00 / #fff | soleil : aplats et décor ; `sun` jamais en texte |
| `info` / `-soft` | #1d4f80 / #e4eef7 | #0a3560 / #fff | sévérité INFO |
| `warning` / `-soft` | #7a4e00 / #fbefd0 | #4d3100 / #fff | sévérité WARNING, hors ligne |
| `critical` / `-hover` / `-soft` | #a1241b / #821c15 / #fbe6e2 | #7a120b / #5c0d08 / #fff | sévérité CRITICAL, erreurs, bouton danger |
| `success` / `-soft` | #1e6b3a / #e3f0e6 | #0b4a22 / #fff | succès (= végétation) |

En contraste élevé, les fonds pâles deviennent blancs : l'information passe par les bordures 2 px noires
(les `Badge`, `Callout` et contrôles ont toujours une bordure) et par l'ombre remplacée par un trait de 2 px.

Autres tokens : `--radius-sm/md/lg/xl` = 4/8/12/16 px ; `--shadow-card` (une seule élévation utile),
`--shadow-raised` (lien d'évitement, menus) ; `--spacing-touch` = 48 px, `--spacing-touch-lg` = 64 px
(`h-touch`, `min-h-touch-lg`…) ; points de rupture 640/768/1024/1280 px (valeurs Tailwind par défaut).

## 3. Typographie

**Pile système** : `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", …`. Justification :

- **0 octet téléchargé** : en 2G une police web de 30 à 60 Ko retarde le premier affichage de plusieurs
  secondes ; `next/font/google` (Geist) du gabarit a été retiré.
- **Couverture des diacritiques** : le fɔngbe (ɔ, ɛ, ɖ, tons combinés ǐ, ɛ̀) et le yorùbá (ẹ, ọ, ṣ, tons)
  sont couverts par Roboto / Noto Sans, polices système des Android visés. Une police web chargée en
  sous-ensemble `latin` (cas du gabarit) exclut ɔ, ɛ, ɖ (blocs IPA / Latin étendu B) et tomberait en
  police de repli au milieu d'un mot. Rendu vérifié dans Chromium Linux (catalogue, section Typographie) ;
  à confirmer sur un Android réel.
- Roboto / Segoe UI ont des chiffres nets et des formes ouvertes, lisibles en basse résolution.

| Token | Taille | Interligne | Usage |
|---|---|---|---|
| `text-xs` | 14 px | 1.35 | métadonnées agent, légendes de pictogrammes du catalogue |
| `text-sm` | 15 px | 1.4 | tableaux agent, aides, badges |
| `text-base` | **17 px** | 1.5 | **corps, minimum du parcours fermier** (mobile et bureau) |
| `text-lg` | 20 px | 1.35 | libellés de tuiles, titres de carte |
| `text-xl` | 24 px | 1.25 | h1 mobile |
| `text-2xl` | 30 px | 1.2 | h1 bureau, chiffres KPI |
| `text-3xl` | 36 px | 1.1 | chiffres du pavé PIN |

Graisses : 400 texte, 600 libellés et boutons, 700 titres et valeurs. Chiffres tabulaires dans les
tableaux, montants, météo. Le zoom navigateur reste permis (pas de `maximumScale`), la taille de base
n'est pas bloquée (`text-size-adjust: 100%`).

## 4. Espacements et mise en page

Base 4 px (`--spacing: 0.25rem`) ; on utilise 4, 8, 12, 16, 24, 32 px (`1, 2, 3, 4, 6, 8`).

- Marges de page : 16 px mobile, 24 px tablette, 32 px bureau. Écart entre tuiles : 12 px (16 px ≥ 640).
- Largeur de lecture : 768 px (`max-w-3xl`) pour le fermier et le public ; 1280 px pour l'agent.
- Cibles : **48 × 48 px minimum** partout (`Button sm`), 56 par défaut, **64** pour l'action principale
  fermier, **72** pour les touches du pavé et la barre basse, **≥ 144** pour les tuiles.
- Espace entre cibles adjacentes ≥ 8 px.

| Largeur | Fermier (`AppShell farmer`) | Agent (`AppShell staff`) |
|---|---|---|
| < 640 px | barre basse fixe 4 items, tuiles 2 colonnes | menu repliable `<details>`, tableaux en cartes |
| 640–1023 | barre sous l'en-tête, tuiles 3 colonnes | idem, tableaux en `<table>` dès 768 |
| ≥ 1024 | idem, contenu 768 px centré | barre latérale 256 px + contenu |

Vérifié à 360 px et 1280 px dans Chromium : aucun défilement horizontal de page.

## 5. Les cinq états

Chaque composant de données a ses cinq états, spécifiés et visibles dans le catalogue.

| État | Composant | Règle |
|---|---|---|
| Chargement | `LoadingBlock` (`lines`, `cards`, `weather`) | squelette à la forme du contenu (pas de saut), libellé lu (`role="status"`). Au-delà de 10 s : Callout « Le réseau est lent, on continue… » + contenu en cache s'il existe |
| Vide — première fois | `EmptyState kind="first-use"` | pictogramme, phrase qui explique à quoi sert l'écran, **une** action (« Ajouter un champ ») |
| Vide — aucun résultat | `EmptyState kind="no-results"` | fond retrait, dit que le filtre ne donne rien, propose d'élargir (« Effacer les filtres ») |
| Erreur | `Callout tone="critical" role="alert"` ; `Field error` | ce qui s'est passé en mots simples + ce qui est gardé + « Réessayer ». Jamais de code technique |
| Hors ligne | `OfflineBanner` (global) ; `Callout tone="offline"` | bandeau soleil pâle collé en haut, pictogramme + « Hors ligne » + phrase rassurante ; le contenu en cache reste utilisable ; envois en file |
| Succès | `Callout tone="success" role="status"` | confirmation + ce qui va se passer ensuite (« Un agent va le regarder ») |

## 6. Sévérités INFO / WARNING / CRITICAL

La sévérité est portée par **trois canaux indépendants** : forme, mot, couleur (plus le remplissage pour CRITICAL).

| Sévérité | Pictogramme | Mot (fr) | Badge | Usage |
|---|---|---|---|---|
| INFO | cercle « i » (`IconInfo`) | Information | contour bleu sur bleu pâle | fenêtres de semis / récolte |
| WARNING | triangle « ! » (`IconAlerte`) | Attention | contour ocre sur soleil pâle | sécheresse, forte pluie, chaleur, vent, risque ravageur |
| CRITICAL | octogone « ! » (`IconDanger`) | Danger | **plein** rouge, texte blanc | seuils critiques, foyer confirmé |

Les cartes d'alerte ajoutent un liseré gauche de 4 px de la couleur de sévérité (`Card accent`), l'ordre
est CRITICAL → WARNING → INFO puis date. Les mots sont traduits (props `labels` depuis `alert.severity.*`).

## 7. Accessibilité : cibles mesurables

| Critère | Cible | Vérification |
|---|---|---|
| Contraste texte | ≥ 4.5:1 (AA), sur les deux thèmes | tableau §10 (script) + audit Chromium de chaque texte rendu du catalogue : 0 échec |
| Contraste non-texte (bords de champs, icônes porteuses, focus) | ≥ 3:1 | tableau §10 |
| Cibles tactiles | ≥ 48 × 48 px | audit Chromium : 0 cible < 48 px (catalogue, coquilles fermier et agent, 360 et 1280 px) |
| Focus visible | anneau 3 px `ink`, décalé 2 px, sur `:focus-visible`, identique sur les deux thèmes | parcours Tab complet : anneau présent à chaque arrêt |
| Clavier | tout est atteignable et activable ; pavé PIN utilisable au clavier physique | parcours Tab ; `PinPad` = vrai `<input>` |
| Lien d'évitement | « Aller au contenu » → `#contenu`, premier arrêt Tab | layout |
| Lecteurs d'écran | `lang` sur `<html>` et sur chaque nom de langue ; badges lus (« 3 nouvelles alertes ») ; `aria-current="page"` ; erreurs reliées par `aria-describedby` et `role="alert"` | revue du DOM |
| Mouvement | `prefers-reduced-motion: reduce` → animations et transitions à 0.01 ms | globals.css |
| Zoom | 200 % sans perte ; pas de `maximumScale` | viewport |

Règles pour les pages : un seul `h1` (`PageHeader`) ; chaque page a un `<main id="contenu">`
(fourni par `AppShell` / `PublicShell`) ; les conteneurs sombres sont proscrits (l'anneau `ink` y serait invisible).

### Mouvement

Seul mouvement : `transition-colors` 120 ms `cubic-bezier(0.2, 0, 0, 1)` sur fond et bordure au survol / appui ;
rotation du `Spinner` 0.8 s ; pulsation des squelettes 1.6 s. Aucune animation ne retarde une interaction.
Sous `prefers-reduced-motion`, tout est coupé (le squelette reste statique, le libellé reste).

## 8. Pictogrammes

Originaux, grille 24 × 24, trait 2 px, extrémités et jonctions arrondies, `currentColor`. Décoratifs par
défaut (`aria-hidden`) ; avec `title` ils deviennent `role="img"`. Taille : 24 (boutons), 28 (barre basse),
44–48 (tuiles, états vides). Jeu : `icons[clé]` (actions, météo, voix, navigation, utilitaires, `danger`,
`marque`), `cropIcons[slug]` (12 cultures) + `getCropIcon()` avec repli, `alertTypeIcons[AlertType]`,
`severityIcons[Severity]`.

## 9. Écrans

### 9.1 Accueil public `/`

Hiérarchie : 1) choisir sa langue, 2) comprendre en une phrase ce que fait AgriVeille, 3) se connecter.

- En-tête `PublicShell` : marque ; à droite `ContrastToggle`.
- Bloc 1 (au-dessus de la ligne de flottaison à 360 px) : `LanguageSwitcher variant="cards"` — trois
  boutons de 64 px « Français », « Fɔngbe », « Yorùbá », chacun écrit dans sa langue avec `lang`. Choisir
  = 1 geste, la page se recharge dans la langue.
- Bloc 2 : `h1` = `app.tagline` + `ListenButton` (audio pré-généré fon/yo) ; trois lignes pictogramme + mot :
  Météo de mes champs · Alertes ravageurs · Vendre et payer.
- Bloc 3 : `Button lg block` « Se connecter » (primaire), « Créer un compte » (secondaire).
- Pied : liens Règles, Prix du marché, Vérifier une quittance (`IconQr`), mention « Démonstration ».

### 9.2 Tableau de bord fermier `/app`

Hiérarchie : 1) y a-t-il une alerte pour moi ? 2) aller vers une des 6 tâches, 3) la météo du jour.

- `AppShell variant="farmer"` : barre basse 4 items (Accueil, Mes champs, Alertes avec badge, Profil).
- `PageHeader` : « Bonjour Ablawa », sous-titre commune · nombre de champs, `ListenButton` qui lit la
  salutation **et** le résumé (« Vous avez 2 alertes »).
- Si alerte CRITICAL ou WARNING non accusée : `Card accent` de l'alerte la plus grave, tout en haut, avec
  `SeverityBadge`, titre, `ListenButton` et « J'ai compris » (1 geste pour accuser).
- `TileGrid` de **6 `IconTile`** (2 colonnes à 360 px, 3 dès 640) :
  | Tuile | Picto | Ton | Lien | Particularité |
  |---|---|---|---|---|
  | Mes champs | `champ` | primary | `/app/parcelles` | aide « 3 champs » |
  | Alertes | `alerte` | sun | `/app/alertes` | `badge` = non lues, lu « N nouvelles alertes » |
  | Signaler | `signaler` | critical | `/app/signaler` | |
  | Vendre | `vendre` | earth | `/app/marche` | aide « 2 offres » si offres reçues |
  | Payer | `payer` | info | `/app/redevances` | aide « Quittances » |
  | Règles | `regle` | neutral | `/reglementation` | |
- Sous les tuiles : météo du jour du premier champ (1 `WeatherDay` + lien « 7 jours »).

### 9.3 Fiche parcelle `/app/parcelles/[id]`

Hiérarchie : 1) quel danger cette semaine ? 2) quel temps les 7 prochains jours ? 3) que faire et quand (calendrier).

- `PageHeader` : retour « Mes champs », pictogramme de la culture (`getCropIcon`), nom du champ, sous-titre
  « Maïs · 1,5 ha · Bohicon », `ListenButton` (résumé météo + alertes).
- **Alertes actives** : liste de `Card accent` triées par sévérité, chacune `SeverityBadge` + titre + conseil
  + `ListenButton variant="icon"` + « J'ai compris ». Vide : `EmptyState first-use` sobre « Aucune alerte
  pour ce champ » (pictogramme `check`).
- **Météo 7 jours** : `WeatherStrip` de 7 `WeatherDay` (défilement horizontal à 360 px, grille 7 colonnes
  dès 768). Jour courant bordé `primary` ; jour touché par une alerte : liseré de sévérité + pictogramme
  de sévérité titré. Source et heure de mise à jour en `text-sm` (« Open-Meteo · mis à jour à 14 h »),
  « données d'hier » si cache expiré hors ligne.
- **Calendrier cultural** : frise des 12 mois (`IconCalendrier`), mois de semis en `primary-soft` + mot
  « Semis » + `IconSemis`, mois de récolte `sun-soft` + « Récolte » + `IconRecolte`, mois courant encadré.
  Sous la frise : « Semé le 12 juin · récolte prévue vers le 10 octobre ».
- Chargement : `LoadingBlock shape="weather"` ; hors ligne : dernier snapshot + `Callout offline`.

### 9.4 Tableau de bord agent `/agent`

Hiérarchie : 1) que dois-je traiter maintenant (signalements en attente) ? 2) les alertes sont-elles lues
(taux d'accusés) ? 3) où (carte) et combien (recettes) ?

- `AppShell variant="staff"` : barre latérale (Tableau de bord, Signalements avec badge, Émettre une alerte,
  Recettes, Simulateur SMS — DÉMO) ; ADMIN ajoute les entrées CMS.
- `PageHeader` + action « Lancer l'analyse » (`Button primary`, `loading` pendant l'analyse, puis
  `Callout success` « 12 alertes créées, 3 doublons ignorés »).
- Rangée de 4 `StatCard` : Signalements à valider (critical), Alertes actives (warning), Taux d'accusés %
  (primary, aide « 94 sur 120 »), Recettes du mois FCFA (earth).
- Carte Leaflet (chargée dynamiquement) des signalements et alertes, à côté (≥ 1280) ou sous (< 1280) la
  liste « À traiter » (`DataTable` : commune, culture, ravageur, date, statut `Badge`, action « Examiner »).
  La carte a une alternative : la liste contient les mêmes données.
- Filtres : `Select` (département, période, statut) au-dessus du tableau ; aucun résultat → `EmptyState no-results`.

## 10. Contrastes mesurés

Calculés (formule WCAG 2.x de luminance relative) sur les valeurs de `globals.css`, script hors dépôt.
Seuil 4.5:1 pour le texte, 3:1 pour les éléments non textuels. **Toutes les paires passent.** `line`
(séparateurs décoratifs, ≈ 1.3:1) est volontairement exclu : il ne porte jamais d'information.
L'anneau de focus étant décalé de 2 px, il se mesure contre le fond de page ou de carte, pas contre le bouton.

| Premier plan | Fond | Usage | Seuil | Clair | Contraste élevé |
|---|---|---|---|---|---|
| `ink` | `canvas` | corps | 4.5:1 | 15.46:1 | 21.00:1 |
| `ink` | `surface` | corps carte | 4.5:1 | 17.12:1 | 21.00:1 |
| `ink` | `sunken` | en-tête tableau | 4.5:1 | 14.04:1 | 18.43:1 |
| `ink-muted` | `canvas` | aide | 4.5:1 | 7.00:1 | 14.16:1 |
| `ink-muted` | `surface` | aide carte | 4.5:1 | 7.75:1 | 14.16:1 |
| `ink-muted` | `sunken` | aide retrait | 4.5:1 | 6.36:1 | 12.42:1 |
| `line-strong` | `surface` | bord champ (non-texte) | 3:1 | 4.31:1 | 21.00:1 |
| `line-strong` | `canvas` | bord contrôle | 3:1 | 3.89:1 | 21.00:1 |
| `on-primary` | `primary` | bouton primaire | 4.5:1 | 6.52:1 | 10.41:1 |
| `on-primary` | `primary-hover` | bouton survol | 4.5:1 | 8.84:1 | 14.04:1 |
| `primary` | `canvas` | lien | 4.5:1 | 5.89:1 | 10.41:1 |
| `primary` | `surface` | lien carte | 4.5:1 | 6.52:1 | 10.41:1 |
| `primary` | `primary-soft` | texte sur fond vert pâle | 4.5:1 | 5.55:1 | 10.41:1 |
| `earth` | `surface` | texte terre | 4.5:1 | 7.27:1 | 10.72:1 |
| `earth` | `earth-soft` | badge terre | 4.5:1 | 5.97:1 | 10.72:1 |
| `earth` | `canvas` | texte terre page | 4.5:1 | 6.56:1 | 10.72:1 |
| `sun-ink` | `surface` | icône soleil (non-texte) | 3:1 | 5.93:1 | 10.09:1 |
| `sun-ink` | `sun-soft` | texte sur soleil pâle | 4.5:1 | 5.18:1 | 10.09:1 |
| `ink` | `sun` | encre sur aplat soleil | 4.5:1 | 7.62:1 | 9.35:1 |
| `info` | `info-soft` | INFO badge | 4.5:1 | 7.20:1 | 12.42:1 |
| `info` | `surface` | INFO texte | 4.5:1 | 8.46:1 | 12.42:1 |
| `warning` | `warning-soft` | WARNING badge | 4.5:1 | 6.29:1 | 11.97:1 |
| `warning` | `surface` | WARNING texte | 4.5:1 | 7.20:1 | 11.97:1 |
| `critical` | `critical-soft` | CRITICAL badge | 4.5:1 | 6.29:1 | 10.94:1 |
| `critical` | `surface` | CRITICAL texte | 4.5:1 | 7.54:1 | 10.94:1 |
| `on-critical` | `critical` | bouton danger | 4.5:1 | 7.54:1 | 10.94:1 |
| `success` | `success-soft` | succès | 4.5:1 | 5.55:1 | 10.41:1 |
| `success` | `surface` | succès texte | 4.5:1 | 6.52:1 | 10.41:1 |
| `focus` | `canvas` | anneau focus | 3:1 | 15.46:1 | 21.00:1 |
| `focus` | `surface` | anneau focus carte | 3:1 | 17.12:1 | 21.00:1 |
| `focus` | `sunken` | anneau focus sur fond retrait | 3:1 | 14.04:1 | 18.43:1 |
| `focus` | `primary-soft` | anneau focus sur fond vert pâle | 3:1 | 14.57:1 | 21.00:1 |
| `ink` | `primary-soft` | texte de Callout succès | 4.5:1 | 14.57:1 | 21.00:1 |
| `ink` | `info-soft` | texte de Callout info | 4.5:1 | 14.57:1 | 21.00:1 |
| `ink` | `warning-soft` | texte bandeau hors ligne / Callout | 4.5:1 | 14.97:1 | 21.00:1 |
| `ink` | `critical-soft` | texte de Callout erreur | 4.5:1 | 14.28:1 | 21.00:1 |
| `ink` | `earth-soft` | texte sur fond terre | 4.5:1 | 14.07:1 | 21.00:1 |
| `on-critical` | `critical-hover` | bouton danger survol | 4.5:1 | 9.88:1 | 13.85:1 |
| `ink-muted` | `primary-soft` | aide sur vert pâle | 4.5:1 | 6.59:1 | 14.16:1 |
| `warning` | `canvas` | icône hors ligne / liseré (non-texte) | 3:1 | 6.50:1 | 11.97:1 |
| `line-strong` | `sunken` | bord contrôle sur retrait | 3:1 | 3.54:1 | 18.43:1 |

## 11. Composants (API résumée)

Serveur par défaut ; `"use client"` : `PinPad`, `ListenButton`, `LanguageSwitcher`, `OfflineBanner`,
`NavLink`, `ContrastToggle`, `ServiceWorkerRegister`, `__catalogue`. Aucune dépendance externe. Tous les
libellés sont des props (défauts en français) : les pages passent les traductions du dictionnaire.

| Composant | Props principales |
|---|---|
| `Button` | `variant` primary/secondary/danger/ghost · `size` sm 48/md 56/lg 64 · `icon` · `block` · `loading` + `loadingLabel` · `href` (rendu `next/link`) · `external` |
| `IconTile`, `TileGrid` | `href`, `icon`, `label`, `hint`, `badge` + `badgeLabel`, `tone` · `TileGrid label` |
| `Card` | `title`, `titleAs`, `actions`, `accent`, `padding`, `as` |
| `Badge`, `CountBadge` | `tone`, `icon`, `size` · `count`, `label` |
| `SeverityBadge` | `severity`, `labels`, `size` |
| `Callout` | `tone` info/warning/critical/success/offline, `title`, `action`, `role` |
| `Field` + `Input`/`Select`/`Textarea` | `id`, `label`, `hint`, `error`, `required`, `icon`, `children(a11yProps)` |
| `PinPad` | `name` (input caché), `label`, `mode` pin/phone, `length`, `autoSubmit`, `onChange`, `onComplete`, `error`, `labels` |
| `LanguageSwitcher` | `current`, `action(locale)` (ex. `setLocaleAction`), `variant` cards/compact, `label` |
| `ListenButton` | `text`, `lang`, `audioSrc?`, `labels`, `variant` pill/icon |
| `OfflineBanner` | `title`, `message` · hook `useOnline()` |
| `EmptyState` | `kind` first-use/no-results, `icon`, `title`, `message`, `action`, `listen` |
| `Skeleton`, `LoadingBlock` | `className` · `label`, `shape`, `count` |
| `PageHeader` | `title`, `icon`, `subtitle`, `backHref`, `backLabel`, `listen`, `actions` |
| `AppShell`, `PublicShell` | `variant` farmer/staff, `items: NavItem[]`, `homeHref`, `headerEnd`, `sidebarFooter` · `footer`, `width` |
| `StatCard` | `label`, `value`, `unit`, `icon`, `hint`, `tone` |
| `DataTable` | `caption`, `columns: Column<T>[]` (`cell`, `align`, `primary`, `hideOnMobile`), `rows`, `rowKey`, `empty` |
| `WeatherDay`, `WeatherStrip`, `weatherCondition()` | `dayLabel`, `condition`, `tMax`, `tMin`, `rainMm`, `windKmh`, `alert`, `today` |
| `ContrastToggle` | `initial`, `label`, `showLabel` |

Contrat `ListenButton` ↔ `/api/voice/tts` : `POST {text, lang: "fon"|"yo"}` → corps = octets audio
(`audio/wav` ou `audio/mpeg`) ; toute réponse non 2xx, vide ou JSON = état erreur, le texte reste à l'écran.
Délai max 60 s (premier appel 229langues), blobs mis en cache pour la page.
