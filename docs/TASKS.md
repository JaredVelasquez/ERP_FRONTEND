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

- **Estado:** [~]
- **Nota:** login y cookie ya conectados a `POST /identity/login` y `GET /erp/session` reales. Falta solo la elección de empresa cuando hay varias membresías, bloqueada por `ERP_Backend/docs/BLOCKERS.md` B-003 (no existe endpoint para listar membresías antes del login).
- **Deps:** backend T-006, T-F001
- **Hacer:**
  - [x] Login, cookie en web
  - [ ] Elección de empresa (bloqueado por B-003 en backend)
  - [x] Navegación con las secciones de la fase, vacías si el endpoint no existe
- **Listo cuando:** un operador no ve contabilidad

## T-F003 — Productos y barras

- **Estado:** [ ]
- **Deps:** backend T-008, T-F002
- **Listo cuando:** se crea un producto con presentación y se ve el código

## T-F004 — Entradas y salidas

- **Estado:** [ ]
- **Deps:** backend T-009, T-F002
- **Listo cuando:** una venta sin existencia se detiene en pantalla y no deja un documento confirmado

## T-F005 — Contabilidad, precios, tablero, Excel y comprobante

- **Estado:** [ ]
- **Deps:** backend T-007, T-010, T-011, T-012, T-013 y T-F002
- **Listo cuando:** cada flujo de RF-05 a RF-09 se recorre en el navegador, no solo se ve una captura

## T-F006 — POC Android

- **Estado:** [ ]
- **Deps:** T-F002
- **Listo cuando:** el login en el WebView queda escrito en un ADR y la sesión sobrevive un reinicio de la app

---

# Fase 2

Puntero a `ERP_Backend/docs/TASKS.md` T-018–T-029 y a SPEC § 12. No se adelanta la pantalla si la tarea de backend sigue en `[ ]`.

## T-F007 — Hoja de barras

- **Estado:** [ ]
- **Deps:** backend T-021, T-F002
- **Hacer:**
  - [ ] Elegir un producto o varios y descargar o imprimir el mismo PDF
  - [ ] Textos en español, fuera del componente
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y en el navegador un producto y varios productos descargan la hoja

## T-F008 — Disminuir por nombre

- **Estado:** [ ]
- **Deps:** backend T-026, T-028, T-F002
- **Hacer:**
  - [ ] Buscar por nombre, elegir el producto, pedir la presentación y la cantidad, confirmar
  - [ ] Si no hay existencia, la pantalla se detiene y no muestra un documento confirmado
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y en el navegador buscar no descuenta hasta confirmar

## T-F009 — Lector y salida

- **Estado:** [ ]
- **Deps:** backend T-027, T-028, T-F002
- **Hacer:**
  - [ ] Campo de lectura: el código y Enter abren la ficha o suman una línea. Confirmar una línea o varias llama la misma salida
  - [ ] Código desconocido visible, sin cambio de existencia
  - [ ] Con el foco en la cantidad, escribir y dar Enter no lee un código
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y el navegador recorre la ficha, el fallo, la salida de una línea, la salida de varias y el foco en la cantidad
