import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TransactionsTracker from '../components/TransactionsTracker.jsx';
import { formatMoney } from './exchangeRate';
import { getLocalDate, validateTransaction } from './transactionAnalytics';
import { applyTransactionEdit, createTransactionEdit, isUncategorizedTransaction, isWithinTransactionDateLimit, transactionToDraft, undoTransactionEdit } from './transactionEdits';

const transaction = (values = {}) => ({ id: 'bank-1', fecha: '2026-10-17', descripcion: 'Supermercado', monto: 125.5, tipo: 'GASTO', categoria: 'Alimentos', metodoPago: 'Tarjeta', moneda: 'MXN', ...values });
const editFor = (original, values) => createTransactionEdit(original, { ...transactionToDraft(original), ...values }).edit;

describe('Transaction editing and conflict-safe undo', () => {
  it('preserves identity, imported metadata and unrelated concurrent changes', () => {
    const metadata = { bank: 'example', originalRow: 21, identifiers: ['statement-a'] };
    const original = transaction({ metadata, importFingerprint: 'opaque', custom: true });
    const edit = editFor(original, { categoria: 'Servicios' });
    const concurrent = { ...original, metodoPago: 'Débito', reconciliation: { reviewed: true } };
    const unrelated = transaction({ id: 'bank-2' });
    const result = applyTransactionEdit([unrelated, concurrent], edit);
    expect(result.status).toBe('updated');
    expect(result.transactions[0]).toBe(unrelated);
    expect(result.transaction).toEqual({ ...concurrent, categoria: 'Servicios' });
    expect(result.transaction.metadata).toBe(metadata);
    expect(original.categoria).toBe('Alimentos');
  });

  it('validates the draft and excludes attempts to replace id or metadata', () => {
    const original = transaction();
    const invalid = createTransactionEdit(original, { ...transactionToDraft(original), fecha: '2026-02-30', monto: '1.001' });
    expect(invalid.edit).toBeNull();
    expect(invalid.errors).toHaveProperty('fecha');
    expect(invalid.errors).toHaveProperty('monto');
    const edit = editFor(original, { descripcion: '  Compra semanal  ', id: 'replacement', imported: false });
    expect(applyTransactionEdit([original], edit).transaction).toEqual({ ...original, descripcion: 'Compra semanal' });
  });

  it('does not normalize untouched fields or invent a category on save', () => {
    const original = transaction({ monto: '125.50', categoria: undefined, metodoPago: undefined });
    const edit = editFor(original, { descripcion: 'Nueva descripción' });
    expect(edit.changes.map(change => change.field)).toEqual(['descripcion']);
    const result = applyTransactionEdit([original], edit);
    expect(result.transaction.monto).toBe('125.50');
    expect(result.transaction.categoria).toBeUndefined();
    expect(result.transaction.metodoPago).toBeUndefined();
  });

  it('requires an explicit currency for incomplete imports and saves the selected currency', () => {
    for (const moneda of [undefined, null, 42]) {
      const original = transaction({ moneda, importFingerprint: 'original-bank-row' });
      if (moneda === undefined) delete original.moneda;
      const draft = transactionToDraft(original);
      expect(draft.moneda).toBe('');
      expect(validateTransaction(draft)).toHaveProperty('moneda');
      const { edit, errors } = createTransactionEdit(original, { ...draft, moneda: 'MXN' });
      expect(errors).toEqual({});
      expect(edit.changes.map(change => change.field)).toEqual(['moneda']);
      const applied = applyTransactionEdit([original], edit);
      expect(applied.status).toBe('updated');
      expect(applied.transaction).toEqual({ ...original, moneda: 'MXN' });
      expect(validateTransaction(applied.transaction)).toEqual({});
      expect(undoTransactionEdit(applied.transactions, edit).transactions).toEqual([original]);
    }
  });

  it('includes the review cutoff day, excludes future or invalid dates, and allows removing the limit', () => {
    const cutoff = '2026-10-18';
    expect(isWithinTransactionDateLimit(transaction({ fecha: '2026-09-30' }), cutoff)).toBe(true);
    expect(isWithinTransactionDateLimit(transaction({ fecha: cutoff }), cutoff)).toBe(true);
    expect(isWithinTransactionDateLimit(transaction({ fecha: '2026-10-19' }), cutoff)).toBe(false);
    expect(isWithinTransactionDateLimit(transaction({ fecha: '2026-02-30' }), cutoff)).toBe(false);
    expect(isWithinTransactionDateLimit(transaction({ fecha: undefined }), cutoff)).toBe(false);
    expect(isWithinTransactionDateLimit(transaction({ fecha: '2026-10-19' }), null)).toBe(true);
    expect(isWithinTransactionDateLimit(transaction({ fecha: '2026-10-19' }), 'invalid')).toBe(true);
  });

  it('rejects a save when the same field changed after opening the editor', () => {
    const original = transaction();
    const current = { ...original, categoria: 'Vivienda' };
    const input = [current];
    const result = applyTransactionEdit(input, editFor(original, { categoria: 'Servicios' }));
    expect(result.status).toBe('conflict');
    expect(result.transactions).toBe(input);
  });

  it('undoes only unchanged edited fields and keeps later edits and metadata', () => {
    const original = transaction();
    const edit = editFor(original, { categoria: 'Servicios', descripcion: 'Recibo' });
    const saved = applyTransactionEdit([original], edit).transaction;
    const later = { ...saved, categoria: 'Vivienda', monto: 800, importedData: { reference: 9 } };
    const result = undoTransactionEdit([later], edit);
    expect(result.status).toBe('partial');
    expect(result.restoredFields).toEqual(['descripcion']);
    expect(result.skippedFields).toEqual(['categoria']);
    expect(result.transactions[0]).toEqual({ ...later, descripcion: original.descripcion });
  });

  it('does not resurrect deleted records or replace all conflicting values', () => {
    const original = transaction();
    const edit = editFor(original, { categoria: 'Servicios' });
    expect(applyTransactionEdit([], edit).status).toBe('missing');
    expect(undoTransactionEdit([], edit)).toMatchObject({ status: 'missing', transactions: [] });
    const newer = [transaction({ categoria: 'Vivienda' })];
    expect(undoTransactionEdit(newer, edit).transactions).toBe(newer);
    expect(undoTransactionEdit(newer, edit).status).toBe('conflict');
  });

  it('restores field absence, preserves other records, and refuses duplicate ids', () => {
    const original = transaction();
    delete original.categoria;
    const edit = editFor(original, { categoria: 'Otros' });
    const saved = applyTransactionEdit([original], edit).transaction;
    const other = transaction({ id: 'bank-2' });
    const result = undoTransactionEdit([other, saved], edit);
    expect(result.transactions[0]).toBe(other);
    expect(Object.hasOwn(result.transactions[1], 'categoria')).toBe(false);
    expect(applyTransactionEdit([original, original], edit).status).toBe('conflict');
  });

  it('keeps blank categories separate from an explicit Otros category', () => {
    for (const categoria of [undefined, null, '', '  ', 42]) expect(isUncategorizedTransaction({ categoria })).toBe(true);
    for (const categoria of ['Otros', 'Alimentos', 'Sin categoría']) expect(isUncategorizedTransaction({ categoria })).toBe(false);
  });

  it('renders distinct budget drilldowns for unassigned, Otros and a literal Sin categoría name', () => {
    const financialData = { transacciones: [
      transaction({ id: 'a', fecha: getLocalDate(), categoria: undefined, monto: 10 }),
      transaction({ id: 'b', fecha: getLocalDate(), categoria: '  ', monto: 20 }),
      transaction({ id: 'c', fecha: getLocalDate(), categoria: 'Otros', monto: 70 }),
      transaction({ id: 'd', fecha: getLocalDate(), categoria: 'Sin categoría', monto: 40 }),
      transaction({ id: 'e', fecha: getLocalDate(), categoria: '__uncategorized__', monto: 50 }),
    ] };
    const before = structuredClone(financialData);
    const markup = renderToStaticMarkup(createElement(TransactionsTracker, { financialData }));
    const unassigned = markup.match(/aria-label="Ver gastos de Sin categoría en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    const assigned = markup.match(/aria-label="Ver gastos de Sin categoría \(asignada\) en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    const others = markup.match(/aria-label="Ver gastos de Otros en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    expect(unassigned).toContain(formatMoney(30, 'MXN'));
    expect(assigned).toContain(formatMoney(40, 'MXN'));
    expect(others).toContain(formatMoney(70, 'MXN'));
    expect(markup).toContain('aria-label="Editar Supermercado"');
    expect(financialData).toEqual(before);
  });

  it('shows an explicit zero budget and its excess without presenting a percentage', () => {
    const financialData = {
      transacciones: [transaction({ fecha: getLocalDate(), monto: 30 })],
      gastosNecesarios: [{ categoria: 'Alimentos', monto: 0, moneda: 'MXN' }],
    };
    const before = structuredClone(financialData);
    const markup = renderToStaticMarkup(createElement(TransactionsTracker, { financialData }));
    const budget = markup.match(/aria-label="Ver gastos de Alimentos en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    expect(budget).toContain(`${formatMoney(0, 'MXN')} presupuestado`);
    expect(budget).toContain(`${formatMoney(30, 'MXN')} de más`);
    expect(budget).not.toContain('Sin presupuesto');
    expect(budget).not.toContain('role="meter"');
    expect(financialData).toEqual(before);
  });

  it('does not treat an absent or invalid budget as an explicit zero budget', () => {
    for (const invalidBudget of [null, { monto: -10 }, { monto: 'invalid' }, { monto: 0, moneda: 'EUR' }, { monto: 0, moneda: '' }]) {
      const financialData = {
        transacciones: [transaction({ fecha: getLocalDate(), monto: 30 })],
        gastosNecesarios: invalidBudget ? [{ categoria: 'Alimentos', moneda: 'MXN', ...invalidBudget }] : [],
      };
      const before = structuredClone(financialData);
      const markup = renderToStaticMarkup(createElement(TransactionsTracker, { financialData }));
      const budget = markup.match(/aria-label="Ver gastos de Alimentos en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
      expect(budget).toContain('Sin presupuesto');
      expect(budget).not.toContain('presupuestado');
      expect(financialData).toEqual(before);
    }
  });

  it('keeps uncategorized budgets separate from uncategorized spending without inferring available funds', () => {
    const financialData = {
      transacciones: [transaction({ fecha: getLocalDate(), categoria: undefined, monto: 250 })],
      gastosNecesarios: [{ concepto: 'Renta', monto: 15000, moneda: 'MXN' }],
    };
    const before = structuredClone(financialData);
    const markup = renderToStaticMarkup(createElement(TransactionsTracker, { financialData, onNavigateTab: () => {} }));
    const spending = markup.match(/aria-label="Ver gastos de Sin categoría en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    const pendingBudget = markup.match(/class="sf-transactions-unassigned-budget"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    expect(spending).toContain(formatMoney(250, 'MXN'));
    expect(spending).toContain('Categoría por asignar');
    expect(spending).not.toMatch(/%|libre|presupuesto consumido|role="meter"/);
    expect(spending).not.toContain(formatMoney(15000, 'MXN'));
    expect(pendingBudget).toContain('1 concepto del presupuesto sin categoría');
    expect(pendingBudget).toContain(`${formatMoney(15000, 'MXN')} previstos`);
    expect(markup).toContain('Revisar presupuesto');
    expect(financialData).toEqual(before);
  });

  it('counts all uncategorized budget records but withholds a total if any amount is invalid', () => {
    const financialData = {
      gastosNecesarios: [{ concepto: 'Renta', monto: 15000, moneda: 'MXN' }],
      gastosOpcionales: [
        { concepto: 'Transporte', categoria: ' ', monto: 'invalid', moneda: 'MXN' },
        { concepto: 'Hobbies', categoria: 42, monto: 400, moneda: 'MXN' },
      ],
    };
    const before = structuredClone(financialData);
    const markup = renderToStaticMarkup(createElement(TransactionsTracker, { financialData }));
    const pendingBudget = markup.match(/class="sf-transactions-unassigned-budget"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    expect(pendingBudget).toContain('3 conceptos del presupuesto sin categoría');
    expect(pendingBudget).toContain('Importes por revisar');
    expect(pendingBudget).not.toContain('previstos');
    expect(markup).not.toContain('aria-label="Ver gastos de Sin categoría en');
    expect(financialData).toEqual(before);
  });

  it('preserves a real category named Sin categoría and avoids collisions with internal budget keys', () => {
    const financialData = {
      transacciones: [
        transaction({ id: 'unassigned', fecha: getLocalDate(), categoria: '', monto: 250 }),
        transaction({ id: 'assigned', fecha: getLocalDate(), categoria: 'Sin categoría', monto: 40 }),
      ],
      gastosNecesarios: [
        { concepto: 'Renta', monto: 15000, moneda: 'MXN' },
        { categoria: 'Sin categoría', monto: 100, moneda: 'MXN' },
        { categoria: '__uncategorized___budget', monto: 90, moneda: 'MXN' },
      ],
    };
    const before = structuredClone(financialData);
    const markup = renderToStaticMarkup(createElement(TransactionsTracker, { financialData }));
    const assigned = markup.match(/aria-label="Ver gastos de Sin categoría \(asignada\) en [^"]*"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    expect(assigned).toContain(`40% de ${formatMoney(100, 'MXN')}`);
    expect(assigned).toContain(`${formatMoney(60, 'MXN')} libre`);
    expect(markup).toContain('aria-label="Ver gastos de __uncategorized___budget en');
    expect(financialData).toEqual(before);
  });
});
