# Prototipo funcional de Gastos e Informe de Gastos V2: informe para la integración

**27-10-2026.** Es el lienzo «App de Gastos» de claude.ai, versión 28: https://claude.ai/artifact/HFNsyhBkZFfc8iyw7JXY1W

**Para el agente de programación**, que conecta estas pantallas a la API local de `/home/wis/dev/gastos-e-informe-de-gastos` (`src/api`, contrato en `docs/CONTRATOS_API.md`). No se tocaron ni el repositorio ni el POCO X7. Se mantuvieron el verde bosque, Manrope, la navegación de cinco pestañas y una pregunta por pantalla.

## 1. Cómo leer el prototipo

- **Datos de ejemplo.** Todo importe, saldo, total y estado que aparece es ficticio. Donde en la app ese valor lo calcula el servicio, la pantalla lo dice: «Ejemplo · lo calcula el servicio», «Datos de ejemplo» o «Calculado por el servicio». **Los C$ 4,000 de custodia de Inicio, Detalle de gestión y Fondos son solo un ejemplo**: no son un saldo real ni salen de un cálculo.
- **Cálculos provisionales.** Los formularios pueden calcular para orientar («Falta repartir», «Sin aplicar», «No puede superar lo pendiente», los totales de «Revisá qué se comparte»). Cada uno lleva la leyenda «provisional: lo valida el servicio».
- **El aviso de prototipo.** Toda acción que en la app llama al servicio muestra un aviso oscuro abajo, con:
  - **«operación disponible en la API»** o **«falta el servicio»**;
  - qué se muestra **solo** si el servicio confirma, y qué se muestra si responde con error;
  - el nombre exacto de la operación.

  El prototipo **nunca muestra un éxito sin respuesta**: no hay «Compra anulada», «Pago registrado», «Restauración completa» ni «Gestión terminada» sin el aviso.
- **El control «respuesta».** Registrar, Preparar informe, Recibir dinero y Fondos tienen, en la sección *Prototipo* de sus ajustes, el control «respuesta» (confirmada, esperando o error). El éxito («Gasto guardado», «Informe emitido», «Copia privada verificada», «Dinero registrado», «Fondos devueltos») solo aparece con «confirmada», siempre rotulado «Prototipo · respuesta simulada». Con «error» se ve el mensaje real del servicio, con su código y su campo.

## 2. Inventario de pantallas

Son 30 mesas de trabajo: las 24 de antes y 6 variantes nuevas. Las variantes son estados de una misma pantalla, como lo eran Registrar 2 a 7, no diseños nuevos.

| # | Mesa | Pantalla | Estado |
|---|---|---|---|
| 1 | Main | Inicio | Corregida |
| 2 | Gestiones | Gestiones y **Todas las compras** (pestaña nueva) | Ampliada |
| 3 | Gestiones-nueva | Gestiones con la hoja «Nueva gestión» | Igual (variante) |
| 4 | Gestion | Detalle de gestión (Compras, Dinero, Historial) | Corregida |
| 5 | Reabrir | Gestión terminada · reabrir | Corregida |
| 6 | Recibir | Recibir dinero (3 pasos y resultado) | Corregida |
| 7 | Fondos | Devolver o trasladar fondos (3 pasos y resultado) | Corregida |
| 8–15 | Registrar, Registrar-2 a 7, Registrar-4b | Registrar gasto (6 pasos y resultado) | Corregida |
| 16 | Informe | Preparar informe (4 pasos y resultado) | Corregida |
| 17 | Recorte | Ajustar comprobante (desde el registro) | Corregida |
| 18 | **Recorte-compra** | Ajustar comprobante (desde una compra) | **Variante nueva** |
| 19 | Respaldo | Más: respaldo, partes, informes y **Acerca de** | Ampliada |
| 20 | Informes | Informes emitidos (historial de revisiones) | Corregida |
| 21 | Partes | Personas y empresas, con sus **roles** | Ampliada |
| 22 | Compra | Detalle de compra, genérico (crédito) | Rehecha |
| 23 | Compra-pago | Compra con la hoja «Registrar pago» | Variante |
| 24 | Compra-anular | Compra con la hoja «Anular» | Variante |
| 25 | Compra-sindetalle | Compra sin detalle con la hoja «¿Cómo se pagó?» | Variante |
| 26 | **Compra-ferreteria** | Repartida entre dos, factura y voucher | **Variante nueva** |
| 27 | **Compra-restaurante** | En dólares, pagó la empresa directo | **Variante nueva** |
| 28 | **Compra-peaje** | Comprobante pendiente, pago sin indicar | **Variante nueva** |
| 29 | **Compra-gasolinera** | Gestión terminada, falta la foto | **Variante nueva** |
| 30 | **Compra-historica** | Histórica, sin gestión, de la versión anterior | **Variante nueva** |

