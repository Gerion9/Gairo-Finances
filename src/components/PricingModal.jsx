import React from 'react';
import { ArrowRight, Check, FileText, Sparkles, Wallet } from 'lucide-react';
import Modal from './ui/Modal';

export default function PricingModal({ isOpen, onClose, onOpenAssistant, onImportStatement }) {
  return <Modal isOpen={isOpen} onClose={onClose} title="Un espacio que crece contigo" description="Tu control financiero, con análisis avanzado cuando lo necesites." wide>
    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-[#223248] p-6 flex flex-col">
        <Wallet className="text-[#7DE4BF] mb-5" size={26} /><p className="eyebrow">Personal</p><h3 className="mt-2 text-2xl font-semibold text-white">Tu día a día, en orden.</h3><p className="mt-3 text-sm leading-relaxed text-slate-400">Tus registros viven en este navegador. Lleva tu presupuesto y explora escenarios con tus propios datos.</p>
        <ul className="space-y-3 text-sm text-slate-300 my-6">{['Movimientos, deudas y calendario', 'Presupuesto y patrimonio en MXN / USD', 'Simuladores y herramientas financieras', 'Importación CSV, respaldo y exportación'].map(text => <li key={text} className="flex gap-2"><Check size={17} className="text-[#7DE4BF] shrink-0" />{text}</li>)}</ul>
        <button className="button-secondary mt-auto justify-center" onClick={onClose}>Seguir explorando</button>
      </section>
      <section className="rounded-2xl border border-[#B8AFF8]/35 bg-gradient-to-br from-[#B8AFF8]/10 to-transparent p-6 flex flex-col">
        <Sparkles className="text-[#B8AFF8] mb-5" size={26} /><p className="eyebrow text-[#B8AFF8]">Análisis con Claude</p><h3 className="mt-2 text-2xl font-semibold text-white">Más claridad para decidir.</h3><p className="mt-3 text-sm leading-relaxed text-slate-400">Pregunta sobre tus números y convierte un estado de cuenta en movimientos que puedes revisar.</p>
        <ul className="space-y-3 text-sm text-slate-300 my-6">{['Conversación con contexto financiero', 'Cifras de respaldo para cada respuesta', 'Extracción de estados de cuenta PDF', 'Revisión editable y posibles duplicados'].map(text => <li key={text} className="flex gap-2"><Check size={17} className="text-[#B8AFF8] shrink-0" />{text}</li>)}</ul>
        <button className="button-primary mt-auto justify-center" onClick={onOpenAssistant}>Configurar Claude<ArrowRight size={16} /></button>
        <button className="button-ghost mt-2 justify-center" onClick={onImportStatement}><FileText size={16} />Explorar estados de cuenta</button>
      </section>
    </div>
    <p className="mt-6 text-sm leading-relaxed text-slate-400">Claude requiere una conexión privada configurada. El consumo se factura en la cuenta de Anthropic del administrador; esta instalación no vende ni activa suscripciones. Los archivos y el resumen financiero solo se envían al solicitar el análisis.</p>
  </Modal>;
}
