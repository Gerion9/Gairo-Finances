import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import { emptyFinancialData, hasFinancialRecords } from './accountData.js';
import { normalizeBackup, createAccountBackup, restoreAccountBackup } from './backup.js';
import { calculateCashFlow, calculateFortnightlyFlow } from './financeEngine.js';
import { debtCoverage, saveDebtRecord, undatedCommitments } from './planning.js';
import { buildAIContext } from './aiContext.js';
import { validateContext } from '../../server/ai/protocol.js';
import { buildFinancialWorkbook } from './excelExport.js';
import PlanningOverview from '../components/PlanningOverview.jsx';
import FinancialCalculatorsHub from '../components/FinancialCalculatorsHub.jsx';
import FinancialEducationHub from '../components/FinancialEducationHub.jsx';

function fixture() {
  const data = emptyFinancialData('gairo');
  data.honorarios = { ...data.honorarios, modo: 'MANUAL', ingresoMensualRecibido: 20000, provisionFiscalMensual: 1100, regimen: 'Régimen declarado', diaPagoImpuestos: null };
  data.gastosNecesarios = [{ id: 'education', nombre: 'Colegiatura', monto: 5750, diaPago: null }];
  data.deudasPendientes = [
    { id: 'card', nombre: 'Tarjeta de prueba', institucion: 'Banco de prueba', clase: 'TARJETA', numeroCuentas: 1, moneda: 'MXN', saldoEstimado: null },
    { id: 'loans', nombre: 'Préstamos de prueba', clase: 'PRESTAMOS_ESTUDIANTILES', numeroCuentas: 2, moneda: 'USD', saldoEstimado: 600 },
  ];
  return data;
}

