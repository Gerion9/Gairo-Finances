import React, { useState, useMemo } from 'react';
import { 
  X, Search, Sparkles, Rocket, Zap, Shield, Cpu, 
  Palette, Calculator, Landmark, Database, Gamepad2, 
  CheckCircle2, Download, Copy, ExternalLink, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import roadmapData from '../data/roadmap100.json';

const PILLARS = [
  { id: 0, name: 'Todos los Pilares', icon: Sparkles, color: 'text-emerald-400 border-emerald-500/30' },
  { id: 1, name: 'Rendimiento & PWA (1-12)', icon: Zap, color: 'text-amber-400 border-amber-500/30' },
  { id: 2, name: 'UI/UX Elite (13-25)', icon: Palette, color: 'text-indigo-400 border-indigo-500/30' },
  { id: 3, name: 'Motor Financiero (26-38)', icon: Calculator, color: 'text-cyan-400 border-cyan-500/30' },
  { id: 4, name: 'Integración & OCR (39-50)', icon: Database, color: 'text-blue-400 border-blue-500/30' },
  { id: 5, name: 'Fiscal SAT & CFDI (51-62)', icon: Landmark, color: 'text-rose-400 border-rose-500/30' },
  { id: 6, name: 'Psicología & Gamificación (63-75)', icon: Gamepad2, color: 'text-purple-400 border-purple-500/30' },
  { id: 7, name: 'Criptografía & Privacidad (76-85)', icon: Shield, color: 'text-teal-400 border-teal-500/30' },
  { id: 8, name: 'Comercialización SaaS (86-95)', icon: Rocket, color: 'text-emerald-400 border-emerald-500/30' },
  { id: 9, name: 'Accesibilidad & i18n (96-100)', icon: Cpu, color: 'text-orange-400 border-orange-500/30' },
];

export default function Roadmap100Modal({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPillar, setSelectedPillar] = useState(0);
  const [expandedItems, setExpandedItems] = useState({});
  const [copied, setCopied] = useState(false);

  // Toggle expansion of an item
  const toggleItem = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = (expand) => {
    if (!expand) {
      setExpandedItems({});
    } else {
      const all = {};
      filteredData.forEach(item => { all[item.id] = true; });
      setExpandedItems(all);
    }
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    return roadmapData.filter(item => {
      const matchesPillar = selectedPillar === 0 || item.pillarId === selectedPillar;
      const q = searchTerm.toLowerCase().trim();
      if (!q) return matchesPillar;

      const matchesSearch = 
        item.title.toLowerCase().includes(q) ||
        item.why.toLowerCase().includes(q) ||
        item.how.toLowerCase().includes(q) ||
        item.kpi.toLowerCase().includes(q) ||
        item.pillarName.toLowerCase().includes(q) ||
        item.id.toString() === q;

      return matchesPillar && matchesSearch;
    });
  }, [searchTerm, selectedPillar]);

  const handleCopySummary = () => {
    const text = `Plan Maestro de 100 Optimizaciones: Sifran\n100/100 optimizaciones estructuradas en 9 pilares estratégicos.\nConsulta el documento completo en PLAN_100_OPTIMIZACIONES.md en el repositorio.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 mt-1 shadow-inner">
              <Rocket className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Plan Maestro: 100 Optimizaciones FinTech
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  100% Factibles
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  5 Fases de Ejecución
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Blueprint exhaustivo para convertir a Sifran en un producto de clase mundial masivamente comercializable y viral.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Optimizaciones:</span>
            <span className="font-extrabold text-emerald-400 text-sm">100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Pilares Estratégicos:</span>
            <span className="font-extrabold text-indigo-400 text-sm">9 Pilares</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Filtrados actualmente:</span>
            <span className="font-bold text-white text-sm">{filteredData.length} de 100</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar Resumen'}
            </button>
          </div>
        </div>

        {/* Search & Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/90 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por término (PWA, SAT, PDF, Cifrado, Stripe, Monte Carlo)..."
                className="w-full pl-10 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => toggleAll(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Expandir Todo
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Colapsar Todo
              </button>
            </div>
          </div>

          {/* Pillars Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            {PILLARS.map(p => {
              const Icon = p.icon;
              const isSelected = selectedPillar === p.id;
              const count = p.id === 0 ? 100 : roadmapData.filter(i => i.pillarId === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPillar(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isSelected 
                      ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{p.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List of 100 Optimizations */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-700">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-2 text-slate-500 opacity-40" />
              <p className="text-base font-semibold">No se encontraron optimizaciones para &quot;{searchTerm}&quot;</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedPillar(0); }}
                className="mt-3 px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            filteredData.map((item) => {
              const isExpanded = !!expandedItems[item.id];
              return (
                <div 
                  key={item.id}
                  className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                    isExpanded 
                      ? 'bg-slate-800/60 border-emerald-500/40 shadow-lg' 
                      : 'bg-slate-950/40 hover:bg-slate-850 border-slate-800'
                  }`}
                >
                  {/* Card Header / Summary */}
                  <div 
                    onClick={() => toggleItem(item.id)}
                    className="p-3.5 sm:p-4 cursor-pointer flex items-start justify-between gap-3 select-none"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 font-black text-xs shrink-0 shadow-inner">
                        #{item.id}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.pillarName}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                            {item.feasibility}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h3>
                        {!isExpanded && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {item.why}
                          </p>
                        )}
                      </div>
                    </div>

                    <button 
                      className="p-1 text-slate-400 hover:text-white rounded transition-colors shrink-0"
                      aria-label="Expandir detalles"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5 border-t border-slate-800/60 space-y-3 text-xs sm:text-sm">
                      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1">
                        <div className="font-bold text-amber-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                          <span>💡 ¿Por qué es crucial? (Impacto Comercial & UX):</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          {item.why}
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1">
                        <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                          <span>🛠️ ¿Cómo se implementaría técnicamente?:</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed font-mono text-xs whitespace-pre-line">
                          {item.how}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-300">
                          <span className="font-bold">Métrica / KPI:</span>
                          <span>{item.kpi}</span>
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Factibilidad: <span className="text-white font-medium">{item.feasibility}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Documento maestro completo en <code className="text-emerald-300 bg-slate-800 px-1.5 py-0.5 rounded font-mono">PLAN_100_OPTIMIZACIONES.md</code></span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl transition-all shadow-md"
          >
            Entendido / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
