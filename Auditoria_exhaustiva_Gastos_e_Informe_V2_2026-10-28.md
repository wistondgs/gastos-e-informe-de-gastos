# Auditoria funcional y tecnica de Gastos e Informe de Gastos V2

**Fecha de revision:** 28 de octubre de 2026  
**Dictamen:** la APK es funcional para un registro basico de compras, pero NO implementa en la interfaz el alcance funcional aprobado para la V2. No se recomienda usarla como control definitivo de fondos hasta integrar y probar la operacion financiera.

## 1. Procedencia y alcance de la evidencia

- **APK objeto de esta auditoria:** `io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-3547c34-801e8f52.apk`.
- **SHA-256 APK:** `801e8f52ceee245a50b865b479a51f31288f0b48b191801e19ae98939438d851`. Integridad del archivo ZIP/APK comprobada sin errores.
- **Fuente de referencia anterior:** `gastos-e-informe-de-gastos.zip`, SHA-256 `b37308199f45381358040ec765a65a504913b346e3c144ce043f741e7fdcfa87`.
- **IMPORTANTE:** los activos compilados de ese ZIP y del APK actual tienen hashes/nombres diferentes: el ZIP contiene `index-Bf8rNl4S.js`, mientras el APK entregado contiene `index-KG8qJ_FA.js`. El APK es una compilacion posterior: **los hallazgos de interfaz se verificaron tambien contra el JavaScript incluido en el APK; los numeros de linea citados corresponden al ZIP de fuentes anterior**. No debe asumirse que todas las correcciones recientes de integridad estan en ese ZIP.
- **Requisitos consultados:** `docs/mandatos/02_Plan_Objetivo_Aplicacion.docx` (apartados 2-10); `docs/mandatos/03_Roadmap_Fases_Aceptacion.docx` (etapas basica, A1-A9, estabilizacion); `docs/entregas/prototipo-informe-para-integracion.md` (30 mesas/variantes y contratos pendientes); `docs/CONTRATOS_API.md`.
- **Pruebas ejecutadas:** 62/62 de la fuente anterior aprobadas al extraer todas sus dependencias y guiones; escenarios A1-A9 aprobados. Ejecutado aparte el caso de 3 depositos sucesivos con la API anterior y datos sinteticos. Estas pruebas NO equivalen a ejecutar el APK en Android nativo. El informe reciente de Codex declara 72 pruebas en SQL.js sobre cambios posteriores, no verificadas independientemente contra la APK actual.
- **Limitacion:** no hay ejecucion instrumental en el POCO X7 ni Samsung, ni acceso a la base real. La prueba automatica del WebView compilado se intento en Chromium, pero el entorno bloqueo la navegacion de prueba. El usuario confirma que la aplicacion abre y registra, lo cual se considera evidencia de su experiencia, no de todos los flujos faltantes.

**Leyenda de estados:** [VISIBLE] expuesto en APK; [MOTOR] implementado en la API del ZIP anterior, no accesible desde la interfaz instalada; [PARCIAL] incompleto; [AUSENTE] no aparece en interfaz ni existe contrato completo verificado; [PENDIENTE] requiere prueba de dispositivo/version.

## 2. Hallazgo principal: dinero recibido y acumulacion de depositos

El APK declara literalmente: `Los fondos, anticipos y creditos todavia estan pendientes.` Por tanto, el usuario no dispone en la interfaz de una funcion para registrar otro anticipo, ver cada transferencia o conocer el saldo disponible.

**Escenario comprobado por separado en la API anterior:**

| Registro | Entrada | Custodia despues de la operacion |
|---|---:|---:|
| Deposito 1 | C$ 100,000.00 | C$ 100,000.00 |
| Deposito 2 | C$ 100,000.00 | C$ 200,000.00 |
| Deposito 3 | C$ 20,000.00 | C$ 220,000.00 |
| Compra pagada con fondos recibidos | -C$ 150,000.00 | C$ 70,000.00 |

La API previa creo tres filas de `recepciones`, tres aplicaciones a la misma gestion y calculo 22,000,000 centavos de custodia antes de la compra y 7,000,000 despues. Conserva los identificadores y referencias individuales. Si una recepcion queda **sin aplicar**, aparece como `recepcion_sin_aplicar`, que no se debe confundir con custodia asignada a una gestion ni ocultar del panorama global.

