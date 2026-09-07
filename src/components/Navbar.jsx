import React, { useState } from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  Settings, 
  LogOut, 
  FileSpreadsheet, 
  ShieldCheck, 
  Layers, 
  PieChart, 
  Calculator, 
  Calendar, 
  Receipt, 
  Activity, 
  Printer, 
  Crown,
  HelpCircle,
  Sparkles,
  Search,
  Eye,
  EyeOff,
  BookOpen,
  Rocket
} from 'lucide-react';
import { exportFinancesToExcel } from '../services/excelExport.js';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  exchangeRateData, 
  onRefreshRate, 
  displayCurrency, 
  setDisplayCurrency, 
  privacyMode,
  setPrivacyMode,
  onOpenCommandPalette,
  onOpenSettings, 
  onOpenPricing,
  onOpenOnboarding,
  onOpenRoadmap,
  onLogout,
  financialData
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshRate();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: PieChart },
    { id: 'debts', label: 'Deudas & Estrategia', icon: Layers },
    { id: 'calendar', label: 'Calendario & Quincenas', icon: Calendar },
    { id: 'transactions', label: 'Transacciones & Gastos', icon: Receipt },
    { id: 'calculators', label: 'Calculadoras (CAT, MSI...)', icon: Calculator },
    { id: 'health', label: 'Diagnóstico & Salud', icon: Activity },
    { id: 'diagnostics', label: 'Buró & Checklist', icon: BookOpen },
    { id: 'simulator', label: 'Simulador What-If', icon: Sparkles },
    { id: 'budget', label: 'Resultados & SAT', icon: TrendingUp },
    { id: 'balance', label: 'Balance General', icon: ShieldCheck },
    { id: 'investments', label: 'Ahorro & CETES', icon: Sparkles },
    { id: 'report', label: 'Reporte PDF', icon: Printer }
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">Gairo<span className="text-emerald-400">Finances</span></span>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenPricing(); }}
                  className="px-2 py-0.5 text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-300 rounded-full border border-amber-500/40 flex items-center gap-1 hover:scale-105 transition-transform"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>PRO</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Planificador de Libertad Financiera</p>
            </div>
          </div>

          {/* Center: Command Palette Trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-xs text-slate-400 hover:text-white transition-all shadow-inner"
            title="Buscar cualquier herramienta (Ctrl + K)"
          >
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>Buscar herramientas o calculadoras...</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
              Ctrl K
            </kbd>
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            
            {/* Mobile Command Palette Trigger */}
            <button
              onClick={onOpenCommandPalette}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Buscar herramientas o calculadoras"
            >
              <Search className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Privacy Mode Toggle */}
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`p-2 rounded-lg transition-colors ${
                privacyMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={privacyMode ? 'Modo Privacidad activo (saldos ocultos). Clic para mostrar.' : 'Activar Modo Privacidad (ocultar saldos)'}
            >
              {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Currency Selector */}
            <div className="hidden sm:flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setDisplayCurrency('MXN')}
                className={`px-2 py-1 rounded font-semibold transition-all ${
                  displayCurrency === 'MXN' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                MXN
              </button>
              <button
                onClick={() => setDisplayCurrency('USD')}
                className={`px-2 py-1 rounded font-semibold transition-all ${
                  displayCurrency === 'USD' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setDisplayCurrency('ORIGINAL')}
                className={`px-2 py-1 rounded font-semibold transition-all ${
                  displayCurrency === 'ORIGINAL' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mixto
              </button>
            </div>

            {/* Live Exchange Rate Pill */}
            <div 
              onClick={onOpenSettings}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:border-emerald-500/50 cursor-pointer text-xs"
              title="Tipo de cambio en vivo. Clic para ajustar."
            >
              <span className="text-slate-400 font-medium">USD:</span>
              <span className="font-bold text-slate-100">${exchangeRateData?.rate?.toFixed(2)}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleRefresh(); }} 
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            {/* Quick Actions */}
            <button
              onClick={onOpenRoadmap}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all"
              title="Ver Plan Maestro de 100 Optimizaciones FinTech"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Roadmap 100</span>
            </button>

            <button
              onClick={() => exportFinancesToExcel(financialData, exchangeRateData?.rate || 19.25)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all"
              title="Descargar reporte completo en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Excel</span>
            </button>

            <button
              onClick={onOpenOnboarding}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Guía de inicio y tutorial"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Ajustes y Parámetros"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-lg bg-slate-800 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>

        {/* Navigation Tabs Bar */}
        <nav aria-label="Navegación principal" className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
