// Issuer documents reviewed on 2026-10-18. Published observations are not a quotation.
// Monthly fees, annual fees and optional programs remain separate; none is annualized.
const source = (title, url) => ({ title, url });
const hsbcPage = source('HSBC 2Now: tarjeta, requisitos y retiro de recompensas', 'https://www.hsbc.com.mx/tarjetas-de-credito/productos/2now/');
const hsbcBrochure = source('HSBC 2Now: folleto de costos y requisitos', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/tarjetas/folleto_digital_2now.pdf');
const hsbcRewards = source('HSBC 2Now: términos de Puntos 2Now', 'https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/tarjetas/terminos_condiciones_2now.pdf');
const costcoPage = source('Costco Banamex: costos, requisitos y recompensa anual', 'https://www.banamex.com/personas/tarjetas-de-credito/tarjeta-costco');
const costcoFees = source('Costco Banamex: anexo de comisiones, julio de 2026', 'https://www.banamex.com/resources/pdf/es/personas/creditos/tarjetas_credito/anexo-comisiones-costco.pdf');
const plataPage = source('Banco Plata: Tarjeta de Crédito', 'https://bancoplata.mx/es');
const plataBrochure = source('Banco Plata: folleto informativo de Tarjeta de Crédito', 'https://prime.bancoplata.mx/file-service/static/eula/booklet.pdf');
const plataPlus = source('Banco Plata: términos de Plata Plus', 'https://prime.bancoplata.mx/file-service/static/eula/terms_and_conditions_plata_plus.pdf');
const plataRewards = source('Banco Plata: condiciones del programa de cashback', 'https://prime.bancoplata.mx/file-service/static/cashback_conditions_public.pdf');
const plataAnnualPromotion = source('Banco Plata: promoción de exención de anualidades', 'https://prime.bancoplata.mx/file-service/static/terms_and_conditions_early_bird_plata_card_sin_anualidades.pdf');
const heyPage = source('Hey Banco: Tarjetas de Crédito Hey', 'https://banco.hey.inc/universo-hey/para-ti-o-tu-negocio/tarjetas-de-credito-hey');
const heyBrochure = source('Hey Banco: folleto Hey You y Biz, actualización de agosto de 2026', 'https://banco.hey.inc/content/dam/heybanco/folletos/folletos-hey-you-biz.pdf');
const heyRewards = source('Hey Banco: Recompensas, vigentes desde el 3 de febrero de 2026', 'https://banco.hey.inc/content/dam/heybanco/terminos-condiciones/beneficios/recompensas.pdf');
const rappiPage = source('RappiCard: tarjeta y costos publicados', 'https://rappicard.mx/');
const rappiRewards = source('RappiCard: condiciones de cashback, octubre de 2026', 'https://rappicard.mx/condiciones-cashback/');
const banregioWin = source('Banregio: Tarjeta WIN, costos y beneficios', 'https://www.banregio.com/personas/tarjetas/banregio.php');
const banregioPlatinum = source('Banregio: Tarjeta Platinum, costos y beneficios', 'https://www.banregio.com/personas/tarjetas/platinum.php');
const banregioFees = source('Banregio: tabla de comisiones de tarjetas de crédito', 'https://portalbanregio.s3.amazonaws.com/assets/naranja/img/Tarjetas-Credito.pdf');
const storiSimi = source('Stori x Farmacias Similares: condiciones y preguntas frecuentes', 'https://www.storicard.com/farmacias-similares');
const storiFees = source('Stori: costos y comisiones, renglón STORI GREEN', 'https://www.storicard.com/files/costos-y-comisiones-credito.pdf?v=20260213');
const storiAlliances = source('Stori: términos de alianzas, actualización del 11 de junio de 2026', 'https://www.storicard.com/files/terminos-y-condiciones-stori-alianzas.pdf?v=20251114');
const storiGuaranteedFees = source('Stori: costos de Tarjeta Garantizada Nivel 1', 'https://www.storicard.com/files/costos-y-comisiones-garantizada.pdf?v=20261001');
const storiGuaranteedPage = source('Stori: tarjeta con garantía y reserva de depósito', 'https://www.storicard.com/stori-con-garantia');

const datedPercent = (percent, label, asOf, validThrough, taxTreatment, sources) => ({
  percent, label, asOf, validThrough, taxTreatment, status: 'documented', sources,
});

const noAnnualFee = (conditions, sources) => ({
  amount: 0, unit: 'MXN', frequency: 'annual', label: 'Anualidad del titular', classification: 'none', taxTreatment: 'Sin IVA',
  asOf: null, validThrough: null, conditions, sources,
});

const banregioCard = ({ id, name, page, cat, interestRate, income, cashFee, requirements = [], benefits }) => ({
  id, name, issuer: 'Banco Regional · Banregio', canonicalUrl: page.url,
  costs: {
    annualFee: noAnnualFee('Sin anualidad publicada; otros cargos por uso o eventos son independientes.', [page]),
    cat: datedPercent(cat, 'CAT promedio publicado para fines informativos y de comparación.', '2026-04-30', '2026-10-30', 'Sin IVA', [page]),
    interestRate: datedPercent(interestRate, 'Promedio ponderada anual variable.', '2026-04-30', '2026-10-30', 'IVA no precisado para esta tasa', [page]),
  },
  requirements: [
    `De 18 a 79 años y 11 meses; ingreso mensual mínimo publicado de ${income} MXN.`,
    'Identificación, comprobantes de ingresos y domicilio, solicitud y evaluación crediticia.',
    ...requirements,
  ],
  otherFees: [
    `Disposición de efectivo: ${cashFee}% del monto más IVA.`,
    'Tarjeta adicional: $200 MXN más IVA por evento.',
    'Pago tardío: $300 MXN o el pago mínimo, lo que sea menor, más IVA.',
    'Reposición por robo o extravío: $190 MXN más IVA.',
  ],
  benefits,
  limitations: [
    'Topes, vigencia y costos de redención de recompensas no consolidados; no se prometen recompensas ilimitadas ni canje en efectivo.',
    'La tasa promedio publicada no es una cotización individual. El margen sobre TIIE del tarifario no se convierte en una tasa efectiva.',
    'La vigencia de las comisiones no se infiere de la fecha del CAT.',
  ],
  evidence: [page, banregioFees],
});

const simiBenefits = [
  'Beneficio base de 2% en Farmacias Similares, hasta $500 MXN por mes calendario, con asignación al programa y tarjeta al corriente.',
  'Bienvenida: 25% en la primera compra en Farmacias Similares, con límite publicado de $1,000 MXN por mes calendario. Fidelidad: 10% tras completar tres compras fuera de Similares; cada beneficio tiene tope de $500 MXN y acumulación y redención hasta el día 27 del mes.',
  'La FAQ indica transferencia manual del beneficio base de 2% a Stori Cuenta+; la bienvenida se abona a la tarjeta. Los costos de redención no están consolidados.',
];
const simiLimitations = [
  'La asignación a la alianza debe confirmarse. No se suman automáticamente bienvenida, fidelidad y beneficio base.',
  'El encabezado web dice «todas tus compras», pero la FAQ restringe el alcance al ecosistema Simi y los términos a Farmacias Similares. Esta ficha conserva el alcance de los términos.',
  'La FAQ describe una compra mensual para el 10%, mientras los términos permiten continuar tras usar un beneficio previo; la cadencia no se automatiza.',
];

export const additionalCardDetails = [
  {
    id: 'hsbc-2now', name: 'Tarjeta de Crédito HSBC 2Now', issuer: 'HSBC México', canonicalUrl: hsbcPage.url,
    costs: {
      annualFee: {
        amount: 0, unit: 'MXN', frequency: 'annual', label: 'Anualidad del titular', classification: 'none', taxTreatment: 'Sin IVA',
        asOf: null, validThrough: null,
        conditions: 'La administración mensual se cobra por separado si no se cumple el uso requerido.', sources: [hsbcBrochure],
      },
      maintenanceFee: {
        amount: 186, unit: 'MXN', frequency: 'monthly', label: 'Administración mensual del titular', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'Se exenta con al menos $3,500 MXN en operaciones elegibles del titular y adicionales entre fechas de corte.', sources: [hsbcBrochure],
      },
      cat: datedPercent(91.6, 'CAT promedio publicado para fines informativos y de comparación.', '2026-08-07', '2026-12-07', 'Sin IVA', [hsbcBrochure]),
      interestRate: datedPercent(45.42, 'Promedio ponderada por saldo, anual variable.', '2026-08-07', '2026-12-07', 'IVA no precisado para esta tasa', [hsbcBrochure]),
    },
    requirements: [
      'De 18 a 74 años y 11 meses; ingreso mensual mínimo publicado de $15,000 MXN.',
      'Un año en el empleo actual, historial crediticio, identificación y comprobantes requeridos por HSBC.',
      'Sujeta a evaluación y aprobación individual.',
    ],
    otherFees: [
      'Administración mensual de adicional: $49 MXN más IVA; se exenta con $1 MXN en operaciones elegibles de esa adicional entre cortes.',
      'Pago tardío: $509 MXN más IVA por evento.',
      'Disposición de efectivo: 8% del monto más IVA.',
    ],
    benefits: [
      '2% en Puntos 2Now sobre los primeros $42,500 MXN de compras elegibles entre cortes: máximo 850 puntos. Un punto equivale a $1 MXN para canje; los puntos vencen en 12 meses.',
      'Canje en comercios físicos o retiro de Saldo 2Now en HSBC o MULTIRED, con tarjeta al corriente y sin bloqueo. El saldo acumulado no es efectivo disponible hoy.',
    ],
    limitations: [
      'Los términos de recompensas excluyen meses sin intereses en un párrafo y después indican considerarlos por su total. Se conserva el conflicto y no se calcula esa modalidad.',
      'El CAT y la tasa promedio no sustituyen las condiciones de la oferta o contrato individual.',
      'La vigencia de las comisiones no se infiere de la vigencia del CAT.',
    ],
    evidence: [hsbcPage, hsbcBrochure, hsbcRewards],
  },
  {
    id: 'banamex-costco', name: 'Tarjeta de Crédito Costco Banamex', issuer: 'Banamex', canonicalUrl: costcoPage.url,
    costs: {
      annualFee: {
        amount: null, unit: 'MXN', frequency: 'annual', label: 'Anualidad por confirmar', classification: 'unknown', taxTreatment: 'Por confirmar',
        asOf: null, validThrough: null,
        conditions: 'El cobro vigente se presenta como administración mensual. El legal conserva $650 MXN de administración; no se suma ni se convierte en una anualidad adicional.',
        sources: [costcoPage, costcoFees],
      },
      maintenanceFee: {
        amount: 54.17, unit: 'MXN', frequency: 'monthly', label: 'Administración mensual del titular', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'El anexo de julio de 2026 establece cobro mensual. La página explica la transición de pagos anteriores al 30 de julio de 2026; confirmar el calendario individual.',
        sources: [costcoFees, costcoPage],
      },
      cat: datedPercent(79.9, 'CAT promedio publicado para fines informativos y de comparación.', '2026-07-27', '2027-01-27', 'Sin IVA', [costcoPage]),
      interestRate: datedPercent(58.29, 'Promedio ponderada anual; crédito de tasa variable.', '2026-07-27', '2027-01-27', 'IVA no precisado para esta tasa', [costcoPage]),
    },
    requirements: [
      'Mayor de 18 años; ingreso mensual mínimo comprobable de $7,000 MXN.',
      'INE o documentación de residencia y pasaporte para extranjeros; comprobante de domicilio de hasta tres meses.',
      'Sujeta a evaluación y aprobación individual.',
    ],
    otherFees: [
      'Administración mensual de adicional: $27.08 MXN más IVA.',
      'Pago tardío: $360 MXN más IVA por evento.',
      'Reposición por robo o extravío: $130 MXN más IVA.',
    ],
    benefits: [
      'Reembolso anual: gasolina Costco 5% hasta $10,000 MXN de facturación mensual y después 3%; educación 4% hasta $20,000 MXN y después 1%; Costco 3%; restaurantes, streaming, TV e internet 2%; otras compras y agregadores 1%.',
      'La recompensa se acredita en diciembre estando al corriente y se usa sólo en tiendas físicas Costco México. No aplica en gasolinas ni en costco.com.mx.',
    ],
    limitations: [
      'La recompensa tiene canje restringido; no equivale a cashback líquido ni a una devolución inmediata.',
      'El cálculo de recompensas depende de tramos y gasto previo del periodo; no se sustituye por una tasa única.',
      'El anexo sólo identifica julio de 2026; no se inventa un día de publicación ni una vigencia para las cuotas.',
    ],
    evidence: [costcoPage, costcoFees],
  },
  {
    id: 'plata-credito', name: 'Tarjeta de Crédito Plata', issuer: 'Banco Plata, S.A., Institución de Banca Múltiple', canonicalUrl: plataPage.url,
    costs: {
      annualFee: {
        amount: 199, unit: 'MXN', frequency: 'annual', label: 'Anualidad base', classification: 'annual', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'Tarifa base anual; el folleto indica sin costo los primeros tres meses. La exención promocional depende de elegibilidad y vigencia.', sources: [plataBrochure, plataAnnualPromotion],
      },
      cat: datedPercent(169.3, 'CAT promedio publicado para fines informativos y de comparación.', '2026-09-18', null, 'Sin IVA', [plataBrochure]),
      interestRate: datedPercent(105.91, 'Ordinaria fija anual, promedio ponderada por saldo.', '2026-09-18', null, 'Sin IVA', [plataBrochure]),
      optionalSubscriptionFee: {
        amount: 99, unit: 'MXN', frequency: 'monthly', label: 'Plata Plus opcional · importe máximo', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'Membresía opcional para Crédito: hasta $99 MXN más IVA al mes. El importe individual se informa en la aplicación; no es un cargo obligatorio de la tarjeta.',
        sources: [plataPlus],
      },
    },
    requirements: [
      'Mayor de edad, mexicano o extranjero residente con identificación y documentación migratoria aplicable.',
      'Solicitud y evaluación individual; ingreso mínimo no consolidado en esta ficha.',
    ],
    otherFees: [
      'Pago tardío: $400 MXN más IVA por evento. Disposición de efectivo: 10% del monto más IVA.',
      'Contratar parcialización a 3, 6, 9 o 12 meses tiene cargos de 10.5%, 21%, 22.5% o 30% más IVA, respectivamente, sobre el importe inicial. Meses sin intereses no implica libre de estos cargos.',
    ],
    benefits: [
      'Selecciona categorías cada mes. «Todas tus compras» devuelve 0.5% sin Plus o 1% con Plus; tope compartido mensual de $1,000 MXN o $3,000 MXN, respectivamente. Algunas categorías llegan a 15%, según oferta individual y sus condiciones.',
      'El cashback se abona a Plata Cuenta o al crédito si no hay cuenta. Las operaciones excluidas y la elegibilidad de cada compra se rigen por los términos del programa.',
      'La promoción de exención de anualidades está dirigida a mexicanos mayores de 18 años y nuevos clientes durante la promoción; se pierde si coinciden pago en exceso no reclamado e inactividad superior a tres meses.',
    ],
    limitations: [
      'No se documentó una fecha de fin de vigencia para el CAT ni la tasa; la fecha de cálculo no prueba vigencia actual.',
      'El tarifario lista «Recompensas básico» por $99 MXN más IVA al mes. No se determinó su obligatoriedad ni si se acumula con Plus; no se trata como un cargo inevitable.',
      'Los términos de Plus permiten hasta diez categorías elegibles y los de cashback mencionan hasta cuatro sin distinguir modalidad. No se consolida un número universal.',
      'El aviso web de promoción dice hasta el 19 de octubre sin indicar el año; no se adopta como una fecha ISO ni se garantiza elegibilidad.',
      'No se descuenta ni se justifica el costo de Plus mediante una estimación aislada de recompensa por compra.',
    ],
    evidence: [plataPage, plataBrochure, plataPlus, plataRewards, plataAnnualPromotion],
  },
  {
    id: 'hey-credito', name: 'Tarjeta de Crédito Hey', issuer: 'Hey Banco', canonicalUrl: heyPage.url,
    costs: {
      annualFee: {
        amount: null, unit: 'MXN', frequency: 'annual', label: 'Anualidad según modalidad', classification: 'conditional', taxTreatment: 'Más IVA en el programa Recompensas',
        asOf: null, validThrough: null,
        conditions: 'Sin anualidad en la modalidad sin Recompensas; $600 MXN más IVA al año al contratar Recompensas. El CAT publicado contempla esta anualidad.',
        sources: [heyBrochure, heyRewards, heyPage],
      },
      cat: datedPercent(58.6, 'CAT promedio de la modalidad con Recompensas opcionales; contempla administración de $600 MXN más IVA al año. No se traslada a la modalidad sin el programa.', '2026-04-30', '2026-10-30', 'Sin IVA', [heyBrochure]),
      interestRate: datedPercent(45.45, 'Promedio ponderada anual variable.', '2026-04-30', '2026-10-30', 'IVA no precisado para esta tasa', [heyBrochure]),
      optionalSubscriptionFee: {
        amount: 600, unit: 'MXN', frequency: 'annual', label: 'Recompensas Hey opcionales · cuota anual', taxTreatment: 'Más IVA',
        asOf: null, validThrough: null,
        conditions: 'Programa opcional de $600 MXN más IVA al año; renovación automática y sin reembolso del periodo contratado al cancelar. La modalidad sin Recompensas no cobra esta cuota.',
        sources: [heyRewards, heyBrochure],
      },
    },
    requirements: [
      'Solicitud y evaluación individual; la página publica una línea de hasta $250,000 MXN sujeta a aprobación.',
      'Edad e ingreso mínimos no consolidados en esta ficha.',
      'Para Recompensas: Cuenta Hey activa y validada, y tarjetas de crédito y de recompensas activas.',
    ],
    otherFees: [
      'Pago tardío: $300 MXN más IVA.',
      'Disposición de efectivo: 6% del monto más IVA.',
      'Tarjeta adicional: $100 MXN más IVA por evento. Reposición por robo o extravío: $150 MXN más IVA.',
    ],
    benefits: [
      'Recompensas opcionales por $600 MXN más IVA al año: 1% en compras elegibles y 1% adicional con tarjeta virtual en los comercios enumerados; no es 2% en cualquier compra por internet.',
      'Tope mensual equivalente al 1% de la línea de crédito. Las recompensas vencen en dos años.',
      'Uso mediante Tarjeta de Recompensas o transferencia a Cuenta Hey. La transferencia tiene una retención publicada de 20%; esta retención no aplica al uso de la Tarjeta de Recompensas.',
    ],
    limitations: [
      'Recompensas excluye efectivo, SPEI, hoteles, renta de autos, casinos y apuestas, intereses y comisiones, según sus términos.',
      'El programa se renueva automáticamente cada año; cancelar no reembolsa el periodo contratado.',
      'El folleto combina una referencia TIIE más margen con un máximo de tasa; no se convierten en un rango numérico comparable ni en una tasa personalizada.',
      'No se infiere una comisión mensual de cero ni una vigencia de cuotas a partir del CAT.',
    ],
    evidence: [heyPage, heyBrochure, heyRewards],
  },
  {
    id: 'rappicard', name: 'RappiCard', issuer: 'Banco Mercantil del Norte', canonicalUrl: rappiPage.url,
    costs: {
      annualFee: {
        ...noAnnualFee('Anualidad publicada en el sitio de RappiCard; no implica que no existan comisiones por otros eventos.', [rappiPage]),
        taxTreatment: 'Sin comisión anual',
      },
      cat: datedPercent(101.4, 'CAT promedio publicado para fines informativos y de comparación.', null, '2026-12-06', 'Sin IVA', [rappiPage]),
      interestRate: datedPercent(71.77, 'Promedio ponderada anual fija.', null, '2026-12-06', 'Sin IVA', [rappiPage]),
    },
    requirements: [
      'Mayor de 18 años; solicitud y evaluación individual.',
      'Para las recompensas: ser titular y estar al corriente, sujeto a confirmación del programa aplicable al contrato.',
      'Ingreso mínimo y edad máxima no consolidados en esta ficha.',
    ],
    otherFees: ['Cargos por atraso, disposición de efectivo y reposición no consolidados; el anexo anterior encontrado está vencido. No se consideran iguales a cero.'],
    benefits: [
      'Términos de cashback publicados para el 1–31 de octubre de 2026: 1% con tarjeta física o digital; 3% dentro de Rappi, incluido Travel; 5% con Rappi Pro Black dentro de Rappi, excepto Travel. Su aplicabilidad al contrato Banorte debe confirmarse.',
      'Para las tasas dentro de Rappi, la tarjeta debe cargarse automáticamente en la aplicación de su titular; el alta manual recibe 1%. Pro Black es una suscripción cuyo costo no está consolidado aquí.',
      'El tope publicado es $1,500 MXN durante la vigencia del contrato, ampliable discrecionalmente hasta $5,000 MXN; no es mensual. Canje como abono a la deuda desde $1 MXN, o tarjetas de regalo y recargas desde $10 MXN.',
    ],
    limitations: [
      'El aviso publica vigencia del 7 de junio al 6 de diciembre de 2026, pero no fecha de cálculo. No se usa el inicio de vigencia como fecha de cálculo.',
      'Los términos de cashback todavía identifican a Tarjetas del Futuro, S.A.P.I., mientras el sitio identifica a Banorte. Deben confirmarse vigencia y aplicabilidad por contrato; no se extienden los beneficios a todo nuevo cliente Banorte.',
      'No se trasladan comisiones del anexo de enero–junio de 2026 ni se presume que el 5% esté incluido gratuitamente en cualquier tarjeta.',
    ],
    evidence: [rappiPage, rappiRewards],
  },
  banregioCard({
    id: 'banregio-win', name: 'Tarjeta WIN Banregio', page: banregioWin, cat: 40.6, interestRate: 34.2,
    income: '$50,000', cashFee: 5,
    benefits: ['1% de recompensas con tarjeta física y 2% en compras por internet con la Tarjeta Virtual. Permite pagar con el saldo de recompensas, sujeto a reglas de redención.'],
  }),
  {
    id: 'stori-simi-green', name: 'Stori Green x Farmacias Similares', issuer: 'Stori México, S.A. de C.V., Sociedad Financiera Popular', canonicalUrl: storiSimi.url,
    costs: {
      annualFee: noAnnualFee('La comisión de apertura de STORI GREEN es independiente de la anualidad.', [storiFees]),
      cat: datedPercent(202.2, 'CAT promedio ponderado de STORI GREEN.', '2026-07-01', '2026-12-31', 'Sin IVA', [storiFees]),
      interestRate: datedPercent(114.6, 'Fija promedio ponderada anual de STORI GREEN.', '2026-07-01', '2026-12-31', 'Sin IVA', [storiFees]),
      openingFee: {
        amount: 500, unit: 'MXN', frequency: 'one-time', label: 'Comisión por apertura', taxTreatment: 'No especificado en el renglón',
        asOf: null, validThrough: null,
        conditions: 'Contratación por apertura, una sola vez, para STORI GREEN; confirmar el tratamiento de IVA.', sources: [storiFees],
      },
    },
    requirements: [
      'Persona física mayor de edad y nuevo cliente, con elegibilidad y notificación de Stori para la alianza.',
      'INE, comprobante de domicilio y selfie según el proceso de solicitud.',
      'La FAQ excluye la solicitud para clientes actuales de Green o Black; ingreso mínimo no consolidado.',
    ],
    otherFees: ['Falta de pago: $300 MXN más IVA por evento.', 'Reposición por robo, extravío o deterioro: $150 MXN más IVA.'],
    benefits: [...simiBenefits],
    limitations: [
      'El tarifario STORI GREEN indica su aplicación a tarjetas de programa de lealtad; no se usa el renglón STORI GREEN CLÁSICA.',
      ...simiLimitations,
    ],
    evidence: [storiSimi, storiFees, storiAlliances],
  },
  {
    id: 'stori-simi-garantizada', name: 'Stori Garantizada Nivel 1 x Farmacias Similares', issuer: 'Stori México, S.A. de C.V., Sociedad Financiera Popular', canonicalUrl: storiAlliances.url,
    availability: 'Variante documentada; contratación individual y asignación de alianza por confirmar.',
    costs: {
      annualFee: noAnnualFee('La reserva de depósito es una garantía, no una comisión anual.', [storiGuaranteedFees]),
      cat: datedPercent(241, 'CAT promedio ponderado de Stori Garantizada Nivel 1.', '2026-07-01', '2026-12-31', 'Sin IVA', [storiGuaranteedFees]),
      interestRate: datedPercent(129.1, 'Fija promedio ponderada anual de Stori Garantizada Nivel 1.', '2026-07-01', '2026-12-31', 'Sin IVA', [storiGuaranteedFees]),
      openingFee: {
        amount: null, unit: 'MXN', frequency: 'one-time', label: 'Apertura de la tarjeta por verificar', taxTreatment: 'Por verificar',
        asOf: null, validThrough: null,
        conditions: 'No se consolidó el costo de apertura de la tarjeta. La contratación sin costo del depósito no acredita que la apertura de la tarjeta cueste cero.', sources: [storiGuaranteedFees, storiGuaranteedPage],
      },
    },
    requirements: [
      'Mayor de 18 años y nuevo cliente, con asignación específica al programa de alianza confirmada por Stori.',
      'Reserva de depósito que respalda la línea, hasta $20,000 MXN; el mínimo depende de lo indicado en la aplicación.',
      'La página no exige comprobante de ingresos ni historial para la modalidad garantizada; la solicitud sigue sujeta al proceso del emisor.',
    ],
    otherFees: ['Falta de pago: $300 MXN más IVA.', 'Reposición: $150 MXN más IVA por evento.'],
    benefits: [
      ...simiBenefits,
      'La parte no utilizada de la reserva puede liberarse conforme al proceso; el resto se libera al pagar la deuda.',
    ],
    limitations: [
      'Las tasas corresponden exclusivamente a Nivel 1; el tarifario identifica Nivel 2 como próximamente.',
      'No se traslada la apertura de $500 MXN de STORI GREEN a la variante garantizada.',
      'El GAT de la cuenta de depósito encontrado tenía vigencia vencida en julio de 2026; no se reutiliza como rendimiento de ahorro actual.',
      ...simiLimitations,
    ],
    evidence: [storiSimi, storiAlliances, storiGuaranteedFees, storiGuaranteedPage],
  },
  banregioCard({
    id: 'banregio-platinum', name: 'Tarjeta Platinum Banregio', page: banregioPlatinum, cat: 34.1, interestRate: 29.6,
    income: '$75,000', cashFee: 4,
    requirements: ['Experiencia con una tarjeta de crédito bancaria con línea de $50,000 MXN.'],
    benefits: ['1.25% de recompensas con tarjeta física y 1.5% en compras por internet con la Tarjeta Virtual o con la física en el extranjero; redención sujeta a sus reglas.'],
  }),
];
