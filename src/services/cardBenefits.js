export const BENEFIT_CATEGORY_IDS = Object.freeze(['pharmacies', 'restaurants', 'telecom', 'groceries', 'fuel', 'travel', 'education', 'other']);
export const BENEFIT_REASON_LABELS = Object.freeze({
  'invalid-programs': 'No se pudieron leer las reglas de beneficios.',
  'invalid-context': 'Revisa los datos de la compra.',
  'invalid-as-of': 'Falta una fecha válida para evaluar las reglas.',
  'invalid-owned-card-ids': 'Selecciona tarjetas con identificadores válidos y sin duplicados.',
  'invalid-amount': 'Introduce un importe positivo en centavos enteros.',
  'invalid-currency': 'Esta comparación sólo admite compras en MXN.',
  'invalid-purchase-date': 'Introduce una fecha de compra válida.',
  'invalid-category': 'Selecciona una categoría disponible.',
  'invalid-merchant': 'Revisa el comercio seleccionado.',
  'invalid-channel': 'Selecciona un canal de compra válido.',
  'invalid-payment-mode': 'Selecciona una modalidad de pago válida.',
  'invalid-pay-in-full': 'Indica si pagarás el total de la tarjeta.',
  'missing-rule': 'No hay una regla documentada para calcular esta tarjeta.',
  'missing-source': 'Falta una fuente válida para respaldar la regla.',
  'malformed-program': 'La regla contiene datos incompletos o incompatibles.',
  'incomplete-evidence': 'La información del beneficio está incompleta.',
  'evidence-conflict': 'Las fuentes o reglas del beneficio tienen un conflicto pendiente.',
  'stale-review': 'La revisión de esta regla necesita actualizarse.',
  'future-review': 'La fecha de revisión es posterior a la evaluación.',
  'outside-validity': 'La compra o evaluación queda fuera de la vigencia publicada.',
  'date-scope-unverified': 'La fuente no confirma la vigencia para esa fecha de compra.',
  'condition-required': 'Falta confirmar una condición del beneficio.',
  'condition-not-met': 'No se cumple una condición del beneficio.',
  'excluded-category': 'La categoría está excluida de este beneficio.',
  'excluded-merchant': 'El comercio no participa en este beneficio.',
  'merchant-required': 'Confirma el comercio para verificar que participa.',
  'channel-required': 'Confirma el canal de compra.',
  'payment-mode-required': 'Confirma la modalidad de pago.',
  'unsupported-channel': 'Este canal de compra no participa.',
  'unsupported-payment-mode': 'Esta modalidad de pago no participa.',
  'missing-category-rule': 'No hay un porcentaje documentado para esta categoría.',
  'ambiguous-rate': 'Coincide más de una regla de porcentaje; falta aclarar cuál aplica.',
  'unsupported-calculation': 'La mecánica publicada requiere un cálculo que todavía no está disponible.',
  'unsupported-reward-unit': 'Este beneficio no puede calcularse como un porcentaje en MXN.',
  'cap-unknown': 'Falta confirmar cuánto tope queda disponible.',
  'cap-period-required': 'Confirma el periodo del tope correspondiente a esta compra.',
  'cap-invalid': 'Revisa el importe disponible y las fechas del tope.',
  'rounding-estimate': 'El emisor puede aplicar un redondeo distinto al estimado.',
  'non-cash-reward': 'Este beneficio se muestra por separado: no es efectivo equivalente.',
  'redemption-cost-unknown': 'No están confirmados los costos para recibir el efectivo.',
  'non-ongoing-benefit': 'Este beneficio temporal o de bienvenida no participa en la comparación regular.',
  'overlapping-programs': 'Hay varios programas posibles en esta tarjeta; no se asume que sus beneficios se suman.',
  'pay-in-full-required': 'La comparación requiere pagar el total; los intereses podrían superar el beneficio.',
  'insufficient-comparable-cards': 'Se necesitan al menos dos tarjetas con beneficios comparables y datos completos.',
  'no-positive-benefit': 'Las reglas comparables no generan un beneficio positivo para esta compra.',
  'highest-estimated-cashback': 'Mayor devolución estimada en efectivo entre las tarjetas comparables.',
  'equal-estimated-cashback': 'Las tarjetas indicadas tienen la misma devolución estimada al centavo.',
});

