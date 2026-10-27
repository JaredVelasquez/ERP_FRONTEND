# BLOCKERS — Tienda

## Resueltos en desarrollo local

- El login, la cookie `httpOnly` y la lectura de sesión funcionan con `POST /identity/login` y `GET /erp/session`.
- La selección de empresa para usuarios con varias membresías funciona con `POST /identity/companies`. Backend B-003 y T-F002 quedaron resueltos.
- La importación de catálogo acepta CSV de la plantilla, muestra una vista previa y pide confirmación antes de enviarlo.

- Identical or concurrent catalog CSV retries, including zero opening stock, are idempotent under backend T-040; PostgreSQL migration 018 is applied and the concurrent smoke check passed.
- Voucher PDF and POS receipt uploads, authenticated reads, replacement, company isolation, and direct-per-voucher-folder R2 keys passed the backend HTTP smoke check. The preview supports individual/side-by-side modes and full screen.

## Pendientes

- **Producción de Michelle Market:** faltan RTN, razón social y dirección reales. Ver backend B-002. La ficha de empresa de la tienda es de consulta; la gestión administrativa se trasladará al panel general de ARQUIGRAPHIA.
- **Native session validation:** web refresh was verified in Chrome, and backend refresh rotation and replay revocation pass HTTP smoke tests. The Android POC still requires a device or emulator (T-F006).
