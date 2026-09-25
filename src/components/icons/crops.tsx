import { createIcon, Dot, type IconComponent } from "./Icon";

/* Un pictogramme par culture (SPEC §9). Silhouettes simples, lisibles à 32 px. */

export const IconMais = createIcon(
  "IconMais",
  <>
    <path d="M12 2.5c2.3 0 3.8 3.4 3.8 7.8S14.3 18 12 18s-3.8-3.3-3.8-7.7S9.7 2.5 12 2.5z" />
    <path d="M12 3v14.5M8.7 7.5h6.6M8.3 11h7.4M8.8 14.5h6.4" strokeWidth={1.5} />
    <path d="M8.3 12.5C5 13.8 4 17 4 21.5c3.3 0 6.3-1.2 8-3" />
    <path d="M15.7 12.5c3.3 1.3 4.3 4.5 4.3 9-3.3 0-6.3-1.2-8-3" />
  </>,
);

export const IconManioc = createIcon(
  "IconManioc",
  <>
    <path d="M4.5 20c-1.2-1.2-.3-3.8 2.4-6.5l6.3-6.3c2.5-2.5 5-3.4 6-2.4s.1 3.5-2.4 6l-6.3 6.3C7.8 19.8 5.7 21.2 4.5 20z" />
    <path d="M8.8 12l3.2 3.2M12.3 8.6l3.1 3.1" />
    <path d="M19.2 4.8 21 3" />
  </>,
);

export const IconIgname = createIcon(
  "IconIgname",
  <>
    <path d="M9 5.5c-3 3-4 7.5-3 11.5.7 3 3.5 4.5 6.2 4 3.5-.6 6-3.5 5.4-7-.5-3-2.6-4.2-3.5-6.6-.6-1.6-.6-2.8-2.4-3.2-1.1-.2-1.8.4-2.7 1.3z" />
    <path d="M11.5 4.5c0-1.6 1-2.6 2.6-2.6" />
    <Dot cx={10} cy={11} r={0.9} />
    <Dot cx={13.5} cy={15} r={0.9} />
    <Dot cx={9.5} cy={16.5} r={0.9} />
  </>,
);

export const IconCoton = createIcon(
  "IconCoton",
  <>
    <path d="M12 3.5a3 3 0 0 1 3 3.2 3 3 0 0 1 1.6 5.5A3.1 3.1 0 0 1 12 15.7a3.1 3.1 0 0 1-4.6-3.5A3 3 0 0 1 9 6.7a3 3 0 0 1 3-3.2z" />
    <path d="M7 15.5l5 5.5 5-5.5M12 15.7V21" />
  </>,
);

export const IconSoja = createIcon(
  "IconSoja",
  <>
    <path d="M5 19C6.5 11 12 5.5 20 4c-1 8.5-6.5 14.2-15 15z" />
    <circle cx={9} cy={15} r={1.8} />
    <circle cx={12.3} cy={11.7} r={1.8} />
    <circle cx={15.6} cy={8.4} r={1.8} />
    <path d="M5 19l-2 2" />
  </>,
);

export const IconRiz = createIcon(
  "IconRiz",
  <>
    <path d="M7 21C8 13 11 8 17.5 3.5" />
    <path d="M7 21c-2-3.5-2-7.5 0-10.5" />
    <path d="M10.2 13.5c.8-1.8 2.8-2.5 4.3-2-.8 1.8-2.8 2.5-4.3 2z" fill="currentColor" />
    <path d="M12.3 9.8c.8-1.8 2.8-2.5 4.3-2-.8 1.8-2.8 2.5-4.3 2z" fill="currentColor" />
    <path d="M9.6 12.6c-1.8-.5-2.7-2.3-2.4-3.9 1.8.5 2.7 2.3 2.4 3.9z" fill="currentColor" />
    <path d="M12 8.6c-1.6-.8-2.2-2.7-1.6-4.2 1.6.8 2.2 2.7 1.6 4.2z" fill="currentColor" />
  </>,
);

