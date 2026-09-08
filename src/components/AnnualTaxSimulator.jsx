import React, { useRef, useState } from 'react';
import { Landmark } from 'lucide-react';
import { calculateFiscalOverview } from '../services/financeEngine.js';

export default function AnnualTaxSimulator({ financialData = {} }) {
  const fiscal = calculateFiscalOverview(financialData.honorarios);
  const [ingresosAnuales, setIngresosAnuales] = useState(fiscal.importeFacturado * 12);
  const [deduccionesPersonales, setDeduccionesPersonales] = useState(0);
  const [retencionesEfectuadas, setRetencionesEfectuadas] = useState(fiscal.retencionIsr * 12);
  const [rfcSixthDigit, setRfcSixthDigit] = useState('4');
  const resultRef = useRef(null);

  // Internal reference table; applicability is not validated for a fiscal year or regime.
  const additionalDays = {
    '1': 1, '2': 1,
    '3': 2, '4': 2,
    '5': 3, '6': 3,
    '7': 4, '8': 4,
    '9': 5, '0': 5
  }[rfcSixthDigit] || 0;

  // Annual calculation
  const baseGravable = Math.max(0, ingresosAnuales - deduccionesPersonales);
  
  // Simplified internal formula, not a validated official annual tax table.
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

  const handleReviewScenario = () => {
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
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
            <h2 className="text-xl font-bold text-white">Simulador de escenario fiscal anual</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Estimación orientativa con una fórmula simplificada. La tarifa y los requisitos del ejercicio fiscal no están validados en esta herramienta.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Inputs */}
        <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white">Supuestos del escenario</h3>
          <p className="text-xs text-slate-400">Revisa los importes precargados: pueden incluir valores de ejemplo. El resultado se actualiza al editar los campos.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="annual-income" className="block text-slate-400 mb-1 font-semibold">Ingresos anuales considerados (MXN)</label>
              <input
                id="annual-income"
                type="number"
                value={ingresosAnuales}
                onChange={e => setIngresosAnuales(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="annual-deductions" className="block text-slate-400 mb-1 font-semibold">Deducciones consideradas (MXN)</label>
              <input
                id="annual-deductions"
                aria-describedby="annual-deductions-note"
                type="number"
                value={deduccionesPersonales}
                onChange={e => setDeduccionesPersonales(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              />
              <span id="annual-deductions-note" className="text-[10px] text-slate-400 mt-1 block">Se resta el importe capturado sin validar topes, conceptos deducibles ni comprobantes.</span>
            </div>

            <div>
              <label htmlFor="annual-withholdings" className="block text-slate-400 mb-1 font-semibold">Retenciones consideradas (MXN)</label>
              <input
                id="annual-withholdings"
                type="number"
                value={retencionesEfectuadas}
                onChange={e => setRetencionesEfectuadas(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="annual-rfc-digit" className="block text-slate-400 mb-1 font-semibold">Sexto dígito numérico del RFC (referencia)</label>
              <select
                id="annual-rfc-digit"
                aria-describedby="annual-rfc-note"
                value={rfcSixthDigit}
                onChange={e => setRfcSixthDigit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-rose-500 focus:outline-none"
              >
                {['1','2','3','4','5','6','7','8','9','0'].map(d => (
                  <option key={d} value={d}>Dígito &quot;{d}&quot;</option>
                ))}
              </select>
              <span id="annual-rfc-note" className="text-[10px] text-slate-400 mt-1 block">
                Referencia interna no validada: día 17 + {additionalDays} días hábiles. No verifica calendario ni aplicabilidad y no interviene en el cálculo anual.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleReviewScenario}
              className="w-full py-2.5 font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-md"
            >
              Revisar resultado estimado
            </button>
          </div>
        </div>

        {/* Results Card */}
        <section ref={resultRef} tabIndex={-1} aria-labelledby="annual-result-title" className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <h3 id="annual-result-title" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado del escenario</h3>
            <div className="mt-3">
              <div className="text-xs text-slate-400">Diferencia estimada: retenciones menos ISR</div>
              <div className={`text-2xl sm:text-3xl font-black mt-1 ${saldoAFavor === 0 ? 'text-white' : esSaldoAFavor ? 'text-emerald-400' : 'text-rose-400'}`}>
                {saldoAFavor === 0 ? '$0.00 MXN' : esSaldoAFavor ? `+$${saldoAFavor.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN` : `-$${Math.abs(saldoAFavor).toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN`}
              </div>
              <div className="mt-2 text-xs">
                {saldoAFavor === 0 ? (
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">Sin diferencia estimada</span>
                ) : esSaldoAFavor ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Posible saldo a favor
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    Posible importe a cargo
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 mt-5 text-xs text-slate-300 border-t border-slate-800 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Base utilizada en el cálculo:</span>
                <span className="font-semibold">${baseGravable.toLocaleString('es-MX')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ISR estimado con esta fórmula:</span>
                <span className="font-semibold">${isrAnual.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Retenciones capturadas:</span>
                <span className="font-semibold">${retencionesEfectuadas.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <strong>Alcance de la estimación:</strong> El resultado no acredita un saldo fiscal ni garantiza una devolución. Esta herramienta no valida deducciones, aportaciones a PPR, retenciones ni requisitos del ejercicio.
          </div>
        </section>

      </div>

    </div>
  );
}
