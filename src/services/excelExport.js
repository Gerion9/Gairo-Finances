// Exportación completa a formato Excel (.xlsx) usando SheetJS
import * as XLSX from 'xlsx';
import { calculateFiscalOverview } from './financeEngine.js';

export function buildFinancialWorkbook(data, exchangeRate) {
  const hasPending = Boolean(data.deudasPendientes?.length);
  const wb = XLSX.utils.book_new();

  // 1. Hoja: Parámetros Fiscales y CFDI
  const fiscal = calculateFiscalOverview(data.honorarios);
  const parametrosData = data.honorarios?.modo === 'MANUAL' ? [
    ['INGRESOS DECLARADOS · MXN', ''], ['Régimen indicado', data.honorarios.regimen],
    ['Ingreso mensual recibido', fiscal.netoEnCuenta], ['Provisión fiscal mensual aproximada', fiscal.totalImpuestosSat],
    ['Después de impuestos', fiscal.ingresoDisponibleReal], ['ISR e IVA desglosados', 'No disponibles: importes declarados, no cálculo fiscal'],
  ] : [
    ['FINANZAS PERSONALES · SIFRAN', ''],
    ['Tipo de cambio USD/MXN aplicado:', exchangeRate],
    ['Fecha de exportación:', new Date().toLocaleString('es-MX')],
    ['', ''],
    ['HONORARIOS / FISCAL', 'MONTO (MXN)'],
    ['Importe facturado (sin IVA)', fiscal.importeFacturado],
    ['IVA cobrado (16%)', fiscal.ivaCobrado],
    ['Subtotal CFDI', fiscal.subtotalCfdi],
    ['(−) Retención ISR cliente (10%)', fiscal.retencionIsr],
    ['(−) Retención IVA cliente (2/3)', fiscal.retencionIva],
    ['NETO que llega a tu cuenta bancaria', fiscal.netoEnCuenta],
    ['(+) Otros ingresos mensuales', fiscal.otrosIngresos],
    ['', ''],
    ['OBLIGACIONES SAT A CARGO (DECLARACIÓN MENSUAL)', 'MONTO (MXN)'],
    ['ISR a cargo mensual', fiscal.isrACargo],
    ['IVA a cargo mensual', fiscal.ivaACargo],
    ['TOTAL PROVISIÓN SAT MENSUAL (INTOCABLE)', fiscal.totalImpuestosSat]
  ];
  const wsParametros = XLSX.utils.aoa_to_sheet(parametrosData);
  XLSX.utils.book_append_sheet(wb, wsParametros, 'Parámetros Fiscales');

  // 2. Hoja: Deudas y Estrategia
  const deudasHeaders = [
    ['PORTAFOLIO DE DEUDAS Y CRÉDITOS', '', '', '', '', '', '', ''],
    ['Nombre', 'Institución', 'Moneda', 'Saldo Original', 'Saldo en MXN', 'Tasa Anual (%)', 'Pago Mínimo', 'Tipo / Estrategia', 'Deadline Promo']
  ];
  const deudasRows = data.deudas.map(d => {
    const saldoMXN = d.moneda === 'USD' ? d.saldo * exchangeRate : d.saldo;
    return [
      d.nombre,
      d.institucion,
      d.moneda,
      d.saldo,
      saldoMXN,
      d.tasaAnual,
      d.pagoMinimo,
      d.tipo === 'PROMO_DEADLINE' ? 'Promoción con Deadline' : (d.tipo === 'HIGH_INTEREST' ? 'Alto Interés (Avalancha)' : 'Bajo Interés (Dejar correr)'),
      d.promoDeadline || 'N/A'
    ];
  });
  const wsDeudas = XLSX.utils.aoa_to_sheet([...deudasHeaders, ...deudasRows]);
  XLSX.utils.book_append_sheet(wb, wsDeudas, 'Deudas');

  if (hasPending) {
    const pendingRows = [['DEUDAS CON DATOS PENDIENTES · SALDOS APROXIMADOS'], ['Nombre', 'Institución', 'Moneda', 'Saldo aproximado', 'Créditos agrupados', 'Tasa contractual', 'Pago mínimo', 'Fecha límite', 'Referencia pública', 'Fuente', 'Consulta', 'Notas'],
      ...data.deudasPendientes.map(d => [d.nombre, d.institucion, d.moneda, d.saldoEstimado ?? 'Por confirmar', d.numeroCuentas, d.tasaAnual ?? 'Por confirmar', d.pagoMinimo ?? 'Por confirmar', d.diaPagoLimite ?? 'Por confirmar', d.referenciaTasa || '', d.fuenteTasa || '', d.consultaTasa || '', d.notas || ''])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pendingRows), 'Deudas pendientes');
  }
  // 3. Hoja: Presupuesto y Gastos
  const gastosData = [
    ['PRESUPUESTO MENSUAL DE GASTOS', ''],
    ['Categoría', 'Monto Mensual (MXN)'],
    ['--- GASTOS NECESARIOS (COSTO DE VIDA) ---', ''],
    ...data.gastosNecesarios.map(g => [g.nombre, g.monto]),
    ['TOTAL COSTO DE VIDA', data.gastosNecesarios.reduce((sum, g) => sum + g.monto, 0)],
    ['', ''],
    ['--- GASTOS OPCIONALES ---', ''],
    ...data.gastosOpcionales.map(g => [g.nombre, g.monto]),
    ['TOTAL GASTOS OPCIONALES', data.gastosOpcionales.reduce((sum, g) => sum + g.monto, 0)]
  ];
  const wsGastos = XLSX.utils.aoa_to_sheet(gastosData);
  XLSX.utils.book_append_sheet(wb, wsGastos, 'Presupuesto de Gastos');

  // 4. Hoja: Estructura de Capital (Activos vs Pasivos)
  const totalPasivosMXN = data.deudas.reduce((sum, d) => sum + (d.moneda === 'USD' ? d.saldo * exchangeRate : d.saldo), 0);
  const activosRows = data.activos.map(a => {
    const montoMXN = a.moneda === 'USD' ? a.monto * exchangeRate : a.monto;
    return [a.nombre, a.tipo, a.moneda, a.monto, montoMXN];
  });
  const totalActivosMXN = data.activos.reduce((sum, a) => sum + (a.moneda === 'USD' ? a.monto * exchangeRate : a.monto), 0);

  const balanceData = [
    ['ESTRUCTURA DE CAPITAL (BALANCE GENERAL)', '', '', '', ''],
    ['Nombre Activo', 'Tipo', 'Moneda', 'Monto Original', 'Monto en MXN'],
    ...activosRows,
    ['TOTAL ACTIVOS', '', '', '', totalActivosMXN],
    ['', '', '', '', ''],
    [hasPending ? 'PASIVOS COMPLETOS EXCLUIDOS LOS PENDIENTES' : 'TOTAL PASIVOS (DEUDAS)', '', '', '', totalPasivosMXN],
    ['PATRIMONIO NETO (ACTIVOS − PASIVOS)', '', '', '', hasPending ? 'Pendiente: faltan datos de deudas' : totalActivosMXN - totalPasivosMXN]
  ];
  const wsBalance = XLSX.utils.aoa_to_sheet(balanceData);
  XLSX.utils.book_append_sheet(wb, wsBalance, 'Estructura de Capital');

  return wb;
}

export function exportFinancesToExcel(data, exchangeRate) {
  const wb = buildFinancialWorkbook(data, exchangeRate);
  // Descargar archivo
  XLSX.writeFile(wb, `Sifran_Finanzas_${new Date().toISOString().split('T')[0]}.xlsx`);
}