**Hojas dentro de las pantallas:**
- Detalle de compra: «Corregir un dato», «Registrar pago», «Anular» y «¿Cómo se pagó?».
- Detalle de gestión: «Terminar gestión».
- Reabrir: «Reabrir».
- Gestiones: «Nueva gestión».
- Personas y empresas: «Agregar» y «Desactivar».
- Más: «Restaurar» y «Acerca de», que lleva la firma «Desarrollada por W. D. Gutiérrez».

## 3. Mapa de navegación

Barra inferior, en todas las pantallas que la tienen: Inicio → Main · Gestiones → Gestiones · Registrar → Registrar · Informes → Informes · Más → Respaldo.

| Desde | Lleva a |
|---|---|
| Main | Registrar · Recibir · Informe · Fondos (custodia) · Gestiones («Ver todas») · Gestion (gestión abierta) · Reabrir (terminada con dinero pendiente) · Respaldo (aviso de respaldo) |
| Gestiones | Gestion · Reabrir · «Compras sin gestión» → pestaña Compras con el filtro Sin gestión · cada compra → su Compra-* |
| Gestion | ← Gestiones · Registrar · Recibir · Informe · Fondos · cada una de las 5 compras → Compra, Compra-peaje, Compra-restaurante, Compra-ferreteria o Compra-sindetalle |
| Reabrir | ← Gestiones · Recibir · la compra → Compra-gasolinera |
| Compra (todas) | ← su origen: Gestion; Reabrir (Gasolinera); Gestiones (histórica) · la foto de la factura de Ferretería → Recorte-compra |
| Recorte | Cancelar o Listo → Registrar-3 |
| Recorte-compra | Cancelar o Listo → Compra-ferreteria |
| Registrar | X → Main · resultado → «Ver la gestión» (Gestion) o «Ver las compras» (Gestiones, si fue sin gestión) · Main |
| Recibir | X → Main · resultado → Main («Ver los saldos») · Gestion |
| Fondos | X → Gestion · resultado → Gestion |
| Informe | X → Main · resultado → Informes · Main · error → Compra-ferreteria |
| Informes | Informe («Nuevo» y «Emitir revisión nueva») |
| Respaldo | Partes · Informes |
| Partes | ← Respaldo (Más) |

**Comprobado en un navegador** (Chrome sin pantalla, con el motor del lienzo): ningún vínculo, fijo ni calculado, lleva a una mesa inexistente, y ningún botón queda sin acción, en las 30 mesas y en 7 estados extra. También corren sin error las 174 combinaciones de los controles de prototipo, apretando todos los botones de cada una.

**Límite del prototipo:** la X de los flujos (Registrar, Recibir, Informe) vuelve a Inicio. En la app tiene que volver a la pantalla de origen, con el historial de navegación.

## 4. Matriz: pantalla, operaciones, datos y respuestas

✓ = la operación existe en `src/api`. ✗ = falta (ver §5).

