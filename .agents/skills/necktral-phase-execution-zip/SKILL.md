---
name: necktral-phase-execution-zip
description: Dirigir una fase funcional aprobada de ERP V4 con un mandato integral a Codex, correcciones autónomas agrupadas, escalamiento inmediato de C1 y certificación del SHA exacto. Usar al iniciar, continuar, desbloquear o cerrar una fase autorizada o un paquete de reparación de esa fase. No usar para elegir roadmap, ejecutar otra fase, desarrollar otros kernels ni resolver consultas genéricas.
---

# Ejecución de fases de ERP V4

## Fijar la autoridad

Mantener un solo objetivo: la fase aprobada dentro de la entrega activa del
`ROADMAP.md`. No convertir hallazgos, commits ni bloques internos en nuevas fases.
Aplicar el mandato explícito de Wis y la constitución vigente; no ratificar decisiones.
Leer [compatibilidad](references/compatibilidad.md) al coexistir con otras Skills.
No importar el Shadow Ledger de versiones anteriores: conservar el diseño contable
ratificado de V4, con un solo kernel y los modos A/B que realmente existan.

## 1. Iniciar o recuperar

Leer completos `AGENTS.md` y `CLAUDE.md`; después el estado relevante de `ROADMAP.md`,
las decisiones ratificadas de `LOG.md`, ficha y precisiones de la fase, contratos,
código y evidencias. Verificar rama, HEAD, Git, worktrees y quién escribe o certifica.
No confundir un ZIP histórico con un repositorio vivo ni un reporte con una prueba ejecutada.

Rellenar [mandato integral](assets/mandato-integral.md) UNA vez por fase. Resolver datos
faltantes mediante lectura; consolidar únicamente lo que requiera decisión externa.
No inventar rutas, ratificaciones, sintaxis de hooks, pruebas rojas ni resultados.
Inspeccionar los controles instalados antes de agregar o ejecutar cualquiera.

Usar [ciclo y autonomía](references/ejecucion.md) para establecer la línea base y
una matriz capacidad → criterio → prueba → evidencia. Planificar internamente por
dependencias y conservar las unidades de commit exigidas, sin pedir microorientaciones.
Usar el estado oficial del roadmap; las anotaciones de ejecución no lo sustituyen.

## 2. Ejecutar dentro del mandato

Completar todas las capacidades aprobadas. Reproducir cada defecto; registrarlo en
`BUGS.md` antes de su prueba roja causal y antes del arreglo. Versionar la ficha,
el rojo y las marcas de procedencia en el orden exigido por los controles actuales.
Aplicar el cambio de menor alcance que resuelva la causa, obtener verde y comprobar
regresiones relacionadas. Un mensaje `test(rojo)` no acredita un fallo real.

Agrupar C2/C3 relacionados por causa y dependencia en un paquete interno. Conservar
la identidad y evidencia de cada bug. Resolver autónomamente lo reproducible,
reversible, autorizado y sin decisión nueva; no esperar permiso para cada arreglo.
No convertir el agrupamiento en un único commit si el contrato exige separarlos.
Consultar [certificación](references/certificacion.md) antes de repetir pruebas costosas.

## 3. Parar la operación afectada y escalar de inmediato

Emitir `BLOCKED` y una alerta inmediata ante C1 de dinero, contabilidad, stock,
seguridad, permisos, auditoría o historia; decisión arquitectónica/de negocio no
ratificada; ruptura contractual; migración destructiva no aprobada; cambio fuera
de alcance; conflicto de escritores; cambio constitucional/de procedencia; o
certificación inválida por SHA. Ante una sospecha fundada de C1, contener primero
y verificar de forma segura, sin afirmar que el defecto está confirmado.

Preservar evidencia, WIP y procesos. No ejecutar la operación insegura, arreglar
silenciosamente el C1, completar el plan dependiente ni esperar cinco hallazgos.
Continuar solo diagnóstico de lectura o trabajo demostrablemente independiente
y seguro dentro del mandato, nunca sobre recursos afectados o compartidos en disputa.
Aplicar también el tope vigente de tres rechazos del mismo bloque.

Consolidar el resto en [informe de bloqueadores](assets/bloqueadores.md). Actualizar
ese mismo informe con decisiones y alcance de reanudación; no abrir una orientación
por cada bug. Si hay una campaña segura activa, no interrumpirla ni duplicarla por
el bloqueo de otro recurso. Ver [ejecución](references/ejecucion.md).

## 4. Certificar sin interferir

Revisar diff, contratos e invariantes; obtener revisión independiente con contexto
fresco según el protocolo existente. Congelar un SHA candidato y verificarlo en
cada evidencia. Ejecutar compuerta oficial, negativos completos/híbridos aplicables,
causalidad, restauración, dependencias y respaldo exigidos por las fuentes vigentes.
No reducir gates por velocidad ni dar un dirigido por certificación integral.

Antes de iniciar una campaña, verificar clon, SHA, bloque, entorno, proceso y salida.
Si la misma campaña válida sigue viva, observarla; no reiniciarla, lanzar otra,
modificar su SHA, limpiar su árbol, cambiar hooks ni matar procesos.
Los clones FAB son clones desechables, nunca worktrees; no crear commits allí.
Un cambio de SHA requiere acreditar de nuevo los gates pertinentes conforme al
procedimiento vigente. No trasladar un certificado antiguo ni usar igualdad de árbol
como sustituto de identidad de commit. Ver [certificación](references/certificacion.md).

## 5. Entregar y esperar aceptación

Usar [aceptación técnica](assets/aceptacion-tecnica.md): `READY_TO_CLOSE` solamente
con todos los criterios y evidencias exigidos; significa pendiente de aceptación
formal de Wis. En otro caso, `BLOCKED`, con UN informe consolidado y acciones
concretas. Una campaña aún ejecutándose no acredita el cierre.
No marcar aceptación, modificar el estado oficial ni empezar la siguiente fase.

## Cuándo no intervenir

No reabrir decisiones ni auditorías cerradas sin evidencia nueva. No solicitar
confirmación por decisiones ya autorizadas, C2 resolubles, commits ordinarios o
correcciones dentro del mandato. No sanear WIP ajeno ni hacer stash/reset/sync por
rutina. No intervenir en una certificación válida activa. No implementar deuda,
K3, frontend ni herramientas ajenas a la capacidad aprobada.

## Recursos de uso condicionado

- [Integración y guarda opcional](references/integracion.md): instalación, hooks, límites y reversión; leer antes de instalar controles.
- [Métricas](references/metricas.md): medir intervenciones y repeticiones por fase sin calendario.
- [Evidencia disponible](references/evidencia.md): alcance histórico del diseño; nunca usarlo como estado actual.
- [Validación reproducible](references/validacion.md): pruebas de la guarda y escenarios conductuales A–F; leer al validar cambios de esta Skill.
