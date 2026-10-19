import { isValidTransactionDate, moneyToCents, validateTransaction } from './transactionAnalytics';

export const EDITABLE_TRANSACTION_FIELDS = ['fecha', 'descripcion', 'monto', 'tipo', 'categoria', 'metodoPago', 'moneda'];

export function isUncategorizedTransaction(transaction) {
  return typeof transaction?.categoria !== 'string' || transaction.categoria.trim() === '';
}

export function isWithinTransactionDateLimit(transaction, dateThrough) {
  return !isValidTransactionDate(dateThrough) || (isValidTransactionDate(transaction?.fecha) && transaction.fecha <= dateThrough);
}

/** Form values are separate from the imported record and never carry its metadata. */
export function transactionToDraft(transaction) {
  return {
    fecha: typeof transaction.fecha === 'string' ? transaction.fecha : '',
    descripcion: typeof transaction.descripcion === 'string' ? transaction.descripcion : '',
    monto: typeof transaction.monto === 'number' || typeof transaction.monto === 'string' ? String(transaction.monto) : '',
    tipo: typeof transaction.tipo === 'string' ? transaction.tipo : '',
    categoria: isUncategorizedTransaction(transaction) ? '' : transaction.categoria,
    metodoPago: typeof transaction.metodoPago === 'string' ? transaction.metodoPago : '',
    moneda: typeof transaction.moneda === 'string' ? transaction.moneda : '',
  };
}

function normalizedValues(draft) {
  const cents = moneyToCents(draft.monto);
  return {
    ...draft,
    descripcion: typeof draft.descripcion === 'string' ? draft.descripcion.trim() : '',
    monto: cents === null ? draft.monto : cents / 100,
    metodoPago: typeof draft.metodoPago === 'string' ? draft.metodoPago.trim() : '',
  };
}

/** Capture only intentional form changes; id and all bank/import metadata stay intact. */
export function createTransactionEdit(original, draft) {
  const normalized = normalizedValues(draft);
  const errors = validateTransaction(normalized);
  if (Object.keys(errors).length) return { errors, edit: null };
  const before = normalizedValues(transactionToDraft(original));
  return {
    errors: {},
    edit: {
      id: original.id,
      changes: EDITABLE_TRANSACTION_FIELDS.filter(field => !Object.is(before[field], normalized[field])).map(field => ({
        field,
        hadBefore: Object.prototype.hasOwnProperty.call(original, field),
        before: original[field],
        after: normalized[field],
      })),
    },
  };
}

function findCurrent(transactions, edit) {
  if (edit?.id === undefined || edit.id === null || edit.id === '') return { status: 'missing', index: -1 };
  const indices = transactions.flatMap((transaction, index) => transaction.id === edit.id ? [index] : []);
  if (indices.length === 0) return { status: 'missing', index: -1 };
  if (indices.length > 1) return { status: 'conflict', index: -1 };
  return { status: 'found', index: indices[0] };
}

export function applyTransactionEdit(transactions, edit) {
  const found = findCurrent(transactions, edit);
  if (found.index < 0) return { transactions, status: found.status, transaction: null };
  const current = transactions[found.index];
  const changes = edit.changes.filter(change => EDITABLE_TRANSACTION_FIELDS.includes(change.field));
  if (!changes.length) return { transactions, status: 'unchanged', transaction: current };
  const conflicts = changes.filter(change =>
    Object.prototype.hasOwnProperty.call(current, change.field) !== change.hadBefore || !Object.is(current[change.field], change.before));
  if (conflicts.length) return { transactions, status: 'conflict', transaction: current, conflicts: conflicts.map(change => change.field) };
  const updated = { ...current };
  for (const change of changes) updated[change.field] = change.after;
  const next = [...transactions];
  next[found.index] = updated;
  return { transactions: next, status: 'updated', transaction: updated };
}

/** Compare each edited field before undoing it; later edits and deletions win. */
export function undoTransactionEdit(transactions, edit) {
  const found = findCurrent(transactions, edit);
  if (found.index < 0) return { transactions, status: found.status, restoredFields: [], skippedFields: [] };
  const current = transactions[found.index];
  const restoredFields = [];
  const skippedFields = [];
  const updated = { ...current };
  for (const change of edit.changes) {
    if (!EDITABLE_TRANSACTION_FIELDS.includes(change.field)) continue;
    if (!Object.prototype.hasOwnProperty.call(current, change.field) || !Object.is(current[change.field], change.after)) {
      skippedFields.push(change.field);
      continue;
    }
    if (change.hadBefore) updated[change.field] = change.before;
    else delete updated[change.field];
    restoredFields.push(change.field);
  }
  if (!restoredFields.length) return { transactions, status: skippedFields.length ? 'conflict' : 'unchanged', restoredFields, skippedFields };
  const next = [...transactions];
  next[found.index] = updated;
  return { transactions: next, status: skippedFields.length ? 'partial' : 'restored', restoredFields, skippedFields };
}
