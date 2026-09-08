import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyFinancialData, hasFinancialRecords } from './accountData.js';
import { createAccountBackup, normalizeBackup, restoreAccountBackup } from './backup.js';
import { calculateFiscalOverview } from './financeEngine.js';

function readonlyStorage(initial = {}) {
  const stored = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn(key => stored.get(key) ?? null),
    setItem: vi.fn(() => { throw new Error('Legacy storage must stay read-only'); }),
    removeItem: vi.fn(() => { throw new Error('Legacy storage must stay read-only'); }),
    clear: vi.fn(() => { throw new Error('Legacy storage must stay read-only'); }),
  };
  return { storage, stored };
}
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const transaction = { id: 'ricardo-transaction', fecha: '2026-09-08', descripcion: 'Registro de prueba', tipo: 'INGRESO', monto: 250, moneda: 'MXN', categoria: 'Otros' };

describe('Read-only legacy recovery and managed account sessions', () => {
  let storage;
  let stored;
  let legacy;
  let auth;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    ({ storage, stored } = readonlyStorage());
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    legacy = await import('./storage.js');
    auth = await import('./auth.js');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function assertNoLegacyWrites() {
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
  }

  it('does not seed financial records, a password or a local authenticated session in an empty browser', async () => {
    expect(legacy.readLegacyBackup(storage)).toBeNull();
    fetchMock.mockResolvedValueOnce(json({ authenticated: false, access: 'pending', account: null }));
    expect(await auth.getSession()).toEqual({ authenticated: false, access: 'pending', account: null });
    expect(legacy).not.toHaveProperty('INITIAL_DATA');
    expect(legacy).not.toHaveProperty('resetToExcelDefaults');
    expect(stored.size).toBe(0);
    assertNoLegacyWrites();
  });

  it('preserves corrupted primary JSON verbatim and fails instead of replacing it with demonstration data', () => {
    const original = '{private-but-broken:"do-not-replace"';
    stored.set(legacy.LEGACY_STORAGE_KEY, original);
    expect(() => legacy.readLegacyBackup(storage)).toThrow();
    expect(stored.get(legacy.LEGACY_STORAGE_KEY)).toBe(original);
    expect(stored.size).toBe(1);
    assertNoLegacyWrites();
  });

  it('recovers explicit records, education and rate preferences into a Gairo-owned backup without touching their originals', () => {
    const original = emptyFinancialData('gairo');
    original.honorarios.otrosIngresos = 321;
    original.config.aportacionExtraMensual = 0;
    stored.set(legacy.LEGACY_STORAGE_KEY, JSON.stringify(original));
    stored.set('gairo_52_weeks', JSON.stringify([1, 13, 13]));
    stored.set('gairo_impulse_cooling', JSON.stringify([{ id: 'impulse-1', name: 'Compra por revisar', amount: 50, createdAt: 1000, expiresAt: 10000 }]));
    stored.set('gairo_fx_manual', '18.25');
    const before = [...stored.entries()];
    const result = legacy.readLegacyBackup(storage);
    expect(result).toMatchObject({ format: 'sifran-account', schemaVersion: 1, accountId: 'gairo' });
    expect(result.financialData).toMatchObject({
      profileId: 'gairo', profileName: 'Gairo', honorarios: { otrosIngresos: 321 },
      config: { aportacionExtraMensual: 0 }, education: { weeks: [1, 13] }, preferences: { manualRate: 18.25 },
    });
    expect(result.financialData.education.impulses[0].id).toBe('impulse-1');
    expect([...stored.entries()]).toEqual(before);
    assertNoLegacyWrites();
  });

  it.each(['gairo_52_weeks', 'gairo_impulse_cooling'])('preserves damaged auxiliary JSON in %s instead of silently losing progress', key => {
    stored.set(legacy.LEGACY_STORAGE_KEY, JSON.stringify(emptyFinancialData('gairo')));
    stored.set(key, '{broken-progress');
    const before = [...stored.entries()];
    expect(() => legacy.readLegacyBackup(storage)).toThrow();
    expect([...stored.entries()]).toEqual(before);
    assertNoLegacyWrites();
  });

  it('does not include or consult retired authentication credentials in a financial migration backup', () => {
    stored.set(legacy.LEGACY_STORAGE_KEY, JSON.stringify(emptyFinancialData('gairo')));
    const retiredKeys = {
      gairo_master_pass_hash: 'do-not-export-private-password-hash',
      gairo_auth_session: 'do-not-export-private-session-token',
      gairo_ai_disconnect_pending: 'do-not-export-retired-ai-marker',
    };
    for (const [key, value] of Object.entries(retiredKeys)) stored.set(key, value);
    const result = legacy.readLegacyBackup(storage);
    const serialized = JSON.stringify(result);
    for (const [key, value] of Object.entries(retiredKeys)) {
      expect(serialized).not.toContain(key);
      expect(serialized).not.toContain(value);
      expect(storage.getItem.mock.calls.map(([readKey]) => readKey)).not.toContain(key);
      expect(stored.get(key)).toBe(value);
    }
    assertNoLegacyWrites();
  });

  it('excludes credentials embedded in legacy JSON while preserving that original verbatim', () => {
    const original = JSON.stringify({
      ...emptyFinancialData('gairo'),
      gairo_master_pass_hash: 'embedded-legacy-hash',
      accessToken: 'embedded-legacy-access-token',
      unrelatedPrivateData: { secret: 'outside-financial-schema' },
    });
    stored.set(legacy.LEGACY_STORAGE_KEY, original);
    const result = legacy.readLegacyBackup(storage);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('embedded-legacy-hash');
    expect(serialized).not.toContain('embedded-legacy-access-token');
    expect(serialized).not.toContain('outside-financial-schema');
    expect(stored.get(legacy.LEGACY_STORAGE_KEY)).toBe(original);
    assertNoLegacyWrites();
  });

  it('does not treat an old session token or password hash as server account authority', async () => {
    stored.set('gairo_auth_session', JSON.stringify({ user: 'gairo', loginTime: Date.now() }));
    stored.set('gairo_master_pass_hash', 'legacy-password-hash');
    fetchMock.mockResolvedValueOnce(json({ authenticated: false, access: 'pending', account: null }));
    const result = await auth.getSession();
    expect(result.authenticated).toBe(false);
    expect(result.account).toBeNull();
    expect(storage.getItem).not.toHaveBeenCalled();
    assertNoLegacyWrites();
  });

  it('claims only the server-invited account without putting credentials or a caller-chosen owner in the request', async () => {
    const serverSession = { authenticated: true, access: 'allowed', account: { id: 'ricardo', displayName: 'Ricardo', userId: 'managed-subject' } };
    fetchMock.mockResolvedValueOnce(json(serverSession));
    await expect(auth.claimAccount()).resolves.toEqual(serverSession);
    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/session/claim');
    expect(options).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(JSON.parse(options.body)).toEqual({});
    const headers = new Headers(options.headers);
    expect(headers.has('oai-authenticated-user-id')).toBe(false);
    expect(headers.has('oai-authenticated-user-email')).toBe(false);
    expect(headers.has('X-Sifran-Account')).toBe(false);
    assertNoLegacyWrites();
  });

  it('rejects workspace responses for another account instead of returning their data', async () => {
    fetchMock.mockResolvedValueOnce(json({ accountId: 'ricardo', financialData: { private: 'other-account' } }));
    await expect(auth.accountRequest('/api/workspace', { accountId: 'gairo' })).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED', status: 409 });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-Sifran-Account')).toBe('gairo');
    assertNoLegacyWrites();
  });

  it('recognizes a login page response as unavailable account service rather than authenticated data', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Sign in</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(auth.getSession()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    assertNoLegacyWrites();
  });

  it('uses managed sign-in and sign-out paths with an internal return target', () => {
    const signin = new URL(auth.SIGN_IN_PATH, 'https://sifran.example');
    const signout = new URL(auth.SIGN_OUT_PATH, 'https://sifran.example');
    expect(signin.pathname).toBe('/signin-with-chatgpt');
    expect(signout.pathname).toBe('/signout-with-chatgpt');
    expect(signin.searchParams.get('return_to')).toBe('/');
    expect(signout.searchParams.get('return_to')).toBe('/');
  });
});

