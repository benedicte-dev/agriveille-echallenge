import { IconChamp, IconInsecte, IconMaladieFeuille, IconPayer, IconSemis, IconVendre, type IconComponent } from "@/components/icons";

export const REG_CATEGORIES = ["PHYTO", "SEEDS", "EXPORT", "TAX", "LAND", "ORGANIC"] as const;
export type RegCategory = (typeof REG_CATEGORIES)[number];

/** Pictogramme de chaque catégorie de fiche (le libellé vient de reg.category.*). */
export const REG_CATEGORY_ICONS: Record<RegCategory, IconComponent> = {
  PHYTO: IconInsecte,
  SEEDS: IconSemis,
  EXPORT: IconVendre,
  TAX: IconPayer,
  LAND: IconChamp,
  ORGANIC: IconMaladieFeuille,
};

export function isRegCategory(v: unknown): v is RegCategory {
  return typeof v === "string" && (REG_CATEGORIES as readonly string[]).includes(v);
}
