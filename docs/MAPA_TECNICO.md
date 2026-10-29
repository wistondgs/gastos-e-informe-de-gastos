# Mapa técnico · Gastos e Informe de Gastos V2

Mapa del código publicado. Todo lo citado se comprobó en **`63b26a4`**; los enlaces relativos llevan al código actual de la rama, y los enlaces permanentes, a ese SHA.

- Base para navegar: `https://github.com/wistondgs/gastos-e-informe-de-gastos/blob/master/`
- Base permanente auditada: `https://github.com/wistondgs/gastos-e-informe-de-gastos/blob/63b26a4d15246073348e8c69f6f2ff9bfa72dec3/`

No reemplaza el [contrato de la API](CONTRATOS_API.md) (parámetros y errores) ni la [matriz](MATRIZ_FINALIZACION_V2.md) (aceptación).

## 1. Capas

```
interfaz (Vue/Quasar)  →  API local (única puerta)  →  dominio (reglas y cálculos)
                                     ↓                         ↑
                         datos (SQLite nativo o SQL.js, archivos privados)
                                     ↓
                         exportaciones (PDF, Excel) y documentos (anexos)
```

Todas las operaciones de dinero pasan por `crearApi` ([`src/api/index.js`](../src/api/index.js)). **Excepción:** la interfaz también usa el repositorio directamente para algunas lecturas y para guardar los ajustes del informe (ver §3.2).

## 2. Entrada y arranque

| Archivo | Responsabilidad | Principal | Depende de | Lo usan |
|---|---|---|---|---|
| [`src/main.js`](../src/main.js) | Monta la aplicación | — | `interfaz/App.vue` | `index.html` |
| [`src/api/dispositivo.js`](../src/api/dispositivo.js) | Abre la API con el repositorio y archivos del dispositivo | `abrirApi` | `datos/abrir.js`, `datos/archivos.js`, `datos/informes-locales.js`, `api/index.js` | `App.vue` |
| [`src/datos/abrir.js`](../src/datos/abrir.js) | Elige SQLite nativo (Capacitor) o SQL.js (navegador) | `abrirRepositorio` | `datos/base.js` | `dispositivo.js` |
| [`src/identidad.js`](../src/identidad.js) | Identidad del producto | `IDENTIDAD` | — | `api/index.js` |

Pruebas: [`tests/arranque.test.js`](../tests/arranque.test.js), [`tests/version.test.js`](../tests/version.test.js).

## 3. API local

[`src/api/index.js`](../src/api/index.js) · `crearApi` · depende de todo `dominio/`, `documentos/anexos.js`, `datos/archivos.js`, `api/errores.js`, `api/informes.js`, `api/respaldo.js` · la usan `dispositivo.js`, `App.vue` (por la API) y las pruebas mediante [`tests/apoyo-api.js`](../tests/apoyo-api.js).

| Grupo | Operaciones |
|---|---|
| `partes` | crear, listar, editar, detalle, desactivar |
| `catalogos` | crear, listar, editar, desactivar |
| `gestiones` | crear, listar, detalle, cerrar, reabrir |
| `compras` | registrar, listar, detalle, corregir, corregirEconomia, anular, asignar, clasificarPago |
| `pagos` | registrar, anular |
| `fondos` | recibir, aplicar, devolver, trasladar, anular, recepciones |
| `saldos` | cuentas, consultar, liquidacion |
| `comprobantes` | agregar, original |
| `anexos` | ajustar, restablecer, obtener, proponerRecorte |
| `informes` ([`api/informes.js`](../src/api/informes.js), `servicioInformes`) | previsualizar, emitir, listar, abrir, regenerar, exportar, excel, sinRegistro |
| `respaldo` ([`api/respaldo.js`](../src/api/respaldo.js), `servicioRespaldo`) | crear, restaurar |

**Envoltura** (`envolverTodo`, al final de `index.js`): toda operación devuelve `ErrorApi` ([`api/errores.js`](../src/api/errores.js), `traducir`), nunca un error interno.

### 3.1 Funciones que escriben datos financieros

Son las 13 de la lista `financieras` de `envolverTodo`. Corren dentro de `repo.transaccion` y pasan por `confirmar`, que **recalcula `calcularSaldos` sobre el conjunto completo antes de guardar** (si una regla falla, no se escribe nada):

