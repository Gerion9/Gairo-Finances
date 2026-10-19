import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, ChevronDown, CreditCard, Search, X } from 'lucide-react';
import { BENEFIT_CATEGORY_IDS, BENEFIT_REASON_LABELS, evaluateCardBenefits } from '../services/cardBenefits';
import { filterCreditCards, formatCatalogDate, localCatalogDate, sourceUrl } from '../services/creditCatalog';
import { isValidTransactionDate, moneyToCents } from '../services/transactionAnalytics';
import { applyCardChoiceDraft, canConfirmCardBenefit, cardChoiceCapsContext, cardChoiceEditorIsDirty, cardChoiceMonthBounds, createCardChoiceEditor, discardCardChoiceDraft, invalidateCardChoiceCaps, requestCardChoiceAction } from '../services/cardChoiceInteraction';
import './CardChoiceWorkbench.css';

const CATEGORY_LABELS = { pharmacies: 'Farmacias', restaurants: 'Restaurantes', telecom: 'Telecomunicaciones', groceries: 'Supermercado', fuel: 'Gasolina', travel: 'Viajes', education: 'Educación', other: 'Otra compra' };
const CHANNEL_LABELS = { 'in-person': 'En el establecimiento', 'online-direct': 'En la web o app del comercio', aggregator: 'En una plataforma intermediaria', unknown: 'No lo sé' };
const PAYMENT_LABELS = { single: 'Una sola exhibición', installments: 'A plazos', unknown: 'No lo sé' };
const CONFIRM_OPTIONS = [{ value: 'unknown', label: 'No lo sé' }, { value: 'yes', label: 'Sí' }, { value: 'no', label: 'No' }];
const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amountLabel = minor => MONEY.format(minor / 100);
const isCalculated = row => ['calculated', 'estimate'].includes(row.status);
const isConditional = row => ['up-to', 'needs-confirmation'].includes(row.status);
const isSeparateReward = row => ['statement-credit', 'store-credit', 'points'].includes(row.rewardType);

function relevantProgram(program, purchase, today) {
  const calculation = program.calculation;
  if (program.status !== 'verified' || !calculation || !purchase.categoryId || !isValidTransactionDate(purchase.purchaseDate)) return false;
  if (program.reviewedOn > today || (program.reviewDueOn && program.reviewDueOn < today)) return false;
  if ((program.validFrom && program.validFrom > purchase.purchaseDate) || (program.validThrough && program.validThrough < purchase.purchaseDate)) return false;
  if (calculation.excludedCategoryIds?.includes(purchase.categoryId)) return false;
  if (purchase.channel !== 'unknown' && !calculation.channels?.includes(purchase.channel)) return false;
  if (purchase.paymentMode !== 'unknown' && !calculation.paymentModes?.includes(purchase.paymentMode)) return false;
  return calculation.defaultRateBps != null || calculation.rates?.some(rate => rate.categoryIds?.includes(purchase.categoryId));
}

function reasonText(reason, program) {
  const condition = program?.conditions?.find(item => item.id === reason.conditionId);
  if (condition && reason.code === 'condition-required') return `Falta confirmar: ${condition.label}`;
  if (condition && reason.code === 'condition-not-met') return `No se cumple: ${condition.label}`;
  return BENEFIT_REASON_LABELS[reason.code] || 'Esta condición necesita revisión en la fuente del programa.';
}

