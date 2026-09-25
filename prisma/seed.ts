/**
 * Données de démonstration AgriVeille (SPEC §9). Idempotent : chaque entrée est
 * un upsert sur une clé naturelle (téléphone, slug, code, nom) ou sur un
 * identifiant fixe au format cuid (préfixe « cseed… », accepté par z.cuid()).
 * Relancer le seed remet les comptes démo dans leur état initial (PIN, verrou).
 *
 * Toutes les personnes sont fictives. Les communes et coordonnées sont réelles.
 * Les champs Fon/Yoruba restent null : ils sont remplis par l'API 229langues.
 *
 * Lancement : pnpm db:seed (prisma db seed → tsx prisma/seed.ts).
 */
import { PrismaClient, type AgroZone, type Market, type PlantingStatus } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY);
const hashPin = (pin: string) => hash(pin, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });

// ─────────────────────────── Communes ───────────────────────────
// Coordonnées du chef-lieu (WGS84). Pôle de développement agricole indicatif.
const COMMUNES: { name: string; department: string; lat: number; lon: number; agroZone: AgroZone }[] = [
  { name: "Cotonou", department: "Littoral", lat: 6.3654, lon: 2.4183, agroZone: "PDA7" },
  { name: "Abomey-Calavi", department: "Atlantique", lat: 6.4485, lon: 2.3557, agroZone: "PDA7" },
  { name: "Ouidah", department: "Atlantique", lat: 6.3631, lon: 2.0851, agroZone: "PDA7" },
  { name: "Allada", department: "Atlantique", lat: 6.665, lon: 2.1511, agroZone: "PDA7" },
  { name: "Porto-Novo", department: "Ouémé", lat: 6.4969, lon: 2.6289, agroZone: "PDA7" },
  { name: "Lokossa", department: "Mono", lat: 6.6386, lon: 1.7167, agroZone: "PDA7" },
  { name: "Comè", department: "Mono", lat: 6.4, lon: 1.8833, agroZone: "PDA7" },
  { name: "Pobè", department: "Plateau", lat: 6.98, lon: 2.6647, agroZone: "PDA6" },
  { name: "Kétou", department: "Plateau", lat: 7.3633, lon: 2.6, agroZone: "PDA6" },
  { name: "Aplahoué", department: "Couffo", lat: 6.9333, lon: 1.6833, agroZone: "PDA5" },
  { name: "Bohicon", department: "Zou", lat: 7.1782, lon: 2.0667, agroZone: "PDA5" },
  { name: "Abomey", department: "Zou", lat: 7.1829, lon: 1.9912, agroZone: "PDA5" },
  { name: "Dassa-Zoumè", department: "Collines", lat: 7.75, lon: 2.1833, agroZone: "PDA4" },
  { name: "Savalou", department: "Collines", lat: 7.9281, lon: 1.9756, agroZone: "PDA4" },
  { name: "Glazoué", department: "Collines", lat: 7.9736, lon: 2.24, agroZone: "PDA4" },
  { name: "Savè", department: "Collines", lat: 8.0342, lon: 2.4866, agroZone: "PDA4" },
  { name: "Parakou", department: "Borgou", lat: 9.3372, lon: 2.6303, agroZone: "PDA4" },
  { name: "Nikki", department: "Borgou", lat: 9.9401, lon: 3.2108, agroZone: "PDA2" },
  { name: "Djougou", department: "Donga", lat: 9.7085, lon: 1.666, agroZone: "PDA4" },
  { name: "Natitingou", department: "Atacora", lat: 10.3042, lon: 1.3796, agroZone: "PDA3" },
  { name: "Tanguiéta", department: "Atacora", lat: 10.6212, lon: 1.265, agroZone: "PDA3" },
  { name: "Kandi", department: "Alibori", lat: 11.1342, lon: 2.9386, agroZone: "PDA2" },
  { name: "Banikoara", department: "Alibori", lat: 11.2986, lon: 2.4386, agroZone: "PDA2" },
  { name: "Malanville", department: "Alibori", lat: 11.8618, lon: 3.3862, agroZone: "PDA1" },
];

