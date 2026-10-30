# Ficha de fase · Interfaz guiada: registro paso a paso, modo aprendizaje y temas

## 0. Errores y guardas aplicables

- **Entradas revisadas de `ERRORES_Y_GUARDAS.md`:** E-01 a E-15.
- **Las que aplican y cómo se cumple cada guarda:**
  - **E-01** (pantalla cambiada sin su prueba de arranque): `tests/arranque.test.js` sigue pasando (busca «Registrar compra», que conserva la versión clásica) y `tests/interfaz-guiada.test.js` compila las pantallas nuevas y exige que `App.vue` las abra.
  - **E-11** (aviso de operación realizada): el aviso `role="status"` de `App.vue` no se tocó; el asistente muestra sus avisos con `role="status"` y los errores con `role="alert"`.
  - **E-14** (instalación o compilación en el árbol equivocado): antes de `npm run check` se comprobó el directorio efectivo (`/home/wis/dev/gastos-e-informe-de-gastos`). No se instalaron dependencias. La compilación solo reescribe `dist/`, ignorado por git; el APK de la fase 08 se compiló en un worktree aparte, así que no depende de ese `dist/`.
  - **E-15** (el pago vacío pedía una persona): la validación nueva `faltaEnPaso` pide «Contestá si ya se pagó» y «Elegí con qué plata se pagó»; la prueba lo exige y su mutante se detectó.
  - **E-03** (reglas de negocio): no se creó ninguna regla nueva. Las respuestas del asistente se traducen a las selecciones existentes de `prepararCompraFinanciera` (plan 02, §§3–6). Los saldos los sigue calculando la API.
  - **E-02, E-04 a E-10, E-12 y E-13:** no aplican; no se tocaron la persistencia, el PDF, los informes, el respaldo, el historial ni los guiones de Android.
- **Resultado de los mutantes de las guardas:** `GUARDAS_CONTADORES` apuntó a un archivo de la carpeta temporal de la sesión, distinto del real; resultado: «LAS GUARDAS SIRVEN». El archivo real no se creó ni se modificó.

## 1. Mandato y alcance

- **Mandato del propietario (28-10):** integrar en la app el diseño guiado aprobado en el lienzo de Claude Design. Las personas usuarias tienen poca práctica con la tecnología: cada paso debe decir qué hacer, con un modo aprendizaje que se pueda encender y apagar.
- **Capacidades:**
  - Inicio guiado: «¿Qué querés hacer?», el botón grande «Registrar un gasto» que abre la cámara, los otros caminos explicados, lo pendiente y un interruptor del modo aprendizaje.
  - Registro de gasto en 7 pasos: cámara en ráfaga; revisión de fotos en carrusel circular, con tipo, giro, recorte, quitar y reordenar arrastrando o con botones; importe con teclado; negocio y concepto; para quién, con alta de una empresa o persona si no está; pago en preguntas simples; y revisión con «Cambiar» en cada línea.
  - Modo aprendizaje: instrucciones numeradas, ejemplo y «¿Para qué sirve?» en cada paso; viene encendido y se apaga desde Inicio o con el botón «?».
  - 10 temas (colores, tipografía y esquinas). Se elige en Inicio, con el botón «Colores».
  - Borrador propio (`compra-guiada`): si se cierra la app, retoma en el mismo paso, con las fotos.
  - Interruptor entre la versión guiada y la clásica; las dos conviven.
- **Fuera del alcance:**
  - Llevar el mismo enfoque guiado a recibir dinero, informes, respaldo y gestiones; por ahora esos caminos abren las pantallas clásicas.
  - Aplicar los temas a las pantallas clásicas.
  - Repartir un gasto entre varias partes desde el asistente; sigue en la versión clásica.
- **Decisiones que requieren consulta:** ninguna nueva. Un gasto propio («Es un gasto mío») que quedó debiendo se guarda «sin detalle», porque `prepararCompraFinanciera` exige un deudor que es una parte; queda pendiente en Inicio.

## 2. Criterios y pruebas

