// Motor de cálculo financiero integral, impuestos SAT, estrategias, score de salud y flujo por quincena

import { convertCurrency } from './exchangeRate.js';

// 1. Cálculo Fiscal y CFDI
export function calculateFiscalOverview(honorarios) {
  const importeFacturado = Number(honorarios.importeFacturado) || 0;
  const ivaCobrado = importeFacturado * (honorarios.tasaIva || 0.16);
  const subtotalCfdi = importeFacturado + ivaCobrado;

  const retencionIsr = importeFacturado * (honorarios.retencionIsrTasa || 0.10);
  const retencionIva = ivaCobrado * (honorarios.retencionIvaFraccion !== undefined ? honorarios.retencionIvaFraccion : 0.6667);

  // Cash real que entra a la cuenta bancaria
  const netoEnCuenta = subtotalCfdi - retencionIsr - retencionIva;

  // Declaración mensual al SAT (lo que tú declaras y tienes que pagar)
  const isrTotalEstimado = importeFacturado * (honorarios.tasaIsrDeclaracion || 0.1725);
  const isrACargo = Math.max(0, isrTotalEstimado - retencionIsr);
  const ivaACargo = Math.max(0, ivaCobrado - retencionIva);
  const totalImpuestosSat = isrACargo + ivaACargo;

  const otrosIngresos = Number(honorarios.otrosIngresos) || 0;
  const ingresoDisponibleReal = netoEnCuenta + otrosIngresos - totalImpuestosSat;

  return {
    importeFacturado,
    ivaCobrado,
    subtotalCfdi,
    retencionIsr,
    retencionIva,
    netoEnCuenta,
    isrACargo,
    ivaACargo,
    totalImpuestosSat,
    otrosIngresos,
    ingresoDisponibleReal
  };
}

// 2. Resumen de Flujo de Efectivo
export function calculateCashFlow(data, exchangeRate) {
  const fiscal = calculateFiscalOverview(data.honorarios);

  const totalCostodeVida = data.gastosNecesarios.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const totalGastosOpcionales = data.gastosOpcionales.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  // Pagos mínimos actuales de deudas (convertidos a MXN)
  const totalPagosMinimosMXN = data.deudas.reduce((acc, d) => {
    const minMXN = convertCurrency(d.pagoMinimo, d.moneda, 'MXN', exchangeRate);
    return acc + (minMXN || 0);
  }, 0);

  // Flujo libre antes de aportaciones extraordinarias
  // = Neto recibido + Otros ingresos - SAT - Costos de vida - Opcionales - Mínimos de deuda
  const flujoLibreReal = (fiscal.netoEnCuenta + fiscal.otrosIngresos)
    - fiscal.totalImpuestosSat
    - totalCostodeVida
    - totalGastosOpcionales
    - totalPagosMinimosMXN;

  return {
    fiscal,
    totalCostodeVida,
    totalGastosOpcionales,
    totalPagosMinimosMXN,
    flujoLibreReal
  };
}

// 3. Tasa de Sangrado por Intereses (Bleed Rate)
export function calculateInterestBleed(deudas, exchangeRate) {
  let interesMensualTotal = 0;

  deudas.forEach(d => {
    const saldoMXN = convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate);
    const tasaMensual = ((Number(d.tasaAnual) || 0) / 100) / 12;
    interesMensualTotal += saldoMXN * tasaMensual;
  });

  const interesDiario = interesMensualTotal / 30;
  const interesAnual = interesMensualTotal * 12;

  return {
    interesDiario: Math.round(interesDiario),
    interesMensual: Math.round(interesMensualTotal),
    interesAnual: Math.round(interesAnual)
  };
}

