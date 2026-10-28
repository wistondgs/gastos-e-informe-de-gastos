# Pruebas, procedencia y certificación

## Leer antes de ejecutar

Inspeccionar versiones vigentes de `./v4`, `scripts/gate.sh`,
`scripts/procedencia.py`, sus autopruebas, `scripts/negativos.sh`,
`scripts/negativos_hibrido.py`, registros del bloque y el hook `commit-msg`
efectivamente instalado. Leer D-80/D-81 si existen. No sustituir estos controles
por esta referencia ni asumir que el snapshot aporta su versión actual.
Todo Docker operativo pasa por `./v4`.

## Tres niveles, sin dispensar gates

| Momento | Evidencia y pruebas | Qué no acredita |
| --- | --- | --- |
| Defecto durante construcción | Registro, rojo causal en estado defectuoso, procedencia antecedente cuando aplica, verde y regresión del flujo | No acredita cierre ni reemplaza compuerta oficial |
| Incremento interno | Gate que exija expresamente contrato/ficha vigente; no añadir híbrido completo por costumbre | No autoriza omitir un gate oficial obligatorio por incremento |
| Candidato de fase | Diff, revisión independiente, invariantes/contratos, SHA congelado, compuerta y negativos exigidos, restauración/causalidad, dependencias y respaldo | No acredita aceptación formal ni otra fase |

No repetir una compuerta válida por ansiedad o por un resumen incompleto.
Verificar primero identidad y cobertura. La reducción es de corridas redundantes,
no del conjunto obligatorio. Si las reglas exigen gate por incremento, conservarlo.
Cualquier cambio de política requiere decisión externa.

## Identidad de campaña

Leer, sin crear un registro rival, los datos del corredor existente:

- SHA completo candidato, clon físico independiente, bloque y conjunto de casos.
- Comando, versión del corredor/registro, entorno Docker y dependencias.
- Identificador/proceso, inicio, salida incremental y reporte final.
- Línea base, detector específico, causa esperada/observada y restauración por caso.

Solo reutilizar una campaña cuya identidad, vigencia, cobertura y resultados
correspondan al candidato requerido. Un archivo `certifica: true` por sí solo no
basta. Una campaña viva no está terminada. Sin resultados obligatorios, mantener
`BLOCKED` para el cierre, indicando «certificación en curso»; observar es una
acción válida, sin pedir una nueva orientación técnica.

Si la misma campaña sigue viva y válida, no lanzar otra ni tocar HEAD, índice,
tests, migraciones, configuración o salidas de su clon. No ejecutar otro gate
sobre recursos compartidos. Si no puede comprobarse si sigue viva, verificar en
lectura y mantener el recurso protegido hasta resolver la incertidumbre.

## Cambios después de congelar

Si hace falta corregir, no modificar el clon ocupado ni reescribir el commit
tomado por FAB. Detener la operación afectada si el riesgo lo exige; crear la
corrección legítima en el desarrollo autorizado y obtener un candidato nuevo.
No trasladar el certificado anterior al nuevo SHA. Volver a gates pertinentes
según el procedimiento vigente y revisar el diff nuevo.

Si no existe regla ratificada para recertificación parcial, no inventarla:
aplicar gates de cierre vigentes o escalar la ambigüedad. Igualdad de archivos o
de tree no equivale a certificar un commit. La evidencia antigua conserva su SHA.

## Negativos y restauración

Verificar línea base verde, mutación realmente plantada, detector correcto, causa
del fallo y restauración de código y datos pertinentes. Timeout, conexión rota,
colección fallida, test omitido o fallo no causal no es DETECTADO. Comprobar que
el universo exigido está completo. No equiparar híbridos de bloque con negativos
integrales si el procedimiento exige ambos en ese cierre.

El snapshot contiene reportes de SHA distintos: `gate.json` de `307ee83…`,
`negativos_hibrido.json` p34 sobre `ec1bb29…` y `negativos.json` sobre `e4adfc7…`.
Sirven para detectar incompatibilidad, no para reunir un certificado compuesto.
No se ejecutó ninguna de esas campañas en este trabajo.

## Revisión y cierre

Usar el revisor exigido por el proyecto; el autor no se autocertifica. Dar
alcance, base/candidato, criterios y artefactos crudos, sin inducir veredicto.
Sin revisión independiente real, `BLOCKED`. Los ensayos conductuales de una
Skill tampoco certifican la contabilidad de K2.

Preparar aceptación con matriz completa, riesgos residuales y límites reales.
Cumplir cierre documental, dependencias y respaldo oficiales bajo su autorización;
preparar como propuestas los actos reservados aún no autorizados.
`READY_TO_CLOSE` no altera por sí solo `ROADMAP.md` ni `LOG.md` ni acepta por Wis.