describe('Backups remain owned by their account and preserve explicit zeros', () => {
  it('creates independent empty workspaces for Gairo and Ricardo without inherited financial records', () => {
    const gairo = emptyFinancialData('gairo');
    const ricardo = emptyFinancialData('ricardo');
    for (const data of [gairo, ricardo]) {
      expect(hasFinancialRecords(data)).toBe(false);
      expect(data.deudas).toEqual([]);
      expect(data.transacciones).toEqual([]);
      expect(data.honorarios.importeFacturado).toBe(0);
      expect(data.config.aportacionExtraMensual).toBe(0);
      expect(data.education).toEqual({ weeks: [], impulses: [] });
    }
    gairo.deudas.push({ id: 'gairo-only' });
    gairo.honorarios.otrosIngresos = 1000;
    gairo.education.weeks.push(1);
    expect(ricardo).toMatchObject({ profileId: 'ricardo', profileName: 'Ricardo', deudas: [], honorarios: { otrosIngresos: 0 }, education: { weeks: [] } });
  });

  it('exports and restores Ricardo data with Ricardo ownership without mutating the caller backup', () => {
    const data = { ...emptyFinancialData('ricardo'), profileId: 'gairo', profileName: 'Gairo', transacciones: [{ ...transaction }] };
    const before = structuredClone(data);
    const backup = createAccountBackup(data, 'ricardo', 4);
    expect(data).toEqual(before);
    expect(backup).toMatchObject({ accountId: 'ricardo', revision: 4, financialData: { profileId: 'ricardo', profileName: 'Ricardo' } });
    expect(restoreAccountBackup(backup, 'ricardo')).toMatchObject({ profileId: 'ricardo', profileName: 'Ricardo', transacciones: [{ ...transaction }] });
  });

  it('rejects a Gairo backup or unowned legacy JSON when restoring Ricardo', () => {
    const gairo = emptyFinancialData('gairo');
    expect(() => restoreAccountBackup(createAccountBackup(gairo, 'gairo'), 'ricardo')).toThrow();
    expect(() => restoreAccountBackup(gairo, 'ricardo')).toThrow();
    const ricardo = emptyFinancialData('ricardo');
    expect(() => restoreAccountBackup(createAccountBackup(ricardo, 'ricardo'), 'gairo')).toThrow();
  });

  it('keeps missing lists empty for Ricardo instead of inheriting Gairo assets or debts', () => {
    const result = normalizeBackup({ deudas: [], transacciones: [] }, 'ricardo');
    expect(result).toMatchObject({ profileId: 'ricardo', profileName: 'Ricardo', deudas: [], transacciones: [], gastosNecesarios: [], gastosOpcionales: [], activos: [] });
    expect(result.honorarios).toEqual(emptyFinancialData('ricardo').honorarios);
    expect(hasFinancialRecords(result)).toBe(false);
  });

  it('does not reactivate imported commercial licenses or change the selected owner', () => {
    const imported = { ...emptyFinancialData('gairo'), licencia: { esPro: true, tipoPlan: 'OLD_ACTIVATION', claveActivacion: 'retired-key' } };
    const before = structuredClone(imported);
    const normalized = normalizeBackup(imported, 'ricardo');
    expect(imported).toEqual(before);
    expect(normalized.licencia).toEqual({ esPro: false, tipoPlan: 'PERSONAL' });
    expect(normalized).toMatchObject({ profileId: 'ricardo', profileName: 'Ricardo' });
  });

  it('keeps explicit zero tax rates through backup normalization and the fiscal calculation', () => {
    const data = emptyFinancialData('ricardo');
    data.honorarios = { importeFacturado: 1000, tasaIva: 0, retencionIsrTasa: 0, retencionIvaFraccion: 0, tasaIsrDeclaracion: 0, otrosIngresos: 25 };
    const restored = restoreAccountBackup(createAccountBackup(data, 'ricardo'), 'ricardo');
    expect(calculateFiscalOverview(restored.honorarios)).toMatchObject({
      importeFacturado: 1000, ivaCobrado: 0, retencionIsr: 0, retencionIva: 0,
      netoEnCuenta: 1000, isrACargo: 0, ivaACargo: 0, totalImpuestosSat: 0, ingresoDisponibleReal: 1025,
    });
    expect(restored.config.aportacionExtraMensual).toBe(0);
  });
});
