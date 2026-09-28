// Documented balances are snapshots. Simulations never update these records.
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
export const cents = value => Math.round(Number(value) * 100);
export const money = value => Math.round(value) / 100;
const sum = values => values.reduce((a, b) => a + b, 0);
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const parseDate = value => new Date(value + 'T12:00:00Z');
export function addMonths(value, count) {
  const d = parseDate(value), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + count);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10);
}
const dayCount = (a, b) => Math.max(0, Math.round((parseDate(b) - parseDate(a)) / 86400000));
const nextDay = value => new Date(parseDate(value).getTime() + 86400000).toISOString().slice(0, 10);
function text(value, label, max = 2000) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('Revisa ' + label + '.');
  return value.trim();
}
function num(value, label, nullable = true, max = 1e9) {
  if (value == null || value === '') { if (nullable) return null; throw new Error('Falta ' + label + '.'); }
  if (!['number', 'string'].includes(typeof value)) throw new Error('Revisa ' + label + '.');
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max || !Number.isSafeInteger(cents(n))) throw new Error('Revisa ' + label + '.');
  return n;
}
function date(value, label, nullable = true) {
  if ((value == null || value === '') && nullable) return null;
  if (!validDate(value)) throw new Error('Revisa la fecha de ' + label + '.');
  return value;
}
function list(value, label, max = 100) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some(x => !isRecord(x))) throw new Error('Revisa ' + label + '.');
  return value;
}
function id(value, label) { const result = text(value, label, 100); if (!result || !/^[\w.-]+$/.test(result)) throw new Error('Identificador inválido en ' + label + '.'); return result; }
function unique(rows, label) { if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Identificadores repetidos en ' + label + '.'); return rows; }
function currency(value) { if (!['MXN', 'USD'].includes(value)) throw new Error('La moneda debe ser MXN o USD.'); return value; }
function enumValue(value, allowed, fallback) { const v = value ?? fallback; if (!allowed.includes(v)) throw new Error('Una opción del plan no es válida.'); return v; }
const flags = value => { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 40) throw new Error('Revisa las observaciones.'); return value.map(v => text(v, 'observación')); };

