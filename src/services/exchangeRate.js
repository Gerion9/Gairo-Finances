// Servicio de tipo de cambio en tiempo real USD/MXN con caché y modo manual

const CACHE_KEY = 'gairo_fx_rate';
const CACHE_TIME_KEY = 'gairo_fx_timestamp';
const localCache = { getItem(key) { try { return globalThis.localStorage.getItem(key); } catch { return null; } }, setItem(key, value) { try { globalThis.localStorage.setItem(key, value); } catch { /* public cache optional */ } } };
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutos

export const DEFAULT_USD_MXN = 19.25;

export async function fetchExchangeRate(forceRefresh = false, preference = {}) {
  // Verificar si el usuario configuró un tipo de cambio manual
  const manual = preference.manualRate;
  if (manual) {
    const parsedManual = parseFloat(manual);
    if (!isNaN(parsedManual) && parsedManual > 0) {
      return {
        rate: parsedManual,
        isManual: true,
        lastUpdated: preference.manualRateUpdatedAt ? new Date(preference.manualRateUpdatedAt) : null,
        source: 'Personalizado (Manual)'
      };
    }
  }

  // Verificar caché
  const cachedRate = localCache.getItem(CACHE_KEY);
  const cachedTime = localCache.getItem(CACHE_TIME_KEY);
  const now = Date.now();

  if (!forceRefresh && cachedRate && cachedTime && (now - parseInt(cachedTime) < CACHE_DURATION_MS)) {
    return {
      rate: parseFloat(cachedRate),
      isManual: false,
      lastUpdated: new Date(parseInt(cachedTime)),
      source: 'Caché local'
    };
  }

  // Intentar API 1: open.er-api.com
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates.MXN) {
        const rate = parseFloat(data.rates.MXN.toFixed(4));
        localCache.setItem(CACHE_KEY, rate.toString());
        localCache.setItem(CACHE_TIME_KEY, now.toString());
        return {
          rate,
          isManual: false,
          lastUpdated: new Date(now),
          source: 'Mercado en vivo (Open ER API)'
        };
      }
    }
  } catch (err) {
    console.warn('Fallo al consultar Open ER API:', err);
  }

  // Intentar API 2 fallback: frankfurter.app
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates.MXN) {
        const rate = parseFloat(data.rates.MXN.toFixed(4));
        localCache.setItem(CACHE_KEY, rate.toString());
        localCache.setItem(CACHE_TIME_KEY, now.toString());
        return {
          rate,
          isManual: false,
          lastUpdated: new Date(now),
          source: 'Mercado en vivo (Frankfurter)'
        };
      }
    }
  } catch (err) {
    console.warn('Fallo al consultar Frankfurter API:', err);
  }

  // Fallback si no hay internet o fallaron ambas APIs
  const fallbackRate = cachedRate ? parseFloat(cachedRate) : DEFAULT_USD_MXN;
  return {
    rate: fallbackRate,
    isManual: false,
    lastUpdated: cachedTime ? new Date(parseInt(cachedTime)) : new Date(),
    source: cachedRate ? 'Caché previo' : 'Tasa base de contingencia'
  };
}

// Conversiones
export function convertCurrency(amount, fromCurrency, toCurrency, rate) {
  const numAmount = Number(amount);
  if (!numAmount || isNaN(numAmount)) return 0;
  if (fromCurrency === toCurrency) return numAmount;
  
  const effectiveRate = Number(rate) > 0 ? Number(rate) : DEFAULT_USD_MXN;
  if (fromCurrency === 'USD' && toCurrency === 'MXN') {
    return numAmount * effectiveRate;
  }
  if (fromCurrency === 'MXN' && toCurrency === 'USD') {
    return numAmount / effectiveRate;
  }
  return numAmount;
}

// Formateo visual
export function formatMoney(amount, currency = 'MXN') {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  const prefix = currency === 'USD' ? 'US$' : '$';
  return `${prefix}${Number(amount).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
