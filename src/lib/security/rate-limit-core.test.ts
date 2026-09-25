import { describe, expect, it } from "vitest";
import { consumeFixedWindow, evaluate } from "./rate-limit-core";

const rule = { limit: 3, windowMs: 60_000 };
const t0 = new Date("2026-09-25T10:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("consumeFixedWindow", () => {
  it("autorise jusqu'à la limite puis refuse", () => {
    let r = consumeFixedWindow(null, t0, rule);
    expect(r).toMatchObject({ allowed: true, remaining: 2 });
    r = consumeFixedWindow(r.next, at(1000), rule);
    r = consumeFixedWindow(r.next, at(2000), rule);
    expect(r).toMatchObject({ allowed: true, remaining: 0 });
    r = consumeFixedWindow(r.next, at(3000), rule);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(57_000);
  });

  it("réinitialise à l'expiration de la fenêtre", () => {
    const full = { count: 10, windowStart: t0 };
    const r = consumeFixedWindow(full, at(60_000), rule);
    expect(r.allowed).toBe(true);
    expect(r.next).toEqual({ count: 1, windowStart: at(60_000) });
  });

  it("evaluate interprète un état persisté", () => {
    expect(evaluate({ count: 4, windowStart: t0 }, at(30_000), rule)).toMatchObject({ allowed: false, retryAfterMs: 30_000 });
  });

  it("refuse une règle invalide", () => {
    expect(() => consumeFixedWindow(null, t0, { limit: 0, windowMs: 1 })).toThrow();
  });
});
