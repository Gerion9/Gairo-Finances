import React, { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight,
  CircleHelp, CircleDashed, CreditCard, Layers3, Plus, ReceiptText, Sparkles, Upload, Wallet,
} from 'lucide-react';
import { convertCurrency, formatMoney } from '../services/exchangeRate';
import {
  consolidatedCurrency, displayAmount, localDateKey, monthlyFlow, nearestPromo,
  pendingPayments, summarizeBalances, summarizeLedger,
} from '../services/dashboardAnalytics';
import { ReviewLauncher } from './FinancialReview';
import { actionUnavailableReason } from '../services/actionAvailability.js';
import { hasWorkspacePlan, workspaceReceivables } from '../services/workspaceOverview.js';
import './DashboardOverview.css';

const compactNumber = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = (date) => date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const amountLabel = (value, currency) => `${formatMoney(value, currency)} ${currency}`;
const signedAmount = (value, currency) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${formatMoney(Math.abs(value), currency)}`;
const linkClass = 'dashboard-link';

function FlowWaterfall({ flow, currency }) {
  const chartId = useId();
  const unreconciled = Math.abs(flow.reconciliationDifference) > 0.01;
  const componentSteps = flow.steps.filter((step) => step.id !== 'free');
  const componentResult = componentSteps.at(-1)?.end ?? 0;
  const endpoints = flow.steps.flatMap((step) => [step.start, step.end]);
  const minimum = Math.min(0, ...endpoints);
  const maximum = Math.max(0, ...endpoints);
  const span = maximum - minimum || 1;
  const position = (value) => (value - minimum) / span * 100;
  const zeroPosition = position(0);
  const ticks = [...new Set([minimum, 0, maximum])]
    .filter((value) => value === 0 || Math.abs(position(value) - zeroPosition) >= 12);
  const stepColor = (step) => step.id === 'free'
    ? step.amount < 0 ? '#E8A4AA' : '#7DE4BF'
    : ['deposit', 'other'].includes(step.id) ? '#7DE4BF' : '#94ABC6';
  const stepLabel = (step) => step.id === 'free' && unreconciled ? 'Resultado reportado' : step.label;

  return (
    <figure className="dashboard-waterfall" data-sensitive aria-describedby={`${chartId}-description`}>
      <figcaption id={`${chartId}-caption`} className="dashboard-waterfall-caption">
        <span>Cómo se compone tu mes</span><span>{currency} · estimación mensual</span>
      </figcaption>
      <p id={`${chartId}-description`} className="dashboard-waterfall-description">
        Cada cambio parte del acumulado anterior. La línea de cero y la escala son comunes a todos los componentes.
      </p>
      <ul className="dashboard-waterfall-legend" aria-label="Identificación de los componentes">
        <li><span className="is-income" aria-hidden="true" />Entradas</li>
        <li><span className="is-expense" aria-hidden="true" />Compromisos</li>
        <li><span className={flow.free < 0 ? 'is-deficit' : 'is-result'} aria-hidden="true" />{unreconciled ? 'Resultado reportado' : 'Resultado'}</li>
      </ul>

      {unreconciled && (
        <div className="dashboard-waterfall-discrepancy" role="note">
          <p>El resultado reportado no coincide con los componentes.</p>
          <dl>
            <div><dt>Acumulado de los componentes</dt><dd>{signedAmount(componentResult, currency)} {currency}</dd></div>
            <div><dt>Resultado reportado</dt><dd>{signedAmount(flow.free, currency)} {currency}</dd></div>
            <div><dt>Diferencia por revisar</dt><dd>{signedAmount(flow.reconciliationDifference, currency)} {currency}</dd></div>
          </dl>
        </div>
      )}

      <div className="dashboard-waterfall-chart" style={{ '--flow-zero': `${zeroPosition}%`, '--flow-step-count': flow.steps.length }}>
        <div className="dashboard-waterfall-axis is-horizontal" aria-hidden="true">
          {ticks.map((value) => <span key={value} className={value === minimum ? 'is-start' : value === maximum ? 'is-end' : ''} style={{ left: `${position(value)}%` }}>{value === 0 ? '0' : compactNumber.format(value)}</span>)}
        </div>
        <div className="dashboard-waterfall-axis is-vertical" aria-hidden="true">
          {ticks.map((value) => <span key={value} style={{ top: `${100 - position(value)}%` }}>{value === 0 ? '0' : compactNumber.format(value)}</span>)}
        </div>
        <ol className="dashboard-waterfall-steps" aria-labelledby={`${chartId}-caption`}>
          {flow.steps.map((step, index) => {
            const startPosition = position(step.start);
            const endPosition = position(step.end);
            const isResult = step.id === 'free';
            const color = stepColor(step);
            const connectNext = index < flow.steps.length - 1 && !(unreconciled && flow.steps[index + 1].id === 'free');
            return (
              <li key={step.id} className={`dashboard-waterfall-step${isResult ? ' is-result' : ''}${isResult && unreconciled ? ' is-unreconciled' : ''}`}
                style={{ '--flow-bar-start': `${Math.min(startPosition, endPosition)}%`, '--flow-bar-size': `${Math.abs(endPosition - startPosition)}%`, '--flow-end': `${endPosition}%`, '--flow-color': color }}>
                <div className="dashboard-waterfall-step-heading">
                  <span className="dashboard-waterfall-step-label">{stepLabel(step)}</span>
                  <span className="dashboard-waterfall-step-amount">{signedAmount(step.amount, currency)}</span>
                </div>
                <div className="dashboard-waterfall-plot" aria-hidden="true">
                  <span className="dashboard-waterfall-zero" />
                  {connectNext && <span className="dashboard-waterfall-connector" />}
                  <span className="dashboard-waterfall-bar" />
                  <span className="dashboard-waterfall-endpoint" />
                </div>
                <p className="dashboard-waterfall-balance"><span>{isResult ? unreconciled ? 'Desde cero · sin conciliar' : 'Resultado desde cero' : 'Acumulado'}</span>{!isResult && <strong>{signedAmount(step.end, currency)}</strong>}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="dashboard-waterfall-note">Las marcas finas señalan el acumulado, incluso cuando el cambio es cero. El resultado parte de cero y conserva su signo.</p>

      <details className="dashboard-waterfall-table-details">
        <summary><CircleHelp size={15} aria-hidden="true" /><span>Ver cifras del cálculo</span><ChevronRight size={15} aria-hidden="true" /></summary>
        <div className="dashboard-waterfall-table-scroll" tabIndex={0} role="region" aria-label={`Cifras del presupuesto mensual en ${currency}`}>
          <table>
            <caption>Presupuesto mensual estimado · {currency}</caption>
            <thead><tr><th scope="col">Concepto</th><th scope="col">Cambio</th><th scope="col">Acumulado</th></tr></thead>
            <tbody>{componentSteps.map((step) => (
              <tr key={step.id}><th scope="row">{step.label}</th><td>{signedAmount(step.amount, currency)}</td><td>{signedAmount(step.end, currency)}</td></tr>
            ))}</tbody>
            <tfoot><tr><th scope="row">{unreconciled ? 'Resultado reportado · sin conciliar' : 'Resultado · flujo libre antes de aportaciones extra'}</th><td><span aria-label="No aplica: es el resultado, no otro cambio">—</span></td><td>{signedAmount(flow.free, currency)}</td></tr></tfoot>
          </table>
        </div>
      </details>
    </figure>
  );
}
function BalanceMetric({ icon: Icon, label, amount, description, currency, onClick, negativeTone = false, pendingLabel = 'Dato pendiente' }) {
  return (
    <motion.button type="button" onClick={onClick} className="dashboard-metric">
      <div className="dashboard-metric-heading">
        <span><Icon size={16} aria-hidden="true" />{label}</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </div>
      <p data-sensitive className={`dashboard-metric-value sensitive-value ${negativeTone && amount < 0 ? 'is-negative' : ''}`}>
        {amount === null ? <span className="dashboard-pending-value">{pendingLabel}</span> : <>{formatMoney(amount, currency)} <span>{currency}</span></>}
      </p>
      <p className="dashboard-caption">{description}</p>
    </motion.button>
  );
}

function ReceivablesOverview({ summary, onOpen }) {
  const titleId = useId();
  const item = summary.representative;
  return <section className="dashboard-receivables-card" aria-labelledby={titleId}>
    <div className="dashboard-card-heading"><h2 id={titleId}>Cobros esperados</h2><ArrowDownLeft size={20} aria-hidden="true" /></div>
    {summary.status === 'error' ? <p className="dashboard-receivables-state">No pudimos leer el seguimiento de cobros</p>
      : summary.pendingCount === 0 ? <p className="dashboard-receivables-state" data-sensitive>Sin cobros pendientes en tus registros.</p>
      : <><p className="dashboard-receivables-count" data-sensitive>{summary.pendingCount} {summary.pendingCount === 1 ? 'cobro pendiente' : 'cobros pendientes'}</p>
        <div className="dashboard-receivable-record" data-sensitive><p>{item.name}</p><strong>{amountLabel(item.pendingMinor / 100, item.currency)}</strong>
          <span>{item.expectedDate ? <time dateTime={item.expectedDate}>{new Date(`${item.expectedDate}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</time> : 'Sin fecha acordada'}</span>
        </div></>}
    <p className="dashboard-caption">Pendiente de recibir; no forma parte de tu saldo disponible.</p>
    <button type="button" className="dashboard-link" onClick={onOpen}>Ver mis cobros <ArrowRight size={16} aria-hidden="true" /></button>
  </section>;
}

