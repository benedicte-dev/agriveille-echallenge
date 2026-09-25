/** Constantes du marché partagées client / serveur (sans dépendance, pour ne pas embarquer zod côté client). */
export const CERTIFICATIONS = ["BIO", "GLOBALGAP", "FAIRTRADE"] as const;
export type Certification = (typeof CERTIFICATIONS)[number];
