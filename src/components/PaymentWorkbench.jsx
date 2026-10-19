import React, { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Plus, RotateCcw, SlidersHorizontal, Wallet } from 'lucide-react';
import { comparePaymentTimelines, dayDistance, shiftDay } from '../services/paymentTimeline.js';
import { summarizeScenarioImpact } from '../services/scenarioImpact.js';
import ScenarioImpact from './ScenarioImpact.jsx';
import './PaymentWorkbench.css';

const cash = (n, currency = 'MXN') => n == null ? 'Por confirmar' : new Intl.NumberFormat('es-MX', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(n) + ' ' + currency;
const dateText = (d, long = false) => d ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')) : 'Fecha pendiente';
const localISO = () => { const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k).value).join('-'); };

function NumberField({ label, value, onChange, min = 0, max, hint, ...props }) {
  return <label className="wb-field"><span>{label}</span><input className="field-input" type="number" min={min} max={max} step="any" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Math.min(max ?? 1e10, Math.max(min, Number(e.target.value))))} {...props} />{hint && <small>{hint}</small>}</label>;
}
function DateField({ label, value, onChange, min }) {
  return <label className="wb-field"><span>{label}</span><input className="field-input" type="date" min={min} value={value || ''} onChange={e => onChange(e.target.value || null)} /></label>;
}
function AmountSlider({ label, value, max, onChange, currency = 'MXN', hint }) {
  const amount = value ?? 0;
  return <div className="wb-slider-field"><NumberField label={label} value={value} onChange={onChange} max={max} /><input aria-label={label + ' · deslizador'} aria-valuetext={cash(amount, currency)} type="range" min={0} max={Math.max(max, amount, 1)} step={1} value={amount} onChange={e => onChange(Number(e.target.value))} /><div className="wb-range-labels"><span>{cash(0, currency)}</span><span>{cash(Math.max(max, amount), currency)}</span></div>{hint && <p className="wb-note">{hint}</p>}</div>;
}
function MoneyPair({ values, field, filter = 'ALL' }) { return <>{(filter === 'ALL' ? ['MXN', 'USD'] : [filter]).map((c, i) => i === 0 ? <strong key={c} className="sensitive-value">{cash(values[c][field], c)}</strong> : <span key={c} className="wb-usd sensitive-value">{cash(values[c][field], c)}</span>)}</>; }
function TimelineTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  const date = new Date(Number(label)).toISOString().slice(0, 10);
  return <div className="plan-tooltip"><strong>{dateText(date)}</strong>{payload.map(p => <div key={p.dataKey}><span>{p.name}</span><b>{cash(p.value, currency)}</b></div>)}<small>Después de los eventos del día</small></div>;
}
const eventsInScope = (events, source, currency) => (events || []).filter(event => source ? Number.isFinite(event.sourceAllocations?.[source.id]) && event.sourceAllocations[source.id] !== 0 : (event.funding || event.currency) === currency);
const balanceDifference = (value, reference) => Number.isFinite(value) && Number.isFinite(reference) ? value - reference : null;
function DayEvents({ title, events, source, currency, opening }) {
  const visible = opening ? [] : eventsInScope(events, source, currency);
  return <section><h4>{title}</h4><div className="wb-day-events">{visible.length ? visible.map(event => {
    const received = source ? event.sourceAllocations[source.id] > 0 : ['INCOME', 'BORROWING'].includes(event.kind);
    const amount = source ? Math.abs(event.sourceAllocations[source.id]) : event.cost ?? event.amount;
    return <div key={event.id}><span>{received ? <ArrowDownLeft size={15} /> : <ArrowRight size={15} />}{event.name}</span><b className="sensitive-value">{received ? '+' : '−'}{cash(amount, currency)}</b></div>;
  }) : <p>{opening ? 'Antes de los movimientos del primer día.' : 'Sin movimientos previstos este día.'}</p>}</div></section>;
}

