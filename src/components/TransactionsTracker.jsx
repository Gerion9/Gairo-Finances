import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Plus, ReceiptText, Search, Sparkles, Trash2, Upload, Wallet } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';
import { filterTransactions, getLocalDate, moneyToCents, summarizeTransactions, TRANSACTION_CATEGORIES, validateTransaction } from '../services/transactionAnalytics';
import { useToast } from './Toast';
import Modal from './ui/Modal';

const createDraft = (date = getLocalDate()) => ({ fecha: date, descripcion: '', monto: '', tipo: 'GASTO', categoria: 'Alimentos', metodoPago: '', moneda: 'MXN' });
const monthLabel = period => new Date(`${period}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export default function TransactionsTracker({
  financialData, onUpdateTransactions, exchangeRate = 19.25, displayCurrency = 'MXN',
  quickAddRequest = 0, onImportStatement, onOpenAssistant,
}) {
  const { addToast } = useToast();
  const formId = useId();
  const [showAddModal, setShowAddModal] = useState(false);
  const [period, setPeriod] = useState(() => getLocalDate().slice(0, 7));
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const [showAllBudgets, setShowAllBudgets] = useState(false);
  const [newTx, setNewTx] = useState(createDraft);
  const [errors, setErrors] = useState({});

  useEffect(() => { if (quickAddRequest > 0) setShowAddModal(true); }, [quickAddRequest]);
  useEffect(() => setVisibleCount(12), [period, filterType, filterCategory, search]);

  const summary = useMemo(() => summarizeTransactions(financialData, period, exchangeRate, displayCurrency), [financialData, period, exchangeRate, displayCurrency]);
  const filteredList = useMemo(() => filterTransactions(summary.transactions, { type: filterType, category: filterCategory, query: search }), [summary.transactions, filterType, filterCategory, search]);
  const categories = useMemo(() => [...new Set([...TRANSACTION_CATEGORIES, ...(financialData?.transacciones || []).map(transaction => transaction.categoria || 'Otros'), ...summary.categories.map(item => item.category)])], [financialData, summary.categories]);
  const hasFilters = search.trim() || filterType !== 'ALL' || filterCategory !== 'ALL';
  const money = value => formatMoney(value, summary.currency);
  const budgetRows = showAllBudgets ? summary.categories : summary.categories.slice(0, 5);
  const idFor = field => `${formId}-${field}`;

  const openAdd = () => {
    if (!newTx.descripcion && !newTx.monto) setNewTx(previous => ({ ...previous, fecha: period === getLocalDate().slice(0, 7) ? getLocalDate() : `${period}-01` }));
    setErrors({});
    setShowAddModal(true);
  };

  const changePeriod = offset => {
    const date = new Date(`${period}-15T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setPeriod(getLocalDate(date).slice(0, 7));
  };

  const updateDraft = (field, value) => {
    setNewTx(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
  };

  const handleAddTx = event => {
    event.preventDefault();
    const validation = validateTransaction(newTx);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    const transaction = { ...newTx, id: `tx_${crypto.randomUUID()}`, descripcion: newTx.descripcion.trim(), monto: moneyToCents(newTx.monto) / 100, metodoPago: newTx.metodoPago.trim() };
    onUpdateTransactions(previous => [transaction, ...previous]);
    setNewTx(createDraft(newTx.fecha));
    setShowAddModal(false);
    addToast({ message: `Movimiento guardado en ${monthLabel(transaction.fecha.slice(0, 7))}.`, onUndo: () => onUpdateTransactions(previous => previous.filter(item => item.id !== transaction.id)) });
  };

  const handleDeleteTx = transaction => {
    const index = (financialData?.transacciones || []).findIndex(item => item.id === transaction.id);
    onUpdateTransactions(previous => previous.filter(item => item.id !== transaction.id));
    addToast({ message: 'Movimiento eliminado.', type: 'info', duration: 8000, onUndo: () => onUpdateTransactions(previous => {
      if (previous.some(item => item.id === transaction.id)) return previous;
      const restored = [...previous];
      restored.splice(Math.max(0, Math.min(index, restored.length)), 0, transaction);
      return restored;
    }) });
  };

  const clearFilters = () => { setSearch(''); setFilterType('ALL'); setFilterCategory('ALL'); };
  const amountFor = transaction => (
    <span data-sensitive className={`sensitive-value whitespace-nowrap font-semibold tabular-nums ${transaction.tipo === 'INGRESO' ? 'text-[#7DE4BF]' : 'text-[#EDF2F8]'}`}>
      {transaction.tipo === 'INGRESO' ? '+' : '−'}{formatMoney(transaction.monto, transaction.moneda)} <span className="text-[11px] font-medium text-[#A4B1C3]">{transaction.moneda || 'MXN'}</span>
    </span>
  );
  const deleteButton = transaction => <button type="button" onClick={() => handleDeleteTx(transaction)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8191A7] transition-colors hover:bg-rose-300/10 hover:text-rose-300" aria-label={`Eliminar ${transaction.descripcion}`}><Trash2 size={16} aria-hidden="true" /></button>;
  const fieldLabel = (field, label) => <label htmlFor={idFor(field)} className="mb-1.5 block text-[13px] font-medium text-[#C5D0DD]">{label}</label>;
  const fieldError = field => errors[field] && <p id={idFor(`${field}-error`)} role="alert" className="mt-1 text-xs text-rose-300">{errors[field]}</p>;
  const inputProps = field => ({ id: idFor(field), value: newTx[field], onChange: event => updateDraft(field, event.target.value), className: 'field-input w-full', 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? idFor(`${field}-error`) : undefined });

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div><p className="eyebrow mb-2">TU ACTIVIDAD</p><h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">Cada movimiento, en su lugar.</h2><p className="mt-2 text-sm leading-relaxed text-[#A4B1C3]">Encuentra tus gastos, registra ingresos y sigue tu presupuesto.</p></div>
        <div className="flex flex-wrap gap-2">
          {onImportStatement && <button type="button" onClick={onImportStatement} className="button-secondary inline-flex items-center justify-center gap-2"><Upload size={16} aria-hidden="true" />Importar estado de cuenta</button>}
          <button type="button" onClick={openAdd} className="button-primary inline-flex items-center justify-center gap-2"><Plus size={18} aria-hidden="true" />Registrar movimiento</button>
        </div>
      </header>

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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface-card min-w-0 overflow-hidden" aria-labelledby={`${formId}-history`}>
          <div className="border-b border-[#223248] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5"><h3 id={`${formId}-history`} className="text-base font-semibold text-white">Movimientos</h3><span aria-live="polite" className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-[#A4B1C3]">{filteredList.length}</span></div>
              <div className="inline-flex rounded-lg bg-[#0B1420] p-1" aria-label="Tipo de movimiento">{[['ALL', 'Todos'], ['GASTO', 'Gastos'], ['INGRESO', 'Ingresos']].map(([value, label]) => <button type="button" key={value} onClick={() => setFilterType(value)} aria-pressed={filterType === value} className={`min-h-9 rounded-md px-3 text-[13px] font-medium transition-colors ${filterType === value ? 'bg-[#223248] text-white shadow-sm' : 'text-[#A4B1C3] hover:text-white'}`}>{label}</button>)}</div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A4B1C3]" /><label htmlFor={`${formId}-search`} className="sr-only">Buscar movimientos</label><input id={`${formId}-search`} type="search" placeholder="Buscar descripción o método de pago" value={search} onChange={event => setSearch(event.target.value)} className="field-input w-full !pl-10 text-sm" /></div>
              <label htmlFor={`${formId}-category-filter`} className="sr-only">Filtrar por categoría</label><select id={`${formId}-category-filter`} value={filterCategory} onChange={event => setFilterCategory(event.target.value)} className="field-input w-full text-[13px] sm:w-[180px]"><option value="ALL">Todas las categorías</option>{categories.map(category => <option key={category}>{category}</option>)}</select>
            </div>
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
                      <td className="px-3 py-4"><span className="rounded-md border border-[#223248] bg-[#142030] px-2 py-1 text-xs text-[#BCC8D7]">{transaction.categoria || 'Otros'}</span></td>
                      <td className="px-3 py-4 text-right">{amountFor(transaction)}</td><td className="py-3 pr-3">{deleteButton(transaction)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <ul className="divide-y divide-[#223248] md:hidden">{filteredList.slice(0, visibleCount).map(transaction => (
                <li key={transaction.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium text-white">{transaction.descripcion}</p><p className="mt-1 text-xs text-[#A4B1C3]"><time dateTime={transaction.fecha}>{dateLabel(transaction.fecha)}</time> · {transaction.categoria || 'Otros'}</p>{transaction.metodoPago && <p className="mt-1 text-xs text-[#A4B1C3]">{transaction.metodoPago}</p>}</div>{deleteButton(transaction)}</div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-[#A4B1C3]">{transaction.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}</span>{amountFor(transaction)}</div></li>
              ))}</ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#223248] px-5 py-3.5"><p className="text-xs text-[#A4B1C3]">{Math.min(visibleCount, filteredList.length)} de {filteredList.length} movimientos · {monthLabel(period)}</p>{visibleCount < filteredList.length && <button type="button" onClick={() => setVisibleCount(count => count + 12)} className="inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-[#7DE4BF]">Mostrar más<ChevronDown size={15} aria-hidden="true" /></button>}{hasFilters && <button type="button" onClick={clearFilters} className="min-h-10 text-[13px] text-[#A4B1C3] hover:text-white">Limpiar filtros</button>}</div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5" aria-labelledby={`${formId}-budget`}>
            <h3 id={`${formId}-budget`} className="text-base font-semibold text-white">Tu presupuesto, al día</h3><p className="mt-1 text-[13px] leading-relaxed text-[#A4B1C3]">Gastos de {monthLabel(period)} frente a tus límites mensuales actuales. {summary.currency}.</p>
            <div className="mt-6 space-y-6">{budgetRows.map(item => (
              <div key={item.category}>
                <div className="flex items-start justify-between gap-3 text-[13px]"><p className="font-medium text-[#EDF2F8]">{item.category}</p><span data-sensitive className="sensitive-value whitespace-nowrap font-semibold text-white tabular-nums">{money(item.spent)}</span></div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#223248]" role={item.percentage === null ? undefined : 'meter'} aria-label={`${item.category}: presupuesto consumido`} aria-valuenow={item.percentage === null ? undefined : Math.min(100, item.percentage)} aria-valuemin={item.percentage === null ? undefined : 0} aria-valuemax={item.percentage === null ? undefined : 100} aria-valuetext={item.percentage === null ? undefined : `${Math.round(item.percentage)}% del presupuesto consumido`}><div className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${item.overBudget ? 'bg-[#F7A9B8]' : item.percentage >= 80 ? 'bg-[#F4C88C]' : 'bg-[#7DE4BF]'}`} style={{ width: `${item.percentage === null ? 0 : Math.min(100, item.percentage)}%` }} /></div>
                <div className="mt-2 flex items-start justify-between gap-2 text-xs text-[#A4B1C3]">{item.percentage === null ? <span>Sin presupuesto</span> : <><span data-sensitive className="sensitive-value">{Math.round(item.percentage)}% de {money(item.budget)}</span><span data-sensitive className={`sensitive-value text-right ${item.overBudget ? 'text-[#F7A9B8]' : ''}`}>{item.overBudget ? `${money(Math.abs(item.remaining))} de más` : `${money(item.remaining)} libre`}</span></>}</div>
              </div>
            ))}{budgetRows.length === 0 && <p className="text-sm leading-relaxed text-[#A4B1C3]">Tus categorías aparecerán cuando registres un gasto o configures un presupuesto.</p>}</div>
            {summary.categories.length > 5 && <button type="button" onClick={() => setShowAllBudgets(value => !value)} className="mt-5 flex min-h-10 w-full items-center justify-center gap-1 border-t border-[#223248] pt-3 text-[13px] text-[#A4B1C3] hover:text-white" aria-expanded={showAllBudgets}>{showAllBudgets ? 'Ver menos' : `Ver las ${summary.categories.length} categorías`}<ChevronDown size={15} className={showAllBudgets ? 'rotate-180' : ''} aria-hidden="true" /></button>}
          </section>
          {onOpenAssistant && <button type="button" onClick={() => onOpenAssistant(`Revisa mis movimientos de ${monthLabel(period)} (${period}). ¿En qué categorías gasté más y cómo se compara con mi presupuesto configurado? Distingue los registros de los gastos que todavía no he capturado.`)} className="group w-full rounded-2xl border border-[#C7BBF5]/20 bg-[#C7BBF5]/[0.06] p-5 text-left transition-colors hover:border-[#C7BBF5]/40 hover:bg-[#C7BBF5]/10"><div className="flex items-center justify-between gap-3"><Sparkles size={19} className="text-[#C7BBF5]" aria-hidden="true" /><ArrowUpRight size={17} className="text-[#C7BBF5] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></div><p className="mt-3 text-sm font-semibold text-[#E3DBFF]">Entiende tu mes con Claude</p><p className="mt-1.5 text-[13px] leading-relaxed text-[#B6ACC9]">Explora tus gastos y encuentra preguntas útiles para tu siguiente decisión.</p></button>}
        </aside>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Registrar movimiento" description="Un pequeño registro. Una imagen más clara de tu dinero.">
        <form onSubmit={handleAddTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><div>{fieldLabel('tipo', 'Tipo')}<select {...inputProps('tipo')}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></div><div>{fieldLabel('fecha', 'Fecha')}<input {...inputProps('fecha')} type="date" required />{fieldError('fecha')}</div></div>
          <div>{fieldLabel('descripcion', 'Descripción')}<input {...inputProps('descripcion')} type="text" required maxLength={200} placeholder="Ej. Supermercado o pago de cliente" />{fieldError('descripcion')}</div>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3"><div>{fieldLabel('monto', 'Importe')}<input {...inputProps('monto')} type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder="0.00" />{fieldError('monto')}</div><div>{fieldLabel('moneda', 'Moneda')}<select {...inputProps('moneda')}><option value="MXN">MXN</option><option value="USD">USD</option></select></div></div>
          <div>{fieldLabel('categoria', 'Categoría')}<select {...inputProps('categoria')}>{categories.map(category => <option key={category}>{category}</option>)}</select></div>
          <div>{fieldLabel('metodoPago', 'Método de pago · opcional')}<input {...inputProps('metodoPago')} type="text" maxLength={100} placeholder="Ej. Débito, transferencia o efectivo" /></div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#223248] pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="button-secondary">Cancelar</button><button type="submit" className="button-primary inline-flex items-center justify-center gap-2"><Plus size={17} aria-hidden="true" />Guardar movimiento</button></div>
        </form>
      </Modal>
    </div>
  );
}
