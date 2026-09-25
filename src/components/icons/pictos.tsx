import { createIcon, Dot } from "./Icon";

/* Navigation et tâches fermier */

export const IconChamp = createIcon(
  "IconChamp",
  <>
    <path d="M3 20h18" />
    <path d="M4 13h16" />
    <path d="M5 20l3-7M12 20v-7M19 20l-3-7" />
    <path d="M12 13V9" />
    <path d="M12 9c0-2.2 1.6-4 4-4 0 2.2-1.8 4-4 4z" />
    <path d="M12 9.5c0-1.9-1.4-3.3-3.3-3.3 0 1.9 1.4 3.3 3.3 3.3z" />
  </>,
);

export const IconAlerte = createIcon(
  "IconAlerte",
  <>
    <path d="M12 3.5 21.5 20h-19z" />
    <path d="M12 10v4.5" />
    <Dot cx={12} cy={17.3} r={1.1} />
  </>,
);

export const IconSignaler = createIcon(
  "IconSignaler",
  <>
    <circle cx={10} cy={10} r={7} />
    <path d="M15.2 15.2 21 21" />
    <ellipse cx={10} cy={11} rx={2} ry={2.6} fill="currentColor" stroke="none" />
    <circle cx={10} cy={7.6} r={1.1} fill="currentColor" stroke="none" />
    <path d="M6.8 9.5h1.2M12 9.5h1.2M7 12.8l1.1-.6M13 12.8l-1.1-.6" strokeWidth={1.5} />
  </>,
);

export const IconVendre = createIcon(
  "IconVendre",
  <>
    <path d="M3 10h18l-2.2 10H5.2z" />
    <path d="M8 10l3-6M16 10l-3-6" />
    <path d="M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5" />
  </>,
);

export const IconPayer = createIcon(
  "IconPayer",
  <>
    <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </>,
);

export const IconRegle = createIcon(
  "IconRegle",
  <>
    <path d="M12 6.5C10 5 7 4.5 3 4.5v14c4 0 7 .5 9 2 2-1.5 5-2 9-2v-14c-4 0-7 .5-9 2z" />
    <path d="M12 6.5v14" />
  </>,
);

/* Météo et climat */

export const IconMeteoSoleil = createIcon(
  "IconMeteoSoleil",
  <>
    <circle cx={12} cy={12} r={4} />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </>,
);

export const IconMeteoNuage = createIcon(
  "IconMeteoNuage",
  <path d="M7 19a4 4 0 0 1-.5-7.97A6 6 0 0 1 17.6 10 4.5 4.5 0 0 1 17 19z" />,
);

export const IconMeteoPluie = createIcon(
  "IconMeteoPluie",
  <>
    <path d="M7 15a4 4 0 0 1-.5-7.97A6 6 0 0 1 17.6 6 4.5 4.5 0 0 1 17 15z" />
    <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
  </>,
);

export const IconMeteoOrage = createIcon(
  "IconMeteoOrage",
  <>
    <path d="M7 15a4 4 0 0 1-.5-7.97A6 6 0 0 1 17.6 6 4.5 4.5 0 0 1 17 15h-1" />
    <path d="M13 13l-3 4.5h4l-2.5 4.5" />
  </>,
);

export const IconVent = createIcon(
  "IconVent",
  <>
    <path d="M3 8h10a3 3 0 1 0-3-3" />
    <path d="M3 12h15a3 3 0 1 1-3 3" />
    <path d="M3 16h6" />
  </>,
);

export const IconChaleur = createIcon(
  "IconChaleur",
  <>
    <path d="M9 14.3V5a2.5 2.5 0 0 1 5 0v9.3a4.2 4.2 0 1 1-5 0z" />
    <path d="M11.5 17.5V10" />
    <path d="M18 5h3M18 9h2.5" />
  </>,
);

export const IconGoutte = createIcon(
  "IconGoutte",
  <>
    <path d="M12 3c3 4 6 7.3 6 11a6 6 0 0 1-12 0c0-3.7 3-7 6-11z" />
    <path d="M9.5 15a2.5 2.5 0 0 0 2 2.4" />
  </>,
);

export const IconSecheresse = createIcon(
  "IconSecheresse",
  <>
    <circle cx={12} cy={7} r={2.8} />
    <path d="M12 1.5v.8M6.6 7h.8M16.6 7h.8M8.2 3.2l.6.6M15.2 3.8l.6-.6" />
    <path d="M3 13.5h18v7H3z" />
    <path d="M8 13.5l2 3-1.5 4M15.5 13.5 14 16.5l2 4" />
  </>,
);

/* Cycle cultural */

export const IconSemis = createIcon(
  "IconSemis",
  <>
    <path d="M3 20h18" />
    <path d="M12 20v-8" />
    <path d="M12 14.5c-3 0-5-2-5-5 3 0 5 2 5 5z" />
    <path d="M12 12c0-3 2-5 5-5 0 3-2 5-5 5z" />
    <Dot cx={6} cy={17} r={1} />
    <Dot cx={18} cy={17} r={1} />
  </>,
);

export const IconRecolte = createIcon(
  "IconRecolte",
  <>
    <path d="M12 21V10M12 21 8 13M12 21l4-8" />
    <path d="M9.5 17h5" />
    <path d="M12 10c-1.3-1.3-1.3-4.3 0-6.5 1.3 2.2 1.3 5.2 0 6.5z" />
    <path d="M8 13c-1.6-.8-2.5-3.6-1.9-6 1.8 1.6 2.6 4.3 1.9 6z" />
    <path d="M16 13c1.6-.8 2.5-3.6 1.9-6-1.8 1.6-2.6 4.3-1.9 6z" />
  </>,
);

