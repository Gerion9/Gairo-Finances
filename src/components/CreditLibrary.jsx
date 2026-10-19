import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, ChevronDown, CreditCard, Search, SlidersHorizontal, X } from 'lucide-react';
import Modal from './ui/Modal';
import ProductViewLoader from './ProductViewLoader.jsx';
import { captureProductFocusIntent, createProductViewResource } from './ProductViewLoader.js';
import { mexicoCreditDirectory } from '../data/mexicoCreditDirectory';
import { cardBenefitPrograms } from '../data/cardBenefits';
import { savingsMarketCoverage } from '../data/marketCoverage';
import { CREDIT_LIBRARY_VIEWS } from '../data/navigation';
import { normalizeMarketSelections } from '../services/marketPreferences.js';
import {
  ANNUAL_FEE_FILTERS, COMPARISON_LIMIT, annualFeeLines, benefitProgramMetadata, catalogBenefitPrograms, catalogBenefitStrings,
  buildCardComparison, catalogIssuers, catalogPage, catalogSources, costSources, datedCostStatus,
  enrichCatalogEntries, filterCreditCards, filterCreditLoans, formatCatalogDate, formatCatalogRate, hasDocumentedBenefits, hasDocumentedCosts, hasPublishedFee, localCatalogDate,
  openingFeeLines, periodicFeeLines, selectedCreditCards, toggleCardComparison,
} from '../services/creditCatalog';
import './CreditLibrary.css';

const EMPTY_CATALOG = { cards: [], loanFamilies: [] };
const purchaseViewResource = createProductViewResource(() => import('./CardChoiceWorkbench'));
const savingsViewResource = createProductViewResource(() => import('./SavingsCatalogRoute'));
const scopeLabels = { costs: 'Con costos documentados', benefits: 'Con beneficios', all: 'Todo el directorio' };

function ScopeControl({ value, onChange, counts, label }) {
  return <fieldset className="credit-library-scope" aria-label={label}><legend>Mostrar</legend><div>
    {Object.entries(counts).map(([scope, count]) => <button key={scope} type="button" aria-pressed={value === scope} onClick={() => onChange(scope)}>{scopeLabels[scope]} <span>({count})</span></button>)}
  </div></fieldset>;
}

function CatalogBadges({ entry, programs = [] }) {
  return <div className="credit-library-badges">
    <span>Producto identificado</span>
    {entry.hasDetailedSheet && <span>Con ficha de costos</span>}
    {programs.length > 0 && <span>Reglas documentadas</span>}
  </div>;
}

function ProgramSummary({ program, inResult = false }) {
  const Heading = inResult ? 'h5' : 'h4';
  return <article className="credit-library-program-summary"><Heading>{program.name}</Heading><p>{program.summary}</p>
    <ul className="credit-library-program-context">{benefitProgramMetadata(program).map((line, index) => <li key={index}>{line}</li>)}</ul>
    <SourceLinks entry={{ evidence: program.sources || [] }} />
  </article>;
}

function DocumentedPrograms({ programs }) {
  if (!programs.length) return null;
  return <section className="credit-library-programs"><h3>Programas documentados</h3>
    <p className="credit-library-muted">La presencia de reglas no confirma su vigencia ni el beneficio de una compra específica.</p>
    {programs.map(program => <ProgramSummary key={program.id} program={program} />)}
  </section>;
}

function CardBenefits({ card, programs, onOpen }) {
  const benefits = catalogBenefitStrings(card);
  return <section className="credit-library-visible-benefits"><h4>Beneficios publicados</h4>
    {programs.slice(0, 2).map(program => <ProgramSummary key={program.id} program={program} inResult />)}
    {programs.length > 0 && <button type="button" className="credit-library-benefit-link" onClick={onOpen}>Ver todos los beneficios<span className="credit-library-sr-only"> de {card.name}</span><ArrowRight size={15} aria-hidden="true" /></button>}
    {benefits.length > 0 && (programs.length ? <details className="credit-library-other-benefits"><summary>Otros beneficios de la ficha<ChevronDown size={16} aria-hidden="true" /></summary><FactList values={benefits} /><SourceLinks entry={card} /></details> : <><FactList values={benefits} /><SourceLinks entry={card} /></>)}
    {!programs.length && !benefits.length && <p className="credit-library-muted">Beneficios aún por documentar. Esto no significa que el producto no los tenga.</p>}
  </section>;
}

function useHeadingFocus(open, contentRef) {
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      if (contentRef.current?.closest('[inert]')) return;
      const heading = contentRef.current?.closest('[role="dialog"]')?.querySelector('.modal-heading h2');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, contentRef]);
}

function SourceLinks({ entry, sources: suppliedSources, compact = false }) {
  const sources = suppliedSources || catalogSources(entry);
  const visibleSources = compact ? sources.slice(0, 1) : sources;
  if (!visibleSources.length) return <span className="credit-library-muted">Fuente por verificar</span>;
  return (
    <ul className={`credit-library-sources ${compact ? 'is-compact' : ''}`}>
      {visibleSources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">
        {compact ? 'Consultar fuente' : source.title}<ArrowUpRight size={14} aria-hidden="true" /><span className="credit-library-sr-only"> (abre en otra pestaña)</span>
      </a></li>)}
    </ul>
  );
}

