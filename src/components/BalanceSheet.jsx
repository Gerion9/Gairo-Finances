import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, ArrowUpRight, DollarSign } from 'lucide-react';
import { formatMoney, convertCurrency } from '../services/exchangeRate';

export default function BalanceSheet({ financialData, onUpdateActivos, exchangeRate, displayCurrency }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    nombre: '',
    tipo: 'Efectivo',
    moneda: 'MXN',
    monto: ''
  });

  // Activos totales en MXN
  const totalActivosMXN = financialData.activos.reduce((sum, a) => {
    return sum + convertCurrency(a.monto, a.moneda, 'MXN', exchangeRate);
  }, 0);

  // Pasivos totales en MXN
  const totalPasivosMXN = financialData.deudas.reduce((sum, d) => {
    return sum + convertCurrency(d.saldo, d.moneda, 'MXN', exchangeRate);
  }, 0);

  // Patrimonio Neto = Activos - Pasivos
  const patrimonioNetoMXN = totalActivosMXN - totalPasivosMXN;
  const ratioApalancamiento = totalActivosMXN > 0 ? (totalPasivosMXN / totalActivosMXN) : 0;

  const handleAddAsset = (e) => {
    e.preventDefault();
    if (!newAsset.nombre || !newAsset.monto) return;

    const updated = [
      ...financialData.activos,
      {
        id: 'a_' + Date.now(),
        nombre: newAsset.nombre.trim(),
        tipo: newAsset.tipo,
        moneda: newAsset.moneda,
        monto: parseFloat(newAsset.monto) || 0
      }
    ];
    onUpdateActivos(updated);
    setNewAsset({ nombre: '', tipo: 'Efectivo', moneda: 'MXN', monto: '' });
    setShowAddModal(false);
  };

  const handleDeleteAsset = (id) => {
    const updated = financialData.activos.filter(a => a.id !== id);
    onUpdateActivos(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Estructura de Capital: Balance General & Patrimonio Neto
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                Hoja Ideas Excel
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Control ejecutivo de Activos, Pasivos (Deudas en MXN y USD) y Capital Contable personal.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Activo</span>
          </button>
        </div>

        {/* Big Net Worth Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              1. Total Activos (Efectivo & Inversión)
            </span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">
              {formatMoney(totalActivosMXN, 'MXN')}
            </span>
            <span className="text-[11px] text-slate-500">Cuentas MXN, USD y CETES</span>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              2. Total Pasivos (Deudas)
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
              -{formatMoney(totalPasivosMXN, 'MXN')}
            </span>
            <span className="text-[11px] text-slate-500">Deudas activas convertidas</span>
          </div>

          <div className={`p-4 rounded-xl border ${patrimonioNetoMXN >= 0 ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              3. Patrimonio Neto (Activos − Pasivos)
            </span>
            <span className={`text-2xl font-black font-mono mt-1 block ${patrimonioNetoMXN >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
              {formatMoney(patrimonioNetoMXN, 'MXN')}
            </span>
            <span className="text-[11px] text-slate-400">
              Apalancamiento: {(ratioApalancamiento * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Two Columns: Activos vs Pasivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Activos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-white">
              Tus Activos Registrados
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {formatMoney(totalActivosMXN, 'MXN')}
            </span>
          </div>

          <div className="space-y-2.5">
            {financialData.activos.map(asset => {
              const montoMXN = convertCurrency(asset.monto, asset.moneda, 'MXN', exchangeRate);
              return (
                <div key={asset.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs block">{asset.nombre}</span>
                    <span className="text-[11px] text-slate-400">{asset.tipo} · {asset.moneda}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {formatMoney(asset.monto, asset.moneda)}
                    </span>
                    <button
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Pasivos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-white">
              Tus Pasivos (Deudas)
            </h3>
            <span className="text-xs font-mono font-bold text-rose-400">
              {formatMoney(totalPasivosMXN, 'MXN')}
            </span>
          </div>

          <div className="space-y-2.5">
            {financialData.deudas.map(debt => {
              const saldoMXN = convertCurrency(debt.saldo, debt.moneda, 'MXN', exchangeRate);
              return (
                <div key={debt.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs block">{debt.nombre}</span>
                    <span className="text-[11px] text-slate-400">{debt.institucion} · {debt.tasaAnual}% APR</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-rose-400">
                    {formatMoney(debt.saldo, debt.moneda)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal Add Asset */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Agregar Nuevo Activo</h3>
            <form onSubmit={handleAddAsset} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Nombre del Activo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cuenta BBVA, CETES, Auto..."
                  value={newAsset.nombre}
                  onChange={(e) => setNewAsset({ ...newAsset, nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Tipo</label>
                  <select
                    value={newAsset.tipo}
                    onChange={(e) => setNewAsset({ ...newAsset, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    <option value="Efectivo">Efectivo / Débito</option>
                    <option value="Inversión">Inversión (CETES, Sofipos)</option>
                    <option value="Bien Fijo">Bien Fijo (Auto, Inmueble)</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Moneda</label>
                  <select
                    value={newAsset.moneda}
                    onChange={(e) => setNewAsset({ ...newAsset, moneda: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    <option value="MXN">MXN ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold uppercase mb-1">Monto Actual</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={newAsset.monto}
                  onChange={(e) => setNewAsset({ ...newAsset, monto: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                />
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
                  Guardar Activo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