const CHANNELS = ['in-person', 'online-direct', 'aggregator'];
const MODES = ['single', 'installments'];
const ANSWERS = ['yes', 'no', 'unknown'];
const REWARDS = ['cash', 'statement-credit', 'store-credit', 'points'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const minor = value => Number.isSafeInteger(value) && value >= 0;
const bps = value => Number.isInteger(value) && value >= 0 && value <= 10000;
const list = value => Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const subset = (value, allowed) => list(value) && value.every(item => allowed.includes(item));
const reason = (code, details = {}) => ({ code, ...details });

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function sourcesOf(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const sources = [];
  for (const source of value) {
    if (!record(source) || !text(source.title) || !text(source.url)) return null;
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
      sources.push({ title: source.title, url: source.url });
    } catch { return null; }
  }
  return sources;
}

function blankResult(cardId, program = null) {
  return { cardId, programId: text(program?.id) ? program.id : null, status: 'descriptive', rewardType: REWARDS.includes(program?.reward?.type) ? program.reward.type : null, amountMinor: null, maximumMinor: null, rateBps: null, rankable: false, reasons: [], assumptions: [], sources: [] };
}
function stop(result, status, code, details) {
  result.status = status;
  result.reasons.push(reason(code, details));
  return result;
}

function contextErrors(context, asOf) {
  const errors = [];
  if (!isoDate(asOf)) errors.push(reason('invalid-as-of'));
  if (!record(context)) return [...errors, reason('invalid-context')];
  if (!list(context.ownedCardIds)) errors.push(reason('invalid-owned-card-ids'));
  if (!minor(context.amountMinor) || context.amountMinor === 0) errors.push(reason('invalid-amount'));
  if (context.currency !== 'MXN') errors.push(reason('invalid-currency'));
  if (!isoDate(context.purchaseDate)) errors.push(reason('invalid-purchase-date'));
  if (!BENEFIT_CATEGORY_IDS.includes(context.categoryId)) errors.push(reason('invalid-category'));
  if (context.merchantId !== null && !text(context.merchantId)) errors.push(reason('invalid-merchant'));
  if (![...CHANNELS, 'unknown'].includes(context.channel)) errors.push(reason('invalid-channel'));
  if (![...MODES, 'unknown'].includes(context.paymentMode)) errors.push(reason('invalid-payment-mode'));
  if (!ANSWERS.includes(context.payInFull)) errors.push(reason('invalid-pay-in-full'));
  return errors;
}

function calculationSupported(calculation) {
  if (!record(calculation) || calculation.type !== 'percent') return false;
  const keys = ['type', 'defaultRateBps', 'rates', 'channels', 'paymentModes', 'eligibleMerchantIds', 'excludedMerchantIds', 'excludedCategoryIds', 'cap', 'rounding'];
  if (Object.keys(calculation).some(key => !keys.includes(key))) return false;
  if (calculation.defaultRateBps !== null && !bps(calculation.defaultRateBps)) return false;
  if (!Array.isArray(calculation.rates) || calculation.rates.some(rate => !record(rate) || Object.keys(rate).some(key => !['categoryIds', 'rateBps'].includes(key)) || !subset(rate.categoryIds, BENEFIT_CATEGORY_IDS) || !rate.categoryIds.length || !bps(rate.rateBps))) return false;
  if (!subset(calculation.channels, CHANNELS) || !calculation.channels.length || !subset(calculation.paymentModes, MODES) || !calculation.paymentModes.length) return false;
  if (calculation.eligibleMerchantIds != null && !list(calculation.eligibleMerchantIds)) return false;
  if (calculation.excludedMerchantIds !== undefined && !list(calculation.excludedMerchantIds)) return false;
  if (calculation.excludedCategoryIds !== undefined && !subset(calculation.excludedCategoryIds, BENEFIT_CATEGORY_IDS)) return false;
  if (!['floor-cent', 'half-up-cent', 'unknown'].includes(calculation.rounding)) return false;
  const cap = calculation.cap;
  if (cap !== null && (!record(cap) || !text(cap.id) || !['reward', 'spend'].includes(cap.unit) || !minor(cap.limitMinor) || !['calendar-month', 'statement'].includes(cap.period) || !text(cap.scopeLabel) || cap.afterCapRateBps !== 0)) return false;
  return true;
}

