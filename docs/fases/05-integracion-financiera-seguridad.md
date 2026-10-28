# Ficha de fase · Integración funcional y seguridad

## 0. Errores y guardas aplicables

Se revisaron E-01 a E-10 en `ERRORES_Y_GUARDAS.md`. E-01: compilar la interfaz y ejecutar las pruebas de arranque; E-02: conservar las pruebas de claves foráneas tras exportar SQL.js; E-03: plan 02 §§3 y 5 y roadmap 03 A1–A4 especifican anticipos, fondos y crédito comercial; no sustituirlos por préstamos personales; E-04 y E-09: mantener las pruebas de informes y no declarar revisados nuevos PDF sin rasterizarlos; E-05: mutantes con `GUARDAS_CONTADORES=/tmp/gastos-fase-finanzas-20261028.json`, 11/11 pasaron; E-06 y E-07: no operar el teléfono; E-08: preservar APK fuera de la salida de Gradle; E-10: hacer que las pruebas de regresión lleguen a la propiedad que comprueban.

## 1. Mandato y alcance

Atender las funcionalidades pendientes de la auditoría por dependencias: fondos y compras, seguridad del dispositivo y firma discreta. Respetar los datos existentes, el paquete Android y el alcance local sin ERP. La modalidad de activación de seguridad se consulta al propietario.

## 2. Criterios y pruebas

Pruebas sintéticas de depósitos acumulados, pago desde fondo, aporte propio, crédito, conservación de compras previas e insuficiencia de saldo. Probar la integración a través de la API y verificar interfaz y compilación. La autenticación nativa requiere prueba aislada en dispositivo antes de declararse operativa.

## 3. Cierre

Primera unidad implementada, con cierre funcional pendiente de prueba de dispositivo: firma reducida al texto solicitado; personas y empresas, entradas sucesivas de dinero, saldos separados, compras con fondo, aporte propio o crédito, reembolsos, devoluciones y traslados conectados a la API. El bloqueo opcional utiliza autenticación del dispositivo para activarse, desactivarse y desbloquear; no cifra datos.

La ejecución `npm run check` terminó con 76 pruebas aprobadas, incluidas A1–A9 y nuevas pruebas sintéticas de 3 entradas, aporte propio, crédito, insuficiencia y activación/cancelación del bloqueo. La compilación Android de la variante `.pruebas` pasó y su manifiesto contiene permisos biométricos. No se instaló nada. Android nativo, iOS y el recorrido visual siguen pendientes: no hubo navegador ni emulador disponibles. El bloqueo debe verificarse en distintos dispositivos y no se afirma que los datos estén cifrados. No se preparó un PDF nuevo para inspección visual.

El propietario eligió el bloqueo opcional desde Ajustes. La interfaz todavía carece de reparto de ingresos entre gestiones, historial completo, pagos posteriores, anulaciones, editor de imágenes y otras capacidades de la auditoría: ver `docs/PENDIENTES_APLICACION.md` y auditoría. Los 11 mutantes pasaron en contadores aislados; no hay nuevos errores de método registrados en esta unidad. La guarda E-08 es preventiva por construcción; no se dispone de nuevos contadores reales de saltos. `npm audit --omit=dev` informó cero vulnerabilidades; `npm audit` informó una alta en Vite, dependencia de desarrollo, pendiente de revisión compatible.
