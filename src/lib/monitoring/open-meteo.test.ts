import { describe, expect, it, vi } from 'vitest';
import bohicon from './__fixtures__/open-meteo-bohicon.json';
import {
  OPEN_METEO_TIMEOUT_MS,
  WeatherUnavailableError,
  buildForecastUrl,
  fetchForecast,
  parseForecast,
  parseOpenMeteoResponse,
} from './open-meteo';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function expectReason(p: Promise<unknown>, reason: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(WeatherUnavailableError);
  expect((err as WeatherUnavailableError).reason).toBe(reason);
  return err as WeatherUnavailableError;
}

describe('buildForecastUrl', () => {
  it('requests the exact daily variables, timezone and horizon', () => {
    const url = new URL(buildForecastUrl(7.178, 2.067));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('7.1780');
    expect(url.searchParams.get('longitude')).toBe('2.0670');
    expect(url.searchParams.get('daily')).toBe(
      'temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max,et0_fao_evapotranspiration',
    );
    expect(url.searchParams.get('timezone')).toBe('Africa/Porto-Novo');
    expect(url.searchParams.get('forecast_days')).toBe('7');
  });
});

describe('parseOpenMeteoResponse (real Bohicon fixture)', () => {
  const f = parseOpenMeteoResponse(bohicon, 7.178, 2.067, new Date('2026-09-25T13:13:00Z'));
  it('maps the 7 days with all fields', () => {
    expect(f.lat).toBe(7.178);
    expect(f.lon).toBe(2.067);
    expect(f.fetchedAt).toBe('2026-09-25T13:13:00.000Z');
    expect(f.days).toHaveLength(7);
    expect(f.days[0]).toEqual({
      date: '2026-09-25',
      tmax: 30,
      tmin: 22.9,
      precipMm: 5.6,
      humidityMean: 88,
      windMaxKmh: 14.5,
      et0Mm: 3.67,
    });
    expect(f.days[6].date).toBe('2026-10-01');
  });
  it('result round-trips through parseForecast (WeatherSnapshot payload)', () => {
    expect(parseForecast(JSON.parse(JSON.stringify(f)))).toEqual(f);
  });
});

describe('parseOpenMeteoResponse (malformed)', () => {
  const base = structuredClone(bohicon);
  it('rejects missing daily block', () => {
    expect(() => parseOpenMeteoResponse({ latitude: 7 }, 7, 2)).toThrow(WeatherUnavailableError);
  });
  it('rejects the Open-Meteo error shape', () => {
    expect(() => parseOpenMeteoResponse({ error: true, reason: 'Invalid' }, 7, 2)).toThrow(WeatherUnavailableError);
  });
  it('rejects non-numeric values and bad dates', () => {
    const a = structuredClone(base) as { daily: Record<string, unknown[]> };
    a.daily.temperature_2m_max[0] = 'hot';
    expect(() => parseOpenMeteoResponse(a, 7, 2)).toThrow(WeatherUnavailableError);
    const b = structuredClone(base) as { daily: Record<string, unknown[]> };
    b.daily.time[0] = '25/09/2026';
    expect(() => parseOpenMeteoResponse(b, 7, 2)).toThrow(WeatherUnavailableError);
  });
  it('rejects series of inconsistent length', () => {
    const a = structuredClone(base) as { daily: Record<string, unknown[]> };
    a.daily.precipitation_sum.pop();
    try {
      parseOpenMeteoResponse(a, 7, 2);
      expect.unreachable();
    } catch (e) {
      expect((e as WeatherUnavailableError).reason).toBe('invalid_response');
    }
  });
  it('drops days with null values, fails if none remain', () => {
    const a = structuredClone(base) as { daily: Record<string, unknown[]> };
    a.daily.relative_humidity_2m_mean[6] = null;
    expect(parseOpenMeteoResponse(a, 7, 2).days).toHaveLength(6);
    const b = structuredClone(base) as { daily: Record<string, unknown[]> };
    b.daily.et0_fao_evapotranspiration = b.daily.et0_fao_evapotranspiration.map(() => null);
    expect(() => parseOpenMeteoResponse(b, 7, 2)).toThrow(WeatherUnavailableError);
  });
  it('drops physically impossible days (humidity > 100 %, negative rain)', () => {
    const a = structuredClone(base) as { daily: Record<string, unknown[]> };
    a.daily.relative_humidity_2m_mean[0] = 140;
    a.daily.precipitation_sum[1] = -2;
    expect(parseOpenMeteoResponse(a, 7, 2).days.map((d) => d.date)).not.toContain('2026-09-25');
    expect(parseOpenMeteoResponse(a, 7, 2).days).toHaveLength(5);
  });
  it('parseForecast rejects a corrupted stored payload', () => {
    expect(() => parseForecast({ lat: 7, lon: 2, fetchedAt: 'hier', days: [] })).toThrow(WeatherUnavailableError);
    expect(() => parseForecast(null)).toThrow(WeatherUnavailableError);
  });
});

describe('fetchForecast', () => {
  it('returns a parsed forecast from the injected fetch', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(bohicon));
    const f = await fetchForecast(7.178, 2.067, { fetchImpl, now: () => new Date('2026-09-25T13:13:00Z') });
    expect(f.days).toHaveLength(7);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('forecast_days=7');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects invalid coordinates without calling the network', async () => {
    const fetchImpl = vi.fn();
    await expectReason(fetchForecast(95, 2, { fetchImpl }), 'invalid_input');
    await expectReason(fetchForecast(7, Number.NaN, { fetchImpl }), 'invalid_input');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('maps HTTP errors', async () => {
    const err = await expectReason(
      fetchForecast(7, 2, { fetchImpl: async () => jsonResponse({ error: true, reason: 'x' }, 400) }),
      'http',
    );
    expect(err.status).toBe(400);
  });
  it('maps network errors', async () => {
    await expectReason(
      fetchForecast(7, 2, {
        fetchImpl: async () => {
          throw new TypeError('fetch failed');
        },
      }),
      'network',
    );
  });
  it('maps non-JSON and malformed bodies', async () => {
    await expectReason(fetchForecast(7, 2, { fetchImpl: async () => new Response('<html>', { status: 200 }) }), 'invalid_response');
    await expectReason(fetchForecast(7, 2, { fetchImpl: async () => jsonResponse({ daily: { time: [] } }) }), 'invalid_response');
  });
  it('times out after the configured delay (default 8 s)', async () => {
    expect(OPEN_METEO_TIMEOUT_MS).toBe(8000);
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    vi.useFakeTimers();
    try {
      const p = fetchForecast(7, 2, { fetchImpl: hanging });
      const assertion = expectReason(p, 'timeout');
      await vi.advanceTimersByTimeAsync(7999);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
  it('honours the caller abort signal', async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    const ctrl = new AbortController();
    const p = fetchForecast(7, 2, { fetchImpl: hanging, signal: ctrl.signal });
    ctrl.abort();
    await expectReason(p, 'aborted');
    await expectReason(fetchForecast(7, 2, { fetchImpl: hanging, signal: ctrl.signal }), 'aborted');
  });
});
