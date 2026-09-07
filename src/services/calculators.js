import { convertCurrency } from './exchangeRate.js';

// Suite Integral de Calculadoras Financieras Avanzadas (Gairo Finances)

// 1. Calculadora de CAT Real (Costo Anual Total Efectivo)
export function calculateCATReal(saldo, tasaNominalAnual, plazoMeses, anualidad = 0, comisionesMensuales = 0) {
  const saldoPrincipal = Math.max(0, Number(saldo) || 0);
  const tasaNom = Math.max(0, Number(tasaNominalAnual) || 0) / 100;
  const meses = Math.max(1, Number(plazoMeses) || 12);
  const rMensual = tasaNom / 12;

  if (saldoPrincipal === 0) {
    return {
      cuotaMensual: 0,
      totalPagado: 0,
      totalInteresesYCargos: 0,
      catReal: 0
    };
  }

  // Pago mensual amortizable base (PMT)
  let cuotaBase = 0;
  if (rMensual === 0) {
    cuotaBase = saldoPrincipal / meses;
  } else {
    const factor = 1 - Math.pow(1 + rMensual, -meses);
    cuotaBase = factor > 0 ? (saldoPrincipal * rMensual) / factor : (saldoPrincipal / meses);
  }

  const pagoMensualConCargos = cuotaBase + Math.max(0, Number(comisionesMensuales) || 0) + (Math.max(0, Number(anualidad) || 0) / 12);
  const totalPagado = pagoMensualConCargos * meses;
  const costoTotalExtra = Math.max(0, totalPagado - saldoPrincipal);
  const catEstimado = (meses > 0 && saldoPrincipal > 0)
    ? (Math.pow(1 + (costoTotalExtra / saldoPrincipal) / (meses / 12), 1) - 1) * 100
    : 0;

  return {
    cuotaMensual: Math.round(pagoMensualConCargos),
    totalPagado: Math.round(totalPagado),
    totalInteresesYCargos: Math.round(costoTotalExtra),
    catReal: Math.min(250, Math.max(tasaNominalAnual || 0, parseFloat(catEstimado.toFixed(1))))
  };
}

// 2. Calculadora: "Meses Sin Intereses (MSI) vs Descuento de Contado"
export function calculateMSIvsDiscount(precioLista, descuentoContadoPorcentaje, mesesMSI, tasaRendimientoCETES = 9.5) {
  const precio = Math.max(0, Number(precioLista) || 0);
  const descPct = Math.max(0, Number(descuentoContadoPorcentaje) || 0) / 100;
  const meses = Math.max(1, Number(mesesMSI) || 12);
  const tasaInvAnual = Math.max(0, Number(tasaRendimientoCETES) || 0) / 100;

  // Opción A: Contado con Descuento
  const precioContado = precio * (1 - descPct);
  const ahorroContado = precio * descPct;

  // Opción B: Pagar a MSI e invertir el dinero en CETES retirando la mensualidad
  const cuotaMSI = meses > 0 ? precio / meses : precio;
  let capitalInvertido = precioContado;
  let rendimientoGanado = 0;

  for (let m = 1; m <= meses; m++) {
    const interesMes = capitalInvertido * (tasaInvAnual / 12);
    rendimientoGanado += interesMes;
    capitalInvertido = Math.max(0, capitalInvertido + interesMes - cuotaMSI);
  }

  const beneficioContado = ahorroContado;
  const beneficioMSI = rendimientoGanado;
  const mejorOpcion = beneficioContado >= beneficioMSI ? 'CONTADO' : 'MSI';
  const diferencia = Math.abs(beneficioContado - beneficioMSI);

  return {
    precioContado: Math.round(precioContado),
    ahorroContado: Math.round(ahorroContado),
    rendimientoInversionMSI: Math.round(rendimientoGanado),
    mejorOpcion,
    diferencia: Math.round(diferencia),
    consejo: mejorOpcion === 'CONTADO' 
      ? `Conviene pagar de CONTADO. Te ahorras ${Math.round(diferencia).toLocaleString('es-MX')} MXN más que lo que ganarías en CETES.`
      : `Conviene pagar a ${meses} MSI e invertir el dinero. Generas ${Math.round(diferencia).toLocaleString('es-MX')} MXN extra de rendimiento.`
  };
}

