import { describe, expect, it } from 'vitest';
import { haversineKm, parcelsWithinRadius } from './geo';

const COTONOU = { lat: 6.3703, lon: 2.3912 };
const PARAKOU = { lat: 9.3372, lon: 2.6303 };
const BOHICON = { lat: 7.178, lon: 2.067 };
const ABOMEY = { lat: 7.1829, lon: 1.9912 };

describe('haversineKm', () => {
  it('Cotonou–Parakou straight-line distance is about 331 km (±5)', () => {
    // La distance routière (RNIE 2) est d'environ 410 km ; à vol d'oiseau elle est d'environ 331 km.
    expect(Math.abs(haversineKm(COTONOU, PARAKOU) - 331)).toBeLessThanOrEqual(5);
  });
  it('is symmetric and zero for identical points', () => {
    expect(haversineKm(COTONOU, PARAKOU)).toBeCloseTo(haversineKm(PARAKOU, COTONOU), 9);
    expect(haversineKm(BOHICON, BOHICON)).toBe(0);
  });
  it('one degree of latitude ≈ 111.2 km', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 1);
  });
  it('rejects invalid coordinates', () => {
    expect(() => haversineKm({ lat: 91, lon: 0 }, COTONOU)).toThrow(RangeError);
    expect(() => haversineKm({ lat: Number.NaN, lon: 0 }, COTONOU)).toThrow(RangeError);
  });
});

describe('parcelsWithinRadius', () => {
  const parcels = [
    { id: 'parakou', ...PARAKOU },
    { id: 'abomey', ...ABOMEY },
    { id: 'bohicon', ...BOHICON },
    { id: 'broken', lat: Number.NaN, lon: 2 },
  ];
  it('returns parcels in radius sorted by distance, with distance', () => {
    const r = parcelsWithinRadius(BOHICON, 15, parcels);
    expect(r.map((p) => p.id)).toEqual(['bohicon', 'abomey']);
    expect(r[1].distanceKm).toBeGreaterThan(8);
    expect(r[1].distanceKm).toBeLessThan(9);
  });
  it('radius edge is inclusive', () => {
    const d = haversineKm(BOHICON, ABOMEY);
    expect(parcelsWithinRadius(BOHICON, d, parcels).map((p) => p.id)).toContain('abomey');
    expect(parcelsWithinRadius(BOHICON, d - 0.001, parcels).map((p) => p.id)).not.toContain('abomey');
  });
  it('rejects negative or non-finite radius', () => {
    expect(() => parcelsWithinRadius(BOHICON, -1, parcels)).toThrow(RangeError);
    expect(() => parcelsWithinRadius(BOHICON, Number.POSITIVE_INFINITY, parcels)).toThrow(RangeError);
  });
});
