import { describe, expect, it, vi } from "vitest";
import { USSD_MAX_CHARS, clip, ussdRespond, type UssdProvider } from "./ussd";

function provider(overrides: Partial<UssdProvider> = {}): UssdProvider {
  return {
    alerts: async () => [
      { id: "al1", title: "Sécheresse", message: "Moins de 10 mm de pluie prévus cette semaine.", severity: "WARNING", acknowledged: false },
    ],
    acknowledge: vi.fn(async () => true),
    parcels: async () => [{ id: "p1", name: "Champ de maïs" }],
    weather: async () => ({
      fetchedAt: new Date("2026-09-25T10:00:00Z"),
      days: [
        { date: "2026-09-25", tmax: 33.4, tmin: 23.2, precipMm: 1.6 },
        { date: "2026-09-26", tmax: 32, tmin: 22, precipMm: 0 },
      ],
    }),
    crops: async () => Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 1}`, name: `Culture ${i + 1}` })),
    prices: async () => [{ market: "LOCAL", price: 250, place: null }],
    pests: async () => [{ id: "pe1", name: "Chenille légionnaire" }],
    report: vi.fn(async () => ({ ok: true, ref: "AB12" })),
    ...overrides,
  };
}

describe("ussdRespond", () => {
  it("menu principal", async () => {
    const r = await ussdRespond([], provider());
    expect(r.text).toContain("1 Mes alertes");
    expect(r.text).toContain("4 Signaler un ravageur");
    expect(r.end).toBe(false);
  });

  it("alertes → détail → accusé, exécuté une seule fois et en fin de chemin", async () => {
    const p = provider();
    const list = await ussdRespond(["1"], p);
    expect(list.text).toContain("1 ! Sécheresse");
    const detail = await ussdRespond(["1", "1"], p);
    expect(detail.text).toContain("Attention : Sécheresse");
    expect(detail.text).toContain("1 J'ai compris");
    const done = await ussdRespond(["1", "1", "1"], p);
    expect(done.end).toBe(true);
    expect(done.text).toContain("Accusé de réception enregistré");
    expect(p.acknowledge).toHaveBeenCalledTimes(1);
    expect(p.acknowledge).toHaveBeenCalledWith("al1");
  });

  it("météo : 3 jours au plus, arrondis", async () => {
    const r = await ussdRespond(["2", "1"], provider());
    expect(r.text).toContain("Ven 25 33/23°C 2mm");
  });

  it("prix : pagination « 8 Suite »", async () => {
    const page1 = await ussdRespond(["3"], provider());
    expect(page1.text).toContain("6 Culture 6");
    expect(page1.text).toContain("8 Suite");
    const page2 = await ussdRespond(["3", "8"], provider());
    expect(page2.text).toContain("1 Culture 7");
    const price = await ussdRespond(["3", "8", "2"], provider());
    expect(price.text).toContain("Culture 8");
    expect(price.text).toContain("National local : 250 F/kg");
  });

  it("signalement : champ → ravageur inconnu → envoyer", async () => {
    const p = provider();
    const confirm = await ussdRespond(["4", "1", "7"], p);
    expect(confirm.text).toContain("ravageur inconnu");
    const sent = await ussdRespond(["4", "1", "7", "1"], p);
    expect(sent.end).toBe(true);
    expect(sent.text).toContain("réf. AB12");
    expect(p.report).toHaveBeenCalledWith("p1", null);
  });

  it("choix invalide : reste sur l'écran, chemin inchangé", async () => {
    const r = await ussdRespond(["1", "9"], provider());
    expect(r.text.startsWith("Choix invalide.")).toBe(true);
    expect(r.path).toEqual(["1"]);
    expect(r.end).toBe(false);
  });

  it("0 = retour, puis 0 à la racine = fin", async () => {
    const back = await ussdRespond(["2", "0"], provider());
    expect(back.path).toEqual([]);
    expect(back.text).toContain("1 Mes alertes");
    const quit = await ussdRespond(["0"], provider());
    expect(quit.end).toBe(true);
  });

  it("aucun écran ne dépasse 182 caractères", async () => {
    const long = "x".repeat(400);
    const p = provider({
      alerts: async () => [{ id: "a", title: long, message: long, severity: "CRITICAL", acknowledged: false }],
    });
    for (const path of [[], ["1"], ["1", "1"], ["2", "1"], ["3"], ["4", "1"], ["4", "1", "1"]]) {
      const r = await ussdRespond(path, p);
      expect(r.text.length).toBeLessThanOrEqual(USSD_MAX_CHARS);
    }
  });

  it("sans champ : message clair", async () => {
    const r = await ussdRespond(["4"], provider({ parcels: async () => [] }));
    expect(r.text).toContain("Aucun champ");
  });
});

describe("clip", () => {
  it("coupe sur un mot avec une ellipse", () => {
    expect(clip("un deux trois quatre", 12)).toBe("un deux…");
  });
});
