import { isValidTransactionDate, moneyToCents } from './transactionAnalytics.js';

export const EMPTY_CHOICE_CAP = { state: 'unknown', remaining: '', periodStart: '', periodEnd: '', stale: false };

export function cardChoiceMonthBounds(date) {
  if (!isValidTransactionDate(date)) return { periodStart: '', periodEnd: '' };
  const [year, month] = date.split('-').map(Number);
  return { periodStart: `${date.slice(0, 7)}-01`, periodEnd: `${date.slice(0, 7)}-${new Date(year, month, 0).getDate()}` };
}

export function canConfirmCardBenefit(row, program) {
  if (!program || program.status !== 'verified' || !program.calculation || !(program.conditions?.length || program.calculation.cap)) return false;
  if (['calculated', 'estimate', 'up-to'].includes(row.status)) return true;
  return (row.reasons || []).some(reason => ['condition-required', 'condition-not-met', 'cap-unknown', 'cap-period-required', 'cap-invalid'].includes(reason.code));
}

export function createCardChoiceEditor(program, conditions = {}, caps = {}) {
  const draft = {
    conditions: Object.fromEntries((program.conditions || []).map(condition => [condition.id, conditions[program.id]?.[condition.id] || 'unknown'])),
    cap: program.calculation?.cap ? { ...EMPTY_CHOICE_CAP, ...caps[program.calculation.cap.id] } : null,
  };
  return { programId: program.id, original: draft, draft: { conditions: { ...draft.conditions }, cap: draft.cap ? { ...draft.cap } : null }, errors: {} };
}

export function cardChoiceEditorIsDirty(editor) {
  return Boolean(editor && JSON.stringify(editor.original) !== JSON.stringify(editor.draft));
}

/** A dirty draft holds the requested action until the user explicitly resolves it. */
export function requestCardChoiceAction(state, action) {
  return cardChoiceEditorIsDirty(state.editor)
    ? { state: { ...state, pendingAction: action }, action: null }
    : { state: { editor: null, pendingAction: null }, action };
}

export function discardCardChoiceDraft(state, continueAction = false) {
  return { state: { editor: null, pendingAction: null }, action: continueAction ? state.pendingAction : null };
}

export function validateCardChoiceDraft(program, draft, purchaseDate) {
  const errors = {};
  for (const condition of program.conditions || []) {
    if (!['yes', 'no', 'unknown'].includes(draft.conditions[condition.id])) errors[`condition-${condition.id}`] = 'Selecciona sí, no o no lo sé.';
  }
  const definition = program.calculation?.cap;
  const cap = draft.cap;
  if (definition) {
    if (!cap || !['full', 'remaining', 'unknown'].includes(cap.state)) errors['cap-state'] = 'Selecciona cuánto tope queda disponible.';
    else if (cap.state !== 'unknown') {
      const remaining = moneyToCents(cap.remaining);
      if (cap.state === 'remaining' && (remaining === null || remaining < 0 || remaining > definition.limitMinor)) errors['cap-remaining'] = 'Indica el tope restante entre cero y el límite publicado.';
      if (definition.period === 'calendar-month') {
        const expected = cardChoiceMonthBounds(purchaseDate);
        if (cap.periodStart !== expected.periodStart || cap.periodEnd !== expected.periodEnd) errors['cap-state'] = 'Confirma el tope del mes de esta compra.';
      } else {
        if (!isValidTransactionDate(cap.periodStart) || cap.periodStart > purchaseDate) errors['cap-start'] = 'Confirma el inicio de un periodo que incluya esta compra.';
        if (!isValidTransactionDate(cap.periodEnd) || cap.periodEnd < purchaseDate || cap.periodEnd < cap.periodStart) errors['cap-end'] = 'Confirma el fin de un periodo que incluya esta compra.';
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function applyCardChoiceDraft(program, draft, purchaseDate, conditions, caps) {
  const validation = validateCardChoiceDraft(program, draft, purchaseDate);
  if (!validation.valid) return { ...validation, conditions, caps };
  const definition = program.calculation?.cap;
  return {
    ...validation,
    conditions: { ...conditions, [program.id]: { ...draft.conditions } },
    caps: definition ? { ...caps, [definition.id]: { ...draft.cap, stale: false } } : caps,
  };
}

export function cardChoiceCapsContext(caps) {
  return Object.fromEntries(Object.entries(caps).map(([id, cap]) => [id, {
    state: cap.state,
    remainingMinor: cap.state === 'remaining' ? moneyToCents(cap.remaining) : null,
    periodStart: cap.state === 'unknown' ? null : cap.periodStart,
    periodEnd: cap.state === 'unknown' ? null : cap.periodEnd,
  }]));
}

export function invalidateCardChoiceCaps(caps, programs, previousDate, nextDate) {
  return Object.fromEntries(Object.entries(caps).map(([id, cap]) => {
    const definition = programs.map(program => program.calculation?.cap).find(item => item?.id === id);
    const changedPeriod = definition?.period === 'calendar-month'
      ? previousDate.slice(0, 7) !== nextDate.slice(0, 7)
      : !isValidTransactionDate(nextDate) || nextDate < cap.periodStart || nextDate > cap.periodEnd;
    return [id, changedPeriod && cap.state !== 'unknown' ? { ...cap, state: 'unknown', stale: true } : cap];
  }));
}
