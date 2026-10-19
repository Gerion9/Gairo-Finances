const statuses = new Set(['available', 'stale', 'unavailable', 'invalid', 'upcoming']);
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function fetchPublicRates({ signal, forceRefresh = false, fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl('/api/reference-rates', {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { Accept: 'application/json', ...(forceRefresh ? { 'X-Sifran-Refresh': '1' } : {}) },
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('No se pudo consultar la referencia oficial.');
  const payload = await response.json();
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.series)) throw new Error('La referencia recibida no es válida.');
  const rate = payload.series.filter(item => item.id === 'cetes28');
  if (rate.length !== 1 || rate[0].unit !== 'annual_percent' || rate[0].termDays !== 28 || !statuses.has(rate[0].status) || rate[0].value !== null && !Number.isFinite(rate[0].value)) throw new Error('La referencia recibida no es válida.');
  if (['available', 'stale', 'upcoming'].includes(rate[0].status) && (rate[0].value === null || !validDate(rate[0].effectiveDate) || !Number.isFinite(Date.parse(rate[0].fetchedAt)))) throw new Error('La referencia recibida no es válida.');
  if (['unavailable', 'invalid'].includes(rate[0].status) && rate[0].value !== null) throw new Error('La referencia recibida no es válida.');
  return payload;
}
