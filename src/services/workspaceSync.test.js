import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { WorkspaceSync } from './workspaceSync.js';
import { AccountError } from './auth.js';
import { emptyFinancialData } from './accountData.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const documentFor = (amount = 0) => ({
  ...emptyFinancialData('gairo'),
  honorarios: { ...emptyFinancialData('gairo').honorarios, otrosIngresos: amount },
});
const remote = (revision = 0, amount = 0) => ({ accountId: 'gairo', schemaVersion: 1, revision, financialData: documentFor(amount), updatedAt: revision ? '2026-09-08T12:00:00.000Z' : null });
const acknowledgement = (operation, currentRevision = operation.baseRevision + 1) => ({
  accountId: 'gairo', mutationId: operation.mutationId,
  acceptedRevision: operation.baseRevision + 1, currentRevision, updatedAt: '2026-09-08T12:01:00.000Z',
});
const writes = request => request.mock.calls.filter(([, options]) => ['PUT', 'POST'].includes(options.method));

describe('WorkspaceSync recovers drafts without crossing revisions or sessions', () => {
  const queues = [];
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('crypto', webcrypto); });
  afterEach(() => {
    for (const sync of queues.splice(0)) sync.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function queue(request, options = {}) {
    const sync = new WorkspaceSync('gairo', { request, ...options });
    queues.push(sync);
    return sync;
  }

  it('keeps a session-expired draft until the same authenticated account returns', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote(2))
      .mockRejectedValueOnce(new AccountError('Session expired', 'AUTH_REQUIRED', 401))
      .mockImplementationOnce(async (_path, options) => acknowledgement(options.body));
    const sync = queue(request);
    await sync.load();
    const draft = documentFor(321);
    sync.edit(draft); await sync.flush();
    expect(sync.status).toBe('session');
    expect(await sync.resumeSession({ authenticated: false, access: 'pending', account: null }, 'subject-a')).toBe('pending');
    expect(sync.active).toBe(true); expect(sync.data).toBe(draft); expect(sync.dirty).toBe(true);
    expect(await sync.resumeSession({ authenticated: true, access: 'allowed', account: { id: 'ricardo', userId: 'subject-b' } }, 'subject-a')).toBe('changed');
    expect(sync.data).toBe(draft); expect(writes(request)).toHaveLength(1);
    expect(await sync.resumeSession({ authenticated: true, access: 'allowed', account: { id: 'gairo', userId: 'subject-a' } }, 'subject-a')).toBe('resumed');
    expect(sync.snapshot()).toMatchObject({ status: 'saved', dirty: false, revision: 3, data: draft });
    expect(writes(request)[0][1].body).toEqual(writes(request)[1][1].body);
  });

  it('ignores a second session verification during cloud replacement', async () => {
    const cloud = deferred();
    const request = vi.fn().mockResolvedValueOnce(remote(1)).mockResolvedValueOnce(remote(2)).mockImplementationOnce(() => cloud.promise);
    const sync = queue(request);
    await sync.load(); sync.status = 'session';
    const session = { authenticated: true, access: 'allowed', account: { id: 'gairo', userId: 'subject-a' } };
    await sync.resumeSession(session, 'subject-a');
    expect(sync.status).toBe('remote');
    const replacing = sync.useCloud();
    expect(await sync.resumeSession(session, 'subject-a')).toBe('obsolete');
    expect(sync.status).toBe('refreshing'); expect(() => sync.edit(documentFor(99))).toThrow();
    cloud.resolve(remote(2, 20)); await replacing;
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 2, data: documentFor(20) });
  });

  it('blocks edits until the initial cloud read completes', async () => {
    const pendingRead = deferred();
    const request = vi.fn(() => pendingRead.promise);
    const sync = queue(request);
    const loading = sync.load();
    expect(sync.snapshot()).toMatchObject({ data: null, status: 'loading', dirty: false });
    expect(() => sync.edit(documentFor(99))).toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes(request)).toHaveLength(0);
    pendingRead.resolve(remote(3, 40));
    await loading;
    expect(sync.snapshot()).toMatchObject({ revision: 3, status: 'saved', dirty: false });
    expect(sync.snapshot().data.honorarios.otrosIngresos).toBe(40);
  });

  it('freezes local editing while the explicitly chosen cloud version is being fetched', async () => {
    const pendingRead = deferred();
    const request = vi.fn().mockResolvedValueOnce(remote(1, 10)).mockImplementationOnce(() => pendingRead.promise);
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(20));
    const choosingCloud = sync.useCloud();
    expect(sync.snapshot()).toMatchObject({ status: 'refreshing', revision: 1, dirty: true });
    expect(sync.snapshot().data.honorarios.otrosIngresos).toBe(20);
    expect(() => sync.edit(documentFor(30))).toThrow();
    await sync.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes(request)).toHaveLength(0);
    pendingRead.resolve(remote(2, 80));
    await choosingCloud;
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 2, dirty: false });
    expect(sync.snapshot().data.honorarios.otrosIngresos).toBe(80);
  });

  it.each([422, 413])('gives a corrected draft a fresh operation key after a definite %i rejection', async status => {
    const request = vi.fn().mockResolvedValueOnce(remote())
      .mockRejectedValueOnce(new AccountError('No se guardó.', status === 422 ? 'INVALID_WORKSPACE' : 'WORKSPACE_TOO_LARGE', status))
      .mockImplementationOnce(async (_path, options) => acknowledgement(options.body));
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(100));
    await sync.flush();
    expect(sync.snapshot()).toMatchObject({ status: 'error', revision: 0, dirty: true });
    const firstOperation = writes(request)[0][1].body;
    sync.edit(documentFor(50));
    await sync.flush();
    const corrected = writes(request)[1][1].body;
    expect(corrected.mutationId).not.toBe(firstOperation.mutationId);
    expect(corrected.baseRevision).toBe(0);
    expect(corrected.financialData.honorarios.otrosIngresos).toBe(50);
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 1, dirty: false });
  });

  it('retries an ambiguous network failure with the identical operation and does not duplicate a write', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote(4))
      .mockRejectedValueOnce(new AccountError('Sin red.', 'NETWORK_ERROR'))
      .mockImplementationOnce(async (_path, options) => ({ ...acknowledgement(options.body), replayed: true }));
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(77));
    await sync.flush();
    expect(sync.snapshot()).toMatchObject({ status: 'error', revision: 4, dirty: true });
    const first = structuredClone(writes(request)[0][1].body);
    await sync.flush();
    expect(writes(request)[1][1].body).toEqual(first);
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 5, dirty: false });
    expect(writes(request)).toHaveLength(2);
  });

  it('retains edits made during a write, then saves them against the acknowledged revision', async () => {
    const firstWrite = deferred();
    const request = vi.fn().mockResolvedValueOnce(remote(2, 5))
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(async (_path, options) => acknowledgement(options.body));
    const sync = queue(request);
    await sync.load();
    const firstDraft = documentFor(50);
    const newerDraft = documentFor(90);
    sync.edit(firstDraft);
    const saving = sync.flush();
    const firstOperation = writes(request)[0][1].body;
    sync.edit(newerDraft);
    expect(sync.snapshot().data).toBe(newerDraft);
    firstWrite.resolve(acknowledgement(firstOperation));
    await saving;
    const operations = writes(request).map(([, options]) => options.body);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({ baseRevision: 2, financialData: firstDraft });
    expect(operations[1]).toMatchObject({ baseRevision: 3, financialData: newerDraft });
    expect(operations[1].mutationId).not.toBe(operations[0].mutationId);
    expect(sync.snapshot()).toMatchObject({ revision: 4, status: 'saved', dirty: false, data: newerDraft });
  });

  it('reconciles a lost response before sending a newer draft with a new operation key', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote())
      .mockRejectedValueOnce(new AccountError('Respuesta perdida.', 'NETWORK_ERROR'))
      .mockImplementationOnce(async (_path, options) => ({ ...acknowledgement(options.body), replayed: true }))
      .mockImplementationOnce(async (_path, options) => acknowledgement(options.body));
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(10));
    await sync.flush();
    sync.edit(documentFor(20));
    await sync.flush();
    const operations = writes(request).map(([, options]) => options.body);
    expect(operations).toHaveLength(3);
    expect(operations[1]).toEqual(operations[0]);
    expect(operations[2].baseRevision).toBe(1);
    expect(operations[2].mutationId).not.toBe(operations[0].mutationId);
    expect(operations[2].financialData.honorarios.otrosIngresos).toBe(20);
    expect(sync.snapshot()).toMatchObject({ revision: 2, dirty: false, status: 'saved' });
  });

  it('retains a draft and stops all autosaves when the server reports a changed session', async () => {
    const onSessionLost = vi.fn();
    const request = vi.fn().mockResolvedValueOnce(remote(2))
      .mockRejectedValueOnce(new AccountError('Otra cuenta activa.', 'ACCOUNT_CHANGED', 409));
    const sync = queue(request, { onSessionLost });
    await sync.load();
    const draft = documentFor(123);
    sync.edit(draft);
    await sync.flush();
    expect(sync.snapshot()).toMatchObject({ status: 'session', revision: 2, dirty: true, data: draft });
    expect(onSessionLost).toHaveBeenCalledOnce();
    expect(() => sync.edit(documentFor(456))).toThrow();
    await vi.advanceTimersByTimeAsync(10_000);
    await sync.flush();
    await sync.check();
    expect(writes(request)).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not automatically overwrite a newer cloud revision while a local draft is dirty', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote(1, 10)).mockResolvedValueOnce(remote(2, 20));
    const sync = queue(request);
    await sync.load();
    const localDraft = documentFor(30);
    sync.edit(localDraft);
    await sync.check();
    expect(sync.snapshot()).toMatchObject({ status: 'conflict', dirty: true, revision: 1, data: localDraft });
    expect(sync.snapshot().remote.financialData.honorarios.otrosIngresos).toBe(20);
    await vi.advanceTimersByTimeAsync(1000);
    await sync.flush();
    expect(writes(request)).toHaveLength(0);
  });

  it('exposes a later cloud revision on a replay without treating stale local data as current', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote(1))
      .mockImplementationOnce(async (_path, options) => ({ ...acknowledgement(options.body, 4), replayed: true }));
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(75));
    await sync.flush();
    expect(sync.snapshot()).toMatchObject({ revision: 2, status: 'conflict' });
    expect(() => sync.edit(documentFor(80))).toThrow();
    await sync.flush();
    expect(writes(request)).toHaveLength(1);
  });

  it('keeps the migration route and operation key when retrying a lost migration response', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote())
      .mockRejectedValueOnce(new AccountError('Respuesta perdida.', 'NETWORK_ERROR'))
      .mockImplementationOnce(async (_path, options) => acknowledgement(options.body));
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(20));
    await sync.flush({ migration: true });
    await sync.flush();
    const calls = writes(request);
    expect(calls.map(([path]) => path)).toEqual(['/api/workspace/migrate', '/api/workspace/migrate']);
    expect(calls.map(([, options]) => options.method)).toEqual(['POST', 'POST']);
    expect(calls[1][1].body).toEqual(calls[0][1].body);
    expect(sync.snapshot()).toMatchObject({ revision: 1, status: 'saved' });
  });

  it('ignores a late initial read after disposal even when the transport ignores abort', async () => {
    const read = deferred();
    const onChange = vi.fn();
    const request = vi.fn(() => read.promise);
    const sync = queue(request, { onChange });
    const loading = sync.load();
    sync.dispose();
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    read.resolve(remote(4, 999));
    await loading;
    expect(sync.snapshot().data).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a late acknowledgement after disposal and never flushes a newer draft', async () => {
    const write = deferred();
    const onChange = vi.fn();
    const request = vi.fn().mockResolvedValueOnce(remote(3)).mockImplementationOnce(() => write.promise);
    const sync = queue(request, { onChange });
    await sync.load();
    sync.edit(documentFor(10));
    const saving = sync.flush();
    const operation = writes(request)[0][1].body;
    sync.edit(documentFor(20));
    sync.dispose();
    const emissions = onChange.mock.calls.length;
    write.resolve(acknowledgement(operation));
    await saving;
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync.snapshot().revision).toBe(3);
    expect(onChange).toHaveBeenCalledTimes(emissions);
    expect(writes(request)).toHaveLength(1);
  });

  it.each(['failure', 'success'])('ignores a stale check %s while the selected cloud revision is still loading', async outcome => {
    const staleRead = deferred();
    const chosenRead = deferred();
    const request = vi.fn().mockResolvedValueOnce(remote(1, 10))
      .mockImplementationOnce(() => staleRead.promise)
      .mockResolvedValueOnce(remote(2, 20))
      .mockImplementationOnce(() => chosenRead.promise);
    const sync = queue(request);
    await sync.load();
    const checkA = sync.check();
    await sync.check();
    expect(sync.snapshot()).toMatchObject({ status: 'remote', revision: 1 });
    expect(sync.snapshot().remote.revision).toBe(2);

    const choosingCloud = sync.useCloud();
    expect(sync.snapshot().status).toBe('refreshing');
    if (outcome === 'failure') staleRead.reject(new AccountError('La lectura anterior perdi? la red.', 'NETWORK_ERROR'));
    else staleRead.resolve(remote(3, 30));
    await checkA;

    expect(sync.snapshot()).toMatchObject({ status: 'refreshing', revision: 1, dirty: false, data: documentFor(10) });
    expect(sync.snapshot().remote.revision).toBe(2);
    expect(() => sync.edit(documentFor(99))).toThrow();
    await sync.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes(request)).toHaveLength(0);

    chosenRead.resolve(remote(4, 40));
    await choosingCloud;
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 4, dirty: false, data: documentFor(40), remote: null });
    expect(() => sync.edit(documentFor(50))).not.toThrow();
  });

  it('uses an ordinary write after accepting cloud data that won an initial migration conflict', async () => {
    const request = vi.fn().mockResolvedValueOnce(remote())
      .mockRejectedValueOnce(new AccountError('Otro dispositivo guard? primero.', 'REVISION_CONFLICT', 409))
      .mockResolvedValueOnce(remote(1, 200))
      .mockImplementationOnce(async (_path, options) => acknowledgement(options.body));
    const sync = queue(request);
    await sync.load();
    sync.edit(documentFor(10));
    await sync.flush({ migration: true });
    expect(sync.snapshot()).toMatchObject({ status: 'conflict', revision: 0, dirty: true, data: documentFor(10) });
    const attemptedMigration = writes(request)[0];
    expect(attemptedMigration[0]).toBe('/api/workspace/migrate');
    expect(attemptedMigration[1]).toMatchObject({ method: 'POST', body: { baseRevision: 0 } });

    await sync.useCloud();
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 1, dirty: false, data: documentFor(200) });
    sync.edit(documentFor(300));
    await sync.flush();

    const calls = writes(request);
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toBe('/api/workspace');
    expect(calls[1][1]).toMatchObject({ method: 'PUT', body: { baseRevision: 1, financialData: documentFor(300) } });
    expect(calls[1][1].body.mutationId).not.toBe(attemptedMigration[1].body.mutationId);
    expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 2, dirty: false, data: documentFor(300) });
  });
});
