# Modelo · formalizar los errores para que no se repitan

**Qué es esto.** El mecanismo, sin el contenido del proyecto donde nació. Se copia a cualquier proyecto; lo único que cambia son las entradas y las guardas de dominio. Dos ficheros: este documento y `guardas.py`.

**El problema que resuelve.** Un error que se comete, se arregla y no se anota se vuelve a cometer. Un error que se anota en prosa y nadie relee tampoco se evita: se archiva. La diferencia entre un archivo y experiencia es que la experiencia **actúa en el momento del riesgo sin que nadie se acuerde de ella**.

---

## 1 · Las tres reglas

1. **Una entrada sin guarda no está cerrada.** La entrada describe el error; la **guarda** es lo que impide que vuelva. Por orden de preferencia: **mecánica** (un test, una función que levanta excepción, un campo que el veredicto lee, un hash) o, si no puede ser mecánica, una **pregunta obligatoria en un punto concreto** de un documento que sí se escribe siempre. Sin guarda, la entrada queda **ABIERTA** y aparece en la pregunta final del cierre.
2. **Se lee en el momento del riesgo, no en un índice.** Nadie va a abrir el registro «por si acaso». Tiene que haber un punto del flujo de trabajo donde consultarlo sea obligatorio y visible.
3. **Cada cierre alimenta el registro.** El cierre de cada unidad de trabajo lista qué guardas saltaron, cuáles callaron y qué entradas nuevas añade. Un error cometido y no anotado es el único que de verdad cuesta.

---

## 2 · El formato de una entrada

```markdown
## E-NN · Título en una línea: qué se hizo mal, no qué salió mal
**Clase:** criterio | instrumento | banco de trabajo · **Veces que saltó:** N · *resumen de una línea*
**Fecha, contexto (error de QUIÉN).** Qué pasó, con el hecho y su fuente: el número, el
comando, el commit, el fichero. No «fallaba el cálculo» sino «declaraba 13,9 millones de
pasos en 0,06 s, que es imposible».
**Por qué.** La causa de método, no la causa técnica. «Se eligió el umbral en la unidad del
resultado sin compararlo con su dispersión», no «faltaba un paréntesis».
**Severidad.** Y en qué moneda. El coste de un instrumento defectuoso rara vez es el tiempo
de máquina: suele ser una afirmación falsa que llegó a un informe.
**Firma (cómo se detecta).** El síntoma observable la próxima vez, antes de saber la causa.
Es el campo más valioso del formato y el que más cuesta escribir.
**Guarda** `[MECÁNICA]` o `[PREGUNTA → punto N]`: qué impide que vuelva.
**Aplicada en.** Fichero y función, o «pendiente», o «ABIERTA».
```

**Por qué «Firma» es el campo que importa.** Las demás describen el pasado. La firma describe el futuro: es lo que vas a *ver* la próxima vez, cuando todavía no sepas qué está mal. Ejemplos reales de firmas útiles: *«una estratificación sale plana donde debería tener gradiente»*; *«el proceso lleva veinte minutos y su salida está vacía»*; *«el informe dice el tamaño de la muestra como una constante del texto y no como una variable contada»*.

**Por qué el título dice lo que se hizo mal y no lo que salió mal.** «El informe salió con cifras erróneas» no sirve para reconocer nada. «Se verificó sobre una lista vacía y se leyó el ninguno como confirmación» sí.

---

## 3 · Las tres clases de error, y por qué clasificar

- **criterio** — se pidió mal: el umbral, la condición de éxito, lo que se le exige a un control.
- **instrumento** — mide otra cosa de la que dice: un contador que cuenta lo que no es, un parámetro declarado que nunca se aplica, una muestra que no representa.
- **banco de trabajo** — un comando suelto: una tubería que se traga la salida, un `kill` por patrón, una verificación sobre cero elementos.

**Clasificar no es taxonomía, es diagnóstico del método.** En el proyecto donde nació esto, de trece errores propios, **nueve fueron de instrumento y banco y sólo cuatro de criterio**. Eso dijo algo accionable: el método de documento-previo-y-pruebas funcionaba sobre el criterio y no llegaba a lo que ocurre entre documentos. De ahí salió la capa 2. Sin la clasificación, trece errores son sólo trece errores.

---

## 4 · Las tres capas

### Capa 1 · El registro (`ERRORES_Y_GUARDAS.md`)
Un fichero, versionado, en el árbol del proyecto, compartido por todos los roles y todas las sesiones. No en una herramienta aparte: en el repositorio, donde quien trabaja ya está mirando.