// 4. Score de Salud Financiera (0 - 100) y Diagnóstico Inteligente
export function calculateFinancialHealthScore(data, exchangeRate) {
  const cashFlow = calculateCashFlow(data, exchangeRate);
  const bleed = calculateInterestBleed(data.deudas, exchangeRate);
  const totalDeudaMXN = data.deudas.reduce((sum, d) => sum + convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate), 0);
  const totalActivosMXN = data.activos.reduce((sum, a) => sum + convertCurrency(a.monto, a.moneda, 'MXN', exchangeRate), 0);
  const totalIngresoNeto = cashFlow.fiscal.netoEnCuenta + cashFlow.fiscal.otrosIngresos;

  // Factor 1: DTI (Debt-To-Income) Ratio (0 - 25 pts)
  const dtiRatio = totalIngresoNeto > 0 ? (cashFlow.totalPagosMinimosMXN / totalIngresoNeto) : 1;
  let dtiScore = 0;
  if (dtiRatio <= 0.15) dtiScore = 25;
  else if (dtiRatio <= 0.25) dtiScore = 20;
  else if (dtiRatio <= 0.35) dtiScore = 15;
  else if (dtiRatio <= 0.45) dtiScore = 8;
  else dtiScore = 2;

  // Factor 2: Cobertura de Emergencia (Runway) (0 - 25 pts)
  const gastoMensualTotal = cashFlow.totalCostodeVida;
  const ahorroLiquido = data.activos
    .filter(a => a.tipo === 'Efectivo' || a.tipo === 'Inversión')
    .reduce((sum, a) => sum + convertCurrency(a.monto, a.moneda, 'MXN', exchangeRate), 0);
  const mesesRunway = gastoMensualTotal > 0 ? (ahorroLiquido / gastoMensualTotal) : 0;
  let runwayScore = 0;
  if (mesesRunway >= 6) runwayScore = 25;
  else if (mesesRunway >= 3) runwayScore = 20;
  else if (mesesRunway >= 1.5) runwayScore = 14;
  else if (mesesRunway >= 0.5) runwayScore = 7;
  else runwayScore = 2;

  // Factor 3: Tasa Promedio de Deuda & Toxicidad (0 - 25 pts)
  const tieneDeudasToxicas = data.deudas.some(d => d.saldo > 0 && d.tasaAnual >= 35);
  let debtRateScore = 25;
  if (totalDeudaMXN > 0) {
    if (tieneDeudasToxicas) debtRateScore = 8;
    else debtRateScore = 18;
  }

  // Factor 4: Margen de Flujo Libre (0 - 25 pts)
  const margenFlujo = totalIngresoNeto > 0 ? (cashFlow.flujoLibreReal / totalIngresoNeto) : 0;
  let cashFlowScore = 0;
  if (margenFlujo >= 0.20) cashFlowScore = 25;
  else if (margenFlujo >= 0.10) cashFlowScore = 20;
  else if (margenFlujo >= 0.0) cashFlowScore = 12;
  else cashFlowScore = 0;

  const totalScore = Math.min(100, Math.max(0, dtiScore + runwayScore + debtRateScore + cashFlowScore));

  let status = 'Vulnerable';
  let color = 'rose';
  if (totalScore >= 80) { status = 'Excelente'; color = 'emerald'; }
  else if (totalScore >= 65) { status = 'Saludable'; color = 'teal'; }
  else if (totalScore >= 50) { status = 'En Riesgo Moderado'; color = 'amber'; }
  else { status = 'Crítico'; color = 'rose'; }

  // Diagnóstico y recomendaciones accionables
  const recomendaciones = [];
  if (tieneDeudasToxicas) {
    recomendaciones.push({
      tipo: 'URGENTE',
      titulo: 'Detener Sangrado por Tasa Alta',
      descripcion: `Estás quemando ${bleed.interesMensual.toLocaleString('es-MX')} MXN cada mes en puros intereses a los bancos. Prioriza la deuda de mayor tasa con la Estrategia Avalancha.`
    });
  }

  const tienePromosCercanas = data.deudas.some(d => d.tipo === 'PROMO_DEADLINE' && d.saldo > 0);
  if (tienePromosCercanas) {
    recomendaciones.push({
      tipo: 'IMPORTANTE',
      titulo: 'Proteger Promociones con Deadline',
      descripcion: 'Asegura tu cuota mensual requerida de promociones al 0% para evitar que el banco te cobre intereses retroactivos.'
    });
  }

  if (mesesRunway < 3) {
    recomendaciones.push({
      tipo: 'PREVENCION',
      titulo: 'Crear Fondo de Emergencia Mínimo',
      descripcion: `Tienes ${(mesesRunway).toFixed(1)} meses de cobertura de vida. Tu meta inicial debe ser alcanzar al menos 3 meses ($${Math.round(gastoMensualTotal * 3).toLocaleString('es-MX')} MXN).`
    });
  }

  return {
    score: totalScore,
    status,
    color,
    dtiRatio: (dtiRatio * 100).toFixed(1),
    mesesRunway: mesesRunway.toFixed(1),
    bleed,
    recomendaciones
  };
}