export function normalizePaymentPlan(value) {
  if (value == null) return null;
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.budget)) throw new Error('El plan debe ser una conciliación de Sifran, versión 1.');
  const budget = value.budget;
  const sources = unique(list(value.sources, 'fuentes').map(s => ({ id: id(s.id, 'fuente'), label: text(s.label, 'fuente', 300), fileName: text(s.fileName, 'documento', 300), date: date(s.date, 'documento'), pages: text(s.pages, 'páginas', 100), note: text(s.note, 'nota de fuente') })), 'fuentes');
  const sourceIds = new Set(sources.map(s => s.id));
  const accounts = unique(list(value.accounts, 'cuentas', 60).map(a => {
    const tranches = unique(list(a.tranches, 'tramos').map(t => ({
      id: id(t.id, 'tramo'), label: text(t.label, 'tramo', 200), balance: num(t.balance, 'saldo de tramo', false), apr: num(t.apr, 'tasa del tramo', true, 1000),
      type: enumValue(t.type, ['REVOLVING', 'INSTALLMENT', 'PROMO', 'DEFERRED', 'LOAN', 'UNKNOWN'], 'UNKNOWN'),
      monthlyPayment: num(t.monthlyPayment, 'cuota del tramo'), paymentsRemaining: num(t.paymentsRemaining, 'cuotas restantes', true, 1000),
      promoEnd: date(t.promoEnd, 'fin de promoción'), postApr: num(t.postApr, 'tasa posterior', true, 1000),
      deferredAccrued: num(t.deferredAccrued, 'interés diferido'), accruedAsOf: date(t.accruedAsOf, 'interés diferido'),
      dayBasis: t.dayBasis === 360 ? 360 : 365, note: text(t.note, 'nota del tramo'),
    })), 'tramos');
    const balance = num(a.balance, 'saldo de cuenta', false);
    if (Math.abs(sum(tranches.map(t => cents(t.balance))) - cents(balance)) > 1) throw new Error('Los tramos no concilian con el saldo de ' + a.name + '.');
    if (a.sourceId && !sourceIds.has(a.sourceId)) throw new Error('Falta la fuente de ' + a.name + '.');
    const result = {
      id: id(a.id, 'cuenta'), name: text(a.name, 'nombre de cuenta', 200), institution: text(a.institution, 'institución', 200), currency: currency(a.currency),
      kind: enumValue(a.kind, ['CARD', 'LOAN'], 'CARD'), balance, balanceDate: date(a.balanceDate, 'saldo', false),
      balanceBasis: enumValue(a.balanceBasis, ['STATEMENT', 'DECLARED', 'RECONCILED'], 'STATEMENT'),
      statementBalance: num(a.statementBalance, 'saldo al corte'), minimum: num(a.minimum, 'pago mínimo'), requiredPayment: num(a.requiredPayment, 'mínimo con cuotas'),
      minimumIncludesInstallments: typeof a.minimumIncludesInstallments === 'boolean' ? a.minimumIncludesInstallments : null,
      paymentToAvoidInterest: num(a.paymentToAvoidInterest, 'pago sin intereses'), reportedPayment: num(a.reportedPayment, 'pago declarado'),
      currentInstallments: num(a.currentInstallments, 'mensualidades del periodo'), futureInstallments: num(a.futureInstallments, 'mensualidades futuras'),
      dueDate: date(a.dueDate, 'vencimiento'), closingDate: date(a.closingDate, 'corte'), ordinaryApr: num(a.ordinaryApr, 'tasa ordinaria', true, 1000),
      autopayAmount: num(a.autopayAmount, 'domiciliación'), autopayDate: date(a.autopayDate, 'domiciliación'),
      lastInterest: num(a.lastInterest, 'intereses del corte'), lastFees: num(a.lastFees, 'comisiones del corte'),
      sourceId: text(a.sourceId, 'referencia', 100), note: text(a.note, 'nota de cuenta', 4000), issues: flags(a.issues), tranches,
    };
    if (!result.name) throw new Error('Falta el nombre de una cuenta.');
    return result;
  }), 'cuentas');
  const assets = unique(list(value.assets, 'ahorros', 30).map(a => ({ id: id(a.id, 'ahorro'), name: text(a.name, 'ahorro', 200), currency: currency(a.currency), balance: num(a.balance, 'ahorro', false), balanceDate: date(a.balanceDate, 'ahorro', false), reserved: num(a.reserved, 'apartado') ?? 0, annualRate: num(a.annualRate, 'rendimiento', true, 1000), rateCap: num(a.rateCap, 'tope de rendimiento'), excessRate: num(a.excessRate, 'rendimiento del excedente', true, 1000), note: text(a.note, 'condiciones de ahorro') })), 'ahorros');
  if (assets.some(a => a.reserved > a.balance)) throw new Error('Un apartado supera el saldo de ahorro.');
  const settings = isRecord(value.settings) ? value.settings : {};
  const result = {
    version: 1, asOf: date(value.asOf, 'conciliación', false), sources, accounts, assets, notes: flags(value.notes),
    budget: {
      monthlyIncome: num(budget.monthlyIncome, 'ingreso mensual', false), monthlyTax: num(budget.monthlyTax, 'impuestos mensuales', false),
      livingExpenses: num(budget.livingExpenses, 'gastos de vida'), payday: num(budget.payday, 'día de ingreso', true, 31), taxDay: num(budget.taxDay, 'día de impuestos', true, 31),
      expenses: unique(list(budget.expenses, 'categorías del presupuesto', 40).map(e => ({ id: id(e.id, 'categoría'), name: text(e.name, 'categoría', 120), amount: num(e.amount, 'presupuesto de ' + e.name), basis: enumValue(e.basis, ['DECLARED', 'ESTIMATE', 'BUDGET'], 'BUDGET'), note: text(e.note, 'categoría') })), 'categorías del presupuesto'),
      tuitionPayments: list(budget.tuitionPayments, 'pagos de maestría', 100).map(p => ({ date: date(p.date, 'pago de maestría', false), amount: num(p.amount, 'pago de maestría', false) })),
      quarterlyTuition: num(budget.quarterlyTuition, 'costo del periodo'), tuitionPaymentCount: num(budget.tuitionPaymentCount ?? 3, 'pagos del periodo', false, 12), tuitionProvisionStart: date(budget.tuitionProvisionStart, 'inicio de provisión'),
      nextQuarterDue: date(budget.nextQuarterDue, 'pago del siguiente trimestre'), tuitionNote: text(budget.tuitionNote, 'maestría'),
    },
    settings: { fx: num(settings.fx, 'tipo de cambio', true, 1000), monthlyDebtBudget: num(settings.monthlyDebtBudget, 'presupuesto de deuda'), horizon: num(settings.horizon ?? 24, 'horizonte', false, 120), strategy: enumValue(settings.strategy, ['AVALANCHE', 'PROMO_FIRST', 'MINIMUMS'], 'AVALANCHE'), remittanceFeeUSD: num(settings.remittanceFeeUSD, 'comisión de envío'), receiverFeeUSD: num(settings.receiverFeeUSD, 'comisión receptora'), interestTaxPercentMXN: num(settings.interestTaxPercentMXN, 'IVA estimado de intereses', true, 100) },
    scenario: normalizeScenario(value.scenario),
    quotes: list(value.quotes, 'cotizaciones', 30).map(q => ({ id: id(q.id, 'cotización'), provider: text(q.provider, 'proveedor', 100), debitMXN: num(q.debitMXN, 'pesos debitados'), netUSD: num(q.netUSD, 'dólares netos'), allCostsIncluded: q.allCostsIncluded === true, eligible: q.eligible === true, quotedAt: text(q.quotedAt, 'fecha de cotización', 40), expiresAt: text(q.expiresAt, 'vigencia', 40), arrivalDate: date(q.arrivalDate, 'llegada'), note: text(q.note, 'cotización') })),
    offers: { plata: { annualRate: 15, cap: 25000, excessRate: 9, confirmed: value.offers?.plata?.confirmed === true, note: text(value.offers?.plata?.note, 'oferta Plata') }, discover: { maximum: 4500, months: 10, feePercent: 5, note: text(value.offers?.discover?.note, 'oferta Discover') } },
  };
  if (result.budget.expenses.some(e => !e.name)) throw new Error('Falta el nombre de una categoría del presupuesto.');
  if (result.budget.expenses.length) result.budget.livingExpenses = livingBudgetSummary(result).total;
  if (!Number.isInteger(result.settings.horizon) || result.settings.horizon < 1 || result.settings.fx === 0) throw new Error('Revisa horizonte y tipo de cambio.');
  if (!Number.isInteger(result.budget.tuitionPaymentCount) || result.budget.tuitionPaymentCount < 1) throw new Error('Revisa el número de pagos de la maestría.');
  for (const d of [result.budget.payday, result.budget.taxDay]) if (d !== null && (!Number.isInteger(d) || d < 1)) throw new Error('El día del mes debe ser entero entre 1 y 31.');
  return result;
}

