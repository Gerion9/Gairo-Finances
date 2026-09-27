import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate.js';
import { debtCoverage } from '../services/planning.js';

export default function PendingDebts({ financialData, onEdit, onDelete }) {
  const { pending, totals, missingBalances, pendingAccounts } = debtCoverage(financialData);
  if (!pending.length) return null;
  return <section className="space-y-5" aria-label="Deudas con datos pendientes">
    <div className="surface-card p-6"><h2 className="text-xl font-semibold text-white">{pendingAccounts} créditos por completar</h2><p className="text-sm text-slate-400 mt-2">Los saldos aproximados se conservan en su moneda. Faltan datos para calcular pagos, intereses y fechas de liquidación.</p><div className="flex flex-wrap gap-8 mt-5">{['MXN', 'USD'].map(currency => <div key={currency}><p className="text-sm text-slate-400">Saldo conocido · {currency}</p><p className="text-2xl font-semibold text-white tabular-nums">≈ {formatMoney(totals[currency], currency)} {currency}</p></div>)}</div>{missingBalances > 0 && <p className="text-sm text-amber-200 mt-3">Además faltan saldos de {missingBalances} créditos. Estos importes no representan toda tu deuda.</p>}</div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{pending.map(debt => <article key={debt.id} className="surface-card p-5 flex flex-col gap-4">
      <div><span className="text-sm text-amber-200">Datos pendientes</span><h3 className="text-lg font-semibold text-white mt-2">{debt.nombre}</h3><p className="text-sm text-slate-400">{debt.institucion || 'Institución por confirmar'}{debt.numeroCuentas > 1 ? ` · ${debt.numeroCuentas} préstamos agrupados` : ''}</p></div>
      <p className="text-2xl font-semibold tabular-nums text-white">{debt.saldoEstimado == null ? 'Saldo por confirmar' : `≈ ${formatMoney(debt.saldoEstimado, debt.moneda)} ${debt.moneda}`}</p>
      <dl className="text-sm space-y-2 text-slate-400"><div><dt className="inline">Pago mínimo: </dt><dd className="inline text-slate-200">{debt.pagoMinimo == null ? 'Por confirmar' : `${formatMoney(debt.pagoMinimo, debt.moneda)} ${debt.moneda}`}</dd></div><div><dt className="inline">Tasa contractual: </dt><dd className="inline text-slate-200">{debt.tasaAnual == null ? 'Por confirmar' : `${debt.tasaAnual}% anual`}</dd></div><div><dt className="inline">Fecha límite: </dt><dd className="inline text-slate-200">{debt.diaPagoLimite == null ? 'Por confirmar' : `Día ${debt.diaPagoLimite}`}</dd></div></dl>
      {debt.referenciaTasa && <details className="text-sm rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-emerald-200">Tasa publicada y condiciones</summary><p className="text-slate-300 mt-3 whitespace-pre-line">{debt.referenciaTasa}</p><p className="text-slate-400 mt-2">Referencia pública; tu estado de cuenta determina la tasa aplicable.</p>{debt.fuenteTasa?.startsWith('https://') && <a className="inline-block underline text-emerald-200 mt-2" href={debt.fuenteTasa} target="_blank" rel="noreferrer">Consultar fuente oficial</a>}{debt.consultaTasa && <p className="text-slate-500 mt-2">Consulta: {debt.consultaTasa}</p>}</details>}
      {debt.notas && <p className="text-sm text-slate-400 whitespace-pre-line">{debt.notas}</p>}
      {(onEdit || onDelete) && <div className="flex gap-2 mt-auto pt-2">{onEdit && <button className="button-secondary flex-1" onClick={() => onEdit(debt)} aria-label={`Completar ${debt.nombre}`}><Pencil size={16} />Completar datos</button>}{onDelete && <button className="icon-button" onClick={() => onDelete(debt.id)} aria-label={`Quitar ${debt.nombre}`}><Trash2 size={16} /></button>}</div>}
    </article>)}</div>
  </section>;
}