// 3. Inyección Extraordinaria (Aguinaldo, Bono, Venta de Activo)
export function calculateWindfallAllocation(montoExtra, deudas = [], exchangeRate = 19.25) {
  const totalInyeccion = Math.max(0, Number(montoExtra) || 0);
  let disponible = totalInyeccion;
  const asignaciones = [];
  const safeDeudas = Array.isArray(deudas) ? deudas : [];

  // 1. Primero blindar promociones con deadline al 0%
  const promos = safeDeudas.filter(d => d.tipo === 'PROMO_DEADLINE' && (Number(d.saldo) || 0) > 0);
  promos.forEach(p => {
    if (disponible <= 0) return;
    const saldoMXN = convertCurrency(p.saldo, p.moneda, 'MXN', exchangeRate);
    const pago = Math.min(saldoMXN, disponible);
    asignaciones.push({
      deudaId: p.id,
      nombre: p.nombre,
      montoAsignado: Math.round(pago),
      razon: 'Protección de Promoción al 0% (Blindaje de Deadline)'
    });
    disponible -= pago;
  });

  // 2. Deudas de alto interés (Avalancha a la mayor tasa)
  const caras = safeDeudas
    .filter(d => d.tipo === 'HIGH_INTEREST' && (Number(d.saldo) || 0) > 0)
    .sort((a, b) => (Number(b.tasaAnual) || 0) - (Number(a.tasaAnual) || 0));

  caras.forEach(c => {
    if (disponible <= 0) return;
    const saldoMXN = convertCurrency(c.saldo, c.moneda, 'MXN', exchangeRate);
    const pago = Math.min(saldoMXN, disponible);
    asignaciones.push({
      deudaId: c.id,
      nombre: c.nombre,
      montoAsignado: Math.round(pago),
      razon: `Ataque Avalancha a tasa del ${c.tasaAnual}% APR`
    });
    disponible -= pago;
  });

  return {
    totalInyeccion,
    sobranteEfectivo: Math.round(Math.max(0, disponible)),
    asignaciones
  };
}

// 4. Detector de Gastos Hormiga & Pérdida por Interés Compuesto
export function calculateGastosHormiga(gastoDiario, diasAlMes = 24, rendimientoAnualCETES = 9.5) {
  const diario = Math.max(0, Number(gastoDiario) || 0);
  const dias = Math.max(0, Number(diasAlMes) || 0);
  const r = Math.max(0, Number(rendimientoAnualCETES) || 0) / 100 / 12;

  const mensual = diario * dias;
  const anual = mensual * 12;

  let vf5 = 0;
  let vf10 = 0;
  let vf20 = 0;

  if (r === 0) {
    vf5 = mensual * 5 * 12;
    vf10 = mensual * 10 * 12;
    vf20 = mensual * 20 * 12;
  } else {
    vf5 = mensual * ((Math.pow(1 + r, 5 * 12) - 1) / r);
    vf10 = mensual * ((Math.pow(1 + r, 10 * 12) - 1) / r);
    vf20 = mensual * ((Math.pow(1 + r, 20 * 12) - 1) / r);
  }

  return {
    gastoDiario: diario,
    gastoMensual: Math.round(mensual),
    gastoAnual: Math.round(anual),
    costoOportunidad5Anos: Math.round(vf5),
    costoOportunidad10Anos: Math.round(vf10),
    costoOportunidad20Anos: Math.round(vf20)
  };
}

// 5. Regla de Presupuesto 50/30/20
export function calculate503020Rule(ingresoNeto, costosVidaNecesarios, gastosOpcionales, aporteDeudaOAhorro) {
  const neto = Math.max(0, Number(ingresoNeto) || 0);
  const necesidades = Math.max(0, Number(costosVidaNecesarios) || 0);
  const deseos = Math.max(0, Number(gastosOpcionales) || 0);
  const ahorroDeuda = Math.max(0, Number(aporteDeudaOAhorro) || 0);

  const pctNecesidades = neto > 0 ? (necesidades / neto) * 100 : 0;
  const pctDeseos = neto > 0 ? (deseos / neto) * 100 : 0;
  const pctAhorroDeuda = neto > 0 ? (ahorroDeuda / neto) * 100 : 0;

  const metaNecesidades = neto * 0.50;
  const metaDeseos = neto * 0.30;
  const metaAhorroDeuda = neto * 0.20;

  return {
    neto,
    actual: {
      necesidades: Math.round(necesidades),
      pctNecesidades: parseFloat(pctNecesidades.toFixed(1)),
      deseos: Math.round(deseos),
      pctDeseos: parseFloat(pctDeseos.toFixed(1)),
      ahorroDeuda: Math.round(ahorroDeuda),
      pctAhorroDeuda: parseFloat(pctAhorroDeuda.toFixed(1))
    },
    meta: {
      necesidades: Math.round(metaNecesidades),
      deseos: Math.round(metaDeseos),
      ahorroDeuda: Math.round(metaAhorroDeuda)
    },
    cumple: pctNecesidades <= 55 && pctAhorroDeuda >= 15
  };
}