| Capacidad           | Criterio                                                                                                                                                 | Prueba                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Traducción del pago | «Con mi plata» deja por reembolsar; «quedó debiendo» deja deuda con el proveedor; «pagó directo» y «gasto mío» no dejan saldo; «no sé» queda sin detalle | `tests/interfaz-guiada.test.js`, sobre la API real con SQL.js |
| Validación por paso | Cada paso dice qué falta; el de pago pide el pago, no una persona (E-15)                                                                                 | ídem                                                          |
| Carrusel y orden    | La lista es circular; mover una foto no pierde ninguna                                                                                                   | ídem                                                          |
| Preferencias        | Se guardan; un tema desconocido o un almacenamiento bloqueado vuelven a los valores iniciales                                                            | ídem                                                          |
| Temas               | Hay 10 y todos definen las mismas variables                                                                                                              | ídem                                                          |
| Integración         | Las dos pantallas nuevas compilan; `App.vue` las abre desde Inicio, el menú y el botón atrás de Android                                                  | ídem                                                          |

- **Las pruebas de las pruebas:** 6 mutantes sembrados a mano:
  - el origen propio cambiado por tercero;
  - «no sé» cambiado por crédito;
  - el carrusel sin vuelta;
  - el mensaje de E-15 que vuelve a pedir una persona;
  - un tema desconocido aceptado;
  - el menú sin abrir la versión guiada.

  **Resultado: 6 de 6 detectados.** El código quedó restaurado y se comprobó byte a byte.

- **Compuerta:** `npm run check` pasa con 121 pruebas (111 anteriores y 10 nuevas); lint, formato y compilación sin errores.
- **Recorrido en navegador** (`npm run dev`, 375×812, datos sintéticos, fotos generadas con un canvas):
  - Inicio, la cámara, la carga de 2 fotos y el carrusel (de «2 de 2» vuelve a «1 de 2»).
  - Marcar el voucher, reordenar, el teclado (C$ 4,250.75), negocio y factura «0000124», para quién, pago, revisar y guardar.
  - En el detalle de la compra clásica: contado, pago propio, los ceros conservados y 2 comprobantes (factura y voucher).
  - Un segundo recorrido dio de alta «Empresa de prueba S.A.» en el paso «Para quién», con pago «con mi plata». La opción «fondos» apareció deshabilitada y explicada, y la compra quedó con reparto y pago propio.
- **PDF:** no se modificó (E-09 no aplica).
- **Android e iOS:** no se probaron. La cámara nativa usa el mismo `Camera.getPhoto` que la pantalla clásica; falta probarla en el teléfono, en la instalación aislada.

## 3. Cierre

- **Resultado:** todos los criterios de §2 se cumplen en la compuerta y en el recorrido de navegador.
- **Guardas:**
  - consultadas: E-01, E-03, E-11, E-14 y E-15;
  - saltos reales: ninguno;
  - los mutantes de `guardas.py` saltaron de forma deliberada, con contadores aislados;
  - E-08 sigue siendo preventiva por construcción.
- **Errores propios nuevos:** ninguno que haya afectado datos o pruebas. En el recorrido se corrigieron tres defectos de presentación antes del cierre:
  - el texto de pie de la vista clásica se superponía;
  - la fecha salía con «De» en mayúscula;
  - un aviso terminaba en «S.A..».
- **Trabajo concurrente:** el árbol tenía cambios sin commit de la fase 08. Solo se tocó `App.vue` en puntos acotados: imports, preferencias, el botón atrás, el montaje de las pantallas guiadas, el menú y un estilo. Su versión anterior quedó copiada en la carpeta temporal de la sesión. No se hizo commit.
- **Pendientes:**
  - prueba en Android (cámara nativa y botón atrás);
  - llevar la guía a recibir dinero, informes y gestiones;
  - temas en las pantallas clásicas;
  - reparto entre varios en el asistente.

## Compilación Android (28-10)

