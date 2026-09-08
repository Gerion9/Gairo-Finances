import { calculateCashFlow } from './financeEngine.js';
import { DEFAULT_USD_MXN } from './exchangeRate.js';

const list = value => Array.isArray(value) ? value : [];
const rounded = value => Math.round((value + Number.EPSILON) * 100) / 100;
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T12:00:00`);
  return year > 0 && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

function money(value, currency, rate, { allowMissingCurrency = false, roundConvertedToCents = false } = {}) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  const unit = currency || (allowMissingCurrency ? 'MXN' : null);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents)
    || Math.abs(cents - amount * 100) > 0.00001 || !['MXN', 'USD'].includes(unit)) return null;
  const convertedCents = unit === 'USD' ? cents * rate : cents;
  if (!Number.isSafeInteger(Math.round(convertedCents))) return null;
  // Budget and balance projections keep the engine's FX precision until the
  // final fact. Registered transactions keep the ledger's per-movement cents.
  if (roundConvertedToCents) return Math.round(convertedCents) / 100;
  return unit === 'USD' ? amount * rate : amount;
}

const categoryLabel = value => typeof value === 'string' && value.trim()
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  : 'Otros';

function fxMetadata(exchangeRateData) {
  const suppliedRate = Number(typeof exchangeRateData === 'number' ? exchangeRateData : exchangeRateData?.rate);
  const valid = Number.isFinite(suppliedRate) && suppliedRate > 0;
  const dateValue = exchangeRateData?.lastUpdated ?? exchangeRateData?.asOf;
  const date = dateValue == null ? null : new Date(dateValue);
  // Only fixed provenance labels leave the browser; arbitrary metadata is not context.
  const knownSources = new Set([
    'Personalizado (Manual)', 'Caché local', 'Mercado en vivo (Open ER API)',
    'Mercado en vivo (Frankfurter)', 'Caché previo', 'Tasa base de contingencia',
  ]);
  const source = !valid ? 'Tasa base de contingencia'
    : knownSources.has(exchangeRateData?.source) ? exchangeRateData.source : 'Tipo de cambio proporcionado';
  return {
    rate: valid ? suppliedRate : DEFAULT_USD_MXN,
    source,
    asOf: source !== 'Tasa base de contingencia' && date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
  };
}

/** An explicit allowlist of aggregate facts, never the profile or raw transactions. */
export function buildAIContext(financialData = {}, exchangeRateData = {}, { now = new Date(), timeZone } = {}) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError('La fecha del resumen no es válida.');
  const today = timeZone ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : localDate(date);
  const reportingMonth = today.slice(0, 7);
  const data = financialData || {};
  const fx = fxMetadata(exchangeRateData);
  const facts = [];
  const addFact = (id, label, amount, basis) => {
    if (Number.isFinite(amount) && Number.isSafeInteger(Math.round(amount * 100)) && facts.length < 40) {
      facts.push({ id, label, amount: rounded(amount), currency: 'MXN', basis, period: reportingMonth });
    }
  };

  const budgetRows = values => list(values).map(row => {
    const amount = money(row?.monto, row?.moneda, fx.rate, { allowMissingCurrency: true });
    return amount === null ? null : { monto: amount };
  }).filter(Boolean);
  const necessary = budgetRows(data.gastosNecesarios);
  const optional = budgetRows(data.gastosOpcionales);
  const debts = list(data.deudas).map(row => {
    const balance = money(row?.saldo, row?.moneda, fx.rate, { allowMissingCurrency: true });
    const minimum = money(row?.pagoMinimo, row?.moneda, fx.rate, { allowMissingCurrency: true });
    return balance === null ? null : { saldo: balance, pagoMinimo: minimum ?? 0, moneda: 'MXN' };
  }).filter(Boolean);
  const honorarios = {};
  const fiscalKeys = ['importeFacturado', 'tasaIva', 'retencionIsrTasa', 'retencionIvaFraccion', 'tasaIsrDeclaracion', 'otrosIngresos'];
  for (const key of fiscalKeys) {
    const raw = data.honorarios?.[key];
    const value = Number(raw);
    if (raw !== null && raw !== '' && Number.isFinite(value) && value >= 0) honorarios[key] = value;
  }
  const fiscalComplete = Object.hasOwn(honorarios, 'importeFacturado')
    && fiscalKeys.every(key => data.honorarios?.[key] === undefined || Object.hasOwn(honorarios, key));
  const cashFlow = calculateCashFlow({ honorarios, gastosNecesarios: necessary, gastosOpcionales: optional, deudas: debts }, fx.rate);
  const budgetComplete = necessary.length === list(data.gastosNecesarios).length
    && optional.length === list(data.gastosOpcionales).length;
  const debtsComplete = debts.length === list(data.deudas).length
    && list(data.deudas).every(row => money(row?.pagoMinimo, row?.moneda, fx.rate, { allowMissingCurrency: true }) !== null);

  if (fiscalComplete) {
    addFact('budget.income', 'Ingreso mensual neto configurado', cashFlow.fiscal.netoEnCuenta + cashFlow.fiscal.otrosIngresos, 'presupuesto');
    addFact('budget.tax', 'Provisión fiscal mensual estimada', cashFlow.fiscal.totalImpuestosSat, 'estimacion');
  }
  if (Array.isArray(data.gastosNecesarios) && necessary.length === data.gastosNecesarios.length) {
    addFact('budget.necessary', 'Gastos necesarios presupuestados', cashFlow.totalCostodeVida, 'presupuesto');
  }
  if (Array.isArray(data.gastosOpcionales) && optional.length === data.gastosOpcionales.length) {
    addFact('budget.optional', 'Gastos opcionales presupuestados', cashFlow.totalGastosOpcionales, 'presupuesto');
  }
  if (Array.isArray(data.deudas) && debtsComplete) {
    addFact('budget.minimums', 'Pagos mínimos mensuales configurados', cashFlow.totalPagosMinimosMXN, 'presupuesto');
  }
  if (fiscalComplete && budgetComplete && debtsComplete && Array.isArray(data.gastosNecesarios) && Array.isArray(data.gastosOpcionales) && Array.isArray(data.deudas)) {
    addFact('budget.margin', 'Margen mensual estimado antes del aporte extra', cashFlow.flujoLibreReal, 'estimacion');
  }
  if (Array.isArray(data.deudas) && debts.length === data.deudas.length) {
    addFact('balance.debt', 'Saldo de deudas registrado', debts.reduce((sum, row) => sum + row.saldo, 0), 'saldos_registrados');
  }
  const assets = list(data.activos).map(row => money(row?.monto, row?.moneda, fx.rate, { allowMissingCurrency: true }));
  if (Array.isArray(data.activos) && assets.every(value => value !== null)) {
    addFact('balance.assets', 'Activos registrados', assets.reduce((sum, value) => sum + value, 0), 'saldos_registrados');
  }

  const transactions = list(data.transacciones).filter(row => row && validDate(row.fecha)
    && row.fecha.startsWith(`${reportingMonth}-`) && row.fecha <= today
    && ['INGRESO', 'GASTO'].includes(row.tipo)).map(row => ({
    date: row.fecha,
    type: row.tipo,
    category: categoryLabel(row.categoria),
    amount: money(row.monto, row.moneda, fx.rate, { roundConvertedToCents: true }),
  })).filter(row => row.amount !== null && row.amount > 0);
  const dates = transactions.map(row => row.date).sort();
  const categories = new Map();
  let income = 0;
  let spending = 0;
  for (const row of transactions) {
    if (row.type === 'INGRESO') income += row.amount;
    else {
      spending += row.amount;
      categories.set(row.category, (categories.get(row.category) || 0) + row.amount);
    }
  }
  if (transactions.length > 0) {
    addFact('recorded.income', 'Ingresos registrados en el mes', income, 'movimientos_registrados');
    addFact('recorded.expenses', 'Gastos registrados en el mes', spending, 'movimientos_registrados');
    addFact('recorded.net', 'Ingresos menos gastos registrados', income - spending, 'movimientos_registrados');
    [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 6)
      .forEach(([label, amount], index) => addFact(`recorded.category.${index + 1}`, `Gasto registrado · ${label}`, amount, 'movimientos_registrados'));
  }

  return {
    version: 1,
    generatedAt: date.toISOString(),
    reportingMonth,
    currency: 'MXN',
    fx,
    coverage: { transactionCount: transactions.length, firstDate: dates[0] || null, lastDate: dates.at(-1) || null },
    facts,
  };
}
