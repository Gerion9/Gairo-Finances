import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStrategyPaymentPlan, calculateCashFlow, compareAllStrategies, compareStrategyOutcomes, runStrategySimulation } from './financeEngine.js';

const debt = (values = {}) => ({ id: 'debt-1', nombre: 'Cuenta de prueba', moneda: 'MXN', saldo: 1000, pagoMinimo: 100, tasaAnual: 0, tipo: 'HIGH_INTEREST', ...values });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('Debt payoff projections preserve balances, horizons and units', () => {
  it('does not invent a payoff date when the balance grows through the 120-month limit', () => {
    const result = runStrategySimulation([debt({ tasaAnual: 24, pagoMinimo: 5 })], 0, 20);
    expect(result).toMatchObject({ paidOff: false, capped: true, simulatedMonths: 120, monthsToDebtFree: null, debtFreeDate: null });
    expect(result.remainingBalance).toBeGreaterThan(1000);
    expect(result.history).toHaveLength(121);
    expect(result.history.at(-1).totalBalance).toBe(result.remainingBalance);
  });

  it('reports an empty portfolio as already paid off without generating fictitious months', () => {
    const result = runStrategySimulation([], 0, 20);
    expect(result).toMatchObject({ paidOff: true, capped: false, simulatedMonths: 0, monthsToDebtFree: 0, remainingBalance: 0, totalInterestPaid: 0 });
    expect(result.debtFreeDate).toBeInstanceOf(Date);
    expect(result.history).toHaveLength(1);
  });

  it('does not forgive a positive balance below one peso', () => {
    const result = runStrategySimulation([debt({ saldo: 0.49, pagoMinimo: 0 })], 0, 20);
    expect(result.paidOff).toBe(false);
    expect(result.remainingBalance).toBe(0.49);
    expect(result.debtFreeDate).toBeNull();
  });

  it('keeps an explicit zero contribution and fixed minimums for active debts', () => {
    const result = runStrategySimulation([debt()], 0, 20);
    expect(result.monthsToDebtFree).toBe(10);
    expect(result.history[1]).toMatchObject({ totalBalance: 900, payment: 100 });
    expect(result.history.at(-1)).toMatchObject({ totalBalance: 0, payment: 100 });
    const comparison = compareAllStrategies([debt()], 0, 20);
    expect(comparison.savingsVsMinimums).toMatchObject({ comparable: true, moneySaved: 0, monthsSaved: 0 });
  });

  it('caps the final payment at the outstanding balance including that month interest', () => {
    const result = runStrategySimulation([debt({ saldo: 101, tasaAnual: 12, pagoMinimo: 500 })], 500, 20);
    expect(result.monthsToDebtFree).toBe(1);
    expect(result.history[1]).toMatchObject({ payment: 102.01, totalBalance: 0, totalInterest: 1.01 });
  });

  it('releases paid-off minimums instead of silently reinvesting them', () => {
    const result = runStrategySimulation([debt({ saldo: 100 }), debt({ id: 'debt-2', saldo: 300 })], 0, 20);
    expect(result.history.map(row => row.payment)).toEqual([0, 200, 100, 100]);
  });

  it('converts USD balances and applies an extra denominated in MXN exactly once', () => {
    const debts = [debt({ moneda: 'USD', saldo: 100, pagoMinimo: 10 }), debt({ id: 'debt-2', saldo: 500, pagoMinimo: 50 })];
    const plan = buildStrategyPaymentPlan(debts, 200, 20);
    expect(plan.totalPaymentMXN).toBe(450);
    expect(plan.items[0]).toMatchObject({ paymentMXN: 400, suggestedPayment: 20 });
    expect(plan.items[1]).toMatchObject({ paymentMXN: 50, suggestedPayment: 50 });
    const result = runStrategySimulation(debts, 200, 20);
    expect(result.initialTotalDebt).toBe(2500);
    expect(result.history[1]).toMatchObject({ totalBalance: 2050, payment: 450 });
  });

  it('caps native-currency payments and exposes extra left over after all balances are covered', () => {
    const debts = [debt({ moneda: 'USD', saldo: 50, pagoMinimo: 10 }), debt({ id: 'debt-2', saldo: 100, pagoMinimo: 20 })];
    const plan = buildStrategyPaymentPlan(debts, 2000, 20);
    expect(plan.totalPaymentMXN).toBe(1100);
    expect(plan.unallocatedExtraMXN).toBe(1120);
    expect(plan.items.map(item => item.suggestedPayment)).toEqual([50, 100]);
  });

  it('never consumes other minimum payments to fund a promotion quota', () => {
    const debts = [debt({ id: 'promo', tipo: 'PROMO_DEADLINE', pagoMinimo: 0, promoDeadline: '2026-01-31', tasaRegularPostPromo: 12 }), debt()];
    const plan = buildStrategyPaymentPlan(debts, 50, 20);
    expect(plan.items.map(item => item.paymentMXN)).toEqual([50, 100]);
    expect(plan.totalPaymentMXN).toBe(150);
    expect(plan.promoShortfallMXN).toBe(950);
    const result = runStrategySimulation(debts, 0, 20);
    expect(result.history[1].debts).toEqual([{ id: 'promo', balance: 1000 }, { id: 'debt-1', balance: 900 }]);
    expect(result.promoShortfallMonths).toBeGreaterThan(0);
  });

  it('applies a registered post-promo rate prospectively after its monthly term', () => {
    const result = runStrategySimulation([debt({ saldo: 1200, pagoMinimo: 0, tipo: 'PROMO_DEADLINE', promoDeadline: '2026-01-31', tasaRegularPostPromo: 12 })], 0, 20);
    expect(result.history[1].totalBalance).toBe(1200);
    expect(result.history[2].totalBalance).toBe(1212);
    expect(result.history[2].totalInterest).toBe(12);
  });

  it('uses the post-promo rate in the first month when the promotion has already expired', () => {
    const result = runStrategySimulation([debt({ saldo: 1200, pagoMinimo: 0, tipo: 'PROMO_DEADLINE', promoDeadline: '2025-12-31', tasaRegularPostPromo: 12 })], 0, 20);
    expect(result.history[1].totalBalance).toBe(1212);
  });

  it('makes missing promotion assumptions visible instead of inventing a rate', () => {
    const result = runStrategySimulation([debt({ tipo: 'PROMO_DEADLINE', promoDeadline: '2026-01-31' })], 0, 20);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.warnings.some(warning => warning.includes('sin tasa posterior'))).toBe(true);
    const missingDate = runStrategySimulation([debt({ tipo: 'PROMO_DEADLINE', tasaRegularPostPromo: 12 })], 0, 20);
    expect(missingDate.warnings.some(warning => warning.includes('sin fecha'))).toBe(true);
  });

  it('withholds lifetime savings unless both scenarios reach zero', () => {
    const comparison = compareAllStrategies([debt({ tasaAnual: 24, pagoMinimo: 5 })], 500, 20);
    expect(comparison.gairoCustom.paidOff).toBe(true);
    expect(comparison.minimums.paidOff).toBe(false);
    expect(comparison.savingsVsMinimums).toMatchObject({ comparable: false, moneySaved: null, monthsSaved: null });
  });

  it('preserves negative differences instead of presenting them as zero savings', () => {
    expect(compareStrategyOutcomes({ paidOff: true, totalInterestPaid: 150, monthsToDebtFree: 5 }, { paidOff: true, totalInterestPaid: 100, monthsToDebtFree: 4 })).toMatchObject({ comparable: true, moneySaved: -50, monthsSaved: -1 });
  });

  it('does not mutate caller-owned debt objects or reorder the portfolio', () => {
    const debts = Object.freeze([Object.freeze(debt({ moneda: 'USD', saldo: 50, pagoMinimo: 5 })), Object.freeze(debt({ id: 'debt-2', tasaAnual: 12 }))]);
    const before = JSON.stringify(debts);
    compareAllStrategies(debts, 100, 20);
    buildStrategyPaymentPlan(debts, 100, 20);
    expect(JSON.stringify(debts)).toBe(before);
  });
});

