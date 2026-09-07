import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const disabled = { configured: false, authenticated: false, accountId: 'gairo', capabilities: { chat: false, pdf: false } };
const enabled = { configured: true, authenticated: true, accountId: 'gairo', capabilities: { chat: true, pdf: true } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Claude client belongs to one synchronized account epoch', () => {
  let client;
  let session;
  let fetchMock;
  let storage;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('crypto', webcrypto);
    fetchMock = vi.fn();
    storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    session = await import('./aiSession.js');
    client = await import('./aiClient.js');
  });
  afterEach(() => {
    session.clearAIWorkspace();
    if (vi.isFakeTimers()) vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function bind(overrides = {}) {
    const workspace = { accountId: 'gairo', workspaceRevision: 7, ready: true, epoch: 'gairo-epoch-a', ...overrides };
    session.bindAIWorkspace(workspace);
    return workspace;
  }
  function invoke(action, options = {}) {
    if (action === 'status') return client.getAIStatus(options);
    if (action === 'connect') return client.connectAI('legacy-code-is-not-authority', options);
    if (action === 'disconnect') return client.disconnectAI(options);
    return client.requestAI(action, action === 'chat' ? { question: '¿Cuál es mi presupuesto?' } : { pdfBase64: 'test-document' }, options);
  }

  it.each(['status', 'connect', 'disconnect', 'chat', 'analyze'])('requires a bound account before %s and never falls back to legacy browser credentials', async action => {
    storage.getItem.mockReturnValue('legacy-secret-token');
    await expect(invoke(action)).rejects.toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(['chat', 'analyze'])('binds %s to the account header and saved revision with a fresh request identifier', async action => {
    bind();
    fetchMock.mockImplementation(async () => json({ accountId: 'gairo', answer: 'Respuesta de prueba' }));
    const payload = action === 'chat' ? { question: 'Pregunta', requestId: 'caller-id', workspaceRevision: 999 } : { pdfBase64: 'test-document', requestId: 'caller-id', workspaceRevision: 999 };
    await client.requestAI(action, payload);
    await client.requestAI(action, payload);
    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/ai');
    expect(options).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(new Headers(options.headers).get('X-Sifran-Account')).toBe('gairo');
    const first = JSON.parse(options.body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.action).toBe(action);
    expect(first.workspaceRevision).toBe(7);
    expect(first.requestId).toMatch(UUID);
    expect(first.requestId).not.toBe('caller-id');
    expect(second.requestId).not.toBe(first.requestId);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(['chat', 'analyze'])('blocks %s before provider access when the workspace has pending changes', async action => {
    bind({ ready: false });
    await expect(invoke(action)).rejects.toMatchObject({ code: 'WORKSPACE_PENDING', status: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('can inspect a disabled service while data is pending without reporting available capabilities', async () => {
    bind({ ready: false });
    fetchMock.mockResolvedValueOnce(json(disabled));
    await expect(client.getAIStatus()).resolves.toEqual(disabled);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
    expect(new Headers(options.headers).get('X-Sifran-Account')).toBe('gairo');
  });

  it('does not send retired access codes or persist a global disconnect marker', async () => {
    bind();
    fetchMock.mockResolvedValueOnce(json(enabled)).mockResolvedValueOnce(json({ ...enabled, authenticated: false }));
    await client.connectAI('must-not-leave-this-call');
    await client.disconnectAI();
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual([{ action: 'connect' }, { action: 'disconnect' }]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each(['status', 'chat', 'analyze'])('discards a late successful %s response after the account is cleared', async action => {
    const binding = bind();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const pending = invoke(action);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    session.clearAIWorkspace(binding.epoch);
    response.resolve(json(action === 'status' ? enabled : { accountId: 'gairo', answer: 'Old private answer' }));
    await rejected;
    expect(session.getAIWorkspace()).toBeNull();
  });

  it.each(['status', 'chat'])('discards a late failed %s response after clearing the account', async action => {
    const binding = bind();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const pending = invoke(action);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    session.clearAIWorkspace(binding.epoch);
    response.resolve(json({ error: { code: 'AI_BUSY', message: 'An error from the old account request.' } }, 503));
    await rejected;
  });

  it('rejects an old answer even if the same account is rebound under a new epoch', async () => {
    bind();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const pending = client.requestAI('chat', { question: 'Old question' });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    bind({ epoch: 'gairo-epoch-b' });
    response.resolve(json({ accountId: 'gairo', answer: 'Old answer' }));
    await rejected;
    expect(session.getAIWorkspace().epoch).toBe('gairo-epoch-b');
  });

  it('ignores cleanup from an old epoch instead of clearing the currently bound account', async () => {
    bind({ accountId: 'ricardo', workspaceRevision: 2, epoch: 'ricardo-epoch' });
    session.clearAIWorkspace('gairo-epoch-a');
    fetchMock.mockResolvedValueOnce(json({ ...disabled, accountId: 'ricardo' }));
    await expect(client.getAIStatus()).resolves.toMatchObject({ accountId: 'ricardo' });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-Sifran-Account')).toBe('ricardo');
  });

  it('rejects a response tagged for another account', async () => {
    bind();
    fetchMock.mockResolvedValueOnce(json({ accountId: 'ricardo', answer: 'Other account response' }));
    await expect(client.requestAI('chat', { question: 'Pregunta' })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([
    ['status', 15_000],
    ['chat', 90_000],
  ])('classifies a %s timeout separately from user cancellation', async (action, duration) => {
    vi.useFakeTimers();
    bind();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const pending = invoke(action);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(duration);
    await rejected;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts an explicitly cancelled request without replacing it with a timeout error', async () => {
    bind();
    const controller = new AbortController();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const pending = client.requestAI('chat', { question: 'Pregunta' }, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
  });

  it.each([404, 200])('keeps a missing or HTML endpoint unavailable rather than assuming Claude is connected (%i)', async status => {
    bind();
    fetchMock.mockResolvedValueOnce(new Response('<html>Application shell</html>', { status, headers: { 'Content-Type': 'text/html' } }));
    await expect(client.getAIStatus()).resolves.toEqual({
      configured: false, authenticated: false, capabilities: { chat: false, pdf: false }, unavailable: true,
    });
  });

  it('preserves typed service errors without fabricating an answer', async () => {
    bind();
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'WORKSPACE_REVISION_CONFLICT', message: 'Actualiza tu espacio.' } }, 409));
    await expect(client.requestAI('chat', { question: 'Pregunta' })).rejects.toMatchObject({ code: 'WORKSPACE_REVISION_CONFLICT', status: 409 });
  });

  it('rejects incomplete status data and malformed JSON', async () => {
    bind();
    fetchMock.mockResolvedValueOnce(json({ configured: false, accountId: 'gairo' }))
      .mockResolvedValueOnce(new Response('{broken', { headers: { 'Content-Type': 'application/json' } }));
    await expect(client.getAIStatus()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client.requestAI('chat', { question: 'Pregunta' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('reports a network failure without changing or persisting the account binding', async () => {
    const binding = bind();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(client.requestAI('chat', { question: 'Pregunta' })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(session.getAIWorkspace()).toEqual(binding);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
