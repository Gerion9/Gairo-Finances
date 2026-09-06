// Suite Integral de Calculadoras Financieras Avanzadas (Gairo Finances)

// 1. Calculadora de CAT Real (Costo Anual Total Efectivo)
export function calculateCATReal(saldo, tasaNominalAnual, plazoMeses, anualidad = 0, comisionesMensuales = 0) {
  const saldoPrincipal = Number(saldo) || 10000;
  const tasaNom = (Number(tasaNominalAnual) || 40) / 100;
  const meses = Number(plazoMeses) || 12;
  const rMensual = tasaNom / 12;

  // Pago mensual amortizable base (PMT)
  const cuotaBase = (saldoPrincipal * rMensual) / (1 - Math.pow(1 + rMensual, -meses));
  const pagoMensualConCargos = cuotaBase + (Number(comisionesMensuales) || 0) + (Number(anualidad) / 12);

  const totalPagado = (pagoMensualConCargos * meses);
  const costoTotalExtra = totalPagado - saldoPrincipal;
  const catEstimado = (Math.pow(1 + (costoTotalExtra / saldoPrincipal) / (meses / 12), 1) - 1) * 100;

  return {
    cuotaMensual: Math.round(pagoMensualConCargos),
    totalPagado: Math.round(totalPagado),
    totalInteresesYCargos: Math.round(costoTotalExtra),
    catReal: Math.min(180, Math.max(tasaNominalAnual, parseFloat(catEstimado.toFixed(1))))
  };
}

