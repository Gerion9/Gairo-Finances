import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Zap, 
  Calculator, 
  Layers, 
  Calendar, 
  Receipt, 
  Activity, 
  ShieldCheck, 
  Printer, 
  ArrowRight,
  Sparkles,
  Percent,
  Coffee,
  PieChart,
  Home,
  Briefcase,
  TrendingUp,
  FileSpreadsheet,
  Settings,
  Crown,
  BookOpen
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onNavigateTab, onAction }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const allItems = [
    // Pestañas Principales
    { id: 'dashboard', title: 'Panel Resumen & KPIs Principales', category: 'General', tab: 'dashboard', icon: Zap },
    { id: 'debts', title: 'Estrategia Gairo & Portafolio de Deudas', category: 'Deudas', tab: 'debts', icon: Layers },
    { id: 'calendar', title: 'Calendario de Pagos por Quincena (Q1 & Q2)', category: 'Flujo de Caja', tab: 'calendar', icon: Calendar },
    { id: 'transactions', title: 'Control de Transacciones Diarias & Presupuesto', category: 'Presupuesto', tab: 'transactions', icon: Receipt },
    { id: 'calculators', title: 'Suite de Calculadoras Financieras (Hub)', category: 'Herramientas', tab: 'calculators', icon: Calculator },
    { id: 'health', title: 'Score de Salud Financiera (0 a 100) & Bleed Rate', category: 'Diagnóstico', tab: 'health', icon: Activity },
    { id: 'diagnostics', title: 'Guía Buró de Crédito, Checklist & Carta UNE', category: 'Diagnóstico', tab: 'diagnostics', icon: ShieldCheck },
    { id: 'simulator', title: 'Simulador What-If con Control Deslizante & Confetti', category: 'Simulador', tab: 'simulator', icon: Sparkles },
    { id: 'budget', title: 'Estado de Resultados Personal & Módulo SAT CFDI', category: 'Fiscal SAT', tab: 'budget', icon: Zap },
    { id: 'balance', title: 'Balance General & Patrimonio Neto (Activos - Pasivos)', category: 'Capital', tab: 'balance', icon: ShieldCheck },
    { id: 'investments', title: 'Fondo de Emergencia & Interés Compuesto CETES', category: 'Inversión', tab: 'investments', icon: TrendingUp },
    { id: 'report', title: 'Generador de Reporte Ejecutivo Imprimible / PDF', category: 'Exportación', tab: 'report', icon: Printer },

    // Accesos Directos Específicos a Calculadoras
    { id: 'calc-cat', title: 'Calculadora de CAT Real & Costo Anual Total', category: 'Calculadora', tab: 'calculators', icon: Percent },
    { id: 'calc-msi', title: 'Meses Sin Intereses (MSI) vs Descuento Contado', category: 'Calculadora', tab: 'calculators', icon: Sparkles },
    { id: 'calc-windfall', title: 'Inyección de Aguinaldo, Bonos o Finiquito', category: 'Calculadora', tab: 'calculators', icon: Layers },
    { id: 'calc-hormiga', title: 'Detector de Gastos Hormiga & Costo Compuesto', category: 'Calculadora', tab: 'calculators', icon: Coffee },
    { id: 'calc-503020', title: 'Auditoría de Presupuesto Regla 50 / 30 / 20', category: 'Calculadora', tab: 'calculators', icon: PieChart },
    { id: 'calc-refinance', title: 'Calculadora de Refinanciamiento / Consolidación', category: 'Calculadora', tab: 'calculators', icon: TrendingUp },
    { id: 'calc-fire', title: 'Calculadora de Retiro Temprano (FIRE Number)', category: 'Calculadora', tab: 'calculators', icon: TrendingUp },
    { id: 'calc-horas', title: 'Conversor de Gastos a Horas de Trabajo', category: 'Calculadora', tab: 'calculators', icon: Briefcase },
    { id: 'calc-rent-buy', title: 'Comparador Rentar vs Comprar Vivienda', category: 'Calculadora', tab: 'calculators', icon: Home },
    { id: 'calc-real-yield', title: 'Rendimiento Real vs Inflación e ISR', category: 'Calculadora', tab: 'calculators', icon: Percent },
    { id: 'calc-deductions', title: 'Deducciones Personales SAT & Devolución Anual', category: 'Calculadora', tab: 'calculators', icon: BookOpen },
    { id: 'calc-resico', title: 'Simulador Fiscal RESICO vs Actividad Profesional', category: 'Calculadora', tab: 'calculators', icon: ShieldCheck },

    // Acciones y Configuración
    { id: 'act-excel', title: 'Descargar Libro Completo en Excel (.xlsx)', category: 'Acción', action: 'exportExcel', icon: FileSpreadsheet },
    { id: 'act-settings', title: 'Ajustes, Contraseña & Tipo de Cambio USD/MXN', category: 'Configuración', action: 'openSettings', icon: Settings },
    { id: 'act-pricing', title: 'Ver Planes Comerciales PRO & Licencias SaaS', category: 'SaaS', action: 'openPricing', icon: Crown }
  ];

  const filtered = allItems.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) || 
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Buscar cualquier herramienta, calculadora o acción (Ctrl+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500">No se encontraron herramientas con "{query}".</p>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action && onAction) {
                      onAction(item.action);
                    } else if (item.tab && onNavigateTab) {
                      onNavigateTab(item.tab);
                    }
                    onClose();
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-800/80 flex items-center justify-between text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 group-hover:border-emerald-500/40">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
          <span>Acceso instantáneo a las 50 funcionalidades en 1 solo clic</span>
          <span className="font-mono">Gairo Finances 2026</span>
        </div>

      </div>
    </div>
  );
}
