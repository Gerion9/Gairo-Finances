import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SavingsCatalog from '../components/SavingsCatalog.jsx';
import {
  buildSavingsComparison, filterSavingsProducts, formatSavingsReturn, orderedSavingsReturns, previewSavingsReturns, savingsReturnGroup,
  savingsReturnSources, savingsReturnStatus, savingsSources, selectedSavingsProducts, toggleSavingsComparison,
} from './savingsCatalog.js';

// Synthetic test records only. These are not documented financial products.
const observation = (id, nature, percent, unit = '% anual') => ({ id, label: `Test ${id}`, nature, percent, unit, rateType: 'Test gross rate', conditions: 'Test condition', asOf: '2026-10-01', validThrough: '2026-10-18', sources: [{ title: 'Test rate document', url: `https://example.test/${id}.pdf` }] });
const products = [
  { id: 'z', name: 'Zeta fund', issuer: 'Test issuer', legalIssuer: 'Entidad Ejemplo', productType: 'Test fund', liquidity: { category: 'mixed', summary: 'Test availability' }, hasDetailedSheet: true, canonicalUrl: 'https://example.test/z', returns: [observation('promo', 'promotion', 12), observation('base', 'base', 5), observation('real', 'gat', -0.3)], amounts: [], fees: [], requirements: [], protection: { label: 'Test fund protection', summary: 'Not a deposit guarantee' }, aliases: ['Inversión'], consultedOn: '2026-10-18' },
  { id: 'a', name: 'Ágil account', issuer: 'Other issuer', productType: 'Test account', hasDetailedSheet: false, returns: [], aliases: ['Cajita'], protection: { label: 'Test deposit protection', summary: 'Test scope and limits' } },
];

describe('Savings observations preserve their meaning', () => {
  it('keeps zero, negative real GAT and the literal unit distinct from unknown values', () => {
    expect(formatSavingsReturn({ percent: 0, unit: '% anual' })).toBe('0 % anual');
    expect(formatSavingsReturn({ percent: -0.3, unit: '% real anual' })).toBe('-0.3 % real anual');
    expect(formatSavingsReturn({ percent: 5.12345, unit: '% nominal' })).toBe('5.12345 % nominal');
    expect(formatSavingsReturn({ percent: null, unit: '%' })).toBe('Por verificar');
    expect(formatSavingsReturn({ percent: '0', unit: '%' })).toBe('Por verificar');
    expect(formatSavingsReturn({ percent: NaN })).toBe('Por verificar');
  });
  it('orders base before promotions without sorting by percentage or changing GAT labels', () => {
    const input = [observation('historical', 'historical', 100), observation('promo', 'promotion', 12), observation('nominal', 'gat', 9), observation('base', 'base', 5), observation('real', 'gat', -0.3)];
    expect(orderedSavingsReturns(input).map(value => value.id)).toEqual(['base', 'promo', 'nominal', 'real', 'historical']);
    expect(input[0].id).toBe('historical');
  });
  it('keeps the deadline inclusive and marks expired or unconfirmed dates honestly', () => {
    const value = observation('base', 'base', 5);
    expect(savingsReturnStatus(value, '2026-10-18').code).toBe('dated');
    expect(savingsReturnStatus(value, '2026-10-19').code).toBe('expired');
    expect(savingsReturnStatus({ validThrough: null }, '2026-10-18').code).toBe('unknown');
    expect(savingsReturnStatus({ validThrough: '2026-02-30' }, '2026-01-01').code).toBe('unknown');
    expect(savingsReturnStatus({ asOf: '2026-11-01', validThrough: '2026-12-01' }, '2026-10-18').code).toBe('future');
  });
});

