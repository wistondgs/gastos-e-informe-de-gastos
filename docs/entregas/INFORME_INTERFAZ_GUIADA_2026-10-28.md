# Informe · Interfaz guiada («modo fácil») de Gastos y Rendiciones

**Fecha:** 28 y 29 de octubre de 2026 · **Responsable del trabajo:** Claude · **Repositorio:** `gastos-e-informe-de-gastos`, sobre `63b26a4`, sin commit
**Ficha de fase:** [`docs/fases/09-interfaz-guiada.md`](../fases/09-interfaz-guiada.md)

---

## 1. Resumen

Se diseñó y se integró en la app una **versión guiada** para personas con poca práctica en tecnología:

- **Una tarea por vez.** Cada pantalla hace una sola pregunta y tiene un solo botón para seguir.
- **Cada paso explica qué hacer** y dice qué falta si no se puede avanzar.
- **Un modo aprendizaje que se prende y se apaga.** Agrega instrucciones numeradas, un ejemplo concreto y un «¿Para qué sirve?» en cada paso.
- **10 temas** de colores y letra, a elección.

Están terminados y probados los tres caminos principales: **Registrar un gasto**, **Recibí dinero** y **Entregar un informe**. La versión clásica sigue disponible y se cambia con un toque.

| Indicador | Resultado |
|---|---|
| Pruebas automáticas del proyecto (`npm run check`) | **126 de 126** (111 anteriores + 15 nuevas); lint, formato y compilación sin errores |
| Pruebas de las pruebas (errores sembrados a propósito) | **7 de 7 detectados** |
| Guardas del proyecto (`guardas.py`, con contadores aislados) | «LAS GUARDAS SIRVEN» |
| Recorridos completos en navegador, con datos sintéticos | 3 gastos, 2 recepciones de dinero, 1 informe emitido con PDF y Excel |
| APK de prueba | Compilado y verificado; **no instalado** (el teléfono no estuvo conectado) |

---

## 2. Cómo se llegó a esto

1. **Primer diseño (lienzo de Claude Design).** Primero se dibujaron 24 pantallas a partir del contrato de la API. El propietario las rechazó: eran un menú de opciones, no una guía, y la gente no sabría qué hacer.
2. **Segundo diseño, guiado.**
   - Inicio con «¿Qué querés hacer?».
   - Cámara en ráfaga.
   - Galería de fotos continua.
   - Una pregunta por pantalla.
   - 10 temas.
   - Después se agregó el **modo aprendizaje**, pedido para quien recién empieza.
3. **Integración en la app.** El propietario pidió que no quedara en un dibujo. Se programó en Vue, conectado a la API local existente, sin cambiar ninguna regla de dinero.

El diseño quedó en el lienzo *App de Gastos*: la página «Versión guiada» es la vigente y «Versión 1» es la descartada.

---

## 3. Qué hay ahora en la app

### 3.1 Inicio guiado

- Saludo y pregunta: «¿Qué querés hacer?».
- Interruptor **Modo aprendizaje** (viene encendido).
- Botón grande **Registrar un gasto**, que abre la cámara.
- Otros caminos explicados: Recibí dinero, Entregar un informe, Ver cómo voy y Ver mis compras.
- **Lo que falta hacer**: compras sin indicar el pago y facturas pendientes.
- Botón **Colores**, para elegir uno de los 10 temas.
- Enlace para usar la versión clásica, que a su vez tiene un botón para volver a la guiada.

### 3.2 Registrar un gasto · 7 pasos

| Paso | Qué hace la persona | Ayuda que da la app |
|---|---|---|
| 1. Fotos | Saca varias fotos seguidas y marca si cada una es factura, voucher u otra. Si no tiene factura: «Me la dan después» o «No hay factura» | 5 instrucciones: luz, encuadre, botón, voucher y «Listo» |
| 2. Revisar fotos | Las ve en un **carrusel sin fin**, que se pasa con el dedo o con flechas. Puede girar, recortar o quitar cada foto, y **reordenarlas** arrastrando o con botones | Cómo saber si se lee; qué es factura y qué es voucher |
| 3. Importe | Elige la gestión (o la crea ahí mismo) y la moneda, y escribe el total con teclado propio | «Buscá la palabra TOTAL», con un ejemplo de qué tocar |
| 4. Dónde | Negocio, qué compró y número de factura | Ejemplo de cómo escribirlo |
| 5. Para quién | Elige la empresa o persona, o «Es un gasto mío»; si no está, la agrega ahí mismo | «Pensá quién te tiene que devolver esta plata» |
| 6. Pago | «¿Ya está pagado?» y después «¿Con qué plata?». La app dice la consecuencia: «Entonces la empresa te tiene que devolver C$ …» | La opción de fondos se desactiva, con explicación, si no hay fondos guardados |
| 7. Revisar | Lee el resumen; cada línea tiene «Cambiar» | «Después de guardar no se borra; se anula con motivo» |

