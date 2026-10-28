# Registro de errores y guardas · Mis gastos móvil

**Qué es.** La lista de lo que ya nos mordió, con la **guarda** que impide que vuelva a morder. Vive en el árbol, versionada, compartida por todos los roles y todas las sesiones.

**Las tres reglas.**
1. **Una entrada sin guarda no está cerrada.** Mecánica si puede ser; si no, una pregunta obligatoria en un punto concreto del flujo. Sin guarda, la entrada queda **ABIERTA**.
2. **Se lee en el momento del riesgo, no en un índice.** El enganche de este proyecto es: [ficha de fase](PLANTILLA_FASE.md), cuyo **punto 0** es «qué entradas de este registro aplican y cómo se cumple cada una». «Ninguna aplica» se justifica.
3. **Cada cierre alimenta el registro.** El cierre lista qué guardas saltaron, cuáles callaron y qué entradas nuevas añade.

**Las guardas de banco de trabajo no se leen: se importan.** Están en `guardas.py`. Una guarda que vive en código actúa aunque nadie abra este fichero.

---

## E-01 · <qué se hizo mal, no qué salió mal>
**Clase:** criterio | instrumento | banco de trabajo · **Veces que saltó:** 0 · *<resumen de una línea>*
**<fecha>, <contexto> (error de <quién>).** <el hecho con su fuente: número, comando, commit, fichero>
**Por qué.** <la causa de método, no la técnica>
**Severidad.** <y en qué moneda: tiempo, una afirmación falsa en un informe, datos>
**Firma (cómo se detecta).** <el síntoma observable la próxima vez, antes de saber la causa>
**Guarda** `[MECÁNICA]` | `[PREGUNTA → punto N]`: <qué impide que vuelva>
**Aplicada en:** <fichero y función> | pendiente | **ABIERTA**

---

## E-01 · Se cambió la pantalla sin actualizar el criterio de su prueba de arranque
**Clase:** instrumento · **Veces que saltó:** 1 · La prueba seguía buscando el texto de la pantalla vacía.
**2026-10-27, fase 01 (error de Codex).** `npm run check` falló porque `tests/arranque.test.js` exigía «Entorno de desarrollo» después de implementar «Registrar compra».
**Por qué.** Se sustituyó la interfaz sin revisar el criterio de la prueba de arranque existente.
**Severidad.** Tiempo de verificación; la compuerta falló, sin pérdida de datos.
**Firma (cómo se detecta).** El componente compila, pero la prueba busca un texto de una pantalla anterior.
**Guarda** `[MECÁNICA]`: ejecutar la prueba de arranque junto con la compilación tras cambiar la pantalla; su aserción busca el acceso al registro vigente.
**Aplicada en:** `tests/arranque.test.js`, ejecutada por `npm run check`. Mutante observado: el texto anterior produjo el fallo antes de actualizarlo.

---

## E-02 · Se perdió la verificación de referencias al exportar SQLite en el navegador
**Clase:** instrumento · **Veces que saltó:** 1 · Exportar una base SQL.js apaga `foreign_keys` en su conexión.
**2026-10-27, fase 01 (error de Codex).** Una comprobación con SQL.js devolvió `PRAGMA foreign_keys = 1` antes de `Database.export()` y `0` después; el adaptador guardaba sin reactivar la opción.
**Por qué.** Se asumió que exportar una base conservaba la configuración de la conexión, sin verificar la propiedad real después de persistir.
**Severidad.** Integridad referencial de la vista de navegador; no había datos reales en la prueba. Android utiliza otra conexión SQLite.
**Firma (cómo se detecta).** `PRAGMA foreign_keys` devuelve 0 después de exportar o de reconstruir la conexión.
**Guarda** `[MECÁNICA]`: reactivar claves foráneas tras cada exportación o reconstrucción y probar que una foto huérfana se rechaza.
**Aplicada en:** `src/datos/adaptador-sqljs.js` y `tests/recorrido.test.js`. Mutante observado: el adaptador anterior deja el pragma en 0 tras exportar.

