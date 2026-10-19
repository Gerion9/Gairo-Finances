export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim().replace(/\s+/g, ' ');

/** An exact destination name comes before incidental matches in descriptions. */
export function searchNavigationItems(items, query) {
  const normalized = normalizeSearch(query);
  const terms = normalized.split(' ').filter(Boolean);
  return items.map((item, index) => {
    const label = normalizeSearch(item.label);
    const keywords = normalizeSearch(item.keywords);
    const content = normalizeSearch([item.label, item.description, item.group, item.keywords].filter(Boolean).join(' '));
    const matches = terms.every(term => content.includes(term));
    const rank = !normalized ? 0 : label === normalized ? 4 : label.startsWith(normalized) ? 3
      : label.includes(normalized) ? 2 : terms.every(term => label.includes(term) || keywords.includes(term)) ? 1 : 0;
    return { item, index, matches, rank };
  }).filter(result => result.matches).sort((a, b) => b.rank - a.rank || a.index - b.index).map(result => result.item);
}
