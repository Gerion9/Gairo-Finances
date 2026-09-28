import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import { normalizePaymentPlan, normalizeScenario, simulatePaymentPlan, applyPaymentPlan, tuitionForPeriod, planTotals, transferTerms, compareRemittanceQuotes, estimateYield, mergePlanHistories, livingBudgetSummary } from './paymentPlan.js';
import { emptyFinancialData } from './accountData.js';
import { createAccountBackup, restoreAccountBackup } from './backup.js';
import { buildAIContext } from './aiContext.js';
import { validateContext } from '../../server/ai/protocol.js';
import { buildFinancialWorkbook } from './excelExport.js';
import PaymentPlan from '../components/PaymentPlan.jsx';

const tranche = (overrides = {}) => ({ id: 'regular', label: 'Saldo ordinario', balance: 1000, apr: 36.5, type: 'REVOLVING', dayBasis: 365, ...overrides });
const account = (overrides = {}) => ({ id: 'card', name: 'Tarjeta de prueba', institution: 'Banco de prueba', currency: 'MXN', balance: 1000, balanceDate: '2026-09-27', minimum: 100, dueDate: '2026-10-20', tranches: [tranche()], ...overrides });
function fixture(overrides = {}) {
  return normalizePaymentPlan({ version: 1, asOf: '2026-09-27', accounts: [account()], ...overrides,
    budget: { monthlyIncome: 1000, monthlyTax: 0, livingExpenses: 0, payday: 1, tuitionPaymentCount: 4, ...overrides.budget },
    settings: { fx: 1, horizon: 3, monthlyDebtBudget: 100, strategy: 'MINIMUMS', remittanceFeeUSD: 0, receiverFeeUSD: 0, interestTaxPercentMXN: 0, ...overrides.settings },
  });
}
const simulate = (p, scenario) => simulatePaymentPlan(p, { scenario });
const transferScenario = (overrides = {}) => normalizeScenario({ transfer: { enabled: true, sourceId: 'card', amount: 1000, date: '2026-09-27', feeAtZero: true, ...overrides } });
const transferPlan = (overrides = {}) => fixture({ accounts: [account({ currency: 'USD' }), account({ id: 'discover', name: 'Discover', currency: 'USD', minimum: 0, balance: 0, tranches: [tranche({ balance: 0, apr: 0 })] })], ...overrides });

