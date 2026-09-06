import React, { useState } from 'react';
import { 
  CreditCard, 
  Flame, 
  Clock, 
  Shield, 
  Edit3, 
  Trash2, 
  PlusCircle, 
  DollarSign, 
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { formatMoney, convertCurrency } from '../services/exchangeRate';

export default function DebtCard({ 
  debt, 
  exchangeRate, 
  displayCurrency, 
  onEdit, 
  onDelete, 
  onPayment 
}) {
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const saldoOriginal = Number(debt.saldo) || 0;
  const saldoMXN = convertCurrency(saldoOriginal, debt.moneda, 'MXN', exchangeRate);
  const saldoUSD = convertCurrency(saldoOriginal, debt.moneda, 'USD', exchangeRate);

  // Valor a mostrar según displayCurrency
  const displayAmount = displayCurrency === 'USD' 
    ? formatMoney(saldoUSD, 'USD') 
    : (displayCurrency === 'MXN' ? formatMoney(saldoMXN, 'MXN') : formatMoney(saldoOriginal, debt.moneda));

  const isPromo = debt.tipo === 'PROMO_DEADLINE';
  const isHigh = debt.tipo === 'HIGH_INTEREST';
  const isLow = debt.tipo === 'LOW_INTEREST_HOLD';

  const handleMakePayment = (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!isNaN(amt) && amt > 0) {
      onPayment(debt.id, amt);
      setPaymentAmount('');
      setShowPaymentInput(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between relative overflow-hidden">
      
      {/* Top Tag & Indicator */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              isPromo
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : isHigh
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}>
              {isPromo && <Clock className="w-3.5 h-3.5" />}
              {isHigh && <Flame className="w-3.5 h-3.5" />}
              {isLow && <Shield className="w-3.5 h-3.5" />}
              <span>
                {isPromo ? 'Promo con Deadline (0%)' : isHigh ? 'Alto Interés (Avalancha)' : 'Bajo Interés (Dejar correr)'}
              </span>
            </span>

            <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase font-mono ${
              debt.moneda === 'USD' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {debt.moneda}
            </span>
          </div>

          {/* Edit / Delete actions */}
          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => onEdit(debt)}
              className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
              title="Editar deuda"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(debt.id)}
              className="p-1.5 rounded-lg hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Eliminar deuda"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Debt Name & Bank */}
        <h3 className="text-lg font-extrabold text-white tracking-tight">
          {debt.nombre}
        </h3>
        <p className="text-xs text-slate-400 font-medium">
          {debt.institucion || 'Institución financiera'}
        </p>

        {/* Saldo Principal */}
        <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Saldo Actual
          </span>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-2xl font-black text-white">
              {displayAmount}
            </span>
            {displayCurrency !== 'ORIGINAL' && debt.moneda !== displayCurrency && (
              <span className="text-xs text-slate-400 font-mono">
                Orig: {formatMoney(saldoOriginal, debt.moneda)}
              </span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="bg-slate-800/40 p-2.5 rounded-lg">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Tasa Anual</span>
            <span className={`font-bold text-sm ${debt.tasaAnual > 30 ? 'text-rose-400' : (debt.tasaAnual === 0 ? 'text-emerald-400' : 'text-slate-200')}`}>
              {debt.tasaAnual}% APR
            </span>
          </div>

          <div className="bg-slate-800/40 p-2.5 rounded-lg">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Pago Mínimo</span>
            <span className="font-bold text-sm text-slate-200">
              {formatMoney(debt.pagoMinimo, debt.moneda)}
            </span>
          </div>
        </div>

        {/* Deadline Info if applicable */}
        {isPromo && debt.promoDeadline && (
          <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 shrink-0 text-amber-400" />
            <div>
              <span className="font-semibold">Fecha Límite:</span> {debt.promoDeadline}
            </div>
          </div>
        )}

        {/* Notes */}
        {debt.notas && (
          <p className="mt-3 text-[11px] text-slate-400 italic line-clamp-2">
            "{debt.notas}"
          </p>
        )}
      </div>

      {/* Payment Action Bar */}
      <div className="mt-5 pt-3 border-t border-slate-800">
        {!showPaymentInput ? (
          <button
            onClick={() => setShowPaymentInput(true)}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Registrar Abono / Pago</span>
          </button>
        ) : (
          <form onSubmit={handleMakePayment} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                required
                placeholder={`Monto en ${debt.moneda}`}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0"
              >
                Abonar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentInput(false)}
              className="text-[11px] text-slate-400 hover:text-white underline w-full text-center"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
