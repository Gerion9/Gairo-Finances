const ENDPOINT = '/api/ai';
const TIMEOUT_MS = 90_000;
import { getAIWorkspace } from './aiSession.js';

export class AIClientError extends Error {
  constructor(message, code = 'REQUEST_FAILED', status = 0) {
    super(message);
    this.name = 'AIClientError';
    this.code = code;
    this.status = status;
  }
}

async function fetchAI({ method = 'POST', body, signal, timeout = TIMEOUT_MS }) {
  const workspace = getAIWorkspace();
  if (!workspace?.accountId) throw new AIClientError('Inicia sesión en tu cuenta para usar Claude.', 'AUTH_REQUIRED', 401);
  if (['chat', 'analyze'].includes(body?.action) && !workspace.ready) throw new AIClientError('Espera a que tus cambios se guarden antes de usar Claude.', 'WORKSPACE_PENDING', 409);
  const requestBody = ['chat', 'analyze'].includes(body?.action) ? { ...body, requestId: crypto.randomUUID(), workspaceRevision: workspace.workspaceRevision } : body;
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  try {
    const response = await fetch(ENDPOINT, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-Sifran-Account': workspace.accountId, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
      signal: controller.signal,
    });
    const isJSON = response.headers.get('content-type')?.includes('application/json');
    if (response.status === 404 || (response.ok && !isJSON)) {
      throw new AIClientError('El servicio de Claude aún no está disponible en esta instalación.', 'ENDPOINT_UNAVAILABLE', response.status);
    }
    if (!isJSON) {
      throw new AIClientError('El servicio de Claude no está respondiendo correctamente. Puedes verificar la conexión de nuevo.', 'SERVICE_UNAVAILABLE', response.status);
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new AIClientError('El servicio devolvió una respuesta incompleta. Puedes intentarlo de nuevo.', 'INVALID_RESPONSE', response.status);
    }
    if (!response.ok) {
      throw new AIClientError(
        typeof result?.error?.message === 'string' ? result.error.message : 'No se pudo completar la consulta. Inténtalo de nuevo.',
        result?.error?.code || 'REQUEST_FAILED', response.status,
      );
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new AIClientError('El servicio devolvió una respuesta no válida.', 'INVALID_RESPONSE', response.status);
    }
    if (getAIWorkspace()?.epoch !== workspace.epoch || (result.accountId && result.accountId !== workspace.accountId)) throw new DOMException('La cuenta cambió.', 'AbortError');
    return result;
  } catch (error) {
    if (getAIWorkspace()?.epoch !== workspace.epoch) throw new DOMException('La cuenta cambió.', 'AbortError');
    if (timedOut) throw new AIClientError('Claude tardó más de lo esperado. Tu pregunta sigue aquí; puedes volver a enviarla.', 'TIMEOUT');
    if (signal?.aborted || error?.name === 'AbortError') throw new DOMException('Consulta cancelada.', 'AbortError');
    if (error instanceof AIClientError) throw error;
    throw new AIClientError('No hay conexión con el servicio de Claude. Revisa tu conexión e inténtalo de nuevo.', 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function requestAI(action, payload = {}, { signal } = {}) {
  return fetchAI({ body: { ...payload, action }, signal });
}

export async function getAIStatus({ signal } = {}) {
  try {
    const status = await fetchAI({ method: 'GET', signal, timeout: 15_000 });
    if (typeof status.configured !== 'boolean' || typeof status.authenticated !== 'boolean') {
      throw new AIClientError('No se pudo verificar el estado del servicio.', 'INVALID_RESPONSE');
    }
    return status;
  } catch (error) {
    if (error.code === 'ENDPOINT_UNAVAILABLE') {
      return { configured: false, authenticated: false, capabilities: { chat: false, pdf: false }, unavailable: true };
    }
    throw error;
  }
}

export function connectAI(accessCode, { signal } = {}) {
  return requestAI('connect', {}, { signal });
}

export function disconnectAI({ signal } = {}) {
  return requestAI('disconnect', {}, { signal });
}
