import type { IconComponent } from "./Icon";
import {
  IconAccueil,
  IconAlerte,
  IconCalendrier,
  IconCamera,
  IconCarte,
  IconChaleur,
  IconCheck,
  IconChevron,
  IconContraste,
  IconCroix,
  IconDeconnexion,
  IconEffacer,
  IconGoutte,
  IconGraphique,
  IconHautParleur,
  IconHorloge,
  IconHorsLigne,
  IconInfo,
  IconInsecte,
  IconMaladieFeuille,
  IconMeteoNuage,
  IconMeteoOrage,
  IconMeteoPluie,
  IconMeteoSoleil,
  IconMicro,
  IconPayer,
  IconPlus,
  IconQr,
  IconRecolte,
  IconRegle,
  IconRetour,
  IconSecheresse,
  IconSemis,
  IconSignaler,
  IconTelephone,
  IconUtilisateur,
  IconVendre,
  IconVent,
  IconChamp,
  IconDanger,
  IconStop,
  IconMenu,
  IconMarque,
} from "./pictos";

export * from "./Icon";
export * from "./pictos";
export * from "./crops";

/** Map clé kebab-case → composant (utile pour des clés stockées en base ou dans la navigation). */
export const icons = {
  champ: IconChamp,
  alerte: IconAlerte,
  signaler: IconSignaler,
  vendre: IconVendre,
  payer: IconPayer,
  regle: IconRegle,
  "meteo-soleil": IconMeteoSoleil,
  "meteo-pluie": IconMeteoPluie,
  "meteo-orage": IconMeteoOrage,
  "meteo-nuage": IconMeteoNuage,
  vent: IconVent,
  chaleur: IconChaleur,
  goutte: IconGoutte,
  secheresse: IconSecheresse,
  semis: IconSemis,
  recolte: IconRecolte,
  insecte: IconInsecte,
  "maladie-feuille": IconMaladieFeuille,
  "haut-parleur": IconHautParleur,
  micro: IconMicro,
  camera: IconCamera,
  carte: IconCarte,
  telephone: IconTelephone,
  utilisateur: IconUtilisateur,
  accueil: IconAccueil,
  retour: IconRetour,
  check: IconCheck,
  croix: IconCroix,
  "hors-ligne": IconHorsLigne,
  qr: IconQr,
  graphique: IconGraphique,
  calendrier: IconCalendrier,
  info: IconInfo,
  plus: IconPlus,
  chevron: IconChevron,
  horloge: IconHorloge,
  deconnexion: IconDeconnexion,
  contraste: IconContraste,
  effacer: IconEffacer,
  danger: IconDanger,
  stop: IconStop,
  menu: IconMenu,
  marque: IconMarque,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof icons;

/** Pictogramme associé à chaque type d'alerte (SPEC §3 AlertType). */
export const alertTypeIcons: Record<
  | "DROUGHT"
  | "HEAVY_RAIN"
  | "HEAT"
  | "WIND"
  | "PEST_RISK"
  | "PEST_OUTBREAK"
  | "SOWING_WINDOW"
  | "HARVEST_WINDOW",
  IconComponent
> = {
  DROUGHT: IconSecheresse,
  HEAVY_RAIN: IconMeteoPluie,
  HEAT: IconChaleur,
  WIND: IconVent,
  PEST_RISK: IconInsecte,
  PEST_OUTBREAK: IconSignaler,
  SOWING_WINDOW: IconSemis,
  HARVEST_WINDOW: IconRecolte,
};

/** Pictogramme de chaque sévérité : forme différente (cercle, triangle, octogone). */
export const severityIcons: Record<"INFO" | "WARNING" | "CRITICAL", IconComponent> = {
  INFO: IconInfo,
  WARNING: IconAlerte,
  CRITICAL: IconDanger,
};
