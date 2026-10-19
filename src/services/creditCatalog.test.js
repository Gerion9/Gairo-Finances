import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CreditLibrary from '../components/CreditLibrary.jsx';
import { cardBenefitPrograms } from '../data/cardBenefits.js';
import { creditCatalog } from '../data/creditCatalog.js';
import {
  annualFeeClass, benefitProgramMetadata, buildCardComparison, catalogBenefitPrograms, catalogBenefitStrings, catalogPage, catalogSources, costSources, datedCostStatus,
  enrichCatalogEntries, filterCreditCards, filterCreditLoans, formatCatalogMoney, formatCatalogPercent, isCatalogDate,
  formatCatalogRate, hasDocumentedBenefits, hasDocumentedCosts, openingFeeLines, periodicFeeLines, selectedCreditCards, toggleCardComparison,
} from './creditCatalog.js';

// Synthetic unit-test records only. These are not public product data.
const fixtureCard = (id, name, issuer, classification, amount) => ({
  id, entryType: 'card', name, issuer, canonicalUrl: `https://example.test/${id}`, consultedOn: '2026-10-18', currency: 'MXN',
  costs: { annualFee: { amount, classification, taxTreatment: 'Test tax treatment', conditions: 'Test condition' },
    cat: { percent: 0, asOf: '2026-10-01', validThrough: '2026-10-18' },
    interestRate: { percent: null, label: 'Test published rate', asOf: null, validThrough: null } },
  requirements: [], otherFees: [], limitations: [], evidence: [],
});
const cards = [
  fixtureCard('z', 'Zeta', 'Emisor Uno', 'annual', 500),
  fixtureCard('a', 'Ágil', 'Emisor Dos', 'none', 0),
  fixtureCard('b', 'Básica', 'Emisor Uno', 'conditional', 500),
  fixtureCard('n', 'Nube', 'Emisor Dos', 'unknown', null),
];

