import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Modal from './ui/Modal';
import { formatMoney } from '../services/exchangeRate.js';

const fresh = () => ({ id: crypto.randomUUID(), nombre: '', monto: '', categoria: '', diaPago: 1, group: 'necessary' });
export default function BudgetEditor({ necessary = [], optional = [], onChange }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const save = event => {
    event.preventDefault(); setError('');
    const amount = Number(editing.monto);
    if (!editing.nombre.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1e12) { setError('Revisa el nombre y el importe.'); return; }
    const { group, ...fields } = editing;
    const row = { ...fields, nombre: fields.nombre.trim(), categoria: fields.categoria.trim() || fields.nombre.trim(), monto: Math.round(amount * 100) / 100, diaPago: Number(fields.diaPago), icono: 'Wallet' };
    const left = necessary.filter(item => item.id !== row.id); const right = optional.filter(item => item.id !== row.id);
    onChange(group === 'necessary' ? [...left, row] : left, group === 'optional' ? [...right, row] : right);
    setEditing(null);
  };
  const remove = (row, group) => {
    if (!window.confirm(`¿Quitar ${row.nombre} de tu presupuesto?`)) return;
    onChange(group === 'necessary' ? necessary.filter(item => item.id !== row.id) : necessary, group === 'optional' ? optional.filter(item => item.id !== row.id) : optional);
  };
  return <section className="surface-card p-6 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4 mb-6"><div><h2 className="text-xl font-semibold text-white">Tus gastos mensuales</h2><p className="text-sm text-slate-400 mt-2">Define cuánto planeas destinar a cada categoría.</p></div><button className="button-primary" onClick={() => { setError(''); setEditing(fresh()); }}><Plus size={17} />Agregar gasto</button></div>
    <div className="grid md:grid-cols-2 gap-6">{[['necessary', 'Necesarios', necessary], ['optional', 'Opcionales', optional]].map(([group, name, rows]) => <div key={group}><h3 className="text-sm font-semibold text-slate-200 mb-3">{name}</h3>{rows.length ? <ul className="divide-y divide-slate-800">{rows.map(row => <li key={row.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="text-sm text-slate-200 break-words">{row.nombre}</p><p className="text-xs text-slate-500">{row.categoria} · Día {row.diaPago || 1}</p></div><span className="text-sm tabular-nums text-slate-300">{formatMoney(row.monto)}</span><button className="icon-button" aria-label={`Editar ${row.nombre}`} onClick={() => { setError(''); setEditing({ ...row, group, categoria: row.categoria || '' }); }}><Pencil size={15} /></button><button className="icon-button" aria-label={`Quitar ${row.nombre}`} onClick={() => remove(row, group)}><Trash2 size={15} /></button></li>)}</ul> : <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-700 p-5">Aún no agregas gastos {name.toLowerCase()}.</p>}</div>)}</div>
    {editing && <Modal isOpen onClose={() => setEditing(null)} title="Gasto del presupuesto" description="Importe mensual en MXN."><form onSubmit={save} className="space-y-4">{error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}<label className="block text-sm text-slate-300">Nombre<input required maxLength={120} value={editing.nombre} onChange={event => setEditing({ ...editing, nombre: event.target.value })} className="field-input mt-2" /></label><div className="grid grid-cols-2 gap-4"><label className="block text-sm text-slate-300">Monto mensual<input required type="number" min="0" max="1000000000000" step="0.01" value={editing.monto} onChange={event => setEditing({ ...editing, monto: event.target.value })} className="field-input mt-2" /></label><label className="block text-sm text-slate-300">Tipo<select value={editing.group} onChange={event => setEditing({ ...editing, group: event.target.value })} className="field-input mt-2"><option value="necessary">Necesario</option><option value="optional">Opcional</option></select></label></div><label className="block text-sm text-slate-300">Categoría<input maxLength={120} value={editing.categoria} onChange={event => setEditing({ ...editing, categoria: event.target.value })} placeholder="Ej. Vivienda" className="field-input mt-2" /></label><label className="block text-sm text-slate-300">Día de pago<input type="number" min="1" max="31" required value={editing.diaPago} onChange={event => setEditing({ ...editing, diaPago: event.target.value })} className="field-input mt-2" /></label><button className="button-primary w-full">Guardar gasto</button></form></Modal>}
  </section>;
}
