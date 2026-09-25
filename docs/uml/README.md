# Modélisation UML d'AgriVeille

Diagrammes en Mermaid, rendus directement par GitHub. Ils documentent l'architecture approuvée
([`docs/SPEC.md`](../SPEC.md), [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)). Le diagramme de classes suit
[`prisma/schema.prisma`](../../prisma/schema.prisma), qui fait foi.

| N° | Diagramme | Contenu |
|---|---|---|
| 01 | [Cas d'utilisation](01-cas-utilisation.md) | 4 acteurs principaux (plus le visiteur), 3 acteurs secondaires, 6 paquetages, `«include»` / `«extend»`, tableau acteur → cas |
| 02 | [Classes](02-classes.md) | vue d'ensemble, puis 3 vues : noyau et monitoring, marché et recettes, contenu et sécurité ; énumérations, multiplicités, compositions, méthodes métier, écarts SPEC / schéma |
| 03 | [Séquence : alerte climatique automatique](03-sequence-alerte-climatique.md) | cron authentifié, cache `WeatherSnapshot`, Open-Meteo, moteur de règles, `dedupKey`, traduction avec repli, livraisons, lecture, audio fon, accusé en ligne et hors ligne |
| 04 | [Séquence : signalement, validation, alerte de zone](04-sequence-signalement-ravageur.md) | photo compressée ou dictée fon, géolocalisation, file IndexedDB, contrôles serveur, validation AGENT, `PEST_OUTBREAK`, haversine, audit |

Chaque séquence comporte une description, ses préconditions, ses postconditions et un tableau d'exceptions.

Validation : les 9 blocs Mermaid (7 ici, 2 dans `ARCHITECTURE.md`) passent l'analyseur `mermaid.parse` (mermaid 12.0.0).
Les SVG ne sont pas encore générés dans `svg/` : `mmdc` a besoin de Chrome, qui n'a pas pu être installé dans le temps imparti.
Pour les produire (hors du projet, sans toucher à `package.json`) :

```sh
npx -y @mermaid-js/mermaid-cli@latest -i docs/uml/02-classes.md -o docs/uml/svg/02-classes.svg
```

Sur un fichier Markdown, `mmdc` produit un SVG par bloc Mermaid, suffixé `-1`, `-2`…
