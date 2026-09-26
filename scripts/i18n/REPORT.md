# Rapport de traduction automatique (fr → fon, yo)

Généré le 2026-09-26T09:26:28.349Z par `scripts/i18n/translate-messages.ts`.

> **Avertissement honnête.** Ces traductions sortent d'un moteur automatique (API 229langues).
> Elles n'ont été relues par **aucune personne locutrice** du fon ni du yoruba. Elles peuvent
> être approximatives, trop littérales, voire fausses sur les termes agricoles ou techniques.
> Avant toute mise en production auprès des fermiers, une relecture par des locuteurs natifs
> (idéalement des agents de vulgarisation agricole) est indispensable. L'interface affiche
> la mention `lang.machine_notice` pour le signaler.

## Chiffres

| | fon | yo |
|---|---|---|
| Clés au total | 904 | 904 |
| Traduites | 898 | 898 |
| Recopiées telles quelles (noms propres, unités) | 6 | 6 |
| Repli français | 0 | 0 |
| Traduction identique au français | 2 | 2 |

Appels API (cette exécution) : 4 (dont 4 réussis), durée moyenne 31415 ms, max 55927 ms.
Durée totale : 131 s (débit volontairement limité à ~5 appels/min).
Cumul de toutes les exécutions (translate + batch) : 30 appels réussis, durée moyenne 40781 ms, max 74389 ms.
Les textes déjà en cache disque ne repartent pas vers l'API : une relance peut faire 0 appel.
Un lot de 50 textes est un seul appel : la durée moyenne par appel inclut donc 50 traductions.

## Clés en repli français

Aucune.

## Échantillon pour relecture (15 paires)

| Clé | Français | Fɔngbe (auto) | Yorùbá (auto) |
|---|---|---|---|
| `nav.home` | Accueil | mεyiyí | Kaabo |
| `tile.parcels` | Mes champs | Gle ce lɛ. | Awọn aaye mi |
| `tile.weather` | Météo | Ayikúngban sín gbeɖiɖó | Iroyin oju ojo |
| `tile.alerts` | Alertes | Akpágbánúmɛ | Awọn itaniji |
| `tile.report` | Signaler un ravageur | Ðɔ nǔvínúví ɖé | Jabo kokoro kan |
| `tile.market` | Vendre | sà | Ta |
| `dashboard.hello` | Bonjour {name} | Mi do gbe nu mi {name} | Hello {name} |
| `auth.pin_hint` | Tapez vos 4 chiffres | Wlan numɛro ɛnɛ mitɔn lɛ | Tẹ awọn nọmba mẹrin rẹ sii |
| `auth.wrong` | Numéro ou code faux | Numɛro alǒ kodu e ma sɔgbe ǎ é | Nọmba ti ko tọ tabi koodu |
| `alert.ack` | J'ai compris | Un mɔ | Ṣe o ri |
| `alert.type.DROUGHT` | Sécheresse | Xú | Ogbele |
| `alert.type.HEAVY_RAIN` | Fortes pluies | Jǐ ɖaxó ɖé ja | Ojo nla |
| `report.take_photo` | Prendre la photo | Mi ɖe fɔto ɔ | Ya aworan naa |
| `market.sell` | Vendre | sà | Ta |
| `offline.message` | Vous pouvez continuer. Tout sera envoyé au retour du réseau. | A sixu kpó ɖò xó ɖɔ wɛ. È na sɛ́ nǔ lɛ bǐ dó sín réseau ɔ jí. | O le tesiwaju. Ohun gbogbo yoo wa ni rán pada lati awọn nẹtiwọki. |

## Procédure de correction

1. Corriger directement `src/lib/i18n/messages/fon.json` ou `yo.json` (ne pas relancer le script
   après correction manuelle : il réécrit les fichiers).
2. Garder les variables `{name}`, `{count}`… à l'identique.
3. Relancer `pnpm exec vitest run src/lib/i18n` : un test vérifie que les jeux de clés et les
   variables sont identiques entre les trois langues.

<!-- audio:begin -->
## Audio TTS (generate-audio.ts)

Clés visées : 41 par langue. Fichiers produits : fon 41, yo 41.
Taille totale : 4016 Ko. ffmpeg : présent (WAV > 150 Ko convertis en MP3 mono 32 kb/s).
Appels TTS (cette exécution) : 80, durée moyenne 2183 ms, max 7009 ms, 0 échec (80 appels pour 82 fichiers : deux textes identiques servis par le cache).

Constat : l'API renvoie du WAV aussi pour le yoruba (la doc annonce du MP3) ; le format est détecté par signature.
Les WAV de 150 Ko ou moins sont gardés tels quels : 4 Mo au total, trop lourd pour un pré-cache hors ligne complet ;
pré-cacher seulement la langue choisie, ou tout convertir en MP3 32 kb/s (environ 5 fois plus léger).

La voix est synthétique et lit la traduction automatique : même réserve de relecture que le texte.

<!-- audio:end -->
