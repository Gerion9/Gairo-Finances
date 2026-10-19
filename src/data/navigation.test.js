import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildNavigationHash, CREDIT_LIBRARY_VIEWS, getPrimaryNavigationId, NAVIGATION_HUBS, NAVIGATION_ITEMS, NAVIGATION_SHORTCUTS, parseNavigationRoute, PRIMARY_NAVIGATION, TRANSACTION_VIEWS } from './navigation.js';
import ToolsDirectory from '../components/ToolsDirectory.jsx';

describe('Navigation route continuity', () => {
  it('keeps every existing destination available alongside the tools directory', () => {
    const routeIds = NAVIGATION_ITEMS.map(item => item.id);
    expect(new Set(routeIds).size).toBe(routeIds.length);
    expect(routeIds).toEqual(expect.arrayContaining([
      'dashboard', 'plan', 'debts', 'calendar', 'transactions', 'budget', 'statements',
      'balance', 'investments', 'simulator', 'health', 'assistant', 'calculators',
      'tax-annual', 'diagnostics', 'education', 'report', 'tools', 'credit-library',
    ]));
    expect(PRIMARY_NAVIGATION.map(item => item.id)).toEqual(['dashboard', 'plan', 'transactions', 'budget', 'balance', 'tools']);
  });

  it.each([
    ['plan', ['plan', 'debts', 'calendar', 'simulator']],
    ['transactions', ['transactions', 'statements']],
    ['balance', ['balance', 'investments', 'health', 'report']],
    ['tools', ['tools', 'credit-library', 'calculators', 'tax-annual', 'diagnostics', 'education']],
  ])('keeps %s selected across its related routes', (primaryId, routes) => {
    for (const route of routes) expect(getPrimaryNavigationId(route)).toBe(primaryId);
  });

  it('keeps independent destinations separate and recovers from an unknown route', () => {
    expect(getPrimaryNavigationId('budget')).toBe('budget');
    expect(getPrimaryNavigationId('assistant')).toBe('assistant');
    expect(getPrimaryNavigationId('dashboard')).toBe('dashboard');
    expect(getPrimaryNavigationId('unknown-route')).toBe('dashboard');
    expect(NAVIGATION_HUBS.some(hub => hub.tabs.includes('budget'))).toBe(false);
  });

  it('uses valid, unique routes in every contextual navigation group', () => {
    const routeIds = new Set(NAVIGATION_ITEMS.map(item => item.id));
    const hubRoutes = NAVIGATION_HUBS.flatMap(hub => hub.tabs);
    expect(new Set(hubRoutes).size).toBe(hubRoutes.length);
    for (const route of hubRoutes) expect(routeIds.has(route)).toBe(true);
  });

  it('exposes every financial destination in the directory without expanding a menu', () => {
    const markup = renderToStaticMarkup(createElement(ToolsDirectory));
    for (const route of NAVIGATION_ITEMS.filter(item => item.id !== 'tools')) {
      expect(markup).toContain(`<strong>${route.label}</strong>`);
    }
    expect(markup).toContain('Descargar respaldo');
    expect(markup).toContain('Exportar a Excel');
    expect(markup).toContain('Qué tarjeta usar');
  });

  it('offers plan reconciliation instead of a second debt list when a payment plan exists', () => {
    const markup = renderToStaticMarkup(createElement(ToolsDirectory, { hasPaymentPlan: true, readOnly: true }));
    expect(markup).toContain('Actualizar conciliación');
    expect(markup).not.toContain('Añadir una deuda');
    expect((markup.match(/disabled=""/g) || []).length).toBe(4);
    expect(markup).toContain('La edición está pausada');
    expect(markup).toContain('Cobros esperados');
  });
});