### Comportamiento aprobado que debe ofrecer la interfaz

1. Boton **Recibir dinero** desde Inicio y desde una gestion; poder repetirlo sin limite artificial para una misma persona y gestion.
2. Guardar fecha, moneda, importe, quien entrega los fondos, referencia bancaria/documental, cuenta o medio cuando ese catalogo este disponible, y un identificador unico por entrada.
3. Elegir cuanto se aplica a una o varias gestiones y distinguir **anticipo** de **reembolso de adelantos propios**. Si una parte no se asigna, mostrarla explicitamente como **sin aplicar**.
4. Mostrar historial de entradas (sin fusionarlas), pagos con origen de fondos, traslados, devoluciones y anulaciones con motivo.
5. Mostrar por persona, gestion y moneda: **recibido**, **aplicado**, **utilizado en compras**, **devuelto**, **trasladado**, **sin aplicar** y **remanente en custodia**; no mezclar dinero propio, deuda comercial y custodia.
6. Una compra solo descuenta custodia cuando tenga un pago efectivo con `origen='fondo'` y propietario correcto; una compra a credito no descuenta efectivo; un reembolso no crea un nuevo gasto.
7. No ocultar fondos pendientes al terminar una gestion: cierre operativo y liquidacion son independientes.

## 3. Matriz de trazabilidad: plan V2 frente al APK

