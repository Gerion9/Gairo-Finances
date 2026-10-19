import { describe, expect, it, vi } from 'vitest';
import { handleSiteRequest, SITE_ORIGIN } from '../server/sites/router.js';

describe('Official reference route boundary', () => {
  const request = (path = '/api/reference-rates', init) => new Request(`${SITE_ORIGIN}${path}`, init);

  it('serves public references without reading a financial account or forwarding request data', async () => {
    const referenceRates = vi.fn().mockResolvedValue({ schemaVersion: 1, series: [] });
    const response = await handleSiteRequest(request('/api/reference-rates?url=https://invalid.example&amount=500', { headers: { Cookie: 'private=secret', 'X-Sifran-Account': 'private', 'X-Sifran-Refresh': '1' } }), {}, { referenceRates });
    expect(response.status).toBe(200);
    expect(referenceRates).toHaveBeenCalledExactlyOnceWith({ forceRefresh: true });
    expect(await response.json()).toEqual({ schemaVersion: 1, series: [] });
  });

  it('requires an exact refresh header and rejects writes without consulting a source', async () => {
    const referenceRates = vi.fn().mockResolvedValue({ schemaVersion: 1, series: [] });
    await handleSiteRequest(request('/api/reference-rates', { headers: { 'X-Sifran-Refresh': 'true' } }), {}, { referenceRates });
    expect(referenceRates).toHaveBeenCalledExactlyOnceWith({ forceRefresh: false });
    referenceRates.mockClear();
    const response = await handleSiteRequest(request('/api/reference-rates', { method: 'POST', body: '{}' }), {}, { referenceRates });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(referenceRates).not.toHaveBeenCalled();
  });

  it('keeps origin and private workspace authorization boundaries', async () => {
    const referenceRates = vi.fn();
    const denied = await handleSiteRequest(new Request('https://untrusted.example/api/reference-rates'), {}, { referenceRates });
    expect(denied.status).toBe(403);
    expect(referenceRates).not.toHaveBeenCalled();
    const workspace = await handleSiteRequest(request('/api/workspace'), {}, { referenceRates });
    expect(workspace.status).toBe(401);
    expect((await workspace.json()).error.code).toBe('AUTH_REQUIRED');
  });

  it('reports reference failure without pretending financial storage failed', async () => {
    const response = await handleSiteRequest(request(), {}, { referenceRates: async () => { throw new Error('private upstream details'); } });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe('REFERENCES_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('upstream');
  });
});
