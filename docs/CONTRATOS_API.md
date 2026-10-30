# Contrato de la API local · Gastos e Informe de Gastos V2

Para quien diseña la interfaz (Claude Design). La app no tiene servidor: estos «endpoints» son funciones de JavaScript que la interfaz llama dentro de la propia app. Funcionan **sin conexión**, sobre SQLite y los archivos privados del teléfono.

**La interfaz no calcula dinero.** Totales, saldos, estados de liquidación, validaciones y numeración de informes salen de la API. Si una pantalla necesita un número que la API no da, hay que pedirlo como operación nueva, no calcularlo en la pantalla.

Fuente: `src/api/index.js` (operaciones), `src/api/informes.js`, `src/api/respaldo.js`, `src/api/errores.js`. Las pruebas de `tests/api.test.js` y `tests/aceptacion-financiera.test.js` son ejemplos de uso ejecutables.

## Cómo se obtiene

```js
import { abrirApi } from "../api/dispositivo.js";
const { api } = await abrirApi(); // una vez al iniciar la app
```

Todas las operaciones son `async`. En el navegador de desarrollo (`npm run dev`) funcionan igual, con SQL.js y el almacenamiento del navegador.

## Convenciones

| Tema            | Regla                                                                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Importes        | Enteros en **centavos**: C$ 1,250.75 es `125075`. La interfaz convierte lo que escribe el usuario con `centavos(texto)` (`src/dominio/compra.js`) y muestra con `dinero(importe, moneda)`.                                              |
| Monedas         | `"NIO"` o `"USD"`. Nunca se suman entre sí ni se convierten. Cada total viene por moneda.                                                                                                                                               |
| Fechas          | `"AAAA-MM-DD"` para fechas de negocio. Las fechas de registro son ISO con hora (`2026-10-27T21:30:00.000Z`).                                                                                                                            |
| Identificadores | Texto (`[A-Za-z0-9-]`, hasta 80). Si la interfaz no manda `id`, la API crea uno. **Para reintentos seguros, la interfaz genera el `id` una vez y lo reusa** si la operación se repite (por ejemplo, tras un corte): no se duplica nada. |
| Nada se borra   | Corregir es **anular con motivo** (de 3 a 300 caracteres) y registrar de nuevo. Lo anulado queda con su fecha (`anulada`) y un evento.                                                                                                  |
| Respuestas      | Objetos simples, serializables a JSON. Los archivos vienen como `bytes` (`Uint8Array`).                                                                                                                                                 |

Las operaciones financieras se coordinan en la conexión y validan sus saldos dentro de la misma transacción que sus escrituras. La identidad de un registro nuevo incluye una huella canónica de su solicitud completa, incluidos reparto y comprobantes; se guarda en auditoría junto al registro. Un reintento idéntico no duplica, y cualquier diferencia produce `CONFLICTO`. En operaciones históricas sin huella original no es posible verificar todo el contenido: reutilizar su identificador devuelve `CONFLICTO`, incluso si los campos visibles coinciden. No se modifican los registros históricos.

En la versión de navegador, las ventanas comparten un bloqueo Web Locks y recargan la base persistida antes de operar. Si el navegador no ofrece Web Locks, la aplicación no abre la base: muestra un error en lugar de permitir escrituras simultáneas inseguras. Esta condición no afecta al adaptador SQLite nativo.

## Errores

Toda operación que falla lanza un `ErrorApi` con `codigo`, `message` (en español, para mostrar) y, si aplica, `campo` (el dato a marcar en el formulario). `error.toJSON()` devuelve `{ codigo, mensaje, campo }`.

| `codigo`        | Significa                                                                       | Qué hace la interfaz                                 |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `VALIDACION`    | Un dato no cumple una regla                                                     | Mostrar el mensaje junto a `campo`                   |
| `NO_ENCONTRADO` | El registro pedido no existe                                                    | Volver a la lista                                    |
| `ESTADO`        | No corresponde al estado actual (gestión terminada, forma de pago ya indicada…) | Explicar y ofrecer la acción previa (p. ej. reabrir) |
| `CONFLICTO`     | El `id` ya pertenece a otro registro                                            | Generar un `id` nuevo                                |
| `INTEGRIDAD`    | Un archivo falta o no coincide con su huella                                    | Avisar: el comprobante o el informe está dañado      |
| `VERSION`       | La base o el respaldo son de una versión más nueva                              | Pedir actualizar la app                              |