describe('Credit catalog field provenance', () => {
  const source = (title, file) => ({ title, url: `https://example.test/documents/${file}.pdf` });
  const fieldCard = {
    ...cards[0],
    costs: {
      annualFee: { ...cards[0].costs.annualFee, sources: [source('Test fee schedule', 'fees')] },
      cat: { ...cards[0].costs.cat, taxTreatment: 'Sin IVA', sources: [source('Test CAT brochure', 'cat')] },
      interestRate: { ...cards[0].costs.interestRate, sources: [source('Test rate terms', 'rate')] },
    },
    evidence: [source('Test general terms', 'terms')],
  };

  it('links each comparison cost to its exact document instead of the product landing page', () => {
    expect(costSources(fieldCard.costs.cat, fieldCard)).toEqual([source('Test CAT brochure', 'cat')]);
    const rows = buildCardComparison([fieldCard], [fieldCard.id], '2026-10-18').rows;
    for (const field of ['annualFee', 'cat', 'interestRate']) {
      expect(rows.find(row => row.id === field).values[0].sources).toEqual(fieldCard.costs[field].sources);
      expect(rows.find(row => row.id === field).values[0].sources[0].url).not.toBe(fieldCard.canonicalUrl);
    }
  });

  it('rejects invalid field URLs without falling back to unrelated general evidence', () => {
    const invalid = { sources: [{ title: 'Unsafe', url: 'javascript:alert(1)' }, { title: 'Invalid', url: 'not a URL' }, null] };
    expect(costSources(invalid, fieldCard)).toEqual([]);
    expect(costSources({ sources: [...invalid.sources, source('Test valid PDF', 'verified'), source('Test duplicate', 'verified')] }, fieldCard))
      .toEqual([source('Test valid PDF', 'verified')]);
  });

  it('retains the legacy fallback when field evidence is absent', () => {
    expect(costSources(cards[0].costs.cat, cards[0])).toEqual(catalogSources(cards[0]));
    expect(costSources({ sources: [] }, cards[0])).toEqual(catalogSources(cards[0]));
    expect(costSources(undefined, cards[0])[0].url).toBe(cards[0].canonicalUrl);
  });

  it('keeps the complete source list while deduplicating field evidence', () => {
    const complete = catalogSources({ ...fieldCard, evidence: [...fieldCard.evidence, ...fieldCard.costs.cat.sources] });
    expect(complete.map(item => item.url)).toEqual([
      fieldCard.canonicalUrl, source('', 'terms').url, source('', 'cat').url,
      source('', 'fees').url, source('', 'rate').url,
    ]);
    expect(buildCardComparison([fieldCard], [fieldCard.id]).rows.find(row => row.id === 'sources').values[0].sources)
      .toEqual(catalogSources(fieldCard));
  });

  it('shows documented tax treatment beside the value without inferring it for missing observations', () => {
    const comparison = buildCardComparison([fieldCard, cards[1]], [fieldCard.id, cards[1].id], '2026-10-18');
    const cat = comparison.rows.find(row => row.id === 'cat');
    expect(cat.values[0].lines.slice(0, 2)).toEqual(['0%', 'Sin IVA']);
    expect(cat.values[1].lines).not.toContain('Sin IVA');
    const rate = comparison.rows.find(row => row.id === 'interestRate');
    expect(rate.values[0].lines[0]).toBe(fieldCard.costs.interestRate.label);
    expect(rate.values[0].lines).toContain('Sin dato documentado');
    expect(rate.values[0].lines).not.toContain('Sin IVA');
  });
});
describe('Credit catalog publication validity', () => {
  it('includes the last published validity date and expires the following day', () => {
    const cost = { asOf: '2026-10-01', validThrough: '2026-10-18', status: 'current' };
    expect(datedCostStatus(cost, '2026-10-18').code).toBe('dated');
    expect(datedCostStatus(cost, '2026-10-19').code).toBe('expired');
  });
  it('does not infer validity from a supplied label or a consultation date', () => {
    expect(datedCostStatus({ status: 'current', consultedOn: '2026-10-18' }, '2026-10-18').code).toBe('unknown');
    expect(datedCostStatus({ validThrough: null }, '2026-10-18').label).toBe('Vigencia por verificar');
  });
  it('rejects impossible dates and identifies future calculation dates', () => {
    expect(isCatalogDate('2026-02-29')).toBe(false);
    expect(isCatalogDate('2024-02-29')).toBe(true);
    expect(datedCostStatus({ validThrough: '2026-02-31' }, '2026-02-01').code).toBe('unknown');
    expect(datedCostStatus({ asOf: '2026-11-01', validThrough: '2026-12-31' }, '2026-10-18').code).toBe('future');
  });
});

describe('Credit catalog unknown values and classifications', () => {
  it('preserves confirmed zero instead of treating it as missing', () => {
    expect(formatCatalogPercent(0)).toBe('0%');
    expect(formatCatalogMoney(0)).toContain('$0.00');
    expect(formatCatalogPercent(null)).toBe('Por verificar');
    expect(formatCatalogMoney(null)).toBe('Por verificar');
    expect(formatCatalogMoney('0')).toBe('Por verificar');
    expect(formatCatalogPercent(NaN)).toBe('Por verificar');
  });
  it('uses declared fee conditions rather than guessing from a zero amount', () => {
    expect(annualFeeClass({ amount: 0, classification: 'conditional' })).toBe('conditional');
    expect(annualFeeClass({ amount: 0 })).toBe('unknown');
    expect(annualFeeClass({ amount: null, classification: 'unknown' })).toBe('unknown');
  });
  it('formats opening charges using only their declared unit', () => {
    expect(openingFeeLines({ amount: 2, unit: '%' })[0]).toBe('2%');
    expect(openingFeeLines({ amount: 0, unit: 'MXN' })[0]).toContain('$0.00');
    expect(openingFeeLines({ amount: null, unit: '%' })[0]).toBe('Por verificar');
    expect(openingFeeLines({ amount: 2 })[0]).toContain('unidad por verificar');
  });
});