export const IconAnacarde = createIcon(
  "IconAnacarde",
  <>
    <path d="M12 3V1.5" />
    <path d="M8 3h8l1 6c.5 3-2 5-5 5s-5.5-2-5-5z" />
    <path d="M12 14c-3 0-4.5 2-4 4.5.5 2 2.5 3 4 2 1-.7 1.5-2 3-2 1.2 0 1.6-1.5 1-2.5-.6-1.3-2-2-4-2z" />
  </>,
);

export const IconAnanas = createIcon(
  "IconAnanas",
  <>
    <ellipse cx={12} cy={15.5} rx={5} ry={6} />
    <path d="M12 9.5V4.5M11.5 9.5 8.5 3.5M12.5 9.5l3-6M10.5 9.8 6.5 6.5M13.5 9.8l4-3.3" />
    <path d="M8.3 12.3l6.4 6.4M10.8 10.3l6 6M15.7 12.3l-6.4 6.4M13.2 10.3l-6 6" strokeWidth={1.5} />
  </>,
);

export const IconNiebe = createIcon(
  "IconNiebe",
  <>
    <path d="M3.5 12.5c0-3 2.5-5 5.5-5 2 0 3 1.4 5 1.4s2.6-1 4.1-1c1.6 0 2.4 1.5 2.4 3.6 0 3.6-3.5 6-8.5 6s-8.5-2-8.5-5z" />
    <ellipse cx={12} cy={11.6} rx={2} ry={1.4} fill="currentColor" stroke="none" />
  </>,
);

export const IconTomate = createIcon(
  "IconTomate",
  <>
    <path d="M12 7.5c5 0 8 2.8 8 6.8S16.5 21 12 21s-8-2.7-8-6.7 3-6.8 8-6.8z" />
    <path d="M12 7.5V3.5M12 7.5 9 5.5M12 7.5l3-2M12 7.5 7.8 8.8M12 7.5l4.2 1.3" />
  </>,
);

export const IconPiment = createIcon(
  "IconPiment",
  <>
    <path d="M16 7.5c1 5-1 10-6 12.5-2 1-5 1.5-6 .5 4-1 7.5-4.5 8.5-9 .5-2 1-3.5 3.5-4z" />
    <path d="M16 7.5c0-2 1-3.5 3-4" />
    <path d="M13.8 8.2c1-.8 2.6-1.2 4-.6" />
  </>,
);

export const IconArachide = createIcon(
  "IconArachide",
  <>
    <path d="M12 3c2.5 0 4 1.8 4 4 0 1.8-1 2.6-1 5s1 3.2 1 5c0 2.2-1.5 4-4 4s-4-1.8-4-4c0-1.8 1-2.6 1-5s-1-3.2-1-5c0-2.2 1.5-4 4-4z" />
    <path d="M10.5 7h3M10.5 17h3" strokeWidth={1.5} />
  </>,
);

/** Culture générique (feuille), repli pour un slug inconnu. */
export const IconCultureGenerique = createIcon(
  "IconCultureGenerique",
  <>
    <path d="M12 21V11" />
    <path d="M12 13c-4 0-7-3-7-7 4 0 7 3 7 7z" />
    <path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7z" />
  </>,
);

/** Slugs des cultures de référence (SPEC §9). */
export type CropSlug =
  | "mais"
  | "manioc"
  | "igname"
  | "coton"
  | "soja"
  | "riz"
  | "anacarde"
  | "ananas"
  | "niebe"
  | "tomate"
  | "piment"
  | "arachide";

export const cropIcons: Record<CropSlug, IconComponent> = {
  mais: IconMais,
  manioc: IconManioc,
  igname: IconIgname,
  coton: IconCoton,
  soja: IconSoja,
  riz: IconRiz,
  anacarde: IconAnacarde,
  ananas: IconAnanas,
  niebe: IconNiebe,
  tomate: IconTomate,
  piment: IconPiment,
  arachide: IconArachide,
};

/** Résout un slug ou une clé `Crop.icon` venant du CMS ; repli sur la feuille générique. */
export function getCropIcon(slugOrKey: string | null | undefined): IconComponent {
  if (!slugOrKey) return IconCultureGenerique;
  const key = slugOrKey
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^crop[-_:]/, "") as CropSlug;
  return cropIcons[key] ?? IconCultureGenerique;
}
