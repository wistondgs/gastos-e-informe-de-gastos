# Ficha · Fluidez y conciliación V2

## 0. Guardas

Revisadas E-01 a E-14: pruebas de arranque y claves (E-01/02), casos A1–A9 y mandato T1–T8 (E-03), PDF completo y revisión visual (E-04/09), mutantes aislados 11/11 en `/tmp/gastos-conciliacion-guardas.json` (E-05), dispositivo y datos reales protegidos (E-06/07), APK fuera de salida de Gradle (E-08), aserciones negativas y transformación real (E-10/13), avisos e identidad del historial (E-11/12), directorio y archivos ignorados comprobados antes de instalaciones o compilaciones (E-14). No se necesitan nuevas reglas de negocio: se aplican los casos T1–T8 y el plan 02 §§3–6.

## Inspección

1. Existen recepciones y aplicaciones múltiples, saldos, pagos propios/de fondos/de tercero, crédito, devoluciones y traslados; el origen aparece tardíamente y la recepción usa un formulario concentrado.
2. `recepciones.parte_id` representa el propietario o entregante; asignaciones identifican beneficiarios y acreedores de reembolso; `gestiones.responsable_id` identifica responsable; el pago identifica origen y, para fondo/tercero, parte; `deudor_id` identifica deudor comercial; el destinatario del informe es texto, no una relación.
3. El modelo `financiero` solo contiene `saldos` y `liquidaciones`; los importes brutos se omiten al armar el contexto.
4. Al seleccionar compras se filtran filas, pero se mantienen saldos completos de gestiones; por período se toman gestiones de las compras y saldos al corte, sin saldos de apertura ni etiqueta adecuada.
5. Aplicaciones, pagos, movimientos, monedas y saldos se derivan de tablas existentes. Finalidad específica de recepción y destinatario por identificador no están persistidos; las aplicaciones antiguas pueden carecer de fecha de creación suficiente.

## Alcance y pruebas

Mandato: unidades 1–4 y T1–T8; sin ERP, OCR, IA, red ni datos reales. Los escenarios T3/T5 deben fallar antes de corregir el modelo. Revisión de PDF en imágenes obligatoria antes de afirmar G4. Android G5 pendiente hasta ejecución aislada.

## Cierre parcial

Se reprodujeron las fallas T3 y T5 antes de corregirlas (`/tmp/gastos-conciliacion-antes.txt`). El modelo de motor 4 y las pruebas posteriores las resuelven para gestiones completas y seleccionadas, con los límites consignados en la matriz. Se revisó visualmente la única página del PDF sintético incluido. Se ejecutó un recorrido de recepción con identidad y datos sintéticos en navegador; no equivale a Android.

E-01–E-14 consultadas; los once saltos de mutantes son aislados y deliberados. La prueba de navegador detectó E-15 (mensaje de pago no seleccionado); se corrigió y agregó una prueba mecánica. La guarda constructiva E-08 previene por construcción. No se elimina ninguna guarda por silencio. No se usaron datos reales ni se efectuaron instalaciones en el teléfono. G1–G5 permanecen parciales o pendientes; faltan recorrido de compra completo, historial completo de movimientos anulados y saldos de período, y validación Android. Migración 5→6: finalidad y beneficiario opcionales en recepciones. Una base sintética v5 se migró y conservó su reintento idempotente.

## Evidencia de compilación y estado

HEAD inicial y actual: `63b26a4d15246073348e8c69f6f2ff9bfa72dec3`; las modificaciones están sin commit. `npm run check` pasó con 111 pruebas. El APK se compiló en un worktree aislado sobre ese HEAD con el parche exacto `docs/evidencia/conciliacion-v2/codigo-compilado.patch` (SHA-256 `cd4580eecea4c71162ac59be4643ddd4375049835c342b5e7a15fd8d00dc4f8f`). Incluye los cambios de código versionado; el archivo de prueba nuevo y los documentos adicionales no forman parte de la compilación.

