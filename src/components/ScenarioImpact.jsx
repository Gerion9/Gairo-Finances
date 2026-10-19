import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { summarizeScenarioImpact } from '../services/scenarioImpact.js';
import './ScenarioImpact.css';

const cash = (value, currency) => new Intl.NumberFormat('es-MX', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(value) + ' ' + currency;
const dateLabel = date => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const pointLabel = point => dateLabel(point.date) + (point.phase === 'opening' ? ' · antes de los movimientos' : ' · al cierre del día');

export default function ScenarioImpact({ result, currency, accountId = '', onInspect, summary }) {
  const reducedMotion = useReducedMotion();
  const impact = useMemo(() => summary || summarizeScenarioImpact(result, { currency, accountId }), [summary, result, currency, accountId]);
  if (!impact.available) return <p className="scenario-impact-unavailable">Faltan datos para comparar este periodo y esta cuenta.</p>;
  const { scope, minimum, final, firstShortfall, maskedShortfall } = impact;
  const inspect = (point, targetAccount = scope.accountId) => onInspect?.({ date: point.date, phase: point.phase || 'closing', currency: scope.currency, ...(targetAccount ? { accountId: targetAccount } : {}) });
  const debts = Object.entries(impact.newDebt).filter(([, amount]) => amount > 0);
  const reason = impact.unchanged ? 'Mismos saldos que la referencia en esta vista.'
    : final.delta > 0 && firstShortfall ? 'El cierre mejora, pero antes hay un faltante que revisar.'
      : final.delta > 0 && minimum.value < minimum.reference.value ? 'Cierras con más dinero, pero tu punto más bajo es menor.'
        : final.delta === 0 ? 'El cierre no cambia; la distribución o los saldos intermedios sí.'
          : 'Compara el punto más bajo con el saldo al cierre.';
  const maskedIsFirst = maskedShortfall && firstShortfall?.date === maskedShortfall.date && firstShortfall?.accountId === maskedShortfall.accountId;
  return <section className="scenario-impact" aria-label="Impacto del escenario">
    <div className="scenario-impact-heading"><div><span>LECTURA DEL PERIODO</span><h3>{scope.name} · {scope.currency}</h3><p>{dateLabel(impact.from)} — {dateLabel(impact.to)}</p></div>{impact.partial && <span className="scenario-impact-partial"><AlertTriangle size={13} />Proyección parcial</span>}</div>
    <span className="sr-only" aria-live="polite" aria-atomic="true">Resumen de {scope.name} en {scope.currency}, del {dateLabel(impact.from)} al {dateLabel(impact.to)}.</span>
    <motion.div className="scenario-impact-metrics" key={scope.currency + scope.accountId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : .15 }}>
      <div className={minimum.value < 0 ? 'is-warning' : ''}><span>Saldo más bajo</span><strong className="sensitive-value">{cash(minimum.value, scope.currency)}</strong><small>{pointLabel(minimum)}</small><small>Referencia: <span className="sensitive-value">{cash(minimum.reference.value, scope.currency)}</span> · {pointLabel(minimum.reference)}</small><button onClick={() => inspect(minimum)}>Explorar ese día <ArrowRight size={13} /></button></div>
      <div><span>Saldo al cierre</span><strong className="sensitive-value">{cash(final.value, scope.currency)}</strong><small>{dateLabel(final.date)}</small><small className="sensitive-value">{final.delta === 0 ? 'Sin diferencia al cierre' : (final.delta > 0 ? '+' : '−') + cash(Math.abs(final.delta), scope.currency) + ' vs. referencia'}</small><button onClick={() => inspect(final)}>Ver el cierre <ArrowRight size={13} /></button></div>
      <div className={firstShortfall ? 'is-warning' : ''}><span>Primer faltante</span>{firstShortfall ? <><strong>{dateLabel(firstShortfall.date)}</strong><small>{firstShortfall.accountName || 'Total disponible'}{firstShortfall.phase === 'opening' ? ' · antes de los movimientos' : ' · al cierre del día'}</small><small>Saldo ese día: <span className="sensitive-value">{cash(firstShortfall.value, scope.currency)}</span></small><button onClick={() => inspect(firstShortfall, firstShortfall.accountId)}>Revisar {firstShortfall.accountId ? 'cuenta y fecha' : 'fecha'} <ArrowRight size={13} /></button></> : <><strong className="scenario-impact-clear">No detectado</strong><small>Sin faltantes detectados con estos supuestos.</small></>}</div>
    </motion.div>
    <p className="scenario-impact-reason">{reason}</p>
    {maskedShortfall && <div className="scenario-impact-warning"><AlertTriangle size={15} /><p>El total en {scope.currency} no es negativo, pero <strong>{maskedShortfall.accountName}</strong> sí queda en <span className="sensitive-value">{cash(maskedShortfall.value, scope.currency)}</span> el {pointLabel(maskedShortfall)}. El dinero de otra cuenta no cubre ese origen automáticamente.{!maskedIsFirst && <button onClick={() => inspect(maskedShortfall, maskedShortfall.accountId)}>Revisar esa cuenta <ArrowRight size={13} /></button>}</p></div>}
    {debts.length > 0 && <p className="scenario-impact-debt">El escenario incorpora deuda nueva: {debts.map(([code, amount], index) => <React.Fragment key={code}>{index > 0 && ' · '}<strong className="sensitive-value">{cash(amount, code)}</strong></React.Fragment>)}. Incluye las comisiones financiadas; no es el saldo de deuda al cierre.</p>}
    {impact.partial && <p className="scenario-impact-footnote">Revisa «Condiciones y datos pendientes». Esta comparación depende de datos y supuestos por confirmar.</p>}
  </section>;
}