// 6. Calculadora de Refinanciamiento / Consolidación de Deuda
export function calculateRefinancingBenefit(saldoTotal, tasaActualPromedio, nuevaTasaConsolidada, plazoMeses = 24) {
  const saldo = Math.max(0, Number(saldoTotal) || 0);
  const tasaVieja = Math.max(0, Number(tasaActualPromedio) || 0) / 100 / 12;
  const tasaNueva = Math.max(0, Number(nuevaTasaConsolidada) || 0) / 100 / 12;
  const n = Math.max(1, Number(plazoMeses) || 24);

  // Cuota actual estimada
  let cuotaVieja = 0;
  if (tasaVieja === 0) {
    cuotaVieja = saldo / n;
  } else {
    const denom = 1 - Math.pow(1 + tasaVieja, -n);
    cuotaVieja = denom > 0 ? (saldo * tasaVieja) / denom : (saldo / n);
  }
  const totalViejo = cuotaVieja * n;

  // Cuota nueva consolidada
  let cuotaNueva = 0;
  if (tasaNueva === 0) {
    cuotaNueva = saldo / n;
  } else {
    const denom = 1 - Math.pow(1 + tasaNueva, -n);
    cuotaNueva = denom > 0 ? (saldo * tasaNueva) / denom : (saldo / n);
  }
  const totalNuevo = cuotaNueva * n;

  const ahorroIntereses = Math.max(0, totalViejo - totalNuevo);
  const reduccionCuota = Math.max(0, cuotaVieja - cuotaNueva);
  const pctAhorro = totalViejo > 0 ? ((ahorroIntereses / totalViejo) * 100) : 0;

  return {
    cuotaVieja: Math.round(cuotaVieja),
    cuotaNueva: Math.round(cuotaNueva),
    reduccionCuotaMensual: Math.round(reduccionCuota),
    ahorroTotalIntereses: Math.round(ahorroIntereses),
    porcentajeAhorro: parseFloat(pctAhorro.toFixed(1))
  };
}

// 7. Calculadora de Retiro FIRE & Libertad Financiera
export function calculateFIRERetirement(gastosAnuales, patrimonioActual, ahorroMensual, rendimientoAnual = 9.0) {
  const gastos = Math.max(0, Number(gastosAnuales) || 0);
  const patrimonio = Math.max(0, Number(patrimonioActual) || 0);
  const ahorro = Math.max(0, Number(ahorroMensual) || 0);
  const rAnual = Math.max(0, Number(rendimientoAnual) || 0) / 100;
  const rMensual = rAnual / 12;

  // Regla del 4% (Número FIRE = Gastos Anuales * 25)
  const numeroFIRE = gastos * 25;

  if (patrimonio >= numeroFIRE && numeroFIRE > 0) {
    return {
      numeroFIRE: Math.round(numeroFIRE),
      patrimonioActual: Math.round(patrimonio),
      anosParaRetiro: 0,
      ahorroMensual: Math.round(ahorro)
    };
  }

  if (ahorro === 0 && rMensual === 0) {
    return {
      numeroFIRE: Math.round(numeroFIRE),
      patrimonioActual: Math.round(patrimonio),
      anosParaRetiro: 99.0,
      ahorroMensual: 0
    };
  }

  let balance = patrimonio;
  let meses = 0;
  while (balance < numeroFIRE && meses < 600) { // 50 años máx
    meses++;
    balance = balance * (1 + rMensual) + ahorro;
  }

  const anosParaRetiro = parseFloat((meses / 12).toFixed(1));

  return {
    numeroFIRE: Math.round(numeroFIRE),
    patrimonioActual: Math.round(patrimonio),
    anosParaRetiro,
    ahorroMensual: Math.round(ahorro)
  };
}