| Pantalla | Operaciones | Datos que muestra | Respuestas a manejar |
|---|---|---|---|
| **Inicio** | ✗ `saldos.resumen()` · ✓ `gestiones.listar({ estado })` · ✓ `saldos.consultar()` (hoy, por líneas) · ✗ `respaldo.estado()` | Los cuatro saldos por moneda y parte; las gestiones abiertas y las terminadas con dinero pendiente (`liquidacion` ≠ `liquidada`); el aviso de respaldo | Sin datos: estado vacío. Nunca un neto |
| **Gestiones · Gestiones** | ✓ `gestiones.listar` · ✗ `totales` por moneda en cada gestión · ✓ `gestiones.crear` | Nombre, fechas, cantidad de compras, totales C$ y US$, estado, liquidación | `crear`: `creada`; VALIDACION (`nombre`, `responsable_id`) |
| **Gestiones · Todas las compras** | ✓ `compras.listar({ gestion_id: 'ninguna', moneda, desde, hasta, proveedor })` · ✗ `resumen` por compra | Fecha, proveedor, concepto, gestión o «Sin gestión», importe, el chip de estado | Lista vacía con filtros |
| **Detalle de gestión** | ✓ `gestiones.detalle(id)` · ✗ `totales` en la respuesta · ✓ `gestiones.cerrar(id, fecha)` | Datos, totales por moneda, liquidación, compras, saldos (Dinero), eventos (Historial) | `cerrar`: ESTADO (ya terminada), VALIDACION (fecha anterior al inicio) |
| **Reabrir** | ✓ `gestiones.detalle` · ✓ `gestiones.reabrir(id, motivo)` | Fechas, liquidación, saldos de la gestión, compras | VALIDACION (`motivo`), ESTADO (ya abierta) |
| **Detalle de compra** (todas las variantes) | ✓ `compras.detalle(id)` · ✗ `pendiente`, `pagado` y `soporte` calculados · ✓ `pagos.registrar` · ✓ `compras.anular` · ✓ `compras.clasificarPago` · ✓ `compras.asignar` · ✓ `comprobantes.agregar` · ✓ `comprobantes.original` · ✓ `anexos.obtener` · ✗ `compras.corregir` · ✗ `titular_id` | Compra, fotos, anexos, reparto, pagos, eventos, pendiente de pago, deudor | `pagos.registrar`: `creado`; VALIDACION (excede, sin fondos en custodia, falta `asignacion_id`), ESTADO (anulada). `anular`: VALIDACION (`motivo`). `clasificarPago`: ESTADO (ya clasificada). `asignar`: VALIDACION (no suma), ESTADO (pagos imputados). `agregar`: INTEGRIDAD |
| **Registrar gasto** | ✓ `compras.registrar({ …, forma_pago, deudor_id, asignaciones, pagos, imagenes })` · ✓ `gestiones.listar({ estado: 'abiertas' })` · ✓ `partes.listar()` · ✗ `borradores.*` | Gestiones abiertas, partes, el reparto (provisional) y la consecuencia de cada origen | `creada: true` → «Gasto guardado» · `creada: false` → «ya estaba guardado» · VALIDACION con `campo` (importe, asignaciones, deudor_id, parte_id) · ESTADO (gestión terminada) · CONFLICTO. **Generar el `id` una sola vez por borrador**, para que reintentar no duplique |
| **Ajustar comprobante** | ✓ `comprobantes.original(foto_id)` · ✓ `anexos.obtener` · ✓ `anexos.proponerRecorte(rgba, ancho, alto)` · ✓ `anexos.ajustar` · ✓ `anexos.restablecer` | La foto original, el giro, el enderezado y el recorte | `ajustar`: VALIDACION (`rotacion`, `enderezar`, `recorte`). `proponerRecorte`: `null` = no es seguro, se usa la imagen completa |
| **Recibir dinero** | ✓ `partes.listar` · ✓ `saldos.consultar({ parte_id })` (lo que se debe por gestión) · ✓ `fondos.recibir({ …, aplicaciones })` | Partes, lo pendiente por gestión, el reparto (provisional «Sin aplicar») | `creada`; VALIDACION («excede lo adelantado», «aplicaciones exceden lo recibido») |
| **Fondos** | ✓ `saldos.consultar({ gestion_id, parte_id })` (custodia) · ✓ `fondos.devolver` · ✓ `fondos.trasladar` · ✓ `gestiones.listar` (destinos) | La custodia de la parte en la gestión | VALIDACION («no hay fondos suficientes en custodia», «el traslado necesita otra gestión») |
| **Preparar informe** | ✓ `gestiones.listar` · ✓ `partes.listar` · ✓ `compras.listar` (para elegir) · ✓ `informes.previsualizar({ alcance, opciones })` · ✓ `informes.emitir(...)` · ✓ `informes.abrir` · ✓ `informes.excel` | Tipos de alcance, compras a compartir (totales provisionales), estilo, papel, título, responsable, destinatario y corte | `emitir`: `informe` (código, revisión, huella), VALIDACION (`corte`, `tipo`), INTEGRIDAD (comprobante alterado: no queda revisión). **«Copia privada verificada» solo con `privado_estado: 'verificado'`** |
| **Informes emitidos** | ✓ `informes.listar()` · ✓ `informes.abrir` · ✓ `informes.excel` · ✓ `informes.exportar` · ✓ `informes.sinRegistro()` · ✗ `informes.leerSinRegistro(nombre)` | Código, revisión, destinatario y corte (del alcance y las opciones guardadas), `privado_estado` y `compartido_estado` | `abrir`: `origen` (privado, compartido o regenerado), INTEGRIDAD, ESTADO (otro motor) |
| **Más · Respaldo** | ✓ `respaldo.crear()` · ✓ `respaldo.restaurar(bytes)` · ✗ `respaldo.estado()` | Aviso de que no está cifrado (`cifrado: false`), último respaldo | `restaurar`: VALIDACION o INTEGRIDAD con su mensaje; los datos actuales quedan intactos |
| **Más · Acerca de** | ✓ `identidad()` | Producto, «Desarrollada por W. D. Gutiérrez», versión | `version: null` en el navegador |
| **Personas y empresas** | ✓ `partes.listar({ incluirInactivas })` · ✓ `partes.crear` · ✓ `partes.desactivar(id, motivo)` · ✗ `partes.uso(id)` | Nombre, tipo, activa y roles | `crear`: `creada`; VALIDACION (`nombre`), CONFLICTO. `desactivar`: VALIDACION (`motivo`) |