**Borrador:** si se cierra la app a mitad del registro, retoma en el mismo paso y con las fotos.

### 3.3 Recibí dinero · 4 pasos

1. **Quién** te dio la plata. Si no está en la lista, se agrega ahí mismo.
2. **Cuánto**: moneda, teclado y número de depósito si lo hay.
3. **Para qué**:
   - **«Me están devolviendo»** se guarda como reembolso. La app muestra cuánto debe esa persona en cada gestión, con el dato que calcula la API.
   - **«Me la dieron para gastar»** se guarda como anticipo, que queda en custodia.
   - **«No sé todavía»** queda sin aplicar.
4. **Revisar** y guardar. La app explica el resultado, por ejemplo: «No es una ganancia: es tu plata que vuelve».

### 3.4 Entregar un informe · 4 pasos

1. **De qué**: una gestión, una empresa o persona (solo lo suyo) o unas fechas.
2. **Para quién**: quien lo recibe y el responsable.
3. **Cómo**: con fotos o sin fotos, papel Carta o A4.
4. **Revisar**: muestra los totales por moneda que da la API y la cantidad de compras, con una vista previa opcional. Después se emite el informe.

Al final hay dos botones: **Mandar el PDF** y **Mandar el Excel**, más un aviso de privacidad y la aclaración de que emitir no significa que ya pagaron.

### 3.5 Temas

Son 10: Bosque, Noche, Alto contraste, Océano, Arcilla, Lavanda, Arena, Grafito, Sol y Rosa. Cambian colores, esquinas y bordes, nunca los datos. La preferencia se guarda en el teléfono.

---

## 4. Reglas que se respetaron

- **La pantalla no calcula dinero.** Las respuestas del asistente se traducen a las mismas funciones que usa la app (`prepararCompraFinanciera`), y los saldos los calcula siempre la API. No se creó ninguna regla de negocio nueva.
- **No se tocaron** la base de datos, las migraciones, el motor del PDF, el respaldo ni los guiones de Android.
- **Trabajo de otra sesión.** El repositorio tenía cambios sin confirmar de la fase 08. El código nuevo va en archivos aparte, y en `App.vue` solo se tocaron los puntos de conexión; se guardó una copia previa. No se hizo commit.
- **Método del proyecto (`AGENTS.md`):**
  - ficha de fase con el punto 0 de guardas;
  - mutantes de `guardas.py` con contadores aislados;
  - pruebas de las pruebas antes de dar por buena cada prueba;
  - registro del error propio E-16.

---

## 5. Pruebas

### 5.1 Automáticas (`tests/interfaz-guiada.test.js`, 15 pruebas)

- Cada respuesta del pago produce el saldo correcto en la **API real** (SQLite con SQL.js):
  - «con mi plata» deja un saldo por reembolsar;
  - «quedó debiendo» deja una deuda con el proveedor;
  - «pagó directo» y «gasto mío» no dejan saldo;
  - «no sé» deja la compra sin detalle.
- Recibí dinero:
  - la devolución baja lo adelantado;
  - «para gastar» queda en custodia;
  - «no sé» queda sin aplicar.
- Informe:
  - totales por gestión;
  - el informe de una empresa trae solo lo suyo;
  - fechas invertidas se rechazan.
- Cada paso dice qué falta; el de pago pide el pago, no una persona (guarda E-15).
- El carrusel es circular y reordenar no pierde fotos.
- Las preferencias se guardan, y un tema desconocido o el almacenamiento bloqueado vuelven al valor inicial.
- Hay 10 temas completos.
- Las 5 pantallas compilan y `App.vue` las abre desde Inicio, el menú y el botón atrás de Android.
- El borrador no se reescribe después de guardar (guarda E-16).

**Errores sembrados a propósito, para comprobar que las pruebas los detectan: 7 de 7.** Fueron:
- el pago propio cambiado por pago de tercero;
- «no sé» cambiado por crédito;
- el carrusel sin vuelta;
- el mensaje de E-15 restituido;
- un tema desconocido aceptado;
- el menú que no abre la versión guiada;
- el freno del borrador anulado.

### 5.2 Recorridos en navegador

Se usaron `npm run dev`, pantalla de 375×812, datos inventados y fotos generadas.

