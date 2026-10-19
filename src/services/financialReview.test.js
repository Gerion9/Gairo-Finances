import { describe, expect, it } from 'vitest';
import { emptyFinancialData } from './accountData.js';
import { applyPaymentPlan, normalizePaymentPlan } from './paymentPlan.js';
import { buildFinancialReview } from './financialReview.js';

const today = '2026-10-18';
const review = (data, options = {}) => buildFinancialReview(data, { today, exchangeRate: 20, ...options });
const items = (data, group, options) => review(data, options).groups.find(row => row.id === group).items;
const base = () => emptyFinancialData('gairo');
const transaction = (patch = {}) => ({ id: 't', fecha: today, descripcion: 'Compra', monto: 100, moneda: 'MXN', tipo: 'GASTO', categoria: 'Alimentos', ...patch });
const withPlan = () => applyPaymentPlan(base(), normalizePaymentPlan({ version: 1, asOf: '2026-10-17', accounts: [{ id: 'card', name: 'Tarjeta', currency: 'MXN', balance: 1000, balanceDate: '2026-10-17', dueDate: '2026-10-20', minimum: 100, ordinaryApr: 30, tranches: [{ id: 'r', label: 'Saldo', type: 'REVOLVING', balance: 1000, apr: 30 }] }], assets: [], budget: { monthlyIncome: 5000, monthlyTax: 0, livingExpenses: 1000, payday: 15 } }));

