# Métricas por fase, sin calendario

Reutilizar el informe de aceptación; no instalar un tablero o servicio nuevo.
Medir fases comparables por capacidades, riesgo y superficie. No confundir
una fase trivial con mejora del proceso ni presentar porcentajes sin denominador.

| Métrica | Cálculo | Interpretación |
| --- | --- | --- |
| Orientaciones por fase | Mandato inicial + continuaciones que contienen una decisión/dirección nueva | Tender a 1 + bloqueos legítimos, no a 1 a costa de ocultar C1 |
| Microconsultas evitables | Consultas de C2 ordinarios ya autorizados / C2 autorizados | Objetivo inicial: 0; no cuenta alertas C1 ni decisiones reservadas |
| Resolución agrupada | Bugs relacionados resueltos en paquetes / bugs relacionados totales | Debe aumentar conservando evidencia individual |
| Repeticiones evitables | Gates/campañas repetidos sin cambio pertinente ni exigencia / campañas ejecutadas | Objetivo inicial: 0; separar repeticiones necesarias por SHA/corrección |
| Carga administrativa | Minutos activos de Wis en prompts, transferencias y reconstrucción de estado / capacidades aceptadas | Comparar con línea base propia; no incluye espera de pruebas |
| Autonomía efectiva | C2 dentro de mandato resueltos sin intervención / C2 dentro de mandato | Medir denominador y causas de excepción, no autoevaluaciones |
| Integridad de certificación | Evidencias exigidas con SHA/entorno/cobertura válidos / evidencias exigidas | Debe ser 100% al proponer cierre |
| C1 escapados | C1 encontrados después de READY_TO_CLOSE o aceptación | Meta: 0; si aumenta, revisar antes de ampliar autonomía |
| Contención C1 | Operaciones inseguras ejecutadas tras detectar riesgo / C1 detectados | Debe ser 0; alertar en el mismo ciclo de detección |
| Cumplimiento funcional | Criterios obligatorios acreditados / criterios obligatorios | 100% para READY_TO_CLOSE; un commit no suma capacidad por sí solo |

Levantar una línea base de fases o paquetes anteriores con datos disponibles,
sin reconstruir tiempos inventados. Si no hay registro de minutos, usar un
conteo prospectivo simple en el informe existente y marcar el pasado «no medido».

Evaluar después de una fase aceptada y comparable. La solución mejora si baja
orientación/capacidad y carga administrativa, desaparecen duplicaciones evitables
y no empeoran C1 escapados, contención, cobertura ni rechazos. No hay reducción
porcentual prometida antes del ensayo real. Si falla, ajustar la Skill o retirar
la guarda opcional; nunca reducir pruebas obligatorias para mejorar el indicador.
