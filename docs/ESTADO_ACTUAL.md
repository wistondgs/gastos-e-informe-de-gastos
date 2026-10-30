# Estado actual · Gastos e Informe de Gastos V2

## 0. Instantánea candidata del 2026-10-29 (vigente)

**Esta sección reemplaza a las §1–§10, que describen `63b26a4` y quedan como historia.** Los textos anteriores que dicen que la reparación económica o la fase 09 no empezaron **están desactualizados**: las dos avanzaron en local (ver [fase 08](fases/08-conciliacion-v2.md) y [fase 09](fases/09-interfaz-guiada.md)).

| Dato | Valor | Clase |
|---|---|---|
| Origen | Trabajo local sin commit de `master` (`63b26a4`), copiado sobre la rama documental del PR #1 (`cb1e0b0`) | — |
| Esquema SQLite | `VERSION_ESQUEMA = 8` ([`src/datos/base.js`](../src/datos/base.js)); 17 tablas, entre ellas `atribuciones_regularizacion` y `regularizaciones` | VERIFICADO EN CÓDIGO |
| Pruebas | `npm run check` en una copia aislada de esta instantánea: lint, formato, **171 de 171 pruebas**, 0 fallos, compilación web correcta | PROBADO |
| Referencias anteriores | «165», «169» y «167 pruebas» aparecen en las fichas; correspondían a estados intermedios | REPORTADO; superado |
| Android nativo | Sin ejecución verificable de esta versión | PENDIENTE (G5) |

### Gates (numeración oficial G1–G5)

G1 Finanzas, G2 Funcionalidad, G3 Documentos y G4 Persistencia: **parciales**. G5 Android: **pendiente**. Ninguna aprobada (detalle en la [matriz](MATRIZ_FINALIZACION_V2.md)).

### Plan frente a implementación

Plan: [`02_Plan_Objetivo_Aplicacion.docx`](mandatos/02_Plan_Objetivo_Aplicacion.docx) y [`03_Roadmap_Fases_Aceptacion.docx`](mandatos/03_Roadmap_Fases_Aceptacion.docx). Los modos Fácil y Estándar vienen de [D4](DECISIONES.md), no del plan.

| Área | Exigencia | Código | Evidencia | Pendiente |
|---|---|---|---|---|
| Recepción de fondos y entregas sucesivas | Plan §3 y §5; A5: una entrada repartida entre gestiones | `fondos.recibir`, `fondos.aplicar`, `fondos.recepciones` | A5; `caja-guiada` (dos entregas por separado) | Android |
| Compras y comprobantes | Plan §3 y §4; roadmap §3 y §4 | `compras.*`, `comprobantes.*`, `anexos.*`, cámara (`salida-camara.js`), recorte (`recorte.js`) | `api`, `correccion-compra`, `salida-camara`, `recorte-interfaz` | Cámara nativa y factura larga en el teléfono |
| Aportes propios y reembolsos | Plan §5; A1 y A3 | `pagos.registrar` con `origen: propio`; aplicación con `destino: reembolso`, también sin gestión (esquema 7) | A1, A3, `economia-integridad` | Android |
| Saldos y conciliación | Plan §5: tres saldos separados, nunca un neto | `calcularSaldos`, `estadoCuentas`, `liquidacion`; regularizaciones (`regularizaciones.atribuir`, `liquidar`, `anular`) | A1–A9, `conciliacion-v2`, `regularizaciones`, `integridad-c1` | G1 parcial: falta la regresión de todos los escenarios |
| SQLite y recuperación | Plan §8; roadmap §6 | Migraciones hasta la 8; respaldo formato 4; respaldo automático de Android desactivado (`data_extraction_rules.xml`) | `gestion`, `informes-revision`, `android-privacidad`, A9 | Restauración y actualización nativas (G4, G5); las versiones anteriores no abren una base 8 |
| Modo Fácil | D4 | `src/interfaz/guiada/` (Inicio, gasto, recibir, informe, «Ver mi caja»), importado en `App.vue` | `interfaz-guiada` (26 pruebas), recorridos sintéticos en navegador | Gestiones y respaldo guiados; repartir un gasto entre partes desde el asistente |
| Modo Estándar | D4 | Pantallas clásicas de `App.vue`, con un cambio de modo identificado | `arranque`; recorridos parciales en navegador | Reorganizar las secciones estándar (G2) |
| Informes con y sin fotografías | Plan §8; roadmap §6 | Opción `incluirFotos` ([`dominio/informe.js`](../src/dominio/informe.js)); PDF y Excel por destinatario sin el total de compras compartidas (E-22) | `informe-presentacion`, `informe-profesional`; PDF y Excel sintéticos revisados (fase 09) | Revisión visual de todos los alcances desde la interfaz (G3) |
| Libro de caja detallado | No está en el plan 02/03; lo más cercano es la conciliación por gestión del plan §5 | «Ver mi caja» lista entregas y movimientos de una gestión a partir de su historial | `caja-guiada` | No se encontró un libro con saldo corrido línea a línea; el requisito debe precisarse |
| Pruebas y compatibilidad Android | Roadmap §3 y §6 | Guiones `compilar.sh`, `identidad-fuente.sh`, `prueba-actualizacion.sh` | `guiones-android`, `android-privacidad`; APK de la fase 08 compilada en una copia aislada | **G5: ninguna ejecución nativa verificable de esta versión** |

