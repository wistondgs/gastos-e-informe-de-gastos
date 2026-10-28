# Validación funcional Android V2 — resultados

Fecha: 2026-10-28. **Resultado global: BLOCK para Android.** No se detectó ningún dispositivo mediante `adb devices -l`; no se instaló, actualizó, desinstaló ni restauró ninguna app. Los PASS de software de esta matriz no son una prueba nativa.

## 0. Ficha de fase y guardas

Se leyeron `AGENTS.md` y E-01 a E-13. Aplican E-01 y E-02 (pruebas de arranque y SQLite web), E-03 (los casos financieros son los expresos del mandato y del roadmap A1–A9; no se decide ninguna regla nueva), E-04/E-09/E-13 (evidencia de informes e imágenes), E-05 (contadores de mutantes separados), E-06/E-07 (no se copió ningún APK al teléfono), E-08 (APK fuera de la salida de Gradle), E-10 (escenario válido y aserción del saldo), E-11/E-12 (pruebas de aviso e historial). Los 11 mutantes pasaron con contadores aislados en `docs/evidencia/validacion-android-v2/guardas-mutantes.json`; sus saltos son deliberados, no eventos reales. La guarda constructiva `salida_a_fichero` calla por diseño. No se ejecutó una nueva inspección visual de todos los PDF, por lo que E-09 no permite declararlos validados. No se registraron saltos reales de estas guardas en esta unidad; el silencio no acredita que todos los defectos posibles estén cubiertos.

Se detectó y registró E-14: `npm ci` se ejecutó primero en el árbol principal, reinstalando `node_modules`; no se sabe si existían cambios manuales dentro de esa carpeta ignorada. El árbol versionado estaba limpio antes del inicio. Se incorporó la pregunta de directorio y destino al punto 0 de la plantilla; después se instaló y compiló exclusivamente en la copia aislada. E-14 queda con guarda por pregunta. No corresponde podar guardas por esta sola unidad.

## Procedencia y compilación

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Git al inicio | PASS | `master`, HEAD y `origin/master`: `6badd62add379aa6924d8d95b3575629d1408a33`; `git status` limpio. `git ls-remote origin refs/heads/master` devolvió el mismo SHA. |
| Árbol para construir | PASS | Worktree aislado en `/tmp/gastos-validacion-android-6badd62`, HEAD indicado y `git status --porcelain` vacío antes de compilar. La prueba adicional se retiró antes de compilar. `npm ci` usó el lock del commit. |
| APK de pruebas | PASS | `io.necktral.gastos.entorno.pruebas`, versión `2.0.0-alfa.1`, versionCode 2, minSdk 23 (Android 6), targetSdk 35; SHA-256 `3be8ea507466c77661d8a63a9f949d65c6722c22138e51d94f06f8aaea28fc23`. |
| Firma | PASS | Certificado `CN=Android Debug`, SHA-256 `20d4b995519447036cb9f2fa02ed1f9dd8c8e642e83c6e2cc67acc769c3b2b23`; `apksigner verify` válido en esquemas v1 y v2. Se emitieron advertencias de entradas META-INF no protegidas por la firma v1; la verificación v2 pasó. Es una compilación de depuración. |
| Recompilación | PASS | Una segunda compilación en el mismo worktree y entorno produjo el mismo SHA-256. Esto no demuestra reproducción bit a bit en otra máquina: depende, entre otros, de herramientas y de la misma clave de firma. |

Herramientas: Node `v24.21.0`, npm `11.19.0`, Java Temurin `21.0.13`, Gradle wrapper 8.11.1, Android SDK build-tools 35.0.0; SHA-256 de `package-lock.json`: `b68cb0a1ac7019e1fb67738a18f611284eb83a9cffce80c0cd80c246c6d7a535`. Comandos principales desde el worktree: `npm ci --no-audit --no-fund`, `npm run check`, `GASTOS_APK_DIR=<destino> scripts/android/compilar.sh pruebas`. Los logs están en `docs/evidencia/validacion-android-v2/`.

## Matriz PASS / FAIL / BLOCK

