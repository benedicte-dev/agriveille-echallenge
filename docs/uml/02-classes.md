# 02 — Diagramme de classes du domaine

> Source de vérité : [SPEC §3](../SPEC.md#3-modèle-de-données-source-de-vérité--prismaschemaprisma), puis `prisma/schema.prisma`.
> Les **attributs** reflètent exactement le modèle persistant. Les **méthodes** sont les règles métier du domaine :
> elles sont implémentées dans des services serveur (`src/lib/...`) et non dans Prisma, qui ne produit que des types de données.
> Le diagramme décrit donc le modèle conceptuel. Chaque méthode indique le service qui en porte la responsabilité (voir le tableau en fin de page).

## Conventions

- Types : `String`, `Int` (montants en **FCFA entiers**, quantités en **kg**), `Float` (coordonnées, surfaces en ha),
  `DateTime`, `Boolean`, `Json`, `Bytes`. `Int[]` est un tableau PostgreSQL.
- Un attribut suffixé `[0..1]` est facultatif (nullable).
- Identifiants : `String` cuid. Textes multilingues : triplets `xxxFr`, `xxxFon [0..1]`, `xxxYo [0..1]`.
- `*--` composition (la partie n'existe pas sans le tout, suppression en cascade), `o--` agrégation (le tout regroupe
  des parties qui lui survivent), `-->` association navigable, `--` association simple.
- Noms d'énumérations, types et nullabilités alignés sur `prisma/schema.prisma` (lu le 25/09/2026). Les écarts avec la SPEC sont listés en fin de page.

Le modèle est découpé en trois vues détaillées précédées d'une vue d'ensemble. Dans chaque vue, les classes
détaillées ailleurs sont présentées réduites à leur nom.

## Vue d'ensemble (simplifiée)

```mermaid
classDiagram
    direction LR
    class User
    class Session
    class Commune
    class Parcel
    class Planting
    class Crop
    class Pest
    class WeatherSnapshot
    class Alert
    class AlertDelivery
    class PestReport
    class SmsOutbox
    class Listing
    class Offer
    class ReferencePrice
    class LevyRate
    class Declaration
    class Regulation
    class AuditLog
    class TranslationCache
    class AudioCache
    class RateLimit

    User "1" *-- "0..*" Session : s'authentifie par
    User "1" --> "0..*" Parcel : possède
    Commune "1" o-- "0..*" Parcel : situe
    Parcel "1" *-- "0..*" Planting : contient
    Crop "1" <-- "0..*" Planting : cultive
    Crop "0..*" -- "0..*" Pest : est attaquée par
    Parcel "1" *-- "0..*" WeatherSnapshot : met en cache
    Alert "1" *-- "0..*" AlertDelivery : est livrée par
    User "1" <-- "0..*" AlertDelivery : destinataire
    PestReport "0..1" <-- "0..*" Alert : déclenche
    User "1" <-- "0..*" PestReport : signale
    Alert "0..1" <-- "0..*" SmsOutbox : simule
    User "1" --> "0..*" Listing : publie
    Listing "1" *-- "0..*" Offer : reçoit
    User "1" <-- "0..*" Offer : fait
    Crop "1" <-- "0..*" ReferencePrice : cote
    User "1" --> "0..*" Declaration : déclare
    LevyRate "1" <-- "0..*" Declaration : applique
    User "0..1" <-- "0..*" AuditLog : trace
```

`Regulation`, `TranslationCache`, `AudioCache` et `RateLimit` n'ont pas d'association : ce sont des contenus ou des caches autonomes.

## Vue 1 — Noyau et monitoring

```mermaid
classDiagram
    direction TB

    class User {
        +String id
        +String phone
        +String pinHash
        +String fullName
        +Role role
        +Locale locale
        +String communeId [0..1]
        +String organization [0..1]
        +Boolean isActive
        +Int failedLogins
        +DateTime lockedUntil [0..1]
        +DateTime createdAt
        +DateTime lastLoginAt [0..1]
        +isLocked(now DateTime) Boolean
        +registerFailedLogin(now DateTime) void
        +resetFailedLogins() void
        +hasRole(roles Role[]) Boolean
    }

    class Commune {
        +String id
        +String name
        +String department
        +Float lat
        +Float lon
        +AgroZone agroZone
    }

    class Parcel {
        +String id
        +String ownerId
        +String name
        +String communeId
        +Float lat
        +Float lon
        +Float areaHa
        +DateTime createdAt
        +distanceKmTo(lat Float, lon Float) Float
        +activePlantings() Planting[]
        +needsWeatherRefresh(now DateTime) Boolean
    }

    class Planting {
        +String id
        +String parcelId
        +String cropId
        +DateTime sowingDate
        +DateTime expectedHarvestDate
        +PlantingStatus status
        +Int estimatedYieldKg [0..1]
        +daysToHarvest(now DateTime) Int
        +startGrowing() void
        +markHarvested() void
    }

    class Crop {
        +String id
        +String slug
        +String nameFr
        +String nameFon [0..1]
        +String nameYo [0..1]
        +String icon
        +Int cycleDays
        +Int[] sowingMonths
        +Int[] harvestMonths
        +Int minRainMm
        +Float optimalTempMin
        +Float optimalTempMax
        +String notes [0..1]
        +isSowingMonth(month Int) Boolean
        +expectedHarvestFrom(sowing DateTime) DateTime
    }

    class Pest {
        +String id
        +String slug
        +String nameFr
        +String nameFon [0..1]
        +String nameYo [0..1]
        +PestKind kind
        +String symptomsFr
        +String preventionFr
        +String treatmentFr
        +Float riskTempMin [0..1]
        +Float riskTempMax [0..1]
        +Float riskHumidityMin [0..1]
        +String imageKey [0..1]
        +isRiskDay(day DailyForecast) Boolean
    }
    note for Pest "symptoms, prevention et treatment existent aussi en Fon et Yo (nullables)"

    class WeatherSnapshot {
        +String id
        +String parcelId
        +DateTime fetchedAt
        +String source
        +Json payload
        +DateTime expiresAt
        +isFresh(now DateTime) Boolean
        +days() DailyForecast[]
    }

    class DailyForecast {
        <<valeur>>
        +String date
        +Float tmax
        +Float tmin
        +Float precipitationMm
        +Float humidityMean
        +Float windMaxKmh
        +Float et0Mm
    }

    class Alert {
        +String id
        +AlertType type
        +AlertSeverity severity
        +AlertSource source
        +String titleFr
        +String messageFr
        +String adviceFr [0..1]
        +String parcelId [0..1]
        +String communeId [0..1]
        +Float lat [0..1]
        +Float lon [0..1]
        +Float radiusKm [0..1]
        +String pestId [0..1]
        +String reportId [0..1]
        +DateTime validFrom
        +DateTime validUntil
        +String createdById [0..1]
        +DateTime createdAt
        +String dedupKey
        +deliverTo(users User[], channels DeliveryChannel[]) AlertDelivery[]
        +isActive(now DateTime) Boolean
        +coversPoint(lat Float, lon Float) Boolean
        +localized(locale Locale) String
    }
    note for Alert "title, message et advice existent aussi en Fon et Yo (nullables, repli fr). dedupKey unique, ex. DROUGHT:parcelId:2026-09-25"

    class AlertDelivery {
        +String id
        +String alertId
        +String userId
        +DeliveryChannel channel
        +DeliveryStatus status
        +DateTime sentAt
        +DateTime readAt [0..1]
        +DateTime acknowledgedAt [0..1]
        +markRead(now DateTime) void
        +acknowledge(now DateTime) void
    }
    note for AlertDelivery "unique(alertId, userId, channel). Transitions SENT vers READ vers ACKNOWLEDGED, idempotentes"

    class PestReport {
        +String id
        +String reporterId
        +String parcelId [0..1]
        +String communeId
        +Float lat
        +Float lon
        +String pestId [0..1]
        +String description [0..1]
        +String voiceTranscript [0..1]
        +String voiceLang [0..1]
        +Bytes photo [0..1]
        +String photoMime [0..1]
        +ReportStatus status
        +String reviewedById [0..1]
        +DateTime reviewedAt [0..1]
        +String reviewNote [0..1]
        +DateTime createdAt
        +String clientId [0..1]
        +confirm(agent User, pestId String, radiusKm Float) Alert
        +reject(agent User, note String) void
    }
    note for PestReport "photo 300 Ko au plus, type vérifié par signature magique (webp, jpeg, png selon le schéma). clientId unique : idempotence de la file hors ligne"

    class SmsOutbox {
        +String id
        +String toPhone
        +String body
        +String lang
        +String alertId [0..1]
        +DateTime createdAt
    }

    class Role {
        <<enumeration>>
        FARMER
        BUYER
        AGENT
        ADMIN
    }
    class Locale {
        <<enumeration>>
        fr
        fon
        yo
    }
    class AgroZone {
        <<enumeration>>
        PDA1
        PDA2
        PDA3
        PDA4
        PDA5
        PDA6
        PDA7
    }
    class PlantingStatus {
        <<enumeration>>
        PLANNED
        GROWING
        HARVESTED
    }
    class PestKind {
        <<enumeration>>
        PEST
        DISEASE
    }
    class AlertType {
        <<enumeration>>
        DROUGHT
        HEAVY_RAIN
        HEAT
        WIND
        PEST_RISK
        PEST_OUTBREAK
        SOWING_WINDOW
        HARVEST_WINDOW
    }
    class AlertSeverity {
        <<enumeration>>
        INFO
        WARNING
        CRITICAL
    }
    class AlertSource {
        <<enumeration>>
        AUTO_WEATHER
        PEST_REPORT
        AGENT_MANUAL
    }
    class DeliveryChannel {
        <<enumeration>>
        IN_APP
        SMS_SIM
        USSD_SIM
        PUSH
    }
    class DeliveryStatus {
        <<enumeration>>
        SENT
        READ
        ACKNOWLEDGED
    }
    class ReportStatus {
        <<enumeration>>
        PENDING
        CONFIRMED
        REJECTED
    }

    User "0..*" --> "0..1" Commune : réside
    User "1" --> "0..*" Parcel : possède
    Commune "1" o-- "0..*" Parcel : situe
    Parcel "1" *-- "0..*" Planting : contient
    Planting "0..*" --> "1" Crop : cultive
    Crop "0..*" -- "0..*" Pest : est attaquée par
    Parcel "1" *-- "0..*" WeatherSnapshot : met en cache
    WeatherSnapshot "1" *-- "7" DailyForecast : payload
    Alert "0..*" --> "0..1" Parcel : cible
    Alert "0..*" --> "0..1" Commune : cible
    Alert "0..*" --> "0..1" Pest : concerne
    Alert "0..*" --> "0..1" User : créée par
    Alert "1" *-- "0..*" AlertDelivery : est livrée par
    AlertDelivery "0..*" --> "1" User : destinataire
    PestReport "0..*" --> "1" User : signalé par
    PestReport "0..*" --> "0..1" User : examiné par
    PestReport "0..*" --> "0..1" Parcel : concerne
    PestReport "0..*" --> "1" Commune : situé dans
    PestReport "0..*" --> "0..1" Pest : identifié comme
    Alert "0..*" --> "0..1" PestReport : issue de
    SmsOutbox "0..*" --> "0..1" Alert : relaie

    User ..> Role
    User ..> Locale
    Commune ..> AgroZone
    Planting ..> PlantingStatus
    Pest ..> PestKind
    Alert ..> AlertType
    Alert ..> AlertSeverity
    Alert ..> AlertSource
    AlertDelivery ..> DeliveryChannel
    AlertDelivery ..> DeliveryStatus
    PestReport ..> ReportStatus
```

`DailyForecast` est un objet valeur (stéréotype `«valeur»`) : il n'a pas de table, il est sérialisé dans `WeatherSnapshot.payload`.
C'est l'entrée du moteur de règles pur `src/lib/monitoring/rules.ts`.

## Vue 2 — Marché et recettes

```mermaid
classDiagram
    direction TB

    class User
    class Crop
    class Commune

    class Listing {
        +String id
        +String sellerId
        +String cropId
        +String title
        +Int quantityKg
        +Int pricePerKgFcfa
        +Market market
        +String communeId
        +DateTime availableFrom
        +String qualityNote [0..1]
        +String certification [0..1]
        +ListingStatus status
        +DateTime createdAt
        +totalValueFcfa() Int
        +reserve() void
        +markSold() void
        +close() void
    }

    class Offer {
        +String id
        +String listingId
        +String buyerId
        +Int quantityKg
        +Int pricePerKgFcfa
        +String message [0..1]
        +OfferStatus status
        +DateTime createdAt
        +accept(seller User) void
        +reject(seller User) void
        +withdraw(buyer User) void
    }
    note for Offer "accept() fait passer l'annonce en RESERVED. Seul le vendeur accepte ou refuse, seul l'acheteur retire"

    class ReferencePrice {
        +String id
        +String cropId
        +String communeId [0..1]
        +Market market
        +Int pricePerKgFcfa
        +DateTime observedAt
        +isNational() Boolean
    }

    class LevyRate {
        +String id
        +String code
        +String labelFr
        +String labelFon [0..1]
        +String labelYo [0..1]
        +LevyBasis basis
        +Int rate
        +Boolean active
        +computeAmount(quantityKg Int, valueFcfa Int) Int
    }
    note for LevyRate "PER_KG : rate en FCFA par kg. PERCENT_VALUE : rate en points de base (1 % = 100). FLAT : montant fixe"

    class Declaration {
        +String id
        +String farmerId
        +String levyRateId
        +String cropId [0..1]
        +Int quantityKg [0..1]
        +Int declaredValueFcfa [0..1]
        +Int amountDueFcfa
        +DeclarationStatus status
        +String receiptNumber
        +String verificationCode
        +DateTime paidAt [0..1]
        +String validatedById [0..1]
        +DateTime createdAt
        +computeAmountDue(rate LevyRate) Int
        +markPaid(now DateTime) void
        +validate(agent User) void
        +reject(agent User) void
        +verificationUrl() String
    }
    note for Declaration "amountDueFcfa calculé serveur, jamais fourni par le client. receiptNumber unique AV-2026-000123. verificationCode unique, 12 caractères, dans le QR"

    class Market {
        <<enumeration>>
        LOCAL
        EXPORT
    }
    class ListingStatus {
        <<enumeration>>
        OPEN
        RESERVED
        SOLD
        CLOSED
    }
    class OfferStatus {
        <<enumeration>>
        PENDING
        ACCEPTED
        REJECTED
        WITHDRAWN
    }
    class LevyBasis {
        <<enumeration>>
        PER_KG
        PERCENT_VALUE
        FLAT
    }
    class DeclarationStatus {
        <<enumeration>>
        SUBMITTED
        PAID
        VALIDATED
        REJECTED
    }

    Listing "0..*" --> "1" User : vendeur
    Listing "0..*" --> "1" Crop : produit
    Listing "0..*" --> "1" Commune : lieu
    Listing "1" *-- "0..*" Offer : reçoit
    Offer "0..*" --> "1" User : acheteur
    ReferencePrice "0..*" --> "1" Crop : cote
    ReferencePrice "0..*" --> "0..1" Commune : zone
    Declaration "0..*" --> "1" User : déclarant
    Declaration "0..*" --> "1" LevyRate : barème
    Declaration "0..*" --> "0..1" Crop : produit
    Declaration "0..*" --> "0..1" User : validée par

    Listing ..> Market
    ReferencePrice ..> Market
    Listing ..> ListingStatus
    Offer ..> OfferStatus
    LevyRate ..> LevyBasis
    Declaration ..> DeclarationStatus
```

## Vue 3 — Contenu et sécurité

```mermaid
classDiagram
    direction TB

    class User

    class Session {
        +String id
        +String tokenHash
        +String userId
        +DateTime expiresAt
        +DateTime createdAt
        +String userAgent [0..1]
        +isExpired(now DateTime) Boolean
        +revoke() void
    }
    note for Session "Jeton aléatoire de 32 octets dans le cookie av_session. Seul son SHA-256 est stocké. Durée 30 jours"

    class Regulation {
        +String id
        +String slug
        +RegulationCategory category
        +String titleFr
        +String titleFon [0..1]
        +String titleYo [0..1]
        +String summaryFr
        +String summaryFon [0..1]
        +String summaryYo [0..1]
        +String bodyFr
        +String bodyFon [0..1]
        +String bodyYo [0..1]
        +String sourceRef [0..1]
        +Boolean published
        +DateTime updatedAt
        +publish() void
        +localizedBody(locale Locale) String
    }
    note for Regulation "sourceRef seulement si le texte de loi est réel et connu. Aucune référence légale inventée"

    class AuditLog {
        +String id
        +String actorId [0..1]
        +String action
        +String entity
        +String entityId [0..1]
        +Json meta
        +String ip [0..1]
        +DateTime createdAt
        +record(actor User, action String, entity String, entityId String, meta Json) AuditLog$
    }

    class TranslationCache {
        +String id
        +String sourceHash
        +String lang
        +String source
        +String text
        +DateTime createdAt
        +keyFor(lang Locale, text String) String$
    }
    note for TranslationCache "sourceHash unique = sha256(lang + texte)"

    class AudioCache {
        +String id
        +String key
        +String lang
        +String mime
        +Bytes data
        +DateTime createdAt
        +keyFor(lang Locale, text String) String$
    }
    note for AudioCache "key unique = sha256(lang + texte). wav pour le fon, mp3 pour le yoruba"

    class RegulationCategory {
        <<enumeration>>
        PHYTO
        SEEDS
        EXPORT
        TAX
        LAND
        ORGANIC
    }
    class RateLimit {
        +String key
        +Int count
        +DateTime windowStart
        +DateTime updatedAt
        +hit(scope String, id String, limit Int, windowSec Int) Boolean$
    }
    note for RateLimit "Fenêtre fixe, key = scope:identifiant (login, signalement, STT). Ajouté par le schéma Prisma, non listé en SPEC 3"

    User "1" *-- "0..*" Session : s'authentifie par
    AuditLog "0..*" --> "0..1" User : acteur
    Regulation ..> RegulationCategory
```

`TranslationCache.lang` et `AudioCache.lang` sont des chaînes dans le schéma Prisma (et non l'énumération `Locale`) :
l'API 229langues nomme le yoruba `yoruba` pour la synthèse vocale et `yo` pour la traduction.
`RateLimit` n'a pas de lien vers `User` : sa clé porte l'identifiant (téléphone, identifiant utilisateur ou IP).

## Méthodes métier → responsable

| Méthode | Règle | Service responsable (unique) |
|---|---|---|
| `User.isLocked`, `registerFailedLogin` | 5 échecs → blocage 15 min | `src/lib/auth/` |
| `Session.isExpired`, `revoke` | 30 jours, jeton haché SHA-256 | `src/lib/auth/` |
| `Parcel.distanceKmTo`, `Alert.coversPoint` | formule de haversine | `src/lib/monitoring/` (pur) |
| `WeatherSnapshot.isFresh`, `Parcel.needsWeatherRefresh` | cache 3 h | service météo (orchestrateur monitoring) |
| `Pest.isRiskDay`, `Crop.isSowingMonth` | seuils SPEC §4 | `src/lib/monitoring/rules.ts` (pur) |
| `Alert.deliverTo` | IN_APP + SMS_SIM pour les FARMER concernés, `upsert` sur unique(alertId, userId, channel) | service d'alertes |
| `AlertDelivery.markRead`, `acknowledge` | transitions monotones, idempotentes | service d'alertes (Server Action + `/api/offline/sync`) |
| `PestReport.confirm`, `reject` | rôle AGENT/ADMIN, crée `PEST_OUTBREAK` (15 km par défaut), audit | service de signalements |
| `Offer.accept`, `reject`, `withdraw` | propriété vendeur / acheteur vérifiée | service marché |
| `LevyRate.computeAmount`, `Declaration.computeAmountDue` | calcul serveur, arrondi à l'entier FCFA | service recettes |
| `Declaration.markPaid`, `validate` | guichet AGENT ou « Payer (démo) » | service recettes |
| `RateLimit.hit` | quotas login, signalement, STT | `src/lib/security/` |
| `AuditLog.record` | toute action AGENT / ADMIN | `src/lib/security/` |
| `TranslationCache.keyFor`, `AudioCache.keyFor` | sha256(lang + texte) | `src/lib/langues/` |

## Écarts entre la SPEC §3 et le schéma Prisma

Relevés lors de l'alignement. Ils sont signalés à l'orchestrateur ; ce diagramme suit le schéma Prisma.

| N° | Élément | SPEC §3 | `schema.prisma` | Effet |
|---|---|---|---|---|
| 1 | `RateLimit` | absent | modèle ajouté (`key`, `count`, `windowStart`) | conforme à SPEC §8 « rate-limit en base » ; ajouté en vue 3 |
| 2 | `PestReport.photo`, `photoMime` | obligatoires | nullables (`Bytes?`, `String?`) | un signalement sans photo (voix seule) devient possible ; l'obligation, si voulue, doit être portée par zod |
| 3 | Formats de photo | webp / jpeg | commentaire : jpeg / webp / png | à trancher : la séquence 04 suit la SPEC (webp, jpeg) |
| 4 | `Alert.adviceFr` | non précisé | nullable | conseil facultatif |
| 5 | `Alert.reportId` | non précisé | non unique (`PestReport.alerts Alert[]`) | multiplicité `0..*` ; l'unicité d'une alerte de foyer par signalement repose sur `dedupKey = PEST_OUTBREAK:<reportId>` |
| 6 | `AgroZone` | « 8 pôles, ex. PDA1…PDA7 » | 7 valeurs `PDA1` à `PDA7` | la SPEC se contredit ; le schéma retient 7 pôles |
| 7 | `TranslationCache.lang`, `AudioCache.lang` | non typé | `String` | pas l'énumération `Locale` |
| 8 | `Crop.optimalTempMin/Max` | non typé | `Float` | — |
| 9 | `Commune.name` | non précisé | unique | — |
