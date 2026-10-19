import React from 'react';
import { Activity, Flame, ShieldAlert, Award, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { calculateFinancialHealthScore } from '../services/financeEngine';
import { formatMoney } from '../services/exchangeRate';

export default function FinancialHealthScore({ financialData, exchangeRate, onNavigateTab }) {
  const diagnostic = calculateFinancialHealthScore(financialData, exchangeRate);
  const { score, status, color, dtiRatio, mesesRunway, bleed, recomendaciones } = diagnostic;

  return (
    <div className="space-y-6">
      
      {/* Top Hero Score Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
          
          <div className="flex items-center gap-5">
            {/* Score circle gauge */}
            <div className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 ${
              score >= 70 ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400' : (score >= 50 ? 'border-amber-500 bg-amber-950/20 text-amber-400' : 'border-rose-500 bg-rose-950/20 text-rose-400')
            } shadow-2xl`}>
              <span className="text-3xl font-black font-mono">{score}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">de 100</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  Diagnóstico de Salud Financiera
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  score >= 70 ? 'bg-emerald-500/20 text-emerald-400' : (score >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400')
                }`}>
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Evaluación algorítmica de tus ratios de endeudamiento, cobertura de supervivencia, sangrado por interés bancario y liquidez libre.
              </p>
            </div>
          </div>

          {/* Bleed Rate Card */}
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 sm:p-5 w-full lg:w-auto shrink-0">
            <div className="flex items-center gap-2 text-rose-400 mb-1">
              <Flame className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider">Tasa de Sangrado por Interés (Bleed Rate)</span>
            </div>
            <div className="text-2xl font-black text-rose-300 font-mono">
              -{formatMoney(bleed.interesMensual, 'MXN')} / mes
            </div>
            <span className="text-[11px] text-slate-400 block mt-1">
              Equivale a <strong className="text-rose-400">-${bleed.interesDiario} MXN al día</strong> o <strong className="text-rose-400">-${bleed.interesAnual.toLocaleString('es-MX')} al año</strong> tirados en puros intereses a los bancos.
            </span>
          </div>

        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">1. Ratio Deuda-Ingreso (DTI)</span>
            <span className="text-xl font-black text-white font-mono mt-1 block">
              {dtiRatio}%
            </span>
            <span className="text-[10px] text-slate-400">
              {Number(dtiRatio) <= 30 ? '✅ Rango saludable (<30%)' : '⚠️ Carga pesada (>30%)'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">2. Runway de Emergencia</span>
            <span className="text-xl font-black text-white font-mono mt-1 block">
              {mesesRunway} meses
            </span>
            <span className="text-[10px] text-slate-400">
              {Number(mesesRunway) >= 3 ? '✅ Cobertura adecuada (>=3m)' : '⚠️ Fondo insuficiente (<3m)'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">3. Tarjetas de Alto Interés</span>
            <span className="text-xl font-black text-rose-400 font-mono mt-1 block">
              {financialData.deudas.filter(d => d.tasaAnual > 30).length} activas
            </span>
            <span className="text-[10px] text-slate-400">
              Requieren ataque con Avalancha
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">4. Blindaje Promociones</span>
            <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
              {financialData.deudas.filter(d => d.tipo === 'PROMO_DEADLINE').length} promos
            </span>
            <span className="text-[10px] text-slate-400">
              0% con fecha límite de vencimiento
            </span>
          </div>

        </div>

      </div>

      {/* Actionable Recommendations */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-white mb-1">
          Plan de Acción Recomendado para Elevar Tu Score a 90+
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Pasos concretos basados en tu situación actual para frenar el sangrado de intereses:
        </p>

        <div className="space-y-3">
          {recomendaciones.map((rec, i) => (
            <div key={i} className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start gap-3.5">
              <div className={`p-2 rounded-lg shrink-0 ${
                rec.tipo === 'URGENTE' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>

              <div>
                <span className="font-extrabold text-white text-xs sm:text-sm block">
                  {rec.titulo}
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  {rec.descripcion}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={() => onNavigateTab('debts')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <span>Ejecutar Estrategia de Pagos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
