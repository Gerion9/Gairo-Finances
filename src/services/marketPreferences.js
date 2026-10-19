const SELECTION_VERSION = 1;
const LIMITS = { ownedCardIds: 500, savingsProductIds: 3 };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function emptyMarketSelections() {
  return { version: SELECTION_VERSION, ownedCardIds: [], savingsProductIds: [] };
}

function normalizeIds(value, key) {
  if (!Array.isArray(value)) throw new Error('La selección de productos debe ser una lista.');
  const ids = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !id.trim() || id.length > 120) throw new Error('La selección contiene un identificador de producto inválido.');
    if (!seen.has(id)) { seen.add(id); ids.push(id); }
  }
  if (ids.length > LIMITS[key]) throw new Error(key === 'savingsProductIds' ? 'Puedes seleccionar hasta tres productos de ahorro.' : 'La selección de tarjetas supera el límite permitido.');
  return ids;
}

export function normalizeMarketSelections(value) {
  if (value === undefined) return emptyMarketSelections();
  if (!record(value) || value.version !== SELECTION_VERSION) throw new Error('La versión de las selecciones de productos no es compatible.');
  if (Object.keys(value).some(key => !['version', 'ownedCardIds', 'savingsProductIds'].includes(key))) throw new Error('Las selecciones de productos contienen campos no admitidos.');
  return {
    version: SELECTION_VERSION,
    ownedCardIds: normalizeIds(value.ownedCardIds, 'ownedCardIds'),
    savingsProductIds: normalizeIds(value.savingsProductIds, 'savingsProductIds'),
  };
}

export function updateMarketSelections(data, patch) {
  if (!record(data) || (data.preferences !== undefined && !record(data.preferences))) throw new Error('Las preferencias del espacio no son válidas.');
  if (!record(patch) || Object.keys(patch).some(key => !Object.hasOwn(LIMITS, key))) throw new Error('El cambio sólo puede incluir selecciones de tarjetas o ahorro.');
  const preferences = data.preferences || {};
  const current = normalizeMarketSelections(preferences.marketSelections);
  if (!Object.keys(patch).length) return data;
  const marketSelections = normalizeMarketSelections({ ...current, ...patch });
  return { ...data, preferences: { ...preferences, marketSelections } };
}
