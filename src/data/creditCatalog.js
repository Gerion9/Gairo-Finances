// Editorial snapshot verified against issuer documentation on 2026-10-18.
// Consultation is not a guarantee of current availability or individual terms.
// Never use these advertising observations to overwrite a user's contract.
import { additionalCardDetails } from './creditCardDetails.js';
import { additionalLoanOffers } from './loanOfferDetails.js';

const reviewedOn = '2026-10-18';
const observation = (percent, asOf, validThrough, status = 'documented') => ({ percent, asOf, validThrough, status, taxTreatment: 'Sin IVA' });
const rate = (percent, label, asOf = null, validThrough = null) => ({ percent, label, asOf, validThrough });
const evidence = (title, url) => ({ title, url });
const withCostSources = ({ costsSource, ...value }) => ({ ...value, costs: Object.fromEntries(Object.entries(value.costs).map(([key, cost]) => [key, { ...cost, sources: cost.sources || [costsSource || evidence('Costos publicados por el emisor', value.canonicalUrl)] }])) });
const card = value => ({ entryType: 'card', consultedOn: reviewedOn, currency: 'MXN', ...withCostSources(value) });
const offer = value => ({ consultedOn: reviewedOn, ...withCostSources(value) });
const family = value => ({
  entryType: 'loan-family', ...value,
  offers: [...(value.offers || []), ...additionalLoanOffers.filter(item => item.familyId === value.id).map(offer)],
});

const urls = {
  bbva: 'https://www.bbva.mx/personas/productos/tarjetas-de-credito/tarjeta-de-credito-azul.html',
  joy: 'https://www.banamex.com/personas/tarjetas-de-credito/tarjeta-joy-sin-anualidad',
  likeu: 'https://www.santander.com.mx/personas/credito-y-financiamiento/tarjetas-de-credito/likeu',
  likeuBrochure: 'https://assets.santandermedia.com/adobe/assets/urn:aaid:aem:eadbc941-a74c-4127-ac61-b4250eb85b52/original/as/Cards_Folleto_TDC_LikeUMastercard_Jun2026_V2_0726.pdf',
  hsbc: 'https://www.hsbc.com.mx/tarjetas-de-credito/productos/zero/',
  hsbcBrochure: 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/tarjetas/folleto_digital_zero.pdf',
  banorte: 'https://www.banorte.com/Personal/TDC/Clasica.html',
  banorteBrochure: 'https://www.banorte.com/dam/jcr:53a48148-c63e-446b-8d27-f8521310f4c0/Folleto%20Cl%C3%A1sica%20oct26.pdf',
  nu: 'https://nubank.com.mx/credito/',
  nuBrochure: 'https://cdn.nubank.com.mx/mex/credito/folleto-informativo.pdf',
  klar: 'https://www.klar.mx/tarjeta-de-credito-con-garantia',
  klarCosts: 'https://www.klar.mx/cat',
  stori: 'https://www.storicard.com/stori-card',
  storiCosts: 'https://www.storicard.com/files/costos-y-comisiones-credito.pdf?v=20260213',
  personal: 'https://www.bbva.mx/personas/productos/creditos/prestamos-personales/prestamo-personal-inmediato.html',
  payroll: 'https://www.bbva.mx/personas/productos/creditos/prestamos-personales/prestamo-nomina.html',
  mortgage: 'https://www.bbva.mx/personas/productos/creditos/credito-hipotecario/hipoteca-fija.html',
};