// ─────────────────────────── Cultures ───────────────────────────
// Calendriers : le Sud (Atlantique, Ouémé, Mono, Couffo, Zou, Plateau) a un régime
// bimodal — grande saison des pluies mi-mars → juillet, petite saison
// septembre → novembre. Le Nord (Borgou, Alibori, Atacora, Donga) a une seule
// saison des pluies, mai → octobre. Les mois ci-dessous couvrent les deux zones.
const CROPS = [
  {
    slug: "mais", nameFr: "Maïs", icon: "maize", cycleDays: 100,
    // Sud : semis mars-avril (1re saison) et août-septembre (2e saison) ; Nord : mai-juillet.
    sowingMonths: [3, 4, 5, 6, 7, 8, 9], harvestMonths: [6, 7, 8, 9, 10, 11, 12],
    minRainMm: 500, optimalTempMin: 18, optimalTempMax: 32,
    notes: "Sud : deux campagnes (mars-avril puis août-septembre). Nord : une campagne (mai-juillet). Variétés précoces de 90 jours conseillées en petite saison.",
  },
  {
    slug: "manioc", nameFr: "Manioc", icon: "cassava", cycleDays: 330,
    // Bouturage en début de saison des pluies ; récolte échelonnée toute l'année.
    sowingMonths: [4, 5, 6, 9, 10], harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    minRainMm: 1000, optimalTempMin: 20, optimalTempMax: 32,
    notes: "Boutures saines de 20 à 25 cm, prélevées sur des plants sans mosaïque. Récolte de 9 à 18 mois selon la variété.",
  },
  {
    slug: "igname", nameFr: "Igname", icon: "yam", cycleDays: 240,
    // Mise en buttes en fin de saison sèche (novembre-avril) ; récolte juillet-décembre.
    sowingMonths: [11, 12, 1, 2, 3, 4], harvestMonths: [7, 8, 9, 10, 11, 12],
    minRainMm: 1000, optimalTempMin: 25, optimalTempMax: 30,
    notes: "Culture phare des Collines, du Borgou et de la Donga. Récolte précoce (juillet-août) pour les variétés à double récolte.",
  },
  {
    slug: "coton", nameFr: "Coton", icon: "cotton", cycleDays: 150,
    // Semis en début de saison unique au Nord et au Centre (mai-juillet).
    sowingMonths: [5, 6, 7], harvestMonths: [10, 11, 12, 1],
    minRainMm: 700, optimalTempMin: 21, optimalTempMax: 35,
    notes: "Principal produit d'exportation agricole. Semis au plus tard mi-juillet dans le Nord pour éviter la fin de pluies.",
  },
  {
    slug: "soja", nameFr: "Soja", icon: "soybean", cycleDays: 110,
    sowingMonths: [5, 6, 7], harvestMonths: [9, 10, 11],
    minRainMm: 450, optimalTempMin: 20, optimalTempMax: 30,
    notes: "Légumineuse : enrichit le sol en azote, bonne culture de rotation après le maïs ou le coton.",
  },
  {
    slug: "riz", nameFr: "Riz", icon: "rice", cycleDays: 120,
    // Bas-fonds et périmètres irrigués (Malanville, vallée de l'Ouémé) : deux cycles possibles.
    sowingMonths: [4, 5, 6, 7, 8], harvestMonths: [8, 9, 10, 11, 12],
    minRainMm: 1000, optimalTempMin: 20, optimalTempMax: 35,
    notes: "Riz de bas-fond ou irrigué. Repiquage 21 jours après la pépinière.",
  },
  {
    slug: "anacarde", nameFr: "Anacarde (cajou)", icon: "cashew", cycleDays: 365,
    // Culture pérenne : plantation en saison des pluies, campagne de récolte février-mai.
    sowingMonths: [6, 7], harvestMonths: [2, 3, 4, 5],
    minRainMm: 800, optimalTempMin: 24, optimalTempMax: 35,
    notes: "Culture pérenne (production à partir de 3 ans). cycleDays = durée d'une campagne. Ramasser les noix tombées et les sécher 2 à 3 jours.",
  },
  {
    slug: "ananas", nameFr: "Ananas", icon: "pineapple", cycleDays: 540,
    // Plantation en saison des pluies ; production étalée grâce à l'induction florale.
    sowingMonths: [3, 4, 5, 9, 10], harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    minRainMm: 1000, optimalTempMin: 22, optimalTempMax: 32,
    notes: "Bassin de l'Atlantique (Allada, Abomey-Calavi). Variétés Pain de sucre et Cayenne lisse. Récolte 14 à 18 mois après plantation.",
  },
  {
    slug: "niebe", nameFr: "Niébé (haricot)", icon: "cowpea", cycleDays: 75,
    // Sud : avril puis août-septembre ; Nord : juillet-août.
    sowingMonths: [4, 7, 8, 9], harvestMonths: [6, 7, 10, 11],
    minRainMm: 300, optimalTempMin: 20, optimalTempMax: 35,
    notes: "Supporte la sécheresse. Récolter les gousses sèches rapidement et stocker en sac hermétique contre la bruche.",
  },
  {
    slug: "tomate", nameFr: "Tomate", icon: "tomato", cycleDays: 110,
    // Pépinière puis repiquage ; contre-saison irriguée très pratiquée.
    sowingMonths: [3, 8, 9, 10, 11], harvestMonths: [1, 2, 3, 6, 7, 12],
    minRainMm: 400, optimalTempMin: 18, optimalTempMax: 30,
    notes: "Culture maraîchère sensible à l'excès d'eau. Tuteurer et pailler. Irrigation goutte-à-goutte en saison sèche.",
  },
  {
    slug: "piment", nameFr: "Piment", icon: "chili", cycleDays: 150,
    sowingMonths: [3, 4, 8, 9], harvestMonths: [1, 2, 7, 8, 9, 12],
    minRainMm: 600, optimalTempMin: 20, optimalTempMax: 30,
    notes: "Pépinière de 4 à 6 semaines. Récoltes échelonnées sur plusieurs mois ; le piment séché se conserve et s'exporte.",
  },
  {
    slug: "arachide", nameFr: "Arachide", icon: "peanut", cycleDays: 100,
    // Sud : avril ; Nord et Centre : juin-juillet.
    sowingMonths: [4, 5, 6, 7], harvestMonths: [7, 8, 9, 10],
    minRainMm: 500, optimalTempMin: 22, optimalTempMax: 33,
    notes: "Sécher les gousses rapidement après l'arrachage pour limiter les moisissures (aflatoxines).",
  },
];

// ─────────────────────────── Ravageurs et maladies ───────────────────────────
// Lutte intégrée d'abord ; un traitement chimique n'est évoqué qu'en dernier
// recours, avec un produit homologué au Bénin et sur conseil d'un agent.
// Aucun nom de matière active de synthèse n'est cité.
// Seuils : fenêtre de température (°C) et humidité relative minimale (%) favorables.
const LAST_RESORT =
  "En dernier recours seulement, et sur conseil de l'agent de votre commune : un produit homologué au Bénin, à la dose indiquée sur l'étiquette, avec gants, masque et bottes. Ne jamais utiliser un produit sans étiquette ni un produit destiné au coton sur des cultures vivrières.";

