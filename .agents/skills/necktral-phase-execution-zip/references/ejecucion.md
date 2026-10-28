# Ciclo de una fase

## Línea base sin alterar la ejecución

1. Identificar el repositorio físico y su versión. En V4 no presumir remoto ni
   `origin/master`: el snapshot inspeccionado exige commits locales sin remoto.
2. Leer constitución y referencia operativa, entrega activa, ficha y precisiones,
   decisiones que la habilitan y superficies públicas. Contrastar documentos con
   código, pruebas, manifiestos y contratos generados. Una ficha que aún dice
   «propuesta» no borra una ratificación posterior comprobada en LOG; documentar
   esa diferencia sin reescribir fuentes para acomodar el plan.
3. Obtener en lectura rama/HEAD completo, estado del índice y árbol, cambios y
   untracked, worktrees y operaciones Git pendientes. Declarar WIP propio/ajeno.
   No ejecutar stash, reset, clean, checkout, fetch, pull ni rebase por hábito.
4. Identificar escritor y campañas. Registrar clon físico, proyecto de entorno,
   SHA, bloque, identificador/proceso, comando y salida de cada campaña pertinente.
   Un PID sin comprobar comando, inicio y entorno no prueba identidad.
5. Reutilizar evidencia válida disponible. Ejecutar solo la línea base que falte
   y sea segura. Si faltan procesos vivos o salida actual, declarar «no verificado».
6. Completar el mandato con rutas positivas/negativas, dependencias ratificadas,
   pruebas oficiales y autorización. Referenciar ficha/LOG/BUGS existentes, sin
   crear otra fuente de estado ni un segundo sistema de bugs.

La matriz de capacidad tiene cinco columnas: capacidad aprobada, criterio de
aceptación, prueba, evidencia con SHA/entorno y pendiente concreto. Los bloques
del plan interno son organización de ejecución, no subfases del roadmap.

## Decisiones dentro del mandato

| Situación | Acción |
| --- | --- |
| C2 probado, misma capacidad, sin cambio contractual ni decisión nueva | Registrar, rojo causal, corregir, verde y regresión; continuar sin consultar |
| Cinco defectos de una misma causa/flujo | Mantener cinco identidades de bug y un paquete causal; ordenar dependencias y ejecutar lo autorizado |
| C3 incidental innecesario para aceptar la fase | Registrar en la libreta existente si procede; no implementar |
| Prueba falla por infraestructura | Separar del fallo de producto; no declararla rojo causal ni negativo detectado |
| Nueva política, arquitectura o contrato no autorizado | Parar ese frente; consolidar opciones y pedir una decisión específica |
| C1 confirmado o sospecha fundada | Contener y alertar inmediatamente; evidencia segura; sin arreglo silencioso |
| Conflicto de escritores o recurso compartido | Parar las escrituras afectadas; no elegir ganador ni mezclar WIP |
| Tercer rechazo independiente del mismo bloque | Parar y consolidar causas; replanteo con Wis conforme a D-52 |

## Paquete de reparación

Agrupar por raíz causal, contrato afectado y dependencia verificable, no solo por
fecha o proximidad de archivos. Conservar por bug: ID real, C1/C2/C3, probado o
sospecha, escenario, causa, archivos, rojo y commit anterior al arreglo, marca
bilateral exigida, corrección, verde y regresión. No inventar IDs D-/BUG-.

No escribir código correctivo antes del rojo acreditado cuando el protocolo lo
exija. Si el test existía, ejecutarlo sobre el estado defectuoso y preservar su
salida. Si hay que escribirlo, respetar su commit antecedente. No simular el rojo
mediante exit voluntario, import roto, dependencia ausente o test omitido. No
reconstruir una secuencia histórica que no ocurrió: regularizar procedencia
requiere la decisión oficial aplicable.

Mantener separados el número de orientaciones, bugs y commits. Una fase puede
exigir muchos commits y recibir un solo mandato.

## Bloqueo y reanudación

La alerta crítica es inmediata y breve: riesgo, operación detenida, recursos,
evidencia y acción segura. El informe consolidado la complementa; no la retrasa.
No continuar por una dependencia potencialmente afectada. Una campaña en otro
clon puede seguir únicamente si no comparte el riesgo.

Presentar opciones solo para decisiones pendientes reales, con costo/riesgo y
recomendación. Pedir una autorización agrupada que identifique decisiones,
límites y condiciones de reanudación. Una respuesta parcial habilita únicamente
su parte segura y explícita; no supone aprobación del resto.

Tras la decisión, actualizar el mandato mediante referencia a la resolución,
comprobar HEAD/Git/procesos y reanudar el mismo objetivo. No solicitar de nuevo
autorizaciones contenidas en el mandato. El bloqueo no cancela automáticamente
campañas, cambia el roadmap ni habilita otra fase.

## Comunicación y continuidad

Dar avances por capacidades, incertidumbres y próxima verificación, no actividad
administrativa. Responder primero una pregunta de Wis y retomar el mandato. Si
la sesión se compacta o cambia de PC, recuperar mandato, evidencia y estado real;
no repetir auditorías válidas ni asumir árbol limpio. El checkpoint de continuidad
cabe en el informe existente: objetivo, HEAD, WIP, campaña, pendientes y próxima
acción segura. No crear un diario paralelo.
