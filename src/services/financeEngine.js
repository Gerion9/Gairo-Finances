// Motor de cálculo financiero integral, impuestos SAT, estrategias, score de salud y flujo por quincena

import { convertCurrency } from './exchangeRate.js';

// 1. Cálculo Fiscal y CFDI
export function calculateFiscalOverview(honorarios = {}) {
  const safeHon = honorarios || {};
  const importeFacturado = Number(safeHon.importeFacturado) || 0;
  const ivaCobrado = importeFacturado * (safeHon.tasaIva ?? 0.16);
  const subtotalCfdi = importeFacturado + ivaCobrado;

  const retencionIsr = importeFacturado * (safeHon.retencionIsrTasa ?? 0.10);
  const retencionIva = ivaCobrado * (safeHon.retencionIvaFraccion !== undefined ? safeHon.retencionIvaFraccion : 0.6667);

  // Cash real que entra a la cuenta bancaria
  const netoEnCuenta = subtotalCfdi - retencionIsr - retencionIva;

  // Declaración mensual al SAT (lo que tú declaras y tienes que pagar)
  const isrTotalEstimado = importeFacturado * (safeHon.tasaIsrDeclaracion ?? 0.1725);
  const isrACargo = Math.max(0, isrTotalEstimado - retencionIsr);
  const ivaACargo = Math.max(0, ivaCobrado - retencionIva);
  const totalImpuestosSat = isrACargo + ivaACargo;

  const otrosIngresos = Number(safeHon.otrosIngresos) || 0;
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
export function calculateCashFlow(data = {}, exchangeRate = 19.25) {
  const safeData = data || {};
  const fiscal = calculateFiscalOverview(safeData.honorarios);

  const gastosNec = Array.isArray(safeData.gastosNecesarios) ? safeData.gastosNecesarios : [];
  const gastosOpc = Array.isArray(safeData.gastosOpcionales) ? safeData.gastosOpcionales : [];
  const deudas = Array.isArray(safeData.deudas) ? safeData.deudas : [];

  const totalCostodeVida = gastosNec.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const totalGastosOpcionales = gastosOpc.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  // Pagos mínimos actuales de deudas (convertidos a MXN)
  const totalPagosMinimosMXN = deudas.reduce((acc, d) => {
    const minimum = Math.min(Math.max(0, Number(d.saldo) || 0), Math.max(0, Number(d.pagoMinimo) || 0));
    const minMXN = convertCurrency(minimum, d.moneda, 'MXN', exchangeRate);
    return acc + (minMXN || 0);
  }, 0);

  // Flujo libre antes de aportaciones extraordinarias
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
export function calculateInterestBleed(deudas = [], exchangeRate = 19.25) {
  let interesMensualTotal = 0;
  const safeDeudas = Array.isArray(deudas) ? deudas : [];

  safeDeudas.forEach(d => {
    const saldoMXN = convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate);
    const tasaMensual = ((Number(d.tasaAnual) || 0) / 100) / 12;
    interesMensualTotal += saldoMXN * tasaMensual;
  });

  const interesMensual = Math.round(interesMensualTotal);
  const interesDiario = Math.round(interesMensualTotal / 30);
  const interesAnual = interesMensual * 12;

  return {
    interesDiario,
    interesMensual,
    interesAnual
  };
}

// 4. Score de Salud Financiera (0 - 100) y Diagnóstico Inteligente
export function calculateFinancialHealthScore(data = {}, exchangeRate = 19.25) {
  const safeData = data || {};
  const deudas = Array.isArray(safeData.deudas) ? safeData.deudas : [];
  const activos = Array.isArray(safeData.activos) ? safeData.activos : [];

  const cashFlow = calculateCashFlow(safeData, exchangeRate);
  const bleed = calculateInterestBleed(deudas, exchangeRate);
  const totalDeudaMXN = deudas.reduce((sum, d) => sum + convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate), 0);
  const totalActivosMXN = activos.reduce((sum, a) => sum + convertCurrency(a.monto, a.moneda, 'MXN', exchangeRate), 0);
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
const STRATEGY_TYPES = ['GAIRO_CUSTOM', 'AVALANCHE', 'SNOWBALL', 'MINIMUMS_ONLY'];
const SIMULATION_LIMIT = 120;
const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;

function requireAmount(value, label, strictlyPositive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (strictlyPositive && value === 0)) {
    throw new RangeError(`${label} debe ser un número finito ${strictlyPositive ? 'mayor que cero' : 'no negativo'}.`);
  }
  return value;
}

