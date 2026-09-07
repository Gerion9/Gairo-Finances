import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  AIError, CHAT_SCHEMA, LIMITS, MAX_BODY_BYTES, PROMPT_VERSION, STATEMENT_SCHEMA,
  onlyKeys, validateChat, validateChatResponse, validatePDF, validateStatementResponse,
} from './contracts.js'
import { CHAT_SYSTEM, STATEMENT_SYSTEM } from './prompts.js'

const COOKIE_NAME = 'finance_ai_session'
const SESSION_SECONDS = 4 * 60 * 60
const UPSTREAM_TIMEOUT_MS = 50_000
const MAX_RESPONSE_BYTES = 1_200_000
const ENDPOINT = 'https://api.anthropic.com/v1/messages'

function header(req, name) {
  const value = req.headers?.[name]
  return typeof value === 'string' ? value : ''
}

function secureEqual(left, right) {
  // Fixed-size digests only normalize a timing-safe comparison. Access codes
  // remain environment-managed service secrets, not a password database.
  return timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest())
}

function settings(env) {
  const production = env.NODE_ENV === 'production' || env.VERCEL === '1' || env.NETLIFY === 'true'
  const key = typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : ''
  const accessCode = typeof env.AI_ACCESS_CODE === 'string' ? env.AI_ACCESS_CODE : ''
  const secret = typeof env.AI_SESSION_SECRET === 'string' ? env.AI_SESSION_SECRET : ''
  const model = typeof env.ANTHROPIC_MODEL === 'string' && /^claude-[a-z0-9.-]{1,80}$/.test(env.ANTHROPIC_MODEL) ? env.ANTHROPIC_MODEL : 'claude-sonnet-5'
  const origin = typeof env.AI_ALLOWED_ORIGIN === 'string' ? env.AI_ALLOWED_ORIGIN : ''
  let validOrigin = false
  try {
    const parsed = new URL(origin)
    validOrigin = parsed.origin === origin && parsed.protocol === 'https:' && !parsed.username && !parsed.password
  } catch { /* An absent or invalid origin must not configure production. */ }
  const configured = Boolean(key && accessCode.trim().length >= 16 && secret.trim().length >= 32 && (!production || validOrigin) && (!origin || validOrigin))
  return { production, key, accessCode, secret, model, origin: validOrigin ? origin : '', configured }
}

function allowedOrigin(req, config) {
  const origin = header(req, 'origin')
  if (!origin) return false
  if (config.origin && origin === config.origin) return true
  if (config.production) return false
  try {
    const url = new URL(origin)
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.host === header(req, 'host')
  } catch {
    return false
  }
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function readSession(req, config, time) {
  if (!config.configured) return null
  const cookies = header(req, 'cookie').split(';').map(value => value.trim()).filter(value => value.startsWith(`${COOKIE_NAME}=`))
  if (cookies.length !== 1) return null
  const token = cookies[0].slice(COOKIE_NAME.length + 1)
  if (token.length > 1024) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1]) || !secureEqual(sign(parts[0], config.secret), parts[1])) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    if (payload.v !== 1 || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.iat > time + 30_000 || payload.exp <= time || payload.exp - payload.iat !== SESSION_SECONDS * 1000 || typeof payload.sid !== 'string' || !/^[a-f0-9]{32}$/.test(payload.sid)) return null
    return payload
  } catch {
    return null
  }
}

function cookie(token, config, maxAge) {
  return `${COOKIE_NAME}=${token}; Path=/api/ai; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.production ? '; Secure' : ''}`
}

function send(res, status, value) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(value))
}

async function readBody(req) {
  const declaredLength = header(req, 'content-length')
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) throw new AIError(413, 'BODY_TOO_LARGE', 'La solicitud supera el tamaño permitido.')
  let raw
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8')
    else if (typeof req.body === 'string') raw = req.body
    else raw = JSON.stringify(req.body)
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new AIError(413, 'BODY_TOO_LARGE', 'La solicitud supera el tamaño permitido.')
  } else {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > MAX_BODY_BYTES) throw new AIError(413, 'BODY_TOO_LARGE', 'La solicitud supera el tamaño permitido.')
      chunks.push(bytes)
    }
    raw = Buffer.concat(chunks).toString('utf8')
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed
  } catch {
    throw new AIError(400, 'INVALID_JSON', 'La solicitud debe contener un objeto JSON válido.')
  }
}

