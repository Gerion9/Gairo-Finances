import React from 'react';
import { Printer, Download, CheckCircle2, TrendingUp, ShieldCheck, DollarSign } from 'lucide-react';
import { formatMoney, convertCurrency } from '../services/exchangeRate';
import { runStrategySimulation, calculateFiscalOverview } from '../services/financeEngine';

export default function PrintableReport({ financialData, exchangeRate }) {
  const fiscal = calculateFiscalOverview(financialData.honorarios);
  const simulation = runStrategySimulation(financialData.deudas, financialData.config?.aportacionExtraMensual || 2500, exchangeRate, 'GAIRO_CUSTOM');
  
  const totalDeudaMXN = financialData.deudas.reduce((sum, d) => sum + convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate), 0);
  const totalActivosMXN = financialData.activos.reduce((sum, a) => sum + convertCurrency(a.monto, a.moneda, 'MXN', exchangeRate), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Control Bar (hidden in print) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-xl font-extrabold text-white">Reporte Ejecutivo Financiero</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Vista optimizada para imprimir o guardar en PDF con tu resumen de liquidación de deudas.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Guardar en PDF</span>
        </button>
      </div>

      {/* Printable Paper Document */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl max-w-4xl mx-auto font-sans print:shadow-none print:p-0">
        
        {/* Report Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Gairo Finances</h1>
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider mt-1">
              Plan Estratégico de Liquidación de Deudas & Libertad Financiera
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <span className="block font-bold">Fecha: {new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</span>
            <span>Tipo de cambio aplicado: 1 USD = ${exchangeRate.toFixed(2)} MXN</span>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Deuda Total Consolidada</span>
            <span className="text-xl font-black text-rose-600 font-mono mt-1 block">
              {formatMoney(totalDeudaMXN, 'MXN')}
            </span>
            <span className="text-[10px] text-slate-500">{financialData.deudas.length} créditos registrados</span>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Fecha Libre de Deudas</span>
            <span className="text-xl font-black text-emerald-700 font-mono mt-1 block capitalize">
              {simulation.debtFreeDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold">{simulation.monthsToDebtFree} meses de esfuerzo enfocado</span>
          </div>

          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Reserva Fiscal SAT Mensual</span>
            <span className="text-xl font-black text-amber-600 font-mono mt-1 block">
              {formatMoney(fiscal.totalImpuestosSat, 'MXN')}
            </span>
            <span className="text-[10px] text-slate-500">Intocable para impuestos</span>
          </div>
        </div>

        {/* Debts Table */}
        <div className="mb-8">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-3 border-b border-slate-300 pb-1">
            1. Inventario de Créditos y Estrategia Asignada
          </h3>

          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-600 uppercase text-[10px]">
                <th className="py-2">Deuda / Institución</th>
                <th className="py-2">Moneda</th>
                <th className="py-2 text-right">Saldo Original</th>
                <th className="py-2 text-right">Saldo MXN</th>
                <th className="py-2 text-right">Tasa APR</th>
                <th className="py-2 text-right">Tratamiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {financialData.deudas.map(d => (
                <tr key={d.id}>
                  <td className="py-2 font-bold font-sans text-slate-900">{d.nombre}</td>
                  <td className="py-2 text-slate-600 font-bold">{d.moneda}</td>
                  <td className="py-2 text-right font-bold">{formatMoney(d.saldo, d.moneda)}</td>
                  <td className="py-2 text-right font-bold">{formatMoney(convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate), 'MXN')}</td>
                  <td className="py-2 text-right font-bold text-rose-600">{d.tasaAnual}%</td>
                  <td className="py-2 text-right font-sans text-[11px]">
                    {d.tipo === 'PROMO_DEADLINE' ? '⚡ Blindar Promo' : (d.tipo === 'HIGH_INTEREST' ? '🔥 Avalancha' : '🛡️ Mínimo')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Monthly Action Plan Preview */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-3 border-b border-slate-300 pb-1">
            2. Proyección de Amortización Mensual (Primeros 12 Meses)
          </h3>

          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 text-[10px] uppercase">
                <th className="py-1.5">Mes</th>
                <th className="py-1.5 text-right">Saldo Deuda Restante</th>
                <th className="py-1.5 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {simulation.history.slice(0, 12).map(r => (
                <tr key={r.month}>
                  <td className="py-1.5 font-sans font-semibold">Mes {r.month}</td>
                  <td className="py-1.5 text-right font-bold text-slate-900">{formatMoney(r.totalBalance, 'MXN')}</td>
                  <td className="py-1.5 text-right font-sans text-slate-600">{r.totalBalance <= 0 ? '¡Liquidado!' : 'En proceso'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-4 border-t border-slate-300 text-[10px] text-slate-500 text-center">
          Generado automáticamente por Gairo Finances · Cálculos validados conforme a Finanzas Personales.xlsx
        </div>

      </div>

    </div>
  );
}
