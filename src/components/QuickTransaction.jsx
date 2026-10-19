import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import Modal from './ui/Modal';
import { formatMoney } from '../services/exchangeRate';
import { getLocalDate, isValidTransactionDate, TRANSACTION_CATEGORIES, validateTransaction } from '../services/transactionAnalytics';
import { createQuickDraft, createQuickTransaction, getRecentQuickTransactions, insertQuickTransaction, quickDraftFromRecent, undoQuickTransaction } from '../services/quickTransactions';
import './QuickTransaction.css';

const fieldOrder = ['monto', 'moneda', 'descripcion', 'fecha', 'tipo'];
const readableDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export default function QuickTransaction({ isOpen, onClose, transactions = [], onUpdateTransactions, onViewTransaction, readOnly = false }) {
  const formId = useId();
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState(createQuickDraft);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [pendingRecent, setPendingRecent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [notice, setNotice] = useState(null);
  const mounted = useRef(false);
  const operationEpoch = useRef(0);
  const saving = useRef(false);
  const undoing = useRef(false);
  const dirty = useRef(false);
  const confirmRef = useRef(null);
  const live = useRef({ readOnly, onUpdateTransactions, onClose });
  live.current = { readOnly, onUpdateTransactions, onClose };
  const recentTransactions = useMemo(() => getRecentQuickTransactions(transactions), [transactions]);
  const categories = useMemo(() => [...new Set([...TRANSACTION_CATEGORIES, ...transactions.map(transaction => transaction?.categoria), draft.categoria].filter(value => typeof value === 'string' && value.trim()))], [transactions, draft.categoria]);
  const futureDate = isValidTransactionDate(draft.fecha) && draft.fecha > getLocalDate();
  const transition = { duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' };
  const fieldId = field => `${formId}-${field}`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operationEpoch.current += 1; };
  }, []);
  useEffect(() => {
    if (isOpen && !dirty.current && !saving.current) setDraft(createQuickDraft());
    if (!isOpen) setPendingRecent(null);
  }, [isOpen]);
  useEffect(() => {
    if (!pendingRecent) return undefined;
    const frame = requestAnimationFrame(() => confirmRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pendingRecent]);

  const focusField = field => requestAnimationFrame(() => {
    if (mounted.current) document.getElementById(fieldId(field))?.focus();
  });
  const updateDraft = (field, value) => {
    if (live.current.readOnly || saving.current) return;
    if (draft[field] !== value) dirty.current = true;
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setSaveError('');
  };
  const useRecent = recent => {
    if (live.current.readOnly || saving.current) return;
    const next = quickDraftFromRecent(recent);
    if (!next) return;
    setDraft(next);
    dirty.current = true;
    setPendingRecent(null);
    setRecentsOpen(false);
    setDetailsOpen(Boolean(next.categoria || next.metodoPago));
    setErrors({});
    setSaveError('');
    focusField('monto');
  };
  const selectRecent = recent => {
    if (live.current.readOnly || saving.current) return;
    if (dirty.current) setPendingRecent(recent);
    else useRecent(recent);
  };

  const save = async event => {
    event.preventDefault();
    if (saving.current || live.current.readOnly || !mounted.current) return;
    const validation = validateTransaction(draft);
    if (Object.keys(validation).length) {
      setErrors(validation);
      focusField(fieldOrder.find(field => validation[field]) || 'monto');
      return;
    }
    if (typeof live.current.onUpdateTransactions !== 'function') {
      setSaveError('No se pudo guardar. Tu borrador sigue aquí; intenta de nuevo.');
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setSaveError('');
    const epoch = operationEpoch.current;
    const isCurrent = () => mounted.current && epoch === operationEpoch.current;
    try {
      const created = createQuickTransaction(draft, `tx_${crypto.randomUUID()}`);
      if (!created.transaction) throw new Error(created.errors.form || 'Revisa los datos del movimiento.');
      const transaction = created.transaction;
      let outcome;
      await live.current.onUpdateTransactions(previous => {
        if (!isCurrent() || live.current.readOnly) throw new Error('El registro está en modo de lectura. Tu borrador se conserva.');
        outcome = insertQuickTransaction(previous, transaction);
        if (outcome.status !== 'inserted') throw new Error('No se pudo guardar el movimiento. Tu borrador se conserva.');
        return outcome.transactions;
      });
      if (!isCurrent()) return;
      if (!outcome) throw new Error('No se pudo confirmar el registro. Tu borrador sigue aquí.');
      setNotice({ transaction: { ...transaction }, canUndo: true });
      setDraft(createQuickDraft());
      dirty.current = false;
      setErrors({});
      setDetailsOpen(false);
      setRecentsOpen(false);
      setPendingRecent(null);
      live.current.onClose?.();
    } catch (error) {
      if (isCurrent()) setSaveError(error.message || 'No se pudo guardar. Tu borrador sigue aquí; intenta de nuevo.');
    } finally {
      if (isCurrent()) { saving.current = false; setIsSaving(false); }
    }
  };

  const undo = async () => {
    if (!notice?.canUndo || undoing.current || live.current.readOnly || !mounted.current || typeof live.current.onUpdateTransactions !== 'function') return;
    undoing.current = true;
    setIsUndoing(true);
    const epoch = operationEpoch.current;
    const isCurrent = () => mounted.current && epoch === operationEpoch.current;
    const transaction = notice.transaction;
    try {
      let outcome;
      await live.current.onUpdateTransactions(previous => {
        if (!isCurrent() || live.current.readOnly) throw new Error('No se puede deshacer mientras el registro está en modo de lectura.');
        outcome = undoQuickTransaction(previous, transaction);
        return outcome.transactions;
      });
      if (!isCurrent()) return;
      if (!outcome) throw new Error('No se pudo confirmar el cambio. Intenta de nuevo.');
      setNotice(previous => previous?.transaction?.id !== transaction.id ? previous : {
        ...previous,
        canUndo: false,
        canView: outcome.status === 'conflict',
        message: outcome.status === 'removed' ? 'Registro deshecho.' : outcome.status === 'missing' ? 'Este movimiento ya no está disponible.' : 'El movimiento cambió después. Conservamos su versión actual.',
        error: false,
      });
    } catch (error) {
      if (isCurrent()) setNotice(previous => previous?.transaction?.id !== transaction.id ? previous : { ...previous, error: true, message: error.message || 'No se pudo deshacer. Intenta de nuevo.' });
    } finally {
      if (isCurrent()) { undoing.current = false; setIsUndoing(false); }
    }
  };

  const inputProps = field => ({ id: fieldId(field), name: field, value: draft[field], onChange: event => updateDraft(field, event.target.value), 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${fieldId(field)}-error` : undefined });
  const fieldError = field => errors[field] && <p className="sf-quick-field-error" id={`${fieldId(field)}-error`}>{errors[field]}</p>;

  return <>
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar movimiento" description="Se añade a tus movimientos. Tú eliges los datos." className="sf-quick-dialog">
      <form className="sf-quick-form" onSubmit={save} noValidate>
        {saveError && <p className="sf-quick-error" role="alert">{saveError}</p>}
        {readOnly && <p className="sf-quick-hint" role="status">Este formulario está en modo de lectura.</p>}
        <fieldset disabled={readOnly || isSaving} aria-busy={isSaving}>
          <div className="sf-quick-types" role="group" aria-label="Tipo de movimiento">
            <button type="button" aria-pressed={draft.tipo === 'GASTO'} onClick={() => updateDraft('tipo', 'GASTO')}><ArrowUpRight size={17} aria-hidden="true" />Gasto</button>
            <button type="button" aria-pressed={draft.tipo === 'INGRESO'} onClick={() => updateDraft('tipo', 'INGRESO')}><ArrowDownLeft size={17} aria-hidden="true" />Ingreso</button>
          </div>
          {draft.tipo === 'INGRESO' && <p className="sf-quick-hint">Registra dinero recibido. Un cobro pendiente se planea por separado.</p>}
          <div className="sf-quick-amount-row">
            <div><label htmlFor={fieldId('monto')}>Importe</label><input {...inputProps('monto')} className="sf-quick-amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required data-autofocus />{fieldError('monto')}</div>
            <div><label htmlFor={fieldId('moneda')}>Moneda</label><select {...inputProps('moneda')}><option value="MXN">MXN</option><option value="USD">USD</option></select>{fieldError('moneda')}</div>
          </div>
          <div className="sf-quick-field"><label htmlFor={fieldId('descripcion')}>Descripción</label><input {...inputProps('descripcion')} type="text" maxLength={200} placeholder={draft.tipo === 'INGRESO' ? 'Ej. Pago de cliente' : 'Ej. Supermercado'} required autoComplete="off" />{fieldError('descripcion')}</div>
          <div className="sf-quick-field"><label htmlFor={fieldId('fecha')}>Fecha</label><input {...inputProps('fecha')} type="date" lang="es-MX" required aria-describedby={`${fieldId('fecha')}-help${errors.fecha ? ` ${fieldId('fecha')}-error` : ''}`} /><p className="sf-quick-hint" id={`${fieldId('fecha')}-help`}>{isValidTransactionDate(draft.fecha) ? readableDate(draft.fecha) : 'Selecciona día, mes y año.'}</p>{fieldError('fecha')}{futureDate && <p className="sf-quick-future" role="status">La fecha es futura: este movimiento no cuenta en los totales hasta hoy.</p>}</div>
          <div className="sf-quick-disclosure">
            <button type="button" className="sf-quick-disclosure-toggle" aria-expanded={detailsOpen} aria-controls={`${formId}-details`} onClick={() => setDetailsOpen(value => !value)}>Más detalles<span>Categoría y método<ChevronDown size={16} aria-hidden="true" /></span></button>
            {detailsOpen && <motion.div id={`${formId}-details`} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} transition={transition} className="sf-quick-details">
              <div className="sf-quick-field"><label htmlFor={fieldId('categoria')}>Categoría <span>· opcional</span></label><select {...inputProps('categoria')}><option value="">Sin categoría · sin asignar</option>{categories.map(category => <option key={category} value={category}>{category === 'Sin categoría' ? 'Sin categoría (asignada)' : category}</option>)}</select></div>
              <div className="sf-quick-field"><label htmlFor={fieldId('metodoPago')}>Método de pago <span>· opcional</span></label><input {...inputProps('metodoPago')} type="text" maxLength={100} placeholder="Ej. Efectivo o transferencia" /></div>
            </motion.div>}
          </div>
          <div className="sf-quick-disclosure">
            <button type="button" className="sf-quick-disclosure-toggle" aria-expanded={recentsOpen} aria-controls={`${formId}-recents`} onClick={() => { setRecentsOpen(value => !value); setPendingRecent(null); }}>Usar un movimiento reciente<ChevronDown size={16} aria-hidden="true" /></button>
            {recentsOpen && <motion.div id={`${formId}-recents`} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
              <p className="sf-quick-hint">Úsalo como punto de partida. La fecha será hoy y podrás cambiar los datos.</p>
              {recentTransactions.length ? <ul className="sf-quick-recents">{recentTransactions.map((recent, index) => <li key={`${recent.fecha}-${index}`}><button type="button" onClick={() => selectRecent(recent)}><span><strong>{recent.descripcion}</strong><small>{recent.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'} · {readableDate(recent.fecha)}</small></span><span data-sensitive className="sensitive-value">{formatMoney(Number(recent.monto), recent.moneda)} <small>{recent.moneda}</small></span></button></li>)}</ul> : <p className="sf-quick-empty">Tus movimientos aparecerán aquí cuando tengan fecha, descripción, importe y moneda válidos.</p>}
              {pendingRecent && <div className="sf-quick-replace" role="group" aria-labelledby={`${formId}-replace`}><p id={`${formId}-replace`}>Ya tienes un borrador. Usar este movimiento reemplazará los datos que escribiste.</p><div><button type="button" ref={confirmRef} onClick={() => useRecent(pendingRecent)}>Sustituir mi borrador</button><button type="button" onClick={() => { setPendingRecent(null); focusField('monto'); }}>Conservarlo</button></div></div>}
            </motion.div>}
          </div>
        </fieldset>
        <footer className="sf-quick-footer"><button type="button" className="button-secondary" onClick={onClose}>Cerrar</button><button type="submit" className="button-primary" disabled={readOnly || isSaving}>{isSaving ? 'Guardando…' : draft.tipo === 'INGRESO' ? 'Guardar ingreso' : 'Guardar gasto'}</button></footer>
      </form>
    </Modal>
    {notice && !isOpen && <motion.div className={`sf-quick-notice${notice.error ? ' sf-quick-notice-error' : ''}`} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <p role="status" aria-live="polite" aria-atomic="true">{notice.error ? <AlertCircle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}<span data-sensitive className="sensitive-value">{notice.message || `${notice.transaction.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'} registrado: ${formatMoney(notice.transaction.monto, notice.transaction.moneda)} ${notice.transaction.moneda} · ${readableDate(notice.transaction.fecha)}`}</span></p>
      <div className="sf-quick-notice-actions">{notice.canUndo && <button type="button" onClick={undo} disabled={readOnly || isUndoing}><RotateCcw size={15} aria-hidden="true" />{isUndoing ? 'Deshaciendo…' : 'Deshacer'}</button>}{notice.canView !== false && onViewTransaction && <button type="button" onClick={() => onViewTransaction(notice.transaction)}>Ver movimiento<ArrowUpRight size={15} aria-hidden="true" /></button>}<button type="button" className="sf-quick-notice-close" onClick={() => setNotice(null)} aria-label="Cerrar confirmación">Cerrar<X size={15} aria-hidden="true" /></button></div>
    </motion.div>}
  </>;
}
