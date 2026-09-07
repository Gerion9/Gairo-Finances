import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import DashboardOverview from './components/DashboardOverview';
import DebtCard from './components/DebtCard';
import DebtModal from './components/DebtModal';
import StrategyPayoff from './components/StrategyPayoff';
import StrategyCompare from './components/StrategyCompare';
import PaymentCalendar from './components/PaymentCalendar';
import TransactionsTracker from './components/TransactionsTracker';
import FinancialHealthScore from './components/FinancialHealthScore';
import FinancialCalculatorsHub from './components/FinancialCalculatorsHub';
import AdvancedDiagnosticsHub from './components/AdvancedDiagnosticsHub';
import PrintableReport from './components/PrintableReport';
import PricingModal from './components/PricingModal';
import OnboardingModal from './components/OnboardingModal';
import CommandPalette from './components/CommandPalette';
import Simulator from './components/Simulator';
import IncomeStatement from './components/IncomeStatement';
import BalanceSheet from './components/BalanceSheet';
import Investments from './components/Investments';
import SettingsModal from './components/SettingsModal';
import Roadmap100Modal from './components/Roadmap100Modal';

import { 
  loadFinancialData, 
  saveFinancialData, 
  resetToExcelDefaults,
  INITIAL_DATA
} from './services/storage.js';
import { 
  fetchExchangeRate 
} from './services/exchangeRate.js';
import { 
  calculateCashFlow, 
  analyzePromoDeadlines, 
  compareAllStrategies 
} from './services/financeEngine.js';
import { 
  isAuthenticated, 
  logout 
} from './services/auth.js';
import { exportFinancesToExcel } from './services/excelExport.js';
import { Plus } from 'lucide-react';

