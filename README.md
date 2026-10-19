# Sifran

Finanzas personales para **Gairo y Ricardo**, con espacios independientes, inicio de sesión con ChatGPT y registros sincronizados entre dispositivos. React 18, Vite, Tailwind, Recharts y un Worker con D1 en Sites.

## Identidad

**Sifran** (SÍ-fran) es una marca creada a partir de la raíz árabe *ṣifr*. Reconoce la historia del cero en la matemática india y su transmisión a través de la matemática árabe, sin atribuir su invención a una sola cultura. Referencias: [historia del cero](https://mathshistory.st-andrews.ac.uk/HistTopics/Zero/) y [etimología de zero](https://mathshistory.st-andrews.ac.uk/Miller/mathword/z/), MacTutor, University of St Andrews.

El isotipo forma un cero con dos trazos opuestos, como entradas y salidas. Los SVG son editables y no contienen imágenes rasterizadas, scripts ni tipografías externas. El nombre está convertido a trazos de Plus Jakarta Sans; licencia en `public/brand/OFL.txt`.

- `public/brand/sifran-logo.svg`: logotipo para fondo oscuro.
- `public/brand/sifran-logo-dark.svg`: logotipo para fondo claro.
- `public/brand/sifran-logo-mono.svg`: una tinta.
- `public/brand/sifran-mark.svg`: isotipo transparente.
- `public/icon.svg`: icono de aplicación.

La elección del nombre no constituye una búsqueda registral de marca.

## Cuentas y sincronización

El acceso usa las rutas gestionadas `/signin-with-chatgpt` y `/signout-with-chatgpt`. No hay contraseñas predeterminadas ni un selector que conceda acceso por elegir un nombre. El correo autenticado debe coincidir con una invitación configurada en el servidor. Al completar el alta, el ID estable queda vinculado a Gairo o Ricardo; cambiar de correo no reasigna la cuenta.

Cada solicitud comprueba la cuenta esperada antes de leer finanzas o consumir Claude. Además, Sites limita quién puede abrir el sitio. El proyecto empieza privado para su propietario. Activar Ricardo requiere su correo de acceso y añadirlo al público autorizado del Site. Ricardo comienza vacío; no se comparten contraseñas ni datos entre ambos.

Una corrección de correo de una cuenta ya activada requiere un permiso de transferencia explícito del administrador: `SIFRAN_<CUENTA>_REBIND_FROM_USER_ID`, `SIFRAN_<CUENTA>_REBIND_TO_EMAIL` y `SIFRAN_<CUENTA>_REBIND_UNTIL` (fecha ISO UTC), junto con la invitación al nuevo correo. El identificador anterior debe obtenerse del registro real, nunca inferirse de un nombre o correo. La nueva persona autenticada debe pulsar **Activar mi cuenta** antes de que venza el permiso. La operación conserva los registros y la cuota de la cuenta, reemplaza el sujeto exacto y consume el permiso al cambiarlo. Después, elimina esas tres variables del entorno. Modificar sólo el correo de invitación no transfiere una cuenta ocupada.

Se sincronizan movimientos, deudas, activos, presupuesto, pagos marcados, escenarios de ahorro, progreso de educación, moneda y tipo de cambio manual. La vista privada, sonidos y respuesta háptica son preferencias del dispositivo. Conversaciones y archivos seleccionados permanecen en memoria de la pestaña.

Los cambios se envían automáticamente tras una pausa breve. **«Guardado en la nube» sólo aparece después de la confirmación del servidor.** La app busca cambios cada 15 segundos mientras está visible, al recuperar el foco, al reconectar y mediante el botón de actualización. No promete colaboración en tiempo real.

Dos dispositivos no pueden sobrescribir silenciosamente la misma revisión. Si coinciden cambios, se conserva el borrador en esa pestaña y se permite descargarlo antes de abrir la versión de nube. Una respuesta perdida se reintenta con el mismo identificador de operación. Mantén la pestaña abierta mientras existan pendientes: no hay almacenamiento financiero sin conexión. Ante una sesión vencida, el espacio se oculta y el borrador sólo se recupera tras verificar la misma cuenta.

## Recuperar los registros anteriores de Gairo

El sitio publicado y localhost tienen orígenes diferentes; el Site no puede leer automáticamente el almacenamiento de la instalación anterior.

1. Abre la instalación local en el navegador donde estaban los registros.
2. En la pantalla de acceso, descarga el respaldo anterior. Si está dañado, puedes descargar el original para recuperarlo sin modificarlo.
3. Abre el Site, entra como Gairo y ve a **Ajustes → Importar respaldo**.
4. Comprueba la cuenta y los conteos, confirma y espera a que aparezca **Guardado en la nube**.

La importación inicial sólo se admite en el espacio vacío de Gairo. Un respaldo nuevo identifica su propietario y no puede restaurarse en la otra cuenta. Reemplazar registros existentes requiere confirmación; descarga primero un respaldo de la cuenta actual. El original local nunca se borra ni se reemplaza automáticamente.

El documento financiero guardado admite hasta **1,500,000 bytes de JSON**. El archivo de respaldo puede pesar hasta 3 MB por el formato de exportación; también debe cumplir el límite del documento. Se rechaza íntegro si es demasiado grande, sin truncar movimientos. Los datos personales heredados no se incluyen como valores iniciales del cliente ni como semillas de la base.

## Desarrollo y pruebas

```powershell
npm install --legacy-peer-deps
npm run dev
```

Abre http://localhost:5173. La vista local permite revisar el acceso y recuperar el respaldo anterior. No simula identidad de Sites ni accede a cuentas financieras remotas. Las API privadas muestran conexión pendiente; `GET /api/reference-rates` sí puede consultar las cuatro fuentes oficiales públicas desde URLs fijas, sin enviar datos de la cuenta. La autenticación y sincronización completas se verifican en el Site privado.

```powershell
node scripts/check-market-data.mjs
npm test
npm run build
```

El control de datos de mercado se ejecuta antes de integrar cambios en directorios, fichas y programas. Revisa el resultado junto con las fuentes y fechas: una comprobación estructural no acredita vigencia comercial ni sustituye la revisión editorial. La última suite completa aprobó 931 pruebas en 43 archivos; el build final terminó sin advertencias. Comandos, entradas y resultados se conservan en [la verificación automatizada](artifacts/ui-review/product-polish-tests-summary-r4.json).

Las pruebas de persistencia usan SQLite real en memoria mediante Python 3, sin datos personales ni llamadas pagadas a Anthropic. La compilación produce `dist/client`, `dist/server/index.js` y metadatos Sites. El adaptador oficial se usa únicamente durante build con Vite 6.4.3; se verificó la integración con Node 20.15.1. Su manifiesto declara Node 22.13+/Vite 8, por lo que esta instalación conserva explícitamente `--legacy-peer-deps` y no habilita su simulador local de autenticación.

El origen autorizado está en `server/sites/router.js`. Cambiar el dominio requiere actualizarlo y verificar el despacho de identidad. El Worker confía en los headers del dispatcher gestionado: no debe exponerse directamente en otro hosting que permita falsificarlos. Los adaptadores anteriores de Vercel y Netlify están retirados y devuelven 410.

El esquema está en `db/schema.ts`. `npm run db:generate` genera migraciones Drizzle; las ya aplicadas son inmutables. Sites configura el binding lógico `DB` y aplica las migraciones de esquema incluidas en el paquete. No se ejecuta DDL durante solicitudes de usuario.

## Experiencia

- Inicio vacío con cuatro tareas: registrar un movimiento, seguir un cobro, organizar una deuda y explorar productos financieros. El presupuesto es opcional y no genera un asunto de revisión por estar vacío.
- Seis destinos principales con descripciones: Resumen, Plan de pagos, Movimientos, Presupuesto, Patrimonio y Herramientas. El directorio conserva búsqueda y objetivo durante la sesión; la búsqueda prioriza los nombres exactos e incluye términos como «cobro» o «cajitas».
- Navegación móvil con acceso directo al plan, búsqueda `Ctrl/Cmd + K`, foco visible y transiciones con Motion que respetan movimiento reducido.
- Resumen adaptado a los registros disponibles: movimientos y cobros pendientes aparecen aunque no haya presupuesto. Los cobros conservan su moneda y se distinguen del saldo disponible; los saldos incompletos no se presentan como cero.
- Registro rápido contextual con `N`: guardar conserva la vista actual, los recientes requieren confirmación y el aviso permite ver o deshacer. Vista privada con `Ctrl/Cmd + Shift + P`.
- Con presupuesto configurado, el Resumen conserva margen estimado, cascada, patrimonio, deuda y próximos pagos sin marcar.
- Movimientos con búsqueda, periodo, categorías, importación revisada y eliminación con deshacer.
- Totales en MXN o USD; «Original» conserva cada moneda en filas y usa MXN para agregados.
- Cuatro reglas de pago, proyecciones completas y tabla de resultados, sin inventar liquidación al agotar el horizonte.
- Presupuesto editable desde cero, respaldos JSON, exportación Excel, impresión y herramientas de educación y cálculo.

Las rutas aparecen en la URL y admiten Atrás/Adelante. Los paneles del plan usan `#plan?panel=...`, las calculadoras `#calculators?tool=...`, movimientos `#transactions?view=registered|expected` y mercado `#credit-library?view=cards|loans|savings|purchase`. En móvil, «Herramientas» abre el catálogo completo con búsqueda y un selector de objetivo. Volver al directorio recupera el control de origen y su posición; abrir una sección desde la paleta lleva al contenido de destino. Los formularios de movimientos y la revisión de importaciones conservan su estado al cambiar de sección.

Cuando la edición del espacio está pausada, Herramientas sigue permitiendo buscar y navegar. Las acciones de edición muestran el motivo de su bloqueo; la vista privada conserva sus propias restricciones.

Presupuesto, deudas y patrimonio enlazan al editor del plan cuando sus registros coinciden con la conciliación. Si existen ajustes o registros independientes, se conservan sus pantallas de edición con una indicación de origen. Guardar un escenario aplica únicamente los campos modificados; importar una conciliación revisada permite reemplazar el inventario explícitamente.

Las pruebas canónicas sólo incluyen `src/` y `tests/`; se excluyen copias históricas y vistas de prueba en `artifacts/`. Las vistas locales de QA con datos sintéticos no forman parte del cliente compilado ni acreditan sincronización remota.

La revisión del Resumen reúne fechas, movimientos y datos pendientes. Cada asunto explica su causa y abre el registro o filtro correspondiente; volver conserva el paso durante la sesión. Cerrar o continuar no confirma pagos. La edición de movimientos conserva su ID y metadatos importados, y permite deshacer campos sin sobrescribir modificaciones posteriores. Los enlaces desde la revisión conservan mes, categoría y fecha límite de los movimientos considerados.

La cascada del presupuesto conserva el acumulado y el cero común al cambiar de orientación en pantallas estrechas. El simulador compara referencia y escenario por fecha, cuenta y moneda, distingue apertura de cierre, muestra mínimos y faltantes y ofrece una tabla con el mismo alcance. Sus valores son proyecciones, no acreditaciones bancarias. La investigación, fuentes y decisiones de esta iteración se documentan en [docs/ux-research.json](docs/ux-research.json); las propuestas futuras están separadas de las funciones implementadas.

## Mercado de México y decisiones de compra

**Herramientas → Explorar productos financieros** abre «Productos financieros en México», con categorías Tarjetas, Préstamos y Ahorro. **Qué tarjeta usar** ofrece acceso directo a la comparación de una compra. La búsqueda, los filtros y la carga progresiva permiten explorar sin presentar todas las fichas a la vez.

| Capa de información | Cobertura del corte editorial del 18 de octubre de 2026 |
|---|---|
| Directorio de tarjetas | 192 productos identificados. |
| Financiamiento | 109 productos, modalidades o programas; no son 109 préstamos directos independientes. |
| Evidencia del directorio | 247 URLs referenciadas; los estados distinguen oferta documentada y contratación por confirmar. |
| Fichas de costos | 17 tarjetas y 13 ofertas de préstamos; los campos pendientes permanecen explícitos. |
| Programas de beneficios | 25 documentados con alcance explícito. |
| Reglas calculables | 5 programas en 4 tarjetas: LikeU, Plata —sin Plus y con Plus—, HSBC 2Now y Simi x Stori Green. |
| Ahorro e inversión | 65 modalidades: 58 fichas detalladas y 7 registros limitados; 59 fuentes primarias. |

Identificación, ficha de costos y regla calculable son niveles distintos de evidencia. El directorio incluye tarjetas de crédito, servicios, cooperativas y tiendas; préstamos, modalidades y programas institucionales conservan su tipo. Un registro histórico, una invitación o una lista de espera no se presenta como oferta disponible para cualquier persona. Se deduplican alias, migraciones, campañas, niveles y versiones físicas/digitales; una modalidad materialmente distinta se conserva con su alcance.

Las listas muestran CAT, tasa ordinaria, anualidad y cargos periódicos de tarjetas, junto a beneficios publicados; en préstamos, CAT, tasa, apertura, mantenimiento, monto y plazo aparecen antes de los requisitos desplegables. Cada costo conserva fuente, tratamiento de IVA y fechas conocidas. Los rangos no se promedian y las membresías opcionales no se suman automáticamente a la anualidad. «Con costos documentados» facilita la entrada; «Con beneficios» y «Todo el directorio» conservan acceso visible al resto del catálogo.

La comparación usa las tarjetas que la persona declara tener y una compra concreta: importe, fecha, categoría, canal, modalidad de pago, condiciones y tope restante del periodo. La selección de tarjetas y de modalidades de ahorro se guarda en las preferencias de cada espacio privado; compra, topes y confirmaciones temporales se vuelven a evaluar. Recordar tarjetas no crea deudas ni verifica crédito disponible. No transforma desconocidos en cero, no estima intereses desde CAT y no afirma que una tarjeta sea la mejor en general. Las reglas incompletas, contradictorias o con revisión vencida conservan su explicación. La primera evaluación muestra qué falta confirmar; cada resultado reúne sus ajustes con Aplicar y Cancelar.

Simi x Stori Green permite estimar acumulación bruta, pero queda fuera de la recomendación de efectivo comparable mientras sus costos de redención sigan sin confirmar. Saldo HSBC 2Now se expresa como equivalente estimado en MXN según las condiciones documentadas de canje; no es efectivo disponible inmediatamente. Una recomendación comparable requiere pago total confirmado y evidencia suficiente; puntos, monederos, bonificaciones y promociones no se suman como si fueran efectivo universal.

Ahorro permite comparar hasta tres modalidades por disponibilidad, mecanismo, liquidez, rendimiento publicado, costos, requisitos, entidad, protección y fechas. Sus 65 modalidades no equivalen a 65 proveedores. Las 248 observaciones conservan 231 cifras y 17 desconocidos; tasa anual, GAT nominal, GAT real, objetivo promocional y rendimiento histórico no se ordenan como si fueran equivalentes. No calcula ganancias ni atribuye a fondos o reportos la protección de depósitos bancarios. Ejemplos primarios: [mecanismos de GBM](https://gbm.com/faqs/que-diferencia-existe-entre-smart-cash-y-smart-cash-dolares/), [fondo utilizado en Mercado Pago](https://www.mercadopago.com.mx/ayuda/Terminos-rendimientos_15581) y [condiciones de Apartados Open](https://www.openbank.mx/assets/OK_MX/es-MX/precontract/v1/MX.OB.CUENTA.NOREM.T%26C.pdf).

La [auditoría de ahorro](docs/mexico-savings-market.json) registra 24 fichas con razón social completa por consolidar y 115 observaciones numéricas con alguna fecha pendiente. Covalto, Banco Azteca, Sabadell y Kubo conservan evidencia limitada por acceso insuficiente; Libertad queda como pendiente documental. Una ficha detallada no implica contrato íntegro ni elegibilidad confirmada.

Fuentes de las reglas calculables: [Santander Cashback Baby](https://assets.santandermedia.com/adobe/assets/urn:aaid:aem:7d6d6b86-b947-4401-996e-830a04318331/original/as/tyc-cashback.pdf), [Plata](https://prime.bancoplata.mx/file-service/static/cashback_conditions_public.pdf), [HSBC 2Now](https://www.hsbc.com.mx/content/dam/hsbc/mx/documents/tarjetas/terminos_condiciones_2now.pdf) y [alianzas Stori](https://www.storicard.com/files/terminos-y-condiciones-stori-alianzas.pdf?v=20251114). Cada ficha conserva sus propios enlaces.

### Cómo se actualiza la información

Los directorios, costos, beneficios y modalidades de ahorro son **snapshots editoriales versionados**. Esta versión no incluye un crawler ni un monitor de productos funcionando. La fecha de consulta no acredita vigencia: se distinguen publicación, periodo, disponibilidad comercial, vigencia contractual y revisión editorial.

Sólo cuatro referencias oficiales tienen una consulta GET refrescable: CETES a 28 días, FIX, UDI e inflación anual del INPC. El adaptador de [referencias públicas](server/references/publicRates.js) conserva fechas y estados de frescura, limita las respuestas y usa caché. Actualizar una referencia no modifica automáticamente un supuesto de inversión. CETES es una referencia anualizada de una colocación; FIX no es el precio de compra o venta de un banco y la inflación observada no es un pronóstico. Fuentes: [Banco de México](https://www.banxico.org.mx/statistics/rss-indicators-banco-mexico.html) e [INEGI](https://www.inegi.org.mx/servicios/feedsnoticias/feeds.html).

La ampliación automática futura requiere revisar fuentes y derechos de uso, detectar cambios y resolver conflictos antes de publicar. El directorio actual es parcial; no acredita todo el mercado, aprobación individual ni verificación registral completa.

### Investigación y estado de verificación

El [informe editorial](docs/daily-value-research.html) y su [evidencia estructurada](docs/daily-value-research.json) conservan la investigación previa. La [ampliación de literatura y comunidades](docs/product-excellence-research.html), con [evidencia estructurada](docs/product-excellence-research.json), documenta cinco decisiones, sus límites y un protocolo de usabilidad todavía no ejecutado. El [inventario de crédito](docs/mexico-credit-market.json) registra cobertura y deduplicación; la [auditoría de costos y beneficios](docs/mexico-credit-details.json) refleja las fichas cuantitativas integradas, con fuentes por campo. Los datos operativos viven en [directorio de crédito](src/data/mexicoCreditDirectory.js), [fichas de costos](src/data/creditCatalog.js), [programas de beneficios](src/data/cardBenefits.js) y [catálogo de ahorro](src/data/mexicoSavingsCatalog.js).

**Verificación local actual:** 931 pruebas en 43 archivos y build final sin advertencias. El navegador aprobó 47 comprobaciones en 11 grupos sobre fixtures aislados: Inicio, búsqueda, rutas, regreso a Herramientas, lectura, privacidad, conservación de borradores y carga con reintento. UI/UX aprobó las superficies renderizadas; la revisión de código cerró los hallazgos de foco. El [registro integrado](docs/product-polish-qa.json) distingue las pruebas ejecutadas, la reutilización de evidencia y los límites. Una interacción quedó limitada por `aria-disabled`; la revisión automática rechazó forzar una acción de escritura deshabilitada, y esa activación y su equivalente por teclado no se ejecutaron.

Tarjetas se carga al entrar al catálogo; Ahorro y Compra se cargan al visitarse y conservan su estado al regresar. La [medición del build](artifacts/ui-review/product-polish-performance-r4.json) registra 21.27% menos JavaScript minificado hasta la primera visita a Tarjetas, o 13.31% menos al comprimir cada archivo con gzip. La entrada por sí sola requiere 7.19% menos JavaScript. Al visitar todas las vistas, el acumulado crece 0.67% con el conjunto de mejoras: el beneficio medido es diferir trabajo. Estas cifras no representan tiempos de carga, LCP ni INP.

La [verificación anterior de mercado y visualización](docs/product-excellence-qa.json) conserva su evidencia histórica. El cierre actual no acredita guardado en una cuenta privada real, conformidad WCAG integral, usabilidad con usuarios ni despliegue; los errores de carga se probaron con un importador controlado. La coordinación real de hogares, membresías y permisos compartidos sigue siendo trabajo futuro; los espacios actuales permanecen independientes.

Cobros esperados registra acuerdos, fechas y parcialidades sin sumar expectativas al efectivo. Permite vincular un ingreso existente sin duplicarlo o registrar un ingreso recibido; deshacer un vínculo conserva el movimiento. Muestra totales separados por moneda y distingue cancelación de pago recibido. El control de repetición identifica operaciones, no sustituye una conciliación bancaria ni detecta cualquier duplicado semántico de una importación.

## Claude y estados de cuenta

Configura estos valores en **el entorno de servidor de Sites** y despliega una versión para aplicarlos. `.env.example` documenta sus nombres; Vite local no los carga para autorizar usuarios.

| Variable | Uso |
|---|---|
| `SIFRAN_GAIRO_EMAIL` | Correo para vincular inicialmente Gairo. |
| `SIFRAN_RICARDO_EMAIL` | Correo para vincular inicialmente Ricardo. |
| `ANTHROPIC_API_KEY` | Secreto de la cuenta Anthropic que pagará el consumo. |
| `ANTHROPIC_MODEL` | Modelo disponible para esa cuenta; predeterminado `claude-sonnet-5`. |

No uses prefijos `VITE_` para secretos. El chat requiere contexto guardado, revisión vigente y consentimiento. El servidor reconstruye las cifras desde el espacio autorizado, compara el resumen y rechaza cambios antes de llamar al proveedor. El tipo de cambio manual no se presenta como cotización bancaria verificada.

La cuota de **20 solicitudes por hora y cuenta** y la exclusión de solicitudes simultáneas se conservan en D1. Un intento reservado puede consumir cuota aunque el proveedor falle. No se reintentan llamadas pagadas automáticamente. El ID de consulta permite correlación, pero no garantiza deduplicar un reenvío manual. «Terminar conversación» limpia mensajes y consentimiento; para cerrar la sesión utiliza el menú de cuenta.

**CSV:** se procesa en el navegador, con selección de columnas, moneda, fechas y separadores; no se envía a Claude. **PDF:** requiere consentimiento para enviar el documento completo a Anthropic; admite hasta 3 MB y 150 movimientos por extracción. No se guarda el archivo original en D1 ni R2.

Revisa los resultados antes de guardarlos. Transferencias, pagos entre cuentas, campos desconocidos y posibles duplicados requieren decisión explícita. La moneda no se infiere de `$`; los resultados del PDF empiezan sin seleccionar. El hash y el índice evitan importar nuevamente una fila idéntica. Las citas de página propuestas por Claude deben cotejarse con el original.

Sin clave configurada, el producto lo indica y rechaza consumo; no presenta respuestas de demostración como si fueran de Claude. Las pruebas usan un proveedor simulado y no acreditan acceso a un modelo real. Referencias de integración: [Messages API](https://platform.claude.com/docs/en/api/http/messages/create), [salidas estructuradas](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) y [PDF](https://platform.claude.com/docs/en/build-with-claude/pdf-support). Se aplica la [retención de la API de Anthropic](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention); Sifran no promete retención cero del proveedor.

## Límites del producto

La vista privada oculta contenido, pero no cifra ni elimina registros. Los respaldos JSON y Excel contienen información financiera legible. El service worker sólo conserva recursos estáticos genéricos; excluye navegación, autenticación, API y documentos. La sincronización y Claude requieren conexión.

El margen se calcula desde el presupuesto configurado, no desde efectivo conciliado con un banco. Los movimientos reflejan únicamente la cobertura registrada. Las proyecciones suponen pagos y tipo de cambio constantes; usan las tasas posteriores a promociones cuando existen, sin anualidades, comisiones ni intereses retroactivos. Si queda saldo a los 120 meses, se informa sin una fecha ficticia de liquidación.

Los cálculos fiscales y de salud financiera son estimaciones configurables. No se acredita vigencia normativa ni consulta a un buró de crédito. Claude puede equivocarse: contrasta las cifras y revisa cada importación.

El análisis avanzado está implementado, pero **no hay cobro ni suscripciones premium activas**. Una licencia incluida en un respaldo no concede permisos de servidor. Comercializar requiere facturación, derechos de acceso y recuperación operativa; no se activan por la longitud de un código.

## Estructura

```text
src/SessionGate.jsx          Acceso, sesión y sincronización
src/components/             Vistas y formularios accesibles
src/services/workspaceSync.js Cola, revisiones y recuperación
src/services/storage.js     Lectura del respaldo anterior
server/sites/              Worker y rutas del Site
server/workspace/          Autorización y persistencia D1
server/ai/worker-ai.js      Claude, contexto de cuenta y cuota D1
server/references/         Adaptador de referencias oficiales públicas
src/data/                  Directorios, fichas y programas editoriales
db/                        Esquema Drizzle
drizzle/                   Migraciones de esquema
tests/                     Autorización, CAS y cuota con SQLite
```
