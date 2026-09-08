import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1 } from './d1-test-adapter.js';
import { handleSiteRequest, SITE_ORIGIN } from '../server/sites/router.js';
import { bindAccount } from '../server/workspace/identity.js';
import { getWorkspace, putWorkspace } from '../server/workspace/repository.js';
import { handleAccountAI } from '../server/ai/worker-ai.js';
import { emptyFinancialData } from '../src/services/accountData.js';
import { buildAIContext } from '../src/services/aiContext.js';

const previous = { userId: 'previous-fixture-subject', email: 'previous@example.test' };
const replacement = { userId: 'replacement-fixture-subject', email: 'replacement@example.test' };
const account = { id: 'gairo', userId: previous.userId };
const pending = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

// Pause the chosen real SQLite operation; every other statement keeps running.
function pauseStatement(database, matches) {
  const entered = pending();
  const released = pending();
  const prepare = database.prepare.bind(database);
  let used = false;
  vi.spyOn(database, 'prepare').mockImplementation(sql => {
    const wrap = statement => ({
      bind: (...values) => wrap(statement.bind(...values)),
      ...Object.fromEntries(['first', 'all', 'run'].map(method => [method, async (...args) => {
        if (!used && matches(sql)) {
          used = true;
          entered.resolve();
          await released.promise;
        }
        return statement[method](...args);
      }])),
    });
    return wrap(prepare(sql));
  });
  return { entered: entered.promise, release: released.resolve };
}

describe('Account transfer during in-flight financial requests', () => {
  let DB;
  let env;
  let data;
  let provider;
  const mutation = (revision = 0) => ({ schemaVersion: 1, baseRevision: revision, mutationId: crypto.randomUUID(), financialData: data });

  beforeEach(async () => {
    DB = await createTestD1();
    env = { DB, SIFRAN_GAIRO_EMAIL: previous.email, ANTHROPIC_API_KEY: 'synthetic-provider-key' };
    await bindAccount(DB, env, previous);
    data = emptyFinancialData('gairo');
    data.honorarios.otrosIngresos = 1000;
    provider = vi.fn();
  });
  afterEach(() => { vi.restoreAllMocks(); DB?.close(); });

  async function transfer() {
    Object.assign(env, {
      SIFRAN_GAIRO_EMAIL: replacement.email,
      SIFRAN_GAIRO_REBIND_FROM_USER_ID: previous.userId,
      SIFRAN_GAIRO_REBIND_TO_EMAIL: replacement.email,
      SIFRAN_GAIRO_REBIND_UNTIL: new Date(Date.now() + 60_000).toISOString(),
    });
    const result = await bindAccount(DB, env, replacement);
    expect(result.account.userId).toBe(replacement.userId);
  }
  async function call(path, method = 'GET', body) {
    const headers = {
      'oai-authenticated-user-id': previous.userId,
      'oai-authenticated-user-email': previous.email,
      'X-Sifran-Account': 'gairo', Origin: SITE_ORIGIN,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const request = new Request(SITE_ORIGIN + path, {
      method, headers,
      ...(body !== undefined ? { body: body instanceof ReadableStream ? body : JSON.stringify(body), duplex: 'half' } : {}),
    });
    const response = await handleSiteRequest(request, env, { ai: (incoming, settings, owner) => handleAccountAI(incoming, settings, owner, { fetchImpl: provider }) });
    return { response, body: await response.json() };
  }
  async function snapshot() {
    return {
      workspace: (await DB.prepare('SELECT * FROM workspaces').all()).results,
      quota: (await DB.prepare('SELECT * FROM ai_limits').all()).results,
    };
  }

  it('rejects a PUT whose body finishes after the identity transfer', async () => {
    const before = await snapshot();
    const started = pending();
    const released = pending();
    let bodyController;
    const stream = new ReadableStream({
      start(controller) { bodyController = controller; },
      pull() { started.resolve(); return released.promise; },
    }, { highWaterMark: 0 });
    const result = call('/api/workspace', 'PUT', stream);
    await started.promise;
    await transfer();
    bodyController.enqueue(new TextEncoder().encode(JSON.stringify(mutation())));
    bodyController.close();
    released.resolve();
    expect((await result).response.status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it('does not return workspace data if the owner changes before its SELECT', async () => {
    await putWorkspace(DB, account, mutation());
    const gate = pauseStatement(DB, sql => sql.includes('w.receipts_json') && sql.includes('LEFT JOIN workspaces'));
    const result = call('/api/workspace');
    await gate.entered;
    await transfer();
    gate.release();
    const denied = await result;
    expect(denied.response.status).toBe(403);
    expect(denied.body.financialData).toBeUndefined();
  });

  it.each([0, 1])('keeps revision %s and receipts intact if transfer wins before the workspace CAS', async revision => {
    if (revision) await putWorkspace(DB, account, mutation());
    const before = await snapshot();
    const gate = pauseStatement(DB, sql => sql.startsWith(revision ? 'UPDATE workspaces' : 'INSERT INTO workspaces'));
    const result = call('/api/workspace', 'PUT', mutation(revision));
    await gate.entered;
    await transfer();
    gate.release();
    expect((await result).response.status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['read', 'new quota', 'existing quota'])('does not call Claude after a transfer before %s', async stage => {
    await putWorkspace(DB, account, mutation());
    if (stage === 'existing quota') await DB.prepare('INSERT INTO ai_limits (account_id, window_start, request_count, lease_id, lease_until) VALUES (?, ?, ?, ?, ?)').bind('gairo', Date.now(), 3, null, 0).run();
    const before = await snapshot();
    const context = buildAIContext(data, { rate: 18, source: 'Tipo de cambio proporcionado', asOf: null }, { now: new Date(), timeZone: 'America/Mexico_City' });
    const gate = pauseStatement(DB, sql => stage === 'read'
      ? sql.includes('w.data_json') && sql.includes('LEFT JOIN workspaces')
      : sql.includes('INSERT INTO ai_limits'));
    const result = call('/api/ai', 'POST', {
      action: 'chat', requestId: crypto.randomUUID(), workspaceRevision: 1,
      question: 'Explica mi ingreso.', history: [], context, consent: true,
    });
    await gate.entered;
    await transfer();
    gate.release();
    expect((await result).response.status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(before);
  });

  it('requires both account ID and stable subject at repository boundaries', async () => {
    await expect(getWorkspace(DB, 'gairo')).rejects.toMatchObject({ status: 403 });
    await expect(putWorkspace(DB, { id: 'gairo' }, mutation())).rejects.toMatchObject({ status: 403 });
  });
});
