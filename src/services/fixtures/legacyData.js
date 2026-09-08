// Synthetic legacy-shaped fixture: no person's records or financial profile.
// Tests only. Never import from production code.
function futurePromoDate() {
  const date = new Date();
  date.setDate(15);
  date.setMonth(date.getMonth() + 4);
  return date.toISOString().split('T')[0];
}

export const INITIAL_DATA = {
  profileId: 'synthetic-fixture',
  profileName: 'Persona de prueba',
  honorarios: {
    importeFacturado: 40000, tasaIva: 0.16, retencionIsrTasa: 0.10,
    retencionIvaFraccion: 0.6667, tasaIsrDeclaracion: 0.20, otrosIngresos: 1000,
  },
  gastosNecesarios: [
    { id: 'necessary-a', nombre: 'Vivienda de prueba', monto: 9000, diaPago: 1, categoria: 'Vivienda' },
    { id: 'necessary-b', nombre: 'Servicios de prueba', monto: 1000, diaPago: 10, categoria: 'Servicios' },
    { id: 'necessary-c', nombre: 'Alimentos de prueba', monto: 2000, diaPago: 18, categoria: 'Alimentos' },
  ],
  gastosOpcionales: [
    { id: 'optional-a', nombre: 'Ocio de prueba', monto: 1400, diaPago: 22, categoria: 'Estilo de Vida' },
    { id: 'optional-b', nombre: 'Suscripción de prueba', monto: 600, diaPago: 6, categoria: 'Estilo de Vida' },
  ],
  deudas: [
    {
      id: 'debt-mxn', nombre: 'Crédito MXN de prueba', institucion: 'Entidad ficticia A',
      moneda: 'MXN', saldo: 30000, tasaAnual: 36, pagoMinimo: 1800,
      diaCorte: 10, diaPagoLimite: 20, tipo: 'HIGH_INTEREST',
      promoDeadline: '', tasaRegularPostPromo: 36, anualidad: 0, notas: '',
    },
    {
      id: 'debt-promo', nombre: 'Promoción de prueba', institucion: 'Entidad ficticia B',
      moneda: 'MXN', saldo: 6000, tasaAnual: 0, pagoMinimo: 600,
      diaCorte: 15, diaPagoLimite: 5, tipo: 'PROMO_DEADLINE',
      promoDeadline: futurePromoDate(), tasaRegularPostPromo: 30, anualidad: 0, notas: '',
    },
    {
      id: 'debt-usd', nombre: 'Crédito USD de prueba', institucion: 'Entidad ficticia C',
      moneda: 'USD', saldo: 500, tasaAnual: 24, pagoMinimo: 24,
      diaCorte: 21, diaPagoLimite: 27, tipo: 'HIGH_INTEREST',
      promoDeadline: '', tasaRegularPostPromo: 24, anualidad: 0, notas: '',
    },
    {
      id: 'debt-low-rate', nombre: 'Préstamo de prueba', institucion: 'Entidad ficticia D',
      moneda: 'MXN', saldo: 4000, tasaAnual: 6, pagoMinimo: 400,
      diaCorte: 2, diaPagoLimite: 12, tipo: 'LOW_INTEREST_HOLD',
      promoDeadline: '', tasaRegularPostPromo: 6, anualidad: 0, notas: '',
    },
  ],
  activos: [
    { id: 'asset-mxn', nombre: 'Saldo MXN de prueba', tipo: 'Efectivo', moneda: 'MXN', monto: 3000 },
    { id: 'asset-usd', nombre: 'Saldo USD de prueba', tipo: 'Efectivo', moneda: 'USD', monto: 200 },
    { id: 'asset-investment', nombre: 'Inversión de prueba', tipo: 'Inversión', moneda: 'MXN', monto: 6000 },
  ],
  transacciones: [
    { id: 'transaction-a', fecha: '2026-09-01', descripcion: 'Compra de prueba A', monto: 25, tipo: 'GASTO', categoria: 'Alimentos', metodoPago: 'Efectivo', moneda: 'MXN' },
    { id: 'transaction-b', fecha: '2026-09-02', descripcion: 'Compra de prueba B', monto: 10, tipo: 'GASTO', categoria: 'Servicios', metodoPago: 'Tarjeta', moneda: 'USD' },
    { id: 'transaction-c', fecha: '2026-09-03', descripcion: 'Ingreso de prueba', monto: 500, tipo: 'INGRESO', categoria: 'Honorarios', metodoPago: 'Transferencia', moneda: 'MXN' },
  ],
  pagosRealizadosMes: {},
  ahorro: { porcentajeObjetivo: 0.10, tasaRendimientoAnual: 0.05, horizonteAnos: 5 },
  licencia: { esPro: false, tipoPlan: 'FREE', fechaActivacion: null },
  config: {
    displayCurrency: 'MXN', aportacionExtraMensual: 2000, tema: 'dark',
    diasAlertaVencimiento: 30, onboardingCompletado: true,
  },
};