---

## E-03 · Se preguntó por préstamos sin aplicar primero los casos ya documentados
**Clase:** criterio · **Veces que saltó:** 1 · Se plantearon préstamos personales genéricos en lugar de adelanto propio y crédito comercial.
**2026-10-27, conversación de fluidez (error de Codex).** Se preguntó si registrar préstamos hechos o recibidos sin partir de los escenarios del plan 02 y A3/A4 del roadmap 03; el propietario precisó que hablaba de aportar dinero propio para una compra y del crédito de la casa comercial.
**Por qué.** Se formuló una pregunta amplia antes de contrastar el vocabulario del usuario con los casos y límites ya escritos.
**Severidad.** Claridad y alcance: puede inducir una función fuera de la beta y retrasar la implementación correcta. No se crearon movimientos ni se alteraron saldos.
**Firma (cómo se detecta).** Una pregunta de negocio ofrece alternativas genéricas sin mencionar el ejemplo o la sección que ya resuelve el caso.
**Guarda** `[PREGUNTA → punto 0]`: antes de consultar una regla de negocio, identificar lo que dicen el plan, roadmap y ejemplos y formular solo la duda restante.
**Aplicada en:** `PLANTILLA_FASE.md`, punto 0; su consulta es obligatoria al iniciar o retomar una fase según `AGENTS.md`.

---

## E-04 · Se ofreció un PDF individual sin un informe de la gestión completa
**Clase:** criterio · **Veces que saltó:** 1 · El propietario señaló que no obtenía un informe final de su jornada.
**2026-10-27, ajuste de informe (error de Codex).** La implementación existente `pdf` en `src/exportaciones/informes.js` recibía una sola compra; no existía un informe que reuniera las compras de la gestión.
**Por qué.** Al entregar el primer recorrido se verificó la exportación de una compra, sin comprobar si cubría el informe agrupado que el propietario necesitaba después de su jornada.
**Severidad.** Informe incompleto y confusión sobre la capacidad disponible; sin cambio en datos ni saldos.
**Firma (cómo se detecta).** El único botón PDF depende de seleccionar una compra y no hay opción de generar un informe de la gestión completa.
**Guarda** `[MECÁNICA]`: probar un informe con dos compras y dos monedas, verificar ambas cantidades y factura, y rechazar una compra de otra gestión.
**Aplicada en:** `tests/informe-profesional.test.js` (dos monedas, factura, compra ajena y duplicada, corte y anexos) sobre `src/dominio/informe.js` y `src/exportaciones/informe-pdf.js`. Desde la V2, paquete 1, reemplaza a `pdfGestion` y su prueba. Mutante observado: el original, antes de existir la exportación agrupada; los de la V2, en la ficha `docs/fases/02-paquete1-informe-profesional.md`.

---

## E-05 · Se ejecutaron los mutantes de las guardas contra los contadores reales
**Clase:** banco de trabajo · **Veces que saltó:** 1 · `guardas.py --help` corre los mutantes; sin `GUARDAS_CONTADORES` escribe en `guardas_contadores.json`.
**2026-10-27, revisión del traspaso (error de Claude).** Para ver la ayuda se ejecutó `python3 -I guardas.py --help`; el módulo ignora los argumentos, corrió los once mutantes y creó `guardas_contadores.json` (antes inexistente) con sus saltos. Los recuentos coincidían exactamente con una sola corrida desde cero; se borró el archivo y los mutantes se repitieron con contadores aislados.
**Por qué.** Se ejecutó un instrumento del proyecto para explorarlo sin leer antes qué hace al invocarse, aunque `AGENTS.md` advierte que los mutantes llevan contadores separados.
**Severidad.** Contadores reales falseados durante unos minutos; sin datos de la aplicación afectados.
**Firma (cómo se detecta).** `guardas_contadores.json` aparece o cambia con saltos de todas las guardas en el mismo segundo.
**Guarda** `[MECÁNICA]`: `guardas.py` ejecutado como programa exige `GUARDAS_CONTADORES` distinto del archivo real; sin él se niega y no escribe nada.
**Aplicada en:** `guardas.py`, bloque `__main__`. Mutante observado: sin la variable, la ejecución termina con error y el archivo real no se crea.