- **Copia aislada (E-14):** un worktree en la carpeta temporal de la sesión, sobre `63b26a4`, con `git diff` del árbol principal (SHA-256 del parche `efbb839430220930220ca33734907e249fe777eb91a7944a661cbeb186eb4b63`) más los archivos sin commit: `src/interfaz/guiada/*`, `tests/interfaz-guiada.test.js` y `tests/conciliacion-v2.test.js`. `npm ci` y la compilación corrieron con el directorio de esa copia explícito. Allí, `npm test`: 121 de 121.
- **APK de pruebas:** `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-6ab182f0.apk`, SHA-256 `6ab182f077b52781fc0efca56678396fad27a134e8b8515da169e36aec417c34`. Certificado `20d4b995…3b2b23`, el mismo que el instalado, así que actualiza sin borrar datos.
- **Instalación:** pendiente. El teléfono no estaba conectado por `adb` al terminar la compilación.

## Ampliación (28-10): Recibí dinero e Informe guiados

- **Mandato:** el propietario pidió avanzar sin esperar al teléfono, probando con datos e imágenes sintéticas.
- **Capacidades nuevas:**
  - **Recibí dinero** (`RecibirGuiado.vue`), en 4 pasos: quién, cuánto, para qué y revisar.
    - «Me están devolviendo» va como reembolso, «Me la dieron para gastar» como anticipo, y «No sé todavía» queda sin aplicar.
    - Para elegir la gestión se muestra lo que esa parte debe en cada una, con `saldos.consultar`. Las deudas de compras sin gestión no se ofrecen, porque no admiten una aplicación; se avisa con una nota.
  - **Entregar un informe** (`InformeGuiado.vue`), en 4 pasos: de qué (una gestión, una empresa o persona, o unas fechas), para quién, cómo (con o sin fotos, Carta o A4) y revisar.
    - En la revisión se muestran los totales de `informes.previsualizar` y se puede ver la vista previa antes de emitir.
    - Al final se manda el PDF (`informes.abrir`) o el Excel (`informes.excel`).
  - En los dos asistentes se pueden crear la gestión y la empresa o persona sin salir del paso.
  - Los estilos compartidos están en `src/interfaz/guiada/guiada.css`, con todo colgado de `.guiada`.
- **Pruebas nuevas:**
  - Recibí dinero sobre la API: reembolso, custodia y monto sin aplicar.
  - Informe: por gestión, por empresa (solo lo suyo) y fechas inválidas.
  - Las pantallas compilan y `App.vue` las abre.
  - La guarda de E-16, con su mutante detectado.
  - **Compuerta:** 126 de 126.
- **Recorrido en navegador** (datos sintéticos):
  - Un gasto de C$ 1,200 en una gestión creada en el mismo paso, con pago «con mi plata».
  - Un segundo registro que empieza limpio (C$ 0.00).
  - Recibí dinero: la devolución saldó la deuda de la gestión, que después figuró en cero.
  - Informe `GR-9FF790D5-R01`: C$ 1,200.00, 1 compra; el PDF y el Excel se generaron sin errores.
  - Tema «Noche» aplicado a las pantallas nuevas.
- **Error propio:** E-16, registrado con su guarda mecánica y su mutante. Fue un guardado diferido que resucitaba el borrador descartado; se detectó en el recorrido.
- **APK:** `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-40c57872.apk`, SHA-256 `40c57872d54dab238a7c65609ad54a4ab00cc6140713731e88f31376dbdb5e98`. Se compiló en la copia aislada con el parche `fe7ac732…931e`; se comprobó, archivo por archivo, que el código y las pruebas eran idénticos al árbol principal, y allí corrieron 126 de 126 pruebas. Reemplaza al APK `6ab182f0`, que no se entregó.
- **Instalación en el teléfono:** pendiente, porque no está conectado por `adb`.

## 29-10 · Pasos numerados y visibles

A solicitud del propietario se sustituyeron las barras sin números por `PasosGuiados.vue`: cada asistente muestra número y nombre de cada etapa, destaca la actual y la marca para lectores de pantalla. El indicador se presenta también en el primer paso de cámara. Las listas de pasos existentes siguen determinando el orden; no se cambió la API, SQLite, los saldos, la navegación financiera ni los datos guardados. Se conservaron los cambios previos sin commit del árbol.

