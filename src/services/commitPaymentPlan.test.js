import { describe, expect, it } from 'vitest';
import { emptyFinancialData } from './accountData.js';
import { applyPaymentPlan, normalizePaymentPlan } from './paymentPlan.js';
import { commitPaymentPlan } from './commitPaymentPlan.js';

const fixture = () => normalizePaymentPlan({ version: 1, asOf: '2026-10-17', accounts: [{ id: 'card', name: 'Tarjeta de prueba', institution: 'Banco', currency: 'MXN', balance: 1000, balanceDate: '2026-10-17', dueDate: '2026-10-25', minimum: 100, tranches: [{ id: 'regular', label: 'Saldo ordinario', type: 'REVOLVING', balance: 1000, apr: 30 }] }], assets: [{ id: 'cash', name: 'Ahorro', currency: 'MXN', balance: 2000, reserved: 100, balanceDate: '2026-10-17' }], budget: { monthlyIncome: 5000, monthlyTax: 100, livingExpenses: 1000, payday: 15 } });

describe('Guardar un plan sin reimportar registros ajenos al cambio', () => {
  it('conserva ajustes anteriores al guardar sólo un escenario', () => {
    const plan = fixture();
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.honorarios.ingresoMensualRecibido = 6000;
    data.deudasPendientes[0].saldoEstimado = 800;
    data.activos.push({ id: 'separate', nombre: 'Otro activo', monto: 300, moneda: 'MXN' });
    const input = structuredClone(plan);
    input.scenario.bonus = { enabled: true, amount: 500, date: '2026-11-01' };
    const before = JSON.stringify(data);
    const next = commitPaymentPlan(data, input);
    expect(next.honorarios.ingresoMensualRecibido).toBe(6000);
    expect(next.deudasPendientes[0].saldoEstimado).toBe(800);
    expect(next.activos).toHaveLength(2);
    expect(next.planFinanciero.scenario.bonus.amount).toBe(500);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('actualiza un crédito sin eliminar registros independientes ni reconstruir el presupuesto', () => {
    const plan = fixture();
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.deudas.push({ id: 'separate', saldo: 75, moneda: 'MXN' });
    data.deudasPendientes.push({ id: 'pending', saldoEstimado: 20, moneda: 'MXN' });
    data.honorarios.ingresoMensualRecibido = 6000;
    const input = structuredClone(plan);
    input.accounts[0].minimum = 150;
    const next = commitPaymentPlan(data, input);
    expect(next.deudas).toEqual(data.deudas);
    expect(next.deudasPendientes.find(item => item.id === 'card').pagoMinimo).toBe(150);
    expect(next.deudasPendientes.find(item => item.id === 'pending')).toEqual(data.deudasPendientes[1]);
    expect(next.honorarios).toEqual(data.honorarios);
    expect(next.activos).toEqual(data.activos);
  });
  it('actualiza ahorros sin perder activos independientes', () => {
    const plan = fixture();
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.activos.push({ id: 'separate', nombre: 'Otro activo', monto: 300, moneda: 'MXN' });
    const input = structuredClone(plan);
    input.assets[0].reserved = 500;
    const next = commitPaymentPlan(data, input);
    expect(next.activos).toHaveLength(2);
    expect(next.planFinanciero.assets[0].reserved).toBe(500);
    expect(next.deudasPendientes).toEqual(data.deudasPendientes);
  });
  it('reemplaza el inventario únicamente al importar una conciliación revisada', () => {
    const plan = fixture();
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.activos.push({ id: 'separate', nombre: 'Otro activo', monto: 300, moneda: 'MXN' });
    data.honorarios.ingresoMensualRecibido = 6000;
    expect(commitPaymentPlan(data, plan, { replaceInventory: true })).toEqual(applyPaymentPlan(data, plan));
    expect(commitPaymentPlan(data, plan, { replaceInventory: true }).activos).toHaveLength(1);
  });
  it('cambiar una cuenta no restablece otra cuenta editada por separado', () => {
    const plan = fixture();
    plan.accounts.push({ ...structuredClone(plan.accounts[0]), id: 'second', name: 'Segunda tarjeta' });
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.deudasPendientes[1].saldoEstimado = 800;
    const input = structuredClone(plan);
    input.accounts[0].minimum = 175;
    const next = commitPaymentPlan(data, input);
    expect(next.deudasPendientes[0].pagoMinimo).toBe(175);
    expect(next.deudasPendientes[1].saldoEstimado).toBe(800);
  });
  it('conserva una nota independiente al ajustar otro campo del ahorro', () => {
    const plan = fixture();
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.activos[0].notas = 'Nota independiente';
    const input = structuredClone(plan); input.assets[0].balance = 2500;
    const next = commitPaymentPlan(data, input);
    expect(next.activos[0]).toMatchObject({ monto: 2500, notas: 'Nota independiente' });
  });
  it('cambiar el día de ingreso no restablece importes ni elimina gastos', () => {
    const plan = fixture();
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.honorarios.ingresoMensualRecibido = 6000;
    data.gastosOpcionales = [{ id: 'personal', nombre: 'Personal', monto: 200 }];
    const input = structuredClone(plan); input.budget.payday = 10;
    const next = commitPaymentPlan(data, input);
    expect(next.honorarios.ingresoMensualRecibido).toBe(6000);
    expect(next.gastosOpcionales).toEqual(data.gastosOpcionales);
    expect(next.planFinanciero.budget.payday).toBe(10);
  });
  it('no se apropia de gastos independientes al completar un presupuesto abierto', () => {
    const plan = fixture(); plan.budget.livingExpenses = null;
    const data = applyPaymentPlan(emptyFinancialData('gairo'), plan);
    data.gastosNecesarios = [{ id: 'rent', nombre: 'Renta independiente', monto: 900 }];
    data.gastosOpcionales = [{ id: 'gift', nombre: 'Regalos', monto: 100 }];
    const input = structuredClone(plan); input.budget.livingExpenses = 2000;
    const next = commitPaymentPlan(data, input);
    expect(next.gastosNecesarios.find(row => row.id === 'rent')).toEqual(data.gastosNecesarios[0]);
    expect(next.gastosOpcionales).toEqual(data.gastosOpcionales);
    expect(next.planFinanciero.budget.livingExpenses).toBe(2000);
  });
  it('conserva la importación inicial y valida datos antes de guardar', () => {
    const data = emptyFinancialData('gairo');
    expect(commitPaymentPlan(data, fixture())).toEqual(applyPaymentPlan(data, fixture()));
    expect(() => commitPaymentPlan(data, null)).toThrow('Falta la conciliación');
    const invalid = fixture(); invalid.accounts[0].balance = 999;
    expect(() => commitPaymentPlan(data, invalid)).toThrow();
    expect(data.planFinanciero).toBeNull();
  });
});
