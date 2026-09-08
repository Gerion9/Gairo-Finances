export const LIMITS = Object.freeze({ maxPdfBytes: 3_000_000, maxRows: 150 })
export const MAX_BODY_BYTES = 4_200_000
export const PROMPT_VERSION = 'finance-assistant-v1'
export const CURRENCIES = ['MXN', 'USD', 'UNKNOWN']

export class AIError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function invalid(message = 'Revisa los datos enviados e inténtalo de nuevo.') {
  throw new AIError(400, 'INVALID_REQUEST', message)
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value
}

export function text(value, max, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) invalid()
  return value
}

function numberOrNull(value) {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e15) invalid()
  return value
}

function currency(value) {
  if (!CURRENCIES.includes(value)) invalid()
  return value
}

function date(value, nullable = true) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid()
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid()
  return value
}

function timestamp(value) {
  text(value, 40)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) invalid()
  return value
}

function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid()
  return value
}

export function onlyKeys(value, allowed) {
  object(value)
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid()
  return value
}

// Rebuild every object: profiles, account identifiers and arbitrary client fields
// can never hitch a ride in the upstream request.
export function validateContext(input) {
  object(input)
  if (input.version !== 1) invalid()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text(input.reportingMonth, 7))) invalid()
  const fx = object(input.fx)
  const rate = numberOrNull(fx.rate)
  if (rate !== null && rate <= 0) invalid()
  const coverage = object(input.coverage)
  if (!Array.isArray(input.facts) || input.facts.length > 40) invalid()
  const ids = new Set()
  const facts = input.facts.map(value => {
    const fact = object(value)
    const id = text(fact.id, 80)
    if (!/^[a-zA-Z0-9._:-]+$/.test(id) || ids.has(id)) invalid()
    ids.add(id)
    return {
      id,
      label: text(fact.label, 180),
      amount: numberOrNull(fact.amount),
      currency: currency(fact.currency),
      basis: text(fact.basis, 160),
      period: text(fact.period, 80),
    }
  })
  const firstDate = date(coverage.firstDate)
  const lastDate = date(coverage.lastDate)
  if (firstDate && lastDate && firstDate > lastDate) invalid()
  return {
    version: 1,
    generatedAt: timestamp(input.generatedAt),
    reportingMonth: input.reportingMonth,
    fx: { rate, source: text(fx.source, 160), asOf: fx.asOf === null ? null : text(fx.asOf, 40) },
    facts,
    coverage: {
      transactionCount: integer(coverage.transactionCount, 0, 10_000_000),
      firstDate,
      lastDate,
    },
  }
}

export function validateChat(input) {
  onlyKeys(input, ['action', 'question', 'history', 'context', 'consent'])
  if (input.consent !== true) throw new AIError(400, 'CONSENT_REQUIRED', 'Autoriza el envío del contexto a Claude para continuar.')
  const question = text(input.question, 1500)
  const history = input.history ?? []
  if (!Array.isArray(history) || history.length > 8) invalid()
  return {
    question,
    history: history.map(value => {
      onlyKeys(value, ['role', 'content'])
      if (!['user', 'assistant'].includes(value.role)) invalid()
      return { role: value.role, content: text(value.content, 4000) }
    }),
    context: validateContext(input.context),
  }
}

const stringSchema = { type: 'string' }
const nullableStringSchema = { type: ['string', 'null'] }
const nullableNumberSchema = { type: ['number', 'null'] }
const currencySchema = { type: 'string', enum: CURRENCIES }
function schemaObject(properties) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

// Length/range constraints are enforced below rather than relying on the
// provider's supported JSON Schema subset.
export const CHAT_SCHEMA = schemaObject({
  answer: stringSchema,
  evidenceIds: { type: 'array', items: stringSchema },
})

export const STATEMENT_SCHEMA = schemaObject({
  schemaVersion: { type: 'integer', enum: [1] },
  statement: schemaObject({
    institution: nullableStringSchema,
    periodStart: nullableStringSchema,
    periodEnd: nullableStringSchema,
    currency: currencySchema,
    openingBalance: nullableNumberSchema,
    closingBalance: nullableNumberSchema,
  }),
  coverage: schemaObject({
    complete: { type: 'boolean' },
    pagesProcessed: { type: 'integer' },
    warnings: { type: 'array', items: stringSchema },
  }),
  transactions: {
    type: 'array',
    items: schemaObject({
      sourceIndex: { type: 'integer' },
      date: nullableStringSchema,
      description: stringSchema,
      amount: nullableNumberSchema,
      currency: currencySchema,
      direction: { type: 'string', enum: ['debit', 'credit', 'transfer', 'unknown'] },
      category: nullableStringSchema,
      pageNumber: { type: ['integer', 'null'] },
      sourceText: stringSchema,
      needsReview: { type: 'boolean' },
    }),
  },
})

