import { describe, expect, it } from 'vitest';
import { additionalCardDetails } from './creditCardDetails.js';
import { additionalLoanOffers } from './loanOfferDetails.js';
import { mexicoCreditDirectory } from './mexicoCreditDirectory.js';
import { enrichCatalogEntries, formatCatalogMoney, formatCatalogPercent, isCatalogDate } from '../services/creditCatalog.js';

const allDetails = [...additionalCardDetails, ...additionalLoanOffers];
const assertSources = sources => {
  expect(Array.isArray(sources)).toBe(true);
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources) {
    expect(typeof source.title).toBe('string');
    expect(source.title.trim().length).toBeGreaterThan(0);
    expect(new URL(source.url).protocol).toBe('https:');
  }
};

describe('Additional credit details: product identity and field evidence', () => {
  it('joins each sheet to one real directory product and preserves loan family membership', () => {
    for (const [details, directory] of [[additionalCardDetails, mexicoCreditDirectory.cards], [additionalLoanOffers, mexicoCreditDirectory.loans]]) {
      expect(new Set(details.map(entry => entry.id)).size).toBe(details.length);
      for (const entry of details) {
        const matches = directory.filter(product => product.id === entry.id);
        expect(matches, entry.id).toHaveLength(1);
        expect(entry.issuer, entry.id).toBe(matches[0].issuer);
        if (entry.familyId) expect(entry.familyId).toBe(matches[0].familyId);
        expect(entry.name.trim()).not.toBe('');
        expect(entry.issuer.trim()).not.toBe('');
        expect(new URL(entry.canonicalUrl).protocol).toBe('https:');
      }
      expect(enrichCatalogEntries(directory, details)).toHaveLength(directory.length);
    }
  });

  it('attributes each financial field to HTTPS evidence and retains source-specific date uncertainty', () => {
    for (const entry of allDetails) {
      assertSources(entry.evidence);
      expect(entry.benefits.length, entry.id).toBeGreaterThan(0);
      expect(entry.requirements.length, entry.id).toBeGreaterThan(0);
      expect(entry.limitations.length, entry.id).toBeGreaterThan(0);
      for (const cost of Object.values(entry.costs)) {
        assertSources(cost.sources);
        expect(cost.taxTreatment.trim()).not.toBe('');
        for (const key of ['asOf', 'validThrough']) {
          expect(Object.hasOwn(cost, key)).toBe(true);
          expect(cost[key] === null || isCatalogDate(cost[key]), `${entry.id}.${key}`).toBe(true);
        }
        if (cost.asOf && cost.validThrough) expect(cost.asOf <= cost.validThrough).toBe(true);
      }
    }
  });

  it('keeps all published numbers finite and every range separate from a single rate', () => {
    for (const entry of allDetails) {
      for (const cost of Object.values(entry.costs)) {
        for (const key of ['amount', 'percent', 'minPercent', 'maxPercent']) {
          if (!Object.hasOwn(cost, key) || cost[key] === null) continue;
          expect(typeof cost[key], `${entry.id}.${key}`).toBe('number');
          expect(Number.isFinite(cost[key]) && cost[key] >= 0, `${entry.id}.${key}`).toBe(true);
        }
        if (Object.hasOwn(cost, 'minPercent') || Object.hasOwn(cost, 'maxPercent')) {
          expect(cost.percent).toBeNull();
          expect(Number.isFinite(cost.minPercent) && Number.isFinite(cost.maxPercent)).toBe(true);
          expect(cost.minPercent <= cost.maxPercent).toBe(true);
          expect(cost.label).toMatch(/anual/i);
        }
      }
    }
  });

  it('keeps fee units, frequencies and non-numeric observations explicit', () => {
    for (const entry of allDetails) {
      for (const [key, cost] of Object.entries(entry.costs)) {
        if (!Object.hasOwn(cost, 'amount')) continue;
        expect(['MXN', 'percent']).toContain(cost.unit);
        expect(['annual', 'monthly', 'one-time', 'per-event']).toContain(cost.frequency);
        expect(cost.label.trim()).not.toBe('');
        expect(cost.conditions.trim()).not.toBe('');
        if (key === 'maintenanceFee') expect(cost.frequency).toBe('monthly');
        if (key === 'annualFee') expect(cost.frequency).toBe('annual');
        if (cost.publishedText) {
          expect(cost.amount).toBeNull();
          expect(typeof cost.publishedText).toBe('string');
          expect(cost.publishedText.trim()).not.toBe('');
        }
      }
    }
  });
});