| ID | Requisito | Estado | Severidad / comentario |
|---|---|---|---|
| F01 | Registrar compras y fechas | [VISIBLE] | Funciona en el recorrido basico; pruebas nativas completas no disponibles. |
| F02 | NIO y USD separados | [VISIBLE] | Inputs y formatos separados; no hay resumen financiero global en UI. |
| F03 | Numero de factura como texto | [VISIBLE] | Mantiene ceros iniciales. |
| F04 | Gestion con nombre, inicio y cierre | [VISIBLE] | Crear, listar y terminar; faltan atributos y detalle ampliado. |
| F05 | Gestiones abiertas y terminadas | [VISIBLE] | Filtro en lista. |
| F06 | Compra historica sin gestion | [PARCIAL] | Se consulta; registrar una nueva exige seleccionar una gestion. |
| F07 | Detalle de gestion: compras/dinero/historial | [PARCIAL] | Ver compras lleva a listado, no a detalle financiero con pestanas. |
| F08 | Reabrir gestion con motivo | [MOTOR] | API `gestiones.reabrir`; no hay accion en UI. |
| F09 | Registrar depositos sucesivos | [MOTOR] | API `fondos.recibir`; cero controles en APK. |
| F10 | Deposito aplicado a varias gestiones | [MOTOR] | API `fondos.recibir`/`aplicar`; UI ausente. |
| F11 | Recibido sin aplicar y disponible | [MOTOR] | API observa `recepcion_sin_aplicar`; UI no muestra. |
| F12 | Custodia por fuente/gestion/moneda | [MOTOR] | API `saldos.consultar`; UI no muestra. |
| F13 | Dinero propio adelantado | [MOTOR] | API de pagos y saldos; no seleccionable en Registro. |
| F14 | Reembolsos parciales | [MOTOR] | API; no existe flujo en pantalla. |
| F15 | Compra a credito / deudor | [MOTOR] | API `forma_pago='credito'`; el formulario no lo pregunta. |
| F16 | Registrar pago posterior | [MOTOR] | `pagos.registrar`; no hay boton en detalle de compra. |
| F17 | Deuda con proveedor | [MOTOR] | API la calcula; no aparece en detalle/Inicio. |
| F18 | Compra con pagos combinados | [MOTOR] | `compras.registrar` acepta pagos; UI usa ruta basica. |
| F19 | Reparto por empresa/persona | [MOTOR] | `asignaciones`; interfaz sin selector ni totales de reparto. |
| F20 | Catastro de personas y empresas | [MOTOR] | `partes.crear/listar/desactivar`; faltan pantallas. |
| F21 | Diferenciar pagador, beneficiario, deudor y titular del documento | [PARCIAL] | Faltan controles; `titular_id` no existe en modelo anterior. |
| F22 | Devolver fondos | [MOTOR] | API `fondos.devolver`; pantalla ausente. |
| F23 | Trasladar remanentes | [MOTOR] | API `fondos.trasladar`; pantalla ausente. |
| F24 | Registrar anulacion de compra con motivo | [MOTOR] | `compras.anular`; sin interfaz. |
| F25 | Corregir compra sin perder historia | [AUSENTE] | Contrato `compras.corregir` identificado como faltante en prototipo. |
| F26 | Clasificar compras antiguas sin forma de pago | [MOTOR] | `compras.clasificarPago`; UI no ofrece regularizar. |
| F27 | Busqueda por fecha/proveedor/moneda/factura | [PARCIAL] | API `compras.listar` filtra; UI tiene listado simple. |
| F28 | Categorias, cuentas, medios de pago editables | [AUSENTE] | Requisito en plan 02, no implementado integralmente en schema/UI. |
| F29 | Ajustes descriptivos sin alterar saldos | [PARCIAL] | Encabezado/responsable/destinatario; catalogos restantes ausentes. |
| F30 | Borradores recuperables tras reinicio | [AUSENTE] | Estado Vue temporal; API `borradores.*` no existe en fuente anterior. |
| I01 | Captura varias fotografias / clasificacion | [VISIBLE] | Factura, voucher, otro; quitar antes de guardar. |
| I02 | Adjuntar foto despues de guardar | [MOTOR] | `comprobantes.agregar`; interfaz no expone. |
| I03 | Girar 90/180/270 manualmente | [MOTOR] | `anexos.ajustar`; sin botones en APK. |
| I04 | Enderezar imagen | [MOTOR] | Motor +-15 grados; sin control en APK. |
| I05 | Recorte manual de bordes | [MOTOR] | Motor de anexos; sin vista previa/selector. |
| I06 | Propuesta automatica de recorte seguro | [MOTOR] | `anexos.proponerRecorte`; no expuesto. |
| I07 | Mantener fotografia original | [MOTOR] | Parametros persistidos sin sobrescribir original; falta probar real. |
| I08 | Vista previa antes de emitir informe | [MOTOR] | `informes.previsualizar`; interfaz no la usa. |
| I09 | Factura larga en varias paginas | [PARCIAL] | Motor profesional lo contempla; PDF individual usa motor anterior. |
| I10 | Dos comprobantes pequenos en una pagina | [PARCIAL] | Motor profesional lo contempla; no en PDF individual. |
| I11 | Fotos HEIC y archivos de gran tamano | [PENDIENTE] | Captura valida solo JPEG/PNG, maximo 15 MB por archivo. Probar Samsung. |
| R01 | PDF por compra | [VISIBLE] | Exportacion individual con fotos. |
| R02 | Excel por compra, con y sin fotos | [VISIBLE] | Disponible. Miniaturas con dimension fija 150x150. |
| R03 | PDF por gestion | [VISIBLE] | Emision por gestion con revision versionada. |
| R04 | Informes por varias gestiones | [MOTOR] | API lista ese alcance; UI solo ofrece gestion. |
| R05 | Informe por periodo | [MOTOR] | Sin UI. |
| R06 | Informe por empresa/persona con aislamiento | [MOTOR] | Filtro por `parte` en API; UI permite marcar manualmente compras, no aislar automaticamente. |
| R07 | Informe de comprobantes pendientes | [MOTOR] | Sin UI. |
| R08 | Revision historica de PDF | [VISIBLE] | Listado, PDF y Excel disponibles. |
| R09 | Previsualizar antes de emitir | [MOTOR] | Sin UI. |
| R10 | Verificar integridad del PDF al abrir | [PARCIAL] | API documentada; certificacion Android pendiente. |
| R11 | Nomenclatura 'Informe de gastos' | [PARCIAL] | Nombre antiguo 'Rendicion' permanece en PDF, identidad y menus. |
| S01 | Respaldo ZIP local | [VISIBLE] | Boton disponible; no cifrado. |
| S02 | Restauracion con confirmacion | [VISIBLE] | Confirmacion basica; no hay asistente de comprobacion previa. |
| S03 | Respaldo protege fotos e informes | [PENDIENTE] | Codex reporta correccion C1; APK nativo no probado aqui. |
| S04 | Actualizacion aislada entre versiones | [PENDIENTE] | Falta evidencia de ejecucion Android de PASO-A -> PASO-B nuevo. |
| S05 | Conservacion de compras reales en instalacion principal | [PENDIENTE] | No instalar/actualizar sin respaldo y prueba de migracion. |
| S06 | Datos sensibles en carpeta compartida | [VISIBLE] | PDF en Documentos puede ser accesible desde otras apps autorizadas. |
| S07 | Cifrado del respaldo exportado | [AUSENTE] | La propia UI avisa que no hay cifrado; no prometerlo. |
| UX01 | Pantalla Inicio con dinero pendiente | [AUSENTE] | Inicio no muestra saldos. |
| UX02 | Registro guiado con origen del dinero | [PARCIAL] | Cuatro pasos antiguos, no los seis del prototipo. |
| UX03 | Menu inferior aprobado | [PARCIAL] | APK: Inicio/Gestiones/Registrar/Compras/Respaldo. Prototipo: Inicio/Gestiones/Registrar/Informes/Mas. |
| UX04 | Todas las compras abren detalle | [VISIBLE] | Listado permite abrir detalle basico; faltan acciones. |
| UX05 | Historia de navegacion y retorno a origen | [AUSENTE] | `ir()` cambia pantalla sin pila. Detalle regresa siempre al listado global. |
| UX06 | Boton Atrás Android | [PENDIENTE] | Config deshabilita manejador por defecto y UI no registra manejador propio; probar salida inesperada. |
| UX07 | Pantallas del prototipo de Claude | [AUSENTE] | El prototipo tiene 30 mesas/variantes, no integradas al APK. |
| UX08 | Firma del desarrollador | [VISIBLE] | 'Desarrollada por W. D. Gutiérrez' aparece en Inicio y Acerca de. |