`compras.registrar`, `compras.anular`, `compras.asignar`, `compras.corregir`, `compras.corregirEconomia`, `compras.clasificarPago`, `pagos.registrar`, `pagos.anular`, `fondos.recibir`, `fondos.aplicar`, `fondos.devolver`, `fondos.trasladar`, `fondos.anular`.

Las demás escrituras (partes, catálogos, gestiones, fotos y ajustes de anexos) van por `repo.exclusiva` y llaman a `repo.aplicar` directamente, sin recalcular saldos.

### 3.2 Accesos de la interfaz que no pasan por la API

`App.vue` recibe el repositorio al abrir (`repo.value = abierta.repo`) y lo usa sin pasar por la API:

- **Lecturas:** `repo.compras()`, `repo.gestiones()`, `repo.fotos(id)`, `repo.ajustes()`.
- **Escrituras:** `repo.guardarAjustes({...})` y `repo.guardarAjuste(texto)` (encabezado, responsable y destinatario del informe; tabla `ajustes`, en [`datos/base.js`](../src/datos/base.js)).

No tocan tablas financieras, pero estas escrituras no generan `eventos` ni pasan por `ErrorApi`. Se documenta como está; cambiarlo corresponde a una fase autorizada.

## 4. Flujo económico

**Recepción → Aplicación → Compra → Pago → Saldo → Reembolso, devolución o crédito → Informe**

| Transición | Llamada de API | Tabla | Regla en el dominio |
|---|---|---|---|
| Recepción de dinero | `fondos.recibir` | `recepciones` | `validarMovimientoBasico("recepcion")` |
| Aplicación a una gestión (anticipo) o reembolso | `fondos.aplicar(recepcion_id, aplicaciones)` | `aplicaciones` (`destino`: `anticipo` o `reembolso`) | `calcularSaldos`: no aplicar más que lo recibido |
| Compra | `compras.registrar` (`forma_pago`: `contado`, `credito`, `sin_detalle`) | `compras`, `fotos`, `asignaciones` | `validarCompra` ([`dominio/compra.js`](../src/dominio/compra.js)), `guardarCompra` ([`dominio/operaciones.js`](../src/dominio/operaciones.js)) |
| Reparto de una compra entre partes | `compras.asignar(id, asignaciones)`; cada asignación lleva `parte_id` (o `null`, ámbito personal) e `importe`, **dentro de la gestión de la compra** | `asignaciones` | `calcularSaldos`: si hay asignaciones, deben sumar **exactamente** el importe de la compra |
| Reparto de una entrada entre gestiones | `fondos.aplicar` con varias aplicaciones de la misma recepción (no `compras.asignar`) | `aplicaciones` | no aplicar más que lo recibido |
| Pago | `pagos.registrar`; `origen`: `fondo` (resta custodia de esa parte), `propio` (suma `por_reembolsar` a la parte imputada) o `tercero` (otra parte pagó directo: exige `parte_id` y **no mueve ningún saldo**) | `pagos` | `calcularSaldos`: un fondo no paga más de su custodia ni el gasto de otra parte; crédito con deudor; `sin_detalle` no admite pagos |
| Saldo | `saldos.consultar`, `saldos.cuentas`, `saldos.liquidacion` | — (derivado) | `calcularSaldos`, `estadoCuentas`, `liquidacion` |
| Devolución | `fondos.devolver` | `movimientos` (`tipo: devolucion`) | la custodia no queda negativa |
| Traslado entre gestiones | `fondos.trasladar` | `movimientos` (`tipo: traslado`) | gestión de destino distinta y existente |
| Reembolso | `fondos.aplicar` con `destino: reembolso` | `aplicaciones` | `por_reembolsar` no queda negativo |
| Crédito y abonos | `compras.registrar` con `forma_pago: credito` y luego `pagos.registrar` | `compras`, `pagos` | `deuda_proveedor` |
| Anulaciones | `fondos.anular`, `pagos.anular`, `compras.anular` | se marca `anulada` y se agrega a `eventos` | anular una recepción anula sus aplicaciones |
| Informe | `informes.emitir` | `informes` + PDF privado | `prepararInforme`, con corte histórico |

Los saldos nunca se compensan entre sí: `TIPOS_SALDO = custodia, por_reembolsar, por_regularizar, deuda_proveedor` ([`dominio/finanzas.js`](../src/dominio/finanzas.js)).