describe('Conciliación financiera sin datos inventados', () => {
  it('conserva ceros, nulos, cuotas y fuentes al respaldar la cuenta', () => {
    const plan = fixture({ accounts: [account({ minimumIncludesInstallments: false, tranches: [tranche({ apr: 0 })] })] });
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    const restored = restoreAccountBackup(JSON.parse(JSON.stringify(createAccountBackup(data, 'gairo'))), 'gairo');
    expect(restored.planFinanciero).toEqual(plan);
    expect(restored.deudas).toEqual([]);
    expect(restored.deudasPendientes).toHaveLength(1);
    expect(restored.planFinanciero.accounts[0].requiredPayment).toBeNull();
  });
  it('rechaza saldos sin conciliación, fechas imposibles e IDs duplicados', () => {
    expect(() => fixture({ accounts: [account({ balance: 1001 })] })).toThrow('no concilian');
    expect(() => fixture({ asOf: '2026-02-30' })).toThrow('fecha');
    expect(() => fixture({ accounts: [account(), account()] })).toThrow('repetidos');
  });
  it('conserva notas extensas en el plan sin exceder el límite del adaptador', () => {
    const p = fixture({ accounts: [account({ note: 'x'.repeat(4000) })] });
    const data = applyPaymentPlan(emptyFinancialData('gairo'), p);
    expect(data.deudasPendientes[0].notas.length).toBe(4000);
    const restored = restoreAccountBackup(createAccountBackup(data, 'gairo'), 'gairo');
    expect(restored.planFinanciero.accounts[0].note).toHaveLength(4000);
  });
  it('cuenta monedas por separado y reemplaza inventario anterior una sola vez', () => {
    const plan = fixture({ accounts: [account(), account({ id: 'dollar', currency: 'USD' })] });
    const old = emptyFinancialData('gairo');
    old.deudasPendientes = [{ id: 'old-group', saldoEstimado: 999, moneda: 'USD', numeroCuentas: 2 }];
    const data = applyPaymentPlan(old, plan);
    expect(planTotals(data.planFinanciero).debts).toEqual({ MXN: 1000, USD: 1000 });
    expect(data.deudasPendientes.map(a => a.id)).toEqual(['card', 'dollar']);
  });
  it('sincroniza presupuesto, contexto y exportación con la conciliación', () => {
    const p = fixture({ budget: { monthlyIncome: 5000, monthlyTax: 200, livingExpenses: 800, tuitionPayments: [{ date: '2026-10-10', amount: 600 }] } });
    const old = emptyFinancialData('gairo'); old.gastosNecesarios = [{ id: 'rent', nombre: 'Renta', monto: 800 }];
    const data = applyPaymentPlan(old, p);
    expect(data.gastosNecesarios.reduce((s, r) => s + r.monto, 0)).toBe(1400);
    const ctx = buildAIContext(data, { rate: 1 });
    expect(() => validateContext(ctx)).not.toThrow();
    expect(ctx.facts.find(r => r.id === 'budget.tax').amount).toBe(200);
    const wb = buildFinancialWorkbook(data, 1);
    expect(wb.SheetNames).toContain('Tramos y promociones');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Créditos conciliados'], { header: 1 });
    expect(rows.find(r => r[0] === 'Total MXN')[2]).toBe(1000);
  });
  it('integra pagos actuales y provisión futura sin duplicar mensualidades', () => {
    const p = fixture({ budget: { tuitionPayments: [{ date: '2026-10-10', amount: 1200 }, { date: '2027-01-10', amount: 1300 }], quarterlyTuition: 6000, tuitionPaymentCount: 4, tuitionProvisionStart: '2027-01-01' } });
    expect(tuitionForPeriod(p, '2026-09-27', '2026-10-27')).toEqual({ amount: 1200, isProvision: false });
    expect(tuitionForPeriod(p, '2026-12-27', '2027-01-27')).toEqual({ amount: 1300, isProvision: false });
    expect(tuitionForPeriod(p, '2027-01-27', '2027-02-27')).toEqual({ amount: 1500, isProvision: true });
  });
  it('conserva categorías desconocidas y descuenta los gastos que sí se conocen', () => {
    const p = fixture({ budget: { expenses: [{ id: 'rent', name: 'Renta', amount: 1100 }, { id: 'food', name: 'Comida', amount: null }] } });
    expect(livingBudgetSummary(p)).toEqual({ known: 1100, total: null, missing: ['Comida'] });
    const r = simulate(p); expect(r.budgetComplete).toBe(false); expect(r.history[1].fundingGap).toBe(200);
    const data = applyPaymentPlan(emptyFinancialData('gairo'), p);
    expect(data.gastosNecesarios).toHaveLength(1); expect(data.gastosNecesarios[0].monto).toBe(1100);
    expect(restoreAccountBackup(createAccountBackup(data, 'gairo'), 'gairo').planFinanciero.budget.expenses[1].amount).toBeNull();
    expect(() => fixture({ budget: { expenses: [{ id: 'unnamed', name: '', amount: 100 }] } })).toThrow('nombre de una categoría');
  });
  it('mover una categoría actualiza el abono disponible y conserva el detalle por crédito', () => {
    const p = fixture({ budget: { expenses: [{ id: 'food', name: 'Comida', amount: 300 }] }, settings: { monthlyDebtBudget: null, strategy: 'AVALANCHE', horizon: 1 } });
    const r = simulate(p); expect(r.history[1].paid).toBe(700); expect(r.monthlyBreakdown[0].accounts[0].payment).toBe(700);
    p.budget.expenses[0].amount = 500;
    const adjusted = normalizePaymentPlan(p); expect(adjusted.budget.livingExpenses).toBe(500); expect(simulate(adjusted).history[1].paid).toBe(500);
  });
});

