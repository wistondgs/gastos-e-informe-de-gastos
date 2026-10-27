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
**Aplicada en:** `tests/informe-gestion.test.js` y `src/exportaciones/informes.js` (`pdfGestion`). Mutante observado: antes de implementar `pdfGestion`, la prueba falló al no existir la exportación agrupada.

---

## Ejes no vigilados (agujeros declarados)

*Un registro sin eventos pero con ejes no vigilados no es un certificado de salud: es un certificado con agujeros declarados.*

- <error que hoy sólo detecta una persona leyendo; sin detector mecánico>

## Cómo añadir una entrada

Número siguiente, fecha, los campos del formato, y la guarda con su tipo. Si la guarda no puede ser mecánica, decir por qué y en qué punto del flujo va la pregunta.