## Identidad

`api.identidad()` → `{ producto: "Gastos e Informe de Gastos", desarrollador: "W Gutiérrez", firma: "Desarrollado por W Gutiérrez", version }`. `version` es la de Android (`null` en el navegador). Es un metadato para Inicio y «Acerca de»; **nunca va en los informes**.

## Personas y empresas (`api.partes`)

| Operación                        | Recibe                            | Devuelve                                                         |
| -------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `crear({ id?, nombre, tipo })`   | `tipo`: `"persona"` o `"empresa"` | `{ parte, creada }` (`creada: false` si ya existía igual)        |
| `listar({ incluirInactivas? })`  |                                   | Lista ordenada por nombre                                        |
| `desactivar(id, motivo)`         |                                   | `{ parte }`. No se borra: sigue en su historia y en sus informes |
| `editar(id, { nombre }, motivo)` | Nombre descriptivo nuevo          | `{ parte }`; conserva identificador y registra antes/después.    |
| `detalle(id)`                    |                                   | Parte, eventos y roles derivados de las operaciones existentes.  |

## Catálogos (`api.catalogos`)

`crear`, `listar`, `editar` y `desactivar` administran cuentas, medios, categorías y destinos descriptivos. Al registrar una compra, `catalogos: [id, ...]` conserva el nombre y tipo utilizados como instantánea. Estas etiquetas no modifican los cálculos ni identifican por sí solas una transferencia bancaria. La migración de esquema 4→5 conserva las tablas anteriores y crea las nuevas vacías; los respaldos antiguos siguen aceptándose.

## Gestiones (`api.gestiones`)

| Operación                                                             | Recibe                                             | Devuelve                                                                                                                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crear({ id?, nombre, descripcion?, responsable_id?, fecha_inicio })` | `responsable_id`: una parte                        | `{ gestion, creada }`                                                                                                                                                         |
| `listar({ estado? })`                                                 | `estado`: `"todas"`, `"abiertas"` o `"terminadas"` | Cada una con `estado` (`abierta`/`terminada`), `liquidacion` y `compras` (cantidad vigente)                                                                                   |
| `detalle(id)`                                                         |                                                    | `{ gestion, compras, liquidacion, saldos, observaciones, eventos, historial }`. El historial reúne aplicaciones de fondos, compras, pagos, movimientos y eventos pertinentes. |
| `cerrar(id, fecha)`                                                   |                                                    | `{ gestion }`. Terminar no borra ni liquida nada                                                                                                                              |
| `reabrir(id, motivo)`                                                 |                                                    | `{ gestion }`. El evento guarda la fecha de cierre anterior                                                                                                                   |

Puede haber varias gestiones abiertas a la vez. **El cierre y la liquidación son independientes:** una gestión terminada puede seguir con dinero pendiente.

`liquidacion`: `"sin_movimientos"`, `"pendiente"`, `"parcial"` o `"liquidada"`.

## Compras (`api.compras`)

`registrar(entrada)` → `{ compra, creada }`. Todo o nada: la compra, sus fotos, su reparto y sus pagos se guardan juntos o no se guarda nada.

```js
await api.compras.registrar({
  id, // opcional; reusarlo en un reintento
  gestion_id, // null: compra sin gestión
  fecha_compra: "2026-10-21",
  concepto,
  proveedor,
  importe: 820000,
  moneda: "NIO",
  factura: "0000123", // texto: conserva los ceros
  estado: "factura", // "factura" | "sin_factura" | "pendiente"
  forma_pago: "contado", // "sin_detalle" (por defecto) | "contado" | "credito"
  deudor_id, // obligatorio si es a crédito: quién le debe al proveedor
  asignaciones: [
    // opcional; si va, debe sumar exactamente el importe
    { parte_id: "empresa", importe: 600000 },
    { parte_id: null, importe: 220000 }, // null = gasto personal del responsable
  ],
  pagos: [
    // opcional; ver «Pagos»
    { origen: "fondo", parte_id: "empresa", importe: 600000, asignacion: 0 },
    { origen: "propio", importe: 220000, asignacion: 1 },
  ],
  imagenes: [{ bytes, tipo: "image/jpeg", clase: "factura" }], // "factura" | "voucher" | "otro"
});
```

En `pagos`, `asignacion` es el **índice** dentro de `asignaciones` de la misma llamada. Para un pago posterior se usa `asignacion_id`.

| Operación                                                  | Recibe                                                                                                                                                  | Devuelve                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listar(filtros)`                                          | `gestion_id` (`"ninguna"` = sin gestión), `desde`, `hasta`, `moneda`, `proveedor` (contiene, sin mayúsculas), `comprobante` (estado), `incluirAnuladas` | Compras más recientes primero                                                                                                                                                                                                                                 |
| `detalle(id)`                                              |                                                                                                                                                         | `{ compra, fotos, anexos, asignaciones, pagos, eventos }`                                                                                                                                                                                                     |
| `anular(id, motivo)`                                       |                                                                                                                                                         | `{ compra }`. Anula también sus pagos y su reparto vigentes                                                                                                                                                                                                   |
| `corregir(id, cambios, motivo)`                            | Solo `concepto`, `proveedor` y `factura`                                                                                                                | `{ compra }`. Conserva los valores anteriores y nuevos en un evento; no altera importes, pagos ni identificador.                                                                                                                                              |
| `corregirEconomia(id, { id?, importe?, moneda? }, motivo)` | Nueva compra con nuevo identificador                                                                                                                    | Anula y conserva la original, duplica sus comprobantes verificados y transformaciones, y enlaza ambas en auditoría. Exige revertir primero pagos y repartos vigentes. Un reintento idéntico con el mismo nuevo ID es seguro; uno distinto genera `CONFLICTO`. |
| `asignar(id, asignaciones, motivo?)`                       | Reparto nuevo completo                                                                                                                                  | `{ asignaciones }`. El anterior queda anulado; el evento guarda el antes y el después. Si hay pagos imputados al reparto actual: `ESTADO`                                                                                                                     |
| `clasificarPago(id, { forma_pago, deudor_id? }, motivo?)`  | Solo para compras `sin_detalle`                                                                                                                         | `{ compra }`. Una sola vez                                                                                                                                                                                                                                    |