| Recorrido | Resultado |
|---|---|
| Gasto con 2 fotos, marcar voucher, reordenar, C$ 4,250.75, factura «0000124» | Guardado. En el detalle clásico: contado, pago propio, los ceros conservados y 2 comprobantes |
| Gasto con alta de «Empresa de prueba S.A.» en el paso 5 | Empresa creada y elegida; la opción de fondos apareció desactivada con explicación; quedaron el reparto y el pago propio |
| Gasto con gestión nueva «Viaje de prueba a León» | Gestión creada y elegida en el paso 3 |
| Segundo gasto seguido | Empieza en C$ 0.00 (antes de E-16 salía con dígitos viejos) |
| Recibí dinero: devolución de C$ 1,200 | La deuda de esa gestión quedó en cero |
| Informe de la gestión de León | `GR-9FF790D5-R01`, C$ 1,200.00, 1 compra; PDF y Excel generados |
| Tema «Noche» | Aplicado a las pantallas nuevas |

---

## 6. Error propio registrado: E-16

- **Qué pasó:** en el navegador, el importe de un segundo gasto salió **C$ 10,001,200.00** en lugar de C$ 1,200.00.
- **Causa:** el borrador se guardaba con 0.4 s de espera. Si se guardaba la compra antes de ese tiempo, el borrador viejo se volvía a escribir y el registro siguiente lo recuperaba.
- **Riesgo:** guardar una cifra equivocada sin notarlo. Solo hubo datos sintéticos.
- **Guarda mecánica:** `crearGuardadoDiferido` se detiene antes de guardar la compra, y una prueba exige que nada se reescriba. Su mutante se detectó.
- **Registro:** quedó anotado en `ERRORES_Y_GUARDAS.md`.

Además se corrigieron cuatro defectos de presentación que aparecieron al probar:
- texto viejo superpuesto;
- la fecha con «De» en mayúscula;
- «S.A..» con doble punto;
- una deuda sin gestión que aparecía sin nombre.

---

## 7. APK de prueba

- **Archivo:** `apk/io.necktral.gastos.entorno.pruebas-v2.0.0-alfa.1-c2-63b26a4-40c57872.apk`
- **SHA-256:** `40c57872d54dab238a7c65609ad54a4ab00cc6140713731e88f31376dbdb5e98`
- **Qué app es:** «Prueba beta de gastos» (`io.necktral.gastos.entorno.pruebas`), con datos sintéticos. **No toca la app con datos reales.**
- **Firma:** el mismo certificado de la app de pruebas instalada (`20d4b995…3b2b23`). Por eso actualiza sin borrar sus datos.
- **Cómo se compiló:** en una copia aislada del proyecto (E-14). Se comprobó, archivo por archivo, que el código era idéntico al árbol principal, y allí pasaron 126 de 126 pruebas.
- **Versión anterior:** reemplaza al APK `6ab182f0`, que no se entregó.

**Estado:** no instalado. El teléfono no estuvo conectado por `adb`.

---

## 8. Archivos

| Archivo | Qué es |
|---|---|
| `src/interfaz/guiada/guia.js` | Lógica sin pantalla: pasos, temas, textos de ayuda, traducción a la API, validaciones, carrusel y borrador diferido |
| `src/interfaz/guiada/InicioGuiado.vue` | Inicio guiado |
| `src/interfaz/guiada/AsistenteGasto.vue` | Registrar un gasto (7 pasos) |
| `src/interfaz/guiada/RecibirGuiado.vue` | Recibí dinero (4 pasos) |
| `src/interfaz/guiada/InformeGuiado.vue` | Entregar un informe (4 pasos) |
| `src/interfaz/guiada/guiada.css` | Estilos compartidos, con los temas como variables |
| `src/interfaz/App.vue` | Solo conexiones: pantallas, preferencias, menú y botón atrás |
| `tests/interfaz-guiada.test.js` | 15 pruebas nuevas |
| `docs/fases/09-interfaz-guiada.md` | Ficha de fase |
| `ERRORES_Y_GUARDAS.md` | Entrada E-16 |
| `.claude/launch.json` | Configuración para abrir el servidor de desarrollo |

---

## 9. Pendientes

1. **Instalar y probar en el teléfono:** cámara nativa, botón atrás y compartir. Hay que conectar el POCO por USB y revisar la carpeta `APK` para no dejar dos instaladores (E-06). Si después de instalar sigue la huella anterior, como pasó en la fase 08, hay que subir el número de versión.
2. **«Ver cómo voy» en modo fácil:** todavía abre la pantalla clásica.
3. **Repartir un gasto entre varias empresas** desde el asistente: sigue en la versión clásica.
4. **Temas en las pantallas clásicas.**
5. **Confirmar en git:** decidir junto con el trabajo pendiente de la fase 08.