function BenefitRow({ row, program, card, context, onOpenCard, rowId, editor, onConfirm }) {
  const sources = (row.sources || []).flatMap(source => {
    const url = sourceUrl(source.url);
    return url ? [{ ...source, url }] : [];
  });
  const monetaryReward = ['cash', 'statement-credit', 'store-credit'].includes(row.rewardType);
  const cashAmount = monetaryReward && Number.isSafeInteger(row.amountMinor) ? `${amountLabel(row.amountMinor)} MXN` : null;
  const maximum = monetaryReward && Number.isSafeInteger(row.maximumMinor) ? `Hasta ${amountLabel(row.maximumMinor)} MXN` : null;
  const value = row.rewardType === 'points' ? 'Beneficio en puntos' : cashAmount || maximum;
  const reasons = (row.reasons || []).map(reason => reasonText(reason, program));
  const cap = program?.calculation?.cap;
  const confirmedCap = cap ? context.caps[cap.id] : null;
  return <li className="card-choice-result-row">
    <div className="card-choice-result-row-header"><div><h5 id={`${rowId}-heading`} tabIndex={-1}>{card?.name || 'Producto ya no disponible en el catálogo'}</h5>{card?.issuer && <p className="card-choice-issuer">{card.issuer}</p>}</div>{value && <div className="card-choice-result-value"><p className="card-choice-result-amount" data-sensitive>{value}</p>{program?.reward?.displayLabel && <p className="card-choice-reward-label">{program.reward.displayLabel}</p>}</div>}</div>
    {program && <p className="card-choice-result-rule"><strong>{program.name}</strong>{program.summary ? ` · ${program.summary}` : ''}</p>}
    {!value && program?.reward?.displayLabel && <p className="card-choice-reward-label">{program.reward.displayLabel}</p>}
    {program?.reward?.redemptionSummary && <p className="card-choice-result-rule">{program.reward.redemptionSummary}</p>}
    {row.status === 'up-to' && <p className="card-choice-result-rule">Sujeto a las condiciones y al tope disponible.</p>}
    {reasons.length > 0 && <ul className="card-choice-result-reasons">{[...new Set(reasons)].map(reason => <li key={reason}>{reason}</li>)}</ul>}
    {canConfirmCardBenefit(row, program) && <button id={`${rowId}-confirm`} type="button" className="card-choice-confirm" aria-expanded={Boolean(editor)} aria-controls={editor ? `${rowId}-editor` : undefined} onClick={onConfirm}>{isCalculated(row) ? 'Revisar condiciones' : 'Confirmar condiciones'}<ArrowRight size={16} aria-hidden="true" /></button>}
    {editor}
    <details className="card-choice-explanation"><summary>Cómo se calculó<ChevronDown size={15} aria-hidden="true" /></summary><div className="card-choice-explanation-body">
      <p>Importe de la compra: {amountLabel(context.amountMinor)} MXN.</p>
      {Number.isInteger(row.rateBps) && <p>Tasa de beneficio aplicable: {new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(row.rateBps / 100)}% de la compra elegible.</p>}
      {row.assumptions?.length > 0 && <ul>{row.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>}
      {cap && <><p>Tope publicado: {amountLabel(cap.limitMinor)} MXN {cap.unit === 'spend' ? 'de compras elegibles' : 'de beneficio'} · {cap.period === 'calendar-month' ? 'mes calendario' : 'periodo de estado de cuenta'}. {cap.scopeLabel}</p><p>{confirmedCap && confirmedCap.state !== 'unknown' ? `Disponible confirmado: ${amountLabel(confirmedCap.state === 'full' ? cap.limitMinor : confirmedCap.remainingMinor)} MXN. Periodo: ${formatCatalogDate(confirmedCap.periodStart)} al ${formatCatalogDate(confirmedCap.periodEnd)}.` : 'Disponibilidad del tope sin confirmar.'}</p></>}
      {program?.conditions?.length > 0 && <ul>{program.conditions.map(condition => <li key={condition.id}>{condition.label}: {context.conditions[program.id]?.[condition.id] === 'yes' ? 'sí' : context.conditions[program.id]?.[condition.id] === 'no' ? 'no' : 'por confirmar'}.</li>)}</ul>}
      {!cashAmount && !maximum && <p>No se asigna un valor de cero a la información que falta o no puede calcularse para esta compra.</p>}
      <p className="card-choice-source-date">Fuente revisada: {formatCatalogDate(program?.reviewedOn)}{program?.validThrough ? ` · Vigencia publicada hasta ${formatCatalogDate(program.validThrough)}` : ''}{program?.reviewDueOn ? ` · Próxima revisión: ${formatCatalogDate(program.reviewDueOn)}` : ''}</p>
      {sources.length ? <ul className="card-choice-sources">{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || 'Fuente del emisor'}<ArrowUpRight size={14} aria-hidden="true" /><span className="card-choice-sr-only"> (abre en otra pestaña)</span></a></li>)}</ul> : <p>Fuente del beneficio por verificar.</p>}
    </div></details>
    {card && onOpenCard && <button type="button" className="card-choice-text-action" onClick={() => onOpenCard(card.id)}>Ver ficha de la tarjeta<ArrowUpRight size={15} aria-hidden="true" /></button>}
  </li>;
}

