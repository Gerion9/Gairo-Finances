import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createAccountBackup, normalizeBackup, restoreAccountBackup } from './backup.js';
import { INITIAL_DATA } from './fixtures/legacyData.js';
import { emptyFinancialData } from './accountData.js';
import { updateMarketSelections } from './marketPreferences.js';
import { createReceivable, receiveReceivableIncome, unlinkReceivableIncome } from './receivables.js';
import { putWorkspace } from '../../server/workspace/repository.js';

afterEach(() => vi.unstubAllGlobals());

describe('Restauración validada', () => {
  const fixture = () => structuredClone(INITIAL_DATA);
  it('normaliza importes numéricos de texto sin mutar el respaldo', () => {
    const data = fixture(); data.deudas[0].saldo = '100'; data.deudas[0].pagoMinimo = '10';
    expect(normalizeBackup(data).deudas[0].saldo).toBe(100);
    expect(data.deudas[0].saldo).toBe('100');
  });
  it('rechaza saldos ausentes antes de reemplazar datos', () => {
    const data = fixture(); delete data.deudas[0].saldo;
    expect(() => normalizeBackup(data)).toThrow('saldo');
  });
  it('conserva tasa posterior desconocida y cero explícito', () => {
    const data = fixture(); data.deudas[0].tasaRegularPostPromo = ''; data.deudas[1].tasaRegularPostPromo = 0;
    const result = normalizeBackup(data);
    expect(result.deudas[0].tasaRegularPostPromo).toBeNull(); expect(result.deudas[1].tasaRegularPostPromo).toBe(0);
  });
  it('conserva cero de aporte y listas vacías', () => {
    const data = fixture(); data.config.aportacionExtraMensual = 0; data.deudas = []; data.transacciones = [];
    expect(normalizeBackup(data).config.aportacionExtraMensual).toBe(0); expect(normalizeBackup(data).deudas).toEqual([]);
  });
  it('rechaza moneda inválida y fechas imposibles', () => {
    const data = fixture(); data.deudas[0].moneda = 'EUR'; expect(() => normalizeBackup(data)).toThrow('moneda');
    const second = fixture(); second.transacciones[0].fecha = '2026-02-30'; expect(() => normalizeBackup(second)).toThrow('fecha');
  });
  it('rechaza id repetido y cantidades no finitas', () => {
    const data = fixture(); data.deudas.push({ ...data.deudas[0] }); expect(() => normalizeBackup(data)).toThrow('identificadores');
    const second = fixture(); second.deudas[0].saldo = Infinity; expect(() => normalizeBackup(second)).toThrow('saldo');
  });
});

describe('Preferencias de mercado en respaldos y operaciones existentes', () => {
  // Captured with the pre-preferences normalizer; changing these bytes breaks existing receipts.
  const legacySerialized = '{"profileId":"gairo","profileName":"Gairo","honorarios":{"importeFacturado":0,"tasaIva":0,"retencionIsrTasa":0,"retencionIvaFraccion":0,"tasaIsrDeclaracion":0,"otrosIngresos":250},"gastosNecesarios":[],"gastosOpcionales":[],"deudas":[],"deudasPendientes":[],"activos":[],"transacciones":[],"pagosRealizadosMes":{},"planFinanciero":null,"ahorro":{"porcentajeObjetivo":0,"tasaRendimientoAnual":0,"horizonteAnos":10},"licencia":{"esPro":false,"tipoPlan":"PERSONAL"},"config":{"displayCurrency":"MXN","aportacionExtraMensual":0,"tema":"dark","diasAlertaVencimiento":45,"onboardingCompletado":false},"education":{"weeks":[],"impulses":[]},"preferences":{"manualRate":18.5,"manualRateUpdatedAt":"2026-10-18T12:00:00.000Z"}}';
  const legacyHash = 'b81fd8e399ed607c6aad672110d9bc7161b97193890182fe8c012a9abfddf5fe';

  it('conserva exactamente la serialización legacy sin materializar una selección vacía', () => {
    const normalized = normalizeBackup(JSON.parse(legacySerialized), 'gairo');
    expect(JSON.stringify(normalized)).toBe(legacySerialized);
    expect(normalized.preferences).not.toHaveProperty('marketSelections');
    expect(normalized).not.toHaveProperty('receivables');
    const missingPreferences = JSON.parse(legacySerialized); delete missingPreferences.preferences;
    expect(normalizeBackup(missingPreferences).preferences).toEqual({ manualRate: null, manualRateUpdatedAt: null });
  });

  it('acepta el replay de un recibo generado antes de añadir selecciones sin escribir otra revisión', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const mutationId = '33864f87-f764-4e9a-8878-0db221fa6e25';
    const row = { account_id: 'gairo', revision: 4, data_json: legacySerialized, receipts_json: JSON.stringify([{ id: mutationId, hash: legacyHash, revision: 1 }]), updated_at: '2026-10-18T12:00:00.000Z' };
    const db = { prepare: vi.fn(sql => {
      expect(sql.startsWith('SELECT ')).toBe(true);
      return { bind: (...args) => { expect(args).toEqual(['gairo', 'user-gairo']); return { first: async () => row }; } };
    }) };
    const result = await putWorkspace(db, { id: 'gairo', userId: 'user-gairo' }, { schemaVersion: 1, baseRevision: 0, mutationId, financialData: JSON.parse(legacySerialized) });
    expect(result).toMatchObject({ replayed: true, acceptedRevision: 1, currentRevision: 4 });
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });

  it('exporta y restaura selecciones sin cambiar la versión externa ni perder otros campos', () => {
    const data = updateMarketSelections(JSON.parse(legacySerialized), { ownedCardIds: ['nu-credito', 'unlisted-card'], savingsProductIds: ['unlisted-saving'] });
    const exported = createAccountBackup(data, 'gairo', 8);
    expect(exported.schemaVersion).toBe(1);
    const restored = restoreAccountBackup(JSON.parse(JSON.stringify(exported)), 'gairo');
    expect(restored.preferences).toEqual(data.preferences);
    expect(restored.honorarios.otrosIngresos).toBe(250);
    expect(restored.preferences.marketSelections).not.toBe(data.preferences.marketSelections);
    expect(() => restoreAccountBackup(exported, 'ricardo')).toThrow('otra cuenta');
  });

  it.each([null, { version: 2, ownedCardIds: [], savingsProductIds: [] }, { version: 1, ownedCardIds: [], savingsProductIds: ['a', 'b', 'c', 'd'] }])('rechaza preferencias incompatibles antes de restaurar: %j', value => {
    const data = emptyFinancialData('gairo'); data.preferences.marketSelections = value;
    expect(() => normalizeBackup(data)).toThrow();
    expect(data.preferences.marketSelections).toBe(value);
  });
});