const PESTS = [
  {
    slug: "chenille-legionnaire", nameFr: "Chenille légionnaire d'automne", kind: "PEST" as const,
    crops: ["mais", "riz"],
    symptomsFr: "Feuilles trouées ou déchiquetées, surtout au cœur (cornet) du maïs. Présence de sciure humide (excréments) dans le cornet. Petites chenilles avec un Y inversé clair sur la tête et quatre points noirs en carré sur l'avant-dernier segment.",
    preventionFr: "Semer tôt et en même temps que les voisins. Associer le maïs avec une légumineuse (niébé, arachide) ou pratiquer le push-pull (desmodium entre les lignes, brachiaria en bordure). Inspecter 20 plants deux fois par semaine dès la levée et écraser les pontes. Enfouir ou détruire les résidus après récolte.",
    treatmentFr: `Si plus de 20 % des plants sont attaqués au stade végétatif : verser une pincée de sable sec mélangé à de la cendre dans le cornet, ou pulvériser un extrait aqueux de graines de neem, ou un biopesticide à base de Bacillus thuringiensis, tôt le matin ou en fin d'après-midi. ${LAST_RESORT}`,
    riskTempMin: 20, riskTempMax: 32, riskHumidityMin: 60, imageKey: "pest-faw",
  },
  {
    slug: "mouche-des-fruits", nameFr: "Mouche des fruits", kind: "PEST" as const,
    crops: ["anacarde", "piment", "tomate"],
    symptomsFr: "Petites piqûres sur les fruits, zones molles et brunes, fruits qui pourrissent et tombent avant maturité. Asticots blancs à l'intérieur des fruits ouverts.",
    preventionFr: "Ramasser chaque semaine tous les fruits tombés et les enfouir à plus de 50 cm ou les enfermer dans un sac plastique au soleil. Installer des pièges à paraphéromone dès le début de la fructification (environ 4 pièges par hectare). Désherber sous les arbres.",
    treatmentFr: `Appâts protéiques appliqués par taches sur le feuillage (un point par arbre), et non en couverture totale. Récolter à bonne maturité sans attendre. Organiser la lutte entre voisins : elle est efficace à l'échelle du village. ${LAST_RESORT}`,
    riskTempMin: 25, riskTempMax: 33, riskHumidityMin: 70, imageKey: "pest-fruitfly",
  },
  {
    slug: "criquet", nameFr: "Criquets et sauteriaux", kind: "PEST" as const,
    crops: ["mais", "riz", "niebe", "arachide", "soja"],
    symptomsFr: "Feuilles rongées depuis le bord, parfois jusqu'à la nervure. Présence de nombreux insectes sauteurs dans le champ et les herbes voisines, surtout en début de saison des pluies.",
    preventionFr: "Labourer en saison sèche pour exposer les oothèques (pontes enterrées). Désherber les bordures des champs. Signaler rapidement toute concentration inhabituelle à l'agent : la lutte antiacridienne est organisée par les services de l'État.",
    treatmentFr: `Ne pas traiter seul une invasion : signaler le foyer dans AgriVeille pour une intervention coordonnée. Contre les sauteriaux locaux, les biopesticides à base du champignon Metarhizium acridum sont recommandés car ils épargnent les autres insectes. ${LAST_RESORT}`,
    riskTempMin: 25, riskTempMax: 38, riskHumidityMin: null, imageKey: "pest-locust",
  },
  {
    slug: "mildiou", nameFr: "Mildiou", kind: "DISEASE" as const,
    crops: ["tomate", "piment"],
    symptomsFr: "Taches brunes à bords flous sur les feuilles, duvet blanc au revers par temps humide, tiges noircies, fruits marbrés de brun qui pourrissent. Progression très rapide après plusieurs jours de pluie.",
    preventionFr: "Rotation d'au moins trois ans sans tomate, piment ni aubergine sur la même planche. Espacer les plants et tuteurer pour aérer. Arroser au pied, jamais sur les feuilles, et le matin. Pailler pour éviter les éclaboussures de terre. Utiliser des variétés tolérantes.",
    treatmentFr: "Arracher et brûler (ou enfouir loin du champ) les feuilles et plants atteints dès les premières taches. En prévention pendant les périodes humides, une bouillie à base de cuivre (bouillie bordelaise), autorisée en agriculture biologique, à la dose de l'étiquette et en respectant le délai avant récolte. Ne pas composter les plants malades.",
    riskTempMin: 18, riskTempMax: 27, riskHumidityMin: 85, imageKey: "disease-blight",
  },
  {
    slug: "striure-du-mais", nameFr: "Striure du maïs", kind: "DISEASE" as const,
    crops: ["mais"],
    symptomsFr: "Fines stries jaunes continues le long des nervures des jeunes feuilles, plants rabougris, épis petits ou absents. Maladie virale transmise par de petites cicadelles.",
    preventionFr: "Semer des variétés tolérantes à la striure (demander à l'agent ou au semencier agréé). Semer tôt et de façon groupée. Éliminer les graminées sauvages autour du champ, qui hébergent les cicadelles. Éviter de semer du maïs à côté d'un champ de maïs âgé et malade.",
    treatmentFr: "Il n'existe pas de traitement curatif pour un plant infecté. Arracher et détruire les jeunes plants atteints pour limiter la propagation, puis ressemer avec une variété tolérante si la saison le permet.",
    riskTempMin: 25, riskTempMax: 35, riskHumidityMin: null, imageKey: "disease-msv",
  },
  {
    slug: "mosaique-du-manioc", nameFr: "Mosaïque du manioc", kind: "DISEASE" as const,
    crops: ["manioc"],
    symptomsFr: "Feuilles tachetées de jaune et de vert (mosaïque), déformées, enroulées et réduites. Plants chétifs et tubercules peu nombreux. Virus transmis par l'aleurode et surtout par les boutures infectées.",
    preventionFr: "Planter uniquement des boutures prélevées sur des plants sains, idéalement de variétés tolérantes. Inspecter le champ pendant les trois premiers mois et arracher les plants malades. Ne jamais donner ni vendre de boutures d'un champ atteint.",
    treatmentFr: "Pas de traitement curatif. Arracher et brûler les plants atteints dès les premiers symptômes, puis remplacer par des boutures saines. Renouveler le matériel de plantation auprès d'un multiplicateur reconnu.",
    riskTempMin: 25, riskTempMax: 32, riskHumidityMin: null, imageKey: "disease-cmd",
  },
  {
    slug: "cochenille-du-manioc", nameFr: "Cochenille farineuse du manioc", kind: "PEST" as const,
    crops: ["manioc"],
    symptomsFr: "Bourgeons terminaux ratatinés en « touffe », feuilles jaunies, entre-nœuds courts. Petits insectes couverts d'une cire blanche farineuse au revers des feuilles et sur les tiges. Dégâts plus forts en saison sèche.",
    preventionFr: "Utiliser des boutures saines. Planter en début de saison des pluies pour que les plants soient vigoureux à la saison sèche. Préserver les ennemis naturels, notamment la petite guêpe Anagyrus lopezi, introduite avec succès en Afrique de l'Ouest : éviter tout insecticide à large spectre.",
    treatmentFr: "Couper et brûler les extrémités de tiges très infestées. La lutte biologique par Anagyrus lopezi suffit en général : ne pas traiter chimiquement, cela détruirait ces auxiliaires. Signaler les foyers importants à l'agent.",
    riskTempMin: 25, riskTempMax: 35, riskHumidityMin: null, imageKey: "pest-mealybug",
  },
  {
    slug: "bruche-du-niebe", nameFr: "Bruche du niébé", kind: "PEST" as const,
    crops: ["niebe"],
    symptomsFr: "Graines stockées percées de petits trous ronds, poudre dans les sacs, petits coléoptères bruns qui s'envolent à l'ouverture. Les pertes peuvent dépasser la moitié du stock en quelques mois.",
    preventionFr: "Récolter dès maturité, bien sécher les graines au soleil, trier les graines percées. Stocker dans des sacs hermétiques à triple fond, des fûts ou des bidons bien fermés, remplis au maximum. On peut mélanger les graines avec de la cendre de bois tamisée.",
    treatmentFr: "Le stockage hermétique asphyxie les insectes sans aucun produit : fermer le sac et ne pas l'ouvrir pendant au moins deux mois. Pour de petites quantités, exposer les graines en couche mince au soleil sous un film plastique noir quelques heures. Ne jamais utiliser de pastilles ou de produits de fumigation à la maison : ils sont mortels.",
    riskTempMin: 25, riskTempMax: 35, riskHumidityMin: 60, imageKey: "pest-bruchid",
  },
  {
    slug: "aleurode", nameFr: "Aleurode (mouche blanche)", kind: "PEST" as const,
    crops: ["tomate", "piment", "manioc", "coton"],
    symptomsFr: "Nuées de minuscules insectes blancs qui s'envolent quand on secoue les plants. Feuilles collantes, noircies par la fumagine, jaunissement. Transmet des virus (enroulement de la tomate, mosaïque du manioc).",
    preventionFr: "Protéger les pépinières sous voile ou filet anti-insectes. Installer des pièges jaunes englués. Détruire les résidus de culture et les plants spontanés. Éviter de planter une nouvelle tomate à côté d'une ancienne parcelle infestée.",
    treatmentFr: `Pulvériser un extrait de neem ou une solution de savon noir (environ 20 g par litre d'eau), sur le revers des feuilles, en fin de journée. Préserver les coccinelles et autres auxiliaires. ${LAST_RESORT}`,
    riskTempMin: 25, riskTempMax: 33, riskHumidityMin: null, imageKey: "pest-whitefly",
  },
];

