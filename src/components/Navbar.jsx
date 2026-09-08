import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, ChevronDown, Command, Download, Eye, EyeOff, HelpCircle,
  LayoutDashboard, ListFilter, LogOut, MoreHorizontal, Plus, RefreshCw,
  Search, Settings, Sparkles, Upload, UserRound, Waypoints,
} from 'lucide-react';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS } from '../data/navigation.js';
import Modal from './ui/Modal';
import Brand, { BrandMark } from './Brand';

export default function Navbar({
  activeTab, setActiveTab, exchangeRateData, onRefreshRate, displayCurrency,
  setDisplayCurrency, privacyMode, setPrivacyMode, onOpenCommandPalette,
  onOpenSettings, onOpenPricing, onOpenOnboarding, onOpenRoadmap, onLogout,
  financialData, onQuickAdd, onOpenAssistant, onImportStatement, isCurrent = () => true, readOnly = false,
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
  const navigate = id => {
    setMenuOpen(false);
    setActiveTab(id);
  };
  const runAction = callback => {
    setMenuOpen(false);
    callback?.();
  };
  const openAssistant = () => runAction(onOpenAssistant || (() => navigate('assistant')));
  const quickAdd = () => { if (!readOnly) runAction(onQuickAdd || (() => navigate('transactions'))); };
  const importStatement = () => { if (!readOnly) runAction(onImportStatement || (() => navigate('statements'))); };
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError('');
    try {
      await onRefreshRate?.();
    } catch {
      setRefreshError('No se pudo actualizar. Intenta de nuevo.');
    } finally {
      setIsRefreshing(false);
    }
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
    } catch {
      setExportStatus('error');
    } finally {
      exporting.current = false;
    }
  };
  const handleSkipToContent = event => {
    event.preventDefault();
    const mainContent = document.getElementById('main-content');
    mainContent?.focus({ preventScroll: true });
    mainContent?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const isMoreActive = !['dashboard', 'transactions', 'assistant'].includes(activeTab);

  const renderNavigation = (mobile = false) => NAVIGATION_GROUPS.map(group => (
    <div className="navigation-group" key={group}>
      <p className="navigation-group-label">{group}</p>
      <div className={mobile ? 'mobile-route-grid' : undefined}>
        {NAVIGATION_ITEMS.filter(item => item.group === group).map(item => {
          const Icon = item.icon;
          return (
            <button
              type="button" key={item.id} onClick={() => navigate(item.id)}
              className={'navigation-item ' + (activeTab === item.id ? 'is-active ' : '') + (item.accent === 'ai' ? 'navigation-item-ai' : '')}
              aria-current={activeTab === item.id ? 'page' : undefined}
              title={item.description}
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              <span>{item.label}</span>
              {item.id === 'assistant' && <span className="navigation-ai-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  ));

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={handleSkipToContent}>Ir al contenido</a>
      <aside className="app-sidebar print:hidden">
        <button type="button" className="brand-lockup" onClick={() => navigate('dashboard')} aria-label="Sifran, ir al resumen">
          <Brand className="h-9 w-auto" decorative />
        </button>
        <nav className="sidebar-navigation" aria-label="Navegación principal">{renderNavigation()}</nav>
        <div className="sidebar-bottom">
          <button type="button" className="sidebar-premium" onClick={onOpenPricing}>
            <span className="premium-icon"><Sparkles size={18} aria-hidden="true" /></span>
            <span><strong>Un paso más allá</strong><small>Explora Sifran Premium</small></span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <div className="sidebar-utilities">
            <button type="button" onClick={onOpenSettings}><Settings size={17} aria-hidden="true" /> Ajustes</button>
            <button type="button" onClick={onOpenOnboarding} className="icon-button" aria-label="Abrir guía de inicio"><HelpCircle size={18} aria-hidden="true" /></button>
          </div>
        </div>
      </aside>

      <header className="app-topbar print:hidden">
        <div className="topbar-location">
          <span className="topbar-mobile-brand" aria-hidden="true"><BrandMark size={22} /></span>
          <span className="topbar-breadcrumb">Mi espacio <span>/</span></span>
          <span className="topbar-page">{currentItem.label}</span>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={onOpenCommandPalette} className="topbar-search" aria-label="Buscar herramientas y acciones, Control K">
            <Search size={17} aria-hidden="true" /><span>Buscar cualquier cosa</span><kbd><Command size={11} aria-hidden="true" /> K</kbd>
          </button>
          <div className="topbar-divider" aria-hidden="true" />
          <button
            type="button" className={'icon-button ' + (privacyMode ? 'privacy-active' : '')}
            onClick={() => setPrivacyMode(!privacyMode)} aria-pressed={privacyMode}
            aria-label={privacyMode ? 'Mostrar importes' : 'Ocultar importes'}
            title={privacyMode ? 'Mostrar importes' : 'Ocultar importes'}
          >
            {privacyMode ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="button-primary topbar-add" disabled={readOnly} onClick={quickAdd}><Plus size={17} aria-hidden="true" /> Añadir</button>
          <button type="button" className="profile-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú de cuenta y herramientas" aria-expanded={menuOpen}>
            <span aria-hidden="true">{profileInitial || <UserRound size={16} />}</span><ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="mobile-bottom-nav print:hidden" aria-label="Navegación móvil">
        <button type="button" className={activeTab === 'dashboard' ? 'is-active' : ''} onClick={() => navigate('dashboard')} aria-current={activeTab === 'dashboard' ? 'page' : undefined}><LayoutDashboard size={20} aria-hidden="true" /><span>Resumen</span></button>
        <button type="button" className={activeTab === 'transactions' ? 'is-active' : ''} onClick={() => navigate('transactions')} aria-current={activeTab === 'transactions' ? 'page' : undefined}><ListFilter size={20} aria-hidden="true" /><span>Movimientos</span></button>
        <button type="button" className="mobile-add" disabled={readOnly} onClick={quickAdd}><span className="mobile-add-icon"><Plus size={22} aria-hidden="true" /></span><span>Añadir</span></button>
        <button type="button" className={activeTab === 'assistant' ? 'is-active' : ''} onClick={openAssistant} aria-current={activeTab === 'assistant' ? 'page' : undefined}><Sparkles size={20} aria-hidden="true" /><span>Asistente</span></button>
        <button type="button" className={isMoreActive || menuOpen ? 'is-active' : ''} onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}><MoreHorizontal size={22} aria-hidden="true" /><span>Más</span></button>
      </nav>

      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Todo tu espacio" description="Tus herramientas y preferencias, a un toque." className="navigation-sheet" wide>
        <div className="sheet-quick-actions">
          <button type="button" className="button-primary" disabled={readOnly} onClick={quickAdd}><Plus size={17} aria-hidden="true" /> Movimiento</button>
          <button type="button" className="button-secondary" disabled={readOnly} onClick={importStatement}><Upload size={17} aria-hidden="true" /> Estado de cuenta</button>
          <button type="button" className="button-secondary" onClick={openAssistant}><Sparkles size={17} aria-hidden="true" /> Asistente</button>
        </div>
        <nav aria-label="Todas las herramientas" className="sheet-navigation">{renderNavigation(true)}</nav>
        <div className="sheet-preferences">
          <div>
            <p className="eyebrow">Moneda de visualización</p>
            <div className="currency-control" role="group" aria-label="Moneda de visualización">
              {[['MXN', 'MXN'], ['USD', 'USD'], ['ORIGINAL', 'Original']].map(([id, label]) => (
                <button type="button" key={id} disabled={readOnly} onClick={() => setDisplayCurrency(id)} aria-pressed={displayCurrency === id}>{label}</button>
              ))}
            </div>
          </div>
          <div className="exchange-control">
            <span className="eyebrow">Tipo de cambio USD / MXN</span>
            <div><strong>{Number.isFinite(exchangeRateData?.rate) ? exchangeRateData.rate.toFixed(2) : 'Sin actualizar'}</strong><button type="button" className="icon-button" onClick={handleRefresh} disabled={isRefreshing} aria-label="Actualizar tipo de cambio"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
            <small>{exchangeRateData?.isManual ? 'Valor manual' : exchangeRateData?.source || 'Fuente pendiente'}</small>
            {refreshError && <p role="status" className="text-xs text-rose-300">{refreshError}</p>}
          </div>
        </div>
        <div className="sheet-account-actions">
          <button type="button" onClick={() => runAction(onOpenSettings)}><Settings size={17} aria-hidden="true" /> Ajustes</button>
          <button type="button" onClick={handleExportExcel} disabled={exportStatus === 'loading'} aria-busy={exportStatus === 'loading'}><Download size={17} aria-hidden="true" /> {exportStatus === 'loading' ? 'Preparando Excel…' : 'Exportar Excel'}</button>
          <button type="button" onClick={() => runAction(onOpenOnboarding)}><HelpCircle size={17} aria-hidden="true" /> Guía de inicio</button>
          <button type="button" onClick={() => runAction(onOpenRoadmap)}><Waypoints size={17} aria-hidden="true" /> Novedades y planes</button>
          <button type="button" onClick={() => runAction(onOpenPricing)}><Sparkles size={17} aria-hidden="true" /> Explorar Premium</button>
          <button type="button" className="logout-action" onClick={() => runAction(onLogout)}><LogOut size={17} aria-hidden="true" /> Cerrar sesión</button>
        </div>
        {exportStatus === 'error' && <p role="alert" className="mt-3 text-xs text-rose-300">No pudimos generar el archivo Excel. Intenta exportarlo de nuevo.</p>}
        {exportStatus === 'success' && <p role="status" className="mt-3 text-xs text-emerald-300">Se inició la descarga del archivo Excel.</p>}
      </Modal>
    </>
  );
}