Se revisaron en navegador los asistentes de gasto y recepción, con tamaño móvil 375×812, y la estructura del de informes. `npm run check` pasó con 127 pruebas, incluida la comprobación del componente y su integración en los tres asistentes. Se revisaron E-01 a E-16 y se ejecutaron los 11 mutantes de `guardas.py` con contadores aislados en `/tmp/gastos-guia-29-guardas.json`; no se alteraron los contadores reales. E-03 se cumple manteniendo las reglas financieras aprobadas; E-14 se cumple compilando el APK en una copia aislada. No se observaron errores propios nuevos. El indicador preventivo E-08 no necesita saltar; no se podaron guardas por esta unidad.

Android nativo permanece pendiente: el POCO no estaba conectado por ADB durante esta revisión, por lo que no se instaló ni se actualizó ninguna aplicación. Las pantallas tradicionales de gestión y respaldo todavía no tienen este mismo recorrido guiado.

La APK aislada de esta revisión se compiló en `/tmp/gastos-pasos-visibles-29` desde `63b26a4d15246073348e8c69f6f2ff9bfa72dec3`, con el diff de archivos versionados SHA-256 `fe7ac732651205ccacf6aedbf849a25926e327463ccbb2850b07bf72dfcb931e` y el directorio de interfaz guiada sin commit copiado y comparado con el árbol principal. Archivo: `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-2ffd59ed.apk`; SHA-256 `2ffd59ed1908e644dad15c33ae9fc5cf8a377710668fead30964a49d2865d29e`, paquete `io.necktral.gastos.entorno.pruebas`, certificado de depuración SHA-256 `20d4b995519447036cb9f2fa02ed1f9dd8c8e642e83c6e2cc67acc769c3b2b23`. No se instaló ni ejecutó en Android.

## Fase 09 autorizada · integración de caja e informes

Punto 0: E-01–E-20 revisadas. Aplican E-03 (API como fuente de saldos), E-09 (inspección visual de informes), E-10 (probar los negativos), E-12 (identificar entidad y clave), E-14 (preservar el árbol) y E-16 (borradores). Once mutantes de guardas pasaron con contadores aislados en `/tmp/gastos-fase09-guardas.json`; E-08 es preventiva por construcción. HEAD inicial `63b26a4d15246073348e8c69f6f2ff9bfa72dec3`, cambios previos preservados, esquema 8 y 157 pruebas iniciales aprobadas. `InicioGuiado`, `AsistenteGasto`, `RecibirGuiado`, `InformeGuiado` y `VerComoVoy` ya están conectados; para movimientos se dispone de `gestiones.detalle`, recepciones y saldos de la API. No se autoriza migración ni nueva lógica financiera.

Avance: inicio y cambio entre Modo Fácil y Estándar identificados claramente; la gestión se muestra en Inicio cuando hay una sola abierta, con su custodia calculada por la API. Las recepciones y compras admiten fecha elegida; la recepción la muestra en la revisión. La confirmación de compra consulta la API para mostrar el disponible y lo pendiente. La caja muestra movimientos de una gestión seleccionada, distingue la compra de sus pagos y abre la compra. Al filtrar por persona omite movimientos cuya parte no puede identificarse y lo advierte. La vista previa consume el resumen financiero del propio modelo de informe sin emitir revisión. Se eliminó el nombre del propietario como ejemplo visible y de los nuevos datos sintéticos, usando Juan.

En Chrome con almacenamiento sintético: U1 PASS, dos entregas C$1,000 y C$3,000 visibles por separado y C$4,000 aplicados; U2 PASS, compra de C$2,500 y custodia C$1,500; U3 PASS, compra C$1,000 con C$800 de fondos y C$200 propios, custodia cero y reembolso pendiente C$200; U4 PASS, anticipo posterior C$800 conserva C$200 por reembolsar; U5 PASS, reembolso C$200 reduce esa obligación a cero sin cambiar custodia C$800. U7 parcial: la compra C$2,500 aparece al cambiar a Estándar y el saldo se conserva al volver; no se comprobaron fotos e identificador en ese recorrido.