// ─────────────────────────── Comptes démo (fictifs) ───────────────────────────
const USERS = [
  { phone: "+2290197000001", fullName: "Ablawa Houénou", role: "FARMER" as const, commune: "Bohicon", pin: "1234", organization: null },
  { phone: "+2290197000002", fullName: "Issa Bani", role: "FARMER" as const, commune: "Parakou", pin: "1234", organization: null },
  { phone: "+2290197000010", fullName: "Carine Agossou", role: "BUYER" as const, commune: "Cotonou", pin: "1234", organization: "Agossou Négoce (démo)" },
  { phone: "+2290197000020", fullName: "Marcel Dossou", role: "AGENT" as const, commune: "Bohicon", pin: "1234", organization: "DDAEP Zou (démo)" },
  { phone: "+2290197000099", fullName: "Administrateur AgriVeille", role: "ADMIN" as const, commune: "Cotonou", pin: "9876", organization: "AgriVeille" },
];

// ─────────────────────────── Parcelles et cultures ───────────────────────────
const PARCELS = [
  { id: "cseedparcel0001", owner: "+2290197000001", name: "Champ derrière la maison", commune: "Bohicon", lat: 7.1905, lon: 2.0712, areaHa: 1.5 },
  { id: "cseedparcel0002", owner: "+2290197000001", name: "Jardin maraîcher", commune: "Bohicon", lat: 7.1714, lon: 2.0548, areaHa: 0.4 },
  { id: "cseedparcel0003", owner: "+2290197000001", name: "Champ de manioc", commune: "Abomey", lat: 7.1967, lon: 2.0105, areaHa: 2 },
  { id: "cseedparcel0004", owner: "+2290197000002", name: "Grand champ", commune: "Parakou", lat: 9.3651, lon: 2.6012, areaHa: 5 },
  { id: "cseedparcel0005", owner: "+2290197000002", name: "Champ près du bas-fond", commune: "Parakou", lat: 9.3104, lon: 2.6588, areaHa: 2.5 },
];

