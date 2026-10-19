import { describe, expect, it } from 'vitest';
import {
  consolidatedCurrency, displayAmount, ledgerPeriod, localDateKey, monthlyFlow,
  nearestPromo, parseLocalDate, pendingPayments, summarizeBalances, summarizeLedger,
} from './dashboardAnalytics.js';
import { calculateCashFlow } from './financeEngine.js';
import { summarizeTransactions } from './transactionAnalytics.js';

describe('Dashboard currency and balance aggregation', () => {
  const data = {
    deudas: [
      { id: 'mxn', saldo: 60.125, moneda: 'MXN' },
      { id: 'usd', saldo: 2, moneda: 'USD' },
      { id: 'zero', saldo: 0, moneda: 'MXN' },
    ],
    activos: [{ monto: 50, moneda: 'MXN' }, { monto: 1, moneda: 'USD' }],
  };

  it('consolidates before comparing, preserves precision, and includes every debt', () => {
    const before = JSON.stringify(data);
    const result = summarizeBalances(data, 20, 'MXN');
    expect(result.debt).toBe(100.125);
    expect(result.assets).toBe(70);
    expect(result.netWorth).toBe(-30.125);
    expect(result.debts.map((debt) => debt.id)).toEqual(['mxn', 'usd', 'zero']);
    expect(result.debts.reduce((sum, debt) => sum + debt.amount, 0)).toBe(result.debt);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('uses a homogeneous USD basis for assets, liabilities, and net worth', () => {
    const result = summarizeBalances(data, 20, 'USD');
    expect(result.debt).toBeCloseTo(5.00625);
    expect(result.assets).toBe(3.5);
    expect(result.netWorth).toBeCloseTo(-1.50625);
    expect(result.debts[1].amount).toBe(2);
  });

  it('keeps ORIGINAL consolidated in MXN with original debt fields intact', () => {
    expect(consolidatedCurrency('ORIGINAL')).toBe('MXN');
    expect(displayAmount(100, 'ORIGINAL', 20)).toBe(100);
    const result = summarizeBalances(data, 20, 'ORIGINAL');
    expect(result.debts[1]).toMatchObject({ saldo: 2, moneda: 'USD', amount: 40 });
    expect(result.debt).toBe(100.125);
  });

  it('returns an honest empty balance without fabricated assets', () => {
    expect(summarizeBalances({}, 20, 'MXN')).toMatchObject({ debts: [], debt: 0, assets: 0, netWorth: 0, assetCount: 0 });
  });

  it('does not disguise invalid or negative balances as zero', () => {
    const result = summarizeBalances({ deudas: [{ saldo: -10, moneda: 'MXN' }, { saldo: 100, moneda: 'MXN' }, null], activos: [{ monto: 'invalid', moneda: 'MXN' }] }, 20, 'MXN');
    expect(result.debt).toBeNull();
    expect(result.assets).toBeNull();
    expect(result.netWorth).toBeNull();
    expect(result.invalidDebtCount).toBe(2);
    expect(result.invalidAssetCount).toBe(1);
    expect(result.debts[0]).toMatchObject({ amount: 100, isValid: true });
    expect(result.debts[1]).toMatchObject({ amount: null, isValid: false });
  });
});

describe('Monthly budget waterfall', () => {
  const cashFlow = {
    fiscal: { netoEnCuenta: 1000, otrosIngresos: 100, totalImpuestosSat: 100 },
    totalCostodeVida: 800,
    totalGastosOpcionales: 150,
    totalPagosMinimosMXN: 200,
    flujoLibreReal: -150,
  };

  it('reconciles every signed component and retains a deficit', () => {
    const flow = monthlyFlow(cashFlow, 'MXN', 20);
    expect(flow.steps.map((step) => step.amount)).toEqual([1000, 100, -100, -800, -150, -200, -150]);
    expect(flow.steps[5]).toMatchObject({ start: 50, end: -150 });
    expect(flow.steps[6]).toMatchObject({ start: 0, end: -150 });
    expect(flow.income).toBe(1100);
    expect(flow.expenses).toBe(1250);
    expect(flow.free).toBe(-150);
    expect(flow.reconciliationDifference).toBe(0);
  });

  it('converts the entire waterfall and its endpoints to USD', () => {
    const flow = monthlyFlow(cashFlow, 'USD', 20);
    expect(flow.free).toBe(-7.5);
    expect(flow.income).toBe(55);
    expect(flow.expenses).toBe(62.5);
    expect(flow.steps[5]).toMatchObject({ start: 2.5, end: -7.5, amount: -10 });
  });

  it('matches the existing finance engine without deducting the extra contribution twice', () => {
    const data = {
      honorarios: { importeFacturado: 12000, otrosIngresos: 400 },
      gastosNecesarios: [{ monto: 1200 }], gastosOpcionales: [{ monto: 300 }],
      deudas: [{ pagoMinimo: 25, moneda: 'USD' }],
      config: { aportacionExtraMensual: 750 },
    };
    const engine = calculateCashFlow(data, 20);
    const flow = monthlyFlow(engine, 'MXN', 20);
    expect(flow.free).toBe(engine.flujoLibreReal);
    expect(flow.reconciliationDifference).toBeCloseTo(0);
    expect(flow.steps.find((step) => step.id === 'other').amount).toBe(400);
  });

  it('exposes inconsistent totals instead of silently rewriting the financial result', () => {
    const flow = monthlyFlow({ ...cashFlow, flujoLibreReal: 10 }, 'MXN', 20);
    expect(flow.free).toBe(10);
    expect(flow.reconciliationDifference).toBe(160);
  });

  it('keeps an empty budget at zero', () => {
    const flow = monthlyFlow({}, 'MXN', 20);
    expect(flow.free).toBe(0);
    expect(flow.steps.every((step) => step.amount === 0)).toBe(true);
    expect(flow.reconciliationDifference).toBe(0);
  });
});

describe('Local calendar periods and recorded activity', () => {
  const now = new Date(2026, 8, 7, 23, 59);
  const transactions = [
    { id: 'old', fecha: '2026-08-31', tipo: 'GASTO', monto: 900, moneda: 'MXN' },
    { id: 'income', fecha: '2026-09-01', tipo: 'INGRESO', monto: 2000, moneda: 'MXN' },
    { id: 'today', fecha: '2026-09-07', tipo: 'GASTO', monto: 10, moneda: 'USD' },
    { id: 'future', fecha: '2026-09-08', tipo: 'GASTO', monto: 700, moneda: 'MXN' },
  ];

  it('parses date-only strings in local time and rejects rollover dates', () => {
    const date = parseLocalDate('2026-09-01');
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(8);
    expect(date.getHours()).toBe(0);
    expect(localDateKey(new Date(2026, 8, 1, 23, 59))).toBe('2026-09-01');
    expect(parseLocalDate('2026-02-29')).toBeNull();
    expect(parseLocalDate('2024-02-29').getDate()).toBe(29);
    expect(parseLocalDate('2026-09-01T00:00:00Z')).toBeNull();
    expect(parseLocalDate('2026-13-01')).toBeNull();
  });

  it('uses the current month through today, excluding future and prior records', () => {
    const result = summarizeLedger(transactions, 'current', now, 20, 'MXN');
    expect(result.rows.map((row) => row.id)).toEqual(['today', 'income']);
    expect(result.income).toBe(2000);
    expect(result.expenses).toBe(200);
    expect(result.net).toBe(1800);
    expect(result.startKey).toBe('2026-09-01');
    expect(result.endKey).toBe('2026-09-07');
  });

  it('keeps the previous month separate and handles year and leap-month boundaries', () => {
    const previous = summarizeLedger(transactions, 'previous', now, 20, 'USD');
    expect(previous.rows.map((row) => row.id)).toEqual(['old']);
    expect(previous.expenses).toBe(45);
    expect(ledgerPeriod('previous', new Date(2026, 0, 3))).toMatchObject({ startKey: '2025-12-01', endKey: '2025-12-31' });
    expect(ledgerPeriod('previous', new Date(2024, 2, 1))).toMatchObject({ startKey: '2024-02-01', endKey: '2024-02-29' });
  });

  it.each([
    ['MXN', { income: 0.87, expenses: 15.61, net: -14.74 }],
    ['USD', { income: 0.06, expenses: 0.81, net: -0.75 }],
    ['ORIGINAL', { income: 0.87, expenses: 15.61, net: -14.74 }],
  ])('matches the transaction ledger in %s after rounding mixed-currency records individually', (currency, expected) => {
    const amounts = [
      ['GASTO', 'USD', 0.01], ['GASTO', 'USD', 0.01], ['GASTO', 'USD', 0.01],
      ['GASTO', 'MXN', 1.25], ['GASTO', 'MXN', 13.79],
      ['INGRESO', 'USD', 0.01], ['INGRESO', 'USD', 0.01], ['INGRESO', 'USD', 0.01],
      ['INGRESO', 'MXN', 0.10], ['INGRESO', 'MXN', 0.10], ['INGRESO', 'MXN', 0.10],
    ];
    const records = amounts.map(([tipo, moneda, monto], index) => ({ id: `rounding-${index}`, fecha: '2026-09-06', tipo, moneda, monto }));
    const before = JSON.stringify(records);
    const dashboard = summarizeLedger(records, 'current', now, 19.257, currency);
    const ledger = summarizeTransactions({ transacciones: records }, '2026-09', 19.257, currency);
    expect(dashboard.rows).toHaveLength(records.length);
    expect(dashboard).toMatchObject(expected);
    expect(dashboard.income).toBe(ledger.income);
    expect(dashboard.expenses).toBe(ledger.expenses);
    expect(dashboard.net).toBe(ledger.net);
    expect(dashboard.rows.find((row) => row.id === 'rounding-0').amount).toBe(currency === 'USD' ? 0.01 : 0.19);
    expect(JSON.stringify(records)).toBe(before);
  });

  it('uses the ledger monetary validation for fractional cents', () => {
    const records = [
      { id: 'valid', fecha: '2026-09-06', tipo: 'GASTO', moneda: 'USD', monto: 0.01 },
      { id: 'fractional', fecha: '2026-09-06', tipo: 'GASTO', moneda: 'USD', monto: 0.015 },
    ];
    const dashboard = summarizeLedger(records, 'current', now, 19.257, 'MXN');
    const ledger = summarizeTransactions({ transacciones: records }, '2026-09', 19.257, 'MXN');
    expect(dashboard.rows.map((row) => row.id)).toEqual(['valid']);
    expect(dashboard.invalidCount).toBe(ledger.excludedCount);
    expect(dashboard.expenses).toBe(ledger.expenses);
  });

  it('excludes malformed records visibly rather than treating them as real spending', () => {
    const valid = transactions[2];
    const result = summarizeLedger([
      valid,
      { ...valid, fecha: 'invalid' },
      { ...valid, monto: -4 },
      { ...valid, monto: null },
      { ...valid, monto: '' },
      { ...valid, monto: Infinity },
      { ...valid, moneda: 'EUR' },
      { ...valid, tipo: 'TRANSFERENCIA' },
    ], 'current', now, 20, 'MXN');
    expect(result.rows).toHaveLength(1);
    expect(result.expenses).toBe(200);
    expect(result.invalidCount).toBe(7);
  });

  it('does not fabricate records or mutate source ordering', () => {
    const before = JSON.stringify(transactions);
    summarizeLedger(transactions, 'current', now, 20, 'MXN');
    expect(JSON.stringify(transactions)).toBe(before);
    expect(summarizeLedger([], 'current', now, 20, 'MXN')).toMatchObject({ rows: [], income: 0, expenses: 0, net: 0, invalidCount: 0 });
  });
});

describe('Payment dates and promotion notices', () => {
  it('includes the manual tax provision once and requires exact payment confirmation', () => {
    const data = { honorarios: { modo: 'MANUAL', provisionFiscalMensual: 500, diaPagoImpuestos: 20 }, gastosNecesarios: [{ id: 'provision-fiscal', monto: 500, diaPago: 20 }], pagosRealizadosMes: { '2026-10': { 'provision-fiscal': 'false' } } };
    const result = pendingPayments(data, new Date(2026, 9, 18), 20, 'MXN');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'provision-fiscal', kind: 'Provisión fiscal', dateKey: '2026-10-20', amount: 500 });
    data.pagosRealizadosMes['2026-10']['provision-fiscal'] = true;
    expect(pendingPayments(data, new Date(2026, 9, 18), 20, 'MXN')).toEqual([]);
  });
  it('limits a pending minimum payment to the remaining balance', () => {
    const data = { deudas: [{ id: 'small', saldo: 10, pagoMinimo: 100, moneda: 'MXN', diaPagoLimite: 7 }] };
    const result = pendingPayments(data, new Date(2026, 8, 7), 20, 'MXN');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ originalAmount: 10, amount: 10 });
    expect(data.deudas[0].pagoMinimo).toBe(100);
  });

  it('caps the payment in its original currency before converting', () => {
    const data = { deudas: [{ id: 'usd-small', saldo: 10, pagoMinimo: 100, moneda: 'USD', diaPagoLimite: 7 }] };
    const now = new Date(2026, 8, 7);
    expect(pendingPayments(data, now, 20, 'MXN')[0]).toMatchObject({ originalAmount: 10, amount: 200 });
    expect(pendingPayments(data, now, 20, 'USD')[0]).toMatchObject({ originalAmount: 10, amount: 10 });
  });

  it('uses registered dates and the current checklist, preserving unconfirmed past dates', () => {
    const now = new Date(2026, 8, 7, 23, 59);
    const data = {
      deudas: [
        { id: 'due', saldo: 200, pagoMinimo: 10, moneda: 'USD', diaPagoLimite: 7 },
        { id: 'paid', saldo: 100, pagoMinimo: 20, moneda: 'MXN', diaPagoLimite: 1 },
        { id: 'settled', saldo: 0, pagoMinimo: 50, moneda: 'MXN', diaPagoLimite: 2 },
        { id: 'undated', saldo: 100, pagoMinimo: 20, moneda: 'MXN' },
      ],
      gastosNecesarios: [{ id: 'past', monto: 50, diaPago: 1 }, { id: 'zero', monto: 0, diaPago: 1 }],
      gastosOpcionales: [{ id: 'future', monto: 30, diaPago: 12 }],
      pagosRealizadosMes: { '2026-09': { paid: true }, '2026-08': { past: true } },
    };
    const result = pendingPayments(data, now, 20, 'USD');
    expect(result.map((item) => item.id)).toEqual(['past', 'due', 'future']);
    expect(result.map((item) => item.daysRemaining)).toEqual([-6, 0, 5]);
    expect(result[1].amount).toBe(10);
    expect(result[0].amount).toBe(2.5);
  });

  it('clamps a monthly day 31 to February end without rolling into March', () => {
    const result = pendingPayments({ gastosNecesarios: [{ id: 'rent', monto: 100, diaPago: 31 }] }, new Date(2026, 1, 27), 20, 'MXN');
    expect(result[0].dateKey).toBe('2026-02-28');
    expect(result[0].daysRemaining).toBe(1);
    expect(pendingPayments({}, new Date(), 20, 'MXN')).toEqual([]);
  });

  it('derives promotion proximity from local dates, skipping paid, invalid, and distant items', () => {
    const now = new Date(2026, 8, 7, 23, 59);
    const promotions = [
      { id: 'paid', saldo: 0, promoDeadline: '2026-09-01' },
      { id: 'today', saldo: 50, promoDeadline: '2026-09-07', daysRemaining: -1 },
      { id: 'future', saldo: 20, promoDeadline: '2027-01-01' },
      { id: 'invalid', saldo: 50, promoDeadline: '2026-02-30' },
    ];
    expect(nearestPromo(promotions, now)).toMatchObject({ id: 'today', daysRemaining: 0 });
    expect(nearestPromo([promotions[2]], now)).toBeNull();
    expect(nearestPromo([], now)).toBeNull();
  });
});
