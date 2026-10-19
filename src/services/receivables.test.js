import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExpectedReceivables from '../components/ExpectedReceivables.jsx';
import { createReceivable, linkReceivableIncome, normalizeReceivables, receiveReceivableIncome, summarizeReceivables, unlinkReceivableIncome, updateReceivable, updateTransactionsWithReceivables } from './receivables.js';

const today = '2026-10-18';
const createdAt = '2026-10-18T12:00:00.000Z';
const item = (values = {}) => ({ id: 'expected-1', name: 'Proyecto de diseño', amountMinor: 100000, currency: 'MXN', expectedDate: '2026-10-17', createdAt, cancelledAt: null, ...values });
const income = (values = {}) => ({ id: 'income-1', tipo: 'INGRESO', descripcion: 'Pago de cliente', monto: 600, moneda: 'MXN', fecha: today, categoria: 'Honorarios', metodoPago: 'Transferencia', ...values });
const dataFor = (values = {}) => ({ transacciones: [income()], activos: [{ id: 'bank', monto: 10 }], honorarios: { ingresoMensualRecibido: 25 }, planFinanciero: { unchanged: true }, ...values });
const withExpected = (values = {}) => createReceivable(dataFor(), item(values)).data;
const link = (data, values = {}) => linkReceivableIncome(data, { id: 'link-1', receivableId: 'expected-1', transactionId: 'income-1', amountMinor: 40000, createdAt, ...values }, { today });
const newIncomeCommand = (values = {}) => ({ id: 'receive-1', receivableId: 'expected-1', transaction: income({ id: undefined, monto: 300 }), createdAt, ...values });
const code = (fn, expected) => { try { fn(); throw new Error('Expected rejection'); } catch (error) { expect(error.code).toBe(expected); } };