export function normalizeScenario(value = {}) {
  if (!isRecord(value)) throw new Error('Revisa el escenario.');
  const raise = value.raise || {}, bonus = value.bonus || {}, transfer = value.transfer || {};
  return {
    raise: { enabled: raise.enabled === true, amount: num(raise.amount, 'aumento') ?? 0, date: date(raise.date, 'aumento') },
    bonus: { enabled: bonus.enabled === true, amount: num(bonus.amount, 'bono') ?? 0, date: date(bonus.date, 'bono') },
    useSavings: value.useSavings === true, savingsAmount: num(value.savingsAmount, 'abono desde ahorros') ?? 0,
    transfer: { enabled: transfer.enabled === true, sourceId: text(transfer.sourceId, 'origen', 100), amount: num(transfer.amount, 'transferencia') ?? 0, date: date(transfer.date, 'transferencia'), limitIncludesFee: transfer.limitIncludesFee !== false, feeAtZero: transfer.feeAtZero === true, postApr: num(transfer.postApr, 'APR posterior de transferencia', true, 1000) },
    rateOverrides: list(value.rateOverrides, 'supuestos de tasas', 100).map(r => ({ accountId: text(r.accountId, 'cuenta', 100), trancheId: text(r.trancheId, 'tramo', 100), apr: num(r.apr, 'APR hipotética', true, 1000), promoEnd: date(r.promoEnd, 'fin hipotético'), postApr: num(r.postApr, 'APR posterior hipotética', true, 1000) })),
  };
}

export function planTotals(plan) {
  const result = { debts: { MXN: 0, USD: 0 }, assets: { MXN: 0, USD: 0 } };
  for (const a of plan.accounts) result.debts[a.currency] += cents(a.balance);
  for (const a of plan.assets) result.assets[a.currency] += cents(a.balance);
  for (const group of Object.values(result)) for (const c of Object.keys(group)) group[c] = money(group[c]);
  return result;
}

export function livingBudgetSummary(plan) {
  const rows = plan.budget.expenses || [];
  if (!rows.length) return { known: plan.budget.livingExpenses ?? 0, total: plan.budget.livingExpenses, missing: plan.budget.livingExpenses === null ? ['Gastos de vida'] : [] };
  const known = money(sum(rows.map(e => cents(e.amount || 0))));
  const missing = rows.filter(e => e.amount === null).map(e => e.name);
  return { known, total: missing.length ? null : known, missing };
}

// Import is explicit and reviewable; account records remain synchronized adapters.
export function applyPaymentPlan(data, input) {
  const plan = normalizePaymentPlan(input);
  if (!plan) throw new Error('Falta la conciliación.');
  const deudasPendientes = plan.accounts.map(a => ({
    id: a.id, nombre: a.name, institucion: a.institution, moneda: a.currency, clase: a.kind === 'LOAN' ? 'PRESTAMOS_ESTUDIANTILES' : 'TARJETA', numeroCuentas: 1,
    saldoEstimado: a.balance, pagoMinimo: a.minimum, tasaAnual: a.ordinaryApr,
    diaCorte: a.closingDate ? Number(a.closingDate.slice(-2)) : null, diaPagoLimite: a.dueDate ? Number(a.dueDate.slice(-2)) : null,
    notas: ('Detalle conciliado en Plan de pagos. Saldo a ' + a.balanceDate + '. ' + a.note).slice(0, 4000), planManaged: true,
  }));
  const tuition = plan.budget.tuitionPayments.filter(p => p.date >= plan.asOf).sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    ...data, planFinanciero: plan, deudas: [], deudasPendientes,
    activos: plan.assets.map(a => ({ id: a.id, nombre: a.name, monto: a.balance, moneda: a.currency, tipo: 'EFECTIVO', institucion: a.name, notas: a.note, planManaged: true })),
    honorarios: { ...data.honorarios, modo: 'MANUAL', ingresoMensualRecibido: plan.budget.monthlyIncome, provisionFiscalMensual: plan.budget.monthlyTax, regimen: data.honorarios?.regimen || 'RESICO', diaPagoImpuestos: plan.budget.taxDay },
    gastosNecesarios: [
      ...(plan.budget.expenses.length ? plan.budget.expenses.filter(e => e.amount !== null).map(e => ({ id: 'plan-expense-' + e.id, nombre: e.name, monto: e.amount, diaPago: null, categoria: 'Presupuesto', planManaged: true })) : plan.budget.livingExpenses === null ? (data.gastosNecesarios || []).filter(g => !g.planManaged && !/maestr[ií]a|tec de monterrey/i.test(g.nombre)) : [{ id: 'plan-living', nombre: 'Gastos de vida · presupuesto conciliado', monto: plan.budget.livingExpenses, diaPago: null, categoria: 'Presupuesto', planManaged: true }]),
      ...(tuition ? [{ id: 'plan-tuition', nombre: 'Maestría · Tec de Monterrey', monto: tuition.amount, diaPago: Number(tuition.date.slice(-2)), categoria: 'Educación', planManaged: true }] : []),
    ],
    gastosOpcionales: plan.budget.expenses.length || plan.budget.livingExpenses !== null ? [] : data.gastosOpcionales,
  };
}

