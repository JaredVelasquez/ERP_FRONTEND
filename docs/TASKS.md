# TASKS — Tienda

Dependen del contrato del backend. No se adelanta una pantalla cuyo endpoint no esté en `ERP_Backend/docs/TASKS.md` marcado `[x]`.

## T-F001 — Esqueleto Vite

- **Estado:** [x]
- **Deps:** ninguna
- **Hacer:**
  - [x] React, Vite, Tailwind, TanStack Router y Query, alias `@/app`, `@/modules`, `@/shared`, `@/platform`
  - [x] Carpetas de la constitución, sin archivos sueltos en `app/`, `shared/` ni `platform/`
  - [x] Health visual: login de humo que aún no llama API
  - [x] Electron y Capacitor Android cableados, sin lógica de negocio
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y la web abre el shell

## T-F002 — Sesión y shell

- **Estado:** [x]
- **Nota:** login y cookie conectados a `POST /identity/login` y `GET /erp/session`; la elección de empresa consulta `POST /identity/companies` después de validar credenciales.
- **Deps:** backend T-006, T-F001
- **Hacer:**
  - [x] Login, cookie en web
  - [x] Elección de empresa cuando hay varias membresías
  - [x] Navegación con las secciones de la fase, vacías si el endpoint no existe
- **Listo cuando:** un operador no ve contabilidad

## T-F003 — Productos y barras

- **Estado:** [x]
- **Deps:** backend T-008, T-F002
- **Verificado en Chrome:** el smoke `smoke:frontend-mobile-routes` crea un producto con presentación desde el formulario, confirma el código interno generado en la tabla y luego lo localiza por nombre y por código de barras. Los datos temporales se eliminan al finalizar.

## T-F004 — Entradas y salidas

- **Estado:** [x]
- **Deps:** backend T-009, T-F002
- **Verificado en Chrome:** `smoke:frontend-mobile-routes` registra un ingreso con costo, vende con existencia, y confirma que una venta sin existencia muestra el rechazo sin crear un documento. Los datos de prueba (producto, documentos, capas y asientos) se limpian al finalizar.

## T-F005 — Contabilidad, precios, tablero, Excel y comprobante

- **Estado:** [ ]
- **Deps:** backend T-007, T-010, T-011, T-012, T-013 y T-F002
- **Listo cuando:** cada flujo de RF-05 a RF-09 se recorre en el navegador, no solo se ve una captura

## T-F006 — POC Android

- **Estado:** [~]
- **Deps:** T-F002
- **Listo cuando:** el login en el WebView queda escrito en un ADR y la sesión sobrevive un reinicio de la app
- **ADR:** docs/ADR-001-capacitor-session.md define el uso de Bearer en memoria y refresh rotatorio en almacenamiento seguro nativo.
- **Implementado:** adaptador Capacitor y pruebas de get/set/clear y fallo cerrado; lint/build pasan.
- **Bloqueo de verificacion:** no hay adb, Java ni Android SDK en este entorno; falta probar login, reinicio, restauracion y logout en emulador o dispositivo.

---

# Fase 2

Puntero a `ERP_Backend/docs/TASKS.md` T-018–T-029 y a SPEC § 12. No se adelanta la pantalla si la tarea de backend sigue en `[ ]`.

## T-F007 — Hoja de barras

- **Estado:** [x]
- **Deps:** backend T-021, T-F002
- **Implementado:** Catálogo ofrece selección por fila y descarga del PDF generado por `/erp/barcode-sheets`; permite una selección o varias a través de búsqueda/paginación y mantiene los textos en el catálogo de mensajes.
- **Verificado en Chrome:** `smoke:frontend-mobile-routes` descarga y comprueba la firma PDF para uno y varios productos. Frontend tests, lint y build pasan.

## T-F008 — Disminuir por nombre

- **Estado:** [x]
- **Deps:** backend T-026, T-028, T-F002
- **Hacer:**
  - [x] Buscar por nombre, elegir el producto, ingresar cantidad y confirmar; sin existencia se detiene sin crear documento.
  - [x] Elegir explícitamente la presentación cuando el producto tenga más de una.
- **Verificado:** Chrome recorre busqueda, seleccion de producto, venta valida y rechazo por existencia; prueba de interfaz confirma eleccion de presentacion y precio correspondiente.

## T-F009 — Lector y salida

- **Corrección de búsqueda:** la pantalla de ingreso/salida usa `/erp/products/search?q=` en lugar de pedir los primeros productos del catálogo con `search` vacío. Las coincidencias muestran nombre, proveedor y código; el precio también busca por proveedor y códigos.
- **Estado:** [x]
- **Deps:** backend T-027, T-028, T-F002
- **Hacer:**
  - [x] Campo de lectura: el código y Enter abren la ficha o suman una línea. Confirmar una línea o varias llama la misma salida
  - [x] Código desconocido visible, sin cambio de existencia
  - [x] Con el foco en la cantidad, escribir y dar Enter no lee un código
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y el navegador recorre la ficha, el fallo, la salida de una línea, la salida de varias y el foco en la cantidad
- **Verificado:** Chrome recorre codigo desconocido, busqueda, lectura de barras, venta de una linea, ingreso y rechazo sin saldo; pruebas de interfaz cubren presentacion explicita, cantidad y venta de varias lineas. Lint, pruebas y build pasan.

## T-F010 — Integraciones MCP y asistente

