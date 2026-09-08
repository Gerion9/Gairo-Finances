import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { calculateFiscalOverview } from '../services/financeEngine.js';
import { formatMoney } from '../services/exchangeRate.js';
import BudgetEditor from './BudgetEditor.jsx';

export default function IncomeStatement({ financialData, onUpdateHonorarios, onUpdateGastos }) {
  const [form, setForm] = useState(financialData.honorarios);
  const [submitted, setSubmitted] = useState(false);
  const fiscal = calculateFiscalOverview(form);
  const necessary = financialData.gastosNecesarios.reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const optional = financialData.gastosOpcionales.reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const income = fiscal.netoEnCuenta + fiscal.otrosIngresos;
  const margin = income - fiscal.totalImpuestosSat - necessary - optional;
  const edit = (key, value) => { setForm(previous => ({ ...previous, [key]: Number(value) || 0 })); setSubmitted(false); };
  const save = event => { event.preventDefault(); onUpdateHonorarios(form); setSubmitted(true); };
  const rates = [['tasaIva', 'IVA facturado'], ['retencionIsrTasa', 'Retención de ISR'], ['retencionIvaFraccion', 'Fracción del IVA retenida'], ['tasaIsrDeclaracion', 'ISR estimado']];
  const rows = [['Ingreso neto estimado', income], ['Provisión fiscal', -fiscal.totalImpuestosSat], ['Gastos necesarios', -necessary], ['Gastos opcionales', -optional], ['Margen antes de pagos de deudas', margin]];
  return <div className="space-y-7">
    <header><p className="eyebrow">Tu presupuesto</p><h1 className="text-3xl font-semibold tracking-tight text-white mt-2">Dale un lugar a cada peso.</h1><p className="text-slate-400 text-sm mt-3">Configura tus ingresos y gastos para estimar tu margen mensual.</p></header>
    <section className="surface-card p-6 sm:p-7"><h2 className="text-xl font-semibold text-white mb-5">Tus ingresos</h2>
      <form onSubmit={save} className="space-y-5"><div className="grid sm:grid-cols-2 gap-5"><label className="text-sm text-slate-300">Ingreso facturado antes de impuestos (MXN)<input type="number" required min="0" max="1000000000000" step="0.01" value={form.importeFacturado} onChange={event => edit('importeFacturado', event.target.value)} className="field-input mt-2" /></label><label className="text-sm text-slate-300">Otros ingresos mensuales (MXN)<input type="number" required min="0" max="1000000000000" step="0.01" value={form.otrosIngresos} onChange={event => edit('otrosIngresos', event.target.value)} className="field-input mt-2" /><span className="block text-xs text-slate-500 mt-2">Por ejemplo, sueldo neto u otros ingresos recibidos.</span></label></div>
        <details className="rounded-xl bg-slate-950/40 border border-slate-800 p-4"><summary className="text-sm text-slate-300 cursor-pointer">Configurar tasas de impuestos y retenciones</summary><p className="text-sm text-slate-400 my-4">Usa las tasas que correspondan a tu caso. Cero conserva el importe sin aplicar esa tasa.</p><div className="grid sm:grid-cols-2 gap-4">{rates.map(([key, label]) => <label key={key} className="text-sm text-slate-300">{label} (%)<input type="number" min="0" max="100" step="0.001" value={Math.round(Number(form[key] || 0) * 100000) / 1000} onChange={event => edit(key, Number(event.target.value) / 100)} className="field-input mt-2" /></label>)}</div></details>
        <div className="flex flex-wrap items-center gap-4"><button className="button-primary"><Save size={16} />Actualizar ingresos</button>{submitted && <span role="status" className="text-sm text-emerald-300 flex items-center gap-2"><Check size={15} />Cambios enviados a sincronizar</span>}</div>
      </form>
    </section>
    <BudgetEditor necessary={financialData.gastosNecesarios} optional={financialData.gastosOpcionales} onChange={onUpdateGastos} />
    <section className="surface-card p-6 sm:p-7"><div className="flex flex-wrap justify-between gap-5 mb-6"><div><p className="eyebrow">Con tu configuración</p><h2 className="text-xl font-semibold text-white mt-2">Tu margen mensual estimado</h2></div><p className={'text-3xl font-semibold tabular-nums ' + (margin < 0 ? 'text-rose-300' : 'text-emerald-300')}>{formatMoney(margin)} <span className="text-sm">MXN</span></p></div><div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Presupuesto mensual y proyección con doce meses iguales</caption><thead><tr className="border-b border-slate-700 text-slate-400"><th className="text-left py-3">Concepto</th><th className="text-right px-4 py-3">Mensual</th><th className="text-right py-3">12 meses</th></tr></thead><tbody>{rows.map(([label, amount], i) => <tr key={label} className={'border-b border-slate-800 ' + (i === 4 ? 'font-semibold text-white' : 'text-slate-300')}><th className="font-inherit text-left py-4">{label}</th><td className="text-right px-4 py-4 whitespace-nowrap tabular-nums">{formatMoney(amount)}</td><td className="text-right py-4 whitespace-nowrap tabular-nums">{formatMoney(amount * 12)}</td></tr>)}</tbody></table></div><p className="text-sm text-slate-500 mt-5">Estimación con ingresos, tasas y gastos constantes. El pago de deudas se incorpora en tu resumen general.</p></section>
  </div>;
}
