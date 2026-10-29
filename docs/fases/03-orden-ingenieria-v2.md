# Ficha de fase · Orden de ingeniería V2 (funcionalidad, datos, finanzas, documentos y respaldo)

> **Nota del 2026-10-29:** ficha histórica. Su numeración de gates es histórica: la oficial es G1–G5 de [`MATRIZ_FINALIZACION_V2.md`](../MATRIZ_FINALIZACION_V2.md#gates-de-aceptación).

## 0. Errores y guardas aplicables

- **Entradas revisadas:** E-01 a E-05 al empezar; E-06 a E-09 nacieron en esta fase.
- **Cómo se cumple cada guarda:**
  - **E-01:** el arranque y la compilación corren en `npm run check`. La pantalla solo cambió en su cableado: los informes y el respaldo pasan por la API.
  - **E-02:** todas las pruebas nuevas usan el adaptador SQL.js real, y las claves foráneas siguen probadas.
  - **E-03:** las reglas de dinero salen del plan 02 (§3 a §6), de la matriz A1–A9 del roadmap 03 (§5) y de `docs/requisitos/direccion-obligaciones.md`. **No quedó una duda de negocio sin resolver por los documentos.** Las tres decisiones técnicas propias están en §3.
  - **E-04:** el informe se prueba con dos monedas, una compra ajena, una duplicada, el corte, los anexos, los cinco tipos y la privacidad por destinatario.
  - **E-05:** los mutantes de `guardas.py` corren con contadores aislados.
- **El documento 04** no está disponible; rigen la orden del 27-10 y los documentos 02 y 03.

## 1. Mandato y alcance

- **Mandato:** la «Orden de ingeniería V2» del 27-10.
  - Paquetes I a VII: gestiones, núcleo financiero, informes, PDF y anexos, documentos y respaldo, migraciones con Android, y aceptación A1–A9.
  - Los contratos para el agente visual.
- **Fuera del alcance, por orden expresa:** el diseño de la interfaz. Lo hace Claude Design sobre `docs/CONTRATOS_API.md`.
  - Las pantallas actuales solo se cablearon a la API.
  - Quedan fuera también el OCR, la IA, el servidor, la sincronización, la banca, el ERP y los préstamos personales independientes.
- **El POCO X7:** desde las 17:29 del 27-10 no tiene ninguna app de gastos instalada, ni datos reales; ver E-06. Las pruebas usan solo la variante aislada `io.necktral.gastos.entorno.pruebas` («Prueba beta de gastos»), con autorización del propietario.

## 2. Criterios y pruebas

| Capacidad | Criterio | Prueba |
|---|---|---|
| Gate 1 · Datos | Las migraciones 1→4, 2→4 y 3→4 conservan compras, ceros, importes, fotos, gestiones e informes. Si la 4 falla, revierte. Una base más nueva se rechaza | `tests/informes-revision.test.js`, `tests/gestion.test.js` |
| Gate 2 · Finanzas | A1 a A9, más las reglas R1 a R9 (fondos ajenos, por regularizar, crédito con deudor, sin detalle, repartos, traslados, anulaciones) | `tests/aceptacion-financiera.test.js`, `tests/api.test.js` |
| Gate 3 · Documentos | Cinco tipos de informe. Por destinatario, solo lo suyo. Anexos girados, recortados, en tramos y de a dos. Excel con sus hojas. Revisiones inmutables y regenerables | `tests/informe-profesional.test.js`, `tests/anexos.test.js`, `tests/api.test.js`, más la revisión visual en `docs/evidencia/informe/` |
| Gate 4 · Recuperación | El respaldo v4 con PDF sin repetir. La restauración valida todo, también las finanzas, y no toca nada si falla. Restaurar dos veces no deja huérfanos. Compatible con v1 a v3 | `tests/informes-revision.test.js`, `tests/recorrido.test.js`, A9 |
| Gate 5 · Android | PASO-A (`ae64da2`, esquema 1) con datos sintéticos → PASO-B (esta versión, esquema 4), en la instalación aislada, sin perder datos | §3, «Android» |
| Guardas del banco | E-06 y E-07, con su prueba y su mutante | `tests/guiones-android.test.js` |

- **Las pruebas de las pruebas:** 39 mutantes del código nuevo (finanzas, API, informes, respaldo, anexos, PDF y migración).
  - En la primera pasada quedaron 6 vivos y 1 que no aplicaba. Eran huecos reales: el reembolso excedido, el corte de los saldos, los saldos ajenos por destinatario y dos casos de recorte. Se cerraron con pruebas nuevas.
  - **Resultado: 39 de 39 detectados.** Las guardas E-06, E-07 y E-09 tienen además su propio mutante.
- **La revisión visual:** los tres PDF de ejemplo se rasterizaron página por página. Aparecieron y se corrigieron:
  - el párrafo contradictorio del informe por destinatario y las rayas que tachaban (E-09);
  - un giro mal elegido en el ejemplo (dato del ejemplo, no del motor).

## 3. Cierre

**Estado:** el código, las pruebas y la documentación están completos. **La Gate 5 sigue pendiente del teléfono.**

**Decisiones técnicas, sin consulta (lo técnico evidente):**
1. **Nada se borra.** Las correcciones anulan con fecha y motivo, y cada cambio de estado deja un evento. El reparto se reemplaza anulando el anterior.
2. **Los saldos se validan sobre el conjunto entero.** Antes de guardar cualquier movimiento, la API recalcula todos los saldos con el movimiento incluido. Así se cumple R4 sin reglas sueltas.
3. **Las compras viejas quedan «sin detalle»:** no inventan deudas ni reembolsos hasta que se clasifiquen una vez.
4. **Un pago propio** sobre una compra sin reparto no genera reembolso; queda como observación. Con varios destinos, el pago tiene que decir a cuál corresponde.
5. **Los fondos de una parte** no pagan el gasto de otra sin un traslado explícito. Si pagan un gasto personal, queda por regularizar.
6. **Los derivados de las fotos son parámetros,** no imágenes nuevas. La foto original no se toca, y el respaldo lleva los parámetros.
7. **Cada revisión guarda su modelo completo,** el motor del PDF es determinista y la copia privada es la referencia. Un cambio del motor obliga a emitir una revisión nueva: no se puede regenerar idéntica con otro motor.
8. **El respaldo es una copia lógica completa** de todas las tablas, no el archivo SQLite crudo: es portable entre Android e iOS. No está cifrado y lo declara (`cifrado: false`). No se agregó ninguna contraseña, porque requiere tu aprobación (orden §8).

**Pendientes:**
- La Gate 5 en Android.
- iOS, sin entorno Apple.
- Las pantallas nuevas, que van a Claude Design.
- El aviso de ExcelJS y sus dependencias (ver el informe).

### Android

**Los APK,** en `apk/` de la carpeta del proyecto, firmados con la misma clave de desarrollo:

| | Paquete | Versión | Esquema | SHA-256 |
|---|---|---|---|---|
| PASO-A | `io.necktral.gastos.entorno.pruebas` | 1.0 (código 1), de `ae64da2` | 1 | `76cd9ba00269297bcce0cf5d9aca2f00c22200491b536700fc201789af5fb5d3` |
| PASO-B | `io.necktral.gastos.entorno.pruebas` | 2.0.0-alfa.1 (código 2), de `02cdbe9` | 4 | `eaa0bfdc7c143c9723b7260795dcc7aa6872478a884533be60b60a5fa35ebde6` |

Mismo identificador, misma firma y código de versión superior: PASO-B actualiza a PASO-A sin borrar sus datos.

**Ensayo en la PC** (`scripts/android/sinteticos.mjs`):
- se cargaron 4 compras y 3 fotos sintéticas en la base vacía del esquema 1 y se migraron con el código real;
- la versión 4 conserva todas las filas, los ceros, los importes y las huellas de las fotos;
- si falta una foto, la verificación lo detecta;
- el guion se niega a cargar datos en una base que no está vacía.

**Procedimiento en el teléfono:**
1. Instalar PASO-A desde Descargas (`PASO-A-instalar-Gastos-pruebas.apk`), abrirla una vez y cerrarla.
2. `scripts/android/prueba-actualizacion.sh cargar <carpeta>`: carga los datos sintéticos por `run-as`, sin tocar la pantalla.
3. `… verificar <carpeta>`: la línea de base, en la versión 1.
4. Borrar PASO-A de Descargas. `scripts/android/entregar.sh <PASO-B> PASO-B-actualizar-Prueba-beta.apk`. El propietario la instala: el teléfono dice «Actualizar», y esta vez es lo correcto.
5. Abrirla una vez. `… verificar <carpeta>`: versión 4, las mismas filas y las mismas fotos.
6. En PASO-B: emitir un informe, crear un respaldo y restaurarlo.

**Estado:** el teléfono se desconectó antes del paso 1. La Gate 5 **no está ejecutada**.