function BenefitAnswerEditor({ id, program, row, editor, pendingAction, purchaseDate, reducedMotion, onChange, onApply, onCancel, onDiscard, onContinue, focusRef }) {
  const definition = program.calculation?.cap;
  const { draft, errors } = editor;
  const fieldId = field => `${id}-${field}`;
  const fieldError = field => errors[field] && <p id={`${fieldId(field)}-error`} className="card-choice-error">{errors[field]}</p>;
  const fieldA11y = field => ({ id: fieldId(field), 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${fieldId(field)}-error` : undefined });
  const pendingConditions = (program.conditions || []).filter(condition => editor.original.conditions[condition.id] === 'unknown' || row.reasons.some(reason => reason.conditionId === condition.id && ['condition-required', 'condition-not-met'].includes(reason.code)));
  const previousConditions = (program.conditions || []).filter(condition => !pendingConditions.includes(condition));
  const pendingCap = definition && (editor.original.cap.state === 'unknown' || editor.original.cap.stale || row.reasons.some(reason => reason.capId === definition.id));
  const conditionField = condition => <div className="card-choice-field" key={condition.id}><label htmlFor={fieldId(`condition-${condition.id}`)}>{condition.label}</label><select {...fieldA11y(`condition-${condition.id}`)} value={draft.conditions[condition.id]} onChange={event => onChange('condition', condition.id, event.target.value)}>{CONFIRM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{fieldError(`condition-${condition.id}`)}</div>;
  const capFields = definition && <div className="card-choice-cap-fields">
    <h6>Tope disponible</h6>
    <p className="card-choice-help">{amountLabel(definition.limitMinor)} MXN {definition.unit === 'spend' ? 'en compras elegibles' : 'de beneficio'} por {definition.period === 'calendar-month' ? 'mes calendario' : 'periodo de estado de cuenta'}. {definition.scopeLabel}</p>
    {draft.cap.stale && <p className="card-choice-stale">Cambió el periodo de la compra. Confirma el tope disponible de {definition.period === 'calendar-month' ? formatCatalogDate(purchaseDate) : 'tu estado de cuenta'}.</p>}
    <div className="card-choice-field"><label htmlFor={fieldId('cap-state')}>Cuánto queda de ese tope</label><select {...fieldA11y('cap-state')} value={draft.cap.state} onChange={event => onChange('cap', 'state', event.target.value)}><option value="unknown">No lo sé</option><option value="full">Tengo el tope completo disponible</option><option value="remaining">Sé cuánto me queda</option></select>{fieldError('cap-state')}</div>
    {draft.cap.state === 'remaining' && <div className="card-choice-field"><label htmlFor={fieldId('cap-remaining')}>Tope restante en MXN {definition.unit === 'spend' ? 'de compras' : 'de beneficio'}</label><input {...fieldA11y('cap-remaining')} type="number" inputMode="decimal" min="0" step="0.01" value={draft.cap.remaining} onChange={event => onChange('cap', 'remaining', event.target.value)} placeholder="Importe confirmado; cero es válido" />{fieldError('cap-remaining')}</div>}
    {draft.cap.state !== 'unknown' && definition.period === 'statement' && [['periodStart', 'cap-start', 'Inicio'], ['periodEnd', 'cap-end', 'Fin']].map(([field, key, label]) => <div className="card-choice-field" key={field}><label htmlFor={fieldId(key)}>{label} del periodo del estado de cuenta</label><input {...fieldA11y(key)} type="date" lang="es-MX" value={draft.cap[field]} onChange={event => onChange('cap', field, event.target.value)} aria-describedby={`${fieldId(key)}-help${errors[key] ? ` ${fieldId(key)}-error` : ''}`} /><small id={`${fieldId(key)}-help`}>{isValidTransactionDate(draft.cap[field]) ? formatCatalogDate(draft.cap[field]) : 'Selecciona día, mes y año.'}</small>{fieldError(key)}</div>)}
    {draft.cap.state !== 'unknown' && definition.period === 'calendar-month' && <p className="card-choice-session">Periodo confirmado: {formatCatalogDate(draft.cap.periodStart)} al {formatCatalogDate(draft.cap.periodEnd)}.</p>}
  </div>;
  return <motion.form id={id} className="card-choice-answer-editor" aria-label={`Condiciones de ${program.name}`} onFocusCapture={() => { focusRef.current = true; }} onBlurCapture={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focusRef.current = false; }} onSubmit={event => { event.preventDefault(); onApply(); }} noValidate initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
    <h6 tabIndex={-1} id={`${id}-title`}>Confirma lo que sabes de este programa</h6>
    <p className="card-choice-help">Estas respuestas se usan para esta comparación. Puedes dejar como «No lo sé» lo que aún no has confirmado.</p>
    {pendingConditions.map(conditionField)}
    {pendingCap && capFields}
    {(previousConditions.length > 0 || (definition && !pendingCap)) && <details className="card-choice-program-conditions"><summary>Revisar respuestas anteriores<ChevronDown size={16} aria-hidden="true" /></summary>{previousConditions.map(conditionField)}{definition && !pendingCap && capFields}</details>}
    {errors.form && <p id={fieldId('form')} tabIndex={-1} className="card-choice-form-error" role="alert">{errors.form}</p>}
    {pendingAction && <div className="card-choice-draft-guard" role="alert"><p>Hay respuestas por aplicar. Aplica o descarta este borrador para continuar con el cambio solicitado.</p><div className="card-choice-editor-actions"><button type="submit" className="card-choice-confirm">Aplicar respuestas</button><button type="button" className="card-choice-text-action" onClick={onDiscard}>Descartar cambios</button><button type="button" className="card-choice-text-action" onClick={onContinue}>Seguir editando</button></div></div>}
    {!pendingAction && <div className="card-choice-editor-actions"><button type="submit" className="card-choice-confirm">Aplicar respuestas</button><button type="button" className="card-choice-text-action" onClick={onCancel}>Cancelar</button></div>}
  </motion.form>;
}

export default function CardChoiceWorkbench({ cards = [], programs = [], selectedIds = [], onSelectedIdsChange, selectionReadOnly = false, onOpenCard, onNavigate, active = true }) {
  const baseId = useId();
  const sectionRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const canFocus = () => activeRef.current && sectionRef.current && !sectionRef.current.closest('[hidden], [inert]');
  const resultHeading = useRef(null);
  const editorHadFocus = useRef(false);
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [purchase, setPurchase] = useState(() => ({ amount: '', purchaseDate: localCatalogDate(), categoryId: '', channel: 'unknown', merchantName: '', paymentMode: 'unknown', payInFull: 'unknown' }));
  const [conditions, setConditions] = useState({});
  const [caps, setCaps] = useState({});
  const [errors, setErrors] = useState({});
  const [comparison, setComparison] = useState(null);
  const [interaction, setInteraction] = useState({ editor: null, pendingAction: null });
  const [notice, setNotice] = useState('');
  const today = localCatalogDate();
  const cardById = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards]);
  const programById = useMemo(() => new Map(programs.map(program => [program.id, program])), [programs]);
  const selectedCards = selectedIds.map(id => cardById.get(id) || { id, name: 'Producto ya no disponible en el catálogo', unavailable: true });
  const filteredCards = useMemo(() => filterCreditCards(cards, { query }), [cards, query]);
  const availablePrograms = programs.filter(program => cardById.has(program.cardId));
  const selectedPrograms = availablePrograms.filter(program => selectedIds.includes(program.cardId));
  const relevantPrograms = selectedPrograms.filter(program => relevantProgram(program, purchase, today));
  const needsMerchant = relevantPrograms.some(program => program.calculation.eligibleMerchantIds?.length || program.calculation.excludedMerchantIds?.length);
  const signature = JSON.stringify({ selectedIds, purchase, conditions, caps, today, programs: availablePrograms });
  const stale = comparison !== null && comparison.signature !== signature;
  const dirtyEditor = cardChoiceEditorIsDirty(interaction.editor);
  const orphanedDraft = dirtyEditor && (stale || Boolean(interaction.editor?.detached));
  const result = comparison && !stale && !orphanedDraft ? comparison.result : null;
  const rowId = row => `${baseId}-benefit-${encodeURIComponent(row.cardId)}-${encodeURIComponent(row.programId || 'no-rule')}`;
  const fieldId = field => `${baseId}-${field}`;
  const fieldError = field => errors[field] && <p id={`${fieldId(field)}-error`} className="card-choice-error">{errors[field]}</p>;
  const fieldA11y = field => ({ id: fieldId(field), 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${fieldId(field)}-error` : undefined });

  useEffect(() => {
    if (!stale || !interaction.editor || interaction.editor.detached) return;
    if (!dirtyEditor) setInteraction({ editor: null, pendingAction: null });
    else {
      setInteraction(previous => ({ editor: { ...previous.editor, detached: true }, pendingAction: null }));
      if (canFocus() && (editorHadFocus.current || document.activeElement?.disabled)) document.getElementById(`${baseId}-orphan-notice`)?.focus();
    }
  }, [stale, dirtyEditor, interaction.editor, baseId]);

  const focusElement = (id, scroll = false) => requestAnimationFrame(() => {
    if (!canFocus()) return;
    const target = document.getElementById(id);
    for (let parent = target?.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    target?.focus({ preventScroll: scroll });
    if (scroll) target?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
  });
  const evaluate = (nextConditions = conditions, nextCaps = caps) => {
    const context = { ownedCardIds: selectedIds, amountMinor: moneyToCents(purchase.amount), currency: 'MXN', purchaseDate: purchase.purchaseDate, categoryId: purchase.categoryId, merchantId: null, channel: purchase.channel, paymentMode: purchase.paymentMode, payInFull: purchase.payInFull, conditions: nextConditions, caps: cardChoiceCapsContext(nextCaps) };
    const evaluated = evaluateCardBenefits(availablePrograms, context, { asOf: today });
    return { result: evaluated, context, signature: JSON.stringify({ selectedIds, purchase, conditions: nextConditions, caps: nextCaps, today, programs: availablePrograms }), merchantName: purchase.merchantName };
  };
  const executeAction = (action, nextConditions = conditions, nextCaps = caps) => {
    if (action.type === 'editor') {
      const program = programById.get(action.programId);
      const row = result?.results.find(item => item.programId === action.programId);
      if (!program || !row || !canConfirmCardBenefit(row, program)) return;
      setInteraction({ editor: { ...createCardChoiceEditor(program, nextConditions, nextCaps), program, row, cardName: cardById.get(row.cardId)?.name || 'Producto ya no disponible en el catálogo' }, pendingAction: null });
      setNotice('');
      focusElement(`${rowId(row)}-editor-title`, true);
      return;
    }
    setInteraction({ editor: null, pendingAction: null });
    if (action.type === 'purchase') {
      if (action.field === 'purchaseDate') setCaps(invalidateCardChoiceCaps(nextCaps, programs, purchase.purchaseDate, action.value));
      setPurchase(previous => ({ ...previous, [action.field]: action.value }));
      setErrors(previous => ({ ...previous, [action.field]: undefined, form: undefined }));
      if (comparison) setNotice('La compra cambió. Vuelve a comparar.');
      if (action.restoreFocus) focusElement(fieldId(action.field));
    } else if (action.type === 'selection') {
      if (selectionReadOnly || !onSelectedIdsChange) return;
      onSelectedIdsChange(selectedIds.includes(action.id) ? selectedIds.filter(value => value !== action.id) : [...selectedIds, action.id]);
      setErrors(previous => ({ ...previous, selectedIds: undefined, form: undefined }));
      if (comparison) setNotice('La selección cambió. Vuelve a comparar.');
      if (action.restoreFocus) { setSelectionOpen(true); focusElement(fieldId('selectedIds')); }
    } else if (action.type === 'compare') runComparison(nextConditions, nextCaps);
  };
  const requestAction = action => {
    if (orphanedDraft) { focusElement(`${baseId}-orphan-notice`); return; }
    const requested = requestCardChoiceAction(interaction, dirtyEditor ? { ...action, restoreFocus: true } : action);
    setInteraction(requested.state);
    if (requested.action) executeAction(requested.action);
    else focusElement(`${rowId(interaction.editor.row)}-editor-title`, true);
  };
  const updatePurchase = (field, value) => requestAction({ type: 'purchase', field, value });
  const toggleCard = id => { if (!selectionReadOnly && onSelectedIdsChange) requestAction({ type: 'selection', id }); };
  const updateAnswer = (kind, field, value) => setInteraction(previous => {
    const editor = previous.editor;
    if (!editor || orphanedDraft) return previous;
    const draft = editor.draft;
    const definition = editor.program.calculation.cap;
    const dates = kind === 'cap' && field === 'state' && value !== 'unknown' && definition.period === 'calendar-month' ? cardChoiceMonthBounds(purchase.purchaseDate) : {};
    return { ...previous, editor: { ...editor, errors: {}, draft: kind === 'condition' ? { ...draft, conditions: { ...draft.conditions, [field]: value } } : { ...draft, cap: { ...draft.cap, ...dates, [field]: value, stale: field === 'state' ? false : draft.cap.stale } } } };
  });
  const cancelAnswers = (continueAction = false) => {
    const current = interaction.editor;
    const discarded = discardCardChoiceDraft(interaction, continueAction);
    setInteraction(discarded.state);
    if (discarded.action) executeAction(discarded.action);
    else if (current) focusElement(`${rowId(current.row)}-confirm`);
  };
  const applyAnswers = () => {
    if (!interaction.editor || stale || orphanedDraft) return;
    const editor = interaction.editor;
    const applied = applyCardChoiceDraft(editor.program, editor.draft, purchase.purchaseDate, conditions, caps);
    const evaluated = applied.valid ? evaluate(applied.conditions, applied.caps) : null;
    const validation = applied.valid && evaluated.result.status !== 'evaluated' ? { form: evaluated.result.errors.map(error => BENEFIT_REASON_LABELS[error.code] || 'Revisa las respuestas.').join(' ') } : applied.errors;
    if (Object.keys(validation).length) {
      setInteraction(previous => ({ ...previous, editor: { ...previous.editor, errors: validation } }));
      focusElement(`${rowId(editor.row)}-editor-${Object.keys(validation)[0]}`);
      return;
    }
    setConditions(applied.conditions);
    setCaps(applied.caps);
    setComparison(evaluated);
    setInteraction({ editor: null, pendingAction: null });
    setNotice('Respuestas aplicadas. Se actualizaron las opciones para esta compra.');
    if (interaction.pendingAction) executeAction(interaction.pendingAction, applied.conditions, applied.caps);
    else focusElement(`${rowId(editor.row)}-heading`, true);
  };
  const runComparison = (nextConditions = conditions, nextCaps = caps) => {
    const validation = {};
    const amountMinor = moneyToCents(purchase.amount);
    if (!selectedIds.length) validation.selectedIds = 'Marca al menos una tarjeta que puedas usar.';
    if (amountMinor === null || amountMinor <= 0) validation.amount = 'Ingresa un importe mayor a cero, con máximo dos decimales.';
    if (!isValidTransactionDate(purchase.purchaseDate)) validation.purchaseDate = 'Selecciona una fecha válida.';
    if (!BENEFIT_CATEGORY_IDS.includes(purchase.categoryId)) validation.categoryId = 'Selecciona el tipo de compra.';
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (validation.selectedIds) setSelectionOpen(true);
      const first = Object.keys(validation)[0];
      requestAnimationFrame(() => {
        if (!canFocus()) return;
        const target = document.getElementById(fieldId(first));
        for (let parent = target?.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
        target?.focus();
      });
      return;
    }
    const evaluated = evaluate(nextConditions, nextCaps);
    if (evaluated.result.status !== 'evaluated') {
      setErrors({ form: evaluated.result.errors.map(error => BENEFIT_REASON_LABELS[error.code] || 'Revisa los datos de la compra antes de comparar.').join(' ') });
      requestAnimationFrame(() => { if (canFocus()) document.getElementById(fieldId('form-error'))?.focus(); });
      return;
    }
    setComparison(evaluated);
    setNotice('');
    setSelectionOpen(false);
    requestAnimationFrame(() => { if (!canFocus()) return; resultHeading.current?.focus({ preventScroll: true }); resultHeading.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }); });
  };
  const compare = event => { event.preventDefault(); requestAction({ type: 'compare' }); };

  const rowGroups = result ? [
    { title: 'Beneficios calculables', rows: result.results.filter(row => row.rewardType === 'cash' && isCalculated(row)) },
    { title: 'Falta confirmar condiciones', rows: result.results.filter(row => !isSeparateReward(row) && isConditional(row)) },
    { title: 'Sin cálculo disponible', rows: result.results.filter(row => !isSeparateReward(row) && !(row.rewardType === 'cash' && isCalculated(row)) && !isConditional(row)) },
    { title: 'Créditos al estado de cuenta', rows: result.results.filter(row => row.rewardType === 'statement-credit') },
    { title: 'Saldo para comercios específicos', rows: result.results.filter(row => row.rewardType === 'store-credit') },
    { title: 'Puntos y sus condiciones de uso', rows: result.results.filter(row => row.rewardType === 'points') },
  ].filter(group => group.rows.length) : [];
  const coverage = result ? [...new Set(comparison.context.ownedCardIds)].reduce((counts, id) => {
    const rows = result.results.filter(row => row.cardId === id);
    if (rows.some(isCalculated)) counts.calculated += 1;
    else if (rows.some(isConditional)) counts.conditional += 1;
    else counts.unavailable += 1;
    return counts;
  }, { calculated: 0, conditional: 0, unavailable: 0 }) : null;
  const recommendation = result?.recommendation;
  const comparableIds = recommendation?.evaluatedCardIds || [];
  const leadIds = recommendation?.status === 'winner' || recommendation?.status === 'tie' ? recommendation.cardIds : comparableIds.length === 1 ? comparableIds : [];
  const leadRow = leadIds.length ? result?.results.find(row => row.cardId === leadIds[0] && row.rankable && Number.isSafeInteger(row.amountMinor)) : null;
  const financing = result && comparison.context.payInFull !== 'yes';
  const noPositiveBenefit = recommendation?.reason === 'no-positive-benefit';

  return <section ref={sectionRef} className="card-choice" aria-labelledby={`${baseId}-title`}>
    <h2 id={`${baseId}-title`}>Elige una tarjeta para esta compra</h2>
    <div className="card-choice-grid">
      <form className="card-choice-form" onSubmit={compare} noValidate>
        <fieldset><legend>Tus tarjetas disponibles</legend>
          <p className="card-choice-help">Marca las tarjetas que tienes y puedes usar. La selección no verifica tu crédito disponible ni registra deudas.</p>
          <p className="card-choice-session">Selección en este espacio.</p>
          {(selectionReadOnly || !onSelectedIdsChange) && <p id={`${baseId}-selection-readonly`} className="card-choice-help">La selección está en modo de lectura. Puedes ajustar la compra y consultar sus opciones.</p>}
          {selectedCards.length > 0 && <><ul className="card-choice-selected">{selectedCards.map(card => <li key={card.id}><span>{card.name}{card.unavailable && <small>{card.id}</small>}</span><button type="button" disabled={selectionReadOnly || !onSelectedIdsChange} aria-describedby={selectionReadOnly || !onSelectedIdsChange ? `${baseId}-selection-readonly` : undefined} aria-label={`Quitar ${card.name}${card.unavailable ? ` (${card.id})` : ''} de tus tarjetas disponibles`} onClick={() => toggleCard(card.id)}><X size={14} aria-hidden="true" /></button></li>)}</ul><button type="button" className="card-choice-selection-toggle" aria-expanded={selectionOpen} aria-controls={`${baseId}-selection`} onClick={() => setSelectionOpen(value => !value)}>{selectionOpen ? 'Ocultar lista de tarjetas' : 'Cambiar selección'}<ChevronDown size={16} aria-hidden="true" /></button></>}
          {(selectionOpen || !selectedCards.length) && <div id={`${baseId}-selection`}>
            <div className="card-choice-search"><label htmlFor={fieldId('selectedIds')}>Buscar tarjeta o emisor</label><div><Search size={17} aria-hidden="true" /><input {...fieldA11y('selectedIds')} type="search" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(10); }} placeholder="Nombre, emisor o alias" /></div>{fieldError('selectedIds')}</div>
            <ul className="card-choice-card-options">{filteredCards.slice(0, visibleCount).map(card => {
              const rules = programs.filter(program => program.cardId === card.id);
              return <li key={card.id}><label><input type="checkbox" checked={selectedIds.includes(card.id)} disabled={selectionReadOnly || !onSelectedIdsChange} aria-describedby={selectionReadOnly || !onSelectedIdsChange ? `${baseId}-selection-readonly` : undefined} onChange={() => toggleCard(card.id)} /><span><strong>{card.name}</strong><small>{card.issuer}</small><small className="card-choice-rule-status">{rules.some(program => program.calculation) ? 'Reglas documentadas · sujetas a condiciones' : rules.length ? 'Información descriptiva del beneficio' : 'Sin reglas de beneficio verificadas'}</small></span></label></li>;
            })}</ul>
            {!filteredCards.length && <p className="card-choice-no-matches">{cards.length ? 'No hay tarjetas con esa búsqueda.' : 'Aún no hay tarjetas documentadas.'}</p>}
            {filteredCards.length > visibleCount && <button className="card-choice-show-more" type="button" onClick={() => setVisibleCount(count => count + 10)}>Mostrar más tarjetas ({filteredCards.length - visibleCount})</button>}
          </div>}
        </fieldset>
        <fieldset><legend>La compra</legend>
          <div className="card-choice-field"><label htmlFor={fieldId('amount')}>Importe de la compra</label><div className="card-choice-amount"><input {...fieldA11y('amount')} type="number" inputMode="decimal" min="0.01" step="0.01" value={purchase.amount} onChange={event => updatePurchase('amount', event.target.value)} placeholder="0.00" required /><span>MXN</span></div>{fieldError('amount')}</div>
          <div className="card-choice-field"><label htmlFor={fieldId('purchaseDate')}>Fecha de la compra</label><input {...fieldA11y('purchaseDate')} type="date" lang="es-MX" value={purchase.purchaseDate} onChange={event => updatePurchase('purchaseDate', event.target.value)} aria-describedby={errors.purchaseDate ? `${fieldId('purchaseDate')}-error ${baseId}-date-help` : `${baseId}-date-help`} required />{fieldError('purchaseDate')}<small id={`${baseId}-date-help`}>{isValidTransactionDate(purchase.purchaseDate) ? `Fecha elegida: ${formatCatalogDate(purchase.purchaseDate)}.` : 'Selecciona día, mes y año.'}</small></div>
          <div className="card-choice-field"><label htmlFor={fieldId('categoryId')}>Tipo de compra</label><select {...fieldA11y('categoryId')} value={purchase.categoryId} onChange={event => updatePurchase('categoryId', event.target.value)} required><option value="">Selecciona una categoría</option>{BENEFIT_CATEGORY_IDS.map(id => <option key={id} value={id}>{CATEGORY_LABELS[id]}</option>)}</select>{fieldError('categoryId')}</div>
          <div className="card-choice-field"><label htmlFor={fieldId('channel')}>Dónde pagarás</label><select id={fieldId('channel')} value={purchase.channel} onChange={event => updatePurchase('channel', event.target.value)}>{Object.entries(CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {needsMerchant && <div className="card-choice-field"><label htmlFor={fieldId('merchantName')}>Comercio · opcional</label><input id={fieldId('merchantName')} value={purchase.merchantName} onChange={event => updatePurchase('merchantName', event.target.value)} type="text" maxLength={150} placeholder="Nombre del comercio" aria-describedby={`${baseId}-merchant-help`} /><small id={`${baseId}-merchant-help`}>El nombre por sí solo no confirma que el comercio participe. Revisaremos esta condición en el resultado.</small></div>}
        </fieldset>
        <fieldset><legend>Cómo la pagarás</legend>
          <div className="card-choice-field"><label htmlFor={fieldId('paymentMode')}>Forma de pago</label><select id={fieldId('paymentMode')} value={purchase.paymentMode} onChange={event => updatePurchase('paymentMode', event.target.value)}>{Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <fieldset className="card-choice-radio-group"><legend>¿Las cuentas están al corriente y cubrirás el pago para no generar intereses?</legend><p className="card-choice-help">Incluye los saldos previos de esas tarjetas.</p><div className="card-choice-radio-options">{[{ value: 'yes', label: 'Sí, en todas' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'No lo sé' }].map(option => <label key={option.value}><input type="radio" name={`${baseId}-pay-in-full`} value={option.value} checked={purchase.payInFull === option.value} onChange={() => updatePurchase('payInFull', option.value)} />{option.label}</label>)}</div></fieldset>
        </fieldset>
        {errors.form && <p id={fieldId('form-error')} className="card-choice-form-error" tabIndex={-1} role="alert">{errors.form}</p>}
        <button id={fieldId('submit')} type="submit" className="card-choice-submit" disabled={orphanedDraft} aria-describedby={orphanedDraft ? `${baseId}-orphan-notice` : undefined}>Ver opciones para esta compra<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <div className="card-choice-results" aria-label="Resultado de la comparación">
        {notice && <p className="card-choice-notice" role="status">{notice}</p>}
        {orphanedDraft && <div className="card-choice-orphan"><p id={`${baseId}-orphan-notice`} tabIndex={-1} role="status">Cambió la selección de tarjetas. Estas respuestas no se aplicarán a la nueva comparación.</p><details className="card-choice-explanation"><summary>Respuestas de la selección anterior<ChevronDown size={15} aria-hidden="true" /></summary><div className="card-choice-explanation-body"><p><strong>{interaction.editor.cardName}</strong> · {interaction.editor.program.name}</p><ul>{interaction.editor.program.conditions.map(condition => <li key={condition.id}>{condition.label}: {CONFIRM_OPTIONS.find(option => option.value === interaction.editor.draft.conditions[condition.id])?.label || 'No lo sé'}.</li>)}</ul>{interaction.editor.draft.cap && <><p>Tope: {interaction.editor.draft.cap.state === 'full' ? 'Completo disponible' : interaction.editor.draft.cap.state === 'remaining' ? `Restante declarado: ${interaction.editor.draft.cap.remaining || 'sin importe'} MXN` : 'No lo sé'}.</p><p>Periodo: {formatCatalogDate(interaction.editor.draft.cap.periodStart)} al {formatCatalogDate(interaction.editor.draft.cap.periodEnd)}.</p></>}</div></details><button type="button" className="card-choice-confirm" onClick={() => { setInteraction({ editor: null, pendingAction: null }); setNotice('Borrador descartado. La compra y la selección actual se conservaron.'); focusElement(fieldId('submit')); }}>Descartar borrador y continuar</button></div>}
        {!result ? <div className="card-choice-intro"><CreditCard size={28} aria-hidden="true" /><h3 className="card-choice-results-title" ref={resultHeading} tabIndex={-1}>Compara tus opciones</h3><p>Selecciona tus tarjetas y describe una compra. Verás qué beneficios podemos calcular y cuáles necesitan confirmar condiciones.</p>{stale && <p className="card-choice-stale" role="status">La compra cambió. Vuelve a comparar.</p>}</div> : <motion.div key={comparison.signature} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
          <h3 ref={resultHeading} tabIndex={-1} className="card-choice-results-title">{financing ? 'Revisa primero el costo de financiar la compra' : 'Resultado para esta compra'}</h3>
          <div className="card-choice-purchase-summary"><span data-sensitive>{amountLabel(comparison.context.amountMinor)} MXN</span><span>{formatCatalogDate(comparison.context.purchaseDate)}</span><span>{CATEGORY_LABELS[comparison.context.categoryId]}</span><span>{CHANNEL_LABELS[comparison.context.channel]}</span><span>{PAYMENT_LABELS[comparison.context.paymentMode]}</span>{comparison.merchantName && <span>{comparison.merchantName}</span>}</div>
          <button type="button" className="card-choice-text-action" onClick={() => { const input = document.getElementById(fieldId('amount')); input?.focus({ preventScroll: true }); input?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' }); }}>Ajustar compra</button>
          <p className="card-choice-coverage">{comparison.context.ownedCardIds.length} {comparison.context.ownedCardIds.length === 1 ? 'tarjeta' : 'tarjetas'} · {coverage.calculated} con cálculo · {coverage.conditional} por confirmar · {coverage.unavailable} sin cálculo disponible</p>
          {dirtyEditor && <p className="card-choice-stale" role="status">Hay respuestas por aplicar. La comparación destacada se actualizará cuando las apliques.</p>}
          {financing ? <div className="card-choice-financing"><p>Los intereses pueden cambiar el resultado. Estos beneficios no permiten elegir la opción de menor costo.</p>{onNavigate && <button type="button" className="card-choice-text-action" onClick={() => onNavigate('plan')}>Revisar mi plan de pagos<ArrowUpRight size={16} aria-hidden="true" /></button>}</div> : dirtyEditor ? null : noPositiveBenefit ? <div className="card-choice-comparison-pending"><h4>Devolución estimada: {amountLabel(0)} MXN</h4><p>Entre {comparableIds.length === 1 ? 'la tarjeta' : `las ${comparableIds.length} tarjetas`} con reglas aplicables.</p></div> : leadRow ? <div className="card-choice-highlight">
            <h4>{recommendation.status === 'tie' ? 'Estas tarjetas ofrecen la misma devolución estimada' : recommendation.status === 'winner' ? 'Mayor devolución estimada' : `Devolución estimada de ${cardById.get(leadIds[0])?.name || 'la tarjeta'}`}</h4>
            <strong className="card-choice-value" data-sensitive>{amountLabel(leadRow.amountMinor)} MXN</strong>
            <ul className="card-choice-lead-programs">{leadIds.map(id => {
              const row = result.results.find(item => item.cardId === id && item.rankable);
              const program = programById.get(row?.programId);
              return <li key={id}>{recommendation.status !== 'none' && <strong>{cardById.get(id)?.name || 'Tarjeta fuera del catálogo'}</strong>}{program?.reward?.displayLabel && <p className="card-choice-reward-label">{program.reward.displayLabel}</p>}{program?.reward?.redemptionSummary && <><p>El canje posterior depende de las condiciones del programa.</p><details className="card-choice-explanation"><summary>Condiciones de canje<ChevronDown size={15} aria-hidden="true" /></summary><div className="card-choice-explanation-body"><p>{program.reward.redemptionSummary}</p></div></details></>}</li>;
            })}</ul>
            {comparableIds.length > 1 && <p>Entre las {comparableIds.length} tarjetas con reglas aplicables.</p>}
          </div> : <div className="card-choice-comparison-pending"><h4>Aún no hay una devolución comparable</h4><p>Revisa las condiciones y los motivos de cada tarjeta.</p></div>}
          <p className="card-choice-coverage">Estimamos la recompensa de esta compra; su acreditación o canje ocurre según cada programa.</p>
          {result.results.some(row => Number.isInteger(row.rateBps)) && <p className="card-choice-coverage">Cálculo porcentual; el abono del emisor puede variar por redondeo.</p>}
          {rowGroups.map(group => <section className="card-choice-result-group" key={group.title}><h4>{group.title}</h4><ul className="card-choice-result-list">{group.rows.map(row => <BenefitRow key={`${row.cardId}-${row.programId || 'no-rule'}`} rowId={rowId(row)} row={row} program={programById.get(row.programId)} card={cardById.get(row.cardId)} context={comparison.context} onOpenCard={onOpenCard} onConfirm={() => requestAction({ type: 'editor', programId: row.programId })} editor={interaction.editor?.programId === row.programId ? <BenefitAnswerEditor id={`${rowId(row)}-editor`} program={interaction.editor.program} row={row} editor={interaction.editor} pendingAction={interaction.pendingAction} purchaseDate={purchase.purchaseDate} reducedMotion={reducedMotion} onChange={updateAnswer} onApply={applyAnswers} onCancel={() => cancelAnswers()} onDiscard={() => cancelAnswers(true)} onContinue={() => { setInteraction(previous => ({ ...previous, pendingAction: null })); focusElement(`${rowId(row)}-editor-title`); }} focusRef={editorHadFocus} /> : null} />)}</ul></section>)}
        </motion.div>}
      </div>
    </div>
  </section>;
}