---

## E-06 · Se dejaron varios APK con nombres parecidos en Descargas del teléfono
**Clase:** banco de trabajo · **Veces que saltó:** 1 · Tres APK casi iguales; uno era la app con datos reales.
**2026-10-27, validación Android (error de Codex y de Claude).** En Descargas convivían `MisGastos-prueba-ae64da2.apk` (la app real), `Gastos-pruebas-aisladas-ae64da2.apk` y, agregado por Claude, `PRUEBAS-1-Gastos-pruebas-v1.apk`. El propietario no supo cuál servía; a las 17:29:42 el logcat registra la desinstalación de `io.necktral.gastos.entorno` desde el teléfono, y con ella se perdió la única compra real.
**Por qué.** Se copió otro APK sin limpiar los anteriores ni pensar en quien tiene que elegir entre ellos en la pantalla del teléfono.
**Severidad.** Pérdida de datos reales (una compra y sus fotos), sin respaldo.
**Firma (cómo se detecta).** `ls /sdcard/Download` muestra más de un `.apk`, o el propietario pregunta cuál instalar.
**Guarda** `[MECÁNICA]`: `scripts/android/entregar.sh` se niega a copiar si ya hay un APK en Descargas y obliga a un nombre visible explícito.
**Aplicada en:** `scripts/android/entregar.sh`; prueba `tests/guiones-android.test.js`. Mutante observado: sin la comprobación, la prueba de E-06 falla.

---

## E-07 · Se copió un APK por adb sin que el teléfono lo indexara
**Clase:** banco de trabajo · **Veces que saltó:** 1 · El instalador lo abría «en blanco».
**2026-10-27, validación Android (error de Claude).** Tras `adb push`, el índice de medios tenía `_size=NULL` para `PASO-A-instalar-Gastos-pruebas.apk`; el propietario veía una pantalla en blanco al tocarlo. Con `content call --method scan_file` quedó con 28532354 bytes.
**Por qué.** Se supuso que copiar el archivo bastaba para que el administrador de archivos lo viera completo.
**Severidad.** Tiempo y confusión del propietario.
**Firma (cómo se detecta).** El instalador muestra una pantalla vacía, o `content query` da `_size=NULL`.
**Guarda** `[MECÁNICA]`: `scripts/android/entregar.sh` fuerza el reexamen y compara el tamaño indexado con el del archivo; si no coinciden, falla.
**Aplicada en:** `scripts/android/entregar.sh`; prueba `tests/guiones-android.test.js`. Mutante observado: sin la comparación, la prueba de E-07 falla.

---

## E-08 · Una compilación borró los APK de referencia guardados en la carpeta de salida
**Clase:** banco de trabajo · **Veces que saltó:** 1 · Gradle vacía `android/app/build/outputs/apk/debug/`.
**2026-10-27, cierre del paquete 1 (error de Claude).** La compilación de las 17:01 eliminó `app-original-ae64da2.apk`, `gastos-pruebas-aisladas.apk` y otros que Codex había dejado ahí como referencia. Se reconstruyeron desde `ae64da2`.
**Por qué.** Se compiló sin revisar qué había en la carpeta de salida.
**Severidad.** Evidencia perdida y tiempo de recompilación; sin datos afectados.
**Firma (cómo se detecta).** Faltan APK con nombre propio en la carpeta de salida después de compilar.
**Guarda** `[MECÁNICA]` (preventiva por construcción): `scripts/android/compilar.sh` copia cada APK a `apk/` de la carpeta del proyecto (antes, `~/.local/share/gastos-entorno/apk/`) con paquete, versión, commit y huella en el nombre; nunca se guarda nada en la carpeta de salida.
**Aplicada en:** `scripts/android/compilar.sh`. No tiene mutante: no detecta, hace imposible el error.