// sow/harvest : décalage en jours par rapport à la date du seed.
const PLANTINGS: { id: string; parcel: string; crop: string; sow: number; harvest: number; status: PlantingStatus; yieldKg: number | null }[] = [
  { id: "cseedplant00001", parcel: "cseedparcel0001", crop: "mais", sow: -45, harvest: 55, status: "GROWING", yieldKg: 2400 },
  { id: "cseedplant00002", parcel: "cseedparcel0001", crop: "niebe", sow: 10, harvest: 85, status: "PLANNED", yieldKg: null },
  { id: "cseedplant00003", parcel: "cseedparcel0002", crop: "tomate", sow: -104, harvest: 6, status: "GROWING", yieldKg: 3000 },
  { id: "cseedplant00004", parcel: "cseedparcel0002", crop: "piment", sow: 20, harvest: 170, status: "PLANNED", yieldKg: null },
  { id: "cseedplant00005", parcel: "cseedparcel0003", crop: "manioc", sow: -170, harvest: 160, status: "GROWING", yieldKg: 20000 },
  { id: "cseedplant00006", parcel: "cseedparcel0003", crop: "mais", sow: -170, harvest: -70, status: "HARVESTED", yieldKg: 2800 },
  { id: "cseedplant00007", parcel: "cseedparcel0004", crop: "coton", sow: -110, harvest: 40, status: "GROWING", yieldKg: 5500 },
  { id: "cseedplant00008", parcel: "cseedparcel0004", crop: "soja", sow: -102, harvest: 8, status: "GROWING", yieldKg: 3000 },
  { id: "cseedplant00009", parcel: "cseedparcel0005", crop: "igname", sow: -200, harvest: 40, status: "GROWING", yieldKg: 25000 },
  { id: "cseedplant00010", parcel: "cseedparcel0005", crop: "arachide", sow: -95, harvest: 5, status: "GROWING", yieldKg: 2000 },
];

// ─────────────────────────── Marché ───────────────────────────
// Prix en FCFA/kg, ordres de grandeur observés sur les marchés béninois.
const LISTINGS: {
  id: string; seller: string; crop: string; title: string; quantityKg: number; price: number; market: Market;
  commune: string; from: number; quality?: string; certification?: string; status: "OPEN" | "RESERVED" | "SOLD";
}[] = [
  { id: "cseedlisting001", seller: "+2290197000001", crop: "mais", title: "Maïs blanc séché, grains triés", quantityKg: 1500, price: 260, market: "LOCAL", commune: "Bohicon", from: 0, quality: "Humidité inférieure à 14 %, sacs de 100 kg", status: "OPEN" },
  { id: "cseedlisting002", seller: "+2290197000001", crop: "tomate", title: "Tomates fraîches de la semaine", quantityKg: 400, price: 350, market: "LOCAL", commune: "Bohicon", from: 5, quality: "Paniers de 25 kg, calibre moyen", status: "OPEN" },
  { id: "cseedlisting003", seller: "+2290197000001", crop: "manioc", title: "Racines de manioc fraîches", quantityKg: 5000, price: 75, market: "LOCAL", commune: "Abomey", from: 30, quality: "Récolte sur commande, livraison à la ferme", status: "OPEN" },
  { id: "cseedlisting004", seller: "+2290197000001", crop: "niebe", title: "Niébé blanc, stocké en sac hermétique", quantityKg: 300, price: 600, market: "LOCAL", commune: "Bohicon", from: 0, quality: "Sans bruche, séché au soleil", status: "RESERVED" },
  { id: "cseedlisting005", seller: "+2290197000001", crop: "piment", title: "Piment séché pour l'export régional", quantityKg: 200, price: 1800, market: "EXPORT", commune: "Bohicon", from: 0, quality: "Séché sur claies, sans moisissure", status: "OPEN" },
  { id: "cseedlisting006", seller: "+2290197000001", crop: "mais", title: "Maïs jaune, récolte précédente", quantityKg: 800, price: 240, market: "LOCAL", commune: "Abomey", from: -20, status: "SOLD" },
  { id: "cseedlisting007", seller: "+2290197000002", crop: "soja", title: "Soja grain pour transformateur", quantityKg: 3000, price: 300, market: "LOCAL", commune: "Parakou", from: 10, quality: "Grains propres, triés", status: "OPEN" },
  { id: "cseedlisting008", seller: "+2290197000002", crop: "igname", title: "Igname Kokoro, gros tubercules", quantityKg: 2000, price: 350, market: "LOCAL", commune: "Parakou", from: 40, status: "OPEN" },
  { id: "cseedlisting009", seller: "+2290197000002", crop: "arachide", title: "Arachide coque, séchée", quantityKg: 1000, price: 450, market: "LOCAL", commune: "Parakou", from: 7, quality: "Séchage rapide contre les aflatoxines", status: "OPEN" },
  { id: "cseedlisting010", seller: "+2290197000002", crop: "anacarde", title: "Noix de cajou brutes pour unité de transformation", quantityKg: 1200, price: 450, market: "LOCAL", commune: "Parakou", from: 150, quality: "Taux de défauts inférieur à 10 %", status: "OPEN" },
  { id: "cseedlisting011", seller: "+2290197000002", crop: "niebe", title: "Niébé rouge pour exportation sous-régionale", quantityKg: 2500, price: 550, market: "EXPORT", commune: "Parakou", from: 45, status: "OPEN" },
  { id: "cseedlisting012", seller: "+2290197000001", crop: "ananas", title: "Ananas Pain de sucre", quantityKg: 1000, price: 220, market: "EXPORT", commune: "Bohicon", from: 15, quality: "Fruits de 1,2 à 1,8 kg", certification: "Agriculture biologique (démo)", status: "OPEN" },
];

