# Entorno de desarrollo: gastos móvil

Repositorio independiente para preparar una aplicación Android/iOS con Vue 3, Quasar y Capacitor 7, siguiendo el ecosistema móvil de ERP V2/V3. Contiene una pantalla vacía: no es una beta funcional ni conecta al ERP. El prototipo anterior permanece en `../gastos-movil` y no forma parte de este repositorio.

## Requisitos y arranque

Node 22 a 24 y npm. Las versiones directas están fijadas en `package.json` y sus dependencias en `package-lock.json`.

```sh
npm ci
npm run check
npm run dev
```

El desarrollo JavaScript usa `node_modules` en esta carpeta, aislado por proyecto; un `venv` de Python no es necesario para esta tecnología. `npm run check` ejecuta análisis estático, formato, prueba de compilación de la pantalla inicial y compilación web.

## Android

El proyecto nativo está en `android/`; `npm run android:sync` actualiza sus recursos. Se requiere JDK 21, SDK Android plataforma 35 y build-tools 35.0.0. Las herramientas descargadas para este equipo están en `~/.local/share/gastos-entorno/`; para usarlas, definir `JAVA_HOME="$HOME/.local/share/gastos-entorno/jdk21"` y `ANDROID_HOME="$HOME/.local/share/gastos-entorno/android-sdk"`. El SDK aún necesita licencia y paquetes. Compilar con `cd android && ./gradlew assembleDebug`. El resultado debug es para pruebas y no constituye una firma de distribución. No se ha verificado instalación en un teléfono.

## iOS

El proyecto Xcode está en `ios/`. `npm run ios:sync` genera recursos, pero en macOS se requieren Xcode, herramientas compatibles, resolución de dependencias nativas y firma adecuada. No se puede validar compilación iOS en este Linux. La identidad `io.necktral.gastos.entorno` es provisional para el esqueleto; acordar identificador y firma antes de distribuir actualizaciones.

## Estructura y datos

`src/dominio`, `src/datos`, `src/interfaz` y `src/exportaciones` reservan límites para la siguiente fase. `config/ejemplo.json` y `config/esquema-v1.json` son estructura descriptiva sintética; el esquema se valida en las pruebas, pero todavía no hay respaldo implementado. Las reglas financieras y la conservación histórica se implementarán y probarán en el mandato funcional. SQLite, cámara, archivos y compartir están instalados como dependencias, sin afirmar que funcionen en ambas plataformas. ExcelJS y pdf-lib están instaladas como candidatas, pendientes de pruebas en ambas plataformas; la auditoría señala dos vulnerabilidades moderadas ligadas a ExcelJS que se deben resolver antes de producción.

No agregar bases, imágenes reales, respaldos, secretos o claves de firma al repositorio. Mantener la firma de distribución bajo control del propietario, con respaldo separado; no se ha creado ninguna clave de producción.
