import React, { useState } from 'react';
import { Calculator, Sparkles, Calendar, DollarSign, Award, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { runStrategySimulation } from '../services/financeEngine';
import { formatMoney } from '../services/exchangeRate';

export default function Simulator({ deudas, exchangeRate, initialExtra = 2500 }) {
  const [extraPayment, setExtraPayment] = useState(initialExtra);

  // Simulación con el aporte extra actual
  const simWithExtra = runStrategySimulation(deudas, extraPayment, exchangeRate, 'GAIRO_CUSTOM');
  // Simulación base con $0 extra
  const simBase = runStrategySimulation(deudas, 0, exchangeRate, 'GAIRO_CUSTOM');

  const monthsSaved = Math.max(0, simBase.monthsToDebtFree - simWithExtra.monthsToDebtFree);
  const moneySaved = Math.max(0, simBase.totalInterestPaid - simWithExtra.totalInterestPaid);

  const handleCelebrate = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const presetAmounts = [0, 1000, 2500, 5000, 7500, 10000];

  return (
    <div className="space-y-6">
      
      {/* Hero Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Simulador Interactivo: "¿Qué Pasa Si Aporto Más Cada Mes?"
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                What-If Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Descubre cuántos meses de tu vida y miles de pesos te ahorras inyectando un poco más a la Estrategia Gairo.
            </p>
          </div>

          <button
            onClick={handleCelebrate}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all self-start sm:self-auto shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>¡Celebrar Mi Libertad Financiera!</span>
          </button>
        </div>

        {/* Slider & Presets */}
        <div className="mt-8 p-6 bg-slate-950/80 rounded-2xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Aportación Extraordinaria Mensual (sobre los pagos mínimos):
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              +{formatMoney(extraPayment, 'MXN')} / mes
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="15000"
            step="500"
            value={extraPayment}
            onChange={(e) => setExtraPayment(Number(e.target.value))}
            className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
            <span>$0 MXN</span>
            <span>$5,000 MXN</span>
            <span>$10,000 MXN</span>
            <span>$15,000 MXN</span>
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 self-center font-medium mr-2">Montos rápidos:</span>
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setExtraPayment(amt)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  extraPayment === amt
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                +${amt.toLocaleString('es-MX')}
              </button>
            ))}
          </div>
        </div>

        {/* Results Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Tiempo para Liquidar Todo
            </span>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {simWithExtra.monthsToDebtFree} meses
            </div>
            <span className="text-xs text-slate-400">
              ({(simWithExtra.monthsToDebtFree / 12).toFixed(1)} años de pagos)
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Fecha "Libre de Deudas"
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1 capitalize">
              {simWithExtra.debtFreeDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </div>
            <span className="text-xs text-slate-400">
              ¡Día oficial de graduación financiera!
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Tiempo Ahorrado de Tu Vida
            </span>
            <div className="text-2xl font-black text-teal-400 font-mono mt-1">
              {monthsSaved} meses antes
            </div>
            <span className="text-xs text-slate-400">
              vs no aportar nada extra
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Dinero Ahorrado en Intereses
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {formatMoney(moneySaved, 'MXN')}
            </div>
            <span className="text-xs text-slate-400">
              Capital que se queda en tu bolsillo
            </span>
          </div>

        </div>

      </div>

      {/* Payoff Timeline Table Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-white mb-2">
          Evolución Mensual del Saldo con Aporte de {formatMoney(extraPayment, 'MXN')}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Visualiza cómo va disminuyendo tu deuda total mes tras mes:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Mes</th>
                <th className="py-2.5 px-3">Saldo Total Restante</th>
                <th className="py-2.5 px-3">Estado de Liquidación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200 font-mono">
              {simWithExtra.history.slice(0, 18).map((row) => (
                <tr key={row.month} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {row.month === 0 ? 'Inicio (Hoy)' : `Mes ${row.month}`}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">
                    {formatMoney(row.totalBalance, 'MXN')}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.totalBalance <= 0 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        ¡DEUDA CERO! 🎉
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">
                        Reducción activa
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