### 4.1 Separación por responsabilidad

1. **Persistencia de hechos y movimientos:** [`datos/tablas.js`](../src/datos/tablas.js) (15 tablas: ajustes, partes, catalogos, gestiones, compras, fotos, catalogo_usos, anexos, asignaciones, recepciones, aplicaciones, pagos, movimientos, informes, eventos), [`datos/base.js`](../src/datos/base.js) (`inicializar`, migraciones, `repositorio` con `aplicar`, `transaccion`, `exclusiva`), [`datos/adaptador-sqljs.js`](../src/datos/adaptador-sqljs.js), [`datos/web-sqlite.js`](../src/datos/web-sqlite.js). Auditoría: cada operación agrega filas a `eventos` (función `evento` en `api/index.js`).
2. **Validaciones del motor económico:** [`dominio/finanzas.js`](../src/dominio/finanzas.js) (`calcularSaldos`, `validarParte`, `validarMovimientoBasico`, `ErrorFinanciero`), [`dominio/compra.js`](../src/dominio/compra.js), [`dominio/gestion.js`](../src/dominio/gestion.js), [`dominio/catalogos.js`](../src/dominio/catalogos.js).
3. **Proyecciones y estados de cuentas:** `calcularSaldos` y `liquidacion` ([`dominio/finanzas.js`](../src/dominio/finanzas.js)); `estadoCuentas` ([`dominio/estado-cuentas.js`](../src/dominio/estado-cuentas.js)). Nada se guarda: se derivan de los movimientos.
4. **Presentación:** [`interfaz/App.vue`](../src/interfaz/App.vue) (pantallas y navegación en un solo componente), [`interfaz/flujo-financiero.js`](../src/interfaz/flujo-financiero.js) (`prepararCompraFinanciera`, `prepararAplicaciones`: arma los pedidos a la API, no calcula saldos), [`interfaz/EditorComprobante.vue`](../src/interfaz/EditorComprobante.vue).
5. **Exportaciones:** [`exportaciones/informe-pdf.js`](../src/exportaciones/informe-pdf.js) (`informePdf`, `MOTOR_PDF`), [`exportaciones/informe-excel.js`](../src/exportaciones/informe-excel.js) (`informeExcel`), [`exportaciones/informes.js`](../src/exportaciones/informes.js) (`pdf` y `excel` sencillos, usados por la interfaz), [`documentos/anexos.js`](../src/documentos/anexos.js) (`planificarAnexos`, `proponerRecorte`, `validarAjusteAnexo`), [`dominio/informe.js`](../src/dominio/informe.js) (`prepararInforme`, `codigoInforme`, `validarOpciones`).

## 5. Otros componentes

| Componente | Archivo | Principal | Pruebas |
|---|---|---|---|
| Respaldo y restauración | [`datos/respaldo.js`](../src/datos/respaldo.js) | `crearRespaldo` (formato 4, SHA-256), `restaurarRespaldo` (valida todo, también finanzas, antes de reemplazar; acepta 1 a 3) | `gestion`, `informes-revision`, `recorrido`, A9 |
| Archivos privados | [`datos/archivos.js`](../src/datos/archivos.js) | `archivos`, `huella`, `compartir` | `editor-integracion`, `recorrido` |
| Informes emitidos | [`datos/informes-locales.js`](../src/datos/informes-locales.js) | `crearAlmacenInformes`, `informesPrivados`, `informesCompartidos` | `informes-locales` |
| Borradores | [`datos/borradores.js`](../src/datos/borradores.js) | `crearBorradores` (IndexedDB) | `borradores` |
| Seguridad de dispositivo | [`interfaz/proteccion.js`](../src/interfaz/proteccion.js) | `crearProteccion` (biometría del sistema; no cifra) | `proteccion` (simulada) |
| Versión instalada | [`interfaz/version.js`](../src/interfaz/version.js) | `versionInstalada` | `version` |

## 6. Pruebas por invariante