function invalidOutput() {
  return new AIError(502, 'INVALID_AI_RESPONSE', 'Claude devolvió datos que no se pudieron verificar. No se guardó ningún movimiento.')
}

export function validateChatResponse(input, context) {
  try {
    onlyKeys(input, ['answer', 'evidenceIds'])
    const answer = text(input.answer, 12_000)
    if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length > 40) invalid()
    const knownIds = new Set(context.facts.map(fact => fact.id))
    if (input.evidenceIds.some(id => typeof id !== 'string' || !knownIds.has(id))) {
      throw new AIError(502, 'UNGROUNDED_AI_RESPONSE', 'La respuesta hace referencia a datos que no están en tu contexto. Inténtalo con una pregunta más concreta.')
    }
    return { answer, evidenceIds: [...new Set(input.evidenceIds)] }
  } catch (error) {
    if (error.code === 'UNGROUNDED_AI_RESPONSE') throw error
    throw invalidOutput()
  }
}

export function validateStatementResponse(input) {
  try {
    onlyKeys(input, ['schemaVersion', 'statement', 'coverage', 'transactions'])
    if (input.schemaVersion !== 1) invalid()
    const statement = onlyKeys(input.statement, Object.keys(STATEMENT_SCHEMA.properties.statement.properties))
    const coverage = onlyKeys(input.coverage, ['complete', 'pagesProcessed', 'warnings'])
    if (typeof coverage.complete !== 'boolean') invalid()
    if (!Array.isArray(input.transactions)) invalid()
    if (!coverage.complete || input.transactions.length > LIMITS.maxRows) {
      throw new AIError(422, 'INCOMPLETE_STATEMENT', 'El estado de cuenta no se pudo extraer completo. Divide el documento en archivos de hasta 150 movimientos y vuelve a intentarlo.')
    }
    const pagesProcessed = integer(coverage.pagesProcessed, 1, 100)
    if (!Array.isArray(coverage.warnings) || coverage.warnings.length > 30) invalid()
    const warnings = coverage.warnings.map(value => text(value, 500))
    const periodStart = date(statement.periodStart)
    const periodEnd = date(statement.periodEnd)
    if (periodStart && periodEnd && periodStart > periodEnd) invalid()
    const sourceIndexes = new Set()
    const transactions = input.transactions.map(value => {
      onlyKeys(value, Object.keys(STATEMENT_SCHEMA.properties.transactions.items.properties))
      const sourceIndex = integer(value.sourceIndex, 0, 10_000)
      if (sourceIndexes.has(sourceIndex)) invalid()
      sourceIndexes.add(sourceIndex)
      if (!['debit', 'credit', 'transfer', 'unknown'].includes(value.direction) || typeof value.needsReview !== 'boolean') invalid()
      const transactionDate = date(value.date)
      const amount = numberOrNull(value.amount)
      if (amount !== null && amount < 0) invalid()
      const transactionCurrency = currency(value.currency)
      const pageNumber = value.pageNumber === null ? null : integer(value.pageNumber, 1, pagesProcessed)
      const sourceText = text(value.sourceText, 1200, true)
      return {
        sourceIndex,
        date: transactionDate,
        description: text(value.description, 500),
        amount,
        currency: transactionCurrency,
        direction: value.direction,
        category: value.category === null ? null : text(value.category, 100),
        pageNumber,
        sourceText,
        needsReview: value.needsReview || transactionDate === null || amount === null || transactionCurrency === 'UNKNOWN' || value.direction === 'unknown' || pageNumber === null || !sourceText.trim() || Boolean(periodStart && transactionDate && transactionDate < periodStart) || Boolean(periodEnd && transactionDate && transactionDate > periodEnd),
      }
    })
    return {
      schemaVersion: 1,
      statement: {
        institution: statement.institution === null ? null : text(statement.institution, 200),
        periodStart,
        periodEnd,
        currency: currency(statement.currency),
        openingBalance: numberOrNull(statement.openingBalance),
        closingBalance: numberOrNull(statement.closingBalance),
      },
      coverage: { complete: true, pagesProcessed, warnings },
      transactions,
    }
  } catch (error) {
    if (error.code === 'INCOMPLETE_STATEMENT') throw error
    throw invalidOutput()
  }
}