describe('Simulation input validation', () => {
  it.each([-1, NaN, Infinity, '100', null, undefined, true])('rejects ambiguous or invalid extra contributions: %s', value => {
    expect(() => runStrategySimulation([debt()], value, 20)).toThrow();
  });
  it.each([0, -1, NaN, Infinity, '20', null, undefined])('rejects invalid exchange rates: %s', value => {
    expect(() => runStrategySimulation([debt()], 0, value)).toThrow();
  });
  it.each([{ saldo: -1 }, { saldo: Infinity }, { saldo: '100' }, { pagoMinimo: NaN }, { pagoMinimo: -5 }, { tasaAnual: '12' }, { tasaAnual: -1 }, { moneda: 'EUR' }, { tasaRegularPostPromo: Infinity }, { tipo: 'PROMO_DEADLINE', promoDeadline: 'invalid' }, { tipo: 'PROMO_DEADLINE', promoDeadline: '2026-02-31' }])('rejects invalid debt fields: %j', value => {
    expect(() => runStrategySimulation([debt(value)], 0, 20)).toThrow();
  });
  it('rejects invalid portfolios and unknown strategies', () => {
    expect(() => runStrategySimulation(null, 0, 20)).toThrow();
    expect(() => runStrategySimulation([null], 0, 20)).toThrow();
    expect(() => runStrategySimulation([debt()], 0, 20, 'UNKNOWN')).toThrow();
  });
});

describe('Cash-flow minimums match current outstanding balances', () => {
  it('excludes repaid debts and caps each active minimum before converting its currency', () => {
    const data = { honorarios: {}, deudas: [debt({ saldo: 0, pagoMinimo: 900 }), debt({ id: 'usd', moneda: 'USD', saldo: 50, pagoMinimo: 100 }), debt({ id: 'small', saldo: 25, pagoMinimo: 100 })] };
    const result = calculateCashFlow(data, 20);
    expect(result.totalPagosMinimosMXN).toBe(1025);
    expect(result.flujoLibreReal).toBe(-1025);
  });
});