export const creditCatalog = {
  reviewedOn,
  cards: [
    ...additionalCardDetails.map(card),
    card({
      id: 'bbva-azul', name: 'Tarjeta Azul BBVA', issuer: 'BBVA México', canonicalUrl: urls.bbva,
      costs: {
        annualFee: { amount: 748, taxTreatment: 'Más IVA', conditions: 'Administración anual de la tarjeta titular.', classification: 'annual' },
        cat: observation(89.4, '2026-07-13', '2027-01-09'),
        interestRate: rate(59.52, 'Promedio ponderada anual por saldo; crédito de tasa variable.', '2026-07-13', '2027-01-09'),
      },
      requirements: ['Mayor de 18 años y residencia en México.', 'Ingreso mensual mínimo publicado: $6,000 MXN.', 'Identificación, comprobantes de ingresos y domicilio; domicilio de hasta tres meses.', 'Autorización para consultar historial y evaluación crediticia.'],
      otherFees: ['Pago tardío: $490 MXN más IVA por evento.', 'Reposición por robo o extravío: $192 MXN más IVA.'],
      benefits: [], // Puntos BBVA is documented once in the linked benefit program.
      limitations: ['CAT promedio sin IVA, informativo; no es una tasa personalizada.', 'BBVA Start, anunciado en el encabezado del sitio, es otro producto.'],
      evidence: [evidence('BBVA Azul: requisitos, comisiones y CAT', urls.bbva)],
    }),
    card({
      id: 'banamex-joy', name: 'Tarjeta de Crédito Joy Banamex', issuer: 'Banamex', canonicalUrl: urls.joy,
      costs: {
        annualFee: { amount: 0, taxTreatment: 'Sin comisión anual', conditions: 'La penalización mensual por inactividad es independiente de la anualidad.', classification: 'none' },
        maintenanceFee: { amount: 149, unit: 'MXN', frequency: 'monthly', label: 'Penalización mensual por inactividad', taxTreatment: 'Más IVA', asOf: null, validThrough: null, conditions: 'Se exenta con al menos $300 MXN en operaciones elegibles antes del corte; MSI, intereses, IVA y comisiones no cuentan.' },
        cat: observation(81.2, '2026-07-27', '2027-01-27'),
        interestRate: rate(60.93, 'Promedio ponderada anual; crédito de tasa variable.', '2026-07-27', '2027-01-27'),
      },
      requirements: ['Ingreso mensual mínimo comprobable: $7,000 MXN.', 'INE vigente; extranjeros: residencia temporal o permanente y pasaporte.', 'Comprobante de domicilio en México de hasta tres meses.', 'Sujeta a autorización.'],
      otherFees: ['Inactividad: $149 MXN más IVA al mes; se exenta con al menos $300 MXN en operaciones elegibles antes del corte.', 'Las parcialidades de MSI, intereses, IVA y comisiones no cuentan para la exención.', 'Pago tardío: $399 MXN más IVA.'],
      benefits: ['Cambio de fecha de corte una vez al año, sujeto a condiciones.', 'Tarjeta digital con CVV dinámico.'],
      limitations: ['CAT promedio sin IVA.', 'No participa en recompensas Banamex.', 'Límites de edad no consolidados en esta ficha.'],
      evidence: [evidence('Joy Banamex: costos y condiciones', urls.joy)],
    }),
    card({
      id: 'santander-likeu', name: 'Tarjeta de Crédito LikeU', issuer: 'Banco Santander México', canonicalUrl: urls.likeu,
      costsSource: evidence('Folleto LikeU: julio–diciembre de 2026', urls.likeuBrochure),
      costs: {
        annualFee: { amount: 0, taxTreatment: 'Sin IVA', conditions: 'El mantenimiento mensual depende del uso.', classification: 'none' },
        maintenanceFee: { amount: 169, unit: 'MXN', frequency: 'monthly', label: 'Mantenimiento mensual', taxTreatment: 'Más IVA', asOf: null, validThrough: null, conditions: 'Se cobra si las compras acumuladas son menores a $200 MXN en el periodo.' },
        cat: observation(89.1, '2026-07-01', '2026-12-31'),
        interestRate: rate(65.52, 'Ordinaria promedio ponderada por saldo, anual variable, sin IVA.', '2026-07-01', '2026-12-31'),
      },
      requirements: ['De 20 a 69 años y 11 meses, según folleto.', 'Ingreso mensual mínimo: $7,500 MXN.', 'Identificación, comprobantes de ingresos y domicilio, solicitud firmada; documentación adicional para extranjeros.'],
      otherFees: ['Mantenimiento: $169 MXN más IVA al mes si las compras acumuladas son menores a $200 MXN.', 'Las asistencias opcionales pueden tener costo.'],
      benefits: ['Tarjeta digital con código de seguridad dinámico.'],
      limitations: ['CAT promedio ponderado sin IVA.', 'El FAQ muestra una tasa de 66.35%; se conserva aquí la del folleto fechado de julio.', 'Recompensas sujetas a sus condiciones; no son rendimiento garantizado.'],
      evidence: [evidence('LikeU: página oficial', urls.likeu), evidence('Folleto LikeU: julio–diciembre de 2026', urls.likeuBrochure)],
    }),
    card({
      id: 'hsbc-zero', name: 'Tarjeta de Crédito HSBC Zero', issuer: 'HSBC México', canonicalUrl: urls.hsbc,
      costsSource: evidence('Folleto HSBC Zero: agosto de 2026', urls.hsbcBrochure),
      costs: {
        annualFee: { amount: 0, taxTreatment: 'Sin IVA', conditions: 'Existe administración mensual exentable por uso.', classification: 'none' },
        maintenanceFee: { amount: 186, unit: 'MXN', frequency: 'monthly', label: 'Administración mensual del titular', taxTreatment: 'Más IVA', asOf: null, validThrough: null, conditions: 'Se exenta con al menos $300 MXN en operaciones elegibles entre cortes.' },
        cat: observation(95.5, '2026-08-07', '2026-12-07'),
        interestRate: rate(45.71, 'Promedio ponderada por saldo publicada junto al CAT.', '2026-08-07', '2026-12-07'),
      },
      requirements: ['Persona física de 18 a 74 años y 11 meses.', 'La página indica ingreso mensual de $25,000 MXN, o $5,000 MXN con nómina HSBC; confirmar por canal.', 'Identificación, comprobantes de domicilio e ingresos e historial crediticio.'],
      otherFees: ['Administración mensual: $186 MXN más IVA; se exenta con al menos $300 MXN en operaciones elegibles entre cortes.', 'Pago tardío: $509 MXN más IVA por evento.'],
      benefits: ['Adicionales sin costo, sujetas a condiciones.'],
      limitations: ['CAT promedio sin IVA.', 'El folleto publica ingreso mínimo de $5,000 MXN y un año de antigüedad laboral; la página distingue ingresos según nómina. Confirmar requisitos, sin inferir elegibilidad.'],
      evidence: [evidence('HSBC Zero: página y requisitos', urls.hsbc), evidence('Folleto HSBC Zero: agosto de 2026', urls.hsbcBrochure)],
    }),
    card({
      id: 'banorte-clasica', name: 'Tarjeta de Crédito Clásica Banorte', issuer: 'Banco Mercantil del Norte', canonicalUrl: urls.banorte,
      costsSource: evidence('Folleto Clásica: octubre de 2026', urls.banorteBrochure),
      costs: {
        annualFee: { amount: 720, taxTreatment: 'Más IVA', conditions: 'Administración anual de la tarjeta titular.', classification: 'annual' },
        cat: observation(119.5, '2026-08-19', '2027-02-19'),
        interestRate: rate(62.06, 'Promedio ponderada por saldo, anual variable, sin IVA.', '2026-08-19', '2027-02-19'),
      },
      requirements: ['Persona física, incluida actividad empresarial.', 'De 18 a 69 años y 11 meses; ingreso mensual comprobable de $7,000 MXN.', 'Identificación, RFC, CURP y solicitud firmada.', 'Evaluación crediticia y verificación de identidad.'],
      otherFees: ['Administración anual de adicional: $300 MXN más IVA.'],
      benefits: ['Recompensa Total Banorte, sujeto a condiciones.'],
      limitations: ['CAT promedio sin IVA.', 'El CAT de 0% de meses sin intereses corresponde a esa modalidad, no al crédito ordinario.'],
      evidence: [evidence('Clásica Banorte: requisitos y costos', urls.banorte), evidence('Folleto Clásica: octubre de 2026', urls.banorteBrochure)],
    }),
    card({
      id: 'nu-credito', name: 'Tarjeta de Crédito Nu', issuer: 'Nubank, S.A., Institución de Banca Múltiple', canonicalUrl: urls.nu,
      costs: {
        annualFee: { amount: 0, taxTreatment: 'Sin IVA', conditions: 'Anualidad de cero publicada en página y folleto.', classification: 'none' },
        cat: observation(null, null, null, 'unknown'),
        interestRate: rate(null, 'Por confirmar: las fuentes oficiales presentan una discrepancia de vigencia.'),
      },
      requirements: ['Mayoría de edad, residencia en México e identificación oficial vigente.', 'Solicitud en la aplicación, verificación de identidad y evaluación crediticia.'],
      otherFees: ['El folleto publica pago tardío de $400 MXN más IVA por evento.'],
      benefits: ['Sin anualidad; operación mediante la aplicación.'],
      limitations: ['La página publica CAT 148.1% y tasa 93.6%, calculados el 10 de abril de 2026; su vigencia terminó el 7 de octubre de 2026.', 'El folleto publica CAT 150.1% y tasa promedio 94.6%, calculados el 13 de agosto de 2026, pero muestra vigencia del 8 de octubre al 9 de febrero de 2026: fechas inconsistentes.', 'No se corrigió el año por inferencia ni se eligió un CAT vigente. Ingreso mínimo no consolidado.'],
      evidence: [evidence('Nu: tarjeta de crédito', urls.nu), evidence('Nu: CAT publicado', 'https://nubank.com.mx/cat/'), evidence('Folleto Nu: discrepancia de fechas', urls.nuBrochure)],
    }),
    card({
      id: 'klar-garantizada', name: 'Tarjeta de Crédito Klar con Garantía', issuer: 'Klar Technologies, S.A. de C.V., S.F.P.', canonicalUrl: urls.klar,
      costsSource: evidence('Klar: costos de tarjeta con y sin garantía', urls.klarCosts),
      costs: {
        annualFee: { amount: 0, taxTreatment: 'Sin comisión', conditions: 'Requiere depósito de garantía; ese depósito no es una anualidad.', classification: 'none' },
        cat: observation(187, '2026-05-01', '2026-11-01'),
        interestRate: rate(123.1, 'Anual fija publicada al 1 de febrero de 2026.', '2026-02-01'),
      },
      requirements: ['Registro y depósito inicial de garantía.', 'Depósito y línea sujetos a las condiciones comunicadas por Klar.'],
      otherFees: ['Cobranza: $300 MXN más IVA después de cuatro días naturales de atraso.', 'Disposición de efectivo: 10% del monto más IVA.'],
      benefits: ['El tarifario publica cero cargos de apertura, mantenimiento y uso mínimo.'],
      limitations: ['CAT promedio sin IVA; el tarifario agrupa tarjetas con y sin garantía.', 'La fecha de la tasa difiere de la del CAT; no se documentó su fin de vigencia.', 'Edad, ingreso y garantía mínimos no consolidados.', 'Klar Platino y Uber Card tienen tarifarios diferentes.'],
      evidence: [evidence('Klar: tarjeta con garantía', urls.klar), evidence('Klar: costos de tarjeta con y sin garantía', urls.klarCosts)],
    }),
    card({
      id: 'stori-green', name: 'Stori Green', issuer: 'Stori México, S.A. de C.V., Sociedad Financiera Popular', canonicalUrl: urls.stori,
      costsSource: evidence('Tarifario Stori: renglón STORI GREEN', urls.storiCosts),
      costs: {
        annualFee: { amount: 0, taxTreatment: 'Sin IVA', conditions: 'Existe una comisión de apertura para esta variante.', classification: 'none' },
        cat: observation(202.2, '2026-07-01', '2026-12-31'),
        interestRate: rate(114.6, 'Fija promedio ponderada anual, sin IVA.', '2026-07-01', '2026-12-31'),
      },
      requirements: ['Mayor de edad con INE vigente.', 'Solicitud y datos requeridos mediante la aplicación.'],
      otherFees: ['Apertura: $500 MXN una sola vez para STORI GREEN; el renglón no especifica IVA.', 'Falta de pago: $300 MXN más IVA por evento.'],
      benefits: ['Tarjeta digital antes de recibir la física, según el proceso publicado.'],
      limitations: ['CAT promedio ponderado sin IVA.', 'Se usa el tarifario de julio; la página conserva CAT 204.3% calculado en abril.', 'STORI GREEN CLÁSICA es otra variante dentro del mismo documento.', 'Ingreso mínimo y aprobación individual no consolidados.'],
      evidence: [evidence('Stori Green: página y requisitos', urls.stori), evidence('Tarifario Stori: renglón STORI GREEN', urls.storiCosts)],
    }),
  ],
  loanFamilies: [
    family({
      id: 'personal', name: 'Préstamo personal',
      purpose: 'Financiamiento para necesidades personales; destino y condiciones dependen del producto.',
      repayment: 'Pagos periódicos durante un plazo pactado.',
      watchOut: ['Comparar desembolso neto, comisión inicial y total a pagar.', 'La preaprobación sigue sujeta a condiciones.'],
      evidence: [evidence('BBVA: préstamo personal', urls.personal)],
      offers: [offer({
        id: 'bbva-personal-inmediato', name: 'Préstamo Personal Inmediato BBVA', issuer: 'BBVA México', canonicalUrl: urls.personal,
        costs: {
          cat: observation(36.1, '2026-07-10', '2027-01-10'),
          interestRate: { ...rate(null, 'Rango de tasa anual fija, según evaluación.'), minPercent: 25.75, maxPercent: 39.95, taxTreatment: 'Sin IVA' },
          openingFee: { amount: 2.75, unit: 'percent', taxTreatment: 'Más IVA', conditions: 'Del monto del crédito, una sola vez.' },
        },
        amountRange: '$3,000–$1,500,000 MXN', termRange: '6–72 meses',
        requirements: ['Cuenta de depósito o tarjeta BBVA y oferta preaprobada vigente.', 'Mayor de 18 años; edad más plazo no mayor a 84 años y 364 días.', 'Historial, capacidad de pago y documentación solicitada.'],
        benefits: ['Pagos anticipados totales o parciales sin comisión; requiere estar al corriente y cubrir al menos el equivalente de un pago periódico.', 'Sin cobro de seguro ni aval o garantía.', 'Tasa fija durante el crédito; pagos quincenales o mensuales fijos antes de IVA.'],
        otherFees: ['Contratación: 2.75% del monto más IVA, por única vez.', 'El primer pago es irregular y cubre únicamente intereses más IVA.'],
        limitations: ['CAT promedio ponderado sin IVA; el rango de tasas no es una cotización.', 'Primer pago irregular de intereses más IVA; posteriores quincenales o mensuales.'],
        evidence: [evidence('Personal Inmediato: oferta y requisitos', urls.personal)],
      })],
    }),
    family({
      id: 'payroll', name: 'Préstamo de nómina', purpose: 'Financiamiento relacionado con la recepción del salario.',
      repayment: 'Calendario y cobro según contrato y recepción de nómina.',
      watchOut: ['Revisar el ingreso restante después del pago.', 'Confirmar seguros y condiciones al cambiar la dispersión de nómina.'],
      evidence: [evidence('BBVA: préstamo de nómina', urls.payroll)],
      offers: [offer({
        id: 'bbva-nomina-seguro-vida', name: 'Creditón Nómina BBVA con seguro de vida', issuer: 'BBVA México', canonicalUrl: urls.payroll,
        costs: {
          cat: observation(26.8, '2026-07-10', '2027-01-10'),
          interestRate: { ...rate(null, 'Rango general de tasa anual fija; confirmar cotización de esta modalidad.'), minPercent: 23.75, maxPercent: 37.45, taxTreatment: 'Sin IVA' },
          openingFee: { amount: 0, unit: 'MXN', taxTreatment: 'Sin comisión', conditions: 'Contratación sin costo.' },
        },
        amountRange: '$2,000–$1,500,000 MXN, rango general', termRange: '3–72 meses, según evaluación',
        requirements: ['Persona física sin actividad empresarial.', 'Ingreso mensual mínimo $2,000 MXN; nómina BBVA de al menos un mes y empleo actual de tres meses.', 'Edad mínima 18; edad más plazo no mayor a 75 años y 364 días en el régimen general.', 'Seguro de vida, documentación y evaluación.'],
        limitations: ['CAT sin IVA exclusivo de la modalidad con seguro de vida.', 'La modalidad sin seguro es para adultos mayores bajo otras condiciones.'],
        evidence: [evidence('Creditón Nómina: requisitos y CAT por modalidad', urls.payroll)],
      })],
    }),
    family({
      id: 'auto', name: 'Crédito automotriz', purpose: 'Financiar un vehículo nuevo o usado elegible.',
      repayment: 'Enganche y pagos durante el plazo contratado; seguros y costos según oferta.',
      watchOut: ['Separar precio, enganche, monto financiado, seguros y comisiones.', 'No mezclar CAT de autos nuevos, usados o promociones.', 'Ficha educativa: no contiene una oferta cotizada.'],
      evidence: [evidence('BBVA: crédito de auto', 'https://www.bbva.mx/personas/productos/creditos/credito-auto.html')], offers: [],
    }),
    family({
      id: 'mortgage', name: 'Crédito hipotecario', purpose: 'Financiar vivienda con el inmueble como garantía, según el producto.',
      repayment: 'Mensualidades a largo plazo, con costos iniciales y recurrentes.',
      watchOut: ['Contemplar avalúo, escrituración, seguros y administración.', 'Comparar para el mismo monto, enganche y plazo.', 'El inmueble garantiza el cumplimiento del crédito.'],
      evidence: [evidence('BBVA: Hipoteca Fija', urls.mortgage)],
      offers: [offer({
        id: 'bbva-hipoteca-fija', name: 'Hipoteca Fija BBVA', issuer: 'BBVA México', canonicalUrl: urls.mortgage,
        costs: {
          cat: observation(13.3, '2026-06-30', '2026-12-27'),
          interestRate: rate(null, 'Fija individual; la página presenta tasas mínimas inconsistentes.'),
          openingFee: { amount: 1, unit: 'percent', taxTreatment: 'Exenta de IVA según el apartado de contratación', conditions: 'Sobre el monto financiado, una vez al formalizar.' },
        },
        amountRange: null, termRange: '5, 10, 15 o 20 años',
        requirements: ['Mayor de 26 años; terminar antes de cumplir 85.', 'Historial, ingresos y antigüedad laboral comprobables.', 'Vivienda elegible, seguros de vida y daños.'],
        limitations: ['CAT sin IVA: aforo de 80%, 15 años y tasa de referencia 11.20%.', 'La página muestra desde 9.05% y desde 9.15%; no se eligió una por inferencia.', 'Administración mensual: 0.030% del monto financiado más IVA; existen otros gastos iniciales.'],
        evidence: [evidence('Hipoteca Fija: costos y supuestos del CAT', urls.mortgage)],
      })],
    }),
    family({
      id: 'consolidation', name: 'Consolidación de deudas',
      purpose: 'Agrupar deudas mediante nuevo financiamiento. Es un uso o estrategia, no una oferta universal.',
      repayment: 'Liquidar obligaciones anteriores y atender el calendario del nuevo crédito.',
      watchOut: ['Una mensualidad menor puede implicar mayor plazo y costo total.', 'Revisar comisiones, garantías y deudas elegibles.', 'Consolidar no elimina deuda ni mejora automáticamente las condiciones.'],
      evidence: [evidence('BBVA: préstamos para pagar deudas', 'https://www.bbva.mx/educacion-financiera/creditos/credito-de-nomina-prestamo/ppi-prestamos-para-pagar-deudas.html')], offers: [],
    }),
    family({
      id: 'secured-pledge', name: 'Crédito con garantía prendaria',
      purpose: 'Obtener liquidez con un bien en garantía, por ejemplo un vehículo.',
      repayment: 'Según contrato, incluidas las condiciones de recuperación o liberación de la garantía.',
      watchOut: ['Distinguir avalúo y dinero efectivamente prestado.', 'El incumplimiento puede ocasionar la pérdida del bien.', 'Las condiciones varían por institución y tipo de prenda.', 'Familia educativa, sin oferta específica.'],
      evidence: [evidence('Nacional Monte de Piedad: vehículo en garantía', 'https://www.montepiedad.com.mx/empeno-vehiculos/')], offers: [],
    }),
  ],
};