APK `io.necktral.gastos.entorno.pruebas`, versión `2.0.0-alfa.1`, código 2: `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-c150e471.apk`; SHA-256 `c150e471a1e34cb5df0f7ed305d6fcc9c95b7d17046fd891375e43c592531274`. Certificado Android Debug SHA-256 `20d4b995519447036cb9f2fa02ed1f9dd8c8e642e83c6e2cc67acc769c3b2b23`. El POCO tiene instalado el mismo paquete de pruebas; no se instaló ni actualizó este APK porque aún no está confirmado si esa instalación contiene datos reales. No se ejecutó T8.

## Intento de validación Android y recuperación de pruebas

El propietario confirmó que `io.necktral.gastos.entorno.pruebas` contenía solo datos sintéticos. El POCO conectado (modelo `24095PCADG`) tenía la versión 2.0.0-alfa.1, esquema 5; se guardó copia local privada de su base, WebView y archivos en `archivo/recuperacion-pruebas-v5/datos-sinteticos-22494e44.tar` (SHA-256 `22494e442a952e3b97b3f1654a38180c13e720e19af448630cdc16f2dbd6c90b`) y de la APK anterior `apk-anterior-3be8ea50.apk` (SHA-256 `3be8ea507466c77661d8a63a9f949d65c6722c22138e51d94f06f8aaea28fc23`). En la copia: SQLite `integrity_check=ok`, 2 compras, 3 fotos, 1 gestión, 1 recepción, 1 aplicación y 1 informe; las huellas de las fotos y el PDF se calcularon antes del intento.

`adb install -r` de la APK nueva respondió `INSTALL_FAILED_USER_RESTRICTED`; después de ese intento `pm list packages` y `pm path` dejaron de mostrar la aplicación de pruebas. No se puede concluir la causa de su desaparición. Un intento posterior de instalar la APK anterior también recibió `INSTALL_FAILED_USER_RESTRICTED`. La copia sintética y APK anterior permanecen en la computadora; la app principal no fue objeto de comandos de instalación ni restauración. No se completaron la migración nativa ni T8. Se pidió mover el APK antiguo de Descargas para no entregar dos instaladores y poder recuperar la app mediante el instalador del teléfono.

## Recuperación de la instalación sintética

El propietario pidió usar la carpeta `APK` del teléfono. Se movió allí el instalador de recuperación, se comprobó su tamaño indexado y el propietario instaló la copia anterior. Se restauró únicamente el paquete `io.necktral.gastos.entorno.pruebas` desde la copia autorizada: la huella de SQLite y las de tres fotos y el PDF coincidieron. La aplicación abrió y mostró dos compras y recuperación del borrador; captura sintética local `/tmp/gastos-pruebas-recuperada.png`.

Se colocó `ACTUALIZAR-Gastos-pruebas.apk` en la carpeta `APK`, se comprobó su tamaño y SHA-256 `c150e471a1e34cb5df0f7ed305d6fcc9c95b7d17046fd891375e43c592531274`. El propietario comunicó instalación finalizada, pero la APK extraída del paquete instalado aún tenía la huella anterior `3be8ea507466c77661d8a63a9f949d65c6722c22138e51d94f06f8aaea28fc23`; por lo tanto, no se afirma que la actualización ni la migración 5→6 hayan ocurrido. Las capturas posteriores del POCO mostraron la app y no el aviso que menciona el propietario. Esperando aclarar qué dispositivo y qué aviso observa. T8 pendiente.

En la copia anterior recuperada se ejecutó `am force-stop` y reapertura del paquete de pruebas. La pantalla volvió a mostrar «Recuperamos el borrador de tu compra» y dos registros (`docs/evidencia/conciliacion-v2/android-version-anterior-tras-cierre-forzado.png`). No se comprobaron el contenido del borrador ni sus fotografías, y esta evidencia corresponde a la versión anterior, no a la APK nueva. Una nueva extracción de la APK instalada tras el aviso del propietario todavía dio la huella anterior; la instalación de la versión nueva sigue sin verificarse.

