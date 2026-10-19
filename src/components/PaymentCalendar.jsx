import React, { useEffect, useRef } from 'react';
import { Calendar, CheckCircle2, Circle, Clock, DollarSign, AlertCircle, ChevronRight } from 'lucide-react';
import { undatedCommitments } from '../services/planning.js';
import { calculateFortnightlyFlow } from '../services/financeEngine';
import { formatMoney, convertCurrency } from '../services/exchangeRate';

export default function PaymentCalendar({ 
  financialData, 
  onTogglePagoMes, 
  exchangeRate, 
  displayCurrency,
  reviewContext,
}) {
  const itemRefs = useRef(new Map());
  useEffect(() => {
    const item = itemRefs.current.get(reviewContext?.itemId);
    if (item) { item.scrollIntoView({ block: 'center', behavior: 'auto' }); item.focus({ preventScroll: true }); }
  }, [reviewContext?.request]);
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // '2026-09'
  const pagosMes = financialData.pagosRealizadosMes?.[currentMonthKey] || {};

  const { quincena1, quincena2 } = calculateFortnightlyFlow(financialData, exchangeRate);

  const togglePago = (itemId) => {
    const updated = {
      ...financialData.pagosRealizadosMes,
      [currentMonthKey]: {
        ...pagosMes,
        [itemId]: pagosMes[itemId] !== true
      }
    };
    onTogglePagoMes(updated);
  };

  const renderItem = (item, isDebt = false) => {
    const isPaid = pagosMes[item.id] === true;
    const dia = isDebt ? (item.diaPagoLimite || 15) : (item.diaPago || 15);
    const montoMXN = isDebt 
      ? convertCurrency(item.pagoMinimo, item.moneda, 'MXN', exchangeRate)
      : item.monto;

    return (
      <div
        key={item.id}
        ref={node => { if (node) itemRefs.current.set(item.id, node); else itemRefs.current.delete(item.id); }}
        tabIndex={-1}
        aria-label={`${item.nombre}, compromiso del mes`}
        className={`p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 outline-none focus:ring-2 focus:ring-emerald-300 ${
          isPaid
            ? 'bg-slate-950/40 border-slate-800 opacity-60'
            : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 shadow-md'
        }`}
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => togglePago(item.id)} aria-pressed={isPaid} aria-label={`${isPaid ? 'Quitar marca de pagado de' : 'Marcar como pagado'} ${item.nombre}`} className={`min-h-11 min-w-11 flex items-center justify-center rounded-full ${isPaid ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}>
            {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${isPaid ? 'line-through text-slate-400' : 'text-white'}`}>
                {item.nombre}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isDebt ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-300'
              }`}>
                {isDebt ? 'Crédito / Deuda' : item.categoria}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Vence el día {dia} de este mes {item.promoDeadline ? `· Promo vence: ${item.promoDeadline}` : ''}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className={`text-sm font-extrabold font-mono block ${isPaid ? 'line-through text-slate-500' : 'text-white'}`}>
            {formatMoney(montoMXN, 'MXN')}
          </span>
          <span className={`text-[10px] font-semibold ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isPaid ? 'Pagado' : 'Pendiente'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {undatedCommitments(financialData).length > 0 && <section className="surface-card p-6"><h2 className="text-xl text-white font-semibold">Pagos con fecha pendiente</h2><p className="text-sm text-slate-400 mt-2">Ya están en tu presupuesto mensual. Confirma la fecha para asignarlos a una quincena.</p><ul className="mt-4 space-y-3">{undatedCommitments(financialData).map(row => <li key={row.id} className="flex justify-between gap-4 text-sm text-slate-200"><span>{row.nombre}</span><span>≈ {formatMoney(row.monto)} MXN · Fecha pendiente</span></li>)}</ul></section>}
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Fechas de tus pagos
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Calendario manual del mes. Marcar un compromiso no realiza un pago ni cambia el saldo de tu deuda. Importes de referencia en MXN.
            </p>
          </div>

          <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Mes en curso: <strong className="text-white capitalize">{new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</strong></span>
          </div>
        </div>

        {/* Quincenas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Quincena 1 */}
          <div className="space-y-3">
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-emerald-400 block tracking-wider">
                  1ra Quincena (Días 1 al 15)
                </span>
                <span className="text-[11px] text-slate-400">Gastos fijos y créditos iniciales</span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-white font-mono block">
                  {formatMoney(quincena1.totalSalidas, 'MXN')}
                </span>
                <span className="text-xs text-slate-400">Compromisos configurados</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 pt-1">Gastos de Vida:</h4>
              {quincena1.gastos.map(g => renderItem(g, false))}

              <h4 className="text-[11px] font-bold uppercase text-slate-400 pt-2">Deudas y Créditos:</h4>
              {quincena1.deudas.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-2">No hay pagos de deudas en esta quincena.</p>
              ) : (
                quincena1.deudas.map(d => renderItem(d, true))
              )}
            </div>
          </div>

          {/* Quincena 2 */}
          <div className="space-y-3">
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-teal-400 block tracking-wider">
                  2da Quincena (Días 16 al Fin de Mes)
                </span>
                <span className="text-[11px] text-slate-400">Tarjetas principales y servicios</span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-white font-mono block">
                  {formatMoney(quincena2.totalSalidas, 'MXN')}
                </span>
                <span className="text-xs text-slate-400">Compromisos configurados</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 pt-1">Gastos de Vida:</h4>
              {quincena2.gastos.map(g => renderItem(g, false))}

              <h4 className="text-[11px] font-bold uppercase text-slate-400 pt-2">Deudas y Créditos:</h4>
              {quincena2.deudas.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-2">No hay pagos de deudas en esta quincena.</p>
              ) : (
                quincena2.deudas.map(d => renderItem(d, true))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
