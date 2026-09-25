import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient. En développement, le module est réévalué à chaque
 * hot-reload : on garde l'instance sur globalThis pour ne pas ouvrir un
 * nouveau pool de connexions à chaque rechargement.
 */
const globalForPrisma = globalThis as unknown as { __agriPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__agriPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__agriPrisma = prisma;
}

export default prisma;