// 8. Costo Real por Hora de Trabajo
export function calculateWorkHoursCost(ingresoNetoMensual, horasTrabajadasMes = 160, precioGasto = 2500) {
  const neto = Math.max(0, Number(ingresoNetoMensual) || 0);
  const horas = Math.max(1, Number(horasTrabajadasMes) || 160);
  const gasto = Math.max(0, Number(precioGasto) || 0);

  const ingresoPorHora = neto / horas;
  const horasNecesarias = ingresoPorHora > 0 ? (gasto / ingresoPorHora) : 0;

  return {
    ingresoPorHora: Math.round(ingresoPorHora),
    horasNecesarias: parseFloat(horasNecesarias.toFixed(1)),
    diasLaborales: parseFloat((horasNecesarias / 8).toFixed(1))
  };
}

// 9. Capacidad Máxima de Endeudamiento Bancario Sano
export function calculateBorrowingCapacity(ingresoNetoMensual, pagosDeudaActuales, rentaMensual = 8500) {
  const neto = Math.max(0, Number(ingresoNetoMensual) || 0);
  const deudaActual = Math.max(0, Number(pagosDeudaActuales) || 0);
  const renta = Math.max(0, Number(rentaMensual) || 0);

  // Criterio CONDUSEF: El total de deudas + vivienda no debe exceder el 40% del ingreso neto
  const limiteMaximoTotal = neto * 0.40;
  const margenRestante = Math.max(0, limiteMaximoTotal - deudaActual - (renta * 0.5));
  const dtiActual = neto > 0 ? ((deudaActual / neto) * 100) : 0;

  return {
    limiteMaximoTotal: Math.round(limiteMaximoTotal),
    margenRestanteMensual: Math.round(margenRestante),
    dtiActual: parseFloat(dtiActual.toFixed(1))
  };
}

// 10. Renta vs Compra de Vivienda (10 y 20 años)
export function calculateRentVsBuy(rentaMensual = 8500, precioInmueble = 2200000, enganchePorcentaje = 20, tasaHipoteca = 10.5, plusvaliaAnual = 5.0, rendimientoCETES = 9.5) {
  const renta = Math.max(0, Number(rentaMensual) || 0);
  const precio = Math.max(0, Number(precioInmueble) || 0);
  const enganche = precio * (Math.max(0, Number(enganchePorcentaje) || 0) / 100);
  const credito = Math.max(0, precio - enganche);
  const rHip = Math.max(0, Number(tasaHipoteca) || 0) / 100 / 12;

  // Mensualidad hipoteca 20 años (240 meses)
  let mensualidadHipoteca = 0;
  if (credito > 0) {
    if (rHip === 0) {
      mensualidadHipoteca = credito / 240;
    } else {
      const denom = 1 - Math.pow(1 + rHip, -240);
      mensualidadHipoteca = denom > 0 ? (credito * rHip) / denom : (credito / 240);
    }
  }

  return {
    rentaMensual: Math.round(renta),
    mensualidadHipoteca: Math.round(mensualidadHipoteca),
    engancheRequerido: Math.round(enganche),
    diferenciaMensual: Math.round(mensualidadHipoteca - renta),
    consejo: mensualidadHipoteca > (renta * 1.5) 
      ? 'Financieramente conviene RENTAR e invertir el enganche y la diferencia mensual en instrumentos con liquidez.'
      : 'La mensualidad hipotecaria está cercana a tu costo de renta; la compra podría ser viable si cuentas con el enganche completo.'
  };
}

// 11. Rendimiento Real (Tasa Nominal vs Inflación e Impuesto)
export function calculateRealYield(tasaNominal = 9.5, inflacion = 4.5, retencionISR = 0.50) {
  const nom = Number(tasaNominal) || 0;
  const inf = Number(inflacion) || 0;
  const isr = Math.max(0, Number(retencionISR) || 0);

  const tasaNeta = nom - isr;
  const infFactor = 1 + (inf / 100);
  const rendimientoReal = infFactor !== 0 ? (((1 + tasaNeta / 100) / infFactor) - 1) * 100 : 0;

  return {
    tasaNominal: nom,
    tasaNeta: parseFloat(tasaNeta.toFixed(2)),
    inflacion: inf,
    rendimientoRealNeto: parseFloat(rendimientoReal.toFixed(2)),
    leGanaALaInflacion: rendimientoReal > 0
  };
}

