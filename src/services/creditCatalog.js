const collator = new Intl.Collator('es-MX', { sensitivity: 'base', numeric: true });
const decimal = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
export const COMPARISON_LIMIT = 3;
export const ANNUAL_FEE_FILTERS = [
  { value: 'all', label: 'Todas las anualidades' },
  { value: 'none', label: 'Sin anualidad' },
  { value: 'conditional', label: 'Exención con condiciones' },
  { value: 'annual', label: 'Con anualidad' },
  { value: 'unknown', label: 'Por verificar' },
];

export const normalizeCatalogSearch = value => (typeof value === 'string' ? value : '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();

export function validCatalogNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatCatalogMoney(value) {
  return validCatalogNumber(value) === null ? 'Por verificar' : `${money.format(value)} MXN`;
}

export function formatCatalogPercent(value) {
  return validCatalogNumber(value) === null ? 'Por verificar' : `${decimal.format(value)}%`;
}

export function hasCatalogRate(cost = {}) {
  return validCatalogNumber(cost.percent) !== null
    || (validCatalogNumber(cost.minPercent) !== null && validCatalogNumber(cost.maxPercent) !== null && cost.minPercent <= cost.maxPercent);
}

export function formatCatalogRate(cost = {}) {
  if (validCatalogNumber(cost.percent) !== null) return formatCatalogPercent(cost.percent);
  return hasCatalogRate(cost) ? `${formatCatalogPercent(cost.minPercent)}–${formatCatalogPercent(cost.maxPercent)}` : 'Por verificar';
}

export function hasDocumentedCosts(entry = {}) {
  const costs = entry.costs || {};
  return hasCatalogRate(costs.cat) || hasCatalogRate(costs.interestRate)
    || ['annualFee', 'maintenanceFee', 'optionalSubscriptionFee', 'openingFee'].some(field => hasPublishedFee(costs[field]));
}

export function hasPublishedFee(fee = {}) {
  return validCatalogNumber(fee?.amount) !== null || (typeof fee?.publishedText === 'string' && Boolean(fee.publishedText.trim()));
}

export function catalogBenefitStrings(entry = {}) {
  return [...new Set((Array.isArray(entry.benefits) ? entry.benefits : []).filter(value => typeof value === 'string' && value.trim()))];
}

export function catalogBenefitPrograms(cardId, programs = []) {
  const seen = new Set();
  const entries = programs.filter(program => {
    if (program.cardId !== cardId || seen.has(program.id)) return false;
    seen.add(program.id);
    return true;
  });
  // Reorder only explicitly classified ongoing/welcome slots; preserve all other editorial positions.
  const classified = entries.filter(program => ['ongoing', 'welcome'].includes(program.kind))
    .sort((a, b) => Number(a.kind === 'welcome') - Number(b.kind === 'welcome'));
  let index = 0;
  return entries.map(program => ['ongoing', 'welcome'].includes(program.kind) ? classified[index++] : program);
}

export function hasDocumentedBenefits(entry = {}, programs = []) {
  return catalogBenefitStrings(entry).length > 0 || programs.some(program => program.cardId === entry.id);
}

export function benefitProgramMetadata(program = {}) {
  const reward = program.reward || {};
  const types = { cash: 'Devolución en dinero', points: 'Puntos', 'statement-credit': 'Abono a la deuda', 'store-credit': 'Saldo de uso restringido' };
  const kinds = { ongoing: 'Beneficio habitual', welcome: 'Beneficio de bienvenida', temporary: 'Beneficio temporal' };
  const statuses = { verified: 'Reglas documentadas', conflict: 'Condiciones con discrepancias', incomplete: 'Condiciones incompletas' };
  const type = reward.originalType || reward.type;
  return [
    types[type] || 'Tipo de beneficio por confirmar',
    ...(kinds[program.kind] ? [kinds[program.kind]] : []),
    reward.redemptionSummary || 'Canje por documentar.',
    statuses[program.status] || 'Estado de las reglas por confirmar',
    `Consulta: ${formatCatalogDate(program.reviewedOn)}.`,
    ...(isCatalogDate(program.validFrom) ? [`Inicio publicado: ${formatCatalogDate(program.validFrom)}.`] : []),
    isCatalogDate(program.validThrough) ? `Vigencia publicada hasta ${formatCatalogDate(program.validThrough)}.` : 'Fecha de fin de vigencia no documentada.',
  ];
}

export function localCatalogDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function isCatalogDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatCatalogDate(value) {
  if (!isCatalogDate(value)) return 'Por verificar';
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Publication dates establish the scope of a quoted cost, never an individual offer.
export function datedCostStatus(cost = {}, today = localCatalogDate()) {
  if (!isCatalogDate(today) || !isCatalogDate(cost.validThrough)) {
    return { code: 'unknown', label: 'Vigencia por verificar', detail: 'La fuente no permite confirmar una vigencia actual.' };
  }
  if (cost.validThrough < today) {
    return { code: 'expired', label: 'Vigencia vencida', detail: `Vigente hasta ${formatCatalogDate(cost.validThrough)}. Es un dato publicado, no una condición actual confirmada.` };
  }
  if (isCatalogDate(cost.asOf) && cost.asOf > today) {
    return { code: 'future', label: 'Fecha de publicación futura', detail: `La ficha indica ${formatCatalogDate(cost.asOf)}; verifica este dato con el emisor.` };
  }
  return { code: 'dated', label: 'Dentro de vigencia publicada', detail: `Vigencia publicada hasta ${formatCatalogDate(cost.validThrough)}.` };
}

export function annualFeeClass(fee = {}) {
  return ANNUAL_FEE_FILTERS.some(option => option.value !== 'all' && option.value === fee.classification)
    ? fee.classification : 'unknown';
}

export function sortCatalogEntries(entries = []) {
  return [...entries].sort((a, b) => collator.compare(a.name || '', b.name || '')
    || collator.compare(a.issuer || '', b.issuer || '') || collator.compare(a.id || '', b.id || ''));
}

export function enrichCatalogEntries(identified = [], detailed = []) {
  const sheets = new Map(detailed.map(entry => [entry.id, entry]));
  const merged = new Map(identified.map(entry => {
    const sheet = sheets.get(entry.id);
    return [entry.id, {
      ...entry, ...sheet, hasDetailedSheet: Boolean(sheet),
      aliases: [...new Set([...(sheet && entry.name !== sheet.name ? [entry.name] : []), ...(entry.aliases || []), ...(sheet?.aliases || [])])],
      evidence: [...(entry.evidence || []), ...(sheet?.evidence || [])],
      limitations: [...new Set([...(entry.limitations || []), ...(sheet?.limitations || [])])],
    }];
  }));
  for (const entry of detailed) if (!merged.has(entry.id)) merged.set(entry.id, { ...entry, hasDetailedSheet: true });
  return sortCatalogEntries([...merged.values()]);
}

export function filterCreditCards(cards = [], { query = '', issuer = 'all', annualFee = 'all', productType = 'all', information = 'all', programs = [] } = {}) {
  const terms = normalizeCatalogSearch(query).split(/\s+/).filter(Boolean);
  const ruleCardIds = new Set(programs.map(program => program.cardId));
  return sortCatalogEntries(cards.filter(card => {
    const searchable = normalizeCatalogSearch(`${card.name || ''} ${card.issuer || ''} ${(card.aliases || []).join(' ')}`);
    return terms.every(term => searchable.includes(term))
      && (issuer === 'all' || card.issuer === issuer)
      && (annualFee === 'all' || annualFeeClass(card.costs?.annualFee) === annualFee)
      && (productType === 'all' || (card.productType || 'unknown') === productType)
      && (information === 'all' || (information === 'costs' && hasDocumentedCosts(card))
        || (information === 'benefits' && hasDocumentedBenefits(card, programs))
        || (information === 'sheet' && card.hasDetailedSheet === true) || (information === 'rules' && ruleCardIds.has(card.id)));
  }));
}

export function filterCreditLoans(loans = [], { query = '', issuer = 'all', familyId = 'all', information = 'all' } = {}) {
  const terms = normalizeCatalogSearch(query).split(/\s+/).filter(Boolean);
  return sortCatalogEntries(loans.filter(loan => {
    const searchable = normalizeCatalogSearch(`${loan.name || ''} ${loan.issuer || ''} ${(loan.aliases || []).join(' ')}`);
    return terms.every(term => searchable.includes(term))
      && (issuer === 'all' || loan.issuer === issuer)
      && (familyId === 'all' || loan.familyId === familyId)
      && (information === 'all' || (information === 'costs' && hasDocumentedCosts(loan)));
  }));
}

export function catalogPage(entries, visibleCount = 12) {
  const count = Number.isInteger(visibleCount) && visibleCount > 0 ? visibleCount : 12;
  return { entries: entries.slice(0, count), remaining: Math.max(0, entries.length - count) };
}

export function catalogIssuers(cards = []) {
  return [...new Set(cards.map(card => card.issuer).filter(Boolean))].sort(collator.compare);
}

export function toggleCardComparison(selectedIds, id) {
  if (selectedIds.includes(id)) return { ids: selectedIds.filter(selectedId => selectedId !== id), reason: null };
  if (selectedIds.length >= COMPARISON_LIMIT) return { ids: [...selectedIds], reason: 'limit' };
  return { ids: [...selectedIds, id], reason: null };
}

export function selectedCreditCards(cards, selectedIds) {
  const byId = new Map(cards.map(card => [card.id, card]));
  return selectedIds.map(id => byId.get(id)).filter(Boolean);
}

export function sourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function verifiedSources(sources) {
  const seen = new Set();
  return sources.flatMap(source => {
    const url = sourceUrl(source?.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ title: source.title || 'Fuente del emisor', url }];
  });
}

export function catalogSources(entry = {}) {
  const fieldSources = Object.values(entry.costs || {}).flatMap(cost => Array.isArray(cost?.sources) ? cost.sources : []);
  return verifiedSources([{ title: 'Ficha del emisor', url: entry.canonicalUrl }, ...(entry.evidence || []), ...fieldSources]);
}

export function costSources(cost = {}, entry = {}) {
  if (cost?.sources == null || (Array.isArray(cost.sources) && cost.sources.length === 0)) return catalogSources(entry);
  // Invalid field evidence must not silently attribute the quoted figure to a different document.
  return verifiedSources(Array.isArray(cost.sources) ? cost.sources : []);
}

export function annualFeeLines(fee = {}, today = localCatalogDate()) {
  return [
    validCatalogNumber(fee.amount) === null ? fee.publishedText?.trim() || 'Por verificar' : `${formatCatalogMoney(fee.amount)}/año`,
    fee.taxTreatment || 'Tratamiento de IVA por verificar.',
    fee.conditions || 'Condiciones por verificar en la fuente del emisor.',
    ...feeDateLines(fee, today),
  ];
}

export function periodicFeeLines(fee = {}, today = localCatalogDate()) {
  const value = openingFeeLines(fee)[0];
  const periods = { monthly: 'mes', annual: 'año' };
  return [
    validCatalogNumber(fee.amount) === null ? fee.publishedText?.trim() || 'Cargo periódico sin dato documentado'
      : `${value}${periods[fee.frequency] ? `/${periods[fee.frequency]}` : ' · periodicidad por verificar'}`,
    fee.taxTreatment || 'Tratamiento de IVA por verificar.',
    fee.conditions || 'Condiciones por verificar en la fuente del emisor.',
    ...(validCatalogNumber(fee.amount) === null && hasPublishedFee(fee) ? [`Periodicidad: ${{ monthly: 'mensual', annual: 'anual' }[fee.frequency] || 'por verificar'}.`] : []),
    ...feeDateLines(fee, today),
  ];
}

function feeDateLines(fee, today) {
  if (!fee.asOf && !fee.validThrough) return [];
  return [
    ...(fee.asOf ? [`Fecha de cálculo: ${formatCatalogDate(fee.asOf)}.`] : []),
    datedCostStatus(fee, today).detail,
  ];
}

export function datedCostLines(cost = {}, today = localCatalogDate()) {
  const status = datedCostStatus(cost, today);
  return [
    formatCatalogRate(cost),
    ...(cost.type ? [`Tipo de tasa: ${cost.type}.`] : []),
    ...(cost.basis ? [cost.basis] : []),
    ...(cost.taxTreatment ? [cost.taxTreatment] : []),
    ...(cost.conditions ? [cost.conditions] : []),
    `Fecha de cálculo: ${formatCatalogDate(cost.asOf)}.`,
    status.label,
    status.detail,
  ];
}

export function openingFeeLines(fee = {}, today = localCatalogDate()) {
  const amount = validCatalogNumber(fee.amount);
  const unit = fee.unit || '';
  const percentageUnit = ['%', 'percent', 'percentage', 'porcentaje'].includes(unit.toLocaleLowerCase('es-MX'));
  const value = amount === null ? fee.publishedText?.trim() || 'Por verificar' : percentageUnit ? formatCatalogPercent(amount)
    : unit.toUpperCase() === 'MXN' ? formatCatalogMoney(amount) : `${decimal.format(amount)} ${unit || '· unidad por verificar'}`;
  return [value, fee.taxTreatment || 'Tratamiento de IVA por verificar.', fee.conditions || 'Condiciones por verificar en la fuente del emisor.', ...feeDateLines(fee, today)];
}

const verifiedLines = values => Array.isArray(values) && values.length ? [...values] : ['Por verificar en la fuente del emisor.'];
const comparisonCostLines = (known, lines) => known ? lines : ['Sin dato documentado', ...lines.slice(1)];

export function buildCardComparison(cards, selectedIds, today = localCatalogDate(), programs = []) {
  const entries = selectedCreditCards(cards, selectedIds);
  const definitions = [
    ['annualFee', 'Anualidad y condiciones', card => comparisonCostLines(hasPublishedFee(card.costs?.annualFee), annualFeeLines(card.costs?.annualFee, today))],
    ['cat', 'CAT promedio publicado', card => comparisonCostLines(hasCatalogRate(card.costs?.cat), datedCostLines(card.costs?.cat, today))],
    ['interestRate', 'Tasa ordinaria publicada', card => [card.costs?.interestRate?.label || 'Tipo de tasa por verificar.', ...comparisonCostLines(hasCatalogRate(card.costs?.interestRate), datedCostLines(card.costs?.interestRate, today))]],
    ['maintenanceFee', 'Cargos periódicos publicados', card => [card.costs?.maintenanceFee?.label || 'Cargo periódico', ...comparisonCostLines(hasPublishedFee(card.costs?.maintenanceFee), periodicFeeLines(card.costs?.maintenanceFee, today))]],
    ['optionalSubscriptionFee', 'Membresía opcional', card => [card.costs?.optionalSubscriptionFee?.label || 'Membresía opcional', ...comparisonCostLines(hasPublishedFee(card.costs?.optionalSubscriptionFee), periodicFeeLines(card.costs?.optionalSubscriptionFee, today))]],
    ['openingFee', 'Comisión de apertura', card => comparisonCostLines(hasPublishedFee(card.costs?.openingFee), openingFeeLines(card.costs?.openingFee, today))],
    ['benefits', 'Beneficios y canje publicados', card => {
      const lines = [...catalogBenefitStrings(card), ...catalogBenefitPrograms(card.id, programs).flatMap(program => [program.name, program.summary, ...benefitProgramMetadata(program)])];
      return lines.length ? lines : ['Beneficios aún por documentar; esto no significa que el producto no los tenga.'];
    }],
    ['requirements', 'Requisitos publicados', card => verifiedLines(card.requirements)],
    ['otherFees', 'Otros costos', card => verifiedLines(card.otherFees)],
    ['limitations', 'Notas y condiciones', card => verifiedLines(card.limitations)],
    ['sources', 'Fuentes y fecha de consulta', card => [`Consulta: ${formatCatalogDate(card.consultedOn)}.`]],
  ];
  return {
    entries,
    rows: definitions.map(([id, label, values]) => ({ id, label, values: entries.map(card => ({
      cardId: card.id, productName: card.name, lines: values(card),
      sources: ['annualFee', 'cat', 'interestRate', 'maintenanceFee', 'optionalSubscriptionFee', 'openingFee'].includes(id) ? costSources(card.costs?.[id], card)
        : id === 'benefits' ? verifiedSources([...catalogSources(card), ...catalogBenefitPrograms(card.id, programs).flatMap(program => program.sources || [])]) : catalogSources(card),
    })) })),
  };
}
