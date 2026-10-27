# Dirección de obligaciones y saldos

Aclaración del propietario para la futura fase financiera de la aplicación de gastos. Complementa el plan 02, secciones 3 y 5, y el roadmap 03, sección 5. No autoriza por sí sola a comenzar una nueva fase ni modifica datos existentes.

## Identidad y dirección

Para cada obligación hay que identificar acreedor, deudor, beneficiario del saldo y responsable de liquidarlo. Son datos distintos de quién registra la operación y quién se beneficia de la compra. La aplicación debe mostrar si un saldo es por cobrar o por pagar desde la perspectiva de la persona consultada, sin ocultar al deudor real.

- Un préstamo hecho por una persona representa un importe a su favor, por cobrar al deudor. Un préstamo recibido representa un importe en su contra, por pagar al acreedor. Estos ejemplos aclaran la dirección; los préstamos personales independientes de una gestión siguen fuera de la beta.
- Un pago con fondos propios por un encargo reconocido puede originar un reembolso a favor de quien adelantó el dinero; solo por el importe reconocido y efectivamente pagado, menos reembolsos aplicados.
- En una compra a crédito, la deuda corresponde al deudor identificado frente al proveedor. Registrar la compra no crea por sí solo una cuenta por cobrar personal; un pago posterior no vuelve a crear la compra.
- El dinero recibido para compras es fondo en custodia, no ganancia ni automáticamente un préstamo. Sus usos, devoluciones y transferencias deben registrarse explícitamente.
- Los saldos de fondos en custodia, reembolsos por recibir y deudas con proveedores se muestran por separado, con responsable, empresa o persona, gestión y moneda. No se compensan sin movimiento explícito ni se mezclan córdobas con dólares.

## Casos de aceptación para la fase financiera

1. Adelanto propio reconocido de C$8,000 y reembolso de C$3,000: quedan C$5,000 a favor de quien pagó.
2. Compra a crédito de C$10,000 a nombre de un deudor identificado; pago de C$4,000: el proveedor conserva C$6,000 por cobrar a ese deudor y no aparece una compra duplicada. La compra impaga no genera automáticamente reembolso personal.
3. Anticipo de C$100,000 para compras y pagos de C$96,000 con ese fondo: quedan C$4,000 bajo custodia; no se muestran como ingreso ganado.
4. Ejemplos de dirección de préstamo: C$10,000 prestados a otra persona son por cobrar al deudor; C$10,000 recibidos como préstamo son por pagar al acreedor. La implementación de préstamos personales independientes no está incluida en la beta actual.
5. Ejecutar cada caso desde la perspectiva de las partes pertinentes y en ambas monedas por separado, sin crear saldos a favor o en contra de quien no sea parte de la obligación.

Si se pretende incorporar un préstamo personal independiente o si el tratamiento de un préstamo vinculado a una gestión no está definido por el mandato de esa fase, consultar al propietario antes de implementar o calcular esa obligación.

## Aclaración del propietario: los dos casos que llama «préstamo»

- **Adelanto propio en una gestión:** se reciben C$100,000 para comprar un producto de C$103,000 y quien hace el encargo aporta C$3,000 de su dinero. Los C$3,000 efectivamente aportados y reconocidos quedan por reembolsar a esa persona. No se transforma el anticipo recibido en una ganancia ni en un préstamo independiente.
- **Crédito de una casa comercial:** la casa comercial financia una compra al cliente identificado. La obligación pendiente corresponde a ese deudor frente a la casa comercial; debe reflejar sus pagos y saldo sin crear otra compra ni una cuenta por cobrar personal automática.

Estos son los casos del plan 02 y las pruebas A3 y A4 del roadmap 03. La palabra «préstamo» en la conversación debe entenderse en ese contexto; no introduce por sí sola préstamos personales independientes fuera del alcance de la beta.
