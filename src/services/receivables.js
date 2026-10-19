// Expected income is a separate ledger. Only linked, existing income movements
// count as received; this module never changes assets, fees or a payment plan.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const currencies = ['MXN', 'USD'];
const itemFields = ['id', 'name', 'amountMinor', 'currency', 'expectedDate', 'note', 'createdAt', 'cancelledAt'];
const editableFields = ['name', 'amountMinor', 'currency', 'expectedDate', 'note', 'cancelledAt'];
const allocationFields = ['id', 'receivableId', 'transactionId', 'amountMinor', 'createdAt', 'reversedAt'];

export class ReceivableError extends Error {
  constructor(code, message) { super(message); this.name = 'ReceivableError'; this.code = code; }
}
const fail = (code, message) => { throw new ReceivableError(code, message); };
const same = (a, b, fields) => fields.every(key => Object.is(a?.[key], b?.[key]));
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 300;
const positiveMinor = value => Number.isSafeInteger(value) && value > 0;

export function isReceivableDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && isReceivableDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
export function receivableMoneyToMinor(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  return Number.isFinite(amount) && Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) <= 0.00001 ? cents : null;
}
function checkedAdd(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail('AMOUNT_OVERFLOW', 'El total excede el importe que podemos representar con precisión.');
  return result;
}
function normalizeItem(value) {
  if (!record(value) || !validId(value.id)) fail('INVALID_ITEM', 'El cobro necesita un identificador válido.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) fail('INVALID_NAME', 'Escribe un concepto de hasta 200 caracteres.');
  if (!positiveMinor(value.amountMinor)) fail('INVALID_AMOUNT', 'El importe esperado debe ser mayor que cero, con máximo dos decimales.');
  if (!currencies.includes(value.currency)) fail('INVALID_CURRENCY', 'Selecciona moneda MXN o USD.');
  if (value.expectedDate !== null && !isReceivableDate(value.expectedDate)) fail('INVALID_DATE', 'La fecha esperada debe ser válida o quedar sin fecha.');
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length > 2000)) fail('INVALID_NOTE', 'La nota puede tener hasta 2,000 caracteres.');
  if (!timestamp(value.createdAt) || (value.cancelledAt !== null && !timestamp(value.cancelledAt))) fail('INVALID_TIMESTAMP', 'El cobro contiene una fecha de registro inválida.');
  if (value.cancelledAt && Date.parse(value.cancelledAt) < Date.parse(value.createdAt)) fail('INVALID_TIMESTAMP', 'La cancelación no puede ser anterior al registro.');
  return Object.fromEntries(itemFields.filter(key => key !== 'note' || value.note !== undefined).map(key => [key, value[key]]));
}
function normalizeAllocation(value) {
  if (!record(value) || !['id', 'receivableId', 'transactionId'].every(key => validId(value[key]))) fail('INVALID_ALLOCATION', 'El vínculo necesita identificadores válidos.');
  if (!positiveMinor(value.amountMinor)) fail('INVALID_AMOUNT', 'El importe vinculado debe ser mayor que cero, con máximo dos decimales.');
  if (!timestamp(value.createdAt) || (value.reversedAt !== null && !timestamp(value.reversedAt))) fail('INVALID_TIMESTAMP', 'El vínculo contiene una fecha de registro inválida.');
  if (value.reversedAt && Date.parse(value.reversedAt) < Date.parse(value.createdAt)) fail('INVALID_TIMESTAMP', 'La desvinculación no puede ser anterior al vínculo.');
  return Object.fromEntries(allocationFields.map(key => [key, value[key]]));
}
function indexUnique(rows, name) {
  const map = new Map();
  for (const row of rows) {
    if (map.has(row.id)) fail('DUPLICATE_ID', `Hay identificadores repetidos en ${name}.`);
    map.set(row.id, row);
  }
  return map;
}
function relationshipTotals(ledger, transactions) {
  const items = indexUnique(ledger.items, 'cobros');
  const transactionsById = new Map();
  for (const transaction of transactions) {
    if (transactionsById.has(transaction?.id)) transactionsById.set(transaction.id, null);
    else transactionsById.set(transaction?.id, transaction);
  }
  const byItem = new Map();
  const byTransaction = new Map();
  for (const allocation of ledger.allocations) {
    const item = items.get(allocation.receivableId);
    if (!item) fail('INVALID_RELATION', 'Un vínculo apunta a un cobro que ya no existe.');
    if (allocation.reversedAt) continue; // Historical links survive deleted movements.
    const transaction = transactionsById.get(allocation.transactionId);
    if (!transaction || transaction.tipo !== 'INGRESO' || transaction.moneda !== item.currency || !isReceivableDate(transaction.fecha)) {
      fail('INVALID_RELATION', 'Un cobro vinculado necesita un ingreso existente, único, con fecha válida y la misma moneda. Desvincúlalo antes de cambiarlo.');
    }
    const amount = receivableMoneyToMinor(transaction.monto);
    if (!positiveMinor(amount)) fail('INVALID_RELATION', 'El ingreso vinculado debe tener un importe válido.');
    const received = checkedAdd(byItem.get(item.id) || 0, allocation.amountMinor);
    const allocated = checkedAdd(byTransaction.get(transaction.id) || 0, allocation.amountMinor);
    if (received > item.amountMinor) fail('OVERALLOCATION', 'El importe esperado no puede ser menor que lo ya vinculado. Ajusta el importe o deshaz los vínculos necesarios.');
    if (allocated > amount) fail('OVERALLOCATION', 'Este ingreso tiene un importe vinculado mayor que el nuevo monto. Deshaz los vínculos necesarios antes de reducirlo.');
    byItem.set(item.id, received);
    byTransaction.set(transaction.id, allocated);
  }
  return { byItem, byTransaction };
}