Informes por gestión: se ordenan recepciones por fecha, se preservan fechas y referencias, y se muestra para cada compra el pago con fondos, propio, directo y crédito pendiente; los resúmenes se derivan de movimientos existentes y las deudas del motor. En informes por destinatario no se expone el pago completo de compras repartidas. PDF motor 8; revisiones anteriores conservan su copia privada y Excel acepta motor 7. Se verificaron PDF/Excel sintéticos de tres compras por C$1,800, C$1,600 de fondos y C$200 propios, con custodia cero; se inspeccionaron ambas páginas. El ejemplo y pruebas negativas están en `docs/evidencia/fase09/`. U6 y U8 parciales: los importes y dos fechas se verificaron por API y exportadores, pero no se completaron ambos recorridos enteros en navegador. U9 parcial: siguen pendientes los ensayos de privacidad y todos los alcances desde la interfaz. U10: batería de 162 pruebas aprobadas; Android no ejecutado.

E-21 se detectó y corrigió: las recepciones podían salir en orden inverso; la prueba detecta un mutante de orden invertido. G1 parcial hasta completar regresiones de todos los escenarios; G2 parcial, no se han completado todos los recorridos ni reorganizado las secciones estándar; G3 parcial por alcances e informes pendientes; G4 parcial hasta recuperación nativa; G5 BLOCK. No se generó APK ni se tocaron datos reales; no hay commit ni publicación.

Continuación: en el navegador se registraron tres compras sintéticas de C$1,000, C$300 y C$500, esta última con C$300 del fondo y C$200 propios. La vista previa mostró tres compras por C$1,800, C$1,600 usados, C$200 propios y custodia C$0; se emitió la revisión `GR-9C6B30CF-R01` y se pulsaron los botones PDF y Excel. Sus archivos descargados de esa interacción no se inspeccionaron; la conciliación de ambos formatos se comprobó con datos equivalentes en pruebas automatizadas y el PDF sintético de `docs/evidencia/fase09/`. U6 permanece parcial hasta comprobar esos archivos reales de interfaz.

E-22: se reprodujo con datos sintéticos la exposición del total de una compra compartida en PDF y Excel por destinatario. Se eliminó ese total del detalle y de la cabecera de anexo, conservando el importe asignado; una prueba protege PDF y Excel y el PDF sintético se inspeccionó. PDF motor 9 y copias históricas preservadas; compartir un comprobante que contiene información de otras partes sigue requiriendo selección explícita. E-23: el historial del mismo día se ordenaba por ID; ahora usa el orden de registro disponible, y si la aplicación tiene evento posterior muestra su fecha real. Cuando falta fecha de aplicación se identifica explícitamente la fecha de recepción como tal. No se inferieron fechas desconocidas.

Última comprobación: `npm run check` aprobó 165 pruebas. La vista previa también muestra los saldos disponibles para informes por destinatario. Se revisaron visualmente el informe por gestión y el informe privado sintético de una parte; el negativo de privacidad está en `docs/evidencia/fase09/`. G1–G4 permanecen parciales: faltan recorridos de alcances y sus archivos obtenidos desde la interfaz, organización y comprobación completa del modo estándar y restauración nativa. G5 permanece BLOCK. Las revisiones históricas no se modificaron: una revisión previa a la corrección de privacidad conserva el contenido con el que fue emitida.

Continuación: el navegador registró C$1,000 el 21/10 y C$3,000 el 22/10 en una gestión iniciada el 20/10. La caja mostró ambas fechas, referencias y C$4,000; la vista previa presentó C$4,000 y se emitió `GR-DE4EEBD4-R01`. La descarga PDF no fue accesible al control del navegador; U8 queda parcial hasta inspeccionar ese archivo concreto, aunque los documentos equivalentes se verificaron por API. Se detectó E-24: la revisión de pago combinado no mostraba el aporte propio. Ahora usa las fuentes preparadas para la operación y muestra ambos importes; hay prueba con mutante en la evidencia.

Para proteger la privacidad sin alterar revisiones emitidas, el Excel de una revisión por destinatario anterior al motor 9 con compras compartidas se rechaza y se solicita una nueva revisión. El PDF histórico sigue disponible sin alteraciones y puede contener el importe compartido anterior; debe revisarse antes de enviarse. No se tocaron datos reales ni se generó APK.

