# Sécurité

Public : le jury et les relecteurs du code. Ce document décrit uniquement les mesures présentes dans le code, avec le fichier qui les porte.

## Authentification (`src/lib/auth`)

- **PIN haché en argon2id** (`pin.ts`) avec les paramètres OWASP : 19 Mio, 2 passes, 1 fil. Le PIN n'est jamais stocké en clair.
- **Pas d'énumération de comptes.** Un numéro inconnu, un compte inactif ou un compte verrouillé déclenchent une vérification factice de même coût (`verifyPinAgainstDummy`) et renvoient un message d'erreur unique (`GENERIC_LOGIN_ERROR`).
- **Verrouillage du compte** (`lockout.ts`) : 5 échecs entraînent un blocage de 15 minutes. Le compteur est incrémenté de façon atomique en base.
- **Sessions en base** (`session.ts`, `token.ts`) : le jeton contient 32 octets aléatoires et seul son SHA-256 est stocké. Le cookie `av_session` est `httpOnly`, `SameSite=Lax`, `Secure` en production, et dure 30 jours. Un cookie mal formé est rejeté avant toute requête SQL. La connexion fait tourner la session (l'ancienne est supprimée). `revokeAllSessions` sert à la désactivation d'un compte ou au changement de PIN.
- **Autorisation côté serveur.** `requireUser` et `requireRole` relisent la session en base à chaque requête. ADMIN satisfait toujours une exigence AGENT, et un rôle non autorisé est renvoyé vers son propre espace.

## Garde de routes (`src/proxy.ts`)

Sans cookie de session, `/app`, `/acheteur`, `/agent` et `/admin` redirigent vers `/connexion`. Ce contrôle est seulement optimiste : la décision qui fait foi reste `requireRole` et le contrôle de propriété, côté serveur.

## Contrôle de propriété dans les Server Actions (anti-IDOR)

Chaque requête qui lit ou modifie un objet personnel filtre sur l'identifiant de l'utilisateur connecté, jamais sur une valeur venue du client :

- parcelles : `ownerId: user.id` (`src/app/app/parcelles/actions.ts`, `src/server/reports/service.ts`) ;
- accusés de réception : `userId: user.id` (`src/app/app/alertes/actions.ts`, `src/app/api/offline/sync/route.ts`) ;
- marché : `listing.sellerId !== ctx.actor.id` renvoie `not_found`, et les offres sont filtrées par `buyerId: ctx.actor.id` (`src/server/market/service.ts`) ;
- redevances : `farmerId: ctx.actor.id` (`src/server/levies/service.ts`), avec un montant dû toujours calculé par le serveur ;
- signalements : `reporterId: user.id` sauf pour AGENT et ADMIN (`src/server/reports/service.ts`).

`assertOwner` (alias `requireOwner`, dans `src/lib/auth/session.ts`) répond 404 plutôt que 403, pour ne pas confirmer l'existence d'un objet.

## Protections transverses (`src/lib/security`)

- **Limitation de débit** (`rate-limit.ts`, `rate-limit-core.ts`) : une table `RateLimit` et un upsert SQL atomique. Les limites sont les suivantes : connexion, 20 par IP en 15 min ; inscription, 5 par IP par heure ; signalements, 10 par utilisateur par heure ; reconnaissance vocale, 30 par heure ; synthèse vocale, 120 par IP par heure ; offres, 30 par heure ; synchronisation hors ligne, 60 en 15 min. En cas de panne de la base, la limitation laisse passer les requêtes (fail-open, voir les limites plus bas) ; le verrouillage de compte reste actif.
- **Images** (`image.ts`) : le type est reconnu par signature binaire (JPEG, PNG, WebP), jamais par l'extension ni par le type MIME déclaré. La taille déclarée est vérifiée avant lecture (2 Mo en entrée, 300 Ko stockés).
- **IP** (`ip.ts`) : l'IP est extraite de `x-forwarded-for` et validée. Elle sert uniquement à la limitation de débit et à l'audit, jamais à l'identification.
- **Journal d'audit** (`audit.ts`) : les actions AGENT et ADMIN sont journalisées. Les clés sensibles (`pin`, `password`, `token`, `secret`, `hash`, `photo`) sont retirées des métadonnées. Une erreur d'écriture n'interrompt pas l'action métier.
- **Validation** : des schémas zod s'appliquent aux entrées des Server Actions et des route handlers (`src/lib/validation`, `src/server/*/schemas.ts`).

## En-têtes HTTP (`next.config.ts`)

Ils s'appliquent à toutes les routes :

- `Content-Security-Policy` avec `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'` et `base-uri 'self'`. Seules les tuiles OpenStreetMap sont autorisées comme images externes, et `connect-src 'self'` s'applique parce qu'Open-Meteo et 229langues sont appelés côté serveur. `upgrade-insecure-requests` est actif en production.
- `Strict-Transport-Security` (2 ans, `includeSubDomains`, `preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`.
- `Permissions-Policy` : micro, géolocalisation et caméra limités à l'origine ; paiement et USB désactivés.
- `X-Powered-By` est désactivé.

## Cron

`/api/cron/monitoring` exige `Authorization: Bearer $CRON_SECRET`. Si `CRON_SECRET` est absent, la route reste fermée et répond 401.

## Gestion des secrets

- Les secrets sont lus depuis les variables d'environnement : `DATABASE_URL`, `CRON_SECRET`, `LANGUES_API_BASE`, `LANGUES_API_KEY`, `LANGUES_HF_TOKEN`. En production, ils sont définis dans Vercel. En local, ils vont dans `.env`, qui ne doit jamais être commité ; `.env.example` ne contient que des noms vides.
- Les clés 229langues ne sont utilisées que côté serveur (`src/lib/langues/client.ts`) et ne sont jamais exposées au navigateur. Les seules variables `NEXT_PUBLIC_*` sont `NEXT_PUBLIC_APP_URL` et `NEXT_PUBLIC_DEMO_MODE`, qui ne sont pas secrètes.
- Les comptes de démo ont des PIN connus, affichés sur `/connexion`. Mettez `NEXT_PUBLIC_DEMO_MODE=false` et ne lancez pas le seed pour une instance réelle.

## Limites connues

- Un PIN à 4 chiffres n'offre que 10 000 valeurs possibles. La protection repose sur le verrouillage et la limitation par IP, pas sur la force du secret.
- La CSP garde `'unsafe-inline'` pour les scripts et les styles (hydratation Next sans nonce). Elle ne protège donc que partiellement contre une injection de script.
- La limitation de débit laisse passer les requêtes si la base est indisponible. Ce choix privilégie la disponibilité au champ.
- Il n'y a pas de double facteur (OTP SMS), car le canal SMS est simulé.
- Le paiement est simulé : aucune donnée bancaire n'est traitée.
- La protection CSRF repose sur les Server Actions de Next (vérification de l'origine) et sur `SameSite=Lax`. Aucun jeton CSRF dédié n'est ajouté.