// 2. Calculadora: "Meses Sin Intereses (MSI) vs Descuento de Contado"
export function calculateMSIvsDiscount(precioLista, descuentoContadoPorcentaje, mesesMSI, tasaRendimientoCETES = 9.5) {
  const precio = Number(precioLista) || 20000;
  const descPct = (Number(descuentoContadoPorcentaje) || 10) / 100;
  const meses = Number(mesesMSI) || 12;
  const tasaInvAnual = (Number(tasaRendimientoCETES) || 9.5) / 100;

  // Opción A: Contado con Descuento
  const precioContado = precio * (1 - descPct);
  const ahorroContado = precio * descPct;

  // Opción B: Pagar a MSI e invertir el dinero en CETES retirando la mensualidad
  const cuotaMSI = precio / meses;
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
export function calculateWindfallAllocation(montoExtra, deudas, exchangeRate) {
  const totalInyeccion = Number(montoExtra) || 20000;
  let disponible = totalInyeccion;
  const asignaciones = [];

  // 1. Primero blindar promociones con deadline al 0%
  const promos = deudas.filter(d => d.tipo === 'PROMO_DEADLINE' && d.saldo > 0);
  promos.forEach(p => {
    if (disponible <= 0) return;
    const saldoMXN = p.moneda === 'USD' ? p.saldo * exchangeRate : p.saldo;
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
  const caras = deudas
    .filter(d => d.tipo === 'HIGH_INTEREST' && d.saldo > 0)
    .sort((a, b) => b.tasaAnual - a.tasaAnual);

  caras.forEach(c => {
    if (disponible <= 0) return;
    const saldoMXN = c.moneda === 'USD' ? c.saldo * exchangeRate : c.saldo;
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
  const diario = Number(gastoDiario) || 75; // Café, snack, estacionamiento
  const dias = Number(diasAlMes) || 24;
  const r = (Number(rendimientoAnualCETES) || 9.5) / 100 / 12;

  const mensual = diario * dias;
  const anual = mensual * 12;

  // Proyección del valor futuro si se hubiera invertido
  const vf5 = mensual * ((Math.pow(1 + r, 5 * 12) - 1) / r);
  const vf10 = mensual * ((Math.pow(1 + r, 10 * 12) - 1) / r);
  const vf20 = mensual * ((Math.pow(1 + r, 20 * 12) - 1) / r);

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
  const neto = Number(ingresoNeto) || 51761.70;
  const necesidades = Number(costosVidaNecesarios) || 27000;
  const deseos = Number(gastosOpcionales) || 5500;
  const ahorroDeuda = Number(aporteDeudaOAhorro) || 12850;

  const pctNecesidades = (necesidades / neto) * 100;
  const pctDeseos = (deseos / neto) * 100;
  const pctAhorroDeuda = (ahorroDeuda / neto) * 100;

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
  const saldo = Number(saldoTotal) || 120000;
  const tasaVieja = (Number(tasaActualPromedio) || 49.03) / 100 / 12;
  const tasaNueva = (Number(nuevaTasaConsolidada) || 18.0) / 100 / 12;
  const n = Number(plazoMeses) || 24;

  // Cuota actual estimada
  const cuotaVieja = (saldo * tasaVieja) / (1 - Math.pow(1 + tasaVieja, -n));
  const totalViejo = cuotaVieja * n;

  // Cuota nueva consolidada
  const cuotaNueva = (saldo * tasaNueva) / (1 - Math.pow(1 + tasaNueva, -n));
  const totalNuevo = cuotaNueva * n;

  const ahorroIntereses = totalViejo - totalNuevo;
  const reduccionCuota = cuotaVieja - cuotaNueva;

  return {
    cuotaVieja: Math.round(cuotaVieja),
    cuotaNueva: Math.round(cuotaNueva),
    reduccionCuotaMensual: Math.round(reduccionCuota),
    ahorroTotalIntereses: Math.round(ahorroIntereses),
    porcentajeAhorro: parseFloat(((ahorroIntereses / totalViejo) * 100).toFixed(1))
  };
}

// 7. Calculadora de Retiro FIRE & Libertad Financiera
export function calculateFIRERetirement(gastosAnuales, patrimonioActual, ahorroMensual, rendimientoAnual = 9.0) {
  const gastos = Number(gastosAnuales) || (27000 * 12);
  const patrimonio = Number(patrimonioActual) || 35000;
  const ahorro = Number(ahorroMensual) || 10000;
  const rAnual = (Number(rendimientoAnual) || 9.0) / 100;
  const rMensual = rAnual / 12;

  // Regla del 4% (Número FIRE = Gastos Anuales * 25)
  const numeroFIRE = gastos * 25;

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
  const neto = Number(ingresoNetoMensual) || 51761.70;
  const horas = Number(horasTrabajadasMes) || 160;
  const gasto = Number(precioGasto) || 2500;

  const ingresoPorHora = neto / horas;
  const horasNecesarias = gasto / ingresoPorHora;

  return {
    ingresoPorHora: Math.round(ingresoPorHora),
    horasNecesarias: parseFloat(horasNecesarias.toFixed(1)),
    diasLaborales: parseFloat((horasNecesarias / 8).toFixed(1))
  };
}

// 9. Capacidad Máxima de Endeudamiento Bancario Sano
export function calculateBorrowingCapacity(ingresoNetoMensual, pagosDeudaActuales, rentaMensual = 8500) {
  const neto = Number(ingresoNetoMensual) || 51761.70;
  const deudaActual = Number(pagosDeudaActuales) || 6000;
  const renta = Number(rentaMensual) || 8500;

  // Criterio CONDUSEF: El total de deudas + vivienda no debe exceder el 40% del ingreso neto
  const limiteMaximoTotal = neto * 0.40;
  const margenRestante = Math.max(0, limiteMaximoTotal - deudaActual - (renta * 0.5));

  return {
    limiteMaximoTotal: Math.round(limiteMaximoTotal),
    margenRestanteMensual: Math.round(margenRestante),
    dtiActual: parseFloat(((deudaActual / neto) * 100).toFixed(1))
  };
}

// 10. Renta vs Compra de Vivienda (10 y 20 años)
export function calculateRentVsBuy(rentaMensual = 8500, precioInmueble = 2200000, enganchePorcentaje = 20, tasaHipoteca = 10.5, plusvaliaAnual = 5.0, rendimientoCETES = 9.5) {
  const renta = Number(rentaMensual) || 8500;
  const precio = Number(precioInmueble) || 2200000;
  const enganche = precio * ((Number(enganchePorcentaje) || 20) / 100);
  const credito = precio - enganche;
  const rHip = (Number(tasaHipoteca) || 10.5) / 100 / 12;

  // Mensualidad hipoteca 20 años (240 meses)
  const mensualidadHipoteca = (credito * rHip) / (1 - Math.pow(1 + rHip, -240));

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
  const nom = Number(tasaNominal) || 9.5;
  const inf = Number(inflacion) || 4.5;
  const isr = Number(retencionISR) || 0.50;

  const tasaNeta = nom - isr;
  const rendimientoReal = ((1 + tasaNeta / 100) / (1 + inf / 100) - 1) * 100;

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
  const bruto = Number(ingresoAnualBruto) || (54295.79 * 12);
  const medicos = Number(gastosMedicosDentales) || 15000;
  const ppr = Number(aportacionesPPR) || 25000;
  const col = Number(colegiaturas) || 0;

  const totalDeducciones = medicos + ppr + col;
  // Tasa marginal promedio estimada (ej. 20% - 30%)
  const devolucionEstimada = totalDeducciones * 0.25;

  return {
    totalDeducciones: Math.round(totalDeducciones),
    devolucionEstimadaSAT: Math.round(devolucionEstimada)
  };
}

// 13. Comparativa Fiscal: RESICO vs PFAE
export function calculateResicoVsPfae(facturacionAnualSinIVA = 651549, gastosDeduciblesAnuales = 250000) {
  const facturacion = Number(facturacionAnualSinIVA) || (54295.79 * 12);
  const gastos = Number(gastosDeduciblesAnuales) || 250000;

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
