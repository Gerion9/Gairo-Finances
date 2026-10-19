import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScenarioImpact from '../components/ScenarioImpact.jsx';
import PaymentWorkbench from '../components/PaymentWorkbench.jsx';
import { normalizePaymentPlan } from './paymentPlan.js';
import { summarizeScenarioImpact } from './scenarioImpact.js';

const date = index => '2026-10-' + String(index + 1).padStart(2, '0');
function timeline(MXN, { USD = MXN.map(() => 0), initial = { MXN: MXN[0], USD: USD[0] }, accounts = {}, fundingAccounts = [], warnings = [], newDebt = 0, newDebtUSD = 0 } = {}) {
  return {
    from: date(0), to: date(MXN.length - 1), initial, fundingAccounts, warnings, newDebt, newDebtUSD,
    daily: MXN.map((value, index) => ({ date: date(index), MXN: value, USD: USD[index], accounts: Object.fromEntries(Object.entries(accounts).map(([id, amounts]) => [id, amounts[index]])) })),
  };
}
const compare = (base, scenario, scope) => summarizeScenarioImpact({ base, scenario }, scope);

describe('Lectura del impacto de un escenario', () => {
  it('conserva el faltante intermedio aunque el cierre se recupere y mejore', () => {
    const impact = compare(timeline([100, 100, 100, 100]), timeline([100, -10, -80, 200]));
    expect(impact.minimum).toMatchObject({ value: -80, date: '2026-10-03', phase: 'closing' });
    expect(impact.final).toMatchObject({ value: 200, reference: 100, delta: 100, date: '2026-10-04' });
    expect(impact.firstShortfall).toMatchObject({ value: -10, date: '2026-10-02' });
  });

  it('muestra la cuenta negativa con el saldo exacto de la primera fecha aunque el total sea positivo', () => {
    const fundingAccounts = [{ id: 'bank', name: 'Cuenta de pagos', currency: 'MXN', initial: 100 }, { id: 'savings', name: 'Ahorros', currency: 'MXN', initial: 900 }];
    const base = timeline([1000, 1000, 1000], { fundingAccounts, accounts: { bank: [100, 100, 100], savings: [900, 900, 900] } });
    const scenario = timeline([1000, 800, 550], { fundingAccounts, accounts: { bank: [100, -100, -350], savings: [900, 900, 900] } });
    scenario.accountShortfalls = [{ id: 'bank', date: '2026-10-02', amount: 350 }];
    const impact = compare(base, scenario);
    expect(impact.minimum.value).toBe(550);
    expect(impact.firstShortfall).toMatchObject({ accountId: 'bank', accountName: 'Cuenta de pagos', date: '2026-10-02', value: -100, total: 800 });
    expect(impact.maskedShortfall).toEqual(impact.firstShortfall);
    const accountImpact = compare(base, scenario, { accountId: 'bank' });
    expect(accountImpact.minimum).toMatchObject({ date: '2026-10-03', value: -350 });
    expect(accountImpact.firstShortfall.value).toBe(-100);
  });

  it('no suma mínimos de cuentas que ocurren en días diferentes', () => {
    const fundingAccounts = [{ id: 'first', currency: 'MXN', initial: 100 }, { id: 'second', currency: 'MXN', initial: 100 }];
    const input = timeline([100, 100], { initial: { MXN: 200, USD: 0 }, fundingAccounts, accounts: { first: [0, 100], second: [100, 0] } });
    expect(compare(input, input).minimum.value).toBe(100);
  });

  it('mantiene MXN y USD independientes, incluida la deuda nueva en sus monedas originales', () => {
    const base = timeline([30, 30, 30], { USD: [5, 5, 5] });
    const scenario = timeline([30, -30, 100], { USD: [5, 3, -2], newDebt: 1000, newDebtUSD: 80 });
    const pesos = compare(base, scenario, { currency: 'MXN' });
    const dollars = compare(base, scenario, { currency: 'USD' });
    expect(pesos.firstShortfall).toMatchObject({ date: '2026-10-02', value: -30, currency: 'MXN' });
    expect(dollars.firstShortfall).toMatchObject({ date: '2026-10-03', value: -2, currency: 'USD' });
    expect(dollars.final.delta).toBe(-7);
    expect(pesos.newDebt).toEqual({ MXN: 1000, USD: 80 });
    expect(dollars.newDebt).toEqual(pesos.newDebt);
  });

  it('sigue la moneda y los saldos de la cuenta elegida', () => {
    const fundingAccounts = [{ id: 'usd-bank', name: 'Cuenta USD', currency: 'USD', initial: 50 }];
    const base = timeline([1000, 1000], { USD: [50, 50], fundingAccounts, accounts: { 'usd-bank': [50, 50] } });
    const scenario = timeline([1000, 1000], { USD: [40, 20], initial: { MXN: 1000, USD: 50 }, fundingAccounts, accounts: { 'usd-bank': [40, 20] } });
    const impact = compare(base, scenario, { currency: 'MXN', accountId: 'usd-bank' });
    expect(impact.scope).toEqual({ accountId: 'usd-bank', name: 'Cuenta USD', currency: 'USD' });
    expect(impact.minimum.value).toBe(20);
    expect(impact.final.delta).toBe(-30);
  });

  it('preserva cero, ausencia de cambios y cobertura parcial como estados distintos', () => {
    const input = timeline([0, 0], { warnings: ['Falta confirmar una cuota.'] });
    const impact = compare(input, input);
    expect(impact).toMatchObject({ available: true, unchanged: true, partial: true, firstShortfall: null, maskedShortfall: null });
    expect(impact.final.delta).toBe(0);
    expect(impact.minimum.value).toBe(0);
    expect(impact.warnings).toEqual(['Falta confirmar una cuota.']);
  });

  it('no confunde un cierre igual con saldos intermedios iguales', () => {
    const impact = compare(timeline([100, 100, 100]), timeline([100, 20, 100]));
    expect(impact.final.delta).toBe(0);
    expect(impact.unchanged).toBe(false);
  });

  it('no declara saldos iguales cuando cambia su distribución entre cuentas', () => {
    const fundingAccounts = [{ id: 'bank', name: 'Cuenta de pagos', currency: 'MXN', initial: 100 }, { id: 'savings', name: 'Ahorros', currency: 'MXN', initial: 900 }];
    const base = timeline([1000, 1000], { fundingAccounts, accounts: { bank: [100, 100], savings: [900, 900] } });
    const scenario = timeline([1000, 1000], { fundingAccounts, accounts: { bank: [100, -50], savings: [900, 1050] } });
    const impact = compare(base, scenario);
    expect(impact.unchanged).toBe(false);
    expect(impact.final.delta).toBe(0);
    expect(impact.maskedShortfall).toMatchObject({ accountId: 'bank', value: -50 });
  });

  it('identifica el saldo de apertura sin atribuirlo al cierre del primer día', () => {
    const impact = compare(timeline([20, 30]), timeline([20, 30], { initial: { MXN: -10, USD: 0 } }));
    expect(impact.minimum).toMatchObject({ value: -10, date: '2026-10-01', phase: 'opening' });
    expect(impact.firstShortfall).toMatchObject({ value: -10, phase: 'opening' });
    expect(impact.final.value).toBe(30);
  });

  it('no presenta el bolsillo virtual como una cuenta bancaria con faltante oculto', () => {
    const fundingAccounts = [{ id: 'virtual', name: 'Sin cuenta asignada', currency: 'MXN', initial: 0, virtual: true }];
    const input = timeline([100, 100], { fundingAccounts, accounts: { virtual: [-10, -20] } });
    const impact = compare(input, input, { accountId: 'virtual' });
    expect(impact.firstShortfall).toMatchObject({ accountId: 'virtual', value: -10 });
    expect(impact.maskedShortfall).toBeNull();
  });

  it('conserva el primer faltante total y un riesgo posterior de cuenta por separado', () => {
    const fundingAccounts = [{ id: 'bank', name: 'Banco', currency: 'MXN', initial: 100 }];
    const scenario = timeline([-50, 100], { initial: { MXN: 100, USD: 0 }, fundingAccounts, accounts: { bank: [0, -20] } });
    const impact = compare(scenario, scenario);
    expect(impact.firstShortfall).toMatchObject({ date: '2026-10-01', value: -50 });
    expect(impact.maskedShortfall).toMatchObject({ date: '2026-10-02', accountId: 'bank', value: -20 });
  });

  it('no inventa métricas para una selección inválida ni modifica la evidencia recibida', () => {
    const base = timeline([100, 100]), scenario = timeline([90, 120]);
    const before = JSON.stringify({ base, scenario });
    expect(compare(base, scenario, { accountId: 'missing' }).available).toBe(false);
    expect(compare(base, { ...scenario, daily: [] }).available).toBe(false);
    expect(compare(base, timeline([100, null])).available).toBe(false);
    compare(base, scenario);
    expect(JSON.stringify({ base, scenario })).toBe(before);
  });
});

