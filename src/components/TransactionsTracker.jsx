import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, ReceiptText, RotateCcw, Search, Sparkles, Trash2, Upload, Wallet, X } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';
import { filterTransactions, getLocalDate, isValidTransactionDate, moneyToCents, summarizeTransactions, TRANSACTION_CATEGORIES, validateTransaction } from '../services/transactionAnalytics';
import { applyTransactionEdit, createTransactionEdit, isUncategorizedTransaction, isWithinTransactionDateLimit, transactionToDraft, undoTransactionEdit } from '../services/transactionEdits';
import { useToast } from './Toast';
import Modal from './ui/Modal';
import ExpectedReceivables from './ExpectedReceivables';
import { TRANSACTION_VIEWS } from '../data/navigation.js';
import './TransactionsTracker.css';

const createDraft = (date = getLocalDate()) => ({ fecha: date, descripcion: '', monto: '', tipo: 'GASTO', categoria: '', metodoPago: '', moneda: 'MXN' });
const monthLabel = period => new Date(`${period}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
const dateLabel = date => isValidTransactionDate(date) ? new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Fecha por revisar';
const isPeriod = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith('0000');
const categoryLabel = transaction => isUncategorizedTransaction(transaction) ? 'Sin categoría' : transaction.categoria === 'Sin categoría' ? 'Sin categoría (asignada)' : transaction.categoria;

export default function TransactionsTracker({
  financialData, onUpdateTransactions, exchangeRate = 19.25, displayCurrency = 'MXN',
  quickAddRequest = 0, onQuickAdd, onImportStatement, onOpenAssistant, transactionContext, onNavigateTab,
  onReceivableCommand, readOnly = false, active = true, requestedView, onViewChange,
}) {
  const { addToast } = useToast();
  const formId = useId();
  const pageHeadingRef = useRef(null);
  const expectedHeadingRef = useRef(null);
  const wasActive = useRef(false);
  const pendingViewFocus = useRef(null);
  const historyRef = useRef(null);
  const seenContexts = useRef(new Set());
  const lastQuickAdd = useRef(0);
  const savingRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activityView, setActivityView] = useState(() => TRANSACTION_VIEWS.includes(requestedView) ? requestedView : 'registered');
  const [period, setPeriod] = useState(() => getLocalDate().slice(0, 7));
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState(null);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [focusedTransactionId, setFocusedTransactionId] = useState(null);
  const [dateThrough, setDateThrough] = useState(null);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const [showAllBudgets, setShowAllBudgets] = useState(false);
  const [newTx, setNewTx] = useState(createDraft);
  const [editor, setEditor] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState(null);
  const [errors, setErrors] = useState({});
  const draft = editor ? editor.draft : newTx;

  useEffect(() => { if (quickAddRequest > lastQuickAdd.current) { lastQuickAdd.current = quickAddRequest; openAdd(); } }, [quickAddRequest]);
  useEffect(() => { if (!active || activityView !== 'registered') setShowAddModal(false); }, [active, activityView]);
  useEffect(() => {
    const entered = active && !wasActive.current;
    wasActive.current = active;
    if (!active) { pendingViewFocus.current = null; return undefined; }
    const view = requestedView === undefined ? activityView : TRANSACTION_VIEWS.includes(requestedView) ? requestedView : 'registered';
    const changed = view !== activityView;
    if (changed) setActivityView(view);
    // A selector keeps its own focus. External navigation opens the named view;
    // contextual movement requests manage their own history/editor focus below.
    if (Number.isFinite(transactionContext?.request) && !seenContexts.current.has(transactionContext.request)) { pendingViewFocus.current = null; return undefined; }
    if (entered || changed) pendingViewFocus.current = { view, origin: document.activeElement };
    const intent = pendingViewFocus.current;
    if (!intent || intent.view !== view) return undefined;
    const frame = requestAnimationFrame(() => {
      if (pendingViewFocus.current !== intent) return;
      pendingViewFocus.current = null;
      if (document.activeElement !== intent.origin && document.activeElement !== document.body && document.activeElement?.id !== 'main-content') return;
      (view === 'expected' ? expectedHeadingRef : pageHeadingRef).current?.focus({ preventScroll: true });
    });
    // Keep an unconsumed intent through StrictMode's setup/cleanup replay.
    return () => cancelAnimationFrame(frame);
  }, [requestedView, active]);
  useEffect(() => setVisibleCount(12), [period, filterType, filterCategory, uncategorizedOnly, focusedTransactionId, dateThrough, search]);
  useEffect(() => {
    if (!Number.isFinite(transactionContext?.request) || seenContexts.current.has(transactionContext.request)) return;
    seenContexts.current.add(transactionContext.request);
    setActivityView('registered');
    if (isPeriod(transactionContext.period)) setPeriod(transactionContext.period);
    setFilterType(['ALL', 'INGRESO', 'GASTO'].includes(transactionContext.type) ? transactionContext.type : 'ALL');
    setFilterCategory(typeof transactionContext.category === 'string' && transactionContext.category.trim() ? transactionContext.category : null);
    setUncategorizedOnly(transactionContext.uncategorized === true);
    setFocusedTransactionId(null);
    setDateThrough(isValidTransactionDate(transactionContext.dateThrough) ? transactionContext.dateThrough : null);
    setSearch('');
    if (transactionContext.transactionId) {
      const transaction = (financialData?.transacciones || []).find(item => item.id === transactionContext.transactionId);
      if (transaction) {
        if (!isPeriod(transactionContext.period) && isValidTransactionDate(transaction.fecha)) setPeriod(transaction.fecha.slice(0, 7));
        if (transactionContext.edit === false) {
          setFocusedTransactionId(transaction.id);
          focusHistory();
        } else openEdit(transaction);
      } else addToast({ message: 'Este movimiento ya no está disponible.', type: 'info' });
    } else focusHistory();
  }, [transactionContext, financialData?.transacciones]);

  const summary = useMemo(() => {
    const transactions = financialData?.transacciones || [];
    const budgets = [...(financialData?.gastosNecesarios || []), ...(financialData?.gastosOpcionales || [])];
    const uncategorizedBudgets = budgets.filter(isUncategorizedTransaction);
    const allRecords = [...transactions, ...budgets];
    const existingNames = new Set(allRecords.map(item => item.categoria));
    let temporaryKey = '__uncategorized__';
    while (existingNames.has(temporaryKey)) temporaryKey += '_';
    let temporaryBudgetKey = `${temporaryKey}_budget`;
    while (existingNames.has(temporaryBudgetKey)) temporaryBudgetKey += '_';
    const presentationCategory = item => isUncategorizedTransaction(item) ? { ...item, categoria: temporaryKey } : item;
    const presentationBudgetCategory = item => isUncategorizedTransaction(item) ? { ...item, categoria: temporaryBudgetKey } : item;
    const isValidBudget = item => {
      const cents = moneyToCents(item.monto);
      return cents !== null && cents >= 0 && ['MXN', 'USD'].includes(item.moneda ?? 'MXN');
    };
    const validBudgetCategories = new Set(budgets.filter(item => !isUncategorizedTransaction(item) && isValidBudget(item)).map(item => item.categoria));
    const aggregated = summarizeTransactions({
      ...financialData,
      transacciones: transactions.map(presentationCategory),
      gastosNecesarios: (financialData?.gastosNecesarios || []).map(presentationBudgetCategory),
      gastosOpcionales: (financialData?.gastosOpcionales || []).map(presentationBudgetCategory),
    }, period, exchangeRate, displayCurrency);
    const uncategorizedBudgetAmount = aggregated.categories.find(item => item.category === temporaryBudgetKey)?.budget;
    return {
      ...aggregated,
      uncategorizedBudget: {
        count: uncategorizedBudgets.length,
        amount: uncategorizedBudgets.every(isValidBudget) && moneyToCents(uncategorizedBudgetAmount) !== null ? uncategorizedBudgetAmount : null,
      },
      transactions: transactions.filter(item => isValidTransactionDate(item.fecha) && item.fecha.startsWith(`${period}-`)),
      categories: aggregated.categories.filter(item => item.category !== temporaryBudgetKey).map(item => {
        const hasBudget = validBudgetCategories.has(item.category);
        return {
          ...item, hasBudget, overBudget: hasBudget && item.spent > item.budget,
          uncategorized: item.category === temporaryKey,
          label: item.category === temporaryKey ? 'Sin categoría' : item.category === 'Sin categoría' ? 'Sin categoría (asignada)' : item.category,
        };
      }),
    };
  }, [financialData, period, exchangeRate, displayCurrency]);
  const filteredList = useMemo(() => filterTransactions(summary.transactions, { type: filterType, query: search }).filter(transaction =>
    (!uncategorizedOnly || isUncategorizedTransaction(transaction)) &&
    (uncategorizedOnly || filterCategory === null || (!isUncategorizedTransaction(transaction) && transaction.categoria === filterCategory)) &&
    (!focusedTransactionId || transaction.id === focusedTransactionId) && isWithinTransactionDateLimit(transaction, dateThrough)), [summary.transactions, filterType, filterCategory, uncategorizedOnly, focusedTransactionId, dateThrough, search]);
  const categories = useMemo(() => [...new Set([...TRANSACTION_CATEGORIES, ...(financialData?.transacciones || []).map(transaction => transaction.categoria), ...summary.categories.filter(item => !item.uncategorized).map(item => item.category)].filter(category => typeof category === 'string' && category.trim()))], [financialData, summary.categories]);
  const hasFilters = search.trim() || filterType !== 'ALL' || filterCategory !== null || uncategorizedOnly || focusedTransactionId || dateThrough;
  const money = value => formatMoney(value, summary.currency);
  const changeActivityView = view => {
    pendingViewFocus.current = null;
    setActivityView(view);
    onViewChange?.(view);
  };
  const budgetRows = showAllBudgets ? summary.categories : summary.categories.slice(0, 5);
  const idFor = field => `${formId}-${field}`;

  const openAdd = () => {
    if (onQuickAdd) { onQuickAdd(); return; }
    setEditor(null);
    if (!newTx.descripcion && !newTx.monto) setNewTx(previous => ({ ...previous, fecha: period === getLocalDate().slice(0, 7) ? getLocalDate() : `${period}-01` }));
    setErrors({});
    setSaveError('');
    setShowAddModal(true);
  };
  const openEdit = transaction => {
    if (!transaction.id) { addToast({ message: 'Este registro necesita un identificador antes de poder editarse.', type: 'error' }); return; }
    const editDraft = transactionToDraft(transaction);
    setEditor({ original: { ...transaction }, draft: editDraft });
    setErrors(validateTransaction(editDraft));
    setSaveError('');
    setShowAddModal(true);
  };
  const closeEditor = () => {
    setShowAddModal(false);
    if (!savingRef.current) { setEditor(null); setSaveError(''); setErrors({}); }
  };
  const focusHistory = () => requestAnimationFrame(() => {
    historyRef.current?.focus({ preventScroll: true });
    historyRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  });

  const changePeriod = offset => {
    const date = new Date(`${period}-15T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setPeriod(getLocalDate(date).slice(0, 7));
  };

  const updateDraft = (field, value) => {
    if (editor) setEditor(previous => ({ ...previous, draft: { ...previous.draft, [field]: value } }));
    else setNewTx(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
  };

  const isVisibleInCurrentView = transaction => isValidTransactionDate(transaction.fecha) && transaction.fecha.startsWith(`${period}-`) &&
    filterTransactions([transaction], { type: filterType, query: search }).length > 0 &&
    (uncategorizedOnly ? isUncategorizedTransaction(transaction) : filterCategory === null || (!isUncategorizedTransaction(transaction) && transaction.categoria === filterCategory)) &&
    (!focusedTransactionId || transaction.id === focusedTransactionId) && isWithinTransactionDateLimit(transaction, dateThrough);

  const undoEdit = async edit => {
    try {
      let outcome;
      await onUpdateTransactions(previous => { outcome = undoTransactionEdit(previous, edit); return outcome.transactions; });
      const message = outcome?.status === 'restored' ? 'Cambios deshechos.' : outcome?.status === 'partial'
        ? 'Se deshicieron los campos disponibles. Conservamos los que editaste después.'
        : outcome?.status === 'missing' ? 'El movimiento fue eliminado; no se restauró.'
        : 'El movimiento cambió después. Conservamos su versión actual.';
      setSaveNotice({ message });
      addToast({ message, type: outcome?.status === 'restored' ? 'success' : 'info' });
    } catch (error) { addToast({ message: error.message || 'No se pudieron deshacer los cambios. Intenta de nuevo.', type: 'error' }); }
  };

  const handleAddTx = async event => {
    event.preventDefault();
    if (savingRef.current) return;
    const validation = validateTransaction(draft);
    if (Object.keys(validation).length) {
      setErrors(validation);
      requestAnimationFrame(() => document.getElementById(idFor(Object.keys(validation)[0]))?.focus());
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError('');
    try {
      let transaction;
      let onUndo;
      if (editor) {
        const { edit } = createTransactionEdit(editor.original, draft);
        let outcome;
        await onUpdateTransactions(previous => {
          outcome = applyTransactionEdit(previous, edit);
          if (outcome.status === 'missing') throw new Error('Este movimiento fue eliminado. Tu borrador sigue aquí para que puedas revisarlo.');
          if (outcome.status === 'conflict') throw new Error('El movimiento cambió mientras lo editabas. Cancela y vuelve a abrirlo para revisar la versión actual.');
          return outcome.transactions;
        });
        if (!outcome) throw new Error('No pudimos confirmar el cambio. Conservamos tu borrador.');
        transaction = outcome.transaction;
        if (outcome.status === 'updated') onUndo = () => undoEdit(edit);
      } else {
        transaction = { ...draft, id: `tx_${crypto.randomUUID()}`, descripcion: draft.descripcion.trim(), monto: moneyToCents(draft.monto) / 100, metodoPago: draft.metodoPago.trim() };
        await onUpdateTransactions(previous => [transaction, ...previous]);
        setNewTx(createDraft(draft.fecha));
        onUndo = async () => {
          try {
            await onUpdateTransactions(previous => previous.filter(item => item.id !== transaction.id || Object.keys(item).length !== Object.keys(transaction).length || Object.keys(transaction).some(key => !Object.is(item[key], transaction[key]))));
            setSaveNotice({ message: 'Se deshizo el registro si no tuvo cambios posteriores.' });
          } catch (error) { addToast({ message: error.message || 'No se pudo deshacer el registro.', type: 'error' }); }
        };
      }
      const leftView = !isVisibleInCurrentView(transaction);
      const message = editor ? 'Movimiento actualizado.' : `Movimiento guardado en ${monthLabel(transaction.fecha.slice(0, 7))}.`;
      setSaveNotice({ message: leftView ? `${message} Ya no aparece con el mes o los filtros actuales.` : message, transaction, leftView, onUndo });
      setShowAddModal(false);
      setEditor(null);
      addToast({ message });
    } catch (error) { setSaveError(error.message || 'No se pudo guardar. Tu borrador sigue aquí; intenta de nuevo.'); }
    finally { savingRef.current = false; setIsSaving(false); }
  };

  const handleDeleteTx = async transaction => {
    try {
      let index = -1;
      let removed;
      await onUpdateTransactions(previous => {
        index = previous.findIndex(item => item.id === transaction.id);
        removed = previous[index];
        return previous.filter(item => item.id !== transaction.id);
      });
      if (!removed) return;
      addToast({ message: 'Movimiento eliminado.', type: 'info', duration: 8000, onUndo: async () => {
        try { await onUpdateTransactions(previous => {
          if (previous.some(item => item.id === transaction.id)) return previous;
          const restored = [...previous];
          restored.splice(Math.max(0, Math.min(index, restored.length)), 0, removed);
          return restored;
        }); } catch (error) { addToast({ message: error.message || 'No se pudo restaurar el movimiento.', type: 'error' }); }
      } });
    } catch (error) { addToast({ message: error.message || 'No se pudo eliminar el movimiento.', type: 'error' }); }
  };

  const clearFilters = () => { setSearch(''); setFilterType('ALL'); setFilterCategory(null); setUncategorizedOnly(false); setFocusedTransactionId(null); setDateThrough(null); };
  const selectBudgetCategory = item => { setSearch(''); setFilterType('GASTO'); setFilterCategory(item.uncategorized ? null : item.category); setUncategorizedOnly(item.uncategorized); setFocusedTransactionId(null); focusHistory(); };
  const revealTransaction = transaction => {
    const current = (financialData?.transacciones || []).find(item => item.id === transaction.id);
    if (!current) { addToast({ message: 'Este movimiento ya no está disponible.', type: 'info' }); return; }
    changeActivityView('registered');
    if (!isValidTransactionDate(current.fecha)) { openEdit(current); return; }
    clearFilters();
    setPeriod(current.fecha.slice(0, 7));
    setFocusedTransactionId(current.id);
    focusHistory();
  };
  const amountFor = transaction => (
    <span data-sensitive className={`sensitive-value whitespace-nowrap font-semibold tabular-nums ${transaction.tipo === 'INGRESO' ? 'text-[#7DE4BF]' : 'text-[#EDF2F8]'}`}>
      {transaction.tipo === 'INGRESO' ? '+' : '−'}{formatMoney(transaction.monto, transaction.moneda)} <span className="text-[11px] font-medium text-[#A4B1C3]">{transaction.moneda || 'MXN'}</span>
    </span>
  );
  const rowActions = transaction => <div className="sf-transactions-row-actions"><button type="button" onClick={() => openEdit(transaction)} aria-label={`Editar ${transaction.descripcion}`}><Pencil size={16} aria-hidden="true" /><span>Editar</span></button><button type="button" onClick={() => handleDeleteTx(transaction)} className="sf-transactions-delete" aria-label={`Eliminar ${transaction.descripcion}`}><Trash2 size={17} aria-hidden="true" /></button></div>;
  const fieldLabel = (field, label) => <label htmlFor={idFor(field)} className="mb-1.5 block text-[13px] font-medium text-[#C5D0DD]">{label}</label>;
  const fieldError = field => errors[field] && <p id={idFor(`${field}-error`)} role="alert" className="mt-1 text-xs text-rose-300">{errors[field]}</p>;
  const inputProps = field => ({ id: idFor(field), value: draft[field], onChange: event => updateDraft(field, event.target.value), className: 'field-input w-full', 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? idFor(`${field}-error`) : undefined });

  return (
    <div className="sf-transactions space-y-6">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div><p className="eyebrow mb-2">TU ACTIVIDAD</p><h1 ref={pageHeadingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">Cada movimiento, en su lugar.</h1><p className="mt-2 text-sm leading-relaxed text-[#A4B1C3]">Encuentra tus gastos, registra ingresos y sigue tu presupuesto.</p></div>
        <div hidden={activityView !== 'registered'} className="sf-transactions-header-actions flex flex-wrap gap-2">
          {onImportStatement && <button type="button" onClick={onImportStatement} className="button-secondary inline-flex items-center justify-center gap-2"><Upload size={16} aria-hidden="true" />Importar estado de cuenta</button>}
          <button type="button" onClick={openAdd} className="button-primary inline-flex items-center justify-center gap-2"><Plus size={18} aria-hidden="true" />Registrar movimiento</button>
        </div>
      </header>

      <div className="sf-transactions-view-switch" role="group" aria-label="Vista de movimientos">
        <button type="button" aria-pressed={activityView === 'registered'} onClick={() => changeActivityView('registered')}>Movimientos registrados</button>
        <button type="button" aria-pressed={activityView === 'expected'} onClick={() => changeActivityView('expected')}>Cobros esperados</button>
      </div>
      <p className="sr-only" role="status">{activityView === 'expected' ? 'Vista de cobros esperados' : 'Vista de movimientos registrados'}</p>
      <ExpectedReceivables financialData={financialData} onReceivableCommand={onReceivableCommand} readOnly={readOnly} active={active && activityView === 'expected'} headingRef={expectedHeadingRef} onViewTransaction={revealTransaction} />
      <div hidden={activityView !== 'registered'} className="sf-transactions-registered space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#223248] bg-[#111B29] p-1">
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-[#A4B1C3] transition-colors hover:bg-white/5 hover:text-white" onClick={() => changePeriod(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <label htmlFor={`${formId}-period`} className="sr-only">Mes de los movimientos y presupuesto</label>
          <input id={`${formId}-period`} type="month" value={period} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && !event.target.value.startsWith('0000')) setPeriod(event.target.value); }} className="min-w-0 max-w-[180px] rounded-lg bg-transparent px-1 py-2 text-sm font-medium text-white [color-scheme:dark]" />
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-[#A4B1C3] transition-colors hover:bg-white/5 hover:text-white" onClick={() => changePeriod(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
        </div>
        <p className="text-[13px] text-[#A4B1C3]">Resumen del mes en <span className="font-semibold text-[#DCE5EF]">{summary.currency}</span> · Filas en moneda original</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Ingresos registrados', amount: summary.income, Icon: ArrowDownLeft, color: 'text-[#7DE4BF]', background: 'bg-[#7DE4BF]/10' },
          { label: 'Gastos registrados', amount: summary.expenses, Icon: ArrowUpRight, color: 'text-[#F4C88C]', background: 'bg-[#F4C88C]/10' },
          { label: 'Balance de movimientos', amount: summary.net, Icon: Wallet, color: summary.net < 0 ? 'text-[#F7A9B8]' : 'text-[#C7BBF5]', background: 'bg-[#C7BBF5]/10' },
        ].map(({ label, amount, Icon, color, background }) => (
          <div key={label} className="surface-card flex items-center gap-4 p-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${background} ${color}`}><Icon size={19} aria-hidden="true" /></span><div className="min-w-0"><p className="text-[13px] text-[#A4B1C3]">{label}</p><p data-sensitive className="sensitive-value mt-1 break-words text-2xl font-semibold tracking-tight text-white tabular-nums">{money(amount)}</p></div></div>
        ))}
      </div>
      {summary.excludedCount > 0 && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">{summary.excludedCount} movimiento(s) con importe o moneda inválidos no se incluyen en el resumen.</p>}
      {saveNotice && <motion.div className="sf-transactions-notice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}><p role="status">{saveNotice.message}</p><div>{saveNotice.leftView && <button type="button" onClick={() => revealTransaction(saveNotice.transaction)}>Ver movimiento<ArrowUpRight size={16} aria-hidden="true" /></button>}{saveNotice.onUndo && <button type="button" onClick={saveNotice.onUndo}><RotateCcw size={16} aria-hidden="true" />Deshacer</button>}<button type="button" className="sf-transactions-dismiss" onClick={() => setSaveNotice(null)} aria-label="Cerrar aviso de movimiento"><X size={17} aria-hidden="true" /></button></div></motion.div>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface-card min-w-0 overflow-hidden" aria-labelledby={`${formId}-history`}>
          <div className="border-b border-[#223248] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5"><h2 id={`${formId}-history`} ref={historyRef} tabIndex={-1} className="sf-transactions-history-title text-base font-semibold text-white">Movimientos</h2><span aria-live="polite" className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-[#A4B1C3]">{filteredList.length}</span></div>
              <div className="sf-transactions-filters inline-flex rounded-lg bg-[#0B1420] p-1" role="group" aria-label="Tipo de movimiento">{[['ALL', 'Todos'], ['GASTO', 'Gastos'], ['INGRESO', 'Ingresos']].map(([value, label]) => <button type="button" key={value} onClick={() => { setFilterType(value); setFocusedTransactionId(null); }} aria-pressed={filterType === value} className={`min-h-9 rounded-md px-3 text-[13px] font-medium transition-colors ${filterType === value ? 'bg-[#223248] text-white shadow-sm' : 'text-[#A4B1C3] hover:text-white'}`}>{label}</button>)}</div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A4B1C3]" /><label htmlFor={`${formId}-search`} className="sr-only">Buscar movimientos</label><input id={`${formId}-search`} type="search" placeholder="Buscar descripción o método de pago" value={search} onChange={event => { setSearch(event.target.value); setFocusedTransactionId(null); }} className="field-input w-full !pl-10 text-sm" /></div>
              <label htmlFor={`${formId}-category-filter`} className="sr-only">Filtrar por categoría</label><select id={`${formId}-category-filter`} value={uncategorizedOnly ? 'uncategorized' : filterCategory === null ? 'all' : `category:${filterCategory}`} onChange={event => { const value = event.target.value; setUncategorizedOnly(value === 'uncategorized'); setFilterCategory(value.startsWith('category:') ? value.slice(9) : null); setFocusedTransactionId(null); }} className="field-input w-full text-[13px] sm:w-[180px]"><option value="all">Todas las categorías</option><option value="uncategorized">Sin categoría · sin asignar</option>{categories.map(category => <option key={category} value={`category:${category}`}>{category === 'Sin categoría' ? 'Sin categoría (asignada)' : category}</option>)}</select>
            </div>
            {hasFilters && <div className="sf-transactions-filter-chips" aria-label="Filtros aplicados">{filterType !== 'ALL' && <button type="button" onClick={() => setFilterType('ALL')} aria-label="Quitar filtro de tipo">{filterType === 'GASTO' ? 'Gastos' : 'Ingresos'}<X size={14} aria-hidden="true" /></button>}{(filterCategory !== null || uncategorizedOnly) && <button type="button" onClick={() => { setFilterCategory(null); setUncategorizedOnly(false); }} aria-label="Quitar filtro de categoría">{uncategorizedOnly ? 'Sin categoría' : filterCategory === 'Sin categoría' ? 'Sin categoría (asignada)' : filterCategory}<X size={14} aria-hidden="true" /></button>}{focusedTransactionId && <button type="button" onClick={() => setFocusedTransactionId(null)} aria-label="Quitar filtro de movimiento">Movimiento seleccionado<X size={14} aria-hidden="true" /></button>}{dateThrough && <button type="button" onClick={() => setDateThrough(null)} aria-label="Quitar límite de fecha">Hasta {dateLabel(dateThrough)} {dateThrough.slice(0, 4)}<X size={14} aria-hidden="true" /></button>}{search.trim() && <button type="button" onClick={() => setSearch('')} aria-label="Quitar búsqueda">Búsqueda: {search}<X size={14} aria-hidden="true" /></button>}</div>}
          </div>
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center"><div className="mb-4 rounded-2xl border border-[#223248] bg-[#172334] p-4"><ReceiptText size={26} aria-hidden="true" className="text-[#7DE4BF]" /></div><h4 className="text-base font-semibold text-white">{hasFilters ? 'No hay coincidencias' : 'Este mes empieza contigo'}</h4><p className="mt-2 max-w-xs text-sm leading-relaxed text-[#A4B1C3]">{hasFilters ? 'Prueba otra búsqueda o quita los filtros para ver tus movimientos.' : `Aún no hay movimientos en ${monthLabel(period)}. Registra el primero para ver cómo va tu mes.`}</p><button type="button" onClick={hasFilters ? clearFilters : openAdd} className="button-secondary mt-5">{hasFilters ? 'Limpiar filtros' : 'Registrar primer movimiento'}</button></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-[13px]">
                  <caption className="sr-only">Movimientos de {monthLabel(period)}. Importes en su moneda original.</caption>
                  <thead><tr className="border-b border-[#223248] text-xs text-[#A4B1C3]"><th scope="col" className="px-5 py-3 font-medium">Movimiento</th><th scope="col" className="px-3 py-3 font-medium">Categoría</th><th scope="col" className="px-3 py-3 text-right font-medium">Importe</th><th scope="col" className="w-12 py-3"><span className="sr-only">Acciones</span></th></tr></thead>
                  <tbody className="divide-y divide-[#223248]/70">{filteredList.slice(0, visibleCount).map(transaction => (
                    <tr key={transaction.id} className="transition-colors hover:bg-white/[0.025]">
                      <td className="py-4 pl-5 pr-3"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${transaction.tipo === 'INGRESO' ? 'bg-[#7DE4BF]/10 text-[#7DE4BF]' : 'bg-white/5 text-[#A4B1C3]'}`}>{transaction.tipo === 'INGRESO' ? <ArrowDownLeft size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}</span><div className="min-w-0"><p className="max-w-[260px] break-words font-medium text-[#EDF2F8]">{transaction.descripcion}</p><p className="mt-1 text-xs text-[#A4B1C3]"><time dateTime={transaction.fecha}>{dateLabel(transaction.fecha)}</time>{transaction.metodoPago && ` · ${transaction.metodoPago}`}</p></div></div></td>
                      <td className="px-3 py-4"><span className="sf-transactions-category rounded-md border border-[#223248] bg-[#142030] px-2 py-1 text-xs text-[#BCC8D7]">{categoryLabel(transaction)}</span></td>
                      <td className="px-3 py-4 text-right">{amountFor(transaction)}</td><td className="py-3 pr-3">{rowActions(transaction)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <ul className="divide-y divide-[#223248] md:hidden">{filteredList.slice(0, visibleCount).map(transaction => (
                <li key={transaction.id} className="p-4"><div className="min-w-0"><p className="break-words text-sm font-medium text-white">{transaction.descripcion}</p><p className="mt-1 text-xs text-[#A4B1C3]"><time dateTime={transaction.fecha}>{dateLabel(transaction.fecha)}</time> · {categoryLabel(transaction)}</p>{transaction.metodoPago && <p className="mt-1 text-xs text-[#A4B1C3]">{transaction.metodoPago}</p>}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2">{rowActions(transaction)}{amountFor(transaction)}</div></li>
              ))}</ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#223248] px-5 py-3.5"><p className="text-xs text-[#A4B1C3]">{Math.min(visibleCount, filteredList.length)} de {filteredList.length} movimientos · {monthLabel(period)}</p>{visibleCount < filteredList.length && <button type="button" onClick={() => setVisibleCount(count => count + 12)} className="inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-[#7DE4BF]">Mostrar más<ChevronDown size={15} aria-hidden="true" /></button>}{hasFilters && <button type="button" onClick={clearFilters} className="min-h-10 text-[13px] text-[#A4B1C3] hover:text-white">Limpiar filtros</button>}</div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5" aria-labelledby={`${formId}-budget`}>
            <h3 id={`${formId}-budget`} className="text-base font-semibold text-white">Tu presupuesto, al día</h3><p className="mt-1 text-[13px] leading-relaxed text-[#A4B1C3]">Gastos de {monthLabel(period)} frente a tus límites mensuales actuales. {summary.currency}.</p>
            <div className="mt-6 space-y-6">{budgetRows.map(item => (
              <button type="button" key={item.category} className="sf-transactions-budget-row" onClick={() => selectBudgetCategory(item)} aria-label={`Ver gastos de ${item.label} en ${monthLabel(period)}`}>
                <span className="flex items-start justify-between gap-3 text-[13px]"><span className="font-medium text-[#EDF2F8]">{item.label}</span><span data-sensitive className="sensitive-value whitespace-nowrap font-semibold text-white tabular-nums">{money(item.spent)}</span></span>
                {!item.uncategorized && <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[#223248]" role={item.percentage === null ? undefined : 'meter'} aria-label={`${item.label}: presupuesto consumido`} aria-valuenow={item.percentage === null ? undefined : Math.min(100, item.percentage)} aria-valuemin={item.percentage === null ? undefined : 0} aria-valuemax={item.percentage === null ? undefined : 100} aria-valuetext={item.percentage === null ? undefined : `${Math.round(item.percentage)}% del presupuesto consumido`}><span className={`block h-full rounded-full ${item.overBudget ? 'bg-[#F7A9B8]' : item.percentage >= 80 ? 'bg-[#F4C88C]' : 'bg-[#7DE4BF]'}`} style={{ width: `${item.percentage === null ? item.hasBudget && item.spent > 0 ? 100 : 0 : Math.min(100, item.percentage)}%` }} /></span>}
                <span className="mt-2 flex items-start justify-between gap-2 text-xs text-[#A4B1C3]">{item.uncategorized ? <span>Categoría por asignar</span> : !item.hasBudget ? <span>Sin presupuesto</span> : <><span data-sensitive className="sensitive-value">{item.percentage === null ? `${money(item.budget)} presupuestado` : `${Math.round(item.percentage)}% de ${money(item.budget)}`}</span><span data-sensitive className={`sensitive-value text-right ${item.overBudget ? 'text-[#F7A9B8]' : ''}`}>{item.overBudget ? `${money(Math.abs(item.remaining))} de más` : `${money(item.remaining)} libre`}</span></>}</span>
                <span className="sf-transactions-budget-link">Ver movimientos<ArrowUpRight size={14} aria-hidden="true" /></span>
              </button>
            ))}{budgetRows.length === 0 && <p className="text-sm leading-relaxed text-[#A4B1C3]">Tus categorías aparecerán cuando registres un gasto o configures un presupuesto.</p>}</div>
            {summary.categories.length > 5 && <button type="button" onClick={() => setShowAllBudgets(value => !value)} className="mt-5 flex min-h-10 w-full items-center justify-center gap-1 border-t border-[#223248] pt-3 text-[13px] text-[#A4B1C3] hover:text-white" aria-expanded={showAllBudgets}>{showAllBudgets ? 'Ver menos' : `Ver las ${summary.categories.length} categorías`}<ChevronDown size={15} className={showAllBudgets ? 'rotate-180' : ''} aria-hidden="true" /></button>}
            {summary.uncategorizedBudget.count > 0 && <div className="sf-transactions-unassigned-budget" role="note" aria-label="Presupuesto por clasificar">
              <p>{summary.uncategorizedBudget.count} {summary.uncategorizedBudget.count === 1 ? 'concepto' : 'conceptos'} del presupuesto sin categoría</p>
              {summary.uncategorizedBudget.amount !== null ? <p data-sensitive className="sensitive-value">{money(summary.uncategorizedBudget.amount)} previstos</p> : <p>Importes por revisar</p>}
              <p>Asigna una categoría para compararlos con tus movimientos.</p>
            </div>}
            {onNavigateTab && <button type="button" className="sf-transactions-review-budget" onClick={() => onNavigateTab('budget')}>Revisar presupuesto<ArrowUpRight size={16} aria-hidden="true" /></button>}
          </section>
          {onOpenAssistant && <button type="button" onClick={() => onOpenAssistant(`Revisa mis movimientos de ${monthLabel(period)} (${period}). ¿En qué categorías gasté más y cómo se compara con mi presupuesto configurado? Distingue los registros de los gastos que todavía no he capturado.`)} className="group w-full rounded-2xl border border-[#C7BBF5]/20 bg-[#C7BBF5]/[0.06] p-5 text-left transition-colors hover:border-[#C7BBF5]/40 hover:bg-[#C7BBF5]/10"><div className="flex items-center justify-between gap-3"><Sparkles size={19} className="text-[#C7BBF5]" aria-hidden="true" /><ArrowUpRight size={17} className="text-[#C7BBF5] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></div><p className="mt-3 text-sm font-semibold text-[#E3DBFF]">Entiende tu mes con Claude</p><p className="mt-1.5 text-[13px] leading-relaxed text-[#B6ACC9]">Explora tus gastos y encuentra preguntas útiles para tu siguiente decisión.</p></button>}
        </aside>
      </div>

      </div>
      <Modal isOpen={active && activityView === 'registered' && showAddModal} onClose={closeEditor} title={editor ? 'Editar movimiento' : 'Registrar movimiento'} description={editor ? 'Actualiza los datos que necesites. Conservaremos la información de origen del registro.' : 'Un pequeño registro. Una imagen más clara de tu dinero.'}>
        <form onSubmit={handleAddTx} noValidate>
          {saveError && <p role="alert" className="sf-transactions-save-error">{saveError}</p>}
          <fieldset disabled={isSaving} className="space-y-4" aria-busy={isSaving}>
          <div className="grid grid-cols-2 gap-3"><div>{fieldLabel('tipo', 'Tipo')}<select {...inputProps('tipo')}>{!['GASTO', 'INGRESO'].includes(draft.tipo) && <option value={draft.tipo}>Selecciona un tipo</option>}<option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select>{fieldError('tipo')}</div><div>{fieldLabel('fecha', 'Fecha')}<input {...inputProps('fecha')} type="date" required />{fieldError('fecha')}</div></div>
          <div>{fieldLabel('descripcion', 'Descripción')}<input {...inputProps('descripcion')} type="text" required maxLength={200} placeholder="Ej. Supermercado o pago de cliente" />{fieldError('descripcion')}</div>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3"><div>{fieldLabel('monto', 'Importe')}<input {...inputProps('monto')} type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder="0.00" />{fieldError('monto')}</div><div>{fieldLabel('moneda', 'Moneda')}<select {...inputProps('moneda')}>{!['MXN', 'USD'].includes(draft.moneda) && <option value={draft.moneda}>Selecciona</option>}<option value="MXN">MXN</option><option value="USD">USD</option></select>{fieldError('moneda')}</div></div>
          <div>{fieldLabel('categoria', 'Categoría')}<select {...inputProps('categoria')}><option value="">Sin categoría · sin asignar</option>{categories.map(category => <option key={category} value={category}>{category === 'Sin categoría' ? 'Sin categoría (asignada)' : category}</option>)}</select></div>
          <div>{fieldLabel('metodoPago', 'Método de pago · opcional')}<input {...inputProps('metodoPago')} type="text" maxLength={100} placeholder="Ej. Débito, transferencia o efectivo" /></div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#223248] pt-4"><button type="button" onClick={closeEditor} className="button-secondary">Cancelar</button><button type="submit" className="button-primary inline-flex items-center justify-center gap-2">{editor ? <Pencil size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{isSaving ? 'Guardando…' : editor ? 'Guardar cambios' : 'Guardar movimiento'}</button></div>
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