describe('Libro opcional de cobros en respaldos', () => {
  const recordedAt = '2026-10-18T12:00:00.000Z';
  const item = { id: 'work-october', name: 'Trabajo de octubre', amountMinor: 10000, currency: 'MXN', expectedDate: '2026-10-20', createdAt: recordedAt, cancelledAt: null };
  const received = () => receiveReceivableIncome(
    createReceivable(emptyFinancialData('gairo'), item).data,
    { id: 'partial-october', receivableId: item.id, transaction: { descripcion: 'Primer pago', monto: 40, fecha: '2026-10-18', moneda: 'MXN' }, createdAt: recordedAt },
    { today: '2026-10-18' },
  ).data;

  it('exporta y restaura cobro, pago parcial y selecciones con schemaVersion externo 1', () => {
    const data = updateMarketSelections(received(), { ownedCardIds: ['nu-credito'], savingsProductIds: ['nu-cajita'] });
    const exported = createAccountBackup(data, 'gairo', 3);
    const restored = restoreAccountBackup(JSON.parse(JSON.stringify(exported)), 'gairo');
    expect(exported.schemaVersion).toBe(1);
    expect(restored.receivables).toEqual(data.receivables);
    expect(restored.receivables.version).toBe(1);
    expect(restored.transacciones).toEqual(data.transacciones);
    expect(restored.preferences).toEqual(data.preferences);
    expect(restored.honorarios).toEqual(emptyFinancialData('gairo').honorarios);
    expect(restored.activos).toEqual([]);
    expect(restored.planFinanciero).toBeNull();
  });

  it('rechaza un vínculo huérfano antes de restaurar el documento', () => {
    const data = received(); data.transacciones = [];
    expect(() => normalizeBackup(data)).toThrow('ingreso existente');
    expect(data.receivables.allocations).toHaveLength(1);
  });

  it.each([
    { moneda: 'USD' }, { tipo: 'GASTO' }, { monto: 39 },
  ])('rechaza movimientos que invalidan un cobro vinculado: %j', patch => {
    const data = received(); data.transacciones[0] = { ...data.transacciones[0], ...patch };
    expect(() => normalizeBackup(data)).toThrow();
  });

  it('conserva un vínculo desvinculado después de eliminar el movimiento', () => {
    const data = unlinkReceivableIncome(received(), { id: 'partial-october', reversedAt: '2026-10-18T12:01:00.000Z' }).data;
    data.transacciones = [];
    const restored = restoreAccountBackup(createAccountBackup(data, 'gairo'), 'gairo');
    expect(restored.receivables.allocations[0].reversedAt).toBe('2026-10-18T12:01:00.000Z');
    expect(restored.transacciones).toEqual([]);
  });

  it.each([null, { version: 2, items: [], allocations: [] }, { version: 1, items: [], allocations: null }])('rechaza libros corruptos o de versión futura: %j', value => {
    const data = emptyFinancialData('gairo'); data.receivables = value;
    expect(() => normalizeBackup(data)).toThrow();
    expect(data.receivables).toBe(value);
  });
});