// 12. Estimador de Deducciones Personales en Declaración Anual
export function calculatePersonalTaxDeductions(ingresoAnualBruto, gastosMedicosDentales = 15000, aportacionesPPR = 25000, colegiaturas = 0) {
  const bruto = Math.max(0, Number(ingresoAnualBruto) || 0);
  const medicos = Math.max(0, Number(gastosMedicosDentales) || 0);
  const ppr = Math.max(0, Number(aportacionesPPR) || 0);
  const col = Math.max(0, Number(colegiaturas) || 0);

  const totalDeducciones = medicos + ppr + col;
  // Tope legal LISR: Máximo 15% del ingreso anual bruto o 5 UMAs anuales (~198,000 MXN)
  const topeLegal = Math.min(bruto * 0.15, 198031);
  const deduccionesAplicables = Math.min(totalDeducciones, topeLegal > 0 ? topeLegal : totalDeducciones);
  const devolucionEstimada = deduccionesAplicables * 0.25;

  return {
    totalDeducciones: Math.round(totalDeducciones),
    deduccionesAplicables: Math.round(deduccionesAplicables),
    devolucionEstimadaSAT: Math.round(devolucionEstimada)
  };
}

// 13. Comparativa Fiscal: RESICO vs PFAE
export function calculateResicoVsPfae(facturacionAnualSinIVA = 651549, gastosDeduciblesAnuales = 250000) {
  const facturacion = Math.max(0, Number(facturacionAnualSinIVA) || 0);
  const gastos = Math.max(0, Number(gastosDeduciblesAnuales) || 0);

  // RESICO (Tasa fija sobre ingresos brutos entre 1% y 2.5%)
  let tasaResico = 0.015;
  if (facturacion <= 300000) tasaResico = 0.010;
  else if (facturacion <= 1000000) tasaResico = 0.015;
  else if (facturacion <= 2500000) tasaResico = 0.020;
  else tasaResico = 0.025;
  const isrResico = facturacion * tasaResico;

  // PFAE (Tasa progresiva sobre utilidad: Facturación - Gastos deducibles)
  const utilidad = Math.max(0, facturacion - gastos);
  const isrPfae = utilidad * 0.22; // Estimado tabla Art. 96/152

  const ahorroResico = Math.max(0, isrPfae - isrResico);

  return {
    facturacionAnual: Math.round(facturacion),
    isrResico: Math.round(isrResico),
    isrPfae: Math.round(isrPfae),
    ahorroEstimadoConResico: Math.round(ahorroResico),
    regimenMasConveniente: isrResico < isrPfae ? 'RESICO' : 'PFAE'
  };
}


// 14. Simulación Estocástica Monte Carlo (1,000 iteraciones)
export function calculateMonteCarloSimulation(saldoTotal = 100000, pagoMensual = 5000, tasaMediaAnual = 35, mesesProyectados = 36) {
  const saldo = Math.max(0, Number(saldoTotal) || 0);
  const pago = Math.max(100, Number(pagoMensual) || 1000);
  const tasaMedia = Math.max(0, Number(tasaMediaAnual) || 0) / 100;
  const meses = Math.max(12, Number(mesesProyectados) || 36);

  if (saldo === 0) {
    return {
      percentil10: 0,
      percentil50: 0,
      percentil90: 0,
      mesesHastaLibertadEstimados: 0,
      probabilidadExito: 100
    };
  }

  const iteraciones = 1000;
  const resultadosMeses = [];

  for (let i = 0; i < iteraciones; i++) {
    let s = saldo;
    let m = 0;
    while (s > 0 && m < 120) {
      m++;
      // Variabilidad estocástica normal (desviación estándar del 15% en tasas y gastos imprevistos)
      const shock = (Math.random() - 0.5) * 0.15;
      const rMes = Math.max(0, (tasaMedia + shock) / 12);
      const interes = s * rMes;
      s = Math.max(0, s + interes - pago);
    }
    resultadosMeses.push(m);
  }

  resultadosMeses.sort((a, b) => a - b);
  const p10 = resultadosMeses[Math.floor(iteraciones * 0.10)];
  const p50 = resultadosMeses[Math.floor(iteraciones * 0.50)];
  const p90 = resultadosMeses[Math.floor(iteraciones * 0.90)];

  return {
    percentil10MejorCaso: p10,
    percentil50Esperado: p50,
    percentil90Pesimista: p90,
    mesesHastaLibertadEstimados: p50,
    probabilidadExito: Math.min(100, Math.round((resultadosMeses.filter(m => m <= meses).length / iteraciones) * 100))
  };
}

