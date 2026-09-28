import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { normalizePaymentPlan, transferTerms, normalizeScenario, applyPaymentPlan } from './paymentPlan.js';
import { bridgeCapacity, dailyYieldComparison, recommendPayments, deadlineFeasibility } from './paymentRecommendation.js';
import { emptyFinancialData } from './accountData.js';
import { createAccountBackup, restoreAccountBackup } from './backup.js';
import PaymentStrategy from '../components/PaymentStrategy.jsx';

const card = (id, currency, balance, extra = {}) => ({ id, name: id, currency, balance, balanceDate: '2026-09-28', minimum: 100, dueDate: '2026-10-02', paymentToAvoidInterest: balance, lastInterest: 0, tranches: [{ id: 'regular', label: 'Saldo', balance, type: 'REVOLVING', apr: 90, dayBasis: 360 }], ...extra });
function fixture(extra = {}) {
  return normalizePaymentPlan({ version: 1, asOf: '2026-09-28', accounts: [card('expensive', 'MXN', 2000)], assets: [], ...extra,
    budget: { monthlyIncome: 1000, monthlyTax: 0, livingExpenses: 0, payday: 1, ...extra.budget },
    recommendation: { from: '2026-09-28', emergencyMXN: 0, usdBuffer: 0, ...extra.recommendation },
    settings: { fx: 1, remittanceFeeUSD: 0, receiverFeeUSD: 0, ...extra.settings } });
}
const asset = (balance, currency = 'MXN') => ({ id: 'cash-' + currency, name: 'Disponible', currency, balance, balanceDate: '2026-09-28' });

describe('Recomendación con caja y vencimientos separados', () => {
  it('conserva el presupuesto pendiente y no lo convierte en gasto confirmado de cero', () => {
    const p = fixture({ budget: { livingExpenses: null } });
    expect(recommendPayments(p, 1).expenses.missing).toEqual(['Gastos de vida']);
  });
  it('detecta un mínimo que llegaría después del vencimiento aunque alcance el total mensual', () => {
    const p = fixture({ accounts: [card('expensive', 'MXN', 2000, { minimum: 200 })], assets: [asset(100)], budget: { payday: 15 } });
    const r = recommendPayments(p, 1);
    expect(r.shortfall).toBe(0);
    expect(r.lateMinimums).toEqual(['expensive']);
  });
  it('no elimina un vencimiento USD anterior ni lo registra como pagado', () => {
    const p = fixture({ accounts: [card('USD', 'USD', 2000, { dueDate: '2026-09-20' })] });
    const r = recommendPayments(p, 1);
    expect(r.overdueAccounts).toEqual(['USD']);
    expect(r.events.some(e => e.due === '2026-09-20')).toBe(true);
  });
  it('incluye cuota de préstamo conocida y no la duplica con una reserva manual', () => {
    const p = fixture({ accounts: [card('loan', 'USD', 2000, { kind: 'LOAN', minimum: 100 })], recommendation: { loanMonthlyUSD: 120 } });
    const r = recommendPayments(p, 1);
    expect(r.loanMonthlyUSDUsed).toBe(120);
    expect(r.usdPayments).toBe(120);
  });
  it('distingue el efectivo en dólares y dos vencimientos del mismo crédito', () => {
    const p = fixture({ accounts: [card('USD', 'USD', 2000, { dueDate: '2026-09-28', paymentToAvoidInterest: null })], assets: [asset(500, 'USD')] });
    const r = recommendPayments(p, 2);
    expect(r.events.filter(e => e.accountId === 'USD')).toHaveLength(2);
    expect(r.usdRemaining).toBe(300);
    expect(r.savingsContribution).toBe(0);
  });
  it('no declara un puente financiado si otro pago MXN deja el mes en negativo', () => {
    const p = fixture({ accounts: [card('expensive', 'MXN', 2000, { tranches: [{ id: 'r', label: 'r', balance: 2000, type: 'REVOLVING', apr: 999 }] }), card('other', 'MXN', 5000, { minimum: 5000 }), card('Discover', 'USD', 100, { minimum: 0, autopayAmount: 0 })], assets: [asset(2500, 'USD')] });
    const r = recommendPayments(p, 1), b = bridgeCapacity(p, r, 1);
    expect(r.minimumCash).toBeLessThan(0);
    expect(b.wouldClear).toBe(false);
  });
  it('preserva condiciones del asesor al respaldar y restaurar, sin cambiar gastos reales', () => {
    const p = fixture({ budget: { livingExpenses: null, expenses: [{ id: 'food', name: 'Comida', amount: null }] }, recommendation: { expenseEstimates: [{ id: 'food', amount: 200 }], transferDepositConfirmed: true, nuRateEnd: '2026-10-07' } });
    const data = applyPaymentPlan(emptyFinancialData('gairo'), p);
    const restored = restoreAccountBackup(createAccountBackup(data, 'gairo'), 'gairo');
    expect(restored.planFinanciero.recommendation).toEqual(p.recommendation);
    expect(restored.planFinanciero.budget.expenses[0].amount).toBeNull();
    expect(recommendPayments(p, 1).expenses.total).toBe(200);
  });
  it('excluye Capital One de las transferencias hacia Discover', () => {
    const p = fixture({ accounts: [card('Capital One Savor', 'USD', 500, { id: 'savor' }), card('Discover', 'USD', 100)] });
    const s = normalizeScenario({ transfer: { enabled: true, sourceId: 'savor', amount: 100, date: '2026-10-01', feeAtZero: true } });
    expect(transferTerms(p, s).errors.join(' ')).toContain('Capital One');
  });
});

