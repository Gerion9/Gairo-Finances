import React, { useState } from 'react';
import { Plus, Receipt, ArrowDownRight, ArrowUpRight, Filter, Trash2, CheckCircle2, TrendingUp } from 'lucide-react';
import { formatMoney } from '../services/exchangeRate';

export default function TransactionsTracker({ financialData, onUpdateTransactions }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [newTx, setNewTx] = useState({
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    monto: '',
    tipo: 'GASTO',
    categoria: 'Alimentos',
    metodoPago: 'BBVA Débito',
    moneda: 'MXN'
  });

  const categories = [
    'Alimentos', 'Vivienda', 'Servicios', 'Transporte', 'Mascota', 
    'Estilo de Vida', 'Honorarios', 'Otros'
  ];

  // Cálculo de gastos reales del mes actual por categoría
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = financialData.transacciones.filter(t => t.fecha.startsWith(currentMonth));

  const realExpensesByCategory = {};
  monthTransactions.filter(t => t.tipo === 'GASTO').forEach(t => {
    realExpensesByCategory[t.categoria] = (realExpensesByCategory[t.categoria] || 0) + (Number(t.monto) || 0);
  });

  // Presupuesto mapeado dinámicamente desde gastosNecesarios y gastosOpcionales
  const budgetByCategory = {};
  [...(financialData?.gastosNecesarios || []), ...(financialData?.gastosOpcionales || [])].forEach(g => {
    if (g.categoria) {
      budgetByCategory[g.categoria] = (budgetByCategory[g.categoria] || 0) + (Number(g.monto) || 0);
    }
  });
  // Fallback para categorías estándar si estuvieran en $0
  const defaultBudgets = {
    'Vivienda': 8500,
    'Servicios': 2200,
    'Transporte': 2800,
    'Alimentos': 10000,
    'Mascota': 3500,
    'Estilo de Vida': 5500
  };
  Object.keys(defaultBudgets).forEach(cat => {
    if (!budgetByCategory[cat]) {
      budgetByCategory[cat] = defaultBudgets[cat];
    }
  });

  const handleAddTx = (e) => {
    e.preventDefault();
    if (!newTx.descripcion || !newTx.monto) return;

    const txToAdd = {
      id: 'tx_' + Date.now(),
      fecha: newTx.fecha,
      descripcion: newTx.descripcion.trim(),
      monto: parseFloat(newTx.monto) || 0,
      tipo: newTx.tipo,
      categoria: newTx.categoria,
      metodoPago: newTx.metodoPago,
      moneda: newTx.moneda
    };

    onUpdateTransactions([txToAdd, ...financialData.transacciones]);
    setNewTx({
      fecha: new Date().toISOString().split('T')[0],
      descripcion: '',
      monto: '',
      tipo: 'GASTO',
      categoria: 'Alimentos',
      metodoPago: 'BBVA Débito',
      moneda: 'MXN'
    });
    setShowAddModal(false);
  };

  const handleDeleteTx = (id) => {
    const updated = financialData.transacciones.filter(t => t.id !== id);
    onUpdateTransactions(updated);
  };

  const filteredList = financialData.transacciones.filter(t => {
    if (filterType === 'ALL') return true;
    return t.tipo === filterType;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Control de Transacciones Diarias & Presupuesto Real
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitorea cada gasto real frente a tus topes presupuestados de costo de vida para no desbordarte.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>

        {/* Budget vs Real Progress Bars */}
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
            Presupuesto Mensual vs Gasto Real Consumido
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(budgetByCategory).map(([cat, budget]) => {
              const spent = realExpensesByCategory[cat] || 0;
              const percent = Math.min(100, Math.round((spent / budget) * 100));
              const isOver = spent > budget;

              return (
                <div key={cat} className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-white">{cat}</span>
                    <span className={`font-mono font-bold ${isOver ? 'text-red-400' : 'text-slate-300'}`}>
                      {formatMoney(spent, 'MXN')} / {formatMoney(budget, 'MXN')}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOver ? 'bg-red-500' : percent > 75 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{percent}% gastado</span>
                    <span>{isOver ? '⚠️ Sobrepasado' : `$${(budget - spent).toLocaleString('es-MX')} restante`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Transactions Table & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-base font-extrabold text-white">
            Historial de Movimientos ({filteredList.length})
          </h3>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded font-semibold ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('GASTO')}
              className={`px-3 py-1 rounded font-semibold ${filterType === 'GASTO' ? 'bg-slate-800 text-rose-400' : 'text-slate-400'}`}
            >
              Gastos
            </button>
            <button
              onClick={() => setFilterType('INGRESO')}
              className={`px-3 py-1 rounded font-semibold ${filterType === 'INGRESO' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}
            >
              Ingresos
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Método</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredList.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 text-slate-400">{tx.fecha}</td>
                  <td className="py-2.5 px-3 font-semibold text-white font-sans">{tx.descripcion}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-sans">
                      {tx.categoria}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">{tx.metodoPago}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${tx.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.tipo === 'INGRESO' ? '+' : '-'}{formatMoney(tx.monto, tx.moneda)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleDeleteTx(tx.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Eliminar movimiento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Transacción */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Registrar Movimiento</h3>
            <form onSubmit={handleAddTx} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Tipo</label>
                  <select
                    value={newTx.tipo}
                    onChange={(e) => setNewTx({ ...newTx, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    <option value="GASTO">Gasto / Salida</option>
                    <option value="INGRESO">Ingreso / Entrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newTx.fecha}
                    onChange={(e) => setNewTx({ ...newTx, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Supermercado, Gasolina, Pago de cliente..."
                  value={newTx.descripcion}
                  onChange={(e) => setNewTx({ ...newTx, descripcion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Monto</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={newTx.monto}
                    onChange={(e) => setNewTx({ ...newTx, monto: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Moneda</label>
                  <select
                    value={newTx.moneda}
                    onChange={(e) => setNewTx({ ...newTx, moneda: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    <option value="MXN">MXN ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Categoría</label>
                  <select
                    value={newTx.categoria}
                    onChange={(e) => setNewTx({ ...newTx, categoria: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Método de Pago</label>
                  <input
                    type="text"
                    placeholder="Ej. BBVA Débito, Efectivo"
                    value={newTx.metodoPago}
                    onChange={(e) => setNewTx({ ...newTx, metodoPago: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
