import { describe, expect, it } from 'vitest';
import { buildAIContext } from './aiContext.js';
import { calculateCashFlow } from './financeEngine.js';
import { INITIAL_DATA } from './fixtures/legacyData.js';
import { summarizeTransactions } from './transactionAnalytics.js';
import { validateChat, validateContext } from '../../server/ai/contracts.js';

const now = new Date('2026-09-07T12:00:00');
const fx = { rate: 20, source: 'Personalizado (Manual)', lastUpdated: new Date('2026-09-06T12:00:00Z') };
const fact = (context, id) => context.facts.find(item => item.id === id);
const base = () => ({
  honorarios: { importeFacturado: 1000, otrosIngresos: 0 },
  gastosNecesarios: [{ monto: 100, moneda: 'MXN' }],
  gastosOpcionales: [{ monto: 10, moneda: 'USD' }],
  deudas: [{ saldo: 100, pagoMinimo: 5, moneda: 'USD' }],
  activos: [{ monto: 1000, moneda: 'MXN' }, { monto: 10, moneda: 'USD' }],
  transacciones: [],
});

describe('Financial context sent to Claude', () => {
  it('matches the canonical budget margin for the saved initial data at FX 16.8894', () => {
    const rate = 16.8894;
    const canonical = calculateCashFlow(INITIAL_DATA, rate);
    const result = buildAIContext(INITIAL_DATA, { ...fx, rate }, { now });
    expect(fact(result, 'budget.margin').amount).toBe(Number(canonical.flujoLibreReal.toFixed(2)));
    expect(fact(result, 'budget.minimums').amount).toBe(Number(canonical.totalPagosMinimosMXN.toFixed(2)));
    expect(fact(result, 'budget.margin').amount).toBe(4315.74);
  });

  it('preserves fractional FX in debt, minimum and asset totals while keeping recorded movements in cents', () => {
    const rate = 16.8894;
    const data = {
      ...base(),
      honorarios: { importeFacturado: 0, otrosIngresos: 100 },
      gastosNecesarios: [{ monto: 10.01, moneda: 'MXN' }],
      gastosOpcionales: [{ monto: 0.03, moneda: 'MXN' }],
      deudas: Array.from({ length: 5 }, (_, index) => ({
        saldo: index === 0 ? 0.01 : 0.02,
        pagoMinimo: index === 0 ? 0.02 : 0.01,
        moneda: 'USD',
      })),
      activos: Array.from({ length: 5 }, () => ({ monto: 0.01, moneda: 'USD' })),
      transacciones: Array.from({ length: 5 }, () => ({ fecha: '2026-09-01', monto: 0.01, moneda: 'USD', tipo: 'GASTO', categoria: 'Otros' })),
    };
    const canonical = calculateCashFlow(data, rate);
    const ledger = summarizeTransactions(data, '2026-09', rate, 'MXN');
    const result = buildAIContext(data, { ...fx, rate }, { now });
    expect(fact(result, 'budget.margin').amount).toBe(Number(canonical.flujoLibreReal.toFixed(2)));
    expect(fact(result, 'budget.minimums').amount).toBe(Number(canonical.totalPagosMinimosMXN.toFixed(2)));
    expect(fact(result, 'budget.minimums').amount).toBe(0.84);
    expect(fact(result, 'balance.debt').amount).toBe(1.52);
    expect(fact(result, 'balance.assets').amount).toBe(0.84);
    expect(fact(result, 'recorded.expenses').amount).toBe(ledger.expenses);
    expect(fact(result, 'recorded.expenses').amount).toBe(0.85);
  });

  it('retains the existing USD budget normalization without rounding its individual FX projections', () => {
    const data = { ...base(), gastosNecesarios: Array.from({ length: 5 }, () => ({ monto: 0.01, moneda: 'USD' })) };
    const result = buildAIContext(data, { ...fx, rate: 16.8894 }, { now });
    expect(fact(result, 'budget.necessary').amount).toBe(0.84);
  });

  it('passes a real generated financial context through the gateway context and chat contracts', () => {
    const result = buildAIContext(INITIAL_DATA, { ...fx, rate: 16.8894 }, { now });
    const accepted = validateContext(result);
    expect(accepted.facts).toEqual(result.facts);
    expect(accepted.coverage).toEqual(result.coverage);
    expect(accepted.fx).toEqual(result.fx);
    expect(accepted.generatedAt).toBe(result.generatedAt);
    expect(accepted.reportingMonth).toBe(result.reportingMonth);
    expect(validateChat({ action: 'chat', question: 'Explica mi margen mensual estimado.', history: [], context: result, consent: true }).context).toEqual(accepted);
  });

  it('converts each valid movement and budget before aggregation, keeping their bases separate', () => {
    const data = base();
    data.transacciones = [
      { fecha: '2026-09-01', monto: 100, moneda: 'MXN', tipo: 'INGRESO' },
      { fecha: '2026-09-02', monto: 10, moneda: 'USD', tipo: 'INGRESO' },
      { fecha: '2026-09-03', monto: 20, moneda: 'MXN', tipo: 'GASTO', categoria: 'Alimentos' },
      { fecha: '2026-09-04', monto: 2, moneda: 'USD', tipo: 'GASTO', categoria: 'Alimentos' },
    ];
    const result = buildAIContext(data, fx, { now });
    expect(fact(result, 'recorded.income')).toMatchObject({ amount: 300, currency: 'MXN', basis: 'movimientos_registrados' });
    expect(fact(result, 'recorded.expenses').amount).toBe(60);
    expect(fact(result, 'recorded.net').amount).toBe(240);
    expect(fact(result, 'recorded.category.1').amount).toBe(60);
    expect(fact(result, 'budget.optional')).toMatchObject({ amount: 200, basis: 'presupuesto' });
    expect(fact(result, 'budget.minimums').amount).toBe(100);
    expect(fact(result, 'balance.debt').amount).toBe(2000);
    expect(fact(result, 'balance.assets').amount).toBe(1200);
    expect(fact(result, 'budget.margin').basis).toBe('estimacion');
    expect(result.fx).toEqual({ rate: 20, source: 'Personalizado (Manual)', asOf: '2026-09-06T12:00:00.000Z' });
  });

  it('limits coverage to valid dated positive movements recorded this month through today', () => {
    const data = base();
    const transaction = { fecha: '2026-09-03', monto: 10, moneda: 'MXN', tipo: 'GASTO' };
    data.transacciones = [
      transaction,
      { ...transaction, fecha: '2026-09-07' },
      { ...transaction, fecha: '2026-09-08' },
      { ...transaction, fecha: '2026-08-31' },
      { ...transaction, fecha: '2026-09-31' },
      { ...transaction, moneda: 'EUR' },
      { ...transaction, moneda: undefined },
      { ...transaction, monto: -1 },
      { ...transaction, monto: 0 },
      { ...transaction, monto: 'not money' },
      { ...transaction, monto: 0.001 },
      { ...transaction, tipo: 'TRANSFERENCIA' },
      null,
    ];
    const result = buildAIContext(data, fx, { now });
    expect(result.coverage).toEqual({ transactionCount: 2, firstDate: '2026-09-03', lastDate: '2026-09-07' });
    expect(fact(result, 'recorded.expenses').amount).toBe(20);
    expect(result.reportingMonth).toBe('2026-09');
    expect(result.generatedAt).toBe(now.toISOString());
  });

  it('never sends profile, access credentials, account identifiers, descriptions, or raw rows', () => {
    const secret = 'DO-NOT-SEND-THIS-SECRET';
    const data = base();
    Object.assign(data, { profileId: secret, profileName: secret, licencia: { claveActivacion: secret }, config: { apiKey: secret } });
    data.honorarios.apiKey = secret;
    data.deudas[0].nombre = secret;
    data.deudas[0].institucion = secret;
    data.transacciones = [{ id: secret, fecha: '2026-09-02', descripcion: secret, metodoPago: secret, monto: 10, moneda: 'MXN', tipo: 'GASTO', categoria: 'Alimentos' }];
    const result = buildAIContext(data, { ...fx, source: secret }, { now });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(Object.keys(result).sort()).toEqual(['coverage', 'currency', 'facts', 'fx', 'generatedAt', 'reportingMonth', 'version']);
    for (const item of result.facts) expect(Object.keys(item).sort()).toEqual(['amount', 'basis', 'currency', 'id', 'label', 'period']);
  });

  it('does not turn absent transaction history into zero spending or invented trends', () => {
    const result = buildAIContext(base(), fx, { now });
    expect(result.coverage).toEqual({ transactionCount: 0, firstDate: null, lastDate: null });
    expect(result.facts.some(item => item.basis === 'movimientos_registrados')).toBe(false);
    expect(result.facts.some(item => item.id.includes('growth') || item.id.includes('trend'))).toBe(false);
    expect(fact(result, 'budget.optional').amount).toBe(200);
  });

  it('bounds category disclosure and keeps unsupported budget totals out of facts', () => {
    const data = base();
    data.gastosOpcionales = [{ monto: 200, moneda: 'EUR' }];
    data.transacciones = Array.from({ length: 100 }, (_, index) => ({
      fecha: '2026-09-02', monto: index + 1, moneda: 'MXN', tipo: 'GASTO', categoria: `${index} ${'a'.repeat(300)}`,
    }));
    const result = buildAIContext(data, fx, { now });
    expect(fact(result, 'budget.optional')).toBeUndefined();
    expect(fact(result, 'budget.margin')).toBeUndefined();
    expect(result.facts.length).toBeLessThanOrEqual(40);
    expect(result.facts.filter(item => item.id.startsWith('recorded.category.'))).toHaveLength(6);
    expect(result.facts.every(item => item.label.length <= 180 && Number.isFinite(item.amount))).toBe(true);
  });

  it('labels a fallback exchange rate without inventing its observation date', () => {
    const result = buildAIContext(base(), { rate: Infinity, source: 'Mercado en vivo (Open ER API)', lastUpdated: now }, { now });
    expect(result.fx).toEqual({ rate: 19.25, source: 'Tasa base de contingencia', asOf: null });
  });

  it('omits income and margin estimates when fiscal inputs are missing or invalid', () => {
    for (const honorarios of [{}, { importeFacturado: 'invalid', otrosIngresos: 100 }, { importeFacturado: 1000, tasaIva: -1 }]) {
      const result = buildAIContext({ ...base(), honorarios }, fx, { now });
      expect(fact(result, 'budget.income')).toBeUndefined();
      expect(fact(result, 'budget.tax')).toBeUndefined();
      expect(fact(result, 'budget.margin')).toBeUndefined();
      expect(fact(result, 'balance.assets').amount).toBe(1200);
    }
  });
});
