import React from 'react';
import { ShieldAlert, Zap, Flame, CheckCircle, ArrowRight, DollarSign } from 'lucide-react';
import { formatMoney, convertCurrency } from '../services/exchangeRate';

export default function StrategyPayoff({ 
  deudas, 
  cashFlow, 
  extraPayment, 
  exchangeRate, 
  displayCurrency 
}) {
  const today = new Date();

  // 1. Identificar Promos
  const promos = deudas.filter(d => d.tipo === 'PROMO_DEADLINE' && d.saldo > 0);
  // 2. Identificar Deudas de Alto Interés
  const highInterest = deudas
    .filter(d => d.tipo === 'HIGH_INTEREST' && d.saldo > 0)
    .sort((a, b) => b.tasaAnual - a.tasaAnual);
  // 3. Identificar Deudas de Bajo Interés ("Dejar correr")
  const lowInterest = deudas.filter(d => d.tipo === 'LOW_INTEREST_HOLD' && d.saldo > 0);

  // Calcular plan de pago para este mes
  const paymentPlan = [];

  // Paso 1: Cuotas de promociones
  promos.forEach(p => {
    let monthsLeft = 1;
    if (p.promoDeadline) {
      const diff = new Date(p.promoDeadline).getTime() - today.getTime();
      monthsLeft = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 30.4)));
    }
    const targetMonthly = Math.min(p.saldo, Math.max(p.pagoMinimo, p.saldo / monthsLeft));
    paymentPlan.push({
      debt: p,
      step: 1,
      tag: 'BLINDAJE PROMO',
      reason: `Liquidar en ${monthsLeft} meses antes del deadline`,
      suggestedPayment: targetMonthly
    });
  });

  // Paso 2: Mínimos de bajo interés
  lowInterest.forEach(l => {
    paymentPlan.push({
      debt: l,
      step: 2,
      tag: 'MÍNIMO CONTROLADO',
      reason: 'Bajo interés: solo pagar el mínimo para no desperdiciar liquidez',
      suggestedPayment: l.pagoMinimo
    });
  });

  // Paso 3: Alto interés (Mínimos + Avalancha de todo el remanente a la más cara)
  highInterest.forEach((h, index) => {
    paymentPlan.push({
      debt: h,
      step: 3,
      isPrimaryTarget: index === 0,
      tag: index === 0 ? 'OBJETIVO AVALANCHA (ATAQUE TOTAL)' : 'PAGO MÍNIMO',
      reason: index === 0 ? `Máxima prioridad: Tasa del ${h.tasaAnual}% APR` : 'Mantener al mínimo mientras se liquida la principal',
      suggestedPayment: index === 0 ? (h.pagoMinimo + extraPayment) : h.pagoMinimo
    });
  });

  const totalSugeridoMXN = paymentPlan.reduce((sum, item) => {
    const amtMXN = convertCurrency(item.suggestedPayment, item.debt.moneda, 'MXN', exchangeRate);
    return sum + amtMXN;
  }, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Estrategia Maestra de Pagos: Mes Actual
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Gairo Custom Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Distribución óptima para no perder promociones y pulverizar los intereses más altos.
          </p>
        </div>

        <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs text-slate-400 font-semibold uppercase">Total a Pagar este Mes:</span>
          <span className="text-lg font-black text-emerald-400 font-mono">
            {formatMoney(totalSugeridoMXN, 'MXN')}
          </span>
        </div>
      </div>

      {/* Steps breakdown */}
      <div className="mt-6 space-y-3">
        {paymentPlan.map((planItem, idx) => {
          const { debt, tag, reason, suggestedPayment, isPrimaryTarget } = planItem;

          return (
            <div
              key={debt.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isPrimaryTarget
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/20'
                  : debt.tipo === 'PROMO_DEADLINE'
                  ? 'bg-amber-950/10 border-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isPrimaryTarget
                    ? 'bg-rose-500/20 text-rose-400'
                    : debt.tipo === 'PROMO_DEADLINE'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {isPrimaryTarget ? (
                    <Flame className="w-5 h-5 animate-pulse" />
                  ) : debt.tipo === 'PROMO_DEADLINE' ? (
                    <Zap className="w-5 h-5" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white">
                      {debt.nombre}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isPrimaryTarget
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : debt.tipo === 'PROMO_DEADLINE'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {tag}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      (Saldo: {formatMoney(debt.saldo, debt.moneda)})
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1">
                    {reason}
                  </p>
                </div>
              </div>

              {/* Suggested payment amount */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">Abono Sugerido</span>
                  <span className={`text-lg font-black font-mono ${isPrimaryTarget ? 'text-rose-400' : (debt.tipo === 'PROMO_DEADLINE' ? 'text-amber-400' : 'text-emerald-400')}`}>
                    {formatMoney(suggestedPayment, debt.moneda)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
        <span className="text-emerald-400 font-bold">💡 Regla de Oro:</span>
        <span>
          Las deudas con deadline no perdonan retrasos. Al liquidar la MacBook / Promo a tiempo, ahorras miles en penalizaciones y liberas ese flujo para fulminar la BBVA Gold al 49%.
        </span>
      </div>

    </div>
  );
}