export default function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [financialData, setFinancialData] = useState(loadFinancialData());
  const [exchangeRateData, setExchangeRateData] = useState({ rate: 19.25, isManual: false, source: 'Iniciando...' });
  const [displayCurrency, setDisplayCurrency] = useState(financialData.config?.displayCurrency || 'MXN');
  const [privacyMode, setPrivacyMode] = useState(false);
  
  // Modales
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);

  // Atajos de teclado globales (Ctrl+K, P para privacidad, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cargar Tipo de Cambio en Vivo
  const updateRate = async (force = false) => {
    const rateRes = await fetchExchangeRate(force);
    setExchangeRateData(rateRes);
  };

  useEffect(() => {
    updateRate();
    const interval = setInterval(() => updateRate(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    saveFinancialData(financialData);
  }, [financialData]);

  if (!authenticated) {
    return <Login onLoginSuccess={() => setAuthenticated(true)} />;
  }

  const exchangeRate = exchangeRateData?.rate || 19.25;

  // Cálculos derivados
  const cashFlow = calculateCashFlow(financialData, exchangeRate);
  const promoDeadlines = analyzePromoDeadlines(financialData.deudas, exchangeRate);
  const comparison = compareAllStrategies(
    financialData.deudas, 
    financialData.config?.aportacionExtraMensual || 2500, 
    exchangeRate
  );

  // Manejadores de deudas
  const handleSaveDebt = (debt) => {
    const exists = financialData.deudas.some(d => d.id === debt.id);
    let updatedDebts;
    if (exists) {
      updatedDebts = financialData.deudas.map(d => d.id === debt.id ? debt : d);
    } else {
      updatedDebts = [debt, ...financialData.deudas];
    }
    setFinancialData({ ...financialData, deudas: updatedDebts });
  };

  const handleDeleteDebt = (id) => {
    if (window.confirm('¿Deseas eliminar esta deuda del registro?')) {
      const updatedDebts = financialData.deudas.filter(d => d.id !== id);
      setFinancialData({ ...financialData, deudas: updatedDebts });
    }
  };

  const handleDebtPayment = (id, amount) => {
    const updatedDebts = financialData.deudas.map(d => {
      if (d.id === id) {
        const newSaldo = Math.max(0, d.saldo - amount);
        return { ...d, saldo: newSaldo };
      }
      return d;
    });
    setFinancialData({ ...financialData, deudas: updatedDebts });
  };

  const handleTogglePagoMes = (pagosActualizados) => {
    setFinancialData({ ...financialData, pagosRealizadosMes: pagosActualizados });
  };

  const handleUpdateTransactions = (transaccionesActualizadas) => {
    setFinancialData({ ...financialData, transacciones: transaccionesActualizadas });
  };

  const handleActivateLicense = (key) => {
    setFinancialData({
      ...financialData,
      licencia: {
        esPro: true,
        tipoPlan: 'COMMERCIAL_PRO_ACTIVE',
        claveActivacion: key,
        fechaActivacion: new Date().toISOString()
      }
    });
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(financialData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GairoFinances_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported || typeof imported !== 'object') {
          throw new Error('Formato inválido');
        }
        const sanitized = {
          ...INITIAL_DATA,
          ...imported,
          honorarios: { ...INITIAL_DATA.honorarios, ...(imported.honorarios || {}) },
          gastosNecesarios: Array.isArray(imported.gastosNecesarios) ? imported.gastosNecesarios : INITIAL_DATA.gastosNecesarios,
          gastosOpcionales: Array.isArray(imported.gastosOpcionales) ? imported.gastosOpcionales : INITIAL_DATA.gastosOpcionales,
          deudas: Array.isArray(imported.deudas) ? imported.deudas : INITIAL_DATA.deudas,
          activos: Array.isArray(imported.activos) ? imported.activos : INITIAL_DATA.activos,
          transacciones: Array.isArray(imported.transacciones) ? imported.transacciones : INITIAL_DATA.transacciones,
          config: { ...INITIAL_DATA.config, ...(imported.config || {}) }
        };
        setFinancialData(sanitized);
        saveFinancialData(sanitized);
        alert('¡Datos restaurados y verificados con éxito!');
        setIsSettingsOpen(false);
      } catch (err) {
        alert('Error: Archivo de respaldo no válido o dañado.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (window.confirm('¿Seguro que deseas restaurar las deudas y parámetros a los valores originales de Finanzas Personales.xlsx?')) {
      const def = resetToExcelDefaults();
      setFinancialData(def);
      setIsSettingsOpen(false);
    }
  };

  const handleCommandAction = (action) => {
    if (action === 'exportExcel') {
      exportFinancesToExcel(financialData, exchangeRate);
    } else if (action === 'openSettings') {
      setIsSettingsOpen(true);
    } else if (action === 'openPricing') {
      setIsPricingOpen(true);
    } else if (action === 'openRoadmap') {
      setIsRoadmapOpen(true);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans ${privacyMode ? 'privacy-mode' : ''}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        exchangeRateData={exchangeRateData}
        onRefreshRate={() => updateRate(true)}
        displayCurrency={displayCurrency}
        setDisplayCurrency={setDisplayCurrency}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
        onLogout={() => { logout(); setAuthenticated(false); }}
        financialData={financialData}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <DashboardOverview
            financialData={financialData}
            cashFlow={cashFlow}
            promoDeadlines={promoDeadlines}
            exchangeRate={exchangeRate}
            displayCurrency={displayCurrency}
            onNavigateTab={setActiveTab}
            onOpenDebtModal={() => { setDebtToEdit(null); setIsDebtModalOpen(true); }}
          />
        )}

        {/* TAB 2: DEUDAS Y ESTRATEGIA */}
        {activeTab === 'debts' && (
          <div className="space-y-8">
            <StrategyPayoff
              deudas={financialData.deudas}
              cashFlow={cashFlow}
              extraPayment={financialData.config?.aportacionExtraMensual || 2500}
              exchangeRate={exchangeRate}
              displayCurrency={displayCurrency}
            />

            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Tus Tarjetas & Deudas Registradas
                </h3>
                <p className="text-xs text-slate-400">
                  {financialData.deudas.length} créditos en pesos y dólares bajo seguimiento.
                </p>
              </div>

              <button
                onClick={() => { setDebtToEdit(null); setIsDebtModalOpen(true); }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Deuda</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {financialData.deudas.map(debt => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  exchangeRate={exchangeRate}
                  displayCurrency={displayCurrency}
                  onEdit={(d) => { setDebtToEdit(d); setIsDebtModalOpen(true); }}
                  onDelete={handleDeleteDebt}
                  onPayment={handleDebtPayment}
                />
              ))}
            </div>

            <div className="pt-6">
              <StrategyCompare comparison={comparison} />
            </div>
          </div>
        )}

        {/* TAB 3: CALENDARIO DE PAGOS POR QUINCENA */}
        {activeTab === 'calendar' && (
          <PaymentCalendar
            financialData={financialData}
            onTogglePagoMes={handleTogglePagoMes}
            exchangeRate={exchangeRate}
            displayCurrency={displayCurrency}
          />
        )}

        {/* TAB 4: TRANSACCIONES & GASTOS DIARIOS */}
        {activeTab === 'transactions' && (
          <TransactionsTracker
            financialData={financialData}
            onUpdateTransactions={handleUpdateTransactions}
          />
        )}

        {/* TAB 5: CALCULADORAS FINANCIERAS (CAT, MSI, RETIRO, REFINANCIAMIENTO...) */}
        {activeTab === 'calculators' && (
          <FinancialCalculatorsHub
            financialData={financialData}
            exchangeRate={exchangeRate}
          />
        )}

        {/* TAB 6: DIAGNÓSTICO & SALUD FINANCIERA */}
        {activeTab === 'health' && (
          <FinancialHealthScore
            financialData={financialData}
            exchangeRate={exchangeRate}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* TAB 7: BURÓ DE CRÉDITO, CHECKLIST & NEGOCIACIÓN */}
        {activeTab === 'diagnostics' && (
          <AdvancedDiagnosticsHub />
        )}

        {/* TAB 8: SIMULADOR WHAT-IF */}
        {activeTab === 'simulator' && (
          <Simulator
            deudas={financialData.deudas}
            exchangeRate={exchangeRate}
            initialExtra={financialData.config?.aportacionExtraMensual || 2500}
          />
        )}

        {/* TAB 9: ESTADO DE RESULTADOS & SAT */}
        {activeTab === 'budget' && (
          <IncomeStatement
            financialData={financialData}
            onUpdateHonorarios={(hon) => setFinancialData({ ...financialData, honorarios: hon })}
            onUpdateGastos={(nec, opc) => setFinancialData({ ...financialData, gastosNecesarios: nec, gastosOpcionales: opc })}
          />
        )}

        {/* TAB 10: ESTRUCTURA DE CAPITAL (BALANCE) */}
        {activeTab === 'balance' && (
          <BalanceSheet
            financialData={financialData}
            onUpdateActivos={(act) => setFinancialData({ ...financialData, activos: act })}
            exchangeRate={exchangeRate}
            displayCurrency={displayCurrency}
          />
        )}

        {/* TAB 11: INVERSIONES & AHORRO */}
        {activeTab === 'investments' && (
          <Investments
            financialData={financialData}
            cashFlow={cashFlow}
            exchangeRate={exchangeRate}
          />
        )}

        {/* TAB 12: REPORTE EJECUTIVO / PDF */}
        {activeTab === 'report' && (
          <PrintableReport
            financialData={financialData}
            exchangeRate={exchangeRate}
          />
        )}

      </main>

      {/* Modales */}
      <DebtModal
        isOpen={isDebtModalOpen}
        onClose={() => { setIsDebtModalOpen(false); setDebtToEdit(null); }}
        onSave={handleSaveDebt}
        debtToEdit={debtToEdit}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        exchangeRateData={exchangeRateData}
        onRefreshRate={() => updateRate(true)}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onResetDefaults={handleResetDefaults}
      />

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        onActivateLicense={handleActivateLicense}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={setActiveTab}
        onAction={handleCommandAction}
      />

      <Roadmap100Modal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 bg-slate-950 print:hidden">
        <p>Gairo Finances &copy; 2026 · Plataforma SaaS Comercial · Optimizada para Lighthouse 100%</p>
      </footer>
    </div>
  );
}
