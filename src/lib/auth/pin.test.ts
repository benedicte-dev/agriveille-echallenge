import { describe, expect, it } from "vitest";
import { hashPin, verifyPin, verifyPinAgainstDummy } from "./pin";
import { generateSessionToken, hashSessionToken, isWellFormedToken } from "./token";
import { afterFailure, isLocked } from "./lockout";
import { LOCKOUT_MS } from "./constants";
import { newPinSchema, pinSchema } from "@/lib/validation";

describe("PIN argon2id", () => {
  it("hache en argon2id et vérifie", async () => {
    const h = await hashPin("4821");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPin(h, "4821")).toBe(true);
    expect(await verifyPin(h, "4822")).toBe(false);
  });

  it("deux hachages du même PIN diffèrent (sel)", async () => {
    expect(await hashPin("4821")).not.toBe(await hashPin("4821"));
  });

  it("refuse un PIN mal formé au hachage", async () => {
    await expect(hashPin("12a4")).rejects.toThrow();
    await expect(hashPin("12345")).rejects.toThrow();
  });

  it("verifyPin ne lève jamais", async () => {
    expect(await verifyPin("pas-un-hash", "1234")).toBe(false);
    expect(await verifyPin("$argon2id$corrompu", "1234")).toBe(false);
    expect(await verifyPinAgainstDummy("1234")).toBe(false);
  });

  it("schémas PIN", () => {
    expect(pinSchema.safeParse("0420").success).toBe(true);
    expect(pinSchema.safeParse("042").success).toBe(false);
    expect(newPinSchema.safeParse("1234").success).toBe(false);
    expect(newPinSchema.safeParse("0000").success).toBe(false);
    expect(newPinSchema.safeParse("4821").success).toBe(true);
  });
});

describe("jetons de session", () => {
  it("32 octets base64url, hachés en SHA-256 hex", () => {
    const t = generateSessionToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(isWellFormedToken(t)).toBe(true);
    expect(hashSessionToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(t)).toBe(hashSessionToken(t));
    expect(generateSessionToken()).not.toBe(t);
    expect(isWellFormedToken("court")).toBe(false);
  });
});

describe("verrouillage", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  it("verrouille 15 min au 5e échec", () => {
    expect(afterFailure(4, now).locked).toBe(false);
    const r = afterFailure(5, now);
    expect(r.locked).toBe(true);
    expect(r.failedLogins).toBe(0);
    expect(r.lockedUntil!.getTime() - now.getTime()).toBe(LOCKOUT_MS);
    expect(isLocked(r.lockedUntil, now)).toBe(true);
    expect(isLocked(r.lockedUntil, new Date(now.getTime() + LOCKOUT_MS + 1))).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});