const OFFERS = [
  { id: "cseedoffer00001", listing: "cseedlisting001", quantityKg: 1000, price: 250, message: "Je peux enlever à Bohicon la semaine prochaine.", status: "PENDING" as const },
  { id: "cseedoffer00002", listing: "cseedlisting004", quantityKg: 300, price: 600, message: "D'accord pour tout le lot.", status: "ACCEPTED" as const },
  { id: "cseedoffer00003", listing: "cseedlisting007", quantityKg: 3000, price: 280, message: null, status: "PENDING" as const },
  { id: "cseedoffer00004", listing: "cseedlisting005", quantityKg: 200, price: 1500, message: "Prix export habituel.", status: "REJECTED" as const },
  { id: "cseedoffer00005", listing: "cseedlisting012", quantityKg: 500, price: 210, message: "Livraison à Cotonou possible ?", status: "PENDING" as const },
];

// Prix de référence (FCFA/kg). commune null = moyenne nationale.
const REFERENCE_PRICES: { crop: string; commune: string | null; market: Market; price: number }[] = [
  { crop: "mais", commune: null, market: "LOCAL", price: 250 },
  { crop: "mais", commune: "Bohicon", market: "LOCAL", price: 265 },
  { crop: "mais", commune: "Parakou", market: "LOCAL", price: 230 },
  { crop: "manioc", commune: null, market: "LOCAL", price: 80 },
  { crop: "igname", commune: null, market: "LOCAL", price: 330 },
  { crop: "igname", commune: "Parakou", market: "LOCAL", price: 300 },
  { crop: "coton", commune: null, market: "LOCAL", price: 300 },
  { crop: "soja", commune: null, market: "LOCAL", price: 300 },
  { crop: "riz", commune: null, market: "LOCAL", price: 230 },
  { crop: "riz", commune: "Malanville", market: "LOCAL", price: 210 },
  { crop: "anacarde", commune: null, market: "LOCAL", price: 450 },
  { crop: "ananas", commune: null, market: "LOCAL", price: 180 },
  { crop: "ananas", commune: null, market: "EXPORT", price: 250 },
  { crop: "niebe", commune: null, market: "LOCAL", price: 580 },
  { crop: "niebe", commune: null, market: "EXPORT", price: 620 },
  { crop: "tomate", commune: null, market: "LOCAL", price: 400 },
  { crop: "tomate", commune: "Cotonou", market: "LOCAL", price: 450 },
  { crop: "piment", commune: null, market: "LOCAL", price: 600 },
  { crop: "piment", commune: null, market: "EXPORT", price: 1900 },
  { crop: "arachide", commune: null, market: "LOCAL", price: 480 },
];

// ─────────────────────────── Redevances (barème de démonstration) ───────────────────────────
const LEVY_RATES = [
  { code: "MARCHE-KG", labelFr: "Redevance de commercialisation (par kg vendu) — démo", basis: "PER_KG" as const, rate: 2 },
  { code: "VALEUR-1PC", labelFr: "Redevance sur la valeur déclarée (1 %) — démo", basis: "PERCENT_VALUE" as const, rate: 100 },
  { code: "TICKET-PLACE", labelFr: "Ticket de place au marché (forfait) — démo", basis: "FLAT" as const, rate: 200 },
];

