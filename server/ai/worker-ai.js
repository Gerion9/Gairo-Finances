// cuentas-ai/r3 proposal. Intended destination: server/ai/worker-ai.js.
// The caller must already validate SIWC, membership, Origin and account header.
import {
  AIError, CHAT_SCHEMA, LIMITS, MAX_BODY_BYTES, PROMPT_VERSION, STATEMENT_SCHEMA,
  onlyKeys, validateChat, validateChatResponse, validateContext, validateStatementResponse,
} from './protocol.js'
import { CHAT_SYSTEM, STATEMENT_SYSTEM } from './prompts.js'
import { buildAIContext } from '../../src/services/aiContext.js'
import { WorkspaceError, json, readJSON } from '../workspace/errors.js'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MAX_RESPONSE_BYTES = 1_200_000
const MAX_REQUESTS = 20
const WINDOW_MS = 60 * 60_000
const LEASE_MS = 60_000
const UPSTREAM_TIMEOUT_MS = 50_000
const CONTEXT_MAX_AGE_MS = 5 * 60_000
const TIME_ZONE = 'America/Mexico_City'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

// The INSERT's SELECT guard also covers the UPDATE branch of the UPSERT.
// A changed workspace cannot acquire a paid lease between the read and write.
const ACQUIRE_LEASE_SQL = `
  INSERT INTO ai_limits (account_id, window_start, request_count, lease_id, lease_until)
  SELECT ?1, ?2, 1, ?3, ?4
  WHERE EXISTS (SELECT 1 FROM workspaces WHERE account_id = ?1 AND revision = ?5)
    AND EXISTS (SELECT 1 FROM accounts WHERE account_id = ?1 AND user_id = ?7)
  ON CONFLICT(account_id) DO UPDATE SET
    window_start = CASE WHEN ai_limits.window_start <= ?6 THEN excluded.window_start ELSE ai_limits.window_start END,
    request_count = CASE WHEN ai_limits.window_start <= ?6 THEN 1 ELSE ai_limits.request_count + 1 END,
    lease_id = excluded.lease_id,
    lease_until = excluded.lease_until
  WHERE ai_limits.lease_until <= ?2
    AND (ai_limits.window_start <= ?6 OR ai_limits.request_count < ${MAX_REQUESTS})
  RETURNING window_start, request_count, lease_id, lease_until
`

function reject(status, code, message, retryAfter) {
  const error = new AIError(status, code, message)
  if (retryAfter !== undefined) error.retryAfter = retryAfter
  throw error
}

function requireText(value, maximum, message = 'Revisa los datos enviados e inténtalo de nuevo.') {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) reject(400, 'INVALID_REQUEST', message)
  return value
}

function settings(env) {
  const key = typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : ''
  const model = typeof env.ANTHROPIC_MODEL === 'string' && /^claude-[a-z0-9.-]{1,80}$/.test(env.ANTHROPIC_MODEL)
    ? env.ANTHROPIC_MODEL : 'claude-sonnet-5'
  return { key, model, configured: Boolean(key) }
}

function localDay(date) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

function requireMetadata(input) {
  if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) reject(400, 'INVALID_REQUEST_ID', 'Vuelve a enviar la solicitud desde la aplicación.')
  if (!Number.isSafeInteger(input.workspaceRevision) || input.workspaceRevision < 0) reject(400, 'WORKSPACE_REVISION_REQUIRED', 'Espera a que tus cambios se guarden antes de usar Claude.')
  return { requestId: input.requestId, workspaceRevision: input.workspaceRevision }
}

