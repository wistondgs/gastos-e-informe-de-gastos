# Ficha de fase · Corrección de integridad C1

## 0. Errores y guardas aplicables

Se leyó el registro completo. E-02: comprobar claves foráneas y migración después de persistir SQL.js. E-03: el plan 02 §§3,5 y el roadmap 03 §5 distinguen custodia, reembolso y deuda comercial; no se consulta una regla ya definida. E-05: ejecutar mutantes con `GUARDAS_CONTADORES=/tmp/gastos-c1-guardas.json`, separado del contador real: 11/11 pasaron. E-06 y E-07: no operar ni entregar APK al teléfono. E-08: no guardar referencias en la salida de Gradle. E-09: no se modifica la composición de PDF. E-01 y E-04 se mantienen cubiertas por las pruebas existentes.

## 1. Mandato y alcance

Corregir concurrencia financiera, idempotencia y completitud de respaldo en los módulos autorizados. Datos sintéticos exclusivamente; sin operaciones sobre el POCO ni cambios visuales o ERP.

## 2. Criterios y pruebas

Las pruebas de regresión deben demostrar primero los defectos existentes; luego verificar que una operación competitiva prevalece, que un identificador distinto en contenido provoca conflicto y que faltas o alteraciones impiden respaldar o restaurar. Ejecutar A1–A9 y `npm run check`. Android nativo queda pendiente si no existe dispositivo aislado.

## 3. Cierre

Las pruebas iniciales detectaron los tres defectos: `docs/evidencia/integridad-c1/pruebas-antes.txt`. La batería específica cubre competencia por custodia y recepción, dos conexiones SQL.js, reintentos y conflictos, y archivos privados ausentes o alterados. A1–A9, migraciones, respaldo y `npm run check` pasan; la evidencia consolidada queda en `docs/evidencia/integridad-c1/check.txt`. El control `integrity_check` devuelve `ok` y `foreign_key_check` no encuentra errores en la prueba sintética.

La lectura y validación financieras se realizan bajo una transacción SQLite, con cola por conexión; en navegador se usa además Web Locks entre ventanas y se recarga la base antes de operar. Las huellas de solicitudes se guardan en eventos de auditoría sin cambiar el esquema. Los identificadores históricos sin huella se rechazan explícitamente en reintentos porque no se puede demostrar su identidad completa. Los respaldos parciales no se ofrecen; los informes antiguos de motor 1 sin copia privada se distinguen de informes actuales sin copia.

Los once mutantes pasaron con contadores aislados; sus saltos no representan saltos reales. Las guardas E-01 a E-10 fueron revisadas; E-08 es preventiva por construcción. Se documentó E-10 por el error de preparación de una prueba, corregido antes de registrar su resultado. No se utilizaron los contadores reales para la mutación. No hay emulador Android disponible; queda pendiente comprobar SQLite nativo en entorno aislado. No se realizaron operaciones en el POCO. La compilación comprobada es la web; no se generó ni instaló un nuevo APK.
