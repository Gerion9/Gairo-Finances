import { convertCurrency, DEFAULT_USD_MXN } from './exchangeRate.js';
import { moneyToCents } from './transactionAnalytics.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const asArray = (value) => Array.isArray(value) ? value : [];
const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const validBalance = (value, currency) => value !== '' && value != null
  && Number.isFinite(Number(value)) && Number(value) >= 0 && ['MXN', 'USD'].includes(currency || 'MXN');

export function consolidatedCurrency(displayCurrency) {
  return displayCurrency === 'USD' ? 'USD' : 'MXN';
}

export function displayAmount(amountMXN, displayCurrency, exchangeRate) {
  return convertCurrency(finiteNumber(amountMXN), 'MXN', consolidatedCurrency(displayCurrency), exchangeRate);
}

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Date-only records represent local calendar dates, never UTC instants.
export function parseLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function calendarDistance(first, second) {
  const utcDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utcDay(first) - utcDay(second)) / DAY_MS);
}

export function ledgerPeriod(period = 'current', now = new Date()) {
  const isPrevious = period === 'previous';
  const start = new Date(now.getFullYear(), now.getMonth() - (isPrevious ? 1 : 0), 1);
  const end = isPrevious
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const lastDate = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  return { start, end, lastDate, startKey: localDateKey(start), endKey: localDateKey(lastDate) };
}

export function summarizeLedger(transactions, period, now, exchangeRate, displayCurrency) {
  const range = ledgerPeriod(period, now);
  const targetCurrency = consolidatedCurrency(displayCurrency);
  const rate = Number.isFinite(Number(exchangeRate)) && Number(exchangeRate) > 0 ? Number(exchangeRate) : DEFAULT_USD_MXN;
  let invalidCount = 0;
  const rows = asArray(transactions).flatMap((transaction, index) => {
    const date = parseLocalDate(transaction?.fecha);
    const sourceCents = moneyToCents(transaction?.monto);
    const currency = transaction?.moneda || 'MXN';
    if (!date || sourceCents === null || sourceCents < 0
      || !['INGRESO', 'GASTO'].includes(transaction?.tipo) || !['MXN', 'USD'].includes(currency)) {
      invalidCount += 1;
      return [];
    }
    if (date < range.start || date >= range.end) return [];
    // Match the ledger: convert source cents directly, then round each record once.
    const amountCents = Math.round(convertCurrency(sourceCents, currency, targetCurrency, rate));
    if (!Number.isSafeInteger(amountCents)) {
      invalidCount += 1;
      return [];
    }
    const amountMXNCents = Math.round(convertCurrency(sourceCents, currency, 'MXN', rate));
    return [{
      ...transaction,
      key: transaction.id || `record-${index}`,
      date,
      moneda: currency,
      amountMXN: Number.isSafeInteger(amountMXNCents) ? amountMXNCents / 100 : null,
      amountCents,
      amount: amountCents / 100,
    }];
  }).sort((a, b) => b.date - a.date);
  const incomeCents = rows.filter((row) => row.tipo === 'INGRESO').reduce((sum, row) => sum + row.amountCents, 0);
  const expenseCents = rows.filter((row) => row.tipo === 'GASTO').reduce((sum, row) => sum + row.amountCents, 0);
  return { ...range, rows, income: incomeCents / 100, expenses: expenseCents / 100, net: (incomeCents - expenseCents) / 100, invalidCount };
}

export function summarizeBalances(data = {}, exchangeRate, displayCurrency) {
  const debts = asArray(data.deudas).map((debt, index) => {
    const isValid = validBalance(debt?.saldo, debt?.moneda);
    const amountMXN = isValid ? convertCurrency(Number(debt.saldo), debt.moneda || 'MXN', 'MXN', exchangeRate) : null;
    return { ...debt, key: debt?.id || `debt-${index}`, isValid, amountMXN, amount: isValid ? displayAmount(amountMXN, displayCurrency, exchangeRate) : null };
  }).sort((a, b) => Number(b.isValid) - Number(a.isValid) || (b.amountMXN || 0) - (a.amountMXN || 0));
  const invalidDebtCount = debts.filter((debt) => !debt.isValid).length;
  const assets = asArray(data.activos);
  const validAssets = assets.filter((asset) => validBalance(asset?.monto, asset?.moneda));
  const invalidAssetCount = assets.length - validAssets.length;
  const debtMXN = debts.reduce((sum, debt) => sum + (debt.amountMXN || 0), 0);
  const assetsMXN = validAssets.reduce((sum, asset) => sum
    + convertCurrency(Number(asset.monto), asset.moneda || 'MXN', 'MXN', exchangeRate), 0);
  return {
    debts,
    debt: invalidDebtCount ? null : displayAmount(debtMXN, displayCurrency, exchangeRate),
    assets: invalidAssetCount ? null : displayAmount(assetsMXN, displayCurrency, exchangeRate),
    netWorth: invalidDebtCount || invalidAssetCount ? null : displayAmount(assetsMXN - debtMXN, displayCurrency, exchangeRate),
    assetCount: assets.length,
    invalidDebtCount,
    invalidAssetCount,
  };
}