function prepareStrategyDebts(deudas, extraMonthlyCash, exchangeRate, strategyType, today) {
  if (!Array.isArray(deudas)) throw new TypeError('Las deudas deben ser una lista.');
  requireAmount(extraMonthlyCash, 'La aportación extra');
  requireAmount(exchangeRate, 'El tipo de cambio', true);
  if (!STRATEGY_TYPES.includes(strategyType)) throw new RangeError('Estrategia desconocida.');

  return deudas.map((debt, index) => {
    if (!debt || typeof debt !== 'object') throw new TypeError(`Deuda ${index + 1} inválida.`);
    if (!['MXN', 'USD'].includes(debt.moneda)) throw new RangeError('La moneda debe ser MXN o USD.');
    requireAmount(debt.saldo, 'El saldo');
    requireAmount(debt.pagoMinimo, 'El pago mínimo');
    requireAmount(debt.tasaAnual, 'La tasa anual');
    if (debt.tasaRegularPostPromo !== undefined && debt.tasaRegularPostPromo !== null) {
      requireAmount(debt.tasaRegularPostPromo, 'La tasa posterior a la promoción');
    }
    let promoMonths = null;
    if (debt.tipo === 'PROMO_DEADLINE' && debt.promoDeadline) {
      // ISO date-only values are local dates, not UTC midnights.
      if (typeof debt.promoDeadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(debt.promoDeadline)) {
        throw new RangeError('La fecha de la promoción debe tener formato AAAA-MM-DD.');
      }
      const deadline = new Date(`${debt.promoDeadline}T00:00:00`);
      if (!Number.isFinite(deadline.getTime()) || deadline.getDate() !== Number(debt.promoDeadline.slice(8))) {
        throw new RangeError('La fecha de la promoción no es válida.');
      }
      promoMonths = Math.max(0, Math.ceil((deadline - today) / (86400000 * 30.4375)));
    }
    const balance = roundMoney(convertCurrency(debt.saldo, debt.moneda, 'MXN', exchangeRate));
    const minPayment = roundMoney(convertCurrency(debt.pagoMinimo, debt.moneda, 'MXN', exchangeRate));
    requireAmount(balance, 'El saldo convertido');
    requireAmount(minPayment, 'El mínimo convertido');
    return {
      id: debt.id,
      index,
      tipo: debt.tipo,
      balance,
      minPayment,
      tasaAnual: debt.tasaAnual,
      postPromoRate: debt.tasaRegularPostPromo ?? null,
      promoMonths
    };
  });
}

function allocateStrategyPayments(debts, extraMonthlyCash, strategyType, month = 1) {
  const payments = debts.map(debt => Math.min(debt.balance, debt.minPayment));
  let availableExtra = strategyType === 'MINIMUMS_ONLY' ? 0 : extraMonthlyCash;
  const promoTargets = debts.map(debt => debt.tipo === 'PROMO_DEADLINE' && debt.promoMonths !== null
    ? Math.min(debt.balance, Math.max(debt.minPayment, debt.balance / Math.max(1, debt.promoMonths - month + 1)))
    : 0);
  const addPayment = (index, requested) => {
    const payment = roundMoney(Math.min(Math.max(0, debts[index].balance - payments[index]), Math.max(0, requested), availableExtra));
    payments[index] = roundMoney(payments[index] + payment);
    availableExtra = roundMoney(Math.max(0, availableExtra - payment));
  };

  if (strategyType === 'GAIRO_CUSTOM') {
    debts.map((debt, index) => ({ debt, index }))
      .filter(({ debt }) => debt.tipo === 'PROMO_DEADLINE' && debt.promoMonths !== null && debt.balance > 0)
      .sort((a, b) => a.debt.promoMonths - b.debt.promoMonths)
      .forEach(({ index }) => addPayment(index, promoTargets[index] - payments[index]));
  }

  if (strategyType !== 'MINIMUMS_ONLY') {
    const priority = debt => debt.tipo === 'HIGH_INTEREST' ? 0 : debt.tipo === 'LOW_INTEREST_HOLD' ? 2 : 1;
    const effectiveRate = debt => debt.promoMonths !== null && month > debt.promoMonths && debt.postPromoRate !== null
      ? debt.postPromoRate : debt.tasaAnual;
    const order = debts.map((debt, index) => ({ debt, index })).sort((a, b) => {
      if (strategyType === 'SNOWBALL') return a.debt.balance - b.debt.balance;
      if (strategyType === 'GAIRO_CUSTOM' && priority(a.debt) !== priority(b.debt)) return priority(a.debt) - priority(b.debt);
      return effectiveRate(b.debt) - effectiveRate(a.debt);
    });
    order.forEach(({ index }) => addPayment(index, debts[index].balance - payments[index]));
  }
  return {
    payments,
    promoTargets,
    totalPaymentMXN: roundMoney(payments.reduce((sum, value) => sum + value, 0)),
    unallocatedExtraMXN: roundMoney(availableExtra),
    promoShortfallMXN: roundMoney(promoTargets.reduce((sum, target, index) => sum + Math.max(0, target - payments[index]), 0))
  };
}

