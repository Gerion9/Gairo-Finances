import { formatCatalogDate, isCatalogDate, localCatalogDate, normalizeCatalogSearch } from './creditCatalog.js';

const collator = new Intl.Collator('es-MX', { sensitivity: 'base', numeric: true });
const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 20 });
export const SAVINGS_COMPARISON_LIMIT = 3;
export const SAVINGS_LIQUIDITY_FILTERS = [
  { value: 'all', label: 'Toda disponibilidad' },
  { value: 'demand', label: 'A la vista' },
  { value: 'term', label: 'A plazo' },
  { value: 'mixed', label: 'Combinada' },
  { value: 'unknown', label: 'Por documentar' },
];
export const SAVINGS_RETURN_NATURE = {
  base: 'Base', promotion: 'Promoción', gat: 'GAT', historical: 'Histórico',
};

export function savingsSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function verifiedSources(sources) {
  const seen = new Set();
  return sources.flatMap(source => {
    const url = savingsSourceUrl(source?.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ title: source.title || 'Fuente del producto', url }];
  });
}

export function savingsSources(product = {}) {
  return verifiedSources([
    { title: 'Ficha del producto', url: product.canonicalUrl }, ...(product.evidence || []),
    ...(product.returns || []).flatMap(observation => observation.sources || []), ...(product.protection?.sources || []),
  ]);
}

export function savingsReturnSources(observation = {}, product = {}) {
  if (observation.sources == null || (Array.isArray(observation.sources) && !observation.sources.length)) return savingsSources(product);
  return verifiedSources(Array.isArray(observation.sources) ? observation.sources : []);
}

export function formatSavingsReturn(observation = {}) {
  if (typeof observation.percent !== 'number' || !Number.isFinite(observation.percent)) return 'Por verificar';
  return `${number.format(observation.percent)} ${observation.unit || '· unidad por verificar'}`;
}

export function savingsReturnStatus(observation = {}, today = localCatalogDate()) {
  if (!isCatalogDate(today) || !isCatalogDate(observation.validThrough)) {
    return { code: 'unknown', label: 'Vigencia por verificar', detail: 'La fecha de consulta no confirma una vigencia actual.' };
  }
  if (observation.validThrough < today) {
    return { code: 'expired', label: 'Vigencia vencida', detail: `Vigente hasta ${formatCatalogDate(observation.validThrough)}. Dato publicado; no es una condición actual confirmada.` };
  }
  if (isCatalogDate(observation.asOf) && observation.asOf > today) {
    return { code: 'future', label: 'Fecha de referencia futura', detail: `La fuente indica ${formatCatalogDate(observation.asOf)}; verifica esta observación.` };
  }
  return { code: 'dated', label: 'Dentro de vigencia publicada', detail: `Vigencia publicada hasta ${formatCatalogDate(observation.validThrough)}.` };
}

export function orderedSavingsReturns(observations = []) {
  const order = { base: 0, promotion: 1, gat: 2, historical: 3 };
  return observations.map((observation, index) => ({ observation, index }))
    .sort((a, b) => (order[a.observation.nature] ?? 4) - (order[b.observation.nature] ?? 4) || a.index - b.index)
    .map(({ observation }) => observation);
}

// Preserve the source order within each kind; a larger percentage never gains priority.
export function previewSavingsReturns(observations = [], today = localCatalogDate()) {
  const ordered = orderedSavingsReturns(observations);
  const core = ordered.filter(observation => ['base', 'promotion'].includes(observation.nature));
  const current = core.filter(observation => ['dated', 'unknown'].includes(savingsReturnStatus(observation, today).code));
  const candidates = current.length ? current : core.length ? core : ordered;
  const base = candidates.find(observation => observation.nature === 'base');
  const promotion = candidates.find(observation => observation.nature === 'promotion');
  return base && promotion ? [base, promotion] : candidates.slice(0, 2);
}

export const SAVINGS_RETURN_GROUPS = [
  { id: 'returns-base', label: 'Rendimiento base' },
  { id: 'returns-promotion', label: 'Promociones' },
  { id: 'returns-gat-nominal', label: 'GAT nominal' },
  { id: 'returns-gat-real', label: 'GAT real' },
  { id: 'returns-historical', label: 'Rendimiento histórico' },
  { id: 'returns-other', label: 'Otros rendimientos documentados' },
];

