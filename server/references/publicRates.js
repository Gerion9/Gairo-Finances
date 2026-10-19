// Public reference data only. No account or financial information is sent upstream.
const NS = Object.freeze({ rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', rss: 'http://purl.org/rss/1.0/', cb: 'http://staging.bis.org/rss-cb/1.0/', dc: 'http://purl.org/dc/elements/1.1/', xml: 'http://www.w3.org/XML/1998/namespace' });
const HOUR = 3_600_000;
const MAX_BYTES = 200_000;
const definitions = Object.freeze([
  { id: 'cetes28', label: 'CETES a 28 días', unit: 'annual_percent', termDays: 28, channel: 'cetes', type: 'interestRate', rateName: 'CETES28', maxAge: 14, ttl: 6 * HOUR, url: 'https://www.banxico.org.mx/SieInternet/consultarDirectorioInternetAction.do?accion=consultarCuadroAnalitico&idCuadro=CF107' },
  { id: 'usdMxnFix', label: 'Tipo de cambio FIX', unit: 'MXN_per_USD', channel: 'fix', type: 'exchangeRate', rateName: 'FIX', maxAge: 7, ttl: 6 * HOUR, url: 'https://www.banxico.org.mx/tipcamb/main.do?page=tip&idioma=sp' },
  { id: 'udi', label: 'Valor de la UDI', unit: 'MXN_per_UDI', channel: 'udis', type: 'otherStatistics', rateName: 'UDIS', maxAge: 2, ttl: 6 * HOUR, url: 'https://www.banxico.org.mx/portal-inflacion/' },
  { id: 'inflationAnnual', label: 'Inflación general anual', unit: 'year_over_year_percent', ttl: 24 * HOUR, url: 'https://www.inegi.org.mx/temas/inpc/' },
].map(def => Object.freeze({ ...def, dataUrl: def.channel ? `https://www.banxico.org.mx/rsscb/rss?BMXC_canal=${def.channel}&BMXC_idioma=es` : 'https://www.inegi.org.mx/servicios/xml/INPCA_M_O.xml' })));
const defaultCache = new Map();

class ReferenceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function reject(code = 'invalid_response') { throw new ReferenceError(code); }

function decodeEntities(value) {
  return value.replace(/&([^;]*);|&/g, (match, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, entity)) return named[entity];
    if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity || '')) reject();
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isSafeInteger(code) || code > 0x10ffff || code < 0x20 && ![9, 10, 13].includes(code) || code >= 0xd800 && code <= 0xdfff) reject();
    return String.fromCodePoint(code);
  });
}

// A deliberately small XML reader for the two fixed provider schemas. No DTD,
// entity declarations, external resources, or executable processing instructions.
function parseXml(xml) {
  if (typeof xml !== 'string' || xml.length > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)) reject();
  const source = xml.replace(/^\uFEFF/, '');
  const stack = [];
  let root = null;
  let count = 0;
  let position = 0;
  const tokens = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/g;
  for (const match of source.matchAll(tokens)) {
    if (match.index !== position) reject();
    const token = match[0];
    position += token.length;
    if (token.startsWith('<?')) {
      if (root || match.index !== 0 || !/^<\?xml\s[^?]*\?>$/.test(token)) reject();
      continue;
    }
    if (token.startsWith('<!--')) { if (token.slice(4, -3).includes('--')) reject(); continue; }
    if (token.startsWith('<![CDATA[')) {
      if (!stack.length) reject();
      stack.at(-1).text += token.slice(9, -3);
      continue;
    }
    if (token.startsWith('</')) {
      const end = /^<\/([A-Za-z_][\w.:-]*)\s*>$/.exec(token);
      if (!end || !stack.length || stack.pop().name !== end[1]) reject();
      continue;
    }
    if (token.startsWith('<')) {
      const open = /^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(token);
      if (!open || ++count > 5000 || stack.length >= 32) reject();
      const rawAttrs = [];
      let rest = open[2];
      while (rest.trim()) {
        const attr = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(rest);
        if (!attr || rawAttrs.some(([name]) => name === attr[1])) reject();
        rawAttrs.push([attr[1], decodeEntities(attr[2] ?? attr[3])]);
        rest = rest.slice(attr[0].length);
      }
      const namespaces = { ...(stack.at(-1)?.namespaces || { xml: NS.xml }) };
      for (const [key, value] of rawAttrs) {
        if (key === 'xmlns') namespaces[''] = value;
        else if (key.startsWith('xmlns:')) namespaces[key.slice(6)] = value;
      }
      function expanded(name, attribute = false) {
        const parts = name.split(':');
        if (parts.length > 2 || parts.length === 2 && !namespaces[parts[0]]) reject();
        return { local: parts.at(-1), uri: parts.length === 2 ? namespaces[parts[0]] : attribute ? '' : namespaces[''] || '' };
      }
      const attrs = rawAttrs.filter(([name]) => name !== 'xmlns' && !name.startsWith('xmlns:')).map(([name, value]) => ({ ...expanded(name, true), value }));
      if (new Set(attrs.map(attr => `${attr.uri}|${attr.local}`)).size !== attrs.length) reject();
      const node = { name: open[1], ...expanded(open[1]), namespaces, attrs, children: [], text: '' };
      if (stack.length) stack.at(-1).children.push(node);
      else if (root) reject();
      else root = node;
      if (!open[3]) stack.push(node);
      continue;
    }
    if (!stack.length) { if (token.trim()) reject(); }
    else stack.at(-1).text += decodeEntities(token);
  }
  if (position !== source.length || stack.length || !root) reject();
  return root;
}
const matches = (node, uri, local) => node.uri === uri && node.local === local;
function descendants(node, uri, local) {
  return node.children.flatMap(child => [...(matches(child, uri, local) ? [child] : []), ...descendants(child, uri, local)]);
}
function one(nodes) { if (nodes.length !== 1) reject(); return nodes[0]; }
function scalar(node) { if (node.children.length) reject(); return node.text.trim(); }
const field = (node, uri, local) => scalar(one(descendants(node, uri, local)));
function attribute(node, uri, local) { return one(node.attrs.filter(attr => attr.uri === uri && attr.local === local)).value; }
function number(value) {
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) reject();
  const result = Number(value);
  if (!Number.isFinite(result)) reject();
  return result;
}
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) reject();
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) reject();
  return value;
}
function timestamp(value) {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59 || Number(parts[6] || 0) > 14 || Number(parts[7] || 0) > 59 || Number(parts[6]) === 14 && Number(parts[7]) !== 0) reject();
  date(parts[1]);
  if (!Number.isFinite(Date.parse(value))) reject();
  return value;
}