/** Strict, clock-free backup validation. Missing optional data remains absent in the caller. */
export function normalizeReceivables(value, transactions = []) {
  if (value === undefined) return { version: 1, items: [], allocations: [] };
  if (!record(value) || value.version !== 1 || !Array.isArray(value.items) || !Array.isArray(value.allocations)
    || value.items.length > 100000 || value.allocations.length > 100000 || !Array.isArray(transactions)) {
    fail('INVALID_LEDGER', 'La sección de cobros esperados no es válida.');
  }
  const ledger = { version: 1, items: value.items.map(normalizeItem), allocations: value.allocations.map(normalizeAllocation) };
  indexUnique(ledger.allocations, 'vínculos');
  relationshipTotals(ledger, transactions);
  return ledger;
}
function todayDate(today) {
  if (!isReceivableDate(today)) fail('INVALID_TODAY', 'Se necesita una fecha local válida para revisar el ingreso.');
  return today;
}
const ledgerFor = data => normalizeReceivables(data?.receivables, data?.transacciones || []);
function result(data, ledger, status, ids = {}) { return { data: { ...data, receivables: ledger }, status, ...ids }; }
function findItem(ledger, id) {
  const item = ledger.items.find(row => row.id === id);
  if (!item) fail('NOT_FOUND', 'Este cobro ya no está disponible.');
  return item;
}

export function summarizeReceivables(data, { today } = {}) {
  todayDate(today);
  const transactions = data?.transacciones || [];
  const ledger = ledgerFor(data);
  const { byTransaction } = relationshipTotals(ledger, transactions);
  const transactionsById = new Map(transactions.map(transaction => [transaction.id, transaction]));
  const transactionCounts = new Map();
  for (const transaction of transactions) transactionCounts.set(transaction.id, (transactionCounts.get(transaction.id) || 0) + 1);
  const allocationsByItem = new Map();
  for (const allocation of ledger.allocations) {
    if (!allocationsByItem.has(allocation.receivableId)) allocationsByItem.set(allocation.receivableId, []);
    allocationsByItem.get(allocation.receivableId).push(allocation);
  }
  const inconsistencies = [];
  const totalsByCurrency = Object.fromEntries(currencies.map(currency => [currency, { expectedMinor: 0, receivedMinor: 0, pendingMinor: 0, overdueMinor: 0, cancelledMinor: 0 }]));
  const items = ledger.items.map(item => {
    let receivedMinor = 0;
    const allocations = (allocationsByItem.get(item.id) || []).map(allocation => {
      const transaction = transactionsById.get(allocation.transactionId);
      const needsReview = !allocation.reversedAt && transaction.fecha > today;
      if (needsReview) inconsistencies.push({ allocationId: allocation.id, receivableId: item.id, code: 'FUTURE_INCOME', message: 'Vínculo por revisar: el ingreso tiene una fecha futura.' });
      if (!allocation.reversedAt && !needsReview) receivedMinor = checkedAdd(receivedMinor, allocation.amountMinor);
      return { ...allocation, transaction, needsReview };
    });
    const remainingMinor = item.amountMinor - receivedMinor;
    const pendingMinor = item.cancelledAt ? 0 : remainingMinor;
    const progress = receivedMinor === item.amountMinor ? 'received' : receivedMinor > 0 ? 'partial' : 'unpaid';
    const timing = item.cancelledAt ? 'cancelled' : remainingMinor === 0 ? 'settled' : !item.expectedDate ? 'undated' : item.expectedDate < today ? 'overdue' : item.expectedDate === today ? 'due-today' : 'upcoming';
    const status = item.cancelledAt ? 'cancelled' : progress === 'received' ? 'received' : 'pending';
    const totals = totalsByCurrency[item.currency];
    for (const [key, amount] of Object.entries({ expectedMinor: item.amountMinor, receivedMinor, pendingMinor, overdueMinor: timing === 'overdue' ? pendingMinor : 0, cancelledMinor: item.cancelledAt ? remainingMinor : 0 })) totals[key] = checkedAdd(totals[key], amount);
    return { ...item, receivedMinor, remainingMinor, pendingMinor, progress, timing, status, overdue: timing === 'overdue', allocations };
  });
  const eligibleIncomes = transactions.filter(transaction => validId(transaction.id) && transactionCounts.get(transaction.id) === 1 && transaction.tipo === 'INGRESO' && currencies.includes(transaction.moneda)
    && isReceivableDate(transaction.fecha) && transaction.fecha <= today && positiveMinor(receivableMoneyToMinor(transaction.monto)))
    .map(transaction => ({ transaction, allocatedMinor: byTransaction.get(transaction.id) || 0, availableMinor: receivableMoneyToMinor(transaction.monto) - (byTransaction.get(transaction.id) || 0) }));
  return { items, totalsByCurrency, eligibleIncomes, inconsistencies };
}

