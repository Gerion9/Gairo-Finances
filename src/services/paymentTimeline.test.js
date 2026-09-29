import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizePaymentPlan, normalizeScenario } from './paymentPlan.js';
import { buildPaymentTimeline, comparePaymentTimelines, discoverDepositTerms, knownRequirement } from './paymentTimeline.js';
import PaymentWorkbench from '../components/PaymentWorkbench.jsx';

function fixture(overrides = {}) {
  return normalizePaymentPlan({ version: 1, asOf: '2026-09-27', accounts: [{ id: 'card', name: 'Tarjeta de prueba', institution: 'Banco', currency: 'MXN', balance: 1000, balanceDate: '2026-09-27', dueDate: '2026-10-02', minimum: 100, paymentToAvoidInterest: 1000, tranches: [{ id: 'regular', label: 'Saldo ordinario', balance: 1000, apr: 36, type: 'REVOLVING' }] }], ...overrides,
    budget: { monthlyIncome: 0, monthlyTax: 0, livingExpenses: 0, payday: 1, ...overrides.budget },
    recommendation: { emergencyMXN: 0, ...overrides.recommendation },
    settings: { fx: 20, remittanceFeeUSD: 0, receiverFeeUSD: 0, ...overrides.settings },
  });
}
const config = { from: '2026-09-27', days: 40, fx: 20 };
const asset = (balance, currency = 'MXN', reserved = 0) => ({ id: 'cash-' + currency, name: 'Ahorro de prueba', currency, balance, reserved, balanceDate: '2026-09-27' });
function manual(plan, entries, extra = {}) {
  const base = buildPaymentTimeline(plan, config);
  return normalizeScenario({ ...extra, cashflow: { ...extra.cashflow, payments: base.payments.map(p => ({ id: p.id, accountId: p.accountId, amount: 0, date: p.date, funding: p.funding })), extraPayments: entries.map((p, i) => ({ id: 'custom-' + i, accountId: 'card', funding: 'MXN', ...p })) } });
}
const on = (r, date) => r.daily.find(d => d.date === date);