- **Actualización:** las filas de conectores muestran un menú de tres puntos para recuperar instrucciones con un token conservado, rotar, renovar o restablecer un token revocado y revocarlo. El restablecimiento genera una credencial nueva; la anterior sigue inválida y el nuevo JSON/prompt se muestra una sola vez. El estado revocado se distingue en rojo. Las acciones de usuarios usan el mismo patrón de menú y los diálogos se centran.
- **Estado:** [x] para tokens, chat, imágenes, PDF, fotogramas, voz grabada y vista previa contextual de adjuntos; [ ] para audio de video.
- **Voz:** un único control permite grabar, detener, escuchar y enviar un mensaje de audio de hasta dos minutos. El asistente procesa/transcribe la voz; la grabación no se guarda en el historial.
- **Hecho:** pantalla de integración con perfiles, selección de herramientas, caducidad, copia única y revocación; asistente accesible desde la tienda, consultas autorizadas y confirmación de propuestas con permisos revalidados.
- **Pendiente:** flujo guiado de validación de renglones OCR contra catálogo para facturas con muchas líneas.

## T-F011 — Configuración de empresa y tablas configurables

- **Actualización:** Configuración tiene subcategorías de Usuarios, Precios, Asistente e Integraciones MCP. El alta de usuarios permite generar una clave segura. Proveedor y modelo se eligen mediante listas. Al crear un token MCP se entrega JSON y un prompt copiable para configurar el cliente.
- **Estado:** [x] para la página de configuración, gestión de usuarios y permisos, clave propia, aprobador de precios, proveedor/modelo/token de IA, dashboard MCP e historial por usuario. El catálogo de precios, usuarios, conectores y uso MCP comparten la tabla con columnas configurables.
- **Edición:** la importación permite corregir sus filas antes de enviar el CSV; los datos persistidos se editan mediante acciones del módulo y los permisos vigentes.
- **Verified in development:** dashboard activity reuses ServerTable with ordering, visibility, search, pagination, and preferences persisted per company. Chrome visited 16 ERP routes at 390px with no horizontal document overflow or runtime exceptions (`smoke:frontend-mobile-routes`). Provider secrets remain redacted after saving; replace them in Settings. A human visual review across module-specific states remains.

## T-F012 — Reportes de ventas y contabilidad

- **Estado:** [x]
- **Alcance:** sección Reportes para usuarios con acceso a Contabilidad; rango de fechas, ventas diarias y por producto, balance de comprobación, balance general y estado de resultados. Permite imprimir la vista y exportar sus filas a CSV.
- **Datos:** ingresos y costos de ventas confirmadas; estados financieros calculados desde asientos contables y sus reversos. El resultado acumulado se presenta dentro del patrimonio del balance general.

## T-F013 — Asientos contables generales

- **Estado:** [x]
- **Alcance:** registro rápido de ingresos y gastos, editor manual de asientos balanceados, historial con reverso y actualización de reportes financieros. La empresa y el usuario se obtienen de la sesión activa.
- **Verificado en Chrome:** ingreso, gasto y asiento manual actualizan sus estados financieros; al anular se conserva el historial y el balance regresa al importe previo.

## T-F014 — Adoptar access Bearer y refresh protegido por plataforma

- **Estado:** [x]
- **Deps:** backend T-036. El POC Android se rastrea en T-F006 por separado.
- **Implementado:** access token solo en memoria, refresh web por cookie `HttpOnly`, almacenamiento seguro por adaptador en Electron/Capacitor, refresh concurrente compartido y logout. Unit tests verify refresh rotation and retry after 401.
- **Prohibido:** `localStorage`, `sessionStorage`, IndexedDB o stores persistidos para access/refresh tokens.
- **Pending close:** Android app restart POC; Chrome verified web refresh after reload, HttpOnly cookie flags, and dashboard layout at 390px. Native validation requires a device or emulator (T-F006).
## T-F015 � Asistente en pantalla completa e historial

- **Estado:** [x]
- **Referencia:** experiencia de conversaciones de `INNOVA/innova-frontend`.
- **Alcance:** abrir el chat desde el lanzador en una p�gina amplia, crear conversaciones y volver al historial paginado; conservar la variante flotante para consultas r�pidas.
- **Listo cuando:** se puede abrir, crear, seleccionar y continuar conversaciones persistidas; el panel de historial se adapta a m�vil y escritorio; permisos y contenido siguen aislados por sesi�n.
- **Verificacion:** smoke en Chrome confirma restauracion y seleccion por URL, creacion, historial movil sin overflow; lint/build pasan.

## T-F016 — Interfaz de facturación y documentos fiscales SAR

- **Estado:** [ ] Pendiente; depende de la definición y API del backend T-043.
- **Alcance:** configuración fiscal disponible según permisos; consulta de documentos por estado y período; flujo para emitir desde una venta elegible; vista previa e impresión; detalle de impuestos y datos fiscales; consulta de notas de crédito/débito y anulaciones; mensajes claros ante correlativos agotados, autorización vencida o errores de emisión.
- **Regla:** distinguir visualmente los documentos fiscales de los comprobantes operativos actuales y no presentar como factura ningún comprobante que no haya sido emitido/autorizado por el flujo fiscal.
- **Listo cuando:** los flujos usan exclusivamente datos del backend, respetan empresa/permisos, conservan acceso al documento emitido, y la interfaz responde en móvil y escritorio con estados de carga, vacío, error y confirmación.