function percentage(amount, rate, rounding) {
  const numerator = BigInt(amount) * BigInt(rate);
  return Number((numerator + (rounding === 'floor-cent' ? 0n : 5000n)) / 10000n);
}
function cappedAmount(amount, rate, calculation, remaining = calculation.cap?.limitMinor) {
  if (!calculation.cap) return percentage(amount, rate, calculation.rounding);
  return calculation.cap.unit === 'spend'
    ? percentage(Math.min(amount, remaining), rate, calculation.rounding)
    : Math.min(percentage(amount, rate, calculation.rounding), remaining);
}

function capState(cap, context) {
  const supplied = record(context.caps) ? context.caps[cap.id] : undefined;
  if (supplied === undefined || supplied === null || record(supplied) && supplied.state === 'unknown') return { code: 'cap-unknown' };
  if (!record(supplied) || !['full', 'remaining'].includes(supplied.state)) return { code: 'cap-invalid' };
  if (supplied.periodStart == null || supplied.periodEnd == null) return { code: 'cap-period-required' };
  if (!isoDate(supplied.periodStart) || !isoDate(supplied.periodEnd) || supplied.periodStart > supplied.periodEnd) return { code: 'cap-invalid' };
  if (supplied.periodStart > context.purchaseDate || supplied.periodEnd < context.purchaseDate) return { code: 'cap-period-required' };
  if (cap.period === 'calendar-month') {
    const first = `${context.purchaseDate.slice(0, 7)}-01`;
    const end = new Date(`${first}T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
    if (supplied.periodStart !== first || supplied.periodEnd !== end.toISOString().slice(0, 10)) return { code: 'cap-period-required' };
  }
  if (supplied.state === 'full') return { remaining: cap.limitMinor };
  if (!minor(supplied.remainingMinor) || supplied.remainingMinor > cap.limitMinor) return { code: 'cap-invalid' };
  return { remaining: supplied.remainingMinor };
}

function evaluateProgram(program, context, asOf, duplicateIds) {
  const result = blankResult(program.cardId, program);
  const unknownReward = program.status === 'incomplete' && program.calculation === null && program.reward?.type === 'unknown' && program.reward?.unit === 'unknown';
  if (!text(program.id) || !text(program.name) || !text(program.summary) || !['verified', 'conflict', 'incomplete'].includes(program.status) || !['ongoing', 'temporary', 'welcome'].includes(program.kind) || !record(program.reward) || !REWARDS.includes(program.reward.type) && !unknownReward || !text(program.reward.redemptionSummary) || !['none', 'unknown'].includes(program.reward.redemptionCosts)) return stop(result, 'descriptive', 'malformed-program');
  const sources = sourcesOf(program.sources);
  if (!sources) return stop(result, 'descriptive', 'missing-source');
  result.sources = sources;
  if (duplicateIds.has(program.id) || program.status === 'conflict') return stop(result, 'conflict', 'evidence-conflict');
  if (program.status === 'incomplete') return stop(result, 'descriptive', 'incomplete-evidence');
  if (!isoDate(program.reviewedOn) || program.validFrom != null && !isoDate(program.validFrom) || program.validThrough != null && !isoDate(program.validThrough) || program.reviewDueOn != null && !isoDate(program.reviewDueOn) || program.validFrom != null && program.validThrough != null && program.validFrom > program.validThrough || program.reviewDueOn != null && program.reviewDueOn < program.reviewedOn) return stop(result, 'conflict', 'malformed-program');
  if (program.reviewedOn > asOf) return stop(result, 'needs-confirmation', 'future-review');
  if (program.validThrough != null && (program.validThrough < asOf || program.validThrough < context.purchaseDate)) return stop(result, 'expired', 'outside-validity');
  if (program.validFrom != null && context.purchaseDate < program.validFrom) return stop(result, 'ineligible', 'outside-validity');
  if (asOf > (program.reviewDueOn ?? program.reviewedOn)) return stop(result, 'needs-confirmation', 'stale-review');
  if (program.kind !== 'ongoing' && (program.validFrom == null || program.validThrough == null) || program.validThrough == null && context.purchaseDate !== asOf || program.validFrom == null && context.purchaseDate < program.reviewedOn) return stop(result, 'needs-confirmation', 'date-scope-unverified');
  if (context.purchaseDate > asOf && (program.validFrom == null || program.validThrough == null)) return stop(result, 'needs-confirmation', 'date-scope-unverified');
  if (context.purchaseDate > asOf) result.assumptions.push('Compra futura dentro de la vigencia publicada; condiciones y tope corresponden al periodo de esa compra.');
  if (!Array.isArray(program.conditions) || program.conditions.some(condition => !record(condition) || !text(condition.id) || !text(condition.label)) || new Set(program.conditions.map(condition => condition.id)).size !== program.conditions.length) return stop(result, 'descriptive', 'malformed-program');
  const answers = record(context.conditions) && record(context.conditions[program.id]) ? context.conditions[program.id] : {};
  const unmet = program.conditions.filter(condition => answers[condition.id] === 'no');
  if (unmet.length) { result.status = 'ineligible'; result.reasons = unmet.map(condition => reason('condition-not-met', { conditionId: condition.id })); return result; }
  const unknown = program.conditions.filter(condition => answers[condition.id] !== 'yes');
  if (unknown.length) { result.status = 'needs-confirmation'; result.reasons = unknown.map(condition => reason('condition-required', { conditionId: condition.id })); return result; }
  if (!calculationSupported(program.calculation)) return stop(result, 'descriptive', 'unsupported-calculation');
  const calculation = program.calculation;
  if (program.reward.unit !== 'MXN' || program.reward.type === 'points') return stop(result, 'descriptive', 'unsupported-reward-unit');
  if ((calculation.excludedCategoryIds || []).includes(context.categoryId)) return stop(result, 'ineligible', 'excluded-category');
  const eligibleMerchants = calculation.eligibleMerchantIds ?? null;
  const excludedMerchants = calculation.excludedMerchantIds || [];
  if (eligibleMerchants !== null && !eligibleMerchants.length) return stop(result, 'ineligible', 'excluded-merchant');
  if ((eligibleMerchants !== null || excludedMerchants.length) && context.merchantId === null) return stop(result, 'needs-confirmation', 'merchant-required');
  if (excludedMerchants.includes(context.merchantId) || eligibleMerchants !== null && !eligibleMerchants.includes(context.merchantId)) return stop(result, 'ineligible', 'excluded-merchant');
  if (context.channel === 'unknown' && calculation.channels.length !== CHANNELS.length) return stop(result, 'needs-confirmation', 'channel-required');
  if (context.channel !== 'unknown' && !calculation.channels.includes(context.channel)) return stop(result, 'ineligible', 'unsupported-channel');
  if (context.paymentMode === 'unknown' && calculation.paymentModes.length !== MODES.length) return stop(result, 'needs-confirmation', 'payment-mode-required');
  if (context.paymentMode !== 'unknown' && !calculation.paymentModes.includes(context.paymentMode)) return stop(result, 'ineligible', 'unsupported-payment-mode');
  const rates = calculation.rates.filter(rate => rate.categoryIds.includes(context.categoryId));
  if (rates.length > 1) return stop(result, 'descriptive', 'ambiguous-rate');
  const rate = rates.length ? rates[0].rateBps : calculation.defaultRateBps;
  if (rate === null) return stop(result, 'descriptive', 'missing-category-rule');
  result.rateBps = rate;
  if (calculation.rounding === 'unknown') {
    result.assumptions.push('Cálculo porcentual; el abono del emisor puede variar por redondeo.');
    result.reasons.push(reason('rounding-estimate'));
  }
  let remaining;
  if (calculation.cap) {
    const state = capState(calculation.cap, context);
    if (state.code) {
      result.maximumMinor = cappedAmount(context.amountMinor, rate, calculation);
      return stop(result, 'up-to', state.code, { capId: calculation.cap.id });
    }
    remaining = state.remaining;
  }
  result.amountMinor = cappedAmount(context.amountMinor, rate, calculation, remaining);
  result.status = calculation.rounding === 'unknown' ? 'estimate' : 'calculated';
  if (program.reward.type !== 'cash') result.reasons.push(reason('non-cash-reward'));
  if (program.reward.redemptionCosts !== 'none') result.reasons.push(reason('redemption-cost-unknown'));
  if (program.kind !== 'ongoing') result.reasons.push(reason('non-ongoing-benefit'));
  if (context.payInFull !== 'yes') result.reasons.push(reason('pay-in-full-required'));
  result.rankable = program.reward.type === 'cash' && program.reward.redemptionCosts === 'none' && program.kind === 'ongoing' && context.payInFull === 'yes';
  return result;
}

/** Compare documented percentages only; never infer issuer approval, stacking or net financing costs. */
export function evaluateCardBenefits(programs, context, { asOf } = {}) {
  const errors = contextErrors(context, asOf);
  if (!Array.isArray(programs)) errors.push(reason('invalid-programs'));
  const recommendation = { status: 'none', basis: 'estimated-percentage', cardIds: [], evaluatedCardIds: [], excludedCardIds: [], reason: 'insufficient-comparable-cards' };
  if (errors.length) return { status: 'invalid', errors, results: [], recommendation: { ...recommendation, reason: 'invalid-context' } };
  const ids = new Set();
  const duplicateIds = new Set();
  for (const program of programs) {
    if (!text(program?.id)) continue;
    if (ids.has(program.id)) duplicateIds.add(program.id);
    ids.add(program.id);
  }
  const results = context.ownedCardIds.flatMap(cardId => {
    const matches = programs.filter(program => record(program) && program.cardId === cardId);
    if (!matches.length) return [stop(blankResult(cardId), 'descriptive', 'missing-rule')];
    const evaluated = matches.map(program => evaluateProgram(program, context, asOf, duplicateIds));
    const possible = evaluated.filter((result, index) => matches[index].reward?.type === 'cash' && matches[index].reward?.unit === 'MXN' && matches[index].kind === 'ongoing' && !['ineligible', 'expired'].includes(result.status));
    if (possible.length > 1) for (const result of possible) { result.rankable = false; result.reasons.push(reason('overlapping-programs')); }
    return evaluated;
  });
  const comparable = results.filter(result => result.rankable);
  recommendation.evaluatedCardIds = comparable.map(result => result.cardId);
  recommendation.excludedCardIds = context.ownedCardIds.filter(cardId => !recommendation.evaluatedCardIds.includes(cardId));
  if (context.payInFull !== 'yes') recommendation.reason = 'pay-in-full-required';
  else if (comparable.length > 0 && comparable.every(result => result.amountMinor === 0)) recommendation.reason = 'no-positive-benefit';
  else if (comparable.length >= 2) {
    const highest = Math.max(...comparable.map(result => result.amountMinor));
    recommendation.cardIds = comparable.filter(result => result.amountMinor === highest).map(result => result.cardId);
    recommendation.status = recommendation.cardIds.length > 1 ? 'tie' : 'winner';
    recommendation.reason = recommendation.status === 'tie' ? 'equal-estimated-cashback' : 'highest-estimated-cashback';
  }
  return { status: 'evaluated', errors: [], results, recommendation };
}