describe('Expected income ledger', () => {
  it('keeps optional legacy data absent and never treats an expectation as cash', () => {
    const original = dataFor();
    const summary = summarizeReceivables(original, { today });
    expect(summary.items).toEqual([]);
    expect(original).not.toHaveProperty('receivables');
    expect(normalizeReceivables(undefined, original.transacciones)).toEqual({ version: 1, items: [], allocations: [] });
    const result = createReceivable(original, item());
    for (const key of ['transacciones', 'activos', 'honorarios', 'planFinanciero']) expect(result.data[key]).toBe(original[key]);
    expect(original).not.toHaveProperty('receivables');
    expect(result.data.receivables.items[0]).not.toHaveProperty('note');
  });

  it('creates once, rejects ID reuse with another payload and derives overdue/undated states', () => {
    const data = withExpected();
    expect(createReceivable(data, item())).toMatchObject({ data, status: 'unchanged' });
    code(() => createReceivable(data, item({ name: 'Other' })), 'IDEMPOTENCY_CONFLICT');
    expect(summarizeReceivables(data, { today }).items[0]).toMatchObject({ progress: 'unpaid', timing: 'overdue', receivedMinor: 0, remainingMinor: 100000, pendingMinor: 100000 });
    expect(summarizeReceivables(withExpected({ expectedDate: null }), { today }).items[0].timing).toBe('undated');
    expect(summarizeReceivables(withExpected({ expectedDate: today }), { today }).items[0].timing).toBe('due-today');
  });

  it.each([
    [{ amountMinor: 1.1 }, 'INVALID_AMOUNT'], [{ amountMinor: Number.MAX_SAFE_INTEGER + 1 }, 'INVALID_AMOUNT'],
    [{ amountMinor: 0 }, 'INVALID_AMOUNT'], [{ currency: 'EUR' }, 'INVALID_CURRENCY'],
    [{ expectedDate: '2026-02-29' }, 'INVALID_DATE'], [{ expectedDate: '0000-01-01' }, 'INVALID_DATE'],
    [{ createdAt: '2026-02-30T12:00:00.000Z' }, 'INVALID_TIMESTAMP'], [{ name: ' ' }, 'INVALID_NAME'],
    [{ note: 'a'.repeat(2001) }, 'INVALID_NOTE'],
  ])('rejects invalid expected values %j', (patch, expected) => code(() => withExpected(patch), expected));

  it('supports partial receipts and splitting one movement without exceeding either balance', () => {
    let data = link(withExpected()).data;
    data = createReceivable(data, item({ id: 'expected-2', amountMinor: 80000 })).data;
    data = link(data, { id: 'link-2', receivableId: 'expected-2', amountMinor: 20000 }).data;
    const summary = summarizeReceivables(data, { today });
    expect(summary.items[0]).toMatchObject({ receivedMinor: 40000, pendingMinor: 60000, progress: 'partial' });
    expect(summary.eligibleIncomes[0]).toMatchObject({ allocatedMinor: 60000, availableMinor: 0 });
    expect(summary.totalsByCurrency.MXN).toMatchObject({ receivedMinor: 60000, pendingMinor: 120000 });
    expect(summary.totalsByCurrency.USD.pendingMinor).toBe(0);
    code(() => link(data, { id: 'link-3', amountMinor: 1 }), 'OVERALLOCATION');
    code(() => link(withExpected({ amountMinor: 100 }), { amountMinor: 101 }), 'OVERALLOCATION');
  });

  it('requires an existing unique income, matching currency and a nonfuture date', () => {
    const original = withExpected();
    code(() => link(original, { transactionId: 'missing' }), 'INVALID_RELATION');
    for (const transaction of [income({ tipo: 'GASTO' }), income({ moneda: 'USD' }), income({ fecha: 'bad' }), income({ monto: 1.001 })]) {
      code(() => link({ ...original, transacciones: [transaction] }), 'INVALID_RELATION');
    }
    code(() => link({ ...original, transacciones: [income(), income()] }), 'INVALID_RELATION');
    code(() => link({ ...original, transacciones: [income({ fecha: '2026-10-19' })] }), 'FUTURE_INCOME');
  });

  it('retries links exactly once and never reactivates a reversed operation', () => {
    const linked = link(withExpected());
    expect(link(linked.data)).toMatchObject({ status: 'unchanged', data: linked.data });
    code(() => link(linked.data, { amountMinor: 20000 }), 'IDEMPOTENCY_CONFLICT');
    const reversed = unlinkReceivableIncome(linked.data, { id: 'link-1', reversedAt: createdAt });
    expect(reversed.data.transacciones).toBe(linked.data.transacciones);
    expect(link(reversed.data)).toMatchObject({ status: 'reversed', data: reversed.data });
    expect(unlinkReceivableIncome(reversed.data, { id: 'link-1', reversedAt: '2026-10-19T12:00:00.000Z' }).status).toBe('unchanged');
    expect(summarizeReceivables(reversed.data, { today }).items[0].receivedMinor).toBe(0);
  });

  it('creates income and allocation atomically with deterministic identity; retries do not duplicate cash', () => {
    const original = withExpected();
    const result = receiveReceivableIncome(original, newIncomeCommand(), { today });
    expect(result.status).toBe('received');
    expect(result.data.transacciones).toHaveLength(2);
    expect(result.data.transacciones[0]).toMatchObject({ id: 'receivable-income:receive-1', monto: 300, tipo: 'INGRESO', categoria: '' });
    expect(result.data.receivables.allocations[0].amountMinor).toBe(30000);
    expect(receiveReceivableIncome(result.data, newIncomeCommand(), { today })).toMatchObject({ data: result.data, status: 'unchanged' });
    code(() => receiveReceivableIncome(result.data, newIncomeCommand({ transaction: income({ monto: 301 }) }), { today }), 'IDEMPOTENCY_CONFLICT');
    code(() => receiveReceivableIncome(original, newIncomeCommand({ transaction: income({ monto: 1001 }) }), { today }), 'OVERALLOCATION');
    expect(original.transacciones).toHaveLength(1);
    expect(original.receivables.allocations).toHaveLength(0);
  });

  it('preserves reversed history after deleting the movement and does not resurrect it on retry', () => {
    let data = receiveReceivableIncome(withExpected(), newIncomeCommand(), { today }).data;
    data = unlinkReceivableIncome(data, { id: 'receive-1', reversedAt: createdAt }).data;
    data = updateTransactionsWithReceivables(data, data.transacciones.filter(row => row.id === 'income-1'), { today }).data;
    expect(normalizeReceivables(data.receivables, data.transacciones).allocations).toHaveLength(1);
    expect(receiveReceivableIncome(data, newIncomeCommand(), { today })).toMatchObject({ data, status: 'reversed' });
    // After deletion, the schema retains allocation fields, not the original
    // description/date. Even a changed removed payload must never resurrect cash.
    expect(receiveReceivableIncome(data, newIncomeCommand({ transaction: income({ monto: 300, descripcion: 'Payload ya no recuperable', fecha: '2026-10-17' }) }), { today })).toMatchObject({ data, status: 'reversed' });
    expect(data.transacciones).toHaveLength(1);
  });

  it('cancels only the remaining amount, retains history, and reopens with compare-and-swap', () => {
    const data = link(withExpected()).data;
    const before = data.receivables.items[0];
    const command = { id: before.id, before, patch: { cancelledAt: createdAt } };
    const cancelled = updateReceivable(data, command).data;
    expect(summarizeReceivables(cancelled, { today }).items[0]).toMatchObject({ pendingMinor: 0, remainingMinor: 60000, receivedMinor: 40000, timing: 'cancelled' });
    expect(updateReceivable(cancelled, command).status).toBe('unchanged');
    code(() => link(cancelled, { id: 'another', amountMinor: 100 }), 'CANCELLED');
    code(() => updateReceivable(cancelled, { id: before.id, before, patch: { name: 'Changed' } }), 'CONFLICT');
    const reopened = updateReceivable(cancelled, { id: before.id, before: cancelled.receivables.items[0], patch: { cancelledAt: null } }).data;
    expect(summarizeReceivables(reopened, { today }).items[0]).toMatchObject({ pendingMinor: 60000, timing: 'overdue' });
    code(() => updateReceivable(data, { id: before.id, before, patch: { amountMinor: 39999 } }), 'OVERALLOCATION');
    code(() => updateReceivable(data, { id: before.id, before, patch: { currency: 'USD' } }), 'CURRENCY_HISTORY');
  });

  it.each([
    ['delete', []], ['expense', [income({ tipo: 'GASTO' })]], ['currency', [income({ moneda: 'USD' })]],
    ['reduce', [income({ monto: 399.99 })]], ['future', [income({ fecha: '2026-10-19' })]],
  ])('guards linked movement mutation: %s', (_, next) => {
    const data = link(withExpected()).data;
    expect(() => updateTransactionsWithReceivables(data, next, { today })).toThrow();
    expect(data.transacciones[0]).toEqual(income());
  });

  it('allows unrelated transaction edits and edits that preserve a linked income', () => {
    const data = link(withExpected()).data;
    const next = [income({ descripcion: 'Corrección', monto: 500, fecha: '2026-10-16', categoria: 'Otros', custom: true })];
    expect(updateTransactionsWithReceivables(data, next, { today }).data.transacciones).toBe(next);
    expect(updateTransactionsWithReceivables(dataFor(), [], { today }).data).not.toHaveProperty('receivables');
  });

  it('normalizes backups without a clock; future linked income is shown as pending review, not received', () => {
    const data = link(withExpected()).data;
    const future = { ...data, transacciones: [income({ fecha: '2026-10-19' })] };
    expect(normalizeReceivables(future.receivables, future.transacciones)).toEqual(future.receivables);
    const summary = summarizeReceivables(future, { today });
    expect(summary.items[0]).toMatchObject({ receivedMinor: 0, pendingMinor: 100000 });
    expect(summary.items[0].allocations[0].needsReview).toBe(true);
    expect(summary.inconsistencies[0].code).toBe('FUTURE_INCOME');
  });

  it('rejects malformed relationship backups and never mutates frozen source objects', () => {
    const data = withExpected();
    code(() => normalizeReceivables({ ...data.receivables, items: [...data.receivables.items, item()] }, data.transacciones), 'DUPLICATE_ID');
    code(() => normalizeReceivables({ ...data.receivables, version: 2 }, data.transacciones), 'INVALID_LEDGER');
    Object.freeze(data); Object.freeze(data.transacciones); Object.freeze(data.receivables); Object.freeze(data.receivables.items);
    expect(link(data).data.receivables.allocations).toHaveLength(1);
    expect(data.receivables.allocations).toHaveLength(0);
  });

  it('preserves currency meaning after unlinking and allows correcting a never-linked currency', () => {
    const linked = link(withExpected()).data;
    const data = unlinkReceivableIncome(linked, { id: 'link-1', reversedAt: createdAt }).data;
    code(() => updateReceivable(data, { id: 'expected-1', before: data.receivables.items[0], patch: { currency: 'USD' } }), 'CURRENCY_HISTORY');
    const empty = withExpected();
    expect(updateReceivable(empty, { id: 'expected-1', before: empty.receivables.items[0], patch: { currency: 'USD' } }).data.receivables.items[0].currency).toBe('USD');
  });

  it('never offers ambiguous duplicate transaction identities for linking', () => {
    const data = { ...withExpected(), transacciones: [income(), income()] };
    expect(summarizeReceivables(data, { today }).eligibleIncomes).toHaveLength(0);
  });

  it('keeps amounts in their original currencies and renders consultation without edit access', () => {
    let data = withExpected({ expectedDate: null });
    data = createReceivable(data, item({ id: 'usd', currency: 'USD', amountMinor: 50000, expectedDate: null })).data;
    const html = renderToStaticMarkup(createElement(ExpectedReceivables, { financialData: data, readOnly: true, onReceivableCommand: () => {} }));
    expect(html).toContain('Pendiente en MXN');
    expect(html).toContain('Pendiente en USD');
    expect(html).toContain('Sin fecha acordada');
    expect(html).toContain('La edición está pausada');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<svg[\s\S]*?Añadir cobro esperado/);
    expect(html).toContain('aria-label="Estado de los cobros"');
    expect(html).not.toContain('Balance de movimientos');
    expect(html).not.toContain('Resumen del mes');
  });
});
