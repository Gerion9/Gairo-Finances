import { describe, expect, it, vi } from 'vitest';
import { getPublicRates, parsePublicRate } from '../server/references/publicRates.js';
import { fetchPublicRates } from '../src/services/publicRates.js';

const rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const rss = 'http://purl.org/rss/1.0/';
const cb = 'http://staging.bis.org/rss-cb/1.0/';
const dc = 'http://purl.org/dc/elements/1.1/';
function banxico({ rateName = 'CETES28', type = 'interestRate', value = '6.25', date = '2026-10-15', publishedAt = '2026-10-13T11:33:07-06:00', currency = '', title = `MX: ${value} ${rateName} ${date} BM`, prefix = 'cb' } = {}) {
  return `<?xml version="1.0" encoding="ISO-8859-1"?><rdf:RDF xmlns:rdf="${rdf}" xmlns="${rss}" xmlns:${prefix}="${cb}" xmlns:dc="${dc}"><item rdf:about="http://www.banxico.org.mx/portal-mercado-valores/index.html/${date.replaceAll('-', '')}"><title><![CDATA[${title}]]></title><dc:date>${publishedAt}</dc:date><${prefix}:statistics><${prefix}:${type}><${prefix}:value frequency="daily business" decimals="2">${value}</${prefix}:value><${prefix}:rateName>${rateName}</${prefix}:rateName>${currency}</${prefix}:${type}></${prefix}:statistics></item></rdf:RDF>`;
}
const fixtures = {
  cetes28: banxico(),
  usdMxnFix: banxico({ rateName: 'FIX', type: 'exchangeRate', value: '18.4930', date: '2026-10-16', publishedAt: '2026-10-16T12:00:19-06:00', title: 'MX: 18.4930 MXN = 1 USD 2026-10-16 BM FIX', currency: '<cb:baseCurrency>USD</cb:baseCurrency><cb:targetCurrency>MXN</cb:targetCurrency>' }),
  udi: banxico({ rateName: 'UDIS', type: 'otherStatistics', value: '8.857670', date: '2026-10-18', publishedAt: '2026-10-18T00:00:01-06:00' }),
  inflationAnnual: '\uFEFF<?xml version="1.0" encoding="UTF-8"?><DATASET><METADATA><Nemonic>INPCA_M_O</Nemonic><Unit xml:lang="en"></Unit><Unit xml:lang="es">Variación Porcentual</Unit><Freq xml:lang="en">Monthly</Freq><Freq xml:lang="es">Mensual</Freq><LastUpdate>08/10/2026</LastUpdate></METADATA><SERIE><Obs TimePeriod="2026/09" CurrentValue="3.45000000000000020000" /></SERIE></DATASET>',
};
const now = () => new Date('2026-10-18T18:00:00Z');
const idForUrl = url => url.includes('canal=cetes') ? 'cetes28' : url.includes('canal=fix') ? 'usdMxnFix' : url.includes('canal=udis') ? 'udi' : 'inflationAnnual';
const responseFor = (url, overrides = {}) => {
  const id = idForUrl(url);
  return new Response(id === 'inflationAnnual' ? overrides[id] || fixtures[id] : Uint8Array.from(Buffer.from(overrides[id] || fixtures[id], 'latin1')), { headers: { 'Content-Type': 'application/xml' } });
};
const fetchFixture = () => vi.fn(async url => responseFor(url));

