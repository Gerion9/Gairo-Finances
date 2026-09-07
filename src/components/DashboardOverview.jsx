import React, { useId, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight,
  CircleHelp, CreditCard, Layers3, Plus, ReceiptText, Sparkles, Upload, Wallet,
} from 'lucide-react';
import { convertCurrency, formatMoney } from '../services/exchangeRate';
import {
  consolidatedCurrency, displayAmount, localDateKey, monthlyFlow, nearestPromo,
  pendingPayments, summarizeBalances, summarizeLedger,
} from '../services/dashboardAnalytics';

const compactNumber = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = (date) => date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const amountLabel = (value, currency) => `${formatMoney(value, currency)} ${currency}`;
const signedAmount = (value, currency) => `${value < 0 ? '−' : '+'}${formatMoney(Math.abs(value), currency)}`;
const linkClass = 'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg text-xs font-semibold text-[#A4B1C3] transition-colors hover:text-[#7DE4BF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DE4BF]';

function FlowWaterfall({ flow, currency }) {
  const chartId = useId();
  const [activeStep, setActiveStep] = useState(null);
  const width = 640;
  const height = 232;
  const chartTop = 18;
  const chartBottom = 177;
  const allValues = flow.steps.flatMap((step) => [step.start, step.end]);
  const maximum = Math.max(0, ...allValues);
  const minimum = Math.min(0, ...allValues);
  const span = maximum - minimum || 1;
  const y = (value) => chartBottom - ((value - minimum) / span) * (chartBottom - chartTop);
  const slot = (width - 64) / flow.steps.length;
  const barWidth = Math.min(47, slot * 0.62);
  const x = (index) => 57 + index * slot + (slot - barWidth) / 2;
  const selected = flow.steps.find((step) => step.id === activeStep);
  const mobileMaximum = Math.max(0, ...flow.steps.map((step) => Math.abs(step.amount)));

  return (
    <figure className="min-w-0" data-sensitive>
      <div className="mb-2 flex min-h-11 flex-wrap items-center justify-between gap-2 text-xs">
        <figcaption id={`${chartId}-caption`} className="font-medium text-[#A4B1C3]">Cómo se compone tu mes <span className="text-[#8B9BB1]">· {currency}</span></figcaption>
        <span className="min-h-5 tabular-nums text-[#F4F7FB]" aria-live="polite">
          {selected ? `${selected.label}: ${signedAmount(selected.amount, currency)} · Acumulado: ${formatMoney(selected.end, currency)}` : 'Ingresos → compromisos → flujo libre'}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="hidden w-full overflow-visible sm:block" role="group" aria-labelledby={`${chartId}-caption`} onPointerLeave={() => setActiveStep(null)}>
        <desc>Cascada del presupuesto mensual estimado. Cada barra parte del saldo acumulado anterior. La última muestra el flujo libre, antes de aportaciones extra.</desc>
        {(maximum === minimum ? [0] : [maximum, minimum + span / 2, minimum]).filter((value, index, values) => values.indexOf(value) === index).map((value) => (
          <g key={value} aria-hidden="true">
            <line x1="57" x2={width} y1={y(value)} y2={y(value)} stroke="#223248" strokeDasharray="3 5" />
            <text x="45" y={y(value) + 4} textAnchor="end" fill="#8B9BB1" fontSize="10">{compactNumber.format(value)}</text>
          </g>
        ))}
        <line x1="57" x2={width} y1={y(0)} y2={y(0)} stroke="#526178" strokeWidth="1" aria-hidden="true" />
        {flow.steps.map((step, index) => {
          const top = Math.min(y(step.start), y(step.end));
          const barHeight = Math.abs(y(step.start) - y(step.end));
          const isActive = step.id === activeStep;
          return (
            <g key={step.id} tabIndex={0} role="img"
              aria-label={`${step.label}: ${signedAmount(step.amount, currency)} ${currency}. Acumulado: ${amountLabel(step.end, currency)}`}
              onFocus={() => setActiveStep(step.id)} onBlur={() => setActiveStep(null)}
              onPointerEnter={() => setActiveStep(step.id)} className="outline-none">
              <title>{step.label}: {signedAmount(step.amount, currency)} {currency}. Acumulado: {amountLabel(step.end, currency)}</title>
              <rect x={x(index) - 7} y="7" width={barWidth + 14} height="214" rx="10" fill={isActive ? '#FFFFFF08' : 'transparent'} stroke={isActive ? '#879BB5' : 'transparent'} />
              {index < flow.steps.length - 2 && (
                <line x1={x(index) + barWidth} x2={x(index + 1)} y1={y(step.end)} y2={y(step.end)} stroke="#6E7F96" strokeDasharray="3 3" aria-hidden="true" />
              )}
              {barHeight > 0 ? (
                <rect x={x(index)} y={top} width={barWidth} height={barHeight} rx={Math.min(5, barHeight / 2)} fill={step.color} opacity={activeStep && !isActive ? 0.52 : 0.95} className="transition-opacity duration-150 motion-reduce:transition-none" />
              ) : (
                <line x1={x(index)} x2={x(index) + barWidth} y1={y(step.start)} y2={y(step.start)} stroke={step.color} strokeWidth="2" />
              )}
              <text x={x(index) + barWidth / 2} y={top - 5} textAnchor="middle" fill={step.color} fontSize="10" aria-hidden="true">{step.amount < 0 ? '−' : ''}{compactNumber.format(Math.abs(step.amount))}</text>
              <text x={x(index) + barWidth / 2} y="205" textAnchor="middle" fill={step.id === 'free' ? step.color : '#A4B1C3'} fontSize="11" fontWeight={step.id === 'free' ? '600' : '400'}>{step.shortLabel}</text>
              <text x={x(index) + barWidth / 2} y="222" textAnchor="middle" fill="#8B9BB1" fontSize="10">{step.id === 'free' ? '=' : step.amount < 0 ? '−' : '+'}</text>
            </g>
          );
        })}
      </svg>
      <dl className="mt-4 space-y-3.5 sm:hidden">
        {flow.steps.map((step) => (
          <div key={step.id} className={step.id === 'free' ? 'border-t border-[#223248] pt-3.5' : ''}>
            <div className="mb-1.5 flex items-start justify-between gap-3"><dt className="text-xs leading-relaxed text-[#A4B1C3]">{step.id === 'free' ? 'Flujo libre' : step.label}</dt><dd className="shrink-0 text-xs font-medium tabular-nums" style={{ color: step.color }}>{signedAmount(step.amount, currency)}</dd></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#223248]" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${mobileMaximum > 0 ? Math.abs(step.amount) / mobileMaximum * 100 : 0}%`, backgroundColor: step.color }} /></div>
          </div>
        ))}
      </dl>
      <details className="group mt-1 rounded-xl text-xs">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-[#A4B1C3] transition-colors hover:text-[#F4F7FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7DE4BF]">
          <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Ver cifras del cálculo
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <table className="mt-1 w-full border-collapse text-left">
          <caption className="sr-only">Componentes del presupuesto mensual en {currency}</caption>
          <thead><tr className="border-b border-[#223248] text-[#8B9BB1]"><th className="py-2 font-medium" scope="col">Concepto</th><th className="py-2 text-right font-medium" scope="col">Importe ({currency})</th><th className="py-2 pl-3 text-right font-medium" scope="col">Acumulado</th></tr></thead>
          <tbody>{flow.steps.map((step) => (
            <tr key={step.id} className={step.id === 'free' ? 'border-t border-[#223248] font-semibold text-[#F4F7FB]' : 'text-[#A4B1C3]'}>
              <th className="py-2 pr-3 font-normal" scope="row">{step.label}</th><td className="py-2 text-right tabular-nums">{signedAmount(step.amount, currency)}</td><td className="py-2 pl-3 text-right tabular-nums">{formatMoney(step.end, currency)}</td>
            </tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  );
}

function BalanceMetric({ icon: Icon, label, amount, description, currency, onClick, negativeTone = false }) {
  return (
    <button type="button" onClick={onClick} className="surface-card group w-full min-w-0 rounded-2xl border border-[#223248] bg-[#111B29] p-5 text-left transition-colors hover:border-[#48647B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DE4BF] sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-[#A4B1C3]"><Icon className="h-4 w-4 text-[#8B9BB1]" aria-hidden="true" />{label}</span>
        <ArrowUpRight className="h-4 w-4 text-[#718399] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
      </div>
      <p data-sensitive className={`sensitive-value mt-4 break-words text-[clamp(1.5rem,2.5vw,2rem)] font-semibold tracking-[-0.045em] tabular-nums ${negativeTone && amount < 0 ? 'text-[#E8A4AA]' : 'text-[#F4F7FB]'}`}>
        {amount === null ? <span className="text-lg tracking-normal text-[#E7BE83]">Dato pendiente</span> : <>{formatMoney(amount, currency)} <span className="text-xs font-normal tracking-normal text-[#8B9BB1]">{currency}</span></>}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#8B9BB1]">{description}</p>
    </button>
  );
}

export default function DashboardOverview({
  financialData = {}, cashFlow = {}, promoDeadlines = [], exchangeRate,
  displayCurrency = 'MXN', onNavigateTab, onOpenDebtModal,
  onQuickAdd, onOpenAssistant, onImportStatement,
}) {
  const [period, setPeriod] = useState('current');
  const today = new Date();
  const todayKey = localDateKey(today);
  const currency = consolidatedCurrency(displayCurrency);
  const balances = useMemo(() => summarizeBalances(financialData, exchangeRate, displayCurrency), [financialData, exchangeRate, displayCurrency]);
  const flow = useMemo(() => monthlyFlow(cashFlow, displayCurrency, exchangeRate), [cashFlow, displayCurrency, exchangeRate]);
  const ledger = useMemo(() => summarizeLedger(financialData.transacciones, period, new Date(`${todayKey}T12:00:00`), exchangeRate, displayCurrency), [financialData.transacciones, period, todayKey, exchangeRate, displayCurrency]);
  const payments = pendingPayments(financialData, today, exchangeRate, displayCurrency);
  const promo = nearestPromo(promoDeadlines, today);
  const debtMaximum = Math.max(0, ...balances.debts.map((debt) => Math.abs(debt.amount)));
  const monthLabel = today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const navigate = (tab) => onNavigateTab?.(tab);
  const openAssistant = (prompt) => onOpenAssistant ? onOpenAssistant(prompt) : navigate('assistant');
  const registerMovement = () => onQuickAdd ? onQuickAdd() : navigate('transactions');
  const hasBudget = flow.steps.some((step) => step.amount !== 0);

  return (
    <div className="space-y-6 pb-4 sm:space-y-7">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7DE4BF]">Tu panorama financiero</p>
          <h1 className="text-[clamp(1.85rem,3vw,2.6rem)] font-semibold leading-tight tracking-[-0.045em] text-[#F4F7FB]">Tu dinero, en perspectiva.</h1>
          <p className="mt-2 text-sm text-[#A4B1C3]">Todo lo esencial para decidir tu siguiente paso.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onImportStatement && <button type="button" onClick={onImportStatement} className="button-secondary inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#223248] px-4 text-xs font-semibold text-[#C8D3E2]"><Upload className="h-4 w-4" aria-hidden="true" />Importar estado</button>}
          <button type="button" onClick={registerMovement} className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#7DE4BF] px-4 text-xs font-semibold text-[#0A1916]"><Plus className="h-4 w-4" aria-hidden="true" />Registrar movimiento</button>
        </div>
      </header>

      {promo && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E7BE83]/25 bg-[#E7BE83]/[0.06] px-5 py-3.5 sm:flex-row sm:items-center" data-sensitive>
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#E7BE83]" aria-hidden="true" />
            <div><p className="text-sm font-medium text-[#E7BE83]">{promo.daysRemaining < 0 ? 'Revisa una promoción con fecha vencida' : promo.daysRemaining === 0 ? 'Una promoción vence hoy' : `Una promoción vence en ${promo.daysRemaining} días`}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A4B1C3]">{promo.nombre} · {shortDate(promo.date)} · Saldo registrado: {amountLabel(displayAmount(convertCurrency(promo.saldo, promo.moneda || 'MXN', 'MXN', exchangeRate), displayCurrency, exchangeRate), currency)}. Consulta sus condiciones.</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('debts')} className={linkClass}>Revisar deuda <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      )}

      <section aria-labelledby="monthly-flow-heading" className="surface-card relative overflow-hidden rounded-[24px] border border-[#2C413F] bg-[#111B29]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(125,228,191,0.08),transparent_65%)]" />
        <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[0.78fr_1.22fr] xl:gap-10">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="monthly-flow-heading" className="text-sm font-medium text-[#C8D3E2]">Flujo mensual estimado</h2>
                <span className="rounded-full border border-[#7DE4BF]/20 bg-[#7DE4BF]/[0.07] px-2 py-0.5 text-[10px] text-[#7DE4BF]">Presupuesto</span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs capitalize text-[#8B9BB1]"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{monthLabel}</p>
              <div className="mt-7" data-sensitive>
                <p className={`sensitive-value break-words text-[clamp(2.2rem,4vw,3.5rem)] font-medium leading-none tracking-[-0.06em] tabular-nums ${flow.free < 0 ? 'text-[#E8A4AA]' : 'text-[#7DE4BF]'}`}>{formatMoney(flow.free, currency)}</p>
                <p className="mt-3 text-xs leading-relaxed text-[#A4B1C3]">{currency} / mes · {flow.free < 0 ? 'Déficit estimado' : flow.free === 0 ? 'Sin margen estimado' : 'Margen estimado'}<br /><span className="text-[#8B9BB1]">Antes de aportaciones extra a deuda.</span></p>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#223248] pt-4" data-sensitive>
                <div><p className="mb-1 text-[11px] text-[#8B9BB1]">Entradas estimadas</p><p className="sensitive-value text-sm font-medium tabular-nums text-[#F4F7FB]">{formatMoney(flow.income, currency)}</p></div>
                <div><p className="mb-1 text-[11px] text-[#8B9BB1]">Compromisos del mes</p><p className="sensitive-value text-sm font-medium tabular-nums text-[#F4F7FB]">{formatMoney(flow.expenses, currency)}</p></div>
              </div>
            </div>
            <button type="button" onClick={() => navigate('budget')} className={`${linkClass} mt-4 self-start text-[#7DE4BF]`}>Ajustar presupuesto <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
          </div>
          <div className="min-w-0 self-center border-t border-[#223248] pt-3 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
            <FlowWaterfall flow={flow} currency={currency} />
            <p className="mt-1 text-[11px] leading-relaxed text-[#8B9BB1]">{hasBudget ? 'Calculado con tus ingresos, provisión fiscal, gastos y pagos mínimos configurados. No representa el saldo bancario.' : 'Configura tus ingresos y compromisos para construir tu presupuesto mensual.'}</p>
            {Math.abs(flow.reconciliationDifference) > 0.01 && <p className="mt-2 text-xs text-[#E7BE83]">El flujo reportado no coincide con sus componentes. Revisa el presupuesto antes de usar esta estimación.</p>}
          </div>
        </div>
      </section>

      <section aria-label="Balance consolidado" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#8B9BB1]">
          <span>Saldos registrados · corte actual</span><span>{displayCurrency === 'ORIGINAL' ? 'Consolidado en MXN · moneda original en el detalle' : `Todos los importes en ${currency}`}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <BalanceMetric icon={Wallet} label="Activos registrados" amount={balances.assets} description={`${balances.assetCount} activos en tu balance`} currency={currency} onClick={() => navigate('balance')} />
          <BalanceMetric icon={CreditCard} label="Deuda registrada" amount={balances.debt} description={`${balances.debts.length} deudas en tu portafolio`} currency={currency} onClick={() => navigate('debts')} />
          <BalanceMetric icon={Layers3} label="Patrimonio neto" amount={balances.netWorth} description="Activos menos deudas registradas" currency={currency} onClick={() => navigate('balance')} negativeTone />
        </div>
        {(balances.invalidDebtCount > 0 || balances.invalidAssetCount > 0) && <p className="px-1 text-xs leading-relaxed text-[#E7BE83]">Revisa {balances.invalidDebtCount + balances.invalidAssetCount} saldos con importe o moneda no válidos. Los totales afectados quedan pendientes.</p>}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section aria-labelledby="recent-ledger-heading" className="surface-card min-w-0 rounded-[22px] border border-[#223248] bg-[#111B29] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow mb-1 text-[10px] uppercase tracking-[0.16em] text-[#8B9BB1]">Actividad</p><h2 id="recent-ledger-heading" className="text-lg font-semibold tracking-tight text-[#F4F7FB]">Movimientos recientes</h2></div>
            <label className="flex flex-col gap-1"><span className="sr-only">Periodo de los movimientos</span><select value={period} onChange={(event) => setPeriod(event.target.value)} className="field-input min-h-11 rounded-xl border border-[#223248] bg-[#0C1420] px-3 text-xs text-[#C8D3E2] focus:border-[#7DE4BF] focus:outline-none"><option value="current">Este mes, hasta hoy</option><option value="previous">Mes anterior</option></select></label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8B9BB1]">{shortDate(ledger.start)}–{shortDate(ledger.lastDate)} · {ledger.rows.length} registros. Cobertura limitada a los movimientos capturados.</p>
          <dl className="my-5 grid grid-cols-2 gap-3 border-y border-[#223248] py-4" data-sensitive>
            <div><dt className="mb-1 flex items-center gap-1 text-[11px] text-[#8B9BB1]"><ArrowDownLeft className="h-3.5 w-3.5 text-[#7DE4BF]" aria-hidden="true" />Ingresos registrados</dt><dd className="sensitive-value text-base font-medium tracking-tight tabular-nums text-[#7DE4BF]">{formatMoney(ledger.income, currency)} <span className="text-[10px] font-normal text-[#8B9BB1]">{currency}</span></dd></div>
            <div><dt className="mb-1 flex items-center gap-1 text-[11px] text-[#8B9BB1]"><ArrowUpRight className="h-3.5 w-3.5 text-[#DCA6A2]" aria-hidden="true" />Gastos registrados</dt><dd className="sensitive-value text-base font-medium tracking-tight tabular-nums text-[#F4F7FB]">{formatMoney(ledger.expenses, currency)} <span className="text-[10px] font-normal text-[#8B9BB1]">{currency}</span></dd></div>
          </dl>
          {ledger.rows.length > 0 ? (
            <ul className="divide-y divide-[#223248]/65" data-sensitive>{ledger.rows.slice(0, 5).map((transaction) => (
              <li key={transaction.key} className="flex items-center gap-3 py-3.5 first:pt-0">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${transaction.tipo === 'INGRESO' ? 'bg-[#7DE4BF]/10 text-[#7DE4BF]' : 'bg-[#89ACD6]/10 text-[#89ACD6]'}`}>{transaction.tipo === 'INGRESO' ? <ArrowDownLeft className="h-4 w-4" aria-hidden="true" /> : <ReceiptText className="h-4 w-4" aria-hidden="true" />}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#E2E9F3]" title={transaction.descripcion}>{transaction.descripcion || 'Movimiento sin descripción'}</p><p className="mt-1 truncate text-[11px] text-[#8B9BB1]">{transaction.categoria || 'Sin categoría'} · <time dateTime={transaction.fecha}>{shortDate(transaction.date)}</time></p></div>
                <div className="max-w-[48%] text-right"><p className={`sensitive-value break-words text-sm font-medium tabular-nums ${transaction.tipo === 'INGRESO' ? 'text-[#7DE4BF]' : 'text-[#C8D3E2]'}`}>{transaction.tipo === 'INGRESO' ? '+' : '−'}{formatMoney(transaction.amount, currency)}</p>{displayCurrency === 'ORIGINAL' && transaction.moneda !== currency && <p className="mt-1 text-[10px] tabular-nums text-[#8B9BB1]">{amountLabel(transaction.monto, transaction.moneda)} original</p>}</div>
              </li>
            ))}</ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#2B3C50] px-5 py-8 text-center"><ReceiptText className="mb-3 h-7 w-7 text-[#718399]" aria-hidden="true" /><p className="text-sm font-medium text-[#C8D3E2]">Este periodo aún no tiene movimientos.</p><p className="mt-2 max-w-xs text-xs leading-relaxed text-[#8B9BB1]">Registra un ingreso o gasto, o importa un estado de cuenta para empezar a revisarlos.</p><button type="button" onClick={registerMovement} className={`${linkClass} mt-3 text-[#7DE4BF]`}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Registrar movimiento</button></div>
          )}
          {ledger.invalidCount > 0 && <p className="mt-3 text-xs leading-relaxed text-[#E7BE83]">{ledger.invalidCount} registros con fecha, monto, tipo o moneda no válidos se excluyeron del resumen.</p>}
          <button type="button" onClick={() => navigate('transactions')} className={`${linkClass} mt-4 w-full justify-between border-t border-[#223248] pt-3`}>Ver todos los movimientos <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        </section>

        <aside aria-labelledby="dashboard-assistant-heading" className="relative overflow-hidden rounded-[22px] border border-[#B8AFF8]/25 bg-[#151B2C] p-5 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-[#B8AFF8]/[0.06] blur-3xl" />
          <div className="relative">
            <div className="mb-6 flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#B8AFF8]/20 bg-[#B8AFF8]/10 text-[#C8C1FF]"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><span className="rounded-full border border-[#B8AFF8]/20 px-2.5 py-1 text-[10px] font-medium text-[#C8C1FF]">Asistente con Claude</span></div>
            <h2 id="dashboard-assistant-heading" className="max-w-xs text-2xl font-medium leading-tight tracking-[-0.035em] text-[#F4F7FB]">De tus números<br />a mejores preguntas.</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#A4B1C3]">Explora tu presupuesto, entiende tus deudas y revisa tus movimientos con contexto.</p>
            <div className="mt-5 space-y-2">
              {[
                ['¿Qué explica mi flujo libre?', 'Explica mi flujo libre mensual usando los componentes de mi presupuesto y distingue las estimaciones de mis movimientos registrados.'],
                ['¿Cómo se distribuyen mis deudas?', 'Ayúdame a entender cómo se distribuyen mis deudas por saldo, moneda y tasa registrada. Señala qué datos faltan antes de comparar alternativas.'],
              ].map(([label, prompt]) => <button key={label} type="button" onClick={() => openAssistant(prompt)} className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[#B8AFF8]/15 bg-[#0C1420]/40 px-3.5 py-3 text-left text-xs font-medium text-[#D9D4FF] transition-colors hover:border-[#B8AFF8]/50 hover:bg-[#B8AFF8]/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8AFF8]">{label}<ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#A49CD9] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></button>)}
            </div>
            <button type="button" onClick={() => openAssistant('')} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B8AFF8] px-4 py-3 text-xs font-semibold text-[#16152A] transition-colors hover:bg-[#CBC4FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B8AFF8]">Abrir asistente <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            <p className="mt-3 text-[11px] leading-relaxed text-[#8B9BB1]">Elige qué información compartir antes de enviar tu consulta.</p>
          </div>
        </aside>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_1fr]">
        <section aria-labelledby="debt-ranking-heading" className="surface-card min-w-0 rounded-[22px] border border-[#223248] bg-[#111B29] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow mb-1 text-[10px] uppercase tracking-[0.16em] text-[#8B9BB1]">Portafolio de deuda</p><h2 id="debt-ranking-heading" className="text-lg font-semibold tracking-tight text-[#F4F7FB]">Dónde se concentra tu saldo</h2></div>{onOpenDebtModal && <button type="button" onClick={onOpenDebtModal} aria-label="Agregar deuda" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#223248] text-[#A4B1C3] transition-colors hover:border-[#7DE4BF]/40 hover:text-[#7DE4BF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7DE4BF]"><Plus className="h-4 w-4" aria-hidden="true" /></button>}</div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8B9BB1]">Saldos actuales en {currency}, ordenados de mayor a menor.</p>
          {balances.debts.length > 0 && balances.debts.every((debt) => debt.isValid && debt.amount === 0) && <p className="mt-4 rounded-xl bg-[#7DE4BF]/[0.07] px-3 py-3 text-xs text-[#7DE4BF]">Todos los saldos registrados están en cero.</p>}
          {balances.debts.length > 0 ? <ol className="mt-6 space-y-5" data-sensitive>{balances.debts.map((debt, index) => (
            <li key={debt.key}>
              <button type="button" onClick={() => navigate('debts')} aria-label={`Ver ${debt.nombre || 'deuda'} en Deudas`} className="block min-h-11 w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DE4BF]">
                <div className="mb-2 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium leading-relaxed text-[#C8D3E2]"><span className="mr-2 text-[10px] tabular-nums text-[#718399]">{String(index + 1).padStart(2, '0')}</span>{debt.nombre || 'Deuda sin nombre'}</p>{debt.isValid && debt.moneda && debt.moneda !== currency && <p className="ml-6 mt-1 text-[10px] text-[#8B9BB1]">{amountLabel(debt.saldo, debt.moneda)} original</p>}</div><span className={`sensitive-value shrink-0 text-xs font-medium tabular-nums ${debt.isValid ? 'text-[#E2E9F3]' : 'text-[#E7BE83]'}`}>{debt.isValid ? formatMoney(debt.amount, currency) : 'Revisar saldo'}</span></div>
                {debt.isValid && <div className="h-2 overflow-hidden rounded-full bg-[#223248]/60" aria-hidden="true" title={`${debt.nombre}: ${amountLabel(debt.amount, currency)}`}><div className="h-full rounded-full bg-[#89ACD6] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${debtMaximum > 0 ? debt.amount / debtMaximum * 100 : 0}%`, opacity: index === 0 ? 1 : 0.65 }} /></div>}
              </button>
            </li>
          ))}</ol> : <div className="mt-5 rounded-xl border border-dashed border-[#2B3C50] px-5 py-7 text-center"><CreditCard className="mx-auto mb-2 h-6 w-6 text-[#718399]" aria-hidden="true" /><p className="text-sm text-[#C8D3E2]">Aún no hay deudas registradas.</p><p className="mt-2 text-xs text-[#8B9BB1]">Agrega tus saldos para ver su distribución.</p></div>}
          <button type="button" onClick={() => navigate('debts')} className={`${linkClass} mt-5 w-full justify-between border-t border-[#223248] pt-3`}>Gestionar deudas <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        </section>

        <section aria-labelledby="pending-payments-heading" className="surface-card min-w-0 rounded-[22px] border border-[#223248] bg-[#111B29] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow mb-1 text-[10px] uppercase tracking-[0.16em] text-[#8B9BB1]">En tu calendario</p><h2 id="pending-payments-heading" className="text-lg font-semibold tracking-tight text-[#F4F7FB]">Pagos por revisar</h2></div><CalendarDays className="mt-1 h-5 w-5 text-[#8B9BB1]" aria-hidden="true" /></div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8B9BB1]">{payments.length} pendientes en el checklist de {monthLabel}. Confirma los pagos ya realizados.</p>
          {payments.length > 0 ? <ul className="mt-5 divide-y divide-[#223248]/65" data-sensitive>{payments.slice(0, 4).map((payment) => (
            <li key={`${payment.kind}-${payment.id}`} className="flex items-center gap-3 py-3.5 first:pt-0"><div className={`flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl border ${payment.daysRemaining < 0 ? 'border-[#E7BE83]/20 bg-[#E7BE83]/[0.07]' : 'border-[#223248] bg-[#0C1420]'}`}><span className="text-[9px] uppercase text-[#8B9BB1]">{payment.date.toLocaleDateString('es-MX', { month: 'short' })}</span><span className={`text-lg font-medium leading-tight tabular-nums ${payment.daysRemaining < 0 ? 'text-[#E7BE83]' : 'text-[#C8D3E2]'}`}>{payment.date.getDate()}</span></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-[#C8D3E2]" title={payment.nombre}>{payment.nombre}</p><p className={`mt-1 text-[10px] ${payment.daysRemaining <= 0 ? 'text-[#E7BE83]' : 'text-[#8B9BB1]'}`}>{payment.daysRemaining < 0 ? 'Fecha pasada · sin confirmar' : payment.daysRemaining === 0 ? 'Hoy · sin confirmar' : `En ${payment.daysRemaining} días`} · {payment.kind}</p></div><span className="sensitive-value max-w-[40%] break-words text-right text-xs font-medium tabular-nums text-[#E2E9F3]">{formatMoney(payment.amount, currency)}</span></li>
          ))}</ul> : <div className="mt-5 rounded-xl border border-dashed border-[#2B3C50] px-5 py-7 text-center"><CalendarDays className="mx-auto mb-2 h-6 w-6 text-[#718399]" aria-hidden="true" /><p className="text-sm text-[#C8D3E2]">Sin pagos pendientes con fecha registrada.</p><p className="mt-2 text-xs leading-relaxed text-[#8B9BB1]">El calendario usa las fechas de tus gastos y deudas, y tu checklist mensual.</p></div>}
          <button type="button" onClick={() => navigate('calendar')} className={`${linkClass} mt-5 w-full justify-between border-t border-[#223248] pt-3`}>Abrir calendario <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        </section>
      </div>
    </div>
  );
}
