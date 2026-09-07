import { describe, it, expect } from 'vitest';

import { 
  categorizeExpense, 
  isDuplicateTransaction 
} from './categorizer.js';

import { 
  computeSHA256, 
  generateMnemonicWords 
} from './cryptoStorage.js';

import { 
  generateQIF 
} from './qifExport.js';

import { 
  isSoundEnabled, 
  setSoundEnabled 
} from './soundEffects.js';

import { 
  isHapticsEnabled, 
  setHapticsEnabled 
} from './haptics.js';

import {
  calculateMonteCarloSimulation,
  calculateDebtConsolidationOptimizer,
  calculateCurrencyShock,
  calculateLatePaymentCost,
  calculateOpportunityCost,
  detectMagicMonths,
  calculate50DaysCreditAdvantage,
  calculateAssetSaleInjection,
  calculateLaborPrestaciones,
  calculateLaborLiquidation,
  calculatePPRTaxMaximizer
} from './calculators.js';

describe('New FinTech Optimization Services & Algorithms', () => {

  describe('Semantic Categorizer (categorizer.js)', () => {
    it('categorizes OXXO as Gastos Hormiga and not deductible', () => {
      const res = categorizeExpense('OXXO TIENDA 4928 GDL');
      expect(res.category).toBe('Gastos Hormiga');
      expect(res.isEssential).toBe(false);
      expect(res.isDeductible).toBe(false);
    });

    it('categorizes Walmart as Supermercado and essential', () => {
      const res = categorizeExpense('WALMART SUPERCENTER 2049');
      expect(res.category).toBe('Supermercado');
      expect(res.isEssential).toBe(true);
    });

    it('categorizes Farmacia Guadalajara as Salud / Farmacia and deductible for SAT', () => {
      const res = categorizeExpense('FARMACIA GUADALAJARA SUC 12');
      expect(res.category).toBe('Salud / Farmacia');
      expect(res.isDeductible).toBe(true);
    });

    it('detects duplicate transactions accurately', () => {
      const t1 = { id: '1', fecha: '2026-05-10', monto: 350.00, concepto: 'Uber trip' };
      const t2 = { id: '2', fecha: '2026-05-11', monto: 350.00, concepto: 'Uber trip' };
      const t3 = { id: '3', fecha: '2026-05-25', monto: 350.00, concepto: 'Uber trip' };
      expect(isDuplicateTransaction(t1, t2)).toBe(true);
      expect(isDuplicateTransaction(t1, t3)).toBe(false);
    });
  });

  describe('Cryptographic Storage & BIP-39 Words (cryptoStorage.js)', () => {
    it('computes consistent SHA-256 hash', async () => {
      const hash1 = await computeSHA256('GairoFinances2026');
      const hash2 = await computeSHA256('GairoFinances2026');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('generates 12 valid mnemonic words for backup recovery', () => {
      const words = generateMnemonicWords(12);
      expect(words).toHaveLength(12);
      words.forEach(w => expect(typeof w).toBe('string'));
    });
  });

  describe('Universal QIF Bank Export (qifExport.js)', () => {
    it('generates valid QIF content with headers and records', () => {
      const txs = [
        { fecha: '2026-04-15', tipo: 'ingreso', monto: 15000, concepto: 'Honorarios Quincena' },
        { fecha: '2026-04-16', tipo: 'gasto', monto: 850, concepto: 'Supermercado' }
      ];
      const qif = generateQIF(txs);
      expect(qif).toContain('!Type:Bank');
      expect(qif).toContain('T15000.00');
      expect(qif).toContain('T-850.00');
      expect(qif).toContain('PHonorarios Quincena');
    });
  });

  describe('Sound and Haptics State Controls', () => {
    it('toggles sound effects enabled state', () => {
      setSoundEnabled(false);
      expect(isSoundEnabled()).toBe(false);
      setSoundEnabled(true);
      expect(isSoundEnabled()).toBe(true);
    });

    it('toggles haptics enabled state', () => {
      setHapticsEnabled(false);
      expect(isHapticsEnabled()).toBe(false);
      setHapticsEnabled(true);
      expect(isHapticsEnabled()).toBe(true);
    });
  });

  describe('Advanced Financial Calculations (calculators.js)', () => {
    it('runs Monte Carlo simulation and outputs percentiles', () => {
      const sim = calculateMonteCarloSimulation(50000, 3500, 40, 24);
      expect(sim.percentil10MejorCaso).toBeGreaterThan(0);
      expect(sim.percentil50Esperado).toBeGreaterThan(0);
      expect(sim.percentil90Pesimista).toBeGreaterThanOrEqual(sim.percentil50Esperado);
      expect(sim.probabilidadExito).toBeGreaterThanOrEqual(0);
    });

    it('calculates debt consolidation loan benefit for expensive cards', () => {
      const deudas = [
        { nombre: 'BBVA Gold', saldo: 80000, tasaInteresAnual: 49.03 },
        { nombre: 'Amex', saldo: 30000, tasaInteresAnual: 55.00 },
        { nombre: 'Blanda 0%', saldo: 20000, tasaInteresAnual: 0.00 }
      ];
      const cons = calculateDebtConsolidationOptimizer(deudas, 22, 24);
      expect(cons.aplicaConsolidacion).toBe(true);
      expect(cons.montoConsolidar).toBe(110000); // 80k + 30k (omits 0% card)
      expect(cons.cuotaNuevaMensual).toBeGreaterThan(0);
      expect(cons.ahorroTotalIntereses).toBeGreaterThan(0);
    });

    it('calculates currency shock stress test scenarios', () => {
      const deudas = [
        { nombre: 'Amex USD', saldo: 1500, moneda: 'USD', pagoMinimoMensual: 100 }
      ];
      const shock = calculateCurrencyShock(deudas, 19.25, [22, 24, 26]);
      expect(shock.tieneDeudasUSD).toBe(true);
      expect(shock.escenarios).toHaveLength(3);
      expect(shock.escenarios[0].saldoMXN).toBe(1500 * 22);
      expect(shock.escenarios[2].saldoMXN).toBe(1500 * 26);
    });

    it('calculates opportunity cost (debt vs CETES)', () => {
      const opp = calculateOpportunityCost(49.03, 11.0, 10000);
      expect(opp.recomendacion).toBe('PAGAR_DEUDA');
      expect(opp.ahorroPorPagarDeuda).toBe(4903);
      expect(opp.gananciaPorInvertir).toBe(1100);
    });

    it('detects magic months with 3 bi-weekly paydays', () => {
      const magic = detectMagicMonths(2026);
      expect(magic.length).toBeGreaterThanOrEqual(1);
    });

    it('calculates 50-day credit card grace period advantage', () => {
      const adv = calculate50DaysCreditAdvantage(10, 30, 11);
      expect(adv.diasDeCreditoGratis).toBeGreaterThanOrEqual(45);
      expect(adv.esMomentoOptimo).toBe(true);
    });

    it('calculates asset sale injection impact on debt', () => {
      const deudas = [{ nombre: 'Tarjeta Tóxica', saldo: 20000, tasaInteresAnual: 45, pagoMinimoMensual: 1200 }];
      const res = calculateAssetSaleInjection(deudas, 5000);
      expect(res.montoInyectado).toBe(5000);
      expect(res.ahorroInteresesEstimado).toBe(2250);
      expect(res.semanasDeVidaGanadas).toBeGreaterThan(0);
    });

    it('calculates Mexican labor prestaciones (Vacaciones Dignas & Aguinaldo)', () => {
      const prest = calculateLaborPrestaciones(30000, 2);
      expect(prest.salarioDiario).toBe(1000);
      expect(prest.aguinaldoLegalMinimo).toBe(15000); // 15 días
      expect(prest.diasVacaciones).toBe(14); // 14 días año 2
      expect(prest.primaVacacionalMinima).toBe(3500); // 14 * 1000 * 0.25
    });

    it('calculates labor liquidation under Art 48/50 LFT', () => {
      const liq = calculateLaborLiquidation(30000, 3, true);
      expect(liq.tresMesesSalario).toBe(90000);
      expect(liq.veinteDiasPorAno).toBe(60000); // 20 * 1000 * 3
      expect(liq.totalLiquidacionEstimada).toBeGreaterThan(150000);
    });

    it('calculates PPR retirement tax refund maximizer for SAT', () => {
      const ppr = calculatePPRTaxMaximizer(600000, 40000);
      expect(ppr.topeMaximoDeducible).toBe(60000); // 10%
      expect(ppr.aportacionConsiderada).toBe(40000);
      expect(ppr.devolucionEstimadaSAT).toBe(12000); // 30% de 40,000
    });
  });

});
