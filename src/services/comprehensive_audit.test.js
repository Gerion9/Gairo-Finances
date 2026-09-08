import { describe, it, expect } from 'vitest';
import { 
  calculateCATReal, 
  calculateMSIvsDiscount, 
  calculateWindfallAllocation, 
  calculateGastosHormiga, 
  calculate503020Rule, 
  calculateRefinancingBenefit, 
  calculateFIRERetirement, 
  calculateWorkHoursCost, 
  calculateBorrowingCapacity, 
  calculateRentVsBuy, 
  calculateRealYield, 
  calculatePersonalTaxDeductions, 
  calculateResicoVsPfae 
} from './calculators.js';
import { 
  calculateFiscalOverview, 
  calculateCashFlow, 
  calculateInterestBleed, 
  calculateFinancialHealthScore, 
  calculateFortnightlyFlow, 
  analyzePromoDeadlines, 
  runStrategySimulation, 
  compareAllStrategies 
} from './financeEngine.js';
import { convertCurrency, formatMoney, DEFAULT_USD_MXN } from './exchangeRate.js';
import { INITIAL_DATA } from './fixtures/legacyData.js';

describe('1. Calculadoras Financieras Avanzadas - Edge Cases & Math Guards', () => {

  describe('calculateCATReal', () => {
    it('calculates CAT accurately for standard BBVA Gold debt', () => {
      const res = calculateCATReal(120000, 49.03, 12, 1131, 0);
      expect(res.cuotaMensual).toBeGreaterThan(12000);
      expect(res.totalInteresesYCargos).toBeGreaterThan(0);
      expect(res.catReal).toBeGreaterThanOrEqual(49.03);
      expect(isNaN(res.cuotaMensual)).toBe(false);
    });

    it('handles 0% interest rate without NaN', () => {
      const res = calculateCATReal(10000, 0, 10, 0, 0);
      expect(res.cuotaMensual).toBe(1000);
      expect(res.totalInteresesYCargos).toBe(0);
      expect(isNaN(res.cuotaMensual)).toBe(false);
    });

    it('handles $0 balance gracefully', () => {
      const res = calculateCATReal(0, 45, 12, 0, 0);
      expect(res.cuotaMensual).toBe(0);
      expect(res.totalPagado).toBe(0);
      expect(res.catReal).toBe(0);
    });

    it('handles missing or negative parameters without crashing', () => {
      const res = calculateCATReal(-500, -10, -5, -10, -10);
      expect(isNaN(res.cuotaMensual)).toBe(false);
      expect(res.cuotaMensual).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateMSIvsDiscount', () => {
    it('correctly compares 10% discount vs 12 MSI with CETES at 9.5%', () => {
      const res = calculateMSIvsDiscount(20000, 10, 12, 9.5);
      expect(['CONTADO', 'MSI']).toContain(res.mejorOpcion);
      expect(res.diferencia).toBeGreaterThan(0);
      expect(res.precioContado).toBe(18000);
      expect(res.ahorroContado).toBe(2000);
    });

    it('handles 0% discount and 0 MSI gracefully', () => {
      const res = calculateMSIvsDiscount(15000, 0, 0, 0);
      expect(isNaN(res.diferencia)).toBe(false);
      expect(res.ahorroContado).toBe(0);
    });
  });

  describe('calculateWindfallAllocation', () => {
    it('prioritizes 0% promo deadline first, then high-interest debts', () => {
      const deudas = [
        { id: '1', nombre: 'Promo Apple', saldo: 10000, tipo: 'PROMO_DEADLINE', tasaAnual: 0, moneda: 'MXN' },
        { id: '2', nombre: 'BBVA Gold', saldo: 50000, tipo: 'HIGH_INTEREST', tasaAnual: 49.03, moneda: 'MXN' },
        { id: '3', nombre: 'Blando', saldo: 20000, tipo: 'LOW_INTEREST_HOLD', tasaAnual: 4, moneda: 'MXN' }
      ];

      const res = calculateWindfallAllocation(25000, deudas, 19.25);
      expect(res.totalInyeccion).toBe(25000);
      expect(res.asignaciones.length).toBe(2);
      expect(res.asignaciones[0].deudaId).toBe('1');
      expect(res.asignaciones[0].montoAsignado).toBe(10000);
      expect(res.asignaciones[1].deudaId).toBe('2');
      expect(res.asignaciones[1].montoAsignado).toBe(15000);
      expect(res.sobranteEfectivo).toBe(0);
    });

    it('handles empty deudas or 0 extra cash without error', () => {
      const res = calculateWindfallAllocation(0, [], 19.25);
      expect(res.asignaciones.length).toBe(0);
      expect(res.sobranteEfectivo).toBe(0);
    });
  });

  describe('calculateGastosHormiga', () => {
    it('calculates 5, 10, 20 year future values accurately', () => {
      const res = calculateGastosHormiga(85, 24, 9.5);
      expect(res.gastoMensual).toBe(2040);
      expect(res.costoOportunidad5Anos).toBeGreaterThan(res.gastoAnual * 5);
      expect(res.costoOportunidad20Anos).toBeGreaterThan(res.costoOportunidad10Anos);
    });

    it('handles 0% CETES rate without NaN', () => {
      const res = calculateGastosHormiga(50, 20, 0);
      expect(res.gastoMensual).toBe(1000);
      expect(res.costoOportunidad5Anos).toBe(1000 * 60);
      expect(isNaN(res.costoOportunidad5Anos)).toBe(false);
    });
  });

  describe('calculate503020Rule', () => {
    it('analyzes budget distribution percentages accurately', () => {
      const res = calculate503020Rule(50000, 25000, 15000, 10000);
      expect(res.actual.pctNecesidades).toBe(50);
      expect(res.actual.pctDeseos).toBe(30);
      expect(res.actual.pctAhorroDeuda).toBe(20);
      expect(res.cumple).toBe(true);
    });

    it('handles $0 income without NaN or division-by-zero crash', () => {
      const res = calculate503020Rule(0, 5000, 2000, 1000);
      expect(res.actual.pctNecesidades).toBe(0);
      expect(isNaN(res.actual.pctNecesidades)).toBe(false);
    });
  });

  describe('calculateRefinancingBenefit', () => {
    it('computes interest savings when moving from 49% to 18%', () => {
      const res = calculateRefinancingBenefit(120000, 49.03, 18.0, 24);
      expect(res.ahorroTotalIntereses).toBeGreaterThan(30000);
      expect(res.reduccionCuotaMensual).toBeGreaterThan(0);
      expect(res.porcentajeAhorro).toBeGreaterThan(0);
    });

    it('handles 0% interest rates without NaN', () => {
      const res = calculateRefinancingBenefit(50000, 0, 0, 10);
      expect(res.cuotaVieja).toBe(5000);
      expect(res.cuotaNueva).toBe(5000);
      expect(res.ahorroTotalIntereses).toBe(0);
      expect(isNaN(res.cuotaVieja)).toBe(false);
    });
  });

  describe('calculateFIRERetirement', () => {
    it('calculates FIRE number (25x annual expenses)', () => {
      const res = calculateFIRERetirement(324000, 50000, 10000, 9.0);
      expect(res.numeroFIRE).toBe(324000 * 25);
      expect(res.anosParaRetiro).toBeGreaterThan(10);
      expect(res.anosParaRetiro).toBeLessThan(40);
    });

    it('returns 0 years if current wealth already exceeds FIRE number', () => {
      const res = calculateFIRERetirement(100000, 5000000, 5000, 9.0);
      expect(res.anosParaRetiro).toBe(0);
    });

    it('handles 0 return and 0 savings gracefully', () => {
      const res = calculateFIRERetirement(200000, 10000, 0, 0);
      expect(res.anosParaRetiro).toBe(99.0);
      expect(isNaN(res.anosParaRetiro)).toBe(false);
    });
  });

  describe('calculateWorkHoursCost', () => {
    it('converts purchase price into labor hours', () => {
      const res = calculateWorkHoursCost(48000, 160, 3000);
      expect(res.ingresoPorHora).toBe(300);
      expect(res.horasNecesarias).toBe(10);
      expect(res.diasLaborales).toBe(1.3);
    });

    it('handles 0 income without dividing by zero', () => {
      const res = calculateWorkHoursCost(0, 160, 2000);
      expect(res.ingresoPorHora).toBe(0);
      expect(res.horasNecesarias).toBe(0);
      expect(isNaN(res.horasNecesarias)).toBe(false);
    });
  });

  describe('calculateRentVsBuy', () => {
    it('compares rent vs 20-year mortgage accurately', () => {
      const res = calculateRentVsBuy(8500, 2200000, 20, 10.5);
      expect(res.engancheRequerido).toBe(440000);
      expect(res.mensualidadHipoteca).toBeGreaterThan(15000);
      expect(res.diferenciaMensual).toBeGreaterThan(0);
      expect(res.consejo).toBeDefined();
    });

    it('handles 0% mortgage rate without NaN', () => {
      const res = calculateRentVsBuy(5000, 1200000, 10, 0);
      expect(res.mensualidadHipoteca).toBe(Math.round((1200000 * 0.9) / 240));
      expect(isNaN(res.mensualidadHipoteca)).toBe(false);
    });
  });

  describe('calculateRealYield', () => {
    it('computes net yield after tax and inflation', () => {
      const res = calculateRealYield(10.0, 4.0, 0.5);
      expect(res.tasaNeta).toBe(9.5);
      expect(res.rendimientoRealNeto).toBeCloseTo(5.29, 1);
      expect(res.leGanaALaInflacion).toBe(true);
    });

    it('detects when inflation erodes yield', () => {
      const res = calculateRealYield(4.0, 6.0, 0.5);
      expect(res.leGanaALaInflacion).toBe(false);
      expect(res.rendimientoRealNeto).toBeLessThan(0);
    });
  });

  describe('calculatePersonalTaxDeductions & RESICO', () => {
    it('calculates SAT deduction ceiling (15% limit)', () => {
      const res = calculatePersonalTaxDeductions(480000, 20000, 30000, 0);
      expect(res.totalDeducciones).toBe(50000);
      expect(res.devolucionEstimadaSAT).toBe(12500);
    });

    it('compares RESICO vs PFAE correctly', () => {
      const res = calculateResicoVsPfae(480000, 250000);
      expect(res.facturacionAnual).toBe(480000);
      expect(res.isrResico).toBeLessThan(res.isrPfae);
      expect(res.regimenMasConveniente).toBe('RESICO');
      expect(res.ahorroEstimadoConResico).toBeGreaterThan(0);
    });
  });
});

describe('2. Motor Financiero Integral (Synthetic Calculation Cases)', () => {

  it('calculates synthetic invoice amounts and provisions to the exact cent', () => {
    const honorarios = {
      importeFacturado: 40000,
      tasaIva: 0.16,
      retencionIsrTasa: 0.10,
      retencionIvaFraccion: 0.6667,
      tasaIsrDeclaracion: 0.20,
      otrosIngresos: 1000
    };

    const fiscal = calculateFiscalOverview(honorarios);

    // Independent arithmetic: 40,000 * 16% VAT and 6,400 * 0.6667 withheld VAT.
    expect(fiscal.importeFacturado).toBe(40000);
    expect(fiscal.ivaCobrado).toBeCloseTo(6400, 2);
    expect(fiscal.subtotalCfdi).toBeCloseTo(46400, 2);
    expect(fiscal.retencionIsr).toBeCloseTo(4000, 2);
    expect(fiscal.retencionIva).toBeCloseTo(4266.88, 2);
    expect(fiscal.netoEnCuenta).toBeCloseTo(38133.12, 2);

    // SAT monthly provision
    expect(fiscal.isrACargo).toBeCloseTo(4000, 2);
    expect(fiscal.ivaACargo).toBeCloseTo(2133.12, 2);
    expect(fiscal.totalImpuestosSat).toBeCloseTo(6133.12, 2);
  });

  it('calculates full cash flow, minimum debt payments and free cashflow', () => {
    const cashFlow = calculateCashFlow(INITIAL_DATA, 19.25);
    expect(cashFlow.totalCostodeVida).toBe(12000);
    expect(cashFlow.totalGastosOpcionales).toBe(2000);
    expect(cashFlow.totalPagosMinimosMXN).toBe(3262);
    expect(cashFlow.flujoLibreReal).toBeCloseTo(15738, 2);
  });

  it('calculates accurate Interest Bleed Rate (daily, monthly, annual)', () => {
    const bleed = calculateInterestBleed(INITIAL_DATA.deudas, 19.25);
    expect(bleed.interesMensual).toBe(1113);
    expect(bleed.interesDiario).toBe(37);
    expect(bleed.interesAnual).toBe(bleed.interesMensual * 12);
  });

  it('calculates Financial Health Score (0-100) with all 4 factors', () => {
    const health = calculateFinancialHealthScore(INITIAL_DATA, 19.25);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(['Excelente', 'Saludable', 'En Riesgo Moderado', 'Crítico']).toContain(health.status);
    expect(health.recomendaciones.length).toBeGreaterThan(0);
  });

  it('correctly splits expenses and debt deadlines into Fortnight 1 and Fortnight 2', () => {
    const { quincena1, quincena2 } = calculateFortnightlyFlow(INITIAL_DATA, 19.25);
    expect(quincena1.totalSalidas).toBeGreaterThan(0);
    expect(quincena2.totalSalidas).toBeGreaterThan(0);
    expect(quincena1.totalSalidas + quincena2.totalSalidas).toBe(17262);
  });

  it('correctly detects promo deadlines and calculates required quota', () => {
    const promos = analyzePromoDeadlines(INITIAL_DATA.deudas, 19.25);
    expect(promos.length).toBeGreaterThan(0);
    const promotion = promos.find(p => p.id === 'debt-promo');
    expect(promotion).toBeDefined();
    expect(promotion.cuotaSugeridaOriginal).toBeGreaterThan(0);
    expect(['CRITICA', 'ALTA', 'MEDIA', 'NORMAL', 'VENCIDA']).toContain(promotion.urgencia);
  });

  it('simulates promotion-first, Avalanche, Snowball, and Minimums without errors', () => {
    const comparison = compareAllStrategies(INITIAL_DATA.deudas, 2500, 19.25);
    expect(comparison.gairoCustom.monthsToDebtFree).toBeGreaterThan(0);
    expect(comparison.avalanche.monthsToDebtFree).toBeGreaterThan(0);
    expect(comparison.snowball.monthsToDebtFree).toBeGreaterThan(0);
    expect(comparison.minimums.monthsToDebtFree).toBeGreaterThanOrEqual(comparison.gairoCustom.monthsToDebtFree);
    expect(comparison.savingsVsMinimums.moneySaved).toBeGreaterThanOrEqual(0);
    expect(comparison.savingsVsMinimums.monthsSaved).toBeGreaterThanOrEqual(0);
  });
});

describe('3. Multi-Divisa & Exchange Rate Operations', () => {

  it('converts USD to MXN and MXN to USD with fallback rate', () => {
    expect(convertCurrency(100, 'USD', 'MXN', 20.0)).toBe(2000);
    expect(convertCurrency(2000, 'MXN', 'USD', 20.0)).toBe(100);
    expect(convertCurrency(100, 'MXN', 'MXN', 20.0)).toBe(100);
  });

  it('handles invalid or 0 exchange rate safely', () => {
    expect(convertCurrency(100, 'USD', 'MXN', 0)).toBe(100 * DEFAULT_USD_MXN);
    expect(convertCurrency(1000, 'MXN', 'USD', 0)).toBeCloseTo(1000 / DEFAULT_USD_MXN, 2);
    expect(convertCurrency(0, 'USD', 'MXN', 20.0)).toBe(0);
  });

  it('formats money consistently in MXN and USD', () => {
    expect(formatMoney(1234.5, 'MXN')).toBe('$1,234.50');
    expect(formatMoney(1234.5, 'USD')).toBe('US$1,234.50');
    expect(formatMoney(null, 'MXN')).toBe('$0.00');
    expect(formatMoney(undefined, 'USD')).toBe('$0.00');
    expect(formatMoney(NaN, 'MXN')).toBe('$0.00');
  });
});

describe('4. Almacenamiento & Integridad de Datos (storage.js)', () => {

  it('the synthetic legacy fixture covers every backup section', () => {
    expect(INITIAL_DATA.honorarios).toBeDefined();
    expect(INITIAL_DATA.gastosNecesarios.length).toBeGreaterThan(0);
    expect(INITIAL_DATA.gastosOpcionales.length).toBeGreaterThan(0);
    expect(INITIAL_DATA.deudas.length).toBeGreaterThan(0);
    expect(INITIAL_DATA.activos.length).toBeGreaterThan(0);
    expect(INITIAL_DATA.transacciones.length).toBeGreaterThan(0);
    expect(INITIAL_DATA.config).toBeDefined();
  });
});
