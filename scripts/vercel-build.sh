#!/bin/sh
# Build Vercel : migrations, données de démo si demandé, puis compilation.
# Les migrations passent par la connexion directe Neon (le pooler ne tient pas
# les verrous consultatifs de Prisma Migrate). SEED_ON_DEPLOY=1 recharge les
# données de démo (idempotent) ; à retirer une fois l'instance initialisée.
set -e

DIRECT_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"

DATABASE_URL="$DIRECT_URL" prisma migrate deploy

if [ "$SEED_ON_DEPLOY" = "1" ]; then
  DATABASE_URL="$DIRECT_URL" prisma db seed
fi

next build