// 5. Análisis de Flujo por Quincena (Días 1-15 vs 16-30)
export function calculateFortnightlyFlow(data, exchangeRate) {
  const quincena1 = {
    titulo: 'Primera Quincena (Días 1 - 15)',
    gastos: [],
    deudas: [],
    totalGastos: 0,
    totalDeudas: 0,
    totalSalidas: 0
  };

  const quincena2 = {
    titulo: 'Segunda Quincena (Días 16 - Fin de Mes)',
    gastos: [],
    deudas: [],
    totalGastos: 0,
    totalDeudas: 0,
    totalSalidas: 0
  };

  // Clasificar gastos necesarios y opcionales según diaPago
  [...data.gastosNecesarios, ...data.gastosOpcionales].forEach(g => {
    const dia = g.diaPago || 15;
    const item = { ...g, tipoConcepto: 'GASTO' };
    if (dia <= 15) {
      quincena1.gastos.push(item);
      quincena1.totalGastos += g.monto;
    } else {
      quincena2.gastos.push(item);
      quincena2.totalGastos += g.monto;
    }
  });

  // Clasificar pagos de deudas según diaPagoLimite
  data.deudas.forEach(d => {
    const dia = d.diaPagoLimite || 15;
    const minMXN = convertCurrency(d.pagoMinimo, d.moneda, 'MXN', exchangeRate);
    const item = { ...d, montoMXN: minMXN, tipoConcepto: 'DEUDA' };
    if (dia <= 15) {
      quincena1.deudas.push(item);
      quincena1.totalDeudas += minMXN;
    } else {
      quincena2.deudas.push(item);
      quincena2.totalDeudas += minMXN;
    }
  });

  quincena1.totalSalidas = quincena1.totalGastos + quincena1.totalDeudas;
  quincena2.totalSalidas = quincena2.totalGastos + quincena2.totalDeudas;

  return { quincena1, quincena2 };
}