### Qué no incluye la instantánea

PDF, Excel, PNG, `.tar` y `.patch` de `docs/evidencia/` (solo se publican sus textos), el archivo `GR-63B343E6-R01.xlsx`, `.claude/`, `node_modules/`, `dist/`, `apk/` y la Skill del ERP de `.agents/` (que ya estaba en GitHub y no se tocó).

---


Resumen verificable para cualquier agente que llegue al proyecto. La referencia de aceptación es la [matriz de finalización](MATRIZ_FINALIZACION_V2.md); este documento solo resume y dice de dónde sale cada dato.

**Clasificación usada:** **VERIFICADO EN CÓDIGO** (leído en el SHA indicado) · **PROBADO** (ejecutado, con fuente) · **REPORTADO SIN VERIFICAR** (lo afirma un informe, no se comprobó en este SHA) · **PENDIENTE**.

## 1. Procedencia

| Dato | Valor |
|---|---|
| Fecha de comprobación | 2026-10-29 |
| Repositorio | `wistondgs/gastos-e-informe-de-gastos` (privado) |
| Rama y SHA inspeccionados | `master` = `origin/master` = `63b26a4d15246073348e8c69f6f2ff9bfa72dec3` |
| Versión de la aplicación | `2.0.0-alfa.1` (`package.json`) — VERIFICADO EN CÓDIGO |
| Esquema SQLite | `VERSION_ESQUEMA = 5` ([`src/datos/base.js`](../src/datos/base.js)) — VERIFICADO EN CÓDIGO |
| Formato de respaldo | versión 4; restaura también 1 a 3 ([`src/datos/respaldo.js`](../src/datos/respaldo.js)) — VERIFICADO EN CÓDIGO |

## 2. Diferencia entre lo publicado y el trabajo local

**Lo publicado en GitHub no es todo lo que existe.** En la máquina del propietario, `master` tiene trabajo sin commit (fase 08, interfaz guiada), que **no forma parte de este SHA ni de esta documentación**:

