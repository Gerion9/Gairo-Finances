import React, { useState } from 'react';
import { X, RefreshCw, Lock, Save, Download, Upload, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { setManualExchangeRate, getManualExchangeRate } from '../services/exchangeRate';
import { changePassword } from '../services/auth';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  exchangeRateData, 
  onRefreshRate, 
  onExportBackup, 
  onImportBackup, 
  onResetDefaults 
}) {
  const [manualRateInput, setManualRateInput] = useState(getManualExchangeRate() || '');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState({ error: '', success: '' });
  const [rateMsg, setRateMsg] = useState('');

  if (!isOpen) return null;

  const handleSaveRate = (e) => {
    e.preventDefault();
    setManualExchangeRate(manualRateInput);
    onRefreshRate();
    setRateMsg('¡Tipo de cambio actualizado con éxito!');
    setTimeout(() => setRateMsg(''), 2500);
  };

  const handleResetToAutoRate = () => {
    setManualExchangeRate(null);
    setManualRateInput('');
    onRefreshRate();
    setRateMsg('Restablecido a cotización automática de mercado.');
    setTimeout(() => setRateMsg(''), 2500);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ error: '', success: '' });

    const res = await changePassword(currentPass, newPass);
    if (res.success) {
      setPassMsg({ error: '', success: '¡Contraseña actualizada correctamente!' });
      setCurrentPass('');
      setNewPass('');
      setTimeout(() => setPassMsg({ error: '', success: '' }), 2500);
    } else {
      setPassMsg({ error: res.error || 'Error al cambiar contraseña', success: '' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Ajustes & Configuración</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Section 1: Exchange Rate */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Tipo de Cambio USD/MXN
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Actualmente: <strong className="text-white">${exchangeRateData?.rate?.toFixed(4)} MXN</strong> ({exchangeRateData?.source}).
            </p>

            <form onSubmit={handleSaveRate} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Ej. 19.45 (dejar vacío para auto)"
                  value={manualRateInput}
                  onChange={(e) => setManualRateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shrink-0"
                >
                  Fijar
                </button>
              </div>

              <div className="flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={handleResetToAutoRate}
                  className="text-emerald-400 hover:underline text-[11px]"
                >
                  Usar cotización automática en vivo
                </button>
                {rateMsg && <span className="text-emerald-400 font-semibold">{rateMsg}</span>}
              </div>
            </form>
          </div>

          {/* Section 2: Password Change */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Seguridad: Cambiar Contraseña Maestra
            </h3>

            {passMsg.error && (
              <p className="text-xs text-red-400 mb-2">{passMsg.error}</p>
            )}
            {passMsg.success && (
              <p className="text-xs text-emerald-400 mb-2">{passMsg.success}</p>
            )}

            <form onSubmit={handleChangePassword} className="space-y-2.5">
              <input
                type="password"
                required
                placeholder="Contraseña actual"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
              <input
                type="password"
                required
                placeholder="Nueva contraseña"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-colors"
              >
                Actualizar Contraseña
              </button>
            </form>
          </div>

          {/* Section 3: Data Backup & Reset */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Respaldo & Sincronización de Datos
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onExportBackup}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar JSON</span>
              </button>

              <label className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-teal-400" />
                <span>Importar JSON</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={onImportBackup}
                />
              </label>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80">
              <button
                onClick={onResetDefaults}
                className="w-full py-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Valores Iniciales del Excel</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
