import { describe, expect, it } from 'vitest';
import { BENEFIT_CATEGORY_IDS, BENEFIT_REASON_LABELS, evaluateCardBenefits } from './cardBenefits.js';

// Synthetic contract fixtures; none of these records describe a real card.
const AS_OF = '2026-10-18';
function program(id = 'a', overrides = {}) {
  return {
    id: `program-${id}`, cardId: id, name: `Synthetic ${id}`, summary: 'Synthetic percentage rule',
    status: 'verified', kind: 'ongoing', reviewedOn: AS_OF, reviewDueOn: '2026-11-18',
    validFrom: '2026-10-01', validThrough: '2026-12-31',
    sources: [{ title: 'Synthetic terms', url: `https://example.test/terms/${id}` }],
    reward: { type: 'cash', unit: 'MXN', redemptionSummary: 'Synthetic cash payout', redemptionCosts: 'none' },
    conditions: [],
    calculation: { type: 'percent', defaultRateBps: 200, rates: [], channels: ['in-person', 'online-direct'], paymentModes: ['single'], eligibleMerchantIds: null, excludedMerchantIds: [], excludedCategoryIds: [], cap: null, rounding: 'half-up-cent' },
    ...overrides,
  };
}
const context = (overrides = {}) => ({ ownedCardIds: ['a'], amountMinor: 100000, currency: 'MXN', purchaseDate: AS_OF, categoryId: 'groceries', merchantId: null, channel: 'in-person', paymentMode: 'single', payInFull: 'yes', conditions: {}, caps: {}, ...overrides });
const rule = overrides => ({ ...program().calculation, ...overrides });
const reward = overrides => ({ ...program().reward, ...overrides });
const cap = overrides => ({ id: 'shared-month', unit: 'reward', limitMinor: 5000, period: 'calendar-month', scopeLabel: 'Synthetic shared monthly cap', afterCapRateBps: 0, ...overrides });
const period = overrides => ({ state: 'full', remainingMinor: null, periodStart: '2026-10-01', periodEnd: '2026-10-31', ...overrides });
const run = (programs = [program()], purchase = context(), asOf = AS_OF) => evaluateCardBenefits(programs, purchase, { asOf });
const first = (item = program(), purchase = context(), asOf = AS_OF) => run([item], purchase, asOf).results[0];
const codes = result => result.reasons.map(item => item.code);
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

describe('benefit contract and exact arithmetic', () => {
  it('exports the stable category vocabulary', () => {
    expect(BENEFIT_CATEGORY_IDS).toEqual(['pharmacies', 'restaurants', 'telecom', 'groceries', 'fuel', 'travel', 'education', 'other']);
  });
  it('calculates integer centavos and rounds once at the final reward', () => {
    const purchase = context({ amountMinor: 10025 });
    expect(first(program(), purchase).amountMinor).toBe(201);
    expect(first(program('a', { calculation: rule({ rounding: 'floor-cent' }) }), purchase).amountMinor).toBe(200);
    expect(first(program('a', { calculation: rule({ defaultRateBps: 600 }) })).amountMinor).toBe(6000);
  });
  it('uses exact intermediates even when amount times basis points exceeds safe integer', () => {
    const amountMinor = Number.MAX_SAFE_INTEGER;
    const result = first(program('a', { calculation: rule({ defaultRateBps: 9999 }) }), context({ amountMinor }));
    expect(result.amountMinor).toBe(Number((BigInt(amountMinor) * 9999n + 5000n) / 10000n));
    expect(Number.isSafeInteger(result.amountMinor)).toBe(true);
  });
  it('keeps unknown rounding visible while permitting the agreed estimated comparison', () => {
    const result = run([program('a', { calculation: rule({ rounding: 'unknown' }) }), program('b', { calculation: rule({ defaultRateBps: 100 }) })], context({ ownedCardIds: ['a', 'b'], amountMinor: 10025 }));
    expect(result.results[0]).toMatchObject({ status: 'estimate', amountMinor: 201, rankable: true });
    expect(result.results[0].assumptions).toContain('Cálculo porcentual; el abono del emisor puede variar por redondeo.');
    expect(result.recommendation).toMatchObject({ status: 'winner', cardIds: ['a'], basis: 'estimated-percentage' });
  });
  it('distinguishes a documented zero from a missing category percentage', () => {
    expect(first(program('a', { calculation: rule({ defaultRateBps: 0 }) }))).toMatchObject({ status: 'calculated', amountMinor: 0 });
    const missing = first(program('a', { calculation: rule({ defaultRateBps: null }) }));
    expect(missing).toMatchObject({ status: 'descriptive', amountMinor: null });
    expect(codes(missing)).toContain('missing-category-rule');
  });
  it('uses the category total instead of adding it to the default rate', () => {
    expect(first(program('a', { calculation: rule({ defaultRateBps: 200, rates: [{ categoryIds: ['groceries'], rateBps: 600 }] }) }))).toMatchObject({ rateBps: 600, amountMinor: 6000 });
  });
  it('does not pick the higher of overlapping category rates', () => {
    const result = first(program('a', { calculation: rule({ rates: [{ categoryIds: ['groceries', 'fuel'], rateBps: 600 }, { categoryIds: ['groceries'], rateBps: 200 }] }) }));
    expect(result.amountMinor).toBeNull();
    expect(codes(result)).toContain('ambiguous-rate');
  });
  it.each([{ type: 'tiered' }, { bonusRateBps: 200 }, { rates: [{ categoryIds: ['groceries'], rateBps: 600, additional: true }] }, { cap: cap({ afterCapRateBps: 100 }) }, { defaultRateBps: 10001 }, { defaultRateBps: 2.5 }, { cap: undefined }])('keeps unsupported mechanics descriptive: %j', changes => {
    const result = first(program('a', { calculation: rule(changes) }));
    expect(result).toMatchObject({ status: 'descriptive', amountMinor: null, rankable: false });
    expect(codes(result)).toContain('unsupported-calculation');
  });
});

