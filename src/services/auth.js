export const SIGN_IN_PATH = '/signin-with-chatgpt?return_to=%2F';
export const SIGN_OUT_PATH = '/signout-with-chatgpt?return_to=%2F';

export class AccountError extends Error {
  constructor(message, code = 'NETWORK_ERROR', status = 0) { super(message); this.code = code; this.status = status; }
}
export async function accountRequest(path, { accountId, method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal,
      headers: { Accept: 'application/json', ...(accountId ? { 'X-Sifran-Account': accountId } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new AccountError('Sin conexión. Tus cambios pendientes siguen en esta pestaña.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new AccountError('Abre la versión de Sifran conectada para iniciar sesión.', 'SERVICE_UNAVAILABLE', response.status);
  const data = await response.json();
  if (!response.ok) throw new AccountError(data.error?.message || 'No se pudo completar la operación.', data.error?.code, response.status);
  if (accountId && data.accountId && accountId !== data.accountId) throw new AccountError('La cuenta cambió. Vuelve a iniciar sesión.', 'ACCOUNT_CHANGED', 409);
  return data;
}
export const getSession = ({ signal } = {}) => accountRequest('/api/session', { signal });
export const claimAccount = ({ signal } = {}) => accountRequest('/api/session/claim', { method: 'POST', body: {}, signal });