describe('public reference schema parsing', () => {
  it('reads CETES by namespace URI, preserving placement and offset publication dates', () => {
    expect(parsePublicRate('cetes28', banxico({ prefix: 'stats' }))).toEqual({ value: 6.25, effectiveDate: '2026-10-15', period: null, publishedAt: '2026-10-13T11:33:07-06:00', publishedDate: null });
  });
  it('keeps FIX and UDI in their original units', () => {
    expect(parsePublicRate('usdMxnFix', fixtures.usdMxnFix).value).toBe(18.493);
    expect(parsePublicRate('udi', fixtures.udi).value).toBe(8.85767);
    expect(() => parsePublicRate('usdMxnFix', fixtures.usdMxnFix.replace('<cb:baseCurrency>USD', '<cb:baseCurrency>EUR'))).toThrow();
  });
  it('retains the INPC month and publication date without inventing a day/time', () => {
    expect(parsePublicRate('inflationAnnual', fixtures.inflationAnnual)).toEqual({ value: 3.45, period: '2026-09', effectiveDate: null, publishedDate: '2026-10-08', publishedAt: null });
    expect(() => parsePublicRate('inflationAnnual', fixtures.inflationAnnual.replace('Variación Porcentual', 'Índice'))).toThrow();
    expect(() => parsePublicRate('inflationAnnual', fixtures.inflationAnnual.replace('2026/09', '2026/13'))).toThrow();
  });
  it('selects the Spanish frequency and rejects ambiguous or missing language metadata', () => {
    expect(parsePublicRate('inflationAnnual', fixtures.inflationAnnual).value).toBe(3.45);
    expect(() => parsePublicRate('inflationAnnual', fixtures.inflationAnnual.replace('<Freq xml:lang="es">Mensual</Freq>', ''))).toThrow();
    expect(() => parsePublicRate('inflationAnnual', fixtures.inflationAnnual.replace('<Freq xml:lang="en">Monthly</Freq>', '<Freq xml:lang="es">Mensual</Freq>'))).toThrow();
    expect(() => parsePublicRate('inflationAnnual', fixtures.inflationAnnual.replace('<Freq xml:lang="es">Mensual</Freq>', '<Freq xml:lang="es">Anual</Freq>'))).toThrow();
  });
  it.each(['6.25junk', 'NaN', 'Infinity', '6,25', '1e999'])('rejects incomplete or non-finite numbers: %s', value => {
    expect(() => parsePublicRate('cetes28', banxico({ value }))).toThrow();
  });
  it('rejects missing, duplicate, mismatched and malformed data', () => {
    for (const xml of [fixtures.cetes28.replace('<cb:rateName>CETES28</cb:rateName>', ''), fixtures.cetes28.replace('</cb:interestRate>', '<cb:value>7</cb:value></cb:interestRate>'), fixtures.cetes28.replace('/20261015', '/20261014'), fixtures.cetes28.replace('</item>', '</wrong>'), fixtures.cetes28.replace(cb, 'https://untrusted.example/schema')]) {
      expect(() => parsePublicRate('cetes28', xml)).toThrow();
    }
    expect(() => parsePublicRate('cetes28', banxico({ date: '2026-02-30' }))).toThrow();
    expect(() => parsePublicRate('cetes28', banxico({ publishedAt: '2026-10-13T25:33:07-06:00' }))).toThrow();
    expect(() => parsePublicRate('cetes28', banxico({ publishedAt: '2026-10-13T11:33:07' }))).toThrow();
  });
  it('rejects DTD, external entities and unknown entities', () => {
    expect(() => parsePublicRate('cetes28', '<!DOCTYPE doc [<!ENTITY x SYSTEM "file:///secret">]>' + fixtures.cetes28)).toThrow();
    expect(() => parsePublicRate('cetes28', fixtures.cetes28.replace('6.25</cb:value>', '&unknown;</cb:value>'))).toThrow();
  });
});