### Capa 2 · Las guardas en código (`guardas.py`)
**Esta capa existe por un hallazgo, no por elegancia:** el registro sólo actúa cuando alguien abre el documento previo, y los errores de banco de trabajo ocurren **entre** documentos, en comandos improvisados. Una guarda en prosa no te salva a las tres de la mañana; una que se importa, sí.

Una guarda es una función que:
- **levanta excepción** cuando detecta lo que vigila (no devuelve `False`: aborta);
- **devuelve el dato útil** cuando pasa, para que quien informa use *ese* valor y no una constante escrita a mano;
- **lleva su propio contador** de consultas y de saltos;
- **tiene su propio mutante**: una prueba de que puede fallar. Una guarda que no puede fallar no es guarda.

### Capa 3 · El enganche
Un punto obligatorio y visible del flujo. En el proyecto original es el **punto 0** de la plantilla del documento de apertura: *«qué entradas del registro aplican a esto y cómo se cumple cada una»*; «ninguna aplica» hay que justificarlo. En un ERP el enganche natural es la plantilla de PR o el documento de cambio: la misma pregunta, en el sitio donde la gente ya escribe.

Y un orden obligatorio: **documento previo → pruebas de las pruebas → enmienda si una prueba refuta un criterio → ejecución real.** El documento no es final hasta que sus pruebas hayan corrido.

---

## 5 · Medir el mecanismo, no sólo llenarlo

Sin esto el registro se convierte en un cementerio de buenas intenciones.

- **Contador por guarda:** veces consultada y veces que saltó.
- **Regla de poda:** una guarda que no salta en dos unidades de trabajo **se revisa**. O el error ya no es posible —y la entrada se cierra como «resuelta por construcción»— o la guarda no detecta y hay que rehacerla.
- **La excepción que descubrimos escribiendo la regla:** hay guardas **preventivas por construcción** —no detectan nada, simplemente hacen imposible el error si se usan—. Ésas **no saltan nunca por diseño**, y su silencio no es síntoma. Hay que marcarlas aparte o la regla de poda borrará justamente las que mejor funcionan.
- **Proporción por clase a lo largo del tiempo:** es la única medida de si el método está mejorando.

---

## 6 · Cómo se adapta a otro dominio

Lo portátil es el modelo, el formato y las tres capas. Lo que se reescribe son las entradas y las guardas de dominio. La receta para derivarlas:

1. **Haz la lista de lo que ya os mordió.** No inventes guardas para errores hipotéticos: el criterio de admisión es *sólo lo que ya falló*. Una guarda para un error que nunca ocurrió es coste sin beneficio.
2. **Por cada una, escribe la firma antes que la guarda.** Si no puedes describir el síntoma observable, no has entendido el error.
3. **Clasifícala.** Si sale de clase «banco de trabajo», es candidata a función importable.
4. **Pregúntate si puede ser preventiva en vez de detectora.** Una función que hace imposible el error vale más que una que lo detecta.
5. **Escríbele su mutante.** Si no sabes cómo hacerla fallar a propósito, no sabes si funciona.

**Ejemplos ilustrativos para un ERP** —no son los vuestros, son para que se vea la traducción—: una guarda que se niega a ejecutar una migración sin su migración inversa probada; una que rechaza un importe en coma flotante donde debe haber decimal exacto; una que falla si un test de integración corrió con la base vacía (es el mismo error que verificar sobre una lista vacía); una que impide que un proceso de cierre contable escriba sin transacción; una que comprueba que un identificador de idempotencia se derive de un campo y no del orden de llegada. La lista real sale del paso 1, no de mí.

---

## 7 · Lo que este modelo no hace, y hay que saberlo

**Impide la segunda vez, no la primera.** En el proyecto original, ninguno de los trece errores propios fue *prevenido* por el registro: todos eran clases nuevas y se anotaron después. Eso no es un fallo del mecanismo; es su alcance. Lo que sí hizo, medido: las pruebas-de-las-pruebas atraparon **seis criterios mal escritos antes de medir nada**, y en una ocasión el flujo **se negó a ejecutar** la parte real porque una prueba estaba en rojo.

**Y hay una trampa a la que caí dos veces en el mismo día:** anotar un error y reintroducirlo en versión suave a los pocos minutos. Anoté «el umbral estaba por debajo del ruido» y acto seguido puse un umbral que seguía ignorando que se comparaban diez cosas a la vez. La guarda contra eso no es más disciplina: es que la corrección **también** pase por su mutante.