## 5. Contratos y cambios para el agente de programación

Ninguno cambia reglas de dinero. Todos devuelven cálculos del servicio, para que la interfaz no reconstruya saldos.

1. **`gestiones.detalle(id)` y `gestiones.listar()` → agregar `totales`** (pedido en el encargo):
   ```js
   totales: { NIO: { importe: 1905075, compras: 4 }, USD: { importe: 8500, compras: 1 } } // solo compras vigentes, sin mezclar monedas
   ```
2. **`saldos.resumen({ corte?, gestion_id?, parte_id? })`**, nueva, para Inicio. Devuelve los totales por moneda **separados**, nunca un neto:
   ```js
   { NIO: { por_recibir, en_custodia, por_regularizar, por_pagar_proveedores }, USD: { … }, lineas: [ /* las de saldos.consultar */ ] }
   ```
   `por_recibir` es la suma de `por_reembolsar`; `por_pagar_proveedores` es la suma de `deuda_proveedor`.
3. **`compras.listar` y `compras.detalle` → agregar `resumen` por compra**, para los chips y el bloque «Pendiente de pago»:
   ```js
   resumen: { pagado, pendiente /* solo crédito */, sin_detallar /* contado sin origen */, soporte: 'presente'|'ausente'|'pendiente'|'sin_factura', fotos }
   ```
