import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from './ui/Modal';

const empty = { nombre: '', institucion: '', moneda: 'MXN', saldo: '', tasaAnual: '', pagoMinimo: '', diaCorte: '', diaPagoLimite: '', tipo: 'HIGH_INTEREST', promoDeadline: '', tasaRegularPostPromo: '', anualidad: '', notas: '', clase: 'TARJETA', numeroCuentas: 1 };
export default function DebtModal({ isOpen, onClose, onSave, debtToEdit }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  useEffect(() => { setForm(debtToEdit ? { ...empty, ...debtToEdit, saldo: debtToEdit.saldo ?? debtToEdit.saldoEstimado ?? '' } : { ...empty }); setError(''); }, [debtToEdit, isOpen]);
  const update = field => event => setForm(previous => ({ ...previous, [field]: event.target.value }));
  const submit = event => {
    event.preventDefault(); setError('');
    if (!form.nombre.trim()) { setError('Escribe un nombre para identificar esta deuda.'); return; }
    const numeric = ['saldo', 'tasaAnual', 'pagoMinimo', 'tasaRegularPostPromo', 'anualidad'];
    if (numeric.some(key => !Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) { setError('Los importes y tasas deben ser números iguales o mayores que cero.'); return; }
    if (Number(form.pagoMinimo) > Number(form.saldo) && Number(form.saldo) > 0) { setError('El pago mínimo no puede superar el saldo registrado.'); return; }
    if (![form.diaCorte, form.diaPagoLimite].every(day => day === '' || day == null || (Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= 31))) { setError('Los días de corte y pago deben estar entre 1 y 31.'); return; }
    const missing = ['saldo', 'tasaAnual', 'pagoMinimo', 'diaCorte', 'diaPagoLimite'].some(key => form[key] === '' || form[key] == null);
    const pending = missing || Number(form.numeroCuentas) > 1 || (form.tipo === 'PROMO_DEADLINE' && !form.promoDeadline);
    if (pending) {
      onSave({ ...form, id: debtToEdit?.id || `d_${crypto.randomUUID()}`, nombre: form.nombre.trim(), institucion: form.institucion.trim(), notas: form.notas.trim(), numeroCuentas: Number(form.numeroCuentas), saldoEstimado: form.saldo === '' || form.saldo == null ? null : Number(form.saldo), ...Object.fromEntries(['tasaAnual', 'pagoMinimo', 'diaCorte', 'diaPagoLimite'].map(key => [key, form[key] === '' || form[key] == null ? null : Number(form[key])])) }, { pending: true });
      onClose(); return;
    }
    onSave({ ...form, ...Object.fromEntries(numeric.map(key => [key, key === 'tasaRegularPostPromo' && (form[key] === '' || form[key] == null) ? null : Number(form[key])])), id: debtToEdit?.id || `d_${crypto.randomUUID()}`, nombre: form.nombre.trim(), institucion: form.institucion.trim(), notas: form.notas.trim(), diaCorte: Number(form.diaCorte), diaPagoLimite: Number(form.diaPagoLimite) });
    onClose();
  };
  const field = (key, label, type = 'text', props = {}) => <label className="block text-sm text-slate-300">{label}<input type={type} value={form[key] ?? ''} onChange={update(key)} className="field-input mt-2" {...props} /></label>;
  return <Modal isOpen={isOpen} onClose={onClose} title={debtToEdit ? 'Editar deuda' : 'Registra una deuda'} description="Guarda lo que sabes. Deja vacíos los importes, tasas y fechas por confirmar; cero significa cero real.">
    <form onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="text-sm text-rose-300 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3">{error}</p>}
      {field('nombre', 'Nombre de la deuda', 'text', { required: true, maxLength: 100, placeholder: 'Tarjeta, préstamo o compra a meses' })}
      <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-slate-300">Clase<select value={form.clase} onChange={update('clase')} className="field-input mt-2"><option value="TARJETA">Tarjeta de crédito</option><option value="PRESTAMOS_ESTUDIANTILES">Préstamo estudiantil</option><option value="OTRO">Otra deuda</option></select></label>{field('numeroCuentas', 'Créditos en este registro', 'number', { required: true, min: 1, max: 100, step: 1, readOnly: debtToEdit?.numeroCuentas > 1 })}</div>
      {Number(form.numeroCuentas) > 1 && <p className="text-sm text-amber-200">Saldo conjunto de {form.numeroCuentas} créditos. Se conserva como grupo pendiente hasta contar con el desglose; no se reparte en partes iguales.</p>}
      <div className="grid sm:grid-cols-2 gap-4">{field('institucion', 'Institución', 'text', { maxLength: 100 })}<label className="text-sm text-slate-300">Moneda<select value={form.moneda} onChange={update('moneda')} className="field-input mt-2"><option value="MXN">Pesos mexicanos · MXN</option><option value="USD">Dólares · USD</option></select></label></div>
      <div className="grid sm:grid-cols-2 gap-4">{field('saldo', `Saldo (${form.moneda}) · puede ser aproximado`, 'number', { min: 0, step: '0.01', placeholder: 'Por confirmar' })}{field('pagoMinimo', `Pago mínimo (${form.moneda})`, 'number', { min: 0, step: '0.01', placeholder: 'Por confirmar' })}</div>
      <div className="grid sm:grid-cols-2 gap-4">{field('tasaAnual', 'Tu tasa contractual anual (%)', 'number', { min: 0, step: '0.01', placeholder: 'Revisa tu estado de cuenta' })}<label className="text-sm text-slate-300">Tipo de deuda<select value={form.tipo} onChange={update('tipo')} className="field-input mt-2"><option value="HIGH_INTEREST">Crédito con interés</option><option value="PROMO_DEADLINE">Promoción con vencimiento</option><option value="LOW_INTEREST_HOLD">Crédito de tasa baja</option></select></label></div>
      <div className="grid sm:grid-cols-2 gap-4">{field('diaCorte', 'Día de corte', 'number', { min: 1, max: 31, placeholder: 'Por confirmar' })}{field('diaPagoLimite', 'Día límite de pago', 'number', { min: 1, max: 31, placeholder: 'Por confirmar' })}</div>
      {form.referenciaTasa && <p className="text-sm text-slate-400">Referencia pública: {form.referenciaTasa}. No sustituye tu tasa contractual.</p>}
      {form.tipo === 'PROMO_DEADLINE' && <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">{field('promoDeadline', 'Fin de la promoción', 'date')}{field('tasaRegularPostPromo', 'Tasa posterior (%)', 'number', { min: 0, step: '0.01' })}</div>}
      <details><summary className="cursor-pointer py-2 text-sm text-slate-400">Anualidad y notas</summary><div className="space-y-4 mt-3">{field('anualidad', `Anualidad (${form.moneda})`, 'number', { min: 0, step: '0.01' })}<label className="block text-sm text-slate-300">Notas<textarea rows={3} maxLength={1000} value={form.notas} onChange={update('notas')} className="field-input mt-2 resize-y" /></label></div></details>
      <div className="flex justify-end gap-2 border-t border-[#223248] pt-5"><button type="button" className="button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Save size={16} />Guardar deuda</button></div>
    </form>
  </Modal>;
}