- 25 archivos modificados (1227 líneas agregadas, 150 quitadas), entre ellos `src/api/index.js`, `src/dominio/finanzas.js`, `src/dominio/estado-cuentas.js`, `src/datos/base.js`, `src/datos/tablas.js`, las exportaciones, `App.vue` y varias pruebas.
- En ese árbol local `VERSION_ESQUEMA = 6`. **REPORTADO SIN VERIFICAR** como funcionamiento: solo se observó la constante.
- Un informe local sin publicar (`docs/entregas/INFORME_INTERFAZ_GUIADA_2026-10-28.md`) declara **126 de 126 pruebas**. **REPORTADO SIN VERIFICAR**: esas pruebas no existen en el SHA publicado y no hay evidencia publicada de su ejecución.
- También hay sin seguimiento `android/app/src/main/res/xml/data_extraction_rules.xml`, una carpeta `.claude/` y un archivo `GR-63B343E6-R01.xlsx` cuyo contenido no se revisó (podría ser un informe con datos reales: no debe subirse sin revisarlo).

Quien trabaje desde GitHub debe partir de `63b26a4` y no suponer el estado local.

## 3. Objetivo y fases

- **Objetivo activo:** integridad e integración económica (reparación económica). **PENDIENTE de iniciar**; esta organización documental no la inicia.
- **Siguiente fase reservada:** Modo Fácil y Estándar, después de la reparación económica ([D3 y D4](DECISIONES.md)).
- **V2 no está cerrada.** Las cinco gates de la matriz siguen pendientes.

## 4. Pruebas

| Afirmación | Clase | Fuente |
|---|---|---|
| 101 pruebas, 101 aprobadas, 0 fallos en `63b26a4` (`node --test tests/*.test.js`) | **PROBADO** | Ejecutado el 2026-10-29 en una copia aislada de `63b26a4`, con el mismo `package-lock.json`. Solo pruebas: no se corrieron lint, formato ni compilación en esa ejecución |
| `npm run check` completo (lint, formato, pruebas, compilación) con 101 pruebas | **REPORTADO** con evidencia publicada | [`docs/evidencia/validacion-android-v2/check.txt`](evidencia/validacion-android-v2/check.txt) (sobre `6badd62`) |
| A1–A9 aprobados | **PROBADO** (dentro de las 101) | [`tests/aceptacion-financiera.test.js`](../tests/aceptacion-financiera.test.js) |
| Concurrencia e idempotencia C1-01 a C1-03 | **PROBADO** (dentro de las 101) | [`tests/integridad-c1.test.js`](../tests/integridad-c1.test.js) |
| Funcionamiento en Android nativo | **PENDIENTE** | [Informe de validación Android](INFORME_VALIDACION_ANDROID_V2.md): BLOCK, sin dispositivo |
| 126 pruebas | **REPORTADO SIN VERIFICAR** | Solo en el árbol local (ver §2) |

Todas las pruebas usan SQL.js y datos sintéticos; ninguna ejecuta el SQLite nativo de Android.

## 5. Gates

