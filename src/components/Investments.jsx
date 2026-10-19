import React, { useState } from 'react';
import { ArrowRight, Shield, TrendingUp } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { formatMoney } from '../services/exchangeRate';
import { projectMonthlySavings, summarizeCashReserve } from '../services/investmentProjection';
import OfficialRateReference, { referenceDate } from './OfficialRateReference';

export default function Investments({ financialData, cashFlow, exchangeRate = 19.25, onNavigateTab }) {
  const monthlyExpenses = cashFlow?.totalCostodeVida;
  const reserve = summarizeCashReserve({ financialData, monthlyExpenses, exchangeRate });
  const [monthlyContribution, setMonthlyContribution] = useState('5000');
  const [annualRate, setAnnualRate] = useState('9.5');
  const [years, setYears] = useState('10');
  const [rateOrigin, setRateOrigin] = useState(null);
  const [appliedMessage, setAppliedMessage] = useState('');
  const reducedMotion = useReducedMotion();
  const projection = projectMonthlySavings({ monthlyContribution, annualRate, years });
  const money = value => formatMoney(value, 'MXN');
  const rateDescription = rateOrigin === 'own' ? 'Supuesto propio.' : rateOrigin ? 'CETES a 28 días · colocación ' + referenceDate(rateOrigin.effectiveDate) + '. Tasa fija durante toda la simulación.' : 'Valor de ejemplo; puedes cambiarlo.';
  const applyReference = reference => {
    setAnnualRate(String(reference.value));
    setRateOrigin(reference);
    setAppliedMessage('Se aplicó ' + reference.value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' % anual como tasa fija supuesta. La proyección se actualizó.');
  };
  return (
    <div className="investments-view">
      <header className="investments-header"><span className="investments-eyebrow">PLANEA TU AHORRO</span><h1>Ahorro e inversión</h1><p>Revisa el efectivo que tienes y explora lo que podrías aportar con el tiempo.</p></header>
      {onNavigateTab && <div><button type="button" className="button-secondary" onClick={() => onNavigateTab('credit-library', { view: 'savings' })}>Explorar cuentas y opciones de ahorro<ArrowRight size={17} aria-hidden="true" /></button></div>}
      <section className="investments-panel" aria-labelledby="reserve-heading">
        <div className="investments-section-heading"><Shield size={19} aria-hidden="true" /><h2 id="reserve-heading">Tu efectivo frente a tus gastos</h2></div>
        <p className="investments-description">Compara sólo tus activos registrados como efectivo con tus gastos necesarios mensuales. Las inversiones quedan fuera de esta referencia.</p>
        <div className="investments-reserve-summary">
          <div><span>Efectivo registrado{reserve.excluded > 0 ? ' con importe válido' : ''}</span><strong>{money(reserve.amount)}</strong><small>{reserve.count === 0 ? 'No hay activos registrados como efectivo.' : reserve.allDated ? 'Fechas de saldo: ' + reserve.dates.map(referenceDate).join(' · ') + '.' : 'No hay fecha de corte registrada para todos los saldos.'}</small></div>
          <div><span>Gastos necesarios registrados</span><strong>{reserve.expensesKnown ? <>{money(Number(monthlyExpenses))}<small> / mes</small></> : 'Por configurar'}</strong><small>{reserve.expensesKnown ? 'No incluye otros gastos ni pagos de deuda.' : 'Registra gastos mensuales completos y mayores a cero para calcular la cobertura.'}</small></div>
          <div><span>Cobertura de estos gastos</span><strong>{reserve.coverage === null ? 'Sin referencia' : reserve.coverage.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' meses'}</strong><small>{reserve.coverage === null ? 'La cobertura requiere saldos y gastos válidos.' : 'Calculada con el efectivo y los gastos registrados.'}</small></div>
        </div>
        {reserve.excluded > 0 && <p className="investments-notice">{reserve.excluded} {reserve.excluded === 1 ? 'saldo de efectivo no se pudo incluir' : 'saldos de efectivo no se pudieron incluir'} por un importe, moneda o tipo de cambio no válido. Completa esos datos para calcular la cobertura.</p>}
        {reserve.hasUsd && <p className="investments-scope">El efectivo en USD se convierte con el tipo de cambio de tu espacio: {Number(exchangeRate).toLocaleString('es-MX', { maximumFractionDigits: 4 })} MXN por USD.</p>}
        <div className="investments-reserve-goals">
          {[3, 6, 12].map(months => <div key={months}><span>Referencia de {months} meses</span><strong>{reserve.expensesKnown && Number.isFinite(Number(monthlyExpenses) * months) ? money(Number(monthlyExpenses) * months) : 'Por configurar'}</strong></div>)}
        </div>
        {reserve.progress !== null && <div className="investments-progress"><div><span>Frente a la referencia de 3 meses</span><span>{Math.floor(reserve.progress)} %</span></div><div role="progressbar" aria-label="Efectivo frente a 3 meses de gastos registrados" aria-valuenow={Math.floor(reserve.progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: reserve.progress + '%' }} /></div></div>}
        <p className="investments-scope">Es una comparación de saldos registrados: no confirma su disponibilidad ni descuenta apartados. Las fechas de los saldos pueden ser distintas.</p>
      </section>
      <section className="investments-panel investments-simulation" aria-labelledby="savings-projection-heading">
        <div className="investments-section-heading"><TrendingUp size={19} aria-hidden="true" /><h2 id="savings-projection-heading">Explora cómo puede crecer tu ahorro</h2></div>
        <p className="investments-description">Ajusta aportación, plazo y tasa. Esta es una simulación.</p>
        <OfficialRateReference onApply={applyReference} />
        <div className="investments-inputs">
          <div className="investments-field"><label htmlFor="savings-monthly">Aportación mensual (MXN)</label><input id="savings-monthly" type="number" inputMode="decimal" min="0" step="500" value={monthlyContribution} onChange={event => setMonthlyContribution(event.target.value)} aria-invalid={Boolean(projection.errors.monthlyContribution)} aria-describedby="savings-monthly-help" /><p id="savings-monthly-help" className={projection.errors.monthlyContribution ? 'investments-field-error' : ''}>{projection.errors.monthlyContribution || 'Aportaciones al cierre de cada mes.'}</p></div>
          <div className="investments-field"><label htmlFor="savings-rate">Tasa anual supuesta (%)</label><input id="savings-rate" type="number" inputMode="decimal" min="-100" max="1000" step="0.01" value={annualRate} onChange={event => { setAnnualRate(event.target.value); setRateOrigin('own'); setAppliedMessage(''); }} aria-invalid={Boolean(projection.errors.annualRate)} aria-describedby="savings-rate-help" /><p id="savings-rate-help" className={projection.errors.annualRate ? 'investments-field-error' : ''}>{projection.errors.annualRate || rateDescription}</p></div>
          <div className="investments-field"><label htmlFor="savings-years">Plazo (años)</label><input id="savings-years" type="number" inputMode="numeric" min="1" max="40" step="1" value={years} onChange={event => setYears(event.target.value)} aria-invalid={Boolean(projection.errors.years)} aria-describedby="savings-years-help" /><p id="savings-years-help" className={projection.errors.years ? 'investments-field-error' : ''}>{projection.errors.years || 'Entre 1 y 40 años completos.'}</p></div>
        </div>
        <div className="investments-apply-status" role="status" aria-live="polite" aria-atomic="true">{appliedMessage && <motion.span key={appliedMessage} initial={reducedMotion ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>{appliedMessage}</motion.span>}</div>
        <div className="investments-results">
          <div><span>Total aportado</span><strong>{projection.valid ? money(projection.contributed) : '—'}</strong></div>
          <div className={projection.valid && projection.returns < 0 ? 'investments-result-loss' : ''}><span>Rendimiento estimado</span><strong>{projection.valid ? money(projection.returns) : '—'}</strong></div>
          <div className="investments-result-total"><span>Total proyectado</span><strong>{projection.valid ? money(projection.total) : '—'}</strong></div>
        </div>
        {!projection.valid && <p className="investments-notice">Revisa los campos indicados para calcular la proyección.</p>}
        <p className="investments-assumptions">Proyección con aportaciones mensuales y tasa fija con capitalización mensual. No incluye impuestos, inflación ni cambios futuros de tasa. La referencia de CETES no garantiza este resultado.</p>
      </section>
    </div>
  );
}
