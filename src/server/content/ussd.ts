/**
 * Moteur du simulateur USSD *229*1# (DÉMO, /agent/sms). Module pur : les
 * données viennent d'un `UssdProvider` injecté (Prisma côté serveur, faux
 * fournisseur dans les tests).
 *
 * Fonctionnement « sans état », comme une passerelle USSD : chaque appel
 * rejoue le chemin complet des réponses depuis la composition du code.
 * Le moteur renvoie le chemin normalisé (réponses valides seulement, « 0 »
 * = retour) que le client garde pour l'appel suivant. Les actions qui écrivent
 * (accusé de réception, signalement) ne s'exécutent que sur la dernière
 * réponse du chemin, et terminent la session : rejouer un chemin ne les
 * répète donc jamais.
 */

import { clip } from "./text";

export { clip };

export const USSD_CODE = "*229*1#";
/** Longueur utile d'un écran USSD (GSM 03.38 : 182 caractères). */
export const USSD_MAX_CHARS = 182;
const PAGE_SIZE = 6;

export type UssdSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface UssdAlert {
  id: string;
  title: string;
  message: string;
  severity: UssdSeverity;
  acknowledged: boolean;
}

export interface UssdDay {
  date: string; // YYYY-MM-DD
  tmax: number;
  tmin: number;
  precipMm: number;
}

export interface UssdProvider {
  alerts(): Promise<UssdAlert[]>;
  acknowledge(alertId: string): Promise<boolean>;
  parcels(): Promise<{ id: string; name: string }[]>;
  weather(parcelId: string): Promise<{ fetchedAt: Date; days: UssdDay[] } | null>;
  crops(): Promise<{ id: string; name: string }[]>;
  prices(cropId: string): Promise<{ market: "LOCAL" | "EXPORT"; price: number; place: string | null }[]>;
  pests(): Promise<{ id: string; name: string }[]>;
  report(parcelId: string, pestId: string | null): Promise<{ ok: boolean; ref?: string }>;
}

export interface UssdResult {
  text: string;
  /** Session terminée (le téléphone affiche « OK » et raccroche). */
  end: boolean;
  /** Chemin normalisé à renvoyer au prochain appel. */
  path: string[];
}

interface Screen {
  text: string;
  end?: boolean;
  /** Réponse à une saisie ; null = choix invalide. `commit` = dernière saisie du chemin. */
  next?: (input: string, commit: boolean) => Promise<Screen | null>;
}

const SEV: Record<UssdSeverity, string> = { INFO: "Info", WARNING: "Attention", CRITICAL: "DANGER" };
const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** Assemble un écran : corps coupé pour que les options tiennent toujours. */
function screenText(body: string, options: string[] = []): string {
  const opts = options.join("\n");
  const room = USSD_MAX_CHARS - (opts ? opts.length + 1 : 0);
  return opts ? `${clip(body, Math.max(room, 20))}\n${opts}` : clip(body, USSD_MAX_CHARS);
}

function endScreen(text: string): Screen {
  return { text: clip(text, USSD_MAX_CHARS), end: true };
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : `${DAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Liste paginée : « 1…6 » choisissent, « 8 » = suite, « 0 » = retour (géré par le moteur).
 * `extra` : option supplémentaire (ex. « 7 Je ne sais pas »).
 */
function listScreen<T extends { name: string }>(
  title: string,
  items: T[],
  onPick: (item: T | null, commit: boolean) => Promise<Screen | null>,
  opts: { page?: number; extra?: { key: string; label: string } } = {},
): Screen {
  const page = opts.page ?? 0;
  const slice = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const more = items.length > (page + 1) * PAGE_SIZE;
  const lines = slice.map((it, i) => `${i + 1} ${clip(it.name, 24)}`);
  if (opts.extra) lines.push(`${opts.extra.key} ${opts.extra.label}`);
  if (more) lines.push("8 Suite");
  lines.push("0 Retour");
  return {
    text: screenText(title, lines),
    async next(input, commit) {
      if (more && input === "8") return listScreen(title, items, onPick, { ...opts, page: page + 1 });
      if (opts.extra && input === opts.extra.key) return onPick(null, commit);
      const n = Number(input);
      if (!Number.isInteger(n) || n < 1 || n > slice.length) return null;
      return onPick(slice[n - 1], commit);
    },
  };
}

function rootScreen(p: UssdProvider): Screen {
  return {
    text: screenText("AgriVeille", [
      "1 Mes alertes",
      "2 Météo de mon champ",
      "3 Prix du marché",
      "4 Signaler un ravageur",
      "0 Quitter",
    ]),
    async next(input) {
      switch (input) {
        case "1":
          return alertsScreen(p);
        case "2":
          return weatherParcelsScreen(p);
        case "3":
          return pricesScreen(p);
        case "4":
          return reportParcelsScreen(p);
        default:
          return null;
      }
    },
  };
}

async function alertsScreen(p: UssdProvider): Promise<Screen> {
  const alerts = await p.alerts();
  if (alerts.length === 0) return { text: screenText("Aucune alerte en cours pour vos champs.", ["0 Retour"]) };
  const items = alerts.map((a) => ({ ...a, name: `${a.severity === "INFO" ? "" : "! "}${a.title}` }));
  return listScreen("Vos alertes :", items, async (a) => {
    if (!a) return null;
    const body = `${SEV[a.severity]} : ${a.title}. ${a.message}`;
    if (a.acknowledged) return { text: screenText(body, ["(déjà accusée)", "0 Retour"]) };
    return {
      text: screenText(body, ["1 J'ai compris", "0 Retour"]),
      async next(input, commit) {
        if (input !== "1") return null;
        if (!commit) return endScreen("Session terminée.");
        const ok = await p.acknowledge(a.id);
        return endScreen(ok ? "Merci. Accusé de réception enregistré." : "Alerte introuvable ou déjà accusée.");
      },
    };
  });
}

async function weatherParcelsScreen(p: UssdProvider): Promise<Screen> {
  const parcels = await p.parcels();
  if (parcels.length === 0) return { text: screenText("Aucun champ enregistré sur ce numéro.", ["0 Retour"]) };
  return listScreen("Météo : quel champ ?", parcels, async (parcel) => {
    if (!parcel) return null;
    const w = await p.weather(parcel.id);
    if (!w || w.days.length === 0) {
      return { text: screenText(`${parcel.name} : pas encore de prévision. Elle arrive avec l'analyse du jour.`, ["0 Retour"]) };
    }
    const lines = w.days
      .slice(0, 3)
      .map((d) => `${dayLabel(d.date)} ${Math.round(d.tmax)}/${Math.round(d.tmin)}°C ${Math.round(d.precipMm)}mm`);
    return { text: screenText([clip(parcel.name, 30), ...lines].join("\n"), ["0 Retour"]) };
  });
}