async function responseJSON(response) {
  if (Number(response.headers?.get('content-length')) > MAX_RESPONSE_BYTES) throw new AIError(502, 'INVALID_AI_RESPONSE', 'La respuesta de Claude superó el tamaño permitido.')
  let raw
  if (response.body?.getReader) {
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel()
          throw new AIError(502, 'INVALID_AI_RESPONSE', 'La respuesta de Claude superó el tamaño permitido.')
        }
        chunks.push(Buffer.from(value))
      }
    } finally {
      reader.releaseLock()
    }
    raw = Buffer.concat(chunks).toString('utf8')
  } else {
    raw = await response.text()
    if (Buffer.byteLength(raw) > MAX_RESPONSE_BYTES) throw new AIError(502, 'INVALID_AI_RESPONSE', 'La respuesta de Claude superó el tamaño permitido.')
  }
  try { return JSON.parse(raw) } catch { throw new AIError(502, 'INVALID_AI_RESPONSE', 'Claude devolvió una respuesta que no se pudo leer.') }
}

async function askClaude(config, fetchImpl, request) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.model, ...request }),
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response.ok) {
      await response.body?.cancel?.()
      if (response.status === 429 || response.status === 529) throw new AIError(503, 'AI_BUSY', 'Claude está ocupado. Inténtalo de nuevo más tarde.')
      throw new AIError(502, 'AI_UNAVAILABLE', 'No fue posible completar la solicitud con Claude. Revisa la configuración del servicio o inténtalo más tarde.')
    }
    const result = await responseJSON(response)
    if (result?.stop_reason === 'max_tokens') throw new AIError(422, 'AI_RESPONSE_TRUNCATED', 'La respuesta quedó incompleta. Reduce el alcance o divide el documento; no se importó ningún dato.')
    if (result?.stop_reason === 'refusal' || result?.content?.some?.(block => block.type === 'refusal')) throw new AIError(422, 'AI_REFUSED', 'Claude no pudo procesar esta solicitud. Reformula la pregunta o revisa el documento.')
    if (result?.stop_reason !== 'end_turn' || !Array.isArray(result.content)) throw new AIError(502, 'INVALID_AI_RESPONSE', 'Claude no terminó la respuesta de forma verificable.')
    const blocks = result.content.filter(block => block.type === 'text')
    if (blocks.length !== 1 || typeof blocks[0].text !== 'string') throw new AIError(502, 'INVALID_AI_RESPONSE', 'Claude devolvió un formato inesperado.')
    let output
    try { output = JSON.parse(blocks[0].text) } catch { throw new AIError(502, 'INVALID_AI_RESPONSE', 'Claude devolvió datos que no se pudieron leer.') }
    const usage = {
      inputTokens: Number.isSafeInteger(result.usage?.input_tokens) && result.usage.input_tokens >= 0 ? result.usage.input_tokens : null,
      outputTokens: Number.isSafeInteger(result.usage?.output_tokens) && result.usage.output_tokens >= 0 ? result.usage.output_tokens : null,
    }
    return { output, usage }
  } catch (error) {
    if (error instanceof AIError) throw error
    if (controller.signal.aborted) throw new AIError(504, 'AI_TIMEOUT', 'Claude tardó demasiado. La solicitud no se reintentó automáticamente; puedes intentarlo de nuevo.')
    throw new AIError(502, 'AI_UNAVAILABLE', 'No se pudo conectar con Claude. Inténtalo más tarde.')
  } finally {
    clearTimeout(timeout)
  }
}

