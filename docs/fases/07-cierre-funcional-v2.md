# Ficha de fase · Cierre funcional V2

## 0. Errores y guardas aplicables

Se revisaron E-01 a E-13: E-01 exige comprobar arranque; E-02, claves foráneas después de exportar; E-03, consultar plan 02 §§3–6 y roadmap 03 A1–A9 antes de decisiones de negocio; E-04 y E-09, verificar informes completos y rasterizar ejemplos; E-05, ejecutar mutantes con contadores separados: `GUARDAS_CONTADORES=/tmp/gastos-cierre-v2-guardas.json`, 11/11 pasaron; E-06 y E-07, proteger datos del teléfono y no instalar sin verificar aislamiento; E-08, conservar APK fuera de la salida de Gradle; E-10 y E-13, asegurar que las pruebas negativas detecten la propiedad; E-11, mostrar éxitos; E-12, distinguir entidad e identificador en historial.

## 1. Mandato y alcance

Completar catálogos, edición de partes y roles, correcciones económicas trazables, historial navegable y cámara posterior, con migraciones y pruebas compatibles. Mantener el árbol previo, aplicaciones y datos reales; sin ERP, OCR ni red. SHA inicial `3547c34c1be1e2e743f0a5cdd3b05b4e71562ab0`, rama `master` con cambios previos sin commit.

## 2. Criterios y pruebas

Probar migración de esquema y respaldo histórico, invariantes financieras, operaciones reversibles, historial, cámara y guardas. Mantener A1–A9, `npm run check` y evaluación Android aislada; no declarar revisada la presentación sin evidencia visual.

## 3. Cierre

Trabajo parcial entregado; G1–G5 permanecen pendientes según la matriz existente. Se incorporaron catálogos, edición de nombres y roles derivados, correcciones económicas, navegación en historial y cámara posterior; los controles nativos siguen sin validación.

Los cortes históricos excluyen sustituciones, anexos y aplicaciones posteriores cuando existen eventos fechados; también reconstruyen ajustes y nombres anteriores. Las operaciones antiguas pueden carecer de eventos suficientes, y un reparto posterior no reconstruible se rechaza. No se garantiza la reconstrucción de todos los registros históricos.

Durante la ejecución apareció el commit `05b428d8c061b8ce6a3382c152dd61451bb6e993`, que incluye el árbol previo; los cambios posteriores quedan sin commit. No se modificaron datos del teléfono ni se instaló una APK. Las pruebas Android, el cierre forzado y la actualización conservando datos están pendientes.
