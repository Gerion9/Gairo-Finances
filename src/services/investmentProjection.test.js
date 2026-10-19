import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Investments from '../components/Investments.jsx';
import { projectMonthlySavings, summarizeCashReserve } from './investmentProjection.js';
import { emptyFinancialData } from './accountData.js';
import { applyPaymentPlan, normalizePaymentPlan } from './paymentPlan.js';
import { managedPlanSections } from './planSourceState.js';

describe('monthly savings simulation', () => {
  it('uses end-of-month contributions and the zero-rate limit', () => {
    const noReturns = projectMonthlySavings({ monthlyContribution: 5000, annualRate: 0, years: 10 });
    expect(noReturns).toMatchObject({ valid: true, contributed: 600000, total: 600000, returns: 0 });
    const result = projectMonthlySavings({ monthlyContribution: 100, annualRate: 12, years: 1 });
    expect(result.total).toBeCloseTo(100 * ((1.01 ** 12 - 1) / 0.01), 8);
    expect(projectMonthlySavings({ monthlyContribution: 100, annualRate: 0.00000001, years: 1 }).total).toBeCloseTo(1200, 5);
  });
  it('keeps losses visible for a negative assumed rate', () => {
    const result = projectMonthlySavings({ monthlyContribution: 100, annualRate: -10, years: 1 });
    expect(result.valid).toBe(true);
    expect(result.returns).toBeLessThan(0);
    expect(result.total).toBeLessThan(result.contributed);
  });
  it.each([{ monthlyContribution: '' }, { monthlyContribution: -1 }, { monthlyContribution: Infinity }, { monthlyContribution: '1e308' }, { annualRate: NaN }, { annualRate: -101 }, { years: 0 }, { years: 2.5 }, { years: 41 }])('rejects invalid input or overflow: %j', invalid => {
    const result = projectMonthlySavings({ monthlyContribution: 5000, annualRate: 9.5, years: 10, ...invalid });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
  });
});

