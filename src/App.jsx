import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import Navbar from './components/Navbar';
import DashboardOverview from './components/DashboardOverview';
import CommandPalette from './components/CommandPalette';
import AppErrorBoundary from './components/AppErrorBoundary';
import { useToast } from './components/Toast';
import { FinancialInteractionLock } from './components/ui/Modal.jsx';
import { downloadJSON } from './services/storage.js';
import { emptyFinancialData, hasFinancialRecords } from './services/accountData.js';
import { fetchExchangeRate } from './services/exchangeRate.js';
import { calculateCashFlow, analyzePromoDeadlines, compareAllStrategies } from './services/financeEngine.js';
import { createAccountBackup, restoreAccountBackup } from './services/backup.js';
import { saveDebtRecord } from './services/planning.js';
import PendingDebts from './components/PendingDebts.jsx';
import PlanningOverview from './components/PlanningOverview.jsx';
import { applyPaymentPlan } from './services/paymentPlan.js';

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

const TABS = ['dashboard', 'plan', 'debts', 'calendar', 'transactions', 'calculators', 'health', 'diagnostics', 'simulator', 'education', 'budget', 'tax-annual', 'balance', 'investments', 'report', 'assistant', 'statements'];
const PERSISTENT_TABS = ['transactions', 'assistant', 'statements'];
function readRoute() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { tab: TABS.includes(path) ? path : 'dashboard', calculator: new URLSearchParams(query).get('tool') || 'cat' };
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
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [quickAddRequest, setQuickAddRequest] = useState(0);
  const [assistantPrompt, setAssistantPrompt] = useState({ text: '', request: 0 });
  const [visited, setVisited] = useState(() => new Set([readRoute().tab]));
  const { addToast } = useToast();
  const rateRequest = useRef(0);
  const importMerger = useRef(null);

  // Synchronous reference keeps imports and undo actions on the latest local data.
  const setFinancialData = useCallback((update) => {
    if (!alive.current || !isCurrent()) throw new Error('Verifica tu cuenta y la sincronización antes de guardar.');
    const next = typeof update === 'function' ? update(dataRef.current) : update;
    onDataChange(next);
    dataRef.current = next;
    setFinancialDataState(next);
  }, [onDataChange, isCurrent]);
  const navigate = useCallback((tab, options = {}) => {
    if (!TABS.includes(tab)) return;
    const calculator = options.calculator || 'cat';
    const hash = `#${tab}${tab === 'calculators' ? `?tool=${encodeURIComponent(calculator)}` : ''}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setRoute({ tab, calculator });
    setVisited(previous => new Set([...previous, tab]));
    setIsCommandPaletteOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const openAssistant = useCallback((prompt = '') => {
    if (typeof prompt === 'string' && prompt) setAssistantPrompt(prev => ({ text: prompt, request: prev.request + 1 }));
    navigate('assistant');
  }, [navigate]);
  const openImport = useCallback(() => navigate('statements'), [navigate]);
  const quickAdd = useCallback(() => { if (privacyMode) return; navigate('transactions'); setQuickAddRequest(n => n + 1); }, [navigate, privacyMode]);
  const openDebt = useCallback(() => { if (privacyMode) return; setDebtToEdit(null); setIsDebtModalOpen(true); }, [privacyMode]);
  const displayCurrency = financialData.config?.displayCurrency || 'MXN';
  const aggregateCurrency = displayCurrency === 'USD' ? 'USD' : 'MXN';
  const exchangeRate = Number(exchangeRateData.rate) > 0 ? Number(exchangeRateData.rate) : 19.25;
  const extraPayment = Math.max(0, Number(financialData.config?.aportacionExtraMensual ?? 2500) || 0);
  const cashFlow = useMemo(() => calculateCashFlow(financialData, exchangeRate), [financialData, exchangeRate]);
  const promoDeadlines = useMemo(() => analyzePromoDeadlines(financialData.deudas, exchangeRate), [financialData.deudas, exchangeRate]);
  const comparisonResult = useMemo(() => {
    if (activeTab !== 'debts') return { value: null, error: '' };
    if (financialData.deudasPendientes?.length) return { value: null, error: 'Completa saldos, tasas contractuales, pagos mínimos y fechas para proyectar el pago de toda tu deuda.' };
    try { return { value: compareAllStrategies(financialData.deudas, extraPayment, exchangeRate), error: '' }; }
    catch { return { value: null, error: 'Hay datos pendientes en tus deudas. Revisa sus importes y tasas para calcular la proyección.' }; }
  }, [activeTab, financialData.deudas, financialData.deudasPendientes, extraPayment, exchangeRate]);

  useEffect(() => {
    const syncRoute = () => { const next = readRoute(); setRoute(next); setVisited(prev => new Set([...prev, next.tab])); };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => { window.removeEventListener('popstate', syncRoute); window.removeEventListener('hashchange', syncRoute); };
  }, []);
  useEffect(() => {
    if (authenticated) document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [activeTab, authenticated]);
  useEffect(() => {
    try { localStorage.setItem('sifran_device_privacy', String(privacyMode)); } catch { /* Session preference remains usable. */ }
    if (privacyMode) window.dispatchEvent(new Event('gairo:privacy'));
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
    setFinancialData(previous => ({ ...previous, transacciones: typeof update === 'function' ? update(previous.transacciones || []) : update }));
  }, [setFinancialData]);
  const handleImportTransactions = useCallback((rows) => {
    if (!importMerger.current) throw new Error('La importación aún se está preparando. Intenta de nuevo.');
    const result = importMerger.current(dataRef.current.transacciones || [], rows);
    setFinancialData(previous => ({ ...previous, transacciones: result.transactions }));
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
    if (action === 'newTransaction') quickAdd();
    else if (action === 'importStatement') openImport();
    else if (action === 'openAssistant') openAssistant();
    else if (action === 'newDebt') openDebt();
    else if (action === 'togglePrivacy') setPrivacyMode(value => !value);
    else if (action === 'exportBackup') handleExportBackup();
    else if (action === 'exportExcel') {
      try { const { exportFinancesToExcel } = await import('./services/excelExport.js'); if (alive.current && isCurrent()) exportFinancesToExcel(dataRef.current, exchangeRate); }
      catch { addToast({ message: 'No se pudo generar el archivo Excel. Intenta de nuevo.', type: 'error' }); }
    } else if (action === 'openSettings') setIsSettingsOpen(true);
    else if (action === 'openPricing') setIsPricingOpen(true);
    else if (action === 'openRoadmap') setIsRoadmapOpen(true);
  };
  const handleLogout = onLogout;
  const renderPage = (tab) => {
    const planPanels = { dashboard: 'overview', plan: 'overview', debts: 'accounts', simulator: 'overview', calendar: 'calendar', investments: 'savings', balance: 'savings', budget: 'analysis' };
    if (tab === 'plan' || (financialData.planFinanciero && Object.hasOwn(planPanels, tab))) return <PaymentPlan key={account.id} draftCache={paymentDraftCache} plan={financialData.planFinanciero} accountName={account.displayName} initialPanel={planPanels[tab]} exchangeRate={exchangeRate} onSave={plan => { setFinancialData(previous => applyPaymentPlan(previous, plan)); addToast({ message: 'Plan preparado. Revisa el estado de sincronización para confirmar el guardado.' }); }} />;
    const hasPendingDebts = (financialData.deudasPendientes || []).length > 0;
    const needsCompleteDebts = ['health', 'simulator', 'balance', 'report', 'investments'].includes(tab);
    if (hasPendingDebts && (tab === 'dashboard' || needsCompleteDebts)) return <div className="space-y-6">{needsCompleteDebts && <div className="surface-card p-5 text-sm text-amber-200">Esta vista necesita los pagos y las tasas contractuales de todas tus deudas. Mientras los completas, aquí tienes tu información registrada.</div>}<PlanningOverview financialData={financialData} cashFlow={cashFlow} onNavigate={navigate} /></div>;
    if (tab === 'tax-annual' && financialData.honorarios.modo === 'MANUAL') return <section className="surface-card p-7"><h1 className="text-2xl font-semibold text-white">Tu provisión fiscal es un importe declarado</h1><p className="text-slate-400 mt-4">La simulación anual requiere facturación, retenciones y tasas. El ingreso recibido y tu provisión mensual no bastan para calcular tu declaración.</p><button className="button-secondary mt-5" onClick={() => navigate('budget')}>Ver ingreso y provisión mensual</button></section>;

    switch (tab) {
      case 'dashboard': return !hasFinancialRecords(financialData) ? <div className="surface-card p-7 sm:p-10"><p className="eyebrow">Tu espacio está listo</p><h1 className="text-3xl font-semibold text-white mt-3">Comienza tu panorama, {account.displayName}.</h1><p className="text-slate-400 mt-4 max-w-xl">Registra tus ingresos y compromisos para ver tu margen. Tus cambios se guardarán para encontrarlos en tus otros dispositivos.</p><div className="flex flex-wrap gap-3 mt-7"><button className="button-primary" onClick={() => navigate('budget')}>Configurar mi presupuesto</button><button className="button-secondary" onClick={quickAdd}>Registrar un movimiento</button>{account.id === 'gairo' && <button className="button-secondary" onClick={() => setIsSettingsOpen(true)}>Importar mis registros</button>}</div></div> : <DashboardOverview financialData={financialData} cashFlow={cashFlow} promoDeadlines={promoDeadlines} exchangeRate={exchangeRate} exchangeRateData={exchangeRateData} displayCurrency={displayCurrency} onNavigateTab={navigate} onOpenDebtModal={openDebt} onQuickAdd={quickAdd} onOpenAssistant={openAssistant} onImportStatement={openImport} />;
      case 'debts': return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Tu dinero</p><h1 className="text-3xl font-semibold tracking-tight text-white mt-2">Tus deudas, con un plan.</h1><p className="text-sm text-slate-400 mt-2">Saldos registrados, próximos pagos y escenarios para avanzar.</p></div><button onClick={openDebt} className="button-primary"><Plus size={17} />Nueva deuda</button></div><PendingDebts financialData={financialData} onEdit={item => { setDebtToEdit(item); setIsDebtModalOpen(true); }} onDelete={handleDeleteDebt} /><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{financialData.deudas.map(debt => <DebtCard key={debt.id} debt={debt} exchangeRate={exchangeRate} displayCurrency={displayCurrency} onEdit={item => { setDebtToEdit(item); setIsDebtModalOpen(true); }} onDelete={handleDeleteDebt} onPayment={handleDebtPayment} />)}</div>{comparisonResult.error ? <p role="alert" className="surface-card p-5 text-amber-300 text-sm">{comparisonResult.error}</p> : <><StrategyPayoff deudas={financialData.deudas} cashFlow={cashFlow} extraPayment={extraPayment} exchangeRate={exchangeRate} displayCurrency={aggregateCurrency} /><StrategyCompare comparison={comparisonResult.value} exchangeRate={exchangeRate} displayCurrency={aggregateCurrency} /></>}</div>;
      case 'calendar': return <><div className={hasPendingDebts ? 'surface-card p-5 mb-5 text-sm text-amber-200' : 'hidden'}>Tus créditos con datos pendientes todavía no tienen pagos programados. Completa su fecha y pago mínimo en Deudas.</div><PaymentCalendar financialData={financialData} onTogglePagoMes={payments => setFinancialData(previous => ({ ...previous, pagosRealizadosMes: payments }))} exchangeRate={exchangeRate} displayCurrency={displayCurrency} /></>;
      case 'transactions': return <TransactionsTracker financialData={financialData} onUpdateTransactions={handleUpdateTransactions} exchangeRate={exchangeRate} displayCurrency={displayCurrency} quickAddRequest={quickAddRequest} onImportStatement={openImport} onOpenAssistant={openAssistant} />;
      case 'calculators': return <FinancialCalculatorsHub financialData={financialData} exchangeRate={exchangeRate} initialCalculator={route.calculator} />;
      case 'health': return !hasFinancialRecords(financialData) ? <div className="surface-card p-8"><h1 className="text-2xl text-white font-semibold">Primero, tu información</h1><p className="text-slate-400 mt-3">Configura tus ingresos y gastos para evaluar tu salud financiera.</p><button className="button-primary mt-5" onClick={() => navigate('budget')}>Configurar presupuesto</button></div> : <FinancialHealthScore financialData={financialData} exchangeRate={exchangeRate} onNavigateTab={navigate} />;
      case 'diagnostics': return <AdvancedDiagnosticsHub />;
      case 'simulator': return <Simulator deudas={financialData.deudas} exchangeRate={exchangeRate} initialExtra={extraPayment} displayCurrency={aggregateCurrency} cashFlow={cashFlow} onSaveExtra={value => setFinancialData(previous => ({ ...previous, config: { ...previous.config, aportacionExtraMensual: value } }))} />;
      case 'education': return <FinancialEducationHub debts={financialData.deudas} pendingDebts={financialData.deudasPendientes} education={financialData.education} onUpdateEducation={education => setFinancialData(previous => ({ ...previous, education }))} />;
      case 'budget': return <IncomeStatement financialData={financialData} onUpdateHonorarios={honorarios => setFinancialData(previous => ({ ...previous, honorarios }))} onUpdateGastos={(gastosNecesarios, gastosOpcionales) => setFinancialData(previous => ({ ...previous, gastosNecesarios, gastosOpcionales }))} />;
      case 'tax-annual': return <AnnualTaxSimulator financialData={financialData} />;
      case 'balance': return <BalanceSheet financialData={financialData} onUpdateActivos={activos => setFinancialData(previous => ({ ...previous, activos }))} exchangeRate={exchangeRate} displayCurrency={displayCurrency} />;
      case 'investments': return <Investments financialData={financialData} cashFlow={cashFlow} exchangeRate={exchangeRate} />;
      case 'report': return <PrintableReport financialData={financialData} exchangeRate={exchangeRate} />;
      case 'assistant': return <FinancialAssistant key={financialData.profileId || 'default'} financialData={financialData} exchangeRateData={exchangeRateData} initialPrompt={assistantPrompt.text} promptRequest={assistantPrompt.request} onImportStatement={openImport} onOpenPlans={() => setIsPricingOpen(true)} />;
      case 'statements': return <StatementImport key={financialData.profileId || 'default'} financialData={financialData} onImportTransactions={handleImportTransactions} onOpenAssistant={openAssistant} onNavigateTab={navigate} />;
      default: return null;
    }
  };
  return <div className={`app-shell ${privacyMode ? 'privacy-mode' : ''}`}>
    <Navbar readOnly={readOnly} activeTab={activeTab} setActiveTab={navigate} exchangeRateData={exchangeRateData} onRefreshRate={() => updateRate(true)} displayCurrency={displayCurrency} setDisplayCurrency={value => setFinancialData(previous => ({ ...previous, config: { ...previous.config, displayCurrency: value } }))} privacyMode={privacyMode} setPrivacyMode={setPrivacyMode} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} onOpenPricing={() => setIsPricingOpen(true)} onOpenOnboarding={() => setIsOnboardingOpen(true)} onOpenRoadmap={() => setIsRoadmapOpen(true)} onLogout={handleLogout} financialData={financialData} isCurrent={() => alive.current && isCurrent()} onQuickAdd={quickAdd} onOpenAssistant={openAssistant} onImportStatement={openImport} />
    <main id="main-content" tabIndex={-1} className="app-main relative outline-none">
      {syncBanner}
      {privacyMode && <div role="status" className="surface-card p-10 text-center mb-6"><ShieldCheck size={32} className="mx-auto text-emerald-300 mb-4" /><h1 className="text-2xl font-semibold text-white">Vista privada activa</h1><p className="text-slate-400 mt-2 mb-6">El contenido financiero está oculto en todas tus páginas.</p><button className="button-secondary" onClick={() => setPrivacyMode(false)}><Eye size={17} />Mostrar mi información</button></div>}
      <FinancialInteractionLock.Provider value={readOnly}><div className={privacyMode ? 'privacy-content' : ''} aria-hidden={privacyMode || undefined} inert={privacyMode || readOnly ? '' : undefined}>
        <AppErrorBoundary key={activeTab} onReset={() => navigate('dashboard')}><Suspense fallback={<PageLoading />}>{!PERSISTENT_TABS.includes(activeTab) && renderPage(activeTab)}</Suspense></AppErrorBoundary>
        {PERSISTENT_TABS.filter(tab => visited.has(tab)).map(tab => <div key={tab} hidden={tab !== activeTab}><AppErrorBoundary onReset={() => navigate('dashboard')}><Suspense fallback={<PageLoading />}>{renderPage(tab)}</Suspense></AppErrorBoundary></div>)}
      </div></FinancialInteractionLock.Provider>
    </main>
    <Suspense fallback={null}>
      {isDebtModalOpen && !privacyMode && !readOnly && <DebtModal isOpen onClose={() => { setIsDebtModalOpen(false); setDebtToEdit(null); }} onSave={handleSaveDebt} debtToEdit={debtToEdit} />}
      {isSettingsOpen && !privacyMode && !readOnly && <SettingsModal account={account} preferences={financialData.preferences} onUpdatePreferences={preferences => setFinancialData(previous => ({ ...previous, preferences }))} isCurrent={() => alive.current && isCurrent()} isOpen onClose={() => setIsSettingsOpen(false)} exchangeRateData={exchangeRateData} onRefreshRate={() => updateRate(true)} onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} onResetDefaults={handleResetDefaults} onOpenAssistant={() => { setIsSettingsOpen(false); openAssistant(); }} />}
      {isPricingOpen && <PricingModal isOpen onClose={() => setIsPricingOpen(false)} onOpenAssistant={() => { setIsPricingOpen(false); openAssistant(); }} onImportStatement={() => { setIsPricingOpen(false); openImport(); }} />}
      {isOnboardingOpen && <OnboardingModal isOpen onClose={() => setIsOnboardingOpen(false)} />}
      {isRoadmapOpen && <Roadmap100Modal isOpen onClose={() => setIsRoadmapOpen(false)} />}
    </Suspense>
    <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} onNavigateTab={navigate} onAction={handleCommandAction} />
    <footer className="app-footer print:hidden"><span>Sifran · Tu dinero, en perspectiva.</span><span className="inline-flex items-center gap-1.5"><Sparkles size={13} />Hecho para decidir con claridad.</span></footer>
  </div>;
}