function FactList({ values, fallback = 'Por verificar en la fuente del emisor.' }) {
  return values?.length
    ? <ul className="credit-library-fact-list">{values.map((value, index) => <li key={index}>{value}</li>)}</ul>
    : <p className="credit-library-muted">{fallback}</p>;
}

function PublishedCost({ cost = {}, today, label = 'CAT promedio', entry }) {
  const status = datedCostStatus(cost, today);
  return <div className="credit-library-published-cost credit-library-cost-cell">
    <div className="credit-library-cost-heading"><p className="credit-library-label">{label}</p><p className="credit-library-cost-value">{formatCatalogRate(cost)}</p></div>
    <div className="credit-library-cost-context">
    {cost.label && <p>{cost.label}</p>}
    {cost.type && <p>Tipo de tasa: {cost.type}</p>}
    {cost.basis && <p>{cost.basis}</p>}
    {cost.taxTreatment && <p className="credit-library-tax">{cost.taxTreatment}</p>}
    {cost.conditions && <p className="credit-library-condition">{cost.conditions}</p>}
    <span className={`credit-library-status is-${status.code}`}>{status.label}</span>
    <p className="credit-library-date">Cálculo: {formatCatalogDate(cost.asOf)}</p>
    <p className="credit-library-validity">{status.detail}</p>
    {entry && <SourceLinks sources={costSources(cost, entry)} />}
    </div>
  </div>;
}

function AnnualFee({ fee, entry }) {
  const [amount, tax, conditions, ...dates] = annualFeeLines(fee);
  return <div className="credit-library-annual-fee credit-library-cost-cell">
    <div className="credit-library-cost-heading"><p className="credit-library-label">{fee?.label || 'Anualidad'}</p><p className="credit-library-cost-value">{amount}</p></div>
    <div className="credit-library-cost-context">
    <p className="credit-library-tax">{tax}</p>
    <p className="credit-library-condition">{conditions}</p>
    {dates.map(line => <p className="credit-library-date" key={line}>{line}</p>)}
    {entry && <SourceLinks sources={costSources(fee, entry)} />}
    </div>
  </div>;
}

function PeriodicFee({ fee, entry, optional = false }) {
  const [amount, tax, conditions, ...context] = periodicFeeLines(fee);
  return <div className="credit-library-periodic-fee credit-library-cost-cell"><div className="credit-library-cost-heading"><p className="credit-library-label">{fee.label || (optional ? 'Membresía opcional' : 'Cargo periódico')}</p><p className="credit-library-cost-value">{amount}</p></div><div className="credit-library-cost-context">{optional && <p>Membresía opcional</p>}<p className="credit-library-tax">{tax}</p><p className="credit-library-condition">{conditions}</p>{context.map(line => <p key={line}>{line}</p>)}<SourceLinks sources={costSources(fee, entry)} /></div></div>;
}

function OpeningFee({ fee, entry }) {
  const [amount, tax, conditions, ...dates] = openingFeeLines(fee);
  return <div className="credit-library-opening-fee credit-library-cost-cell"><div className="credit-library-cost-heading"><p className="credit-library-label">{fee?.label || 'Comisión de apertura'}</p><p className="credit-library-cost-value">{amount}</p></div><div className="credit-library-cost-context"><p>{tax}</p><p>{conditions}</p>{dates.map(line => <p key={line}>{line}</p>)}<SourceLinks sources={costSources(fee, entry)} /></div></div>;
}

function AnnualAndPeriodicFees({ entry }) {
  const annual = entry.costs?.annualFee;
  const periodic = entry.costs?.maintenanceFee;
  const subscription = entry.costs?.optionalSubscriptionFee;
  const knownAnnual = hasPublishedFee(annual);
  const knownPeriodic = [periodic, subscription].some(hasPublishedFee);
  return <div className="credit-library-fees-cell"><p className="credit-library-label credit-library-fees-title">Anualidad y cargos periódicos</p>
    {(knownAnnual || !knownPeriodic) && <AnnualFee fee={annual} entry={entry} />}
    {periodic && <PeriodicFee fee={periodic} entry={entry} />}
    {subscription && <PeriodicFee fee={subscription} entry={entry} optional />}
    {!knownAnnual && knownPeriodic && <div className="credit-library-cost-context credit-library-missing-annual"><p>Anualidad sin dato documentado</p>{annual?.conditions && <p>{annual.conditions}</p>}{annual?.taxTreatment && <p>{annual.taxTreatment}</p>}{annual && <SourceLinks sources={costSources(annual, entry)} />}</div>}
    {!periodic && <p className="credit-library-muted">Cargos periódicos sin dato documentado</p>}
  </div>;
}

function CardCosts({ card, today }) {
  return hasDocumentedCosts(card) ? <><div className="credit-library-visible-cost-grid">
    <PublishedCost cost={card.costs?.cat} today={today} entry={card} />
    <PublishedCost cost={card.costs?.interestRate} today={today} label="Tasa ordinaria" entry={card} />
    <AnnualAndPeriodicFees entry={card} />
  </div>{hasPublishedFee(card.costs?.openingFee) && <div className="credit-library-card-opening"><OpeningFee fee={card.costs.openingFee} entry={card} /></div>}</> : <p className="credit-library-pending-costs">CAT, tasa y costos aún por documentar</p>;
}