## Continuación del mandato de cierre · inspección

- **P1:** Gasto, recepción e informe tienen asistentes conectados y probados en navegador; no se acreditó Android. «Ver cómo voy» conduce al detalle clásico, sin asistente propio. El reparto múltiple solo está en modo avanzado.
- **P2:** E-16 requiere esperar escrituras en curso y preservar el borrador al salir. El cuarto recorrido necesita interfaz propia conectada a `saldos.cuentas`, `saldos.consultar`, recepciones e historial. El informe ya tiene sumas por gestión y movimientos vigentes, pero no explica la recepción global y su remanente. El reparto existente puede integrarse al asistente mediante la API transaccional.
- **P3:** No se garantiza reconstrucción completa a todos los cortes: las aplicaciones históricas pueden carecer de fecha y los repartos posteriores ambiguos se rechazan; el historial completo de anulaciones y los saldos iniciales de períodos están pendientes. Las revisiones antiguas conservan sus archivos.
- **P4:** El resumen y el modelo nuevo de informe necesitan ampliar las salidas sin alterar revisiones ya emitidas. La selección de pagos y beneficiarios debe seguir separada y delegar validaciones a la API. No se prevé modificar SQLite salvo necesidad demostrada.

E-01 a E-16 revisadas; casos financieros A1–A9 y escenarios A–F del mandato aplican, sin nuevas decisiones de negocio. E-14: se comprobó el directorio y se preservaron los cambios locales; compilaciones Android en copia aislada. Los 11 mutantes de guardas pasaron con `/tmp/gastos-fase08-29-guardas.json`, separado del contador real. Evidencia anterior: `/tmp/gastos-guias-29-check.txt` registra 127 pruebas aprobadas (incluye las 126 y una posterior). Las dos pruebas nuevas de carrera y salida fallaron contra el código anterior en `/tmp/fase08-e16-antes.txt`.

## Continuación fase 08 · resultado de esta unidad

- **G1 parcial:** E-16 espera escrituras en curso, serializa operaciones de borrador entre instancias y evita abrir un asistente nuevo mientras termina el guardado anterior. Al salir se vacía el borrador pendiente; si falla la compra, se intenta conservarlo. Las pruebas cubren C$1,200, US$12.34, reintento idempotente, fotografías en el borrador y cambio de pantalla. La evidencia negativa está en `docs/evidencia/fase08-cierre/e16-pruebas-antes.txt` y `e16-cambio-pantalla-antes.txt`. Falta ejecutar los casos completos con fotografías y fallos en Android.
- **G2 parcial:** cuatro accesos conectados. En navegador, con datos sintéticos, se crearon una recepción, compra mixta, reparto de C$600/C$250/C$150, reembolso de C$30, estado de cuentas y un informe detallado. La ayuda se encendió y apagó. Faltan recorridos completos de todos los errores y escenarios A–F; el reparto guiado de pagos parciales y crédito sigue en modo avanzado.
- **G3 parcial:** pruebas de API para depósitos sucesivos, múltiples beneficiarios, monedas separadas y el caso del propietario C$10,000 − C$5,600 = C$4,400. En navegador se observaron C$100 aplicados, C$80 usados, C$20 en custodia y C$30 reembolsables antes del reembolso.
- **G4 parcial:** motor PDF 5, modelo común de recepción global y remanente, aplicaciones por gestión, pagos y saldos; se revisaron las dos páginas del PDF ejecutivo sintético `docs/evidencia/fase08-cierre/conciliacion-sintetica.pdf` y se comprobó el Excel `conciliacion-sintetica.xlsx` contra la API. Quedan pendientes algunos cortes antiguos, alcance de períodos, validación detallada de todos los informes y Android. E-17 se encontró visualmente y tiene prueba.
- **G5 BLOCK:** ADB no detectó dispositivo autorizado. No se instaló ni actualizó la app principal ni la de pruebas en esta unidad.