---

## E-09 · Dos defectos del PDF solo se vieron al rasterizar
**Clase:** instrumento · **Veces que saltó:** 1 · Las pruebas de texto pasaban.
**2026-10-27, orden V2 (error de Claude).** En el informe por destinatario, el párrafo decía «sin movimientos de dinero registrados» aunque abajo mostraba saldos; las rayas del estado financiero tachaban la fila siguiente. Ambos se vieron en `docs/evidencia/informe/` al rasterizar con `pdftoppm`.
**Por qué.** Las pruebas extraen el texto del PDF, pero no comprueban la coherencia entre secciones ni la posición de las líneas.
**Severidad.** Un informe a terceros con una afirmación falsa y una lectura difícil.
**Firma (cómo se detecta).** El PDF tiene secciones que se contradicen, o líneas que cruzan el texto.
**Guarda** `[MECÁNICA]` + `[PREGUNTA → punto 2]`: `tests/api.test.js` exige que, con saldos, el texto no diga «sin movimientos». Y la ficha exige rasterizar y mirar cada PDF de ejemplo antes de cerrar.
**Aplicada en:** `tests/api.test.js` (informe por destinatario) y `PLANTILLA_FASE.md`, punto 2.

---

## E-10 · La primera prueba de respaldo falló antes de llegar al defecto
**Clase:** instrumento · **Veces que saltó:** 1 · El ejemplo de informe no incluía el título obligatorio.
**2026-10-27, fase C1 (error de Codex).** La primera ejecución de `tests/integridad-c1.test.js` falló por `VALIDACION` del título en lugar de comprobar la falta de PDF. Se corrigió el ejemplo y se volvió a ejecutar contra el código previo; entonces falló por ausencia de rechazo, como se pretendía.
**Por qué.** Se construyó la preparación del caso sin copiar todas las opciones obligatorias de un ejemplo existente.
**Severidad.** Evidencia inicial engañosa y tiempo de verificación; únicamente datos sintéticos.
**Firma (cómo se detecta).** El caso negativo falla en la preparación con un campo inválido, antes de ejecutar la acción que debe comprobar.
**Guarda** `[MECÁNICA]`: el caso de `tests/integridad-c1.test.js` primero exige emitir correctamente el informe y luego exige el error de integridad al crear el respaldo; si falta el título falla antes de la aserción.
**Aplicada en:** `tests/integridad-c1.test.js`, prueba C1-03. Mutante observado: omitir el título produce el error de validación mencionado.

---

## E-11 · Se eliminó el aviso visible de operación realizada
**Clase:** instrumento · **Veces que saltó:** 1 · La interfaz seguía preparando mensajes de éxito, pero no los mostraba.
**2026-10-28, integración V2 (error de Codex).** Se detectó al revisar `App.vue`: `mensaje.value` se asignaba al guardar, pero la plantilla ya no contenía un elemento con `role="status"`.
**Por qué.** Al retirar un aviso duplicado en la fase anterior se retiró también el único aviso que debía quedar, sin una aserción que lo exigiera.
**Severidad.** Confusión sobre el resultado de operaciones; sin modificación de datos.
**Firma (cómo se detecta).** Hay asignaciones a `mensaje.value` sin una presentación visible y accesible de ese estado.
**Guarda** `[MECÁNICA]`: `tests/arranque.test.js` exige el aviso condicional con `role="status"` en la plantilla. Mutante observado: la plantilla sin ese aviso incumple la aserción.
**Aplicada en:** `src/interfaz/App.vue` y `tests/arranque.test.js`.

---

