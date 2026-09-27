import { emptyFinancialData, ACCOUNT_NAMES } from './accountData.js';

const record = value => value && typeof value === 'object' && !Array.isArray(value);
function number(value, label, fallback) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Falta ${label} en el respaldo.`);
  }
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e14) throw new Error(`${label} debe ser un número válido igual o mayor que cero.`);
  return parsed;
}
function currency(value) {
  if (!['MXN', 'USD'].includes(value)) throw new Error('Cada registro debe indicar moneda MXN o USD.');
  return value;
}
function rows(value, name, fallback, normalize) {
  if (value === undefined) return structuredClone(fallback);
  if (!Array.isArray(value) || value.length > 100000) throw new Error(`La lista ${name} no es válida.`);
  const ids = new Set();
  return value.map(row => {
    if (!record(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error(`Hay registros o identificadores inválidos en ${name}.`);
    ids.add(row.id);
    for (const key of ['nombre', 'institucion', 'descripcion', 'categoria', 'metodoPago', 'notas', 'icono']) {
      if (row[key] !== undefined && (typeof row[key] !== 'string' || row[key].length > (key === 'notas' ? 4000 : 300))) throw new Error('Un campo de texto en el respaldo no es v\u00e1lido.');
    }
    if (name !== 'movimientos' && (typeof row.nombre !== 'string' || !row.nombre.trim())) throw new Error('Falta el nombre de un registro.');
    return normalize(row);
  });
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function normalizeBackup(imported, accountId = 'gairo') {
  const INITIAL_DATA = emptyFinancialData(accountId);
  if (!record(imported) || !Array.isArray(imported.deudas) || !Array.isArray(imported.transacciones)) throw new Error('Selecciona un respaldo de Sifran con deudas y movimientos.');
  for (const key of ['honorarios', 'config', 'ahorro', 'licencia', 'pagosRealizadosMes']) {
    if (imported[key] !== undefined && !record(imported[key])) throw new Error(`La sección ${key} no es válida.`);
  }
  const normalized = { ...INITIAL_DATA };
  for (const key of Object.keys(INITIAL_DATA)) if (Object.hasOwn(imported, key)) normalized[key] = imported[key];
  normalized.honorarios = { ...INITIAL_DATA.honorarios, ...imported.honorarios };
  for (const key of Object.keys(INITIAL_DATA.honorarios)) normalized.honorarios[key] = number(normalized.honorarios[key], `honorarios.${key}`);
  if (normalized.honorarios.modo !== undefined && !['MANUAL', 'FACTURADO'].includes(normalized.honorarios.modo)) throw new Error('El modo de ingresos no es válido.');
  if (normalized.honorarios.modo === 'MANUAL') {
    for (const key of ['ingresoMensualRecibido', 'provisionFiscalMensual']) normalized.honorarios[key] = number(normalized.honorarios[key], key);
    if (typeof normalized.honorarios.regimen !== 'string' || normalized.honorarios.regimen.length > 100) throw new Error('El régimen fiscal no es válido.');
    const day = normalized.honorarios.diaPagoImpuestos;
    normalized.honorarios.diaPagoImpuestos = day == null || day === '' ? null : number(day, 'día de impuestos');
    if (normalized.honorarios.diaPagoImpuestos !== null && (!Number.isInteger(normalized.honorarios.diaPagoImpuestos) || normalized.honorarios.diaPagoImpuestos < 1 || normalized.honorarios.diaPagoImpuestos > 31)) throw new Error('El día de impuestos debe estar entre 1 y 31.');
  }
  normalized.deudasPendientes = rows(imported.deudasPendientes, 'deudas pendientes', [], row => {
    if (!['TARJETA', 'PRESTAMOS_ESTUDIANTILES', 'OTRO'].includes(row.clase)) throw new Error('El tipo de obligación pendiente no es válido.');
    const numeroCuentas = number(row.numeroCuentas, 'número de créditos', 1);
    if (!Number.isInteger(numeroCuentas) || numeroCuentas < 1 || numeroCuentas > 100) throw new Error('Revisa el número de créditos agrupados.');
    const next = { ...row, moneda: currency(row.moneda), numeroCuentas, saldoEstimado: row.saldoEstimado == null || row.saldoEstimado === '' ? null : number(row.saldoEstimado, 'saldo aproximado') };
    for (const key of ['tasaAnual', 'pagoMinimo', 'diaCorte', 'diaPagoLimite']) {
      next[key] = row[key] == null || row[key] === '' ? null : number(row[key], key);
      if (key.startsWith('dia') && next[key] !== null && (!Number.isInteger(next[key]) || next[key] < 1 || next[key] > 31)) throw new Error('Los días deben estar entre 1 y 31.');
    }
    for (const key of ['referenciaTasa', 'fuenteTasa', 'consultaTasa']) if (row[key] !== undefined && (typeof row[key] !== 'string' || row[key].length > 3000)) throw new Error('La referencia pública no es válida.');
    if (row.fuenteTasa && !row.fuenteTasa.startsWith('https://')) throw new Error('La fuente pública debe usar HTTPS.');
    return next;
  });
  normalized.deudas = rows(imported.deudas, 'deudas', [], row => {
    if (typeof row.nombre !== 'string' || !row.nombre.trim() || !['HIGH_INTEREST', 'PROMO_DEADLINE', 'LOW_INTEREST_HOLD'].includes(row.tipo)) throw new Error('Una deuda no tiene nombre o tipo válido.');
    if (row.promoDeadline && !date(row.promoDeadline)) throw new Error('Una promoción contiene una fecha inválida.');
    const next = { ...row, moneda: currency(row.moneda), saldo: number(row.saldo, 'saldo'), tasaAnual: number(row.tasaAnual, 'tasa anual'), pagoMinimo: number(row.pagoMinimo, 'pago mínimo'), anualidad: number(row.anualidad, 'anualidad', 0) };
    next.tasaRegularPostPromo = row.tasaRegularPostPromo == null || row.tasaRegularPostPromo === '' ? null : number(row.tasaRegularPostPromo, 'tasa posterior');
    for (const [key, fallback] of [['diaCorte', 15], ['diaPagoLimite', 5]]) {
      next[key] = number(row[key], key, fallback);
      if (!Number.isInteger(next[key]) || next[key] < 1 || next[key] > 31) throw new Error('Los días de pago y corte deben estar entre 1 y 31.');
    }
    return next;
  });
  normalized.transacciones = rows(imported.transacciones, 'movimientos', [], row => {
    if (!date(row.fecha) || typeof row.descripcion !== 'string' || !row.descripcion.trim() || !['INGRESO', 'GASTO'].includes(row.tipo)) throw new Error('Un movimiento tiene fecha, descripción o tipo inválido.');
    const monto = number(row.monto, 'monto del movimiento');
    if (monto <= 0) throw new Error('El importe de un movimiento debe ser mayor que cero.');
    return { ...row, monto, moneda: currency(row.moneda) };
  });
  const debtIds = new Set(normalized.deudas.map(row => row.id));
  if (normalized.deudasPendientes.some(row => debtIds.has(row.id))) throw new Error('Una deuda no puede estar completa y pendiente a la vez.');
  for (const key of ['gastosNecesarios', 'gastosOpcionales', 'activos']) normalized[key] = rows(imported[key], key, INITIAL_DATA[key], row => ({ ...row, monto: number(row.monto, `monto en ${key}`), ...(key === 'activos' ? { moneda: currency(row.moneda) } : {}) }));
  for (const row of [...normalized.gastosNecesarios, ...normalized.gastosOpcionales]) {
    row.diaPago = row.diaPago == null || row.diaPago === '' ? null : number(row.diaPago, 'día de gasto');
    if (row.diaPago !== null && (!Number.isInteger(row.diaPago) || row.diaPago < 1 || row.diaPago > 31)) throw new Error('El día de gasto debe estar entre 1 y 31.');
  }
  normalized.config = { ...INITIAL_DATA.config, ...imported.config };
  normalized.config.aportacionExtraMensual = number(normalized.config.aportacionExtraMensual, 'aportación extra');
  if (!['MXN', 'USD', 'ORIGINAL'].includes(normalized.config.displayCurrency)) throw new Error('La preferencia de moneda no es válida.');
  normalized.profileId = accountId;
  normalized.profileName = ACCOUNT_NAMES[accountId];
  normalized.licencia = INITIAL_DATA.licencia;
  const education = imported.education || INITIAL_DATA.education;
  if (!record(education) || !Array.isArray(education.weeks) || !Array.isArray(education.impulses)) throw new Error('El progreso de educación no es válido.');
  if (education.weeks.some(w => !Number.isInteger(w) || w < 1 || w > 52) || education.impulses.length > 1000) throw new Error('El progreso de educación no es válido.');
  normalized.education = { weeks: [...new Set(education.weeks)], impulses: education.impulses.map(row => {
    if (!record(row) || !['string','number'].includes(typeof row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 200 || !Number.isFinite(row.createdAt) || !Number.isFinite(row.expiresAt)) throw new Error('Una compra pendiente no es válida.');
    return { id: row.id, name: row.name, amount: number(row.amount, 'compra pendiente'), createdAt: row.createdAt, expiresAt: row.expiresAt };
  }) };
  const prefs = imported.preferences || INITIAL_DATA.preferences;
  if (!record(prefs)) throw new Error('Las preferencias no son válidas.');
  normalized.preferences = { manualRate: prefs.manualRate == null ? null : number(prefs.manualRate, 'tipo de cambio'), manualRateUpdatedAt: typeof prefs.manualRateUpdatedAt === 'string' ? prefs.manualRateUpdatedAt.slice(0, 40) : null };
  if (normalized.preferences.manualRate === 0) throw new Error('El tipo de cambio debe ser mayor que cero.');
  return normalized;
}

export function createAccountBackup(data, accountId, revision = null) {
  return { format: 'sifran-account', schemaVersion: 1, accountId, revision, exportedAt: new Date().toISOString(), financialData: normalizeBackup(data, accountId) };
}

export function restoreAccountBackup(value, accountId) {
  if (value?.format === 'sifran-account') {
    if (value.schemaVersion !== 1 || value.accountId !== accountId) throw new Error('Este respaldo pertenece a otra cuenta o versión.');
    return normalizeBackup(value.financialData, accountId);
  }
  if (accountId !== 'gairo') throw new Error('Los respaldos de la instalación anterior sólo se pueden importar en Gairo.');
  return normalizeBackup(value, accountId);
}