function parseBanxico(root, def) {
  if (!matches(root, NS.rdf, 'RDF')) reject();
  const candidates = [];
  for (const item of root.children.filter(node => matches(node, NS.rss, 'item'))) {
    const containers = descendants(item, NS.cb, def.type);
    if (!containers.length) continue;
    const container = one(containers);
    if (field(container, NS.cb, 'rateName') !== def.rateName) continue;
    const value = number(field(container, NS.cb, 'value'));
    if (def.id !== 'cetes28' && value <= 0) reject();
    if (def.id === 'usdMxnFix' && (field(container, NS.cb, 'baseCurrency') !== 'USD' || field(container, NS.cb, 'targetCurrency') !== 'MXN')) reject();
    const title = field(item, NS.rss, 'title');
    const titleDates = title.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    const effectiveDate = date(one(titleDates));
    const about = attribute(item, NS.rdf, 'about');
    if (!about.endsWith(`/${effectiveDate.replaceAll('-', '')}`)) reject();
    if (!title.includes(def.rateName) || def.id === 'usdMxnFix' && !/MXN\s*=\s*1\s+USD/.test(title)) reject();
    candidates.push({ value, effectiveDate, period: null, publishedAt: timestamp(field(item, NS.dc, 'date')), publishedDate: null });
  }
  if (!candidates.length) reject('missing_series');
  candidates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  if (candidates.length > 1 && candidates[0].effectiveDate === candidates[1].effectiveDate) reject();
  return candidates[0];
}

function parseInegi(root) {
  if (!matches(root, '', 'DATASET')) reject();
  const metadata = one(root.children.filter(node => matches(node, '', 'METADATA')));
  const frequency = one(descendants(metadata, '', 'Freq').filter(node => node.attrs.some(attr => attr.uri === NS.xml && attr.local === 'lang' && attr.value === 'es')));
  if (field(metadata, '', 'Nemonic') !== 'INPCA_M_O' || scalar(frequency) !== 'Mensual') reject();
  const unit = one(descendants(metadata, '', 'Unit').filter(node => node.attrs.some(attr => attr.uri === NS.xml && attr.local === 'lang' && attr.value === 'es')));
  if (scalar(unit) !== 'Variación Porcentual') reject();
  const update = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(field(metadata, '', 'LastUpdate'));
  if (!update) reject();
  const publishedDate = date(`${update[3]}-${update[2]}-${update[1]}`);
  const series = one(root.children.filter(node => matches(node, '', 'SERIE')));
  const observations = series.children.filter(node => matches(node, '', 'Obs')).map(node => {
    const rawPeriod = attribute(node, '', 'TimePeriod');
    if (!/^\d{4}\/(0[1-9]|1[0-2])$/.test(rawPeriod)) reject();
    return { period: rawPeriod.replace('/', '-'), value: number(attribute(node, '', 'CurrentValue')) };
  }).sort((a, b) => b.period.localeCompare(a.period));
  if (!observations.length) reject('missing_series');
  if (observations.length > 1 && observations[0].period === observations[1].period) reject();
  return { ...observations[0], effectiveDate: null, publishedDate, publishedAt: null };
}

