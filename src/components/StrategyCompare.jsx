import React, { useState } from 'react';
import { ArrowDownRight, ChartNoAxesCombined, Info } from 'lucide-react';
import { convertCurrency, formatMoney } from '../services/exchangeRate';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const STRATEGIES = [
  { key: 'gairoCustom', title: 'Plan Sifran', tag: 'Promociones + tasa', color: '#7DE4BF', dash: '', description: 'Reserva los mínimos, destina el extra a cuotas de promociones y luego prioriza las deudas de tasa alta.' },
  { key: 'avalanche', title: 'Avalancha', tag: 'Mayor tasa primero', color: '#7CB6F3', dash: '8 4', description: 'Aplica el extra a la deuda con la mayor tasa vigente en cada mes.' },
  { key: 'snowball', title: 'Bola de nieve', tag: 'Menor saldo primero', color: '#B8AFF8', dash: '3 4', description: 'Aplica el extra a la deuda de menor saldo para cerrar cuentas antes.' },
  { key: 'minimums', title: 'Solo mínimos', tag: 'Sin aportación extra', color: '#F49AA6', dash: '10 3 2 3', description: 'Mantiene el mínimo registrado de cada deuda activa, sin aportaciones adicionales.' }
];

export default function StrategyCompare({ comparison, exchangeRate = 19.25, displayCurrency = 'MXN' }) {
  const [horizon, setHorizon] = useState('all');
  const [visible, setVisible] = useState(STRATEGIES.map(item => item.key));
  if (!comparison) return null;

  const money = value => formatMoney(convertCurrency(value, 'MXN', displayCurrency, exchangeRate), displayCurrency);
  const { savingsVsMinimums } = comparison;
  const maxMonth = Math.max(...STRATEGIES.map(({ key }) => comparison[key].simulatedMonths));
  const fullData = Array.from({ length: maxMonth + 1 }, (_, month) => {
    const row = { month };
    STRATEGIES.forEach(({ key }) => {
      const result = comparison[key];
      const balance = result.history[month]?.totalBalance ?? (result.paidOff ? 0 : null);
      row[key] = balance === null ? null : convertCurrency(balance, 'MXN', displayCurrency, exchangeRate);
    });
    return row;
  });
  const horizonMonth = horizon === 'all' ? maxMonth : Math.min(Number(horizon), maxMonth);
  const chartData = fullData.filter(row => row.month <= horizonMonth);
  const maxBalance = Math.max(1, ...fullData.flatMap(row => STRATEGIES.map(({ key }) => row[key] ?? 0)));
  const warnings = [...new Set(STRATEGIES.flatMap(({ key }) => comparison[key].warnings || []))];
  const toggleSeries = key => setVisible(current => current.includes(key)
    ? current.length > 1 ? current.filter(item => item !== key) : current
    : [...current, key]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#7DE4BF]/25 bg-[#111B29] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#7DE4BF]/10 p-2.5 text-[#7DE4BF]"><ArrowDownRight size={22} aria-hidden="true" /></div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7DE4BF]">Plan Sifran frente a solo mínimos</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {savingsVsMinimums.comparable ? <span data-sensitive>
                {money(Math.abs(savingsVsMinimums.moneySaved))} {savingsVsMinimums.moneySaved >= 0 ? 'menos' : 'más'} en intereses estimados
              </span> : 'El horizonte todavía deja saldo pendiente'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {savingsVsMinimums.comparable
                ? <span data-sensitive>{Math.abs(savingsVsMinimums.monthsSaved)} meses {savingsVsMinimums.monthsSaved >= 0 ? 'antes' : 'después'}, bajo los mismos supuestos. La diferencia incluye la aportación extra del plan Sifran.</span>
                : savingsVsMinimums.reason}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#223248] bg-[#111B29] p-4 sm:p-6" aria-labelledby="strategy-chart-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 id="strategy-chart-title" className="flex items-center gap-2 text-lg font-semibold text-white"><ChartNoAxesCombined size={19} className="text-[#7DE4BF]" aria-hidden="true" />Cuatro rutas para tu deuda</h3>
            <p className="mt-1 text-sm text-slate-400">Saldo proyectado por mes · {displayCurrency} · hasta {maxMonth} meses</p>
          </div>
          <div className="flex rounded-xl border border-[#223248] bg-[#080D14] p-1" role="group" aria-label="Horizonte de la gráfica">
            {[['12', '12 meses'], ['24', '24 meses'], ['all', 'Completo']].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={horizon === value} onClick={() => setHorizon(value)} className={`min-h-10 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DE4BF] ${horizon === value ? 'bg-[#223248] text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Estrategias visibles">
          {STRATEGIES.map(item => (
            <button type="button" key={item.key} aria-pressed={visible.includes(item.key)} onClick={() => toggleSeries(item.key)} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DE4BF] ${visible.includes(item.key) ? 'border-[#223248] bg-[#080D14] text-white' : 'border-transparent text-slate-500'}`}>
              <svg width="22" height="12" aria-hidden="true"><line x1="0" y1="6" x2="22" y2="6" stroke={item.color} strokeWidth="2" strokeDasharray={item.dash} /></svg>{item.title}
            </button>
          ))}
        </div>
        <div className="mt-6 h-80 w-full" data-sensitive role="img" aria-label={`Gráfica de saldo por estrategia en ${displayCurrency}. La tabla debajo contiene los valores mensuales.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 18, left: 4, bottom: 8 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 5" stroke="#223248" vertical={false} />
              <XAxis dataKey="month" type="number" domain={[0, Math.max(1, horizonMonth)]} allowDecimals={false} stroke="#93A4BC" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={25} tickFormatter={value => `Mes ${value}`} />
              <YAxis domain={[0, Math.ceil(maxBalance * 1.05)]} stroke="#93A4BC" tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
              <Tooltip contentStyle={{ backgroundColor: '#080D14', border: '1px solid #223248', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#EAF1FA' }} labelFormatter={value => `Mes ${value}`} formatter={(value, name) => [`${formatMoney(value, displayCurrency)} ${displayCurrency}`, name]} />
              {STRATEGIES.map(item => <Line key={item.key} type="linear" dataKey={item.key} name={item.title} stroke={item.color} strokeDasharray={item.dash} strokeWidth={item.key === 'gairoCustom' ? 3 : 2} dot={false} activeDot={{ r: 4 }} connectNulls={false} hide={!visible.includes(item.key)} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Escala fija al alternar estrategias. Un saldo se prolonga en cero solo después de liquidarse dentro del modelo.</p>
        <details className="mt-5 border-t border-[#223248] pt-4">
          <summary className="min-h-10 cursor-pointer text-sm font-medium text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7DE4BF]">Ver tabla mensual completa</summary>
          <div className="max-h-80 overflow-auto rounded-xl border border-[#223248]" data-sensitive tabIndex={0} role="region" aria-label="Tabla de comparación mensual">
            <table className="w-full min-w-[620px] text-left text-xs tabular-nums">
              <caption className="sr-only">Saldo mensual en {displayCurrency}; todos los horizontes y estrategias.</caption>
              <thead className="sticky top-0 bg-[#080D14] text-slate-400"><tr><th scope="col" className="p-3">Mes</th>{STRATEGIES.map(item => <th scope="col" className="p-3 text-right" key={item.key}>{item.title}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#223248]">{fullData.map(row => <tr key={row.month} className="text-slate-300 hover:bg-[#223248]/40"><th scope="row" className="p-3 font-medium">{row.month}</th>{STRATEGIES.map(item => <td className="p-3 text-right" key={item.key}>{row[item.key] === null ? 'Sin proyección' : formatMoney(row[item.key], displayCurrency)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STRATEGIES.map(item => {
          const result = comparison[item.key];
          return <article key={item.key} className="flex flex-col rounded-2xl border border-[#223248] bg-[#111B29] p-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: item.color }}>{item.tag}</span>
            <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
            <dl className="mt-5 space-y-3 border-t border-[#223248] pt-4 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Liquidación estimada</dt><dd className="text-right font-medium text-white" data-sensitive>{result.paidOff ? `${result.monthsToDebtFree} meses` : `No alcanza en ${result.simulatedMonths} meses`}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Intereses a {result.simulatedMonths} meses</dt><dd className="text-right font-medium tabular-nums" style={{ color: item.color }} data-sensitive>{money(result.totalInterestPaid)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">{result.paidOff ? 'Mes estimado' : 'Saldo pendiente'}</dt><dd className="text-right text-slate-300" data-sensitive>{result.paidOff ? result.debtFreeDate.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : money(result.remainingBalance)}</dd></div>
            </dl>
          </article>;
        })}
      </div>

      <div className="rounded-xl border border-[#223248] bg-[#080D14] p-4 text-xs leading-relaxed text-slate-400">
        <p className="flex items-center gap-2 font-medium text-slate-300"><Info size={15} aria-hidden="true" />Supuestos de la proyección</p>
        <p className="mt-2">Pagos al cierre de cada mes; tasas y tipo de cambio constantes, salvo la tasa posterior a promoción registrada, aplicada al terminar su plazo mensual aproximado. Sin nuevas compras, comisiones, anualidades ni intereses retroactivos. Los mínimos se suponen financiados y permanecen fijos por deuda activa; al liquidarla, su mínimo se libera y no se reinvierte. La aportación extra permanece constante. Las fechas son estimaciones.</p>
        {warnings.length > 0 && <ul className="mt-3 space-y-1 border-t border-[#223248] pt-3 text-amber-200">{warnings.map(warning => <li key={warning}>• {warning}</li>)}</ul>}
      </div>
    </div>
  );
}
