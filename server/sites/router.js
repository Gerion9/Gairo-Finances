import { json, readJSON, WorkspaceError } from '../workspace/errors.js';
import { readIdentity, getAccountSession, bindAccount, requireAccount } from '../workspace/identity.js';
import { getWorkspace, putWorkspace } from '../workspace/repository.js';
import { handleAccountAI } from '../ai/worker-ai.js';

export const SITE_ORIGIN = 'https://sifran.gairo.chatgpt.site';

// Deploy this entrypoint ONLY through Sites. It relies on the managed
// dispatcher stripping/replacing identity headers and enforcing private access.
export async function handleSiteRequest(request, env, { html = '', ai = handleAccountAI } = {}) {
  const url = new URL(request.url);
  if (url.origin !== SITE_ORIGIN) return json({ error: { code: 'ENTRYPOINT_DENIED', message: 'Abre Sifran desde su dirección privada.' } }, 403);
  const path = url.pathname;
  if (!path.startsWith('/api/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    if (path === '/' || path === '/index.html') return new Response(request.method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' } });
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  }
  try {
    const identity = readIdentity(request);
    if (!identity && path === '/api/session' && request.method === 'GET') return json({ authenticated: false, access: 'pending', account: null });
    if (!identity) throw new WorkspaceError(401, 'AUTH_REQUIRED', 'Inicia sesión para acceder a tu cuenta.');
    if (!env.DB?.prepare) throw new WorkspaceError(503, 'STORAGE_UNAVAILABLE', 'La sincronización todavía no está disponible. Tus datos no se han reemplazado.');
    // D1 without Sessions API runs every statement on the primary. Revocation
    // must not depend on replica lag after the first authorization query.
    // https://developers.cloudflare.com/d1/best-practices/read-replication/
    const db = env.DB;
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (request.headers.get('origin') !== SITE_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site') throw new WorkspaceError(403, 'ORIGIN_DENIED', 'El origen de la solicitud no está autorizado.');
    }
    if (path === '/api/session' && request.method === 'GET') return json(await getAccountSession(db, env, identity));
    if (path === '/api/session/claim' && request.method === 'POST') {
      const input = await readJSON(request, 256);
      if (Object.keys(input).length) throw new WorkspaceError(400, 'INVALID_REQUEST', 'La cuenta se asigna a tu identidad verificada.');
      return json(await bindAccount(db, env, identity));
    }
    const account = await requireAccount(db, request, identity);
    if (path === '/api/workspace' && request.method === 'GET') {
      const { receipts, ...workspace } = await getWorkspace(db, account);
      return json(workspace, 200, { ETag: `"ws-${workspace.revision}"` });
    }
    if ((path === '/api/workspace' && request.method === 'PUT') || (path === '/api/workspace/migrate' && request.method === 'POST')) {
      const input = await readJSON(request, 1_600_000);
      return json(await putWorkspace(db, account, input, { migration: path.endsWith('/migrate') }));
    }
    if (path === '/api/ai') {
      const result = await ai(request, { ...env, DB: db }, account);
      const body = await result.json();
      return json({ ...body, accountId: account.id }, result.status, result.headers.get('Retry-After') ? { 'Retry-After': result.headers.get('Retry-After') } : {});
    }
    throw new WorkspaceError(404, 'NOT_FOUND', 'Esta operación no existe.');
  } catch (error) {
    const safe = error instanceof WorkspaceError ? error : new WorkspaceError(503, 'STORAGE_UNAVAILABLE', 'No se pudo verificar el guardado. Conserva esta pestaña y vuelve a intentarlo.');
    return json({ error: { code: safe.code, message: safe.message } }, safe.status);
  }
}
