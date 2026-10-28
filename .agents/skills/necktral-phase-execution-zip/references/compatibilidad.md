# Compatibilidad y límites de autoridad

## Decisión de diseño

Crear una Skill especializada. Ampliar el controlador mezclaría ejecución, foco y
gobierno con contexto V2/V3; ampliar las tres repetiría el ciclo. Esta Skill
conserva un solo ciclo y referencia autoridades existentes. No es un roadmap,
runner, registro de bugs ni certificador nuevo.

## Reparto de responsabilidades

| Fuente o Skill | Responsabilidad conservada | Adaptación acotada para ERP V4 |
| --- | --- | --- |
| Mandato explícito de Wis | Objetivo, límites, aceptación y decisiones reservadas | Prevalece sobre recetas antiguas incompatibles; no ratifica decisiones contables nuevas |
| `CLAUDE.md` + `AGENTS.md` | Constitución y referencia operativa | Leer completos; no editar para instalar |
| `ROADMAP.md`, `LOG.md`, ficha/precisiones | Estado, decisiones y alcance | Referenciar; no crear estado paralelo |
| `necktral-focus-protocol` | Un objetivo, no deriva, protección WIP | No aplicar stash/sync automático; preservar WIP sin mutarlo |
| `necktral-project-governance` | Lectura real, C1/C2/C3, ratificación y riesgos | Usar fuentes locales reales; no exigir remoto inexistente ni `origin/master` |
| `necktral-agent-controller` | Código como evidencia, contratos, revisión y delegación | Unidad: fase; fixes internos sin orientación/branch por bug |
| `necktral-phase-execution` | Mandato, autonomía, paquetes y consolidación | No decide prioridades ni sustituye las tres Skills |
| Hooks, `./v4` y corredores oficiales | Controles ejecutables y evidencia | Reutilizar íntegros, sin clonar lógica |

## Incompatibilidades comprobadas y resolución

1. **Shadow Ledger genérico.** Skills antiguas describen EconomicEvent /
   JournalDraft / Shadow Ledger. La constitución V4 y D-60 exigen un solo kernel
   sin libro sombra. El mandato actual lo confirma. Conservar hecho económico,
   asiento/preasiento A y soporte B según código; no agregar contabilidad paralela.
2. **Un fix por tarea/branch.** El controlador propone esa división. El mandato
   autoriza fases y paquetes. Conservar trazabilidad/commits exigidos, sin hacer
   de ellos decisiones del propietario.
3. **Remoto y PC.** Recetas generales hablan de `origin/master`, PR y stash. La
   constitución dice commits locales sin remoto y protege escritor/FAB. No crear
   remoto, PR, sync ni stash. Leer GitHub V2/V3 no verifica V4.
4. **Aceptación.** La bitácora de fase 2 dice que no hizo falta nueva ratificación
   por entrega. Este mandato exige `READY_TO_CLOSE`, pendiente de aceptación
   formal; no presumir aceptación de una fase nueva por ese antecedente.
5. **Fábrica.** El foco protege worktrees; FAB-1 prohíbe usarlos para certificar.
   Proteger ambos; usar FAB solo como clones independientes.
6. **Gates.** Hay antecedentes que exigen gate por incremento. El mandato no los
   elimina: prohíbe añadir híbridos completos por cada fix cuando no se exigen.
   Inspeccionar reglas vigentes al inicio.

Son resoluciones acotadas sustentadas en el mandato recibido, no ediciones ni
derogaciones de Skills antiguas o constitución. Si una regla **vigente** contradice
el mandato sin resolución explícita aquí o por Wis, detener el frente y consolidar
el conflicto, sin reescribirla.

## Enrutamiento

Invocar explícitamente `$necktral-phase-execution` para la fase V4 autorizada.
Mantener `allow_implicit_invocation: false` durante esta activación controlada:
no se carga automáticamente sobre una sesión K2/FAB iniciada. Invocarla no ejecuta
código por sí misma ni autoriza alcance nuevo.

Si se cargan Skills generales, aplicar este reparto y citar fuente vigente de
cada diferencia. No copiar checklists completos. No reinstalar el ZIP antiguo:
comparte nombre con governance. Las Skills no se fusionan por nombre; duplicarlas
empeora enrutamiento.

## Límite de verificación

La revisión de coexistencia cubre instrucciones y archivos disponibles. No se
ejecutó Codex del usuario, sus hooks actuales, el `commit-msg` posterior al
snapshot ni sesiones activas. Integrar hooks queda pendiente de ese inventario
y autorización expresa; la Skill funciona sin hooks nuevos.