export default function PaymentWorkbench({ plan, fx, onChangeScenario, onChangeAsset, onOpenAccounts, onOpenProjection }) {
  const reducedMotion = useReducedMotion();
  const [from, setFrom] = useState(() => [localISO(), plan.asOf].sort().at(-1));
  const [horizon, setHorizon] = useState(30);
  const [currency, setCurrency] = useState('MXN');
  const [paymentCurrency, setPaymentCurrency] = useState('ALL');
  const [graphAccount, setGraphAccount] = useState('');
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [day, setDay] = useState(0);
  const [inspectionPhase, setInspectionPhase] = useState('closing');
  const [compactChart, setCompactChart] = useState(true);
  const [, setScaleRevision] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [undoScenario, setUndoScenario] = useState(null);
  const [activeStep, setActiveStep] = useState(2);
  const editor = useRef(null);
  const dailyDetail = useRef(null);
  const scale = useRef({});
  const result = useMemo(() => { try { return comparePaymentTimelines(plan, { from, days: horizon, fx }); } catch (error) { return { error: error.message }; } }, [plan, from, horizon, fx]);
  if (result.error) return <section className="surface-card plan-section"><p role="alert">{result.error}</p><DateField label="Planear desde" value={from} min={plan.asOf} onChange={v => v && setFrom(v)} /><p>Corrige los campos del escenario para recuperar el cálculo.</p></section>;
  const { base, scenario: simulation, rows } = result;
  const scenario = plan.scenario, cf = scenario.cashflow;
  const obligations = simulation.obligations.filter(a => (!a.dueDate || a.dueDate <= simulation.to) && (paymentCurrency === 'ALL' || a.currency === paymentCurrency));
  const editableObligations = obligations.filter(a => !a.fixed);
  const visibleAccounts = plan.accounts.filter(a => paymentCurrency === 'ALL' || a.currency === paymentCurrency);
  const activeAccount = visibleAccounts.find(a => a.id === selectedAccount) || visibleAccounts.find(a => a.id === editableObligations[0]?.accountId) || visibleAccounts[0];
  const accountPayments = simulation.payments.filter(p => p.accountId === activeAccount?.id);
  const payment = accountPayments.find(p => p.id === selectedPayment) || accountPayments[0];
  const obligation = simulation.obligations.find(a => a.accountId === activeAccount?.id && a.dueDate === payment?.due) || simulation.obligations.find(a => a.accountId === activeAccount?.id);
  const graphSource = simulation.fundingAccounts.find(a => a.id === graphAccount);
  const impact = summarizeScenarioImpact(result, { currency, accountId: graphSource?.id || '' });
  const chartRows = rows.map(r => ({ ...r, reference: graphSource ? r.baseAccounts[graphSource.id] : r['base' + currency], proposed: graphSource ? r.scenarioAccounts[graphSource.id] : r['scenario' + currency] }));
  const selectedDay = Math.min(day, rows.length - 1), current = chartRows[selectedDay];
  const opening = inspectionPhase === 'opening' && selectedDay === 0;
  const referenceDetail = opening ? graphSource ? base.fundingAccounts.find(account => account.id === graphSource.id)?.initial : base.initial[currency] : current.reference;
  const proposedDetail = opening ? graphSource ? graphSource.initial : simulation.initial[currency] : current.proposed;
  const selectedBaseEvents = base.daily[selectedDay]?.events || [];
  const chartTicks = [...new Set([rows[0].timestamp, rows[Math.floor((rows.length - 1) / 2)].timestamp, rows.at(-1).timestamp])];
  const minimumOnCurve = impact.available && impact.minimum.phase === 'closing' ? impact.minimum : null;
  const minCash = Math.min(graphSource ? graphSource.initial : simulation.initial[currency], ...chartRows.map(r => r.proposed));
  const reserve = graphSource ? 0 : currency === 'MXN' ? simulation.reserve : simulation.recommendation.config.usdBuffer;
  const baseReserve = graphSource ? 0 : currency === 'MXN' ? base.reserve : base.recommendation.config.usdBuffer;
  const values = chartRows.flatMap(r => [r.reference, r.proposed]).concat([0, reserve, baseReserve]).filter(Number.isFinite);
  const low = Math.min(...values), high = Math.max(...values), padding = Math.max((high - low) * .08, currency === 'MXN' ? 100 : 10);
  const scaleKey = graphAccount + currency + from + horizon, previous = scale.current[scaleKey];
  const domain = [Math.min(previous?.[0] ?? Infinity, low - padding), Math.max(previous?.[1] ?? -Infinity, high + padding)];
  scale.current[scaleKey] = domain;
  const selectDay = next => { setDay(next); setInspectionPhase('closing'); };
  const fitScale = () => { scale.current[scaleKey] = [low - padding, high + padding]; setScaleRevision(revision => revision + 1); };
  const updateScenario = (key, value) => onChangeScenario({ ...scenario, [key]: value });
  const updateCashflow = (key, value) => updateScenario('cashflow', { ...cf, [key]: value });
  const updateLoan = (key, value) => updateCashflow('loan', { ...cf.loan, [key]: value });
  const updateDiscover = patch => updateCashflow('discover', { ...cf.discover, ...patch });
  const revealSection = (id, step) => {
    const target = document.getElementById(id);
    if (!target) return;
    let ancestor = target;
    while (ancestor && ancestor !== target.closest('.payment-workbench')?.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    if (step) setActiveStep(step);
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    const focusTarget = target.tagName === 'DETAILS' ? target.querySelector('summary') : target;
    focusTarget?.focus({ preventScroll: true });
  };
  const filterPayments = c => { setPaymentCurrency(c); setSelectedPayment(null); if (c !== 'ALL') { setCurrency(c); setGraphAccount(''); } };
  const inspectImpact = ({ date, phase = 'closing', accountId = '', currency: nextCurrency }) => {
    const index = rows.findIndex(row => row.date === date);
    if (index < 0) return;
    setDay(index); setInspectionPhase(phase); setCurrency(nextCurrency); setGraphAccount(accountId); setActiveStep(3);
    requestAnimationFrame(() => {
      dailyDetail.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
      dailyDetail.current?.focus({ preventScroll: true });
    });
  };
  const updatePayment = patch => {
    if (!payment) return;
    const next = { id: payment.id, accountId: payment.accountId, amount: payment.requestedAmount ?? payment.amount, date: payment.date, dueDate: payment.due, funding: payment.funding, assetId: payment.assetId || '', ...patch };
    const key = payment.extra ? 'extraPayments' : 'payments';
    updateCashflow(key, [...cf[key].filter(p => p.id !== payment.id), next]);
  };
  const selectAccount = obligationId => {
    const selected = simulation.obligations.find(a => a.id === obligationId);
    const id = selected?.accountId || obligationId, due = selected?.dueDate;
    setSelectedAccount(id); setSelectedPayment(simulation.payments.find(p => p.accountId === id && p.due === due)?.id || null);
    if (due) selectDay(Math.max(0, Math.min(horizon - 1, dayDistance(from, due))));
    revealSection('wb-payment-editor', 2);
  };
  const addPayment = () => {
    if (!activeAccount) return;
    const id = 'extra-' + crypto.randomUUID();
    updateCashflow('extraPayments', [...cf.extraPayments, { id, accountId: activeAccount.id, date: current.date, dueDate: obligation?.dueDate || activeAccount.dueDate, amount: 0, funding: activeAccount.currency }]);
    setSelectedPayment(id);
  };
  const targetAmount = target => {
    if (target == null || !payment) return;
    const due = obligation?.dueDate || activeAccount.dueDate;
    const others = simulation.payments.filter(p => p.accountId === activeAccount.id && p.id !== payment.id && p.kind === 'PAYMENT' && p.due === due && p.date >= from && p.date <= due).reduce((total, p) => total + p.amount, 0);
    updatePayment({ amount: Math.max(0, Math.round((target - others) * 100) / 100) });
  };
  const reset = () => { setUndoScenario(structuredClone(scenario)); onChangeScenario({ ...scenario, bonus: { ...scenario.bonus, enabled: false }, raise: { ...scenario.raise, enabled: false }, cashflow: { ...cf, reserveMXN: null, currentExpensesMXN: null, payments: [], extraPayments: [], loan: { ...cf.loan, enabled: false }, discover: { ...cf.discover, enabled: false } } }); };
  const warningCount = simulation.warnings.length;
  const initialExpenses = simulation.events.find(e => e.id === 'living-' + from.slice(0, 8) + '01' && e.name === 'Gastos pendientes antes del ingreso');

  return <div className="payment-workbench">
    <div className="wb-toolbar"><div><span className="wb-kicker"><SlidersHorizontal size={15} /> SIMULADOR POR FECHA</span><h2>Prueba un abono y revisa su efecto</h2><p>Ajusta un abono y revisa cómo cambia tu dinero disponible. Aquí no se realizan pagos.</p></div><div className="wb-toolbar-actions"><button className="button-ghost" onClick={reset}><RotateCcw size={15} />Restablecer prueba</button>{undoScenario && <button className="button-secondary" onClick={() => { onChangeScenario(undoScenario); setUndoScenario(null); }}>Deshacer restablecimiento</button>}</div></div>
    <nav className="wb-steps" aria-label="Cómo usar el simulador">{[
      [1, 'Revisa tus cuentas', 'Confirma el dinero disponible', 'wb-available-accounts'],
      [2, 'Ajusta los abonos', 'Elige cuenta, importe y fecha', 'wb-payment-editor'],
      [3, 'Revisa la proyección', 'Comprueba los fondos por día', 'wb-cash-chart'],
    ].map(([number, title, description, target]) => <button key={number} onClick={() => revealSection(target, number)} aria-current={activeStep === number ? 'step' : undefined}>{activeStep === number && <motion.span className="wb-step-active" layoutId="workbench-step" transition={{ duration: reducedMotion ? 0 : .18 }} />}<span className="wb-step-number">{number}</span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={16} /></button>)}</nav>
    <div className="wb-controls-row">
    <div className="wb-period"><DateField label="Planear desde" value={from} min={plan.asOf} onChange={v => { if (v) { setFrom(v); selectDay(0); } }} /><div><span className="wb-label">Ver próximos</span><div className="wb-segment" aria-label="Horizonte del simulador">{[7, 14, 30, 60, 90].map(n => <button key={n} aria-pressed={horizon === n} onClick={() => { setHorizon(n); selectDay(d => Math.min(d, n - 1)); }}>{n} días</button>)}</div></div><span className="wb-period-end">Hasta {dateText(simulation.to, true)}<small>Cortes revisados al {dateText(plan.asOf)}</small></span></div>
    <div className="wb-filter"><span className="wb-label">Pagos por moneda</span><div className="wb-segment" aria-label="Filtrar pagos por moneda">{[['ALL', 'Todos'], ['MXN', 'MXN'], ['USD', 'USD']].map(([key, label]) => <button key={key} aria-pressed={paymentCurrency === key} onClick={() => filterPayments(key)}>{label}</button>)}</div><small>Filtra vencimientos y metas. Tus asignaciones se conservan.</small></div>
    </div>
    <details className="surface-card wb-disclosure wb-accounts" id="wb-available-accounts"><summary><Wallet size={19} /><span><strong>Cuentas disponibles ({plan.assets.length})</strong><small>Dinero disponible · revisa saldos y apartados antes de asignar un pago</small></span></summary><div className="wb-asset-grid">{plan.assets.map(a => <div className="wb-asset" key={a.id}><div><strong>{a.name}</strong><span>{a.currency} · saldo al {dateText(a.balanceDate)}</span></div><b className="sensitive-value">{cash(a.balance - a.reserved, a.currency)}</b><small>Saldo {cash(a.balance, a.currency)} · apartado {cash(a.reserved, a.currency)}</small><div className="wb-asset-actions"><button className="button-ghost" onClick={() => { setGraphAccount(a.id); setCurrency(a.currency); revealSection('wb-cash-chart', 3); }}>Ver en gráfica</button>{onChangeAsset && <button className="button-ghost" aria-expanded={editingAsset === a.id} onClick={() => setEditingAsset(editingAsset === a.id ? null : a.id)}>Actualizar saldo</button>}</div>{editingAsset === a.id && <><NumberField label={'Saldo de ' + a.name + ' · ' + a.currency} min={a.reserved} value={a.balance} onChange={v => onChangeAsset(a.id, { balance: v ?? a.balance, balanceDate: localISO() })} /><NumberField label={'Apartado de ' + a.name + ' · ' + a.currency} max={a.balance} value={a.reserved} onChange={v => onChangeAsset(a.id, { reserved: v ?? 0 })} /><p className="wb-note">Actualiza el dato registrado en este borrador. Usa «Guardar» para conservarlo en tu cuenta.</p></>}</div>)}</div>{!plan.assets.length && <p className="wb-note">Aún no hay cuentas de dinero registradas en la conciliación.</p>}</details>

    <div className="wb-summary">
      <div><span>Metas de pago en esta ventana</span><MoneyPair filter={paymentCurrency} values={simulation.totals} field="target" /><small>Sin intereses cuando se conoce ese importe; en otros casos, mínimo con cuotas.</small></div>
      <div><span>Asignado con fondos antes de vencer</span><MoneyPair filter={paymentCurrency} values={simulation.totals} field="funded" /><small>Propuesto. No acredita pagos realizados.</small></div>
      <div className={obligations.some(a => a.gap > 0) ? 'wb-summary-alert' : ''}><span>Falta cubrir</span><MoneyPair filter={paymentCurrency} values={simulation.totals} field="gap" /><small>{obligations.filter(a => a.target == null || !a.dueDate).length} compromisos con datos pendientes, fuera de las sumas completas.</small></div>
    </div>
    {cf.currentExpensesMXN === null && initialExpenses?.amount > 0 && <div className="wb-assumption"><div><strong>Confirma cuánto te falta gastar antes de cobrar</strong><p>Por ahora se apartan {cash(initialExpenses.amount)}, el presupuesto completo conocido. Si ya pagaste parte, ajusta lo pendiente para ver tu disponibilidad.</p></div><button className="button-secondary" onClick={() => revealSection('wb-reserves')}>Ajustar gastos pendientes</button></div>}
    <div className="wb-next-heading"><h3>Vencen primero</h3><button className="button-ghost" onClick={() => { setShowAll(true); document.getElementById('wb-all-payments')?.scrollIntoView({ behavior: 'auto', block: 'start' }); }}>Ver agenda completa <ArrowRight size={15} /></button></div>
    <div className="wb-next">{obligations.slice(0, 3).map(a => <button className={'wb-deadline ' + a.risk + (activeAccount?.id === a.accountId && (!payment?.due || payment.due === a.dueDate) ? ' selected' : '')} key={a.id} onClick={() => a.fixed ? (selectDay(Math.max(0, Math.min(horizon - 1, dayDistance(from, a.dueDate)))), revealSection('wb-cash-chart', 3)) : selectAccount(a.id)}><span className="wb-deadline-top"><CalendarDays size={16} />{dateText(a.dueDate)}<span>{a.dueDate ? a.overdue ? 'Revisar' : dayDistance(from, a.dueDate) === 0 ? 'Hoy' : 'En ' + dayDistance(from, a.dueDate) + ' días' : 'Pendiente'}</span></span><strong>{a.name}</strong><span className="wb-deadline-amount sensitive-value">{cash(a.target, a.currency)}</span><span className="wb-status">{a.status}</span>{a.gap > 0 && <small className="sensitive-value">Faltan {cash(a.gap, a.currency)}</small>}</button>)}</div>
    {!obligations.length && <div className="wb-empty">No hay vencimientos documentados en estos {horizon} días. Amplía la ventana para ver los siguientes.</div>}

    <details className="surface-card wb-disclosure wb-conditions" open={warningCount > 0}><summary><AlertTriangle size={17} />Condiciones y datos pendientes ({warningCount})</summary><ul>{simulation.warnings.map(w => <li key={w}>{w}</li>)}</ul><p>Presupuesto de vida usado: {cash(simulation.recommendation.expenses.total)} al mes; impuestos: {cash(plan.budget.monthlyTax)}. Usa los supuestos guardados de tu recomendación. Los saldos provienen de fechas distintas; confirma movimientos posteriores al corte.</p><button className="button-ghost" onClick={onOpenProjection}>Revisar presupuesto y supuestos <ArrowRight size={15} /></button></details>

    <div className="wb-workspace">
      <aside className="surface-card wb-editor" id="wb-payment-editor" ref={editor} tabIndex={-1} aria-label="Ajustar abonos del escenario">

        <div className="wb-editor-heading"><span className="wb-kicker">PASO 2 · TU SIGUIENTE DECISIÓN</span><h2>Ajusta un abono</h2><p>Elige un crédito y prueba cuánto pagar.</p></div>
        {activeAccount ? <>
          <label className="wb-field"><span>Crédito que quieres ajustar</span><select className="field-input" value={activeAccount?.id || ''} onChange={e => { setSelectedAccount(e.target.value); setSelectedPayment(null); }}>{visibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
          {activeAccount && <><div className="wb-account-context"><strong>{obligation?.interest}</strong><span>Vence {dateText(activeAccount.dueDate)} · tasa ordinaria {activeAccount.ordinaryApr == null ? 'pendiente' : activeAccount.ordinaryApr + '%'}</span><span>Saldo registrado: <b className="sensitive-value">{cash(activeAccount.balance, activeAccount.currency)}</b></span></div>
          {payment ? <><label className="wb-field"><span>Abono que estás modificando</span><select className="field-input" value={payment.id} onChange={e => setSelectedPayment(e.target.value)}>{accountPayments.map(p => <option value={p.id} key={p.id}>{dateText(p.date)} · {cash(p.requestedAmount ?? p.amount, p.currency)}{p.extra ? ' · adicional' : ''}{p.estimated ? ' · referencia' : ''}</option>)}</select></label>
            <label className="wb-field"><span>De dónde sale el dinero</span><select className="field-input" value={payment.assetId || 'auto-' + payment.funding} onChange={e => { const a = simulation.fundingAccounts.find(a => a.id === e.target.value); updatePayment({ assetId: a?.id || '', funding: a?.currency || e.target.value.slice(-3) }); }}><option value={'auto-' + activeAccount.currency}>Reparto automático · {activeAccount.currency}</option>{activeAccount.currency === 'USD' && <option value="auto-MXN">Convertir MXN a USD · automático</option>}{simulation.fundingAccounts.filter(a => a.currency === activeAccount.currency || (activeAccount.currency === 'USD' && a.currency === 'MXN')).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}{a.currency !== activeAccount.currency ? ' · requiere conversión' : ''}</option>)}</select><small>{payment.assetId ? 'Se usa sólo el saldo de esta cuenta.' : 'Primero usa ingresos sin cuenta asignada y luego las cuentas registradas, en el orden mostrado arriba.'}{payment.funding !== activeAccount.currency && ' Conversión de referencia: ' + fx + ' MXN/USD, más comisiones registradas.'}</small></label>
            <div className="wb-payment-direction"><span>{simulation.fundingAccounts.find(a => a.id === payment.assetId)?.name || 'Fondos ' + payment.funding}</span><ArrowRight size={17} /><strong>{activeAccount.name} · {activeAccount.kind === 'LOAN' ? 'préstamo' : 'crédito'}</strong></div>
            <AmountSlider label={'Asignar a ' + activeAccount.name + ' · ' + activeAccount.currency} value={payment.requestedAmount ?? payment.amount} max={activeAccount.balance} currency={activeAccount.currency} onChange={v => updatePayment({ amount: v ?? 0 })} />
            <div className="wb-presets"><button disabled={obligation?.required == null} onClick={() => targetAmount(obligation.required)}>Cubrir mínimo y cuotas</button><button disabled={obligation?.paymentToAvoidInterest == null} onClick={() => targetAmount(obligation.paymentToAvoidInterest)}>Completar pago sin intereses</button><button onClick={() => updatePayment({ amount: 0 })}>Liberar este abono</button></div>
            <p className="wb-note">Estos botones completan la meta descontando otros abonos a tiempo; no la suman otra vez.</p>
            <DateField label="Fecha propuesta de pago" value={payment.date} min={from} onChange={v => v && updatePayment({ date: v })} />
            <input type="range" min={0} max={Math.max(horizon - 1, dayDistance(from, payment.date))} step={1} value={Math.max(0, dayDistance(from, payment.date))} aria-label="Mover fecha del pago" aria-valuetext={dateText(payment.date, true)} onChange={e => updatePayment({ date: shiftDay(from, Number(e.target.value)) })} />
            {payment.due && payment.date > payment.due && <div className="wb-inline-warning"><AlertTriangle size={16} />Este abono llega después del vencimiento documentado.</div>}
            {payment.kind === 'RESERVE' && <div className="wb-inline-warning">Es un apartado de clasificación pendiente. No cuenta como pago que cubre el mínimo.</div>}
            {(payment.date > simulation.to || payment.date < from) && <p className="wb-inline-warning">Fuera de la ventana visible. Conserva esta fecha o cámbiala para volver a ver el efecto.</p>}{payment.estimated && <p className="wb-note">Corte futuro estimado. Confirma importe y vencimiento con el siguiente estado.</p>}

            {payment.extra && <button className="button-ghost" onClick={() => { updateCashflow('extraPayments', cf.extraPayments.filter(p => p.id !== payment.id)); setSelectedPayment(null); }}>Quitar este abono adicional</button>}
          </> : <p>No hay abonos propuestos para este crédito. Añade uno con importe y fecha.</p>}
          <button className="button-secondary wb-full" onClick={addPayment}><Plus size={16} />Dividir o añadir otro abono</button>
          <div className={'wb-allocation-result ' + (obligation?.risk || '')}><span>Antes de {dateText(obligation?.dueDate)}</span><strong className="sensitive-value">{cash(obligation?.funded, activeAccount.currency)} con fondos</strong><span>{obligation?.gap == null ? 'Falta confirmar la meta de pago.' : 'Falta para la meta: ' + cash(obligation.gap, activeAccount.currency)}</span></div>
          <button className="button-ghost" onClick={onOpenAccounts}>Consultar el desglose del estado <ArrowRight size={14} /></button></>}

        </> : <p>No hay créditos en esta moneda.</p>}
        <button className="button-primary wb-full wb-show-effect" onClick={() => revealSection('wb-cash-chart', 3)}>Ver el efecto en mi dinero<ArrowRight size={16} /></button><button className="button-ghost wb-full" onClick={() => revealSection('wb-scenarios')}>Probar bono, aumento o préstamo<Plus size={15} /></button>
      </aside>

      <section className="surface-card wb-chart-panel" id="wb-cash-chart" tabIndex={-1} aria-label="Proyección de dinero disponible">
        <div className="wb-chart-heading"><div><span className="wb-kicker">PASO 3 · EL EFECTO DE TU PLAN</span><h2>Tu dinero, día por día</h2></div><div className="wb-segment" aria-label="Moneda de la gráfica">{['MXN', 'USD'].map(c => <button key={c} aria-pressed={currency === c} onClick={() => { setCurrency(c); setGraphAccount(''); }}>{c}</button>)}</div></div>
        <label className="wb-field wb-graph-scope"><span>Ver saldo de</span><select className="field-input" value={graphSource?.id || 'total-' + currency} onChange={e => { const a = simulation.fundingAccounts.find(a => a.id === e.target.value); setGraphAccount(a?.id || ''); setCurrency(a?.currency || e.target.value.slice(-3)); }}><option value="total-MXN">Total disponible · MXN</option><option value="total-USD">Total disponible · USD</option>{simulation.fundingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><small>{graphSource ? graphSource.name + ' · ' + currency : 'Todas tus cuentas e ingresos previstos en ' + currency}</small></label>
        <ScenarioImpact result={result} summary={impact} currency={currency} accountId={graphSource?.id || ''} onInspect={inspectImpact} />
        <div className="wb-chart-options">
          <div className="wb-legend"><span><i className="base" />Referencia sin cambios</span><span><i className="scenario" />Mi escenario</span><span><i className="zero" />Saldo cero</span>{!graphSource && <span><i className="reserve" />Reserva del escenario {cash(reserve, currency)}</span>}{!graphSource && baseReserve !== reserve && <span><i className="base-reserve" />Reserva de referencia {cash(baseReserve, currency)}</span>}{minimumOnCurve && <span><i className="minimum" />Punto más bajo al cierre</span>}</div>
          <button className="button-ghost wb-fit-scale" onClick={fitScale}><RotateCcw size={14} />Ajustar escala</button>
        </div>
        <p className="wb-chart-reading">Saldos previstos al cierre de cada día; no representan movimientos intradía. La escala permanece estable mientras editas.</p>
        {minCash >= 0 && minCash < reserve && <div className="wb-cash-status warning"><AlertTriangle size={16} /><span>El escenario usa parte de la reserva que quieres conservar.</span></div>}
        <div className="wb-chart" role="img" aria-label={'Efectivo al cierre de cada día en ' + currency + ' · ' + (graphSource?.name || 'Total disponible') + '. Referencia discontinua y escenario continuo; consulta los valores y eventos en la tabla diaria.'}>
          <ResponsiveContainer width="100%" height="100%" onResize={width => setCompactChart(width <= 560)}>
            <LineChart data={chartRows} margin={{ top: 12, right: 18, bottom: 0, left: 0 }} onClick={state => { if (state?.activeLabel != null && Number.isFinite(Number(state.activeLabel))) selectDay(Math.max(0, Math.min(horizon - 1, Math.round((Number(state.activeLabel) - rows[0].timestamp) / 86400000)))); }}>
              <CartesianGrid stroke="#263448" strokeDasharray="3 5" vertical={false} />
              <XAxis type="number" dataKey="timestamp" scale="time" domain={[rows[0].timestamp, rows.at(-1).timestamp]} ticks={compactChart ? chartTicks : undefined} tickFormatter={value => dateText(new Date(value).toISOString().slice(0, 10))} minTickGap={compactChart ? 15 : 35} tick={{ fill: '#a8b8cd', fontSize: 12 }} />
              <YAxis domain={domain} width={68} tickFormatter={value => new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} tick={{ fill: '#a8b8cd', fontSize: 12 }} />
              <Tooltip content={<TimelineTooltip currency={currency} />} />
              <ReferenceLine y={0} stroke="#fb8d9c" label={compactChart ? undefined : { value: 'Saldo cero', position: 'insideBottomLeft', fill: '#e5a9b0', fontSize: 11 }} />
              {!graphSource && <ReferenceLine y={reserve} stroke="#efbc73" strokeDasharray="4 4" />}
              {!graphSource && baseReserve !== reserve && <ReferenceLine y={baseReserve} stroke="#8996aa" strokeDasharray="2 6" />}
              <ReferenceLine x={current.timestamp} stroke="#91afd6" strokeDasharray="3 3" />
              {activeAccount?.dueDate && activeAccount.dueDate >= from && activeAccount.dueDate <= simulation.to && <ReferenceLine x={Date.parse(activeAccount.dueDate + 'T12:00:00Z')} stroke="#efbc73" strokeDasharray="2 4" label={compactChart ? undefined : { value: 'Vence', fill: '#efbc73', fontSize: 12, position: 'insideTopRight' }} />}
              <Line type="stepAfter" dataKey="reference" name="Referencia" stroke="#8e9eb7" strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="proposed" name="Mi escenario" stroke="#7de4bf" strokeWidth={3} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
              {minimumOnCurve && <ReferenceDot x={Date.parse(minimumOnCurve.date + 'T12:00:00Z')} y={minimumOnCurve.value} r={5} fill="#efbc73" stroke="#101c29" strokeWidth={2} isFront />}
              {!opening && Number.isFinite(current.proposed) && minimumOnCurve?.date !== current.date && <ReferenceDot x={current.timestamp} y={current.proposed} r={5} fill="#7de4bf" stroke="#e7fff4" strokeWidth={2} isFront />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="wb-date-scrubber"><button aria-label="Día anterior" disabled={selectedDay === 0} onClick={() => selectDay(selectedDay - 1)}><ChevronLeft size={18} /></button><label><span>Explorar fecha <strong>{dateText(current.date, true)}{opening ? ' · apertura' : ' · cierre'}</strong></span><input type="range" min={0} max={horizon - 1} step={1} value={selectedDay} aria-label="Explorar fecha" aria-valuetext={dateText(current.date, true) + (opening ? ', antes de los movimientos' : ', al cierre del día') + '. Referencia: ' + cash(referenceDetail, currency) + '. Escenario: ' + cash(proposedDetail, currency)} onChange={event => selectDay(Number(event.target.value))} /></label><button aria-label="Día siguiente" disabled={selectedDay === horizon - 1} onClick={() => selectDay(selectedDay + 1)}><ChevronRight size={18} /></button></div>
        <section className="wb-day-detail" ref={dailyDetail} tabIndex={-1} aria-label={(opening ? 'Apertura del ' : 'Cierre del ') + dateText(current.date, true) + ' · ' + (graphSource?.name || 'Total disponible') + ' · ' + currency}>
          <h3 className="wb-day-detail-title">{opening ? 'Apertura del ' : 'Cierre del '}{dateText(current.date)} · {graphSource?.name || 'Total disponible'} · {currency}</h3>
          {opening && <p className="wb-opening-note">Saldo antes de los movimientos del primer día. Este importe no es un punto de la curva de cierres.</p>}
          <div className="wb-day-summary"><div><span>Referencia</span><strong className="sensitive-value">{cash(referenceDetail, currency)}</strong></div><div><span>Mi escenario</span><strong className="sensitive-value">{cash(proposedDetail, currency)}</strong></div><div><span>Diferencia</span><strong className="sensitive-value">{cash(balanceDifference(proposedDetail, referenceDetail), currency)}</strong></div></div>
          <div className="wb-event-comparison"><DayEvents title="Movimientos de la referencia" events={selectedBaseEvents} source={graphSource} currency={currency} opening={opening} /><DayEvents title="Movimientos del escenario" events={current.events} source={graphSource} currency={currency} opening={opening} /></div>
          {!opening && <p className="wb-note">Estos movimientos corresponden sólo al día seleccionado. La diferencia entre saldos también incorpora los días anteriores.</p>}
        </section>
        <p className="wb-note">Saldos después de apartados y pagos propuestos. El reparto automático entre cuentas es una propuesta editable; no registra movimientos bancarios. No incluyen intereses futuros ni compras nuevas. Una entrada el mismo día no garantiza acreditación a tiempo.{baseReserve !== reserve && <> Reserva de referencia: {cash(baseReserve, currency)}.</>}</p>
      </section>
    </div>


    <details className="surface-card wb-disclosure wb-scenarios" id="wb-scenarios" open={scenario.bonus.enabled || scenario.raise.enabled || cf.discover.enabled || cf.loan.enabled}><summary><Plus size={19} /><span><strong>Probar ingresos y financiamiento</strong><small>Bono, aumento, oferta Discover u otro préstamo · {[scenario.bonus, scenario.raise, cf.discover, cf.loan].filter(option => option.enabled).length} opciones activas</small></span></summary><p className="wb-note">Opcional. Activa únicamente la alternativa que quieras comparar y define cuándo recibirías el dinero. Un préstamo también genera deuda.</p><div className="wb-scenario-grid">
      {[['bonus', 'Agregar un bono', 'Bono neto · MXN'], ['raise', 'Agregar un aumento', 'Aumento neto mensual · MXN']].map(([key, label, amountLabel]) => <div className="wb-funding-option" key={key} id={'wb-' + key} tabIndex={-1}><label className="wb-toggle"><span>{label}<small>{scenario[key].enabled ? cash(scenario[key].amount) + ' · ' + dateText(scenario[key].date) : 'Sin activar'}</small></span><input type="checkbox" checked={scenario[key].enabled} onChange={e => updateScenario(key, { ...scenario[key], enabled: e.target.checked })} /></label>{scenario[key].enabled && <><AmountSlider label={amountLabel} value={scenario[key].amount} max={Math.max(plan.budget.monthlyIncome * 3, scenario[key].amount, 1000)} onChange={v => updateScenario(key, { ...scenario[key], amount: v ?? 0 })} /><DateField label={key === 'bonus' ? 'Recibir el bono el' : 'Aumento disponible desde'} value={scenario[key].date} min={from} onChange={v => updateScenario(key, { ...scenario[key], date: v })} />{!scenario[key].date && <p className="wb-inline-warning">Elige la fecha para incluirlo en la gráfica.</p>}{scenario[key].date > simulation.to && <p className="wb-note">Amplía el horizonte para ver esta entrada.</p>}</>}</div>)}
      <div className="wb-funding-option wb-discover" id="wb-discover" tabIndex={-1}><label className="wb-toggle"><span>Usar la oferta de Discover<small>{cf.discover.enabled ? cash(cf.discover.amount, 'USD') + ' · ' + dateText(cf.discover.date) : 'Depósito a tu cuenta · sin activar'}</small></span><input type="checkbox" checked={cf.discover.enabled} onChange={e => updateDiscover({ enabled: e.target.checked })} /></label><p className="wb-note">Oferta declarada: 0% · {plan.offers.discover.months} meses · comisión {plan.offers.discover.feePercent}% · límite {cash(plan.offers.discover.maximum, 'USD')}.</p>{cf.discover.enabled && <>
        <AmountSlider label="Principal de Discover · USD" currency="USD" value={cf.discover.amount} max={plan.offers.discover.maximum} onChange={v => updateDiscover({ amount: v ?? 0, netMXN: null, quotePrincipalUSD: null })} />
        <DateField label="Discover disponible en tu cuenta el" min={from} value={cf.discover.date} onChange={v => updateDiscover({ date: v })} />
        <label className="wb-field"><span>Recibir el dinero en</span><select className="field-input" value={cf.discover.currency} onChange={e => updateDiscover({ currency: e.target.value, assetId: '' })}><option value="USD">USD · conservar dólares</option><option value="MXN">MXN · convertir con cotización neta</option></select></label>
        {cf.discover.currency === 'MXN' && <NumberField label="Pesos netos por ese principal · MXN" value={cf.discover.netMXN} onChange={v => updateDiscover({ netMXN: v, quotePrincipalUSD: cf.discover.amount })} hint="Después de conversión y comisiones. Cambiar el principal requiere una nueva cotización." />}
        <label className="wb-field"><span>Cuenta que recibe Discover</span><select className="field-input" value={cf.discover.assetId} onChange={e => updateDiscover({ assetId: e.target.value })}><option value="">Sin asignar cuenta todavía</option>{plan.assets.filter(a => a.currency === cf.discover.currency).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
        <label className="plan-check"><input type="checkbox" checked={cf.discover.limitIncludesFee} onChange={e => updateDiscover({ limitIncludesFee: e.target.checked })} />Suponer que la comisión consume el límite</label>
        <div className="wb-account-context"><span>Comisión financiada: <b>{cash(simulation.discover.fee, 'USD')}</b></span><strong>Nueva deuda: {cash(simulation.discover.debt, 'USD')}</strong><span>El saldo Discover anterior conserva sus condiciones.</span></div>
        <NumberField label="Abono mensual adicional a Discover · USD" value={cf.discover.monthlyPayment} onChange={v => updateDiscover({ monthlyPayment: v })} /><button className="button-secondary" onClick={() => updateDiscover({ monthlyPayment: simulation.discover.monthlyTarget })}>Probar {cash(simulation.discover.monthlyTarget, 'USD')} por mes</button>
        <DateField label="Primer abono adicional a Discover" min={cf.discover.date || from} value={cf.discover.firstPaymentDate} onChange={v => updateDiscover({ firstPaymentDate: v })} />
        <label className="wb-field"><span>Pagar los abonos adicionales desde</span><select className="field-input" value={cf.discover.paymentAssetId || 'auto-' + cf.discover.funding} onChange={e => { const a = simulation.fundingAccounts.find(a => a.id === e.target.value); updateDiscover({ paymentAssetId: a?.id || '', funding: a?.currency || e.target.value.slice(-3) }); }}><option value="auto-USD">Reparto automático · USD</option><option value="auto-MXN">Convertir MXN a USD · automático</option>{simulation.fundingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}{a.currency === 'MXN' ? ' · requiere conversión' : ''}</option>)}</select><small>{cf.discover.funding === 'MXN' ? 'Se convierte al tipo de referencia y se cobra la comisión registrada en cada abono.' : 'Estos abonos usan fondos en dólares.'}</small></label>
        <p className="wb-note">Ese abono se suma al pago vigente de Discover. Dividir la nueva deuda en {plan.offers.discover.months} pagos es una meta; no es el mínimo bancario ni asegura la liquidación. Fin de referencia: {dateText(simulation.discover.promoEnd, true)}.</p>
        {simulation.discover.issues.length > 0 && <div className="wb-inline-warning"><div>El depósito aún no entra en la gráfica:{simulation.discover.issues.map(issue => <p key={issue}>{issue}</p>)}</div></div>}
        {(cf.discover.monthlyPayment === null || !cf.discover.firstPaymentDate) && <p className="wb-inline-warning">Faltan los abonos: recibir este dinero también crea deuda en USD.</p>}
      </>}</div>
      <div className="wb-funding-option" id="wb-other-loan" tabIndex={-1}><label className="wb-toggle"><span>Probar otro préstamo<small>{cf.loan.enabled ? cash(cf.loan.amount) + ' · ' + dateText(cf.loan.date) : 'En MXN · sin activar'}</small></span><input type="checkbox" checked={cf.loan.enabled} onChange={e => updateLoan('enabled', e.target.checked)} /></label>{cf.loan.enabled && <><NumberField label="Dinero que recibirías · MXN" value={cf.loan.amount} onChange={v => updateLoan('amount', v ?? 0)} /><DateField label="Fecha de desembolso" value={cf.loan.date} min={from} onChange={v => updateLoan('date', v)} /><NumberField label="Tasa anual · %" max={1000} value={cf.loan.apr} onChange={v => updateLoan('apr', v)} /><NumberField label="Comisión financiada · MXN" value={cf.loan.fee} onChange={v => updateLoan('fee', v ?? 0)} /><NumberField label="Cuota mensual total · MXN" value={cf.loan.monthlyPayment} onChange={v => updateLoan('monthlyPayment', v)} /><DateField label="Primera cuota" value={cf.loan.firstPaymentDate} onChange={v => updateLoan('firstPaymentDate', v)} /><p className="wb-inline-warning">Nueva deuda inicial: {cash(cf.loan.amount + cf.loan.fee)}. La gráfica descuenta la cuota indicada; no calcula una cuota bancaria ni una fecha de liquidación.</p></>}</div>
    </div><p className="wb-note">Cada entrada aparece desde su fecha. Los ingresos sin banco indicado quedan separados como «sin cuenta asignada»; usa «Asignar pagos» para decidir qué deuda cubrir.</p></details>
    <details className="surface-card wb-disclosure" id="wb-reserves"><summary><Wallet size={19} /><span><strong>Reserva y gastos pendientes</strong><small>Define cuánto conservar y cuánto falta gastar antes de cobrar</small></span></summary><div className="wb-fields-two">          <AmountSlider label="Reserva que quieres conservar · MXN" value={simulation.reserve} max={Math.max(simulation.initial.MXN, simulation.reserve)} onChange={v => updateCashflow('reserveMXN', v)} hint="La línea ámbar marca tu reserva. Cambiarla conserva los abonos: ajusta sus montos en Asignar pagos para usar más o menos ahorro." />
          <NumberField label="Gastos pendientes antes del próximo ingreso · MXN" value={cf.currentExpensesMXN} onChange={v => updateCashflow('currentExpensesMXN', v)} hint="Gastos por cubrir con tu saldo actual. Al cobrar se aparta el presupuesto del nuevo ciclo. Vacío: usa la provisión conservadora indicada en las condiciones." />
</div></details>
    <section className="surface-card wb-agenda" id="wb-all-payments"><div className="wb-chart-heading"><div><span className="wb-kicker">FECHAS Y PRIORIDADES</span><h2>Lo que necesita dinero</h2></div><button className="button-ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Mostrar primeros 5' : 'Ver todos (' + obligations.length + ')'}</button></div><div className="wb-agenda-head" aria-hidden="true"><span>Vencimiento / compromiso</span><span>Meta de pago</span><span>Con fondos a tiempo</span><span>Falta cubrir</span><span /></div>{(showAll ? obligations : obligations.slice(0, 5)).map(a => <div className={'wb-agenda-row ' + a.risk} key={a.id}><div><strong>{dateText(a.dueDate)} · {a.name}</strong><span>{a.interest}</span><small>{a.status}</small></div><div><span className="wb-mobile-label">Meta</span><b className="sensitive-value">{cash(a.target, a.currency)}</b><small>{a.paymentToAvoidInterest != null ? 'Para no generar intereses' : 'Mínimo / compromiso conocido'}</small></div><div><span className="wb-mobile-label">Con fondos a tiempo</span><b className="sensitive-value">{cash(a.funded, a.currency)}</b></div><div><span className="wb-mobile-label">Falta</span><b className="sensitive-value">{cash(a.gap, a.currency)}</b></div>{!a.fixed && <button className="button-secondary" onClick={() => { selectAccount(a.id); editor.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }}>Ajustar <ArrowRight size={14} /></button>}{a.discoverExtra && <button className="button-secondary" onClick={() => revealSection('wb-discover')}>Ajustar oferta <ArrowRight size={14} /></button>}</div>)}<p className="wb-note">Las metas no se suman entre sí: mínimo, cuotas y pago sin intereses pueden solaparse. Los vencimientos pasados necesitan confirmación; ningún pago se presume realizado.</p></section>

    {simulation.promos.length > 0 && <details className="surface-card wb-disclosure"><summary><CalendarDays size={17} />Después: vencimientos de promociones ({simulation.promos.length})</summary><div className="wb-promos">{simulation.promos.sort((a, b) => (a.promoEnd || '9999').localeCompare(b.promoEnd || '9999')).map(p => <div key={p.account + p.id}><strong>{p.account}</strong><span>{dateText(p.promoEnd, true)}</span><b className="sensitive-value">{cash(p.balance, p.currency)}</b><small>{p.type === 'DEFERRED' ? 'Interés diferido: revisar liquidación antes del plazo' : 'Fin de tasa promocional'} · tasa posterior {p.postApr == null ? 'pendiente' : p.postApr + '%'}</small></div>)}</div></details>}
    <details className="surface-card wb-disclosure"><summary>Ver tabla diaria · {graphSource?.name || 'Total disponible'} · {currency}</summary><div className="plan-table-wrap" role="region" aria-label={'Saldos diarios comparados · ' + (graphSource?.name || 'Total disponible') + ' · ' + currency} tabIndex={0}><table className="plan-table wb-daily-table"><caption>{graphSource?.name || 'Total disponible'} · {currency} · {dateText(from, true)} a {dateText(simulation.to, true)}. Saldos al cierre de cada día.</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Referencia · {currency}</th><th scope="col">Escenario · {currency}</th><th scope="col">Diferencia · {currency}</th><th scope="col">Movimientos del día</th></tr></thead><tbody>{chartRows.map((row, index) => <tr key={row.date}><th scope="row">{dateText(row.date)}</th><td className="sensitive-value">{cash(row.reference, currency)}</td><td className="sensitive-value">{cash(row.proposed, currency)}</td><td className="sensitive-value">{cash(balanceDifference(row.proposed, row.reference), currency)}</td><td><small><b>Referencia:</b> {eventsInScope(base.daily[index]?.events, graphSource, currency).map(event => event.name).join(' · ') || 'Sin movimientos'}</small><small><b>Escenario:</b> {eventsInScope(row.events, graphSource, currency).map(event => event.name).join(' · ') || 'Sin movimientos'}</small></td></tr>)}</tbody></table></div></details>
  </div>;
}
