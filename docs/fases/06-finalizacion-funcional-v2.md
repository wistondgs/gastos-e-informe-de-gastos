# Ficha de ejecución · Finalización funcional V2

## 0. Errores y guardas aplicables

Se revisaron E-01 a E-10 y las instrucciones del proyecto. E-01 y E-02: verificar arranque, compilación y claves foráneas; E-03: el plan 02 §§3–6 y el roadmap 03 A1–A9 definen anticipos, reembolsos, créditos comerciales y cierres separados; E-04 y E-09: verificar informes completos y rasterizar cada ejemplo; E-05: mutantes con `GUARDAS_CONTADORES=/tmp/gastos-integral-v2-mutantes.json`, 11/11 pasaron; E-06 y E-07: no modificar el teléfono ni su almacenamiento; E-08: preservar APK fuera de la salida; E-10: comprobar que los negativos lleguen al defecto. Durante la unidad se añadieron E-11 para los avisos de éxito, E-12 para identificar eventos por entidad e ID y E-13 para probar la transformación visible en PDF. No se trasladan guardas del ERP.

## 1. Inspección y alcance

SHA inicial `3547c34c1be1e2e743f0a5cdd3b05b4e71562ab0`, rama `master`, con cambios anteriores sin commit que se conservan. Existen motor financiero, operaciones de fondos, crédito, saldos, informes, respaldo y ajustes de imágenes; hay integración parcial de fondos y seguridad en la interfaz. Faltan distribución de entradas, historial, pagos posteriores y varias acciones de compra; el editor y varios alcances de informes solo están en la API. Android nativo, seguridad y recorrido visual carecen de verificación aislada. Se aplica el mandato integral, sin OCR, red ni ERP.

## 2. Criterios y pruebas

Cada unidad requiere pruebas de regresión, compuerta correspondiente y evidencia; A1–A9 y pruebas de integridad no deben retroceder. No probar con datos reales. PDF exige inspección visual de cada página; Android requiere dispositivo aislado y firma/paquete verificados.

## 3. Cierre por unidades

Unidad financiera: se conectaron reparto entre gestiones, remanente, aplicación posterior, reparto mixto entre partes, detalle e historial, abonos, clasificación, anulación de operaciones, reapertura y corrección descriptiva con evento de antes/después. A1–A9 y pruebas nuevas de reparto, crédito y colisión de IDs pasan. Falta validación de la interfaz en Android, por lo que Gate 1 no se cierra.

Unidad de imágenes: se agregó editor en borrador y en compra guardada, con giro, enderezado, recorte y previsualización, más comprobantes posteriores. La prueba sintética verifica parámetros, original y restauración. El PDF individual aplica las transformaciones; se rasterizó y revisó un comprobante sintético largo en cuatro páginas. La geometría visual en dispositivo permanece pendiente; Gate 2 no se cierra.

Unidad de recorridos: se permite compra sin gestión, se conectaron pantallas adicionales, atrás Android y borradores IndexedDB de compras y fotos. Pruebas de almacenamiento sintético aprobadas; falta matriz de navegación y recuperación en dispositivo. Gate 3 no se cierra.

Unidad de informes: se conectaron vista previa e informes de varios alcances. Se generaron cinco PDF y cinco Excel sintéticos en `docs/evidencia/v2-ejemplos/`; nueve páginas PDF rasterizadas y revisadas. El resumen del Excel de varias gestiones se corrigió tras detectarse texto cortado y se revisó de nuevo. Falta revisión visual de todas las hojas. Motor PDF actualizado de 2 a 3; las revisiones anteriores abren desde su copia privada. Gate 4 no se cierra.

Unidad de seguridad y respaldo: se conservó el bloqueo opcional sin atribuirle cifrado; Vite 6.4.1 se actualizó a 6.4.5, y `npm audit` informó cero vulnerabilidades. Las pruebas existentes de respaldo/restauración y la nueva prueba de foto ajustada pasan. Faltan catálogos, prueba de bloqueo y restauración nativa; Gate 5 no se cierra.

`npm run check`: 86 pruebas aprobadas, lint, formato y compilación web. Mutantes de guardas: 11/11 con contador aislado. E-11 corrige la eliminación accidental de aviso de éxito; E-12 corrige el historial que mezclaba entidades con igual ID; E-13 sustituye una comparación inválida de huellas PDF por una prueba de la matriz del dibujo. E-08 preventiva por construcción. Se desconoce el historial de silencios reales; los mutantes no lo representan. `adb devices` no encontró dispositivos y no hay emulador instalado; no se efectuaron operaciones con el teléfono. La matriz `docs/MATRIZ_FINALIZACION_V2.md` identifica las capacidades pendientes.

Ante la consulta del propietario se revisaron los dos estilos ya existentes, Ejecutivo y Formal: ambos están disponibles en los informes por gestión y en los informes de otros alcances. Los PDF sintéticos `estilo-ejecutivo.pdf` y `estilo-formal.pdf` se rasterizaron y revisaron en sus cuatro páginas. La exportación individual de una compra utiliza su propio formato y todavía no ofrece selección de estilos.

APK de prueba compilado: `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-3547c34-692bf32f.apk`, paquete `io.necktral.gastos.entorno.pruebas`, versión `2.0.0-alfa.1`, SHA-256 `692bf32fe767ae34bc615ff8ac3da7c55e01f352ce68a0e5639433797644472b`. La firma verificada es Android Debug con certificado SHA-256 `20d4b995519447036cb9f2fa02ed1f9dd8c8e642e83c6e2cc67acc769c3b2b23`; no se comparó contra ninguna instalación del teléfono. El SHA del nombre identifica el commit base, mientras que el APK incluye cambios sin commit.