const cash = { id: 'cash', tipo: 'Efectivo', moneda: 'MXN', monto: 3000 };
const data = { activos: [cash], gastosNecesarios: [{ monto: 1000 }] };
const planData = budget => applyPaymentPlan(emptyFinancialData('gairo'), normalizePaymentPlan({
  version: 1, asOf: '2026-10-17', accounts: [],
  assets: [{ id: 'cash', name: 'Efectivo', currency: 'MXN', balance: 2000, balanceDate: '2026-10-17' }],
  budget: { monthlyIncome: 5000, monthlyTax: 100, livingExpenses: null, ...budget },
}));
describe('cash reserve scope', () => {
  it('counts only cash and handles the plan EFECTIVO spelling', () => {
    const financialData = { ...data, activos: [cash, { ...cash, id: 'usd', tipo: 'EFECTIVO', moneda: 'USD', monto: 100 }, { ...cash, id: 'investment', tipo: 'Inversión', monto: 90000 }] };
    const result = summarizeCashReserve({ financialData, monthlyExpenses: 1000, exchangeRate: 20 });
    expect(result).toMatchObject({ amount: 5000, count: 2, coverage: 5, hasUsd: true, progress: 100 });
  });
  it.each([0, null, undefined, NaN, ''])('does not mark zero or unknown expenses complete: %s', monthlyExpenses => {
    expect(summarizeCashReserve({ financialData: data, monthlyExpenses, exchangeRate: 20 })).toMatchObject({ coverage: null, progress: null, expensesKnown: false });
  });
  it('discloses missing cash and partial plan expense data', () => {
    const invalidCash = summarizeCashReserve({ financialData: { ...data, activos: [cash, { ...cash, monto: null }] }, monthlyExpenses: 1000, exchangeRate: 20 });
    expect(invalidCash).toMatchObject({ amount: 3000, excluded: 1, coverage: null, progress: null });
    const partialExpenses = summarizeCashReserve({ financialData: { ...data, gastosNecesarios: [{ monto: 1000, planManaged: true }], planFinanciero: { budget: { expenses: [{ amount: null }] } } }, monthlyExpenses: 1000, exchangeRate: 20 });
    expect(partialExpenses.expensesKnown).toBe(false);
    expect(summarizeCashReserve({ financialData: data, monthlyExpenses: Number.MIN_VALUE, exchangeRate: 20 }).coverage).toBeNull();
  });
  it('calculates coverage from independent expenses when the plan has no living-expense amount', () => {
    const financialData = planData({});
    financialData.gastosNecesarios = [{ id: 'rent', nombre: 'Renta', monto: 900 }];
    financialData.gastosOpcionales = [{ id: 'gift', nombre: 'Regalos', monto: 100 }];
    expect(managedPlanSections(financialData).budget).toBe(false);
    const before = JSON.stringify(financialData);
    const result = summarizeCashReserve({ financialData, monthlyExpenses: 900, exchangeRate: 20 });
    expect(result.expensesKnown).toBe(true);
    expect(result.coverage).toBeCloseTo(2000 / 900, 10);
    expect(result.progress).toBeCloseTo(2000 / 2700 * 100, 10);
    expect(JSON.stringify(financialData)).toBe(before);
  });
  it('keeps a linked partial budget unknown even when projection omits missing amounts', () => {
    const financialData = planData({ expenses: [{ id: 'rent', name: 'Renta', amount: 900 }, { id: 'food', name: 'Comida', amount: null }] });
    expect(managedPlanSections(financialData).budget).toBe(true);
    expect(financialData.gastosNecesarios).toHaveLength(1);
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 900, exchangeRate: 20 })).toMatchObject({ expensesKnown: false, coverage: null, progress: null });
  });
  it('does not let manual additions fill an omitted plan expense in a mixed budget', () => {
    const financialData = planData({ expenses: [{ id: 'rent', name: 'Renta', amount: 900 }, { id: 'food', name: 'Comida', amount: null }] });
    financialData.gastosNecesarios.push({ id: 'manual-food', nombre: 'Comida', monto: 100 });
    expect(managedPlanSections(financialData).budget).toBe(false);
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 1000, exchangeRate: 20 })).toMatchObject({ expensesKnown: false, coverage: null, progress: null });
  });
  it('recognizes projected expense IDs after optional planManaged metadata is removed', () => {
    const financialData = planData({ expenses: [{ id: 'rent', name: 'Renta', amount: 900 }, { id: 'food', name: 'Comida', amount: null }] });
    delete financialData.gastosNecesarios[0].planManaged;
    expect(managedPlanSections(financialData).budget).toBe(true);
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 900, exchangeRate: 20 }).expensesKnown).toBe(false);
    financialData.gastosNecesarios.push({ id: 'manual-food', nombre: 'Comida', monto: 100 });
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 1000, exchangeRate: 20 }).expensesKnown).toBe(false);
  });
  it('retains coverage for a complete linked budget', () => {
    const financialData = planData({ livingExpenses: 900 });
    expect(managedPlanSections(financialData).budget).toBe(true);
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 900, exchangeRate: 20 }).coverage).toBeCloseTo(2000 / 900, 10);
  });
  it('uses a matching recorded balance date without inventing dates', () => {
    const financialData = { ...data, activos: [{ ...cash, planManaged: true }], planFinanciero: { assets: [{ id: 'cash', currency: 'MXN', balance: 3000, balanceDate: '2026-10-10' }] } };
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 1000, exchangeRate: 20 })).toMatchObject({ dates: ['2026-10-10'], allDated: true });
    financialData.activos[0].monto = 4000;
    expect(summarizeCashReserve({ financialData, monthlyExpenses: 1000, exchangeRate: 20 })).toMatchObject({ dates: [], allDated: false });
  });
  it('renders example-rate and unknown-data language without an achieved goal', () => {
    const html = renderToStaticMarkup(React.createElement(Investments, { financialData: { activos: [], gastosNecesarios: [] }, cashFlow: { totalCostodeVida: 0 } }));
    expect(html).toContain('Ahorro e inversión');
    expect(html).toContain('Valor de ejemplo; puedes cambiarlo.');
    expect(html).toContain('Por configurar');
    expect(html).toContain('La referencia de CETES no garantiza este resultado.');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('NaN');
  });
});
