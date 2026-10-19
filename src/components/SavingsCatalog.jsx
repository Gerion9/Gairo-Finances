import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, ChevronDown, Search, ShieldQuestion, X } from 'lucide-react';
import Modal from './ui/Modal';
import { catalogPage, formatCatalogDate, localCatalogDate } from '../services/creditCatalog';
import {
  SAVINGS_COMPARISON_LIMIT, SAVINGS_LIQUIDITY_FILTERS, SAVINGS_RETURN_NATURE,
  buildSavingsComparison, filterSavingsProducts, formatSavingsReturn, orderedSavingsReturns, previewSavingsReturns,
  savingsReturnSources, savingsReturnStatus, savingsSources, selectedSavingsProducts, toggleSavingsComparison,
} from '../services/savingsCatalog';
import './SavingsCatalog.css';

const EMPTY_CATALOG = { products: [], sources: [] };
const EMPTY_SELECTION = [];
const DIFFERENCE_NOTE = 'Una cuenta, un fondo y un producto a plazo pueden tener riesgos, disponibilidad y protección distintos. Revisa estas condiciones junto con el rendimiento.';

function useSavingsHeadingFocus(open, contentRef, section = 'heading') {
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      if (contentRef.current?.closest('[inert]')) return;
      const heading = section === 'returns'
        ? contentRef.current?.querySelector('[data-savings-returns-heading]')
        : contentRef.current?.closest('[role="dialog"]')?.querySelector('.modal-heading h2');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        if (section === 'returns') heading.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, contentRef, section]);
}

function useComparisonScrollPadding(open, contentRef, headingRef) {
  useEffect(() => {
    if (!open) return undefined;
    const body = contentRef.current?.closest('.modal-body');
    const heading = headingRef.current;
    if (!body || !heading) return undefined;
    const property = 'scroll-padding-top';
    const original = body.style.getPropertyValue(property);
    const priority = body.style.getPropertyPriority(property);
    const desktop = window.matchMedia('(min-width: 760px)');
    const restore = () => {
      if (original) body.style.setProperty(property, original, priority);
      else body.style.removeProperty(property);
    };
    const measure = () => {
      if (desktop.matches) body.style.setProperty(property, `${heading.offsetHeight + 12}px`);
      else restore();
    };
    // Layout height includes padding and borders, without the modal's entrance transform.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(heading);
    if (!observer) window.addEventListener('resize', measure);
    desktop.addEventListener('change', measure);
    measure();
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', measure);
      desktop.removeEventListener('change', measure);
      restore();
    };
  }, [open, contentRef, headingRef]);
}

function SourceLinks({ entry = {}, sources }) {
  const verified = sources ? savingsSources({ evidence: sources }) : savingsSources(entry);
  if (!verified.length) return <p className="savings-muted">Fuente por verificar</p>;
  return <ul className="savings-sources">{verified.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={14} aria-hidden="true" /><span className="savings-sr-only"> (abre en otra pestaña)</span></a></li>)}</ul>;
}

