import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Download, FileDown, Layers3, Plus, Search, Settings,
  Sparkles, Upload, Waypoints, X,
} from 'lucide-react';
import { NAVIGATION_ITEMS, NAVIGATION_SHORTCUTS } from '../data/navigation.js';
import { actionUnavailableReason } from '../services/actionAvailability.js';
import { normalizeSearch as normalize } from '../services/navigationSearch.js';
import './Navigation.css';

const goals = [
  { id: 'organize', label: 'Organizar mi dinero', description: 'Conoce tu punto de partida y lleva el control de cada mes.', routes: ['dashboard', 'transactions', 'budget', 'statements'] },
  { id: 'repay', label: 'Pagar mis deudas', description: 'Ordena tus compromisos y decide tu siguiente pago.', routes: ['plan', 'debts', 'calendar', 'simulator'] },
  { id: 'grow', label: 'Cuidar mi patrimonio', description: 'Revisa tu balance, tus ahorros y tu progreso.', routes: ['balance', 'investments', 'health', 'report'] },
  { id: 'decide', label: 'Aprender y decidir', description: 'Resuelve dudas, compara opciones y construye hábitos.', routes: ['credit-library', 'assistant', 'calculators', 'tax-annual', 'diagnostics', 'education'] },
];
const calculatorKeywords = 'CAT MSI FIRE refinanciamiento gastos hormiga aguinaldo bonos rentar comprar vivienda rendimiento real RESICO deducciones 50 30 20 horas trabajo retiro';
const quickActions = [
  { id: 'newTransaction', label: 'Registrar movimiento', description: 'Añade un ingreso o gasto', icon: Plus, goal: 'organize', writes: true },
  { id: 'importStatement', label: 'Importar estado de cuenta', description: 'Carga los movimientos de tu banco', icon: Upload, goal: 'organize', writes: true },
  { id: 'newDebt', label: 'Añadir una deuda', description: 'Registra una tarjeta o préstamo', icon: Layers3, goal: 'repay', writes: true },
  { id: 'openAssistant', label: 'Preguntar al asistente', description: 'Conversa sobre tus finanzas', icon: Sparkles, goal: 'decide' },
  ...NAVIGATION_SHORTCUTS,
];
const accountActions = [
  { id: 'exportExcel', label: 'Exportar a Excel', description: 'Descarga tu libro financiero', icon: Download },
  { id: 'exportBackup', label: 'Descargar respaldo', description: 'Guarda una copia de tus datos', icon: FileDown },
  { id: 'openSettings', label: 'Ajustes y respaldos', description: 'Preferencias, acceso y restauración', icon: Settings },
  { id: 'openRoadmap', label: 'Novedades y planes', description: 'Consulta la evolución de Sifran', icon: Waypoints },
];

