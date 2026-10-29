# Pendientes de la aplicación

Anotaciones del propietario para revisar y desarrollar por fases. Registrar aquí un pendiente no significa que esté implementado ni aprobado un diseño definitivo.

> **Nota del 2026-10-29:** los «Estado actual» de abajo son anteriores a la matriz. El estado vigente de cada capacidad está en [`MATRIZ_FINALIZACION_V2.md`](MATRIZ_FINALIZACION_V2.md); el reparto entre gestiones, el historial, los pagos posteriores y las anulaciones figuran allí como conectados (contradicción C-2 en [`ESTADO_ACTUAL.md`](ESTADO_ACTUAL.md#8-contradicciones-registradas)).

## Efectivo asignado a una gestión

- Registrar quién entrega el efectivo, el importe y la moneda de una gestión.
- Al registrar una compra, indicar cuánto se pagó con ese efectivo y disminuir el saldo disponible. Mostrar cuánto se recibió, cuánto se gastó y cuánto queda.
- Contemplar cuando el responsable aporta dinero propio para completar una compra y el importe pendiente de reembolso, así como la devolución de dinero sobrante.
- Estado actual: se integraron en la interfaz el registro de personas y empresas, entradas de dinero aplicadas a una gestión, saldo por parte/gestión/moneda, pagos con fondo y aporte propio, crédito, reembolsos, devoluciones y traslados. La prueba en Android aislado está pendiente. Faltan el reparto de una entrada entre varias gestiones, el historial detallado de todos los movimientos, pagos posteriores, anulaciones y el resto de la auditoría; no se considera cerrada la integración financiera.

## Protección opcional de la aplicación

- Se agregó un ajuste opcional que solicita la autenticación del teléfono al activarlo, al desactivarlo y al abrir o volver a la aplicación. Usa el sistema del dispositivo y no guarda el PIN ni datos biométricos.
- El bloqueo controla el acceso a la interfaz; no cifra la base de datos, los archivos ni los respaldos. La validación real de huella, reconocimiento facial y PIN en Android e iOS permanece pendiente.

## Editor de imágenes de comprobantes

- Incorporar un paso cómodo para revisar y preparar las imágenes de facturas y comprobantes: girar, enderezar y recortar, con vista previa y posibilidad de restablecer.
- Conservar la imagen original; aplicar los ajustes a la presentación y a los anexos del informe. Revisar el recorte sugerido antes de aplicarlo.
- Estado actual: existen en la API ajustes de giro, enderezado, recorte y propuesta de recorte; falta la pantalla para utilizarlos en la aplicación móvil. La corrección automática de perspectiva y las mejoras de imagen no están confirmadas como implementadas y quedan por evaluar si se necesitan.