describe('Pagos, intereses y suficiencia', () => {
  it('conserva principal más interés menos pagos en centavos', () => {
    const r = simulate(fixture());
    expect(r.history[1]).toMatchObject({ interest: 30, paid: 100, debt: 930, required: 100 });
    for (let i = 1; i < r.history.length; i++) expect(r.history[i].debt).toBeCloseTo(r.history[i - 1].debt + r.history[i].interest - r.history[i].paid, 2);
  });
  it('no convierte tasas, cuotas o fechas promocionales desconocidas en cero', () => {
    for (const t of [tranche({ apr: null }), tranche({ apr: 0, type: 'PROMO' }), tranche({ type: 'DEFERRED' })]) {
      const r = simulate(fixture({ accounts: [account({ tranches: [t] })] }));
      expect(r.excluded).toHaveLength(1); expect(r.payoffDate).toBeNull(); expect(r.fullCoverage).toBe(false);
    }
    const r = simulate(fixture({ accounts: [account({ minimum: 0, minimumIncludesInstallments: false, tranches: [tranche({ type: 'INSTALLMENT', apr: 0 })] })] }));
    expect(r.budgetComplete).toBe(false); expect(r.funded).toBe(false); expect(r.warnings.join(' ')).toContain('Faltan cuotas');
  });
  it('respeta mínimos inclusivos sin limitarse al saldo ordinario', () => {
    const p = fixture({ accounts: [account({ balance: 1020, minimumIncludesInstallments: true, tranches: [tranche({ balance: 20, apr: 0 }), tranche({ id: 'msi', balance: 1000, apr: 0, type: 'INSTALLMENT', monthlyPayment: 50 })] })] });
    const r = simulate(p); expect(r.history[1].required).toBe(100);
    expect(r.history[1].minimumShortfall).toBe(0); expect(r.history[1].paid).toBe(100);
  });
  it('no afirma viabilidad con mínimos sin cubrir aunque sobre ingreso', () => {
    const r = simulate(fixture({ settings: { monthlyDebtBudget: 10 } }));
    expect(r.history[1].minimumShortfall).toBe(90); expect(r.funded).toBe(false);
  });
  it('acepta ahorros autorizados como fondos, no como ingreso recurrente', () => {
    const p = fixture({ accounts: [account({ balance: 2000, tranches: [tranche({ balance: 2000, apr: 0 })] })], assets: [{ id: 'cash', name: 'Reserva', currency: 'MXN', balance: 1000, balanceDate: '2026-09-27' }], settings: { monthlyDebtBudget: 1000, strategy: 'AVALANCHE' } });
    const r = simulate(p, { useSavings: true, savingsAmount: 1000 });
    expect(r.history[1]).toMatchObject({ paid: 2000, debt: 0, surplus: -1000, fundingGap: 0, savingsUsed: 1000, liquidity: 0 });
    expect(r.funded).toBe(true); expect(r.payoffDate).not.toBeNull();
  });
  it('no cobra una remesa ficticia al usar dólares ya disponibles', () => {
    const p = fixture({ accounts: [account({ currency: 'USD', tranches: [tranche({ apr: 0 })] })], budget: { monthlyIncome: 0 }, assets: [{ id: 'usd', name: 'Efectivo USD', currency: 'USD', balance: 1000, balanceDate: '2026-09-27' }], settings: { monthlyDebtBudget: 0, strategy: 'AVALANCHE', remittanceFeeUSD: 10 } });
    const r = simulate(p, { useSavings: true, savingsAmount: 1000 });
    expect(r.history[1]).toMatchObject({ paid: 1000, debt: 0, fees: 0, fundingGap: 0 });
  });
  it('no reduce los mínimos por una comisión cuando el efectivo USD cubre el periodo', () => {
    const p = fixture({ accounts: [account({ currency: 'USD', tranches: [tranche({ apr: 0 })] })], assets: [{ id: 'usd', name: 'Efectivo USD', currency: 'USD', balance: 200, balanceDate: '2026-09-27' }], settings: { monthlyDebtBudget: 100, remittanceFeeUSD: 10, horizon: 1 } });
    expect(simulate(p).history[1]).toMatchObject({ paid: 100, fees: 0, minimumShortfall: 0 });
  });
  it('el presupuesto provisional de mínimos incluye el costo de remesa conocido', () => {
    const p = fixture({ accounts: [account({ currency: 'USD', tranches: [tranche({ apr: 0 })] })], budget: { livingExpenses: null }, settings: { monthlyDebtBudget: null, remittanceFeeUSD: 10, horizon: 1 } });
    expect(simulate(p).history[1]).toMatchObject({ paid: 100, fees: 10, minimumShortfall: 0, fundingGap: 0 });
  });
  it('no reutiliza dólares que se convirtieron para pagar una deuda en pesos', () => {
    const p = fixture({ accounts: [account({ minimum: 0, tranches: [tranche({ apr: 0 })] }), account({ id: 'usdcard', currency: 'USD', minimum: 0, tranches: [tranche({ apr: 0 })] })], assets: [{ id: 'usd', name: 'Dólares disponibles', currency: 'USD', balance: 1000, balanceDate: '2026-09-27' }], budget: { monthlyIncome: 0 }, settings: { monthlyDebtBudget: 0, horizon: 2, strategy: 'AVALANCHE', remittanceFeeUSD: 10 } });
    const r = simulate(p, { useSavings: true, savingsAmount: 1000, bonus: { enabled: true, amount: 1000, date: '2026-11-01' } });
    expect(r.history[1].paid).toBe(1000); expect(r.history[2]).toMatchObject({ paid: 990, fees: 10, debt: 10 });
    expect(r.budgetComplete).toBe(false); expect(r.warnings.join(' ')).toContain('conversión inversa');
  });
  it('concede gracia por pagos reales de la cuenta y conserva el PNGI tras créditos', () => {
    const p = fixture({ accounts: [account({ balance: 2000, lastInterest: 0, paymentToAvoidInterest: 1100, tranches: [tranche(), tranche({ id: 'low', apr: 1 })] })], settings: { monthlyDebtBudget: 1100, strategy: 'AVALANCHE', horizon: 1 } });
    const r = simulate(p); expect(r.history[1]).toMatchObject({ paid: 1100, interest: 0, debt: 900 });
    p.settings.monthlyDebtBudget = 1099;
    expect(simulate(p).history[1].interest).toBeGreaterThan(0);
  });
  it('mantiene gracia sin concederla a otra cuenta por compartir presupuesto', () => {
    const p = fixture({ accounts: [account({ id: 'expensive', tranches: [tranche({ apr: 90 })] }), account({ id: 'grace', lastInterest: 0, paymentToAvoidInterest: 1000 })], settings: { monthlyDebtBudget: 1000, strategy: 'AVALANCHE', horizon: 1 } });
    const r = simulate(p); expect(r.history[1].interest).toBeGreaterThan(100);
  });
  it('no repite una cuota excluida después de las mensualidades documentadas', () => {
    const p = fixture({ accounts: [account({ minimum: 0, minimumIncludesInstallments: false, tranches: [tranche({ type: 'INSTALLMENT', apr: null, monthlyPayment: 100, paymentsRemaining: 2 })] }), account({ id: 'other' })] });
    expect(simulate(p).history.slice(1).map(r => r.reservedUnknown)).toEqual([100, 100, 0]);
  });
});

