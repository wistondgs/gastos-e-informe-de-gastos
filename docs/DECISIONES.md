# Decisiones del proyecto

Solo decisiones respaldadas por instrucciones del propietario. Las fases y su avance no van aquí: están en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y en la [matriz](MATRIZ_FINALIZACION_V2.md).

**Fuente común:** el mandato de organización del repositorio del 2026-10-29, que las enumera. Donde una decisión ya constaba antes, se indica dónde.

## D1 · Aplicación autónoma

- **Fecha:** registrada el 2026-10-29; ya constaba en [`AGENTS.md`](../AGENTS.md) y en el [README](../README.md).
- **Decisión:** la aplicación no se mezcla con ERP V4.
- **Motivo:** es una herramienta personal sin servidor y con otro ciclo de vida.
- **Consecuencias:** no se importan reglas, nomenclaturas, guardas ni procedimientos del ERP.
- **Restricción:** el material del ERP que haya en el repositorio (ver [MAPA_TECNICO.md §9](MAPA_TECNICO.md#9-material-ajeno-al-proyecto)) no se aplica; retirarlo requiere autorización.

## D2 · Una sola fuente financiera

- **Fecha:** 2026-10-29.
- **Decisión:** se conservan el motor económico (`src/dominio/`), la API local (`src/api/`) y SQLite como única fuente del dinero.
- **Motivo:** los saldos se derivan de los movimientos registrados; una segunda fuente permitiría cifras divergentes.
- **Consecuencias:** la interfaz y las exportaciones leen de la API; no calculan ni guardan saldos propios.
- **Restricción:** ningún modo de interfaz futuro tendrá su propio almacenamiento financiero.

## D3 · Orden de ejecución

- **Fecha:** 2026-10-29.
- **Decisión:** primero la reparación económica (integridad e integración); después la interfaz.
- **Consecuencias:** no se empieza la fase de Modo Fácil y Estándar hasta cerrar la reparación económica.
- **Restricción:** ninguna de las dos está iniciada; cada una requiere autorización expresa.

## D4 · Dos modos posteriores

- **Fecha:** 2026-10-29.
- **Decisión:** después de la reparación habrá un Modo Fácil y un Modo Estándar.
- **Consecuencias:** comparten datos, API y contratos (D2); difieren solo en la presentación.
- **Restricción:** el diseño concreto de cada modo no está aprobado.

## D5 · OCR e IA

- **Fecha:** 2026-10-29; la matriz ya declaraba que no están implementados.
- **Decisión:** el OCR y la IA quedan fuera del alcance actual.

## D6 · Protección de datos

- **Fecha:** 2026-10-29; ya practicada en el [informe de validación Android](INFORME_VALIDACION_ANDROID_V2.md).
- **Decisión:** no se modifica ninguna instalación con registros reales sin autorización.
- **Consecuencias:** las pruebas usan la instalación aislada `io.necktral.gastos.entorno.pruebas` y datos sintéticos; las compilaciones, en copias aisladas (E-14).
- **Restricción:** al repositorio no se suben bases reales, respaldos, fotos personales, APK ni claves.
