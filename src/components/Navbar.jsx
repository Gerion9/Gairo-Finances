import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, ChevronDown, Download, Eye, EyeOff, Grid2X2, HelpCircle,
  LogOut, Plus, RefreshCw, Search, Settings, Sparkles, UserRound, Waypoints,
} from 'lucide-react';
import { getPrimaryNavigationId, NAVIGATION_ITEMS, PRIMARY_NAVIGATION } from '../data/navigation.js';
import Modal from './ui/Modal';
import Brand, { BrandMark } from './Brand';
import './Navigation.css';

const mobileDestinations = ['dashboard', 'plan', 'transactions', 'tools'];
const navTransition = { type: 'spring', stiffness: 420, damping: 38 };

export default function Navbar({
  activeTab, setActiveTab, exchangeRateData, onRefreshRate, displayCurrency,
  setDisplayCurrency, privacyMode, setPrivacyMode, onOpenCommandPalette,
  onOpenSettings, onOpenPricing, onOpenOnboarding, onOpenRoadmap, onLogout,
  financialData, onQuickAdd, onOpenAssistant, isCurrent = () => true, readOnly = false,
}) {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [exportStatus, setExportStatus] = useState('idle');
  const exporting = useRef(false);
  const profileName = typeof financialData?.profileName === 'string' ? financialData.profileName.trim() : '';
  const profileInitial = Array.from(profileName)[0]?.toLocaleUpperCase('es-MX');
  const currentItem = NAVIGATION_ITEMS.find(item => item.id === activeTab) || NAVIGATION_ITEMS[0];
  const primaryId = getPrimaryNavigationId(activeTab);
  const primaryItem = PRIMARY_NAVIGATION.find(item => item.id === primaryId);
  const pendingDebtsCount = Array.isArray(financialData?.deudasPendientes) ? financialData.deudasPendientes.length : 0;

  const navigate = id => { setMenuOpen(false); setActiveTab(id); };
  const runAction = callback => { setMenuOpen(false); callback?.(); };
  const openAssistant = () => runAction(onOpenAssistant || (() => navigate('assistant')));
  const quickAdd = () => { if (!readOnly) runAction(onQuickAdd || (() => navigate('transactions'))); };
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError('');
    try { await onRefreshRate?.(); }
    catch { if (alive.current && isCurrent()) setRefreshError('No se pudo actualizar. Intenta de nuevo.'); }
    finally { if (alive.current) setIsRefreshing(false); }
  };
  const handleExportExcel = async () => {
    if (exporting.current) return;
    exporting.current = true;
    setExportStatus('loading');
    try {
      const { exportFinancesToExcel } = await import('../services/excelExport.js');
      if (!alive.current || !isCurrent()) return;
      exportFinancesToExcel(financialData, exchangeRateData?.rate || 19.25);
      setExportStatus('success');
    } catch { if (alive.current && isCurrent()) setExportStatus('error'); }
    finally { exporting.current = false; }
  };
  const handleSkipToContent = event => {
    event.preventDefault();
    const mainContent = document.getElementById('main-content');
    mainContent?.focus({ preventScroll: true });
    mainContent?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={handleSkipToContent}>Ir al contenido</a>
      <aside className="app-sidebar sf-nav-sidebar print:hidden">
        <button type="button" className="brand-lockup sf-nav-brand" onClick={() => navigate('dashboard')} aria-label="Sifran, ir al resumen">
          <Brand className="h-9 w-auto" decorative />
        </button>
        <div className="sf-nav-scroll">
          <p className="sf-nav-section-label">Tu espacio financiero</p>
          <nav className="sf-nav-primary" aria-label="Navegación principal">
            {PRIMARY_NAVIGATION.map(item => {
              const Icon = item.icon;
              const isActive = primaryId === item.id;
              return (
                <motion.button type="button" key={item.id} onClick={() => navigate(item.id)}
                  className={`sf-nav-destination ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined} whileTap={{ scale: 0.985 }}>
                  {isActive && <motion.span className="sf-nav-active-surface" layoutId="sifran-sidebar-active" transition={navTransition} aria-hidden="true" />}
                  <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                  <span className="sf-nav-destination-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
                  {item.id === 'plan' && pendingDebtsCount > 0 && <span className="sf-nav-pending" title={`${pendingDebtsCount} deudas por completar`} aria-label={`${pendingDebtsCount} deudas por completar`}>{pendingDebtsCount}</span>}
                </motion.button>
              );
            })}
          </nav>
          <div className="sf-nav-assistant-area">
            <motion.button type="button" onClick={openAssistant} className={`sf-nav-destination sf-nav-assistant ${activeTab === 'assistant' ? 'is-active' : ''}`} aria-current={activeTab === 'assistant' ? 'page' : undefined} whileTap={{ scale: 0.985 }}>
              <Sparkles size={20} strokeWidth={1.7} aria-hidden="true" />
              <span className="sf-nav-destination-copy"><strong>Asistente IA</strong><small>Resuelve tus dudas</small></span>
              <ArrowRight size={15} aria-hidden="true" />
            </motion.button>
          </div>
        </div>
        <div className="sf-nav-utilities">
          <button type="button" onClick={onOpenOnboarding}><HelpCircle size={18} aria-hidden="true" /><span>Guía de inicio</span></button>
          <button type="button" onClick={onOpenSettings}><Settings size={18} aria-hidden="true" /><span>Ajustes</span></button>
        </div>
      </aside>

      <header className="app-topbar sf-nav-topbar print:hidden">
        <div className="sf-nav-location">
          <span className="sf-nav-mobile-brand" aria-hidden="true"><BrandMark size={24} /></span>
          {primaryItem && primaryItem.id !== activeTab && <><button type="button" className="sf-nav-parent" onClick={() => navigate(primaryItem.id)}>{primaryItem.label}</button><span className="sf-nav-location-separator" aria-hidden="true">/</span></>}
          <span className="sf-nav-current-page">{currentItem.label}</span>
        </div>
        <div className="sf-nav-topbar-actions">
          <button type="button" onClick={onOpenCommandPalette} className="sf-nav-search" aria-label="Buscar herramientas y acciones, Control K" aria-keyshortcuts="Control+k Meta+k">
            <Search size={19} aria-hidden="true" /><span>Buscar en Sifran</span><kbd>Ctrl K</kbd>
          </button>
          <div className="sf-nav-currency-quick" role="group" aria-label="Moneda rápida">
            {[['MXN', 'MXN'], ['USD', 'USD'], ['ORIGINAL', 'Original']].map(([id, label]) => (
              <button type="button" key={id} disabled={readOnly} onClick={() => setDisplayCurrency(id)} aria-pressed={displayCurrency === id}>{label}</button>
            ))}
          </div>
          <button type="button" className={`icon-button sf-nav-privacy ${privacyMode ? 'privacy-active' : ''}`}
            onClick={() => setPrivacyMode(!privacyMode)} aria-pressed={privacyMode}
            aria-label={privacyMode ? 'Mostrar información' : 'Ocultar información'} title={privacyMode ? 'Mostrar información' : 'Ocultar información'}>
            {privacyMode ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
          <motion.button type="button" className="button-primary sf-nav-add" aria-label="Registrar movimiento" disabled={readOnly || privacyMode} onClick={quickAdd} whileTap={{ scale: 0.97 }}><Plus size={18} aria-hidden="true" /><span>Registrar<span className="sf-nav-add-detail"> movimiento</span></span></motion.button>
          <button type="button" className="sf-nav-profile" onClick={() => setMenuOpen(true)} aria-label="Abrir cuenta y preferencias" aria-haspopup="dialog" aria-expanded={menuOpen}>
            <span aria-hidden="true">{profileInitial || <UserRound size={17} />}</span><ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="sf-nav-mobile print:hidden" aria-label="Navegación móvil">
        {mobileDestinations.map(id => {
          const item = PRIMARY_NAVIGATION.find(destination => destination.id === id);
          const Icon = item.icon;
          const isActive = primaryId === id;
          return (
            <motion.button type="button" key={id} className={isActive ? 'is-active' : ''} onClick={() => navigate(id)} aria-current={isActive ? 'page' : undefined} whileTap={{ scale: 0.96 }}>
              {isActive && <motion.span className="sf-nav-mobile-active" layoutId="sifran-mobile-active" transition={navTransition} aria-hidden="true" />}
              <Icon size={21} strokeWidth={1.8} aria-hidden="true" /><span>{id === 'plan' ? 'Plan' : item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Cuenta y preferencias" description={profileName || 'Personaliza tu espacio y administra tus datos.'} className="sf-nav-account">
        <button type="button" className="sf-nav-directory-link" onClick={() => navigate('tools')}><Grid2X2 size={20} aria-hidden="true" /><span><strong>Explorar herramientas</strong><small>Todo lo que puedes hacer en Sifran</small></span><ArrowRight size={18} aria-hidden="true" /></button>
        <div className="sf-nav-preferences">
          <div>
            <p className="sf-nav-preference-label">Moneda de visualización</p>
            <div className="sf-nav-currency" role="group" aria-label="Moneda de visualización">
              {[['MXN', 'MXN'], ['USD', 'USD'], ['ORIGINAL', 'Original']].map(([id, label]) => (
                <button type="button" key={id} disabled={readOnly} onClick={() => setDisplayCurrency(id)} aria-pressed={displayCurrency === id}>{label}</button>
              ))}
            </div>
          </div>
          <div className="sf-nav-exchange">
            <p className="sf-nav-preference-label">Tipo de cambio USD / MXN</p>
            <div><strong>{Number.isFinite(exchangeRateData?.rate) ? exchangeRateData.rate.toFixed(2) : 'Sin actualizar'}</strong><button type="button" className="icon-button" onClick={handleRefresh} disabled={isRefreshing} aria-label="Actualizar tipo de cambio"><RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
            <small>{exchangeRateData?.isManual ? 'Valor manual' : exchangeRateData?.source || 'Fuente pendiente'}</small>
            {refreshError && <p role="status" className="sf-nav-status is-error">{refreshError}</p>}
          </div>
        </div>
        <div className="sf-nav-account-actions">
          <button type="button" onClick={() => runAction(onOpenSettings)}><Settings size={18} aria-hidden="true" /> Ajustes y respaldos</button>
          <button type="button" onClick={handleExportExcel} disabled={exportStatus === 'loading'} aria-busy={exportStatus === 'loading'}><Download size={18} aria-hidden="true" /> {exportStatus === 'loading' ? 'Preparando Excel…' : 'Exportar a Excel'}</button>
          <button type="button" onClick={() => runAction(onOpenOnboarding)}><HelpCircle size={18} aria-hidden="true" /> Guía de inicio</button>
          <button type="button" onClick={() => runAction(onOpenRoadmap)}><Waypoints size={18} aria-hidden="true" /> Novedades y planes</button>
          <button type="button" onClick={() => runAction(onOpenPricing)}><Sparkles size={18} aria-hidden="true" /> Funciones Premium</button>
          <button type="button" className="sf-nav-logout" onClick={() => runAction(onLogout)}><LogOut size={18} aria-hidden="true" /> Cerrar sesión</button>
        </div>
        {exportStatus === 'error' && <p role="alert" className="sf-nav-status is-error">No pudimos generar el archivo Excel. Intenta exportarlo de nuevo.</p>}
        {exportStatus === 'success' && <p role="status" className="sf-nav-status">Se inició la descarga del archivo Excel.</p>}
      </Modal>
    </>
  );
}
