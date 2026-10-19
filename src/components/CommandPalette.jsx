import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUp, Calculator, CornerDownLeft, Download, FileDown, Layers3, Plus, Search, Settings, Sparkles, Upload, Waypoints, X } from 'lucide-react';
import { NAVIGATION_ITEMS, NAVIGATION_SHORTCUTS, PRIMARY_NAVIGATION } from '../data/navigation.js';
import { actionUnavailableReason } from '../services/actionAvailability.js';
import { normalizeSearch, searchNavigationItems } from '../services/navigationSearch.js';
import useModalFocus from '../hooks/useModalFocus';
import './Navigation.css';

const calculatorItems = [
  ['cat', 'CAT real', 'Costo anual total de un crédito'],
  ['msi', 'Meses sin intereses', 'MSI o descuento de contado'],
  ['windfall', 'Aguinaldo y bonos', 'Distribuye un ingreso extraordinario'],
  ['hormiga', 'Gastos hormiga', 'El costo acumulado de gastos pequeños'],
  ['rule503020', 'Regla 50 / 30 / 20', 'Distribución de tu presupuesto'],
  ['refinance', 'Refinanciamiento', 'Compara el costo de consolidar deudas'],
  ['fire', 'Retiro y libertad financiera', 'Calcula tu objetivo FIRE'],
  ['horas', 'Costo en horas de trabajo', 'Convierte compras en tiempo'],
  ['rentVsBuy', 'Rentar o comprar vivienda', 'Compara escenarios de vivienda'],
  ['realYield', 'Rendimiento real', 'Inflación e impuestos sobre inversiones'],
  ['deductions', 'Deducciones personales', 'Simula deducciones y devolución SAT'],
  ['resico', 'RESICO o actividad profesional', 'Compara regímenes fiscales'],
].map(([calculator, label, description]) => ({ id: 'calc-' + calculator, calculator, label, description, group: 'Calculadoras', icon: Calculator, tab: 'calculators' }));
const actionItems = [
  { id: 'new-transaction', label: 'Registrar movimiento', description: 'Añade un ingreso o gasto', action: 'newTransaction', icon: Plus },
  { id: 'import-statement', label: 'Importar estado de cuenta', description: 'Revisa movimientos de tu banco', action: 'importStatement', icon: Upload },
  { id: 'ask-assistant', label: 'Preguntar al asistente', description: 'Resuelve dudas sobre tus finanzas', action: 'openAssistant', icon: Sparkles },
  { id: 'new-debt', label: 'Añadir una deuda', description: 'Registra un crédito o revisa la conciliación de tu plan', action: 'newDebt', icon: Layers3 },
  { id: 'export-excel', label: 'Exportar a Excel', description: 'Descarga tu libro financiero', action: 'exportExcel', icon: Download },
  { id: 'export-backup', label: 'Descargar respaldo', description: 'Guarda una copia de tus datos', action: 'exportBackup', icon: FileDown },
  { id: 'settings', label: 'Abrir ajustes', description: 'Preferencias, acceso y respaldos', action: 'openSettings', icon: Settings },
  { id: 'pricing', label: 'Explorar Premium', description: 'Conoce las funciones disponibles', action: 'openPricing', icon: Sparkles },
  { id: 'roadmap', label: 'Novedades y próximos pasos', description: 'Consulta los planes de la aplicación', action: 'openRoadmap', icon: Waypoints },
].map(item => ({ ...item, group: 'Acciones rápidas' }));
const allItems = [...actionItems.slice(0, 3), ...NAVIGATION_SHORTCUTS, ...NAVIGATION_ITEMS.map(item => ({ ...item, tab: item.id })), ...calculatorItems, ...actionItems.slice(3)];
const suggestedItems = [...actionItems.slice(0, 3), ...NAVIGATION_SHORTCUTS, ...PRIMARY_NAVIGATION.map(item => ({ ...item, tab: item.id })), actionItems.find(item => item.action === 'openSettings')];

export default function CommandPalette({ isOpen, onClose, onNavigateTab, onAction, readOnly = false, privacyMode = false }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useModalFocus(isOpen, onClose);
  const resultRefs = useRef([]);
  const baseId = useId();
  const listId = baseId + '-results';
  const filtered = useMemo(() => {
    const source = normalizeSearch(query) ? allItems : suggestedItems;
    return searchNavigationItems(source, query);
  }, [query]);

  useEffect(() => {
    if (isOpen) { setQuery(''); setActiveIndex(0); }
  }, [isOpen]);
  useEffect(() => {
    if (isOpen) resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const selectItem = item => {
    if (!item || actionUnavailableReason(item.action, { readOnly, privacyMode })) return;
    onClose();
    if (item.action) onAction?.(item.action);
    else if (item.calculator) onNavigateTab?.(item.tab, { calculator: item.calculator });
    else onNavigateTab?.(item.tab, item.options);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop command-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section ref={dialogRef} className="command-panel sf-command" role="dialog" aria-modal="true" aria-label="Buscar herramientas y acciones" tabIndex={-1} initial={{ opacity: 0, y: -10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
        <div className="command-input-row">
          <Search size={21} aria-hidden="true" />
          <input
            data-autofocus type="text" value={query} placeholder="¿Qué quieres hacer?"
            role="combobox" aria-label="Buscar herramientas, calculadoras y acciones"
            aria-controls={listId} aria-expanded="true" aria-autocomplete="list"
            aria-activedescendant={filtered[activeIndex] ? baseId + '-' + filtered[activeIndex].id : undefined}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                setActiveIndex(index => filtered.length ? (index + delta + filtered.length) % filtered.length : 0);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                selectItem(filtered[activeIndex]);
              } else if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                setActiveIndex(0);
              } else if (event.key === 'End' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                setActiveIndex(Math.max(0, filtered.length - 1));
              }
            }}
          />
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar búsqueda"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="command-results-heading"><span>{query.trim() ? 'Resultados de búsqueda' : 'Accesos directos'}</span><span role="status" aria-live="polite">{query.trim() ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}` : 'Escribe para explorar todo'}</span></div>
        <div className="command-results" role="listbox" id={listId} aria-label="Resultados de búsqueda">
          {filtered.length === 0 ? (
            <div className="command-empty"><Search size={28} aria-hidden="true" /><strong>No encontramos esa herramienta</strong><p>Prueba con “gastos”, “estado de cuenta” o “CAT”.</p></div>
          ) : filtered.map((item, index) => {
            const Icon = item.icon;
            const reason = actionUnavailableReason(item.action, { readOnly, privacyMode });
            return (
              <button
                type="button" role="option" tabIndex={-1} key={item.id} id={baseId + '-' + item.id}
                ref={element => { resultRefs.current[index] = element; }}
                aria-selected={index === activeIndex} aria-disabled={!!reason || undefined} onClick={() => selectItem(item)} onMouseMove={() => { if (index !== activeIndex) setActiveIndex(index); }}
                className={'command-result ' + (index === activeIndex ? 'is-selected' : '')}
              >
                <span className={'command-result-icon ' + (item.icon === Sparkles ? 'is-ai' : '')}><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className="command-result-copy"><strong>{item.label}</strong><small>{reason || item.description}</small></span>
                <span className="command-result-group">{item.group}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <footer className="command-footer"><span><ArrowUp size={12} aria-hidden="true" /><ArrowDown size={12} aria-hidden="true" /> Navegar</span><span><CornerDownLeft size={13} aria-hidden="true" /> Abrir</span><span><kbd>esc</kbd> Cerrar</span></footer>
      </motion.section>
    </div>, document.body,
  );
}
