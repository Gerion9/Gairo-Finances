import React, { useState } from 'react';
import { Sparkles, Shield, TrendingUp, DollarSign } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';

export default function Investments({ financialData, cashFlow }) {
  const { totalCostodeVida } = cashFlow;

  // Fondo de Emergencia: Metas
  const meta3Meses = totalCostodeVida * 3;
  const meta6Meses = totalCostodeVida * 6;
  const meta12Meses = totalCostodeVida * 12;

  // Ahorro líquido actual
  const ahorroLiquido = financialData.activos
    .filter(a => a.tipo === 'Efectivo' || a.tipo === 'Inversión')
    .reduce((sum, a) => sum + (a.monto || 0), 0);

  const progreso3m = Math.min(100, Math.round((ahorroLiquido / meta3Meses) * 100));

  // Calculadora de Interés Compuesto
  const [monthlyContribution, setMonthlyContribution] = useState(5000);
  const [annualRate, setAnnualRate] = useState(9.5); // 9.5% CETES
  const [years, setYears] = useState(10);

  // Fórmulas de valor futuro
  const r = (annualRate / 100) / 12;
  const n = years * 12;
  const valorFuturo = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
  const totalAportado = monthlyContribution * n;
  const rendimiento = valorFuturo - totalAportado;

  return (
    <div className="space-y-6">
      
      {/* Fondo de Emergencia */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Fondo de Emergencia: Tu Escudo de Paz Mental
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Calculado con base en tu costo de vida mensual de {formatMoney(totalCostodeVida, 'MXN')}/mes.
        </p>

        {/* Progress Bar */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300">Cobertura Inicial (Meta 3 Meses):</span>
            <span className="font-black text-emerald-400 font-mono">{progreso3m}% completado</span>
          </div>

          <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progreso3m}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">3 Meses (Esencial)</span>
              <span className="font-bold text-white text-base font-mono block mt-0.5">
                {formatMoney(meta3Meses, 'MXN')}
              </span>
              <span className="text-[10px] text-emerald-400">Primer objetivo</span>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">6 Meses (Robusto)</span>
              <span className="font-bold text-white text-base font-mono block mt-0.5">
                {formatMoney(meta6Meses, 'MXN')}
              </span>
              <span className="text-[10px] text-slate-400">Tranquilidad total</span>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">12 Meses (Invencible)</span>
              <span className="font-bold text-white text-base font-mono block mt-0.5">
                {formatMoney(meta12Meses, 'MXN')}
              </span>
              <span className="text-[10px] text-slate-400">Libertad absoluta</span>
            </div>
          </div>
        </div>
      </div>

      {/* Proyección de Interés Compuesto */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-extrabold text-white tracking-tight">
            Calculadora de Rendimientos & Crecimiento Compuesto (CETES / Sofipos)
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Una vez liquidadas tus deudas caras, tu flujo libre mensual trabajará para ti a tasas de interés compuesto.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-slate-400 font-semibold uppercase mb-1">
              Ahorro Mensual
            </label>
            <input
              type="number"
              step="500"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold uppercase mb-1">
              Rendimiento Anual (%)
            </label>
            <input
              type="number"
              step="0.5"
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold uppercase mb-1">
              Horizonte (Años)
            </label>
            <input
              type="number"
              min="1"
              max="40"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
            />
          </div>
        </div>

        {/* Future Value Outputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-slate-950/80 rounded-2xl border border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 block">Total Aportado de Tu Dinero</span>
            <span className="text-xl font-bold text-slate-200 font-mono mt-0.5 block">
              {formatMoney(totalAportado, 'MXN')}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase text-teal-400 block">Rendimientos Ganados</span>
            <span className="text-xl font-bold text-teal-300 font-mono mt-0.5 block">
              +{formatMoney(rendimiento, 'MXN')}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase text-emerald-400 block">Valor Futuro Total</span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
              {formatMoney(valorFuturo, 'MXN')}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