describe('caps and period boundaries', () => {
  it('applies a reward cap and a spending cap in their respective units', () => {
    const purchase = context({ caps: { 'shared-month': period({ state: 'remaining', remainingMinor: 1000 }) } });
    expect(first(program('a', { calculation: rule({ defaultRateBps: 600, cap: cap() }) }), purchase).amountMinor).toBe(1000);
    expect(first(program('a', { calculation: rule({ cap: cap({ unit: 'spend', limitMinor: 100000 }) }) }), context({ caps: { 'shared-month': period({ state: 'remaining', remainingMinor: 50000 }) } })).amountMinor).toBe(1000);
  });
  it('treats remaining zero as known but missing cap context as conditional', () => {
    const item = program('a', { calculation: rule({ cap: cap() }) });
    expect(first(item, context({ caps: { 'shared-month': period({ state: 'remaining', remainingMinor: 0 }) } }))).toMatchObject({ amountMinor: 0, status: 'calculated', rankable: true });
    expect(first(item)).toMatchObject({ amountMinor: null, maximumMinor: 2000, status: 'up-to', rankable: false });
    expect(first(program('a', { calculation: rule({ cap: cap({ limitMinor: 0 }) }) }), context({ caps: { 'shared-month': period() } })).amountMinor).toBe(0);
  });
  it('uses the defined limit for full state rather than a default remaining amount', () => {
    expect(first(program('a', { calculation: rule({ defaultRateBps: 600, cap: cap() }) }), context({ caps: { 'shared-month': period({ remainingMinor: 0 }) } })).amountMinor).toBe(5000);
  });
  it.each([
    [undefined, 'cap-unknown'], [null, 'cap-unknown'], [{ state: 'unknown' }, 'cap-unknown'],
    [period({ periodStart: null }), 'cap-period-required'],
    [period({ periodEnd: '2026-10-30' }), 'cap-period-required'],
    [period({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }), 'cap-period-required'],
    [period({ periodStart: '2026-02-30' }), 'cap-invalid'],
    [period({ state: 'remaining', remainingMinor: -1 }), 'cap-invalid'],
    [period({ state: 'remaining', remainingMinor: 5001 }), 'cap-invalid'],
    [period({ state: 'remaining', remainingMinor: 0.5 }), 'cap-invalid'],
    [false, 'cap-invalid'],
  ])('does not rank unconfirmed or malformed cap context: %j', (state, code) => {
    const result = first(program('a', { calculation: rule({ cap: cap() }) }), context({ caps: { 'shared-month': state } }));
    expect(result).toMatchObject({ amountMinor: null, maximumMinor: 2000, rankable: false, status: 'up-to' });
    expect(result.reasons).toContainEqual({ code, capId: 'shared-month' });
  });
  it('requires statement boundaries including the purchase', () => {
    const item = program('a', { calculation: rule({ cap: cap({ period: 'statement' }) }) });
    expect(first(item, context({ caps: { 'shared-month': period({ periodStart: '2026-09-25', periodEnd: '2026-10-24' }) } })).amountMinor).toBe(2000);
    expect(first(item, context({ caps: { 'shared-month': period({ periodStart: null, periodEnd: null }) } })).status).toBe('up-to');
  });
  it('shares a cap across categories without consuming it during comparison', () => {
    const item = program('a', { calculation: rule({ rates: [{ categoryIds: ['groceries', 'fuel'], rateBps: 600 }], cap: cap() }) });
    const purchase = freeze(context({ caps: { 'shared-month': period({ state: 'remaining', remainingMinor: 1000 }) } }));
    expect(first(item, purchase).amountMinor).toBe(1000);
    expect(first(item, { ...purchase, categoryId: 'fuel' }).amountMinor).toBe(1000);
    expect(purchase.caps['shared-month'].remainingMinor).toBe(1000);
  });
  it('keeps the rounding assumption visible on a conditional maximum', () => {
    const result = first(program('a', { calculation: rule({ cap: cap(), rounding: 'unknown' }) }));
    expect(result.status).toBe('up-to');
    expect(result.assumptions).toHaveLength(1);
  });
});