export async function validateWebPDF(input) {
  onlyKeys(input, ['action', 'file', 'consent'])
  if (input.consent !== true) reject(400, 'CONSENT_REQUIRED', 'Autoriza el envío del PDF a Claude para continuar.')
  const file = onlyKeys(input.file, ['name', 'mime', 'base64', 'sha256'])
  const name = requireText(file.name, 200)
  if (file.mime !== 'application/pdf' || !/\.pdf$/i.test(name)) reject(400, 'INVALID_PDF', 'Selecciona un archivo PDF.')
  if (typeof file.base64 !== 'string') reject(400, 'INVALID_PDF', 'El archivo PDF no tiene una codificación válida.')
  if (file.base64.length > Math.ceil(LIMITS.maxPdfBytes / 3) * 4) reject(413, 'PDF_TOO_LARGE', 'El PDF debe pesar como máximo 3 MB.')
  if (!file.base64.length || file.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) reject(400, 'INVALID_PDF', 'El archivo PDF no tiene una codificación válida.')
  let binary
  try { binary = atob(file.base64) } catch { reject(400, 'INVALID_PDF', 'El archivo PDF no tiene una codificación válida.') }
  if (btoa(binary) !== file.base64 || binary.length < 8 || binary.slice(0, 5) !== '%PDF-') reject(400, 'INVALID_PDF', 'El archivo no parece ser un PDF válido.')
  if (binary.length > LIMITS.maxPdfBytes) reject(413, 'PDF_TOO_LARGE', 'El PDF debe pesar como máximo 3 MB.')
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  // This is a public integrity checksum, not a credential comparison.
  if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.sha256) || file.sha256.toLowerCase() !== sha256) reject(400, 'FILE_HASH_MISMATCH', 'El archivo cambió durante la lectura. Vuelve a seleccionarlo.')
  return { name, base64: file.base64, sha256 }
}

async function readWorkspace(db, account, expectedRevision) {
  const row = await db.prepare('SELECT a.account_id, w.data_json, w.revision FROM accounts AS a LEFT JOIN workspaces AS w ON w.account_id = a.account_id WHERE a.account_id = ? AND a.user_id = ?').bind(account.id, account.userId).first()
  if (!row) reject(403, 'ACCOUNT_NOT_ALLOWED', 'Tu acceso ya no tiene esta cuenta asignada.')
  if (row.revision == null) reject(409, 'WORKSPACE_NOT_READY', 'Abre y guarda tu espacio financiero antes de usar Claude.')
  if (row.revision !== expectedRevision) reject(409, 'WORKSPACE_REVISION_CONFLICT', 'Tus datos cambiaron. Sincroniza el espacio y vuelve a preparar la consulta.')
  let financialData
  try {
    financialData = JSON.parse(row.data_json)
    if (!financialData || typeof financialData !== 'object' || Array.isArray(financialData)) throw new Error()
  } catch {
    reject(503, 'WORKSPACE_UNAVAILABLE', 'No se pudieron verificar los datos guardados del espacio.')
  }
  return financialData
}

function accountContext(financialData, supplied, time) {
  const clientContext = validateContext(supplied)
  const generated = new Date(clientContext.generatedAt)
  if (!Number.isFinite(generated.getTime()) || Math.abs(generated.getTime() - time) > CONTEXT_MAX_AGE_MS || localDay(generated) !== localDay(new Date(time))) {
    reject(409, 'AI_CONTEXT_STALE', 'El resumen financiero quedó desactualizado. Vuelve a preparar la consulta.')
  }
  if (typeof clientContext.fx.rate !== 'number' || !Number.isFinite(clientContext.fx.rate) || clientContext.fx.rate <= 0) reject(400, 'INVALID_FX', 'Revisa el tipo de cambio antes de usar Claude.')
  if (clientContext.fx.asOf !== null && (!Number.isFinite(Date.parse(clientContext.fx.asOf)) || Date.parse(clientContext.fx.asOf) > time + CONTEXT_MAX_AGE_MS)) reject(400, 'INVALID_FX', 'La fecha del tipo de cambio no es válida.')
  const rebuilt = validateContext(buildAIContext(financialData, {
    rate: clientContext.fx.rate,
    source: clientContext.fx.source,
    asOf: clientContext.fx.asOf,
  }, { now: generated, timeZone: TIME_ZONE }))
  // Both sides are normalized by the same allowlist; received aggregates are
  // compared but NEVER forwarded. The database-derived facts go to Claude.
  if (JSON.stringify(rebuilt) !== JSON.stringify(clientContext)) reject(409, 'AI_CONTEXT_MISMATCH', 'El resumen no coincide con tus datos guardados. Sincroniza el espacio y vuelve a intentarlo.')
  return rebuilt
}

