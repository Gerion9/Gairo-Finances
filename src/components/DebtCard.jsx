import React, { useId, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, Clock3, CreditCard, Edit3, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { convertCurrency, formatMoney } from '../services/exchangeRate';
import { moneyToCents, validateDebtPayment } from '../services/transactionAnalytics';

export default function DebtCard({ debt, exchangeRate, displayCurrency, onEdit, onDelete, onPayment }) {
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const inputId = useId();
  const originalBalance = Number(debt.saldo) || 0;
  const currency = ['MXN', 'USD'].includes(displayCurrency) ? displayCurrency : debt.moneda;
  const amount = convertCurrency(originalBalance, debt.moneda, currency, exchangeRate);
  const paid = originalBalance <= 0;
  const promo = debt.tipo === 'PROMO_DEADLINE';
  const highInterest = debt.tipo === 'HIGH_INTEREST';
  const tag = paid ? 'Liquidada' : promo ? 'Promoción con vencimiento' : highInterest ? 'Interés alto' : 'Interés bajo';
  const TagIcon = paid ? CheckCircle2 : promo ? Clock3 : highInterest ? CreditCard : ShieldCheck;
  const tone = paid ? 'border-[#7DE4BF]/20 bg-[#7DE4BF]/10 text-[#7DE4BF]' : promo ? 'border-[#F4C88C]/20 bg-[#F4C88C]/10 text-[#F4C88C]' : highInterest ? 'border-[#F7A9B8]/20 bg-[#F7A9B8]/10 text-[#F7A9B8]' : 'border-[#A4B1C3]/20 bg-[#A4B1C3]/10 text-[#C5D0DD]';

  const handleMakePayment = event => {
    event.preventDefault();
    const error = validateDebtPayment(paymentAmount, debt.saldo);
    if (error) { setPaymentError(error); return; }
    onPayment(debt.id, moneyToCents(paymentAmount) / 100);
    setPaymentAmount('');
    setPaymentError('');
    setShowPaymentInput(false);
  };

  return (
    <article className="surface-card group flex min-w-0 flex-col justify-between p-5 transition-colors hover:border-[#344960]">
      <div>
        <div className="mb-5 flex items-start justify-between gap-2">
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${tone}`}><TagIcon size={14} aria-hidden="true" />{tag}</span>
          <div className="-mr-1 -mt-1 flex items-center gap-0.5">
            <button type="button" onClick={() => onEdit(debt)} aria-label={`Editar ${debt.nombre}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8191A7] transition-colors hover:bg-white/5 hover:text-white"><Edit3 size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => onDelete(debt.id)} aria-label={`Eliminar ${debt.nombre}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8191A7] transition-colors hover:bg-rose-300/10 hover:text-rose-300"><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </div>
        <p className="text-xs font-medium text-[#A4B1C3]">{debt.institucion || 'Cuenta de deuda'}</p>
        <h3 className="mt-1 break-words text-[17px] font-semibold tracking-tight text-white">{debt.nombre}</h3>
        <div className="my-5">
          <p className="text-[13px] text-[#A4B1C3]">Saldo pendiente</p>
          <p data-sensitive className="sensitive-value mt-1 break-words text-[30px] font-semibold leading-tight tracking-tight text-[#EDF2F8] tabular-nums">{formatMoney(amount, currency)} <span className="text-xs font-medium tracking-normal text-[#A4B1C3]">{currency}</span></p>
          {currency !== debt.moneda && <p data-sensitive className="sensitive-value mt-1.5 text-xs text-[#A4B1C3] tabular-nums">Original: {formatMoney(originalBalance, debt.moneda)} {debt.moneda}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 border-y border-[#223248] py-4">
          <div><dt className="text-xs text-[#A4B1C3]">Tasa anual</dt><dd className={`mt-1.5 text-[15px] font-semibold tabular-nums ${Number(debt.tasaAnual) > 30 ? 'text-[#F7A9B8]' : 'text-[#DCE5EF]'}`}>{Number(debt.tasaAnual).toLocaleString('es-MX')}%</dd></div>
          <div><dt className="text-xs text-[#A4B1C3]">Pago mínimo · {debt.moneda}</dt><dd data-sensitive className="sensitive-value mt-1.5 text-[15px] font-semibold text-[#DCE5EF] tabular-nums">{formatMoney(debt.pagoMinimo, debt.moneda)}</dd></div>
        </dl>
        {promo && debt.promoDeadline ? <div className="mt-4 flex items-start gap-2 text-[13px] text-[#F4C88C]"><CalendarDays size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><p>La promoción vence el <time dateTime={debt.promoDeadline} className="font-medium">{debt.promoDeadline}</time></p></div> : debt.diaPagoLimite ? <p className="mt-4 flex items-center gap-2 text-[13px] text-[#A4B1C3]"><CalendarDays size={16} aria-hidden="true" />Pago límite: día {debt.diaPagoLimite} de cada mes</p> : null}
        {debt.notas && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-[#A4B1C3]">{debt.notas}</p>}
      </div>
      <div className="mt-5">
        {!showPaymentInput ? <button type="button" disabled={paid} onClick={() => { setPaymentError(''); setShowPaymentInput(true); }} className="button-secondary inline-flex w-full items-center justify-center gap-2 disabled:cursor-default disabled:opacity-60">{paid ? <CheckCircle2 size={16} className="text-[#7DE4BF]" aria-hidden="true" /> : <Plus size={16} className="text-[#7DE4BF]" aria-hidden="true" />}{paid ? 'Saldo liquidado' : 'Registrar abono'}</button> : (
          <form onSubmit={handleMakePayment} className="space-y-2.5 rounded-xl border border-[#7DE4BF]/25 bg-[#7DE4BF]/[0.03] p-3">
            <label htmlFor={inputId} className="block text-[13px] font-medium text-[#DCE5EF]">Abono en {debt.moneda}</label>
            <div className="flex items-start gap-2"><input id={inputId} type="number" inputMode="decimal" step="0.01" min="0.01" max={originalBalance} required autoFocus placeholder="0.00" value={paymentAmount} onChange={event => { setPaymentAmount(event.target.value); setPaymentError(''); }} className="field-input min-w-0 flex-1 tabular-nums" aria-invalid={!!paymentError} aria-describedby={`${inputId}-help${paymentError ? ` ${inputId}-error` : ''}`} /><button type="submit" className="button-primary !px-3" aria-label={`Confirmar abono a ${debt.nombre}`}><Check size={18} aria-hidden="true" /></button></div>
            <p id={`${inputId}-help`} data-sensitive className="sensitive-value text-xs leading-relaxed text-[#A4B1C3]">Hasta {formatMoney(originalBalance, debt.moneda)} {debt.moneda}. El abono reduce el saldo de esta deuda.</p>
            {paymentError && <p id={`${inputId}-error`} role="alert" className="text-xs leading-relaxed text-rose-300">{paymentError}</p>}
            <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => { setPaymentAmount(String(Math.min(Number(debt.pagoMinimo) || 0, originalBalance))); setPaymentError(''); }} disabled={Number(debt.pagoMinimo) <= 0} className="min-h-10 text-xs font-medium text-[#7DE4BF] disabled:hidden">Usar pago mínimo</button><button type="button" onClick={() => { setShowPaymentInput(false); setPaymentError(''); }} className="ml-auto min-h-10 text-xs text-[#A4B1C3] hover:text-white">Cancelar</button></div>
          </form>
        )}
      </div>
    </article>
  );
}
