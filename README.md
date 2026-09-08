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

Abre http://localhost:5173. La vista local permite revisar el acceso y recuperar el respaldo anterior. **No simula identidad de Sites ni conecta datos o claves remotos.** Los endpoints locales muestran conexión pendiente. La aplicación completa se verifica en el Site privado.

```powershell
npm test
npm run build
```

Las pruebas de persistencia usan SQLite real en memoria mediante Python 3, sin datos personales ni llamadas pagadas a Anthropic. La compilación produce `dist/client`, `dist/server/index.js` y metadatos Sites. El adaptador oficial se usa únicamente durante build con Vite 6.4.3; se verificó la integración con Node 20.15.1. Su manifiesto declara Node 22.13+/Vite 8, por lo que esta instalación conserva explícitamente `--legacy-peer-deps` y no habilita su simulador local de autenticación.

El origen autorizado está en `server/sites/router.js`. Cambiar el dominio requiere actualizarlo y verificar el despacho de identidad. El Worker confía en los headers del dispatcher gestionado: no debe exponerse directamente en otro hosting que permita falsificarlos. Los adaptadores anteriores de Vercel y Netlify están retirados y devuelven 410.

El esquema está en `db/schema.ts`. `npm run db:generate` genera migraciones Drizzle; las ya aplicadas son inmutables. Sites configura el binding lógico `DB` y aplica las migraciones de esquema incluidas en el paquete. No se ejecuta DDL durante solicitudes de usuario.

## Experiencia

- Navegación lateral, menú móvil completo, búsqueda `Ctrl/Cmd + K`, foco visible y movimiento reducido.
- Registro rápido con `N`; vista privada con `Ctrl/Cmd + Shift + P`.
- Resumen de margen estimado, presupuesto, patrimonio, deuda y próximos pagos sin marcar.
- Movimientos con búsqueda, periodo, categorías, importación revisada y eliminación con deshacer.
- Totales en MXN o USD; «Original» conserva cada moneda en filas y usa MXN para agregados.
- Cuatro reglas de pago, proyecciones completas y tabla de resultados, sin inventar liquidación al agotar el horizonte.
- Presupuesto editable desde cero, respaldos JSON, exportación Excel, impresión y herramientas de educación y cálculo.

Las rutas aparecen en la URL y admiten Atrás/Adelante. En móvil, «Más» abre el catálogo completo. Reducir la navegación nunca elimina la revisión de una importación financiera.

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
db/                        Esquema Drizzle
drizzle/                   Migraciones de esquema
tests/                     Autorización, CAS y cuota con SQLite
```