async function acquireLease(db, account, revision, time) {
  const leaseId = crypto.randomUUID()
  const lease = await db.prepare(ACQUIRE_LEASE_SQL).bind(account.id, time, leaseId, time + LEASE_MS, revision, time - WINDOW_MS, account.userId).first()
  if (lease && lease.lease_id === leaseId && Number.isSafeInteger(lease.request_count) && lease.request_count >= 1 && lease.request_count <= MAX_REQUESTS && lease.lease_until === time + LEASE_MS) return lease
  const current = await db.prepare('SELECT a.account_id, w.revision, l.window_start, l.request_count, l.lease_until FROM accounts AS a LEFT JOIN workspaces AS w ON w.account_id = a.account_id LEFT JOIN ai_limits AS l ON l.account_id = a.account_id WHERE a.account_id = ? AND a.user_id = ?').bind(account.id, account.userId).first()
  if (!current) reject(403, 'ACCOUNT_NOT_ALLOWED', 'Tu acceso ya no tiene esta cuenta asignada.')
  if (current.revision == null || current.revision !== revision) reject(409, 'WORKSPACE_REVISION_CONFLICT', 'Tus datos cambiaron. Sincroniza el espacio y vuelve a preparar la consulta.')
  if (current?.lease_until > time) reject(429, 'AI_IN_FLIGHT', 'Espera a que termine la solicitud de Claude en esta cuenta.', Math.max(1, Math.ceil((current.lease_until - time) / 1000)))
  if (current && current.window_start > time - WINDOW_MS && current.request_count >= MAX_REQUESTS) reject(429, 'RATE_LIMITED', 'Esta cuenta alcanzó el límite de 20 solicitudes por hora. Inténtalo más tarde.', Math.max(1, Math.ceil((current.window_start + WINDOW_MS - time) / 1000)))
  reject(503, 'AI_QUOTA_UNAVAILABLE', 'No se pudo reservar una solicitud de Claude. Inténtalo más tarde.')
}

async function responseJSON(response) {
  if (Number(response.headers?.get('content-length')) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel?.()
    reject(502, 'INVALID_AI_RESPONSE', 'La respuesta de Claude superó el tamaño permitido.')
  }
  const reader = response.body?.getReader()
  let raw
  if (reader) {
    const chunks = []
    let size = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel()
          reject(502, 'INVALID_AI_RESPONSE', 'La respuesta de Claude superó el tamaño permitido.')
        }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    raw = new TextDecoder().decode(bytes)
  } else {
    raw = await response.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) reject(502, 'INVALID_AI_RESPONSE', 'La respuesta de Claude superó el tamaño permitido.')
  }
  try { return JSON.parse(raw) } catch { reject(502, 'INVALID_AI_RESPONSE', 'Claude devolvió una respuesta que no se pudo leer.') }
}