Continuación: el asistente permite seleccionar dos o más gestiones mediante el alcance existente de la API; rechaza selecciones insuficientes o desconocidas. En navegador se eligieron «Encargo combinado» y «Prueba tres compras»: la vista presentó cuatro compras por C$2,800 y separó los fondos y obligaciones por gestión, empresa y moneda; se emitió `GM-1C1D73C2-R01`. Se detectó y corrigió durante esta prueba la ausencia del nombre de gestión en cada saldo de la vista previa. La descarga de esta revisión no se inspeccionó, por lo que no se da por terminado U9. Siguen pendientes selección guiada de compras, reorganización estándar, recuperación nativa y comprobación de descargas originadas desde la interfaz.

## Correcciones solicitadas: compra, comprobantes y tema

Punto 0: revisadas E-01–E-24; aplican E-09 (verificar visualmente comprobantes), E-10 (probar negativos), E-14 (preservar archivos locales e ignorados), E-16 (conservar borradores) y E-22 (evitar exponer datos ajenos). Las reglas económicas no se alteran. Mutantes de guardas: 11/11, contadores aislados en `/tmp/gastos-correcciones-ui-guardas.json`. La cámara nativa depende del teléfono; no se promete control de enfoque no expuesto por el complemento. Pruebas con imágenes sintéticas, sin acceso a datos reales. No se modifica SQLite ni se sustituye la instalación principal.

Primera unidad de correcciones: en registro estándar se quitó la lista automática superpuesta al proveedor para permitir escritura libre; en navegador se escribió «Súper de prueba» sin guardar una compra. El editor de comprobantes ofrece acercar, alejar y recortar por bordes, conservando original y contrato de ajustes; `tests/recorte-interfaz.test.js` comprueba límites y repetición. El modo estándar hereda los colores del tema para fondo, cabecera, tarjetas, campos, botones principales y navegación; se comprobó en navegador el cambio al modo estándar con tema Noche. `npm run check` aprobó 168 pruebas y compilación web; tras un ajuste final del editor también pasaron su prueba específica y ESLint. Pendiente comprobar visualmente el editor y la legibilidad de todas las pantallas y temas, y validar cámara, enfoque y controles táctiles en Android. El complemento de cámara abre la cámara del sistema: no se ha añadido control manual de enfoque ni se asegura la calidad de captura. El teléfono dejó de aparecer en ADB. No se compiló ni instaló APK, conforme a la instrucción. Guardas E-09, E-10, E-14, E-16 y E-22 consultadas; mutantes aislados 11/11; ninguna incidencia propia nueva registrada. El silencio de guardas preventivas es por construcción; no se podó ninguna guarda.

## Continuación: cámara protegida, compras por gestión y ayuda de catálogos

Punto 0: E-01–E-24 revisadas; aplican E-10 (pruebas negativas), E-14 (preservación de archivos), E-16 (borrador y fotos) y E-22 (separación por gestión sin inventar datos). El informe y la base financiera no se alteran. Once mutantes de guardas pasaron con contadores aislados en `/tmp/gastos-camara-guardas.json`. La actividad externa de cámara puede ser destruida por Android; esa recuperación requiere prueba nativa y no se dará por verificada por inferencia. Sin compilar ni instalar APK, conforme a la instrucción vigente.

Resultado de esta unidad: Compras muestra gestiones y conteo, incluyendo «Sin gestión» cuando hay compras sin asociación; al seleccionar una gestión solo aparecen sus compras. Verificado en navegador sintético con tres compras aisladas. En Respaldo, la ayuda explica cuenta, medio, categoría y destino cuando está activado el aprendizaje; aclara que son etiquetas y no mueven fondos. Verificada en navegador. La cámara usa una excepción temporal, activa únicamente mientras está pendiente la solicitud iniciada por la app y cerrada también al cancelar; la pantalla protegida oculta el asistente sin destruirlo. Prueba unitaria verifica resultado, cancelación y doble solicitud. `npm run check`: 169/169, lint, formato y compilación web. Guardas de apertura: 11/11 mutantes aislados, E-10/E-14/E-16/E-22 consultadas; sin nuevos errores propios identificados ni poda de preventivas. Pendientes: validar en Android el ciclo cámara/autenticación, interrupciones, seguridad al cambiar de aplicación durante la cámara y restauración de resultados si Android mata el proceso; la excepción puede mantener la sesión desbloqueada mientras la cámara está pendiente. No se generó ni instaló APK; el teléfono no apareció en ADB.