export function parsePublicRate(id, xml) {
  const def = definitions.find(item => item.id === id);
  if (!def) reject('unknown_series');
  const root = parseXml(xml);
  return def.channel ? parseBanxico(root, def) : parseInegi(root);
}

function mexicoDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const dayAge = (current, previous) => (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000;
function freshness(def, observation, now) {
  const today = mexicoDate(now);
  if (observation.effectiveDate) {
    const age = dayAge(today, observation.effectiveDate);
    if (age < 0) return 'upcoming';
    return age > def.maxAge ? 'stale' : 'available';
  }
  const [year, month] = observation.period.split('-').map(Number);
  const months = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - (year * 12 + month);
  if (observation.publishedDate > today || months < 0) return 'upcoming';
  return dayAge(today, observation.publishedDate) > 45 || months > 2 ? 'stale' : 'available';
}

async function download(def, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(def.dataUrl, { method: 'GET', redirect: 'error', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/xml, text/xml, application/rdf+xml' } });
    if (!response.ok) reject('upstream_unavailable');
    const declared = response.headers?.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) reject('response_too_large');
    if (!response.body?.getReader) reject();
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); reject('response_too_large'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parsePublicRate(def.id, new TextDecoder(def.channel ? 'iso-8859-1' : 'utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (controller.signal.aborted) reject('timeout');
    if (error instanceof ReferenceError) throw error;
    reject('upstream_unavailable');
  } finally { clearTimeout(timer); controller.abort(); }
}

function payload(def, entry, now, fromCache) {
  const observation = entry.good;
  return {
    id: def.id, label: def.label, value: observation?.value ?? null, unit: def.unit,
    ...(def.termDays ? { termDays: def.termDays } : {}),
    effectiveDate: observation?.effectiveDate ?? null, period: observation?.period ?? null,
    publishedAt: observation?.publishedAt ?? null, publishedDate: observation?.publishedDate ?? null,
    fetchedAt: entry.fetchedAt ?? null, lastAttemptAt: entry.lastAttemptAt ?? null,
    source: { name: def.channel ? 'Banco de México' : 'INEGI', url: def.url, dataUrl: def.dataUrl },
    status: observation ? entry.error ? 'stale' : freshness(def, observation, now) : ['invalid_response', 'missing_series', 'response_too_large'].includes(entry.error) ? 'invalid' : 'unavailable',
    error: entry.error ?? null, fromCache: fromCache || Boolean(entry.error && observation),
  };
}

// Inject a Map and clock for isolated tests; production shares one process cache.
export async function getPublicRates({ fetchImpl = globalThis.fetch, now = () => new Date(), cache = defaultCache, forceRefresh = false, timeoutMs = 8000 } = {}) {
  const time = new Date(now());
  if (!Number.isFinite(time.getTime())) throw new TypeError('Invalid reference clock');
  const timeout = Math.max(1, Math.min(8000, Number(timeoutMs) || 8000));
  const series = await Promise.all(definitions.map(async def => {
    let entry = cache.get(def.id);
    if (!entry) { entry = {}; cache.set(def.id, entry); }
    if (entry.pending) { await entry.pending; return payload(def, entry, time, true); }
    // Short failure cooldown prevents repeated upstream requests on unavailable data.
    const ttl = entry.error ? 60_000 : def.ttl;
    if (entry.lastAttemptMs !== undefined && time.getTime() >= entry.lastAttemptMs && time.getTime() - entry.lastAttemptMs < (forceRefresh ? 30_000 : ttl)) return payload(def, entry, time, true);
    entry.lastAttemptAt = time.toISOString();
    entry.lastAttemptMs = time.getTime();
    entry.pending = (async () => {
      try {
        entry.good = await download(def, fetchImpl, timeout);
        entry.fetchedAt = time.toISOString();
        entry.error = null;
      } catch (error) { entry.error = error instanceof ReferenceError ? error.code : 'upstream_unavailable'; }
    })();
    try { await entry.pending; } finally { delete entry.pending; }
    return payload(def, entry, time, false);
  }));
  return { schemaVersion: 1, series };
}