describe('Savings discovery and comparison', () => {
  it('searches aliases and the legal entity without accents and sorts alphabetically', () => {
    expect(filterSavingsProducts(products).map(product => product.id)).toEqual(['a', 'z']);
    expect(filterSavingsProducts(products, { query: 'inversion entidad ejemplo' }).map(product => product.id)).toEqual(['z']);
    expect(filterSavingsProducts(products, { query: 'cajita' }).map(product => product.id)).toEqual(['a']);
  });
  it('combines type, availability and coverage filters without assuming liquidity', () => {
    expect(filterSavingsProducts(products, { productType: 'Test fund', liquidity: 'mixed', information: 'sheet' }).map(product => product.id)).toEqual(['z']);
    expect(filterSavingsProducts(products, { liquidity: 'unknown', information: 'identified' }).map(product => product.id)).toEqual(['a']);
    expect(filterSavingsProducts(products, { liquidity: 'demand' })).toHaveLength(0);
  });
  it('caps selection at three without replacing entries and keeps it independent of filters', () => {
    const ids = ['z', 'a', 'third'];
    expect(toggleSavingsComparison(ids, 'fourth')).toEqual({ ids, reason: 'limit' });
    expect(toggleSavingsComparison(ids, 'a')).toEqual({ ids: ['z', 'third'], reason: null });
    expect(selectedSavingsProducts(products, ['z', 'a']).map(product => product.id)).toEqual(['z', 'a']);
    expect(filterSavingsProducts(products, { query: 'Zeta' })).toHaveLength(1);
    expect(ids).toEqual(['z', 'a', 'third']);
  });
  it('compares equivalent attributes without merging protections or converting unknown costs to zero', () => {
    const comparison = buildSavingsComparison(products, ['z', 'a'], '2026-10-19');
    expect(comparison.rows.map(row => row.id)).toEqual(['liquidity', 'amounts', 'fees', 'requirements', 'protection', 'returns-base', 'returns-promotion', 'returns-gat-nominal', 'returns-gat-real', 'returns-historical', 'returns-other', 'type', 'entity', 'sources']);
    const protection = comparison.rows.find(row => row.id === 'protection');
    expect(protection.values[0].lines).toContain('Not a deposit guarantee');
    expect(protection.values[1].lines).toContain('Test scope and limits');
    const returns = comparison.rows.find(row => row.id === 'returns-base');
    expect(returns.values[0].observations.map(value => value.id)).toEqual(['base']);
    expect(returns.values[0].lines).toContain('Vigencia vencida');
    expect(returns.values[1].lines).toEqual(['Sin observaciones documentadas para este concepto. No significa un rendimiento de cero.']);
    expect(comparison.rows.find(row => row.id === 'fees').values[0].lines).toEqual(['Por documentar en la fuente del producto.']);
  });
});

describe('Savings source validation', () => {
  it('accepts only HTTPS sources and deduplicates without losing exact return evidence', () => {
    const product = { ...products[0], evidence: [{ title: 'Unsafe', url: 'javascript:alert(1)' }, { title: 'HTTP', url: 'http://example.test/insecure' }, { title: 'Duplicate', url: 'https://example.test/z' }] };
    expect(savingsSources(product).map(value => value.url)).toEqual(['https://example.test/z', 'https://example.test/promo.pdf', 'https://example.test/base.pdf', 'https://example.test/real.pdf']);
    expect(savingsReturnSources(product.returns[0], product)[0].url).toBe('https://example.test/promo.pdf');
  });
  it('never silently replaces invalid exact evidence with a different product document', () => {
    expect(savingsReturnSources({ sources: [{ url: 'http://example.test/rate' }] }, products[0])).toEqual([]);
    expect(savingsReturnSources({}, products[0])).toEqual(savingsSources(products[0]));
  });
});

