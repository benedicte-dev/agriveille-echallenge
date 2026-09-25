import { describe, expect, it } from "vitest";
import { amountFcfaSchema, coordinatesSchema, idSchema, paginationSchema, toSkipTake } from "./index";

describe("validation", () => {
  it("coordonnées dans l'emprise du Bénin", () => {
    expect(coordinatesSchema.safeParse({ lat: "7.18", lon: "2.07" }).success).toBe(true);
    expect(coordinatesSchema.safeParse({ lat: 5.5, lon: 2 }).success).toBe(false);
    expect(coordinatesSchema.safeParse({ lat: 9, lon: 4.2 }).success).toBe(false);
  });
  it("cuid, dont les identifiants fixes du seed", () => {
    expect(idSchema.safeParse("cseedparcel0001").success).toBe(true);
    expect(idSchema.safeParse("x' OR 1=1").success).toBe(false);
  });
  it("pagination tolérante", () => {
    const p = paginationSchema.parse({ page: "3", pageSize: "abc" });
    expect(p).toEqual({ page: 3, pageSize: 20 });
    expect(toSkipTake(p)).toEqual({ skip: 40, take: 20 });
  });
  it("montants entiers positifs", () => {
    expect(amountFcfaSchema.safeParse("1500").success).toBe(true);
    expect(amountFcfaSchema.safeParse("12.5").success).toBe(false);
    expect(amountFcfaSchema.safeParse(-1).success).toBe(false);
  });
});