Las compras de versiones anteriores quedan `sin_detalle`: no generan deudas ni reembolsos hasta que se clasifiquen.

## Pagos (`api.pagos`)

`registrar({ id?, compra_id, fecha, importe, origen, parte_id?, asignacion_id? })` → `{ pago, creado }`.

| `origen`    | `parte_id`          | Efecto                                                                                                                                                                                                            |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"propio"`  | —                   | El responsable pagó con su dinero. Si está imputado a la parte de una empresa o persona, nace **por reembolsar** a su cargo. Si es la parte personal o no tiene reparto, no genera nada (queda como observación). |
| `"fondo"`   | Dueño de los fondos | Sale de los fondos de esa parte **en custodia** en la gestión. Si paga la parte personal, queda **por regularizar** con el dueño. No puede pagar el gasto de otra parte (`VALIDACION`).                           |
| `"tercero"` | Quien pagó directo  | La empresa o persona pagó al proveedor: reduce la deuda, sin reembolso.                                                                                                                                           |

Con una compra repartida entre varias partes, el pago `propio` o `fondo` debe decir `asignacion_id`. Los pagos nunca superan el importe de la compra. `anular(id, motivo)`.

## Regularizaciones (`api.regularizaciones`)

`atribuir({id?, pago_id, responsable_id, beneficiario_id, fecha, motivo})` atribuye expresamente la responsabilidad y el beneficiario de un pago de fondos aplicado a gasto personal. Cada pago admite una atribución; no se inventa una persona para registros históricos. `liquidar({id?, pago_id, pagador_id, modalidad, fecha, importe, motivo})` registra un reintegro en centavos, con modalidad `reposicion` (aumenta la custodia) o `directa` (no la modifica). El propietario y la moneda se obtienen del pago original. Se permiten pagos parciales hasta el importe de ese pago; el reintento idéntico es idempotente. `listar()` devuelve atribuciones y movimientos; `anular(id, motivo)` revierte el efecto si el conjunto sigue siendo válido. La operación original no puede anularse mientras tenga liquidaciones activas.

La migración SQLite 7→8 añade atribuciones y movimientos, sin saldos persistidos paralelos. Las aplicaciones anteriores no pueden abrir una base migrada a esquema 8. Las revisiones PDF anteriores conservan sus copias privadas; las nuevas usan el motor 10.

El Excel de una revisión anterior al motor 9 por destinatario que incluya compras compartidas se rechaza: esa revisión podía divulgar importes de otras partes. Debe emitirse una nueva revisión para obtener Excel con el alcance protegido. La copia PDF histórica permanece intacta y debe revisarse antes de compartirla.

## Dinero recibido y fondos (`api.fondos`)

| Operación                                                                         | Recibe                                                                                                                                    | Devuelve                                                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `recibir({ id?, fecha, parte_id, importe, moneda, referencia?, aplicaciones })`   | `aplicaciones`: `[{ gestion_id, destino, importe }]`; `destino`: `"anticipo"` (queda en custodia) o `"reembolso"` (cancela lo adelantado) | `{ recepcion, aplicaciones, creada }`. **Una sola entrada** repartida entre varias gestiones |

| `aplicar(recepcion_id, aplicaciones)`                                             | Aplica lo que quedó sin aplicar                                                                                                           | `{ aplicaciones }`                                                                           |
| `devolver({ gestion_id, parte_id, fecha, importe, moneda })`                      | Devuelve fondos en custodia a su dueño                                                                                                    | `{ movimiento, creado }`                                                                     |
| `trasladar({ gestion_id, gestion_destino_id, parte_id, fecha, importe, moneda })` | Pasa fondos en custodia a otra gestión                                                                                                    | `{ movimiento, creado }`                                                                     |
| `anular(tipo, id, motivo)`                                                        | `tipo`: `"recepcion"`, `"aplicacion"` o `"movimiento"`                                                                                    | `{ anulado }`. No se anula dinero ya gastado: primero se anulan esos pagos                   |
| `recepciones()`                                                                   |                                                                                                                                           | Cada una con sus `aplicaciones` y `sin_aplicar`                                              |

Una aplicación con `gestion_id: null` se admite únicamente con destino `reembolso`: cancela el saldo de compras sin gestión de la misma parte y moneda. No admite reembolso mayor al saldo ni anticipo sin gestión. La migración SQLite 6→7 conserva las aplicaciones anteriores; las versiones anteriores de la aplicación no pueden abrir una base ya migrada a 7.

Nada puede dejar la custodia en negativo ni reembolsar más de lo adelantado (`VALIDACION`).

## Saldos (`api.saldos`)

`consultar({ gestion_id?, parte_id?, moneda?, corte? })` → `{ saldos, observaciones }`. `corte` (`AAAA-MM-DD`) calcula a esa fecha.

Cada saldo: `{ tipo, gestion_id, parte_id, moneda, importe }` (más `compra_id` y `proveedor` en las deudas). Solo vienen los distintos de cero.

| `tipo`            | Texto sugerido                                                    |
| ----------------- | ----------------------------------------------------------------- |
| `custodia`        | Fondos de {parte} en custodia                                     |
| `por_reembolsar`  | Por reembolsar al responsable, a cargo de {parte}                 |
| `por_regularizar` | Por regularizar con {parte}: sus fondos pagaron un gasto personal |
| `deuda_proveedor` | Pendiente de pago a {proveedor}, deudor {parte}                   |

**No hay un saldo neto:** los cuatro tipos se muestran por separado, por moneda. No indicar deudas solo con color.

`observaciones`: avisos que no son saldos: `origen_sin_detallar`, `pago_propio_sin_cargo`, `pago_personal`, `recepcion_sin_aplicar`.

`liquidacion(gestion_id, { corte? })` → `{ estado, saldos }`.

`cuentas({ gestion_id? })` devuelve el resumen actual por gestión, parte y moneda: recibido, gastos registrados, pagos con fondo, custodia, aportes propios, reembolso, deuda, devoluciones y traslados. Los gastos sin reparto aparecen con parte nula; no se atribuyen automáticamente al deudor.

## Comprobantes y anexos

| Operación                                                      | Recibe                                     | Devuelve                                                                   |
| -------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| `comprobantes.agregar(compra_id, imagenes)`                    | Fotos para una compra ya guardada          | `{ fotos }`. Una compra `pendiente` que recibe su factura pasa a `factura` |
| `comprobantes.original(foto_id)`                               |                                            | `{ foto, bytes }`, verificados contra su huella                            |
| `anexos.obtener(foto_id)`                                      |                                            | `{ anexo: { rotacion, enderezar, recorte } }`                              |
| `anexos.ajustar(foto_id, { rotacion?, enderezar?, recorte? })` | Ver abajo                                  | `{ anexo }`. **La foto original no cambia nunca**                          |
| `anexos.restablecer(foto_id)`                                  |                                            | Vuelve a la presentación original                                          |
| `anexos.proponerRecorte(rgba, ancho, alto)`                    | Píxeles RGBA de la foto (de un `<canvas>`) | `{ recorte }` o `{ recorte: null }` si no es seguro recortar               |

- `rotacion`: 0, 90, 180 o 270 grados, en sentido horario. Se suma a la orientación EXIF de la foto, que la API ya corrige sola.
- `enderezar`: de −15 a 15 grados (positivo = horario).
- `recorte`: `{ x, y, w, h }` en fracciones (0 a 1) de la imagen **ya girada**, con origen arriba a la izquierda. Cada lado conserva al menos un 20 %. Un recorte fuera de esos límites se rechaza, y si llegara uno inseguro, el PDF usa la imagen completa.

**Para la pantalla de recorte:** dibujar la foto (de `comprobantes.original`) en un canvas con el giro elegido, pedir `proponerRecorte` con sus píxeles, dejar que el usuario ajuste el rectángulo y guardar con `anexos.ajustar`. La vista previa del resultado sale de `informes.previsualizar`.

## Informes (`api.informes`)

`alcance` elige el tipo:

| `tipo`       | Campos                     | Qué trae                                                                                                                                                                           |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gestion`    | `gestion_id`               | Rendición de una gestión                                                                                                                                                           |
| `gestiones`  | `gestion_ids`              | Varias gestiones en un documento                                                                                                                                                   |
| `periodo`    | `desde`, `hasta`           | Historial de compras del período, con o sin gestión                                                                                                                                |
| `parte`      | `parte_id`, `gestion_ids?` | Por empresa o persona: **solo lo asignado a ella**. Sin filas, importes ni saldos ajenos. Sus comprobantes compartidos con otros destinos no se anexan, salvo `incluirCompartidos` |
| `pendientes` | `gestion_ids?`             | Gastos pendientes de comprobante                                                                                                                                                   |

