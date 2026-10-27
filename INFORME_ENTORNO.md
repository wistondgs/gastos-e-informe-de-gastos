# Informe de preparación del entorno

Referencia de producto: documentos 01, 02 y 03 del paquete del usuario. El ERP es referencia de lectura; este repositorio es independiente. No se incluyen credenciales.

## Equipo y elección

Ubuntu 26.04.1 nativo, x86_64, 22 GiB RAM y 320 GiB libres observados al inicio; VS Code 1.143.1, Codex CLI 0.142.5, Git 2.53.0, Node 24.21.0 y npm 11.19.0. Equipo wis-Predator: se prioriza un teléfono físico; no se cambió la GPU ni sus controladores.

Se eligió Vue 3.5.44, Quasar 2.35.2 y Capacitor 7.6.9 por continuidad con CO-PA en V2/V3 y una sola interfaz para una persona. Flutter ofrece interfaz compartida, pero introduce Dart y otra plataforma de UI. Kotlin Multiplatform con Compose ofrece lógica e incluso interfaz compartida, pero introduce Kotlin y, con interfaces nativas, exige mantener por separado Android e iOS. Las tres opciones necesitan pruebas reales de cámara, SQLite, accesibilidad, archivos, exportaciones y firma en cada sistema. Flutter y Kotlin no eliminan el requisito de macOS/Xcode para iOS. La documentación oficial consultada: https://docs.flutter.dev/platform-integration y https://kotlinlang.org/docs/multiplatform/build-ios-android-app.html y https://capacitorjs.com/docs/getting-started/environment-setup.

Plugins instalados y fijados: SQLite 7.0.3, cámara 7.0.5, archivos 7.1.9 y compartir 7.0.4. Su instalación no equivale a una prueba de sus funcionalidades. ExcelJS 4.4.0 y pdf-lib 1.17.1 están instaladas como candidatas para la próxima fase, no verificadas en dispositivos. Ajv 8.20.0 verifica el esquema de ejemplo en pruebas. `npm audit --omit=dev` reportó dos vulnerabilidades moderadas en ExcelJS/uuid y ninguna alta o crítica; revisar y resolver antes de usar ExcelJS en producción. Vite 6.4.1, plugin Vue 5.2.4, plugin Quasar 1.10.0, ESLint 9.39.2 y Prettier 3.8.1; las versiones transitivas se fijan en el lockfile. npm advierte que esta versión de ESLint está fuera de soporte: se debe actualizar en una revisión de dependencias compatible.

## Preparación y verificaciones

- Instalación `npm install`: verificada; dependencias propias en `node_modules`, lockfile generado.
- `npm run check`: verificado: lint, formato, compilación de componente y build web.
- `npx cap add android`, `npx cap add ios` y `npm run android:sync`: verificados. iOS se generó sin ejecutar CocoaPods ni Xcode.
- Temurin Java 21.0.13 y herramientas Android de línea de comandos descargados en `~/.local/share/gastos-entorno`. El archivo de herramientas de Google se verificó con SHA-256 `4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583`, publicado por Google. El SHA-256 del JDK coincide con los metadatos oficiales de Adoptium. Gradle 8.11.1 ejecutó `--version` con ese JDK. Licencia Android aceptada por el propietario; instalados plataforma 35 (revisión 2), platform-tools 37.0.1 y build-tools 35.0.0 y 34.0.0.
- Android: `./gradlew assembleDebug --no-daemon` compiló correctamente el APK de prueba `android/app/build/outputs/apk/debug/app-debug.apk` (27 MB; SHA-256 049af79440fafb65e1ea817aa0645c8ae27f3ad294f283e8b7cc913a7145b696). `apksigner verify` verificó firma v1 y v2 de desarrollo; advirtió entradas META-INF sin protección v1. Gradle informó advertencias del complemento Filesystem y conservó sin strip la biblioteca libsqlcipher.so. `adb devices` no encontró dispositivo: instalación y prueba real no ejecutadas. Firma de distribución pendiente.
- iOS: compilación, firma, instalación y dispositivo real no verificados. Se necesita acceso a macOS, Xcode, dependencias nativas y destino autorizado. No hay ruta de distribución ni servicio remoto confirmados.
- Reproducción desde checkout limpio: verificada con `git archive HEAD`, `npm ci` y `npm run check`; incluye `cap sync android` y `./gradlew :app:assembleDebug` con el SDK y caché locales; no incluye iOS.
- Remote y CI: no hay repositorio remoto autorizado ni servicio de CI ejecutado.

## Referencias ERP

ERP V4, rama main, HEAD db8d3c7061b7136db7d553e4cd9aab1d53cdd089, árbol con cambios locales preexistentes. La inspección previa encontró organización (`backend/erp/plataforma/org/models.py`), permisos (`plataforma/permisos/models.py`), documentos (`kernels/documentos/api.py`), auditoría y aprobaciones (`plataforma/auditoria/models.py`, `plataforma/aprobaciones/models.py`), reintentos (`plataforma/comunes/reintento.py`) y hechos (`kernels/contabilidad/hechos.py`). No se verificó un circuito específico completo de rendiciones. No se modifica el ERP.

## Siguiente trabajo

Con mandato funcional: verificar en Android e iOS el recorrido de gasto sintético y foto, reinicio, Excel y PDF, respaldo y restauración. Registrar por plataforma el resultado y no cerrar con pérdida de datos, duplicados o saldos inconsistentes. No hay OCR ni integración ERP en esta preparación.