| Invariante | Prueba |
|---|---|
| A1–A9 (adelanto propio, anticipo y devolución, origen combinado, crédito, períodos, compra mixta, respaldo duplicado, monedas y correcciones, protección) | [`tests/aceptacion-financiera.test.js`](../tests/aceptacion-financiera.test.js) |
| Concurrencia sobre la custodia y las recepciones; idempotencia; PDF privado completo (C1-01 a C1-03) | [`tests/integridad-c1.test.js`](../tests/integridad-c1.test.js) |
| Un fondo no paga más de lo recibido; reparto mixto | [`tests/flujo-financiero.test.js`](../tests/flujo-financiero.test.js) |
| Reparto de una entrada y remanente; crédito con abonos | [`tests/flujo-reparto.test.js`](../tests/flujo-reparto.test.js) |
| Estado de cuentas separado por concepto | [`tests/estado-cuentas.test.js`](../tests/estado-cuentas.test.js) |
| Historial sin mezclar entidades | [`tests/historial-financiero.test.js`](../tests/historial-financiero.test.js) |
| Corrección descriptiva y económica | [`tests/correccion-compra.test.js`](../tests/correccion-compra.test.js) |
| Corte histórico de informes | [`tests/informe-corte-historico.test.js`](../tests/informe-corte-historico.test.js) |
| Reglas de pago, rastro de eventos, errores de la API | [`tests/api.test.js`](../tests/api.test.js) |
| Migraciones y respaldo | [`tests/gestion.test.js`](../tests/gestion.test.js), [`tests/informes-revision.test.js`](../tests/informes-revision.test.js), [`tests/catalogos-partes.test.js`](../tests/catalogos-partes.test.js) |
| Informes, PDF, Excel y anexos | [`tests/informe-profesional.test.js`](../tests/informe-profesional.test.js), [`tests/anexos.test.js`](../tests/anexos.test.js), [`tests/editor-integracion.test.js`](../tests/editor-integracion.test.js), [`tests/recorrido.test.js`](../tests/recorrido.test.js) |
| Guiones Android | [`tests/guiones-android.test.js`](../tests/guiones-android.test.js) |

Total en `63b26a4`: 23 archivos, 101 pruebas (ver [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md#4-pruebas)). Las guardas de proceso están en [`guardas.py`](../guardas.py) y [`ERRORES_Y_GUARDAS.md`](../ERRORES_Y_GUARDAS.md).

## 7. Android y entrega

| Archivo | Qué hace |
|---|---|
| [`scripts/android/compilar.sh`](../scripts/android/compilar.sh) | `pruebas` (`io.necktral.gastos.entorno.pruebas`) u `oficial`; guarda la APK en `apk/` con versión, commit y huella |
| [`scripts/android/entregar.sh`](../scripts/android/entregar.sh) | Copia al teléfono; se niega si hay otra APK en Descargas |
| [`scripts/android/prueba-actualizacion.sh`](../scripts/android/prueba-actualizacion.sh), [`scripts/android/sinteticos.mjs`](../scripts/android/sinteticos.mjs) | Prueba de actualización con datos sintéticos |
| [`capacitor.config.json`](../capacitor.config.json), `android/`, `ios/` | Proyectos nativos |

## 8. Evidencia y documentos históricos

- [`docs/evidencia/`](evidencia/): ejemplos de PDF y Excel, registros de `check.txt` y mutantes, todo con datos ficticios.
- [`docs/fases/`](fases/): fichas 01 a 07 (históricas).
- [`docs/validaciones/android-poco-x7.md`](validaciones/android-poco-x7.md), [`docs/INFORME_VALIDACION_ANDROID_V2.md`](INFORME_VALIDACION_ANDROID_V2.md).
- [`Auditoria_exhaustiva_Gastos_e_Informe_V2_2026-10-28.md`](../Auditoria_exhaustiva_Gastos_e_Informe_V2_2026-10-28.md): auditoría de una APK anterior (`3547c34`).
- [`docs/mandatos/`](mandatos/): mandato, plan y roadmap (DOCX).

## 9. Material ajeno al proyecto

`.agents/skills/necktral-phase-execution-zip/` es una Skill para **ERP V4** («Ejecución de fases de ERP V4»: `ROADMAP.md`, kernels, `CLAUDE.md`). Ningún archivo de `src/`, `tests/`, `scripts/` ni la documentación la referencia: **no tiene dependencia real** en esta aplicación. Contradice [D1](DECISIONES.md). **Propuesta:** retirarla de este repositorio o trasladarla al del ERP. No se movió ni se modificó: queda a decisión del propietario.
