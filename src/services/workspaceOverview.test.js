import { describe, expect, it } from 'vitest';
import { emptyFinancialData, hasFinancialRecords } from './accountData.js';
import { createReceivable, linkReceivableIncome } from './receivables.js';
import { hasWorkspaceActivity, hasWorkspacePlan, workspaceReceivables } from './workspaceOverview.js';

const today = '2026-10-18';
const createdAt = '2026-10-18T12:00:00.000Z';
const item = (id, values = {}) => ({ id, name: `Cobro ${id}`, amountMinor: 100000, currency: 'MXN', expectedDate: today, createdAt, cancelledAt: null, ...values });
const withItems = items => ({ ...emptyFinancialData('gairo'), receivables: { version: 1, items, allocations: [] } });
const plan = () => ({ version: 1, asOf: today, sources: [], accounts: [], assets: [], budget: { monthlyIncome: 0, monthlyTax: 0, expenses: [], tuitionPayments: [] } });

describe('Workspace activity is a presentation predicate', () => {
  it('keeps an empty space empty and ignores preferences and product selections', () => {
    expect(hasWorkspaceActivity(emptyFinancialData('gairo'))).toBe(false);
    expect(hasWorkspaceActivity()).toBe(false);
    expect(hasWorkspaceActivity(null)).toBe(false);
    expect(hasWorkspaceActivity({ preferences: { marketSelections: { version: 1, ownedCardIds: ['card'], savingsProductIds: [] } } })).toBe(false);
  });
  it('routes expected and historic receivables to their workspace without changing financial-record semantics', () => {
    for (const values of [{}, { cancelledAt: createdAt }]) {
      const data = withItems([item('one', values)]);
      const original = JSON.stringify(data);
      expect(hasFinancialRecords(data)).toBe(false);
      expect(hasWorkspaceActivity(data)).toBe(true);
      expect(JSON.stringify(data)).toBe(original);
    }
    expect(hasWorkspaceActivity({ receivables: { version: 9, items: [{ id: 'future' }] } })).toBe(true);
  });
  it('retains existing record activity and accepts only a valid payment plan as additional activity', () => {
    expect(hasWorkspaceActivity({ transacciones: [{ id: 'record' }] })).toBe(true);
    const valid = { ...emptyFinancialData('gairo'), planFinanciero: plan() };
    const original = JSON.stringify(valid);
    expect(hasWorkspacePlan(valid)).toBe(true);
    expect(hasWorkspaceActivity(valid)).toBe(true);
    expect(hasFinancialRecords(valid)).toBe(false);
    expect(hasWorkspaceActivity({ planFinanciero: { version: 2 } })).toBe(false);
    expect(JSON.stringify(valid)).toBe(original);
  });
});

describe('Workspace receivable presentation', () => {
  it('uses date order, leaves undated items last and excludes cancelled items', () => {
    const data = withItems([
      item('undated', { expectedDate: null }),
      item('upcoming', { expectedDate: '2026-10-25' }),
      item('cancelled', { expectedDate: '2026-09-01', cancelledAt: createdAt }),
      item('overdue', { expectedDate: '2026-10-17', currency: 'USD' }),
    ]);
    const original = JSON.stringify(data);
    expect(workspaceReceivables(data, { today })).toMatchObject({ status: 'ready', pendingCount: 3, representative: { id: 'overdue', currency: 'USD', pendingMinor: 100000 } });
    expect(workspaceReceivables(withItems([data.receivables.items[0]]), { today }).representative.expectedDate).toBeNull();
    expect(JSON.stringify(data)).toBe(original);
  });
  it('uses the remaining amount after a partial receipt without adding expected money to cash or budgets', () => {
    const original = { ...emptyFinancialData('gairo'), transacciones: [{ id: 'income', tipo: 'INGRESO', descripcion: 'Pago', monto: 400, moneda: 'USD', fecha: today }] };
    const created = createReceivable(original, item('usd', { currency: 'USD' })).data;
    const linked = linkReceivableIncome(created, { id: 'allocation', receivableId: 'usd', transactionId: 'income', amountMinor: 40000, createdAt }, { today }).data;
    const snapshot = JSON.stringify(linked);
    const overview = workspaceReceivables(linked, { today });
    expect(overview.representative).toMatchObject({ currency: 'USD', pendingMinor: 60000, progress: 'partial' });
    expect(JSON.stringify(linked)).toBe(snapshot);
    expect(linked.activos).toBe(original.activos);
    expect(linked.honorarios).toBe(original.honorarios);
  });
  it('distinguishes a settled ledger from an unreadable one without inventing zero on failure', () => {
    const data = withItems([item('cancelled', { cancelledAt: createdAt })]);
    expect(workspaceReceivables(data, { today })).toMatchObject({ status: 'ready', hasItems: true, pendingCount: 0, representative: null });
    expect(workspaceReceivables(emptyFinancialData('gairo'), { today })).toMatchObject({ status: 'ready', hasItems: false, pendingCount: 0 });
    expect(workspaceReceivables({ receivables: { version: 2, items: [], allocations: [] } }, { today })).toEqual({ status: 'error', hasItems: true, pendingCount: null, representative: null, needsReview: true });
  });
  it('does not count a fully received item and leaves future linked income pending review', () => {
    const base = { ...emptyFinancialData('gairo'), transacciones: [{ id: 'income', tipo: 'INGRESO', descripcion: 'Pago', monto: 1000, moneda: 'MXN', fecha: today }] };
    const created = createReceivable(base, item('one')).data;
    const linked = linkReceivableIncome(created, { id: 'allocation', receivableId: 'one', transactionId: 'income', amountMinor: 100000, createdAt }, { today }).data;
    expect(workspaceReceivables(linked, { today })).toMatchObject({ pendingCount: 0, representative: null });
    const future = { ...linked, transacciones: [{ ...linked.transacciones[0], fecha: '2026-10-19' }] };
    expect(workspaceReceivables(future, { today })).toMatchObject({ pendingCount: 1, needsReview: true, representative: { pendingMinor: 100000 } });
  });
});