export function monthlyFlow(cashFlow = {}, displayCurrency, exchangeRate) {
  const fiscal = cashFlow.fiscal || {};
  const definitions = [
    ['deposit', 'Depósito neto', 'Depósito', fiscal.netoEnCuenta, '#7DE4BF'],
    ['other', 'Otros ingresos', 'Otros', fiscal.otrosIngresos, '#A7E9D2'],
    ['tax', 'Provisión fiscal', 'Provisión', -finiteNumber(fiscal.totalImpuestosSat), '#E7BE83'],
    ['necessary', 'Gastos necesarios', 'Necesarios', -finiteNumber(cashFlow.totalCostodeVida), '#89ACD6'],
    ['optional', 'Gastos opcionales', 'Opcionales', -finiteNumber(cashFlow.totalGastosOpcionales), '#B8AFF8'],
    ['minimum', 'Pagos mínimos de deuda', 'Mínimos', -finiteNumber(cashFlow.totalPagosMinimosMXN), '#DCA6A2'],
  ];
  let runningMXN = 0;
  const steps = definitions.map(([id, label, shortLabel, rawAmount, color]) => {
    const amountMXN = finiteNumber(rawAmount);
    const startMXN = runningMXN;
    runningMXN += amountMXN;
    return {
      id, label, shortLabel, color,
      amount: displayAmount(amountMXN, displayCurrency, exchangeRate),
      start: displayAmount(startMXN, displayCurrency, exchangeRate),
      end: displayAmount(runningMXN, displayCurrency, exchangeRate),
    };
  });
  const freeMXN = finiteNumber(cashFlow.flujoLibreReal);
  const free = displayAmount(freeMXN, displayCurrency, exchangeRate);
  return {
    steps: [...steps, { id: 'free', label: 'Flujo libre antes de aportaciones extra', shortLabel: 'Libre', amount: free, start: 0, end: free, color: free < 0 ? '#E8A4AA' : '#7DE4BF' }],
    free,
    income: displayAmount(finiteNumber(fiscal.netoEnCuenta) + finiteNumber(fiscal.otrosIngresos), displayCurrency, exchangeRate),
    expenses: displayAmount(finiteNumber(fiscal.totalImpuestosSat) + finiteNumber(cashFlow.totalCostodeVida)
      + finiteNumber(cashFlow.totalGastosOpcionales) + finiteNumber(cashFlow.totalPagosMinimosMXN), displayCurrency, exchangeRate),
    reconciliationDifference: displayAmount(freeMXN - runningMXN, displayCurrency, exchangeRate),
  };
}

export function pendingPayments(data = {}, now = new Date(), exchangeRate, displayCurrency) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthKey = localDateKey(now).slice(0, 7);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const paid = data.pagosRealizadosMes?.[monthKey] || {};
  const manualTax = data.honorarios?.modo === 'MANUAL' && Number(data.honorarios.provisionFiscalMensual) > 0;
  const expenses = [...asArray(data.gastosNecesarios).filter(Boolean).map(expense => ({ ...expense, kind: 'Gasto necesario' })), ...asArray(data.gastosOpcionales).filter(Boolean).map(expense => ({ ...expense, kind: 'Gasto opcional' }))]
    .filter(expense => !manualTax || expense.id !== 'provision-fiscal');
  if (manualTax) expenses.push({ id: 'provision-fiscal', nombre: 'Provisión de impuestos', monto: data.honorarios.provisionFiscalMensual, diaPago: data.honorarios.diaPagoImpuestos, kind: 'Provisión fiscal' });
  const items = [
    ...asArray(data.deudas).filter((debt) => validBalance(debt?.saldo, debt?.moneda) && Number(debt.saldo) > 0).map((debt) => ({
      ...debt, day: debt.diaPagoLimite, originalAmount: Math.min(Number(debt.saldo), Math.max(0, finiteNumber(debt.pagoMinimo))), kind: 'Pago mínimo', currency: debt.moneda || 'MXN',
    })),
    ...expenses.map(expense => ({ ...expense, day: expense.diaPago, originalAmount: finiteNumber(expense.monto), currency: 'MXN' })),
  ];
  return items.flatMap((item) => {
    const day = Number(item.day);
    if (paid[item.id] === true || item.originalAmount <= 0 || !Number.isInteger(day) || day < 1 || day > 31) return [];
    const date = new Date(year, month, Math.min(day, lastDay));
    const amountMXN = convertCurrency(item.originalAmount, item.currency, 'MXN', exchangeRate);
    return [{ ...item, date, dateKey: localDateKey(date), daysRemaining: calendarDistance(date, now), amount: displayAmount(amountMXN, displayCurrency, exchangeRate) }];
  }).sort((a, b) => a.date - b.date || b.amount - a.amount);
}

export function nearestPromo(promotions, now = new Date()) {
  return asArray(promotions).flatMap((promotion) => {
    const date = parseLocalDate(promotion?.promoDeadline);
    if (!date || finiteNumber(promotion?.saldo) <= 0) return [];
    const daysRemaining = calendarDistance(date, now);
    return daysRemaining <= 45 ? [{ ...promotion, date, daysRemaining }] : [];
  }).sort((a, b) => a.date - b.date)[0] || null;
}
