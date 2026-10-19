import { describe, expect, it } from 'vitest';
import { NAVIGATION_ITEMS, NAVIGATION_SHORTCUTS } from '../data/navigation.js';
import { searchNavigationItems } from './navigationSearch.js';

const items = [...NAVIGATION_ITEMS, ...NAVIGATION_SHORTCUTS];
describe('Task-oriented navigation search', () => {
  it('prioritizes the requested page over words spread across unrelated descriptions', () => {
    expect(searchNavigationItems(items, 'plan de pagos')[0].id).toBe('plan');
    expect(searchNavigationItems(items, '  PLAN   de PAGOS  ')[0].id).toBe('plan');
  });
  it.each(['cobro', 'cobrar', 'me deben', 'factura', 'pago parcial'])('finds expected income from %s', query => {
    expect(searchNavigationItems(items, query).map(item => item.id)).toContain('expected-income');
  });
  it.each(['cajitas', 'cuenta remunerada', 'cetes'])('finds the savings comparison from %s', query => {
    expect(searchNavigationItems(items, query).map(item => item.id)).toContain('compare-savings');
  });
  it('normalizes accents and keeps the curated order for empty or equal matches', () => {
    expect(searchNavigationItems(items, 'que tarjeta usar')[0].id).toBe('choose-card');
    expect(searchNavigationItems(items, '')).toEqual(items);
    expect(searchNavigationItems(items, 'nada-coincide-aqui')).toEqual([]);
  });
});
