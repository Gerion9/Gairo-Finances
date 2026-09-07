import React, { useRef, useState } from 'react';
import { Download, Upload, RefreshCw, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import Modal from './ui/Modal';

export default function SettingsModal({ account, preferences = {}, onUpdatePreferences, isCurrent = () => true, isOpen, onClose, exchangeRateData, onRefreshRate, onExportBackup, onImportBackup, onResetDefaults, onOpenAssistant }) {
  const [manualRate, setManualRate] = useState(() => preferences.manualRate ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const saveRate = async (event, automatic = false) => {
    event?.preventDefault(); setError(''); setMessage('');
    const value = automatic || manualRate === '' ? null : Number(manualRate);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) { setError('Ingresa un tipo de cambio mayor que cero.'); return; }
    try {
      if (!isCurrent()) return;
      onUpdatePreferences({ ...preferences, manualRate: value, manualRateUpdatedAt: value ? new Date().toISOString() : null });
      if (automatic) setManualRate('');
      await onRefreshRate();
      if (isCurrent()) setMessage(value === null ? 'Modo automático seleccionado. Revisa la confirmación de guardado.' : 'Tipo de cambio actualizado. Revisa la confirmación de guardado.');
    } catch (failure) { setError(failure.message); }
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="Tu espacio, a tu manera" description="Preferencias y respaldos de tu cuenta sincronizada.">
    <div className="space-y-7">
      {message && <p role="status" className="text-sm rounded-xl p-3 bg-emerald-400/10 text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-sm rounded-xl p-3 bg-rose-400/10 text-rose-300">{error}</p>}
      <section className="flex gap-3 rounded-xl border border-slate-700 p-4"><ShieldCheck className="text-emerald-300 shrink-0" size={22} /><div><h3 className="text-base font-semibold text-white">Cuenta de {account?.displayName}</h3><p className="text-sm text-slate-400 mt-1">Tus registros se sincronizan al entrar con esta misma cuenta. El acceso y la recuperación se gestionan desde ChatGPT.</p></div></section>
      <section><h3 className="text-base font-semibold text-white">Tipo de cambio</h3><p className="text-sm text-slate-400 mt-1 mb-4">1 USD = {Number(exchangeRateData?.rate || 0).toFixed(4)} MXN · {exchangeRateData?.source}</p><form onSubmit={saveRate}><label className="text-sm text-slate-300" htmlFor="settings-fx">MXN por cada USD</label><div className="flex gap-2 mt-2"><input id="settings-fx" type="number" step="0.0001" min="0.0001" value={manualRate} onChange={event => setManualRate(event.target.value)} placeholder="Vacío: automático" className="field-input min-w-0" /><button className="button-primary" type="submit">Guardar</button></div></form><button className="button-ghost mt-2" onClick={event => saveRate(event, true)}><RefreshCw size={15} />Usar cambio automático</button></section>
      <section className="border-t border-[#223248] pt-6"><h3 className="text-base font-semibold text-white">Tus datos y respaldos</h3><p className="text-sm text-slate-400 mt-1 mb-4">Descarga una copia adicional o importa tus registros. Un respaldo de otra cuenta no reemplazará los tuyos.</p><div className="grid sm:grid-cols-2 gap-2"><button className="button-secondary" onClick={onExportBackup}><Download size={16} />Descargar respaldo</button><button className="button-secondary" onClick={() => inputRef.current?.click()}><Upload size={16} />Importar mis registros</button><input ref={inputRef} type="file" accept=".json,application/json" aria-label="Archivo de respaldo JSON" className="sr-only" tabIndex={-1} onChange={onImportBackup} /></div></section>
      <section className="border-t border-[#223248] pt-6"><button onClick={onOpenAssistant} className="flex w-full items-center gap-3 rounded-xl p-4 text-left bg-[#B8AFF8]/10 border border-[#B8AFF8]/20"><Sparkles size={23} className="text-[#B8AFF8] shrink-0" /><span className="flex-1"><strong className="block text-sm text-white">Conexión con Claude</strong><span className="text-sm text-slate-400">Consulta el estado de la IA de tu cuenta.</span></span><ArrowRight size={17} className="text-[#B8AFF8]" /></button></section>
      <details className="border-t border-[#223248] pt-5"><summary className="cursor-pointer text-sm text-slate-400 py-2">Vaciar los registros de {account?.displayName}</summary><p className="text-sm text-slate-400 mt-2 mb-4">Vacía esta cuenta en todos tus dispositivos y conserva tu acceso. Descarga un respaldo primero.</p><button className="button-secondary text-rose-300" onClick={onResetDefaults}>Vaciar esta cuenta</button></details>
    </div>
  </Modal>;
}