describe('eligibility is explicit', () => {
  const conditional = () => program('a', { conditions: [{ id: 'enrolled', label: 'Enrollment confirmed' }] });
  it.each([undefined, 'unknown', false, true, 1])('does not coerce condition values to confirmed: %s', answer => {
    const result = first(conditional(), context({ conditions: { 'program-a': { enrolled: answer } } }));
    expect(result).toMatchObject({ status: 'needs-confirmation', amountMinor: null });
    expect(result.reasons).toContainEqual({ code: 'condition-required', conditionId: 'enrolled' });
  });
  it('separates a rejected condition from a confirmed one', () => {
    expect(first(conditional(), context({ conditions: { 'program-a': { enrolled: 'no' } } })).status).toBe('ineligible');
    expect(first(conditional(), context({ conditions: { 'program-a': { enrolled: 'yes' } } })).amountMinor).toBe(2000);
  });
  it('blocks only the program whose condition state is malformed', () => {
    const result = run([conditional(), program('b')], context({ ownedCardIds: ['a', 'b'], conditions: { 'program-a': true } }));
    expect(result.status).toBe('evaluated');
    expect(result.results.map(item => item.status)).toEqual(['needs-confirmation', 'calculated']);
  });
  it('resolves unknown channel and mode only when the source explicitly admits every option', () => {
    const result = first(program('a', { calculation: rule({ channels: ['in-person', 'online-direct', 'aggregator'], paymentModes: ['single', 'installments'] }) }), context({ channel: 'unknown', paymentMode: 'unknown' }));
    expect(result).toMatchObject({ status: 'calculated', amountMinor: 2000, rankable: true });
  });
  it.each([
    [rule({ excludedCategoryIds: ['groceries'] }), context(), 'excluded-category', 'ineligible'],
    [rule({ excludedMerchantIds: ['shop'] }), context({ merchantId: 'shop' }), 'excluded-merchant', 'ineligible'],
    [rule({ eligibleMerchantIds: ['shop'] }), context({ merchantId: 'Shop' }), 'excluded-merchant', 'ineligible'],
    [rule({ eligibleMerchantIds: ['shop'] }), context(), 'merchant-required', 'needs-confirmation'],
    [rule({ excludedMerchantIds: ['shop'] }), context(), 'merchant-required', 'needs-confirmation'],
    [rule({}), context({ channel: 'aggregator' }), 'unsupported-channel', 'ineligible'],
    [rule({}), context({ channel: 'unknown' }), 'channel-required', 'needs-confirmation'],
    [rule({}), context({ paymentMode: 'installments' }), 'unsupported-payment-mode', 'ineligible'],
    [rule({}), context({ paymentMode: 'unknown' }), 'payment-mode-required', 'needs-confirmation'],
  ])('handles exact scope without fuzzy eligibility: %s', (calculation, purchase, code, status) => {
    const result = first(program('a', { calculation }), purchase);
    expect(result).toMatchObject({ status, amountMinor: null, rankable: false });
    expect(codes(result)).toContain(code);
  });
});

