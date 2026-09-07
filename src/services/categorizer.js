// src/services/categorizer.js
// Clasificador automático semántico de comercios y gastos en México

const MERCHANT_RULES = [
  // Supermercado / Despensa
  { pattern: /walmart|bodega aurrera|soriana|chedraui|costco|sam's|sams|la comer|city market|heb|superama|super san francisco|calimax/i, category: 'Supermercado', isEssential: true },
  
  // Tiendas de conveniencia / Gastos Hormiga
  { pattern: /oxxo|7-eleven|seven eleven|circle k|extra|tiendas bara|asturiano|kiosko/i, category: 'Gastos Hormiga', isEssential: false },
  
  // Transporte y Combustible
  { pattern: /gasolin|pemex|shell|bp |repsol|mobil|g500|total gas|hidrosina|valero/i, category: 'Transporte / Gasolina', isEssential: true },
  { pattern: /uber|didi|cabify|metro |metrobus|ecobici|estacionamiento|peaje|tag|pase/i, category: 'Transporte / Gasolina', isEssential: true },
  
  // Comida fuera / Restaurantes / Café
  { pattern: /starbucks|cielito|the italian coffee|timmys|tim hortons|cafe |cafeteria/i, category: 'Gastos Hormiga', isEssential: false },
  { pattern: /uber eats|didi food|rappi|domino's|dominos|little caesars|mcdonald|kfc|burger king|carl's jr|vips|toks|sanborns|taqueria|tacos/i, category: 'Restaurantes', isEssential: false },
  
  // Vivienda y Servicios Fijos
  { pattern: /cfe |luz |agua |sacmex|gas natural|naturgy|gas lp/i, category: 'Servicios Fijos', isEssential: true },
  { pattern: /telmex|infinitum|izzi|totalplay|megacable|at&t|telcel|movistar/i, category: 'Servicios Fijos', isEssential: true },
  { pattern: /renta|mantenimiento edificio|predial/i, category: 'Renta / Vivienda', isEssential: true },

  // Salud, Farmacia y Deducibles SAT
  { pattern: /farmacia|san pablo|guadalajara|benavides|del ahorro|fahorro|similares|dr\. simi/i, category: 'Salud / Farmacia', isEssential: true, isDeductible: true },
  { pattern: /hospital|medico|doctor|dental|dentista|oftalm|optica|laboratorio|chopo|salud digna/i, category: 'Salud / Farmacia', isEssential: true, isDeductible: true },
  
  // Mascotas
  { pattern: /petco|petzer|veterinaria|veterinario|purina|pedigree|croquetas|toto/i, category: 'Mascotas', isEssential: true },
  
  // Suscripciones y Entretenimiento
  { pattern: /netflix|spotify|disney|hbo|max|prime video|amazon prime|youtube|apple\.com|icloud|playstation|xbox|nintendo/i, category: 'Suscripciones', isEssential: false },
  
  // Compras generales / Ecommerce
  { pattern: /amazon|mercado libre|mercadolibre|liverpool|palacio de hierro|sears|coppel|elektra|zara|h&m/i, category: 'Compras Personales', isEssential: false },
  
  // Fiscal / SAT
  { pattern: /sat |tesoreria|impuestos|pago provisional|multa fiscal/i, category: 'Impuestos SAT', isEssential: true }
];

/**
 * Sugiere la categoría y deduce si un gasto es esencial o deducible ante el SAT
 */
export function categorizeExpense(description) {
  if (!description || typeof description !== 'string') {
    return { category: 'Otros', isEssential: false, isDeductible: false };
  }

  const clean = description.trim();
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(clean)) {
      return {
        category: rule.category,
        isEssential: rule.isEssential,
        isDeductible: !!rule.isDeductible
      };
    }
  }

  return {
    category: 'Varios',
    isEssential: false,
    isDeductible: false
  };
}

/**
 * Detecta si dos transacciones son duplicadas
 */
export function isDuplicateTransaction(t1, t2) {
  if (!t1 || !t2) return false;
  if (t1.id && t2.id && t1.id === t2.id) return false; // Misma transacción existente
  
  // Monto idéntico
  const sameAmount = Math.abs(Number(t1.monto) - Number(t2.monto)) < 0.01;
  if (!sameAmount) return false;

  // Fechas dentro de +/- 2 días
  const d1 = new Date(t1.fecha).getTime();
  const d2 = new Date(t2.fecha).getTime();
  const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  if (daysDiff > 2) return false;

  // Concepto similar
  const c1 = (t1.concepto || '').toLowerCase().trim();
  const c2 = (t2.concepto || '').toLowerCase().trim();
  if (c1 === c2) return true;
  if (c1.includes(c2) || c2.includes(c1)) return true;

  return false;
}
