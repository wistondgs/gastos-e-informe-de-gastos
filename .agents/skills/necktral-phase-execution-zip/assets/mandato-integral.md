# Mandato integral de una fase aprobada

Usa `$necktral-phase-execution`. Este mandato cubre toda la fase; bloques internos
y bugs ordinarios no requieren nuevos prompts de dirección. Campos sin acreditar
no se convierten en hechos por estar en esta plantilla.

## Autoridad y línea base

- Entrega activa / fase exacta: [referencia existente; no inventar fase].
- Objetivo funcional y autorización: [texto + fuente].
- Ficha, precisiones, constitución y decisiones ratificadas: [rutas/secciones].
- Repositorio físico / rama / HEAD completo / base: [verificados].
- Índice, árbol, untracked, worktrees y WIP: [salida/ruta a evidencia].
- Escritor autorizado / recursos exclusivos: [identidad verificable].
- Campañas: [clon, proyecto, SHA, bloque, proceso/inicio, salida, estado verificado].
- Fuentes no disponibles o no verificadas: [lista acotada].

## Alcance completo

| Capacidad exigida | Resultado observable | Criterio de aceptación | Prueba/gate y evidencia |
| --- | --- | --- | --- |
| [capacidad de ficha] | [comportamiento] | [condición comprobable] | [comando/escenario y entorno] |

- Dependencias y decisiones pendientes con punto de parada: [referencias].
- Archivos/rutas autorizados: [exactos; tests, BUGS y procedencia necesarios].
- Archivos/dominios prohibidos: [exactos; K3/otros kernels/frontend fuera del alcance].
- Contratos API/eventos/BD y cambios ratificados: [versiones/diff esperado].
- Migraciones autorizadas, reversibilidad y datos permitidos: [condiciones].
- Invariantes: [aislamiento, permisos, dinero, auditoría, idempotencia e historia].
- Contabilidad: [diseño vigente A/B, sin libro sombra adicional].
- No objetivos: [deuda/capacidades fuera de ficha].

## Ejecución delegada

Inspecciona código y resultados; planifica por dependencias. Implementa todas las
capacidades hasta acreditarlas o hallar un bloqueo legítimo. Por cada defecto: BUG real
→ rojo causal → antecedente/marca bilateral exigidos → arreglo acotado → verde
→ regresiones. Agrupa relacionados en un paquete causal, preservando IDs/commits.
Resuelve C2 autorizados sin orientación por bug. No inventes evidencia ni regularices
historia sin la decisión requerida. Conserva controles, incluido `commit-msg`.

## Pruebas y certificación

- Dirigidas/regresión: [comandos reales, expectativas y recursos].
- Gates por incremento: [fuente exacta; sin dispensas nuevas].
- Gate oficial / negativos completos / híbrido de bloque: [comandos reales/fuente].
- Revisión independiente: [revisor/procedimiento, base y candidato].
- Dependencias, respaldo y otros requisitos: [fuente y evidencia].
- Causalidad/restauración: [resultados exigidos y ubicaciones existentes].
- SHA: congela candidato; cada evidencia aplica a su SHA completo; recertifica
  gates pertinentes tras cambios conforme al procedimiento vigente.
- Campaña válida viva: obsérvala; no la dupliques ni cambies clon/SHA.

## Paradas y resultado

Detén operación afectada y alerta inmediatamente ante C1, decisión no ratificada,
ruptura contractual, migración insegura, salida de alcance, concurrencia peligrosa,
cambio constitucional/de procedencia, SHA incompatible o tres rechazos del mismo
bloque. Solo lectura segura o trabajo probado independiente y autorizado. No
acumules C1 silenciosamente. Consolida pendientes en un informe con hechos/sospechas,
causas, opciones, decisiones reservadas y acciones para reanudar.

Entrega `READY_TO_CLOSE` acreditado y pendiente de aceptación formal de Wis;
si falta requisito/evidencia, `BLOCKED` con informe único. No aceptes por Wis ni
inicies la siguiente fase. Reutiliza registros existentes y estas plantillas;
no crees roadmap ni certificador paralelo.
