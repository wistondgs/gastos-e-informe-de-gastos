# Matriz de avance · Finalización funcional V2

Esta matriz registra el estado del árbol de trabajo y no declara cerrada la V2. La prueba de interfaz real y Android nativo sigue pendiente.

| Capacidad | Código e interfaz | Evidencia y límites |
|---|---|---|
| Depósitos sucesivos y saldos | Conectado | A1–A9, flujo financiero; falta ejecución Android. |
| Una entrada distribuida entre gestiones y remanente | Conectado | `tests/flujo-reparto.test.js`; falta probar los controles en dispositivo. |
| Aplicaciones posteriores | Conectado | Prueba sintética de aplicación del remanente; falta Android. |
| Detalle e historial de gestión | Conectado parcialmente | `tests/historial-financiero.test.js`; los datos se obtienen de la API. Falta matriz completa de todos los detalles y referencias. |
| Crédito y pagos posteriores | Conectado | Prueba de C$15,000 con abonos de C$5,000 y C$3,000; falta Android. |
| Anular compras, pagos, entradas, aplicaciones y movimientos | Conectado | Servicios con motivo y pruebas del dominio; falta matriz visual y Android. |
| Corrección de compra | Parcial | Concepto, proveedor y factura dejan valores previos en auditoría; no permite cambios económicos ni reemplazo integral. |
| Regularización y reapertura | Conectado | Servicios existentes y escenarios A1–A9; falta validación del recorrido en dispositivo. |
| Asignación mixta a varias partes | Conectado | `tests/flujo-financiero.test.js` verifica reparto y pagos; falta validar interacción y errores en Android. |
| Compra sin gestión | Conectado | Permitida en el formulario; debe probarse en interfaz Android. |
| Editor de fotos | Parcial | Giro, enderezado y recorte manual con vista previa; parámetros de borrador o foto guardada persisten. La prueba sintética comprueba respaldo e inmutabilidad del original; falta comprobar la geometría visual en dispositivo y factura larga. |
| Comprobante posterior | Conectado | Permite seleccionar tipo e imágenes; falta cámara posterior y prueba Android. |
| PDF individual | Conectado | Aplica transformaciones sin alterar originales; un comprobante sintético largo se rasterizó y revisó en cuatro páginas. Falta validación Android. |
| Informes de gestión, gestiones, período, parte y pendientes | Conectado | Cinco PDF sintéticos revisados visualmente; revisiones antiguas motor 2 se abren desde su copia privada. Falta recorrer controles y revisión integral de Excel. |
| Informe con comprobantes compartidos | Conectado | Inclusión opcional explícita; pruebas de aislamiento en API. Falta prueba de interfaz. |
| Atrás Android e historial de navegación | Implementación inicial | Listener configurado; no probado en Android. |
| Borrador de compra y fotos | Conectado | `tests/borradores.test.js` usa IndexedDB sintético; falta recuperación tras cierre forzado en teléfono y borradores de otras operaciones. |
| Personas y empresas | Crear, listar y desactivar conectados | Falta catálogo completo de roles y edición. |
| Configuración de cuentas, medios, categorías y destinos | Pendiente | No hay esquema ni pantallas completas. |
| Seguridad de dispositivo | Implementación previa conservada | Activación opcional y pruebas con simulaciones; huella, rostro, PIN y regreso a la app pendientes en Android real. No cifra datos. |
| Respaldo y restauración | Conectado | Pruebas de integridad y recuperación sintética; falta restauración y actualización nativas aisladas. |
| Vite | Corregido | 6.4.1 → 6.4.5; `npm audit` informó 0 vulnerabilidades. |
| Android POCO / Samsung | Bloqueado para certificación | No se instaló ni actualizó ninguna aplicación ni se tocaron datos reales. |

No se implementaron OCR, IA, sincronización, backend ni integración ERP.