export function upcomingPlanPayments(plan) {
  const rows = plan.accounts.map(a => ({ id: a.id, name: a.name, date: a.dueDate, currency: a.currency, minimum: a.minimum, required: a.requiredPayment, avoidInterest: a.paymentToAvoidInterest, reported: a.reportedPayment, autopay: a.autopayAmount, autopayDate: a.autopayDate, status: 'Pago por confirmar', sourceId: a.sourceId }));
  for (const p of plan.budget.tuitionPayments) rows.push({ id: 'tuition-' + p.date, name: 'Maestría · Tec de Monterrey', date: p.date, currency: 'MXN', minimum: p.amount, required: p.amount, status: 'Compromiso declarado' });
  return rows.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

export function tuitionForPeriod(plan, start, end) {
  const actual = sum(plan.budget.tuitionPayments.filter(p => p.date >= start && p.date < end).map(p => cents(p.amount)));
  // A provision is a budget envelope, not a second debit from a bank account.
  const provision = plan.budget.tuitionProvisionStart && end > plan.budget.tuitionProvisionStart ? cents((plan.budget.quarterlyTuition || 0) / plan.budget.tuitionPaymentCount) : 0;
  return { amount: money(actual || provision), isProvision: actual === 0 && provision > 0 };
}

export function transferTerms(plan, scenario) {
  const t = scenario.transfer, fee = money(Math.round(cents(t.amount) * 0.05));
  const source = plan.accounts.find(a => a.id === t.sourceId);
  const destination = plan.accounts.find(a => /discover/i.test(a.name));
  const errors = [];
  if (!source || source.currency !== 'USD' || source.kind !== 'CARD' || source.id === destination?.id) errors.push('Elige una tarjeta estadounidense distinta de Discover.');
  if (!destination) errors.push('Falta la cuenta Discover de destino.');
  if (!t.date) errors.push('Indica la fecha hipotética de transferencia.');
  if (t.date && t.date < plan.asOf) errors.push('La transferencia hipotética debe ser posterior a la fecha de revisión.');
  if (t.amount <= 0 || t.amount > (source?.balance || 0)) errors.push('El importe debe ser positivo y no superar el saldo del origen.');
  if (t.amount + (t.limitIncludesFee ? fee : 0) > plan.offers.discover.maximum + 0.001) errors.push('La transferencia supera el límite elegido.');
  if (!t.feeAtZero) errors.push('Confirma como supuesto del escenario que la comisión financiada también tiene 0%.');
  return { principal: t.amount, fee, newBalance: money(cents(t.amount) + cents(fee)), monthlyTarget: money(Math.ceil((cents(t.amount) + cents(fee)) / 10)), end: t.date ? addMonths(t.date, 10) : null, source, destination, errors };
}

export function estimateYield(balance, annualRate, cap, excessRate, days = 365) {
  if (annualRate === null || annualRate === undefined) return null;
  if (cap != null && balance > cap && excessRate == null) return null;
  const eligible = cap == null ? balance : Math.min(balance, cap), excess = cap == null ? 0 : Math.max(0, balance - cap);
  return money(Math.round((cents(eligible) * annualRate + cents(excess) * (excessRate || 0)) / 100 * days / 365));
}

export function compareRemittanceQuotes(quotes, now = new Date()) {
  return quotes.map(q => {
    const expires = Date.parse(q.expiresAt), quoted = Date.parse(q.quotedAt);
    const valid = q.debitMXN > 0 && q.netUSD > 0 && q.allCostsIncluded && q.eligible && Number.isFinite(expires) && Number.isFinite(quoted) && quoted <= now.getTime() && expires > now.getTime();
    return { ...q, valid, effectiveRate: q.debitMXN > 0 && q.netUSD > 0 ? q.debitMXN / q.netUSD : null };
  }).sort((a, b) => Number(b.valid) - Number(a.valid) || (a.effectiveRate ?? Infinity) - (b.effectiveRate ?? Infinity));
}

function trancheKnown(t) { return t.apr !== null && !(['PROMO', 'DEFERRED'].includes(t.type) && !t.promoEnd); }
const currentRate = (t, day) => t.promoEnd && day > t.promoEnd ? t.postApr : (t.type === 'DEFERRED' ? 0 : t.apr);

/** Monthly planning approximation: no new purchases, fixed FX and known installments.
 * Unknown components are excluded visibly, never zero-priced or called paid off.
 * Payment dates remain a separate documented calendar: this is not daily solvency.
 */
export function simulatePaymentPlan(plan, { scenario = null, fx = 19.25, horizon = plan.settings.horizon } = {}) {
  const rate = plan.settings.fx || fx;
  if (!(rate > 0) || !Number.isFinite(rate)) throw new Error('Falta un tipo de cambio válido.');
  const toMXN = (amount, currency) => currency === 'USD' ? Math.round(amount * rate) : amount;
  const fromMXN = (amount, currency) => currency === 'USD' ? Math.floor(amount / rate) : amount;
  const accounts = structuredClone(plan.accounts).map(a => ({ ...a, tranches: a.tranches.map(t => ({ ...t, remaining: cents(t.balance), deferred: cents(t.deferredAccrued || 0) })) }));
  const warnings = [];
  if (plan.budget.livingExpenses === null) warnings.push('Gastos de vida pendientes: se modelan mínimos y cuotas conocidos, salvo que definas un presupuesto para deudas.');
  if (!plan.budget.payday) warnings.push('Fecha de ingreso pendiente: el flujo mensual no acredita liquidez en cada vencimiento.');
  if (plan.accounts.some(a => a.minimum === null)) warnings.push('Faltan mensualidades exigibles de algunos créditos; no se confirma la viabilidad del presupuesto.');
  if (plan.accounts.some(a => a.tranches.some(t => t.type === 'INSTALLMENT' && t.balance > 0 && t.monthlyPayment === null))) warnings.push('Faltan cuotas de planes a mensualidades; no se confirma la suficiencia del presupuesto.');
  if (plan.settings.receiverFeeUSD === null) warnings.push('Comisión receptora en Wells Fargo pendiente; el costo de remesas es parcial.');
  const hypothetical = scenario ? normalizeScenario(scenario) : null;
  if (hypothetical?.raise.enabled && !hypothetical.raise.date) warnings.push('El aumento está activado pero falta su fecha; aún no afecta la simulación.');
  if (hypothetical?.bonus.enabled && !hypothetical.bonus.date) warnings.push('El bono está activado pero falta su fecha; aún no afecta la simulación.');
  for (const a of accounts) if (a.minimumIncludesInstallments === null && a.tranches.some(t => t.type === 'INSTALLMENT')) warnings.push(a.name + ': la relación entre mínimo y cuotas no está confirmada. Se reserva su suma como supuesto cuando no existe un pago conjunto documentado.');
  for (const o of hypothetical?.rateOverrides || []) {
    const t = accounts.find(a => a.id === o.accountId)?.tranches.find(t => t.id === o.trancheId);
    if (t) { if (o.apr !== null) t.apr = o.apr; if (o.promoEnd) t.promoEnd = o.promoEnd; if (o.postApr !== null) t.postApr = o.postApr; }
  }
  const excluded = [];
  for (const a of accounts) for (const t of a.tranches) { t.modeled = trancheKnown(t); if (!t.modeled && t.remaining) excluded.push({ account: a.name, tranche: t.label, currency: a.currency, balance: t.balance, reason: t.apr === null ? 'Tasa o tratamiento de interés pendiente' : 'Vencimiento promocional pendiente' }); }
  const transfer = hypothetical?.transfer.enabled ? transferTerms(plan, hypothetical) : null;
  if (transfer?.errors.length) warnings.push(...transfer.errors);
  let didTransfer = false, totalInterest = 0, totalFees = 0, totalPaid = 0, totalYield = 0, stopped = null;
  let usdLiquidity = sum(plan.assets.filter(a => a.currency === 'USD').map(a => cents(a.balance - a.reserved)));
  let mxnLiquidity = sum(plan.assets.filter(a => a.currency === 'MXN').map(a => cents(a.balance - a.reserved)));
  let reverseConversion = false;
  const savingsAvailable = sum(plan.assets.map(a => toMXN(cents(a.balance - a.reserved), a.currency)));
  const requestedSavings = hypothetical?.useSavings ? cents(hypothetical.savingsAmount) : 0;
  const initialContribution = Math.min(requestedSavings, savingsAvailable);
  // USD already held remain available for USD payments, including a savings contribution.
  let reserve = sum(plan.assets.map(a => toMXN(cents(a.balance), a.currency))) - initialContribution;
  if (requestedSavings > savingsAvailable) warnings.push('El abono inicial se limita a los ahorros disponibles después de apartados.');
  const initialModeled = sum(accounts.flatMap(a => a.tranches.filter(t => t.modeled).map(t => toMXN(t.remaining, a.currency))));
  const history = [{ date: plan.asOf, debt: money(initialModeled), paid: 0, principal: 0, interest: 0, fees: 0, income: 0, tuition: 0, surplus: null, liquidity: money(reserve), required: 0, yield: 0 }];
  const promotional = [], monthlyBreakdown = [];
  let payoffDate = null;
  for (let month = 0; month < horizon; month++) {
    const start = addMonths(plan.asOf, month), end = addMonths(plan.asOf, month + 1), days = dayCount(start, end);
    const tuition = tuitionForPeriod(plan, start, end);
    const increase = hypothetical?.raise.enabled && hypothetical.raise.date && hypothetical.raise.date < end ? Math.round(cents(hypothetical.raise.amount) * dayCount(hypothetical.raise.date > start ? hypothetical.raise.date : start, end) / days) : 0;
    const bonus = hypothetical?.bonus.enabled && hypothetical.bonus.date && hypothetical.bonus.date >= start && hypothetical.bonus.date < end ? cents(hypothetical.bonus.amount) : 0;
    const income = cents(plan.budget.monthlyIncome) + increase + bonus;
    let periodFees = 0, cashFees = 0, periodInterest = 0, periodPaid = 0, usdPaid = 0;
    const available = income - cents(plan.budget.monthlyTax) - cents(livingBudgetSummary(plan).known) - cents(tuition.amount);
    const fixedSavings = month === 0 ? initialContribution : 0;
    if (transfer && !transfer.errors.length && !didTransfer && hypothetical.transfer.date < end && hypothetical.transfer.date >= start) {
      const source = accounts.find(a => a.id === transfer.source.id), target = accounts.find(a => a.id === transfer.destination.id);
      if (source.tranches.some(t => !t.modeled && t.remaining)) {
        transfer.errors.push('Completa las condiciones del origen para integrar la transferencia a la comparación de deuda.');
        warnings.push(transfer.errors.at(-1));
      }
      else if (source.tranches.some(t => t.remaining > 0 && t.promoEnd && t.promoEnd < hypothetical.transfer.date && (t.type === 'DEFERRED' || t.postApr === null))) {
        transfer.errors.push('El origen cruza una promoción antes del traspaso y faltan condiciones para calcularlo.');
        warnings.push(transfer.errors.at(-1));
      }
      else if (cents(transfer.principal) > sum(source.tranches.map(t => t.remaining))) {
        transfer.errors.push('El saldo simulado del origen ya es menor que el traspaso elegido. Reduce el importe o adelanta la fecha.');
        warnings.push(transfer.errors.at(-1));
      } else {
        let rest = cents(transfer.principal);
        for (const t of [...source.tranches].sort((a, b) => (b.apr || 0) - (a.apr || 0))) {
          const x = Math.min(t.remaining, rest); t.remaining -= x; rest -= x;
          const elapsed = dayCount(start, hypothetical.transfer.date);
          const pre = t.promoEnd ? Math.min(elapsed, dayCount(start, nextDay(t.promoEnd))) : elapsed;
          const beforeApr = t.type === 'DEFERRED' ? 0 : t.apr;
          const interest = Math.round(x * (pre * beforeApr + (elapsed - pre) * (t.postApr || 0)) / 100 / t.dayBasis);
          // Added after ordinary accrual to avoid charging interest on this new interest.
          t.transferAccrued = interest;
          periodInterest += toMXN(interest, source.currency);
        }
        target.tranches.push({ id: 'scenario-transfer', label: 'Transferencia hipotética', remaining: cents(transfer.newBalance), balance: transfer.newBalance, apr: 0, postApr: hypothetical.transfer.postApr, promoEnd: transfer.end, type: 'PROMO', dayBasis: 365, modeled: true, monthlyPayment: transfer.monthlyTarget, deferred: 0 });
        periodFees += toMXN(cents(transfer.fee), 'USD'); didTransfer = true;
      }
    }
    const commitments = accounts.map(a => {
      const installments = sum(a.tranches.filter(t => t.type === 'INSTALLMENT' && t.remaining > 0 && (t.modeled || t.paymentsRemaining === null || month < t.paymentsRemaining)).map(t => Math.min(t.remaining, cents(t.monthlyPayment || 0))));
      const normalMin = Math.min(cents(a.minimum || 0), sum(a.tranches.filter(t => a.minimumIncludesInstallments === true || t.type !== 'INSTALLMENT').map(t => t.remaining)));
      let required = month === 0 && a.requiredPayment !== null ? cents(a.requiredPayment) : a.minimumIncludesInstallments === true ? Math.max(normalMin, installments) : normalMin + installments;
      // Existing fixed autopay instructions are obligations, not extra payments on top.
      required = Math.max(required, cents(a.autopayAmount || 0));
      if (a.kind === 'LOAN' && a.minimum === null) required = 0;
      return { account: a, amount: Math.min(required, sum(a.tranches.map(t => t.remaining))), installments };
    });
    const required = sum(commitments.map(c => toMXN(c.amount, c.account.currency)));
    let paymentBudget = plan.settings.monthlyDebtBudget !== null ? cents(plan.settings.monthlyDebtBudget) : plan.budget.livingExpenses === null ? required : Math.max(0, available);
    if (hypothetical && (plan.settings.monthlyDebtBudget !== null || plan.budget.livingExpenses === null)) paymentBudget += increase + bonus;
    paymentBudget += fixedSavings;
    // Reserve requirements of unknown-rate balances so they cannot fund modeled debt.
    const unknownRequirements = sum(commitments.map(c => {
      const unknownInstallments = sum(c.account.tranches.filter(t => !t.modeled && t.type === 'INSTALLMENT' && (t.paymentsRemaining === null || month < t.paymentsRemaining)).map(t => Math.min(t.remaining, cents(t.monthlyPayment || 0))));
      const unknownOther = c.account.tranches.some(t => !t.modeled && t.type !== 'INSTALLMENT' && t.remaining > 0) ? Math.max(0, c.amount - c.installments) : 0;
      c.unknownRequirement = Math.min(c.amount, unknownInstallments + unknownOther);
      return toMXN(c.unknownRequirement, c.account.currency);
    }));
    const requiredUSD = sum(commitments.filter(c => c.account.currency === 'USD').map(c => c.amount));
    const possibleUSD = Math.min(sum(accounts.filter(a => a.currency === 'USD').flatMap(a => a.tranches.map(t => t.remaining))), requiredUSD + fromMXN(Math.max(0, paymentBudget - required), 'USD'));
    const possibleRemittanceFee = possibleUSD > usdLiquidity
      ? toMXN(cents((plan.settings.remittanceFeeUSD || 0) + (plan.settings.receiverFeeUSD || 0)), 'USD') : 0;
    if (plan.settings.monthlyDebtBudget === null && plan.budget.livingExpenses === null) paymentBudget += possibleRemittanceFee;
    let remainingBudget = Math.max(0, paymentBudget - unknownRequirements - possibleRemittanceFee);
    const paidByAccount = new Map(accounts.map(a => [a.id, 0]));
    const pay = (a, t, desired) => {
      if (!t.modeled || t.remaining <= 0 || remainingBudget <= 0) return 0;
      const amount = Math.min(t.remaining, Math.max(0, Math.round(desired)), fromMXN(remainingBudget, a.currency));
      const converted = toMXN(amount, a.currency);
      t.remaining -= amount; remainingBudget -= converted; periodPaid += converted;
      paidByAccount.set(a.id, paidByAccount.get(a.id) + amount);
      if (a.currency === 'USD') usdPaid += amount;
      return amount;
    };
    const crossings = [];
    const accrued = [];
    // Interest is a stated approximation on opening balances, with changes split by date.
    for (const a of accounts) for (const t of a.tranches) {
      if (!t.modeled || t.remaining <= 0) continue;
      const before = t.promoEnd && t.promoEnd >= start && t.promoEnd < end ? dayCount(start, t.promoEnd) + 1 : (t.promoEnd && t.promoEnd < start ? 0 : days);
      const after = days - Math.min(days, before);
      if (after > 0 && t.promoEnd) crossings.push({ a, t, after, openingBalance: t.remaining });
      const baseApr = t.type === 'DEFERRED' ? 0 : t.apr;
      const ordinaryInterest = Math.round(t.remaining * (Math.min(days, before) * baseApr / (100 * t.dayBasis)));
      const interest = ordinaryInterest + (a.currency === 'MXN' ? Math.round(ordinaryInterest * (plan.settings.interestTaxPercentMXN || 0) / 100) : 0);
      if (t.type === 'DEFERRED' && t.promoEnd && start <= t.promoEnd) t.deferred += Math.round(t.remaining * t.apr / 100 * Math.min(days, before) / t.dayBasis);
      if (!Number.isSafeInteger(t.remaining + interest)) { stopped ||= { date: start, account: a.name, reason: 'El saldo proyectado supera el rango numérico del modelo.' }; continue; }
      t.remaining += interest; periodInterest += toMXN(interest, a.currency);
      if (t.type === 'REVOLVING' && interest > 0) accrued.push({ a, t, interest });
    }
    for (const a of accounts) for (const t of a.tranches) if (t.transferAccrued) { t.remaining += t.transferAccrued; t.transferAccrued = 0; }
    if (stopped) {
      history.push({ date: end, debt: null, paid: null, interest: null, fees: null, income: money(income), tuition: tuition.amount, surplus: null, liquidity: null, required: money(required), yield: null });
      break;
    }
    for (const c of commitments) {
      let needed = c.amount;
      for (const t of c.account.tranches.filter(t => t.type === 'INSTALLMENT')) {
        const scheduled = !t.modeled && t.paymentsRemaining !== null && month >= t.paymentsRemaining ? 0 : Math.min(t.remaining, cents(t.monthlyPayment || 0));
        needed -= t.modeled ? pay(c.account, t, scheduled) : scheduled;
      }
      if (c.account.tranches.some(t => !t.modeled && t.type !== 'INSTALLMENT' && t.remaining)) needed = 0;
      for (const t of [...c.account.tranches].filter(t => t.type !== 'INSTALLMENT').sort((a, b) => (currentRate(b, start) || 0) - (currentRate(a, start) || 0))) { const paid = pay(c.account, t, needed); needed -= paid; }
      for (const t of c.account.tranches.filter(t => t.type === 'INSTALLMENT')) needed -= pay(c.account, t, needed);
    }
    if (plan.settings.strategy !== 'MINIMUMS') {
      const candidates = accounts.flatMap(a => a.tranches.filter(t => t.modeled && t.remaining > 0 && (t.type !== 'INSTALLMENT' || currentRate(t, start) > 0)).map(t => ({ a, t })));
      // Extra-payment priority; known installments remain ring-fenced above.
      candidates.sort((x, y) => {
        if (plan.settings.strategy === 'PROMO_FIRST') { const dx = x.t.promoEnd || '9999', dy = y.t.promoEnd || '9999'; if (dx !== dy) return dx.localeCompare(dy); }
        return (currentRate(y.t, start) || 0) - (currentRate(x.t, start) || 0);
      });
      for (const { a, t } of candidates) pay(a, t, t.remaining);
    }
    // Grace follows the actual allocation, not merely the existence of a budget.
    if (month === 0) for (const a of accounts) {
      if (a.lastInterest !== 0 || a.paymentToAvoidInterest === null || !a.dueDate || a.dueDate < start || a.dueDate >= end || paidByAccount.get(a.id) < cents(a.paymentToAvoidInterest)) continue;
      const eligible = accrued.filter(row => row.a.id === a.id);
      const refundable = sum(eligible.map(({ t, interest }) => Math.max(0, interest - t.remaining)));
      const remainingAfterCredits = sum(a.tranches.filter(t => t.modeled).map(t => t.remaining)) - sum(eligible.map(({ t, interest }) => Math.min(t.remaining, interest)));
      if (paidByAccount.get(a.id) - Math.max(0, refundable - remainingAfterCredits) < cents(a.paymentToAvoidInterest)) continue;
      for (const { t, interest } of eligible) { t.remaining -= Math.min(t.remaining, interest); periodInterest -= toMXN(interest, a.currency); }
      if (refundable) {
        const converted = toMXN(refundable, a.currency);
        paidByAccount.set(a.id, paidByAccount.get(a.id) - refundable);
        periodPaid -= converted; remainingBudget += converted;
        if (a.currency === 'USD') usdPaid -= refundable;
        let reallocate = refundable;
        for (const t of a.tranches.filter(t => t.modeled)) reallocate -= pay(a, t, Math.min(reallocate, t.remaining));
      }
    }
    for (const { a, t, after, openingBalance } of crossings) {
      let paymentDate = a.dueDate;
      if (paymentDate) while (paymentDate < start) paymentDate = addMonths(paymentDate, 1);
      if (t.remaining === 0 && paymentDate && paymentDate <= t.promoEnd && paymentDate < end) continue;
      if (t.type === 'DEFERRED') {
        promotional.push({ account: a.name, date: t.promoEnd, balance: money(t.remaining), currency: a.currency, deferredRisk: money(t.deferred), estimated: true });
        stopped ||= { date: t.promoEnd, account: a.name, reason: 'La liquidación antes de vencer el interés diferido no está acreditada en este escenario.' };
      } else if (t.postApr === null) stopped ||= { date: t.promoEnd, account: a.name, reason: 'Falta la tasa posterior a la promoción.' };
      else {
        // A payment after expiry cannot erase interest accrued before its date.
        const postStart = t.promoEnd < start ? start : nextDay(t.promoEnd);
        const beforePayment = Math.min(after, dayCount(postStart, paymentDate || end));
        const ordinary = Math.round((openingBalance * beforePayment + t.remaining * (after - beforePayment)) * t.postApr / 100 / t.dayBasis);
        const extraInterest = ordinary + (a.currency === 'MXN' ? Math.round(ordinary * (plan.settings.interestTaxPercentMXN || 0) / 100) : 0);
        if (!Number.isSafeInteger(t.remaining + extraInterest)) { stopped ||= { date: start, account: a.name, reason: 'El saldo proyectado supera el rango numérico del modelo.' }; continue; }
        t.remaining += extraInterest; periodInterest += toMXN(extraInterest, a.currency);
        if (plan.settings.strategy !== 'MINIMUMS') pay(a, t, extraInterest);
      }
    }
    if (stopped) {
      history.push({ date: end, debt: null, paid: null, interest: null, fees: null, income: money(income), tuition: tuition.amount, surplus: null, liquidity: null, required: money(required), yield: null });
      break;
    }
    const unknownUSD = sum(commitments.filter(c => c.account.currency === 'USD').map(c => c.unknownRequirement));
    const paymentsMXN = periodPaid - toMXN(usdPaid, 'USD') + unknownRequirements - toMXN(unknownUSD, 'USD');
    mxnLiquidity += available;
    if (paymentsMXN > mxnLiquidity && usdLiquidity > 0) {
      const convertedUSD = Math.min(usdLiquidity, Math.ceil((paymentsMXN - mxnLiquidity) / rate));
      usdLiquidity -= convertedUSD;
      mxnLiquidity += toMXN(convertedUSD, 'USD');
      reverseConversion = true;
      warnings.push('El escenario usa dólares para cubrir pagos en pesos. Se descuenta ese efectivo USD; falta cotizar el costo de conversión inversa.');
    }
    mxnLiquidity -= paymentsMXN;
    usdPaid += unknownUSD;
    if (usdPaid > usdLiquidity) {
      cashFees = toMXN(cents((plan.settings.remittanceFeeUSD || 0) + (plan.settings.receiverFeeUSD || 0)), 'USD'); periodFees += cashFees;
      mxnLiquidity -= toMXN(usdPaid - usdLiquidity, 'USD') + cashFees;
      usdLiquidity = 0;
    } else usdLiquidity -= usdPaid;
    const debt = sum(accounts.flatMap(a => a.tranches.filter(t => t.modeled).map(t => toMXN(t.remaining, a.currency))));
    const grossYield = sum(plan.assets.map(a => {
      const applied = initialContribution > 0 ? Math.max(0, 1 - initialContribution / Math.max(1, savingsAvailable)) : 1;
      return toMXN(cents(estimateYield((a.balance - a.reserved) * applied, a.annualRate, a.rateCap, a.excessRate, days) || 0), a.currency);
    }));
    const surplus = available - periodPaid - unknownRequirements - cashFees;
    const requirementGap = sum(commitments.map(c => toMXN(Math.max(0, c.amount - paidByAccount.get(c.account.id) - c.unknownRequirement), c.account.currency)));
    const minimumShortfall = Math.max(requirementGap, Math.max(0, required - paymentBudget));
    const fundingGap = Math.max(0, -surplus - fixedSavings, periodPaid + unknownRequirements + cashFees - paymentBudget);
    reserve += surplus + grossYield + fixedSavings;
    totalInterest += periodInterest; totalFees += periodFees; totalPaid += periodPaid; totalYield += grossYield;
    monthlyBreakdown.push({ date: end, accounts: accounts.map(a => ({ id: a.id, name: a.name, currency: a.currency, balance: money(sum(a.tranches.filter(t => t.modeled).map(t => t.remaining))), payment: money(paidByAccount.get(a.id)), reserved: money(commitments.find(c => c.account.id === a.id)?.unknownRequirement || 0), partial: a.tranches.some(t => !t.modeled) })) });
    history.push({ date: end, debt: money(debt), paid: money(periodPaid), principal: money(Math.max(0, periodPaid - periodInterest)), interest: money(periodInterest), fees: money(periodFees), income: money(income), tuition: tuition.amount, isTuitionProvision: tuition.isProvision, surplus: plan.budget.livingExpenses === null ? null : money(surplus), liquidity: plan.budget.livingExpenses === null ? null : money(reserve), required: money(required), minimumShortfall: money(minimumShortfall), fundingGap: money(fundingGap), savingsUsed: money(fixedSavings), reservedUnknown: money(unknownRequirements), yield: money(grossYield) });
    if (debt === 0) { payoffDate = end; break; }
  }
  const fullCoverage = excluded.length === 0 && !stopped;
  const budgetComplete = !reverseConversion && plan.budget.livingExpenses !== null && plan.accounts.every(a => a.minimum !== null && (a.minimumIncludesInstallments !== null || !a.tranches.some(t => t.type === 'INSTALLMENT')) && !a.tranches.some(t => t.type === 'INSTALLMENT' && t.balance > 0 && t.monthlyPayment === null)) && plan.budget.payday !== null && (!plan.accounts.some(a => a.currency === 'USD') || plan.settings.receiverFeeUSD !== null);
  const funded = budgetComplete && !stopped && history.every(r => !(r.minimumShortfall > 0) && !(r.fundingGap > 0));
  return { history, monthlyBreakdown, excluded, stopped, warnings: [...new Set(warnings)], fullCoverage, budgetComplete, funded, payoffDate: fullCoverage && budgetComplete && funded ? payoffDate : null, modeledPayoffDate: payoffDate, initialModeled: money(initialModeled), totalInterest: money(totalInterest), totalFees: money(totalFees), totalPaid: money(totalPaid), totalYield: money(totalYield), promotional, fx: rate, transfer: transfer ? { ...transfer, source: undefined, destination: undefined, applied: didTransfer } : null };
}

export function mergePlanHistories(base, scenario) {
  const dates = [...new Set([...base.map(r => r.date), ...scenario.map(r => r.date)])].sort();
  const b = new Map(base.map(r => [r.date, r])), s = new Map(scenario.map(r => [r.date, r]));
  return dates.map(date => ({ date, base: b.get(date)?.debt ?? null, scenario: s.get(date)?.debt ?? null }));
}
