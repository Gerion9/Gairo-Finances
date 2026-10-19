import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarClock, CreditCard, Landmark, ReceiptText, Upload } from 'lucide-react';
import { actionUnavailableReason } from '../services/actionAvailability.js';

export default function WorkspaceWelcome({ onNavigate, onQuickAdd, onNewDebt, onImportBackup, readOnly = false }) {
  const reasonId = useId();
  const reducedMotion = useReducedMotion();
  const tasks = [
    { id: 'movement', icon: ReceiptText, title: 'Registrar un movimiento', text: 'Un ingreso o gasto que ya ocurrió.', action: 'newTransaction', run: onQuickAdd },
    { id: 'receivable', icon: CalendarClock, title: 'Seguir un cobro', text: 'Dinero que tienes pendiente de recibir.', run: () => onNavigate?.('transactions', { view: 'expected' }) },
    { id: 'debt', icon: CreditCard, title: 'Organizar una deuda', text: 'Su saldo y las fechas que necesitas tener presentes.', action: 'newDebt', run: onNewDebt },
    { id: 'products', icon: Landmark, title: 'Explorar productos financieros', text: 'Tarjetas, préstamos y opciones de ahorro.', run: () => onNavigate?.('credit-library') },
  ];
  const reason = actionUnavailableReason('newTransaction', { readOnly });
  const restoreReason = actionUnavailableReason('openSettings', { readOnly });
  return <div className="workspace-welcome">
    <header className="welcome-heading"><h1 tabIndex={-1}>Empieza por lo que necesitas</h1><p>Elige una tarea; completa tus datos cuando los necesites.</p></header>
    <div className="welcome-tasks">{tasks.map(({ id, icon: Icon, title, text, action, run }) => {
      const unavailable = action ? actionUnavailableReason(action, { readOnly }) : '';
      return <motion.button key={id} type="button" className="welcome-task" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.16 }} disabled={Boolean(unavailable)} aria-describedby={unavailable ? reasonId : undefined} onClick={run}>
        <span className="welcome-task-icon"><Icon size={21} aria-hidden="true" /></span><span className="welcome-task-copy"><strong>{title}</strong><span>{text}</span></span><ArrowRight size={18} aria-hidden="true" />
      </motion.button>;
    })}</div>
    {reason && <p id={reasonId} className="welcome-action-reason">{reason}</p>}
    <div className="welcome-secondary"><button type="button" className="button-ghost" onClick={() => onNavigate?.('budget')}>Configurar mi presupuesto<ArrowRight size={16} aria-hidden="true" /></button>
      {onImportBackup && <button type="button" className="button-ghost welcome-restore" disabled={Boolean(restoreReason)} aria-describedby={restoreReason ? reasonId : undefined} onClick={onImportBackup}><Upload size={16} aria-hidden="true" />Ya tengo un respaldo de mis registros</button>}
    </div>
  </div>;
}