describe('Credit catalog discovery and comparison', () => {
  it('searches name and issuer without accents and sorts by name without mutating records', () => {
    const baseline = JSON.stringify(cards);
    expect(filterCreditCards(cards).map(card => card.id)).toEqual(['a', 'b', 'n', 'z']);
    expect(filterCreditCards(cards, { query: 'agil EMISOR dos' }).map(card => card.id)).toEqual(['a']);
    expect(JSON.stringify(cards)).toBe(baseline);
  });
  it('combines issuer and annual-fee filters', () => {
    expect(filterCreditCards(cards, { issuer: 'Emisor Uno', annualFee: 'conditional' }).map(card => card.id)).toEqual(['b']);
    expect(filterCreditCards(cards, { annualFee: 'unknown' }).map(card => card.id)).toEqual(['n']);
    expect(filterCreditCards(cards, { annualFee: 'none' }).map(card => card.id)).toEqual(['a']);
  });
  it('caps selection at three and never silently replaces a selected card', () => {
    const selected = ['z', 'a', 'b'];
    expect(toggleCardComparison(selected, 'n')).toEqual({ ids: selected, reason: 'limit' });
    expect(toggleCardComparison(selected, 'a')).toEqual({ ids: ['z', 'b'], reason: null });
    expect(selected).toEqual(['z', 'a', 'b']);
  });
  it('preserves comparison order and membership when the result filter changes', () => {
    const selected = ['z', 'a', 'b'];
    const filtered = filterCreditCards(cards, { issuer: 'Emisor Dos' });
    expect(filtered.map(card => card.id)).toEqual(['a', 'n']);
    expect(selectedCreditCards(cards, selected).map(card => card.id)).toEqual(selected);
    expect(buildCardComparison(cards, selected, '2026-10-19').entries.map(card => card.id)).toEqual(selected);
  });
  it('compares equivalent attributes and keeps missing rates unknown', () => {
    const comparison = buildCardComparison(cards, ['a', 'n'], '2026-10-19');
    expect(comparison.rows.map(row => row.id)).toEqual(['annualFee', 'cat', 'interestRate', 'maintenanceFee', 'optionalSubscriptionFee', 'openingFee', 'benefits', 'requirements', 'otherFees', 'limitations', 'sources']);
    expect(comparison.rows[0].values[0].lines[0]).toContain('$0.00');
    expect(comparison.rows[0].values[1].lines[0]).toBe('Sin dato documentado');
    expect(comparison.rows[1].values[0].lines).toContain('Vigencia vencida');
    expect(comparison.rows[2].values[0].lines).toContain('Sin dato documentado');
  });
  it('keeps direct web sources, deduplicates URLs and rejects executable schemes', () => {
    const sources = catalogSources({ canonicalUrl: 'https://example.test/product', evidence: [
      { title: 'Duplicate', url: 'https://example.test/product' }, { title: 'Fees', url: 'https://example.test/fees' }, { title: 'Unsafe', url: 'javascript:alert(1)' },
    ] });
    expect(sources.map(source => source.url)).toEqual(['https://example.test/product', 'https://example.test/fees']);
  });
});