// 15. Optimizador de Consolidación de Deudas
export function calculateDebtConsolidationOptimizer(deudas = [], tasaPrestamoPersonal = 22, plazoMeses = 24) {
  const deudasCaras = deudas.filter(d => (Number(d.tasaInteresAnual) || 0) > tasaPrestamoPersonal && (Number(d.saldo) || 0) > 0);
  const saldoTotalConsolidar = deudasCaras.reduce((sum, d) => sum + (Number(d.saldo) || 0), 0);

  if (saldoTotalConsolidar === 0) {
    return {
      aplicaConsolidacion: false,
      montoConsolidar: 0,
      cuotaNueva: 0,
      ahorroTotalIntereses: 0,
      mensaje: 'No tienes deudas con tasa superior al ' + tasaPrestamoPersonal + '% para consolidar.'
    };
  }

  const r = (tasaPrestamoPersonal / 100) / 12;
  const factor = 1 - Math.pow(1 + r, -plazoMeses);
  const cuotaNueva = factor > 0 ? (saldoTotalConsolidar * r) / factor : (saldoTotalConsolidar / plazoMeses);
  const totalPagadoPrestamo = cuotaNueva * plazoMeses;

  // Costo en tarjetas actuales pagando el mínimo (estimado al doble del tiempo)
  const catPromedioActual = deudasCaras.reduce((acc, d) => acc + ((Number(d.tasaInteresAnual) || 0) * (Number(d.saldo) || 0)), 0) / saldoTotalConsolidar;
  const costoActualEstimado = saldoTotalConsolidar * (1 + (catPromedioActual / 100) * 1.5);
  const ahorro = Math.max(0, costoActualEstimado - totalPagadoPrestamo);

  return {
    aplicaConsolidacion: true,
    montoConsolidar: Math.round(saldoTotalConsolidar),
    cuotaNuevaMensual: Math.round(cuotaNueva),
    plazoMeses,
    tasaPrestamoPersonal,
    ahorroTotalIntereses: Math.round(ahorro),
    deudasInvolucradas: deudasCaras.map(d => d.nombre)
  };
}

// 16. Simulador de Estrés Cambiario (Currency Shock)
export function calculateCurrencyShock(deudas = [], tipoCambioActual = 19.25, tasasEstrés = [22, 24, 26]) {
  const deudasUSD = deudas.filter(d => d.moneda === 'USD' && (Number(d.saldo) || 0) > 0);
  const saldoTotalUSD = deudasUSD.reduce((sum, d) => sum + (Number(d.saldo) || 0), 0);
  const pagosMinimosUSD = deudasUSD.reduce((sum, d) => sum + (Number(d.pagoMinimoMensual) || 0), 0);

  const escenarios = tasasEstrés.map(tc => {
    const saldoEnMXN = saldoTotalUSD * tc;
    const pagoMinimoMXN = pagosMinimosUSD * tc;
    const incrementoSaldo = (saldoTotalUSD * tc) - (saldoTotalUSD * tipoCambioActual);

    return {
      tipoCambio: tc,
      saldoMXN: Math.round(saldoEnMXN),
      pagoMinimoMXN: Math.round(pagoMinimoMXN),
      impactoExtraMXN: Math.round(incrementoSaldo)
    };
  });

  return {
    tieneDeudasUSD: saldoTotalUSD > 0,
    saldoTotalUSD: Math.round(saldoTotalUSD),
    saldoBaseMXN: Math.round(saldoTotalUSD * tipoCambioActual),
    escenarios
  };
}

// 17. Calculadora de Comisiones por Pago Tardío y Moratorios Evitados
export function calculateLatePaymentCost(deudas = [], comisionPromedio = 550) {
  const numTarjetas = Math.max(1, deudas.filter(d => (Number(d.saldo) || 0) > 0).length);
  // Si se incurre en 1 olvido cada 2 meses por tarjeta
  const costoAnualComisiones = numTarjetas * 6 * comisionPromedio * 1.16; // Con IVA
  const interesMoratorioEstimado = deudas.reduce((sum, d) => sum + ((Number(d.saldo) || 0) * 0.05), 0); // 5% penalización

  return {
    costoAnualRiesgoOlvido: Math.round(costoAnualComisiones + interesMoratorioEstimado),
    ahorroBlindandoFechasLimite: Math.round(costoAnualComisiones + interesMoratorioEstimado)
  };
}

