import React, { useEffect, useId, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CreditCard, PieChart, ReceiptText } from 'lucide-react';
import Modal from './ui/Modal';
import './DashboardOverview.css';

const STEPS = [
  {
    id: 'budget',
    label: 'Presupuesto',
    icon: PieChart,
    title: 'Define tu presupuesto',
    description: 'Reúne tus ingresos, gastos y compromisos. Con esos datos, tu resumen muestra el margen mensual estimado y cómo se calcula.',
    destination: 'Presupuesto',
    hint: 'Aquí configuras las cifras de tu mes. Los movimientos reales se registran por separado.',
  },
  {
    id: 'debts',
    label: 'Deudas y plan',
    icon: CreditCard,
    title: 'Registra tus deudas y fechas',
    description: 'Agrega saldos, pagos mínimos y fechas en Deudas. En el Plan de pagos puedes revisar vencimientos y explorar cómo se distribuyen tus pagos.',
    destination: 'Deudas → Plan de pagos',
    hint: 'Completar los datos de cada deuda permite distinguir lo registrado de lo que todavía falta por conocer.',
  },
  {
    id: 'transactions',
    label: 'Movimientos',
    icon: ReceiptText,
    title: 'Registra tus ingresos y gastos',
    description: 'Registra ingresos y gastos en Movimientos, o importa un estado de cuenta. Después revisa tu actividad junto al presupuesto para entender tu mes.',
    destination: 'Movimientos',
    hint: 'El botón Registrar movimiento está a mano desde tu resumen. Puedes volver a esta guía desde tu cuenta.',
  },
];

export default function OnboardingModal({ isOpen, onClose, onNavigateTab }) {
  const [step, setStep] = useState(0);
  const contentId = useId();
  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;
  const continueGuide = () => {
    if (!isLastStep) {
      setStep((currentStep) => Math.min(currentStep + 1, STEPS.length - 1));
      return;
    }
    onClose?.();
    onNavigateTab?.('budget');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Un lugar para cada decisión" description="Conoce tu espacio en tres pasos. Puedes recorrerlo a tu ritmo." className="onboarding-panel">
      <ol className="onboarding-progress" aria-label="Pasos de la guía">
        {STEPS.map((item, index) => (
          <li key={item.id} aria-current={step === index ? 'step' : undefined}>
            <span className="onboarding-progress-track" aria-hidden="true"><motion.span initial={false} animate={{ scaleX: index <= step ? 1 : 0 }} transition={{ duration: 0.2 }} /></span>
            <span className="onboarding-progress-label">{index < step ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">{index + 1}.</span>}{item.label}</span>
          </li>
        ))}
      </ol>
      <div id={contentId} aria-live="polite" aria-atomic="true">
        <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="onboarding-step-content">
          <span className="onboarding-step-icon"><Icon size={24} aria-hidden="true" /></span>
          <p className="onboarding-step-count">Paso {step + 1} de {STEPS.length}</p>
          <h3>{current.title}</h3>
          <p className="onboarding-step-description">{current.description}</p>
          <div className="onboarding-route-hint"><ArrowRight size={16} aria-hidden="true" /><p>{current.destination}<span>{current.hint}</span></p></div>
        </motion.div>
      </div>
      <div className="onboarding-footer">
        <button type="button" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} disabled={step === 0} aria-controls={contentId} className="onboarding-back"><ArrowLeft size={15} aria-hidden="true" />Anterior</button>
        <motion.button type="button" onClick={continueGuide} data-autofocus aria-controls={!isLastStep ? contentId : undefined} whileTap={{ scale: 0.98 }} className="onboarding-continue">{isLastStep ? onNavigateTab ? 'Ir a mi presupuesto' : 'Comenzar' : 'Siguiente'}<ArrowRight size={16} aria-hidden="true" /></motion.button>
      </div>
      <button type="button" onClick={onClose} className="onboarding-skip">{isLastStep ? 'Cerrar guía' : 'Explorar por mi cuenta'}</button>
    </Modal>
  );
}