describe('Visible published credit terms', () => {
  it('formats valid rate ranges without inventing an average or replacing zero', () => {
    expect(formatCatalogRate({ percent: null, minPercent: 0, maxPercent: 12.5 })).toBe('0%–12.5%');
    expect(formatCatalogRate({ percent: null, minPercent: 25.75, maxPercent: 39.95 })).toBe('25.75%–39.95%');
    expect(formatCatalogRate({ percent: 0, minPercent: 25, maxPercent: 40 })).toBe('0%');
    for (const cost of [{}, { minPercent: 5 }, { minPercent: 9, maxPercent: 8 }, { minPercent: -1, maxPercent: 2 }, { minPercent: '0', maxPercent: 5 }, { minPercent: 1, maxPercent: Infinity }]) {
      expect(formatCatalogRate(cost)).toBe('Por verificar');
    }
  });

  it('requires actual cost observations rather than a detailed-sheet label, limit or amount text', () => {
    expect(hasDocumentedCosts({ hasDetailedSheet: true, amountRange: '$100 a $500', costs: { cat: { percent: null }, interestRate: { label: 'Tasa del 10 al 20%' } } })).toBe(false);
    expect(hasDocumentedCosts({ costs: { annualFee: { amount: 0 } } })).toBe(true);
    expect(hasDocumentedCosts({ costs: { interestRate: { percent: null, minPercent: 0, maxPercent: 12 } } })).toBe(true);
    expect(hasDocumentedCosts({ costs: { interestRate: { percent: null, minPercent: 9, maxPercent: 3 } } })).toBe(false);
    expect(hasDocumentedCosts({ costs: { maintenanceFee: { amount: 99 } } })).toBe(true);
    expect(hasDocumentedCosts({ costs: { optionalSubscriptionFee: { amount: 600 } } })).toBe(true);
    expect(hasDocumentedCosts({ costs: { openingFee: { amount: '0' } } })).toBe(false);
  });

  it('keeps monthly, annual and unknown fee periods distinct without totalizing costs', () => {
    expect(periodicFeeLines({ amount: 169, unit: 'MXN', frequency: 'monthly', taxTreatment: 'Más IVA', conditions: 'Se exenta con $200 de compras elegibles.' }))
      .toEqual(['$169.00 MXN/mes', 'Más IVA', 'Se exenta con $200 de compras elegibles.']);
    expect(periodicFeeLines({ amount: 600, unit: 'MXN', frequency: 'annual' })[0]).toBe('$600.00 MXN/año');
    expect(periodicFeeLines({ amount: 0, unit: 'MXN', frequency: 'monthly' })[0]).toBe('$0.00 MXN/mes');
    expect(periodicFeeLines({ amount: 2, frequency: 'monthly' })[0]).toContain('unidad por verificar');
    expect(periodicFeeLines({ amount: 2, unit: 'MXN' })[0]).toContain('periodicidad por verificar');
    expect(periodicFeeLines({ amount: null })[0]).toBe('Cargo periódico sin dato documentado');
  });

  it('preserves published fee brackets as text with their conditions instead of fabricating a single price', () => {
    const opening = { amount: null, unit: '%', publishedText: '2.9%, 3.9% o 4.9%', conditions: 'Según calificación y plazo.', taxTreatment: 'Más IVA' };
    const monthly = { amount: null, unit: 'MXN', frequency: 'monthly', publishedText: '$10, $20 o $30 MXN según tramo', conditions: 'El tramo depende del monto del crédito.', taxTreatment: 'Más IVA' };
    expect(openingFeeLines(opening)).toEqual(['2.9%, 3.9% o 4.9%', 'Más IVA', 'Según calificación y plazo.']);
    expect(periodicFeeLines(monthly)).toEqual(['$10, $20 o $30 MXN según tramo', 'Más IVA', 'El tramo depende del monto del crédito.', 'Periodicidad: mensual.']);
    expect(hasDocumentedCosts({ costs: { openingFee: opening } })).toBe(true);
    expect(hasDocumentedCosts({ costs: { maintenanceFee: monthly } })).toBe(true);
    expect(hasDocumentedCosts({ costs: { openingFee: { amount: null, publishedText: ' ' } } })).toBe(false);
  });

  it('aligns subscription and maintenance fees separately with their own evidence and full conditions', () => {
    const maintenance = { amount: 99, unit: 'MXN', frequency: 'monthly', label: 'Administración mensual', taxTreatment: 'Más IVA', conditions: 'Exención condicionada al uso.', sources: [{ title: 'Monthly terms', url: 'https://example.test/monthly' }] };
    const subscription = { amount: 600, unit: 'MXN', frequency: 'annual', label: 'Recompensas opcionales', conditions: 'Sólo si se contrata el programa.', sources: [{ title: 'Optional terms', url: 'https://example.test/optional' }] };
    const fixture = { ...cards[0], costs: { ...cards[0].costs, maintenanceFee: maintenance, optionalSubscriptionFee: subscription,
      interestRate: { percent: null, minPercent: 25.75, maxPercent: 39.95, type: 'variable', basis: 'Anual', conditions: 'Modalidad publicada específica.' } } };
    const rows = buildCardComparison([fixture, cards[1]], [fixture.id, cards[1].id], '2026-10-18').rows;
    const monthly = rows.find(row => row.id === 'maintenanceFee');
    const optional = rows.find(row => row.id === 'optionalSubscriptionFee');
    expect(monthly.values[0].lines).toContain('$99.00 MXN/mes');
    expect(monthly.values[0].lines).toContain(maintenance.conditions);
    expect(monthly.values[0].sources).toEqual(maintenance.sources);
    expect(monthly.values[1].lines).toContain('Sin dato documentado');
    expect(optional.values[0].lines).toContain('$600.00 MXN/año');
    expect(optional.values[0].lines).toContain(subscription.conditions);
    expect(optional.values[0].sources).toEqual(subscription.sources);
    const rateLines = rows.find(row => row.id === 'interestRate').values[0].lines;
    expect(rateLines).toContain('25.75%–39.95%');
    expect(rateLines).toContain('Modalidad publicada específica.');
    expect(rateLines).toContain('Tipo de tasa: variable.');
    expect(rateLines).not.toContain('Por verificar');
  });

  it('includes descriptive and conflicted benefit programs and literal benefits without treating them as calculable cash', () => {
    const noCosts = { id: 'points', name: 'Puntos', benefits: ['CVV dinámico.', 'CVV dinámico.', 'CVV dinámico con condición.', ''] };
    const programs = [{ id: 'p', cardId: noCosts.id, name: 'Programa de puntos', summary: '10 puntos con condiciones.', status: 'conflict', reward: { type: 'cash', originalType: 'points', redemptionSummary: 'Canje restringido.' }, sources: [{ title: 'Point terms', url: 'https://example.test/points' }] }];
    expect(catalogBenefitStrings(noCosts)).toEqual(['CVV dinámico.', 'CVV dinámico con condición.']);
    expect(hasDocumentedBenefits(noCosts)).toBe(true);
    expect(hasDocumentedBenefits({ id: 'points' }, programs)).toBe(true);
    expect(benefitProgramMetadata(programs[0])).toContain('Puntos');
    expect(benefitProgramMetadata(programs[0])).not.toContain('Devolución en dinero');
    expect(benefitProgramMetadata(programs[0])).toContain('Condiciones con discrepancias');
    const benefit = buildCardComparison([noCosts], ['points'], '2026-10-18', programs).rows.find(row => row.id === 'benefits').values[0];
    expect(benefit.lines).toContain(programs[0].summary);
    expect(benefit.lines).toContain('Canje restringido.');
    expect(benefit.sources).toEqual(programs[0].sources);
    expect(buildCardComparison([{ id: 'unknown' }], ['unknown']).rows.find(row => row.id === 'benefits').values[0].lines[0]).toContain('no significa');
  });

  it('reorders only explicitly classified habitual and welcome programs, deduplicating IDs without guessing from summaries', () => {
    const programs = [
      { id: 'welcome', cardId: 'a', kind: 'welcome' },
      { id: 'unclassified', cardId: 'a', summary: 'Beneficio habitual del 10%.' },
      { id: 'ongoing', cardId: 'a', kind: 'ongoing' },
      { id: 'ongoing', cardId: 'a', kind: 'ongoing' },
      { id: 'other', cardId: 'b', kind: 'ongoing' },
    ];
    expect(catalogBenefitPrograms('a', programs).map(program => program.id)).toEqual(['ongoing', 'unclassified', 'welcome']);
    expect(programs[0].id).toBe('welcome');
  });

  it('keeps cost and benefit scopes independent, retains all by default, and preserves the other filters when widening', () => {
    const entries = [
      { id: 'both', name: 'Ambas', issuer: 'A', costs: { annualFee: { amount: 0 } }, benefits: ['Beneficio textual.'] },
      { id: 'benefits', name: 'Beneficios', issuer: 'B' },
      { id: 'sheet', name: 'Ficha vacía', issuer: 'B', hasDetailedSheet: true },
      { id: 'identified', name: 'Identificada', issuer: 'B' },
    ];
    const programs = [{ id: 'p', cardId: 'benefits', status: 'incomplete', calculation: null }];
    expect(filterCreditCards(entries)).toHaveLength(4);
    expect(filterCreditCards(entries, { information: 'costs', programs }).map(entry => entry.id)).toEqual(['both']);
    expect(filterCreditCards(entries, { information: 'benefits', programs }).map(entry => entry.id)).toEqual(['both', 'benefits']);
    const criteria = { query: 'identificada', issuer: 'B', annualFee: 'unknown', information: 'costs', programs };
    expect(filterCreditCards(entries, criteria)).toHaveLength(0);
    expect(filterCreditCards(entries, { ...criteria, information: 'all' }).map(entry => entry.id)).toEqual(['identified']);
    expect(criteria.information).toBe('costs');
  });

  it('filters loan costs independently of detailed-sheet membership and preserves family and aliases', () => {
    const loans = [{ id: 'range', name: 'Rango', familyId: 'auto', aliases: ['Vehículo'], costs: { interestRate: { minPercent: 10, maxPercent: 20 } } }, { id: 'empty', name: 'Ficha', familyId: 'auto', hasDetailedSheet: true }];
    expect(filterCreditLoans(loans)).toHaveLength(2);
    expect(filterCreditLoans(loans, { information: 'costs', familyId: 'auto', query: 'vehiculo' }).map(loan => loan.id)).toEqual(['range']);
    expect(filterCreditLoans(loans, { information: 'costs', familyId: 'mortgage' })).toHaveLength(0);
  });
});