4. **`compras.corregir(id, cambios, motivo)`**, nueva. En una transacción: anula la compra, registra la corregida con un id nuevo y deja eventos enlazados en las dos (`reemplaza_id` y `reemplazada_por`). Hoy la corrección es anular y registrar de nuevo, a mano.
5. **El titular del documento**, un campo nuevo: `compras.titular_id`, que referencia a `partes` (a nombre de quién está la factura; distinto del deudor y del beneficiario). Va en la migración 5, en `registrar`, `detalle`, el informe y el Excel.
6. **`partes.uso(id)`**, nueva: los roles de una parte, calculados a partir de los registros:
   ```js
   { responsable_de_gestiones, beneficiaria_de_compras, pagos_directos, fondos_entregados, deudora_de_creditos, por_reembolsar_a_su_cargo, titular_de_documentos }
   ```
7. **`informes.leerSinRegistro(nombre)`**, nueva: los bytes de un PDF de la versión anterior que está en Documentos sin revisión. Hoy la API los lista (`sinRegistro`) pero no los abre.
8. **`respaldo.estado()`**, nueva: `{ ultimo: fecha | null, bytes, fotos, informes }`. Hace falta registrar cada respaldo creado, por ejemplo en `ajustes`.
9. **`borradores.guardar(tipo, datos)`, `borradores.obtener(tipo)` y `borradores.descartar(tipo)`**, nuevas: el borrador de Registrar, Recibir e Informe tiene que sobrevivir a navegar y a cerrar la app. El borrador guarda el `id` ya generado de la compra, que hace seguro el reintento.
10. **La terminología del pedido** («rendición» → «Gastos», «Informe de gastos» y «Liquidación»):
    - `IDENTIDAD.producto`: «Gastos y Rendiciones» → **«Gastos e Informe de Gastos»**.
    - `TIPOS_INFORME` (los subtítulos del PDF):
      - «Rendición de gastos por gestión» → «Informe de gastos por gestión»;
      - «Rendición de varias gestiones» → «Informe de gastos de varias gestiones»;
      - «Rendición por empresa o persona» → «Informe de gastos por empresa o persona».
    - Cambiar el texto del PDF cambia los bytes: **subir `MOTOR_PDF` a 3**. Las revisiones del motor 2 se siguen abriendo desde su copia privada.
11. **La interfaz actual (`App.vue`)** se reemplaza por estas pantallas. La navegación de la app tiene que llevar historial, para que la X y el botón atrás de Android vuelvan al origen.

## 6. Errores corregidos en esta revisión