export async function askClaude(config, fetchImpl, input, { signal, timeoutMs = UPSTREAM_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    if (controller.signal.aborted) reject(409, 'AI_CANCELLED', 'La solicitud se canceló antes de enviarse.')
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.model, ...input }),
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response.ok) {
      await response.body?.cancel?.()
      if (response.status === 429 || response.status === 529) reject(503, 'AI_BUSY', 'Claude está ocupado. Inténtalo de nuevo más tarde.')
      reject(502, 'AI_UNAVAILABLE', 'No fue posible completar la solicitud con Claude. Revisa la configuración del servicio o inténtalo más tarde.')
    }
    const result = await responseJSON(response)
    if (result?.stop_reason === 'max_tokens') reject(422, 'AI_RESPONSE_TRUNCATED', 'La respuesta quedó incompleta. Reduce el alcance o divide el documento; no se importó ningún dato.')
    if (result?.stop_reason === 'refusal' || result?.content?.some?.(block => block.type === 'refusal')) reject(422, 'AI_REFUSED', 'Claude no pudo procesar esta solicitud. Reformula la pregunta o revisa el documento.')
    if (result?.stop_reason !== 'end_turn' || !Array.isArray(result.content)) reject(502, 'INVALID_AI_RESPONSE', 'Claude no terminó la respuesta de forma verificable.')
    const blocks = result.content.filter(block => block.type === 'text')
    if (blocks.length !== 1 || typeof blocks[0].text !== 'string') reject(502, 'INVALID_AI_RESPONSE', 'Claude devolvió un formato inesperado.')
    let output
    try { output = JSON.parse(blocks[0].text) } catch { reject(502, 'INVALID_AI_RESPONSE', 'Claude devolvió datos que no se pudieron leer.') }
    return {
      output,
      usage: {
        inputTokens: Number.isSafeInteger(result.usage?.input_tokens) && result.usage.input_tokens >= 0 ? result.usage.input_tokens : null,
        outputTokens: Number.isSafeInteger(result.usage?.output_tokens) && result.usage.output_tokens >= 0 ? result.usage.output_tokens : null,
      },
    }
  } catch (error) {
    if (error instanceof AIError) throw error
    if (signal?.aborted) reject(409, 'AI_CANCELLED', 'La solicitud se canceló. No se reintentó automáticamente.')
    if (controller.signal.aborted) reject(504, 'AI_TIMEOUT', 'Claude tardó demasiado. La solicitud no se reintentó automáticamente; puedes intentarlo de nuevo.')
    reject(502, 'AI_UNAVAILABLE', 'No se pudo conectar con Claude. Inténtalo más tarde.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Account authorization belongs to the SIWC/membership router, never the body. */
export async function handleAccountAI(request, env, account, { fetchImpl = fetch, now = Date.now } = {}) {
  let requestId
  let lease
  let db
  let body
  let statusCode = 200
  let extraHeaders = {}
  let releasePending = false
  try {
    if (!account || typeof account.id !== 'string' || !account.id || typeof account.userId !== 'string' || !account.userId) reject(401, 'AI_AUTH_REQUIRED', 'Inicia sesión en tu cuenta para continuar.')
    const config = settings(env)
    const status = authenticated => ({ configured: config.configured, authenticated, capabilities: { chat: config.configured, pdf: config.configured }, limits: { ...LIMITS, maxRequestsPerHour: MAX_REQUESTS }, model: config.model })
    if (request.method === 'GET') return json(status(config.configured))
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } }, 405, { Allow: 'GET, POST' })
    const input = await readJSON(request, MAX_BODY_BYTES)
    if (input.action === 'disconnect') {
      onlyKeys(input, ['action'])
      // Compatibility acknowledgement only; SIWC logout belongs to its router.
      return json({ ...status(config.configured), conversationEnded: true })
    }
    if (!config.configured) reject(503, 'AI_NOT_CONFIGURED', 'Claude aún no está configurado en el servidor.')
    if (input.action === 'connect') {
      onlyKeys(input, ['action'])
      return json(status(true))
    }
    if (!['chat', 'analyze'].includes(input.action)) reject(400, 'INVALID_ACTION', 'La acción solicitada no existe.')
    const metadata = requireMetadata(input)
    requestId = metadata.requestId
    const { requestId: _requestId, workspaceRevision: _workspaceRevision, ...payload } = input
    const data = input.action === 'chat' ? validateChat(payload) : await validateWebPDF(payload)
    if (!env.DB?.prepare) reject(503, 'AI_QUOTA_UNAVAILABLE', 'No se pudo verificar el espacio ni la cuota de Claude.')
    // Primary-first sessions preserve read-your-writes when D1 replication is enabled.
    // Keep authorization reads on the primary; do not reuse replica sessions.
    db = env.DB
    const financialData = await readWorkspace(db, account, metadata.workspaceRevision)
    const context = input.action === 'chat' ? accountContext(financialData, data.context, now()) : null
    if (request.signal?.aborted) reject(409, 'AI_CANCELLED', 'La solicitud se canceló antes de enviarse.')
    lease = await acquireLease(db, account, metadata.workspaceRevision, now())
    const remainingLeaseMs = lease.lease_until - now() - 1000
    if (remainingLeaseMs <= 0) reject(503, 'AI_QUOTA_UNAVAILABLE', 'La reserva de Claude expiró antes de iniciar. Vuelve a intentarlo.')
    const options = { signal: request.signal, timeoutMs: Math.min(UPSTREAM_TIMEOUT_MS, remainingLeaseMs) }
    if (input.action === 'chat') {
      const result = await askClaude(config, fetchImpl, {
        max_tokens: 2200,
        system: `${CHAT_SYSTEM}\nLos hechos de esta solicitud fueron recalculados por el servidor desde el espacio autorizado. El tipo de cambio y su procedencia son valores declarados por el usuario y no cotizaciones verificadas por el servidor.`,
        messages: [{ role: 'user', content: JSON.stringify({ question: data.question, history: data.history, context }) }],
        output_config: { format: { type: 'json_schema', schema: CHAT_SCHEMA } },
      }, options)
      body = { ...validateChatResponse(result.output, context), model: config.model, usage: result.usage, contextAsOf: context.generatedAt, promptVersion: PROMPT_VERSION }
    } else {
      const result = await askClaude(config, fetchImpl, {
        max_tokens: 16_000,
        system: STATEMENT_SYSTEM,
        messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data.base64 } }, { type: 'text', text: 'Extrae el estado de cuenta completo, con un máximo de 150 movimientos. Si no puedes revisar el documento completo, marca coverage.complete=false.' }] }],
        output_config: { format: { type: 'json_schema', schema: STATEMENT_SCHEMA } },
      }, options)
      body = { ...validateStatementResponse(result.output), file: { name: data.name, sha256: data.sha256 }, model: config.model, usage: result.usage, promptVersion: PROMPT_VERSION }
    }
    body.workspaceRevision = metadata.workspaceRevision
  } catch (error) {
    const safe = error instanceof AIError || error instanceof WorkspaceError ? error : new AIError(503, 'AI_UNAVAILABLE', 'No se pudo verificar o completar la solicitud de Claude. Inténtalo más tarde.')
    statusCode = safe.status
    body = { error: { code: safe.code, message: safe.message } }
    if (safe.status === 429) extraHeaders = { 'Retry-After': String(safe.retryAfter || 60) }
  } finally {
    if (lease && db) {
      try {
        // Never release a newer caller's lease, even if this request finished late.
        const result = await db.prepare('UPDATE ai_limits SET lease_until = 0 WHERE account_id = ? AND lease_id = ?').bind(account.id, lease.lease_id).run()
        if (result?.success === false) throw new Error('Lease release failed')
      } catch {
        // The lease remains bounded by its original TTL; report this operational
        // state without discarding a paid answer or retrying the provider.
        releasePending = true
      }
    }
  }
  if (requestId) body.requestId = requestId
  if (lease) body.quota = { limit: MAX_REQUESTS, remaining: Math.max(0, MAX_REQUESTS - lease.request_count), resetAt: new Date(lease.window_start + WINDOW_MS).toISOString(), leaseReleasePending: releasePending }
  return json(body, statusCode, extraHeaders)
}
