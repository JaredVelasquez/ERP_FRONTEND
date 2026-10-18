# BLOCKERS — Tienda

Backend T-006 ya está cerrado: el login (`src/modules/authentication/api.ts`) ya pega contra `POST /identity/login` y `GET /erp/session` reales, con cookie `httpOnly`. Lo que falta de T-F002 es la elección de empresa cuando el usuario tiene varias membresías — el `SelectField` de `login-form.tsx` sigue con una sola opción fija porque el backend no expone un endpoint para listar membresías antes del login. Ver `ERP_Backend/docs/BLOCKERS.md` B-003: hasta que esa decisión de contrato se cierre, no tiene sentido construir el selector en la tienda.

El POC Android no se cierra sin un dispositivo o emulador.
