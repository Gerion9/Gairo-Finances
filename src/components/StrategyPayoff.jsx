import React from 'react';
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Wallet } from 'lucide-react';
import { formatMoney, convertCurrency } from '../services/exchangeRate';
import { buildStrategyPaymentPlan } from '../services/financeEngine';

export default function StrategyPayoff({ deudas = [], cashFlow, extraPayment = 0, exchangeRate = 19.25, displayCurrency = 'MXN' }) {
  const plan = buildStrategyPaymentPlan(deudas, extraPayment, exchangeRate);
  const money = value => formatMoney(convertCurrency(value, 'MXN', displayCurrency, exchangeRate), displayCurrency);
  const availableForDebt = Number.isFinite(cashFlow?.flujoLibreReal) && Number.isFinite(cashFlow?.totalPagosMinimosMXN)
    ? Math.max(0, cashFlow.flujoLibreReal + cashFlow.totalPagosMinimosMXN) : null;
  const fundingGap = availableForDebt === null ? null : Math.max(0, plan.totalPaymentMXN - availableForDebt);
  const orderedItems = [...plan.items].sort((a, b) => Number(b.debt.tipo === 'PROMO_DEADLINE') - Number(a.debt.tipo === 'PROMO_DEADLINE') || b.paymentMXN - a.paymentMXN);

  return (
    <section className="rounded-2xl border border-[#223248] bg-[#111B29] p-4 sm:p-6" aria-labelledby="payment-plan-title">
      <div className="flex flex-col justify-between gap-5 border-b border-[#223248] pb-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7DE4BF]">Tu siguiente movimiento</p>
          <h2 id="payment-plan-title" className="mt-2 text-xl font-semibold tracking-tight text-white">Un plan de pagos para este mes</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Primero los mínimos de cada deuda. Después, el extra cubre cuotas de promociones y la prioridad por tasa.</p>
        </div>
        <div className="self-start rounded-xl border border-[#223248] bg-[#080D14] px-5 py-4 lg:min-w-[230px]">
          <p className="flex items-center gap-2 text-xs text-slate-400"><Wallet size={15} aria-hidden="true" />Total del plan · {displayCurrency}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#7DE4BF]" data-sensitive>{money(plan.totalPaymentMXN)}</p>
        </div>
      </div>

      {(fundingGap > 0 || cashFlow?.flujoLibreReal < 0) && <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4" role="status">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-200" size={18} aria-hidden="true" />
        <div className="text-sm leading-relaxed"><p className="font-medium text-amber-100">Este escenario requiere revisar tu flujo disponible</p><p className="mt-1 text-amber-200/80">{fundingGap > 0 ? <span data-sensitive>Faltan {money(fundingGap)} {displayCurrency} para financiar el total del plan. </span> : 'El flujo libre registrado es negativo. '}Ajusta la aportación, los gastos o los ingresos antes de usar esta hipótesis como plan de pago.</p></div>
      </div>}
      {availableForDebt === null && <p className="mt-4 text-xs text-amber-200">Faltan datos de flujo para evaluar si este plan es financiable.</p>}
      {plan.promoShortfallMXN > 0 && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-relaxed text-amber-200" role="status">
        <strong className="font-medium">El extra no cubre todas las cuotas de promociones.</strong> <span data-sensitive>Faltan {money(plan.promoShortfallMXN)} {displayCurrency} frente a sus cuotas objetivo de este mes.</span> Los mínimos de las demás deudas permanecen reservados.
      </div>}

      <div className="mt-5 space-y-3">
        {orderedItems.length === 0 ? <div className="rounded-xl border border-[#223248] bg-[#080D14] p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-[#7DE4BF]" size={30} aria-hidden="true" /><h3 className="font-medium text-white">No tienes saldos de deuda pendientes</h3><p className="mt-2 text-sm text-slate-400">El total registrado de tus deudas es cero.</p>
        </div> : orderedItems.map(({ debt, paymentMXN, suggestedPayment, promoTargetMXN, promoShortfallMXN, monthsRemaining }) => {
          const isPromo = debt.tipo === 'PROMO_DEADLINE';
          const minimumMXN = convertCurrency(Math.min(debt.saldo, debt.pagoMinimo), debt.moneda, 'MXN', exchangeRate);
          const hasExtra = paymentMXN > minimumMXN + 0.01;
          const accent = promoShortfallMXN > 0 ? '#E9C17A' : hasExtra ? '#7DE4BF' : '#93A4BC';
          return <article key={debt.id} className="flex flex-col justify-between gap-4 rounded-xl border border-[#223248] bg-[#080D14]/65 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-xl bg-[#223248]/50 p-2.5" style={{ color: accent }}>{isPromo ? <CalendarClock size={19} aria-hidden="true" /> : hasExtra ? <ArrowUpRight size={19} aria-hidden="true" /> : <CheckCircle2 size={19} aria-hidden="true" />}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold text-white" data-sensitive>{debt.nombre}</h3><span className="rounded-md bg-[#223248]/65 px-2 py-1 text-[10px] font-medium" style={{ color: accent }}>{isPromo ? 'Promoción' : hasExtra ? 'Mínimo + extra' : 'Mínimo'}</span></div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400" data-sensitive>Saldo {formatMoney(debt.saldo, debt.moneda)} {debt.moneda} · tasa anual {debt.tasaAnual}%</p>
                {isPromo && <p className={`mt-1.5 text-xs leading-relaxed ${promoShortfallMXN > 0 ? 'text-amber-200' : 'text-slate-400'}`}>
                  {monthsRemaining === null ? 'Registra el vencimiento para calcular la cuota objetivo.' : <span data-sensitive>Cuota objetivo: {money(promoTargetMXN)} {displayCurrency} · {monthsRemaining === 0 ? 'plazo vencido' : `${monthsRemaining} meses estimados restantes`}{promoShortfallMXN > 0 ? ` · faltan ${money(promoShortfallMXN)} ${displayCurrency}` : ''}</span>}
                </p>}
              </div>
            </div>
            <div className="flex shrink-0 items-end justify-between border-t border-[#223248] pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Pago del escenario</span>
              <div data-sensitive><p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: accent }}>{formatMoney(suggestedPayment, debt.moneda)} <span className="text-xs">{debt.moneda}</span></p>{debt.moneda !== displayCurrency && <p className="mt-1 text-[11px] text-slate-500">≈ {money(paymentMXN)} {displayCurrency}</p>}</div>
            </div>
          </article>;
        })}
      </div>
      <div className="mt-5 rounded-xl border border-[#223248] bg-[#080D14] p-4 text-xs leading-relaxed text-slate-400">
        <p>La aportación extra está expresada en MXN y se convierte a la moneda de cada deuda. Ningún abono supera el saldo registrado. Este reparto usa los saldos de hoy; los próximos intereses y cargos pueden cambiar el importe exigible.</p>
        {plan.unallocatedExtraMXN > 0 && <p className="mt-2 text-[#7DE4BF]" data-sensitive>Quedan {money(plan.unallocatedExtraMXN)} {displayCurrency} de la aportación extra sin asignar porque los saldos del plan ya están cubiertos.</p>}
      </div>
    </section>
  );
}
