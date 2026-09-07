import React, { createContext, useContext, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useModalFocus from '../../hooks/useModalFocus';

export const FinancialInteractionLock = createContext(false);

export default function Modal({ isOpen, onClose, title, description, children, className = '', wide = false }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalFocus(isOpen, onClose);
  const syncBlocked = useContext(FinancialInteractionLock);
  useEffect(() => { if (isOpen && syncBlocked) dialogRef.current?.querySelector('[data-sync-recovery]')?.focus(); }, [isOpen, syncBlocked, dialogRef]);
  const reviewSync = () => {
    onClose?.();
    requestAnimationFrame(() => document.getElementById('sync-status')?.focus());
  };
  if (!isOpen) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={dialogRef} className={`modal-panel ${wide ? 'modal-panel-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <header className="modal-heading">
          <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Cerrar ventana"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="modal-body">
          {syncBlocked && <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 mb-5"><p role="alert" className="text-sm text-amber-100">Llegaron cambios desde otro dispositivo. Este formulario está pausado para evitar sobrescribirlos.</p><button type="button" data-sync-recovery className="button-secondary mt-3" onClick={reviewSync}>Cerrar formulario y revisar sincronización</button></div>}
          <div inert={syncBlocked ? '' : undefined} aria-disabled={syncBlocked || undefined}>{children}</div>
        </div>
      </section>
    </div>, document.body,
  );
}
