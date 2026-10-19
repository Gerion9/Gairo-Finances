import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceWelcome from './WorkspaceWelcome.jsx';
import DashboardOverview from './DashboardOverview.jsx';
import { emptyFinancialData } from '../services/accountData.js';
import { actionUnavailableReason } from '../services/actionAvailability.js';
import { formatMoney } from '../services/exchangeRate.js';

const today = '2026-10-18';
const createdAt = '2026-10-18T12:00:00.000Z';
const item = (values = {}) => ({ id: 'expected', name: 'Proyecto de diseño con un nombre completo que debe conservarse', amountMinor: 22510, currency: 'USD', expectedDate: null, createdAt, cancelledAt: null, ...values });
const receivables = items => ({ version: 1, items, allocations: [] });
const transaction = { id: 'income', tipo: 'INGRESO', descripcion: 'Anticipo registrado', monto: 200, moneda: 'MXN', fecha: today };
const budget = { fiscal: { netoEnCuenta: 10000, otrosIngresos: 500, totalImpuestosSat: 1000 }, totalCostodeVida: 2000, totalGastosOpcionales: 500, totalPagosMinimosMXN: 100, flujoLibreReal: 6900 };
const renderDashboard = (data, props = {}) => renderToStaticMarkup(<DashboardOverview financialData={{ ...emptyFinancialData('gairo'), ...data }} exchangeRate={20} {...props} />);
const buttons = html => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
const buttonWith = (html, text) => buttons(html).find(button => button.includes(text));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 18, 12)); });
afterEach(() => vi.useRealTimers());