export function createReceivable(data, command) {
  const ledger = ledgerFor(data);
  const item = normalizeItem(command);
  if (item.cancelledAt) fail('INVALID_ITEM', 'Un cobro nuevo debe empezar pendiente.');
  const existing = ledger.items.find(row => row.id === item.id);
  if (existing) {
    if (!same(existing, item, itemFields)) fail('IDEMPOTENCY_CONFLICT', 'Este identificador ya corresponde a otro cobro. Revisa el registro antes de repetirlo.');
    return { data, status: 'unchanged', receivableId: item.id };
  }
  return result(data, { ...ledger, items: [...ledger.items, item] }, 'created', { receivableId: item.id });
}

export function updateReceivable(data, { id, before, patch } = {}) {
  const ledger = ledgerFor(data);
  const current = findItem(ledger, id);
  if (!record(before) || !record(patch) || Object.keys(patch).some(key => !editableFields.includes(key))) fail('INVALID_PATCH', 'El cambio de cobro contiene campos no editables.');
  const expected = normalizeItem(before);
  const next = normalizeItem({ ...expected, ...patch });
  if (expected.id !== id) fail('INVALID_PATCH', 'El cobro editado no coincide con el registro original.');
  if (same(current, next, itemFields)) return { data, status: 'unchanged', receivableId: id };
  if (!same(current, expected, itemFields)) fail('CONFLICT', 'Este cobro cambió mientras lo editabas. Revisa la versión actual antes de confirmar.');
  if (next.currency !== current.currency && ledger.allocations.some(allocation => allocation.receivableId === id)) fail('CURRENCY_HISTORY', 'La moneda no puede cambiar después de vincular ingresos. Conserva este historial y crea otro cobro en la moneda correcta.');
  const updated = { ...ledger, items: ledger.items.map(row => row.id === id ? next : row) };
  relationshipTotals(updated, data.transacciones || []);
  return result(data, updated, 'updated', { receivableId: id });
}

export function linkReceivableIncome(data, command, { today } = {}) {
  todayDate(today);
  const ledger = ledgerFor(data);
  const allocation = normalizeAllocation({ ...command, reversedAt: null });
  const existing = ledger.allocations.find(row => row.id === allocation.id);
  if (existing) {
    if (!same(existing, allocation, allocationFields.filter(key => key !== 'reversedAt'))) fail('IDEMPOTENCY_CONFLICT', 'Este identificador ya corresponde a otro vínculo. Revisa el historial antes de repetirlo.');
    return { data, status: existing.reversedAt ? 'reversed' : 'unchanged', receivableId: existing.receivableId, allocationId: existing.id, transactionId: existing.transactionId };
  }
  const item = findItem(ledger, allocation.receivableId);
  if (item.cancelledAt) fail('CANCELLED', 'Reabre este cobro antes de vincular otro ingreso.');
  const transaction = (data.transacciones || []).find(row => row.id === allocation.transactionId);
  if (transaction && isReceivableDate(transaction.fecha) && transaction.fecha > today) fail('FUTURE_INCOME', 'Vincula sólo ingresos con fecha de hoy o anterior.');
  const updated = { ...ledger, allocations: [...ledger.allocations, allocation] };
  relationshipTotals(updated, data.transacciones || []);
  return result(data, updated, 'linked', { receivableId: item.id, allocationId: allocation.id, transactionId: allocation.transactionId });
}

