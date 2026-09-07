// Historical calculation fixture. Never import from production code.
function getFutureDate(monthsAhead, day = 15) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  d.setDate(day);
  return d.toISOString().split('T')[0];
}

function getTodayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const INITIAL_DATA = {
  profileId: 'default',
  profileName: 'Gairo (Finanzas Personales)',

  // Parámetros Fiscales y CFDI Honorarios
  honorarios: {
    importeFacturado: 54295.79, // Base CFDI sin IVA
    tasaIva: 0.16,
    retencionIsrTasa: 0.10,     // 10% retenido por cliente
    retencionIvaFraccion: 0.6667, // 0.6667 fórmula Excel =B8*0.6667
    tasaIsrDeclaracion: 0.1725, // Tasa ISR estimada declaración
    otrosIngresos: 1446.00      // Otros ingresos mensuales
  },

  // Costo de Vida Necesario ($27,000 / mes)
  gastosNecesarios: [
    { id: 'g_renta', nombre: 'Renta vivienda', monto: 8500, diaPago: 1, icono: 'Home', categoria: 'Vivienda' },
    { id: 'g_servicios', nombre: 'Internet + Agua + Luz', monto: 1200, diaPago: 10, icono: 'Zap', categoria: 'Servicios' },
    { id: 'g_gasolina', nombre: 'Transporte y Gasolina', monto: 2800, diaPago: 15, icono: 'Fuel', categoria: 'Transporte' },
    { id: 'g_super', nombre: 'Supermercado y Alimentos', monto: 10000, diaPago: 15, icono: 'ShoppingCart', categoria: 'Alimentos' },
    { id: 'g_toto', nombre: 'Mascota (Toto)', monto: 3500, diaPago: 20, icono: 'Heart', categoria: 'Mascota' },
    { id: 'g_telefono', nombre: 'Teléfono celular', monto: 1000, diaPago: 5, icono: 'Phone', categoria: 'Servicios' },
    { id: 'g_otros_nec', nombre: 'Otros necesarios', monto: 0, diaPago: 28, icono: 'AlertCircle', categoria: 'Otros' }
  ],

  // Gastos Opcionales / Discrecionales ($5,500 / mes)
  gastosOpcionales: [
    { id: 'g_recreacion', nombre: 'Recreación y salir a comer', monto: 4000, diaPago: 15, icono: 'Utensils', categoria: 'Estilo de Vida' },
    { id: 'g_suscripciones', nombre: 'Suscripciones y streaming', monto: 1500, diaPago: 18, icono: 'Tv', categoria: 'Estilo de Vida' },
    { id: 'g_otros_opc', nombre: 'Otros opcionales', monto: 0, diaPago: 28, icono: 'Coffee', categoria: 'Estilo de Vida' }
  ],

  // Portafolio de Deudas (Pesos y Dólares + Deadlines)
  deudas: [
    {
      id: 'd_bbva_gold',
      nombre: 'BBVA Gold Crédito',
      institucion: 'BBVA México',
      moneda: 'MXN',
      saldo: 120000,
      tasaAnual: 49.03,
      pagoMinimo: 6000,
      diaCorte: 8,
      diaPagoLimite: 28,
      tipo: 'HIGH_INTEREST', // HIGH_INTEREST | PROMO_DEADLINE | LOW_INTEREST_HOLD
      promoDeadline: '',
      tasaRegularPostPromo: 49.03,
      anualidad: 1131,
      notas: 'Tarjeta principal de alto interés. Prioridad de liquidación agresiva (Avalancha).'
    },
    {
      id: 'd_promo_msi',
      nombre: 'MacBook Pro Meses Sin Intereses',
      institucion: 'Apple Store / Banamex',
      moneda: 'MXN',
      saldo: 28000,
      tasaAnual: 0.0,
      pagoMinimo: 2000,
      diaCorte: 15,
      diaPagoLimite: 5,
      tipo: 'PROMO_DEADLINE',
      promoDeadline: getFutureDate(4, 15), // Vence en 4 meses
      tasaRegularPostPromo: 44.5,
      anualidad: 0,
      notas: '¡Promoción 0% con vencimiento próximo! Si no se liquida antes del deadline, cobran intereses retroactivos.'
    },
    {
      id: 'd_usd_chase',
      nombre: 'Chase Freedom Card (USD)',
      institucion: 'Chase Bank USA',
      moneda: 'USD',
      saldo: 1150.00,
      tasaAnual: 24.99,
      pagoMinimo: 45.00,
      diaCorte: 22,
      diaPagoLimite: 17,
      tipo: 'HIGH_INTEREST',
      promoDeadline: '',
      tasaRegularPostPromo: 24.99,
      anualidad: 0,
      notas: 'Deuda en dólares. Se actualiza automáticamente con el tipo de cambio USD/MXN.'
    },
    {
      id: 'd_prestamo_amigo',
      nombre: 'Préstamo Personal Blando',
      institucion: 'Préstamo Familiar',
      moneda: 'MXN',
      saldo: 16000,
      tasaAnual: 4.0,
      pagoMinimo: 800,
      diaCorte: 1,
      diaPagoLimite: 15,
      tipo: 'LOW_INTEREST_HOLD',
      promoDeadline: '',
      tasaRegularPostPromo: 4.0,
      anualidad: 0,
      notas: 'Tasa muy baja. Puede mantenerse en pago mínimo mientras se matan las caras.'
    }
  ],

  // Activos para Estructura de Capital (Balance General)
  activos: [
    { id: 'a_banco_mxn', nombre: 'Cuenta de Débito (Bancos MXN)', tipo: 'Efectivo', moneda: 'MXN', monto: 18500 },
    { id: 'a_banco_usd', nombre: 'Cuenta en Dólares (USD)', tipo: 'Efectivo', moneda: 'USD', monto: 850 },
    { id: 'a_cetes', nombre: 'CETES Directo (Rendimiento ~8-10%)', tipo: 'Inversión', moneda: 'MXN', monto: 35000 },
    { id: 'a_fondo_emergencia', nombre: 'Cajita Nu / Ahorro Líquido', tipo: 'Inversión', moneda: 'MXN', monto: 12000 }
  ],

  // Transacciones recientes (para el módulo de gastos reales vs presupuesto)
  transacciones: [
    { id: 'tx_1', fecha: getTodayOffset(-1), descripcion: 'Super Chedraui Selecto', monto: 2350, tipo: 'GASTO', categoria: 'Alimentos', metodoPago: 'BBVA Débito', moneda: 'MXN' },
    { id: 'tx_2', fecha: getTodayOffset(-3), descripcion: 'Gasolina Mobil', monto: 850, tipo: 'GASTO', categoria: 'Transporte', metodoPago: 'Efectivo', moneda: 'MXN' },
    { id: 'tx_3', fecha: getTodayOffset(-5), descripcion: 'Comida Toto (Croquetas ProPlan)', monto: 1400, tipo: 'GASTO', categoria: 'Mascota', metodoPago: 'BBVA Débito', moneda: 'MXN' },
    { id: 'tx_4', fecha: getTodayOffset(-6), descripcion: 'Depósito Honorarios Cliente', monto: 51761.70, tipo: 'INGRESO', categoria: 'Honorarios', metodoPago: 'Transferencia', moneda: 'MXN' },
    { id: 'tx_5', fecha: getTodayOffset(-7), descripcion: 'Netflix + Spotify', monto: 450, tipo: 'GASTO', categoria: 'Estilo de Vida', metodoPago: 'Tarjeta Crédito', moneda: 'MXN' }
  ],

  // Estado del Checklist de pagos del mes actual
  pagosRealizadosMes: {},

  // Parámetros de Ahorro
  ahorro: {
    porcentajeObjetivo: 0.10, // 10% sobre ingreso neto
    tasaRendimientoAnual: 0.095, // 9.5% anual CETES
    horizonteAnos: 10
  },

  // Estado de Licencia Comercial / Suscripción
  licencia: {
    esPro: true, // Activado para Gairo y venta comercial
    tipoPlan: 'LIFETIME_COMMERCIAL_FOUNDER',
    fechaActivacion: new Date().toISOString()
  },

  // Preferencias de usuario
  config: {
    displayCurrency: 'MXN', // 'MXN' | 'USD' | 'ORIGINAL'
    aportacionExtraMensual: 2500, // Aporte extra para el simulador
    tema: 'dark',
    diasAlertaVencimiento: 45,
    onboardingCompletado: true
  }
};