// 18. Calculadora de Costo de Oportunidad (Pagar Deuda vs Invertir en CETES)
export function calculateOpportunityCost(catDeuda = 45, rendimientoCetes = 11, montoDisponible = 10000) {
  const cat = Math.max(0, Number(catDeuda) || 0);
  const inv = Math.max(0, Number(rendimientoCetes) || 0);
  const monto = Math.max(0, Number(montoDisponible) || 0);

  const ahorroPorPagarDeuda = monto * (cat / 100);
  const gananciaPorInvertir = monto * (inv / 100);
  const diferenciaNeta = Math.abs(ahorroPorPagarDeuda - gananciaPorInvertir);

  return {
    ahorroPorPagarDeuda: Math.round(ahorroPorPagarDeuda),
    gananciaPorInvertir: Math.round(gananciaPorInvertir),
    diferenciaNeta: Math.round(diferenciaNeta),
    recomendacion: cat > inv ? 'PAGAR_DEUDA' : 'INVERTIR_CETES',
    mensaje: cat > inv 
      ? `Conviene amortizar tu deuda: Ahorras $${Math.round(diferenciaNeta)} MXN más de lo que ganarías invirtiendo.`
      : `Conviene invertir: La inversión genera $${Math.round(diferenciaNeta)} MXN más de lo que cuesta el crédito.`
  };
}

// 19. Detector de "Meses Mágicos" (Meses con 3 Quincenas)
export function detectMagicMonths(year = new Date().getFullYear()) {
  const magicMonths = [];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Para trabajadores que cobran en días 15 y último, o cada 14 días (26 quincenas al año)
  // Siempre hay 2 meses con 3 pagos en esquemas catorcenales/quincenales
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    if (daysInMonth === 31 && (m === 4 || m === 9)) {
      magicMonths.push({
        mesIndex: m,
        mesNombre: monthNames[m],
        descripcion: 'Mes con 3 quincenas: ¡Destina el 100% de la tercera quincena a liquidación express!'
      });
    }
  }

  return magicMonths.length > 0 ? magicMonths : [
    { mesIndex: 4, mesNombre: 'Mayo', descripcion: 'Mes de alta liquidez: Inyecta el excedente a tu tarjeta más tóxica.' },
    { mesIndex: 9, mesNombre: 'Octubre', descripcion: 'Mes de 3 pagos: Liquidación express recomendada.' }
  ];
}

// 20. El "Truco de los 50 Días de Crédito Gratuito" con Tarjeta de Crédito
export function calculate50DaysCreditAdvantage(diaCorte = 10, diaPagoLimite = 30, diaCompra = new Date().getDate()) {
  let diasDeCreditoGratis = 0;
  if (diaCompra > diaCorte) {
    const diasRestantesMes = 30 - diaCompra;
    diasDeCreditoGratis = diasRestantesMes + diaCorte + (diaPagoLimite - diaCorte);
  } else {
    diasDeCreditoGratis = diaPagoLimite - diaCompra;
  }

  diasDeCreditoGratis = Math.min(52, Math.max(15, diasDeCreditoGratis));

  return {
    diasDeCreditoGratis,
    esMomentoOptimo: diaCompra === diaCorte + 1 || diaCompra === diaCorte + 2,
    consejo: diasDeCreditoGratis >= 45 
      ? '¡Excelente momento para comprar! Tienes hasta ' + diasDeCreditoGratis + ' días de financiamiento al 0% de interés.'
      : 'Atención: Tu corte está próximo. Tendrás solo ' + diasDeCreditoGratis + ' días para liquidar esta compra.'
  };
}

// 21. Simulador de Aceleración por Venta de Activos Ociosos
export function calculateAssetSaleInjection(deudas = [], valorVentaEstimado = 5000) {
  const deudasConInteres = deudas.filter(d => (Number(d.saldo) || 0) > 0 && (Number(d.tasaInteresAnual) || 0) > 0);
  const deudaMasToxica = deudasConInteres.sort((a, b) => (Number(b.tasaInteresAnual) || 0) - (Number(a.tasaInteresAnual) || 0))[0];

  if (!deudaMasToxica) {
    return {
      ahorroTotal: 0,
      semanasAhorradas: 0,
      mensaje: '¡No tienes deudas con intereses para aplicar la inyección!'
    };
  }

  const saldo = Number(deudaMasToxica.saldo);
  const tasa = (Number(deudaMasToxica.tasaInteresAnual) || 40) / 100;
  const inyeccion = Math.min(saldo, Number(valorVentaEstimado) || 0);

  // Ahorro en intereses compuesto a 1 año
  const ahorroInteres = inyeccion * tasa;
  const semanasAhorradas = Math.round((inyeccion / (Number(deudaMasToxica.pagoMinimoMensual) || 1500)) * 4.3);

  return {
    deudaBeneficiada: deudaMasToxica.nombre,
    montoInyectado: Math.round(inyeccion),
    ahorroInteresesEstimado: Math.round(ahorroInteres),
    semanasDeVidaGanadas: semanasAhorradas
  };
}

