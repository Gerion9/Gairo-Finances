import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { AlertTriangle, ArrowRight, ChartNoAxesCombined, Eye, Layers3, Plus, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import Navbar from './components/Navbar';
import DashboardOverview from './components/DashboardOverview';
import CommandPalette from './components/CommandPalette';
import AppErrorBoundary from './components/AppErrorBoundary';
import { useToast } from './components/Toast';
import { FinancialInteractionLock } from './components/ui/Modal.jsx';
import { downloadJSON } from './services/storage.js';
import { emptyFinancialData, hasFinancialRecords } from './services/accountData.js';
import { hasWorkspaceActivity } from './services/workspaceOverview.js';
import { actionUnavailableReason } from './services/actionAvailability.js';
import { fetchExchangeRate } from './services/exchangeRate.js';
import { calculateCashFlow, analyzePromoDeadlines, compareAllStrategies } from './services/financeEngine.js';
import { createAccountBackup, restoreAccountBackup } from './services/backup.js';
import { updateMarketSelections } from './services/marketPreferences.js';
import { createReceivable, updateReceivable, linkReceivableIncome, receiveReceivableIncome, unlinkReceivableIncome, updateTransactionsWithReceivables } from './services/receivables.js';
import { saveDebtRecord } from './services/planning.js';
import PendingDebts from './components/PendingDebts.jsx';
import PlanningOverview from './components/PlanningOverview.jsx';
import { commitPaymentPlan } from './services/commitPaymentPlan.js';
import { balanceDisplayData, managedPlanSections } from './services/planSourceState.js';
import { buildNavigationHash, NAVIGATION_HUBS, NAVIGATION_ITEMS, parseNavigationRoute } from './data/navigation.js';
import PageTransition from './components/ui/PageTransition.jsx';
import WorkspaceWelcome from './components/WorkspaceWelcome.jsx';
import PlanSourceView from './components/PlanSourceView.jsx';
import FinancialReview from './components/FinancialReview.jsx';
import { buildFinancialReview } from './services/financialReview.js';
import { localDateKey } from './services/dashboardAnalytics.js';
import QuickTransaction from './components/QuickTransaction.jsx';
import './components/Workspace.css';

const ToolsDirectory = lazy(() => import('./components/ToolsDirectory.jsx'));
const CreditLibrary = lazy(() => import('./components/CreditLibraryRoute.jsx'));

const PaymentPlan = lazy(() => import('./components/PaymentPlan.jsx'));

const DebtCard = lazy(() => import('./components/DebtCard'));
const DebtModal = lazy(() => import('./components/DebtModal'));
const StrategyPayoff = lazy(() => import('./components/StrategyPayoff'));
const StrategyCompare = lazy(() => import('./components/StrategyCompare'));
const PaymentCalendar = lazy(() => import('./components/PaymentCalendar'));
const TransactionsTracker = lazy(() => import('./components/TransactionsTracker'));
const FinancialHealthScore = lazy(() => import('./components/FinancialHealthScore'));
const FinancialCalculatorsHub = lazy(() => import('./components/FinancialCalculatorsHub'));
const AdvancedDiagnosticsHub = lazy(() => import('./components/AdvancedDiagnosticsHub'));
const PrintableReport = lazy(() => import('./components/PrintableReport'));
const PricingModal = lazy(() => import('./components/PricingModal'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
const Simulator = lazy(() => import('./components/Simulator'));
const IncomeStatement = lazy(() => import('./components/IncomeStatement'));
const BalanceSheet = lazy(() => import('./components/BalanceSheet'));
const Investments = lazy(() => import('./components/Investments'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const Roadmap100Modal = lazy(() => import('./components/Roadmap100Modal'));
const FinancialEducationHub = lazy(() => import('./components/FinancialEducationHub'));
const AnnualTaxSimulator = lazy(() => import('./components/AnnualTaxSimulator'));
const FinancialAssistant = lazy(() => import('./components/FinancialAssistant'));
const StatementImport = lazy(() => import('./components/StatementImport'));

const PERSISTENT_TABS = ['transactions', 'assistant', 'statements', 'credit-library'];
const RECEIVABLE_COMMANDS = { create: createReceivable, update: updateReceivable, link: linkReceivableIncome, receive: receiveReceivableIncome, unlink: unlinkReceivableIncome };

function readRoute() {
  return parseNavigationRoute(window.location.hash);
}
function PageLoading() {
  return <div role="status" className="surface-card min-h-[280px] p-8"><div className="h-4 w-28 rounded bg-slate-800 mb-5" /><div className="h-9 w-2/3 rounded bg-slate-800 mb-8" /><div className="h-28 rounded bg-slate-800/50" /><span className="sr-only">Cargando tu espacio…</span></div>;
}

export default function App({ account, initialData, revision, onDataChange, onLogout, isCurrent, syncBanner, readOnly = false, onRestore }) {
  const authenticated = true;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [route, setRoute] = useState(readRoute);
  const activeTab = route.tab;
  const financialInteractionsLocked = readOnly && !['credit-library', 'tools', 'dashboard'].includes(activeTab);
  const [financialData, setFinancialDataState] = useState(() => initialData);
  const dataRef = useRef(financialData);
  // The simulation draft stays in this authenticated session, never in browser storage.
  const paymentDraftCache = useRef(null);
  useEffect(() => {
    const protectDraft = event => {
      const cached = paymentDraftCache.current;
      if (cached && JSON.stringify(cached.value) !== cached.source) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, []);
  const [exchangeRateData, setExchangeRateData] = useState({ rate: 19.25, isManual: false, source: 'Tasa base · conectando', lastUpdated: null });
  const [privacyMode, setPrivacyMode] = useState(() => { try { return localStorage.getItem('sifran_device_privacy') === 'true'; } catch { return false; } });
  const actionAccess = useRef({ readOnly, privacyMode });
  actionAccess.current = { readOnly, privacyMode };
  const [directoryView, setDirectoryView] = useState({ query: '', goal: 'all' });
  const directoryLocation = useRef(null);
  const directoryRequest = useRef(0);
  const [directoryRestore, setDirectoryRestore] = useState(null);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isQuickTransactionOpen, setIsQuickTransactionOpen] = useState(false);
  const [transactionContext, setTransactionContext] = useState(null);
  const [calendarContext, setCalendarContext] = useState(null);
  const [reviewSession, setReviewSession] = useState({ open: false, step: 0, active: false, itemTitle: '' });
  const [assistantPrompt, setAssistantPrompt] = useState({ text: '', request: 0 });
  const [visited, setVisited] = useState(() => new Set([readRoute().tab]));
  const [showPendingOverviewOnTab, setShowPendingOverviewOnTab] = useState(false);
  const { addToast } = useToast();
  const rateRequest = useRef(0);
  const importMerger = useRef(null);
  const contextualNavigation = useRef(false);

  // Synchronous reference keeps imports and undo actions on the latest local data.
  const setFinancialData = useCallback((update) => {
    if (readOnly || !alive.current || !isCurrent()) throw new Error('Verifica tu cuenta y la sincronización antes de guardar.');
    const next = typeof update === 'function' ? update(dataRef.current) : update;
    if (next === dataRef.current) return;
    onDataChange(next);
    dataRef.current = next;
    setFinancialDataState(next);
  }, [onDataChange, isCurrent, readOnly]);
  const handleMarketSelectionsChange = useCallback(patch => {
    setFinancialData(previous => updateMarketSelections(previous, patch));
  }, [setFinancialData]);
  const navigate = useCallback((tab, options = {}) => {
    const hash = buildNavigationHash(tab, options);
    if (!hash) return;
    const restoreDirectory = tab === 'tools' && directoryLocation.current && !options.focusStart;
    contextualNavigation.current = Boolean(options.itemId || options.contextualFocus || restoreDirectory);
    if (restoreDirectory) setDirectoryRestore({ ...directoryLocation.current, request: ++directoryRequest.current, focusOrigin: document.activeElement });
    else setDirectoryRestore(null);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setRoute(parseNavigationRoute(hash));
    if (tab === 'calendar') setCalendarContext(previous => options.itemId ? { itemId: options.itemId, request: (previous?.request || 0) + 1 } : null);
    setShowPendingOverviewOnTab(false);
    setVisited(previous => new Set([...previous, tab]));
    setIsCommandPaletteOpen(false);
    if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const openAssistant = useCallback((prompt = '') => {
    if (typeof prompt === 'string' && prompt) setAssistantPrompt(prev => ({ text: prompt, request: prev.request + 1 }));
    navigate('assistant');
  }, [navigate]);
  const openImport = useCallback(() => navigate('statements'), [navigate]);
  const quickAdd = useCallback(() => { if (privacyMode || readOnly) return; setIsQuickTransactionOpen(true); }, [privacyMode, readOnly]);
  const restoreOrphanedPageFocus = (preferredSelector) => {
    const expectedRoute = window.location.hash;
    requestAnimationFrame(() => {
      if (!alive.current || actionAccess.current.privacyMode || window.location.hash !== expectedRoute || document.activeElement !== document.body || document.querySelector('[role="dialog"]')) return;
      const preferred = preferredSelector ? document.querySelector(preferredSelector) : null;
      const target = [preferred, ...document.querySelectorAll('#main-content h1'), document.getElementById('main-content')].find(node => node?.getClientRects().length && !node.closest('[hidden], [inert]'));
      if (target?.tagName === 'H1' && !target.hasAttribute('tabindex')) target.tabIndex = -1;
      target?.focus({ preventScroll: true });
    });
  };
  const closeQuickTransaction = () => { setIsQuickTransactionOpen(false); restoreOrphanedPageFocus(); };
  const closeDebt = () => { setIsDebtModalOpen(false); setDebtToEdit(null); restoreOrphanedPageFocus(); };
  const openDebt = useCallback(() => {
    if (privacyMode || readOnly) return;
    if (dataRef.current.planFinanciero && managedPlanSections(dataRef.current).debts) { navigate('plan', { panel: 'data' }); return; }
    setDebtToEdit(null); setIsDebtModalOpen(true);
  }, [privacyMode, readOnly, navigate]);
  const displayCurrency = financialData.config?.displayCurrency || 'MXN';
  const aggregateCurrency = displayCurrency === 'USD' ? 'USD' : 'MXN';
  const exchangeRate = Number(exchangeRateData.rate) > 0 ? Number(exchangeRateData.rate) : 19.25;
  const extraPayment = Math.max(0, Number(financialData.config?.aportacionExtraMensual ?? 2500) || 0);
  const cashFlow = useMemo(() => calculateCashFlow(financialData, exchangeRate), [financialData, exchangeRate]);
  const linkedSections = useMemo(() => managedPlanSections(financialData), [financialData]);
  const reviewDate = localDateKey(new Date());
  const financialReview = useMemo(() => buildFinancialReview(financialData, { today: reviewDate, exchangeRate, displayCurrency }), [financialData, reviewDate, exchangeRate, displayCurrency]);
  const openReview = () => setReviewSession(previous => ({ ...previous, open: true, active: true }));
  const openReviewItem = item => {
    setReviewSession(previous => ({ ...previous, open: false, active: true, itemTitle: item.title }));
    if (item.target.transactionContext) setTransactionContext(previous => ({ ...item.target.transactionContext, request: (previous?.request || 0) + 1 }));
    navigate(item.target.tab, { ...item.target.options, ...(item.target.tab === 'transactions' ? { view: 'registered' } : {}), contextualFocus: Boolean(item.target.transactionContext) });
  };
  const promoDeadlines = useMemo(() => analyzePromoDeadlines(financialData.deudas, exchangeRate), [financialData.deudas, exchangeRate]);
  const comparisonResult = useMemo(() => {
    if (activeTab !== 'debts') return { value: null, error: '' };
    if (financialData.deudasPendientes?.length) return { value: null, error: 'Completa saldos, tasas contractuales, pagos mínimos y fechas en tus créditos pendientes para proyectar todas las estrategias a la vez.' };
    try { return { value: compareAllStrategies(financialData.deudas, extraPayment, exchangeRate), error: '' }; }
    catch { return { value: null, error: 'Hay datos pendientes en tus deudas. Revisa sus importes y tasas para calcular la proyección.' }; }
  }, [activeTab, financialData.deudas, financialData.deudasPendientes, extraPayment, exchangeRate]);

  useEffect(() => {
    const syncRoute = () => {
      const next = readRoute();
      if (next.tab === 'tools' && directoryLocation.current) {
        contextualNavigation.current = true;
        setDirectoryRestore({ ...directoryLocation.current, request: ++directoryRequest.current, focusOrigin: document.activeElement });
      } else setDirectoryRestore(null);
      setRoute(next); setVisited(prev => new Set([...prev, next.tab]));
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => { window.removeEventListener('popstate', syncRoute); window.removeEventListener('hashchange', syncRoute); };
  }, []);
  useEffect(() => {
    if (authenticated && !contextualNavigation.current) document.getElementById('main-content')?.focus({ preventScroll: true });
    contextualNavigation.current = false;
  }, [activeTab, authenticated]);
  useEffect(() => {
    try { localStorage.setItem('sifran_device_privacy', String(privacyMode)); } catch { /* Session preference remains usable. */ }
    if (!privacyMode) return undefined;
    window.dispatchEvent(new Event('gairo:privacy'));
    const frame = requestAnimationFrame(() => document.getElementById('privacy-reveal-button')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [privacyMode]);
  useEffect(() => {
    if (visited.has('statements')) import('./services/statementImport.js').then(module => { importMerger.current = module.mergeImportedTransactions; }).catch(() => {});
  }, [visited]);
  const updateRate = useCallback(async (force = false) => {
    const request = ++rateRequest.current;
    const result = await fetchExchangeRate(force, dataRef.current.preferences);
    if (alive.current && request === rateRequest.current) setExchangeRateData(result);
  }, []);
  useEffect(() => {
    if (!authenticated) return undefined;
    updateRate();
    const interval = window.setInterval(() => updateRate(), 15 * 60 * 1000);
    return () => { window.clearInterval(interval); rateRequest.current += 1; };
  }, [authenticated, updateRate]);
  useEffect(() => {
    if (!authenticated) return undefined;
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const isTyping = event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName));
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        if (!document.querySelector('[role="dialog"]') || isCommandPaletteOpen) setIsCommandPaletteOpen(open => !open);
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'p') {
        event.preventDefault(); setPrivacyMode(value => !value);
      } else if (key === 'n' && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('[role="dialog"]') && !privacyMode) {
        event.preventDefault(); quickAdd();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authenticated, isCommandPaletteOpen, privacyMode, quickAdd]);

  const handleUpdateTransactions = useCallback((update) => {
    setFinancialData(previous => updateTransactionsWithReceivables(previous,
      typeof update === 'function' ? update(previous.transacciones || []) : update,
      { today: localDateKey(new Date()) }).data);
  }, [setFinancialData]);
  const handleReceivableCommand = useCallback(command => {
    if (!command || !Object.hasOwn(RECEIVABLE_COMMANDS, command.type)) throw new Error('La acción del cobro no es válida.');
    let outcome;
    setFinancialData(previous => {
      outcome = RECEIVABLE_COMMANDS[command.type](previous, command.payload, { today: localDateKey(new Date()) });
      return outcome.data;
    });
    return outcome;
  }, [setFinancialData]);
  const handleImportTransactions = useCallback((rows) => {
    if (!importMerger.current) throw new Error('La importación aún se está preparando. Intenta de nuevo.');
    let result;
    setFinancialData(previous => {
      result = importMerger.current(previous.transacciones || [], rows);
      return updateTransactionsWithReceivables(previous, result.transactions, { today: localDateKey(new Date()) }).data;
    });
    addToast({ message: `${result.added} movimientos importados${result.skipped ? ` · ${result.skipped} ya registrados` : ''}.` });
    return { added: result.added, skipped: result.skipped };
  }, [setFinancialData, addToast]);
  const handleSaveDebt = (debt, { pending = false } = {}) => {
    setFinancialData(previous => saveDebtRecord(previous, debt, pending));
    addToast({ message: pending ? 'Deuda guardada con datos pendientes.' : 'Deuda guardada.' });
  };
  const handleDeleteDebt = (id) => {
    const pending = (dataRef.current.deudasPendientes || []).some(row => row.id === id);
    const key = pending ? 'deudasPendientes' : 'deudas';
    const removed = dataRef.current[key].find(item => item.id === id);
    if (!removed) return;
    setFinancialData(previous => ({ ...previous, [key]: previous[key].filter(item => item.id !== id) }));
    addToast({ message: 'Deuda eliminada.', duration: 10000, onUndo: () => setFinancialData(previous => saveDebtRecord(previous, removed, pending)) });
  };
  const handleDebtPayment = (id, amount) => {
    const debt = dataRef.current.deudas.find(item => item.id === id);
    const value = Number(amount);
    if (!debt || !Number.isFinite(value) || value <= 0 || value > Number(debt.saldo)) return;
    setFinancialData(previous => ({ ...previous, deudas: previous.deudas.map(item => item.id === id ? { ...item, saldo: Math.round((Number(item.saldo) - value) * 100) / 100 } : item) }));
    addToast({ message: 'Abono registrado. Se actualizó el saldo.' });
  };
  const handleExportBackup = () => {
    if (!isCurrent()) return;
    downloadJSON(createAccountBackup(dataRef.current, account.id, revision), `Sifran_${account.displayName}_${new Date().toISOString().slice(0, 10)}.json`);
    addToast({ message: 'Respaldo descargado.' });
  };
  const handleImportBackup = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 3_000_000) throw new Error('El archivo de respaldo debe pesar menos de 3 MB. No se importará una copia parcial.');
      const imported = JSON.parse(await file.text());
      if (!alive.current || !isCurrent()) return;
      const restored = restoreAccountBackup(imported, account.id);
      if (!window.confirm(`Importar a ${account.displayName}: ${restored.transacciones.length} movimientos, ${restored.deudas.length} deudas completas, ${(restored.deudasPendientes || []).length} registros de deuda pendientes y ${restored.activos.length} activos. Esto reemplaza sus registros actuales; descarga un respaldo antes de continuar. El archivo original se conserva. ¿Continuar?`)) return;
      await onRestore(restored, true);
    } catch (error) { if (alive.current) addToast({ message: error.message || 'No se pudo leer el respaldo.', type: 'error' }); }
    finally { input.value = ''; }
  };
  const handleResetDefaults = async () => {
    if (!window.confirm(`Se vaciarán únicamente los registros de ${account.displayName} en todos sus dispositivos. Descarga un respaldo antes de continuar. ¿Vaciar esta cuenta?`)) return;
    try { await onRestore(emptyFinancialData(account.id), false); }
    catch (error) { if (alive.current) addToast({ message: error.message, type: 'error' }); }
  };
  const handleCommandAction = async (action) => {
    const unavailable = actionUnavailableReason(action, actionAccess.current);
    if (unavailable) { addToast({ message: unavailable, type: 'info' }); return; }
    if (action === 'newTransaction') quickAdd();
    else if (action === 'importStatement') openImport();
    else if (action === 'openAssistant') openAssistant();
    else if (action === 'newDebt') openDebt();
    else if (action === 'togglePrivacy') setPrivacyMode(value => !value);
    else if (action === 'exportBackup') handleExportBackup();
    else if (action === 'exportExcel') {
      try { const { exportFinancesToExcel } = await import('./services/excelExport.js'); if (alive.current && isCurrent() && !actionUnavailableReason(action, actionAccess.current)) exportFinancesToExcel(dataRef.current, exchangeRate); }
      catch { addToast({ message: 'No se pudo generar el archivo Excel. Intenta de nuevo.', type: 'error' }); }
    } else if (action === 'openSettings') setIsSettingsOpen(true);
    else if (action === 'openPricing') setIsPricingOpen(true);
    else if (action === 'openRoadmap') setIsRoadmapOpen(true);
  };
  const handleLogout = onLogout;

  const activeHub = useMemo(() => NAVIGATION_HUBS.find(hub => hub.tabs.includes(activeTab)) || null, [activeTab]);

  const renderContextualHubBar = () => {
    if (!activeHub || activeTab === 'tools' || activeTab === 'plan') return null;
    return (
      <nav className="workspace-section-nav print:hidden" aria-label={activeHub.title}>
        {activeHub.tabs.map(tabId => {
          const item = NAVIGATION_ITEMS.find(nav => nav.id === tabId);
          if (!item) return null;
          const Icon = item.icon;
          return <button key={tabId} type="button" onClick={() => navigate(tabId)} aria-current={activeTab === tabId ? 'page' : undefined}>
            {activeTab === tabId && <motion.span className="section-active-indicator" layoutId="workspace-section-active" transition={{ type: 'spring', stiffness: 420, damping: 38 }} aria-hidden="true" />}
            <Icon size={16} aria-hidden="true" /><span>{item.label}</span>
          </button>;
        })}
      </nav>
    );
  };

  const renderPage = (tab) => {
    const savePlanHandler = (plan, options) => {
      setFinancialData(previous => commitPaymentPlan(previous, plan, options));
      addToast({ message: 'Plan preparado. Revisa el estado de sincronización para confirmar el guardado.' });
    };

    if (tab === 'plan') {
      return (
        <PaymentPlan
          key={account.id}
          draftCache={paymentDraftCache}
          plan={financialData.planFinanciero}
          accountName={account.displayName}
          initialPanel={route.panel}
          onPanelChange={panel => navigate('plan', { panel, preserveScroll: true })}
          onNavigateTab={navigate}
          exchangeRate={exchangeRate}
          onSave={savePlanHandler}
        />
      );
    }

    // These routes keep their purpose while editing the single inventory in the plan.
    if (financialData.planFinanciero && linkedSections[tab]) {
      return <PlanSourceView type={tab} plan={financialData.planFinanciero} onNavigate={navigate} exchangeRate={exchangeRate} displayCurrency={displayCurrency} />;
    }

    const hasPendingDebts = (financialData.deudasPendientes || []).length > 0;
    const needsCompleteDebts = ['health', 'simulator', 'balance', 'report', 'investments'].includes(tab);

    const pendingNoticeBanner = hasPendingDebts && needsCompleteDebts ? (
      <div className="mb-6 space-y-4 print:hidden">
        <div className="surface-card border-amber-400/25 bg-amber-400/[0.04] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={19} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-100">
                Tienes {financialData.deudasPendientes.length} {financialData.deudasPendientes.length === 1 ? 'crédito con datos por confirmar' : 'créditos con datos por confirmar'}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Esta herramienta está activa con tus registros confirmados. Completa pagos mínimos y tasas contractuales para incluir el 100% de tus pasivos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="button-secondary text-xs py-2 px-3" onClick={() => setShowPendingOverviewOnTab(prev => !prev)}>
              {showPendingOverviewOnTab ? 'Ocultar conciliación' : 'Ver resumen de conciliación'}
            </button>
            <button type="button" className="button-primary text-xs py-2 px-3" onClick={() => navigate('debts')}>
              Completar en Deudas <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {showPendingOverviewOnTab && (
          <PlanningOverview financialData={financialData} cashFlow={cashFlow} onNavigate={navigate} />
        )}
      </div>
    ) : null;

    switch (tab) {
      case 'tools':
        return <ToolsDirectory onNavigateTab={navigate} onAction={handleCommandAction} hasPaymentPlan={Boolean(financialData.planFinanciero)} readOnly={readOnly} privacyMode={privacyMode} active={!privacyMode && activeTab === 'tools'} viewState={directoryView} onViewStateChange={patch => setDirectoryView(previous => ({ ...previous, ...patch }))} onRememberLocation={location => { directoryLocation.current = location; }} restorePoint={directoryRestore} />;
      case 'credit-library':
        return <CreditLibrary active={!privacyMode && activeTab === 'credit-library'} onNavigate={navigate} requestedView={activeTab === 'credit-library' ? route.view : undefined} onViewChange={view => navigate('credit-library', { view, preserveScroll: true })} marketSelections={financialData.preferences?.marketSelections} readOnly={readOnly} onMarketSelectionsChange={handleMarketSelectionsChange} />;
      case 'dashboard':
        if (!hasWorkspaceActivity(financialData)) {
          return <WorkspaceWelcome name={account.displayName} onNavigate={navigate} onQuickAdd={quickAdd} onNewDebt={openDebt} readOnly={readOnly} onImportBackup={account.id === 'gairo' ? () => setIsSettingsOpen(true) : undefined} />;
        }
        return (
          <div className="space-y-8">
            <DashboardOverview
              readOnly={readOnly}
              review={financialReview}
              onOpenReview={openReview}
              accountName={account.displayName}
              financialData={financialData}
              cashFlow={cashFlow}
              promoDeadlines={promoDeadlines}
              exchangeRate={exchangeRate}
              exchangeRateData={exchangeRateData}
              displayCurrency={displayCurrency}
              onNavigateTab={navigate}
              onOpenDebtModal={openDebt}
              onQuickAdd={quickAdd}
              onOpenAssistant={openAssistant}
              onImportStatement={openImport}
            />

          </div>
        );

      case 'debts':
        return (
          <div className="space-y-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Estrategia de pasivos</p>
                <h1 className="text-3xl font-semibold tracking-tight text-white mt-2">Tus deudas, con un plan claro.</h1>
                <p className="text-sm text-slate-400 mt-2">Saldos registrados, promociones activas, próximos pagos y estrategias comparadas para liquidar antes.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {financialData.planFinanciero && (
                  <button type="button" onClick={() => navigate('plan')} className="button-secondary">
                    <ChartNoAxesCombined size={16} /> Ir a Mesa de Pagos
                  </button>
                )}
                <button type="button" onClick={() => navigate('simulator')} className="button-secondary">
                  <WandSparkles size={16} /> Simular abonos
                </button>
                <button type="button" onClick={openDebt} className="button-primary">
                  <Plus size={17} /> Nueva deuda
                </button>
              </div>
            </div>
            <PendingDebts financialData={financialData} onEdit={item => { setDebtToEdit(item); setIsDebtModalOpen(true); }} onDelete={handleDeleteDebt} />
            {financialData.deudas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {financialData.deudas.map(debt => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    exchangeRate={exchangeRate}
                    displayCurrency={displayCurrency}
                    onEdit={item => { setDebtToEdit(item); setIsDebtModalOpen(true); }}
                    onDelete={handleDeleteDebt}
                    onPayment={handleDebtPayment}
                  />
                ))}
              </div>
            ) : (
              <div className="surface-card p-6 text-sm text-slate-300 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">Aún no hay créditos con ficha completa</p>
                  <p className="text-slate-400 mt-1">Completa los datos pendientes arriba o registra una deuda con saldo, tasa y pago mínimo para activar el comparador de estrategias.</p>
                </div>
                <button type="button" onClick={openDebt} className="button-primary"><Plus size={16} /> Registrar deuda completa</button>
              </div>
            )}
            {comparisonResult.error ? (
              <div role="alert" className="surface-card border-amber-400/25 p-5 text-amber-200 text-sm flex flex-wrap items-center justify-between gap-4">
                <span>{comparisonResult.error}</span>
                {financialData.planFinanciero && (
                  <button type="button" onClick={() => navigate('plan')} className="button-secondary text-xs py-2 px-3">
                    Ver estrategia día a día en Plan de pagos
                  </button>
                )}
              </div>
            ) : (
              <>
                <StrategyPayoff deudas={financialData.deudas} cashFlow={cashFlow} extraPayment={extraPayment} exchangeRate={exchangeRate} displayCurrency={aggregateCurrency} />
                <StrategyCompare comparison={comparisonResult.value} exchangeRate={exchangeRate} displayCurrency={aggregateCurrency} />
              </>
            )}
          </div>
        );

      case 'calendar':
        return (
          <div className="space-y-5">
            {hasPendingDebts && (
              <div className="surface-card border-amber-400/25 p-4 sm:p-5 text-sm text-amber-200 flex flex-wrap items-center justify-between gap-3">
                <span>Tus créditos con datos pendientes todavía no tienen día de pago fijo en este calendario mensual.</span>
                <div className="flex flex-wrap gap-2">
                  {financialData.planFinanciero && (
                    <button type="button" onClick={() => navigate('plan', { panel: 'calendar' })} className="button-secondary text-xs py-1.5 px-3">
                      Ver calendario de vencimientos del Plan
                    </button>
                  )}
                  <button type="button" onClick={() => navigate('debts')} className="button-secondary text-xs py-1.5 px-3">
                    Completar en Deudas
                  </button>
                </div>
              </div>
            )}
            <PaymentCalendar
              financialData={financialData}
              reviewContext={calendarContext}
              onTogglePagoMes={payments => setFinancialData(previous => ({ ...previous, pagosRealizadosMes: payments }))}
              exchangeRate={exchangeRate}
              displayCurrency={displayCurrency}
            />
          </div>
        );

      case 'transactions':
        return <TransactionsTracker financialData={financialData} onUpdateTransactions={handleUpdateTransactions} onReceivableCommand={handleReceivableCommand} readOnly={readOnly} active={!privacyMode && activeTab === 'transactions'} requestedView={activeTab === 'transactions' ? route.view : undefined} onViewChange={view => navigate('transactions', { view, preserveScroll: true })} exchangeRate={exchangeRate} displayCurrency={displayCurrency} onQuickAdd={quickAdd} transactionContext={transactionContext} onNavigateTab={navigate} onImportStatement={openImport} onOpenAssistant={openAssistant} />;

      case 'calculators':
        return <FinancialCalculatorsHub financialData={financialData} exchangeRate={exchangeRate} initialCalculator={route.calculator} onNavigateTab={navigate} />;

      case 'health':
        return !hasFinancialRecords(financialData) ? (
          <div className="surface-card p-8">
            <h1 className="text-2xl text-white font-semibold">Primero, tu información</h1>
            <p className="text-slate-400 mt-3">Configura tus ingresos y gastos para evaluar tu salud financiera.</p>
            <button className="button-primary mt-5" onClick={() => navigate('budget')}>Configurar presupuesto</button>
          </div>
        ) : (
          <>
            {pendingNoticeBanner}
            <FinancialHealthScore financialData={financialData} exchangeRate={exchangeRate} onNavigateTab={navigate} />
          </>
        );

      case 'diagnostics':
        return <AdvancedDiagnosticsHub />;

      case 'simulator':
        return (
          <>
            {pendingNoticeBanner}
            <Simulator
              deudas={financialData.deudas}
              pendingDebts={financialData.deudasPendientes}
              exchangeRate={exchangeRate}
              initialExtra={extraPayment}
              displayCurrency={aggregateCurrency}
              cashFlow={cashFlow}
              onNavigateTab={navigate}
              onSaveExtra={value => setFinancialData(previous => ({ ...previous, config: { ...previous.config, aportacionExtraMensual: value } }))}
            />
          </>
        );

      case 'education':
        return <FinancialEducationHub debts={financialData.deudas} pendingDebts={financialData.deudasPendientes} education={financialData.education} onUpdateEducation={education => setFinancialData(previous => ({ ...previous, education }))} />;

      case 'budget':
        return <IncomeStatement financialData={financialData} exchangeRate={exchangeRate} onNavigateTab={navigate} onUpdateHonorarios={honorarios => setFinancialData(previous => ({ ...previous, honorarios }))} onUpdateGastos={(gastosNecesarios, gastosOpcionales) => setFinancialData(previous => ({ ...previous, gastosNecesarios, gastosOpcionales }))} />;

      case 'tax-annual':
        return (
          <div className="space-y-6">
            {financialData.honorarios?.modo === 'MANUAL' && (
              <div className="surface-card border-sky-400/25 bg-sky-400/[0.04] p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-sky-100">Tu provisión fiscal actual está configurada como importe mensual declarado</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Puedes usar este simulador ingresando tus montos anuales estimados manualmente abajo, o configurar facturación y retenciones en Ingresos y gastos.
                  </p>
                </div>
                <button type="button" className="button-secondary text-xs py-2 px-3" onClick={() => navigate('budget')}>
                  Ir a Ingresos y gastos
                </button>
              </div>
            )}
            <AnnualTaxSimulator financialData={financialData} />
          </div>
        );

      case 'balance':
        return (
          <>
            {pendingNoticeBanner}
            <BalanceSheet
              financialData={balanceDisplayData(financialData)}
              onUpdateActivos={activos => setFinancialData(previous => ({ ...previous, activos }))}
              exchangeRate={exchangeRate}
              displayCurrency={displayCurrency}
              onNavigateTab={navigate}
            />
          </>
        );

      case 'investments':
        return (
          <>
            {pendingNoticeBanner}
            <Investments financialData={financialData} cashFlow={cashFlow} exchangeRate={exchangeRate} onNavigateTab={navigate} />
          </>
        );

      case 'report':
        return (
          <>
            {pendingNoticeBanner}
            <PrintableReport financialData={financialData} exchangeRate={exchangeRate} />
          </>
        );

      case 'assistant':
        return <FinancialAssistant key={financialData.profileId || 'default'} financialData={financialData} exchangeRateData={exchangeRateData} initialPrompt={assistantPrompt.text} promptRequest={assistantPrompt.request} onImportStatement={openImport} onOpenPlans={() => setIsPricingOpen(true)} />;

      case 'statements':
        return <StatementImport key={financialData.profileId || 'default'} financialData={financialData} onImportTransactions={handleImportTransactions} onOpenAssistant={openAssistant} onNavigateTab={navigate} />;

      default:
        return null;
    }
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0.75, 0.25, 1] }}>
    <div className={`app-shell ${privacyMode ? 'privacy-mode' : ''}`}>
      <Navbar
        readOnly={readOnly}
        activeTab={activeTab}
        setActiveTab={navigate}
        exchangeRateData={exchangeRateData}
        onRefreshRate={() => updateRate(true)}
        displayCurrency={displayCurrency}
        setDisplayCurrency={value => setFinancialData(previous => ({ ...previous, config: { ...previous.config, displayCurrency: value } }))}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
        onLogout={handleLogout}
        financialData={financialData}
        isCurrent={() => alive.current && isCurrent()}
        onQuickAdd={quickAdd}
        onOpenAssistant={openAssistant}
        onImportStatement={openImport}
      />
      <main id="main-content" tabIndex={-1} className="app-main relative outline-none">
        {syncBanner}
        {!privacyMode && reviewSession.active && !reviewSession.open && activeTab !== 'dashboard' && <aside className="review-return" aria-label="Tu revisión en curso"><div><strong>{reviewSession.itemTitle || 'Tu revisión sigue abierta'}</strong><span>Vuelve al mismo paso cuando termines. Los asuntos se actualizan con tus registros.</span></div><button type="button" className="button-secondary" onClick={openReview}>Volver a mi revisión<ArrowRight size={16} aria-hidden="true" /></button><button type="button" className="button-ghost" onClick={() => setReviewSession(previous => ({ ...previous, active: false }))}>Cerrar revisión</button></aside>}
        {privacyMode && (
          <div role="status" className="surface-card p-10 text-center mb-6">
            <ShieldCheck size={32} className="mx-auto text-emerald-300 mb-4" />
            <h1 className="text-2xl font-semibold text-white">Vista privada activa</h1>
            <p className="text-slate-400 mt-2 mb-6">El contenido financiero está oculto en todas tus páginas.</p>
            <button id="privacy-reveal-button" className="button-secondary" onClick={() => { setPrivacyMode(false); restoreOrphanedPageFocus('.sf-nav-privacy'); }}><Eye size={17} />Mostrar mi información</button>
          </div>
        )}
        <FinancialInteractionLock.Provider value={financialInteractionsLocked}>
          <div className={privacyMode ? 'privacy-content' : ''} aria-hidden={privacyMode || undefined} inert={privacyMode || financialInteractionsLocked ? '' : undefined}>
            {renderContextualHubBar()}
            {financialData.planFinanciero && ['budget', 'balance', 'debts'].includes(activeTab) && !linkedSections[activeTab] && <div className="source-context mb-6"><Layers3 size={17} aria-hidden="true" /><p><strong>Conservas registros independientes del plan</strong><span>Aquí puedes revisarlos y editarlos. El resumen usa tus registros; los escenarios conservan los datos de la conciliación.</span></p><button type="button" className="button-secondary" onClick={() => navigate('plan', { panel: { budget: 'monthly', balance: 'savings', debts: 'accounts' }[activeTab] })}>Revisar datos del plan<ArrowRight size={16} aria-hidden="true" /></button></div>}
            <PageTransition routeKey={`${activeTab}:${route.panel}:${route.calculator}`}>
            <AppErrorBoundary key={activeTab} onReset={() => navigate('dashboard')}>
              <Suspense fallback={<PageLoading />}>
                {!PERSISTENT_TABS.includes(activeTab) && renderPage(activeTab)}
              </Suspense>
            </AppErrorBoundary>
            {PERSISTENT_TABS.filter(tab => visited.has(tab)).map(tab => (
              <div key={tab} hidden={tab !== activeTab}>
                <AppErrorBoundary onReset={() => navigate('dashboard')}>
                  <Suspense fallback={<PageLoading />}>
                    {renderPage(tab)}
                  </Suspense>
                </AppErrorBoundary>
              </div>
            ))}
            </PageTransition>
          </div>
        </FinancialInteractionLock.Provider>
      </main>
      <Suspense fallback={null}>
        {!privacyMode && <QuickTransaction key={account.id} isOpen={isQuickTransactionOpen} onClose={closeQuickTransaction} transactions={financialData.transacciones || []} onUpdateTransactions={handleUpdateTransactions} readOnly={readOnly} onViewTransaction={transaction => {
          setTransactionContext(previous => ({ transactionId: transaction.id, edit: false, request: (previous?.request || 0) + 1 }));
          navigate('transactions', { view: 'registered', contextualFocus: true });
        }} />}
        {!privacyMode && <FinancialReview review={financialReview} open={reviewSession.open} step={reviewSession.step} readOnly={readOnly} onStepChange={step => setReviewSession(previous => ({ ...previous, step }))} onOpenItem={openReviewItem} onClose={() => setReviewSession(previous => ({ ...previous, open: false, active: false }))} />}
        {isDebtModalOpen && !privacyMode && !readOnly && <DebtModal isOpen onClose={closeDebt} onSave={handleSaveDebt} debtToEdit={debtToEdit} />}
        {isSettingsOpen && !privacyMode && !readOnly && <SettingsModal account={account} preferences={financialData.preferences} onUpdatePreferences={preferences => setFinancialData(previous => ({ ...previous, preferences: { ...previous.preferences, manualRate: preferences.manualRate, manualRateUpdatedAt: preferences.manualRateUpdatedAt } }))} isCurrent={() => alive.current && isCurrent()} isOpen onClose={() => setIsSettingsOpen(false)} exchangeRateData={exchangeRateData} onRefreshRate={() => updateRate(true)} onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} onResetDefaults={handleResetDefaults} onOpenAssistant={() => { setIsSettingsOpen(false); openAssistant(); }} />}
        {isPricingOpen && <PricingModal isOpen onClose={() => setIsPricingOpen(false)} onOpenAssistant={() => { setIsPricingOpen(false); openAssistant(); }} onImportStatement={() => { setIsPricingOpen(false); openImport(); }} />}
        {isOnboardingOpen && <OnboardingModal isOpen onClose={() => setIsOnboardingOpen(false)} onNavigateTab={navigate} />}
        {isRoadmapOpen && <Roadmap100Modal isOpen onClose={() => setIsRoadmapOpen(false)} />}
      </Suspense>
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} onNavigateTab={(tab, options) => navigate(tab, { ...options, focusStart: true })} onAction={handleCommandAction} readOnly={readOnly} privacyMode={privacyMode} />
      <footer className="app-footer print:hidden">
        <span>Sifran · Tu dinero, en perspectiva.</span>
        <span className="inline-flex items-center gap-1.5"><Sparkles size={13} />Hecho para decidir con claridad.</span>
      </footer>
    </div>
    </MotionConfig>
  );
}
