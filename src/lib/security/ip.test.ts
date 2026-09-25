import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders } from "./ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("getClientIpFromHeaders", () => {
  it("prend la première valeur de x-forwarded-for", () => {
    expect(getClientIpFromHeaders(h({ "x-forwarded-for": "41.138.1.2, 10.0.0.1" }))).toBe("41.138.1.2");
  });
  it("replie sur x-real-ip puis unknown, rejette les valeurs forgées", () => {
    expect(getClientIpFromHeaders(h({ "x-real-ip": "::1" }))).toBe("::1");
    expect(getClientIpFromHeaders(h({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(getClientIpFromHeaders(h({}))).toBe("unknown");
    expect(getClientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4:5678" }))).toBe("1.2.3.4");
  });
});
