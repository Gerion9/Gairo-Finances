import { getLocalDate, moneyToCents, validateTransaction } from './transactionAnalytics';
import { transactionToDraft } from './transactionEdits';

export function createQuickDraft(today = getLocalDate()) {
  return { fecha: today, descripcion: '', monto: '', tipo: 'GASTO', categoria: '', metodoPago: '', moneda: 'MXN' };
}

/** Recent entries are templates, never copies of bank identities or import metadata. */
export function getRecentQuickTransactions(transactions = []) {
  return transactions
    .filter(transaction => transaction && typeof transaction === 'object')
    .map(transactionToDraft)
    .filter(draft => Object.keys(validateTransaction(draft)).length === 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5);
}

export function quickDraftFromRecent(transaction, today = getLocalDate()) {
  const draft = transactionToDraft(transaction || {});
  if (Object.keys(validateTransaction(draft)).length) return null;
  return { ...draft, fecha: today };
}

/** The caller supplies a new identity; only explicitly editable fields survive. */
export function createQuickTransaction(draft, id) {
  const values = transactionToDraft(draft || {});
  const errors = validateTransaction(values);
  if (typeof id !== 'string' || !id.trim()) errors.form = 'No se pudo identificar el movimiento. Intenta de nuevo.';
  if (Object.keys(errors).length) return { transaction: null, errors };
  return {
    errors: {},
    transaction: {
      ...values,
      id,
      descripcion: values.descripcion.trim(),
      monto: moneyToCents(values.monto) / 100,
      metodoPago: values.metodoPago.trim(),
    },
  };
}

export function insertQuickTransaction(transactions, transaction) {
  if (!transaction?.id || Object.keys(validateTransaction(transactionToDraft(transaction))).length) {
    return { transactions, status: 'invalid' };
  }
  if (transactions.some(item => item.id === transaction.id)) return { transactions, status: 'conflict' };
  return { transactions: [{ ...transaction }, ...transactions], status: 'inserted' };
}

/** Undo removes only the exact new record; later edits and deletions always win. */
export function undoQuickTransaction(transactions, created) {
  if (!created?.id) return { transactions, status: 'missing' };
  const matches = transactions.filter(transaction => transaction.id === created.id);
  if (!matches.length) return { transactions, status: 'missing' };
  if (matches.length !== 1) return { transactions, status: 'conflict' };
  const current = matches[0];
  const keys = Reflect.ownKeys(created);
  if (Reflect.ownKeys(current).length !== keys.length || keys.some(key => !Object.hasOwn(current, key) || !Object.is(current[key], created[key]))) {
    return { transactions, status: 'conflict' };
  }
  return { transactions: transactions.filter(transaction => transaction.id !== created.id), status: 'removed' };
}
