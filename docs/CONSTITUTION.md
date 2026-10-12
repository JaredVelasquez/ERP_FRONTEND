# CONSTITUCIÓN — Michelle Market tienda

La especificación de negocio está en `ERP_Backend/docs/SPEC.md`. Este documento fija cómo se construye la tienda.

## Principios

| # | Principio | Implicación |
| --- | --- | --- |
| P1 | Una interfaz | Web, Electron y Android salen del mismo código React. No hay una segunda UI. |
| P2 | Features | El negocio vive en `src/modules`. `app/` solo compone. `shared/` no importa módulos. |
| P3 | Plataforma detrás de contratos | Solo `platform/electron` importa `electron`. Solo `platform/capacitor` importa `@capacitor/*`. |
| P4 | Estado de servidor | TanStack Query. No hay un store por entidad. |
| P5 | Contrato generado | Tipos y schemas Zod salen de OpenAPI. La UI no importa esos DTO. |
| P6 | Pocos pasos | Cada pantalla tiene una acción principal. El operador no ve lenguaje de asientos. |
| P7 | Marca de la empresa | Los colores y el logo llegan de la API. La base es azul `#0157D2` y crema `#F6EDE6`. |

## Estructura

```text
src/
  app/        bootstrap, router, providers, layouts, screens, wiring, config
  modules/    authentication, products, inventory, accounting, prices, dashboard, imports, documents
  shared/     ui, api, contracts, i18n, hooks, lib, config, constants
  platform/   web, electron, capacitor
  assets/
  testing/
```

Stack: TypeScript, React, Vite, TanStack Router, TanStack Query, Tailwind, shadcn/ui, Zod, React Hook Form, Vitest, Testing Library, Playwright, Electron, Capacitor Android.

## STOP

Si una pantalla necesita un dato que el SPEC del backend no expone, se agrega el requisito allá antes de inventar el endpoint.
