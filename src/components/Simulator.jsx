import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { compareStrategyOutcomes, runStrategySimulation } from '../services/financeEngine';
import { convertCurrency, formatMoney } from '../services/exchangeRate';

export default function Simulator({ deudas, exchangeRate = 19.25, initialExtra = 2500, displayCurrency = 'MXN', cashFlow }) {
  const [extraPayment, setExtraPayment] = useState(initialExtra);
  const [horizon, setHorizon] = useState('all');
  useEffect(() => setExtraPayment(initialExtra), [initialExtra]);
  const simWithExtra = useMemo(() => runStrategySimulation(deudas, extraPayment, exchangeRate, 'GAIRO_CUSTOM'), [deudas, extraPayment, exchangeRate]);
  const simBase = useMemo(() => runStrategySimulation(deudas, 0, exchangeRate, 'GAIRO_CUSTOM'), [deudas, exchangeRate]);
  const savings = compareStrategyOutcomes(simWithExtra, simBase);
  const money = value => formatMoney(convertCurrency(value, 'MXN', displayCurrency, exchangeRate), displayCurrency);
  const maximumMonth = Math.max(simWithExtra.simulatedMonths, simBase.simulatedMonths);
  const horizonMonth = horizon === 'all' ? maximumMonth : Math.min(Number(horizon), maximumMonth);
  const balanceAt = (result, month) => {
    const balance = result.history[month]?.totalBalance ?? (result.paidOff ? 0 : null);
    return balance === null ? null : convertCurrency(balance, 'MXN', displayCurrency, exchangeRate);
  };
  const chartData = Array.from({ length: horizonMonth + 1 }, (_, month) => ({
    month,
    extra: balanceAt(simWithExtra, month),
    base: balanceAt(simBase, month)
  }));
  const chartMaximum = Math.max(1, ...simWithExtra.history.map(row => convertCurrency(row.totalBalance, 'MXN', displayCurrency, exchangeRate)), ...simBase.history.map(row => convertCurrency(row.totalBalance, 'MXN', displayCurrency, exchangeRate)));
  const knownFlow = Number.isFinite(cashFlow?.flujoLibreReal);
  const exceedsFlow = knownFlow && extraPayment > Math.max(0, cashFlow.flujoLibreReal);
  const sliderMaximum = Math.max(15000, Math.ceil(extraPayment / 1000) * 1000);
  const warnings = [...new Set([...simWithExtra.warnings, ...simBase.warnings])];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#223248] bg-[#111B29] p-4 sm:p-6" aria-labelledby="simulator-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7DE4BF]"><SlidersHorizontal size={15} aria-hidden="true" />Explora tus posibilidades</p>
            <h1 id="simulator-title" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">¿Qué cambia si aportas másí</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Ajusta tu aportación mensual y compara el resultado con el mismo plan sin extra. El escenario no modifica tus datos guardados.</p>
          </div>
          <button type="button" onClick={() => setExtraPayment(initialExtra)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#223248] px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-[#223248] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DE4BF]"><RotateCcw size={14} aria-hidden="true" />Restablecer aporte</button>
        </div>

        <div className="mt-6 rounded-2xl border border-[#223248] bg-[#080D14] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><label htmlFor="simulator-extra-input" className="text-sm font-medium text-slate-300">Extra mensual sobre los mínimos</label><p className="mt-1 text-xs text-slate-500">El aporte se captura en MXN, incluso con deudas en USD.</p></div>
            <div className="flex items-center gap-2 rounded-xl border border-[#223248] bg-[#111B29] px-3 focus-within:border-[#7DE4BF]" data-sensitive><span className="text-sm text-slate-400">$</span><input id="simulator-extra-input" type="number" inputMode="decimal" min="0" step="0.01" value={extraPayment} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0) setExtraPayment(value); }} className="min-h-12 w-32 bg-transparent text-right text-xl font-semibold tabular-nums text-[#7DE4BF] outline-none" /><span className="text-xs text-slate-400">MXN</span></div>
          </div>
          <label htmlFor="simulator-extra-range" className="sr-only">Ajustar extra mensual en MXN</label>
          <input id="simulator-extra-range" type="range" min="0" max={sliderMaximum} step="100" value={extraPayment} aria-valuetext={`${formatMoney(extraPayment, 'MXN')} MXN por mes`} onChange={event => setExtraPayment(Number(event.target.value))} className="mt-5 h-10 w-full cursor-pointer accent-[#7DE4BF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DE4BF]" data-sensitive />
          <div className="flex justify-between text-[11px] tabular-nums text-slate-500"><span>$0 MXN</span><span>{formatMoney(sliderMaximum, 'MXN')} MXN</span></div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Aportaciones rápidas en MXN">{[0, 1000, 2500, 5000, 10000].map(amount => <button type="button" key={amount} aria-pressed={extraPayment === amount} onClick={() => setExtraPayment(amount)} className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DE4BF] ${extraPayment === amount ? 'border-[#7DE4BF]/40 bg-[#7DE4BF]/10 text-[#7DE4BF]' : 'border-[#223248] text-slate-400 hover:bg-[#223248]'}`}>{amount === 0 ? 'Sin extra' : `+$${amount.toLocaleString('es-MX')}`}</button>)}</div>
          {knownFlow && <p className={`mt-4 text-xs leading-relaxed ${exceedsFlow || cashFlow.flujoLibreReal < 0 ? 'text-amber-200' : 'text-slate-400'}`} data-sensitive>Flujo libre registrado: {money(cashFlow.flujoLibreReal)} {displayCurrency} al mes.{exceedsFlow ? ' Este escenario supera tu flujo libre y requiere financiar la diferencia antes de aplicarlo.' : cashFlow.flujoLibreReal < 0 ? ' Tu presupuesto no cubre los mínimos actuales; revisa el flujo antes de usar este plan.' : ' El aporte cabe en el flujo libre registrado.'}</p>}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite" aria-atomic="true">
          <div className="rounded-xl border border-[#7DE4BF]/25 bg-[#7DE4BF]/5 p-4"><p className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays size={14} aria-hidden="true" />Liquidación estimada</p><p className="mt-3 text-xl font-semibold text-[#7DE4BF]" data-sensitive>{simWithExtra.paidOff ? simWithExtra.debtFreeDate.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'Fuera del horizonte'}</p><p className="mt-2 text-xs text-slate-400" data-sensitive>{simWithExtra.paidOff ? `${simWithExtra.monthsToDebtFree} meses de pagos en el modelo` : `Quedan ${money(simWithExtra.remainingBalance)} ${displayCurrency} al mes ${simWithExtra.simulatedMonths}`}</p></div>
          <div className="rounded-xl border border-[#223248] bg-[#080D14] p-4"><p className="text-xs text-slate-400">Intereses del escenario</p><p className="mt-3 text-xl font-semibold tabular-nums text-white" data-sensitive>{money(simWithExtra.totalInterestPaid)}</p><p className="mt-2 text-xs text-slate-500">{displayCurrency} · acumulados a {simWithExtra.simulatedMonths} meses</p></div>
          <div className="rounded-xl border border-[#223248] bg-[#080D14] p-4"><p className="text-xs text-slate-400">Diferencia de tiempo</p><p className="mt-3 text-xl font-semibold tabular-nums text-white" data-sensitive>{savings.comparable ? `${Math.abs(savings.monthsSaved)} meses` : 'Sin comparación total'}</p><p className="mt-2 text-xs text-slate-500">{savings.comparable ? `${savings.monthsSaved >= 0 ? 'Antes' : 'Después'} que el mismo plan sin extra` : 'El escenario base conserva saldo'}</p></div>
          <div className="rounded-xl border border-[#223248] bg-[#080D14] p-4"><p className="text-xs text-slate-400">Diferencia de intereses</p><p className="mt-3 text-xl font-semibold tabular-nums text-white" data-sensitive>{savings.comparable ? money(Math.abs(savings.moneySaved)) : 'Sin comparación total'}</p><p className="mt-2 text-xs text-slate-500">{savings.comparable ? `${displayCurrency} ${savings.moneySaved >= 0 ? 'menos' : 'más'} que el mismo plan sin extra` : 'Requiere liquidación en ambos escenarios'}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#223248] bg-[#111B29] p-4 sm:p-6" aria-labelledby="simulator-curve-title">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 id="simulator-curve-title" className="text-lg font-semibold text-white">Así cambia el saldo mes a mes</h3><p className="mt-1 text-sm text-slate-400">Comparación en {displayCurrency} · mismo plan de prioridades</p></div><div className="flex gap-1 rounded-xl border border-[#223248] bg-[#080D14] p-1" role="group" aria-label="Horizonte del escenario">{[['12', '12 meses'], ['24', '24 meses'], ['all', 'Completo']].map(([value, label]) => <button key={value} type="button" aria-pressed={horizon === value} onClick={() => setHorizon(value)} className={`min-h-10 rounded-lg px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7DE4BF] ${horizon === value ? 'bg-[#223248] text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>)}</div></div>
        <div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-300"><span className="flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-[#7DE4BF]" />Con tu aporte</span><span className="flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed border-[#7CB6F3]" />Sin extra</span></div>
        <div className="mt-5 h-72 w-full" data-sensitive role="img" aria-label={`Saldo proyectado en ${displayCurrency} con tu aporte y sin extra. Consulta los valores en la tabla mensual.`}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }} accessibilityLayer>
            <CartesianGrid stroke="#223248" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" type="number" domain={[0, Math.max(1, horizonMonth)]} allowDecimals={false} tickFormatter={value => `Mes ${value}`} stroke="#93A4BC" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} minTickGap={25} /><YAxis domain={[0, Math.ceil(chartMaximum * 1.05)]} width={65} stroke="#93A4BC" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} /><Tooltip contentStyle={{ backgroundColor: '#080D14', border: '1px solid #223248', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#EAF1FA' }} labelFormatter={value => `Mes ${value}`} formatter={(value, name) => [`${formatMoney(value, displayCurrency)} ${displayCurrency}`, name]} /><Line type="linear" dataKey="extra" name="Con tu aporte" stroke="#7DE4BF" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} /><Line type="linear" dataKey="base" name="Sin extra" stroke="#7CB6F3" strokeWidth={2} strokeDasharray="7 4" dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </div>
        <details className="mt-5 border-t border-[#223248] pt-4"><summary className="min-h-10 cursor-pointer text-sm font-medium text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7DE4BF]">Ver todos los pagos mensuales del escenario</summary><div className="max-h-80 overflow-auto rounded-xl border border-[#223248]" tabIndex={0} role="region" aria-label="Pagos mensuales del escenario" data-sensitive><table className="w-full min-w-[620px] text-left text-xs tabular-nums"><caption className="sr-only">Proyección mensual con aportación extra. Todos los importes están en {displayCurrency}.</caption><thead className="sticky top-0 bg-[#080D14] text-slate-400"><tr><th scope="col" className="p-3">Mes</th><th scope="col" className="p-3 text-right">Pago</th><th scope="col" className="p-3 text-right">Saldo</th><th scope="col" className="p-3 text-right">Interés acumulado</th><th scope="col" className="p-3">Cambio del saldo</th></tr></thead><tbody className="divide-y divide-[#223248] text-slate-300">{simWithExtra.history.map((row, index) => <tr key={row.month} className="hover:bg-[#223248]/40"><th scope="row" className="p-3 font-medium">{row.month === 0 ? 'Hoy' : row.month}</th><td className="p-3 text-right">{money(row.payment)}</td><td className="p-3 text-right text-[#7DE4BF]">{money(row.totalBalance)}</td><td className="p-3 text-right">{money(row.totalInterest)}</td><td className="p-3">{row.totalBalance === 0 ? 'Liquidado' : index === 0 ? 'Saldo inicial' : row.totalBalance < simWithExtra.history[index - 1].totalBalance ? 'Disminuye' : row.totalBalance > simWithExtra.history[index - 1].totalBalance ? 'Aumenta' : 'Sin cambio'}</td></tr>)}</tbody></table></div></details>
      </section>
      <div className="rounded-xl border border-[#223248] bg-[#080D14] p-4 text-xs leading-relaxed text-slate-400"><p className="flex items-center gap-2 font-medium text-slate-300"><ArrowRight size={14} aria-hidden="true" />Una proyección con supuestos visibles</p><p className="mt-2">Pagos al cierre mensual, tipo de cambio constante y tasas registradas fijas; la tasa posterior a promoción se aplica prospectivamente al terminar su plazo mensual aproximado. Sin compras nuevas, comisiones, anualidades ni intereses retroactivos. El mínimo de una deuda liquidada se libera y no se suma al extra. Se supone que los mínimos están financiados. Límite: 120 meses; las fechas estimadas no garantizan una liquidación.</p>{warnings.length > 0 && <ul className="mt-3 space-y-1 border-t border-[#223248] pt-3 text-amber-200">{warnings.map(warning => <li key={warning}>• {warning}</li>)}</ul>}</div>
    </div>
  );
}
