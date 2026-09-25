import { describe, expect, it } from "vitest";
import { nextAllowedForRole, safeNextPath } from "./safe-next";

describe("safeNextPath (anti open-redirect)", () => {
  it.each(["/app", "/agent/signalements?statut=PENDING", "/app/alertes#a1", "/reglementation/usage-des-pesticides"])(
    "accepte le chemin interne %s",
    (p) => expect(safeNextPath(p)).toBe(p),
  );
  it.each([
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/\t/evil.example",
    "",
    " ",
    undefined,
    null,
    42,
    "/" + "a".repeat(600),
  ])("refuse %s", (p) => {
    expect(safeNextPath(p)).toBeNull();
  });
  it("un chemin encodé reste interne", () => {
    const r = safeNextPath("/%2F%2Fevil.example");
    expect(r).not.toBeNull();
    expect(new URL(r!, "https://x.invalid").origin).toBe("https://x.invalid");
  });
});

describe("nextAllowedForRole", () => {
  it("n'envoie pas un fermier vers /agent (éviterait une boucle de redirection)", () => {
    expect(nextAllowedForRole("/agent", "FARMER")).toBe(false);
    expect(nextAllowedForRole("/agent/sms", "AGENT")).toBe(true);
    expect(nextAllowedForRole("/agent", "ADMIN")).toBe(true);
    expect(nextAllowedForRole("/admin/audit", "AGENT")).toBe(false);
    expect(nextAllowedForRole("/app/parcelles", "FARMER")).toBe(true);
    expect(nextAllowedForRole("/application", "BUYER")).toBe(true);
    expect(nextAllowedForRole("/connexion", "FARMER")).toBe(false);
    expect(nextAllowedForRole("/marche", "BUYER")).toBe(true);
  });
});
