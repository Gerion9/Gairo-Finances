import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Calendar } from 'lucide-react';

export default function DebtModal({ isOpen, onClose, onSave, debtToEdit }) {
  const [formData, setFormData] = useState({
    nombre: '',
    institucion: '',
    moneda: 'MXN',
    saldo: '',
    tasaAnual: '',
    pagoMinimo: '',
    diaCorte: 15,
    diaPagoLimite: 5,
    tipo: 'HIGH_INTEREST',
    promoDeadline: '',
    tasaRegularPostPromo: '',
    anualidad: '',
    notas: ''
  });

  useEffect(() => {
    if (debtToEdit) {
      setFormData({
        nombre: debtToEdit.nombre || '',
        institucion: debtToEdit.institucion || '',
        moneda: debtToEdit.moneda || 'MXN',
        saldo: debtToEdit.saldo !== undefined ? debtToEdit.saldo : '',
        tasaAnual: debtToEdit.tasaAnual !== undefined ? debtToEdit.tasaAnual : '',
        pagoMinimo: debtToEdit.pagoMinimo !== undefined ? debtToEdit.pagoMinimo : '',
        diaCorte: debtToEdit.diaCorte !== undefined ? debtToEdit.diaCorte : 15,
        diaPagoLimite: debtToEdit.diaPagoLimite !== undefined ? debtToEdit.diaPagoLimite : 5,
        tipo: debtToEdit.tipo || 'HIGH_INTEREST',
        promoDeadline: debtToEdit.promoDeadline || '',
        tasaRegularPostPromo: debtToEdit.tasaRegularPostPromo || '',
        anualidad: debtToEdit.anualidad || '',
        notas: debtToEdit.notas || ''
      });
    } else {
      setFormData({
        nombre: '',
        institucion: '',
        moneda: 'MXN',
        saldo: '',
        tasaAnual: '',
        pagoMinimo: '',
        diaCorte: 15,
        diaPagoLimite: 5,
        tipo: 'HIGH_INTEREST',
        promoDeadline: '',
        tasaRegularPostPromo: '',
        anualidad: '',
        notas: ''
      });
    }
  }, [debtToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: debtToEdit?.id || 'd_' + Date.now(),
      nombre: formData.nombre.trim(),
      institucion: formData.institucion.trim(),
      moneda: formData.moneda,
      saldo: parseFloat(formData.saldo) || 0,
      tasaAnual: parseFloat(formData.tasaAnual) || 0,
      pagoMinimo: parseFloat(formData.pagoMinimo) || 0,
      diaCorte: parseInt(formData.diaCorte) || 15,
      diaPagoLimite: parseInt(formData.diaPagoLimite) || 5,
      tipo: formData.tipo,
      promoDeadline: formData.promoDeadline,
      tasaRegularPostPromo: parseFloat(formData.tasaRegularPostPromo) || 0,
      anualidad: parseFloat(formData.anualidad) || 0,
      notas: formData.notas.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {debtToEdit ? 'Editar Deuda / Crédito' : 'Nueva Deuda / Crédito'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nombre de la deuda *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. BBVA Gold, Apple MSI..."
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Institución / Banco
              </label>
              <input
                type="text"
                placeholder="Ej. BBVA, Chase, Banamex..."
                value={formData.institucion}
                onChange={(e) => setFormData({ ...formData, institucion: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Moneda *
              </label>
              <select
                value={formData.moneda}
                onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="MXN">Pesos Mexicanos (MXN)</option>
                <option value="USD">Dólares Americanos (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Saldo Actual *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={formData.saldo}
                onChange={(e) => setFormData({ ...formData, saldo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Tasa de Interés Anual (%) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="Ej. 49.03 (o 0 si es promo)"
                value={formData.tasaAnual}
                onChange={(e) => setFormData({ ...formData, tasaAnual: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Pago Mínimo Mensual *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={formData.pagoMinimo}
                onChange={(e) => setFormData({ ...formData, pagoMinimo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Fechas de corte y pago para el calendario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Día de Corte (1 - 31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="15"
                value={formData.diaCorte}
                onChange={(e) => setFormData({ ...formData, diaCorte: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Día Límite de Pago (1 - 31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="5"
                value={formData.diaPagoLimite}
                onChange={(e) => setFormData({ ...formData, diaPagoLimite: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Estrategia / Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Tipo de Deuda y Tratamiento Estratégico *
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="PROMO_DEADLINE">Promoción con Deadline (0% / MSI que vencerá pronto)</option>
              <option value="HIGH_INTEREST">Alto Interés / Revolvente (Objetivo de Avalancha agresiva)</option>
              <option value="LOW_INTEREST_HOLD">Bajo Interés (Dejar correr con pago mínimo sin crecer)</option>
            </select>
          </div>

          {/* Conditional Deadline fields */}
          {formData.tipo === 'PROMO_DEADLINE' && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    Fecha Límite del Deadline *
                  </label>
                  <input
                    type="date"
                    required={formData.tipo === 'PROMO_DEADLINE'}
                    value={formData.promoDeadline}
                    onChange={(e) => setFormData({ ...formData, promoDeadline: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-amber-500/40 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    Tasa si NO se liquida a tiempo (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ej. 45"
                    value={formData.tasaRegularPostPromo}
                    onChange={(e) => setFormData({ ...formData, tasaRegularPostPromo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-amber-500/40 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-amber-200/80">
                La Estrategia Gairo calculará la cuota exacta mensual para liquidar esta deuda al 100% antes de la fecha límite.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Notas y Recordatorios
            </label>
            <textarea
              rows={2}
              placeholder="Anotaciones clave sobre esta deuda..."
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Deuda</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