describe('Task-oriented workspace welcome', () => {
  it('presents four equally named tasks without a forced sequence or budget prerequisite', () => {
    const html = renderToStaticMarkup(<WorkspaceWelcome onNavigate={() => {}} onQuickAdd={() => {}} onNewDebt={() => {}} onImportBackup={() => {}} />);
    expect((html.match(/class="welcome-task"/g) || []).length).toBe(4);
    for (const title of ['Registrar un movimiento', 'Seguir un cobro', 'Organizar una deuda', 'Explorar productos financieros', 'Configurar mi presupuesto']) expect(buttonWith(html, title)).toBeDefined();
    expect(html.includes('Tu espacio está listo')).toBe(false);
    expect(html.includes('welcome-step')).toBe(false);
    expect(html.includes('<h1 tabindex="-1">Empieza por lo que necesitas</h1>')).toBe(true);
  });
  it('disables editing and restoration in read-only mode but leaves navigation available', () => {
    const handler = vi.fn();
    const html = renderToStaticMarkup(<WorkspaceWelcome readOnly onNavigate={handler} onQuickAdd={handler} onNewDebt={handler} onImportBackup={handler} />);
    for (const text of ['Registrar un movimiento', 'Organizar una deuda', 'Ya tengo un respaldo']) expect(buttonWith(html, text)).toContain('disabled=""');
    for (const text of ['Seguir un cobro', 'Explorar productos financieros', 'Configurar mi presupuesto']) expect(buttonWith(html, text)).not.toContain('disabled=""');
    expect(html.includes(actionUnavailableReason('newTransaction', { readOnly: true }))).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Returning workspace presentation', () => {
  it('makes expected-only activity visible without a fictitious budget, balance or movement total', () => {
    const record = item();
    const html = renderDashboard({ receivables: receivables([record]) });
    expect(html.includes('Cobros esperados')).toBe(true);
    expect(html.includes(record.name)).toBe(true);
    expect(html.includes(`${formatMoney(record.amountMinor / 100, record.currency)} USD`)).toBe(true);
    expect(html.includes('Sin fecha acordada')).toBe(true);
    expect(html.includes('1 cobro pendiente')).toBe(true);
    expect(html.includes('Pendiente de recibir; no forma parte de tu saldo disponible.')).toBe(true);
    for (const absent of ['Margen mensual estimado', 'Por configurar', 'Balance consolidado', 'Movimientos recientes', 'Pagos de este mes']) expect(html.includes(absent)).toBe(false);
    expect(html.includes('class="dashboard-receivable-record" data-sensitive="true"')).toBe(true);
    expect(html.indexOf('Cobros esperados')).toBeLessThan(html.indexOf('Configura un presupuesto'));
  });
  it('puts movements first when they are the only activity and uses the singular count', () => {
    const html = renderDashboard({ transacciones: [transaction] }, { onImportStatement: () => {} });
    expect(html.includes('Movimientos recientes')).toBe(true);
    expect(html.includes('1 registro.')).toBe(true);
    expect(html.includes('1 registros.')).toBe(false);
    expect(html.includes('Cobros esperados')).toBe(false);
    expect(html.includes('Margen mensual estimado')).toBe(false);
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    expect(header.includes('Importar estado')).toBe(false);
    expect(header.includes('Registrar movimiento')).toBe(false);
    expect(html.includes('Importar estado')).toBe(true);
  });
  it('shows receivables before movements once each without a budget', () => {
    const html = renderDashboard({ transacciones: [transaction], receivables: receivables([item()]) });
    expect(html.indexOf('Cobros esperados')).toBeLessThan(html.indexOf('Movimientos recientes'));
    expect((html.match(/>Cobros esperados</g) || []).length).toBe(1);
    expect((html.match(/>Movimientos recientes</g) || []).length).toBe(1);
  });
  it('preserves the budget result and waterfall without adding an expected receipt', () => {
    const html = renderDashboard({ receivables: receivables([item({ amountMinor: 9999900 })]) }, { cashFlow: budget, review: { total: 0 } });
    const margin = html.slice(html.indexOf('class="dashboard-margin-amount"'), html.indexOf('class="dashboard-margin-description"'));
    expect(margin.includes(formatMoney(6900, 'MXN'))).toBe(true);
    expect(margin.includes('99,999')).toBe(false);
    expect(html.includes('Cómo se compone tu mes')).toBe(true);
    expect(html.includes('class="dashboard-review-grid ')).toBe(true);
    expect((html.match(/>Cobros esperados</g) || []).length).toBe(1);
    expect((html.match(/>Movimientos recientes</g) || []).length).toBe(1);
  });
  it('retains recorded debt and asset blocks without treating debt minimums as a configured budget', () => {
    const html = renderDashboard({ deudas: [{ id: 'debt', nombre: 'Tarjeta registrada', saldo: 300, moneda: 'MXN' }], activos: [{ id: 'asset', nombre: 'Cuenta', monto: 100, moneda: 'MXN' }] }, { cashFlow: { totalPagosMinimosMXN: 100, flujoLibreReal: -100 } });
    expect(html.includes('Balance consolidado')).toBe(true);
    expect(html.includes('Tus saldos, en orden')).toBe(true);
    expect(html.includes('Tarjeta registrada')).toBe(true);
    expect(html.includes('Margen mensual estimado')).toBe(false);
  });
  it('distinguishes cancellation and corrupted receivables instead of reporting zero for a failed read', () => {
    const settled = renderDashboard({ receivables: receivables([item({ cancelledAt: createdAt })]) });
    expect(settled.includes('Sin cobros pendientes en tus registros.')).toBe(true);
    expect(settled.includes(item().name)).toBe(false);
    const broken = renderDashboard({ receivables: { version: 9, items: [item()], allocations: [] } });
    expect(broken.includes('No pudimos leer el seguimiento de cobros')).toBe(true);
    expect(broken.includes('Sin cobros pendientes')).toBe(false);
    expect(buttonWith(broken, 'Ver mis cobros')).not.toContain('disabled');
  });
  it('keeps public navigation active while mutation controls explain paused editing', () => {
    const handler = vi.fn();
    const html = renderDashboard({ receivables: receivables([item()]) }, { cashFlow: budget, readOnly: true, onQuickAdd: handler, onOpenDebtModal: handler, onImportStatement: handler, onNavigateTab: handler });
    for (const text of ['Registrar movimiento', 'Agregar deuda', 'Importar estado']) expect(buttonWith(html, text)).toContain('disabled=""');
    for (const text of ['Ver mis cobros', 'Ver presupuesto', 'Ver todas las deudas', 'Ver todos los movimientos']) expect(buttonWith(html, text)).not.toContain('disabled=""');
    expect(html.includes(actionUnavailableReason('newTransaction', { readOnly: true }))).toBe(true);
    expect(html.includes('<h1 tabindex="-1">')).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
  it('offers a contextual return to a valid standalone payment plan in read-only mode', () => {
    const html = renderDashboard({ planFinanciero: { version: 1, asOf: today, sources: [], accounts: [], assets: [], budget: { monthlyIncome: 0, monthlyTax: 0, expenses: [], tuitionPayments: [] } } }, { readOnly: true });
    expect(html.includes('Tienes un plan de pagos en este espacio')).toBe(true);
    expect(buttonWith(html, 'Abrir mi plan de pagos')).not.toContain('disabled');
    expect(html.indexOf('Abrir mi plan de pagos')).toBeLessThan(html.indexOf('Configura un presupuesto'));
  });
});
