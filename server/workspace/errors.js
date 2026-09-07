export class WorkspaceError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff', ...extraHeaders } });
}
export async function readJSON(request, limit = 1_500_000) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) throw new WorkspaceError(415, 'JSON_REQUIRED', 'La solicitud debe ser JSON.');
  if (Number(request.headers.get('content-length')) > limit) throw new WorkspaceError(413, 'BODY_TOO_LARGE', 'El archivo supera el tamaño permitido.');
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError(400, 'INVALID_JSON', 'Falta el contenido de la solicitud.');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new WorkspaceError(413, 'BODY_TOO_LARGE', 'El archivo supera el tamaño permitido.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new WorkspaceError(400, 'INVALID_JSON', 'No se pudo leer el contenido.'); }
}