describe('public reference fetch and cache', () => {
  it('fetches only fixed public GET endpoints and returns four independent series', async () => {
    const fetchImpl = fetchFixture();
    const result = await getPublicRates({ fetchImpl, now, cache: new Map() });
    expect(result.schemaVersion).toBe(1);
    expect(result.series.map(item => [item.id, item.status, item.unit])).toEqual([['cetes28', 'available', 'annual_percent'], ['usdMxnFix', 'available', 'MXN_per_USD'], ['udi', 'available', 'MXN_per_UDI'], ['inflationAnnual', 'available', 'year_over_year_percent']]);
    expect(result.series[0]).toMatchObject({ termDays: 28, fromCache: false, fetchedAt: now().toISOString() });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    for (const [url, options] of fetchImpl.mock.calls) {
      expect(['www.banxico.org.mx', 'www.inegi.org.mx']).toContain(new URL(url).hostname);
      expect(options).toMatchObject({ method: 'GET', redirect: 'error', credentials: 'omit' });
      expect(options.body).toBeUndefined();
    }
  });
  it('coalesces pending work and uses different provider TTLs', async () => {
    const cache = new Map();
    const fetchImpl = fetchFixture();
    const args = { fetchImpl, now, cache };
    const [first, concurrent] = await Promise.all([getPublicRates(args), getPublicRates(args)]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(first.series.every(item => !item.fromCache)).toBe(true);
    expect(concurrent.series.every(item => item.fromCache)).toBe(true);
    await getPublicRates({ ...args, now: () => new Date(now().getTime() + 7 * 3_600_000) });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    await getPublicRates({ ...args, now: () => new Date(now().getTime() + 25 * 3_600_000) });
    expect(fetchImpl).toHaveBeenCalledTimes(11);
  });
  it('rate-limits forced refresh to 30 seconds then bypasses the TTL', async () => {
    const cache = new Map();
    const fetchImpl = fetchFixture();
    await getPublicRates({ fetchImpl, now, cache });
    await getPublicRates({ fetchImpl, now, cache, forceRefresh: true });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    await getPublicRates({ fetchImpl, now: () => new Date(now().getTime() + 30_000), cache, forceRefresh: true });
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });
  it('returns partial failures without inventing numbers or exposing provider errors', async () => {
    const fetchImpl = vi.fn(async url => { if (idForUrl(url) === 'usdMxnFix') throw new Error('secret-in-upstream-error'); return responseFor(url); });
    const result = await getPublicRates({ fetchImpl, now, cache: new Map() });
    expect(result.series[1]).toMatchObject({ status: 'unavailable', value: null, error: 'upstream_unavailable', fetchedAt: null });
    expect(result.series.filter(item => item.status === 'available')).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain('secret-in-upstream-error');
  });
  it('preserves a last good observation and dates on a failed refresh', async () => {
    const cache = new Map();
    await getPublicRates({ fetchImpl: fetchFixture(), now, cache });
    const later = () => new Date(now().getTime() + 31_000);
    const result = await getPublicRates({ fetchImpl: async () => { throw new Error('network'); }, now: later, cache, forceRefresh: true });
    expect(result.series[0]).toMatchObject({ value: 6.25, status: 'stale', fromCache: true, fetchedAt: now().toISOString(), lastAttemptAt: later().toISOString(), effectiveDate: '2026-10-15' });
  });
  it('classifies future placements using Mexico City date and ages cached data', async () => {
    const fetchImpl = fetchFixture();
    const future = await getPublicRates({ fetchImpl, now: () => new Date('2026-10-15T01:00:00Z'), cache: new Map() });
    expect(future.series[0].status).toBe('upcoming');
    const old = await getPublicRates({ fetchImpl, now: () => new Date('2026-12-20T18:00:00Z'), cache: new Map() });
    expect(old.series.every(item => item.status === 'stale')).toBe(true);
  });
  it('rejects oversized declared and streamed bodies', async () => {
    for (const fetchImpl of [async () => new Response('small', { headers: { 'content-length': '200001' } }), async () => new Response('x'.repeat(200001))]) {
      const result = await getPublicRates({ fetchImpl, now, cache: new Map() });
      expect(result.series.every(item => item.status === 'invalid' && item.error === 'response_too_large' && item.value === null)).toBe(true);
    }
  });
  it('aborts requests at the configured bounded deadline', async () => {
    const fetchImpl = vi.fn((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
    const result = await getPublicRates({ fetchImpl, now, cache: new Map(), timeoutMs: 2 });
    expect(result.series.every(item => item.status === 'unavailable' && item.error === 'timeout')).toBe(true);
  });
});

describe('public reference browser client', () => {
  it('requests refresh explicitly with no financial or account payload', async () => {
    const payload = await getPublicRates({ fetchImpl: fetchFixture(), now, cache: new Map() });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }));
    expect(await fetchPublicRates({ fetchImpl, forceRefresh: true })).toEqual(payload);
    expect(fetchImpl.mock.calls[0]).toEqual(['/api/reference-rates', expect.objectContaining({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Sifran-Refresh': '1' } })]);
    expect(fetchImpl.mock.calls[0][1].body).toBeUndefined();
  });
  it('rejects unavailable endpoints and malformed response contracts', async () => {
    await expect(fetchPublicRates({ fetchImpl: async () => new Response('{}', { status: 503 }) })).rejects.toThrow();
    await expect(fetchPublicRates({ fetchImpl: async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }) })).rejects.toThrow();
    const payload = await getPublicRates({ fetchImpl: fetchFixture(), now, cache: new Map() });
    payload.series[0].effectiveDate = '2026-02-30';
    await expect(fetchPublicRates({ fetchImpl: async () => new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }) })).rejects.toThrow();
  });
});
