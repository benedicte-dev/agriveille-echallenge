import { describe, expect, it } from "vitest";
import { formatBeninPhone, maskBeninPhone, normalizeBeninPhone } from "./phone";
import { phoneSchema } from "@/lib/validation";

describe("normalizeBeninPhone", () => {
  it.each([
    ["0197000001", "+2290197000001"],
    ["+229 01 97 00 00 01", "+2290197000001"],
    ["+2290197000001", "+2290197000001"],
    ["01 97 00 00 01", "+2290197000001"],
    ["00229 0197000001", "+2290197000001"],
    ["2290197000001", "+2290197000001"],
    ["01.97.00.00.01", "+2290197000001"],
    ["97000001", "+2290197000001"],
  ])("accepte %s", (input, expected) => {
    expect(normalizeBeninPhone(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "0297000001", // ne commence pas par 01
    "019700000", // 9 chiffres
    "01970000011", // 11 chiffres
    "+33 6 12 34 56 78", // autre pays
    "+2290297000001",
    "01-97-AB-00-01",
    "abc",
  ])("refuse %s", (input) => {
    expect(normalizeBeninPhone(input)).toBeNull();
  });

  it("refuse les valeurs non textuelles", () => {
    expect(normalizeBeninPhone(null)).toBeNull();
    expect(normalizeBeninPhone(undefined)).toBeNull();
  });

  it("formate et masque", () => {
    expect(formatBeninPhone("+2290197000001")).toBe("+229 01 97 00 00 01");
    expect(maskBeninPhone("+2290197000001")).toBe("+229 01 •• •• •• 01");
  });

  it("phoneSchema normalise ou renvoie un message", () => {
    expect(phoneSchema.parse(" 01 97 00 00 02 ")).toBe("+2290197000002");
    const r = phoneSchema.safeParse("12345");
    expect(r.success).toBe(false);
  });
});