export default function ToolsDirectory({ onNavigateTab, onAction, hasPaymentPlan = false, readOnly = false, privacyMode = false,
  viewState, onViewStateChange, onRememberLocation, restorePoint, active = true }) {
  const [localView, setLocalView] = useState({ query: '', goal: 'all' });
  const { query = '', goal = 'all' } = viewState ?? localView;
  const updateView = patch => onViewStateChange ? onViewStateChange(patch) : setLocalView(previous => ({ ...previous, ...patch }));
  const setQuery = query => updateView({ query });
  const setGoal = goal => updateView({ goal });
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const restoredRequest = useRef(null);
  const searchRef = useRef(null);
  const headingId = useId();
  const searchId = useId();
  useEffect(() => {
    if (!active || !restorePoint || restoredRequest.current === restorePoint.request) return;
    const frame = requestAnimationFrame(() => {
      restoredRequest.current = restorePoint.request;
      const focused = document.activeElement;
      if (focused !== restorePoint.focusOrigin && focused !== document.body && focused?.id !== 'main-content') return;
      const target = [...(sectionRef.current?.querySelectorAll('[data-directory-target]') || [])]
        .find(element => element.dataset.directoryTarget === restorePoint.target);
      (target || headingRef.current)?.focus({ preventScroll: true });
      window.scrollTo({ top: restorePoint.scrollY, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, restorePoint]);
  const leave = (target, run) => {
    onRememberLocation?.({ target, scrollY: window.scrollY });
    run();
  };
  const terms = useMemo(() => normalize(query).split(/\s+/).filter(Boolean), [query]);
  const matches = (...values) => {
    const content = normalize(values.filter(Boolean).join(' '));
    return terms.every(term => content.includes(term));
  };
  const sections = goals.filter(section => goal === 'all' || section.id === goal).map(section => ({
    ...section,
    items: section.routes.map(id => NAVIGATION_ITEMS.find(item => item.id === id)).filter(item =>
      matches(item.label, item.description, section.label, item.id === 'calculators' ? calculatorKeywords : '')),
  })).filter(section => section.items.length);
  const actions = quickActions.map(action => action.id === 'newDebt' && hasPaymentPlan
    ? { ...action, label: 'Actualizar conciliación', description: 'Revisa saldos y datos de tu plan' }
    : action).filter(action => (goal === 'all' || action.goal === goal) && matches(action.label, action.description, action.keywords));
  const dataActions = goal === 'all' || goal === 'manage' ? accountActions.filter(action => matches(action.label, action.description)) : [];
  const resultCount = sections.reduce((count, section) => count + section.items.length, 0) + actions.length + dataActions.length;
  const resetSearch = () => { updateView({ query: '', goal: 'all' }); searchRef.current?.focus(); };

  return (
    <section ref={sectionRef} className="sf-tools" aria-labelledby={headingId}>
      <header className="sf-tools-heading">
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>¿Qué quieres hacer?</h1>
        <p>Busca una tarea o explora por objetivo.</p>
      </header>

      <div className="sf-tools-finder">
        <label htmlFor={searchId} className="sr-only">Buscar herramientas y acciones</label>
        <div className="sf-tools-search">
          <Search size={21} aria-hidden="true" />
          <input id={searchId} ref={searchRef} type="search" value={query} placeholder="Busca una herramienta, acción o tema…" onChange={event => setQuery(event.target.value)} />
          {query && <button type="button" className="icon-button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Limpiar búsqueda"><X size={18} aria-hidden="true" /></button>}
        </div>
        <div className="sf-tools-filters" role="group" aria-label="Filtrar por objetivo">
          {[{ id: 'all', label: 'Todo' }, ...goals, { id: 'manage', label: 'Mis datos' }].map(filter => (
            <button type="button" key={filter.id} aria-pressed={goal === filter.id} onClick={() => setGoal(filter.id)}>{filter.label}</button>
          ))}
        </div>
        <label className="sf-tools-goal-select" htmlFor={`${searchId}-goal`}>Objetivo
          <select id={`${searchId}-goal`} value={goal} onChange={event => setGoal(event.target.value)}>
            {[{ id: 'all', label: 'Todo' }, ...goals, { id: 'manage', label: 'Mis datos' }].map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
          </select>
        </label>
      </div>

      <p className="sf-tools-result-count" role="status" aria-live="polite">{query || goal !== 'all' ? `${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}` : 'Empieza con una acción o explora por objetivo.'}</p>
      {readOnly && <p className="sf-tools-availability">La edición está pausada. Puedes buscar y abrir herramientas; revisa el aviso de tu espacio para volver a editar.</p>}

      {actions.length > 0 && <section className="sf-tools-quick-section" aria-label="Acciones rápidas">
        <div className="sf-tools-quick-grid">
          {actions.map(action => {
            const Icon = action.icon;
            const reason = actionUnavailableReason(action.id, { readOnly, privacyMode });
            return <motion.button type="button" key={action.id} data-directory-target={`action:${action.id}`} className={`sf-tools-quick-action ${action.id === 'openAssistant' ? 'is-assistant' : ''}`} disabled={!!reason} onClick={() => leave(`action:${action.id}`, () => action.tab ? onNavigateTab?.(action.tab, action.options) : onAction?.(action.id))} whileHover={reason ? undefined : { y: -2 }} whileTap={reason ? undefined : { scale: 0.99 }}>
              <span className="sf-tools-action-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
              <span><strong>{action.label}</strong><small>{reason || action.description}</small></span>
            </motion.button>;
          })}
        </div>
      </section>}

      <div className="sf-tools-sections">
        {sections.map(section => <section key={section.id} className="sf-tools-section" aria-labelledby={`${headingId}-${section.id}`}>
          <div className="sf-tools-section-heading"><h2 id={`${headingId}-${section.id}`}>{section.label}</h2><p>{section.description}</p></div>
          <div className="sf-tools-grid">
            {section.items.map(item => {
              const Icon = item.icon;
              return <motion.button type="button" key={item.id} data-directory-target={`route:${item.id}`} className={`sf-tools-card ${item.accent === 'ai' ? 'is-assistant' : ''}`} onClick={() => leave(`route:${item.id}`, () => onNavigateTab?.(item.id))} whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }}>
                <span className="sf-tools-card-top"><span className="sf-tools-card-icon"><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span><ArrowRight className="sf-tools-card-arrow" size={19} aria-hidden="true" /></span>
                <strong>{item.label}</strong><span className="sf-tools-card-description">{item.description}</span>
              </motion.button>;
            })}
          </div>
        </section>)}
      </div>

      {dataActions.length > 0 && <section className="sf-tools-data" aria-labelledby={`${headingId}-data`}>
        <div className="sf-tools-section-heading"><h2 id={`${headingId}-data`}>Tus datos, a la mano</h2><p>Exporta tu información y personaliza tu espacio.</p></div>
        <div className="sf-tools-data-grid">{dataActions.map(action => {
          const Icon = action.icon;
          const reason = actionUnavailableReason(action.id, { readOnly, privacyMode });
          return <button type="button" key={action.id} data-directory-target={`action:${action.id}`} disabled={!!reason} onClick={() => leave(`action:${action.id}`, () => onAction?.(action.id))}><Icon size={19} aria-hidden="true" /><span><strong>{action.label}</strong><small>{reason || action.description}</small></span><ArrowRight size={16} aria-hidden="true" /></button>;
        })}</div>
      </section>}

      {resultCount === 0 && <div className="sf-tools-empty"><Search size={30} aria-hidden="true" /><h2>No encontramos coincidencias</h2><p>Prueba con “presupuesto”, “deudas” o “ahorro”, o vuelve a explorar todas las herramientas.</p><button type="button" className="button-secondary" onClick={resetSearch}>Ver todas las herramientas</button></div>}
    </section>
  );
}
