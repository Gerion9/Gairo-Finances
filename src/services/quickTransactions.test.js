import { describe, expect, it } from 'vitest';
import { validateTransaction } from './transactionAnalytics';
import { createQuickDraft, createQuickTransaction, getRecentQuickTransactions, insertQuickTransaction, quickDraftFromRecent, undoQuickTransaction } from './quickTransactions';

const record = (values = {}) => ({ id: 'imported-1', fecha: '2026-10-17', descripcion: 'Compra semanal', monto: 125.5, tipo: 'GASTO', moneda: 'MXN', categoria: 'Alimentos', metodoPago: 'Tarjeta', ...values });
const created = (values = {}) => createQuickTransaction(record(values), 'new-1').transaction;

describe('Quick transaction templates and creation', () => {
  it('starts with today, an empty description and amount, and no assumed category', () => {
    expect(createQuickDraft('2026-10-19')).toEqual({ fecha: '2026-10-19', descripcion: '', monto: '', tipo: 'GASTO', categoria: '', metodoPago: '', moneda: 'MXN' });
  });

  it('offers at most five valid recent records in descending date order without mutating input', () => {
    const transactions = Array.from({ length: 8 }, (_, index) => record({ id: `bank-${index}`, fecha: `2026-10-${String(index + 1).padStart(2, '0')}` }));
    const before = structuredClone(transactions);
    const recent = getRecentQuickTransactions(transactions);
    expect(recent.map(item => item.fecha)).toEqual(['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04']);
    expect(transactions).toEqual(before);
  });

  it('excludes incomplete and invalid imports safely before offering templates', () => {
    const invalid = [null, undefined, 42, record({ fecha: '2026-02-30' }), record({ descripcion: '' }), record({ descripcion: 42 }), record({ monto: 0 }), record({ monto: -1 }), record({ monto: '1.001' }), record({ moneda: undefined }), record({ moneda: 'EUR' }), record({ tipo: 'OTHER' })];
    expect(getRecentQuickTransactions([...invalid, record()])).toHaveLength(1);
    expect(quickDraftFromRecent(record({ moneda: undefined }), '2026-10-19')).toBeNull();
  });

  it('strips identity and import metadata from recents and replaces only their date with today', () => {
    const original = record({ importSource: 'statement.pdf', importFingerprint: 'bank-row', metadata: { source: 3 }, reconciled: true });
    const before = structuredClone(original);
    const [recent] = getRecentQuickTransactions([original]);
    expect(Object.keys(recent).sort()).toEqual(['fecha', 'descripcion', 'monto', 'tipo', 'categoria', 'metodoPago', 'moneda'].sort());
    const draft = quickDraftFromRecent(recent, '2026-10-19');
    expect(draft).toEqual({ ...recent, fecha: '2026-10-19' });
    expect(original).toEqual(before);
  });

  it('creates a new identity and editable values without transferring origin, flags or hidden fields', () => {
    const original = record({ importSource: 'bank', metadata: { row: 1 }, paymentPlanId: 'plan', reconciled: true, descripcion: '  Compra  ', monto: '125.50', metodoPago: '  Tarjeta  ', categoria: undefined });
    const before = structuredClone(original);
    const { transaction, errors } = createQuickTransaction({ ...original, fecha: '2026-10-19' }, 'fresh-id');
    expect(errors).toEqual({});
    expect(transaction).toEqual({ id: 'fresh-id', fecha: '2026-10-19', descripcion: 'Compra', monto: 125.5, tipo: 'GASTO', moneda: 'MXN', categoria: '', metodoPago: 'Tarjeta' });
    expect(validateTransaction(transaction)).toEqual({});
    expect(original).toEqual(before);
  });

  it('rejects invalid dates, fractional cents, missing currency and missing identity', () => {
    const result = createQuickTransaction(record({ fecha: '2026-02-30', monto: '1.001', moneda: undefined }), '');
    expect(result.transaction).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual(['fecha', 'moneda', 'monto', 'form'].sort());
  });

  it('inserts immutably, preserving other records and refusing duplicate identities or invalid amounts', () => {
    const existing = record();
    const transactions = [existing];
    const transaction = created();
    const inserted = insertQuickTransaction(transactions, transaction);
    expect(inserted.status).toBe('inserted');
    expect(inserted.transactions).toEqual([transaction, existing]);
    expect(inserted.transactions[1]).toBe(existing);
    expect(transactions).toEqual([existing]);
    expect(insertQuickTransaction(inserted.transactions, transaction)).toEqual({ transactions: inserted.transactions, status: 'conflict' });
    expect(insertQuickTransaction(transactions, { ...transaction, monto: 0 })).toEqual({ transactions, status: 'invalid' });
  });
});

describe('Quick transaction undo', () => {
  it('removes only the intact created record and preserves other identities and values', () => {
    const transaction = created();
    const unrelated = record();
    const transactions = [unrelated, { ...transaction }];
    const result = undoQuickTransaction(transactions, transaction);
    expect(result.status).toBe('removed');
    expect(result.transactions).toEqual([unrelated]);
    expect(result.transactions[0]).toBe(unrelated);
    expect(transactions).toHaveLength(2);
  });

  it('preserves every later edit, including new metadata or removed fields', () => {
    const transaction = created();
    const withoutCategory = { ...transaction };
    delete withoutCategory.categoria;
    for (const current of [{ ...transaction, monto: 999 }, { ...transaction, categoria: 'Otros' }, { ...transaction, imported: undefined }, withoutCategory]) {
      const transactions = [current];
      const result = undoQuickTransaction(transactions, transaction);
      expect(result.status).toBe('conflict');
      expect(result.transactions).toBe(transactions);
    }
  });

  it('keeps the creation snapshot separate even if an inserted record is later mutated in place', () => {
    const transaction = created();
    const inserted = insertQuickTransaction([], transaction);
    inserted.transactions[0].descripcion = 'Actualización posterior';
    expect(transaction.descripcion).toBe('Compra semanal');
    expect(undoQuickTransaction(inserted.transactions, transaction).status).toBe('conflict');
  });

  it('never resurrects a deletion or removes duplicated identities', () => {
    const transaction = created();
    const empty = [];
    expect(undoQuickTransaction(empty, transaction)).toEqual({ transactions: empty, status: 'missing' });
    const duplicates = [transaction, { ...transaction }];
    expect(undoQuickTransaction(duplicates, transaction)).toEqual({ transactions: duplicates, status: 'conflict' });
  });
});
