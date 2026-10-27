# Fase 01 · Primer recorrido funcional

## 0. Errores y guardas aplicables

Se revisó `ERRORES_Y_GUARDAS.md`: contiene únicamente una plantilla, sin entradas reales; por eso ninguna entrada se aplica todavía. Las guardas portátiles se ejecutan con contadores de prueba separados. No se incorpora experiencia del ERP ni de otro proyecto. La ficha se completa con resultados al cierre.

## 1. Mandato y alcance

Autorizado: compra manual, comprobantes privados, SQLite, reapertura, Excel y PDF, respaldo y restauración, sin servidor. No integra ERP, OCR ni sincronización. Una compra es el único objeto financiero de esta fase; pagos, rendiciones múltiples y catálogos completos quedan para fases posteriores. El documento 04 no está disponible; se aplican las órdenes explícitas y los documentos 02 y 03.

## 2. Criterios y pruebas

- Moneda y centavos exactos, fecha de compra/registro y documento textual; pruebas de valores válidos e inválidos.
- Dos imágenes vinculadas a una sola compra; repetición de la misma operación no crea otra compra; persistencia SQLite y reapertura.
- Excel XLSX con y sin imágenes y PDF con comprobantes; abrir y examinar artefactos generados por las bibliotecas.
- Respaldo con datos, fotos, versión y huellas; recuperación transaccional y validación previa; imagen ausente, archivo alterado y fallo de escritura no alteran datos anteriores.
- Android: compilar; instalar y probar dispositivo solo si existe autorizado. iOS: proyecto compatible, pruebas reales pendientes sin macOS y Xcode.
- Pruebas de las pruebas: casos alterados (importe, duplicado, imagen y respaldo corrupto) deben fallar antes de considerar válido el criterio.

## 3. Cierre

Pendiente de implementación y verificación. Registrar evidencia, guardas consultadas y errores reales al concluir.

### Evidencia y resultado

- `npm run check`: 7 pruebas aprobadas. Incluyen C$1,250.75, `0000123`, compra sin factura, dos fotos para una compra, segunda ejecución con igual ID, reapertura de SQLite de prueba, Excel con/sin fotos, PDF, respaldo, modificación de datos e imagen dentro del ZIP, falla de almacenamiento y falla transaccional con rollback. Se usa SQL.js real y un almacén de archivos de prueba; no es una prueba del plugin nativo ni de cámara.
- El mutante de `foreign_keys` se observó desactivado tras `Database.export()` antes de la corrección; se añadió una prueba que exige su activación y el rechazo de foto huérfana. La prueba antigua de arranque se observó fallar al sustituirse la pantalla vacía. Ambos errores están en `ERRORES_Y_GUARDAS.md`.
- Generados archivos sintéticos independientes en `/tmp/gastos-fase-evidencia/`: `unzip -t` aceptó el XLSX; PDF leído con `pdfinfo` y `pdftotext` mostró 2 páginas, importe y factura con ceros. Son archivos temporales, no respaldos del usuario.
- En navegador Chrome: guardar compra sintética, recargar y ver C$1,250.75 y `0000123`. El cargador de archivos del navegador de automatización no permitió suministrar fotos por una configuración de la extensión; las imágenes se probaron en servicios, no mediante interfaz real.
- `npm run android:sync` y `./gradlew :app:assembleDebug --no-daemon`: BUILD SUCCESSFUL. APK debug `android/app/build/outputs/apk/debug/app-debug.apk`, SHA-256 `c63545b3131dce136275c5f0ecfd953f832fbd63c21a091e3d189a86c73d9270`. Firma debug verificada. `adb devices` no encontró teléfonos; instalación, cámara, abrir Excel/PDF y restauración en Android no verificados.
- `npx cap sync ios`: recursos y plugins copiados; CocoaPods y Xcode no están disponibles en Linux. Compilación, instalación y pruebas iOS no ejecutadas.
- `npm audit --omit=dev`: 2 hallazgos moderados asociados a ExcelJS/uuid; 0 altos o críticos. Vite advierte dependencias externas del navegador y tamaño del bundle. El proyecto requiere revisión de dependencias antes de producción.
- Las guardas portátiles se consultaron en mutantes con contadores aislados: 11 comprobaciones pasaron, las fallas deliberadas no son saltos de producción. En ejecución real de guardas no se registraron consultas ni saltos; no confundir ausencia de medición con ausencia de errores. E-01 y E-02 tienen guarda mecánica y mutante observado. Sin unidades anteriores medidas para aplicar poda.

### Límites y estado

**No se cierra la fase:** faltan la ejecución real de extremo a extremo y apertura de archivos en Android, y el recorrido completo en iOS. El respaldo es ZIP con representación lógica de la base, fotos, versión y SHA-256; se comparte desde la caché privada para que el usuario lo guarde. No está cifrado con contraseña y no aporta autenticidad criptográfica. El sandbox del sistema operativo protege los archivos privados mientras permanecen en la aplicación; una copia compartida queda bajo control del destino elegido. No se implementó cifrado portátil, huella o recuperación entre dispositivos. La restauración validada reemplaza todos los registros existentes tras confirmación. Faltan pruebas de cortes reales de energía y uso con imágenes grandes en dispositivo.
