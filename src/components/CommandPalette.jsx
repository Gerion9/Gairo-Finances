import React, { useState, useEffect } from 'react';
import { Search, X, Zap, Calculator, Layers, Calendar, Receipt, Activity, ShieldCheck, Printer, ArrowRight } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onNavigateTab, onAction }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(); // toggle
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
    { id: 'dashboard', title: 'Panel Resumen & KPIs', category: 'General', tab: 'dashboard', icon: Zap },
    { id: 'debts', title: 'Estrategia Gairo & Deudas', category: 'Deudas', tab: 'debts', icon: Layers },
    { id: 'calendar', title: 'Calendario de Pagos por Quincena', category: 'Flujo', tab: 'calendar', icon: Calendar },
    { id: 'transactions', title: 'Control de Transacciones & Presupuesto', category: 'Presupuesto', tab: 'transactions', icon: Receipt },
    { id: 'calculators', title: 'Suite de Calculadoras Financieras (CAT, MSI, Aguinaldo...)', category: 'Herramientas', tab: 'calculators', icon: Calculator },
    { id: 'health', title: 'Diagnóstico & Salud Financiera (Score)', category: 'Diagnóstico', tab: 'health', icon: Activity },
    { id: 'diagnostics', title: 'Guía Buró, Checklist Mensual & Cartas Bancarias', category: 'Diagnóstico', tab: 'diagnostics', icon: ShieldCheck },
    { id: 'simulator', title: 'Simulador What-If de Desendeudamiento', category: 'Simulador', tab: 'simulator', icon: Calculator },
    { id: 'budget', title: 'Estado de Resultados & Módulo SAT CFDI', category: 'Fiscal', tab: 'budget', icon: Zap },
    { id: 'balance', title: 'Balance General & Patrimonio Neto', category: 'Capital', tab: 'balance', icon: ShieldCheck },
    { id: 'investments', title: 'Fondo de Emergencia & Interés Compuesto', category: 'Inversión', tab: 'investments', icon: Zap },
    { id: 'report', title: 'Reporte Ejecutivo Imprimible / PDF', category: 'Exportación', tab: 'report', icon: Printer },
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
            placeholder="Buscar herramienta, calculadora o sección (Ctrl+K)..."
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
                    onNavigateTab(item.tab);
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
          <span>Navega a cualquier funcionalidad en 1 solo clic</span>
          <span>Presiona <strong className="text-slate-200 font-mono">Ctrl + K</strong> para abrir en cualquier momento</span>
        </div>

      </div>
    </div>
  );
}