describe('Simulador diario: fondos y vencimientos', () => {
  it('un bono posterior no cubre un pago anterior al vencimiento', () => {
    const p = fixture();
    const run = date => buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-02', amount: 1000 }], { bonus: { enabled: true, amount: 1000, date } }) });
    const early = run('2026-10-01'), late = run('2026-10-20');
    expect(early.obligations[0]).toMatchObject({ funded: 1000, gap: 0 });
    expect(late.obligations[0]).toMatchObject({ funded: 0, gap: 1000 });
    expect(on(late, '2026-10-02').MXN).toBe(-1000);
    expect(on(late, '2026-10-20').MXN).toBe(0);
  });
  it('mover un abono cambia la caja desde esa fecha y no corrige un vencimiento pasado', () => {
    const p = fixture({ assets: [asset(1000)] });
    const early = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-01', amount: 500 }]) });
    const late = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-05', amount: 500 }]) });
    expect(on(early, '2026-09-30').MXN).toBe(on(late, '2026-09-30').MXN);
    expect(on(early, '2026-10-03').MXN).toBe(500);
    expect(on(late, '2026-10-03').MXN).toBe(1000);
    expect(late.obligations[0].funded).toBe(0);
  });
  it('cuenta ahorros una sola vez y respeta apartados', () => {
    const p = fixture({ assets: [asset(1000, 'MXN', 200)] });
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [], { useSavings: true, savingsAmount: 800 }) });
    expect(r.initial.MXN).toBe(800);
    expect(r.daily.at(-1).MXN).toBe(800);
    expect(r.warnings.join(' ')).toContain('No se suman otra vez');
  });
  it('no permite financiar dólares con pesos sin conversión explícita', () => {
    const p = fixture({ assets: [asset(1000)] }); p.accounts[0].currency = 'USD';
    const native = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-01', amount: 10, funding: 'USD' }]) });
    expect(on(native, '2026-10-01')).toMatchObject({ MXN: 1000, USD: -10 });
    expect(native.obligations[0].funded).toBe(0);
    const converted = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-01', amount: 10, funding: 'MXN' }]) });
    expect(on(converted, '2026-10-01')).toMatchObject({ MXN: 800, USD: 0 });
    expect(converted.obligations[0].funded).toBe(10);
  });
  it('descuenta comisiones de conversión una vez por abono', () => {
    const p = fixture({ assets: [asset(1000)], settings: { remittanceFeeUSD: 2, receiverFeeUSD: 3 } }); p.accounts[0].currency = 'USD';
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-01', amount: 10, funding: 'MXN' }]) });
    expect(on(r, '2026-10-01').MXN).toBe(700);
  });
  it('toma mínimo con cuotas sin sumarle mínimo o MSI otra vez', () => {
    const p = fixture(); Object.assign(p.accounts[0], { minimum: 100, requiredPayment: 300, minimumIncludesInstallments: false });
    p.accounts[0].tranches[0].monthlyPayment = 250;
    expect(knownRequirement(p.accounts[0])).toBe(300);
    const r = buildPaymentTimeline(p, config);
    expect(r.obligations[0].required).toBe(300);
  });
  it('deja visibles importes desconocidos y vencimientos pasados sin presumir pago', () => {
    const p = fixture(); Object.assign(p.accounts[0], { dueDate: '2026-09-25', minimum: null, paymentToAvoidInterest: null });
    const r = buildPaymentTimeline(p, config);
    expect(r.obligations[0]).toMatchObject({ overdue: true, target: null, gap: null, funded: 0 });
    expect(r.warnings.join(' ')).toContain('No equivalen a cero');
  });
  it('una cuota MSI conocida no convierte el mínimo desconocido en un total confirmado', () => {
    const p = fixture({ assets: [asset(1000)] });
    Object.assign(p.accounts[0], { minimum: null, paymentToAvoidInterest: null });
    Object.assign(p.accounts[0].tranches[0], { type: 'INSTALLMENT', monthlyPayment: 100, apr: 0 });
    const r = buildPaymentTimeline(p, config);
    expect(r.obligations[0]).toMatchObject({ required: null, target: null, risk: 'warning' });
    expect(r.warnings.join(' ')).toContain('No equivalen a cero');
  });
  it.each([100, 200])('no duplica reserva y pago de préstamos USD con ahorro %s', balance => {
    const p = fixture({ assets: [asset(balance, 'USD')], recommendation: { loanMonthlyUSD: 100 } });
    Object.assign(p.accounts[0], { kind: 'LOAN', currency: 'USD', minimum: 100, paymentToAvoidInterest: null, dueDate: '2026-10-20' });
    p.accounts[0].tranches[0].type = 'LOAN';
    const r = buildPaymentTimeline(p, { ...config, days: 30 });
    expect(on(r, '2026-10-20').USD).toBe(balance - 100);
    expect(r.obligations[0]).toMatchObject({ funded: 100, gap: 0 });
    expect(r.payments.find(p => p.accountId === 'card')).toBeDefined();
  });
  it('una cuota adelantada al mes anterior consume el sobre del mes de vencimiento', () => {
    const p = fixture({ assets: [asset(200, 'USD')], recommendation: { loanMonthlyUSD: 100 } });
    Object.assign(p.accounts[0], { kind: 'LOAN', currency: 'USD', minimum: 100, requiredPayment: 100, paymentToAvoidInterest: null, dueDate: '2026-10-01' });
    p.accounts[0].tranches[0].type = 'LOAN';
    const r = buildPaymentTimeline(p, { ...config, from: '2026-09-29', days: 30 });
    expect(r.daily.at(-1).USD).toBe(100);
    expect(r.events.filter(e => e.id.startsWith('loan-envelope'))).toHaveLength(0);
  });
  it('muestra los vencimientos siguientes como referencias en la misma agenda y totales', () => {
    const p = fixture({ assets: [asset(300, 'USD')] });
    Object.assign(p.accounts[0], { currency: 'USD', minimum: 100, paymentToAvoidInterest: null, dueDate: '2026-10-20' });
    const r = buildPaymentTimeline(p, { ...config, days: 90 });
    expect(r.obligations.map(a => a.dueDate)).toEqual(['2026-10-20', '2026-11-20', '2026-12-20']);
    expect(r.totals.USD.target).toBe(300);
    expect(r.obligations.slice(1).every(a => a.estimated && a.paymentToAvoidInterest === null)).toBe(true);
    expect(r.totals.USD.gap).toBe(0);
  });
  it('cambiar la reserva mantiene la identidad y el monto de cada asignación manual', () => {
    const p = fixture({ assets: [asset(500)], budget: { monthlyIncome: 1000, payday: 1 } });
    p.accounts[0].balance = 2000; p.accounts[0].paymentToAvoidInterest = 2000; p.accounts[0].dueDate = '2026-10-20'; p.accounts[0].tranches[0].balance = 2000;
    const b = buildPaymentTimeline(p, config), chosen = b.payments.find(p => p.date === '2026-10-01');
    const changes = normalizeScenario({ cashflow: { reserveMXN: 500, payments: [{ ...chosen, amount: 100 }] } });
    const r = buildPaymentTimeline(p, { ...config, scenario: changes });
    expect(r.payments.find(p => p.id === chosen.id).requestedAmount).toBe(100);
    expect(r.reserve).toBe(500);
  });
  it('adelantar el inicio no duplica una referencia mensual editada', () => {
    const p = fixture({ assets: [asset(500, 'USD')] });
    Object.assign(p.accounts[0], { currency: 'USD', minimum: 100, paymentToAvoidInterest: null, dueDate: '2026-10-20' });
    const seed = buildPaymentTimeline(p, { ...config, days: 90 }).payments.find(e => e.due === '2026-11-20');
    const scenario = normalizeScenario({ cashflow: { payments: [{ ...seed, dueDate: seed.due, amount: 50 }] } });
    const r = buildPaymentTimeline(p, { ...config, from: '2026-10-29', days: 60, scenario });
    expect(r.payments.filter(e => e.due === '2026-11-20')).toHaveLength(1);
    expect(r.payments.find(e => e.due === '2026-11-20').amount).toBe(50);
  });
  it('un abono atrasado del corte anterior no cubre automáticamente el siguiente', () => {
    const p = fixture({ assets: [asset(100, 'USD')] });
    Object.assign(p.accounts[0], { currency: 'USD', minimum: 100, paymentToAvoidInterest: null, dueDate: '2026-10-20' });
    const r = buildPaymentTimeline(p, { ...config, from: '2026-10-29', days: 40 });
    expect(r.obligations.find(a => a.dueDate === '2026-11-20')).toMatchObject({ funded: 0, gap: 100 });
  });
  it('no anticipa ingreso del día 30 al principio del mes ni lo omite', () => {
    const p = fixture({ accounts: [], budget: { monthlyIncome: 1200, payday: 30 } });
    const r = buildPaymentTimeline(p, config);
    expect(on(r, '2026-09-29').MXN).toBe(0);
    expect(on(r, '2026-09-30').MXN).toBe(1200);
    expect(on(r, '2026-10-30').MXN).toBe(2400);
  });
  it('no inventa fecha de nómina y mantiene el alcance parcial', () => {
    const p = fixture({ accounts: [], budget: { monthlyIncome: 1200, payday: null } });
    const r = buildPaymentTimeline(p, config);
    expect(r.daily.at(-1).MXN).toBe(0);
    expect(r.warnings.join(' ')).toContain('no se agrega nómina');
  });
  it('incluye el compromiso de maestría en agenda, caja y faltantes', () => {
    const p = fixture({ accounts: [], assets: [asset(500)], budget: { tuitionPayments: [{ date: '2026-10-10', amount: 600 }] } });
    const r = buildPaymentTimeline(p, config);
    expect(r.obligations[0]).toMatchObject({ name: 'Maestría', target: 600, gap: 100 });
    expect(r.totals.MXN.gap).toBe(100);
    expect(r.daily.at(-1).MXN).toBe(-100);
  });
  it('permite declarar gastos ya cubiertos sin alterar presupuesto real', () => {
    const p = fixture({ accounts: [], assets: [asset(500)], budget: { livingExpenses: 200 } });
    const r = buildPaymentTimeline(p, { ...config, scenario: normalizeScenario({ cashflow: { currentExpensesMXN: 50 } }) });
    expect(r.daily[0].MXN).toBe(450);
    expect(p.budget.livingExpenses).toBe(200);
  });
  it('reserva los gastos pendientes desde hoy aunque la nómina llegue mañana', () => {
    const p = fixture({ accounts: [], assets: [asset(500)], budget: { livingExpenses: 200, monthlyIncome: 1000, payday: 30 } });
    const r = buildPaymentTimeline(p, { ...config, from: '2026-09-29', scenario: normalizeScenario({ cashflow: { currentExpensesMXN: 50 } }) });
    expect(on(r, '2026-09-29').MXN).toBe(450);
    expect(on(r, '2026-09-30').MXN).toBe(1250);
  });
  it('limita la suma de abonos al saldo registrado sin descontar excedentes', () => {
    const p = fixture({ assets: [asset(2000)] });
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-09-28', amount: 700 }, { date: '2026-09-29', amount: 700 }]) });
    expect(on(r, '2026-09-29').MXN).toBe(1000);
    expect(r.obligations[0].funded).toBe(1000);
    expect(r.warnings.join(' ')).toContain('excedente');
  });
});

