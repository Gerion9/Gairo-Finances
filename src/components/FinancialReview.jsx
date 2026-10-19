import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, FileSearch, ListFilter,
} from 'lucide-react';
import Modal from './ui/Modal';
import './FinancialReview.css';

const GROUP_ICONS = { dates: CalendarDays, transactions: ListFilter, data: FileSearch };
const INITIAL_ITEMS = 3;
const issueCount = (count) => `${count} ${count === 1 ? 'asunto' : 'asuntos'}`;

function reviewDate(value) {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

export function ReviewLauncher({ review, onOpen }) {
  const titleId = useId();
  if (!review) return null;
  const hasFindings = review.total > 0;

  return (
    <section className="financial-review-launcher" aria-labelledby={titleId}>
      <span className="financial-review-launcher-icon"><ClipboardList size={20} aria-hidden="true" /></span>
      <div className="financial-review-launcher-copy">
        <h2 id={titleId}>{hasFindings ? <><span data-sensitive>{issueCount(review.total)}</span> por revisar</> : 'Sin asuntos detectados en tus registros'}</h2>
        <p>{hasFindings ? 'Fechas, movimientos y datos. Un siguiente paso para cada asunto.' : 'Consulta el alcance de tu revisión y los datos que se tomaron en cuenta.'}</p>
      </div>
      <button type="button" onClick={onOpen} className="financial-review-launcher-action">
        {hasFindings ? 'Empezar revisión' : 'Ver revisión'}<ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}

function ReviewItem({ item, onOpen }) {
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  return (
    <li className={`financial-review-item ${item.tone === 'attention' ? 'has-attention' : ''}`}>
      <div className="financial-review-item-heading">
        <span className="financial-review-item-marker" aria-hidden="true" />
        <h4 data-sensitive>{item.title}</h4>
      </div>
      <p className="financial-review-item-reason" data-sensitive>{item.reason}</p>
      {evidence.length > 0 && (
        <details className="financial-review-evidence">
          <summary><CircleHelp size={14} aria-hidden="true" /><span>En qué se basa</span><ChevronDown size={14} aria-hidden="true" /></summary>
          <ul data-sensitive>{evidence.map((fact, index) => <li key={`${item.id}-evidence-${index}`}>{fact}</li>)}</ul>
        </details>
      )}
      <button type="button" onClick={() => onOpen?.(item)} className="financial-review-item-action">
        {item.actionLabel}<ArrowRight size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function FinancialReview({
  review, open = false, step = 0, onStepChange, onOpenItem, onClose, readOnly = false,
}) {
  const [expandedGroup, setExpandedGroup] = useState(null);
  const titleRef = useRef(null);
  const contentId = useId();
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const groups = review?.groups || [];
  const currentStep = Math.max(0, Math.min(2, Number.isInteger(step) ? step : 0));
  const current = groups[currentStep];
  const currentId = current?.id;

  useEffect(() => {
    if (!open) return undefined;
    setExpandedGroup(null);
    const frame = requestAnimationFrame(() => {
      const heading = titleRef.current;
      if (heading && !heading.closest('[inert]')) heading.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, currentId]);

  if (!review || !current) return null;

  const items = current.items;
  const expanded = expandedGroup === current.id;
  const shownItems = expanded ? items : items.slice(0, INITIAL_ITEMS);
  const Icon = GROUP_ICONS[current.id] || FileSearch;
  const dateLabel = reviewDate(review.asOf);
  const isLastStep = currentStep === groups.length - 1;

  return (
    <Modal isOpen={open} onClose={onClose} title="Tu revisión financiera" description="Fechas, movimientos y datos, un paso a la vez." wide className="financial-review-panel">
      <div className="financial-review-meta">
        <p><span data-sensitive>{issueCount(review.total)} en total</span>{dateLabel && <> · <time dateTime={review.asOf}>Al {dateLabel}</time></>}</p>
        {readOnly && <span className="financial-review-readonly">Solo lectura</span>}
      </div>

      <ol className="financial-review-steps" aria-label="Pasos de la revisión">
        {groups.map((group, index) => (
          <li key={group.id}>
            <button type="button" onClick={() => onStepChange?.(index)} aria-current={index === currentStep ? 'step' : undefined} aria-controls={contentId}>
              <span className="financial-review-step-number" aria-hidden="true">{index + 1}</span>
              <span className="financial-review-step-label">{group.label}<small data-sensitive>{issueCount(group.items.length)}</small></span>
            </button>
          </li>
        ))}
      </ol>

      <motion.section key={current.id} id={contentId} aria-labelledby={titleId} className="financial-review-step-content"
        initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}>
        <div className="financial-review-step-heading">
          <span className="financial-review-step-icon"><Icon size={20} aria-hidden="true" /></span>
          <div><p className="financial-review-step-eyebrow">Paso {currentStep + 1} de {groups.length}</p><h3 ref={titleRef} id={titleId} tabIndex={-1}>{current.title}</h3></div>
        </div>
        <p className="financial-review-step-description">{current.description}</p>

        {items.length > 0 ? (
          <>
            <ul className="financial-review-items">{shownItems.map((item) => <ReviewItem key={item.id} item={item} onOpen={onOpenItem} />)}</ul>
            {items.length > INITIAL_ITEMS && (
              <button type="button" onClick={() => setExpandedGroup(expanded ? null : current.id)} aria-expanded={expanded} className="financial-review-show-all">
                {expanded ? 'Mostrar menos' : <>Ver todos los asuntos <span data-sensitive>({items.length})</span></>}
                <ChevronDown size={15} className={expanded ? 'is-expanded' : ''} aria-hidden="true" />
              </button>
            )}
          </>
        ) : (
          <div className="financial-review-empty">
            <FileSearch size={25} aria-hidden="true" />
            <h4>Sin asuntos detectados en este paso</h4>
            <p>La revisión se limita a los datos registrados. Consulta su alcance para saber qué se pudo revisar.</p>
          </div>
        )}
      </motion.section>

      <details className="financial-review-coverage">
        <summary><CircleHelp size={15} aria-hidden="true" /><span>Alcance de esta revisión</span><ChevronRight size={15} aria-hidden="true" /></summary>
        {review.coverage.length > 0 ? <ul data-sensitive>{review.coverage.map((line, index) => <li key={`coverage-${index}`}>{line}</li>)}</ul> : <p>Se revisan únicamente los datos disponibles en tus registros.</p>}
      </details>

      <div className="financial-review-process-note">
        <p>La lista se actualiza al corregir los datos en su sección. Continuar solo cambia de paso: no resuelve asuntos ni confirma pagos.</p>
        {readOnly && <p>Puedes consultar los asuntos y abrir sus secciones. Los cambios requieren que la cuenta permita editar.</p>}
      </div>

      <footer className="financial-review-footer">
        <button type="button" onClick={() => onStepChange?.(currentStep - 1)} disabled={currentStep === 0} className="financial-review-back"><ArrowLeft size={15} aria-hidden="true" />Volver</button>
        {!isLastStep && <button type="button" onClick={onClose} className="financial-review-close">Cerrar revisión</button>}
        <button type="button" onClick={isLastStep ? onClose : () => onStepChange?.(currentStep + 1)} className="financial-review-next">
          {isLastStep ? 'Cerrar revisión' : 'Continuar'}{!isLastStep && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </footer>
    </Modal>
  );
}