describe('Promociones y traspasos', () => {
  it('cobra el interés entre vencimiento y pago, aunque se pague todo el principal', () => {
    const p = fixture({ accounts: [account({ tranches: [tranche({ type: 'PROMO', apr: 0, promoEnd: '2026-10-10', postApr: 36.5 })] })], settings: { monthlyDebtBudget: 1000, strategy: 'AVALANCHE', horizon: 1 } });
    const r = simulate(p); expect(r.history[1]).toMatchObject({ paid: 1000, interest: 9, debt: 9 }); expect(r.payoffDate).toBeNull();
    p.accounts[0].dueDate = '2026-10-05'; expect(simulate(p).history[1].interest).toBe(0);
  });
  it('detiene la curva al cruzar una tasa posterior desconocida', () => {
    const p = fixture({ accounts: [account({ tranches: [tranche({ type: 'PROMO', apr: 0, promoEnd: '2026-10-10' })] })] });
    const r = simulate(p); expect(r.stopped.reason).toContain('Falta la tasa'); expect(r.history.at(-1).debt).toBeNull(); expect(r.payoffDate).toBeNull();
  });
  it('no suma interés diferido al saldo actual y exige liquidación oportuna', () => {
    const p = fixture({ accounts: [account({ tranches: [tranche({ type: 'DEFERRED', promoEnd: '2026-10-10', deferredAccrued: 150 })] })], settings: { monthlyDebtBudget: 1000, strategy: 'AVALANCHE' } });
    expect(planTotals(p).debts.MXN).toBe(1000);
    const late = simulate(p); expect(late.stopped.reason).toContain('interés diferido'); expect(late.payoffDate).toBeNull();
    p.accounts[0].dueDate = '2026-10-05'; expect(simulate(p).stopped).toBeNull();
  });
  it('separa promoción existente y nueva, y financia la comisión una sola vez', () => {
    const p = transferPlan({ settings: { monthlyDebtBudget: 0, horizon: 1 } });
    const r = simulate(p, transferScenario());
    expect(r.transfer.applied).toBe(true); expect(r.totalFees).toBe(50); expect(r.history[1].debt).toBe(1050);
    expect(p.accounts[0].balance).toBe(1000);
    expect(simulate(p).totalFees).toBe(0);
  });
  it('respeta el límite con comisión y rechaza fechas anteriores al plan', () => {
    const p = transferPlan({ accounts: [account({ currency: 'USD', balance: 5000, tranches: [tranche({ balance: 5000 })] }), account({ id: 'discover', name: 'Discover', currency: 'USD' })] });
    expect(transferTerms(p, transferScenario({ amount: 4285.71 })).errors).toEqual([]);
    expect(transferTerms(p, transferScenario({ amount: 4500 })).errors).toContain('La transferencia supera el límite elegido.');
    expect(transferTerms(p, transferScenario({ date: '2026-09-01' })).errors.join(' ')).toContain('fecha de revisión');
  });
  it('mantiene intereses devengados antes de un traspaso dentro del periodo', () => {
    const p = transferPlan({ settings: { monthlyDebtBudget: 0, horizon: 1 } });
    const r = simulate(p, transferScenario({ date: '2026-10-20' }));
    expect(r.history[1]).toMatchObject({ interest: 23, debt: 1073, fees: 50 });
  });
  it('rechaza traspasos mayores que el saldo futuro sin crear deuda ni comisión', () => {
    const p = transferPlan({ settings: { monthlyDebtBudget: 600, horizon: 2 } });
    const r = simulate(p, transferScenario({ date: '2026-10-28' }));
    expect(r.transfer.applied).toBe(false); expect(r.transfer.errors.join(' ')).toContain('saldo simulado'); expect(r.totalFees).toBe(0);
  });
});

