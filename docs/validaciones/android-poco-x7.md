# Validación Android · POCO X7

## Punto 0 · Registro y guardas

Revisado `ERRORES_Y_GUARDAS.md`: E-01 aplica a cambios de interfaz (ejecutar prueba de arranque y compilación); E-02 aplica si se modifica el adaptador SQL.js (ejecutar prueba de integridad referencial). La validación física en Android usa SQLite nativo, no demuestra por sí sola las guardas del navegador. Los mutantes se ejecutan con contadores aislados; sus saltos no cuentan como incidentes.

## Contexto y alcance

Proyecto independiente `gastos-movil-entorno`, rama `master`, referencia inicial `ae64da29021b49b22d103a18bcdcc05748cc07aa`. APK debug SHA-256 `c63545b3131dce136275c5f0ecfd953f832fbd63c21a091e3d189a86c73d9270`. Pruebas únicamente con datos sintéticos; no borrar ni desinstalar datos existentes. iOS queda fuera de esta ejecución.

El USB identifica Xiaomi POCO X7 con interfaz MTP. Inicialmente `adb devices -l` devuelve lista vacía; versión de Android todavía no verificada. Se solicitó habilitar y autorizar depuración USB. No se instalaron controladores ni se cambiaron configuraciones del equipo.

## Matriz inicial

T1 compra, T2 fotos, T3 reapertura, T4 Excel, T5 PDF, T6 respaldo, T7 corrupto, T8 sin internet, T9 idempotencia, T10 privacidad: **NOT RUN** en dispositivo hasta que esté reconocido y autorizado. No se ha instalado ni ejecutado el APK en el teléfono.

## Avance posterior

El propietario activó y autorizó la depuración. ADB reconoció `device`; `getprop` identifica POCO X7, modelo 24095PCADG, Android 16 (API 36), HyperOS OS3.0.305.0.WOOMIXM. No se encontró el paquete `io.necktral.gastos.entorno` instalado.

Se intentó `adb install -r` con el APK indicado; el teléfono devolvió `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`. La aplicación no quedó instalada y no se eliminó almacenamiento. Se solicitó habilitar «Instalar vía USB» o autorizar el diálogo en el dispositivo. T1–T10 continúan NOT RUN hasta que se pueda instalar y abrir la app.

El propietario indicó que habilitó «Instalar vía USB»; un segundo intento ADB devolvió la misma restricción. Se copió el APK debug a `Download/MisGastos-prueba-ae64da2.apk` sin sobrescribir archivos y se solicitó abrirlo mediante el instalador normal de Android. No se habilitaron permisos ni se instalaron fuentes desconocidas automáticamente.

## Instalación y arranque en dispositivo

El propietario instaló manualmente el APK desde Descargas. ADB confirma paquete `io.necktral.gastos.entorno`, versión 1.0 (versionCode 1); se abrió `.MainActivity` y la pantalla de registro se observó en el POCO. `run-as` identificó la base privada `databases/gastos_fase1SQLite.db`. Esto verifica instalación y creación de base, no los recorridos T1–T10.

`adb shell input text` devolvió `SecurityException: Injecting input events requires ... INJECT_EVENTS`; `uiautomator dump` no produjo jerarquía (exit 137). Se solicitó al propietario habilitar la opción de depuración USB para ajustes de seguridad o elegir realizar las acciones manualmente. No se modificaron permisos ni configuraciones de seguridad por nuestra cuenta.

El propietario indicó haber activado los ajustes de seguridad y reconectó USB. Una nueva prueba inocua de `adb shell input keyevent KEYCODE_SHIFT_LEFT` siguió devolviendo INJECT_EVENTS denegado. Se decidió continuar con interacción manual, sin cambiar otras opciones de seguridad. Se creó en Descargas `gastos-comprobante-sintetico.png` (imagen de prueba de 68 bytes, sin sobrescribir un archivo existente) y se solicitaron al propietario compra sintética, foto y selección de esa imagen. La ejecución permanece pendiente de su respuesta; T1–T10 no se consideran aprobados aún.

El propietario informó que guardó una compra y dos fotos. Se observó una compra que no coincide con los datos sintéticos solicitados; se desconoce si contiene información real. Se detuvieron las pruebas que podrían exponerla o reemplazarla, se eliminó la captura temporal propia y se consultó al propietario sin solicitar importes ni imágenes. No se accedió al contenido de la base ni a las fotos y no se ejecutó restauración. T1–T10 permanecen pendientes de verificación.

El propietario confirmó que la compra observada contiene información real. No se ejecutó restauración ni lectura del contenido de la base/fotos. Para aislar las pruebas se compiló desde `ae64da29021b49b22d103a18bcdcc05748cc07aa` una copia temporal que únicamente cambia el identificador Android a `io.necktral.gastos.entorno.pruebas` y el nombre visible a `Gastos - pruebas`; el código funcional es el mismo. APK SHA-256 `cee479753595d15ee75fd05a9fac7278ea53d874a0bf2faa809bd25e5e462f08`, firma debug verificada. Se copió a Descargas con nombre distinto y se solicitó instalación manual como aplicación separada. La instalación que contiene información real no se desinstala, reemplaza ni restaura.

El propietario informó ver la aplicación de pruebas, pero Android/ADB solo enumeró `io.necktral.gastos.entorno` y la actividad abierta pertenecía a la aplicación original. El segundo intento de instalar el APK aislado con ADB devolvió de nuevo `INSTALL_FAILED_USER_RESTRICTED`. A solicitud de abrir el APK aislado desde Descargas, el propietario informó que el instalador proponía actualizar una aplicación existente: se indicó no aceptar y se detuvo la operación. `aapt` identifica el APK original como `io.necktral.gastos.entorno` y el APK aislado como `io.necktral.gastos.entorno.pruebas`; la huella del archivo aislado en el teléfono coincide con la compilada. La discrepancia del instalador no está resuelta. No se ha restaurado, borrado ni actualizado la instalación con datos reales; validaciones T1–T10 siguen sin ejecutar en un entorno aislado confirmado.