describe('Préstamos, persistencia y comparación', () => {
  it('un préstamo aumenta caja y deuda, y descuenta sus cuotas desde la fecha acordada', () => {
    const p = fixture({ accounts: [] });
    const scenario = normalizeScenario({ cashflow: { loan: { enabled: true, amount: 1000, fee: 50, date: '2026-10-01', apr: 24, monthlyPayment: 200, firstPaymentDate: '2026-10-15' } } });
    const r = buildPaymentTimeline(p, { ...config, scenario, days: 60 });
    expect(on(r, '2026-09-30').MXN).toBe(0);
    expect(on(r, '2026-10-01').MXN).toBe(1000);
    expect(r.newDebt).toBe(1050);
    expect(on(r, '2026-11-15').MXN).toBe(600);
    expect(r.events.filter(e => e.kind === 'BORROWING')).toHaveLength(1);
  });
  it('un préstamo con datos faltantes no aparenta ser un ingreso gratuito', () => {
    const p = fixture({ accounts: [] });
    const r = buildPaymentTimeline(p, { ...config, scenario: normalizeScenario({ cashflow: { loan: { enabled: true, amount: 1000, date: '2026-10-01' } } }) });
    expect(r.newDebt).toBe(1000);
    expect(r.warnings.join(' ')).toContain('Préstamo parcial');
  });
  it('base y escenario comparten fechas; desactivar bono restituye la referencia', () => {
    const p = fixture({ accounts: [], scenario: { bonus: { enabled: true, amount: 500, date: '2026-10-01' } } });
    const r = comparePaymentTimelines(p, config);
    expect(r.rows.find(d => d.date === '2026-09-30')).toMatchObject({ baseMXN: 0, scenarioMXN: 0 });
    expect(r.rows.find(d => d.date === '2026-10-01')).toMatchObject({ baseMXN: 0, scenarioMXN: 500 });
    p.scenario.bonus.enabled = false;
    expect(comparePaymentTimelines(p, config).rows.every(d => d.baseMXN === d.scenarioMXN)).toBe(true);
  });
  it('normaliza, serializa y recupera todos los controles sin cambiar datos documentados', () => {
    const p = fixture();
    p.scenario = manual(p, [{ date: '2026-10-01', amount: 100 }], { cashflow: { reserveMXN: 125, currentExpensesMXN: 20, loan: { enabled: true, amount: 800, apr: 12, monthlyPayment: 80, date: '2026-10-04', firstPaymentDate: '2026-11-04' } } });
    const before = JSON.stringify(p);
    comparePaymentTimelines(p, config);
    expect(JSON.stringify(p)).toBe(before);
    expect(normalizePaymentPlan(JSON.parse(before))).toEqual(p);
  });
  it('rechaza asignaciones inválidas, IDs repetidos y horizontes no soportados', () => {
    const allocation = { id: 'a', accountId: 'card', date: '2026-10-01', amount: 10, funding: 'MXN' };
    expect(() => normalizeScenario({ cashflow: { payments: [allocation, allocation] } })).toThrow('repetidos');
    expect(() => normalizeScenario({ cashflow: { payments: [{ ...allocation, amount: -1 }] } })).toThrow();
    expect(() => normalizeScenario({ cashflow: { payments: [{ ...allocation, date: '2026-02-30' }] } })).toThrow();
    expect(() => buildPaymentTimeline(fixture(), { ...config, days: 121 })).toThrow();
  });
  it('renderiza la agenda, la comparación y controles con nombres accesibles', () => {
    const html = renderToStaticMarkup(createElement(PaymentWorkbench, { plan: fixture(), fx: 20, onChangeScenario() {}, onOpenAccounts() {}, onOpenProjection() {} }));
    for (const text of ['Vencen primero', 'Falta cubrir', 'Tu dinero, día por día', 'Explorar fecha', 'Mover fecha del pago', 'Dinero disponible', 'Saldos diarios comparados']) expect(html).toContain(text);
  });
});