La muestra sintética reconcilia compra C$110, recepción y aplicación C$100, pago con fondos C$80, aporte propio C$30, por reembolsar C$30 y custodia C$20. El efectivo disponible usa los saldos de la API y no se descuenta para crédito o pago propio.

Se revisó el dictamen: `allowBackup` estaba activo. La configuración actual lo desactiva e incluye reglas separadas de exclusión para nube y transferencia entre dispositivos, preservando el respaldo manual; la eficacia de cada fabricante sigue pendiente de prueba nativa. La firma actual es de depuración, no una firma estable de producción. El script de APK ahora marca `modificado` si el árbol no está limpio; no se presenta la APK como si el SHA publicado fuera todo su contenido.

La copia aislada se basó en `63b26a4d15246073348e8c69f6f2ff9bfa72dec3` más `fuente-cambios-versionados.patch` (SHA-256 `0c71fb580350e15383d8b096e2d09fcdc6e7d1ffd4e72e82e5efa9776be16323`) y los archivos nuevos identificados en `huellas-codigo-guiado.txt`. Se compararon código y pruebas de la copia con el árbol principal; `npm run check` pasó 139 pruebas. La APK `io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-modificado-1534adfd.apk` tiene SHA-256 `1534adfdb9144d88b83524c0fd70bb9d451c35d8b544dfbcc361eff8cab039e0`, versión `2.0.0-alfa.1` código 2 y certificado Android Debug SHA-256 `20d4b995519447036cb9f2fa02ed1f9dd8c8e642e83c6e2cc67acc769c3b2b23`. `aapt` confirmó `allowBackup=false` y reglas de extracción incluidas. La APK no se instaló.

Se consultaron E-01–E-16 y se registró E-17; los 11 mutantes de guardas fueron deliberados y aislados. E-08 es preventiva por construcción y su silencio no justifica poda. No se creó commit ni se publicó: la condición de cierre de las compuertas todavía no se ha cumplido.

### Prueba adicional de depósitos en navegador

Se registraron tres entradas sintéticas de C$100,000, C$100,000 y C$20,000 en una gestión, y una compra de C$150,000 pagada con esos fondos. La interfaz mostró C$220,000 aplicados, C$150,000 usados y C$70,000 disponibles. Se detectaron y corrigieron E-18 (parte recién creada repetida visualmente, identificador único) y E-19 (el mensaje de una entrada describía su importe como si fuera el saldo acumulado). Se añadieron pruebas negativas y ambas entradas están registradas en `ERRORES_Y_GUARDAS.md`. Los gates permanecen pendientes según la matriz: la prueba de navegador no sustituye Android, los fallos de almacenamiento nativo ni la revisión completa de documentos.

### Continuación: informe histórico y procedencia de APK

La prueba histórica de compra anulada el día 20 y corte al 15 se amplió: además del PDF, verifica en Excel la compra de C$1,000 y su saldo por reembolsar por C$1,000. La prueba usa exclusivamente datos sintéticos. Un primer intento buscó la hoja equivocada (Conciliación); se corrigió la prueba para revisar la hoja real del informe por destinatario (Fondos y saldos). No se modificó el motor financiero.

La APK aislada más reciente es `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-modificado-27f30255.apk`, SHA-256 `27f30255d1a9b39e9c0354ec00b304acd942913c4139baad130b4a5eebd9d6d0`, versión `2.0.0-alfa.1`, código 2, paquete `io.necktral.gastos.entorno.pruebas` y certificado de depuración SHA-256 `20d4b995519447036cb9f2fa02ed1f9dd8c8e642e83c6e2cc67acc769c3b2b23`. Se compiló en copia aislada desde `63b26a4d15246073348e8c69f6f2ff9bfa72dec3` con modificaciones locales; el parche, los archivos nuevos y los registros de compilación y pruebas de esa copia están en `docs/evidencia/fase08-cierre/` con sufijo `27f30255`. El parche tiene SHA-256 `3de74e3108c46dbe0134f714032222d4ae18c4cb1b490f087d6b27248d10d6fe` y el archivo de fuentes nuevas `c23d269677130e2fc45f1e21d98dc501cdfbde13f73fe413a8347ac9fca50eff`. La ampliación posterior de la prueba histórica no cambia código de la aplicación incluida en esa APK.