describe('evidence and dates', () => {
  it('includes the last valid day and expires the following day', () => {
    const item = program('a', { validThrough: AS_OF });
    expect(first(item).status).toBe('calculated');
    expect(first(item, context({ purchaseDate: '2026-10-19' }), '2026-10-19')).toMatchObject({ status: 'expired', amountMinor: null });
    expect(first(item, context(), '2026-10-19').status).toBe('expired');
  });
  it.each([
    [{ reviewedOn: '2026-10-19' }, 'future-review'],
    [{ reviewDueOn: '2026-10-17', reviewedOn: '2026-10-01' }, 'stale-review'],
    [{ reviewDueOn: null, reviewedOn: '2026-10-17' }, 'stale-review'],
    [{ validFrom: '2026-02-30' }, 'malformed-program'],
    [{ validFrom: '2026-12-31', validThrough: '2026-10-01' }, 'malformed-program'],
    [{ reviewDueOn: '2026-09-01' }, 'malformed-program'],
  ])('blocks invalid, future or stale evidence: %j', (changes, code) => {
    const result = first(program('a', changes));
    expect(result.amountMinor).toBeNull(); expect(result.rankable).toBe(false); expect(codes(result)).toContain(code);
  });
  it('allows open-ended current observation only on the evaluation day', () => {
    const item = program('a', { validFrom: null, validThrough: null, reviewDueOn: null });
    expect(first(item).amountMinor).toBe(2000);
    expect(codes(first(item, context({ purchaseDate: '2026-10-19' })))).toContain('date-scope-unverified');
    expect(codes(first(item, context({ purchaseDate: '2026-10-17' })))).toContain('date-scope-unverified');
  });
  it('allows explicitly published future dates without assuming a future cap', () => {
    const item = program('a', { validFrom: '2026-11-01', validThrough: '2026-11-30', calculation: rule({ cap: cap() }) });
    const purchase = context({ purchaseDate: '2026-11-05', caps: { 'shared-month': period() } });
    const unconfirmed = first(item, purchase);
    expect(unconfirmed.status).toBe('up-to');
    expect(unconfirmed.assumptions.some(value => value.includes('Compra futura'))).toBe(true);
    const confirmed = first(item, { ...purchase, caps: { 'shared-month': period({ periodStart: '2026-11-01', periodEnd: '2026-11-30' }) } });
    expect(confirmed).toMatchObject({ amountMinor: 2000, rankable: true });
  });
  it.each([[], [{ title: '', url: 'https://example.test/terms' }], [{ title: 'Terms', url: 'javascript:alert(1)' }], [{ title: 'Terms', url: 'http://example.test/terms' }], [{ title: 'Terms', url: 'https://user:secret@example.test/terms' }], [{ title: 'Valid', url: 'https://example.test/terms' }, { title: 'Invalid', url: 'invalid' }]].map(sources => [sources]))('requires every attributed source to be valid: %j', sources => {
    const result = first(program('a', { sources }));
    expect(result.amountMinor).toBeNull(); expect(codes(result)).toContain('missing-source');
  });
  it('does not derive verified status from a source URL', () => {
    expect(codes(first(program('a', { status: 'incomplete' })))).toContain('incomplete-evidence');
    expect(first(program('a', { status: 'conflict' }))).toMatchObject({ status: 'conflict', amountMinor: null });
  });
  it('preserves an unclassified incomplete benefit without inventing a reward type or zero', () => {
    const item = program('a', { status: 'incomplete', calculation: null, reward: reward({ type: 'unknown', unit: 'unknown', redemptionCosts: 'unknown' }) });
    const result = first(item);
    expect(result).toMatchObject({ status: 'descriptive', rewardType: null, amountMinor: null, maximumMinor: null, rankable: false, sources: item.sources });
    expect(codes(result)).toContain('incomplete-evidence');
    for (const changes of [{ status: 'verified' }, { calculation: rule({}) }, { reward: reward({ type: 'unknown', unit: 'MXN' }) }]) {
      const invalid = first({ ...item, ...changes });
      expect(invalid).toMatchObject({ amountMinor: null, rankable: false });
      expect(codes(invalid)).toContain('malformed-program');
    }
  });
});