function receivedTransaction(transaction, id) {
  if (!record(transaction) || typeof transaction.descripcion !== 'string' || !transaction.descripcion.trim() || transaction.descripcion.length > 200
    || !positiveMinor(receivableMoneyToMinor(transaction.monto)) || !isReceivableDate(transaction.fecha) || !currencies.includes(transaction.moneda)) {
    fail('INVALID_TRANSACTION', 'Revisa el concepto, importe, fecha y moneda del ingreso recibido.');
  }
  return { id: `receivable-income:${id}`, tipo: 'INGRESO', descripcion: transaction.descripcion.trim(), monto: receivableMoneyToMinor(transaction.monto) / 100, fecha: transaction.fecha, moneda: transaction.moneda, categoria: '', metodoPago: '' };
}
export function receiveReceivableIncome(data, { id, receivableId, transaction, createdAt } = {}, { today } = {}) {
  todayDate(today);
  const income = receivedTransaction(transaction, id);
  const ledger = ledgerFor(data);
  const allocation = normalizeAllocation({ id, receivableId, transactionId: income.id, amountMinor: receivableMoneyToMinor(income.monto), createdAt, reversedAt: null });
  const existing = ledger.allocations.find(row => row.id === id);
  if (existing) {
    const currentTransaction = (data.transacciones || []).find(row => row.id === income.id);
    const sameAllocation = same(existing, allocation, allocationFields.filter(key => key !== 'reversedAt'));
    if (!sameAllocation || (!existing.reversedAt && (!currentTransaction || !same(currentTransaction, income, Object.keys(income))))) fail('IDEMPOTENCY_CONFLICT', 'Este registro ya fue procesado con otros datos. Revisa el ingreso antes de repetirlo.');
    // A reversed operation is a tombstone: a retry never recreates its income.
    if (existing.reversedAt && currentTransaction && !same(currentTransaction, income, Object.keys(income))) fail('IDEMPOTENCY_CONFLICT', 'El ingreso de este vínculo cambió. Revisa el movimiento antes de repetirlo.');
    return { data, status: existing.reversedAt ? 'reversed' : 'unchanged', receivableId, allocationId: id, transactionId: income.id };
  }
  if ((data.transacciones || []).some(row => row.id === income.id)) fail('IDEMPOTENCY_CONFLICT', 'El ingreso ya existe sin este vínculo. Revisa tus movimientos.');
  const linked = linkReceivableIncome({ ...data, transacciones: [income, ...(data.transacciones || [])] }, allocation, { today });
  return { ...linked, status: 'received' };
}

export function unlinkReceivableIncome(data, { id, reversedAt } = {}) {
  const ledger = ledgerFor(data);
  const allocation = ledger.allocations.find(row => row.id === id);
  if (!allocation) fail('NOT_FOUND', 'Este vínculo ya no está disponible.');
  const reversed = normalizeAllocation({ ...allocation, reversedAt });
  if (!reversed.reversedAt) fail('INVALID_TIMESTAMP', 'Se necesita una fecha para desvincular el ingreso.');
  if (allocation.reversedAt) return { data, status: 'unchanged', receivableId: allocation.receivableId, allocationId: id, transactionId: allocation.transactionId };
  return result(data, { ...ledger, allocations: ledger.allocations.map(row => row.id === id ? reversed : row) }, 'unlinked', { receivableId: allocation.receivableId, allocationId: id, transactionId: allocation.transactionId });
}

/** Every movement mutation must pass here, including imports, quick add and undo. */
export function updateTransactionsWithReceivables(data, nextTransactions, { today } = {}) {
  todayDate(today);
  if (!Array.isArray(nextTransactions)) fail('INVALID_TRANSACTIONS', 'La lista de movimientos no es válida.');
  const ledger = ledgerFor(data);
  relationshipTotals(ledger, nextTransactions);
  const nextById = new Map(nextTransactions.map(transaction => [transaction.id, transaction]));
  for (const allocation of ledger.allocations) {
    if (!allocation.reversedAt && nextById.get(allocation.transactionId).fecha > today) fail('FUTURE_INCOME', 'Este ingreso está vinculado a un cobro. Desvincúlalo antes de asignarle una fecha futura.');
  }
  return { data: { ...data, transacciones: nextTransactions }, status: nextTransactions === data.transacciones ? 'unchanged' : 'updated' };
}
