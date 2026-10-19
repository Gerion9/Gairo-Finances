import { describe, expect, it } from 'vitest';
import { applyCardChoiceDraft, canConfirmCardBenefit, cardChoiceCapsContext, cardChoiceEditorIsDirty, cardChoiceMonthBounds, createCardChoiceEditor, discardCardChoiceDraft, invalidateCardChoiceCaps, requestCardChoiceAction, validateCardChoiceDraft } from './cardChoiceInteraction.js';
import { evaluateCardBenefits } from './cardBenefits.js';

// Synthetic contract fixture; this is not a real card or a published benefit.
const program = {
  id: 'test-benefit', cardId: 'test-card', name: 'Synthetic benefit', summary: 'Synthetic conditions',
  status: 'verified', kind: 'ongoing', reviewedOn: '2026-10-18', reviewDueOn: '2026-11-18',
  validFrom: '2026-10-01', validThrough: '2026-12-31',
  sources: [{ title: 'Synthetic terms', url: 'https://example.test/terms' }],
  reward: { type: 'cash', unit: 'MXN', redemptionSummary: 'Synthetic cash payout', redemptionCosts: 'none' },
  conditions: [{ id: 'enrolled', label: 'Enrollment confirmed' }, { id: 'account', label: 'Linked account confirmed' }],
  calculation: { type: 'percent', defaultRateBps: 200, rates: [], channels: ['in-person'], paymentModes: ['single'], eligibleMerchantIds: null, excludedMerchantIds: [], excludedCategoryIds: [], rounding: 'unknown', cap: { id: 'test-cap', unit: 'reward', limitMinor: 5000, period: 'calendar-month', scopeLabel: 'Synthetic monthly cap', afterCapRateBps: 0 } },
};
const date = '2026-10-18';
const knownCap = { state: 'remaining', remaining: '0', ...cardChoiceMonthBounds(date), stale: false };
const answered = { enrolled: 'yes', account: 'yes' };
function dirtyEditor() {
  const editor = createCardChoiceEditor(program);
  return { ...editor, draft: { ...editor.draft, conditions: { ...editor.draft.conditions, enrolled: 'yes' } } };
}
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

describe('isolated benefit answer drafts', () => {
  it('starts unknown, without assuming enrollment or a full cap', () => {
    const editor = createCardChoiceEditor(program);
    expect(editor.draft.conditions).toEqual({ enrolled: 'unknown', account: 'unknown' });
    expect(editor.draft.cap).toMatchObject({ state: 'unknown', remaining: '', periodStart: '', periodEnd: '' });
    expect(cardChoiceEditorIsDirty(editor)).toBe(false);
  });
  it('copies applied answers without sharing editable references', () => {
    const conditions = freeze({ [program.id]: answered, other: { flag: 'yes' } });
    const caps = freeze({ 'test-cap': knownCap });
    const editor = createCardChoiceEditor(program, conditions, caps);
    editor.draft.conditions.enrolled = 'no';
    editor.draft.cap.remaining = '12';
    expect(conditions[program.id].enrolled).toBe('yes');
    expect(caps['test-cap'].remaining).toBe('0');
    expect(editor.original.conditions.enrolled).toBe('yes');
    expect(editor.original.cap.remaining).toBe('0');
    expect(cardChoiceEditorIsDirty(editor)).toBe(true);
  });
  it.each([{ type: 'editor', programId: 'other' }, { type: 'purchase', field: 'amount', value: '75' }, { type: 'selection', id: 'other' }, { type: 'compare' }])('holds a requested action while the draft is dirty: %j', action => {
    const editor = dirtyEditor();
    const requested = requestCardChoiceAction({ editor, pendingAction: null }, action);
    expect(requested.action).toBeNull();
    expect(requested.state.editor).toBe(editor);
    expect(requested.state.pendingAction).toEqual(action);
    expect(editor.draft.conditions.enrolled).toBe('yes');
  });
  it('cancels only the draft, and continues a pending action only after explicit discard', () => {
    const action = { type: 'purchase', field: 'amount', value: '75' };
    const state = freeze({ editor: dirtyEditor(), pendingAction: action });
    expect(discardCardChoiceDraft(state)).toEqual({ state: { editor: null, pendingAction: null }, action: null });
    expect(discardCardChoiceDraft(state, true).action).toBe(action);
    expect(state.editor.draft.conditions.enrolled).toBe('yes');
  });
  it('allows a clean editor to yield without a discard prompt', () => {
    const action = { type: 'editor', programId: 'other' };
    expect(requestCardChoiceAction({ editor: createCardChoiceEditor(program), pendingAction: null }, action)).toEqual({ state: { editor: null, pendingAction: null }, action });
  });
});