export function savingsReturnGroup(observation = {}) {
  if (observation.nature === 'gat') {
    if (observation.unit === '% GAT nominal') return 'returns-gat-nominal';
    if (observation.unit === '% GAT real') return 'returns-gat-real';
    return 'returns-other';
  }
  return ({ base: 'returns-base', promotion: 'returns-promotion', historical: 'returns-historical' })[observation.nature] || 'returns-other';
}

export function filterSavingsProducts(products = [], { query = '', productType = 'all', liquidity = 'all', information = 'all' } = {}) {
  const terms = normalizeCatalogSearch(query).split(/\s+/).filter(Boolean);
  return [...products].filter(product => {
    const searchable = normalizeCatalogSearch(`${product.name || ''} ${product.issuer || ''} ${product.legalIssuer || ''} ${(product.aliases || []).join(' ')}`);
    return terms.every(term => searchable.includes(term))
      && (productType === 'all' || (product.productType || 'unknown') === productType)
      && (liquidity === 'all' || (product.liquidity?.category || 'unknown') === liquidity)
      && (information === 'all' || (information === 'sheet' && product.hasDetailedSheet === true) || (information === 'identified' && !product.hasDetailedSheet));
  }).sort((a, b) => collator.compare(a.name || '', b.name || '') || collator.compare(a.issuer || '', b.issuer || '') || collator.compare(a.id, b.id));
}

export function toggleSavingsComparison(selectedIds, id) {
  if (selectedIds.includes(id)) return { ids: selectedIds.filter(value => value !== id), reason: null };
  if (selectedIds.length >= SAVINGS_COMPARISON_LIMIT) return { ids: [...selectedIds], reason: 'limit' };
  return { ids: [...selectedIds, id], reason: null };
}

export function selectedSavingsProducts(products, selectedIds) {
  const byId = new Map(products.map(product => [product.id, product]));
  return selectedIds.map(id => byId.get(id) || {
    id, name: 'Producto ya no disponible en el catálogo', unavailable: true,
    availability: 'Este producto seleccionado ya no está disponible en el catálogo actual.',
  });
}

const documentedLines = values => values?.length ? [...values] : ['Por documentar en la fuente del producto.'];

export function savingsReturnLines(observation, today = localCatalogDate()) {
  const status = savingsReturnStatus(observation, today);
  return [observation.label || 'Rendimiento publicado', formatSavingsReturn(observation),
    SAVINGS_RETURN_NATURE[observation.nature] || 'Carácter por verificar', observation.rateType || 'Tipo de rendimiento por verificar',
    observation.conditions || 'Condiciones por verificar.', `Referencia: ${formatCatalogDate(observation.asOf)}.`, status.label, status.detail];
}

export function buildSavingsComparison(products, selectedIds, today = localCatalogDate()) {
  const entries = selectedSavingsProducts(products, selectedIds);
  const definitions = [
    ['liquidity', 'Disponibilidad y plazo', product => [product.liquidity?.summary || 'Disponibilidad por documentar.', product.availability || 'Estado de contratación por confirmar.']],
    ['amounts', 'Montos', product => documentedLines(product.amounts)],
    ['fees', 'Costos y membresía', product => documentedLines(product.fees)],
    ['requirements', 'Requisitos', product => documentedLines(product.requirements)],
    ['protection', 'Protección', product => [product.protection?.label || 'Protección por documentar.', product.protection?.summary || 'Consulta el alcance y las condiciones en la fuente del producto.']],
    ...SAVINGS_RETURN_GROUPS.map(group => [group.id, group.label, product => {
      const observations = orderedSavingsReturns(product.returns || []).filter(observation => savingsReturnGroup(observation) === group.id);
      return observations.length ? observations.flatMap(observation => savingsReturnLines(observation, today)) : ['Sin observaciones documentadas para este concepto. No significa un rendimiento de cero.'];
    }]),
    ['type', 'Tipo de producto', product => [product.productType || 'Por documentar']],
    ['entity', 'Entidad', product => [...new Set([product.issuer || 'Por documentar', product.legalIssuer || 'Entidad legal por documentar'])]],
    ['sources', 'Fechas y fuentes', product => [`Consulta: ${formatCatalogDate(product.consultedOn)}.`]],
  ];
  return { entries, rows: definitions.map(([id, label, lines]) => ({ id, label, values: entries.map(product => ({
    productId: product.id, productName: product.name, lines: lines(product), sources: savingsSources(product),
    observations: id.startsWith('returns-') ? orderedSavingsReturns(product.returns || []).filter(observation => savingsReturnGroup(observation) === id) : undefined,
  })) })) };
}
