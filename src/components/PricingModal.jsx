import React, { useState } from 'react';
import { X, Check, Sparkles, ShieldCheck, Zap, Crown } from 'lucide-react';

export default function PricingModal({ isOpen, onClose, onActivateLicense }) {
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activationMsg, setActivationMsg] = useState('');

  if (!isOpen) return null;

  const handleActivate = (e) => {
    e.preventDefault();
    if (licenseKeyInput.trim().length >= 6) {
      onActivateLicense(licenseKeyInput.trim());
      setActivationMsg('¡Licencia comercial PRO activada exitosamente!');
      setTimeout(() => {
        setActivationMsg('');
        onClose();
      }, 1500);
    } else {
      setActivationMsg('Clave de licencia no válida.');
    }
  };

  const tiers = [
    {
      name: 'Plan Personal',
      price: 'Gratis',
      period: 'para siempre',
      desc: 'Para quienes inician su orden financiero.',
      features: [
        'Registro de deudas en MXN',
        'Cálculo fiscal básico',
        'Almacenamiento local privado'
      ],
      current: false,
      cta: 'Plan Actual'
    },
    {
      name: 'Plan PRO / Freelance',
      price: '$9 USD',
      period: '/ mes (o $180 MXN)',
      desc: 'Para personas con deudas complejas y régimen de honorarios.',
      features: [
        'Soporte Multi-divisa en vivo (USD/MXN)',
        'Estrategia de Promociones con Deadline al 0%',
        'Algoritmo Avalancha vs Bola de Nieve',
        'Calendario de Vencimientos por Quincena',
        'Exportación nativa a Excel (.xlsx)',
        'Control de Presupuesto Diario'
      ],
      highlight: true,
      current: true,
      cta: 'Plan Activo'
    },
    {
      name: 'Licencia Vitalicia Founder',
      price: '$49 USD',
      period: 'pago único',
      desc: 'Acceso ilimitado para siempre con todas las actualizaciones.',
      features: [
        'Todo lo del Plan PRO',
        'Sin cuotas mensuales de por vida',
        'Soporte prioritario',
        'Reportes ejecutivos en PDF ilimitados'
      ],
      current: false,
      cta: 'Comprar Vitalicio'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Planes & Licenciamiento Comercial (SaaS Ready)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          <div className="text-center max-w-lg mx-auto">
            <h3 className="text-2xl font-black text-white">Elige Tu Nivel de Libertad Financiera</h3>
            <p className="text-xs text-slate-400 mt-1">
              Diseñado para comercializarse masivamente a profesionistas, freelancers y personas que buscan salir de deudas.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.map((t, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border flex flex-col justify-between ${
                  t.highlight
                    ? 'bg-gradient-to-b from-slate-900 to-emerald-950/20 border-emerald-500/60 shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-white">{t.name}</span>
                    {t.highlight && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        MÁS POPULAR
                      </span>
                    )}
                  </div>

                  <div className="mt-3 mb-2">
                    <span className="text-3xl font-black text-white font-mono">{t.price}</span>
                    <span className="text-xs text-slate-400 ml-1">{t.period}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4">{t.desc}</p>

                  <ul className="space-y-2 border-t border-slate-800/80 pt-4 text-xs text-slate-300">
                    {t.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  <button
                    disabled={t.current}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      t.highlight
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    } disabled:opacity-75`}
                  >
                    {t.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* License Activation Form */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 max-w-md mx-auto">
            <span className="text-xs font-bold uppercase text-slate-400 block mb-1 text-center">
              ¿Ya tienes una clave de licencia comercial?
            </span>
            <form onSubmit={handleActivate} className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Ej. GAIRO-PRO-2026-XXXX"
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white uppercase font-mono"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shrink-0"
              >
                Activar
              </button>
            </form>
            {activationMsg && (
              <p className="text-[11px] text-emerald-400 mt-2 text-center font-semibold">{activationMsg}</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