describe('Savings comparison groups and previews', () => {
  it('uses exact GAT units and preserves every observation, including unfamiliar units and kinds', () => {
    const observations = [
      observation('nominal', 'gat', 7, '% GAT nominal'),
      observation('real', 'gat', -1, '% GAT real'),
      observation('other-gat', 'gat', 5, '% real anual'),
      observation('misleading-label', 'gat', 6, '% GAT real anual'),
      observation('spacing', 'gat', 6, '% GAT nominal '),
      observation('base', 'base', null, 'Fórmula publicada'),
      observation('promotion', 'promotion', 12),
      observation('historical', 'historical', 4),
      observation('unknown-kind', 'future-kind', 8, 'Unidad nueva'),
    ];
    const entry = { ...products[0], returns: observations };
    const before = JSON.stringify(entry);
    const rows = buildSavingsComparison([entry], [entry.id], '2026-10-18').rows;
    const ids = group => rows.find(row => row.id === group).values[0].observations.map(value => value.id);
    expect(ids('returns-gat-nominal')).toEqual(['nominal']);
    expect(ids('returns-gat-real')).toEqual(['real']);
    expect(ids('returns-other')).toEqual(['other-gat', 'misleading-label', 'spacing', 'unknown-kind']);
    expect(ids('returns-base')).toEqual(['base']);
    const returned = rows.flatMap(row => row.values[0].observations || []);
    expect(returned).toHaveLength(observations.length);
    expect(new Set(returned.map(value => value.id))).toEqual(new Set(observations.map(value => value.id)));
    expect(JSON.stringify(entry)).toBe(before);
    expect(savingsReturnGroup({ nature: 'base', unit: '% GAT real' })).toBe('returns-base');
  });

  it('previews current base and promotion in source order, never the largest figure', () => {
    const old = { ...observation('expired', 'promotion', 99), validThrough: '2026-10-17' };
    const base = { ...observation('base', 'base', null), validThrough: null };
    const firstPromo = observation('first-promo', 'promotion', 5);
    const higherPromo = observation('higher-promo', 'promotion', 15);
    const observations = [old, firstPromo, higherPromo, base];
    expect(previewSavingsReturns(observations, '2026-10-18').map(value => value.id)).toEqual(['base', 'first-promo']);
    expect(observations[0]).toBe(old);
    expect(previewSavingsReturns([old], '2026-10-18')).toEqual([old]);
    expect(savingsReturnStatus(previewSavingsReturns([old], '2026-10-18')[0], '2026-10-18').code).toBe('expired');
    expect(previewSavingsReturns([observation('history', 'historical', 2)], '2026-10-18')[0].nature).toBe('historical');
  });

  it('retains unavailable selected products and counts them toward the comparison limit', () => {
    const ids = ['z', 'removed', 'a'];
    const selected = selectedSavingsProducts(products, ids);
    expect(selected.map(product => product.id)).toEqual(ids);
    expect(selected[1]).toMatchObject({ unavailable: true, name: 'Producto ya no disponible en el catálogo' });
    expect(toggleSavingsComparison(ids, 'new')).toEqual({ ids, reason: 'limit' });
    expect(toggleSavingsComparison(ids, 'removed').ids).toEqual(['z', 'a']);
    const compared = buildSavingsComparison(products, ids, '2026-10-18');
    expect(compared.entries).toHaveLength(3);
    expect(compared.rows.find(row => row.id === 'returns-base').values[1].observations).toEqual([]);
    expect(compared.rows.find(row => row.id === 'liquidity').values[1].lines).toContain('Este producto seleccionado ya no está disponible en el catálogo actual.');
  });
});

describe('Savings catalog rendered disclosure contract', () => {
  it('renders full conditions and all distinct exact sources, with a controlled read-only selection', () => {
    const fullCondition = 'Complete eligibility condition with a membership requirement and an amount limit.';
    const fees = ['Membresía de prueba: $199 MXN al mes, sujeta a las condiciones documentadas.', 'Cargo de prueba por un servicio adicional: consulta el importe y las exenciones publicados.'];
    const entry = {
      ...products[0], availability: 'Only after issuer eligibility review.',
      fees,
      returns: [{ ...observation('base', 'base', 5), conditions: fullCondition,
        sources: [{ title: 'First exact source', url: 'https://example.test/first' }, { title: 'Second exact source', url: 'https://example.test/second' }] }],
    };
    const changes = [];
    const markup = renderToStaticMarkup(React.createElement(SavingsCatalog, {
      catalog: { products: [entry], reviewedOn: '2026-10-18' },
      selectedIds: ['z'], onSelectedIdsChange: ids => changes.push(ids), readOnly: true,
    }));
    expect(markup).toContain(fullCondition);
    expect(markup).toContain('First exact source');
    expect(markup).toContain('Second exact source');
    expect(markup).toContain('Only after issuer eligibility review.');
    expect(markup).toContain('Fuentes y fechas');
    expect(markup).toMatch(/type="checkbox"[^>]*disabled=""[^>]*checked=""/);
    expect(markup).toMatch(/<button[^>]*aria-label="Ver ficha de Zeta fund"/);
    const productRow = markup.slice(markup.indexOf('savings-product-list'));
    expect(productRow.indexOf(fullCondition)).toBeLessThan(productRow.indexOf('Disponibilidad del dinero'));
    expect(productRow.indexOf('Disponibilidad para contratar')).toBeLessThan(productRow.indexOf(fullCondition));
    expect(productRow).toContain('Costos y membresía');
    for (const fee of fees) expect(productRow).toContain(fee);
    expect(changes).toEqual([]);
  });

  it('keeps undocumented costs explicit instead of implying a free product', () => {
    for (const fees of [[], undefined]) {
      const markup = renderToStaticMarkup(React.createElement(SavingsCatalog, { catalog: { products: [{ ...products[0], fees }] } }));
      expect(markup).toContain('Costos y membresía por verificar en la fuente del producto.');
      expect(markup).not.toContain('Sin costo');
      expect(markup).not.toContain('Gratis');
    }
  });
});