/* Phytosanitaire */

export const IconInsecte = createIcon(
  "IconInsecte",
  <>
    <ellipse cx={12} cy={14.5} rx={4} ry={5.5} />
    <circle cx={12} cy={6.5} r={2} />
    <path d="M10.7 5 8.8 2.5M13.3 5l1.9-2.5" />
    <path d="M12 9v11" />
    <path d="M8 11.5H4.5M8 15H3.5M8.7 18.5 5.5 21M16 11.5h3.5M16 15h4.5M15.3 18.5l3.2 2.5" />
  </>,
);

export const IconMaladieFeuille = createIcon(
  "IconMaladieFeuille",
  <>
    <path d="M4.5 19.5C4.5 10.5 10 4 20 4c0 10-6 15.5-15.5 15.5z" />
    <path d="M4.5 19.5 13 11" />
    <Dot cx={14.5} cy={14} r={1.3} />
    <Dot cx={11} cy={8.3} r={1.1} />
    <Dot cx={17} cy={8.5} r={1} />
  </>,
);

/* Voix et médias */

export const IconHautParleur = createIcon(
  "IconHautParleur",
  <>
    <path d="M4 9h3.5L12 5v14l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18.5 6a8 8 0 0 1 0 12" />
  </>,
);

export const IconMicro = createIcon(
  "IconMicro",
  <>
    <rect x={9} y={3} width={6} height={11} rx={3} />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21M9 21h6" />
  </>,
);

export const IconCamera = createIcon(
  "IconCamera",
  <>
    <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
    <circle cx={12} cy={13} r={3.5} />
  </>,
);

/* Outils et navigation */

export const IconCarte = createIcon(
  "IconCarte",
  <>
    <path d="M3 6.5 9 4.5l6 2 6-2v13l-6 2-6-2-6 2z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </>,
);

export const IconTelephone = createIcon(
  "IconTelephone",
  <>
    <rect x={6.5} y={2.5} width={11} height={19} rx={2} />
    <path d="M10.5 18h3" />
  </>,
);

export const IconUtilisateur = createIcon(
  "IconUtilisateur",
  <>
    <circle cx={12} cy={8} r={4} />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);

export const IconAccueil = createIcon(
  "IconAccueil",
  <>
    <path d="M3 11.5 12 3.5l9 8" />
    <path d="M5.5 9.5V21h4.5v-6h4v6h4.5V9.5" />
  </>,
);

export const IconRetour = createIcon(
  "IconRetour",
  <>
    <path d="M20 12H5" />
    <path d="M11 5.5 4.5 12l6.5 6.5" />
  </>,
);

export const IconCheck = createIcon("IconCheck", <path d="M4.5 12.5l5 5L20 7" />);

export const IconCroix = createIcon("IconCroix", <path d="M6 6l12 12M18 6 6 18" />);

export const IconHorsLigne = createIcon(
  "IconHorsLigne",
  <>
    <path d="M4 20v-2.5M9 20v-5.5M14 20v-8.5M19 20V5.5" />
    <path d="M3 3l18 18" />
  </>,
);

export const IconQr = createIcon(
  "IconQr",
  <>
    <path d="M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6z" />
    <path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M17 20.5h3.5V18M14.5 20.5v-.01" />
    <Dot cx={6.5} cy={6.5} r={1} />
    <Dot cx={17.5} cy={6.5} r={1} />
    <Dot cx={6.5} cy={17.5} r={1} />
  </>,
);

export const IconGraphique = createIcon(
  "IconGraphique",
  <>
    <path d="M3.5 3.5v17h17" />
    <path d="M8 17v-5M12.5 17V7.5M17 17v-8" />
  </>,
);

export const IconCalendrier = createIcon(
  "IconCalendrier",
  <>
    <rect x={3} y={5} width={18} height={16} rx={2} />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <Dot cx={8} cy={14} r={1} />
    <Dot cx={12} cy={14} r={1} />
    <Dot cx={16} cy={14} r={1} />
    <Dot cx={8} cy={17.5} r={1} />
    <Dot cx={12} cy={17.5} r={1} />
  </>,
);

/* Utilitaires d'interface */

export const IconInfo = createIcon(
  "IconInfo",
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 11v5.5" />
    <Dot cx={12} cy={7.8} r={1.1} />
  </>,
);

export const IconPlus = createIcon("IconPlus", <path d="M12 5v14M5 12h14" />);

export const IconChevron = createIcon("IconChevron", <path d="M9 5.5 15.5 12 9 18.5" />);

export const IconHorloge = createIcon(
  "IconHorloge",
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 7v5l3.5 2" />
  </>,
);

export const IconDeconnexion = createIcon(
  "IconDeconnexion",
  <>
    <path d="M10 4H5v16h5" />
    <path d="M15 8l4 4-4 4M19 12H9.5" />
  </>,
);

export const IconContraste = createIcon(
  "IconContraste",
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
  </>,
);

export const IconEffacer = createIcon(
  "IconEffacer",
  <>
    <path d="M8.5 5H21v14H8.5L2.5 12z" />
    <path d="M11.5 9l6 6M17.5 9l-6 6" />
  </>,
);
