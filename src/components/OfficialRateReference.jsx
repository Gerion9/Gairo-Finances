import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { fetchPublicRates } from '../services/publicRates';
import './OfficialRateReference.css';

const sourceUrl = 'https://www.banxico.org.mx/SieInternet/consultarDirectorioInternetAction.do?accion=consultarCuadroAnalitico&idCuadro=CF107';
export function referenceDate(value) {
  if (!value || !Number.isFinite(Date.parse(`${value}T12:00:00Z`))) return 'Sin fecha disponible';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
function consultedAt(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin consulta válida';
  return `${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(value))} · Ciudad de México`;
}
const percent = value => new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function OfficialRateReference({ onApply }) {
  const [reference, setReference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef(null);
  const reducedMotion = useReducedMotion();
  const refresh = useCallback(async (forceRefresh = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const payload = await fetchPublicRates({ signal: controller.signal, forceRefresh });
      if (controller.signal.aborted) return;
      const next = payload.series.find(item => item.id === 'cetes28');
      if (Number.isFinite(next.value)) { setReference(next); setFailed(Boolean(next.error)); }
      else setFailed(true);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); return () => request.current?.abort(); }, [refresh]);
  const hasValue = reference && Number.isFinite(reference.value);
  const stale = hasValue && (failed || reference.status === 'stale');
  // A failed refresh must not turn a future placement into a current reference.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const upcoming = hasValue && (reference.status === 'upcoming' || reference.effectiveDate > today);
  const usable = hasValue && !upcoming && ['available', 'stale'].includes(reference.status);
  return (
    <aside className={`official-rate ${stale || failed ? 'official-rate--notice' : ''}`} aria-label="Referencia oficial para tu supuesto">
      <div className="official-rate__content">
        <span className="official-rate__eyebrow">Referencia oficial para tu supuesto</span>
        {hasValue ? <>
          <div className="official-rate__value"><span>CETES a 28 días</span><strong>{percent(reference.value)} % <small>anual</small></strong></div>
          <p className="official-rate__dates">Colocación: {referenceDate(reference.effectiveDate)} <span aria-hidden="true">·</span> Consultado: {consultedAt(reference.fetchedAt)}</p>
        </> : <p className="official-rate__empty">{loading ? 'Consultando CETES a 28 días…' : 'Referencia no disponible. Puedes introducir tu propio supuesto.'}</p>}
        <a className="official-rate__source" href={sourceUrl} target="_blank" rel="noopener noreferrer">Fuente: Banco de México <ExternalLink size={13} aria-hidden="true" /></a>
        <div className="official-rate__status" role="status" aria-live="polite" aria-atomic="true">
          {upcoming ? 'Próxima colocación: esta referencia todavía no está vigente.' : stale ? failed ? 'No se pudo actualizar. Se conserva la última referencia consultada; revisa sus fechas antes de usarla.' : 'La referencia tiene más de 14 días. Revisa su fecha antes de usarla como supuesto.' : failed && !hasValue ? 'La consulta oficial no está disponible por el momento.' : ''}
        </div>
      </div>
      <div className="official-rate__actions">
        {usable && <motion.button type="button" className="official-rate__apply" onClick={() => onApply(reference)} whileTap={reducedMotion ? undefined : { scale: 0.98 }}><ArrowDownToLine size={16} aria-hidden="true" />{stale ? `Usar última referencia (${percent(reference.value)} %)` : `Usar ${percent(reference.value)} % como supuesto`}</motion.button>}
        <button type="button" className="official-rate__refresh" onClick={() => refresh(true)} disabled={loading}><RefreshCw size={15} aria-hidden="true" />{loading ? 'Consultando referencia…' : 'Actualizar referencia'}</button>
        <span className="official-rate__hint">Actualizar no cambia tu supuesto.</span>
      </div>
    </aside>
  );
}