describe('Credit library visible terms rendering', () => {
  const fixture = {
    reviewedOn: '2026-10-18',
    cards: [{ ...fixtureCard('bbva-azul', 'Visible test card', 'Test issuer', 'none', 0), benefits: ['Distinct digital security benefit.'],
      costs: { annualFee: { amount: 0, conditions: 'Zero annual fee, monthly cost separate.', taxTreatment: 'Sin IVA' },
        cat: { percent: 10, conditions: 'Only for the documented program.', asOf: '2026-10-01', validThrough: '2026-12-31' },
        interestRate: { percent: null, minPercent: 25.75, maxPercent: 39.95, label: 'Annual variable published rate.' },
        maintenanceFee: { amount: 99, unit: 'MXN', frequency: 'monthly', conditions: 'Exemption requires eligible spending.', sources: [{ title: 'Exact monthly source', url: 'https://example.test/monthly' }] },
        optionalSubscriptionFee: { amount: 600, unit: 'MXN', frequency: 'annual', label: 'Optional test program', conditions: 'Only when subscribed.' },
        openingFee: { amount: 91.27, unit: 'MXN', conditions: 'One-time opening charge.', sources: [{ title: 'Exact opening source', url: 'https://example.test/opening' }] },
      } }],
    loanFamilies: [{ id: 'personal', name: 'Personal', offers: [{ id: 'test-visible-loan', name: 'Visible loan', issuer: 'Test lender', amountRange: 'Published loan amount', termRange: 'Published loan term', costs: { cat: { percent: 10 }, interestRate: { minPercent: 20, maxPercent: 30 }, openingFee: { amount: 0, unit: '%' }, maintenanceFee: { amount: null, publishedText: '$10, $20 o $30 MXN según tramo', unit: 'MXN', frequency: 'monthly', conditions: 'Visible tier condition.' } }, requirements: ['Test requirement.'], benefits: ['Test loan benefit.'], otherFees: ['Test other fee.'] }] }],
  };
  const markup = renderToStaticMarkup(React.createElement(CreditLibrary, { catalog: fixture }));
  const cardMarkup = markup.slice(markup.indexOf('<article class="credit-library-card-row credit-library-visible-card"'), markup.indexOf('</footer>', markup.indexOf('<article class="credit-library-card-row credit-library-visible-card"')));
  const loanMarkup = markup.slice(markup.indexOf('<article class="credit-library-loan-offer credit-library-visible-loan"'), markup.indexOf('</article>', markup.indexOf('<article class="credit-library-loan-offer credit-library-visible-loan"')));

  it('starts with explicit documented-cost scopes and keeps controls out of the availability filter', () => {
    expect((markup.match(/aria-pressed="true">Con costos documentados/g) || []).length).toBe(2);
    const cardFilters = markup.slice(markup.indexOf('<section class="credit-library-cards"'), markup.indexOf('<ul class="credit-library-card-list"'));
    expect(cardFilters.includes('Información disponible</span>')).toBe(false);
    expect(markup.includes('Con beneficios')).toBe(true);
  });

  it('renders cost figures, complete program summary, conditions and fee units before any card disclosure', () => {
    const beforeDisclosure = cardMarkup.split('<details')[0];
    for (const value of ['10%', '25.75%–39.95%', '$0.00 MXN/año', '$99.00 MXN/mes', '$600.00 MXN/año', 'Only for the documented program.', 'Exemption requires eligible spending.', 'Optional test program', 'https://example.test/monthly', '$91.27 MXN', 'One-time opening charge.', 'https://example.test/opening']) expect(beforeDisclosure.includes(value)).toBe(true);
    const program = cardBenefitPrograms.find(item => item.id === 'bbva-azul-points');
    expect(cardMarkup.includes(program.summary)).toBe(true);
    expect(cardMarkup.includes('Distinct digital security benefit.')).toBe(true);
    expect(cardMarkup.includes('Ver todos los beneficios')).toBe(true);
    expect(cardMarkup.includes('Ver ficha completa')).toBe(true);
    expect(cardMarkup.includes('Devolución en dinero')).toBe(false);
  });

  it('renders loan terms before the requirements disclosure and keeps loan extras present', () => {
    const visible = loanMarkup.split('<details')[0];
    for (const value of ['10%', '20%–30%', '0%', 'Published loan amount', 'Published loan term', 'Test loan benefit.', 'Test other fee.', '$10, $20 o $30 MXN según tramo', 'Visible tier condition.', 'Periodicidad: mensual.']) expect(visible.includes(value)).toBe(true);
    expect(loanMarkup.includes('Requisitos y condiciones')).toBe(true);
    expect(loanMarkup.includes('Test requirement.')).toBe(true);
  });

  it('integrates current optional-program and bracketed-loan records without hiding their qualifiers', () => {
    const hey = creditCatalog.cards.find(card => card.id === 'hey-credito');
    const personal = creditCatalog.loanFamilies.find(family => family.id === 'personal');
    const loan = personal.offers.find(offer => offer.id === 'yotepresto-personal');
    const production = renderToStaticMarkup(React.createElement(CreditLibrary, { catalog: { cards: [hey], loanFamilies: [{ ...personal, offers: [loan] }] } }));
    const start = production.indexOf('<article class="credit-library-card-row credit-library-visible-card"');
    const renderedCard = production.slice(start, production.indexOf('</footer>', start));
    for (const line of [hey.costs.annualFee.conditions, hey.costs.cat.label, hey.costs.optionalSubscriptionFee.label, hey.costs.optionalSubscriptionFee.conditions, 'Anualidad sin dato documentado', '$600.00 MXN/año']) expect(renderedCard.includes(line)).toBe(true);
    const loanStart = production.indexOf('<article class="credit-library-loan-offer credit-library-visible-loan"');
    const renderedLoan = production.slice(loanStart, production.indexOf('<details', loanStart));
    for (const line of [loan.costs.openingFee.publishedText, loan.costs.openingFee.conditions, loan.costs.maintenanceFee.publishedText, loan.costs.maintenanceFee.conditions, '8.9%–38.9%']) expect(renderedLoan.includes(line)).toBe(true);
  });

  it('includes the documented Stori opening charge separately from annual and monthly fees', () => {
    const stori = creditCatalog.cards.find(card => card.id === 'stori-simi-green');
    const comparison = buildCardComparison([stori, cards[1]], [stori.id, cards[1].id], '2026-10-18');
    const row = comparison.rows.find(item => item.id === 'openingFee');
    expect(row.values[0].lines).toEqual(openingFeeLines(stori.costs.openingFee, '2026-10-18'));
    expect(row.values[0].sources).toEqual(costSources(stori.costs.openingFee, stori));
    expect(row.values[1].lines[0]).toBe('Sin dato documentado');
    const production = renderToStaticMarkup(React.createElement(CreditLibrary, { catalog: { cards: [stori], loanFamilies: [] } }));
    const start = production.indexOf('<article class="credit-library-card-row credit-library-visible-card"');
    const renderedCard = production.slice(start, production.indexOf('</footer>', start));
    expect(renderedCard.includes('class="credit-library-label">Comisión por apertura</p>')).toBe(true);
    expect(renderedCard.includes('class="credit-library-card-opening"')).toBe(true);
    expect(renderedCard.includes(openingFeeLines(stori.costs.openingFee)[0])).toBe(true);
    expect(renderedCard.includes(stori.costs.openingFee.conditions)).toBe(true);
    expect(renderedCard.includes(stori.costs.openingFee.sources[0].url)).toBe(true);
  });
});

