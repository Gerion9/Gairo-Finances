import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { handleSiteRequest, SITE_ORIGIN } from '../server/sites/router.js';
import { getWorkspace, putWorkspace } from '../server/workspace/repository.js';
import { emptyFinancialData } from '../src/services/accountData.js';
import { createTestD1 } from './d1-test-adapter.js';

// These fixtures represent identity headers supplied by the managed Sites
// dispatcher. They do not simulate or claim to verify SIWC token signatures.
const GAIRO = { userId: 'siwc-gairo-001', email: 'gairo@example.test' };
const RICARDO = { userId: 'siwc-ricardo-001', email: 'ricardo@example.test' };
const UNKNOWN = { userId: 'siwc-uninvited-001', email: 'uninvited@example.test' };

function requestFor(path, { identity = GAIRO, accountId, method = 'GET', body, headers: extraHeaders = {}, origin = SITE_ORIGIN } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (identity) {
    headers.set('oai-authenticated-user-id', identity.userId);
    headers.set('oai-authenticated-user-email', identity.email);
  }
  if (accountId) headers.set('X-Sifran-Account', accountId);
  if (!['GET', 'HEAD'].includes(method)) headers.set('Origin', origin);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Request(SITE_ORIGIN + path, {
    method, headers,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}

function financialData(accountId, id = 'record-1', amount = 25) {
  return {
    ...emptyFinancialData(accountId),
    transacciones: [{ id, fecha: '2026-09-08', descripcion: 'Movimiento de prueba', tipo: 'GASTO', monto: amount, moneda: 'MXN', categoria: 'Otros' }],
  };
}
const mutation = (baseRevision, data, mutationId = crypto.randomUUID()) => ({ schemaVersion: 1, baseRevision, mutationId, financialData: data });

describe('Sites account authorization and durable workspace isolation', () => {
  let db;
  let env;
  let provider;

  beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    db = await createTestD1();
    env = { DB: db, SIFRAN_GAIRO_EMAIL: GAIRO.email, SIFRAN_RICARDO_EMAIL: RICARDO.email };
    provider = vi.fn(async () => new Response(JSON.stringify({ configured: false, authenticated: false }), { headers: { 'Content-Type': 'application/json' } }));
  });
  afterEach(() => {
    db?.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function call(path, options = {}) {
    const request = requestFor(path, options);
    const response = await handleSiteRequest(request, env, { ai: provider });
    return { request, response, value: await response.json() };
  }
  async function claim(identity = GAIRO) {
    const result = await call('/api/session/claim', { identity, method: 'POST', body: {} });
    expect(result.response.status).toBe(200);
    expect(result.value.access).toBe('allowed');
    return result.value.account;
  }

  it('offers only exact invited email addresses, with whitespace and case normalized', async () => {
    const invited = await call('/api/session', { identity: { ...GAIRO, email: '  GAIRO@EXAMPLE.TEST  ' } });
    expect(invited.value).toMatchObject({ authenticated: true, access: 'invited', account: null, invitedName: 'Gairo' });
    for (const email of ['gairo+other@example.test', 'gairo@example.test.attacker.test', 'othergairo@example.test']) {
      const result = await call('/api/session', { identity: { userId: 'not-invited-' + email, email } });
      expect(result.value).toMatchObject({ authenticated: true, access: 'pending', account: null });
    }
    expect((await db.prepare('SELECT account_id FROM accounts').all()).results).toEqual([]);
  });

  it('binds a slot to the stable subject and does not reassign it when that subject changes email', async () => {
    expect(await claim()).toMatchObject({ id: 'gairo', displayName: 'Gairo', userId: GAIRO.userId });
    const sameSubject = { ...GAIRO, email: RICARDO.email };
    expect(await claim(sameSubject)).toMatchObject({ id: 'gairo', userId: GAIRO.userId });
    const session = await call('/api/session', { identity: sameSubject });
    expect(session.value.account.id).toBe('gairo');
    expect((await db.prepare('SELECT account_id, user_id FROM accounts').all()).results).toEqual([{ account_id: 'gairo', user_id: GAIRO.userId }]);
  });

  it('does not let a different subject take an occupied slot even with the same invited email', async () => {
    await claim();
    const secondSubject = { ...GAIRO, userId: 'different-siwc-subject' };
    const session = await call('/api/session', { identity: secondSubject });
    expect(session.value).toMatchObject({ access: 'pending', account: null });
    const result = await call('/api/session/claim', { identity: secondSubject, method: 'POST', body: {} });
    expect(result.response.status).toBe(403);
    expect(result.value.error.code).toBe('ACCOUNT_NOT_ALLOWED');
    expect((await db.prepare('SELECT user_id FROM accounts WHERE account_id = ?').bind('gairo').first()).user_id).toBe(GAIRO.userId);
  });

  describe('explicit server-authorized email correction', () => {
    const replacement = { userId: 'siwc-gairo-replacement', email: 'gairo-new@example.test' };
    const authorizeTransfer = () => Object.assign(env, {
      SIFRAN_GAIRO_EMAIL: replacement.email,
      SIFRAN_GAIRO_REBIND_FROM_USER_ID: GAIRO.userId,
      SIFRAN_GAIRO_REBIND_TO_EMAIL: replacement.email,
      SIFRAN_GAIRO_REBIND_UNTIL: new Date(Date.now() + 60_000).toISOString(),
    });

    it('requires activation, preserves the account records and quota, and rejects the previous subject afterward', async () => {
      await claim();
      const originalAccount = await db.prepare('SELECT * FROM accounts WHERE account_id = ?').bind('gairo').first();
      const saved = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: mutation(0, financialData('gairo', 'preserved-record', 87)) });
      expect(saved.response.status).toBe(200);
      await db.prepare('INSERT INTO ai_limits (account_id, window_start, request_count, lease_id, lease_until) VALUES (?, ?, ?, ?, ?)').bind('gairo', 1000, 2, null, 0).run();
      const originalWorkspace = await db.prepare('SELECT * FROM workspaces WHERE account_id = ?').bind('gairo').first();
      const originalQuota = await db.prepare('SELECT * FROM ai_limits WHERE account_id = ?').bind('gairo').first();
      authorizeTransfer();

      expect((await call('/api/session', { identity: replacement })).value).toMatchObject({ access: 'invited', invitedName: 'Gairo', account: null });
      expect(await db.prepare('SELECT * FROM accounts WHERE account_id = ?').bind('gairo').first()).toEqual(originalAccount);
      expect(await claim(replacement)).toMatchObject({ id: 'gairo', userId: replacement.userId });
      expect(await db.prepare('SELECT * FROM accounts WHERE account_id = ?').bind('gairo').first()).toEqual({ ...originalAccount, user_id: replacement.userId, email_at_binding: replacement.email });
      expect(await db.prepare('SELECT * FROM workspaces WHERE account_id = ?').bind('gairo').first()).toEqual(originalWorkspace);
      expect(await db.prepare('SELECT * FROM ai_limits WHERE account_id = ?').bind('gairo').first()).toEqual(originalQuota);
      expect((await call('/api/workspace', { identity: replacement, accountId: 'gairo' })).response.status).toBe(200);
      expect((await call('/api/workspace', { identity: GAIRO, accountId: 'gairo' })).response.status).toBe(403);
      expect((await call('/api/session/claim', { identity: GAIRO, method: 'POST', body: {} })).response.status).toBe(403);
      expect(await claim(replacement)).toMatchObject({ id: 'gairo', userId: replacement.userId });
    });

    it.each([
      ['SIFRAN_GAIRO_REBIND_FROM_USER_ID', ''],
      ['SIFRAN_GAIRO_REBIND_FROM_USER_ID', RICARDO.userId],
      ['SIFRAN_GAIRO_REBIND_TO_EMAIL', 'another@example.test'],
      ['SIFRAN_GAIRO_REBIND_UNTIL', ''],
      ['SIFRAN_GAIRO_REBIND_UNTIL', 'invalid-date'],
      ['SIFRAN_GAIRO_REBIND_UNTIL', '2000-01-01T00:00:00.000Z'],
    ])('keeps the original binding when %s is %s', async (key, value) => {
      await claim();
      authorizeTransfer();
      env[key] = value;
      expect((await call('/api/session', { identity: replacement })).value.access).toBe('pending');
      expect((await call('/api/session/claim', { identity: replacement, method: 'POST', body: {} })).response.status).toBe(403);
      expect((await db.prepare('SELECT user_id FROM accounts WHERE account_id = ?').bind('gairo').first()).user_id).toBe(GAIRO.userId);
    });

    it('does not transfer from a different email or from an untrusted request origin', async () => {
      await claim();
      authorizeTransfer();
      const wrongEmail = { ...replacement, email: 'gairo-new+other@example.test' };
      expect((await call('/api/session/claim', { identity: wrongEmail, method: 'POST', body: {} })).response.status).toBe(403);
      expect((await call('/api/session/claim', { identity: replacement, method: 'POST', body: {}, origin: 'https://untrusted.example.test' })).response.status).toBe(403);
      expect((await db.prepare('SELECT user_id FROM accounts WHERE account_id = ?').bind('gairo').first()).user_id).toBe(GAIRO.userId);
    });

    it('consumes the exact previous-subject grant only once when two verified subjects race', async () => {
      await claim();
      authorizeTransfer();
      const contenders = [replacement, { ...replacement, userId: 'another-new-subject' }];
      const results = await Promise.all(contenders.map(identity => call('/api/session/claim', { identity, method: 'POST', body: {} })));
      expect(results.map(result => result.response.status).sort()).toEqual([200, 403]);
      const winner = contenders[results.findIndex(result => result.response.status === 200)];
      expect((await db.prepare('SELECT user_id FROM accounts WHERE account_id = ?').bind('gairo').first()).user_id).toBe(winner.userId);
      const replay = { ...replacement, userId: 'later-new-subject' };
      expect((await call('/api/session/claim', { identity: replay, method: 'POST', body: {} })).response.status).toBe(403);
    });

    it('does not move an identity that is already bound to the other account', async () => {
      await claim();
      await claim(RICARDO);
      authorizeTransfer();
      const existingSubject = { ...replacement, userId: RICARDO.userId };
      expect(await claim(existingSubject)).toMatchObject({ id: 'ricardo', userId: RICARDO.userId });
      expect((await db.prepare('SELECT user_id FROM accounts WHERE account_id = ?').bind('gairo').first()).user_id).toBe(GAIRO.userId);
    });
  });

  it('denies ambiguous invitations when both configured slots have the same email', async () => {
    env.SIFRAN_GAIRO_EMAIL = ' SHARED@example.test ';
    env.SIFRAN_RICARDO_EMAIL = 'shared@EXAMPLE.TEST';
    const identity = { userId: 'shared-subject', email: 'shared@example.test' };
    expect((await call('/api/session', { identity })).value.access).toBe('pending');
    const result = await call('/api/session/claim', { identity, method: 'POST', body: {} });
    expect(result.response.status).toBe(403);
    expect((await db.prepare('SELECT account_id FROM accounts').all()).results).toEqual([]);
  });

  it('rejects caller-selected account fields during a claim', async () => {
    const result = await call('/api/session/claim', { method: 'POST', body: { accountId: 'ricardo' } });
    expect(result.response.status).toBe(400);
    expect(result.value.error.code).toBe('INVALID_REQUEST');
    expect((await db.prepare('SELECT account_id FROM accounts').all()).results).toEqual([]);
  });

  it('reports unauthenticated session state without creating either account', async () => {
    const result = await call('/api/session', { identity: null });
    expect(result.value).toEqual({ authenticated: false, access: 'pending', account: null });
    expect((await db.prepare('SELECT account_id FROM accounts').all()).results).toEqual([]);
  });

  it.each([
    ['missing identity', null, 'gairo', 401, 'AUTH_REQUIRED'],
    ['unbound subject', UNKNOWN, 'gairo', 403, 'ACCOUNT_NOT_ALLOWED'],
    ['different account header', GAIRO, 'ricardo', 409, 'ACCOUNT_CHANGED'],
    ['missing account header', GAIRO, undefined, 409, 'ACCOUNT_CHANGED'],
  ])('rejects %s before reading the body or calling Claude', async (_name, identity, accountId, status, code) => {
    await claim();
    const result = await call('/api/ai', { identity, accountId, method: 'POST', body: '{not-json-and-must-not-be-read' });
    expect(result.response.status).toBe(status);
    expect(result.value.error.code).toBe(code);
    expect(result.request.bodyUsed).toBe(false);
    expect(provider).not.toHaveBeenCalled();
  });

  it('denies off-site mutations and untrusted entrypoint origins before provider access', async () => {
    await claim();
    const crossSite = await call('/api/ai', { accountId: 'gairo', method: 'POST', body: '{invalid', origin: 'https://other.example' });
    expect(crossSite.response.status).toBe(403);
    expect(crossSite.value.error.code).toBe('ORIGIN_DENIED');
    expect(crossSite.request.bodyUsed).toBe(false);
    const original = requestFor('/api/ai', { accountId: 'gairo' });
    const response = await handleSiteRequest(new Request('https://other.example/api/ai', { headers: original.headers }), env, { ai: provider });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('ENTRYPOINT_DENIED');
    expect(provider).not.toHaveBeenCalled();
  });

  it('starts both accounts empty and keeps one account writes out of the other workspace', async () => {
    await claim();
    await claim(RICARDO);
    for (const [identity, accountId] of [[GAIRO, 'gairo'], [RICARDO, 'ricardo']]) {
      const result = await call('/api/workspace', { identity, accountId });
      expect(result.value).toMatchObject({ accountId, revision: 0, updatedAt: null, financialData: emptyFinancialData(accountId) });
      expect(result.value).not.toHaveProperty('receipts');
      expect(result.response.headers.get('etag')).toBe('"ws-0"');
    }
    const write = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: mutation(0, financialData('gairo', 'gairo-private', 42)) });
    expect(write.response.status).toBe(200);
    const ricardo = await call('/api/workspace', { identity: RICARDO, accountId: 'ricardo' });
    expect(ricardo.value.revision).toBe(0);
    expect(ricardo.value.financialData).toEqual(emptyFinancialData('ricardo'));
    const forbidden = await call('/api/workspace', { identity: RICARDO, accountId: 'gairo' });
    expect(forbidden.response.status).toBe(409);
  });

  it.each([0, 1])('allows only one simultaneous writer at revision %i', async baseRevision => {
    await claim();
    if (baseRevision === 1) await putWorkspace(db, { id: 'gairo', userId: GAIRO.userId }, mutation(0, financialData('gairo', 'initial')));
    const a = mutation(baseRevision, financialData('gairo', 'writer-a', 101));
    const b = mutation(baseRevision, financialData('gairo', 'writer-b', 202));
    const results = await Promise.all([a, b].map(body => call('/api/workspace', { accountId: 'gairo', method: 'PUT', body })));
    expect(results.map(item => item.response.status).sort()).toEqual([200, 409]);
    const winner = results.findIndex(item => item.response.status === 200);
    expect(results[1 - winner].value.error.code).toBe('REVISION_CONFLICT');
    const final = await call('/api/workspace', { accountId: 'gairo' });
    expect(final.value.revision).toBe(baseRevision + 1);
    expect(final.value.financialData.transacciones).toEqual([a, b][winner].financialData.transacciones);
  });

  it('replays a write whose response was lost without recording a second revision', async () => {
    await claim();
    const body = mutation(0, financialData('gairo'));
    const first = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body });
    expect(first.value).toMatchObject({ acceptedRevision: 1, currentRevision: 1, replayed: false });
    const retry = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body });
    expect(retry.value).toMatchObject({ mutationId: body.mutationId, acceptedRevision: 1, currentRevision: 1, replayed: true });
    expect((await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId })).receipts).toHaveLength(1);
  });

  it('rejects reuse of an operation key for changed data without replacing the first write', async () => {
    await claim();
    const body = mutation(0, financialData('gairo', 'first', 10));
    await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body });
    const reused = { ...body, financialData: financialData('gairo', 'changed', 999) };
    const result = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: reused });
    expect(result.response.status).toBe(409);
    expect(result.value.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const stored = await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId });
    expect(stored.revision).toBe(1);
    expect(stored.financialData.transacciones[0].id).toBe('first');
  });

  it('replays an old receipt after later writes without rolling the workspace backwards', async () => {
    await claim();
    const first = mutation(0, financialData('gairo', 'old'));
    await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: first });
    await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: mutation(1, financialData('gairo', 'new')) });
    const replay = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: first });
    expect(replay.value).toMatchObject({ acceptedRevision: 1, currentRevision: 2, replayed: true });
    expect((await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId })).financialData.transacciones[0].id).toBe('new');
  });

  it('restricts legacy migration to Gairo revision zero while permitting identical migration retries', async () => {
    await claim();
    await claim(RICARDO);
    const body = mutation(0, financialData('gairo', 'legacy'));
    const denied = await call('/api/workspace/migrate', { identity: RICARDO, accountId: 'ricardo', method: 'POST', body });
    expect(denied.value.error.code).toBe('MIGRATION_NOT_ALLOWED');
    expect((await getWorkspace(db, { id: 'ricardo', userId: RICARDO.userId })).revision).toBe(0);
    const accepted = await call('/api/workspace/migrate', { accountId: 'gairo', method: 'POST', body });
    expect(accepted.value).toMatchObject({ acceptedRevision: 1, replayed: false });
    const retry = await call('/api/workspace/migrate', { accountId: 'gairo', method: 'POST', body });
    expect(retry.value).toMatchObject({ acceptedRevision: 1, replayed: true });
    const later = await call('/api/workspace/migrate', { accountId: 'gairo', method: 'POST', body: mutation(1, financialData('gairo', 'later')) });
    expect(later.value.error.code).toBe('MIGRATION_NOT_ALLOWED');
    const newOperation = await call('/api/workspace/migrate', { accountId: 'gairo', method: 'POST', body: mutation(0, financialData('gairo', 'other')) });
    expect(newOperation.value.error.code).toBe('REVISION_CONFLICT');
    expect((await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId })).financialData.transacciones[0].id).toBe('legacy');
  });

  it('derives backup ownership from the authorized account without mutating the input object', async () => {
    await claim(RICARDO);
    const body = mutation(0, { ...financialData('ricardo'), profileId: 'gairo', profileName: 'Gairo' });
    const before = structuredClone(body);
    await putWorkspace(db, { id: 'ricardo', userId: RICARDO.userId }, body);
    expect(body).toEqual(before);
    expect((await getWorkspace(db, { id: 'ricardo', userId: RICARDO.userId })).financialData).toMatchObject({ profileId: 'ricardo', profileName: 'Ricardo' });
    expect(await db.prepare('SELECT revision FROM workspaces WHERE account_id = ?').bind('gairo').first()).toBeNull();
  });

  it('keeps the prior workspace unchanged after validation or size rejection', async () => {
    await claim();
    const invalid = mutation(0, financialData('gairo'));
    invalid.financialData.transacciones[0].monto = -1;
    const bad = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: invalid });
    expect(bad.response.status).toBe(422);
    const oversized = mutation(0, financialData('gairo'));
    oversized.financialData.transacciones = Array.from({ length: 400 }, (_, index) => ({
      ...financialData('gairo').transacciones[0], id: 'oversized-' + index, notas: 'x'.repeat(3700),
    }));
    const large = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: oversized });
    expect(large.response.status).toBe(413);
    expect(large.value.error.code).toBe('WORKSPACE_TOO_LARGE');
    expect((await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId })).revision).toBe(0);
  });

  it.each([
    ['activos', 'nombre', { nested: 'Objeto inv?lido' }],
    ['activos', 'nombre', ['Lista inv?lida']],
    ['deudas', 'institucion', { nested: 'Objeto inv?lido' }],
    ['deudas', 'institucion', ['Lista inv?lida']],
    ['transacciones', 'categoria', { nested: 'Objeto inv?lido' }],
    ['transacciones', 'categoria', ['Lista inv?lida']],
  ])('rejects %s.%s as %j without changing saved data or revision receipts', async (collection, field, invalidValue) => {
    await claim();
    const initial = financialData('gairo', 'protected-baseline', 50);
    initial.activos = [{ id: 'asset-1', nombre: 'Ahorro de prueba', tipo: 'EFECTIVO', monto: 100, moneda: 'MXN' }];
    initial.deudas = [{
      id: 'debt-1', nombre: 'Cr?dito de prueba', institucion: 'Banco de prueba',
      tipo: 'HIGH_INTEREST', moneda: 'MXN', saldo: 100, tasaAnual: 10,
      pagoMinimo: 10, anualidad: 0, diaCorte: 15, diaPagoLimite: 5, tasaRegularPostPromo: null,
    }];
    const firstWrite = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: mutation(0, initial) });
    expect(firstWrite.response.status).toBe(200);
    const before = await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId });
    expect(before.revision).toBe(1);
    const invalid = structuredClone(before.financialData);
    invalid[collection][0][field] = invalidValue;

    const rejected = await call('/api/workspace', { accountId: 'gairo', method: 'PUT', body: mutation(1, invalid) });
    expect(rejected.response.status).toBe(422);
    expect(rejected.value.error.code).toBe('INVALID_WORKSPACE');
    const after = await getWorkspace(db, { id: 'gairo', userId: GAIRO.userId });
    expect(after.revision).toBe(1);
    expect(after.financialData).toEqual(before.financialData);
    expect(after.receipts).toEqual(before.receipts);
  });
});