## 4. Rutas efectivas y desconexiones

**Nueve estados de pantalla reconocidos en el APK:** `inicio`, `acerca`, `gestiones`, `registro`, `compras`, `detalle`, `preparar-informe`, `informes`, `respaldo`. No son equivalentes a las 30 mesas/variantes del prototipo.

**Barra inferior real:** Inicio / Gestiones / Registrar / Compras / Respaldo. El prototipo aprobado proponia Inicio / Gestiones / Registrar / Informes / Mas.

**Conexiones que existen:** Inicio -> Gestiones, Compras, Respaldo, Acerca de; Gestiones -> Registrar compra, Ver compras, Preparar informe, Terminar gestion; Compras -> Detalle; Detalle -> exportacion individual; Informes -> abrir PDF/Excel; Respaldo -> informes/crear/restaurar.

**Recorridos ausentes o incompletos:** Inicio -> Recibir dinero; Inicio -> resumen de fondos; Gestion -> Detalle con pestanas Dinero/Historial; Gestion -> Recibir/Devolver/Trasladar; Gestion -> Reabrir; Compra -> Registrar pago/Anular/Corregir/Clasificar/Adjuntar; Compra -> Ajustar imagen; Mas -> Partes; Informes -> tipos adicionales, filtros por destinatario y vista previa; Registro -> seleccion de origen/fondo/credito/reparto; Registro -> borrador persistente.

**Problema arquitectonico importante:** `src/interfaz/App.vue:223-241` registra la compra mediante `guardarCompra(repo.value, ...)`, en vez de `api.compras.registrar({ forma_pago, asignaciones, pagos, imagenes })`. Por ello guarda el valor por defecto `sin_detalle` y no genera pagos financieros ni reduce custodia. Tambien utiliza directamente `repo.crearGestion` y `repo.cerrarGestion` (lineas 160-184), evitando los eventos de auditoria de la API para cerrar una gestion. La interfaz debe consumir exclusivamente la API de aplicacion para mutaciones economicas/operativas.

## 5. Hallazgos priorizados y acciones precisas

