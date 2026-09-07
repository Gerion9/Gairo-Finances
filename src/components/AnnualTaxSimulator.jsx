import React, { useState } from 'react';
import { Landmark, Calendar, FileText, CheckCircle, AlertCircle, Upload, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { playVictorySound } from '../services/soundEffects.js';
import confetti from 'canvas-confetti';

export default function AnnualTaxSimulator({ financialData = {} }) {
  const [ingresosAnuales, setIngresosAnuales] = useState((financialData.honorarios?.facturaSinIva || 54295.79) * 12);
  const [deduccionesPersonales, setDeduccionesPersonales] = useState(35000);
  const [retencionesEfectuadas, setRetencionesEfectuadas] = useState((financialData.honorarios?.retencionIsr || 5429.58) * 12);
  const [rfcSixthDigit, setRfcSixthDigit] = useState('4');

  // RFC additional business days calculation (Miscelánea Fiscal)
  const additionalDays = {
    '1': 1, '2': 1,
    '3': 2, '4': 2,
    '5': 3, '6': 3,
    '7': 4, '8': 4,
    '9': 5, '0': 5
  }[rfcSixthDigit] || 0;

  // Annual calculation
  const baseGravable = Math.max(0, ingresosAnuales - deduccionesPersonales);
  
  // ISR Anual aproximado (Tarifa Art. 152 LISR)
  let isrAnual = 0;
  if (baseGravable <= 100000) {
    isrAnual = baseGravable * 0.06;
  } else if (baseGravable <= 300000) {
    isrAnual = 6000 + (baseGravable - 100000) * 0.16;
  } else if (baseGravable <= 600000) {
    isrAnual = 38000 + (baseGravable - 300000) * 0.2352;
  } else {
    isrAnual = 108500 + (baseGravable - 600000) * 0.30;
  }

  const saldoAFavor = retencionesEfectuadas - isrAnual;
  const esSaldoAFavor = saldoAFavor > 0;

  const handleSimulateWin = () => {
    if (esSaldoAFavor) {
      playVictorySound();
      confetti({ particleCount: 80, spread: 70 });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 border border-rose-500/30 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Simulador de Declaración Anual Personas Físicas (SAT)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Proyección oficial de saldo a favor / en contra para la Declaración Anual de Abril conforme al Art. 151 y 152 de la LISR.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Inputs */}
        <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white">Parámetros del Ejercicio Fiscal</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Ingresos Brutos Acumulables ($ MXN/año)</label>
              <input
                type="number"
                value={ingresosAnuales}
                onChange={e => setIngresosAnuales(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Deducciones Personales (Gastos Médicos, Colegiaturas, PPR)</label>
              <input
                type="number"
                value={deduccionesPersonales}
                onChange={e => setDeduccionesPersonales(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Tope: Menor entre 15% de ingresos o 5 UMAs (~$198,000)</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Retenciones de ISR Efectuadas por Empresas (10%)</label>
              <input
                type="number"
                value={retencionesEfectuadas}
                onChange={e => setRetencionesEfectuadas(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Sexto Dígito Numérico de tu RFC</label>
              <select
                value={rfcSixthDigit}
                onChange={e => setRfcSixthDigit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              >
                {['1','2','3','4','5','6','7','8','9','0'].map(d => (
                  <option key={d} value={d}>Dígito &quot;{d}&quot; ({additionalDays} días hábiles adicionales)</option>
                ))}
              </select>
              <span className="text-[10px] text-emerald-400 mt-1 block">
                Tu fecha límite mensual es: Día 17 + {additionalDays} días hábiles adicionales.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSimulateWin}
              className="w-full py-2.5 font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-md"
            >
              Recalcular Escenario Fiscal Anual
            </button>
          </div>
        </div>

        {/* Results Card */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dictamen Estimado SAT</span>
            <div className="mt-3">
              <div className="text-xs text-slate-400">Resultado Proyectado:</div>
              <div className={`text-2xl sm:text-3xl font-black mt-1 ${esSaldoAFavor ? 'text-emerald-400' : 'text-rose-400'}`}>
                {esSaldoAFavor ? `+$${saldoAFavor.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN` : `-$${Math.abs(saldoAFavor).toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN`}
              </div>
              <div className="mt-2 text-xs">
                {esSaldoAFavor ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    🎉 ¡Saldo a Favor a Devolver en Abril!
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    ⚠️ Impuesto a Pagar al SAT
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 mt-5 text-xs text-slate-300 border-t border-slate-800 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Base Gravable Neta:</span>
                <span className="font-semibold">${baseGravable.toLocaleString('es-MX')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ISR Causado Anual:</span>
                <span className="font-semibold">${isrAnual.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pagos / Retenciones:</span>
                <span className="font-semibold">${retencionesEfectuadas.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            💡 <strong>Consejo SAT:</strong> Aumentar tus aportaciones voluntarias a tu PPR antes del 31 de diciembre maximiza directamente este saldo a favor en abril.
          </div>
        </div>

      </div>

    </div>
  );
}