describe('Presentación de la comparación', () => {
  it('expone fecha, cuenta y acción del faltante que el total positivo oculta', () => {
    const fundingAccounts = [{ id: 'bank', name: 'Cuenta de pagos', currency: 'MXN', initial: 100 }];
    const base = timeline([100, 100], { fundingAccounts, accounts: { bank: [100, 100] } });
    const scenario = timeline([100, 80], { fundingAccounts, accounts: { bank: [100, -20] }, newDebtUSD: 50 });
    const html = renderToStaticMarkup(createElement(ScenarioImpact, { result: { base, scenario }, currency: 'MXN', onInspect() {} }));
    for (const text of ['Saldo más bajo', 'Saldo al cierre', 'Primer faltante', 'Cuenta de pagos', 'Revisar cuenta y fecha', 'El total en MXN no es negativo', '50.00 USD', 'no es el saldo de deuda al cierre']) expect(html).toContain(text);
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('wb-horizon-summary');
  });

  it('explica que no hallar faltantes no convierte una comparación parcial en garantía', () => {
    const input = timeline([0, 0], { warnings: ['Condición pendiente'] });
    const html = renderToStaticMarkup(createElement(ScenarioImpact, { result: { base: input, scenario: input }, currency: 'MXN' }));
    for (const text of ['Mismos saldos que la referencia', 'Sin faltantes detectados con estos supuestos', 'Proyección parcial', 'datos y supuestos por confirmar']) expect(html).toContain(text);
  });

  it('integra resumen, tabla y eventos con el mismo alcance sin modificar el plan', () => {
    const plan = normalizePaymentPlan({ version: 1, asOf: '2026-10-18', accounts: [], assets: [{ id: 'bank', name: 'Cuenta de prueba', currency: 'MXN', balance: 1000, reserved: 0, balanceDate: '2026-10-18' }], budget: { monthlyIncome: 0, monthlyTax: 0, livingExpenses: 0, payday: 1 }, settings: { fx: 20 }, recommendation: { emergencyMXN: 0 } });
    const before = JSON.stringify(plan);
    const html = renderToStaticMarkup(createElement(PaymentWorkbench, { plan, fx: 20, onChangeScenario() {}, onOpenAccounts() {}, onOpenProjection() {} }));
    for (const text of ['Impacto del escenario', 'Ajustar escala', 'Movimientos de la referencia', 'Movimientos del escenario', 'Referencia · MXN', 'Escenario · MXN', 'Diferencia · MXN', 'Saldos previstos al cierre de cada día', 'no representan movimientos intradía', 'La diferencia entre saldos también incorpora los días anteriores']) expect(html).toContain(text);
    expect(html).toContain('<caption>Total disponible · MXN');
    expect(html).not.toContain('Referencia USD');
    expect(html).not.toContain('wb-horizon-summary');
    expect(JSON.stringify(plan)).toBe(before);
  });
});
