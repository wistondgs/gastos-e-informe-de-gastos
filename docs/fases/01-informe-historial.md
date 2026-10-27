# Ajuste del informe y del historial

## 0. Registro y guardas

Revisados E-01, E-02 y E-03: verificar la pantalla mediante sus pruebas y compilar; conservar la prueba de integridad SQLite; al distinguir historial local de datos externos atender el plan, el roadmap y la aclaración del propietario. Mutantes de guardas con contadores aislados. No se modifica el teléfono ni sus datos reales. La foto de prueba se genera localmente.

## Alcance

Informe PDF de compras de una gestión, con fecha, identificación, listado, totales separados por moneda y opción de comprobantes; claridad sobre gestiones abiertas y terminadas y compras anteriores sin gestión. El PDF informa compras registradas, no calcula fondos, deuda o liquidación. La recuperación de datos de otras aplicaciones depende de conocer formato, fuente y permisos; no se asume que la app actual pueda leerlos.

## Evidencia

Pendiente de ejecución. Se distinguirán pruebas de servicios, interfaz, diseño del PDF y apertura en teléfono. No instalar sobre datos reales sin respaldo probado y validación aislada.

### Resultado verificado localmente

- Se añadió historial de gestiones abiertas y terminadas, acceso a sus compras y visibilidad de compras anteriores sin gestión. En navegador se revisó una gestión sintética terminada y sus compras.
- `pdfGestion` genera un PDF de compras de una sola gestión, con importes separados en C$ y US$, opción de fotos y advertencia de que no liquida fondos o créditos. Rechaza compras ajenas o duplicadas y fotos vinculadas a otra compra. `tests/informe-gestion.test.js` comprueba dos compras, dos monedas, factura con ceros y opciones de imagen. Un PDF sintético fue abierto con Poppler y sus dos páginas renderizadas visualmente, sin recortes observados en ese ejemplo.
- En Android el código intenta crear `Documentos/Registros de mis gastos` al guardar el primer informe, verifica su contenido y conserva un historial. Los PDF son documentos de la carpeta compartida del teléfono; no se envían a servicios ni otros sistemas automáticamente. El acceso de aplicaciones con permisos al almacenamiento compartido requiere cuidado. En la vista de navegador los archivos son de prueba y se almacenan en ese navegador. En iOS quedan dentro de la app hasta verificar una ruta apropiada sin exponer fotos.
- `tests/informes-locales.test.js` comprueba historial, no sobrescribir y fallo de verificación con almacenamiento simulado. No demuestra permisos, visibilidad de carpeta ni apertura real en Android. El respaldo actual incluye compras y fotos, no PDFs históricos; la app lo advierte.
- El propietario aclaró que no quiere importar ni integrar movimientos de otra aplicación durante esta beta. La carpeta y el historial son locales; no se incorporó integración.
- `npm run check` pasa en el entorno de desarrollo; los mutantes de guardas ejecutados con contadores aislados pasaron. E-04 registra el informe agrupado que faltaba y la prueba que lo protege.
- **No verificado en POCO ni iOS:** carpeta, generación o apertura del PDF físico, permisos y actualización de la app que contiene datos reales. No se ha modificado ni restaurado esa aplicación. La discrepancia al instalar la copia aislada sigue pendiente.

Validación final local: `npm run check`, 14 pruebas aprobadas; `npm run android:sync` y `./gradlew :app:assembleDebug --no-daemon`, compilación correcta. APK de desarrollo SHA-256 `5615c3567db8b47b23795250bab300a31dd7c4c7e507c289d97cfcf9773baa63`. No se instaló en el POCO; la app y datos reales permanecen sin cambios.
