import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Link2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';
import { getLocalDate } from '../services/transactionAnalytics';
import { isReceivableDate, receivableMoneyToMinor, summarizeReceivables } from '../services/receivables.js';
import Modal from './ui/Modal';
import './ExpectedReceivables.css';

const money = (minor, currency) => `${formatMoney(minor / 100, currency)} ${currency}`;
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha acordada';
const timingLabels = { undated: 'Sin fecha', upcoming: 'Por cobrar', 'due-today': 'Esperado hoy', overdue: 'Fecha vencida', settled: 'Cobrado', cancelled: 'Sin seguimiento' };
const initialDraft = () => ({ name: '', amount: '', currency: 'MXN', expectedDate: '', note: '' });
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export default function ExpectedReceivables({ financialData, onReceivableCommand, onViewTransaction, readOnly = false, active = true, headingRef: externalHeadingRef }) {
  const formId = useId();
  const headingRef = useRef(null);
  const closeConfirmRef = useRef(null);
  const rowRefs = useRef(new Map());
  const busyRef = useRef(false);
  const operationRef = useRef(null);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState(initialDraft);
  const [receipt, setReceipt] = useState({ mode: 'link', transactionId: '', amount: '', fecha: '', descripcion: '', confirmed: false, search: '' });
  const [dirty, setDirty] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [suspended, setSuspended] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const today = getLocalDate();
  const blocked = readOnly || !onReceivableCommand;
  const summary = useMemo(() => {
    try { return summarizeReceivables(financialData, { today }); }
    catch (error) { return { items: [], eligibleIncomes: [], totalsByCurrency: {}, inconsistencies: [], error: error.message }; }
  }, [financialData, today]);
  const selected = summary.items.find(item => item.id === modal?.id);
  const currencyHasHistory = modal?.type === 'edit' && selected?.allocations.length > 0;
  const chosenIncome = summary.eligibleIncomes.find(item => item.transaction.id === receipt.transactionId);
  const receiptMinor = receivableMoneyToMinor(receipt.amount);
  const visible = summary.items.filter(item => (filter === 'all' || item.status === filter) && normalizeSearch(`${item.name} ${item.note || ''}`).includes(normalizeSearch(query)));
  const matchingIncome = selected ? summary.eligibleIncomes.filter(item => item.transaction.moneda === selected.currency && normalizeSearch(item.transaction.descripcion).includes(normalizeSearch(receipt.search)))
    .sort((a, b) => b.transaction.fecha.localeCompare(a.transaction.fecha)) : [];
  const ids = field => `${formId}-${field}`;
  const fieldError = field => errors[field] && <p id={ids(`${field}-error`)} className="sf-receivables-error" role="alert">{errors[field]}</p>;
  const fieldProps = field => ({ id: ids(field), 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? ids(`${field}-error`) : undefined });
  const focusRow = id => requestAnimationFrame(() => (rowRefs.current.get(id) || headingRef.current)?.focus({ preventScroll: true }));
  const resetErrors = () => { setErrors({}); setCloseConfirm(false); operationRef.current = null; };

  useEffect(() => {
    if (active) return;
    if (modal) {
      if (dirty) setSuspended(modal);
      setModal(null);
      setCloseConfirm(false);
    }
    setConfirmation(null);
  }, [active, modal, dirty]);
  useEffect(() => { if (closeConfirm) closeConfirmRef.current?.focus(); }, [closeConfirm]);

  const openCreate = () => {
    setDraft(initialDraft()); setModal({ type: 'create' }); setDirty(false); setSuspended(null); resetErrors();
  };
  const openEdit = item => {
    setDraft({ name: item.name, amount: String(item.amountMinor / 100), currency: item.currency, expectedDate: item.expectedDate || '', note: item.note || '' });
    setModal({ type: 'edit', id: item.id, before: financialData.receivables.items.find(row => row.id === item.id) });
    setDirty(false); setSuspended(null); resetErrors();
  };
  const openReceipt = item => {
    setReceipt({ mode: 'link', transactionId: '', amount: '', fecha: today, descripcion: item.name, confirmed: false, search: '' });
    setModal({ type: 'receipt', id: item.id }); setDirty(false); setSuspended(null); resetErrors();
  };
  const requestClose = () => {
    if (busyRef.current) return;
    if (blocked) { if (dirty) setSuspended(modal); setModal(null); setCloseConfirm(false); return; }
    if (dirty) { setCloseConfirm(true); return; }
    setModal(null); setErrors({});
  };
  const discard = () => { setModal(null); setSuspended(null); setDirty(false); setCloseConfirm(false); resetErrors(); };
  const changeDraft = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setDirty(true); resetErrors(); };
  const changeReceipt = (field, value) => {
    setReceipt(previous => ({ ...previous, [field]: value, ...(field !== 'confirmed' ? { confirmed: false } : {}) }));
    setDirty(true); resetErrors();
  };
  const selectIncome = income => {
    setReceipt(previous => ({ ...previous, transactionId: income.transaction.id, amount: String(Math.min(selected.pendingMinor, income.availableMinor) / 100) }));
    setDirty(true); resetErrors();
  };
  const showErrors = next => {
    setErrors(next);
    requestAnimationFrame(() => document.getElementById(ids(Object.keys(next)[0]))?.focus());
  };
  const execute = async (type, payloadFactory, { close = false, undo = false } = {}) => {
    if (busyRef.current || blocked) return;
    if (!operationRef.current) operationRef.current = { type, payload: payloadFactory() };
    const command = operationRef.current;
    busyRef.current = true; setBusy(true); setErrors({});
    try {
      const outcome = await onReceivableCommand(command);
      if (!outcome?.status) throw new Error('No pudimos confirmar el registro. Tu borrador sigue aquí; vuelve a intentar.');
      const message = outcome.status === 'reversed' ? 'Este vínculo ya había sido deshecho. No se registró otro ingreso.'
        : type === 'unlink' ? 'Vínculo deshecho. El ingreso sigue en Movimientos.'
          : type === 'receive' ? 'Ingreso registrado y vinculado al cobro.'
            : type === 'link' ? 'Ingreso vinculado. No se creó otro movimiento.'
              : type === 'create' ? 'Cobro esperado guardado. Se mantiene separado del dinero recibido.' : 'Cobro actualizado.';
      setNotice({ message, allocationId: undo && outcome.status !== 'reversed' ? outcome.allocationId : null, receivableId: outcome.receivableId });
      operationRef.current = null; setConfirmation(null);
      if (close) { setModal(null); setDirty(false); setSuspended(null); setCloseConfirm(false); }
      focusRow(outcome.receivableId);
    } catch (error) {
      const message = error.message || 'No se pudo guardar. Conservamos tu borrador para volver a intentar.';
      setErrors({ form: message });
      if (['CONFLICT', 'OVERALLOCATION', 'CANCELLED', 'INVALID_RELATION', 'FUTURE_INCOME', 'IDEMPOTENCY_CONFLICT'].includes(error.code)) {
        operationRef.current = null;
        setReceipt(previous => ({ ...previous, confirmed: false }));
        if (modal?.type === 'edit') setModal(previous => ({ ...previous, before: financialData.receivables.items.find(row => row.id === previous.id) }));
      }
    } finally { busyRef.current = false; setBusy(false); }
  };
  const saveExpected = event => {
    event.preventDefault();
    const nextErrors = {};
    const amountMinor = receivableMoneyToMinor(draft.amount);
    if (!draft.name.trim() || draft.name.length > 200) nextErrors.name = 'Escribe un concepto de hasta 200 caracteres.';
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) nextErrors.amount = 'Escribe un importe mayor a cero, con máximo dos decimales.';
    if (draft.expectedDate && !isReceivableDate(draft.expectedDate)) nextErrors.expectedDate = 'Selecciona una fecha válida o deja el campo vacío.';
    if (draft.note.length > 2000) nextErrors.note = 'La nota puede tener hasta 2,000 caracteres.';
    if (Object.keys(nextErrors).length) { showErrors(nextErrors); return; }
    const fields = { name: draft.name.trim(), amountMinor, currency: draft.currency, expectedDate: draft.expectedDate || null };
    // Do not materialize a previously absent note while editing unrelated fields.
    if (draft.note || modal?.before?.note !== undefined) fields.note = draft.note;
    if (modal.type === 'edit') execute('update', () => ({ id: modal.id, before: modal.before, patch: fields }), { close: true });
    else execute('create', () => ({ ...fields, id: crypto.randomUUID(), createdAt: new Date().toISOString(), cancelledAt: null }), { close: true });
  };
  const saveReceipt = event => {
    event.preventDefault();
    const nextErrors = {};
    if (!selected || selected.cancelledAt) nextErrors.form = 'Este cobro cambió. Cierra y vuelve a abrirlo para revisar su estado.';
    if (!Number.isSafeInteger(receiptMinor) || receiptMinor <= 0) nextErrors.amount = 'Escribe un importe mayor a cero, con máximo dos decimales.';
    else if (selected && receiptMinor > selected.pendingMinor) nextErrors.amount = 'El importe supera lo pendiente. Registra el ingreso completo en Movimientos y vincula sólo la parte que corresponde, o corrige el importe esperado.';
    if (receipt.mode === 'link') {
      if (!chosenIncome || chosenIncome.transaction.moneda !== selected?.currency) nextErrors.transaction = 'Selecciona el ingreso que recibiste para este cobro.';
      else if (receiptMinor > chosenIncome.availableMinor) nextErrors.amount = 'El importe supera lo disponible de este ingreso. Revisa el importe y vuelve a confirmar.';
    } else {
      if (!isReceivableDate(receipt.fecha) || receipt.fecha > today) nextErrors.fecha = 'Usa una fecha válida de hoy o anterior.';
      if (!receipt.descripcion.trim() || receipt.descripcion.length > 200) nextErrors.descripcion = 'Escribe una descripción de hasta 200 caracteres.';
      if (!receipt.confirmed) nextErrors.confirmed = 'Confirma que este dinero ya fue recibido.';
    }
    if (Object.keys(nextErrors).length) { showErrors(nextErrors); return; }
    execute(receipt.mode === 'link' ? 'link' : 'receive', () => ({
      id: crypto.randomUUID(), receivableId: selected.id, createdAt: new Date().toISOString(),
      ...(receipt.mode === 'link' ? { transactionId: chosenIncome.transaction.id, amountMinor: receiptMinor }
        : { transaction: { descripcion: receipt.descripcion.trim(), monto: receiptMinor / 100, moneda: selected.currency, fecha: receipt.fecha } }),
    }), { close: true, undo: true });
  };
  const unlink = allocationId => {
    if (operationRef.current?.type !== 'unlink' || operationRef.current.payload.id !== allocationId) operationRef.current = null;
    execute('unlink', () => ({ id: allocationId, reversedAt: new Date().toISOString() }));
  };
  const toggleCancel = item => {
    if (operationRef.current?.type !== 'update' || operationRef.current.payload.id !== item.id) operationRef.current = null;
    execute('update', () => ({ id: item.id, before: financialData.receivables.items.find(row => row.id === item.id), patch: { cancelledAt: item.cancelledAt ? null : new Date().toISOString() } }));
  };

  return <section hidden={!active} className="sf-receivables" aria-labelledby={ids('heading')}>
    <header className="sf-receivables-heading">
      <div><h2 id={ids('heading')} ref={node => { headingRef.current = node; if (externalHeadingRef) externalHeadingRef.current = node; }} tabIndex={-1}>Cobros esperados</h2><p>Da seguimiento a lo que te deben y vincula los pagos cuando lleguen. Lo esperado no cuenta como dinero disponible.</p></div>
      <button type="button" className="button-primary" onClick={openCreate} disabled={blocked || busy || !!suspended || !!summary.error}><Plus size={17} aria-hidden="true" />Añadir cobro esperado</button>
    </header>
    {blocked && <p className="sf-receivables-muted" role="status">Puedes consultar los cobros. La edición está pausada hasta verificar la cuenta y la sincronización.</p>}
    {summary.error && <p role="alert" className="sf-receivables-error-box">{summary.error} Revisa el respaldo antes de modificar los cobros.</p>}
    {notice && <div className="sf-receivables-notice"><p role="status">{notice.message}</p>{notice.allocationId && <button type="button" className="button-secondary" disabled={blocked || busy || !!suspended} onClick={() => unlink(notice.allocationId)}><RotateCcw size={16} aria-hidden="true" />Deshacer vínculo</button>}</div>}
    {suspended && <div className="sf-receivables-notice"><p>Conservamos tu borrador en este espacio. Continúalo o descártalo antes de abrir otro.</p><button type="button" className="button-secondary" disabled={blocked} onClick={() => { setModal(suspended); setSuspended(null); }}>Continuar borrador</button><button type="button" className="sf-receivables-link" onClick={discard}>Descartar</button></div>}
    {!modal && errors.form && <p role="alert" className="sf-receivables-error-box">{errors.form}</p>}
    {summary.items.length > 0 && <>
      <section className="sf-receivables-pending" aria-labelledby={ids('pending-total')}><div className="sf-receivables-pending-intro"><h3 id={ids('pending-total')}>Pendiente total por cobrar</h3><p>Todos los cobros sin cancelar, de cualquier fecha. Este total no cambia con la búsqueda ni los filtros.</p></div>{Object.entries(summary.totalsByCurrency).filter(([currency]) => summary.items.some(item => item.currency === currency)).map(([currency, totals]) => <p key={currency}><span>Pendiente en {currency}</span><strong data-sensitive className="sensitive-value">{money(totals.pendingMinor, currency)}</strong></p>)}</section>
      <div className="sf-receivables-toolbar"><div className="sf-receivables-segments" role="group" aria-label="Estado de los cobros">{[['pending', 'Pendientes'], ['received', 'Cobrados'], ['cancelled', 'Cancelados'], ['all', 'Todos']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="sf-receivables-search" htmlFor={ids('query')}><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar cobros</span><input id={ids('query')} type="search" placeholder="Buscar concepto o nota" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <p className="sf-receivables-view-count" role="status">{visible.length} {visible.length === 1 ? 'cobro' : 'cobros'} en esta vista</p>
    </>}
    {!summary.error && visible.length === 0 && <div className="sf-receivables-empty"><Link2 size={27} aria-hidden="true" /><h3>{summary.items.length ? 'No hay cobros con estos filtros' : 'Lo que esperas cobrar, sin confundirlo con lo recibido'}</h3><p>{summary.items.length ? 'Cambia el estado o la búsqueda para encontrar otro cobro.' : 'Guarda el concepto y el importe. Puedes dejar la fecha pendiente y registrar pagos parciales cuando lleguen.'}</p>{summary.items.length ? <button className="button-secondary" type="button" onClick={() => { setFilter('all'); setQuery(''); }}>Ver todos los cobros</button> : <button className="button-primary" type="button" onClick={openCreate} disabled={blocked || !!suspended}>Añadir primer cobro</button>}</div>}
    <ul className="sf-receivables-list">{visible.map(item => <li key={item.id}>
      <article className={`sf-receivables-card${item.cancelledAt ? ' is-cancelled' : ''}`} aria-labelledby={`${formId}-item-${item.id}`}>
        <div className="sf-receivables-card-heading"><div><h3 id={`${formId}-item-${item.id}`} ref={node => { if (node) rowRefs.current.set(item.id, node); else rowRefs.current.delete(item.id); }} tabIndex={-1}>{item.name}</h3><p>{dateLabel(item.expectedDate)}</p></div><span className={`sf-receivables-badge ${item.overdue ? 'is-overdue' : ''}`}>{timingLabels[item.timing]}</span></div>
        <dl className="sf-receivables-amounts"><div><dt>Esperado</dt><dd data-sensitive className="sensitive-value">{money(item.amountMinor, item.currency)}</dd></div><div><dt>Recibido vinculado</dt><dd data-sensitive className="sensitive-value">{money(item.receivedMinor, item.currency)}</dd></div><div><dt>{item.cancelledAt ? 'Sin seguimiento' : 'Pendiente'}</dt><dd data-sensitive className="sensitive-value">{money(item.cancelledAt ? item.remainingMinor : item.pendingMinor, item.currency)}</dd></div></dl>
        {item.note && <p className="sf-receivables-note">{item.note}</p>}
        {item.allocations.some(allocation => allocation.needsReview) && <p className="sf-receivables-review" role="note">Vínculo por revisar: hay un ingreso con fecha futura. No se cuenta como recibido; revisa el movimiento o desvincúlalo.</p>}
        <div className="sf-receivables-actions">
          {!item.cancelledAt && item.pendingMinor > 0 && <button type="button" className="button-primary" disabled={blocked || busy || !!suspended} onClick={() => openReceipt(item)}><Link2 size={16} aria-hidden="true" />Registrar cobro recibido</button>}
          <button type="button" className="button-secondary" disabled={blocked || busy || !!suspended} onClick={() => openEdit(item)} aria-label={`Editar cobro ${item.name}`}><Pencil size={15} aria-hidden="true" />Editar</button>
          {(item.pendingMinor > 0 || item.cancelledAt) && <button type="button" className="sf-receivables-link" disabled={blocked || busy || !!suspended} onClick={() => { setConfirmation({ type: 'cancel', id: item.id }); operationRef.current = null; setErrors({}); }}>{item.cancelledAt ? 'Reabrir pendiente' : 'Cancelar pendiente'}</button>}
        </div>
        {confirmation?.type === 'cancel' && confirmation.id === item.id && <div className="sf-receivables-confirm"><p>{item.cancelledAt ? 'El importe restante volverá a aparecer en tus pendientes.' : 'Dejarás de dar seguimiento al importe pendiente. Los ingresos y vínculos anteriores se conservan.'}</p><div><button type="button" className="button-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Volver</button><button type="button" className="button-primary" disabled={blocked || busy} onClick={() => toggleCancel(item)}>{busy ? 'Guardando…' : item.cancelledAt ? 'Reabrir pendiente' : 'Confirmar cancelación'}</button></div></div>}
        {item.allocations.length > 0 && <details className="sf-receivables-history"><summary>Historial de vínculos ({item.allocations.length})</summary><ul>{item.allocations.map(allocation => <li key={allocation.id}>
          <div><strong data-sensitive className="sensitive-value">{money(allocation.amountMinor, item.currency)}</strong><p>{allocation.transaction ? dateLabel(allocation.transaction.fecha) : 'Movimiento eliminado'} · {allocation.reversedAt ? 'Desvinculado' : allocation.needsReview ? 'Vínculo por revisar' : 'Vinculado'}</p></div>
          <div className="sf-receivables-history-actions">{allocation.transaction && onViewTransaction && <button className="sf-receivables-link" type="button" onClick={() => onViewTransaction(allocation.transaction)}>Ver movimiento<ArrowUpRight size={14} aria-hidden="true" /></button>}{!allocation.reversedAt && <button className="sf-receivables-link" type="button" disabled={blocked || busy || !!suspended} onClick={() => { setConfirmation({ type: 'unlink', id: allocation.id }); operationRef.current = null; setErrors({}); }}>Desvincular</button>}</div>
          {confirmation?.type === 'unlink' && confirmation.id === allocation.id && <div className="sf-receivables-confirm"><p>El cobro volverá a quedar pendiente por este importe. El ingreso seguirá en Movimientos.</p><div><button className="button-secondary" type="button" disabled={busy} onClick={() => setConfirmation(null)}>Conservar vínculo</button><button className="button-primary" type="button" disabled={blocked || busy} onClick={() => unlink(allocation.id)}>{busy ? 'Guardando…' : 'Desvincular ingreso'}</button></div></div>}
        </li>)}</ul></details>}
      </article>
    </li>)}</ul>
    <Modal isOpen={active && !!modal} onClose={requestClose} title={modal?.type === 'receipt' ? 'Registrar cobro recibido' : modal?.type === 'edit' ? 'Editar cobro esperado' : 'Añadir cobro esperado'} description={modal?.type === 'receipt' && selected ? <><span className="break-words">{selected.name}</span> · Pendiente: <span data-sensitive className="sensitive-value">{money(selected.pendingMinor, selected.currency)}</span></> : undefined} className="sf-receivables-modal">
      {closeConfirm && <div className="sf-receivables-confirm" role="alert"><p>Hay un borrador sin guardar.</p><div><button ref={closeConfirmRef} type="button" className="button-primary" onClick={() => setCloseConfirm(false)}>Seguir editando</button><button type="button" className="button-secondary" onClick={discard}>Descartar borrador</button></div></div>}
      {errors.form && <p className="sf-receivables-error-box" role="alert">{errors.form}</p>}
      {modal?.type === 'receipt' ? selected ? <form onSubmit={saveReceipt} noValidate>
        <p className="sf-receivables-receipt-context"><strong>{selected.name}</strong><span data-sensitive className="sensitive-value">{money(selected.pendingMinor, selected.currency)} pendiente</span></p>
        <fieldset disabled={busy || blocked} aria-busy={busy} className="sf-receivables-fields">
          <div className="sf-receivables-segments sf-receivables-receipt-modes" role="group" aria-label="Origen del ingreso"><button type="button" aria-pressed={receipt.mode === 'link'} onClick={() => { changeReceipt('mode', 'link'); }}>Vincular ingreso registrado</button><button type="button" aria-pressed={receipt.mode === 'new'} onClick={() => { changeReceipt('mode', 'new'); }}>Registrar uno nuevo</button></div>
          {receipt.mode === 'link' ? <>
            <p className="sf-receivables-muted">Elige un ingreso que ya registraste. Vincularlo no crea otro movimiento.</p>
            <label htmlFor={ids('income-query')}>Buscar ingreso</label><input id={ids('income-query')} className="field-input" type="search" placeholder="Buscar descripción" value={receipt.search} onChange={event => setReceipt(previous => ({ ...previous, search: event.target.value }))} />
            <fieldset id={ids('transaction')} tabIndex={-1} className="sf-receivables-income-list" aria-describedby={errors.transaction ? ids('transaction-error') : undefined}><legend className="sr-only">Selecciona un ingreso en {selected.currency}</legend>{matchingIncome.length ? matchingIncome.map(income => <label key={income.transaction.id} className={`sf-receivables-income ${receipt.transactionId === income.transaction.id ? 'is-selected' : ''}`}><input type="radio" name={`${formId}-income`} checked={receipt.transactionId === income.transaction.id} disabled={income.availableMinor <= 0} onChange={() => selectIncome(income)} /><span><strong>{income.transaction.descripcion}</strong><span>{dateLabel(income.transaction.fecha)} · Total <span data-sensitive className="sensitive-value">{money(receivableMoneyToMinor(income.transaction.monto), selected.currency)}</span></span><span data-sensitive className="sensitive-value">{income.availableMinor > 0 ? `Disponible para vincular: ${money(income.availableMinor, selected.currency)}` : 'Ya está completamente vinculado'}</span></span>{receipt.transactionId === income.transaction.id && <Check size={17} aria-hidden="true" />}</label>) : <p className="sf-receivables-muted">No hay ingresos disponibles con esta búsqueda y moneda. Puedes registrar uno nuevo sólo si ya recibiste el dinero.</p>}</fieldset>{fieldError('transaction')}
          </> : <>
            <p className="sf-receivables-review">Confirma sólo dinero que ya recibiste. Se creará un ingreso en Movimientos y quedará vinculado a este cobro.</p>
            <div><label htmlFor={ids('descripcion')}>Descripción del ingreso</label><input {...fieldProps('descripcion')} className="field-input" value={receipt.descripcion} maxLength={200} onChange={event => changeReceipt('descripcion', event.target.value)} />{fieldError('descripcion')}</div>
            <div><label htmlFor={ids('fecha')}>Fecha en que recibiste el dinero</label><input {...fieldProps('fecha')} className="field-input" type="date" max={today} value={receipt.fecha} onChange={event => changeReceipt('fecha', event.target.value)} /><p className="sf-receivables-help">La fecha inicial es hoy, {dateLabel(today)}. Cámbiala si lo recibiste antes.</p>{fieldError('fecha')}</div>
          </>}
          <div><label htmlFor={ids('amount')}>Importe que corresponde a este cobro · {selected.currency}</label><input {...fieldProps('amount')} className="field-input" type="number" inputMode="decimal" min="0.01" step="0.01" value={receipt.amount} onChange={event => changeReceipt('amount', event.target.value)} placeholder="0.00" />{fieldError('amount')}</div>
          {receiptMinor > 0 && receiptMinor <= selected.pendingMinor && (receipt.mode === 'new' || (chosenIncome && receiptMinor <= chosenIncome.availableMinor)) && <div className="sf-receivables-preview" aria-live="polite"><p>Se vincularán <strong data-sensitive className="sensitive-value">{money(receiptMinor, selected.currency)}</strong>.</p><p>Quedarán <strong data-sensitive className="sensitive-value">{money(selected.pendingMinor - receiptMinor, selected.currency)}</strong> pendientes de este cobro.</p>{receipt.mode === 'link' && <p>El ingreso conservará <strong data-sensitive className="sensitive-value">{money(chosenIncome.availableMinor - receiptMinor, selected.currency)}</strong> sin vincular.</p>}</div>}
          {receipt.mode === 'new' && <div><label className="sf-receivables-checkbox"><input {...fieldProps('confirmed')} type="checkbox" checked={receipt.confirmed} onChange={event => changeReceipt('confirmed', event.target.checked)} /><span>Confirmo que ya recibí este dinero.</span></label>{fieldError('confirmed')}</div>}
          <div className="sf-receivables-modal-actions"><button type="button" className="button-secondary" onClick={requestClose}>Cancelar</button><button type="submit" className="button-primary">{busy ? 'Guardando…' : receipt.mode === 'link' ? receiptMinor > 0 ? `Vincular ${money(receiptMinor, selected.currency)}` : 'Vincular ingreso' : 'Registrar y vincular ingreso'}</button></div>
        </fieldset>
      </form> : <p role="alert">Este cobro ya no está disponible. Cierra la ventana para revisar la lista actual.</p> : <form onSubmit={saveExpected} noValidate><fieldset disabled={busy || blocked} aria-busy={busy} className="sf-receivables-fields">
        <p className="sf-receivables-muted">Este registro no agrega dinero disponible ni modifica tus ingresos mensuales del plan.</p>
        <div><label htmlFor={ids('name')}>Concepto</label><input {...fieldProps('name')} className="field-input" value={draft.name} onChange={event => changeDraft('name', event.target.value)} maxLength={200} placeholder="Ej. Pago de proyecto o reembolso" />{fieldError('name')}</div>
        <div className="sf-receivables-form-row"><div><label htmlFor={ids('amount')}>Importe esperado</label><input {...fieldProps('amount')} className="field-input" type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.amount} onChange={event => changeDraft('amount', event.target.value)} placeholder="0.00" />{fieldError('amount')}</div><div><label htmlFor={ids('currency')}>Moneda</label><select id={ids('currency')} className="field-input" value={draft.currency} disabled={currencyHasHistory} aria-describedby={currencyHasHistory ? ids('currency-history') : undefined} onChange={event => changeDraft('currency', event.target.value)}><option value="MXN">MXN</option><option value="USD">USD</option></select></div></div>
        {currencyHasHistory && <p id={ids('currency-history')} className="sf-receivables-help">La moneda se conserva para no cambiar el significado de los vínculos del historial. Si era otra moneda, crea un cobro nuevo.</p>}
        <div><label htmlFor={ids('expectedDate')}>Fecha esperada · opcional</label><input {...fieldProps('expectedDate')} className="field-input" type="date" value={draft.expectedDate} onChange={event => changeDraft('expectedDate', event.target.value)} /><p className="sf-receivables-help">Déjala vacía si todavía no hay una fecha acordada.</p>{fieldError('expectedDate')}</div>
        <div><label htmlFor={ids('note')}>Nota · opcional</label><textarea {...fieldProps('note')} className="field-input" rows={3} maxLength={2000} value={draft.note} onChange={event => changeDraft('note', event.target.value)} placeholder="Referencia o acuerdo que quieras recordar" />{fieldError('note')}</div>
        <div className="sf-receivables-modal-actions"><button type="button" className="button-secondary" onClick={requestClose}>Cancelar</button><button type="submit" className="button-primary">{busy ? 'Guardando…' : modal?.type === 'edit' ? 'Guardar cambios' : 'Guardar cobro esperado'}</button></div>
      </fieldset></form>}
    </Modal>
  </section>;
}
