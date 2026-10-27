# Mis gastos · primer recorrido

Aplicación móvil independiente para registrar compras y comprobantes sin servidor. El recorrido implementado incluye gestiones con fecha de apertura y finalización, captura guiada de compras, SQLite, fotos, Excel, PDF y respaldo; **todavía no está validada en teléfono** y no es una beta certificada. Los fondos, adelantos, reembolsos y créditos comerciales aún no están implementados. No conecta con ERP.

## Desarrollo

Requiere Node 22–24 y npm:

```sh
npm ci
npm run check
npm run dev
```

En Android/iOS se usa el plugin nativo SQLite y archivos privados. La vista de navegador para desarrollo usa SQLite mediante SQL.js y almacenamiento del navegador, con sus límites de espacio y aislamiento; no reemplaza la prueba móvil.

## Android

Con JDK 21 y SDK Android instalados:

```sh
export JAVA_HOME="$HOME/.local/share/gastos-entorno/jdk21"
export ANDROID_HOME="$HOME/.local/share/gastos-entorno/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npm run android:sync
(cd android && ./gradlew :app:assembleDebug --no-daemon)
```

El APK de prueba se genera en `android/app/build/outputs/apk/debug/app-debug.apk`. Tiene firma de desarrollo; requiere un teléfono o emulador para verificar instalación y funciones. Antes de distribuir actualizaciones hay que acordar identificador definitivo y firma de distribución respaldada.

## iOS

`npm run ios:sync` prepara los recursos; compilar y probar requiere macOS, Xcode, CocoaPods y un destino Apple. No se ha ejecutado esa validación.

## Respaldo

La aplicación crea un ZIP con los registros de la base, imágenes, versión de esquema y huellas SHA-256. Restaurar valida antes de reemplazar datos y usa una transacción para los registros. El archivo compartido **no está cifrado ni autenticado con contraseña**: elegir un destino privado y verificar la restauración en un dispositivo antes de confiarle datos reales. La copia de pruebas no garantiza conservación ante daños del teléfono, apagones o cambios de plataforma. La recuperación entre dispositivos y cualquier cifrado adicional requieren una decisión posterior.

Ver [ficha y evidencia de la fase](docs/fases/01-primer-recorrido.md). Errores y medidas de prevención están en `ERRORES_Y_GUARDAS.md`.

La versión con gestiones migra la base local de esquema 1 a 2. La migración y la restauración de respaldos anteriores pasaron pruebas sintéticas con SQL.js, pero aún no se han probado en Android o iOS; no actualizar una instalación con datos reales hasta completar una prueba aislada y verificar su respaldo.