describe('Financial distinctions that must survive catalog enrichment', () => {
  const cards = enrichCatalogEntries(mexicoCreditDirectory.cards, additionalCardDetails);
  const loans = enrichCatalogEntries(mexicoCreditDirectory.loans, additionalLoanOffers);
  const card = id => cards.find(entry => entry.id === id);
  const loan = id => loans.find(entry => entry.id === id);

  it('does not turn a monthly administration charge into a second annual fee', () => {
    const costco = card('banamex-costco').costs;
    expect(costco.annualFee.amount).toBeNull();
    expect(costco.annualFee.classification).toBe('unknown');
    expect(costco.maintenanceFee.amount).toBeGreaterThan(0);
    expect(costco.maintenanceFee.frequency).toBe('monthly');
    expect(costco.annualFee.conditions).toMatch(/no se suma/i);
    const hsbc = card('hsbc-2now').costs;
    expect(hsbc.annualFee.amount).toBe(0);
    expect(hsbc.maintenanceFee.amount).toBeGreaterThan(0);
    expect(hsbc.maintenanceFee.conditions).toMatch(/entre fechas de corte/);
    expect(hsbc.maintenanceFee.asOf).toBeNull();
    expect(hsbc.maintenanceFee.validThrough).toBeNull();
  });

  it('separates optional reward subscriptions from card maintenance and scopes the Hey CAT', () => {
    for (const id of ['plata-credito', 'hey-credito']) {
      const costs = card(id).costs;
      expect(costs.maintenanceFee).toBeUndefined();
      expect(costs.optionalSubscriptionFee.amount).toBeGreaterThan(0);
      expect(costs.optionalSubscriptionFee.label).toMatch(/opcional/);
      expect(costs.optionalSubscriptionFee.conditions).toMatch(/opcional/i);
    }
    expect(card('plata-credito').costs.optionalSubscriptionFee.label).toMatch(/máximo/);
    expect(card('plata-credito').costs.optionalSubscriptionFee.conditions).toMatch(/individual.*aplicación/);
    expect(card('hey-credito').costs.cat.label).toMatch(/modalidad con Recompensas/);
    expect(card('hey-credito').costs.annualFee.amount).toBeNull();
  });

  it('does not replace a missing or conflicting rate with CAT, zero, or a range endpoint', () => {
    const missing = loan('banamex-personal').costs;
    expect(missing.cat.percent).toBeGreaterThan(0);
    expect(missing.interestRate.percent).toBeNull();
    expect(missing.interestRate.minPercent).toBeUndefined();
    expect(formatCatalogPercent(missing.interestRate.percent)).toBe('Por verificar');
    expect(formatCatalogMoney(missing.openingFee.amount)).toContain('$0.00');
    const range = loan('hsbc-personal').costs.interestRate;
    expect(range.percent).toBeNull();
    expect(range.minPercent).toBeLessThan(range.maxPercent);
    expect(range.label).toMatch(/anual/);
    expect(loan('banorte-nomina').costs.interestRate.percent).toBeNull();
    expect(loan('banorte-nomina').costs.interestRate.minPercent).toBeUndefined();
  });

  it('does not borrow opening cost or savings yield from a different Stori variant', () => {
    expect(card('stori-simi-green').costs.openingFee.amount).toBeGreaterThan(0);
    const secured = card('stori-simi-garantizada');
    expect(secured.costs.openingFee.amount).toBeNull();
    expect(secured.costs.annualFee.amount).toBe(0);
    expect(secured.costs.cat.sources).not.toEqual(card('stori-simi-green').costs.cat.sources);
    expect(Object.keys(secured.costs).some(key => /gat|yield/i.test(key))).toBe(false);
  });

  it('keeps tiered fees textual and does not invent missing publication or validity dates', () => {
    const costs = loan('yotepresto-personal').costs;
    expect(costs.openingFee.amount).toBeNull();
    expect(costs.openingFee.publishedText).toMatch(/%/);
    expect(costs.maintenanceFee.amount).toBeNull();
    expect(costs.maintenanceFee.publishedText).toMatch(/MXN al mes/);
    expect(costs.maintenanceFee.frequency).toBe('monthly');
    expect(costs.maintenanceFee.taxTreatment).toBe('IVA incluido');
    expect(costs.interestRate.asOf).toBeNull();
    expect(costs.cat.validThrough).toBeNull();
    expect(card('rappicard').costs.cat.asOf).toBeNull();
    expect(card('plata-credito').costs.cat.validThrough).toBeNull();
    expect(loan('banorte-personal').termRange).toBeNull();
  });
});
