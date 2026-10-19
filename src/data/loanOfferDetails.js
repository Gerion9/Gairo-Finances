// Dated issuer observations, reviewed on 2026-10-18; not individual quotations.
// Each fee keeps its own unit, period and evidence. CAT is never an interest rate.
const source = (title, url) => ({ title, url });
const santanderBrochure = source('Santander: folleto de créditos personales y de nómina, octubre de 2026', 'https://assets.santandermedia.com/adobe/assets/urn:aaid:aem:95f815f3-9707-4ddf-99b1-9ac025c2699a/original/as/folleto-electronico-ajuste-comision.pdf');
const santanderPersonal = source('Santander: Crédito Personal, requisitos y comisión', 'https://www.santander.com.mx/personas/credito-y-financiamiento/creditos-personales/credito-personal-santander/');
const santanderPayroll = source('Santander: Crédito Nómina, requisitos y comisión', 'https://www.santander.com.mx/personas/credito-y-financiamiento/creditos-personales/credito-nomina-santander/');
const banortePersonal = source('Banorte: Crédito Personal, costos y condiciones', 'https://www.banorte.com/Personal/Credito-Personal-Banorte.html');
const hsbcCosts = source('HSBC: comisiones y CAT de créditos al consumo, vigencia publicada a diciembre de 2026', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/comisiones/comisiones_credito_consumo.pdf');
const hsbcPersonalFees = source('HSBC: anexo de comisiones de Crédito Personal, emisión del 7 de julio de 2025', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/creditos/tarifas_comisiones_cred_personal.pdf');
const hsbcPayrollFees = source('HSBC: anexo de comisiones de Crédito Nómina, emisión del 7 de julio de 2025', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/creditos/tarifas_comisiones_cred_nomina.pdf');
const hsbcPersonalOldBrochure = source('HSBC: folleto Personal enlazado con CAT vencido', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/creditos/folleto_digital_personal.pdf');
const hsbcPayrollOldBrochure = source('HSBC: folleto Nómina enlazado con CAT vencido', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/creditos/folleto_digital_nomina.pdf');
const banortePayroll = source('Banorte: Crédito de Nómina, requisitos y costos', 'https://www.banorte.com/Personal/Nomina/Nomina-Personas-Fisicas/Credito-de-Nomina.html');
const banortePayrollBrochure = source('Banorte: folleto Crédito de Nómina, junio–diciembre de 2026; tabla de tasa pendiente de revisión visual', 'https://www.banorte.com/dam/jcr:94448546-782b-4e6c-aaf7-c13afdbb9087/Folleto-Informativo-CDN.pdf');
const banamexPersonal = source('Banamex: Crédito Personal y CAT cargado por la página oficial', 'https://www.banamex.com/es/personas/creditos/credito-personal.html');
const banamexBenefits = source('Banamex: soluciones en efectivo, condiciones y beneficios', 'https://www.banamex.com/personas/soluciones-en-efectivo');
const yoteprestoPersonal = source('yotepresto: préstamo personal, tasas y requisitos', 'https://www.yotepresto.com/prestamos-personales');
const yoteprestoCosts = source('yotepresto: tasas y comisiones por perfil', 'https://www.yotepresto.com/tasas-comisiones');
const yoteprestoFaq = source('yotepresto: preguntas frecuentes de solicitantes', 'https://www.yotepresto.com/preguntas-frec-qup');
const yoteprestoAdministration = source('yotepresto: tabla publicada de administración mensual por monto del préstamo', 'https://cdn.prod.website-files.com/60fee83d8392d802267e7efc/62eac70bc9142dac652d1e85_comision-administracion-y-cuenta.webp');

const datedPercent = (percent, label, asOf, validThrough, taxTreatment, sources) => ({
  percent, label, asOf, validThrough, taxTreatment, status: 'documented', sources,
});

const hsbcOffer = ({ id, name, familyId, url, cat, minPercent, maxPercent, eligibility, income, amountRange, feesSource, oldBrochure, limitations = [] }) => {
  const page = source(`HSBC: ${name}, requisitos y condiciones`, url);
  return {
    id, name, familyId, issuer: 'HSBC México', canonicalUrl: url, currency: 'MXN',
    costs: {
      cat: datedPercent(cat, 'CAT promedio publicado, para fines informativos y de comparación.', '2026-06-30', '2026-12-31', 'Sin IVA', [hsbcCosts]),
      interestRate: {
        ...datedPercent(null, 'Fija anual, según evaluación; rango publicado, no cotización individual.', '2026-06-30', '2026-12-31', 'IVA no precisado para esta tasa', [hsbcCosts]),
        minPercent, maxPercent,
      },
      openingFee: {
        amount: 1.77, unit: 'percent', frequency: 'per-event', label: 'Comisión por disposición', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null, conditions: '1.77% una vez por cada disposición del crédito.',
        sources: [hsbcCosts, ...(feesSource ? [feesSource] : [])],
      },
    },
    amountRange, termRange: '6–60 meses',
    requirements: [
      eligibility,
      'De 18 a 74 años y 11 meses; buen historial crediticio y evaluación de capacidad de pago.',
      income,
      'Identificación y, para extranjeros, residencia; comprobante de domicilio de hasta dos meses y solicitud.',
      'Comprobantes de ingresos de los últimos dos meses o seis estados de cuenta donde se reciben, según los requisitos de contratación.',
    ],
    otherFees: [feesSource
      ? 'Cobranza por pago vencido en crédito simple: $100 MXN para pago semanal y $366 MXN para pago quincenal o mensual; en cuenta corriente, $100 MXN. Importes más IVA, según la modalidad contratada.'
      : 'Cobranza por pago vencido: $366 MXN en crédito simple y $100 MXN en cuenta corriente, más IVA; confirmar la modalidad contratada.'],
    benefits: [
      'Pagos anticipados o adelantados sin penalización, conforme al contrato.',
      'Pagos fijos según la oferta contratada.',
      'Condonación por fallecimiento mediante aviso al banco y conforme a la cláusula Quinta; no se presenta como un seguro gratuito.',
    ],
    limitations: [
      'El rango de tasas y el CAT son publicaciones informativas; no garantizan aprobación, monto ni tasa individual.',
      'La vigencia del CAT y del rango de tasas no acredita una vigencia propia de la comisión por disposición.',
      'Costo de seguros separado no documentado en esta ficha. La condonación por fallecimiento es una condición contractual.',
      ...(oldBrochure ? ['El folleto enlazado conserva un plazo distinto y un CAT vencido; esta ficha usa el plazo de la página y los costos del tarifario de junio–diciembre de 2026.'] : []),
      ...limitations,
    ],
    evidence: [page, hsbcCosts, ...(feesSource ? [feesSource] : []), ...(oldBrochure ? [oldBrochure] : [])],
  };
};

export const additionalLoanOffers = [
  {
    id: 'santander-personal', familyId: 'personal', name: 'Crédito Personal Santander', issuer: 'Banco Santander México',
    canonicalUrl: santanderPersonal.url, currency: 'MXN',
    costs: {
      cat: datedPercent(36.9, 'CAT promedio ponderado, para fines informativos y de comparación.', '2026-08-31', '2027-02-28', 'Sin IVA', [santanderBrochure]),
      interestRate: datedPercent(28.32, 'Ordinaria anual fija promedio ponderada; la tasa individual depende de la oferta.', '2026-08-31', '2027-02-28', 'IVA no precisado para esta tasa', [santanderBrochure]),
      openingFee: {
        amount: 1.75, unit: 'percent', frequency: 'per-event', label: 'Comisión por disposición máxima', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'Hasta 1.75% por evento sobre el monto contratado. Puede reducirse según el perfil; no es una cotización individual.',
        sources: [santanderBrochure, santanderPersonal],
      },
    },
    amountRange: 'Hasta $3,000,000 MXN; mínimo por verificar.', termRange: '6–72 meses',
    requirements: [
      'De 20 a 81 años; ingreso mensual mínimo publicado de $3,000 MXN.',
      'Asalariados: dos años continuos entre empleo actual y anterior, con al menos tres meses en el actual. Actividad empresarial: dos años continuos.',
      'Buenos antecedentes crediticios si existe historial; sujeto a evaluación y oferta.',
      'Identificación y comprobante de domicilio de hasta dos meses. Independientes: dos declaraciones anuales, tres estados de cuenta y contrato de servicios, según el canal.',
      'Seguro de vida e invalidez obligatorio. Se admite otra aseguradora que cumpla los requisitos del banco; prima no cuantificada en esta ficha.',
    ],
    otherFees: ['Cobranza: $200 MXN por evento, hasta tres eventos consecutivos; tratamiento de IVA no explicitado en el folleto.'],
    benefits: [
      'Pagos anticipados totales o parciales sin penalización estando al corriente; se aplican al saldo insoluto conforme al contrato.',
      'Sin garantía, sujeto a los requisitos y evaluación del banco.',
    ],
    limitations: [
      'CAT y tasa promedio del folleto de octubre de 2026; no representan una oferta personalizada.',
      'La página conserva un bloque con vigencia terminada el 30 de septiembre de 2026 y una referencia a nómina que no coincide con el cuerpo y el folleto. Se prioriza el folleto fechado.',
      'El máximo de tasa de 60% aparece en el bloque web vencido y no se adopta como condición vigente.',
      'No se documentó una vigencia propia de la comisión ni el costo del seguro. La fecha del CAT no se extiende a esos cargos.',
    ],
    evidence: [santanderBrochure, santanderPersonal],
  },
  {
    id: 'santander-nomina', familyId: 'payroll', name: 'Crédito Nómina Santander', issuer: 'Banco Santander México',
    canonicalUrl: santanderPayroll.url, currency: 'MXN',
    costs: {
      cat: datedPercent(38.7, 'CAT promedio ponderado, para fines informativos y de comparación.', '2026-08-31', '2027-02-28', 'Sin IVA', [santanderBrochure]),
      interestRate: datedPercent(27.32, 'Ordinaria anual fija promedio ponderada; la tasa individual depende de la oferta.', '2026-08-31', '2027-02-28', 'IVA no precisado para esta tasa', [santanderBrochure]),
      openingFee: {
        amount: 12, unit: 'percent', frequency: 'per-event', label: 'Comisión por disposición máxima', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'Hasta 12% por evento sobre el monto contratado. Puede reducirse según el perfil; no es una cotización individual.',
        sources: [santanderBrochure, santanderPayroll],
      },
    },
    amountRange: 'Hasta $3,000,000 MXN; mínimo por verificar.', termRange: '3–72 meses',
    requirements: [
      'Recibir la nómina en Santander; de 18 a 81 años; ingreso neto mensual mínimo publicado de $1,000 MXN.',
      'Dos años continuos entre empleo actual y anterior, con al menos tres meses en el actual; buenos antecedentes crediticios si existe historial.',
      'Identificación y comprobante de domicilio de hasta dos meses; comprobantes de ingresos si la nómina lleva menos de tres meses en Santander.',
      'Seguro obligatorio según la oferta: vida e invalidez o desempleo. Se admite una aseguradora que cumpla los requisitos; costo no cuantificado.',
      'Sujeto a evaluación y condiciones de la oferta individual.',
    ],
    otherFees: ['Cobranza por evento según frecuencia de pago: $100 MXN mensual, $50 MXN quincenal o catorcenal y $25 MXN semanal; máximo tres eventos consecutivos. IVA no explicitado.'],
    benefits: [
      'Pagos anticipados totales o parciales sin penalización estando al corriente; se aplican al saldo insoluto conforme al contrato.',
      'Sin garantía, sujeto a los requisitos y evaluación del banco.',
    ],
    limitations: [
      'CAT y tasa promedio del folleto de octubre de 2026; no representan una oferta personalizada.',
      'La página conserva cifras con vigencia vencida. El máximo de tasa de 65% de ese bloque no se adopta como condición vigente.',
      'No se documentó una vigencia propia de la comisión ni el costo del seguro. La fecha del CAT no se extiende a esos cargos.',
    ],
    evidence: [santanderBrochure, santanderPayroll],
  },
  {
    id: 'banorte-personal', familyId: 'personal', name: 'Crédito Personal Banorte', issuer: 'Banco Mercantil del Norte',
    canonicalUrl: banortePersonal.url, currency: 'MXN',
    costs: {
      cat: datedPercent(28.8, 'CAT promedio publicado para el escenario indicado por el banco.', '2026-04-30', '2026-10-30', 'Sin IVA', [banortePersonal]),
      interestRate: datedPercent(25.68, 'Fija anual promedio ponderada; no es una tasa individual garantizada.', '2026-04-30', '2026-10-30', 'Sin IVA', [banortePersonal]),
      openingFee: {
        amount: 0, unit: 'MXN', frequency: 'one-time', label: 'Comisión por apertura', taxTreatment: 'Sin comisión',
        asOf: null, validThrough: null, conditions: 'Apertura sin comisión publicada por el banco.', sources: [banortePersonal],
      },
    },
    amountRange: 'Hasta $500,000 MXN; mínimo por verificar.', termRange: null,
    requirements: [
      'Ser cliente Banorte y contar con invitación; sujeto a evaluación crediticia.',
      'Identificación y comprobante de domicilio; cargo mensual a la cuenta de pago.',
      'Edad e ingreso mínimo no consolidados en esta ficha.',
    ],
    otherFees: ['Otros cargos y sus condiciones no consolidados en esta ficha.'],
    benefits: [
      'Pagos anticipados totales o parciales sin penalización, según las condiciones del crédito.',
      'Seguro de vida gratuito durante el crédito.',
      'Sin aval ni garantía, sujeto a evaluación e invitación.',
    ],
    limitations: [
      'El CAT se calcula con un crédito de $252,639 MXN a 36 meses. Ese escenario no acredita el rango de plazos de contratación.',
      'No se incorporan el monto de hasta $1 millón ni el plazo de 12–36 meses de Crédito Personal Preferente: corresponde a otro segmento.',
      'No se documentó una vigencia propia de la comisión de apertura. La fecha del CAT no se extiende a ese dato.',
    ],
    evidence: [banortePersonal],
  },
  hsbcOffer({
    id: 'hsbc-personal', familyId: 'personal', name: 'Crédito Personal HSBC',
    url: 'https://www.hsbc.com.mx/creditos/personales/personal/', cat: 37.3, minPercent: 28.99, maxPercent: 46.99,
    eligibility: 'Confirmar el segmento de contratación con HSBC; la página de Personal menciona clientes Advance.',
    income: 'Ingresos mensuales mayores a $5,000 MXN.', amountRange: 'Hasta $1,000,000 MXN; mínimo por verificar.',
    feesSource: hsbcPersonalFees, oldBrochure: hsbcPersonalOldBrochure,
    limitations: ['La página de Personal menciona Advance, pero One tiene un CAT y rango de tasas diferentes; no se trasladan condiciones entre esos productos.'],
  }),
  hsbcOffer({
    id: 'hsbc-personal-one', familyId: 'personal', name: 'Crédito Personal One',
    url: 'https://www.hsbc.com.mx/creditos/personales/one/', cat: 33.9, minPercent: 18.99, maxPercent: 39.99,
    eligibility: 'Ser cliente HSBC One y cumplir los requisitos de contratación.',
    income: 'Ingresos mensuales mayores a $5,000 MXN.', amountRange: 'Hasta $1,000,000 MXN; mínimo por verificar.',
    limitations: ['El tarifario también denomina Advance a esta variante; no se sustituyen sus tasas por las de Crédito Personal HSBC.'],
  }),
  hsbcOffer({
    id: 'hsbc-personal-premier', familyId: 'personal', name: 'Crédito Personal Premier',
    url: 'https://www.hsbc.com.mx/creditos/personales/personal-premier/', cat: 26.7, minPercent: 14.9, maxPercent: 35.99,
    eligibility: 'Ser cliente HSBC Premier y cumplir los requisitos de contratación.',
    income: 'Ingreso mínimo no cuantificado en la página consultada; confirmar requisitos del segmento Premier.',
    amountRange: 'Hasta $1,000,000 MXN; mínimo por verificar.',
    limitations: ['La promoción enlazada de apertura de 0–1.77% venció el 30 de junio de 2026; no se aplica a esta ficha.'],
  }),
  hsbcOffer({
    id: 'hsbc-nomina', familyId: 'payroll', name: 'Crédito de Nómina HSBC',
    url: 'https://www.hsbc.com.mx/creditos/personales/nomina/', cat: 36.7, minPercent: 15.9, maxPercent: 49.99,
    eligibility: 'Recibir la nómina en HSBC y cumplir los requisitos de contratación.',
    income: 'Ingreso mínimo no cuantificado en la página consultada.',
    amountRange: 'Hasta 11 meses del sueldo o $1,200,000 MXN, según capacidad de pago.', feesSource: hsbcPayrollFees, oldBrochure: hsbcPayrollOldBrochure,
  }),
  {
    id: 'banorte-nomina', familyId: 'payroll', name: 'Crédito de Nómina Banorte', issuer: 'Banco Mercantil del Norte',
    canonicalUrl: banortePayroll.url, currency: 'MXN',
    costs: {
      cat: datedPercent(38, 'CAT promedio publicado para fines informativos y de comparación.', '2026-06-30', '2026-12-31', 'Sin IVA', [banortePayroll]),
      interestRate: {
        percent: null, label: 'Tasa ordinaria por verificar; el rango de la tabla del folleto está pendiente de revisión visual.',
        asOf: null, validThrough: null, taxTreatment: 'IVA no precisado para esta tasa', status: 'unknown', sources: [banortePayrollBrochure],
      },
      openingFee: {
        amount: 350, unit: 'MXN', frequency: 'one-time', label: 'Comisión por apertura', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null, conditions: 'Por apertura, una sola vez.', sources: [banortePayroll],
      },
    },
    amountRange: 'Hasta $1,500,000 MXN; mínimo por verificar.', termRange: '6, 12, 18, 24, 30, 36, 42, 48, 54 o 60 meses',
    requirements: [
      'Recibir nómina neta de al menos $2,000 MXN; de 18 a 74 años y 11 meses, o hasta 79 años y 11 meses para pensionados.',
      'Identificación, comprobante de domicilio de hasta tres meses, comprobantes de ingresos y consulta de Buró de Crédito.',
      'Solicitud desde el primer depósito, sujeta a validación de 48–72 horas y aprobación.',
      'Seguro de vida y desempleo obligatorio según el folleto; prima no cuantificada en esta ficha.',
    ],
    otherFees: ['Otros cargos del folleto y sus modalidades están pendientes de revisión visual de las tablas; no se consideran iguales a cero.'],
    benefits: [
      'Sin anualidad, aval ni garantía, sujeto a evaluación y condiciones del crédito.',
      'Pagos anticipados sin penalización y cargo a la nómina conforme al contrato.',
    ],
    limitations: [
      'La página oficial acredita CAT, apertura y condiciones aquí publicadas. El folleto contiene un rango de tasa, pero su tabla no pudo verificarse visualmente y permanece pendiente; esto no significa que el emisor no publique el dato.',
      'El CAT no se usa como sustituto de la tasa ni como cotización individual.',
      'La fecha de vigencia del CAT no se extiende a la comisión de apertura ni al seguro.',
    ],
    evidence: [banortePayroll, banortePayrollBrochure],
  },
  {
    id: 'banamex-personal', familyId: 'personal', name: 'Crédito Personal Banamex', issuer: 'Banamex',
    canonicalUrl: banamexPersonal.url, currency: 'MXN',
    costs: {
      // Read-only public POST used by the issuer page, verified 2026-10-18:
      // https://www.banamex.com/query
      // { operation: 'getAll', site: '7', entity: 'pt_cats', page: '0', page_size: '100' }
      // Row id 118, prod 'Crédito Personal': cat '36.8%', fecha '02 de julio de 2026',
      // fechaVigenciaFin '02 de enero de 2027'. The visible source is the consuming page;
      // the POST endpoint is not offered as a broken GET link. Its tasa '17%' is not
      // selected over the conflicting landing/simulator values.
      cat: datedPercent(36.8, 'CAT promedio publicado por la consulta oficial que utiliza la página; no es una cotización individual.', '2026-07-02', '2027-01-02', 'Sin IVA', [banamexPersonal]),
      interestRate: {
        percent: null, label: 'Anual fija según perfil; las referencias públicas de tasa no coinciden.',
        asOf: null, validThrough: null, taxTreatment: 'Tratamiento de IVA por confirmar para la tasa individual', status: 'unknown', sources: [banamexPersonal],
      },
      openingFee: {
        amount: 0, unit: 'MXN', frequency: 'one-time', label: 'Comisión por apertura', taxTreatment: 'Sin comisión',
        asOf: null, validThrough: null, conditions: 'Sin comisión de apertura; otros cargos por disposición o modalidad son independientes.', sources: [banamexPersonal],
      },
    },
    amountRange: '$10,000–$750,000 MXN', termRange: '24, 36, 48 o 60 meses',
    requirements: [
      'Ser cliente con cuenta Banamex y contar con invitación; sujeto a evaluación.',
      'De 21 a 79 años; la FAQ especifica hasta 79 años y 11 meses. Ingreso mensual mínimo de $8,000 MXN.',
      'Identificación y CURP o documentación de residencia permanente, comprobante de domicilio de hasta tres meses y teléfono.',
    ],
    otherFees: ['Disposición para transferencia de saldo: $150 MXN más IVA; no se presenta como comisión general de apertura.'],
    benefits: [
      'Pagos anticipados sin penalización, conforme al contrato.',
      'Liberación de la deuda por fallecimiento sin costo si el crédito está al corriente; no se equipara a un seguro independiente.',
      'Sin aval, sujeto a invitación y evaluación.',
      'Redisposición hasta diez veces sólo con oferta, pagos al corriente, domiciliación y disponibilidad de al menos $3,000 MXN; disposición mínima de $1,000 MXN.',
    ],
    limitations: [
      'La página comercial, los controles del simulador y el servicio público de datos muestran referencias de tasa distintas. No se elige una ni se construye un rango como si fuera la oferta individual.',
      'El CAT se obtuvo del servicio público que llena la página del producto; no de una simulación ni de datos privados del usuario.',
      'No se documentó una vigencia propia de la apertura sin comisión ni costos de seguros separados.',
    ],
    evidence: [banamexPersonal, banamexBenefits],
  },
  {
    id: 'yotepresto-personal', familyId: 'personal', name: 'Préstamo Personal yotepresto', issuer: 'Comunidad de Préstamos, S.A.P.I. de C.V., IFC',
    canonicalUrl: yoteprestoPersonal.url, currency: 'MXN',
    costs: {
      cat: datedPercent(26.2, 'CAT promedio publicado para fines informativos y de comparación.', '2026-06-15', null, 'Sin IVA', [yoteprestoPersonal, yoteprestoCosts]),
      interestRate: {
        ...datedPercent(null, 'Fija anual según perfil; rango publicado, no cotización individual.', null, null, 'Sin IVA', [yoteprestoPersonal, yoteprestoCosts]),
        minPercent: 8.9, maxPercent: 38.9,
      },
      openingFee: {
        amount: null, unit: 'percent', frequency: 'one-time', label: 'Apertura según perfil', publishedText: '2.9%, 3.9% o 4.9%', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: '2.9% para perfiles A1–A3; 3.9% para A4–A7; 4.9% para B1–C7. Se descuenta del monto fondeado al formalizar; no se cobra si la solicitud se rechaza, no se fondea o no se firma.',
        sources: [yoteprestoCosts],
      },
      maintenanceFee: {
        amount: null, unit: 'MXN', frequency: 'monthly', label: 'Administración mensual según monto del préstamo', publishedText: '$149, $199, $249 o $299 MXN al mes', taxTreatment: 'IVA incluido',
        asOf: null, validThrough: null,
        conditions: 'Tabla publicada: $149 para préstamo de $10,000–$25,000; $199 para $25,001–$49,999; $249 para $50,000–$74,999; $299 desde $75,000 MXN. Incluye IVA y seguro del capital por fallecimiento. Los intervalos se conservan como están publicados, sin interpolar importes con centavos.',
        sources: [yoteprestoCosts, yoteprestoAdministration],
      },
    },
    amountRange: '$10,000–$425,000 MXN', termRange: '6, 12, 18, 24, 30 o 36 meses',
    requirements: [
      'De 21 a 69 años; buen historial crediticio de al menos dos años e ingresos comprobables.',
      'Cuenta bancaria propia e identificación; la FAQ excluye actualmente a empleados de gobierno.',
      'Evaluación de la solicitud y fondeo por la comunidad; la aprobación no garantiza desembolso inmediato.',
    ],
    otherFees: [
      'Mora: $300 MXN más IVA por atraso de al menos tres días hábiles o domiciliación fallida por falta de saldo.',
      'Cobranza extrajudicial: hasta 20% de lo pagado; tratamiento de IVA no especificado para este cargo.',
    ],
    benefits: [
      'Pago anticipado sin comisión ni penalización conforme a las condiciones del préstamo.',
      'Mensualidades fijas salvo el primer periodo y pago domiciliado sin cargo.',
      'El seguro incluido cubre capital insoluto por fallecimiento, no intereses; requiere acta y contempla hasta 120 días hábiles según la FAQ.',
    ],
    limitations: [
      'Es financiamiento colectivo, no un préstamo bancario. El fondeo puede tomar de uno a 25 días; disponibilidad inmediata no garantizada.',
      'No se publica fecha final de vigencia del CAT. La fecha de cálculo del CAT no se atribuye al rango de tasa ni a las comisiones.',
      'La prima del seguro no está desglosada; los cargos escalonados no se promedian ni se transforman en una cuota única.',
      'Las tablas promocionales que comparan otros bancos no se usan como fuente de sus costos.',
    ],
    evidence: [yoteprestoPersonal, yoteprestoCosts, yoteprestoFaq, yoteprestoAdministration],
  },
];
