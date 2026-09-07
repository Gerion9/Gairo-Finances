import React from 'react';
import { AlertTriangle, Clock, Calendar, ChevronRight, Zap } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';

export default function PromoAlerts({ promoDeadlines, displayCurrency, exchangeRate, onGoToDebts }) {
  if (!promoDeadlines || promoDeadlines.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {promoDeadlines.map((item) => {
        const isExpired = item.daysRemaining < 0;
        const isCritical = !isExpired && item.daysRemaining <= 30;
        const isHigh = !isExpired && item.daysRemaining > 30 && item.daysRemaining <= 90;

        const borderClass = isExpired
          ? 'border-red-600/70 bg-gradient-to-r from-red-950/60 via-red-900/30 to-slate-900'
          : isCritical
          ? 'border-red-500/50 bg-gradient-to-r from-red-950/40 via-red-900/20 to-slate-900'
          : isHigh
          ? 'border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900'
          : 'border-blue-500/40 bg-gradient-to-r from-blue-950/30 via-slate-900 to-slate-900';

        const badgeClass = isExpired
          ? 'bg-red-600 text-white font-black animate-pulse'
          : isCritical
          ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
          : isHigh
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
          : 'bg-blue-500/20 text-blue-400 border border-blue-500/40';

        return (
          <div
            key={item.id}
            className={`p-4 rounded-xl border ${borderClass} shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${isExpired || isCritical ? 'bg-red-500/20 text-red-400' : isHigh ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-white text-sm sm:text-base">
                    {item.nombre}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                    {item.daysRemaining < 0
                      ? '¡PLAZO EXPIRADO!'
                      : item.daysRemaining === 0
                      ? '¡VENCE HOY!'
                      : `¡Vence en ${item.daysRemaining} días!`}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({item.institucion})
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1">
                  Saldo pendiente:{' '}
                  <span className="font-bold text-white">
                    {formatMoney(item.saldo, item.moneda)}
                  </span>
                  {' · '}
                  Si no se liquida antes del <span className="underline font-semibold">{item.promoDeadline}</span>, se cobrarán intereses al {item.tasaRegularPostPromo || 40}%.
                </p>

                <div className="flex items-center gap-2 mt-2 text-xs">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">
                    Cuota recomendada para blindarte:{' '}
                    <strong className="text-emerald-400 font-bold">
                      {formatMoney(item.cuotaSugeridaOriginal, item.moneda)} / mes
                    </strong>{' '}
                    (durante los {item.monthsRemaining} meses restantes).
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onGoToDebts}
              className="self-end sm:self-center shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            >
              <span>Ver Estrategia</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
