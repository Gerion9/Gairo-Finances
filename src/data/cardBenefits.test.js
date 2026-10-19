import { describe, expect, it } from 'vitest';
import { cardBenefitPrograms } from './cardBenefits.js';
import { evaluateCardBenefits } from '../services/cardBenefits.js';

const asOf = '2026-10-18';
function purchase(overrides = {}) {
  const conditions = Object.fromEntries(cardBenefitPrograms.map(program => [program.id, Object.fromEntries(program.conditions.map(item => [item.id, 'yes']))]));
  conditions['plata-all-plus']['plus-plan'] = 'no';
  const caps = Object.fromEntries(cardBenefitPrograms.filter(program => program.calculation?.cap).map(program => [program.calculation.cap.id, { state: 'full', periodStart: '2026-10-01', periodEnd: '2026-10-31' }]));
  return { ownedCardIds: ['santander-likeu', 'hsbc-2now', 'plata-credito', 'stori-simi-green', 'nu-credito'], amountMinor: 150000, currency: 'MXN', purchaseDate: asOf, categoryId: 'pharmacies', merchantId: null, channel: 'in-person', paymentMode: 'single', payInFull: 'yes', conditions, caps, ...overrides };
}
const evaluate = context => evaluateCardBenefits(cardBenefitPrograms, context, { asOf });

describe('documented Mexican benefit programs', () => {
  it('compares documented cashback while preserving non-comparable and unknown cards', () => {
    const result = evaluate(purchase());
    expect(result.status).toBe('evaluated');
    expect(result.recommendation.cardIds).toEqual(['santander-likeu']);
    expect(result.results.find(row => row.cardId === 'santander-likeu').amountMinor).toBe(9000);
    expect(result.results.find(row => row.cardId === 'hsbc-2now').amountMinor).toBe(3000);
    expect(result.results.find(row => row.programId === 'plata-all-base').amountMinor).toBe(750);
    expect(result.results.find(row => row.cardId === 'stori-simi-green')).toMatchObject({ amountMinor: 3000, rankable: false });
    expect(result.results.find(row => row.cardId === 'nu-credito')).toMatchObject({ amountMinor: null, rankable: false });
  });
  it('honors the remaining LikeU cap instead of the advertised percentage alone', () => {
    const context = purchase();
    context.caps['likeu-credit-holder-month'] = { state: 'remaining', remainingMinor: 3000, periodStart: '2026-10-01', periodEnd: '2026-10-31' };
    const result = evaluate(context);
    expect(result.recommendation.status).toBe('tie');
    expect(new Set(result.recommendation.cardIds)).toEqual(new Set(['santander-likeu', 'hsbc-2now']));
  });
  it.each(['unknown', 'no'])('does not recommend LikeU when its receiving account condition is %s', answer => {
    const context = purchase({ ownedCardIds: ['santander-likeu', 'hsbc-2now'] });
    context.conditions['santander-likeu-cashback']['receiving-account'] = answer;
    const result = evaluate(context);
    expect(result.results.find(row => row.cardId === 'santander-likeu')).toMatchObject({ amountMinor: null, rankable: false });
    expect(result.recommendation.cardIds).not.toContain('santander-likeu');
  });
  it('requires explicit 2Now redemption choice and does not calculate the conflicted installment mode', () => {
    const context = purchase({ ownedCardIds: ['hsbc-2now'] });
    context.conditions['hsbc-2now-cash-equivalent']['cash-redemption'] = 'unknown';
    expect(evaluate(context).results[0].amountMinor).toBeNull();
    context.conditions['hsbc-2now-cash-equivalent']['cash-redemption'] = 'yes';
    context.paymentMode = 'installments';
    expect(evaluate(context).results[0]).toMatchObject({ amountMinor: null, rankable: false });
  });
  it('preserves the distinction between Plata plans and refuses unresolved overlap', () => {
    const context = purchase({ ownedCardIds: ['plata-credito', 'hsbc-2now'] });
    context.conditions['plata-all-base']['base-plan'] = 'no';
    context.conditions['plata-all-plus']['plus-plan'] = 'yes';
    expect(evaluate(context).results.find(row => row.programId === 'plata-all-plus').amountMinor).toBe(1500);
    context.conditions['plata-all-base']['base-plan'] = 'yes';
    expect(evaluate(context).results.filter(row => row.cardId === 'plata-credito').every(row => !row.rankable)).toBe(true);
  });
  it('keeps every real program readable without treating missing evidence as zero', () => {
    const context = purchase({ ownedCardIds: [...new Set(cardBenefitPrograms.map(program => program.cardId))] });
    const result = evaluate(context);
    expect(result.results.some(row => row.reasons.some(reason => reason.code === 'malformed-program'))).toBe(false);
    expect(result.results.filter(row => row.rewardType === null).every(row => row.amountMinor === null)).toBe(true);
    expect(new Set(cardBenefitPrograms.map(program => program.id)).size).toBe(cardBenefitPrograms.length);
  });
  it('withdraws recommendations when financing or editorial verification becomes stale', () => {
    expect(evaluate(purchase({ payInFull: 'no' })).recommendation.status).toBe('none');
    const result = evaluateCardBenefits(cardBenefitPrograms, purchase({ purchaseDate: '2026-11-18' }), { asOf: '2026-11-18' });
    expect(result.recommendation.status).toBe('none');
    expect(result.results.every(row => !row.rankable)).toBe(true);
  });
});