describe('comparison and disjoint reward types', () => {
  it('requires at least two comparable cards and represents a selected card without rules', () => {
    const result = run([program()], context({ ownedCardIds: ['a', 'unmodeled'] }));
    expect(result.results[1]).toMatchObject({ cardId: 'unmodeled', programId: null, status: 'descriptive', amountMinor: null });
    expect(codes(result.results[1])).toContain('missing-rule');
    expect(result.recommendation).toMatchObject({ status: 'none', evaluatedCardIds: ['a'], excludedCardIds: ['unmodeled'], reason: 'insufficient-comparable-cards' });
  });
  it('reports exact-cent ties, one-cent differences and all-zero abstention', () => {
    const purchase = context({ ownedCardIds: ['a', 'b'], amountMinor: 10000 });
    expect(run([program('a'), program('b')], purchase).recommendation).toMatchObject({ status: 'tie', cardIds: ['a', 'b'] });
    expect(run([program('a'), program('b', { calculation: rule({ defaultRateBps: 201 }) })], purchase).recommendation).toMatchObject({ status: 'winner', cardIds: ['b'] });
    expect(run([program('a', { calculation: rule({ defaultRateBps: 0 }) }), program('b', { calculation: rule({ defaultRateBps: 0 }) })], purchase).recommendation).toMatchObject({ status: 'none', cardIds: [], reason: 'no-positive-benefit' });
    expect(run([program('a', { calculation: rule({ defaultRateBps: 0 }) })]).recommendation).toMatchObject({ status: 'none', cardIds: [], evaluatedCardIds: ['a'], reason: 'no-positive-benefit' });
  });
  it.each(['no', 'unknown'])('calculates gross rewards but never recommends when payInFull=%s', payInFull => {
    const result = run([program('a'), program('b')], context({ ownedCardIds: ['a', 'b'], payInFull }));
    expect(result.results.every(item => item.amountMinor === 2000 && !item.rankable)).toBe(true);
    expect(result.recommendation).toMatchObject({ status: 'none', cardIds: [], reason: 'pay-in-full-required' });
  });
  it.each(['statement-credit', 'store-credit'])('calculates %s in its own group without cash ranking', type => {
    const result = first(program('a', { reward: reward({ type }) }));
    expect(result).toMatchObject({ amountMinor: 2000, rankable: false, rewardType: type });
    expect(codes(result)).toContain('non-cash-reward');
  });
  it('does not convert points or mismatched units to money', () => {
    for (const changes of [{ type: 'points', unit: 'points' }, { type: 'cash', unit: 'points' }, { type: 'store-credit', unit: 'USD' }]) {
      const result = first(program('a', { reward: reward(changes) }));
      expect(result.amountMinor).toBeNull(); expect(codes(result)).toContain('unsupported-reward-unit');
    }
  });
  it('keeps temporary, welcome and redemption-cost uncertainty outside regular ranking', () => {
    for (const changes of [{ kind: 'temporary' }, { kind: 'welcome' }, { reward: reward({ redemptionCosts: 'unknown' }) }]) expect(first(program('a', changes))).toMatchObject({ amountMinor: 2000, rankable: false });
    expect(first(program('a', { kind: 'temporary', validThrough: null })).amountMinor).toBeNull();
  });
  it('does not sum or silently select overlapping cash programs, including an unconfirmed variant', () => {
    for (const overrides of [{}, { conditions: [{ id: 'member', label: 'Member' }] }, { calculation: null }]) {
      const result = run([program('a'), program('a', { id: 'variant-a', ...overrides }), program('b')], context({ ownedCardIds: ['a', 'b'] }));
      expect(result.results.filter(item => item.cardId === 'a').every(item => !item.rankable && codes(item).includes('overlapping-programs'))).toBe(true);
      expect(result.recommendation).toMatchObject({ status: 'none', evaluatedCardIds: ['b'], excludedCardIds: ['a'] });
    }
  });
  it('does not let separate rewards or explicitly ineligible variants block regular cash', () => {
    for (const overrides of [{ reward: reward({ type: 'points', unit: 'points' }) }, { reward: reward({ type: 'store-credit' }) }, { kind: 'welcome' }, { calculation: rule({ excludedCategoryIds: ['groceries'] }) }]) {
      const result = run([program('a'), program('a', { id: 'other-a', ...overrides }), program('b')], context({ ownedCardIds: ['a', 'b'] }));
      expect(result.results[0].rankable).toBe(true);
      expect(result.recommendation.status).toBe('tie');
    }
  });
  it('rejects duplicate program identity instead of arbitrarily selecting a version', () => {
    const result = run([program(), program('a', { calculation: rule({ defaultRateBps: 600 }) })]);
    expect(result.results.every(item => item.status === 'conflict' && item.amountMinor === null)).toBe(true);
  });
});