`opciones`: `{ titulo, responsable?, destinatario?, corte, papel: "carta"|"a4", estilo: "ejecutivo"|"formal", incluirFotos, incluirCompartidos?, compras? }`. `compras` (lista de ids) limita a las elegidas, para revisar qué se comparte.

| Operación                                         | Devuelve                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `previsualizar({ alcance, opciones })`            | `{ codigo, revision, totales, filas, anexos, financiero, financieroLimitado, bytes }`, **sin registrar nada**. El resumen proviene del mismo modelo que el PDF; puede ser `null` cuando el alcance no permite atribuir saldos. |
| `emitir({ alcance, opciones, exportar? = true })` | `{ informe, bytes }`. Revisión nueva e inmutable (`GR-…-R01`, `R02`…), con copia privada verificada y, si `exportar`, copia en Documentos/«Registros de mis gastos» |
| `listar({ clave?, gestion_id? })`                 | Revisiones con `privado_estado` y `compartido_estado` (`verificado`, `alterado` o `ausente`), sin el modelo completo                                                |
| `abrir(id)`                                       | `{ bytes, origen, nombre }`. `origen`: `privado`, `compartido` o `regenerado` (idéntico, verificado con la huella)                                                  |
| `regenerar(id)`                                   | `{ bytes }` idénticos al entregado, o `INTEGRIDAD`                                                                                                                  |
| `exportar(id)`                                    | `{ archivo, nuevo }`: copia a la carpeta compartida                                                                                                                 |
| `excel(id)`                                       | `{ bytes, nombre }`, de la misma revisión: hojas Resumen, Compras, Asignaciones, Fondos y saldos, Comprobantes (las que tengan datos)                               |
| `sinRegistro()`                                   | PDF de la carpeta compartida de versiones anteriores, sin revisión                                                                                                  |