describe('Planeación con datos por confirmar', () => {
  it('conserva nulos, grupos y referencias en un respaldo de ida y vuelta', () => {
    const data = fixture();
    data.deudasPendientes[0].referenciaTasa = 'Promedio público, no tasa contractual';
    data.deudasPendientes[0].fuenteTasa = 'https://example.com/terms';
    const restored = restoreAccountBackup(JSON.parse(JSON.stringify(createAccountBackup(data, 'gairo'))), 'gairo');
    expect(restored.deudasPendientes[0]).toMatchObject({ saldoEstimado: null, tasaAnual: null, pagoMinimo: null, diaPagoLimite: null, referenciaTasa: data.deudasPendientes[0].referenciaTasa });
    expect(restored.gastosNecesarios[0].diaPago).toBeNull();
    expect(debtCoverage(restored)).toMatchObject({ pendingAccounts: 3, missingBalances: 1, totals: { MXN: 0, USD: 600 } });
  });
  it('descuenta impuestos una sola vez sin derivar tasas fiscales', () => {
    const cash = calculateCashFlow(normalizeBackup(fixture()), 20);
    expect(cash.fiscal.netoEnCuenta).toBe(20000);
    expect(cash.fiscal.ingresoDisponibleReal).toBe(18900);
    expect(cash.flujoLibreReal).toBe(13150);
    expect(cash.fiscal.desgloseFiscalDisponible).toBe(false);
  });
  it('no inventa quincenas ni fechas de impuestos o colegiatura', () => {
    const data = fixture();
    const result = calculateFortnightlyFlow(data, 20);
    expect(result.quincena1.totalSalidas + result.quincena2.totalSalidas).toBe(0);
    expect(undatedCommitments(data)).toHaveLength(2);
    data.honorarios.diaPagoImpuestos = 18;
    expect(calculateFortnightlyFlow(data, 20).quincena2.totalSalidas).toBe(1100);
  });
  it('promueve una deuda sin conservarla dos veces y rechaza colisiones de IDs', () => {
    const data = fixture();
    const ready = { id: 'card', nombre: 'Tarjeta de prueba', moneda: 'MXN', saldo: 100, pagoMinimo: 10, tasaAnual: 20, diaCorte: 2, diaPagoLimite: 22, tipo: 'HIGH_INTEREST' };
    const result = normalizeBackup(saveDebtRecord(data, ready));
    expect(result.deudas).toHaveLength(1);
    expect(result.deudasPendientes).toHaveLength(1);
    data.deudas = [ready];
    expect(() => normalizeBackup(data)).toThrow('a la vez');
  });
  it('omite totales engañosos del chat y mantiene USD sin conversión implícita', () => {
    const context = buildAIContext(fixture(), { rate: 20 });
    expect(() => validateContext(context)).not.toThrow();
    expect(context.facts.find(row => row.id === 'budget.income').amount).toBe(20000);
    expect(context.facts.find(row => row.id === 'budget.tax').amount).toBe(1100);
    expect(context.facts.find(row => row.id === 'budget.subtotal').amount).toBe(13150);
    expect(context.facts.find(row => row.id === 'balance.known.USD')).toMatchObject({ amount: 600, currency: 'USD' });
    expect(context.facts.find(row => row.id === 'balance.pending').amount).toBeNull();
    expect(context.facts.some(row => ['budget.margin', 'budget.minimums', 'balance.debt'].includes(row.id))).toBe(false);
  });
  it('exporta pendientes y no presenta patrimonio ni desglose fiscal inventados', () => {
    const workbook = buildFinancialWorkbook(fixture(), 20);
    expect(workbook.SheetNames).toContain('Deudas pendientes');
    const balance = XLSX.utils.sheet_to_json(workbook.Sheets['Estructura de Capital'], { header: 1 });
    expect(balance.at(-1).at(-1)).toContain('Pendiente');
    const fiscal = XLSX.utils.sheet_to_json(workbook.Sheets['Parámetros Fiscales'], { header: 1 });
    expect(fiscal.at(-1).at(-1)).toContain('No disponibles');
  });
  it('el resumen reconoce registros pendientes y no los presenta liquidados', () => {
    const data = fixture();
    expect(hasFinancialRecords({ ...emptyFinancialData('gairo'), deudasPendientes: data.deudasPendientes })).toBe(true);
    const html = renderToStaticMarkup(createElement(PlanningOverview, { financialData: data, cashFlow: calculateCashFlow(data), onNavigate: () => {} }));
    expect(html).toContain('Saldo por confirmar');
    expect(html).toContain('3 créditos por completar');
    expect(html).toContain('USD');
    expect(html).not.toContain('Liquidada');
  });
  it('rechaza referencias inseguras y días inválidos', () => {
    const data = fixture(); data.deudasPendientes[0].fuenteTasa = 'javascript:alert(1)';
    expect(() => normalizeBackup(data)).toThrow('HTTPS');
    delete data.deudasPendientes[0].fuenteTasa; data.gastosNecesarios[0].diaPago = 32;
    expect(() => normalizeBackup(data)).toThrow('día de gasto');
  });
  it('impide resultados dependientes de datos contractuales o fiscales desconocidos', () => {
    for (const tool of ['windfall', 'rule503020', 'fire', 'deductions', 'resico']) {
      const html = renderToStaticMarkup(createElement(FinancialCalculatorsHub, { financialData: fixture(), exchangeRate: 20, initialCalculator: tool }));
      expect(html).toContain('Faltan datos para este cálculo');
      expect(html).not.toContain('Distribución Óptima Sugerida');
    }
    const independent = renderToStaticMarkup(createElement(FinancialCalculatorsHub, { financialData: fixture(), exchangeRate: 20, initialCalculator: 'cat' }));
    expect(independent).not.toContain('Faltan datos para este cálculo');
  });
  it('cuenta créditos agrupados en hábitos sin declararlos liquidados', () => {
    const html = renderToStaticMarkup(createElement(FinancialEducationHub, { debts: [], pendingDebts: fixture().deudasPendientes }));
    expect(html).toContain('3 por completar');
    expect(html).not.toContain('0 deudas en tu registro');
  });
});
