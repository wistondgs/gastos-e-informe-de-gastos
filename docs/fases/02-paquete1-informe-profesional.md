# Ficha de fase · V2, paquete 1: el informe profesional por gestión

## 0. Errores y guardas aplicables

- **Entradas revisadas de `ERRORES_Y_GUARDAS.md`:** E-01 a E-05.
- **Las que aplican y cómo se cumple cada guarda:**
  - **E-01:** cambia la pantalla de gestiones. Se corren `tests/arranque.test.js` y la compilación (`npm run check`).
  - **E-02:** la migración 3 pasa por el adaptador SQL.js. Se corre la prueba de las claves foráneas, y las pruebas nuevas usan el adaptador real.
  - **E-03:** antes de cada duda de negocio se lee el plan 02 (§3, §7 y §8) y el roadmap 03 (§4 y §6). La única duda que queda es la separación por destinatario: el plan la ata a las asignaciones (§3), que llegan en el paquete 5. Hasta entonces, el informe deja elegir qué compras se incluyen («revisar qué se comparte», §7). No hace falta preguntar.
  - **E-04:** el informe nuevo se prueba con dos monedas, una compra ajena, una duplicada, la fecha de corte y la relación anexo–compra.
  - **E-05:** los mutantes de `guardas.py` corren con `GUARDAS_CONTADORES` aislado; sin eso, la guarda lo impide.
- **Mutantes de las guardas:** se corren al cerrar, con contadores en la carpeta temporal de la sesión.

## 1. Mandato y alcance

- **Fase autorizada y capacidades:** el mandato integral V2 del 27-10, paquete 1:
  - el informe por gestión, con el formato «Ejecutivo moderno» y un modo de impresión «Formal»;
  - papel Carta o A4;
  - el encabezado configurable: título, responsable y destinatario;
  - la fecha de corte, el identificador y la revisión;
  - la tabla de compras y los totales por moneda, conciliados;
  - la relación de comprobantes (presentes, pendientes y ausentes), los anexos numerados y la numeración de páginas;
  - el registro histórico inmutable de cada revisión emitida, con su huella, y la regeneración verificable;
  - el Excel de la gestión desde la misma revisión.
- **Fuera del alcance:**
  - el recorte y el giro de las fotos, y los anexos de a dos por página (paquete 2);
  - los saldos, anticipos y créditos (paquete 5);
  - los PDF dentro del respaldo (paquete 4).

  El informe declara expresamente que no calcula la liquidación.
- **Decisiones que requieren consulta:** ninguna. La firma del desarrollador **no** va en el informe: lo dice el mandato, §5.

## 2. Criterios y pruebas

| Capacidad | Criterio verificable | Prueba |
|---|---|---|
| Totales | Las sumas de C$ y de US$ salen por separado y cuadran con las filas; nunca hay un total mezclado | `tests/informe-profesional.test.js` |
| Integridad | Rechaza una compra ajena, una duplicada, una moneda inválida y una foto de otra compra | ídem |
| Corte | Excluye las compras posteriores al corte; un corte anterior al inicio se rechaza | ídem |
| Anexos | La numeración es correlativa y coincide con la columna «Soporte»; una factura sin imagen se informa como «Ausente» | ídem |
| Papel y estilo | Carta mide 612×792 pt y A4, 595×842 pt; el modo Formal trae el bloque de revisión | ídem |
| Revisión | Cada emisión numera la revisión siguiente; la revisión emitida no se puede modificar | `tests/informes-revision.test.js` |
| Regeneración | Con los mismos datos y la misma fecha de emisión, el PDF sale idéntico (la misma huella SHA-256) | ídem |
| Privacidad | La firma del desarrollador no aparece en el PDF; las compras no elegidas no aparecen | ídem |
| Texto | Un emoji o un carácter fuera de WinAnsi no rompe el PDF | ídem |
| Migración 2→3 | Conserva las compras, las fotos y las gestiones; si falla, revierte | `tests/informes-revision.test.js` |
| Respaldo v3 | Guarda y restaura los ajustes y las revisiones; un respaldo v2 sigue restaurando | ídem |
| Revisión visual | Se rasterizan los PDF de ejemplo y se miran página por página | `docs/evidencia/informe/` |