describe('Origen por cuenta', () => {
  it('otra cuenta con dinero no cubre un pago asignado a una cuenta insuficiente', () => {
    const p = fixture({ assets: [asset(100), { ...asset(900), id: 'second' }] });
    const scenario = manual(p, [{ date: '2026-10-01', amount: 500, assetId: 'cash-MXN' }]);
    const r = buildPaymentTimeline(p, { ...config, scenario });
    expect(r.obligations[0].funded).toBe(100);
    expect(on(r, '2026-10-01').accounts).toMatchObject({ 'cash-MXN': -400, second: 900 });
    expect(on(r, '2026-10-01').MXN).toBe(500);
    expect(r.accountShortfalls[0]).toMatchObject({ id: 'cash-MXN', amount: 400, date: '2026-10-01' });
  });
  it('el reparto automático conserva la suma de cuentas y usa los ingresos sin banco primero', () => {
    const p = fixture({ assets: [asset(100)] });
    const scenario = manual(p, [{ date: '2026-10-01', amount: 150 }], { bonus: { enabled: true, amount: 100, date: '2026-09-30' } });
    const r = buildPaymentTimeline(p, { ...config, scenario });
    expect(on(r, '2026-10-01').accounts['cash-MXN']).toBe(50);
    expect(on(r, '2026-10-01').accounts['@unassigned-MXN']).toBe(0);
    for (const day of r.daily) for (const c of ['MXN', 'USD']) expect(r.fundingAccounts.filter(a => a.currency === c).reduce((n, a) => n + day.accounts[a.id], 0)).toBeCloseTo(day[c], 2);
  });
  it('un ingreso sin destino no aparece silenciosamente en un banco elegido', () => {
    const p = fixture({ assets: [asset(0)] });
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-01', amount: 100, assetId: 'cash-MXN' }], { bonus: { enabled: true, amount: 500, date: '2026-09-30' } }) });
    expect(r.obligations[0].funded).toBe(0);
    expect(on(r, '2026-10-01').accounts['@unassigned-MXN']).toBe(500);
  });
  it('conversión desde una cuenta específica descuenta allí el principal y una comisión', () => {
    const p = fixture({ assets: [asset(1000)], settings: { remittanceFeeUSD: 2, receiverFeeUSD: 3 } });
    p.accounts[0].currency = 'USD';
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-01', amount: 10, funding: 'MXN', assetId: 'cash-MXN' }]) });
    expect(on(r, '2026-10-01').accounts['cash-MXN']).toBe(700);
    expect(r.obligations[0].funded).toBe(10);
  });
  it('conserva el origen al normalizar y rechaza cuentas incompatibles', () => {
    const p = fixture({ assets: [asset(100, 'USD')] });
    const scenario = manual(p, [{ date: '2026-10-01', amount: 10, assetId: 'cash-USD', funding: 'MXN' }]);
    expect(normalizeScenario(JSON.parse(JSON.stringify(scenario))).cashflow.extraPayments[0].assetId).toBe('cash-USD');
    expect(() => buildPaymentTimeline(p, { ...config, scenario })).toThrow('cuenta de origen');
  });
  it('no cobra dos veces el capital comprometido ni marca como pagado el abono sin fondos', () => {
    const p = fixture();
    const scenario = manual(p, [{ date: '2026-09-28', amount: 1000 }, { date: '2026-10-01', amount: 1000 }], { bonus: { enabled: true, amount: 2000, date: '2026-09-30' } });
    const r = buildPaymentTimeline(p, { ...config, scenario });
    expect(r.payments.find(p => p.id === 'custom-0').funded).toBe(0);
    expect(r.payments.find(p => p.id === 'custom-1').amount).toBe(0);
    expect(r.obligations[0].funded).toBe(0);
    expect(r.events.filter(e => e.kind === 'PAYMENT').reduce((n, e) => n + e.cost, 0)).toBe(1000);
  });
});