async function pricesScreen(p: UssdProvider): Promise<Screen> {
  const crops = await p.crops();
  if (crops.length === 0) return { text: screenText("Aucun prix publié.", ["0 Retour"]) };
  return listScreen("Prix : quelle culture ?", crops, async (crop) => {
    if (!crop) return null;
    const prices = await p.prices(crop.id);
    if (prices.length === 0) return { text: screenText(`${crop.name} : pas de prix de référence.`, ["0 Retour"]) };
    const lines = prices
      .slice(0, 4)
      .map((r) => `${r.place ?? "National"} ${r.market === "EXPORT" ? "export" : "local"} : ${r.price} F/kg`);
    return { text: screenText([crop.name, ...lines].join("\n"), ["0 Retour"]) };
  });
}

async function reportParcelsScreen(p: UssdProvider): Promise<Screen> {
  const parcels = await p.parcels();
  if (parcels.length === 0) return { text: screenText("Aucun champ enregistré sur ce numéro.", ["0 Retour"]) };
  return listScreen("Signaler : quel champ ?", parcels, async (parcel) => {
    if (!parcel) return null;
    const pests = await p.pests();
    return listScreen(
      "Quel ravageur ?",
      pests,
      async (pest) => ({
        text: screenText(`Envoyer : ${pest ? pest.name : "ravageur inconnu"} dans ${parcel.name} ?`, ["1 Envoyer", "0 Retour"]),
        async next(input, commit) {
          if (input !== "1") return null;
          if (!commit) return endScreen("Session terminée.");
          const r = await p.report(parcel.id, pest?.id ?? null);
          return endScreen(
            r.ok
              ? `Merci. Signalement envoyé${r.ref ? ` (réf. ${r.ref})` : ""}. Un agent va le vérifier.`
              : "Envoi impossible pour le moment. Réessayez plus tard.",
          );
        },
      }),
      { extra: { key: "7", label: "Je ne sais pas" } },
    );
  });
}

/** Rejoue `inputs` depuis la composition de *229*1# et renvoie l'écran courant. */
export async function ussdRespond(inputs: readonly string[], provider: UssdProvider): Promise<UssdResult> {
  const root = rootScreen(provider);
  const stack: Screen[] = [root];
  const path: string[] = [];

  for (let k = 0; k < inputs.length; k++) {
    const input = inputs[k].trim();
    const current = stack[stack.length - 1];
    const commit = k === inputs.length - 1;

    if (input === "0") {
      if (stack.length === 1) return { text: "Merci d'avoir utilisé AgriVeille.", end: true, path: [] };
      stack.pop();
      path.pop();
      continue;
    }
    const next = current.next ? await current.next(input, commit) : null;
    if (!next) {
      // Le titre de l'écran est remplacé par le message : les options restent visibles.
      const [, ...rest] = current.text.split("\n");
      return { text: ["Choix invalide.", ...rest].join("\n"), end: false, path };
    }
    if (next.end) return { text: next.text, end: true, path: [] };
    stack.push(next);
    path.push(input);
  }
  return { text: stack[stack.length - 1].text, end: false, path };
}
