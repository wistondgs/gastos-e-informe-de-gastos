# Gastos e Informe de Gastos V2

Aplicación móvil de uso personal para registrar compras, comprobantes y el dinero de cada gestión, y emitir sus informes. Funciona sin servidor, con SQLite y archivos privados del dispositivo. Es autónoma: no conecta con el ERP ([D1](docs/DECISIONES.md)).

**Estado:** versión `2.0.0-alfa.1`, en desarrollo. **V2 no está cerrada** y no está certificada para datos reales: las cinco gates de la matriz siguen pendientes, Android incluido.

**GitHub** es un espejo privado de consulta ([D7](docs/DECISIONES.md#d7--github-solo-como-espejo-de-consulta)); el desarrollo sigue en local y puede ir por delante de lo publicado.

## Empezar aquí

| Documento | Para qué |
|---|---|
| [`docs/ESTADO_ACTUAL.md`](docs/ESTADO_ACTUAL.md) | SHA publicado, pruebas con su fuente, gates, bloqueadores y diferencia con el trabajo local |
| [`docs/MAPA_TECNICO.md`](docs/MAPA_TECNICO.md) | Dónde está cada componente, el flujo económico y qué prueba cubre cada invariante |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Decisiones del propietario (D1–D7) |
| [`docs/MATRIZ_FINALIZACION_V2.md`](docs/MATRIZ_FINALIZACION_V2.md) | Referencia de aceptación de la V2 |
| [`docs/CONTRATOS_API.md`](docs/CONTRATOS_API.md) | Contrato de la API local |
| [`ERRORES_Y_GUARDAS.md`](ERRORES_Y_GUARDAS.md), [`AGENTS.md`](AGENTS.md), [`PLANTILLA_FASE.md`](PLANTILLA_FASE.md) | Reglas de trabajo de cada fase |

## Arquitectura

- **La API local** (`src/api/`) es la puerta a los datos financieros (la interfaz guarda los ajustes del informe directamente en el repositorio; ver el [mapa técnico](docs/MAPA_TECNICO.md#32-accesos-de-la-interfaz-que-no-pasan-por-la-api)): gestiones, compras, pagos, fondos, saldos, comprobantes, anexos, informes y respaldo. El contrato para quien diseña la interfaz está en [`docs/CONTRATOS_API.md`](docs/CONTRATOS_API.md).
- **Las finanzas:** cuatro saldos que nunca se compensan (custodia, por reembolsar, por regularizar y deuda con proveedores), derivados siempre de los movimientos. La matriz A1–A9 está en `tests/aceptacion-financiera.test.js`.
- **Los informes:** por gestión, varias gestiones, período, empresa o persona, y pendientes de comprobante. Ejecutivo o formal, Carta o A4. Cada emisión es una revisión inmutable con su huella; se regenera idéntica.
- **Los anexos:** giro, enderezado, recorte y división de facturas largas en tramos, sin tocar la foto original; dos comprobantes chicos por página.
- **El respaldo v4:** la base completa, las fotos y las copias privadas de los informes, con manifiesto de huellas. **No está cifrado.** Restaura también los respaldos v1 a v3.
- **El esquema SQLite 5** (`VERSION_ESQUEMA` en `src/datos/base.js`) migra desde las bases anteriores sin perder compras, fotos ni identificadores. La migración a 4 está en `docs/fases/03-orden-ingenieria-v2.md`; la 4→5 agrega los catálogos.

## Dónde está todo

| Carpeta | Qué hay |
|---|---|
| `src/`, `tests/`, `scripts/` | El código de la app, sus pruebas y los guiones (compilar, entregar al teléfono, ejemplos) |
| `android/`, `ios/` | Los proyectos nativos de Capacitor |
| `apk/` | **La aplicación compilada**: cada APK con su paquete, su versión, su commit y su huella. Fuera de git |
| `docs/mandatos/` | Los documentos 01, 02 y 03 del proyecto (mandato, plan y roadmap) |
| `docs/CONTRATOS_API.md` | El contrato de la API local, para quien diseña la interfaz |
| `docs/entregas/` | El informe del prototipo de pantallas, para la integración |
| `docs/fases/`, `docs/validaciones/`, `docs/requisitos/` | Las fichas de cada fase, la validación en el POCO y las aclaraciones de negocio |
| `docs/evidencia/` | Los ejemplos: PDF, Excel, respaldo y capturas, con datos ficticios |
| `ERRORES_Y_GUARDAS.md` | Los errores propios y su guarda |
| `archivo/` | Lo que ya no se usa, guardado por si acaso: la primera versión abandonada y las exportaciones de prueba de Codex. Fuera de git |

**El prototipo de pantallas** no es un archivo de esta carpeta: es el lienzo «App de Gastos» de claude.ai, https://claude.ai/artifact/HFNsyhBkZFfc8iyw7JXY1W.

**Las herramientas de Android** (JDK y SDK) están en `~/.local/share/gastos-entorno/`. Son del entorno, no del proyecto.

## Desarrollo

Requiere Node 22–24 y npm:

```sh
npm ci
npm run check
npm run dev
```

`npm run check` corre lint, formato, las pruebas (`node --test tests/*.test.js`, con SQL.js y datos sintéticos) y la compilación web. En `63b26a4` pasan 101 pruebas; ninguna ejecuta el SQLite nativo de Android.

En Android/iOS se usa el plugin nativo SQLite y archivos privados. La vista de navegador para desarrollo usa SQLite mediante SQL.js y almacenamiento del navegador, con sus límites de espacio y aislamiento; no reemplaza la prueba móvil.

## Android: compilar y entregar

```sh
scripts/android/compilar.sh pruebas    # io.necktral.gastos.entorno.pruebas, «Prueba beta de gastos»
scripts/android/compilar.sh oficial    # io.necktral.gastos.entorno
scripts/android/entregar.sh <apk> PASO-B-instalar.apk
```

`compilar.sh` guarda cada APK en `apk/` de esta carpeta, con su versión, su commit y su huella (E-08). `entregar.sh` se niega si ya hay otro APK en Descargas (E-06) y verifica que el teléfono lo haya indexado (E-07).

**Estado en Android:** sin validación de la versión actual: no hubo dispositivo conectado ([informe](docs/INFORME_VALIDACION_ANDROID_V2.md)).

**Datos reales:** compilar siempre en una copia aislada (E-14) y probar solo en la instalación `io.necktral.gastos.entorno.pruebas` con datos sintéticos. No instalar sobre la aplicación que tiene registros reales sin autorización ([D6](docs/DECISIONES.md)).

iOS: `npm run ios:sync` prepara los recursos; compilar y probar requiere macOS y Xcode. No se validó.

## Respaldo

El ZIP lleva todas las tablas, las fotos originales y las copias privadas de los informes, con huellas SHA-256. Restaurar valida todo antes de reemplazar (también las reglas de dinero) y prepara los archivos aparte; si algo falla, el estado anterior queda intacto. **No está cifrado ni tiene contraseña:** guardarlo en un destino privado. La base en el teléfono está en el almacenamiento privado de la app, protegido por el cifrado del propio Android; la conexión SQLite es `no-encryption` y no se declara cifrada.

Errores y guardas del proyecto: `ERRORES_Y_GUARDAS.md`.