Una revisión emitida no cambia nunca: una compra, un pago o un ajuste de anexo posteriores no la alteran. Para reflejarlos se emite una revisión nueva. Para compartir un archivo, la interfaz usa `compartir(nombre, bytes, tipo)` de `src/datos/archivos.js`.

Para cortes anteriores, las anulaciones, sustituciones económicas y correcciones descriptivas registradas se consideran en su fecha. Los repartos históricos reemplazados que no pueden reconstruirse con certeza se rechazan explícitamente. **Limitación:** los registros históricos de fotos y algunas aplicaciones no guardan su fecha de incorporación; por ello no se garantiza una reconstrucción completa de imágenes y aplicaciones para fechas anteriores. Una revisión ya emitida y conservada es la referencia verificable.

## Respaldo (`api.respaldo`)

| Operación          | Devuelve                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crear()`          | `{ bytes, cifrado: false }`: ZIP integral con la base, las fotos y las copias privadas esperadas de los informes, con manifiesto de huellas. Falta o alteración de un archivo esperado produce `INTEGRIDAD` y no entrega un ZIP. No se ofrecen respaldos parciales. Los informes históricos de motor 1 que nunca tuvieron copia privada se conservan como tales. |
| `restaurar(bytes)` | `{ compras, fotos, informes, informes_con_archivo, movimientos }`. Valida todo antes de tocar nada (también las reglas de dinero); si algo falla, el estado anterior queda intacto                                                                                                                                                                               |

El respaldo **no está cifrado:** la pantalla debe decirlo y recomendar un destino privado. Restaurar reemplaza todos los datos: pedir confirmación. Acepta los respaldos de versiones anteriores.
Un respaldo anterior que omitió una copia privada esperada no se considera completo y se rechaza antes de reemplazar los datos existentes.

## Lo que queda para la interfaz

- **Pantallas** de: partes, detalle de gestión con sus saldos, el pago al registrar una compra (contado/crédito, origen del dinero, reparto), recepción de dinero y su reparto, devoluciones y traslados, anulaciones con motivo, informes de todos los tipos y la pantalla de recorte.
- **El botón atrás de Android:** hoy cierra la app desde cualquier pantalla. `@capacitor/app` ya está instalado, con su manejo del botón desactivado (`capacitor.config.json`).
- **Las pantallas actuales** (Inicio, Gestiones, Registro, Compras, Respaldo) siguen funcionando y usan la API para informes y respaldo. El registro de compras actual guarda `forma_pago: "sin_detalle"`.

### Conciliación de informes · antecedentes del motor 4

En los informes completos de una o varias gestiones, el modelo inmutable contiene `financiero.cuentas`: importes en centavos por gestión, parte y moneda, derivados de los mismos movimientos y corte que los saldos. `recibido` significa anticipo aplicado a la gestión, no total global del depósito; `usado_fondo`, `aportado_propio`, `reembolsado`, devoluciones, traslados y saldos son campos separados. PDF y Excel consumen ese mismo modelo. Las selecciones parciales, períodos y pendientes no presentan saldos generales como si pertenecieran a las compras seleccionadas: `financieroLimitado` expresa esa limitación. El modelo incluye movimientos vigentes para gestiones completas, con fecha desconocida cuando falta el dato; no incluye aún todo el historial de anulaciones/correcciones ni saldos de apertura para períodos. `destinatario_id` selecciona una parte existente y fija su nombre en la revisión emitida.

La emisión guarda el instante UTC y la representación local de ese instante; las revisiones anteriores mantienen sus copias privadas y su huella. El esquema SQLite 6 incorpora `finalidad` y `beneficiario_id` opcionales en recepciones; se conservan los valores vacíos de registros y respaldos anteriores y la identidad de sus reintentos. El cálculo histórico no puede recuperar fechas o relaciones que no hayan sido registradas; consulte las limitaciones de la matriz y no complete valores por inferencia.

### Continuación fase 08: fuente de fondos y motor 5

El motor PDF 5 conserva en el modelo de revisión las recepciones globales vinculadas a las gestiones, su total y remanente sin aplicar; las filas de conciliación siguen reflejando únicamente lo aplicado a cada gestión. El total global se etiqueta y no se suma de nuevo por gestión. Las revisiones de motores anteriores se abren desde sus copias privadas verificadas; no se regeneran con el motor nuevo. Los cortes antiguos con información temporal insuficiente siguen siendo limitados y se advierte explícitamente.

El asistente de compra admite reparto de una compra pagada entre varios destinos, con origen y dueño del fondo o pagador identificados por cada parte. Para una compra sencilla también exige elegir el propietario del fondo o pagador directo; estas respuestas se traducen a la API transaccional existente. Los repartos a crédito o pagos parciales que el asistente no exprese siguen disponibles en el recorrido avanzado.

Los informes nuevos admiten `opciones.logotipo` opcional: imagen PNG o JPEG como data URL de hasta 1 MB. El modelo de la revisión conserva la imagen elegida, de modo que el PDF histórico y su regeneración no dependen de una imagen que después se cambie. En el asistente se elige para cada informe; todavía no existe una asociación persistente de logotipos por empresa.
