import { describe, expect, it } from 'vitest';
import { filterTransactions, getLocalDate, isValidTransactionDate, moneyToCents, summarizeTransactions, validateDebtPayment, validateTransaction } from './transactionAnalytics';

const expense = (overrides = {}) => ({ fecha: '2026-09-07', descripcion: 'Supermercado', monto: 100, moneda: 'MXN', tipo: 'GASTO', categoria: 'Alimentos', ...overrides });

describe('Ledger totals and budget honesty', () => {
  it('converts both currencies before summing expenses, income and budgets', () => {
    const data = {
      transacciones: [expense(), expense({ monto: 10, moneda: 'USD' }), expense({ monto: 50, moneda: 'USD', tipo: 'INGRESO' })],
      gastosNecesarios: [{ categoria: 'Alimentos', monto: 200 }],
      gastosOpcionales: [{ categoria: 'Alimentos', monto: 5, moneda: 'USD' }],
    };
    const mxn = summarizeTransactions(data, '2026-09', 20, 'MXN');
    expect(mxn).toMatchObject({ expenses: 300, income: 1000, net: 700, currency: 'MXN' });
    expect(mxn.categories[0]).toMatchObject({ budget: 300, spent: 300, percentage: 100 });
    expect(summarizeTransactions(data, '2026-09', 20, 'USD')).toMatchObject({ expenses: 15, income: 50, net: 35, currency: 'USD' });
    expect(summarizeTransactions(data, '2026-09', 20, 'ORIGINAL').currency).toBe('MXN');
  });

  it('preserves zero and absent budgets without invented limits or infinity', () => {
    const result = summarizeTransactions({ transacciones: [expense()], gastosNecesarios: [{ categoria: 'Alimentos', monto: 0 }] }, '2026-09');
    expect(result.categories[0]).toMatchObject({ budget: 0, spent: 100, percentage: null, overBudget: false });
    expect(summarizeTransactions({ transacciones: [expense()] }, '2026-09').categories[0].budget).toBe(0);
  });

  it('retains percentages above 100 and computes the actual excess', () => {
    const result = summarizeTransactions({ transacciones: [expense({ monto: 150 })], gastosNecesarios: [{ categoria: 'Alimentos', monto: 100 }] }, '2026-09');
    expect(result.categories[0]).toMatchObject({ percentage: 150, remaining: -50, overBudget: true });
  });

  it('uses only valid dates in the selected month, including month boundaries', () => {
    const result = summarizeTransactions({ transacciones: [expense({ fecha: '2026-08-31' }), expense({ fecha: '2026-09-01' }), expense({ fecha: '2026-09-30' }), expense({ fecha: '2026-09-31' }), expense({ fecha: '2026-10-01' })] }, '2026-09');
    expect(result.expenses).toBe(200);
    expect(result.transactions).toHaveLength(2);
  });

  it('does not let invalid amounts or unsupported currencies poison totals', () => {
    const result = summarizeTransactions({ transacciones: [expense(), expense({ monto: Infinity }), expense({ monto: -30 }), expense({ moneda: 'EUR' })] }, '2026-09');
    expect(result.expenses).toBe(100);
    expect(result.excludedCount).toBe(3);
  });

  it('adds decimal amounts using integer cents', () => {
    const result = summarizeTransactions({ transacciones: [expense({ monto: 0.1 }), expense({ monto: 0.2 })] }, '2026-09');
    expect(result.expenses).toBe(0.3);
    expect(moneyToCents(19.99)).toBe(1999);
    expect(moneyToCents(1.001)).toBeNull();
  });
});

describe('Transaction and payment validation', () => {
  it('builds the current date from local calendar fields', () => {
    expect(getLocalDate(new Date(2026, 8, 7, 23, 59))).toBe('2026-09-07');
  });

  it('validates calendar dates without UTC rollover or permissive parsing', () => {
    expect(isValidTransactionDate('2024-02-29')).toBe(true);
    for (const date of ['2025-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-9-7', '', '0000-01-01']) expect(isValidTransactionDate(date)).toBe(false);
  });

  it('rejects negative, empty, nonfinite and subcent transaction amounts', () => {
    for (const monto of [-1, 0, '', 'Infinity', NaN, 1.001]) expect(validateTransaction(expense({ monto })).monto).toBeTruthy();
    expect(validateTransaction(expense({ descripcion: '  ', fecha: '2026-02-30' }))).toHaveProperty('descripcion');
    expect(validateTransaction(expense({ fecha: '2026-02-30' }))).toHaveProperty('fecha');
    expect(validateTransaction(expense())).toEqual({});
  });

  it('allows exact payoff and prevents overpayment or invalid payments', () => {
    expect(validateDebtPayment('19.99', 19.99)).toBeNull();
    expect(validateDebtPayment('20', 19.99)).toMatch(/mayor al saldo/);
    for (const amount of [0, -1, NaN, Infinity, '', '1.001']) expect(validateDebtPayment(amount, 100)).toBeTruthy();
    expect(validateDebtPayment(1, 0)).toBeTruthy();
  });

  it('combines filters, searches accents and orders newest first without mutating input', () => {
    const rows = [expense({ fecha: '2026-09-01', metodoPago: 'Débito' }), expense({ fecha: '2026-09-07', metodoPago: 'Débito' }), expense({ tipo: 'INGRESO', metodoPago: 'Débito' })];
    expect(filterTransactions(rows, { type: 'GASTO', category: 'Alimentos', query: 'debito' }).map(row => row.fecha)).toEqual(['2026-09-07', '2026-09-01']);
    expect(rows[0].fecha).toBe('2026-09-01');
    expect(filterTransactions(rows, { category: 'Vivienda' })).toEqual([]);
  });
});
