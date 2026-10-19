import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, FileText, CheckCircle2, AlertTriangle, TrendingDown, BookOpen } from 'lucide-react';

export default function AdvancedDiagnosticsHub() {
  const [copied, setCopied] = useState(false);
  const [checkedHabits, setCheckedHabits] = useState({
    1: true, 2: true, 3: true, 4: false, 5: true, 6: false, 7: false, 8: true
  });

  const letterTemplate = `ASUNTO: Solicitud de Reestructuración / Plan de Liquidación con Tasa Preferencial

Estimado Comité de Crédito / Unidad de Atención Especializada,

Por medio de la presente, yo, titular de la tarjeta de crédito terminación [XXXX], me dirijo a ustedes de manera voluntaria y con plena disposición de pago para solicitar formalmente un plan de reestructuración o consolidación a pagos fijos con tasa de interés preferencial.

Debido a un reajuste en mi planeación financiera y con el fin de garantizar la liquidación total de mi adeudo sin comprometer mi capacidad de pago ni caer en mora, solicito la congelación de saldo a una tasa competitiva a un plazo de [12 / 24] meses.

Agradezco de antemano su atención y quedo a la espera de su propuesta formal para formalizar el convenio.

Atentamente,
[Nombre Completo]
Teléfono: [Teléfono de Contacto]`;

  const handleCopyLetter = () => {
    navigator.clipboard.writeText(letterTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const habits = [
    { id: 1, text: 'Revisé mi saldo bancario y aparté la provisión obligatoria del SAT.' },
    { id: 2, text: 'Pagué la cuota recomendada de mis compras a meses sin intereses antes del deadline.' },
    { id: 3, text: 'Inyecté un abono extraordinario a capital en la tarjeta con mayor tasa de interés (BBVA Gold).' },
    { id: 4, text: 'Audité mis suscripciones digitales y cancelé los servicios que no utilicé en los últimos 30 días.' },
    { id: 5, text: 'Verifiqué que los gastos en supermercado y comida no rebasaran el tope presupuestado.' },
    { id: 6, text: 'Aporté al menos el 10% de mis ingresos netos a CETES o al Fondo de Emergencia.' },
    { id: 7, text: 'Descargué mi reporte especial de Buró de Crédito gratuito para descartar homonimias o fraudes.' },
    { id: 8, text: 'No solicité créditos nuevos ni acepté compras a meses sin una justificación indispensable.' },
  ];

  const completedCount = Object.values(checkedHabits).filter(Boolean).length;
  const habitScore = Math.round((completedCount / habits.length) * 100);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Centro de Diagnóstico Avanzado & Guía Buró de Crédito
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Herramientas ejecutivas para proteger tu historial crediticio, negociar con bancos y mantener hábitos blindados.
        </p>
      </div>

      {/* Grid: Buró de Crédito + Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Buró de Crédito Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white">¿Cómo Mejorar Tu Score en Buró de Crédito?</h3>
          </div>
          <p className="text-xs text-slate-300">
            Los 5 factores clave que determinan tu Score crediticio (300 a 850 puntos):
          </p>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="font-bold text-emerald-400 block">1. Historial de Pagos Puntuales (35% del Score)</span>
              <span className="text-slate-300 text-[11px]">Pagar siempre al menos el mínimo antes de la fecha límite es el factor que más peso tiene.</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="font-bold text-teal-400 block">2. Nivel de Utilización de Crédito (30% del Score)</span>
              <span className="text-slate-300 text-[11px]">Mantén tu saldo por debajo del 30% del límite de crédito de cada tarjeta para proyectar solvencia.</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="font-bold text-blue-400 block">3. Antigüedad de las Cuentas (15% del Score)</span>
              <span className="text-slate-300 text-[11px]">No canceles tu tarjeta de crédito más antigua; te otorga historial prolongado.</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="font-bold text-purple-400 block">4. Mix de Créditos & Consultas (20% del Score)</span>
              <span className="text-slate-300 text-[11px]">Evita pedir muchas tarjetas en un mismo mes para no generar consultas duras múltiples.</span>
            </div>
          </div>
        </div>

        {/* Right: Monthly Habits Checklist */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Checklist de Hábitos Financieros</h3>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              {completedCount} de {habits.length} ({habitScore}%)
            </span>
          </div>

          <div className="space-y-2">
            {habits.map((h) => (
              <div
                key={h.id}
                onClick={() => setCheckedHabits({ ...checkedHabits, [h.id]: !checkedHabits[h.id] })}
                className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  checkedHabits[h.id]
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className={`mt-0.5 rounded-full p-0.5 ${checkedHabits[h.id] ? 'bg-emerald-500 text-slate-950' : 'border border-slate-600'}`}>
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span className={`text-xs ${checkedHabits[h.id] ? 'font-medium text-white' : ''}`}>
                  {h.text}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Generator of Negotiation Letter to Bank */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Plantilla de Solicitud de Reestructuración al Banco</h3>
          </div>

          <button
            onClick={handleCopyLetter}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Carta'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Usa este texto formal para enviar a la UNE (Unidad Especializada) de tu banco si necesitas negociar una tasa fija congelada.
        </p>

        <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
          {letterTemplate}
        </pre>
      </div>

    </div>
  );
}