### P0-01 - Entradas sucesivas de dinero invisibles en UI
**Evidencia:** aviso literal del APK; `src/api/index.js:562-740` contiene funciones de fondos que `App.vue` no llama.  
**Accion:** pantallas Recibir dinero, Historial de depositos, Aplicar importe, Devolver y Trasladar; soportar entradas sucesivas y multi-gestion; saldo y movimientos auditables.  
**Aceptacion:** C$100k+C$100k+C$20k=C$220k; salida de C$150k desde esos fondos => C$70k en custodia; vista de 3 depositos individuales; registro separado de dinero sin aplicar.

### P0-02 - Registro de compras desconectado del origen financiero
**Evidencia:** `App.vue:223-241`; `src/dominio/operaciones.js:21-50`; default `forma_pago='sin_detalle'`.  
**Accion:** conectar `api.compras.registrar` con contado/credito, pagado por quien, fondos propios/terceros/custodia, repartos y comprobantes; transformar compras anteriores mediante `clasificarPago` y `pagos.registrar`, sin borrarlas.  
**Aceptacion:** compras pagadas con anticipo consumen custodia una sola vez; compras a credito generan deuda del deudor identificado, no gasto duplicado; adelantos propios generan reembolso solo cuando corresponda.

### P0-03 - Riesgo de emitir informe a destinatario equivocado
**Evidencia:** `App.vue:865-941` permite seleccionar compras manualmente, avisa que la separacion por empresa no esta disponible; la API dispone de alcance `parte`.  
**Accion:** elegir destinatario y generar informe aislado por asignacion, nunca mediante filtrado visual solamente; proteger comprobantes compartidos. Vista previa de datos y soportes exactos que saldran.  
**Aceptacion:** un informe de empresa A no contiene importes personales ni de empresa B; una factura mixta exige confirmacion explicita de compartir la imagen completa.

### P0-04 - Base de datos y controles financieros en Android
**Evidencia:** corregidos en SQL.js segun reporte Codex; fuente ZIP vieja, APK nuevo; sin prueba SQLite nativo reproducible proporcionada.  
**Accion:** en un paquete de prueba aislado ejecutar concurrencia, idempotencia, backup/restore y migracion de datos; no sobrescribir una instalacion con compras reales.  
**Aceptacion:** pasar pruebas nativas con datos sinteticos, conservar fotos y compras en actualizacion.

### P1-01 - Ajustar fotografias no conectado
**Evidencia:** `src/api/index.js:796-857` y `src/documentos/anexos.js` soportan parametros; `App.vue:709-756,821-862` no tiene ajuste ni vista previa; el APK carece de controles Girar/Enderezar.  
**Accion:** abrir editor desde el registro y desde una compra existente. Integrar 90/180/270, enderezar, recorte libre y propuesto, previsualizacion, restablecer. Guardar parametros sin modificar original.  
**Aceptacion:** rotar imagen de factura, guardar, reiniciar, reabrir, producir PDF con el giro sin perder bytes originales.

### P1-02 - Dos motores de PDF de comportamiento distinto
**Evidencia:** `src/exportaciones/informes.js:93-159` crea una pagina por foto y no consume parametros `anexos`; `src/exportaciones/informe-pdf.js` usa motor profesional por alcance.  
**Accion:** unificar el tratamiento de imagenes para informes individuales y por gestion; centrar sin deformar, evitar comprimir facturas largas; optimizar sin cortar informacion.  
**Aceptacion:** fotos largas legibles, factura y voucher unidos logicamente a una compra, recortes persistidos aplicados donde corresponda, Carta y A4.

### P1-03 - Gestion sin detalle financiero ni reapertura
**Evidencia:** pantalla `gestiones` solo lista y envia a Compras; API `gestiones.detalle`, `reabrir` y `saldos.liquidacion` estan sin consumir.  
**Accion:** pestanas Compras/Dinero/Historial, totales calculados por moneda, motivo al reabrir, cierre no liquida saldos.  
**Aceptacion:** cerrar gestion con C$4k en custodia conserva el saldo y permite devolverlo/trasladarlo; historial refleja cierre y reapertura.

### P1-04 - Acciones de compra incompletas
**Evidencia:** `App.vue:821-862` solo muestra compra, fotos y exportacion.  
**Accion:** pago posterior, anulacion con motivo, clasificar sin detalle, correccion trazable, agregar comprobante. Evaluar `compras.corregir` y `titular_id` propuestos en `docs/entregas/prototipo-informe-para-integracion.md`.  
**Aceptacion:** compra previa a credito, abono parcial, factura adjunta despues, anulacion sin perder historia, reembolso sin crear otra compra.

