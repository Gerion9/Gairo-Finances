import React, { useState } from 'react';
import { X, ArrowRight, Check, ShieldAlert, Zap, Sparkles } from 'lucide-react';
import { BrandMark } from './Brand';

export default function OnboardingModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const steps = [
    {
      step: 1,
      icon: BrandMark,
      title: '¡Bienvenido a Sifran!',
      subtitle: 'Tu plataforma inteligente de aceleración de pagos y control fiscal.',
      desc: 'Esta herramienta fue creada tomando como base tus finanzas reales para devolverte el control de tu dinero, evitar penalizaciones costosas y guiarte mes a mes hasta liquidar cada centavo.'
    },
    {
      step: 2,
      icon: ShieldAlert,
      title: 'El Semáforo Fiscal SAT & Provisión',
      subtitle: 'El error #1 de los profesionistas es gastar el dinero de impuestos.',
      desc: 'La app aparta automáticamente tu cuota mensual estimada de impuestos ($6,831.93 MXN). Este dinero es intocable y debe mantenerse resguardado en una cuenta separada como Cajita Nu o CETES.'
    },
    {
      step: 3,
      icon: Zap,
      title: 'La Estrategia Maestra de Pagos',
      subtitle: 'Blindaje de Promociones con Deadline + Ataque Avalancha.',
      desc: 'El algoritmo calcula primero la cuota exacta para liquidar tus compras a meses sin intereses antes de que venza el plazo. Todo el dinero restante ataca con fuerza tu tarjeta más cara (BBVA Gold al 49%).'
    }
  ];

  const current = steps[step - 1];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Steps pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-xs font-extrabold text-slate-400 font-mono">
            Paso {step} de 3
          </span>
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight">
          {current.title}
        </h3>
        <p className="text-xs font-semibold text-emerald-400 mt-1">
          {current.subtitle}
        </p>

        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
          {current.desc}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(i => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-700'
                }`}
              ></span>
            ))}
          </div>

          <button
            onClick={() => {
              if (step < 3) setStep(step + 1);
              else onClose();
            }}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <span>{step === 3 ? 'Comenzar Ahora' : 'Siguiente'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