Se consultaron las guardas aplicables E-01–E-19 y se ejecutaron los 11 mutantes con contadores aislados en `/tmp/gastos-guardas-actual-29.json`; los saltos fueron deliberados, la guarda constructiva no salta por diseño y no se podó ninguna. No se instaló ni actualizó ninguna aplicación: ADB no detectó un dispositivo. Los gates conservan sus estados anteriores y el cierre sigue pendiente.

### Reparación económica: inspección y avance

Punto 0: E-01–E-19 revisadas; aplican E-03 (dirección financiera), E-09 (revisar PDF visualmente), E-10 (la prueba debe llegar al defecto), E-12 (entidad e ID), E-14 (preservar el árbol y no compilar sobre sus salidas) y E-16 (borradores). Los 11 mutantes de guardas pasaron con contadores aislados en `/tmp/gastos-reparacion-guardas-29.json`. El usuario confirmó el traspaso exclusivo de la sesión anterior. Se preservó el diff inicial y las fuentes nuevas en `/tmp/gastos-reparacion-inicial-20261029/`; no se abrió el Excel restringido. SHA de partida `63b26a4d15246073348e8c69f6f2ff9bfa72dec3`, 38 entradas de estado Git; esquema inicial 6.

Inspección: **DEFECTO REPRODUCIDO** crédito sin abonos clasificado como sin movimientos; **DEFECTO REPRODUCIDO** reembolso sin gestión no aplicable; **DEFECTO REPRODUCIDO** informe por parte sin compras que oculta fondos recibidos; **INCOMPLETO** resolución de fondos ajenos usados para gasto personal, pendiente de decisión económica; **YA CORREGIDO** E-16 en el código previo, con pruebas existentes, sin validación nativa. A1–A9 ya existían, pero A4 no comprobaba el estado previo al primer pago. Pruebas negativas previas conservadas en `/tmp/gastos-economia-antes.txt`, `/tmp/gastos-economia-sin-gestion-antes.txt` y `/tmp/gastos-economia-recepcion-antes.txt`.

Se corrigió la clasificación de crédito y el alcance de saldos por destinatario; los informes de una parte incluyen únicamente sus recepciones, diferenciando total recibido de lo pendiente de aplicar. Se demostró necesaria la migración 6→7 porque `aplicaciones.gestion_id` era `NOT NULL`: la nueva tabla admite null solo para reembolso y conserva las filas e índice. La API permite liquidar esas obligaciones por la misma parte y moneda, valida que no excedan el saldo y mantiene la atomicidad y el reintento. La base 7 no es compatible hacia atrás con una app de esquema 6; no se ha instalado ni migrado ninguna base real. Las pruebas cubren la migración sintética, restauración, moneda y reintento. La resolución de regularizaciones, los restantes recorridos y Android siguen pendientes; no se cierran gates por inferencia.

Además se reprodujo y corrigió la omisión del saldo por reembolsar sin gestión en el informe por destinatario. La evidencia negativa de los cuatro defectos está en `docs/evidencia/reparacion-economica-v2/`. La prueba T1 registra tres anticipos y una compra y verifica exactamente C$70,000 en custodia. Resultado final: `npm run check`, 146 pruebas aprobadas, formato, lint y compilación web; no se construyó un APK con esquema 7. Permanecen pendientes la resolución económica de la regularización, la validación visual de los informes nuevos y Android nativo. No hay commit ni publicación; SHA final de HEAD igual al inicial, con cambios locales preservados.

### Continuación de cierre del motor

Al inicio, `master` seguía en `63b26a4d15246073348e8c69f6f2ff9bfa72dec3`, con esquema local 7 y cambios pendientes de la unidad anterior. Las 146 pruebas reportadas volvieron a pasar. Se consultaron E-01–E-19; las 11 pruebas deliberadas de guardas pasaron con contadores separados en `/tmp/gastos-cierre-motor-guardas.json`, sin saltos reales nuevos. E-08 es preventiva por construcción; no se eliminan guardas por silencio.