### P1-05 - Personas, empresas y responsables sin UI
**Evidencia:** API `partes`; pantalla no tiene mantenimiento de partes ni papeles de cada contraparte.  
**Accion:** alta/lista/desactivar, relacion con gestores, beneficiarios, duenos de fondos, deudores y titulares de facturas. Evitar borrar historial.  
**Aceptacion:** compra para padre pagada por usuario no se confunde con compra personal ni con deuda del proveedor.

### P1-06 - Informes solo de gestion y sin preview
**Evidencia:** `App.vue:306-340,865-941`; API implementa varios alcances.  
**Accion:** varias gestiones, periodo, persona/empresa, pendientes, vista previa, emision versionada, PDFs y Excel con datos correctos, destino correcto.  
**Aceptacion:** periodo con compras sin gestion, informe selectivo sin fuga, revision inmutable, saldos no compensados.

### P1-07 - Borrador, retroceso y captura sin gestion
**Evidencia:** `App.vue:49-53,75-91,191-242,629-783`; formulario de 4 pasos y seleccion de gestion obligatoria; no existe persistencia de borrador.  
**Accion:** flujo de 6 pasos del prototipo; guardar borrador local con ID estable y adjuntos en staging, recuperar al cerrar/reabrir, permitir compra sin gestion, regresar a pantalla origen, manejar Back Android.  
**Aceptacion:** matar app en paso 4 no pierde captura; reintentar sin duplicar; sin gestion tambien se puede registrar.

### P1-08 - Cuentas/categorias/formas de pago no configurables
**Evidencia:** plan 02 establece catalogos editables; esquema 4 solo tiene `partes` y `ajustes` basicos.  
**Accion:** datos versionados de medios/cuentas/categorias/destinos sin construir un motor generico ni alterar los saldos.  
**Aceptacion:** cambiar nombre o desactivar item preserva historial y PDFs emitidos.

### P1-09 - Nomenclatura incorrecta en producto e informes
**Evidencia:** APK contiene `Gastos y Rendiciones`, `Rendicion de gastos`; PDF de ejemplo encabezado `RENDICION...`.  
**Accion:** reemplazar textos visibles por `Gastos e Informe de Gastos`, `Informe de gastos` y `Liquidacion` segun contexto. Versionar motor PDF y conservar acceso a revisiones emitidas previamente.  
**Aceptacion:** ningun texto nuevo visible con `rendicion` y PDFs antiguos siguen abriendo sin cambio de bytes.

### P2-01 - Calidad de miniaturas Excel y fotos Samsung
**Evidencia:** `src/exportaciones/informes.js:51-60` incrusta fotos a 150 x 150; captura limita JPEG/PNG y 15 MB (`src/dominio/operaciones.js:3-20`).  
**Accion:** respetar relacion de aspecto, probar fotos Samsung verticales, giradas, documentos muy largos y archivos grandes; conversion explicita o mensaje claro para HEIC.  
**Aceptacion:** recibos legibles, sin deformacion ni fallos silenciosos por formato o tamano.

### P2-02 - Respaldo, privacidad y entrega
**Evidencia:** respaldo exportado no cifrado; PDFs compartidos en Documentos; en fuente Android el manifest tiene `allowBackup=true` (revisar si sigue igual en APK empaquetado).  
**Accion:** politica de almacenamiento local y copias sensibles; comprobar Android Auto Backup/transferencia del SO y sus reglas; estado de ultimo respaldo; mensaje de restauracion con contenido y confirmacion.  
**Aceptacion:** restauracion de imagenes e informes + comparacion de hashes, sin declaracion de exito parcial; usuario informado si almacena respaldo sin cifrado.

## 6. Evidencia positiva y limites de integridad

**Implementado en el nucleo anterior:** SQLite por dominios, operaciones de fondos y saldos por cuatro categorias, informes versionados por gestion/periodo/parte, tratamiento de fotos, respaldo v4, restauracion, controles de moneda, auditoria operativa, pruebas A1-A9. **No confundir esto con pantallas disponibles en APK.**

