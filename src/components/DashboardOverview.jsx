import React from 'react';
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  ShieldAlert, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Flame, 
  Sparkles,
  Layers,
  Plus
} from 'lucide-react';
import PromoAlerts from './PromoAlerts';
import { formatMoney, convertCurrency } from '../services/exchangeRate';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function DashboardOverview({
  financialData,
  cashFlow,
  promoDeadlines,
  exchangeRate,
  displayCurrency,
  onNavigateTab,
  onOpenDebtModal
}) {
  const { fiscal, totalCostodeVida, totalGastosOpcionales, flujoLibreReal, totalPagosMinimosMXN } = cashFlow;

  // Total Deuda en MXN y USD
  const totalDeudaMXN = financialData.deudas.reduce((acc, d) => {
    return acc + convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate);
  }, 0);
  const totalDeudaUSD = totalDeudaMXN / exchangeRate;

  // Total Activos en MXN
  const totalActivosMXN = financialData.activos.reduce((acc, a) => {
    return acc + convertCurrency(a.monto, a.moneda, 'MXN', exchangeRate);
  }, 0);

  // Patrimonio Neto
  const patrimonioNetoMXN = totalActivosMXN - totalDeudaMXN;

  // Datos para gráfico circular de deudas
  const debtBreakdown = financialData.deudas.map(d => ({
    name: d.nombre,
    value: Math.round(convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate)),
    color: d.tipo === 'PROMO_DEADLINE' ? '#f59e0b' : (d.tipo === 'HIGH_INTEREST' ? '#f43f5e' : '#10b981')
  }));

  const COLORS = ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

  return (
    <div className="space-y-6">
      
      {/* Promo Deadlines Hero Alerts */}
      <PromoAlerts 
        promoDeadlines={promoDeadlines} 
        displayCurrency={displayCurrency} 
        exchangeRate={exchangeRate}
        onGoToDebts={() => onNavigateTab('debts')}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Deuda */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Deuda Total Activa</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {displayCurrency === 'USD' ? formatMoney(totalDeudaUSD, 'USD') : formatMoney(totalDeudaMXN, 'MXN')}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
            <span>{financialData.deudas.length} deudas registradas</span>
            <span className="text-rose-400 font-semibold">MXN & USD</span>
          </div>
        </div>

        {/* Card 2: Provisión SAT (Intocable) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Provisión SAT Mensual</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {formatMoney(fiscal.totalImpuestosSat, 'MXN')}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
            <span>ISR: ${Math.round(fiscal.isrACargo)} | IVA: ${Math.round(fiscal.ivaACargo)}</span>
            <span className="text-amber-400 font-bold uppercase text-[10px]">⚠️ Intocable</span>
          </div>
        </div>

        {/* Card 3: Flujo Libre Mensual */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Flujo Libre Disponible</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${flujoLibreReal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(flujoLibreReal, 'MXN')}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
            <span>Para aportes extra de deuda</span>
            <span className="text-emerald-400 font-semibold">{flujoLibreReal >= 0 ? 'Superávit' : 'Déficit'}</span>
          </div>
        </div>

        {/* Card 4: Patrimonio Neto */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Patrimonio Neto</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${patrimonioNetoMXN >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {formatMoney(patrimonioNetoMXN, 'MXN')}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
            <span>Activos: {formatMoney(totalActivosMXN, 'MXN')}</span>
            <span className="text-slate-300 font-semibold">Estructura Capital</span>
          </div>
        </div>

      </div>

      {/* Main Grid: Cash Flow Diagram & Debts Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Resumen Mensual de Ingresos y Salidas */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                Flujo Mensual: De Dónde Viene y Adónde Va Tu Dinero
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cálculo basado en tus honorarios reales y deducciones de ley.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('budget')}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>Ver Estado de Resultados</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Step flow visualizer */}
          <div className="space-y-3 text-xs">
            
            {/* Facturado */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Importe Facturado CFDI (sin IVA)</span>
                <span className="text-slate-400">Base antes de retenciones cliente</span>
              </div>
              <span className="font-extrabold text-white text-sm font-mono">
                {formatMoney(fiscal.importeFacturado, 'MXN')}
              </span>
            </div>

            {/* Neto en Cuenta */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-400 block">Depósito Neto que Entra a Cuenta Bancaria</span>
                <span className="text-slate-400">Ya descontadas retenciones ISR (-10%) e IVA (-2/3)</span>
              </div>
              <span className="font-extrabold text-emerald-400 text-sm font-mono">
                {formatMoney(fiscal.netoEnCuenta, 'MXN')}
              </span>
            </div>

            {/* Salidas Clave */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl">
                <span className="text-amber-400 font-bold block text-[11px] uppercase">1. Guardar para SAT</span>
                <span className="text-base font-black text-amber-300 font-mono block mt-1">
                  -{formatMoney(fiscal.totalImpuestosSat, 'MXN')}
                </span>
                <span className="text-[10px] text-slate-400">ISR + IVA mensual</span>
              </div>

              <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                <span className="text-slate-300 font-bold block text-[11px] uppercase">2. Costo de Vida</span>
                <span className="text-base font-black text-white font-mono block mt-1">
                  -{formatMoney(totalCostodeVida, 'MXN')}
                </span>
                <span className="text-[10px] text-slate-400">Renta, Super, Toto...</span>
              </div>

              <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                <span className="text-slate-300 font-bold block text-[11px] uppercase">3. Opcionales + Mínimos</span>
                <span className="text-base font-black text-white font-mono block mt-1">
                  -{formatMoney(totalGastosOpcionales + totalPagosMinimosMXN, 'MXN')}
                </span>
                <span className="text-[10px] text-slate-400">Recreación y créditos</span>
              </div>
            </div>

            {/* Remanente libre */}
            <div className="mt-4 p-4 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                  Capacidad de Aporte Extra para Liquidar Deudas
                </span>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Dinero libre real que puedes inyectar para acelerar tu salida de deudas sin asfixiarte.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {formatMoney(Math.max(0, flujoLibreReal), 'MXN')} / mes
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Right 1 Col: Portafolio de Deudas y Composición */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Composición de Deudas
              </h3>
              <button
                onClick={onOpenDebtModal}
                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                title="Agregar nueva deuda"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Pie Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={debtBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {debtBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val) => [`$${Number(val).toLocaleString('es-MX')} MXN`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* List of debts summary */}
            <div className="space-y-2 mt-3 text-xs">
              {financialData.deudas.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between p-2 bg-slate-950/60 rounded-lg border border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                    <span className="font-semibold text-white truncate max-w-[120px]">{d.nombre}</span>
                  </div>
                  <span className="font-mono text-slate-300">
                    {formatMoney(d.saldo, d.moneda)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('debts')}
            className="w-full mt-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Gestionar Todas las Deudas</span>
          </button>
        </div>

      </div>

    </div>
  );
}
