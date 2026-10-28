# Gastos y Rendiciones · V2 (en construcción)

Aplicación móvil independiente para registrar compras, comprobantes y el dinero de cada gestión, sin servidor, con SQLite y archivos privados. No conecta con el ERP. Está en desarrollo: **no está certificada para datos reales hasta pasar la Gate 5** (la actualización probada en Android).

- **La API local** (`src/api/`) es la única puerta a los datos: gestiones, compras, pagos, fondos, saldos, comprobantes, anexos, informes y respaldo. El contrato para quien diseña la interfaz está en [`docs/CONTRATOS_API.md`](docs/CONTRATOS_API.md).
- **Las finanzas:** cuatro saldos que nunca se compensan (custodia, por reembolsar, por regularizar y deuda con proveedores), derivados siempre de los movimientos. La matriz A1–A9 está en `tests/aceptacion-financiera.test.js`.
- **Los informes:** por gestión, varias gestiones, período, empresa o persona, y pendientes de comprobante. Ejecutivo o formal, Carta o A4. Cada emisión es una revisión inmutable con su huella; se regenera idéntica.
- **Los anexos:** giro, enderezado, recorte y división de facturas largas en tramos, sin tocar la foto original; dos comprobantes chicos por página.
- **El respaldo v4:** la base completa, las fotos y las copias privadas de los informes, con manifiesto de huellas. **No está cifrado.** Restaura también los respaldos v1 a v3.
- **El esquema 4** migra desde las bases 1, 2 y 3 sin perder compras, fotos ni identificadores. Ver `docs/fases/03-orden-ingenieria-v2.md`.

## Desarrollo

Requiere Node 22–24 y npm:

```sh
npm ci
npm run check
npm run dev
```

En Android/iOS se usa el plugin nativo SQLite y archivos privados. La vista de navegador para desarrollo usa SQLite mediante SQL.js y almacenamiento del navegador, con sus límites de espacio y aislamiento; no reemplaza la prueba móvil.

## Android: compilar y entregar

```sh
scripts/android/compilar.sh pruebas    # io.necktral.gastos.entorno.pruebas, «Prueba beta de gastos»
scripts/android/compilar.sh oficial    # io.necktral.gastos.entorno
scripts/android/entregar.sh <apk> PASO-B-instalar.apk
```

`compilar.sh` guarda cada APK en `~/.local/share/gastos-entorno/apk/`, con su versión, su commit y su huella (E-08). `entregar.sh` se niega si ya hay otro APK en Descargas (E-06) y verifica que el teléfono lo haya indexado (E-07).

iOS: `npm run ios:sync` prepara los recursos; compilar y probar requiere macOS y Xcode. No se validó.

## Respaldo

El ZIP lleva todas las tablas, las fotos originales y las copias privadas de los informes, con huellas SHA-256. Restaurar valida todo antes de reemplazar (también las reglas de dinero) y prepara los archivos aparte; si algo falla, el estado anterior queda intacto. **No está cifrado ni tiene contraseña:** guardarlo en un destino privado. La base en el teléfono está en el almacenamiento privado de la app, protegido por el cifrado del propio Android; la conexión SQLite es `no-encryption` y no se declara cifrada.

Errores y guardas del proyecto: `ERRORES_Y_GUARDAS.md`.
