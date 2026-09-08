import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createTestD1 } from './d1-test-adapter.js';
import { emptyFinancialData } from '../src/services/accountData.js';
import { buildAIContext } from '../src/services/aiContext.js';
import { bindAccount } from '../server/workspace/identity.js';
import { putWorkspace } from '../server/workspace/repository.js';
import { handleAccountAI, validateWebPDF } from '../server/ai/worker-ai.js';

const NOW = Date.parse('2026-09-08T03:30:00Z');
const account = { id: 'gairo', userId: 'synthetic-user-a' };
const data = emptyFinancialData('gairo'); data.honorarios.otrosIngresos = 1000;
const context = () => buildAIContext(data, { rate: 18, source: 'Tipo de cambio proporcionado', asOf: null }, { now: new Date(NOW), timeZone: 'America/Mexico_City' });
const body = extra => ({ action: 'chat', requestId: crypto.randomUUID(), workspaceRevision: 1, question: 'Explica mi ingreso registrado.', history: [], context: context(), consent: true, ...extra });
const request = value => new Request('https://sifran.gairo.chatgpt.site/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const response = () => Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ answer: 'El ingreso configurado es 1000 MXN.', evidenceIds: ['budget.income'] }) }], usage: { input_tokens: 10, output_tokens: 10 } });

describe('Account-bound Claude with real SQLite quota and workspace', () => {
  let DB; let env;
  beforeEach(async () => {
    DB = await createTestD1(); env = { DB, SIFRAN_GAIRO_EMAIL: 'gairo@example.test', ANTHROPIC_API_KEY: 'synthetic-provider-key' };
    await bindAccount(DB, env, { userId: account.userId, email: env.SIFRAN_GAIRO_EMAIL });
    await putWorkspace(DB, account, { schemaVersion: 1, baseRevision: 0, mutationId: crypto.randomUUID(), financialData: data });
  });
  afterEach(() => DB?.close());
  it('rebuilds only the authorized workspace and releases its lease', async () => {
    const fetchImpl = vi.fn(async () => response());
    const result = await handleAccountAI(request(body()), env, account, { fetchImpl, now: () => NOW });
    expect(result.status).toBe(200);
    expect((await result.json()).evidenceIds).toEqual(['budget.income']);
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const facts = JSON.parse(sent.messages[0].content).context.facts;
    expect(facts.find(item => item.id === 'budget.income').amount).toBe(1000);
    expect(JSON.stringify(sent)).not.toContain('synthetic-user-a');
    expect((await DB.prepare('SELECT lease_until FROM ai_limits WHERE account_id = ?').bind('gairo').first()).lease_until).toBe(0);
  });
  it.each(['revision', 'facts', 'consent', 'stale'])('rejects invalid %s before provider or quota', async scenario => {
    const value = body();
    if (scenario === 'revision') value.workspaceRevision = 0;
    if (scenario === 'facts') value.context.facts[0].amount += 1;
    if (scenario === 'consent') value.consent = false;
    if (scenario === 'stale') value.context.generatedAt = '2026-09-07T00:00:00Z';
    const fetchImpl = vi.fn();
    const result = await handleAccountAI(request(value), env, account, { fetchImpl, now: () => NOW });
    expect(result.status).toBeGreaterThanOrEqual(400); expect(fetchImpl).not.toHaveBeenCalled();
    expect(await DB.prepare('SELECT * FROM ai_limits').first()).toBeNull();
  });
  it('enforces a shared account limit across handler instances', async () => {
    const fetchImpl = vi.fn(async () => response());
    for (let i = 0; i < 20; i++) expect((await handleAccountAI(request(body()), env, account, { fetchImpl, now: () => NOW })).status).toBe(200);
    expect((await handleAccountAI(request(body()), env, account, { fetchImpl, now: () => NOW })).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(20);
  });
  it('rejects an overlapping paid request while the lease is held', async () => {
    let release; const fetchImpl = vi.fn(() => new Promise(resolve => { release = () => resolve(response()); }));
    const first = handleAccountAI(request(body()), env, account, { fetchImpl, now: () => NOW });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const second = await handleAccountAI(request(body()), env, account, { fetchImpl, now: () => NOW });
    expect(second.status).toBe(429); release(); expect((await first).status).toBe(200);
  });
  it('fails closed without provider configuration and never fabricates a response', async () => {
    const fetchImpl = vi.fn();
    const result = await handleAccountAI(request(body()), { DB }, account, { fetchImpl });
    expect(result.status).toBe(503); expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('validates PDF bytes using Web Crypto without Node globals', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nfixture only');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    const file = { name: 'fixture.pdf', mime: 'application/pdf', base64: btoa('%PDF-1.7\nfixture only'), sha256: digest };
    expect((await validateWebPDF({ action: 'analyze', file, consent: true })).sha256).toBe(digest);
    await expect(validateWebPDF({ action: 'analyze', file: { ...file, sha256: '0'.repeat(64) }, consent: true })).rejects.toMatchObject({ code: 'FILE_HASH_MISMATCH' });
  });
});
