# ADR-001: Persistencia de sesión en Capacitor

- **Estado:** aceptado para el POC Android
- **Fecha:** 2026-10-25

## Contexto

La sesión web usa una cookie de refresh `HttpOnly`. El WebView de Capacitor tiene un origen propio y puede aplicar restricciones distintas a cookies de terceros. El access token debe permanecer solo en memoria.

## Decisión

Capacitor solicita un refresh token rotatorio para el cliente nativo y lo almacena mediante `capacitor-secure-storage-plugin`, respaldado por almacenamiento seguro de la plataforma. Al iniciar la aplicación, el frontend recupera ese refresh token, solicita un access token nuevo y vuelve a leer la sesión. El access token nunca se persiste. Al cerrar sesión se revoca la familia en el servidor y se elimina el refresh token local.

El navegador conserva el refresh en cookie `HttpOnly`. Electron mantiene su adaptador `safeStorage`. Ninguna plataforma guarda tokens en `localStorage`, `sessionStorage` o IndexedDB.

## Consecuencias

- La aplicación falla cerrada si el almacenamiento seguro no puede recuperar el refresh token.
- El servidor persiste hashes de refresh tokens, rota cada uso y revoca la familia si detecta reutilización.
- Antes de cerrar T-F006 se debe instalar en un emulador o Android físico, iniciar sesión, detener y reiniciar la aplicación, y comprobar la recuperación y el logout.

## Validación pendiente

El código y el build web verifican el adaptador. En el entorno actual no están disponibles `adb`, Java ni Android SDK; la persistencia tras reinicio requiere un dispositivo o emulador y no se declara verificada.