El usuario probo el APK y reporta que funciona para su recorrido basico. La inspeccion del APK actual confirma que la interfaz basica y las exportaciones estan empaquetadas. La fuente anterior paso 62 pruebas; Codex reporto 72 pruebas posteriores en SQL.js (no repetidas sobre su rama corregida en esta auditoria). Ninguna de estas evidencias prueba por si sola migracion, concurrencia y fotos reales en Android nativo.

## 7. Opciones y decision de implementacion

**Opcion A - Correcciones parciales de interfaz.** Rapida inicialmente, pero deja botones aislados, logica duplicada y riesgo de seguir trabajando con compras `sin_detalle`. Costo de mantenimiento alto; NO recomendada.

**Opcion B - Integracion funcional completa por dependencias, conservando Vue/Quasar/Capacitor/SQLite y el prototipo.** Reutiliza los servicios existentes, agrega contratos faltantes y prueba cada recorrido extremo a extremo; costo inicial medio, menor retrabajo. **Recomendada**.

No desarrollar OCR, integracion ERP, servidor, banca, facturacion fiscal ni redisenar el framework. La app es personal: no requiere publicacion en tiendas ni certificaciones comerciales. La prueba pendiente es funcional Android, con POCO X7 como laboratorio aislado y Samsung Galaxy como destino final.

## 8. Orden de fases y gates (sin fechas artificiales)

### Fase 0 - Congelar evidencia y proteger datos
- Inspeccionar rama/SHA real y los cambios sin commit; confirmar que el codigo fuente corresponde EXACTAMENTE al APK por hash de compilacion.
- Respaldar instalacion actual y probar restauracion aparte. Separar paquete `.pruebas` de paquete oficial. No reinstalar el paquete oficial con datos reales sin autorizacion.
- Gate: modelo de migracion y procedencia verificados; conservar un APK conocido funcional.

### Fase 1 - Dinero, pagos y actores (bloqueador funcional)
- Implementar personas/empresas, recibir varias entradas, distribuir/consultar sin aplicar, saldos por moneda y gestion, pagos con fondos/propios/terceros, credito y reembolso, transferir y devolver, anular con motivo.
- Conectar UI exclusivamente a `api.*` para operaciones economicas y auditables. Evitar logica financiera paralela en componentes Vue.
- Gate: caso 100k+100k+20k, casos A1-A9, pagos parciales, cierre sin liquidacion, y pruebas de concurrencia/idempotencia en SQL.js y Android nativo.

### Fase 2 - Compras, fotos y edicion
- 6 pasos y origen financiero, compra sin gestion, detalles, correcciones y pagos posteriores, borrador durable, editor de fotos, originales inmutables, fotos largas y PDF por compra/gestion.
- Gate: captura y reanudacion, giro/recorte y PDF verificable tras reiniciar, foto posterior y no duplicacion.

### Fase 3 - Informes, destinatarios y navegacion
- Integrar 30 mesas/variantes del prototipo como estados de interfaz (no como 30 componentes obligatorios), menus, historial de navegacion, filtros, informes por tipos y destinatarios, vista previa y versionado. Cambiar nomenclatura.
- Gate: navegacion de todos los controles, reporte A sin gasto B, revision historica identica, PDF/Excel correctos, pruebas de respaldo con foto e informe.

### Fase 4 - Uso real controlado
- Prueba aislada POCO: migracion entre APK con misma firma e identificador de pruebas; respaldo/restore, camara y archivos; comprobar botones del sistema.
- Prueba Samsung: permisos, formatos de imagen, apertura/comparticion PDF, almacenamiento privado, recuperacion y rendimiento medido.
- Gate: sin perdida de fotos ni dinero, ninguna prueba financiera pendiente en Android, defectos documentados por severidad.

## 9. Pruebas adicionales que no se deben omitir

