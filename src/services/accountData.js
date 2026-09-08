export const ACCOUNT_NAMES = Object.freeze({ gairo: 'Gairo', ricardo: 'Ricardo' });

export function emptyFinancialData(accountId) {
  if (!ACCOUNT_NAMES[accountId]) throw new Error('Cuenta desconocida.');
  return {
    profileId: accountId, profileName: ACCOUNT_NAMES[accountId],
    honorarios: { importeFacturado: 0, tasaIva: 0, retencionIsrTasa: 0, retencionIvaFraccion: 0, tasaIsrDeclaracion: 0, otrosIngresos: 0 },
    gastosNecesarios: [], gastosOpcionales: [], deudas: [], activos: [], transacciones: [], pagosRealizadosMes: {},
    ahorro: { porcentajeObjetivo: 0, tasaRendimientoAnual: 0, horizonteAnos: 10 },
    licencia: { esPro: false, tipoPlan: 'PERSONAL' },
    config: { displayCurrency: 'MXN', aportacionExtraMensual: 0, tema: 'dark', diasAlertaVencimiento: 45, onboardingCompletado: false },
    education: { weeks: [], impulses: [] }, preferences: { manualRate: null, manualRateUpdatedAt: null },
  };
}

export function hasFinancialRecords(data) {
  return ['deudas', 'activos', 'transacciones', 'gastosNecesarios', 'gastosOpcionales'].some(key => data[key]?.length > 0)
    || Number(data.honorarios?.importeFacturado) > 0 || Number(data.honorarios?.otrosIngresos) > 0;
}