// A current-balance payment hypothesis. Future monthly interest is accrued by the simulation only.
export function buildStrategyPaymentPlan(deudas, extraMonthlyCash, exchangeRate, strategyType = 'GAIRO_CUSTOM') {
  const debts = prepareStrategyDebts(deudas, extraMonthlyCash, exchangeRate, strategyType, new Date());
  const allocation = allocateStrategyPayments(debts, extraMonthlyCash, strategyType);
  return {
    ...allocation,
    items: debts.map((debt, index) => ({
      debt: deudas[index],
      paymentMXN: allocation.payments[index],
      suggestedPayment: Math.min(deudas[index].saldo, convertCurrency(allocation.payments[index], 'MXN', deudas[index].moneda, exchangeRate)),
      promoTargetMXN: roundMoney(allocation.promoTargets[index]),
      promoShortfallMXN: roundMoney(Math.max(0, allocation.promoTargets[index] - allocation.payments[index])),
      monthsRemaining: debt.promoMonths
    })).filter(item => item.debt.saldo > 0)
  };
}

export function runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, strategyType = 'GAIRO_CUSTOM') {
  const today = new Date();
  const debts = prepareStrategyDebts(deudas, extraMonthlyCash, exchangeRate, strategyType, today);
  const initialTotalDebt = roundMoney(debts.reduce((sum, debt) => sum + debt.balance, 0));
  requireAmount(initialTotalDebt, 'La deuda total');
  let month = 0;
  let totalInterestPaid = 0;
  let promoShortfallMonths = 0;
  const history = [{ month: 0, totalBalance: initialTotalDebt, totalInterest: 0, payment: 0, debts: debts.map(debt => ({ id: debt.id, balance: debt.balance })) }];

  while (debts.some(debt => debt.balance > 0) && month < SIMULATION_LIMIT) {
    month++;
    let monthInterest = 0;
    debts.forEach(debt => {
      const rate = debt.promoMonths !== null && month > debt.promoMonths && debt.postPromoRate !== null
        ? debt.postPromoRate : debt.tasaAnual;
      const interest = roundMoney(debt.balance * rate / 1200);
      debt.balance = roundMoney(debt.balance + interest);
      requireAmount(debt.balance, 'El saldo proyectado');
      monthInterest += interest;
    });
    totalInterestPaid = roundMoney(totalInterestPaid + monthInterest);
    const allocation = allocateStrategyPayments(debts, extraMonthlyCash, strategyType, month);
    if (allocation.promoShortfallMXN > 0) promoShortfallMonths++;
    debts.forEach((debt, index) => { debt.balance = roundMoney(Math.max(0, debt.balance - allocation.payments[index])); });
    history.push({
      month,
      totalBalance: roundMoney(debts.reduce((sum, debt) => sum + debt.balance, 0)),
      totalInterest: totalInterestPaid,
      payment: allocation.totalPaymentMXN,
      debts: debts.map(debt => ({ id: debt.id, balance: debt.balance }))
    });
  }

  const remainingBalance = history[history.length - 1].totalBalance;
  const paidOff = remainingBalance === 0;
  const warnings = [];
  if (debts.some(debt => debt.tipo === 'PROMO_DEADLINE' && debt.postPromoRate === null)) {
    warnings.push('Hay promociones sin tasa posterior registrada: se conserva su tasa actual después del vencimiento.');
  }
  if (debts.some(debt => debt.tipo === 'PROMO_DEADLINE' && debt.promoMonths === null)) {
    warnings.push('Hay promociones sin fecha registrada: no se puede calcular su cuota objetivo ni el cambio de tasa.');
  }
  if (promoShortfallMonths > 0) warnings.push('El presupuesto no cubre la cuota objetivo de todas las promociones en algunos meses.');
  return {
    strategyType,
    paidOff,
    remainingBalance,
    capped: !paidOff && month === SIMULATION_LIMIT,
    simulatedMonths: month,
    monthsToDebtFree: paidOff ? month : null,
    debtFreeDate: paidOff ? new Date(today.getFullYear(), today.getMonth() + month, 1) : null,
    totalInterestPaid,
    initialTotalDebt,
    promoShortfallMonths,
    warnings,
    history
  };
}

export function compareStrategyOutcomes(strategy, baseline) {
  const comparable = strategy.paidOff && baseline.paidOff;
  return {
    comparable,
    moneySaved: comparable ? roundMoney(baseline.totalInterestPaid - strategy.totalInterestPaid) : null,
    monthsSaved: comparable ? baseline.monthsToDebtFree - strategy.monthsToDebtFree : null,
    reason: comparable ? null : 'No se calcula ahorro total mientras alguna estrategia conserve saldo al finalizar los 120 meses.'
  };
}

// 8. Comparar las cuatro estrategias hasta liquidación o el límite declarado.
export function compareAllStrategies(deudas, extraMonthlyCash, exchangeRate) {
  const gairoCustom = runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, 'GAIRO_CUSTOM');
  const avalanche = runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, 'AVALANCHE');
  const snowball = runStrategySimulation(deudas, extraMonthlyCash, exchangeRate, 'SNOWBALL');
  const minimums = runStrategySimulation(deudas, 0, exchangeRate, 'MINIMUMS_ONLY');
  return { gairoCustom, avalanche, snowball, minimums, savingsVsMinimums: compareStrategyOutcomes(gairoCustom, minimums) };
}
