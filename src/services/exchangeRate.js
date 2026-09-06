// Servicio de tipo de cambio en tiempo real USD/MXN con caché y modo manual

const CACHE_KEY = 'gairo_fx_rate';
const CACHE_TIME_KEY = 'gairo_fx_timestamp';
const MANUAL_KEY = 'gairo_fx_manual';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutos

export const DEFAULT_USD_MXN = 19.25;

export async function fetchExchangeRate(forceRefresh = false) {
  // Verificar si el usuario configuró un tipo de cambio manual
  const manual = localStorage.getItem(MANUAL_KEY);
  if (manual) {
    const parsedManual = parseFloat(manual);
    if (!isNaN(parsedManual) && parsedManual > 0) {
      return {
        rate: parsedManual,
        isManual: true,
        lastUpdated: new Date(parseInt(localStorage.getItem(CACHE_TIME_KEY) || Date.now())),
        source: 'Personalizado (Manual)'
      };
    }
  }

  // Verificar caché
  const cachedRate = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
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
        localStorage.setItem(CACHE_KEY, rate.toString());
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
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
        localStorage.setItem(CACHE_KEY, rate.toString());
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
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

export function setManualExchangeRate(rate) {
  if (rate === null || rate === undefined || rate === '' || isNaN(rate) || rate <= 0) {
    localStorage.removeItem(MANUAL_KEY);
  } else {
    localStorage.setItem(MANUAL_KEY, parseFloat(rate).toString());
  }
  localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
}

export function getManualExchangeRate() {
  const m = localStorage.getItem(MANUAL_KEY);
  return m ? parseFloat(m) : null;
}

// Conversiones
export function convertCurrency(amount, fromCurrency, toCurrency, rate) {
  if (!amount || isNaN(amount)) return 0;
  if (fromCurrency === toCurrency) return amount;
  if (fromCurrency === 'USD' && toCurrency === 'MXN') {
    return amount * rate;
  }
  if (fromCurrency === 'MXN' && toCurrency === 'USD') {
    return amount / rate;
  }
  return amount;
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
