# SPEC — Tienda (fase 1)

Complementa `ERP_Backend/docs/SPEC.md`. Aquí solo está la experiencia de la tienda.

## Pantallas

1. Login y elección de empresa cuando hay más de una.
2. Inicio con el tablero de RF-07.
3. Productos: buscar, crear y editar en un flujo. Método vacío muestra el de la empresa.
4. Código de barras: número, vista previa y descarga PNG o SVG.
5. Entrada: compra o saldo inicial, cuenta de pago, líneas, confirmar.
6. Salida: venta, merma o ajuste. En venta, la cuenta donde entró el dinero. Si no hay existencia, se detiene.
7. Kardex del producto.
8. Catálogo contable en árbol y reglas de partida. Solo el dueño.
9. Reportes: diario, mayor, balance de comprobación, valuación, cambios de precio.
10. Excel: descargar plantilla, subir, ver errores, confirmar.
11. Comprobante Ficohsa: formulario, firma y descarga del PDF.

## Reglas de interfaz

- Textos en español, fuera de los componentes, con infraestructura i18n desde el inicio.
- Botones y filas cómodos al tacto. Una acción principal por pantalla.
- El tema usa las variables que publica la empresa. Si no hay tema, azul `#0157D2` y crema `#F6EDE6`.
- Electron abre una URL real, con `contextIsolation`, sin `nodeIntegration`.
- Android no se publica hasta pasar el POC de sesión del SPEC RF-01.

## Fuera de esta app

Sociedades, alta de empresas, edición de plantillas HTML y colores de plataforma. Eso es ERP_ADMIN.

## Fase 2

La regla está en `ERP_Backend/docs/SPEC.md` § 12. Esta app no la repite.

Tres pantallas, la misma interfaz en web, Electron y Android:

1. Hoja de barras: elegir uno o varios productos, descargar o imprimir el PDF.
2. Disminuir por nombre: buscar, elegir, indicar cantidad y confirmar.
3. Lector: el campo de lectura recibe el código y Enter. La ficha deja sacar ese producto o acumular líneas y confirmar una sola salida.

El lector no escucha mientras el foco está en otro campo. Un código desconocido se muestra y no cambia la existencia. Sin cámara y sin iOS.