Numeración oficial: **G1–G5 de la [matriz](MATRIZ_FINALIZACION_V2.md#gates-de-aceptación)**. **G1 Finanzas, G2 Funcionalidad, G3 Documentos, G4 Persistencia y G5 Android: todas pendientes.** Ninguna cerrada.

La [ficha 03](fases/03-orden-ingenieria-v2.md) usa otra numeración (Gate 1 Datos … Gate 5 Android), que queda como histórica (C-3).

## 6. Bloqueadores reales

1. **Sin validación Android.** Ningún flujo se ejecutó en el teléfono con la versión actual (G5).
2. **Cortes históricos incompletos.** Datos anteriores a los eventos fechados no permiten reconstruir algunos cortes; un reparto reemplazado sin fecha suficiente se rechaza (`tests/informe-corte-historico.test.js`). VERIFICADO EN CÓDIGO como límite declarado.
3. **Trabajo local sin publicar** (§2): la próxima fase depende de decidir qué hacer con él.

## 7. Riesgos críticos

- **Datos reales:** hay instalaciones con registros reales. Ninguna prueba ni compilación debe tocarlas ([D6](DECISIONES.md)). Probar solo en `io.necktral.gastos.entorno.pruebas` con datos sintéticos.
- **Respaldo sin cifrar:** el ZIP de respaldo no tiene contraseña; la conexión SQLite es `no-encryption`. VERIFICADO EN CÓDIGO.
- **La protección de dispositivo no cifra datos:** solo controla el acceso a la interfaz.
- **Divergencia de esquema:** el árbol local va por el esquema 6; una APK compilada desde el local migraría bases a un esquema que GitHub no contiene.

## 8. Contradicciones registradas

| # | Contradicción | Resolución |
|---|---|---|
| C-1 | El README decía «esquema 4»; el código publicado tiene `VERSION_ESQUEMA = 5` | Corregido en el README |
| C-2 | [`PENDIENTES_APLICACION.md`](PENDIENTES_APLICACION.md) dice que faltan el reparto entre gestiones, el historial, los pagos posteriores y las anulaciones; la matriz los marca «Conectado» con pruebas que existen (`flujo-reparto`, `historial-financiero`) | Se anotó en ese archivo que su estado es anterior y que manda la matriz |
| C-3 | Dos numeraciones de gates: ficha 03 (Datos, Finanzas, Documentos, Recuperación, Android) y matriz (Finanzas, Funcionalidad, Documentos, Persistencia, Android) | Resuelto (2026-10-29): la numeración oficial es G1–G5 de la matriz; la ficha 03 se conserva como histórica |
| C-4 | La [auditoría del 28-10](../Auditoria_exhaustiva_Gastos_e_Informe_V2_2026-10-28.md) dice que la interfaz no expone fondos ni anticipos; la matriz posterior los da por conectados | No es contradicción: la auditoría revisó una APK anterior (`3547c34`). Se conserva como histórica |
| C-6 | El README y el mapa decían que la interfaz solo accede a los datos por la API; `App.vue` lee y escribe ajustes directamente en el repositorio | Corregido en ambos ([MAPA_TECNICO.md §3.2](MAPA_TECNICO.md#32-accesos-de-la-interfaz-que-no-pasan-por-la-api)) |
| C-5 | 101 pruebas publicadas frente a 126 declaradas en local | Ver §2 |

## 9. Próxima decisión autorizada

Le corresponde al propietario:

1. Qué hacer con el trabajo local de la fase 08 (publicarlo en su propia rama, revisarlo o descartarlo).
2. Autorizar el inicio de la reparación económica.
3. Resolver la propuesta sobre la Skill ajena (ver [MAPA_TECNICO.md §9](MAPA_TECNICO.md#9-material-ajeno-al-proyecto)).

## 10. Qué no debe modificar el siguiente agente sin autorización

- El motor económico (`src/dominio/finanzas.js`, `estado-cuentas.js`, las operaciones financieras de `src/api/index.js`) y el esquema.
- Ninguna instalación Android con datos reales.
- El trabajo local sin commit del propietario.
- La evidencia histórica de `docs/evidencia/` y las fichas de `docs/fases/`.
- `.agents/skills/necktral-phase-execution-zip/` (ver D1).

## 11. GitHub como espejo de consulta (D7)

GitHub es un espejo privado de lectura para auditorías de ChatGPT ([D7](DECISIONES.md#d7--github-solo-como-espejo-de-consulta)). El desarrollo sigue en local, y este documento describe solo lo publicado.

**Antes de una nueva auditoría,** se prepara una instantánea verificable del código que el propietario autorice publicar, y se indican:

1. el SHA publicado (`git rev-parse HEAD` igual a `git ls-remote origin <rama>`);
2. el `VERSION_ESQUEMA` de ese SHA (`src/datos/base.js`);
3. las pruebas ejecutadas sobre ese SHA en una copia aislada: comando, total, aprobadas y fecha.

Lo que no se publica: trabajo sin autorizar (como el de la fase 08, con el esquema 6), bases reales, respaldos, fotos personales, APK y credenciales.
