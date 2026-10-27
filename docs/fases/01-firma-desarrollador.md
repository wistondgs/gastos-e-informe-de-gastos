# Firma del desarrollador · ajuste de interfaz

## 0. Errores y guardas aplicables

E-01: la pantalla cambia; verificar la prueba de arranque y compilar. E-03: la firma y el alcance están explícitos en la solicitud del propietario; no reinterpretar el nombre. E-02 y E-04 no se modifican; las pruebas existentes se mantienen. Ejecutar los mutantes portátiles con contadores aislados. Preservar la instalación y los datos reales del POCO.

## Alcance

Mostrar «Desarrollada por W. D. Gutiérrez» en Inicio y Acerca de, con distintivo WD y versión nativa obtenida de la aplicación instalada. No cambiar SQLite, identificadores, informes, respaldos ni el identificador Android. La vista de navegador debe distinguirse de una versión instalada. Verificar las dos pantallas en vista móvil y compilar sin instalar en el teléfono.

## Evidencia

Código de Codex (27-10, hasta las 15:53); cierre de Claude el mismo día, sobre `3bb7059`.

- `npm run check`: lint, formato, 15 de 15 pruebas y compilación, en verde.
- La prueba nueva (`tests/version.test.js`) detecta 4 de 4 mutantes de `src/interfaz/version.js`: acepta una versión vacía, una versión fija, consulta en el navegador, propaga el error.
- Capturas a tamaño de teléfono, en el navegador: `docs/evidencia/firma/inicio.jpg` y `acerca-de.jpg`. En el navegador, «Acerca de» dice «Disponible en la aplicación instalada».
- **La versión mostrada ahora distingue las compilaciones:** `versionName` pasa de «1.0» a «2.0.0-alfa.1» y `versionCode` de 1 a 2 (`android/app/build.gradle`, `package.json`). Antes, todas las compilaciones decían «1.0».
- `@capacitor/app` 7.1.2 se agrega con `disableBackButtonHandler: true`: el botón atrás sigue igual que antes (cierra la app). La navegación por historial queda para el paquete de experiencia de usuario.
- **No probado en el teléfono:** la versión nativa leída del sistema. No se instaló nada en el POCO.

## Cierre

- Guardas consultadas: E-01 (prueba de arranque y compilación: callada, se cumplió); E-03 (no aplica: no hubo preguntas de negocio). E-02 y E-04 no aplican: no se tocaron el adaptador ni los informes.
- Mutantes de `guardas.py` con contadores aislados: LAS GUARDAS SIRVEN.
- Error nuevo: **E-05** (de Claude), con su guarda mecánica en `guardas.py`.
