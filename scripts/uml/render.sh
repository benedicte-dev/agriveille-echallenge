#!/bin/sh
# Génère les images des diagrammes UML (docs/uml/*.md → docs/uml/img/*.svg et *.png)
# avec @mermaid-js/mermaid-cli, sans l'ajouter aux dépendances du projet.
#   pnpm uml:render
# Chromium : CHROME_PATH, sinon celui de Playwright s'il existe, sinon celui de Puppeteer.
set -e
cd "$(dirname "$0")/../.."
OUT=docs/uml/img
mkdir -p "$OUT"

CFG=$(mktemp)
if [ -z "$CHROME_PATH" ]; then
  CHROME_PATH=$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1 || true)
fi
if [ -n "$CHROME_PATH" ]; then
  printf '{"executablePath":"%s","args":["--no-sandbox"]}' "$CHROME_PATH" > "$CFG"
else
  printf '{"args":["--no-sandbox"]}' > "$CFG"
fi

for src in docs/uml/0*.md; do
  name=$(basename "$src" .md)
  for fmt in svg png; do
    pnpm dlx @mermaid-js/mermaid-cli -q -p "$CFG" -i "$src" -o "$OUT/$name.$fmt" -b white -s 2
  done
  echo "ok $name"
done
rm -f "$CFG"