describe('answer application and cap validation', () => {
  it('does not partially apply conditions when the remaining amount is invalid', () => {
    const conditions = freeze({ other: { flag: 'yes' } });
    const caps = freeze({ other: knownCap });
    const draft = freeze({ conditions: answered, cap: { ...knownCap, remaining: '50.01' } });
    const applied = applyCardChoiceDraft(program, draft, date, conditions, caps);
    expect(applied.valid).toBe(false);
    expect(applied.errors['cap-remaining']).toBeTruthy();
    expect(applied.conditions).toBe(conditions);
    expect(applied.caps).toBe(caps);
    expect(draft.cap.remaining).toBe('50.01');
  });
  it('accepts an explicitly confirmed zero and preserves unrelated applied answers', () => {
    const conditions = freeze({ other: { flag: 'no' } });
    const caps = freeze({ other: knownCap });
    const applied = applyCardChoiceDraft(program, { conditions: answered, cap: knownCap }, date, conditions, caps);
    expect(applied.valid).toBe(true);
    expect(applied.conditions.other).toBe(conditions.other);
    expect(applied.caps.other).toBe(caps.other);
    expect(cardChoiceCapsContext(applied.caps)['test-cap']).toMatchObject({ state: 'remaining', remainingMinor: 0 });
    expect(conditions[program.id]).toBeUndefined();
  });
  it('retains unknown as unknown even if old amounts and dates remain in the draft', () => {
    const draft = { conditions: { enrolled: 'unknown', account: 'no' }, cap: { ...knownCap, state: 'unknown', remaining: 'not confirmed' } };
    const applied = applyCardChoiceDraft(program, draft, date, {}, {});
    expect(applied.valid).toBe(true);
    expect(cardChoiceCapsContext(applied.caps)['test-cap']).toEqual({ state: 'unknown', remainingMinor: null, periodStart: null, periodEnd: null });
  });
  it('rejects a calendar cap for the wrong month on the visible cap control', () => {
    const checked = validateCardChoiceDraft(program, { conditions: answered, cap: { ...knownCap, ...cardChoiceMonthBounds('2026-09-18') } }, date);
    expect(Object.keys(checked.errors)).toEqual(['cap-state']);
  });
  it('requires both statement boundaries to contain the purchase', () => {
    const statement = { ...program, calculation: { ...program.calculation, cap: { ...program.calculation.cap, period: 'statement' } } };
    expect(validateCardChoiceDraft(statement, { conditions: answered, cap: { ...knownCap, periodStart: '2026-10-19', periodEnd: '2026-10-17' } }, date).errors).toMatchObject({ 'cap-start': expect.any(String), 'cap-end': expect.any(String) });
    expect(validateCardChoiceDraft(statement, { conditions: answered, cap: { ...knownCap, periodStart: '2026-09-19', periodEnd: date } }, date).valid).toBe(true);
  });
  it('invalidates a confirmed period after a date change without reinterpreting its remaining amount', () => {
    const caps = freeze({ 'test-cap': { ...knownCap, remaining: '12.50' } });
    const next = invalidateCardChoiceCaps(caps, [program], date, '2026-11-01');
    expect(next['test-cap']).toMatchObject({ state: 'unknown', stale: true, remaining: '12.50', periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    expect(caps['test-cap'].state).toBe('remaining');
    expect(invalidateCardChoiceCaps(caps, [program], date, '2026-10-19')['test-cap']).toBe(caps['test-cap']);
  });
  it('uses real month boundaries including leap years and rejects malformed dates', () => {
    expect(cardChoiceMonthBounds('2028-02-15').periodEnd).toBe('2028-02-29');
    expect(cardChoiceMonthBounds('2026-02-30')).toEqual({ periodStart: '', periodEnd: '' });
  });
  it('never accepts an invented condition response', () => {
    expect(validateCardChoiceDraft(program, { conditions: { ...answered, enrolled: 'maybe' }, cap: knownCap }, date).errors['condition-enrolled']).toBeTruthy();
  });
});

describe('engine-driven progressive confirmation', () => {
  const context = { ownedCardIds: ['test-card'], amountMinor: 100000, currency: 'MXN', purchaseDate: date, categoryId: 'groceries', merchantId: null, channel: 'in-person', paymentMode: 'single', payInFull: 'yes', conditions: {}, caps: {} };
  const run = overrides => evaluateCardBenefits([program], { ...context, ...overrides }, { asOf: date });
  it('moves from unknown conditions to an unknown cap, then to the engine zero result', () => {
    const initial = run({}).results[0];
    expect(initial.status).toBe('needs-confirmation');
    expect(canConfirmCardBenefit(initial, program)).toBe(true);
    const answeredOnly = applyCardChoiceDraft(program, { conditions: answered, cap: createCardChoiceEditor(program).draft.cap }, date, {}, {});
    const capped = run({ conditions: answeredOnly.conditions, caps: cardChoiceCapsContext(answeredOnly.caps) }).results[0];
    expect(capped).toMatchObject({ status: 'up-to', amountMinor: null });
    const zero = applyCardChoiceDraft(program, { conditions: answered, cap: knownCap }, date, answeredOnly.conditions, answeredOnly.caps);
    const final = run({ conditions: zero.conditions, caps: cardChoiceCapsContext(zero.caps) });
    expect(final.results[0]).toMatchObject({ status: 'estimate', amountMinor: 0 });
    expect(final.recommendation.reason).toBe('no-positive-benefit');
  });
  it('offers an editor for a condition that excluded a program without inferring eligibility itself', () => {
    const row = run({ conditions: { [program.id]: { enrolled: 'no', account: 'unknown' } } }).results[0];
    expect(row.status).toBe('ineligible');
    expect(canConfirmCardBenefit(row, program)).toBe(true);
  });
  it.each(['missing-rule', 'stale-review', 'outside-validity', 'missing-category-rule', 'unsupported-channel'])('does not offer answers that cannot repair %s', code => {
    expect(canConfirmCardBenefit({ status: 'descriptive', reasons: [{ code }] }, program)).toBe(false);
  });
  it('does not allow confirmation to manufacture verified rules', () => {
    expect(canConfirmCardBenefit({ status: 'needs-confirmation', reasons: [{ code: 'condition-required' }] }, { ...program, status: 'incomplete', calculation: null })).toBe(false);
    expect(canConfirmCardBenefit({ status: 'descriptive', reasons: [{ code: 'missing-rule' }] }, undefined)).toBe(false);
  });
});