// 6. Análisis de Promociones con Deadline
export function analyzePromoDeadlines(deudas, exchangeRate) {
  const today = new Date();
  
  return deudas
    .filter(d => d.tipo === 'PROMO_DEADLINE' && d.promoDeadline)
    .map(d => {
      const deadlineDate = new Date(d.promoDeadline);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4));

      const saldoOriginal = Number(d.saldo) || 0;
      const saldoMXN = convertCurrency(saldoOriginal, d.moneda, 'MXN', exchangeRate);

      const cuotaSugeridaOriginal = saldoOriginal / monthsRemaining;
      const cuotaSugeridaMXN = saldoMXN / monthsRemaining;

      let urgencia = 'NORMAL';
      if (daysRemaining <= 30) urgencia = 'CRITICA';
      else if (daysRemaining <= 90) urgencia = 'ALTA';
      else if (daysRemaining <= 180) urgencia = 'MEDIA';

      return {
        ...d,
        daysRemaining,
        monthsRemaining,
        saldoOriginal,
        saldoMXN,
        cuotaSugeridaOriginal,
        cuotaSugeridaMXN,
        urgencia
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// 7. Simulación de Liquidación de Deudas
export function runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, strategyType = 'GAIRO_CUSTOM') {
  const today = new Date();
  
  let currentDebts = deudas.map(d => {
    const balanceMXN = convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate);
    const minPayMXN = convertCurrency(d.pagoMinimo, d.moneda, 'MXN', exchangeRate);
    
    let daysRemaining = 9999;
    let monthsRemaining = 999;
    if (d.tipo === 'PROMO_DEADLINE' && d.promoDeadline) {
      const diff = new Date(d.promoDeadline).getTime() - today.getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
      monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4));
    }

    return {
      id: d.id,
      nombre: d.nombre,
      monedaOriginal: d.moneda,
      tipo: d.tipo,
      tasaAnual: Number(d.tasaAnual) || 0,
      balance: balanceMXN,
      minPayment: minPayMXN,
      daysRemaining,
      monthsRemaining,
      initialBalance: balanceMXN
    };
  });

  const MAX_MONTHS = 120;
  let month = 0;
  let totalInterestPaid = 0;
  const history = [];

  const initialTotalDebt = currentDebts.reduce((sum, d) => sum + d.balance, 0);

  history.push({
    month: 0,
    totalBalance: initialTotalDebt,
    debts: currentDebts.map(d => ({ id: d.id, balance: d.balance }))
  });

  while (currentDebts.some(d => d.balance > 1) && month < MAX_MONTHS) {
    month++;
    let monthInterest = 0;

    currentDebts.forEach(d => {
      if (d.balance > 0) {
        const monthlyRate = (d.tasaAnual / 100) / 12;
        const interest = d.balance * monthlyRate;
        d.balance += interest;
        monthInterest += interest;
      }
    });
    totalInterestPaid += monthInterest;

    let availableCash = currentDebts.reduce((sum, d) => sum + (d.balance > 0 ? d.minPayment : 0), 0) + extraMonthlyCash;

    if (strategyType === 'GAIRO_CUSTOM') {
      const promos = currentDebts.filter(d => d.balance > 0 && d.tipo === 'PROMO_DEADLINE');
      promos.forEach(p => {
        const remainingMonths = Math.max(1, p.monthsRemaining - (month - 1));
        const requiredQuota = Math.min(p.balance, Math.max(p.minPayment, p.balance / remainingMonths));
        const pay = Math.min(availableCash, requiredQuota);
        p.balance -= pay;
        availableCash -= pay;
      });
    }

    currentDebts.forEach(d => {
      if (d.balance > 0) {
        if (strategyType === 'GAIRO_CUSTOM' && d.tipo === 'PROMO_DEADLINE') return;
        const pay = Math.min(d.balance, d.minPayment, availableCash);
        d.balance -= pay;
        availableCash -= pay;
      }
    });

    if (availableCash > 0 && currentDebts.some(d => d.balance > 0)) {
      let targetOrder = [];

      if (strategyType === 'GAIRO_CUSTOM') {
        targetOrder = [...currentDebts.filter(d => d.balance > 0)].sort((a, b) => {
          if (a.tipo === 'HIGH_INTEREST' && b.tipo !== 'HIGH_INTEREST') return -1;
          if (b.tipo === 'HIGH_INTEREST' && a.tipo !== 'HIGH_INTEREST') return 1;
          if (a.tipo === 'LOW_INTEREST_HOLD' && b.tipo !== 'LOW_INTEREST_HOLD') return 1;
          if (b.tipo === 'LOW_INTEREST_HOLD' && a.tipo !== 'LOW_INTEREST_HOLD') return -1;
          return b.tasaAnual - a.tasaAnual;
        });
      } else if (strategyType === 'AVALANCHE') {
        targetOrder = [...currentDebts.filter(d => d.balance > 0)].sort((a, b) => b.tasaAnual - a.tasaAnual);
      } else if (strategyType === 'SNOWBALL') {
        targetOrder = [...currentDebts.filter(d => d.balance > 0)].sort((a, b) => a.balance - b.balance);
      } else if (strategyType === 'MINIMUMS_ONLY') {
        targetOrder = [];
      }

      for (const target of targetOrder) {
        if (availableCash <= 0) break;
        const extraPay = Math.min(target.balance, availableCash);
        target.balance -= extraPay;
        availableCash -= extraPay;
      }
    }

    const currentTotalDebt = currentDebts.reduce((sum, d) => sum + Math.max(0, d.balance), 0);
    history.push({
      month,
      totalBalance: Math.round(currentTotalDebt),
      debts: currentDebts.map(d => ({ id: d.id, balance: Math.round(Math.max(0, d.balance)) }))
    });
  }

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

  return {
    strategyType,
    monthsToDebtFree: month,
    debtFreeDate,
    totalInterestPaid: Math.round(totalInterestPaid),
    initialTotalDebt: Math.round(initialTotalDebt),
    history
  };
}

// 8. Comparar las 4 estrategias
export function compareAllStrategies(deudas, extraMonthlyCash, exchangeRate) {
  const gairoCustom = runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, 'GAIRO_CUSTOM');
  const avalanche = runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, 'AVALANCHE');
  const snowball = runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, 'SNOWBALL');
  const minimums = runStrategySimulation(deudas, 0, exchangeRate, 'MINIMUMS_ONLY');

  return {
    gairoCustom,
    avalanche,
    snowball,
    minimums,
    savingsVsMinimums: {
      moneySaved: Math.max(0, minimums.totalInterestPaid - gairoCustom.totalInterestPaid),
      monthsSaved: Math.max(0, minimums.monthsToDebtFree - gairoCustom.monthsToDebtFree)
    }
  };
}