export default function DashboardOverview({
  financialData = {}, cashFlow = {}, promoDeadlines = [], exchangeRate,
  displayCurrency = 'MXN', accountName, onNavigateTab, onOpenDebtModal,
  onQuickAdd, onOpenAssistant, onImportStatement, review, onOpenReview, readOnly = false,
}) {
  const [period, setPeriod] = useState('current');
  const reasonId = useId();
  const reducedMotion = useReducedMotion();
  const enter = { initial: reducedMotion ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: reducedMotion ? 0 : 0.16 } };
  const editReason = actionUnavailableReason('newTransaction', { readOnly });
  const importReason = actionUnavailableReason('importStatement', { readOnly });
  const debtReason = actionUnavailableReason('newDebt', { readOnly });
  const today = new Date();
  const todayKey = localDateKey(today);
  const currency = consolidatedCurrency(displayCurrency);
  const balances = useMemo(() => summarizeBalances(financialData, exchangeRate, displayCurrency), [financialData, exchangeRate, displayCurrency]);
  const flow = useMemo(() => monthlyFlow(cashFlow, displayCurrency, exchangeRate), [cashFlow, displayCurrency, exchangeRate]);
  const ledger = useMemo(() => summarizeLedger(financialData.transacciones, period, new Date(`${todayKey}T12:00:00`), exchangeRate, displayCurrency), [financialData.transacciones, period, todayKey, exchangeRate, displayCurrency]);
  const payments = pendingPayments(financialData, today, exchangeRate, displayCurrency);
  const promo = nearestPromo(promoDeadlines, today);
  const receivables = useMemo(() => workspaceReceivables(financialData, { today: todayKey }), [financialData, todayKey]);
  const debtMaximum = Math.max(0, ...balances.debts.map((debt) => Math.abs(debt.amount)));
  const monthLabel = today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const dateLabel = today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const navigate = (tab, options) => onNavigateTab?.(tab, options);
  const openAssistant = (prompt) => onOpenAssistant ? onOpenAssistant(prompt) : navigate('assistant');
  const registerMovement = () => { if (!editReason) return onQuickAdd ? onQuickAdd() : navigate('transactions'); };
  const hasBudget = flow.steps.some((step) => !['minimum', 'free'].includes(step.id) && step.amount !== 0);
  const hasMovements = Array.isArray(financialData.transacciones) && financialData.transacciones.length > 0;
  const hasDebtRecords = balances.debts.length > 0 || Boolean(financialData.deudasPendientes?.length);
  const hasBalanceRecords = balances.assetCount > 0 || hasDebtRecords;
  const hasPlan = useMemo(() => hasWorkspacePlan(financialData), [financialData.planFinanciero]);
  const pendingDebtCount = Array.isArray(financialData.deudasPendientes) ? financialData.deudasPendientes.length : 0;
  const hasPendingDebts = pendingDebtCount > 0;
  const firstName = typeof accountName === 'string' ? accountName.trim().split(/\s+/)[0] : '';

  const movementsPanel = (
        <section aria-labelledby="recent-ledger-heading" className="dashboard-activity-card">
          <div className="dashboard-card-heading dashboard-activity-heading"><div><p className="dashboard-eyebrow">Actividad</p><h2 id="recent-ledger-heading">Movimientos recientes</h2></div><label><span className="sr-only">Periodo de los movimientos</span><select value={period} onChange={(event) => setPeriod(event.target.value)} className="dashboard-period"><option value="current">Este mes</option><option value="previous">Mes anterior</option></select></label></div>
          <p className="dashboard-caption dashboard-ledger-coverage">{shortDate(ledger.start)}–{shortDate(ledger.lastDate)} · <span data-sensitive>{ledger.rows.length} {ledger.rows.length === 1 ? 'registro' : 'registros'}.</span> Solo movimientos capturados.</p>
          {ledger.rows.length > 0 && <dl className="dashboard-ledger-totals" data-sensitive><div><dt><ArrowDownLeft size={14} aria-hidden="true" />Ingresos registrados</dt><dd className="sensitive-value">{formatMoney(ledger.income, currency)} <span>{currency}</span></dd></div><div><dt><ArrowUpRight size={14} aria-hidden="true" />Gastos registrados</dt><dd className="sensitive-value">{formatMoney(ledger.expenses, currency)} <span>{currency}</span></dd></div></dl>}
          {ledger.rows.length > 0 ? <ul className="dashboard-ledger-list" data-sensitive>{ledger.rows.slice(0, 5).map((transaction) => (
            <li key={transaction.key}><span className={`dashboard-ledger-icon ${transaction.tipo === 'INGRESO' ? 'is-income' : ''}`}>{transaction.tipo === 'INGRESO' ? <ArrowDownLeft size={17} aria-hidden="true" /> : <ReceiptText size={17} aria-hidden="true" />}</span><div className="dashboard-ledger-detail"><p title={transaction.descripcion}>{transaction.descripcion || 'Movimiento sin descripción'}</p><span>{transaction.categoria || 'Sin categoría'} · <time dateTime={transaction.fecha}>{shortDate(transaction.date)}</time></span></div><div className="dashboard-ledger-amount"><p className={`sensitive-value ${transaction.tipo === 'INGRESO' ? 'is-income' : ''}`}>{transaction.tipo === 'INGRESO' ? '+' : '−'}{formatMoney(transaction.amount, currency)}</p>{displayCurrency === 'ORIGINAL' && transaction.moneda !== currency && <span>{amountLabel(transaction.monto, transaction.moneda)} original</span>}</div></li>
          ))}</ul> : <div className="dashboard-empty"><ReceiptText size={26} aria-hidden="true" /><p>Aún no hay movimientos en este periodo</p><span>Registra un ingreso o gasto para empezar a ver tu actividad.</span><button type="button" onClick={registerMovement} disabled={Boolean(editReason)} title={editReason || undefined} aria-describedby={editReason ? reasonId : undefined} className={linkClass}><Plus size={15} aria-hidden="true" />Registrar movimiento</button></div>}
          {ledger.invalidCount > 0 && <p className="dashboard-validation">{ledger.invalidCount} registros con fecha, monto, tipo o moneda no válidos se excluyeron del resumen.</p>}
          <div className="dashboard-activity-footer"><button type="button" onClick={() => navigate('transactions')} className="dashboard-card-link">Ver todos los movimientos <ArrowRight size={16} aria-hidden="true" /></button>
            {onImportStatement && <button type="button" className="dashboard-link" disabled={Boolean(importReason)} title={importReason || undefined} aria-describedby={importReason ? reasonId : undefined} onClick={onImportStatement}><Upload size={16} aria-hidden="true" />Importar estado</button>}
          </div>
        </section>
  );
  const debtPanel = (
        <section aria-labelledby="debt-ranking-heading" className="dashboard-debts-card">
          <div className="dashboard-card-heading"><div><p className="dashboard-eyebrow">Deudas</p><h2 id="debt-ranking-heading">Tus saldos, en orden</h2></div>{onOpenDebtModal && <button type="button" onClick={onOpenDebtModal} disabled={Boolean(debtReason)} title={debtReason || undefined} aria-describedby={debtReason ? reasonId : undefined} aria-label="Agregar deuda" className="dashboard-icon-button"><Plus size={17} aria-hidden="true" /></button>}</div>
          <p className="dashboard-caption">{hasPendingDebts ? 'Solo deudas completas. ' : ''}De mayor a menor saldo, en {currency}.</p>
          {balances.debts.length > 0 && balances.debts.every((debt) => debt.isValid && debt.amount === 0) && <p className="dashboard-zero-balances">Los saldos de las deudas completas están en cero.</p>}
          {balances.debts.length > 0 ? <ol className="dashboard-debt-list" data-sensitive>{balances.debts.slice(0, 5).map((debt, index) => (
            <li key={debt.key}><button type="button" onClick={() => navigate('debts')} aria-label={`Ver ${debt.nombre || 'deuda'} en Deudas`}><div className="dashboard-debt-row"><div><p><span className="dashboard-debt-rank">{String(index + 1).padStart(2, '0')}</span>{debt.nombre || 'Deuda sin nombre'}</p>{debt.isValid && debt.moneda && debt.moneda !== currency && <span className="dashboard-debt-original">{amountLabel(debt.saldo, debt.moneda)} original</span>}</div><span className={`dashboard-debt-amount sensitive-value ${!debt.isValid ? 'is-pending' : ''}`}>{debt.isValid ? formatMoney(debt.amount, currency) : 'Revisar saldo'}</span></div>{debt.isValid && <div className="dashboard-debt-track" aria-hidden="true"><div style={{ width: `${debtMaximum > 0 ? debt.amount / debtMaximum * 100 : 0}%`, opacity: index === 0 ? 1 : 0.65 }} /></div>}</button></li>
          ))}</ol> : <div className="dashboard-empty"><CreditCard size={26} aria-hidden="true" /><p>{hasPendingDebts ? 'Completa tus deudas para ver sus saldos' : 'Sin deudas registradas'}</p><span>{hasPendingDebts ? 'Los registros pendientes todavía no forman parte de este resumen.' : 'Agrega una deuda si tienes saldos por registrar.'}</span></div>}
          <button type="button" onClick={() => navigate('debts')} className="dashboard-card-link">{balances.debts.length > 5 ? `Ver todas las deudas (${balances.debts.length})` : 'Ver todas las deudas'} <ArrowRight size={16} aria-hidden="true" /></button>
        </section>
  );
  const receivablesPanel = receivables.hasItems ? <ReceivablesOverview summary={receivables} onOpen={() => navigate('transactions', { view: 'expected' })} /> : null;

  return (
    <div className="dashboard-overview">
      <motion.header {...enter} className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Tu resumen</p>
          <h1 tabIndex={-1}>{firstName ? <>Hola, <span data-sensitive>{firstName}</span>.</> : 'Tu mes, con claridad.'}</h1>
          <p className="dashboard-header-description">{hasBudget ? 'Tus saldos registrados y tu margen estimado.' : 'Retoma tus registros y lo que tienes pendiente.'}</p>
        </div>
        <div className="dashboard-header-tools">
          <time dateTime={todayKey} className="dashboard-today"><CalendarDays size={14} aria-hidden="true" />{dateLabel}</time>

        </div>
      </motion.header>

      {editReason && <p id={reasonId} className="sr-only">{editReason}</p>}
      {!hasBudget && !hasMovements && !receivables.hasItems && hasPlan && <div className="dashboard-plan-return"><p>Tienes un plan de pagos en este espacio</p><button type="button" className={linkClass} onClick={() => navigate('plan')}>Abrir mi plan de pagos <ArrowRight size={16} aria-hidden="true" /></button></div>}
      {!hasBudget && (receivablesPanel || hasMovements) && <div className={`dashboard-return-grid ${receivablesPanel && hasMovements ? '' : 'is-single'}`}>{receivablesPanel}{hasMovements && movementsPanel}</div>}
      {(hasBudget || review?.total > 0) && (review || receivablesPanel) && <div className={`dashboard-review-grid ${hasBudget && review && receivablesPanel ? '' : 'is-single'}`}>
        {review && <ReviewLauncher review={review} onOpen={onOpenReview} />}
        {hasBudget && receivablesPanel}
      </div>}

      {hasPendingDebts && !review && (
        <div className="dashboard-notice">
          <CircleDashed size={20} aria-hidden="true" />
          <div><p><span data-sensitive>{pendingDebtCount} {pendingDebtCount === 1 ? 'deuda por completar' : 'deudas por completar'}</span></p><span>Faltan datos para incluirlas en el balance y los pagos mínimos. Tu panorama es parcial.</span></div>
          <button type="button" onClick={() => navigate('debts')} className={linkClass}>Completar datos <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      )}

      {promo && (
        <div className="dashboard-notice dashboard-notice-promo" data-sensitive>
          <CalendarDays size={19} aria-hidden="true" />
          <div><p>{promo.daysRemaining < 0 ? 'Una promoción tiene fecha vencida' : promo.daysRemaining === 0 ? 'Una promoción vence hoy' : `Una promoción vence en ${promo.daysRemaining} días`}</p><span>{promo.nombre} · {shortDate(promo.date)} · Saldo registrado: {amountLabel(displayAmount(convertCurrency(promo.saldo, promo.moneda || 'MXN', 'MXN', exchangeRate), displayCurrency, exchangeRate), currency)}. Revisa sus condiciones.</span></div>
          <button type="button" onClick={() => navigate('debts')} className={linkClass}>Revisar deuda <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      )}

      {hasBudget && <div className="dashboard-hero-grid">
        <motion.section {...enter} aria-labelledby="monthly-flow-heading" className="dashboard-margin-card">
          <div className="dashboard-card-heading">
            <div><p className="dashboard-eyebrow">Tu presupuesto · {monthLabel}</p><h2 id="monthly-flow-heading">Margen mensual estimado</h2></div>
            <span className={`dashboard-status ${hasPendingDebts ? 'is-partial' : ''}`}>{hasPendingDebts ? 'Estimación parcial' : 'Estimación'}</span>
          </div>
          <div className="dashboard-margin-amount" data-sensitive>
            <p className={`sensitive-value ${flow.free < 0 ? 'is-negative' : ''}`}>{formatMoney(flow.free, currency)}<span>{currency} / mes</span></p>
          </div>
          <p className="dashboard-margin-description">{hasPendingDebts ? 'Faltan pagos mínimos por integrar. Este importe todavía no representa tu margen completo.' : flow.free < 0 ? 'Los compromisos configurados superan las entradas estimadas del mes.' : 'Lo que queda de tus ingresos después de los compromisos configurados, antes de aportaciones extra a deuda.'}</p>
          <dl className="dashboard-flow-summary" data-sensitive>
            <div><dt><span className="dashboard-dot income" />Entradas estimadas</dt><dd className="sensitive-value">{formatMoney(flow.income, currency)}</dd></div>
            <div><dt><span className="dashboard-dot expenses" />Compromisos del mes</dt><dd className="sensitive-value">{formatMoney(flow.expenses, currency)}</dd></div>
          </dl>
          <div className="dashboard-margin-footer"><p className="dashboard-caption">Fuente: tu presupuesto configurado.<br />Es una estimación, no tu saldo bancario.</p><button type="button" onClick={() => navigate('budget')} className={linkClass}>Ver presupuesto <ArrowRight size={15} aria-hidden="true" /></button></div>
          <details className="dashboard-calculation">
            <summary><CircleHelp size={15} aria-hidden="true" /><span>Cómo se calcula</span><ChevronRight size={15} aria-hidden="true" /></summary>
            <div className="dashboard-calculation-content"><FlowWaterfall flow={flow} currency={currency} /><p className="dashboard-caption">Ingresos, provisión fiscal, gastos y pagos mínimos configurados.{hasPendingDebts ? ' Las deudas por completar no se incluyen.' : ''}</p></div>
          </details>
          {Math.abs(flow.reconciliationDifference) > 0.01 && <p className="dashboard-validation">El flujo reportado no coincide con sus componentes. Revisa el presupuesto antes de usar esta estimación.</p>}
        </motion.section>

        <motion.section {...enter} aria-labelledby="pending-payments-heading" className="dashboard-payments-card">
          <div className="dashboard-card-heading"><div><p className="dashboard-eyebrow">Para tener presente</p><h2 id="pending-payments-heading">Pagos de este mes</h2></div><CalendarDays size={20} aria-hidden="true" /></div>
          <p className="dashboard-caption dashboard-payment-coverage"><span data-sensitive>{payments.length} {payments.length === 1 ? 'pago sin confirmar' : 'pagos sin confirmar'}.</span> Solo fechas de registros completos.</p>
          {payments.length > 0 ? <ul className="dashboard-payment-list" data-sensitive>{payments.slice(0, 3).map((payment) => (
            <li key={`${payment.kind}-${payment.id}`}>
              <div className={`dashboard-payment-date ${payment.daysRemaining <= 0 ? 'is-due' : ''}`}><span>{payment.date.toLocaleDateString('es-MX', { month: 'short' })}</span><strong>{payment.date.getDate()}</strong></div>
              <div className="dashboard-payment-detail"><p title={payment.nombre}>{payment.nombre}</p><span className={payment.daysRemaining <= 0 ? 'is-due' : ''}>{payment.daysRemaining < 0 ? 'Fecha pasada · sin confirmar' : payment.daysRemaining === 0 ? 'Hoy · sin confirmar' : `En ${payment.daysRemaining} días`}</span><span>{payment.kind}</span></div>
              <p className="dashboard-payment-amount sensitive-value">{formatMoney(payment.amount, currency)}<span>{currency}</span></p>
            </li>
          ))}</ul> : <div className="dashboard-payment-empty"><CalendarDays size={27} aria-hidden="true" /><p>Sin fechas pendientes registradas</p><span>Revisa las fechas de tus gastos y deudas en el calendario.</span></div>}
          <div className="dashboard-payment-footer"><button type="button" onClick={() => navigate('calendar')} className={linkClass}>{payments.length > 3 ? `Ver los ${payments.length} pagos` : 'Abrir calendario'} <ArrowRight size={15} aria-hidden="true" /></button>{financialData.planFinanciero && <button type="button" onClick={() => navigate('plan', { panel: 'calendar' })} className="dashboard-plan-link">Ver vencimientos del plan <ArrowUpRight size={14} aria-hidden="true" /></button>}</div>
        </motion.section>
      </div>}

      {(hasBudget || hasBalanceRecords) && <section aria-label="Balance consolidado" className="dashboard-balance-section">
        <div className="dashboard-section-caption"><span>Saldos registrados{hasPendingDebts ? ' · cobertura parcial' : ' · corte actual'}</span><span>{displayCurrency === 'ORIGINAL' ? 'Consolidado en MXN · moneda original en el detalle' : `Importes en ${currency}`}</span></div>
        <div className="dashboard-metrics-grid">
          {(hasBudget || balances.assetCount > 0) && <BalanceMetric icon={Wallet} label="Activos registrados" amount={balances.assets} description={`${balances.assetCount} ${balances.assetCount === 1 ? 'activo en tu balance' : 'activos en tu balance'}`} currency={currency} onClick={() => navigate('balance')} />}
          {(hasBudget || hasDebtRecords) && <BalanceMetric icon={CreditCard} label="Deuda registrada" amount={hasPendingDebts ? null : balances.debt} pendingLabel={hasPendingDebts ? 'Por completar' : 'Dato pendiente'} description={hasPendingDebts ? `${pendingDebtCount} ${pendingDebtCount === 1 ? 'deuda pendiente de integrar al total' : 'deudas pendientes de integrar al total'}` : `${balances.debts.length} ${balances.debts.length === 1 ? 'deuda en tus registros' : 'deudas en tus registros'}`} currency={currency} onClick={() => navigate('debts')} />}
          <BalanceMetric icon={Layers3} label="Patrimonio neto" amount={hasPendingDebts ? null : balances.netWorth} pendingLabel={hasPendingDebts ? 'Por completar' : 'Dato pendiente'} description={hasPendingDebts ? 'Completa tus deudas para calcularlo' : 'Activos menos deudas registradas'} currency={currency} onClick={() => navigate('balance')} negativeTone />
        </div>
        {(balances.invalidDebtCount > 0 || balances.invalidAssetCount > 0) && <p className="dashboard-validation">Revisa {balances.invalidDebtCount + balances.invalidAssetCount} saldos con importe o moneda no válidos. Los totales afectados quedan pendientes.</p>}
      </section>}

      {(hasBudget || hasDebtRecords) && <div className={`dashboard-detail-grid ${!hasBudget ? 'is-single' : ''}`}>
        {hasBudget && movementsPanel}
        {debtPanel}
      </div>}
      {!hasBudget && <div className="dashboard-budget-invitation"><p>Configura un presupuesto si quieres estimar tu margen mensual.</p><button type="button" onClick={() => navigate('budget')} className={linkClass}>Configurar mi presupuesto <ArrowRight size={16} aria-hidden="true" /></button></div>}

      <aside aria-labelledby="dashboard-assistant-heading" className="dashboard-assistant-strip">
        <span className="dashboard-assistant-icon"><Sparkles size={19} aria-hidden="true" /></span><div><h2 id="dashboard-assistant-heading">Dale contexto a tus números</h2><p>Pregunta por tu margen o tus deudas. Tú eliges qué información compartir.</p></div><motion.button type="button" onClick={() => openAssistant('Explica mi margen mensual usando los componentes de mi presupuesto. Distingue las estimaciones de los movimientos registrados y señala los datos pendientes.')} className="dashboard-assistant-action">Preguntar al asistente <ArrowUpRight size={16} aria-hidden="true" /></motion.button>
      </aside>
    </div>
  );
}
