import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Writable } from 'node:stream';
import React from 'react';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import CreditLibrary from '../components/CreditLibrary.jsx';
import { emptyFinancialData } from './accountData.js';
import { emptyMarketSelections, normalizeMarketSelections, updateMarketSelections } from './marketPreferences.js';
import { WorkspaceSync } from './workspaceSync.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function renderVisitedView(props) {
  return new Promise((resolve, reject) => {
    let markup = '';
    const destination = new Writable({ write(chunk, encoding, done) { markup += chunk.toString(); done(); } });
    destination.on('finish', () => resolve(markup));
    const stream = renderToPipeableStream(React.createElement(CreditLibrary, props), {
      onAllReady() { stream.pipe(destination); },
      onError: reject,
    });
  });
}

describe('Selecciones privadas del mercado', () => {
  it('lee un documento antiguo sin materializar ni guardar preferencias', () => {
    const data = emptyFinancialData('gairo');
    const before = JSON.stringify(data);
    expect(normalizeMarketSelections(data.preferences.marketSelections)).toEqual(emptyMarketSelections());
    expect(JSON.stringify(data)).toBe(before);
    expect(Object.hasOwn(data.preferences, 'marketSelections')).toBe(false);
  });

  it('crea listas independientes para cada espacio', () => {
    const first = emptyMarketSelections();
    const second = emptyMarketSelections();
    first.ownedCardIds.push('nu-credito');
    expect(second.ownedCardIds).toEqual([]);
  });

  it('deduplica en orden sin descartar productos que ya no están en el catálogo', () => {
    const original = { version: 1, ownedCardIds: ['legacy-card', 'nu-credito', 'legacy-card'], savingsProductIds: ['retired-saving', 'nu-cajita', 'retired-saving'] };
    const result = normalizeMarketSelections(original);
    expect(result).toEqual({ version: 1, ownedCardIds: ['legacy-card', 'nu-credito'], savingsProductIds: ['retired-saving', 'nu-cajita'] });
    expect(original.ownedCardIds).toHaveLength(3);
    expect(result.ownedCardIds).not.toBe(original.ownedCardIds);
  });

  it.each([null, [], 'invalid', {}, { version: 2, ownedCardIds: [], savingsProductIds: [] }, { version: '1', ownedCardIds: [], savingsProductIds: [] }, { version: 1, ownedCardIds: [] }, { version: 1, savingsProductIds: [] }, { version: 1, ownedCardIds: [], savingsProductIds: [], extra: true }])('rechaza un documento incompatible sin convertirlo en vacío: %j', value => {
    expect(() => normalizeMarketSelections(value)).toThrow();
  });

  it.each(['', '  ', 42, null, 'a'.repeat(121)])('rechaza identificadores inválidos: %j', id => {
    expect(() => normalizeMarketSelections({ ...emptyMarketSelections(), ownedCardIds: [id] })).toThrow();
    expect(() => normalizeMarketSelections({ ...emptyMarketSelections(), savingsProductIds: [id] })).toThrow();
  });

  it('acepta los límites técnicos y rechaza excederlos sin recortar datos', () => {
    const cards = Array.from({ length: 500 }, (_, index) => `card-${index}`);
    expect(normalizeMarketSelections({ version: 1, ownedCardIds: cards, savingsProductIds: ['a', 'b', 'c'] }).ownedCardIds).toHaveLength(500);
    expect(() => normalizeMarketSelections({ version: 1, ownedCardIds: [...cards, 'overflow'], savingsProductIds: [] })).toThrow();
    expect(() => normalizeMarketSelections({ version: 1, ownedCardIds: [], savingsProductIds: ['a', 'b', 'c', 'd'] })).toThrow();
    expect(normalizeMarketSelections({ version: 1, ownedCardIds: [], savingsProductIds: ['a', 'a', 'b', 'c'] }).savingsProductIds).toEqual(['a', 'b', 'c']);
  });

  it('fusiona cada cambio sobre los datos previos sin perder cambio manual u otras preferencias', () => {
    const original = emptyFinancialData('gairo');
    original.preferences = { manualRate: 18.5, manualRateUpdatedAt: '2026-10-18T12:00:00Z', futurePreference: { enabled: true } };
    const withCards = updateMarketSelections(original, { ownedCardIds: ['nu-credito'] });
    const withSavings = updateMarketSelections(withCards, { savingsProductIds: ['nu-cajita'] });
    expect(withSavings.preferences).toMatchObject({ manualRate: 18.5, manualRateUpdatedAt: '2026-10-18T12:00:00Z', futurePreference: { enabled: true }, marketSelections: { ownedCardIds: ['nu-credito'], savingsProductIds: ['nu-cajita'] } });
    expect(withSavings.transacciones).toBe(original.transacciones);
    expect(original.preferences).not.toHaveProperty('marketSelections');
    expect(updateMarketSelections(original, {})).toBe(original);
  });

  it('permite quitar un producto desconocido y no cambia otro espacio', () => {
    const first = updateMarketSelections(emptyFinancialData('gairo'), { ownedCardIds: ['retired-card'], savingsProductIds: ['retired-saving'] });
    const second = emptyFinancialData('ricardo');
    const result = updateMarketSelections(first, { ownedCardIds: [] });
    expect(result.preferences.marketSelections).toEqual({ version: 1, ownedCardIds: [], savingsProductIds: ['retired-saving'] });
    expect(second.preferences).not.toHaveProperty('marketSelections');
    expect(first.preferences.marketSelections.ownedCardIds).toEqual(['retired-card']);
  });

  it.each([{ version: 2 }, { manualRate: 20 }, { purchase: {} }, { conditions: {} }, { caps: {} }, { ownedCardIds: null }, null, []])('rechaza parches fuera del contrato: %j', patch => {
    expect(() => updateMarketSelections(emptyFinancialData('gairo'), patch)).toThrow();
  });

  it('no reemplaza una versión futura ni preferencias corruptas al modificar una lista', () => {
    const data = emptyFinancialData('gairo');
    data.preferences.marketSelections = { version: 2, ownedCardIds: ['future-card'], savingsProductIds: [] };
    expect(() => updateMarketSelections(data, { savingsProductIds: ['nu-cajita'] })).toThrow();
    expect(data.preferences.marketSelections.version).toBe(2);
    expect(() => updateMarketSelections({ ...data, preferences: [] }, { ownedCardIds: [] })).toThrow();
  });

  it('hidrata sin enviar cambios y usa la cola de sincronización del espacio al editar', async () => {
    vi.useFakeTimers(); vi.stubGlobal('crypto', webcrypto);
    const saved = updateMarketSelections(emptyFinancialData('gairo'), { ownedCardIds: ['nu-credito'] });
    const request = vi.fn(async (path, options) => options.method ? {
      mutationId: options.body.mutationId, acceptedRevision: options.body.baseRevision + 1, currentRevision: options.body.baseRevision + 1,
    } : { financialData: saved, revision: 2 });
    const sync = new WorkspaceSync('gairo', { request });
    try {
      await sync.load();
      expect(normalizeMarketSelections(sync.snapshot().data.preferences.marketSelections).ownedCardIds).toEqual(['nu-credito']);
      await vi.advanceTimersByTimeAsync(500);
      expect(request).toHaveBeenCalledTimes(1);
      sync.edit(updateMarketSelections(sync.snapshot().data, { savingsProductIds: ['nu-cajita'] }));
      await vi.advanceTimersByTimeAsync(500);
      expect(request).toHaveBeenCalledTimes(2);
      const options = request.mock.calls[1][1];
      expect(options.accountId).toBe('gairo');
      expect(options.body.financialData.preferences.marketSelections).toEqual({ version: 1, ownedCardIds: ['nu-credito'], savingsProductIds: ['nu-cajita'] });
      expect(sync.snapshot()).toMatchObject({ status: 'saved', revision: 3, dirty: false });
      sync.status = 'conflict';
      expect(() => sync.edit(updateMarketSelections(saved, { ownedCardIds: [] }))).toThrow();
    } finally { sync.dispose(); }
  });

  it('conecta ambas selecciones al visitar sus vistas y bloquea su edición sin bloquear la consulta pública', async () => {
    const change = vi.fn();
    const props = {
      readOnly: true, onMarketSelectionsChange: change,
      marketSelections: { version: 1, ownedCardIds: ['retired-card'], savingsProductIds: ['actinver-trade-actiren'] },
    };
    const savingsMarkup = await renderVisitedView({ ...props, requestedView: 'savings' });
    expect(savingsMarkup).not.toContain('retired-card');
    expect(/type="checkbox"[^>]*disabled=""[^>]*checked=""/.test(savingsMarkup)).toBe(true);
    const purchaseMarkup = await renderVisitedView({ ...props, requestedView: 'purchase' });
    expect(purchaseMarkup).toContain('retired-card');
    expect(purchaseMarkup).toContain('Producto ya no disponible en el catálogo');
    expect(/<button[^>]*disabled=""[^>]*aria-label="Quitar [^"]*de tus tarjetas disponibles"/.test(purchaseMarkup)).toBe(true);
    const comparisonSubmit = purchaseMarkup.match(/<button[^>]*class="card-choice-submit"[^>]*>/)?.[0];
    expect(comparisonSubmit).toBeDefined();
    expect(comparisonSubmit).not.toContain('disabled');
    expect(change).not.toHaveBeenCalled();
  });

  it('rechaza preferencias corruptas en la integración sin emitir un reemplazo vacío', () => {
    const change = vi.fn();
    expect(() => renderToStaticMarkup(React.createElement(CreditLibrary, {
      marketSelections: { version: 2, ownedCardIds: ['future-card'], savingsProductIds: [] },
      onMarketSelectionsChange: change,
    }))).toThrow('versión');
    expect(change).not.toHaveBeenCalled();
  });
});