describe('Revisión financiera derivada y explicable', () => {
  it('no inventa pagos, saldos ni score en el estado vacío', () => {
    const result = review(base());
    expect(result.groups.map(group => group.id)).toEqual(['dates', 'transactions', 'data']);
    expect(result.groups[0].items).toEqual([]);
    expect(result.groups[1].items).toEqual([]);
    expect(result.groups[2].items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result).not.toHaveProperty('score');
  });
  it('mantiene el presupuesto opcional para quien sólo sigue cobros', () => {
    const data = base();
    data.receivables = { version: 1, items: [{ id: 'invoice', name: 'Proyecto', amountMinor: 100000, currency: 'MXN', expectedDate: today, createdAt: `${today}T12:00:00Z`, cancelledAt: null }], allocations: [] };
    const before = JSON.stringify(data);
    const result = review(data);
    expect(result.total).toBe(0);
    expect(result.groups.flatMap(group => group.items)).toEqual([]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('conserva asuntos reales sin exigir crear un presupuesto', () => {
    const data = base();
    data.transacciones = [transaction({ categoria: '' })];
    data.deudasPendientes = [{ id: 'pending', nombre: 'Deuda por confirmar' }];
    const result = review(data);
    expect(result.groups.flatMap(group => group.items).map(item => item.id)).toEqual(['categories:2026-10', 'pending-debts']);
    expect(result.total).toBe(2);
  });
  it('cuenta una deuda adaptada una sola vez, sin convertir el escenario en pago', () => {
    const data = withPlan();
    data.pagosRealizadosMes = { '2026-10': { card: true } };
    data.planFinanciero.scenario.cashflow.payments = [{ id: 'p', accountId: 'card', amount: 100, date: '2026-10-19' }];
    const dates = items(data, 'dates');
    expect(dates).toHaveLength(1);
    expect(dates[0].id).toBe('plan:card');
    expect(dates[0].reason).toContain('Fecha registrada');
  });
  it('presenta una divergencia sin emitir dos pagos ni elegir saldo en silencio', () => {
    const data = withPlan(); data.deudasPendientes[0].saldoEstimado = 800;
    expect(items(data, 'dates')).toEqual([]);
    expect(items(data, 'data').filter(item => item.id === 'conflict:card')).toHaveLength(1);
  });
  it('no fusiona créditos distintos por tener el mismo nombre', () => {
    const data = withPlan();
    data.deudas.push({ id: 'other', nombre: 'Tarjeta', saldo: 200, moneda: 'MXN', pagoMinimo: 20, diaPagoLimite: 20 });
    expect(items(data, 'dates')).toHaveLength(2);
  });
  it('un pago tradicional sólo se oculta con confirmación booleana exacta', () => {
    const data = base(); data.gastosNecesarios = [{ id: 'rent', nombre: 'Renta', monto: 100, diaPago: 20 }];
    data.pagosRealizadosMes = { '2026-10': { rent: 'false' } };
    expect(items(data, 'dates')).toHaveLength(1);
    data.pagosRealizadosMes['2026-10'].rent = true;
    expect(items(data, 'dates')).toEqual([]);
  });
  it('admite fechas absolutas del siguiente mes sin inventar recurrencias tradicionales', () => {
    const data = withPlan(); data.planFinanciero.accounts[0].dueDate = '2026-11-02'; data.deudasPendientes[0].diaPagoLimite = 2;
    data.gastosNecesarios.push({ id: 'rent', nombre: 'Renta', monto: 100, diaPago: 2 });
    const dates = items(data, 'dates', { today: '2026-10-30' });
    expect(dates.find(item => item.id === 'plan:card').date).toBe('2026-11-02');
    expect(dates.find(item => item.id.includes('rent')).date).toBe('2026-10-02');
    expect(dates).toHaveLength(2);
  });
  it('respeta fin de febrero en fechas mensuales sin desbordarse a marzo', () => {
    const data = base(); data.gastosNecesarios = [{ id: 'rent', nombre: 'Renta', monto: 100, diaPago: 31 }];
    expect(items(data, 'dates', { today: '2028-02-28' })[0].date).toBe('2028-02-29');
  });
  it('conserva colegiaturas de la misma fecha con identidad distinta y omite el adaptador', () => {
    const data = withPlan(); data.planFinanciero.budget.tuitionPayments = [{ date: '2026-10-22', amount: 100 }, { date: '2026-10-22', amount: 200 }];
    data.gastosNecesarios.push({ id: 'plan-tuition', nombre: 'Colegiatura', monto: 100, diaPago: 22, planManaged: true });
    const dates = items(data, 'dates');
    expect(dates).toHaveLength(3);
    expect(new Set(dates.map(item => item.id)).size).toBe(3);
  });
  it('no confunde cero confirmado con mínimo desconocido', () => {
    const data = withPlan(); data.planFinanciero.accounts[0].minimum = 0; data.deudasPendientes[0].pagoMinimo = 0;
    expect(items(data, 'data').some(item => item.id === 'account-data:card')).toBe(false);
    data.planFinanciero.accounts[0].minimum = null; data.deudasPendientes[0].pagoMinimo = null;
    expect(items(data, 'data').some(item => item.id === 'account-data:card')).toBe(true);
  });
  it('Otros y categorías personalizadas son válidas; el futuro no genera pendientes', () => {
    const data = base(); data.transacciones = [transaction({ categoria: 'Otros' }), transaction({ id: 'c', categoria: 'Viaje' }), transaction({ id: 'blank', categoria: '  ' }), transaction({ id: 'future', fecha: '2026-11-01', categoria: '' })];
    const records = items(data, 'transactions');
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('1 movimiento sin categoría');
    expect(records[0].target.transactionContext).toEqual({ period: '2026-10', uncategorized: true, dateThrough: today });
  });
  it('un registro con fecha inválida conserva acceso a su editor por ID', () => {
    const data = base(); data.transacciones = [transaction({ fecha: '2026-02-30' })];
    const records = items(data, 'transactions');
    expect(records[0].target.transactionContext).toEqual({ transactionId: 't' });
    expect(records[0].evidence).toContain('Selecciona una fecha válida.');
  });
  it('compara sólo categorías compatibles y gastos registrados hasta hoy', () => {
    const data = withPlan();
    data.gastosNecesarios.push({ id: 'food', nombre: 'Comida', monto: 50, categoria: 'Alimentos', diaPago: 20 });
    data.transacciones = [transaction(), transaction({ id: 'future', monto: 10000, fecha: '2026-10-25' })];
    const records = items(data, 'transactions').filter(item => item.id.startsWith('budget:'));
    expect(records).toHaveLength(1);
    expect(records[0].target.transactionContext).toEqual({ period: '2026-10', category: 'Alimentos', type: 'GASTO', dateThrough: today });
    expect(records[0].reason).toContain('$100.00');
    expect(records[0].reason).not.toContain('10,100');
  });
  it('un presupuesto desconocido genera una causa, no gasto disponible ni exceso inventado', () => {
    const data = withPlan(); data.planFinanciero.budget.livingExpenses = null;
    expect(items(data, 'data').some(item => item.id === 'plan-budget')).toBe(true);
    expect(items(data, 'transactions')).toEqual([]);
  });
  it('distingue un límite explícito de cero de una categoría sin presupuesto', () => {
    const data = base();
    data.gastosNecesarios = [{ id: 'food', categoria: 'Alimentos', monto: 0 }];
    data.transacciones = [transaction(), transaction({ id: 'other', categoria: 'Transporte' })];
    const records = items(data, 'transactions').filter(item => item.id.startsWith('budget:'));
    expect(records.map(item => item.target.transactionContext.category)).toEqual(['Alimentos']);
    data.gastosNecesarios[0].monto = null;
    expect(items(data, 'transactions').filter(item => item.id.startsWith('budget:'))).toEqual([]);
  });
  it('un movimiento sin categoría no consume el presupuesto de Otros', () => {
    const data = base(); data.gastosNecesarios = [{ id: 'other', categoria: 'Otros', monto: 0 }];
    data.transacciones = [transaction({ categoria: '' })];
    expect(items(data, 'transactions').map(item => item.id)).toEqual(['categories:2026-10']);
  });
  it('incluye la provisión fiscal mensual una sola vez y respeta su marca manual', () => {
    const data = base(); data.honorarios = { ...data.honorarios, modo: 'MANUAL', provisionFiscalMensual: 500, diaPagoImpuestos: 20 };
    data.gastosNecesarios = [{ id: 'provision-fiscal', nombre: 'Provisión', monto: 500, diaPago: 20 }];
    expect(items(data, 'dates')).toHaveLength(1);
    expect(items(data, 'dates')[0].target.options.itemId).toBe('provision-fiscal');
    data.pagosRealizadosMes = { '2026-10': { 'provision-fiscal': true } };
    expect(items(data, 'dates')).toEqual([]);
  });
  it('incluye impuestos del plan mediante su presupuesto adaptado', () => {
    const data = withPlan();
    data.planFinanciero.budget.monthlyTax = 500; data.planFinanciero.budget.taxDay = 20;
    const adapted = applyPaymentPlan(data, data.planFinanciero);
    expect(items(adapted, 'dates').filter(item => item.target.options?.itemId === 'provision-fiscal')).toHaveLength(1);
  });
  it('no consolida importes nativos de fechas en una moneda implícita', () => {
    const data = withPlan(); data.planFinanciero.accounts[0].currency = 'USD'; data.deudasPendientes[0].moneda = 'USD';
    const row = items(data, 'dates', { displayCurrency: 'MXN' })[0];
    expect(row.evidence[0]).toContain('$100.00 USD');
    expect(row.evidence[0]).not.toContain('2,000');
  });
  it('explica la regla de antigüedad sin usar fecha de sincronización y no muta entradas', () => {
    const data = withPlan(); data.planFinanciero.accounts[0].balanceDate = '2026-01-01';
    const baseline = JSON.stringify(data);
    const first = review(data);
    expect(first.groups[2].items.find(item => item.id === 'dated-balances').reason).toContain('45 días');
    expect(review(data)).toEqual(first);
    expect(JSON.stringify(data)).toBe(baseline);
    expect(first.total).toBe(first.groups.reduce((sum, group) => sum + group.items.length, 0));
  });
  it('rechaza una fecha de evaluación inválida', () => {
    expect(() => review(base(), { today: '2026-02-30' })).toThrow('fecha válida');
  });
});
