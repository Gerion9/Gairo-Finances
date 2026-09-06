import React from 'react';
import { Award, TrendingDown, Clock, DollarSign, ArrowUpRight } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function StrategyCompare({ comparison }) {
  if (!comparison) return null;

  const { gairoCustom, avalanche, snowball, minimums, savingsVsMinimums } = comparison;

  const cards = [
    {
      title: 'Estrategia Gairo (Recomendada)',
      tag: 'ÓPTIMA & PROTEGIDA',
      color: 'emerald',
      months: gairoCustom.monthsToDebtFree,
      interest: gairoCustom.totalInterestPaid,
      debtFreeDate: gairoCustom.debtFreeDate.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
      desc: 'Blinda promociones con deadline al 0% y ataca con avalancha agresiva las deudas de mayor tasa.',
      highlight: true
    },
    {
      title: 'Avalancha Clásica',
      tag: 'MAYOR TASA PRIMERO',
      color: 'blue',
      months: avalanche.monthsToDebtFree,
      interest: avalanche.totalInterestPaid,
      debtFreeDate: avalanche.debtFreeDate.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
      desc: 'Paga deudas ordenadas puramente por tasa de interés descendente sin considerar deadlines especiales.'
    },
    {
      title: 'Bola de Nieve',
      tag: 'MENOR SALDO PRIMERO',
      color: 'purple',
      months: snowball.monthsToDebtFree,
      interest: snowball.totalInterestPaid,
      debtFreeDate: snowball.debtFreeDate.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
      desc: 'Paga primero las deudas más pequeñas para victorias psicológicas rápidas (aunque pagues más interés).'
    },
    {
      title: 'Solo Pagos Mínimos',
      tag: 'EL MÁS COSTOSO',
      color: 'rose',
      months: minimums.monthsToDebtFree,
      interest: minimums.totalInterestPaid,
      debtFreeDate: minimums.debtFreeDate.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
      desc: 'Pagar únicamente el mínimo de cada tarjeta alarga la agonía y quintuplica los intereses pagados.'
    }
  ];

  // Preparar datos para el gráfico comparativo
  const maxPoints = Math.min(
    24,
    Math.max(gairoCustom.history.length, avalanche.history.length, snowball.history.length)
  );

  const chartData = [];
  for (let m = 0; m < maxPoints; m++) {
    chartData.push({
      mes: `Mes ${m}`,
      GairoCustom: gairoCustom.history[m]?.totalBalance ?? 0,
      Avalancha: avalanche.history[m]?.totalBalance ?? 0,
      BolaDeNieve: snowball.history[m]?.totalBalance ?? 0,
      SoloMinimos: minimums.history[m]?.totalBalance ?? minimums.history[minimums.history.length - 1]?.totalBalance ?? 0
    });
  }

  return (
    <div className="space-y-6">
      
      {/* Savings Highlight Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/40 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Impacto Financiero de la Estrategia Gairo
            </span>
            <h3 className="text-2xl font-black text-white mt-0.5">
              Ahorras {formatMoney(savingsVsMinimums.moneySaved, 'MXN')} y te liberas {savingsVsMinimums.monthsSaved} meses antes
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              En comparación con pagar únicamente el pago mínimo mensual de tus tarjetas.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of 4 Strategies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              c.highlight
                ? 'bg-slate-900 border-emerald-500/60 shadow-xl shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  c.highlight ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {c.tag}
                </span>
              </div>

              <h4 className="text-base font-extrabold text-white">
                {c.title}
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                {c.desc}
              </p>

              <div className="mt-4 space-y-2.5 pt-3 border-t border-slate-800/80">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Meses para liquidar:</span>
                  <span className="font-extrabold text-white font-mono">{c.months} meses</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total intereses:</span>
                  <span className={`font-extrabold font-mono ${c.highlight ? 'text-emerald-400' : (c.months > 60 ? 'text-rose-400' : 'text-slate-200')}`}>
                    {formatMoney(c.interest, 'MXN')}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Libre de deudas en:</span>
                  <span className="font-bold text-slate-300 font-mono">{c.debtFreeDate}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Curve Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-white mb-1">
          Curva de Desendeudamiento en el Tiempo (MXN)
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Proyección del saldo total mes con mes comparando cada metodología de pago.
        </p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGairo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMinimos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="mes" stroke="#64748b" textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val) => [`$${Number(val).toLocaleString('es-MX')}`, '']}
              />
              <Legend />
              <Area type="monotone" dataKey="GairoCustom" name="Estrategia Gairo" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGairo)" />
              <Area type="monotone" dataKey="Avalancha" name="Avalancha Clásica" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} />
              <Area type="monotone" dataKey="BolaDeNieve" name="Bola de Nieve" stroke="#a855f7" strokeWidth={2} fillOpacity={0} />
              <Area type="monotone" dataKey="SoloMinimos" name="Solo Mínimos" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorMinimos)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