`por_regularizar`: para C$1,000 en anticipo y C$200 de gasto personal, la prueba sintética demuestra C$800 de custodia, C$200 por regularizar, cero reembolso y una compra. No hay movimiento que liquide esa obligación. Los requisitos consultados no establecen quién responde por ella ni autorizan una forma concreta de reintegro o reclasificación. Se consultó al propietario y se mantiene pendiente; no se compensan saldos automáticamente. La prueba detectó el mutante que elimina el saldo, evidencia en `docs/evidencia/reparacion-economica-v2/mutante-regularizacion.txt`.

Se amplió la prueba de migración 6→7 para comparar todas las tablas, incluidas compras, pagos, aplicaciones, eventos, identificadores y referencias a comprobantes. Detectó el mutante que omite copiar aplicaciones; evidencia en `mutante-migracion.txt`. El respaldo/restauración sintético previo conserva el reembolso sin gestión; no se ha verificado la migración de archivos físicos en Android.

Con datos exclusivamente sintéticos se generaron tres informes, PDF y Excel, en `docs/evidencia/reparacion-economica-v2/documentos-sinteticos/`. Se inspeccionaron visualmente las cuatro páginas rasterizadas: sin texto cortado u otros defectos visibles en esos ejemplos. En la gestión, API y hojas muestran C$100 aplicados, C$80 usados, C$30 aportados, C$20 de custodia y C$6,000 pendientes del crédito. El informe de la empresa sin compras muestra C$250 recibidos, C$50 sin aplicar y C$200 en custodia; el informe de otra parte muestra US$15 por reembolsar sin gestión. Se comprobó por lectura programática que Excel contiene esos valores y que el informe de la empresa sin compras no incluye a la otra empresa. Los informes parciales e históricos tienen pruebas previas; la revisión de estos tres ejemplos no certifica todos los posibles alcances ni la presentación nativa.

G1 sigue BLOCK por la decisión de regularización; G2 queda pendiente para la fase visual; G3 es parcial por los alcances y presentación aún no verificados; G4 es parcial hasta SQLite nativo y pruebas de actualización; G5 BLOCK por falta de validación nativa. No se creó APK, no se tocaron datos reales y no se publicó en GitHub.

### Inspección para liquidar regularizaciones

El mandato posterior autoriza expresamente reposición a custodia y devolución directa. Estado inicial `master`, HEAD `63b26a4d15246073348e8c69f6f2ff9bfa72dec3`, esquema 7 y 147 pruebas aprobadas. Se revisaron E-01–E-19 y los once mutantes de guardas pasaron con contadores aislados en `/tmp/gastos-liquidacion-guardas.json`. El diff y las fuentes nuevas se preservaron en `/tmp/gastos-integracion-economica-inicial/`. No se abrió el Excel restringido.

El saldo actual `por_regularizar` se agrega por gestión, dueño y moneda a partir de pagos con fondos imputados a gasto personal. El esquema no almacena una atribución de beneficiario o responsable, ni movimientos de reintegro vinculados a un pago específico; por tanto no permite ejecutar con trazabilidad las dos modalidades autorizadas. Es necesaria una ampliación persistente con migración, validación por obligación, auditoría, transacciones, respaldo y proyección de informes. Esta inspección no implementa dicha ampliación. Los gates permanecen sin cambios y no se ha generado ni instalado APK.

### Implementación de regularizaciones · punto 0

E-01–E-19 revisadas; aplican E-03 por las reglas económicas, E-09 por la verificación visual de PDF, E-10 para la validez de los negativos, E-12 para el par entidad/identificador y E-14 para preservar el árbol. Los once mutantes de guardas se ejecutaron con contadores aislados en `/tmp/gastos-regularizaciones-guardas.json`. El diff de partida se preservó en `/tmp/gastos-regularizaciones-inicial.patch`; la sesión anterior autorizó el traspaso exclusivo y no se detectaron procesos hijos escribiendo en el proyecto.