// ─────────────────────────── Réglementation ───────────────────────────
// sourceRef renseigné uniquement pour des textes dont l'existence est certaine.
const REGULATIONS = [
  {
    slug: "usage-des-pesticides", category: "PHYTO" as const,
    titleFr: "Utiliser un produit phytosanitaire sans danger",
    summaryFr: "N'utiliser que des produits homologués au Bénin, avec étiquette, à la bonne dose et avec une protection.",
    bodyFr: `## L'essentiel

- **N'achetez que des produits homologués** au Bénin, vendus avec une étiquette lisible en français. Méfiez-vous des produits vendus au détail dans des bouteilles de boisson.
- **Lisez l'étiquette** ou faites-la lire : culture autorisée, dose, délai avant récolte.
- **Protégez-vous** : gants, masque, bottes, manches longues. Ne mangez pas, ne buvez pas, ne fumez pas pendant le traitement.
- **Respectez le délai avant récolte** indiqué : sinon les résidus restent sur les produits vendus.
- **Ne réutilisez jamais un emballage vide** pour l'eau ou la nourriture : percez-le et rapportez-le au point de collecte.

## Avant de traiter

La lutte intégrée passe d'abord par la prévention (rotation, variétés tolérantes, surveillance, extraits naturels comme le neem). Le produit chimique est le dernier recours. En cas de doute, demandez conseil à l'agent de votre commune.`,
    sourceRef: "Loi n° 91-004 du 11 février 1991 portant réglementation phytosanitaire en République du Bénin",
  },
  {
    slug: "signaler-un-ravageur", category: "PHYTO" as const,
    titleFr: "Signaler un ravageur ou une maladie",
    summaryFr: "Un foyer signalé tôt protège tout le village : photo, position, et l'agent confirme.",
    bodyFr: `## Pourquoi signaler

Certains ravageurs (chenille légionnaire, criquets, mouche des fruits) se propagent très vite d'un champ à l'autre. Un signalement précoce permet aux services de l'agriculture d'alerter les producteurs voisins et d'organiser la lutte.

## Comment faire dans AgriVeille

1. Ouvrez « Signaler » et prenez une photo nette des feuilles ou des fruits atteints.
2. Laissez le téléphone indiquer la position du champ, ou choisissez la parcelle.
3. Décrivez ce que vous voyez, à l'écrit ou à la voix.

Le signalement fonctionne aussi sans réseau : il part dès que la connexion revient. Un agent le vérifie ; s'il le confirme, une alerte est envoyée aux producteurs situés autour.`,
    sourceRef: null,
  },
  {
    slug: "semences-de-qualite", category: "SEEDS" as const,
    titleFr: "Choisir des semences de qualité",
    summaryFr: "Acheter des semences certifiées chez un distributeur agréé et conserver la preuve d'achat.",
    bodyFr: `## Conseils

- Achetez vos semences auprès d'un **distributeur agréé** ou d'un multiplicateur reconnu par les services de l'agriculture.
- Vérifiez l'**étiquette** : variété, date de production, taux de germination, numéro de lot.
- Gardez la **facture** et l'étiquette jusqu'à la récolte : elles servent en cas de problème.
- Pour le manioc, utilisez des **boutures saines** issues de champs sans mosaïque.

## Semences paysannes

Vous pouvez resemer une partie de votre récolte pour les variétés locales. Triez les meilleures graines, séchez-les bien et stockez-les à l'abri des insectes. Pour le maïs hybride, le resemis donne de mauvais rendements : il faut racheter la semence.`,
    sourceRef: null,
  },
  {
    slug: "exporter-des-produits-agricoles", category: "EXPORT" as const,
    titleFr: "Vendre à l'exportation : les étapes",
    summaryFr: "Un produit exporté doit être accompagné de documents officiels, dont un certificat phytosanitaire.",
    bodyFr: `## Ce qu'il faut savoir

- L'exportation de produits végétaux exige en général un **certificat phytosanitaire** délivré par le service officiel de protection des végétaux, après inspection du lot.
- Le pays acheteur peut imposer ses propres normes : **limites de résidus de pesticides**, calibre, traçabilité, certification (par exemple GlobalG.A.P. ou biologique pour l'Europe).
- Certains produits bruts peuvent faire l'objet de **mesures de restriction à l'exportation** décidées par le Gouvernement : renseignez-vous auprès de la DDAEP ou de la chambre d'agriculture avant de vous engager.

## Conseils pratiques

Tenez un cahier de culture (dates de semis, produits utilisés, récolte) : c'est la base de la traçabilité demandée par les exportateurs. Vendre en groupe (coopérative) facilite l'accès aux marchés d'exportation.`,
    sourceRef: null,
  },
  {
    slug: "redevances-et-quittances", category: "TAX" as const,
    titleFr: "Déclarer une vente et obtenir sa quittance",
    summaryFr: "La déclaration se fait dans l'application ; la quittance porte un code QR vérifiable par tous.",
    bodyFr: `## Comment ça marche

1. Dans « Redevances », choisissez le type de redevance et indiquez la quantité ou la valeur vendue.
2. Le montant dû est **calculé automatiquement** selon le barème en vigueur.
3. Le paiement est enregistré au guichet par un agent (dans cette démonstration, un bouton « Payer (démo) » simule le paiement).
4. Vous recevez une **quittance numérotée** avec un code QR. Toute personne peut vérifier son authenticité en scannant le code.

Le barème affiché dans cette démonstration est **fictif** : il sert à illustrer le fonctionnement.`,
    sourceRef: null,
  },
  {
    slug: "securiser-sa-terre", category: "LAND" as const,
    titleFr: "Sécuriser sa terre agricole",
    summaryFr: "Faire reconnaître ses droits sur la terre protège contre les conflits et facilite le crédit.",
    bodyFr: `## Pourquoi c'est important

Un champ dont les droits sont reconnus par écrit est mieux protégé contre les litiges et peut faciliter l'accès au crédit ou aux projets d'aménagement.

## Les démarches

- Renseignez-vous auprès de la **mairie** de votre commune ou du service chargé du foncier sur les documents possibles pour votre situation (héritage, achat, attribution).
- Pour une location ou un prêt de terre, **écrivez l'accord** (durée, surface, contrepartie) devant témoins, et faites-le enregistrer si possible.
- Conservez tous les documents (actes, reçus, plans) dans un endroit sûr.

En cas de conflit, privilégiez d'abord la conciliation devant les autorités locales.`,
    sourceRef: "Loi n° 2013-01 du 14 août 2013 portant code foncier et domanial en République du Bénin",
  },
  {
    slug: "agriculture-biologique", category: "ORGANIC" as const,
    titleFr: "Produire en agriculture biologique",
    summaryFr: "Sans engrais ni pesticides de synthèse, avec une certification pour vendre sous la mention « bio ».",
    bodyFr: `## Principes

- Pas d'engrais chimiques de synthèse : compost, fumier, engrais verts (mucuna, légumineuses), rotation.
- Pas de pesticides de synthèse : prévention, extraits de neem, pièges, auxiliaires ; seuls quelques produits autorisés (comme le cuivre) sont admis.
- Pas de semences génétiquement modifiées.

## Certification

Pour vendre sous la mention « bio », surtout à l'exportation (ananas, anacarde, karité), il faut une **certification** par un organisme reconnu par le pays acheteur, ou un **système participatif de garantie** pour le marché local. La conversion d'une parcelle prend en général plusieurs saisons.`,
    sourceRef: null,
  },
  {
    slug: "stockage-apres-recolte", category: "PHYTO" as const,
    titleFr: "Bien stocker ses récoltes",
    summaryFr: "Sécher, trier, stocker hermétique : moins de pertes et pas de produits dangereux à la maison.",
    bodyFr: `## Les bons gestes

- **Sécher** les grains jusqu'à ce qu'ils craquent sous la dent (moins de 13-14 % d'humidité pour le maïs).
- **Trier** et éliminer les grains abîmés ou moisis : les moisissures produisent des toxiques (aflatoxines) dangereux pour la santé.
- **Stocker hermétique** : sacs à triple fond, fûts ou bidons fermés. Sans air, les insectes meurent sans aucun produit.
- Placer les sacs sur des **palettes**, à l'écart des murs, dans un local propre et aéré.

## À ne jamais faire

N'utilisez jamais de produits de fumigation dans une habitation : ces gaz sont mortels. Ne traitez pas les grains destinés à la consommation avec des produits prévus pour les cultures.`,
    sourceRef: null,
  },
];