function CardDetail({ card, today, onClose, selected, onToggle, selectionNotice, programs = [], onPurchase, purchaseDisabled = false }) {
  const contentRef = useRef(null);
  useHeadingFocus(Boolean(card), contentRef);
  return <Modal isOpen={Boolean(card)} onClose={onClose} title={card?.name} description={card?.issuer} wide className="credit-library-modal">
    {card && <div ref={contentRef} className="credit-library-detail">
      <div className="credit-library-detail-intro"><CatalogBadges entry={card} programs={programs} /><p>Consulta: {formatCatalogDate(card.consultedOn)}</p></div>
      {card.summary && <p className="credit-library-product-summary">{card.summary}</p>}
      {card.productType && <p className="credit-library-muted">Tipo documentado: {card.productType}</p>}
      {card.availability && <p className="credit-library-muted">{card.availability}</p>}
      <CardCosts card={card} today={today} />
      <p className="credit-library-context-note">El CAT promedio es una referencia del costo total publicado. No es la tasa de interés individual ni una oferta de aprobación.</p>
      <div className="credit-library-detail-sections">
        {(card.hasDetailedSheet || card.requirements?.length > 0) && <section><h3>Requisitos publicados</h3><FactList values={card.requirements} /></section>}
        {(card.hasDetailedSheet || card.otherFees?.length > 0) && <section><h3>Otros costos</h3><FactList values={card.otherFees} /></section>}
        {card.benefits?.length > 0 && <section><h3>Beneficios publicados</h3><FactList values={card.benefits} /></section>}
        <section><h3>Notas y condiciones</h3><FactList values={card.limitations} /></section>
      </div>
      <DocumentedPrograms programs={programs} />
      <section className="credit-library-detail-sources"><h3>Fuentes del emisor</h3><SourceLinks entry={card} /></section>
      <div className="credit-library-detail-footer"><button className="credit-library-button is-primary" type="button" disabled={purchaseDisabled} onClick={() => onPurchase(card.id)}>La tengo: comparar una compra</button>{card.hasDetailedSheet && <button className="credit-library-button" type="button" onClick={() => onToggle(card.id)}>{selected ? 'Quitar de comparación de costos' : 'Comparar costos'}</button>}<button className="credit-library-button" type="button" onClick={onClose}>Cerrar ficha</button></div>
      <p className="credit-library-detail-notice" role="status">{selectionNotice}</p>
    </div>}
  </Modal>;
}

