import { describe, expect, it } from 'vitest';
import { normalizeBackup } from './backup.js';
import { INITIAL_DATA } from './fixtures/legacyData.js';

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