// 22. Calculadora de Prestaciones Laborales (Aguinaldo y Vacaciones Dignas LFT)
export function calculateLaborPrestaciones(sueldoMensualBruto = 25000, anosAntiguedad = 2) {
  const sueldo = Math.max(0, Number(sueldoMensualBruto) || 0);
  const antiguedad = Math.max(1, Number(anosAntiguedad) || 1);
  const salarioDiario = sueldo / 30;

  // Aguinaldo mínimo legal: 15 días
  const aguinaldo = salarioDiario * 15;

  // Vacaciones Dignas reforma LFT: 12 días año 1, 14 año 2, 16 año 3, 18 año 4, 20 año 5...
  const diasVacaciones = Math.min(32, 12 + ((antiguedad - 1) * 2));
  const primaVacacional = diasVacaciones * salarioDiario * 0.25;

  return {
    salarioDiario: Math.round(salarioDiario),
    aguinaldoLegalMinimo: Math.round(aguinaldo),
    diasVacaciones,
    primaVacacionalMinima: Math.round(primaVacacional),
    totalPrestacionesAnuales: Math.round(aguinaldo + primaVacacional)
  };
}

// 23. Calculadora de Liquidación y Finiquito (Art. 48/50 LFT)
export function calculateLaborLiquidation(sueldoMensualBruto = 30000, anosAntiguedad = 3, despidoInjustificado = true) {
  const sueldo = Math.max(0, Number(sueldoMensualBruto) || 0);
  const anos = Math.max(0.5, Number(anosAntiguedad) || 1);
  const salarioDiario = sueldo / 30;

  // 3 meses constitucionales
  const tresMeses = despidoInjustificado ? sueldo * 3 : 0;
  // 20 días por año de servicio
  const veinteDiasPorAno = despidoInjustificado ? (20 * salarioDiario * anos) : 0;
  // Prima de antigüedad: 12 días por año (tope 2 salarios mínimos ~$500/día)
  const salarioDiarioTopado = Math.min(salarioDiario, 500);
  const primaAntiguedad = 12 * salarioDiarioTopado * anos;

  // Finiquito proporcional (Aguinaldo + Vacaciones proporcionales)
  const finiquitoProporcional = (salarioDiario * 15 * 0.5) + (salarioDiario * 14 * 0.25 * 0.5);
  const totalCompensacion = tresMeses + veinteDiasPorAno + primaAntiguedad + finiquitoProporcional;

  return {
    tresMesesSalario: Math.round(tresMeses),
    veinteDiasPorAno: Math.round(veinteDiasPorAno),
    primaAntiguedad: Math.round(primaAntiguedad),
    finiquitoProporcional: Math.round(finiquitoProporcional),
    totalLiquidacionEstimada: Math.round(totalCompensacion)
  };
}

// 24. Optimizador de Aportaciones al AFORE / PPR para Maximizar Devolución SAT
export function calculatePPRTaxMaximizer(ingresoAnualBruto = 650000, aportacionPlaneada = 40000) {
  const ingreso = Math.max(0, Number(ingresoAnualBruto) || 0);
  const aportacion = Math.max(0, Number(aportacionPlaneada) || 0);

  // Tope deducible: 10% del ingreso o 5 UMAs anuales (~$198,000)
  const topeDeducible = Math.min(ingreso * 0.10, 198031);
  const aportacionEfectivaDeducible = Math.min(aportacion, topeDeducible);

  // Tasa marginal estimada (30% para ingresos medios-altos)
  const tasaMarginal = ingreso > 500000 ? 0.30 : 0.20;
  const devolucionExtraEnAbril = aportacionEfectivaDeducible * tasaMarginal;

  return {
    topeMaximoDeducible: Math.round(topeDeducible),
    aportacionConsiderada: Math.round(aportacionEfectivaDeducible),
    devolucionEstimadaSAT: Math.round(devolucionExtraEnAbril),
    rendimientoFiscalInmediato: Math.round(tasaMarginal * 100)
  };
}
