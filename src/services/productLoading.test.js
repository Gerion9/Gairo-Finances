import { describe, expect, it, vi } from 'vitest';
import { createElement, Suspense } from 'react';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import { Writable } from 'node:stream';
import ProductViewLoader from '../components/ProductViewLoader.jsx';
import { captureProductFocusIntent, createProductViewResource } from '../components/ProductViewLoader.js';
import { savingsMarketCoverage } from '../data/marketCoverage.js';
import { mexicoSavingsCatalog } from '../data/mexicoSavingsCatalog.js';

function renderResolvedView(View) {
  return new Promise(resolve => {
    let html = '';
    const errors = [];
    const destination = new Writable({ write(chunk, encoding, done) { html += chunk.toString(); done(); } });
    destination.on('finish', () => resolve({ html, errors }));
    const stream = renderToPipeableStream(createElement(Suspense, { fallback: 'Cargando' }, createElement(View)), {
      onAllReady() { stream.pipe(destination); },
      onError(error) { errors.push(error); },
    });
  });
}

describe('Deferred product views', () => {
  it('does not request a module before the view is first active', async () => {
    const importer = vi.fn(() => Promise.resolve({ default: () => createElement('p', null, 'Opciones') }));
    const resource = createProductViewResource(importer);
    const markup = renderToStaticMarkup(createElement(ProductViewLoader, { resource, active: false, loadingLabel: 'Cargando opciones de ahorro…' }));
    await Promise.resolve();
    expect(markup).toBe('');
    expect(importer).not.toHaveBeenCalled();
  });

  it('keeps loading local and announces it without exposing decorative skeletons', async () => {
    let finish;
    const importer = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const resource = createProductViewResource(importer);
    const markup = renderToStaticMarkup(createElement(ProductViewLoader, { resource, active: true, loadingLabel: 'Cargando opciones de ahorro…' }));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Cargando opciones de ahorro…');
    expect(markup).toContain('aria-hidden="true"');
    await Promise.resolve();
    expect(importer).toHaveBeenCalledTimes(1);
    finish({ default: () => createElement('p', null, 'Opciones') });
    await resource.load();
  });

  it('retries a rejected import with a fresh lazy view and reuses successful code', async () => {
    const unavailable = new Error('Module request unavailable');
    const importer = vi.fn()
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValue({ default: () => createElement('p', null, 'Opciones recuperadas') });
    const resource = createProductViewResource(importer);
    const failed = await renderResolvedView(resource.createAttempt());
    expect(failed.errors).toEqual([unavailable]);
    const recovered = await renderResolvedView(resource.createAttempt());
    expect(recovered.errors).toEqual([]);
    expect(recovered.html).toContain('Opciones recuperadas');
    const returned = await renderResolvedView(resource.createAttempt());
    expect(returned.html).toContain('Opciones recuperadas');
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('deduplicates a pending request and keeps another panel available after failure', async () => {
    const purchaseModule = { default: () => createElement('p', null, 'Compra') };
    const purchaseImporter = vi.fn().mockResolvedValue(purchaseModule);
    const purchase = createProductViewResource(purchaseImporter);
    const first = purchase.load();
    expect(purchase.load()).toBe(first);
    const savings = createProductViewResource(() => Promise.reject(new Error('Savings request unavailable')));
    await expect(savings.load()).rejects.toThrow('Savings request unavailable');
    await expect(first).resolves.toBe(purchaseModule);
    await expect(purchase.load()).resolves.toBe(purchaseModule);
    expect(purchaseImporter).toHaveBeenCalledTimes(1);
  });
});

describe('Deferred focus intent', () => {
  const ownerDocument = () => Object.assign(new EventTarget(), { activeElement: {}, body: {}, documentElement: {} });
  const moveFocus = (document, target) => {
    document.activeElement = target;
    const event = new Event('focusin');
    Object.defineProperty(event, 'target', { value: target });
    document.dispatchEvent(event);
  };

  it('allows an intent while the initiating control stays focused or is removed', () => {
    const document = ownerDocument();
    const intent = captureProductFocusIntent(document);
    moveFocus(document, document.activeElement);
    moveFocus(document, document.body);
    expect(intent.isCurrent()).toBe(true);
    intent.cancel();
    expect(intent.isCurrent()).toBe(false);
  });

  it('does not revive focus after the person moved to another control and back', () => {
    const document = ownerDocument();
    const origin = document.activeElement;
    const intent = captureProductFocusIntent(document);
    moveFocus(document, {});
    moveFocus(document, origin);
    expect(intent.isCurrent()).toBe(false);
    intent.cancel();
  });

  it('supports rendering without a browser document', () => {
    expect(captureProductFocusIntent(undefined)).toBeNull();
  });
});

describe('Lightweight savings coverage', () => {
  it('matches the authoritative catalog without importing it into the library header', () => {
    expect(savingsMarketCoverage).toEqual({
      reviewedOn: mexicoSavingsCatalog.reviewedOn,
      identifiedProducts: mexicoSavingsCatalog.products.length,
      detailedProducts: mexicoSavingsCatalog.products.filter(product => product.hasDetailedSheet).length,
    });
  });
});