## Depuración de informes · apertura

Punto 0: consultadas E-01–E-24. Aplican E-09 (rasterizar e inspeccionar las páginas), E-10 (regresiones negativas), E-14 (conservar archivos locales), E-20/E-21 (saldos cero y fechas de recepción) y E-22 (alcance de privacidad). Once mutantes de guardas pasaron con contadores de prueba `/tmp/gastos-informes-guardas.json`. No se tocarán registros reales ni revisiones emitidas. El archivo `GR-A084610E-R01.pdf` no se encontró en el proyecto, Documentos ni bajo /home/wis; su inspección está pendiente de ubicación. El boceto visual está pendiente de entrega por el usuario. No generar APK ni modificar SQLite.

Avance previo al boceto: los informes nuevos muestran «No registrado» para factura sin número cargado y aclaran que el conteo de comprobantes corresponde a compras. Prueba negativa `/tmp/gastos-informe-negativo.txt` y regresión `tests/informe-profesional.test.js`. Motor PDF 10; el Excel de revisiones 9 sigue disponible y los PDF históricos no se alteran. Batería completa 169/169; compilación web aprobada. No se ha terminado la depuración de secciones, la conciliación de los dos PDF ni la inspección visual. Pendientes el boceto y el PDF de referencia; no se generó APK.

Continuación con bocetos y PDF de referencia: inspeccionadas las dos primeras páginas del original, sin modificarlo. Se confirmó la duplicación de pagos de compras y el salto de la conciliación entre páginas. El PDF ejecutivo adopta verde, coloca las entregas antes de compras, une la conciliación, omite pagos de compra en la lista adicional y conserva aplicaciones, reembolsos, devoluciones, traslados y regularizaciones. No se extrapolaron depósitos del boceto a los datos reales. La opción guiada distingue con y sin fotografías. Se generaron dos PDF y Excel sintéticos en `docs/evidencia/fase09/`, con C$1,600 recibidos/aplicados, C$1,800 de compras, C$200 de aporte propio y por reembolsar, y custodia C$0. Se inspeccionaron todas las páginas sintéticas: un PDF sin fotografías de una página y otro de cuatro con tres anexos; el informe con logotipo incluye una copia de la imagen en la revisión y sobrevive a respaldo/restauración en SQL.js. El logotipo se elige para cada informe en Modo Fácil, no queda asignado de forma permanente a una empresa; Modo Estándar y Android están pendientes. Se incorporó el icono propuesto en los dos inicios, pero no se sustituyó aún el icono de lanzamiento de Android. Firma visible: W. Gutiérrez. `npm run check` aprobó 171 pruebas y compilación web. Falta la auditoría de A-02/A-03/A-05 y ampliar las comprobaciones a todos los alcances, resumen principal, legibilidad con datos extensos y Android; G3 permanece parcial. No se generó APK ni se modificaron datos reales. Guardas E-09/E-10/E-14/E-20/E-21/E-22 consultadas; mutantes aislados 11/11, sin poda de preventivas.

Ícono elegido por el propietario: se copió sin modificar la imagen proporcionada a los recursos de los dos inicios y a Android; la propuesta anterior se conserva en `src/interfaz/imagenes/icono-gastos-propuesta-anterior.png`. El manifiesto apunta al nuevo recurso con variante adaptativa y recurso anterior a Android 8; `aapt2 compile` validó sintaxis de recursos, sin construir APK. `npm run check`: 171/171, lint, formato y compilación web. Falta verificar el recorte del lanzador en un Android real; no se instaló ni actualizó ninguna aplicación. El logotipo opcional de empresa en el informe sigue eligiéndose por informe, no se asigna todavía permanentemente por empresa.
