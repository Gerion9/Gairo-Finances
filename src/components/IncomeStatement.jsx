import React, { useState } from 'react';
import { TrendingUp, Save, ShieldAlert, CheckCircle2, DollarSign, Edit3 } from 'lucide-react';
import { calculateFiscalOverview } from '../services/financeEngine';
import { formatMoney } from '../services/exchangeRate';

export default function IncomeStatement({ financialData, onUpdateHonorarios, onUpdateGastos }) {
  const [honorariosForm, setHonorariosForm] = useState(financialData.honorarios);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fiscal = calculateFiscalOverview(honorariosForm);
  const totalCostodeVida = financialData.gastosNecesarios.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const totalGastosOpcionales = financialData.gastosOpcionales.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  const handleSave = (e) => {
    e.preventDefault();
    onUpdateHonorarios(honorariosForm);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <div className="space-y-6">
      
      {/* Header & Fiscal Config */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Estado de Resultados Personal & Módulo Fiscal SAT
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Basado en CFDI Honorarios
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Réplica digital exacta de las hojas "Parámetros" y "Estado de Resultados" de tu archivo Excel.
            </p>
          </div>

          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 font-semibold animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              ¡Parámetros actualizados!
            </span>
          )}
        </div>

        {/* Form to edit Base CFDI parameters */}
        <form onSubmit={handleSave} className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Importe Facturado (sin IVA) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={honorariosForm.importeFacturado}
                onChange={(e) => setHonorariosForm({ ...honorariosForm, importeFacturado: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Base del CFDI del cliente</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Otros Ingresos Mensuales
              </label>
              <input
                type="number"
                step="any"
                value={honorariosForm.otrosIngresos}
                onChange={(e) => setHonorariosForm({ ...honorariosForm, otrosIngresos: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Freelance, rentas, extras</span>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Actualizar Ingresos</span>
              </button>
            </div>
          </div>
        </form>

        {/* Fiscal Breakdown Card */}
        <div className="mt-6 p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Desglose Fiscal Mensual (CFDI & Retenciones de Ley)
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">IVA Facturado (16%)</span>
              <span className="font-bold text-white text-sm font-mono mt-0.5 block">
                {formatMoney(fiscal.ivaCobrado, 'MXN')}
              </span>
              <span className="text-[10px] text-slate-500">No es tuyo</span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">(−) Ret. ISR Cliente</span>
              <span className="font-bold text-amber-400 text-sm font-mono mt-0.5 block">
                -{formatMoney(fiscal.retencionIsr, 'MXN')}
              </span>
              <span className="text-[10px] text-slate-500">10% retenido</span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">(−) Ret. IVA Cliente</span>
              <span className="font-bold text-amber-400 text-sm font-mono mt-0.5 block">
                -{formatMoney(fiscal.retencionIva, 'MXN')}
              </span>
              <span className="text-[10px] text-slate-500">2/3 retenido</span>
            </div>

            <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30">
              <span className="text-emerald-400 text-[10px] block uppercase font-bold">Neto que Entra al Banco</span>
              <span className="font-black text-emerald-300 text-base font-mono mt-0.5 block">
                {formatMoney(fiscal.netoEnCuenta, 'MXN')}
              </span>
              <span className="text-[10px] text-emerald-400/80">Cash real recibido</span>
            </div>
          </div>

          {/* SAT Alert banner */}
          <div className="mt-4 p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300 block">
                  Provisión Obligatoria para Declaración SAT: {formatMoney(fiscal.totalImpuestosSat, 'MXN')} / mes
                </span>
                <span className="text-slate-400 text-[11px]">
                  ISR a cargo: {formatMoney(fiscal.isrACargo, 'MXN')} + IVA a cargo: {formatMoney(fiscal.ivaACargo, 'MXN')}. Guarda este dinero en una cuenta separada (ej. Cajita Nu o CETES).
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Annual Projection Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-white mb-1">
          Proyección Anualizada (Enero - Diciembre)
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Distribución mensual del Estado de Resultados con desglose de honorarios, costos de vida y gastos opcionales.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-bold">
                <th className="py-2.5 px-3 text-white">Concepto</th>
                <th className="py-2.5 px-3 text-right">Mensual (Base)</th>
                <th className="py-2.5 px-3 text-right text-emerald-400 font-extrabold">Total Anual (x12)</th>
                <th className="py-2.5 px-3 text-right text-slate-400">% s/ Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              
              <tr className="bg-slate-950/40">
                <td className="py-2.5 px-3 font-bold text-white uppercase">INGRESOS NETOS EN CUENTA</td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{formatMoney(fiscal.netoEnCuenta, 'MXN')}</td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{formatMoney(fiscal.netoEnCuenta * 12, 'MXN')}</td>
                <td className="py-2.5 px-3 text-right text-slate-400">100.0%</td>
              </tr>

              <tr>
                <td className="py-2 px-3 text-slate-400 pl-6">(−) Provisión Impuestos SAT</td>
                <td className="py-2 px-3 text-right text-amber-400">-{formatMoney(fiscal.totalImpuestosSat, 'MXN')}</td>
                <td className="py-2 px-3 text-right text-amber-400">-{formatMoney(fiscal.totalImpuestosSat * 12, 'MXN')}</td>
                <td className="py-2 px-3 text-right text-slate-500">{((fiscal.totalImpuestosSat / fiscal.netoEnCuenta) * 100).toFixed(1)}%</td>
              </tr>

              <tr>
                <td className="py-2 px-3 text-slate-400 pl-6">(−) Costo de Vida Necesario (Renta, Super, Toto...)</td>
                <td className="py-2 px-3 text-right text-slate-200">-{formatMoney(totalCostodeVida, 'MXN')}</td>
                <td className="py-2 px-3 text-right text-slate-200">-{formatMoney(totalCostodeVida * 12, 'MXN')}</td>
                <td className="py-2 px-3 text-right text-slate-500">{((totalCostodeVida / fiscal.netoEnCuenta) * 100).toFixed(1)}%</td>
              </tr>

              <tr>
                <td className="py-2 px-3 text-slate-400 pl-6">(−) Gastos Opcionales (Recreación, Suscripciones)</td>
                <td className="py-2 px-3 text-right text-slate-200">-{formatMoney(totalGastosOpcionales, 'MXN')}</td>
                <td className="py-2 px-3 text-right text-slate-200">-{formatMoney(totalGastosOpcionales * 12, 'MXN')}</td>
                <td className="py-2 px-3 text-right text-slate-500">{((totalGastosOpcionales / fiscal.netoEnCuenta) * 100).toFixed(1)}%</td>
              </tr>

              <tr className="bg-emerald-950/20 font-bold text-white border-t border-emerald-500/30">
                <td className="py-2.5 px-3 text-emerald-400 uppercase">FLUJO DISPONIBLE PARA DEUDAS Y AHORRO</td>
                <td className="py-2.5 px-3 text-right text-emerald-300 text-sm">
                  {formatMoney(fiscal.netoEnCuenta + fiscal.otrosIngresos - fiscal.totalImpuestosSat - totalCostodeVida - totalGastosOpcionales, 'MXN')}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-300 text-sm">
                  {formatMoney((fiscal.netoEnCuenta + fiscal.otrosIngresos - fiscal.totalImpuestosSat - totalCostodeVida - totalGastosOpcionales) * 12, 'MXN')}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  {(((fiscal.netoEnCuenta + fiscal.otrosIngresos - fiscal.totalImpuestosSat - totalCostodeVida - totalGastosOpcionales) / fiscal.netoEnCuenta) * 100).toFixed(1)}%
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