export function createAIHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  // These are bounded, per-instance safeguards. They are NOT durable quotas or
  // cross-instance billing/authorization, and never trust browser plan flags.
  const buckets = new Map()
  const activeSessions = new Set()
  let inFlight = 0
  function take(key, maximum, windowMs) {
    const time = now()
    for (const [entryKey, entry] of buckets) if (entry.resetAt <= time) buckets.delete(entryKey)
    let entry = buckets.get(key)
    if (!entry) {
      if (buckets.size >= 2000) throw new AIError(429, 'RATE_LIMITED', 'El servicio alcanzó su límite temporal. Inténtalo más tarde.')
      entry = { count: 0, resetAt: time + windowMs }
      buckets.set(key, entry)
    }
    if (entry.count >= maximum) throw new AIError(429, 'RATE_LIMITED', 'Alcanzaste el límite temporal de solicitudes. Inténtalo más tarde.')
    entry.count += 1
  }

  return async function handleAI(req, res) {
    const config = settings(env)
    const session = readSession(req, config, now())
    const status = authenticated => ({ configured: config.configured, authenticated, capabilities: { chat: config.configured, pdf: config.configured }, limits: LIMITS, model: config.model })
    try {
      if (req.method === 'GET') return send(res, 200, status(Boolean(session)))
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST')
        throw new AIError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.')
      }
      if (!allowedOrigin(req, config)) throw new AIError(403, 'ORIGIN_DENIED', 'El origen de la solicitud no está autorizado.')
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(header(req, 'content-type'))) throw new AIError(415, 'JSON_REQUIRED', 'Envía la solicitud como application/json.')
      const input = await readBody(req)
      if (input.action === 'disconnect') {
        onlyKeys(input, ['action'])
        res.setHeader('Set-Cookie', cookie('', config, 0))
        return send(res, 200, status(false))
      }
      if (!config.configured) throw new AIError(503, 'AI_NOT_CONFIGURED', 'Claude aún no está configurado en el servidor.')
      if (input.action === 'connect') {
        onlyKeys(input, ['action', 'accessCode'])
        take(`connect:${req.socket?.remoteAddress || 'shared'}`, 5, 15 * 60_000)
        if (typeof input.accessCode !== 'string' || input.accessCode.length > 256 || !secureEqual(input.accessCode, config.accessCode)) throw new AIError(401, 'INVALID_ACCESS_CODE', 'El código de acceso no es válido.')
        const issued = now()
        const payload = Buffer.from(JSON.stringify({ v: 1, iat: issued, exp: issued + SESSION_SECONDS * 1000, sid: randomBytes(16).toString('hex') })).toString('base64url')
        res.setHeader('Set-Cookie', cookie(`${payload}.${sign(payload, config.secret)}`, config, SESSION_SECONDS))
        return send(res, 200, status(true))
      }
      if (!session) throw new AIError(401, 'AI_AUTH_REQUIRED', 'Conecta tu acceso a Claude para continuar.')
      if (!['chat', 'analyze'].includes(input.action)) throw new AIError(400, 'INVALID_ACTION', 'La acción solicitada no existe.')
      const data = input.action === 'chat' ? validateChat(input) : validatePDF(input)
      if (inFlight >= 2 || activeSessions.has(session.sid)) throw new AIError(429, 'AI_IN_FLIGHT', 'Espera a que termine la solicitud en curso.')
      take(`session:${session.sid}`, 10, 60_000)
      take('paid:instance', 60, 60 * 60_000)
      inFlight += 1
      activeSessions.add(session.sid)
      try {
        if (input.action === 'chat') {
          const result = await askClaude(config, fetchImpl, {
            max_tokens: 2200,
            system: CHAT_SYSTEM,
            messages: [{ role: 'user', content: JSON.stringify({ question: data.question, history: data.history, context: data.context }) }],
            output_config: { format: { type: 'json_schema', schema: CHAT_SCHEMA } },
          })
          return send(res, 200, { ...validateChatResponse(result.output, data.context), model: config.model, usage: result.usage, contextAsOf: data.context.generatedAt, promptVersion: PROMPT_VERSION })
        }
        const result = await askClaude(config, fetchImpl, {
          max_tokens: 16_000,
          system: STATEMENT_SYSTEM,
          messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data.base64 } }, { type: 'text', text: 'Extrae el estado de cuenta completo, con un máximo de 150 movimientos. Si no puedes revisar el documento completo, marca coverage.complete=false.' }] }],
          output_config: { format: { type: 'json_schema', schema: STATEMENT_SCHEMA } },
        })
        return send(res, 200, { ...validateStatementResponse(result.output), file: { name: data.name, sha256: data.sha256 }, model: config.model, usage: result.usage, promptVersion: PROMPT_VERSION })
      } finally {
        inFlight -= 1
        activeSessions.delete(session.sid)
      }
    } catch (error) {
      const safe = error instanceof AIError ? error : new AIError(500, 'AI_INTERNAL_ERROR', 'No se pudo procesar la solicitud. Inténtalo más tarde.')
      if (safe.status === 429) res.setHeader('Retry-After', '60')
      return send(res, safe.status, { error: { code: safe.code, message: safe.message } })
    }
  }
}

export default createAIHandler()