Se implementó la migración SQLite 7→8, con atribución explícita de responsable y beneficiario por pago original y hechos de regularización con pagador, fecha, modalidad, importe, motivo y anulación. No hay saldos persistidos paralelos. La API `regularizaciones.atribuir`, `liquidar`, `listar` y `anular` usa transacciones y auditoría; el propietario y la moneda se derivan del pago. La reposición incrementa custodia; la devolución directa no. Un pago anterior sin atribución no puede liquidarse. Exceso, concurrencia y anulación del pago con liquidación activa se rechazan. El esquema 8 no puede abrirse con versiones anteriores.

Ejemplo mixto probado: C$1,000 recibidos, C$200 usados personalmente, C$80 repuestos y C$120 devueltos directamente → C$880 en custodia y C$0 por regularizar, una compra y una recepción. Las pruebas cubren responsables distintos, dos obligaciones, empresas y monedas separadas, reintento, concurrencia, anulación, respaldo y migración sintética 7→8. Se detectó el mutante que elimina el límite por pago, conservado en `docs/evidencia/reparacion-economica-v2/regularizaciones/`. `npm run check`: 153 pruebas aprobadas. La proyección por gestión, PDF motor 6 y Excel muestran obligación original, reposición, devolución directa y saldo pendiente; se inspeccionaron las dos páginas del PDF sintético de esa carpeta. Informes históricos conservan sus copias; Excel acepta motor 5 anterior.

G1 permanece parcial mientras no se completen todos los escenarios económicos y se valide la implementación en Android; G2 pendiente; G3 parcial porque se verificó solo el alcance de gestión, no todos los alcances; G4 parcial porque la migración y el respaldo se probaron en SQL.js y no nativamente; G5 BLOCK. No se generó ni instaló APK, no se tocaron datos reales ni se publicó en GitHub. No se inicia la fase visual.

### Corrección de alcance: integración de encargos

Se detuvo la ampliación funcional y se conservaron el esquema 8 y los cambios existentes. E-01–E-19 consultadas; aplican E-03, E-09, E-10 y E-14. Los once mutantes de guardas pasaron con contadores aislados en `/tmp/gastos-alcance-guardas.json`; E-08 es constructiva. La prueba de la prueba anuló deliberadamente el aporte propio en una copia temporal y produjo tres fallos. Se detectó E-20: el informe omitía la custodia cuando era cero. Se corrigieron los exportadores y se elevó el motor PDF a 7 para preservar revisiones previas; Excel sigue admitiendo motor 6. Evidencia negativa y documento sintético rasterizado en `docs/evidencia/integracion-encargos/`.

| Recorrido sintético | Esperado | Obtenido | Resultado |
| --- | --- | --- | --- |
| Recibir C$800, comprar C$1,000 | Custodia C$0; reembolso C$200 | C$0; C$200 | PASS |
| Recibir C$800 + C$800, comprar C$1,000 | Custodia C$600; reembolso C$0 | C$600; C$0 | PASS |
| Nuevo anticipo C$800 después de la primera compra | Custodia C$800; reembolso C$200 hasta reembolso explícito | C$800; C$200; tras reembolso C$0 | PASS |
| Tres compras C$1,000 + C$300 + C$500 con C$1,600 de fondos | Total C$1,800; custodia C$0; reembolso C$200; tres compras | Coincide; tres compras | PASS |
| Informe PDF y Excel de las tres compras | Recibido y usado C$1,600; propio C$200; custodia C$0; total C$1,800 | Coincide en API, PDF y Excel | PASS |

La prueba ejecuta la preparación financiera de interfaz, la API, SQLite SQL.js y los exportadores; comprueba que los reintentos de compra no duplican. No ejecuta la interacción de pantallas ni Android nativo. `npm run check`: 157 pruebas aprobadas. No se cambió SQLite ni se instalaron APK o tocaron datos reales. No se continúa con otra ampliación.