| # | Dónde | Qué pasaba | Corrección |
|---|---|---|---|
| 1 | Detalle de gestión | Solo 2 de 5 compras abrían su detalle | Las 5 abren su variante de detalle |
| 2 | Gestiones | No había consulta global; «Compras sin gestión: ninguna» | Pestaña «Todas las compras», con filtros por gestión (incluido «Sin gestión») y por moneda; compra histórica de ejemplo |
| 3 | Reabrir | La compra de Estelí no era navegable | Lleva a Compra-gasolinera |
| 4 | Detalle de compra | Solo había dos casos fijos; «Cambiar reparto» y «Agregar» no hacían nada; la vuelta era siempre a Winston Managua | Pantalla genérica con 7 casos; cada acción con su operación; «Corregir un dato» con trazabilidad; la vuelta según el origen |
| 5 | Ajustar comprobante | Abierto desde una compra, volvía al registro | Variante Recorte-compra, que vuelve a la compra |
| 6 | Detalle de gestión | Botón «Más opciones» sin destino | Retirado |
| 7 | Informe | «¿Qué querés rendir?», «La rendición completa…», el título «Rendición de gastos» | «¿Qué informe querés hacer?», «Todos los gastos de una gestión», «Informe de gastos» |
| 8 | Más | El producto decía «Gastos y Rendiciones» | «Gastos e Informe de Gastos» |
| 9 | Informe, paso 3 | Totales fijos que no cambiaban al desmarcar compras | Cálculo provisional que sigue la selección, rotulado; los definitivos, en la vista previa |
| 10 | Informe, resultado | «Informe emitido» y «Archivo verificado» sin respuesta del servicio | Control «respuesta»; «Copia privada verificada» solo con la respuesta confirmada; estado de error con INTEGRIDAD |
| 11 | Informe | «Ver vista previa», «Compartir», «Abrir» y «Excel» sin acción | Aviso con su operación |
| 12 | Informes emitidos | «Verificada» fija; los botones sin acción | Estados según el servicio (verificada, cambió, no está); serie R01 y R02; aviso por botón; «Ver» marcado como falta el servicio |
| 13 | Registrar | «Gasto guardado» sin respuesta; «Borrador guardado» sin respaldo | Control «respuesta», con error VALIDACION; «Borrador · se conserva al navegar»; «Falta repartir» rotulado provisional; el botón de fecha con aviso |
| 14 | Registrar | «Ver la gestión» iba a Winston Managua aunque el gasto fuera sin gestión | Depende de la elección |
| 15 | Recibir, Fondos | «Dinero registrado» y «Fondos devueltos» sin respuesta | Control «respuesta», con errores VALIDACION reales |
| 16 | Inicio, Gestión, Fondos, Reabrir | Saldos de ejemplo presentados como reales | Rotulados como ejemplo que calcula el servicio |
| 17 | Hojas (terminar, reabrir, pago, anular, clasificar, crear, desactivar, restaurar) | Cerraban en silencio, como si se hubiera hecho | Aviso con la operación y lo que se muestra al confirmar o al fallar |
| 18 | Personas y empresas | Desactivar cambiaba la lista sin confirmación | Aviso; una parte desactivada de ejemplo para ver ese estado; roles por parte |
| 19 | Más | «Acerca de» no abría nada | Hoja con producto, firma «Desarrollada por W. D. Gutiérrez» y versión |
| 20 | Más | «Crear respaldo» sin acción | Aviso; el último respaldo, marcado como falta el servicio |
| 21 | Gestión, Personas, Más (también Registrar) | **Listas y botones comprimidos y encimados**, por el patrón flex con `overflow: hidden` dentro del área desplazable. Se vio al rasterizar | Regla de base `main > * { flex-shrink: 0 }` en las 12 pantallas con área desplazable, y `flex: none` en las 11 tarjetas |
| 22 | Detalle de compra | El importe pendiente se partía en dos renglones | Sin corte de línea |
| 23 | Informe | «SIMULADA:CONFIRMADA» sin espacio | Texto armado en la lógica |

## 7. Cómo se verificó

- **Un revisor estático** de las 30 mesas: la sintaxis del JavaScript, las etiquetas balanceadas, que cada `{{ valor }}` exista en su lógica, los vínculos fijos y calculados, los botones sin acción y la palabra «rendición». Probado con cinco defectos inyectados: detectó los cinco después de corregir un hueco del propio revisor.
- **La lógica de cada pantalla**, con 174 combinaciones de sus controles y todos sus botones apretados en cada una: sin errores.
- **Chrome sin pantalla con el motor del lienzo:**
  - 30 mesas y 7 estados extra (esperando y error), cada una arriba y al final de su desplazamiento;
  - 14 recorridos con clics: terminar una gestión, la pestaña de compras y su filtro «Sin gestión», corregir y registrar un pago, Acerca de, crear respaldo, las partes desactivadas, el PDF anterior, desmarcar compras y el informe completo;
  - capturas revisadas a ojo;
  - un detector de cajas comprimidas o aplastadas, probado contra el defecto real: cero casos al final.
- **No se verificó:** el lienzo publicado en claude.ai (hace falta tu sesión). Las pantallas se probaron con el mismo motor, servido en la PC.

## 8. Dependencias pendientes

- **Las 9 operaciones o campos que faltan** (§5, del 1 al 9) y el cambio de terminología (§5, 10).
- **La navegación con historial** en la app real (X y atrás de Android).
- **La pantalla de recorte:** en el prototipo es fija (Ferretería). En la app usa un `<canvas>` con la foto real, `proponerRecorte` con sus píxeles RGBA y la vista previa del informe.
- **La Gate 5 en Android** (PASO-A → PASO-B): sigue pendiente del teléfono. Nada de esto se instaló en el POCO X7.