describe('Direct routes to expected income', () => {
  it.each(TRANSACTION_VIEWS)('restores %s from history without another primary destination', view => {
    expect(parseNavigationRoute(buildNavigationHash('transactions', { view }))).toMatchObject({ tab: 'transactions', view });
  });
  it('keeps legacy movement links and rejects views from a different module', () => {
    for (const hash of ['#transactions', '#/transactions', '#transactions?view=unknown', '#transactions?view=savings']) {
      expect(parseNavigationRoute(hash)).toMatchObject({ tab: 'transactions', view: 'registered' });
    }
    expect(parseNavigationRoute('#credit-library?view=expected').view).toBe('cards');
  });
  it('opens task shortcuts in the intended subview and searches by familiar terms', () => {
    const expected = NAVIGATION_SHORTCUTS.find(item => item.id === 'expected-income');
    const savings = NAVIGATION_SHORTCUTS.find(item => item.id === 'compare-savings');
    expect(buildNavigationHash(expected.tab, expected.options)).toBe('#transactions?view=expected');
    expect(buildNavigationHash(savings.tab, savings.options)).toBe('#credit-library?view=savings');
    for (const query of ['cobro', 'me deben', 'factura']) {
      const markup = renderToStaticMarkup(createElement(ToolsDirectory, { viewState: { query, goal: 'all' } }));
      expect(markup).toContain('<strong>Cobros esperados</strong>');
      expect(markup).not.toContain('No encontramos coincidencias');
    }
    const markup = renderToStaticMarkup(createElement(ToolsDirectory, { viewState: { query: 'cajitas', goal: 'grow' } }));
    expect(markup).toContain('<strong>Comparar opciones de ahorro</strong>');
  });
});

describe('Contextual financial product routes', () => {
  it.each(CREDIT_LIBRARY_VIEWS)('restores the %s view from a shareable history entry', view => {
    const hash = buildNavigationHash('credit-library', { view });
    expect(hash).toBe(`#credit-library?view=${view}`);
    expect(parseNavigationRoute(hash)).toEqual({ tab: 'credit-library', calculator: 'cat', panel: 'overview', view });
  });

  it('keeps legacy links valid and falls back to cards for unsupported views', () => {
    expect(buildNavigationHash('credit-library')).toBe('#credit-library');
    for (const hash of ['#credit-library', '#/credit-library', '#credit-library?view=unknown']) {
      expect(parseNavigationRoute(hash)).toMatchObject({ tab: 'credit-library', view: 'cards' });
    }
    expect(buildNavigationHash('credit-library', { view: 'unknown' })).toBe('#credit-library');
    expect(parseNavigationRoute('#unknown')).toMatchObject({ tab: 'dashboard' });
    expect(buildNavigationHash('unknown')).toBeNull();
  });

  it('preserves the existing plan panels and calculator deep links', () => {
    for (const panel of ['accounts', 'calendar', 'monthly', 'analysis', 'savings', 'transfers', 'data']) {
      expect(parseNavigationRoute(buildNavigationHash('plan', { panel })).panel).toBe(panel);
    }
    expect(buildNavigationHash('plan', { panel: 'overview' })).toBe('#plan');
    expect(parseNavigationRoute('#plan?panel=unknown').panel).toBe('overview');
    for (const calculator of ['cat', 'msi', 'rentVsBuy', 'rule503020']) {
      expect(parseNavigationRoute(buildNavigationHash('calculators', { calculator })).calculator).toBe(calculator);
    }
    expect(buildNavigationHash('calculators')).toBe('#calculators?tool=cat');
    expect(buildNavigationHash('transactions', { panel: 'data', view: 'purchase', calculator: 'msi' })).toBe('#transactions');
  });

  it('opens card choice through the existing library without adding a primary destination', () => {
    const shortcut = NAVIGATION_SHORTCUTS.find(item => item.id === 'choose-card');
    expect(shortcut.label).toBe('Qué tarjeta usar');
    expect(parseNavigationRoute(buildNavigationHash(shortcut.tab, shortcut.options))).toMatchObject({ tab: 'credit-library', view: 'purchase' });
    expect(NAVIGATION_ITEMS.find(item => item.id === 'credit-library').label).toBe('Explorar productos financieros');
    expect(PRIMARY_NAVIGATION.some(item => item.id === shortcut.id)).toBe(false);
  });
});