**Las pruebas de las pruebas:** cada prueba nueva se corre contra un mutante del código antes de darla por buena.

## 3. Cierre

**27-10-2026, 17:05 · Claude**, sobre `78abc81`.

- **Resultado:** todos los criterios de §2 se cumplen en la compuerta. `npm run check` da 31 de 31.
  - `tests/informe-profesional.test.js`: 11 pruebas.
  - `tests/informes-revision.test.js`: 6 pruebas.
- **Las pruebas de las pruebas:** 16 mutantes del código nuevo (dominio, PDF, emisión, respaldo y migración).
  - El primer intento dejó 3 vivos: el corte excluyente, el PDF que tomaba la fecha del reloj y la regeneración sin comparar la huella. Las tres pruebas faltantes se agregaron.
  - Al final: 16 de 16 detectados.
- **Ejemplos con datos ficticios,** en `docs/evidencia/informe/`:
  - tres PDF: ejecutivo Carta con anexos, formal A4 con anexos y ejecutivo A4 sin anexos y con corte;
  - un Excel;
  - las capturas de «Preparar informe» y «Informes emitidos».

  Los genera `scripts/ejemplos/` (`comprobantes.py` y `informes.mjs`).
- **La revisión visual:** se rasterizó cada página y se miró una por una.
  - Se corrigieron el espacio entre las firmas y las observaciones, el espacio antes de la relación de comprobantes y el rótulo pegado a «Volver».
  - **Siguen pendientes para el paquete 2:**
    - la factura larga se reduce a una sola página y queda ilegible;
    - la foto tomada de lado sale girada;
    - un recibo chico ocupa una página entera.
- **El recorrido en el navegador** (Chrome sin pantalla, 390×844): se preparó y emitió un informe, y quedó «Archivo verificado».
- **El APK** de prueba: `io.necktral.gastos.entorno`, 2.0.0-alfa.1 (código 2), SHA-256 `cb5993cc93f1f024e9d31182806a101fc84d69a019cabcfb0a23d3aa8aaf3244`. **No se instaló:** tiene el mismo identificador que la app con datos reales del POCO, y migra su base al esquema 3.
- **Las guardas:**
  - E-01: callada, se cumplió (la prueba de arranque y la compilación).
  - E-02: callada (las claves foráneas, por el adaptador).
  - E-03: callada; la duda por destinatario se resolvió leyendo el plan.
  - E-04: callada; su guarda pasó a las pruebas nuevas.
  - E-05: callada; los mutantes corrieron aislados.
  - Mutantes de `guardas.py`: LAS GUARDAS SIRVEN.
- **Errores propios nuevos:** ninguno en el código del producto.
  - En el banco de trabajo, un `pkill -f` coincidió con su propia línea de comandos y cortó el shell, sin daño.
  - No se registra porque no es del proyecto: no afecta datos ni pruebas.
- **Decisiones técnicas:**
  - la inmutabilidad de las revisiones está en el código, no en un trigger (por el plugin nativo, que no se pudo probar);
  - el PDF es determinista (las fechas fijadas en la emisión), así que se puede regenerar y comparar contra la huella;
  - el respaldo v3 guarda el registro de las revisiones, no los PDF;
  - la elección manual de compras reemplaza, por ahora, la separación por destinatario;
  - `pdfGestion` se retiró.
- **Pendientes:**
  - la prueba en Android de la migración 2→3 y de la carpeta Documentos, en una instalación aislada;
  - iOS, no probado;
  - el filtro automático por destinatario (paquete 5).

> **Nota (27-10, orden V2):** los PDF de ejemplo de este paquete se reemplazaron por los del motor 2 (`ejemplo-1-gestion-ejecutivo-carta.pdf`, `ejemplo-2-destinatario-formal-a4.pdf`, `ejemplo-3-varias-gestiones-ejecutivo-a4.pdf`). Se conservan en el historial de git, en `1b34f88`. Ver `03-orden-ingenieria-v2.md`.