## E-12 · El historial mezcló eventos de entidades con el mismo identificador
**Clase:** criterio · **Veces que saltó:** 1 · Se filtraban eventos solo por el texto del identificador.
**2026-10-28, integración V2 (error de Codex).** La prueba `tests/historial-financiero.test.js` creó una gestión y una compra ajena con el mismo ID y detectó el evento de la compra en el historial de la gestión.
**Por qué.** Se supuso que los identificadores eran globalmente únicos, aunque son claves de tablas distintas.
**Severidad.** Presentación de información ajena en el historial; la prueba usó datos sintéticos.
**Firma (cómo se detecta).** Una compra y una gestión de contextos diferentes comparten ID y aparece un evento de la compra en el historial de esa gestión.
**Guarda** `[MECÁNICA]`: identificar cada evento por par entidad e ID y ejecutar el caso con IDs iguales en `tests/historial-financiero.test.js`. Mutante observado: filtrar solo por ID produce el fallo anterior.
**Aplicada en:** `src/api/index.js`, `gestiones.detalle`, y la prueba indicada.

---

## E-13 · Una prueba del PDF pasó por cambiar la fecha interna, no por aplicar el ajuste
**Clase:** instrumento · **Veces que saltó:** 1 · Comparar la huella completa de dos PDF daba una diferencia aunque el dibujo fuera idéntico.
**2026-10-28, integración del editor (error de Codex).** La primera versión de `tests/editor-integracion.test.js` pasó con el exportador sin soporte de ajustes. Al comparar las matrices del contenido de la página se comprobó que las dos eran iguales; después de implementar la transformación, difieren.
**Por qué.** Se compararon bytes globales de un documento que incluye metadatos variables en lugar de la propiedad visual buscada.
**Severidad.** Prueba falsamente positiva de una función de comprobantes; sin datos reales.
**Firma (cómo se detecta).** La prueba dice que cambió el PDF mientras el exportador todavía ignora el argumento de ajuste.
**Guarda** `[MECÁNICA]`: `tests/editor-integracion.test.js` compara las matrices de transformación de la página y comprueba también la huella de la foto original. Mutante observado: el exportador sin ajustes deja las matrices iguales y falla.
**Aplicada en:** `tests/editor-integracion.test.js` y `src/exportaciones/informes.js`.

---

## Ejes no vigilados (agujeros declarados)

*Un registro sin eventos pero con ejes no vigilados no es un certificado de salud: es un certificado con agujeros declarados.*

- <error que hoy sólo detecta una persona leyendo; sin detector mecánico>

## Cómo añadir una entrada

Número siguiente, fecha, los campos del formato, y la guarda con su tipo. Si la guarda no puede ser mecánica, decir por qué y en qué punto del flujo va la pregunta.

---

## E-14 · Se reinstalaron dependencias en el árbol principal en vez de la copia aislada
**Clase:** banco de trabajo · **Veces que saltó:** 1 · `npm ci` se ejecutó en el directorio de trabajo principal.
**2026-10-28, validación Android (error de Codex).** Al crear una copia aislada se encadenó `npm ci` al comando que la creaba, pero el directorio del proceso seguía siendo `/home/wis/dev/gastos-e-informe-de-gastos`. Git seguía limpio; `node_modules` fue reinstalado y se desconoce si contenía modificaciones manuales.
**Por qué.** Se supuso que crear una copia de trabajo cambiaba el directorio del proceso.
**Severidad.** Posible pérdida de ajustes locales ignorados en dependencias; sin evidencia de cambios en archivos versionados ni datos de la aplicación.
**Firma (cómo se detecta).** Un comando de instalación o compilación destructiva apunta al árbol principal pese a existir una ruta aislada.
**Guarda** `[PREGUNTA → punto 0]`: antes de ejecutar instalaciones o compilaciones que reemplacen archivos, comprobar el directorio efectivo, el destino y el estado de archivos ignorados afectados; usar un proceso con directorio explícito de la copia aislada.
**Aplicada en:** `PLANTILLA_FASE.md`, punto 0; el enganche es obligatorio por `AGENTS.md`.