| Comprobación | Software sintético | Android nativo | Evidencia o condición para completar |
| --- | --- | --- | --- |
| C$100,000 + C$100,000 + C$20,000; compra C$150,000; quedan C$70,000 | PASS | BLOCK | `escenario-sintetico.test.js` y `escenario.txt`, SQL.js; repetir en la app aislada y revisar saldo persistido. |
| Reparto entre gestiones y remanente | PASS | BLOCK | `tests/flujo-reparto.test.js` y A5; ejecutar navegación y saldos en Android. |
| Propios, crédito y pagos parciales | PASS | BLOCK | A1/A3/A4 y `tests/flujo-reparto.test.js`; ejecutar controles y verificar persistencia. |
| Devoluciones, anulaciones y saldos | PASS | BLOCK | A2/A8 y `tests/integridad-c1.test.js`; comprobar errores, auditoría y saldos en interfaz. |
| Cámara y galería | BLOCK | BLOCK | No se han capturado ni seleccionado imágenes en un Android para esta unidad. |
| Giro, enderezado, recorte, PDF y original | PASS parcial | BLOCK | `tests/editor-integracion.test.js` verifica matrices PDF y huella del original; `tests/anexos.test.js` rasteriza giro. Falta validar visualmente giro, enderezado, recorte, factura larga y PDF en Android. |
| Botón Atrás | BLOCK | BLOCK | Sin ejecución en Android. |
| Borrador y varias fotos tras cierre forzado | PASS parcial | BLOCK | `tests/borradores.test.js` prueba reapertura sintética IndexedDB; no prueba cierre forzado ni varias fotos reales en Android. |
| Autenticación de dispositivo | PASS parcial | BLOCK | `tests/proteccion.test.js` usa simulaciones; sin PIN, huella o rostro nativos. |
| PDF e informes | PASS parcial | BLOCK | Pruebas de informes, totales, anexos y revisión histórica; falta visualización completa y recuperación en Android. Históricos antiguos pueden carecer de fechas necesarias. |
| Excel | PASS parcial | BLOCK | `tests/informe-profesional.test.js` compara totales y `tests/recorrido.test.js` genera Excel; falta verificar los recorridos en Android. |
| Respaldo y restauración | PASS parcial | BLOCK | A9, `tests/migracion.test.js`, `tests/informes-revision.test.js` y `tests/recorrido.test.js` usan datos sintéticos; falta restauración nativa aislada. |
| Actualización de APK anterior y preservación | PASS parcial | BLOCK | Migraciones de base en SQL.js; sin actualizar una instalación aislada Android no se acredita preservación de base, fotos e informes en el teléfono. |

`npm run check`: PASS, 101 pruebas, 0 fallos; lint, formato y compilación web pasaron (`check.txt`). Ninguna prueba nativa fue ejecutada. No se creó ningún dato de prueba en el teléfono.

## Defectos y límites

- **FAIL de procedimiento E-14:** reinstalación accidental de `node_modules` en el repositorio principal; no puede demostrarse si se sobrescribieron ajustes manuales ignorados. Registrado en `ERRORES_Y_GUARDAS.md` y conectado a la ficha.
- **BLOCK de validación:** no existe dispositivo Android conectado y autorizado. No hay evidencia de ejecución de la app ni de cámara, seguridad, cierre forzado, actualización o restauración nativa.
- **Riesgo preexistente:** algunos datos históricos anteriores a los eventos fechados no permiten reconstruir exactamente ciertos cortes. No se ha corregido en esta unidad.
- **Avisos de herramientas:** el SDK advierte una diferencia de versión de XML y la compilación web advierte un paquete grande; ambos procesos terminaron correctamente.

La matriz anterior define las pruebas a completar únicamente sobre `io.necktral.gastos.entorno.pruebas` con datos sintéticos, una vez comprobada la identidad de la instalación aislada. La app principal con datos reales no forma parte de los procedimientos.

## Comprobación posterior del entorno principal

A solicitud del propietario se comprobó la instalación actual: `npm ls --depth=0` no informó dependencias faltantes y `npm run check` terminó con 101 pruebas aprobadas y compilación web correcta. La comparación con la instalación aislada mostró únicamente artefactos temporales de compilación. La evidencia está en `docs/evidencia/validacion-android-v2/comprobacion-entorno-principal.txt`. No se encontró una copia de la carpeta anterior: no puede garantizarse la recuperación de posibles cambios manuales que hubieran existido dentro de `node_modules` antes de `npm ci`. E-14 mantiene su guarda.