1. Tres depositos distintos del mismo emisor y gestion, mismos o diferentes dias, referencia propia; saldo acumulado y movimientos individuales.
2. Depósito con 30% asignado y 70% sin aplicar; la interfaz muestra ambos sin confundir el total.
3. Una entrada de C$100k repartida entre dos gestiones sin duplicar el deposito.
4. Dos depositos del mismo importe con IDs distintos se aceptan; reintento identico mismo ID no duplica; cambio de contenido mismo ID genera conflicto.
5. Compra de C$150k pagada parcialmente con fondo, parcialmente con dinero propio, con asignaciones exactas; custodias y reembolso correctos.
6. Transferencia entre dos gestiones sin cambiar la suma del dinero en custodia global.
7. Devolucion excedida, dos devoluciones simultaneas y anulacion: nunca custodia negativa.
8. Gestion terminada con remanente; el cierre no elimina remanente ni borra pendientes.
9. Compra a credito con proveedor/deudor reales, abonos parciales, foto y factura; una sola compra.
10. Una compra compartida por empresa A, B y personal: informe de A excluye B/personal; comprobante compartido requiere decision.
11. Compra antigua `sin_detalle`: regularizar sin duplicar su importe ni perder imagen.
12. Registrar gasto sin gestion y posteriormente asignarlo mediante operacion permitida (si el contrato aun no la soporta, documentar cambio necesario).
13. Foto vertical, horizontal, girada, larga, HEIC y superior a 15MB en Samsung; mensajes precisos y sin perder la captura.
14. Giro de 90/180/270, enderezado y recorte persistentes; PDF refleja ajuste, foto original conserva hash.
15. Factura+voucher de la misma compra: un gasto y dos anexos; PDF Carta/A4 y Excel legibles.
16. Borrador sobreviviente a cierre forzado, retroceso por Android y cambio entre pantallas.
17. PDF emitido R01, operacion posterior y emision R02: R01 inalterado; reproduccion igual SHA.
18. Respaldo completo, archivo PDF privado ausente/corrupto, archivo foto ausente/corrupto, restauracion interrumpida y compatibilidad version anterior.
19. Actualizacion aislada PASO-A -> version corregida sin borrar compras/fotos; nunca usar el paquete real con datos para probar.
20. Prueba final Samsung Galaxy, sin Play Store, con instalacion APK directa controlada.

## 10. Rutas que debe abrir Codex

Ruta informada en PC del usuario: `/home/wis/dev/gastos-e-informe-de-gastos` (Codex debe comprobar que existe y leer el SHA vigente).

| Area | Archivo |
|---|---|
| Interfaz navegacion y todos los formularios | `src/interfaz/App.vue` |
| API financiera y gestiones | `src/api/index.js` |
| API para informes | `src/api/informes.js` |
| Contratos frontend/backend | `docs/CONTRATOS_API.md` |
| Nucleo de saldos y obligaciones | `src/dominio/finanzas.js` |
| Modelo y migraciones SQLite | `src/datos/base.js`, `src/datos/tablas.js` |
| Captura y almacenamiento de fotos | `src/dominio/operaciones.js`, `src/datos/archivos.js` |
| Editor de comprobantes | `src/documentos/anexos.js` |
| Informe profesional | `src/exportaciones/informe-pdf.js`, `src/exportaciones/informe-excel.js` |
| Exportacion individual antigua | `src/exportaciones/informes.js` |
| Historial y archivos PDF | `src/datos/informes-locales.js` |
| Respaldo | `src/datos/respaldo.js`, `src/api/respaldo.js` |
| Identidad/nombres | `src/identidad.js`, `src/interfaz/version.js` |
| Pruebas financieras | `tests/aceptacion-financiera.test.js` |
| Pruebas de anexos | `tests/anexos.test.js` |
| Prototipo y contratos pendientes | `docs/entregas/prototipo-informe-para-integracion.md` |
| Plan y roadmap originales | `docs/mandatos/02_Plan_Objetivo_Aplicacion.docx`, `docs/mandatos/03_Roadmap_Fases_Aceptacion.docx` |
| Reglas de trabajo del repo | `AGENTS.md`, `ERRORES_Y_GUARDAS.md` |

**Regla de cierre:** no declarar terminada la V2 por tener pruebas A1-A9 sobre el backend si el propietario no puede ejecutar esas operaciones desde el telefono. Para cada capacidad se exige codigo de dominio, contrato, pantalla conectada, persistencia, errores claros, prueba automatizada y recorrido Android verificado.
