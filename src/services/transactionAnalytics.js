import { DEFAULT_USD_MXN } from './exchangeRate';

export const TRANSACTION_CATEGORIES = [
  'Alimentos', 'Vivienda', 'Servicios', 'Transporte', 'Mascota',
  'Estilo de Vida', 'Honorarios', 'Otros',
];

export function getLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidTransactionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

// Store and sum cents; reject fractional cents instead of silently changing an entry.
export function moneyToCents(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.00001) return null;
  return cents;
}

export function validateTransaction(transaction) {
  const errors = {};
  const cents = moneyToCents(transaction.monto);
  if (!transaction.descripcion?.trim()) errors.descripcion = 'Escribe una descripción para reconocer este movimiento.';
  if (cents === null || cents <= 0) errors.monto = 'Ingresa un importe mayor a cero, con máximo dos decimales.';
  if (!isValidTransactionDate(transaction.fecha)) errors.fecha = 'Selecciona una fecha válida.';
  if (!['MXN', 'USD'].includes(transaction.moneda)) errors.moneda = 'Selecciona MXN o USD.';
  if (!['GASTO', 'INGRESO'].includes(transaction.tipo)) errors.tipo = 'Selecciona gasto o ingreso.';
  return errors;
}

export function validateDebtPayment(amount, balance) {
  const cents = moneyToCents(amount);
  const balanceCents = moneyToCents(balance);
  if (cents === null || cents <= 0) return 'Ingresa un abono mayor a cero, con máximo dos decimales.';
  if (balanceCents === null || balanceCents <= 0) return 'Esta deuda no tiene saldo disponible para abonar.';
  if (cents > balanceCents) return 'El abono no puede ser mayor al saldo pendiente.';
  return null;
}

function convertedCents(amount, fromCurrency, toCurrency, exchangeRate) {
  const cents = moneyToCents(amount);
  const source = fromCurrency || 'MXN'; // Existing budgets without a currency are denominated in MXN.
  if (cents === null || cents < 0 || !['MXN', 'USD'].includes(source)) return null;
  if (source === toCurrency) return cents;
  const rate = Number.isFinite(Number(exchangeRate)) && Number(exchangeRate) > 0 ? Number(exchangeRate) : DEFAULT_USD_MXN;
  const result = Math.round(source === 'USD' ? cents * rate : cents / rate);
  return Number.isSafeInteger(result) ? result : null;
}

export function summarizeTransactions(financialData, period, exchangeRate = DEFAULT_USD_MXN, displayCurrency = 'MXN') {
  // A mixed-currency total cannot have an "original" currency; use MXN and label it explicitly.
  const currency = displayCurrency === 'USD' ? 'USD' : 'MXN';
  const transactions = (financialData?.transacciones || []).filter(transaction =>
    isValidTransactionDate(transaction.fecha) && transaction.fecha.startsWith(`${period}-`));
  const categories = new Map();
  const categoryFor = (name) => {
    const category = name || 'Otros';
    if (!categories.has(category)) categories.set(category, { category, budgetCents: 0, spentCents: 0 });
    return categories.get(category);
  };

  for (const budget of [...(financialData?.gastosNecesarios || []), ...(financialData?.gastosOpcionales || [])]) {
    const item = categoryFor(budget.categoria);
    const cents = convertedCents(budget.monto, budget.moneda, currency, exchangeRate);
    if (cents !== null) item.budgetCents += cents;
  }

  let incomeCents = 0;
  let expenseCents = 0;
  let excludedCount = 0;
  for (const transaction of transactions) {
    const cents = convertedCents(transaction.monto, transaction.moneda, currency, exchangeRate);
    if (cents === null || !['GASTO', 'INGRESO'].includes(transaction.tipo)) {
      excludedCount += 1;
      continue;
    }
    if (transaction.tipo === 'INGRESO') incomeCents += cents;
    else {
      expenseCents += cents;
      categoryFor(transaction.categoria).spentCents += cents;
    }
  }

  return {
    currency,
    transactions,
    income: incomeCents / 100,
    expenses: expenseCents / 100,
    net: (incomeCents - expenseCents) / 100,
    excludedCount,
    categories: [...categories.values()].map(item => ({
      category: item.category,
      budget: item.budgetCents / 100,
      spent: item.spentCents / 100,
      remaining: (item.budgetCents - item.spentCents) / 100,
      percentage: item.budgetCents > 0 ? (item.spentCents / item.budgetCents) * 100 : null,
      overBudget: item.budgetCents > 0 && item.spentCents > item.budgetCents,
    })).sort((a, b) => b.spent - a.spent || b.budget - a.budget || a.category.localeCompare(b.category, 'es')),
  };
}

const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function filterTransactions(transactions, { type = 'ALL', category = 'ALL', query = '' } = {}) {
  const search = normalizeSearch(query.trim());
  return transactions.filter(transaction =>
    (type === 'ALL' || transaction.tipo === type) &&
    (category === 'ALL' || (transaction.categoria || 'Otros') === category) &&
    (!search || normalizeSearch(`${transaction.descripcion} ${transaction.categoria} ${transaction.metodoPago}`).includes(search)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