describe('invalid input, purity and determinism', () => {
  it.each([
    [{ amountMinor: 0 }, 'invalid-amount'], [{ amountMinor: -1 }, 'invalid-amount'], [{ amountMinor: 2.5 }, 'invalid-amount'], [{ amountMinor: NaN }, 'invalid-amount'], [{ amountMinor: Infinity }, 'invalid-amount'], [{ amountMinor: Number.MAX_SAFE_INTEGER + 1 }, 'invalid-amount'], [{ amountMinor: '1000' }, 'invalid-amount'],
    [{ currency: 'USD' }, 'invalid-currency'], [{ purchaseDate: '2026-02-30' }, 'invalid-purchase-date'], [{ categoryId: 'unknown' }, 'invalid-category'], [{ channel: 'web' }, 'invalid-channel'], [{ paymentMode: false }, 'invalid-payment-mode'], [{ payInFull: true }, 'invalid-pay-in-full'], [{ ownedCardIds: ['a', 'a'] }, 'invalid-owned-card-ids'], [{ merchantId: {} }, 'invalid-merchant'],
  ])('returns structured errors with no fictitious results: %j', (changes, code) => {
    const result = run([program()], context(changes));
    expect(result).toMatchObject({ status: 'invalid', results: [], recommendation: { status: 'none', cardIds: [] } });
    expect(result.errors).toContainEqual({ code });
  });
  it('requires an explicit valid evaluation date rather than reading the wall clock', () => {
    expect(evaluateCardBenefits([program()], context()).errors).toContainEqual({ code: 'invalid-as-of' });
    expect(run([program()], context(), '2026-02-30').status).toBe('invalid');
  });
  it('handles malformed root inputs without throwing', () => {
    expect(evaluateCardBenefits(null, null, { asOf: AS_OF }).status).toBe('invalid');
    expect(run([null, 7], context()).results[0].reasons).toContainEqual({ code: 'missing-rule' });
  });
  it('does not mutate programs, context, cap state or nested source records', () => {
    const programs = freeze([program('a', { calculation: rule({ cap: cap() }) }), program('b')]);
    const purchase = freeze(context({ ownedCardIds: ['a', 'b'], caps: { 'shared-month': period() } }));
    const before = JSON.stringify({ programs, purchase });
    const result = run(programs, purchase);
    expect(run(programs, purchase)).toEqual(result);
    result.results[0].sources[0].title = 'Changed output';
    result.recommendation.cardIds.push('changed-output');
    expect(JSON.stringify({ programs, purchase })).toBe(before);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
  it('has Spanish labels for emitted input, result and recommendation codes', () => {
    const outcomes = [run([program()]), run([program('a', { calculation: rule({ cap: cap() }) })]), run([], context({ amountMinor: 0 }))];
    for (const result of outcomes) for (const code of [...result.errors.map(item => item.code), ...result.results.flatMap(item => codes(item)), result.recommendation.reason]) expect(BENEFIT_REASON_LABELS[code]).toBeTruthy();
  });
});