const discoverFixture = () => {
  const p = fixture({ assets: [asset(0), asset(0, 'USD')], recommendation: { transferDepositConfirmed: true } });
  p.accounts.push({ ...structuredClone(p.accounts[0]), id: 'discover', name: 'Discover de prueba', currency: 'USD', balance: 500, minimum: 35, requiredPayment: 35, autopayAmount: 100, paymentToAvoidInterest: null, dueDate: '2026-10-21', tranches: [{ ...p.accounts[0].tranches[0], balance: 500, apr: 7.99 }] });
  return p;
};
const deposit = { enabled: true, amount: 1000, date: '2026-10-01', currency: 'USD', assetId: 'cash-USD', monthlyPayment: 105, firstPaymentDate: '2026-10-20' };

describe('Discover como depósito de la oferta', () => {
  it('agrega sólo el principal al efectivo, deuda con comisión en USD y conserva el saldo anterior', () => {
    const p = discoverFixture(), before = JSON.stringify(p);
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [], { cashflow: { discover: deposit } }) });
    expect(on(r, '2026-09-30').USD).toBe(0);
    expect(on(r, '2026-10-01').accounts['cash-USD']).toBe(1000);
    expect(r.newDebtUSD).toBe(1050);
    expect(r.newDebt).toBe(0);
    expect(on(r, '2026-10-20').USD).toBe(895);
    expect(JSON.stringify(p)).toBe(before);
    expect(p.accounts[1].tranches[0].apr).toBe(7.99);
  });
  it('un depósito en pesos posterior al vencimiento no lo cubre retroactivamente', () => {
    const p = discoverFixture();
    const d = { ...deposit, currency: 'MXN', assetId: 'cash-MXN', netMXN: 19500, quotePrincipalUSD: 1000, date: '2026-10-03' };
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ date: '2026-10-02', amount: 1000 }], { cashflow: { discover: d } }) });
    expect(r.obligations.find(a => a.id === 'card').funded).toBe(0);
    expect(on(r, '2026-10-03').MXN).toBe(18500);
    expect(r.newDebtUSD).toBe(1050);
  });
  it('no inventa pesos sin cotización y la invalida al cambiar el principal', () => {
    const p = discoverFixture();
    for (const d of [{ ...deposit, currency: 'MXN', assetId: 'cash-MXN' }, { ...deposit, amount: 1200, currency: 'MXN', assetId: 'cash-MXN', netMXN: 19000, quotePrincipalUSD: 1000 }]) {
      const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [], { cashflow: { discover: d } }) });
      expect(r.events.some(e => e.id === 'discover-deposit')).toBe(false);
      expect(r.newDebtUSD).toBe(0);
      expect(r.discover.issues.join(' ')).toContain('cotizados');
    }
  });
  it('aplica el límite exacto con comisión financiada y deja explícito el supuesto alternativo', () => {
    const p = discoverFixture();
    expect(discoverDepositTerms(p, { ...deposit, amount: 4285.71 }).valid).toBe(true);
    expect(discoverDepositTerms(p, { ...deposit, amount: 4285.72 }).valid).toBe(false);
    expect(discoverDepositTerms(p, { ...deposit, amount: 4500, limitIncludesFee: false })).toMatchObject({ valid: true, debt: 4725, receipt: 4500 });
  });
  it('no presume un desembolso pasado ni acepta el primer abono antes de recibirlo', () => {
    const p = discoverFixture();
    expect(discoverDepositTerms(p, deposit, '2026-10-02').valid).toBe(false);
    expect(discoverDepositTerms(p, { ...deposit, firstPaymentDate: '2026-09-30' }).valid).toBe(false);
  });
  it('suma el abono adicional una sola vez al pago vigente sin volver a sumar el mínimo', () => {
    const p = discoverFixture();
    const r = buildPaymentTimeline(p, { ...config, days: 30, scenario: manual(p, [{ accountId: 'discover', date: '2026-10-20', amount: 100, funding: 'USD' }], { cashflow: { discover: deposit } }) });
    expect(on(r, '2026-10-20').USD).toBe(795);
    expect(r.events.filter(e => e.date === '2026-10-20' && e.kind === 'PAYMENT').reduce((s, e) => s + e.cost, 0)).toBe(205);
  });
  it('la deuda nueva sigue existiendo después de pagar el saldo previo y no permite exceder la deuda combinada', () => {
    const p = discoverFixture(); p.assets[1].balance = 2000;
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [{ accountId: 'discover', date: '2026-10-02', amount: 500, funding: 'USD' }], { cashflow: { discover: { ...deposit, monthlyPayment: 1500 } } }) });
    expect(r.events.find(e => e.id === 'discover-extra-0').amount).toBe(1050);
    expect(on(r, '2026-10-20').USD).toBe(1450);
  });
  it('no reutiliza la misma oferta simultáneamente para depósito y transferencia entre tarjetas', () => {
    const p = discoverFixture();
    const scenario = manual(p, [], { transfer: { enabled: true, amount: 1000 }, cashflow: { discover: deposit } });
    const r = buildPaymentTimeline(p, { ...config, scenario });
    expect(r.events.some(e => e.id === 'discover-deposit')).toBe(false);
    expect(r.discover.issues.join(' ')).toContain('misma oferta');
  });
  it('permite financiar abonos Discover desde la cuenta MXN elegida con una comisión por abono', () => {
    const p = discoverFixture(); p.settings.remittanceFeeUSD = 2;
    const d = { ...deposit, currency: 'MXN', assetId: 'cash-MXN', netMXN: 19500, quotePrincipalUSD: 1000, funding: 'MXN', paymentAssetId: 'cash-MXN' };
    const r = buildPaymentTimeline(p, { ...config, scenario: manual(p, [], { cashflow: { discover: d } }) });
    expect(r.events.find(e => e.id === 'discover-extra-0')).toMatchObject({ funded: 105, cost: 2140, funding: 'MXN' });
    expect(on(r, '2026-10-20').accounts['cash-MXN']).toBe(17360);
    expect(on(r, '2026-10-20').USD).toBe(0);
  });
  it('limita los compromisos de varios meses sin fondos al capital y conserva sus faltantes', () => {
    const p = fixture();
    Object.assign(p.accounts[0], { balance: 100, minimum: 100, requiredPayment: 100, paymentToAvoidInterest: null, dueDate: '2026-10-20', currency: 'USD' });
    const r = buildPaymentTimeline(p, { ...config, days: 90 });
    expect(r.events.filter(e => e.kind === 'PAYMENT').reduce((n, e) => n + e.cost, 0)).toBe(100);
    expect(r.daily.at(-1).USD).toBe(-100);
    expect(r.obligations.every(a => a.funded === 0 && a.gap === 100)).toBe(true);
  });
  it('persiste todos los datos y mantiene pendientes los términos que el escenario no demuestra', () => {
    const p = discoverFixture();
    p.scenario = manual(p, [], { cashflow: { discover: { ...deposit, monthlyPayment: null, firstPaymentDate: null } } });
    expect(normalizePaymentPlan(JSON.parse(JSON.stringify(p))).scenario).toEqual(p.scenario);
    const r = comparePaymentTimelines(p, config);
    expect(r.scenario.warnings.join(' ')).toContain('aún no tiene pagos previstos');
    expect(r.scenario.warnings.join(' ')).toContain('no se acredita liquidación');
  });
});