describe('Rendimiento y límites de la comparación', () => {
  it('calcula abono diario con base360 y capitalización a centavos', () => {
    expect(dailyYieldComparison(10000, 36, 2, { from: '2026-09-28', credit: 'DAILY' }).accrued).toBe(20.01);
  });
  it('no confunde devengo de Plata con efectivo abonado', () => {
    const r = dailyYieldComparison(10000, 36, 4, { from: '2026-09-28', credit: 'UNPOSTED' });
    expect(r.accrued).toBe(40);
    expect(r.credited).toBe(0);
  });
  it('mantiene pendientes las tasas desconocidas y aplica topes al indicador de un día', () => {
    expect(dailyYieldComparison(50000, null, 1, { from: '2026-09-28' }).accrued).toBeNull();
    expect(dailyYieldComparison(50000, 13, 1, { from: '2026-09-28' }).accrued).toBe(9.03);
    expect(dailyYieldComparison(50000, 15, 1, { from: '2026-09-28', excessRate: 9 }).accrued).toBe(16.67);
  });
  it('conserva visible una entrada inválida mientras calcula con los últimos datos válidos', () => {
    const p = fixture();
    const html = renderToStaticMarkup(createElement(PaymentStrategy, { plan: p, editableRecommendation: { ...p.recommendation, savingsDays: 366 }, fx: 1, onChange() {} }));
    expect(html).toContain('Días a comparar');
    expect(html).toContain('value="366"');
    expect(html).not.toContain('NaN');
  });
  it('deja de devengar al vencer, pero puede abonar lo devengado antes', () => {
    const r = dailyYieldComparison(10000, 36, 4, { from: '2026-09-28', rateEnd: '2026-09-29', credit: 'MONTHLY' });
    expect(r.accrued).toBe(20);
    expect(r.credited).toBe(20);
    expect(r.supportedDays).toBe(2);
  });
  it('añade un bono una vez y sólo en la comparación activada', () => {
    const p = fixture({ accounts: [card('promo', 'USD', 3000, { paymentToAvoidInterest: null, tranches: [{ id: 'promo', label: 'Promo', balance: 3000, type: 'PROMO', apr: 0, promoEnd: '2026-12-20' }] })], scenario: { bonus: { enabled: true, amount: 250, date: '2026-11-15' } } });
    const r = recommendPayments(p, 1), base = deadlineFeasibility(p, r, 1), extra = deadlineFeasibility(p, r, 1, true);
    expect(extra[0].available - base[0].available).toBe(250);
  });
  it('renderiza tablas, supuestos y controles sin datos personales en el componente', () => {
    const p = fixture();
    const html = renderToStaticMarkup(createElement(PaymentStrategy, { plan: p, fx: 1, onChange() {} }));
    expect(html).toContain('Calendario recomendado del primer ciclo');
    expect(html).toContain('El rendimiento diario sirve para los apartados');
    expect(html).not.toContain('NaN');
  });
});