describe('Mexico credit directory coverage and discovery', () => {
  const identified = [
    { id: 'z', name: 'Directory Zeta', issuer: 'Emisor Uno', aliases: ['Crédito viajero'], productType: 'credit-card', evidence: [{ title: 'Test directory', url: 'https://example.test/directory' }], limitations: ['Test directory limit'] },
    { id: 'only-identified', name: 'Product without cost sheet', issuer: 'Emisor Tres', productType: 'charge-card', aliases: ['Compras de viaje'], evidence: [], limitations: [] },
  ];
  const programs = [{ id: 'test-rule', cardId: 'only-identified' }];

  it('enriches by id without counting a product twice or discarding documented costs and directory aliases', () => {
    const baseline = JSON.stringify({ identified, cards });
    const entries = enrichCatalogEntries(identified, cards);
    expect(entries).toHaveLength(5);
    const enriched = entries.find(entry => entry.id === 'z');
    expect(enriched.name).toBe(cards[0].name);
    expect(enriched.costs).toEqual(cards[0].costs);
    expect(enriched.aliases).toContain('Crédito viajero');
    expect(enriched.aliases).toContain('Directory Zeta');
    expect(enriched.evidence).toContainEqual(identified[0].evidence[0]);
    expect(enriched.hasDetailedSheet).toBe(true);
    expect(entries.find(entry => entry.id === 'only-identified').hasDetailedSheet).toBe(false);
    expect(JSON.stringify({ identified, cards })).toBe(baseline);
  });

  it('finds aliases without accents and combines documented type and issuer filters', () => {
    const entries = enrichCatalogEntries(identified, cards);
    expect(filterCreditCards(entries, { query: 'credito viajero', issuer: 'Emisor Uno', productType: 'credit-card' }).map(entry => entry.id)).toEqual(['z']);
    expect(filterCreditCards(entries, { productType: 'unknown' }).map(entry => entry.id)).toEqual(['a', 'b', 'n']);
  });

  it('keeps benefit rules independent from cost coverage and treats absent annual fees as unknown', () => {
    const entries = enrichCatalogEntries(identified, cards);
    expect(filterCreditCards(entries, { information: 'sheet', programs })).toHaveLength(4);
    expect(filterCreditCards(entries, { information: 'rules', annualFee: 'unknown', programs }).map(entry => entry.id)).toEqual(['only-identified']);
    expect(filterCreditCards(entries, { information: 'rules', annualFee: 'none', programs })).toHaveLength(0);
  });

  it('merges loan sheets while preserving family membership and allows direct family, issuer and alias searches', () => {
    const loans = enrichCatalogEntries([
      { id: 'loan-a', name: 'Auto A', issuer: 'Issuer A', familyId: 'auto', aliases: ['Vehículo'] },
      { id: 'loan-b', name: 'Loan B', issuer: 'Issuer B', familyId: 'new-family', aliases: [] },
    ], [{ id: 'loan-a', name: 'Documented auto', issuer: 'Issuer A', familyId: 'auto', costs: { cat: { percent: null } } }]);
    expect(loans).toHaveLength(2);
    expect(filterCreditLoans(loans, { query: 'vehiculo', issuer: 'Issuer A', familyId: 'auto' }).map(entry => entry.id)).toEqual(['loan-a']);
    expect(filterCreditLoans(loans, { familyId: 'new-family' })[0].hasDetailedSheet).toBe(false);
  });

  it('reveals twelve more entries without changing the underlying data or membership', () => {
    const entries = Array.from({ length: 29 }, (_, index) => ({ id: `test-${index}` }));
    expect(catalogPage(entries)).toEqual({ entries: entries.slice(0, 12), remaining: 17 });
    expect(catalogPage(entries, 24)).toEqual({ entries: entries.slice(0, 24), remaining: 5 });
    expect(catalogPage(entries, 36)).toEqual({ entries, remaining: 0 });
    expect(entries).toHaveLength(29);
  });
});