function FactList({ values, fallback = 'Por documentar en la fuente del producto.' }) {
  return values?.length ? <ul className="savings-facts">{values.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p className="savings-muted">{fallback}</p>;
}

function ReturnObservation({ observation, product, today, compact = false }) {
  const status = savingsReturnStatus(observation, today);
  return <div className={`savings-observation ${compact ? 'is-compact' : ''}`}>
    <div className="savings-observation-label"><span>{observation.label || 'Rendimiento publicado'}</span><span className="savings-nature">{SAVINGS_RETURN_NATURE[observation.nature] || 'Carácter por verificar'}</span></div>
    <p className="savings-return-value">{formatSavingsReturn(observation)}</p>
    <p className="savings-rate-type">{observation.rateType || 'Tipo de rendimiento por verificar'}</p>
    <p className="savings-return-conditions">{observation.conditions || 'Condiciones por verificar en la fuente.'}</p>
    {!compact && <p className="savings-date">Referencia: {formatCatalogDate(observation.asOf)}</p>}
    <p className={`savings-status is-${status.code}`}>{status.label}</p>
    <p className="savings-validity">{status.detail}</p>
    {observation.nature === 'historical' && <p className="savings-validity">El rendimiento histórico no confirma un rendimiento futuro.</p>}
    <SourceLinks sources={savingsReturnSources(observation, product)} />
  </div>;
}

function ProductDetail({ product, today, selected, onToggle, onClose, notice, focusSection, readOnly }) {
  const contentRef = useRef(null);
  useSavingsHeadingFocus(Boolean(product), contentRef, focusSection);
  return <Modal isOpen={Boolean(product)} onClose={onClose} title={product?.name} description={product?.issuer} wide className="savings-modal">
    {product && <div ref={contentRef} className="savings-detail">
      <div className="savings-detail-meta"><span className="savings-tag">{product.hasDetailedSheet ? 'Con ficha documentada' : 'Producto identificado'}</span><span>Consulta: {formatCatalogDate(product.consultedOn)}</span></div>
      {product.summary && <p className="savings-product-summary">{product.summary}</p>}
      <section><h3>Cómo funciona</h3><p className="savings-label">{product.productType || 'Tipo por documentar'}</p><p>{product.mechanism || 'Mecanismo por documentar en la fuente del producto.'}</p></section>
      <section><h3 data-savings-returns-heading tabIndex={-1}>Rendimiento</h3>{product.returns?.length ? <div className="savings-detail-returns">{orderedSavingsReturns(product.returns).map(observation => <ReturnObservation key={observation.id} observation={observation} product={product} today={today} />)}</div> : <p className="savings-muted">Rendimientos aún por documentar. La ausencia de una cifra no significa un rendimiento de cero.</p>}</section>
      <section><h3>Disponibilidad</h3><p>{product.liquidity?.summary || 'Liquidez y plazo por documentar.'}</p><p>{product.availability || 'Estado de contratación por confirmar en la fuente.'}</p></section>
      <section><h3>Costos y condiciones</h3><div className="savings-detail-grid"><div><h4>Montos</h4><FactList values={product.amounts} /></div><div><h4>Costos y membresía</h4><FactList values={product.fees} /></div><div><h4>Requisitos</h4><FactList values={product.requirements} /></div><div><h4>Notas y límites</h4><FactList values={product.limitations} /></div></div></section>
      <section><h3>Entidad y protección</h3><p className="savings-legal-entity">{product.legalIssuer || 'Entidad legal por documentar'}</p><h4>{product.protection?.label || 'Protección por documentar'}</h4><p>{product.protection?.summary || 'Consulta el alcance y las condiciones en la fuente del producto.'}</p><SourceLinks sources={product.protection?.sources || []} /></section>
      <section><h3>Fuentes</h3><p className="savings-date">Consulta de la ficha: {formatCatalogDate(product.consultedOn)}</p><SourceLinks entry={product} /></section>
      <div className="savings-detail-actions"><button type="button" className="savings-button is-primary" disabled={readOnly} onClick={() => onToggle(product.id)}>{selected ? 'Quitar de comparación' : 'Añadir a comparación'}</button><button type="button" className="savings-button" onClick={onClose}>Cerrar ficha</button></div>
      <p className="savings-notice" role="status">{notice}</p>
    </div>}
  </Modal>;
}

function SavingsComparison({ comparison, open, today, onClose }) {
  const contentRef = useRef(null);
  const headingRef = useRef(null);
  useSavingsHeadingFocus(open, contentRef);
  useComparisonScrollPadding(open, contentRef, headingRef);
  const products = new Map(comparison.entries.map(product => [product.id, product]));
  return <Modal isOpen={open} onClose={onClose} title="Compara condiciones de ahorro" description="Rendimiento, disponibilidad, costos y protección de cada producto." wide className="savings-modal savings-comparison-modal">
    <div ref={contentRef} className="savings-comparison" style={{ '--savings-count': comparison.entries.length || 1 }}>
      <p className="savings-comparison-note">{DIFFERENCE_NOTE}</p>
      <div ref={headingRef} className="savings-comparison-heading" aria-hidden="true"><span>Condición documentada</span><div>{comparison.entries.map(product => <div key={product.id}><span>{product.issuer}</span><strong>{product.name}</strong></div>)}</div></div>
      {comparison.rows.map(row => <section key={row.id} className="savings-comparison-row" aria-label={row.label}><h3>{row.label}</h3><div className="savings-comparison-values">{row.values.map(value => <div key={value.productId} className="savings-comparison-value"><h4>{value.productName}</h4>
        {value.observations?.length ? value.observations.map(observation => <ReturnObservation key={observation.id} observation={observation} product={products.get(value.productId)} today={today} />) : <ul>{value.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>}
        {row.id === 'protection' && <SourceLinks sources={products.get(value.productId)?.protection?.sources || []} />}
        {row.id === 'sources' && <SourceLinks sources={value.sources} />}
      </div>)}</div></section>)}
      <button type="button" className="savings-button" onClick={onClose}>Cerrar comparación</button>
    </div>
  </Modal>;
}

function ProductSourceDetails({ product, observations }) {
  return <details className="savings-row-sources">
    <summary>Fuentes y fechas<ChevronDown size={15} aria-hidden="true" /></summary>
    <div>
      <p className="savings-date">Consulta de la ficha: {formatCatalogDate(product.consultedOn)}</p>
      <p className="savings-validity">La fecha de consulta indica cuándo se revisó la información; no confirma la vigencia de una tasa.</p>
      {observations.map(observation => <div className="savings-source-reference" key={observation.id}>
        <p>{observation.label || 'Rendimiento publicado'}</p>
        <p className="savings-date">Referencia: {formatCatalogDate(observation.asOf)}</p>
        <p className="savings-date">Vigencia publicada hasta: {formatCatalogDate(observation.validThrough)}</p>
        <SourceLinks sources={savingsReturnSources(observation, product)} />
      </div>)}
      <p className="savings-label">Fuentes de la ficha</p><SourceLinks entry={product} />
    </div>
  </details>;
}

function useSelectionDock(visible, catalogRef, dockRef) {
  useEffect(() => {
    if (!visible) return undefined;
    const catalog = catalogRef.current;
    const dock = dockRef.current;
    if (!catalog || !dock) return undefined;
    const root = document.documentElement;
    const original = root.style.getPropertyValue('scroll-padding-bottom');
    const priority = root.style.getPropertyPriority('scroll-padding-bottom');
    const navs = [...document.querySelectorAll('.sf-nav-mobile, .mobile-bottom-nav')];
    const measure = () => {
      const rect = catalog.getBoundingClientRect();
      const navHeight = Math.max(0, ...navs.map(nav => nav.getBoundingClientRect().height));
      dock.style.left = `${Math.max(8, rect.left)}px`;
      dock.style.width = `${Math.max(0, Math.min(rect.width, window.innerWidth - Math.max(8, rect.left) - 8))}px`;
      dock.style.setProperty('--savings-dock-bottom', `${navHeight + 10}px`);
      const clearance = dock.getBoundingClientRect().height + navHeight + 34;
      catalog.style.setProperty('--savings-dock-clearance', `${clearance}px`);
      root.style.setProperty('scroll-padding-bottom', `${clearance}px`);
    };
    const keepFocusVisible = event => {
      if (!catalog.contains(event.target) || !event.target.getBoundingClientRect) return;
      const bottom = event.target.getBoundingClientRect().bottom;
      const top = dock.getBoundingClientRect().top;
      if (bottom > top - 12) window.scrollBy({ top: bottom - top + 20, behavior: 'instant' });
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    [catalog, dock, ...navs].forEach(element => observer?.observe(element));
    window.addEventListener('resize', measure);
    catalog.addEventListener('focusin', keepFocusVisible);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      catalog.removeEventListener('focusin', keepFocusVisible);
      catalog.style.removeProperty('--savings-dock-clearance');
      if (original) root.style.setProperty('scroll-padding-bottom', original, priority);
      else root.style.removeProperty('scroll-padding-bottom');
    };
  }, [visible, catalogRef, dockRef]);
}

function SelectionDock({ selected, active, visible, catalogRef, compareButtonRef, readOnly, onToggle, onCompare, notice }) {
  const dockRef = useRef(null);
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  // Keep the reserved space while a dialog is open so closing it preserves the list's scroll position.
  useSelectionDock(active && selected.length > 0, catalogRef, dockRef);
  const remove = id => {
    const index = selected.findIndex(product => product.id === id);
    onToggle(id);
    requestAnimationFrame(() => {
      const remaining = [...(dockRef.current?.querySelectorAll('.savings-selected-products button:not(:disabled)') || [])].filter(button => button.getClientRects().length);
      const target = remaining[Math.min(index, remaining.length - 1)] || catalogRef.current?.querySelector('.savings-header h2');
      if (target) {
        if (target.tagName === 'H2') target.tabIndex = -1;
        target.focus();
      }
    });
  };
  if (!selected.length || typeof document === 'undefined') return null;
  return createPortal(<section ref={dockRef} className={`savings-selection ${expanded ? 'is-expanded' : ''} ${visible ? '' : 'is-concealed'}`} aria-hidden={!visible || undefined} aria-label="Selección para comparar">
    <div className="savings-selection-summary"><strong>{selected.length} {selected.length === 1 ? 'producto' : 'productos'}<span className="savings-selection-desktop"> de {SAVINGS_COMPARISON_LIMIT}</span></strong><p>{selected.length < 2 ? 'Añade otro para comparar condiciones.' : 'Selección para comparar'}</p></div>
    <ul id={listId} className="savings-selected-products">{selected.map(product => <li key={product.id}><span>{product.name}</span><button type="button" disabled={readOnly} aria-label={`Quitar ${product.name} de comparación`} onClick={() => remove(product.id)}><X size={16} aria-hidden="true" /></button></li>)}</ul>
    <button ref={compareButtonRef} type="button" className="savings-button is-primary savings-compare-button" disabled={selected.length < 2} onClick={onCompare}>Comparar<span className="savings-selection-desktop"> condiciones</span><ArrowRight size={16} aria-hidden="true" /></button>
    <button type="button" className="savings-selection-review" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Ocultar selección' : 'Revisar selección'}<ChevronDown size={15} aria-hidden="true" /></button>
    {notice && <p className="savings-selection-notice" role="status">{notice}</p>}
  </section>, document.body);
}

export default function SavingsCatalog({ catalog = EMPTY_CATALOG, active = true, onDeactivateOverlay, selectedIds = EMPTY_SELECTION, onSelectedIdsChange, readOnly = false }) {
  const products = catalog?.products || EMPTY_CATALOG.products;
  const [query, setQuery] = useState('');
  const [productType, setProductType] = useState('all');
  const [liquidity, setLiquidity] = useState('all');
  const [information, setInformation] = useState('all');
  const [visibleCount, setVisibleCount] = useState(12);
  const catalogRef = useRef(null);
  const compareButtonRef = useRef(null);
  const [detailId, setDetailId] = useState(null);
  const [detailFocus, setDetailFocus] = useState('heading');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const baseId = useId();
  const reducedMotion = useReducedMotion();
  const today = localCatalogDate();
  const types = useMemo(() => [...new Set(products.map(product => product.productType || 'unknown'))].sort((a, b) => a.localeCompare(b, 'es')), [products]);
  const filtered = useMemo(() => filterSavingsProducts(products, { query, productType, liquidity, information }), [products, query, productType, liquidity, information]);
  const page = catalogPage(filtered, visibleCount);
  const selected = useMemo(() => selectedSavingsProducts(products, selectedIds), [products, selectedIds]);
  const comparison = useMemo(() => buildSavingsComparison(products, selectedIds, today), [products, selectedIds, today]);
  const detail = active ? products.find(product => product.id === detailId) || null : null;
  const hasFilters = query.trim() || productType !== 'all' || liquidity !== 'all' || information !== 'all';
  useEffect(() => { setVisibleCount(12); }, [query, productType, liquidity, information]);
  useEffect(() => {
    if (active || (!detailId && !comparisonOpen)) return;
    setDetailId(null);
    setComparisonOpen(false);
    onDeactivateOverlay?.();
  }, [active, detailId, comparisonOpen, onDeactivateOverlay]);
  const toggle = id => {
    if (readOnly) return;
    const result = toggleSavingsComparison(selectedIds, id);
    if (!result.reason) onSelectedIdsChange?.(result.ids);
    setNotice(result.reason === 'limit' ? 'Puedes comparar hasta tres productos. Quita uno para añadir otro.' : '');
  };
  const resetFilters = () => { setQuery(''); setProductType('all'); setLiquidity('all'); setInformation('all'); };
  const openDetail = (id, section = 'heading') => { setDetailFocus(section); setDetailId(id); };
  const closeComparison = () => {
    setComparisonOpen(false);
    requestAnimationFrame(() => {
      if (active && !catalogRef.current?.closest('[hidden]')) compareButtonRef.current?.focus({ preventScroll: true });
    });
  };
  const showMore = () => {
    const nextId = filtered[visibleCount]?.id;
    setVisibleCount(count => count + 12);
    requestAnimationFrame(() => document.getElementById(`${baseId}-product-${nextId}`)?.focus());
  };

  return <section ref={catalogRef} className="savings-catalog" aria-labelledby={`${baseId}-title`}>
    <header className="savings-header"><h2 id={`${baseId}-title`}>Explora productos para tu ahorro</h2><p>Cuentas, apartados y otros productos: revisa qué condiciones están documentadas.</p></header>
    <div className="savings-difference-note"><ShieldQuestion size={20} aria-hidden="true" /><p>{DIFFERENCE_NOTE}</p></div>
    <details className="savings-methodology"><summary>Alcance y fecha de consulta<ChevronDown size={15} aria-hidden="true" /></summary><div><p>{catalog?.coverage?.scope || 'Catálogo parcial de productos con fuentes disponibles.'}</p><p>{products.length} productos identificados · {products.filter(product => product.hasDetailedSheet).length} con ficha documentada · Consulta: {formatCatalogDate(catalog?.reviewedOn)}</p>{catalog?.coverage?.limitations?.length > 0 && <FactList values={catalog.coverage.limitations} />}<SourceLinks sources={catalog?.sources || []} /></div></details>
    <div className="savings-filters">
      <label className="savings-search" htmlFor={`${baseId}-search`}><span>Buscar producto o entidad</span><div><Search size={17} aria-hidden="true" /><input id={`${baseId}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre, entidad o apartado" /></div></label>
      <label htmlFor={`${baseId}-type`}><span>Tipo de producto</span><select id={`${baseId}-type`} value={productType} onChange={event => setProductType(event.target.value)}><option value="all">Todos los tipos</option>{types.map(type => <option key={type} value={type}>{type === 'unknown' ? 'Tipo por documentar' : type}</option>)}</select></label>
      <label htmlFor={`${baseId}-liquidity`}><span>Disponibilidad del dinero</span><select id={`${baseId}-liquidity`} value={liquidity} onChange={event => setLiquidity(event.target.value)}>{SAVINGS_LIQUIDITY_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label htmlFor={`${baseId}-information`}><span>Información disponible</span><select id={`${baseId}-information`} value={information} onChange={event => setInformation(event.target.value)}><option value="all">Todos los productos</option><option value="sheet">Con ficha documentada</option><option value="identified">Sólo identificación</option></select></label>
    </div>

    <p role="status" className="savings-notice">{notice}</p>
    <div className="savings-results-meta"><p role="status">{filtered.length} de {products.length} productos · Orden alfabético por nombre</p>{hasFilters && <button type="button" onClick={resetFilters}>Limpiar filtros<X size={14} aria-hidden="true" /></button>}</div>
    {page.entries.length ? <ul className="savings-product-list">{page.entries.map(product => {
      const ordered = orderedSavingsReturns(product.returns || []);
      const shown = previewSavingsReturns(ordered, today);
      return <li key={product.id}><article className="savings-product-row">
        <div className="savings-product-identity"><label className="savings-checkbox"><input type="checkbox" checked={selectedIds.includes(product.id)} disabled={readOnly} onChange={() => toggle(product.id)} /><span>Comparar<span className="savings-sr-only"> {product.name}</span></span></label><p className="savings-issuer">{product.issuer}</p><h3 id={`${baseId}-product-${product.id}`} tabIndex={-1}>{product.name}</h3><p className="savings-product-type">{product.productType || 'Tipo por documentar'}</p><span className="savings-tag">{product.hasDetailedSheet ? 'Con ficha documentada' : 'Producto identificado'}</span><div className="savings-contracting"><p className="savings-label">Disponibilidad para contratar</p><p className="savings-availability">{product.availability || 'Estado de contratación por confirmar.'}</p></div></div>
        <div className="savings-product-conditions"><h4 className="savings-conditions-title">Condiciones publicadas</h4>{shown.length ? shown.map(observation => <ReturnObservation key={observation.id} observation={observation} product={product} today={today} compact />) : <><p className="savings-product-summary">{product.summary || 'Producto identificado en las fuentes enlazadas.'}</p><p className="savings-muted">Rendimiento por documentar. La ausencia de una cifra no significa un rendimiento de cero.</p></>}{ordered.length > shown.length && <><p className="savings-more-observations">Mostrando {shown.length} de {ordered.length} condiciones documentadas</p><button type="button" className="savings-button" onClick={() => openDetail(product.id, 'returns')}>Ver todas las tasas y plazos<ArrowRight size={15} aria-hidden="true" /></button></>}<div className="savings-liquidity-summary"><h4 className="savings-conditions-title">Disponibilidad del dinero</h4><p>{product.liquidity?.summary || 'Liquidez y plazo por documentar.'}</p></div><div className="savings-fees-summary"><h4 className="savings-conditions-title">Costos y membresía</h4><FactList values={product.fees} fallback="Costos y membresía por verificar en la fuente del producto." /></div></div>
        <div className="savings-product-actions"><motion.button type="button" className="savings-button" whileTap={reducedMotion ? undefined : { scale: 0.985 }} onClick={() => openDetail(product.id)} aria-label={`Ver ficha de ${product.name}`}>Ver ficha<ArrowRight size={15} aria-hidden="true" /></motion.button><ProductSourceDetails product={product} observations={shown} /></div>
      </article></li>;
    })}</ul> : <div className="savings-empty"><Search size={25} aria-hidden="true" /><h3>{products.length ? 'No hay productos con estos filtros' : 'Aún no hay productos de ahorro documentados'}</h3><p>{products.length ? 'Prueba otro nombre, tipo de producto o disponibilidad.' : 'Los productos aparecerán cuando sus fuentes estén disponibles.'}</p>{hasFilters && <button type="button" className="savings-button" onClick={resetFilters}>Ver todos los productos</button>}</div>}
    {page.remaining > 0 && <div className="savings-pagination"><p>Mostrando {page.entries.length} de {filtered.length} resultados</p><button type="button" className="savings-button" onClick={showMore}>Mostrar {Math.min(12, page.remaining)} productos más<ChevronDown size={15} aria-hidden="true" /></button></div>}
    <SelectionDock selected={selected} active={active} visible={active && selectedIds.length > 0 && !detail && !comparisonOpen} catalogRef={catalogRef} compareButtonRef={compareButtonRef} readOnly={readOnly} onToggle={toggle} onCompare={() => setComparisonOpen(true)} notice={notice} />
    <ProductDetail product={detail} today={today} selected={selectedIds.includes(detailId)} onToggle={toggle} onClose={() => setDetailId(null)} notice={notice} focusSection={detailFocus} readOnly={readOnly} />
    <SavingsComparison comparison={comparison} open={active && comparisonOpen} today={today} onClose={closeComparison} />
  </section>;
}
