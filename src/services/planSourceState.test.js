import { describe, expect, it } from 'vitest';
import { emptyFinancialData } from './accountData.js';
import { applyPaymentPlan, normalizePaymentPlan } from './paymentPlan.js';
import { balanceDisplayData, managedPlanSections } from './planSourceState.js';

const fixture = () => applyPaymentPlan(emptyFinancialData('gairo'), normalizePaymentPlan({ version: 1, asOf: '2026-10-17', accounts: [{ id: 'card', name: 'Tarjeta', currency: 'MXN', balance: 1000, balanceDate: '2026-10-17', tranches: [{ id: 'regular', label: 'Saldo', balance: 1000, apr: 30, type: 'REVOLVING' }] }], assets: [{ id: 'cash', name: 'Ahorro', currency: 'MXN', balance: 2000, balanceDate: '2026-10-17' }], budget: { monthlyIncome: 5000, monthlyTax: 100, livingExpenses: 1000, payday: 15 } }));

describe('Navegación que conserva los registros independientes', () => {
  it('usa vistas vinculadas cuando todos los datos coinciden con el plan', () => {
    expect(managedPlanSections(fixture())).toEqual({ debts: true, balance: true, budget: true });
    expect(managedPlanSections(emptyFinancialData('gairo'))).toEqual({ debts: false, balance: false, budget: false });
  });
  it('mantiene cada editor con registros independientes accesible', () => {
    const data = fixture();
    data.activos.push({ id: 'other', monto: 100, moneda: 'MXN' });
    expect(managedPlanSections(data)).toEqual({ debts: true, balance: false, budget: true });
    data.honorarios.ingresoMensualRecibido = 6000;
    expect(managedPlanSections(data).budget).toBe(false);
    data.deudasPendientes[0].saldoEstimado = 800;
    expect(managedPlanSections(data).debts).toBe(false);
  });
  it('no cambia el editor por orden de propiedades ni metadatos planManaged', () => {
    const data = fixture();
    data.activos = data.activos.map(row => Object.fromEntries(Object.entries(row).reverse().filter(([key]) => key !== 'planManaged')));
    expect(managedPlanSections(data).balance).toBe(true);
  });
  it('mantiene visible un presupuesto independiente cuando el plan no conoce sus gastos', () => {
    const data = fixture(); data.planFinanciero.budget.livingExpenses = null;
    data.gastosNecesarios = [{ id: 'rent', nombre: 'Renta', monto: 900 }];
    data.gastosOpcionales = [{ id: 'gift', nombre: 'Regalos', monto: 100 }];
    expect(managedPlanSections(data).budget).toBe(false);
  });
  it('cuenta cada deuda una vez, con prioridad al registro actual', () => {
    const data = fixture();
    data.deudas = [{ id: 'card', nombre: 'Actualizada', moneda: 'MXN', saldo: 800 }, { id: 'other', saldo: 200, moneda: 'USD' }];
    const before = JSON.stringify(data);
    const result = balanceDisplayData(data);
    expect(result.deudas).toHaveLength(2);
    expect(result.deudas.find(item => item.id === 'card').saldo).toBe(800);
    expect(result.balanceCoverageIncomplete).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('no presenta un saldo desconocido como deuda cero', () => {
    const data = fixture(); data.deudasPendientes[0].saldoEstimado = null;
    const result = balanceDisplayData(data);
    expect(result.balanceCoverageIncomplete).toBe(true);
    expect(result.deudas[0].balanceUnknown).toBe(true);
  });
});