function Comparison({ comparison, open, onClose }) {
  const contentRef = useRef(null);
  useHeadingFocus(open, contentRef);
  return <Modal isOpen={open} onClose={onClose} title="Compara costos y condiciones" description="Las mismas preguntas para cada tarjeta. Revisa la vigencia de cada cifra." wide className="credit-library-modal credit-library-comparison-modal">
    <div ref={contentRef} className="credit-library-comparison" style={{ '--credit-comparison-count': comparison.entries.length || 1 }}>
      <div className="credit-library-comparison-heading" aria-hidden="true"><span>Condición publicada</span><div>{comparison.entries.map(card => <div key={card.id}><span>{card.issuer}</span><strong>{card.name}</strong></div>)}</div></div>
      {comparison.rows.map(row => <section key={row.id} className="credit-library-comparison-row" aria-label={row.label}>
        <h3>{row.label}</h3><div className="credit-library-comparison-values">{row.values.map(value => <div className="credit-library-comparison-value" key={value.cardId}>
          <h4>{value.productName}</h4>
          <ul>{value.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
          <SourceLinks sources={value.sources} />
        </div>)}</div>
      </section>)}
      <p className="credit-library-context-note">El CAT promedio no es una tasa individual. Una cifra vencida conserva su fecha como referencia; confirma las condiciones actuales con el emisor.</p>
      <button className="credit-library-button" type="button" onClick={onClose}>Cerrar comparación</button>
    </div>
  </Modal>;
}

function LoanOffer({ offer, today, familyLabel, summaryId }) {
  return <article className="credit-library-loan-offer credit-library-visible-loan" aria-labelledby={summaryId}>
    <header><p className="credit-library-issuer">{offer.issuer}{familyLabel ? ` · ${familyLabel}` : ''}</p><h3 id={summaryId} tabIndex={-1}>{offer.name}</h3><p className="credit-library-availability">Disponibilidad: {offer.availability || 'Disponibilidad actual por confirmar'}</p></header>
    {offer.summary && <p className="credit-library-product-summary">{offer.summary}</p>}
    {hasDocumentedCosts(offer) ? <div className="credit-library-visible-cost-grid">
      <PublishedCost cost={offer.costs?.cat} today={today} entry={offer} label="CAT publicado" />
      <PublishedCost cost={offer.costs?.interestRate} today={today} label="Tasa ordinaria" entry={offer} />
      <div className="credit-library-fees-cell"><OpeningFee fee={offer.costs?.openingFee} entry={offer} />{offer.costs?.maintenanceFee && <PeriodicFee fee={offer.costs.maintenanceFee} entry={offer} />}</div>
    </div> : <p className="credit-library-pending-costs">CAT, tasa y costos aún por documentar</p>}
    <dl className="credit-library-loan-terms"><div><dt>Monto publicado</dt><dd>{offer.amountRange || 'Sin dato documentado'}</dd></div><div><dt>Plazo publicado</dt><dd>{offer.termRange || 'Sin dato documentado'}</dd></div></dl>
    {offer.benefits?.length > 0 && <section className="credit-library-loan-extra"><h4>Beneficios publicados</h4><FactList values={catalogBenefitStrings(offer)} /></section>}
    {offer.otherFees?.length > 0 && <section className="credit-library-loan-extra"><h4>Otros costos</h4><FactList values={offer.otherFees} /></section>}
    <details className="credit-library-loan-conditions"><summary>Requisitos y condiciones<ChevronDown size={18} aria-hidden="true" /></summary><div className="credit-library-loan-offer-body">
      <section><h4>Requisitos publicados</h4><FactList values={offer.requirements} /></section>
      <section><h4>Notas y condiciones</h4><FactList values={offer.limitations} /></section>
      <section><h4>Fuentes y consulta</h4><p>Consulta: {formatCatalogDate(offer.consultedOn)}</p><SourceLinks entry={offer} /></section>
    </div></details>
  </article>;
}

export default function CreditLibrary({ catalog = EMPTY_CATALOG, active = true, onNavigate, requestedView, onViewChange, marketSelections, readOnly = false, onMarketSelectionsChange }) {
  const selections = useMemo(() => normalizeMarketSelections(marketSelections), [marketSelections]);
  const families = catalog?.loanFamilies || EMPTY_CATALOG.loanFamilies;
  const cards = useMemo(() => enrichCatalogEntries(mexicoCreditDirectory.cards, catalog?.cards || []), [catalog]);
  const loans = useMemo(() => enrichCatalogEntries(mexicoCreditDirectory.loans,
    families.flatMap(family => (family.offers || []).map(offer => ({ ...offer, familyId: family.id })))), [families]);
  const programs = cardBenefitPrograms;
  const programsByCard = useMemo(() => new Map(cards.map(card => [card.id, catalogBenefitPrograms(card.id, programs)])), [cards, programs]);
  const detailedCards = useMemo(() => cards.filter(card => card.hasDetailedSheet), [cards]);
  const cardScopes = useMemo(() => ({ costs: cards.filter(hasDocumentedCosts).length, benefits: cards.filter(card => hasDocumentedBenefits(card, programs)).length, all: cards.length }), [cards, programs]);
  const loanScopes = useMemo(() => ({ costs: loans.filter(hasDocumentedCosts).length, all: loans.length }), [loans]);
  const [localView, setView] = useState(() => CREDIT_LIBRARY_VIEWS.includes(requestedView) ? requestedView : 'cards');
  const view = CREDIT_LIBRARY_VIEWS.includes(requestedView) ? requestedView : localView;
  const [query, setQuery] = useState('');
  const [issuer, setIssuer] = useState('all');
  const [annualFee, setAnnualFee] = useState('all');
  const [productType, setProductType] = useState('all');
  const [information, setInformation] = useState('costs');
  const [visibleCards, setVisibleCards] = useState(12);
  const [loanQuery, setLoanQuery] = useState('');
  const [loanIssuer, setLoanIssuer] = useState('all');
  const [loanFamily, setLoanFamily] = useState('all');
  const [loanInformation, setLoanInformation] = useState('costs');
  const [visibleLoans, setVisibleLoans] = useState(12);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionNotice, setSelectionNotice] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const libraryRef = useRef(null);
  const libraryHeadingRef = useRef(null);
  const overlayViewRef = useRef(view);
  const focusFrameRef = useRef(null);
  const navigationRef = useRef({ active, view });
  navigationRef.current = { active, view };
  const workbenchRef = useRef(null);
  const loanResultsRef = useRef(null);
  const focusPurchaseRef = useRef(null);
  const purchaseFocusFrameRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const baseId = useId();
  const today = localCatalogDate();
  const issuers = useMemo(() => catalogIssuers(cards), [cards]);
  const types = useMemo(() => [...new Set(cards.map(card => card.productType || 'unknown'))].sort((a, b) => a.localeCompare(b, 'es')), [cards]);
  const loanIssuers = useMemo(() => catalogIssuers(loans), [loans]);
  const familyNames = useMemo(() => new Map([...families.map(family => [family.id, family.name]), ...Object.entries(mexicoCreditDirectory.familyLabels || {})]), [families]);
  const familyOptions = useMemo(() => [...new Set([...families.map(family => family.id), ...loans.map(loan => loan.familyId).filter(Boolean)])]
    .map(id => ({ id, name: familyNames.get(id) || 'Familia por documentar' })), [families, loans, familyNames]);
  const filteredCards = useMemo(() => filterCreditCards(cards, { query, issuer, annualFee, productType, information, programs }), [cards, query, issuer, annualFee, productType, information, programs]);
  const filteredLoans = useMemo(() => filterCreditLoans(loans, { query: loanQuery, issuer: loanIssuer, familyId: loanFamily, information: loanInformation }), [loans, loanQuery, loanIssuer, loanFamily, loanInformation]);
  const cardPage = catalogPage(filteredCards, visibleCards);
  const loanPage = catalogPage(filteredLoans, visibleLoans);
  const selected = useMemo(() => selectedCreditCards(detailedCards, selectedIds), [detailedCards, selectedIds]);
  const comparison = useMemo(() => buildCardComparison(detailedCards, selectedIds, today, programs), [detailedCards, selectedIds, today, programs]);
  const overlaysActive = active && overlayViewRef.current === view;
  const detailCard = overlaysActive ? cards.find(card => card.id === detailId) || null : null;
  const hasFilters = Boolean(query.trim() || issuer !== 'all' || annualFee !== 'all' || productType !== 'all');
  const hasLoanFilters = Boolean(loanQuery.trim() || loanIssuer !== 'all' || loanFamily !== 'all');

  const focusActiveHeading = () => {
    cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = requestAnimationFrame(() => {
      // Run after the closing portal releases its focus trap; another dialog keeps its focus.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const current = navigationRef.current;
      const selectors = { cards: '.credit-library-cards h2', loans: '.credit-library-loans h2', savings: '.savings-header h2', purchase: '.card-choice > h2' };
      const scope = current.active ? libraryRef.current : document.getElementById('main-content');
      const candidates = scope?.querySelectorAll(current.active ? selectors[current.view] : 'h1, h2') || [];
      const heading = [...candidates].find(element => !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      else if (!current.active) scope?.focus({ preventScroll: true });
      else libraryHeadingRef.current?.focus({ preventScroll: true });
    });
  };
  const requestPurchaseFocus = () => {
    focusPurchaseRef.current?.cancel();
    focusPurchaseRef.current = captureProductFocusIntent(libraryRef.current?.ownerDocument);
  };
  const focusPurchaseHeading = () => {
    cancelAnimationFrame(purchaseFocusFrameRef.current);
    purchaseFocusFrameRef.current = requestAnimationFrame(() => {
      const intent = focusPurchaseRef.current;
      const current = navigationRef.current;
      if (!intent || !current.active || current.view !== 'purchase') return;
      const heading = workbenchRef.current?.querySelector('.card-choice > h2') || libraryHeadingRef.current;
      // Resolve navigation focus now; finishing a download must never move it.
      focusPurchaseRef.current = null;
      const shouldFocus = intent.isCurrent() && heading && !heading.closest('[hidden], [inert]');
      intent.cancel();
      if (shouldFocus) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  };
  useEffect(() => () => cancelAnimationFrame(focusFrameRef.current), []);
  useEffect(() => () => {
    cancelAnimationFrame(purchaseFocusFrameRef.current);
    focusPurchaseRef.current?.cancel();
    focusPurchaseRef.current = null;
  }, []);
  useEffect(() => {
    if (overlaysActive || (!detailId && !compareOpen)) return;
    setDetailId(null);
    setCompareOpen(false);
    focusActiveHeading();
  }, [overlaysActive, detailId, compareOpen]);
  useEffect(() => { setVisibleCards(12); }, [query, issuer, annualFee, productType, information]);
  useEffect(() => { setVisibleLoans(12); }, [loanQuery, loanIssuer, loanFamily, loanInformation]);
  useEffect(() => {
    if (!CREDIT_LIBRARY_VIEWS.includes(requestedView)) return;
    if (requestedView === 'purchase' && !focusPurchaseRef.current) requestPurchaseFocus();
    setView(requestedView);
  }, [requestedView]);
  useEffect(() => {
    if (!active || view !== 'purchase') {
      focusPurchaseRef.current?.cancel();
      focusPurchaseRef.current = null;
      cancelAnimationFrame(purchaseFocusFrameRef.current);
      return;
    }
    focusPurchaseHeading();
  }, [active, view, detailId, requestedView]);

  const changeView = nextView => {
    if (!CREDIT_LIBRARY_VIEWS.includes(nextView)) return;
    setView(nextView);
    onViewChange?.(nextView);
  };
  const toggleComparison = id => {
    if (!detailedCards.some(card => card.id === id)) return;
    const result = toggleCardComparison(selectedIds, id);
    setSelectedIds(result.ids);
    setSelectionNotice(result.reason === 'limit' ? 'Puedes comparar hasta tres tarjetas. Quita una para añadir otra.' : '');
  };
  const comparePurchase = id => {
    if (!selections.ownedCardIds.includes(id)) {
      if (readOnly) return;
      onMarketSelectionsChange?.({ ownedCardIds: [...selections.ownedCardIds, id] });
    }
    requestPurchaseFocus();
    setDetailId(null);
    changeView('purchase');
  };
  const openCard = card => { overlayViewRef.current = view; setDetailId(typeof card === 'string' ? card : card?.id || null); };
  const resetFilters = () => { setQuery(''); setIssuer('all'); setAnnualFee('all'); setProductType('all'); };
  const resetLoanFilters = () => { setLoanQuery(''); setLoanIssuer('all'); setLoanFamily('all'); };
  const showMoreCards = () => {
    const nextId = filteredCards[visibleCards]?.id;
    setVisibleCards(count => count + 12);
    requestAnimationFrame(() => document.getElementById(`${baseId}-card-${nextId}`)?.focus());
  };
  const showMoreLoans = () => {
    const nextId = filteredLoans[visibleLoans]?.id;
    setVisibleLoans(count => count + 12);
    requestAnimationFrame(() => document.getElementById(`${baseId}-loan-${nextId}`)?.focus());
  };

  return <div ref={libraryRef} className="credit-library">
    <header className="credit-library-header">
      <h1 ref={libraryHeadingRef} tabIndex={-1}>Productos financieros en México</h1>
      <p className="credit-library-description">Explora tarjetas, préstamos y productos de ahorro con sus fuentes y condiciones.</p>
      <details className="credit-library-methodology"><summary>Qué cubre esta biblioteca<ChevronDown size={15} aria-hidden="true" /></summary><div>
        <p className="credit-library-coverage"><span>{cards.length} tarjetas identificadas</span><span>{detailedCards.length} tarjetas con ficha</span><span>{loans.length} productos y programas de financiamiento</span><span>{programs.length} programas de beneficios documentados</span></p>
        <p className="credit-library-coverage credit-library-savings-coverage"><span>{savingsMarketCoverage.identifiedProducts} productos de ahorro identificados</span><span>{savingsMarketCoverage.detailedProducts} con ficha de ahorro</span></p>
        <p>{mexicoCreditDirectory.coverage?.scope || 'Este catálogo es parcial y no representa todo el mercado.'}</p>
        <p>Identificar un producto, documentar sus costos y documentar sus reglas de beneficios son coberturas distintas. Una ficha no confirma disponibilidad, elegibilidad ni aprobación.</p>
        <p>Directorio consultado: {formatCatalogDate(mexicoCreditDirectory.reviewedOn)}. Fichas de costos: {formatCatalogDate(catalog?.reviewedOn)}. Cada programa conserva su propia fecha de consulta.</p>
        <p>La fecha de consulta indica cuándo se revisó una fuente; no amplía su vigencia. Los datos sin confirmar aparecen como «Por verificar» y las cifras vencidas conservan su fecha.</p>
        {mexicoCreditDirectory.coverage?.limitations?.length > 0 && <FactList values={mexicoCreditDirectory.coverage.limitations} />}
        <details className="credit-library-source-directory"><summary>Fuentes del directorio ({mexicoCreditDirectory.sources?.length || 0})<ChevronDown size={15} aria-hidden="true" /></summary><SourceLinks entry={{ evidence: mexicoCreditDirectory.sources || [] }} /></details>
      </div></details>
    </header>

    <div className="credit-library-view-switch" role="group" aria-label="Vista de la biblioteca">
      <button type="button" aria-pressed={view === 'cards' || view === 'purchase'} onClick={() => changeView('cards')}>Tarjetas</button>
      <button type="button" aria-pressed={view === 'loans'} onClick={() => changeView('loans')}>Préstamos</button>
      <button type="button" aria-pressed={view === 'savings'} onClick={() => changeView('savings')}>Ahorro</button>
    </div>

    {view === 'cards' && selectedIds.length > 0 && <section className="credit-library-selection" aria-label="Tarjetas para comparar costos">
      <div className="credit-library-selection-copy"><strong>Costos de {selected.length} de {COMPARISON_LIMIT} tarjetas</strong><p>{selected.length < 2 ? 'Añade otra ficha para comparar sus condiciones.' : 'Esta selección compara costos publicados.'}</p></div>
      <ul>{selected.map(card => <li key={card.id}><span>{card.name}</span><button type="button" aria-label={`Quitar ${card.name} de comparación`} onClick={() => toggleComparison(card.id)}><X size={15} aria-hidden="true" /></button></li>)}</ul>
      <button className="credit-library-button is-primary" type="button" disabled={selected.length < 2} onClick={() => { overlayViewRef.current = view; setCompareOpen(true); }}>Comparar costos<ArrowRight size={16} aria-hidden="true" /></button>
    </section>}
    <p className="credit-library-selection-notice" role="status" aria-live="polite">{view === 'cards' ? selectionNotice : ''}</p>

    <div ref={workbenchRef} hidden={view !== 'purchase'} className="credit-library-workbench">
      <div className="credit-library-purchase-navigation"><nav aria-label="Ruta de la biblioteca"><ol><li>Productos</li><li>Tarjetas</li><li aria-current="page">Para esta compra</li></ol></nav><button type="button" className="credit-library-button" onClick={() => changeView('cards')}>Volver a tarjetas</button></div>
      <ProductViewLoader resource={purchaseViewResource} active={active && view === 'purchase'} loadingLabel="Cargando comparación de compra…" errorLabel="No pudimos cargar la comparación de compra" retryFocusRef={libraryHeadingRef} componentProps={{ cards, programs, selectedIds: selections.ownedCardIds, onSelectedIdsChange: ids => { if (!readOnly) onMarketSelectionsChange?.({ ownedCardIds: ids }); }, selectionReadOnly: readOnly, onOpenCard: openCard, onNavigate }} />
    </div>
    <div hidden={view !== 'savings'} className="credit-library-savings"><ProductViewLoader resource={savingsViewResource} active={active && view === 'savings'} loadingLabel="Cargando opciones de ahorro…" errorLabel="No pudimos cargar las opciones de ahorro" retryFocusRef={libraryHeadingRef} componentProps={{ onDeactivateOverlay: focusActiveHeading, selectedIds: selections.savingsProductIds, onSelectedIdsChange: ids => { if (!readOnly) onMarketSelectionsChange?.({ savingsProductIds: ids }); }, readOnly }} /></div>

    <motion.div hidden={view !== 'cards'} initial={false} animate={{ opacity: view === 'cards' ? 1 : 0, y: reducedMotion || view === 'cards' ? 0 : 5 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
      <section className="credit-library-cards" aria-labelledby={`${baseId}-cards-title`}>
        <div className="credit-library-purchase-entry"><div><strong>Una compra, las tarjetas que ya tienes</strong><p>Consulta beneficios y condiciones para el gasto que estás considerando.</p></div><button type="button" className="credit-library-button is-primary" onClick={() => { requestPurchaseFocus(); changeView('purchase'); }}>Comparar una compra con mis tarjetas<ArrowRight size={16} aria-hidden="true" /></button></div>
        <div className="credit-library-section-heading"><div><h2 id={`${baseId}-cards-title`}>Explora las tarjetas identificadas</h2><p>Busca un producto y consulta qué costos y reglas están documentados.</p></div></div>
        <ScopeControl label="Alcance de tarjetas" value={information} onChange={setInformation} counts={cardScopes} />
        <div className="credit-library-filters credit-library-directory-filters">
          <label className="credit-library-search" htmlFor={`${baseId}-search`}><span>Buscar tarjeta o emisor</span><div><Search size={17} aria-hidden="true" /><input id={`${baseId}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre de tarjeta o emisor" /></div></label>
          <label htmlFor={`${baseId}-issuer`}><span>Emisor</span><select id={`${baseId}-issuer`} value={issuer} onChange={event => setIssuer(event.target.value)}><option value="all">Todos los emisores</option>{issuers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label htmlFor={`${baseId}-type`}><span>Tipo documentado</span><select id={`${baseId}-type`} value={productType} onChange={event => setProductType(event.target.value)}><option value="all">Todos los tipos</option>{types.map(type => <option key={type} value={type}>{type === 'unknown' ? 'Tipo por documentar' : type}</option>)}</select></label>
          <label htmlFor={`${baseId}-fee`}><span>Anualidad</span><select id={`${baseId}-fee`} value={annualFee} onChange={event => setAnnualFee(event.target.value)}>{ANNUAL_FEE_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <div className="credit-library-results-meta"><p role="status">{filteredCards.length} de {cards.length} tarjetas <span aria-hidden="true">·</span> {scopeLabels[information]} <span aria-hidden="true">·</span> Orden alfabético por nombre</p>{hasFilters && <button type="button" onClick={resetFilters}>Limpiar filtros<X size={14} aria-hidden="true" /></button>}</div>
        {filteredCards.length ? <ul className="credit-library-card-list">{cardPage.entries.map(card => <li key={card.id}>
          <article className="credit-library-card-row credit-library-visible-card" aria-labelledby={`${baseId}-card-${card.id}`}>
            <header className="credit-library-visible-card-header"><div className="credit-library-card-identity"><p className="credit-library-issuer">{card.issuer}</p><h3 id={`${baseId}-card-${card.id}`} tabIndex={-1}>{card.name}</h3><p className="credit-library-availability">Disponibilidad: {card.availability || 'Disponibilidad actual por confirmar'}</p><p className="credit-library-date">Consulta: {formatCatalogDate(card.consultedOn)}</p></div>
              {card.hasDetailedSheet ? <label className="credit-library-checkbox"><input type="checkbox" checked={selectedIds.includes(card.id)} onChange={() => toggleComparison(card.id)} /><span>Comparar costos<span className="credit-library-sr-only"> de {card.name}</span></span></label> : <p className="credit-library-unavailable-action">Comparación de costos aún no disponible.</p>}
            </header>
            <div className="credit-library-visible-card-body"><section className="credit-library-visible-costs"><h4>Costos publicados</h4><CardCosts card={card} today={today} /></section><CardBenefits card={card} programs={programsByCard.get(card.id) || []} onOpen={() => openCard(card.id)} /></div>
            <footer className="credit-library-visible-card-footer">
              <button className="credit-library-button" type="button" onClick={() => openCard(card.id)} aria-label={`Ver ficha completa de ${card.name}`}>Ver ficha completa<ArrowRight size={15} aria-hidden="true" /></button>
              <button className="credit-library-button is-purchase" type="button" disabled={readOnly && !selections.ownedCardIds.includes(card.id)} onClick={() => comparePurchase(card.id)}>La tengo: comparar una compra</button>
            </footer>
          </article>
        </li>)}</ul> : <div className="credit-library-empty"><SlidersHorizontal size={25} aria-hidden="true" /><h3>{cards.length ? 'No hay tarjetas con estos filtros' : 'Aún no hay tarjetas documentadas'}</h3><p>{cards.length ? `No hay coincidencias en «${scopeLabels[information]}». Puedes ampliar el alcance o ajustar los filtros.` : 'Las fichas aparecerán cuando sus fuentes y condiciones estén documentadas.'}</p>{information !== 'all' && <button type="button" className="credit-library-button" onClick={() => setInformation('all')}>Buscar en todo el directorio</button>}{hasFilters && <button type="button" className="credit-library-button" onClick={resetFilters}>Limpiar filtros</button>}</div>}
        {cardPage.remaining > 0 && <div className="credit-library-pagination"><p>Mostrando {cardPage.entries.length} de {filteredCards.length} resultados</p><button type="button" className="credit-library-button" onClick={showMoreCards}>Mostrar {Math.min(12, cardPage.remaining)} tarjetas más<ChevronDown size={16} aria-hidden="true" /></button></div>}
        <p className="credit-library-bottom-note">Los alcances de costos y beneficios pueden incluir una misma tarjeta; sus conteos no se suman. Las cifras y reglas conservan sus fechas y no confirman una oferta individual.</p>
      </section>
    </motion.div>
    <motion.div hidden={view !== 'loans'} initial={false} animate={{ opacity: view === 'loans' ? 1 : 0, y: reducedMotion || view === 'loans' ? 0 : 5 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
      <section className="credit-library-loans" aria-labelledby={`${baseId}-loans-title`}>
        <div className="credit-library-section-heading"><div><h2 ref={loanResultsRef} tabIndex={-1} id={`${baseId}-loans-title`}>Explora productos y programas de financiamiento</h2><p>Busca por producto, emisor o familia. Un programa o modalidad no representa necesariamente un crédito directo.</p></div></div>
        <ScopeControl label="Alcance de financiamiento" value={loanInformation} onChange={setLoanInformation} counts={loanScopes} />
        <div className="credit-library-filters">
          <label className="credit-library-search" htmlFor={`${baseId}-loan-search`}><span>Buscar préstamo o emisor</span><div><Search size={17} aria-hidden="true" /><input id={`${baseId}-loan-search`} type="search" value={loanQuery} onChange={event => setLoanQuery(event.target.value)} placeholder="Nombre de préstamo o emisor" /></div></label>
          <label htmlFor={`${baseId}-loan-issuer`}><span>Emisor</span><select id={`${baseId}-loan-issuer`} value={loanIssuer} onChange={event => setLoanIssuer(event.target.value)}><option value="all">Todos los emisores</option>{loanIssuers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label htmlFor={`${baseId}-loan-family`}><span>Familia</span><select id={`${baseId}-loan-family`} value={loanFamily} onChange={event => setLoanFamily(event.target.value)}><option value="all">Todas las familias</option>{familyOptions.map(family => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label>
        </div>
        <div className="credit-library-results-meta"><p role="status">{filteredLoans.length} de {loans.length} productos y programas de financiamiento <span aria-hidden="true">·</span> {scopeLabels[loanInformation]} <span aria-hidden="true">·</span> Orden alfabético por nombre</p>{hasLoanFilters && <button type="button" onClick={resetLoanFilters}>Limpiar filtros<X size={14} aria-hidden="true" /></button>}</div>
        {filteredLoans.length ? <div className="credit-library-loan-directory">{loanPage.entries.map(offer => <LoanOffer key={offer.id} summaryId={`${baseId}-loan-${offer.id}`} offer={offer} today={today} familyLabel={familyNames.get(offer.familyId) || 'Familia por documentar'} />)}</div> : <div className="credit-library-empty"><SlidersHorizontal size={25} aria-hidden="true" /><h3>No hay préstamos con estos filtros</h3><p>No hay coincidencias en «{scopeLabels[loanInformation]}». Puedes ampliar el alcance o ajustar los filtros.</p>{loanInformation !== 'all' && <button type="button" className="credit-library-button" onClick={() => setLoanInformation('all')}>Buscar en todo el directorio</button>}{hasLoanFilters && <button type="button" className="credit-library-button" onClick={resetLoanFilters}>Limpiar filtros</button>}</div>}
        {loanPage.remaining > 0 && <div className="credit-library-pagination"><p>Mostrando {loanPage.entries.length} de {filteredLoans.length} resultados</p><button type="button" className="credit-library-button" onClick={showMoreLoans}>Mostrar {Math.min(12, loanPage.remaining)} resultados más<ChevronDown size={16} aria-hidden="true" /></button></div>}
        {families.length > 0 && <details className="credit-library-family-guide"><summary>Cómo funciona cada familia de préstamos<ChevronDown size={18} aria-hidden="true" /></summary><div className="credit-library-family-grid">{families.map(family => <details className="credit-library-family" key={family.id}>
          <summary><span className="credit-library-family-icon"><CreditCard size={20} aria-hidden="true" /></span><span><strong>{family.name}</strong></span><ChevronDown size={18} aria-hidden="true" /></summary>
          <div className="credit-library-family-body"><section><h3>Para qué sirve</h3><p>{family.purpose || 'Por verificar en las fuentes.'}</p></section><section><h3>Cómo se paga</h3><p>{family.repayment || 'Por verificar en las fuentes.'}</p></section><section><h3>Qué revisar</h3><FactList values={family.watchOut} /></section><section><h3>Fuentes de esta familia</h3><SourceLinks entry={family} /></section><button type="button" className="credit-library-button" onClick={() => { setLoanFamily(family.id); setLoanQuery(''); setLoanIssuer('all'); setLoanInformation('all'); requestAnimationFrame(() => loanResultsRef.current?.focus()); }}>Ver préstamos de esta familia</button></div>
        </details>)}</div></details>}
        <p className="credit-library-bottom-note">Los montos, plazos y costos publicados describen cada oferta. Las condiciones personales deben confirmarse con el emisor.</p>
      </section>
    </motion.div>
    <CardDetail card={detailCard} today={today} onClose={() => setDetailId(null)} selected={selectedIds.includes(detailId)} onToggle={toggleComparison} selectionNotice={selectionNotice} programs={programsByCard.get(detailId) || []} onPurchase={comparePurchase} purchaseDisabled={readOnly && !selections.ownedCardIds.includes(detailId)} />
    <Comparison comparison={comparison} open={overlaysActive && compareOpen} onClose={() => setCompareOpen(false)} />
  </div>;
}
