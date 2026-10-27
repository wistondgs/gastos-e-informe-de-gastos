# Ajuste de fluidez · primer recorrido

## 0. Registro y guardas

E-01 aplica: verificar prueba de arranque después de reorganizar interfaz. E-02 corresponde al adaptador SQLite de navegador, que no se modifica; las pruebas existentes de integridad se vuelven a ejecutar. Mutantes de `guardas.py` se ejecutan con contadores de prueba separados. La compra real del teléfono queda preservada: no instalar, actualizar ni restaurar en ese dispositivo durante este ajuste.

## Alcance

Ajustar la navegación y la presentación móvil del recorrido ya implementado, preservando la base, identificadores, exportaciones y servicios. La funcionalidad financiera de anticipos, crédito y préstamos no se simula y continúa pendiente de la fase correspondiente. Verificar que navegar no pierda los datos introducidos, que el registro continúe accesible y que las operaciones existentes sigan ejecutándose.

## Evidencia

- Navegación inferior: inicio, gestiones, registro, compras y respaldo. El registro presenta cuatro pasos y conserva el borrador al navegar mientras la app sigue abierta.
- Gestiones: crear con nombre y fecha, asociar compras, ver compras por gestión y terminar con fecha. La finalización no calcula ni liquida saldos en esta versión.
- Pruebas de navegador con datos sintéticos: crear gestión, registrar compra por pasos, terminar gestión, recargar y consultar sus compras; los registros previos sin gestión siguieron visibles.
- Pruebas automatizadas: 11 aprobadas, incluyendo migración desde SQLite v1 con compra y referencia de foto, rollback de una migración fallida y restauración de respaldos v1 con y sin foto. Se usa SQL.js y almacenamiento de prueba; la migración en Android/iOS real queda pendiente.
- E-03: el propietario corrigió una pregunta que confundía adelanto propio con préstamo genérico. Se documentaron sus ejemplos y se agregó la pregunta obligatoria de verificación en el punto 0 de la plantilla. Las guardas portátiles se comprobaron con contadores aislados: 11 resultados pasaron; no se contabilizan como uso real.
- El APK Android se compila para revisión, sin instalarlo en el teléfono con datos reales. La migración, cámara y copia de seguridad deben probarse en una instalación aislada confirmada antes de actualizar la aplicación real. La discrepancia del instalador de la copia aislada sigue pendiente.
- Fondos recibidos, adelantos propios, reembolsos, crédito comercial y sus saldos no están implementados en este ajuste. El plan y el roadmap siguen vigentes; el cierre visual de una gestión no constituye liquidación financiera.
- iOS no se compiló ni probó. No se tocó la aplicación ni los datos reales en el teléfono.

Compilación Android de este ajuste: `npm run android:sync` y `./gradlew :app:assembleDebug --no-daemon` completaron correctamente; APK debug SHA-256 `6a903b916ec09523f1aa038083936abb3e6fe2be69c2584b547294971a991478`. El APK anterior quedó preservado con SHA-256 `c63545b3131dce136275c5f0ecfd953f832fbd63c21a091e3d189a86c73d9270`. No se instaló ninguno en el POCO durante este ajuste.