describe('Escenarios, rendimientos y comparación visible', () => {
  it('base ignora opciones guardadas y el aumento no se suma dos veces', () => {
    const p = fixture({ settings: { monthlyDebtBudget: null, horizon: 1, strategy: 'AVALANCHE' }, budget: { monthlyIncome: 100 }, scenario: { raise: { enabled: true, amount: 300, date: '2026-10-12' } } });
    const b = simulate(p), s = simulate(p, p.scenario);
    expect(b.history[1].income).toBe(100); expect(s.history[1].income).toBe(250); expect(s.history[1].paid).toBe(250);
  });
  it('un bono sólo ocurre una vez y una opción sin fecha no inventa el mes', () => {
    const p = fixture({ settings: { horizon: 3 } });
    const r = simulate(p, { bonus: { enabled: true, amount: 50, date: '2026-11-01' } });
    expect(r.history.slice(1).map(r => r.income)).toEqual([1000, 1050, 1000]);
    expect(simulate(p, { bonus: { enabled: true, amount: 50 } }).warnings.join(' ')).toContain('falta su fecha');
  });
  it('calcula tasas por tramos y no inventa rendimiento del excedente', () => {
    expect(estimateYield(30000, 15, 25000, 9)).toBe(4200);
    expect(estimateYield(30000, 13, 25000, null)).toBeNull();
    expect(estimateYield(10000, 13, 25000, null)).toBe(1300);
  });
  it('compara sólo cotizaciones completas, elegibles y vigentes por costo efectivo', () => {
    const q = { debitMXN: 10000, netUSD: 500, allCostsIncluded: true, eligible: true, quotedAt: '2026-09-27T12:00:00Z', expiresAt: '2026-09-27T14:00:00Z' };
    const ranked = compareRemittanceQuotes([{ ...q, id: 'a' }, { ...q, id: 'b', netUSD: 510 }, { ...q, id: 'bad', netUSD: 900, allCostsIncluded: false }], new Date('2026-09-27T13:00:00Z'));
    expect(ranked[0].id).toBe('b'); expect(ranked.at(-1).valid).toBe(false);
    expect(compareRemittanceQuotes([q], new Date('2026-09-28T13:00:00Z'))[0].valid).toBe(false);
  });
  it('alinea las curvas por fecha y conserva el tramo más largo sin interpolar huecos', () => {
    expect(mergePlanHistories([{ date: '2026-01-01', debt: 100 }], [{ date: '2026-01-01', debt: 100 }, { date: '2026-02-01', debt: 80 }])).toEqual([{ date: '2026-01-01', base: 100, scenario: 100 }, { date: '2026-02-01', base: null, scenario: 80 }]);
  });
  it('renderiza importación, fuentes, cuotas y límites de cada vista', () => {
    const props = { plan: fixture(), onSave: () => {}, accountName: 'Cuenta de prueba', exchangeRate: 1 };
    for (const initialPanel of ['overview', 'accounts', 'calendar', 'savings', 'transfers', 'data']) expect(renderToStaticMarkup(createElement(PaymentPlan, { ...props, initialPanel }))).toContain('Tu plan de pagos');
    const html = renderToStaticMarkup(createElement(PaymentPlan, { ...props, plan: null }));
    expect(html).toContain('Revisar conciliación'); expect(html).toContain('Datos de la conciliación');
  });
});