// ─────────────────────────── Exécution ───────────────────────────

async function main() {
  const communeId = new Map<string, string>();
  for (const c of COMMUNES) {
    const row = await prisma.commune.upsert({
      where: { name: c.name },
      create: c,
      update: { department: c.department, lat: c.lat, lon: c.lon, agroZone: c.agroZone },
      select: { id: true },
    });
    communeId.set(c.name, row.id);
  }

  const cropId = new Map<string, string>();
  for (const c of CROPS) {
    const row = await prisma.crop.upsert({ where: { slug: c.slug }, create: c, update: c, select: { id: true } });
    cropId.set(c.slug, row.id);
  }

  for (const p of PESTS) {
    const { crops, ...data } = p;
    const ids = crops.map((slug) => ({ id: cropId.get(slug)! }));
    await prisma.pest.upsert({
      where: { slug: p.slug },
      create: { ...data, crops: { connect: ids } },
      update: { ...data, crops: { set: ids } },
    });
  }

  const userId = new Map<string, string>();
  for (const u of USERS) {
    const pinHash = await hashPin(u.pin);
    const data = {
      fullName: u.fullName,
      role: u.role,
      communeId: communeId.get(u.commune)!,
      organization: u.organization,
      pinHash,
      isActive: true,
      failedLogins: 0,
      lockedUntil: null,
    };
    const row = await prisma.user.upsert({
      where: { phone: u.phone },
      create: { phone: u.phone, ...data },
      update: data,
      select: { id: true },
    });
    userId.set(u.phone, row.id);
  }

  for (const p of PARCELS) {
    const data = {
      ownerId: userId.get(p.owner)!,
      name: p.name,
      communeId: communeId.get(p.commune)!,
      lat: p.lat,
      lon: p.lon,
      areaHa: p.areaHa,
    };
    await prisma.parcel.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
  }

  for (const pl of PLANTINGS) {
    const data = {
      parcelId: pl.parcel,
      cropId: cropId.get(pl.crop)!,
      sowingDate: daysFromNow(pl.sow),
      expectedHarvestDate: daysFromNow(pl.harvest),
      status: pl.status,
      estimatedYieldKg: pl.yieldKg,
    };
    await prisma.planting.upsert({ where: { id: pl.id }, create: { id: pl.id, ...data }, update: data });
  }

  for (const l of LISTINGS) {
    const data = {
      sellerId: userId.get(l.seller)!,
      cropId: cropId.get(l.crop)!,
      title: l.title,
      quantityKg: l.quantityKg,
      pricePerKgFcfa: l.price,
      market: l.market,
      communeId: communeId.get(l.commune)!,
      availableFrom: daysFromNow(l.from),
      qualityNote: l.quality ?? null,
      certification: l.certification ?? null,
      status: l.status,
    };
    await prisma.listing.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update: data });
  }

  const buyer = userId.get("+2290197000010")!;
  for (const o of OFFERS) {
    const data = {
      listingId: o.listing,
      buyerId: buyer,
      quantityKg: o.quantityKg,
      pricePerKgFcfa: o.price,
      message: o.message,
      status: o.status,
    };
    await prisma.offer.upsert({ where: { id: o.id }, create: { id: o.id, ...data }, update: data });
  }

  for (const [i, r] of REFERENCE_PRICES.entries()) {
    const id = `cseedrefprice${String(i + 1).padStart(3, "0")}`;
    const data = {
      cropId: cropId.get(r.crop)!,
      communeId: r.commune ? communeId.get(r.commune)! : null,
      market: r.market,
      pricePerKgFcfa: r.price,
      observedAt: daysFromNow(-3),
    };
    await prisma.referencePrice.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  const levyId = new Map<string, string>();
  for (const l of LEVY_RATES) {
    const row = await prisma.levyRate.upsert({
      where: { code: l.code },
      create: { ...l, active: true },
      update: { ...l, active: true },
      select: { id: true },
    });
    levyId.set(l.code, row.id);
  }

  // Une quittance payée pour la démonstration de /verifier/<code>.
  // 1 % de 150 000 FCFA = 1 500 FCFA (même règle que le calcul serveur).
  const receipt = {
    farmerId: userId.get("+2290197000001")!,
    levyRateId: levyId.get("VALEUR-1PC")!,
    cropId: cropId.get("mais")!,
    quantityKg: 600,
    declaredValueFcfa: 150_000,
    amountDueFcfa: 1_500,
    status: "PAID" as const,
    verificationCode: "DEMOAV2026QR",
    paidAt: daysFromNow(-12),
  };
  await prisma.declaration.upsert({
    where: { receiptNumber: "AV-2026-000001" },
    create: { receiptNumber: "AV-2026-000001", ...receipt },
    update: receipt,
  });

  for (const r of REGULATIONS) {
    await prisma.regulation.upsert({ where: { slug: r.slug }, create: { ...r, published: true }, update: r });
  }

  const counts = {
    Commune: await prisma.commune.count(),
    Crop: await prisma.crop.count(),
    Pest: await prisma.pest.count(),
    User: await prisma.user.count(),
    Parcel: await prisma.parcel.count(),
    Planting: await prisma.planting.count(),
    Listing: await prisma.listing.count(),
    Offer: await prisma.offer.count(),
    ReferencePrice: await prisma.referencePrice.count(),
    LevyRate: await prisma.levyRate.count(),
    Declaration: await prisma.declaration.count(),
    Regulation: await prisma.regulation.count(),
  };
  console.table(counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
