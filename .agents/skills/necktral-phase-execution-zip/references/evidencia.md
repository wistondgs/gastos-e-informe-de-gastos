# Evidencia disponible y límites del diseño

## Fuentes realmente inspeccionadas

Esta versión fue construida el 21 de octubre de 2026 (America/Managua) a partir
exclusivamente de los archivos aportados y las Skills disponibles. No accedió al
repositorio vivo de la PC, no consultó GitHub para afirmar estado de V4 y no ejecutó
Docker, gates, migraciones, negativos ni respaldos de ERP V4.

El snapshot `ERP_V4.zip` tiene HEAD completo `307ee83e73eb41fed679721b2f269b47e2508bcf`,
posterior al candidato de fase 2 `00ca555904a68d076b42ff456e17b8dcd3c940dc`.
Su `ROADMAP.md` dice fase 1/2 DONE y fase 3 aún no iniciada por O-1/D-72 3A.
Se leyó `AGENTS.md`, `CLAUDE.md` completo, partes pertinentes de `ROADMAP.md`,
`LOG.md`, ficha EF-3/precisiones, código de hechos/modelos/API de K2, contratos,
procedencia/autopruebas, entorno FAB, gate, corredores y reportes. La lectura de
`hechos.guardar()` confirma que ese snapshot aún rechaza modo A y hechos sin
sucursal: evidencia de su antigüedad, no un nuevo bug de la fase actual.

En `fabrica_v4.zip` se inspeccionaron inventario, HEAD archivados y los documentos,
scripts/reportes pertinentes de los clones aportados. c1 y c2 apuntan a `00ca555…`;
no se encontró c4. Los otros clones conservan referencias históricas. Ninguno
permite observar procesos vivos ni el candidato c120d943… del último reporte.
No se arrancó ni restauró ninguno de esos entornos.

Se compararon las tres Skills instaladas de Necktral y `skill.zip`, que contiene
una versión de `necktral-project-governance`, no la nueva Skill. Las planillas
adjuntas no se leyeron: no son necesarias para el mecanismo y no se incorporan
sus datos a esta entrega.

## Estado relatado, no acreditado con estos snapshots

Fase 3 completada, fase 4 D-72 3A, candidato
`c120d9435d5d95a8a4ff209660ac4a8cb79cffda`, gate verde, revisión favorable,
B-01/B-02 y FAB-1/c4 en ejecución son el último reporte suministrado por Wis.
No se encontró evidencia de ese SHA, BUG-115/116/117 o D-80/D-81 en los archivos
pertinentes inspeccionados. No equivale a refutar el reporte: las fuentes son
anteriores. La Skill obliga a leer sus versiones actuales antes de integrar.

Los reportes adjuntos tienen identidades distintas: gate oficial de `307ee83…`,
híbrido p34 de `ec1bb29…`, negativos completos de `e4adfc7…`. No se combinan ni
se convierten en evidencia del candidato de fase 4. El snapshot no aporta un
`commit-msg` instalado activo; no se presume su inexistencia en la PC.

## Identidad de las entradas

| Archivo aportado | SHA-256 |
| --- | --- |
| 01-skill.zip | `8f71d0571123dd75fa6240aac08dc947155a8125e41851688149e4ca35c7db6c` |
| 06-fabrica_v4.zip | `cdc2107e0538effa885bffd00432b544ba1d9f78c90954df4356c8a3ddb3a64a` |
| 05-ERP_V4.zip | `fe942d89c0b2d9a54d8e806344aae1861a0d8811f07e92bfa5ab86b3e497e8f3` |

El manifiesto de validación conserva además SHA-256 de los archivos canónicos
leídos. Las entradas originales se mantuvieron intactas. Solo se crearon el
paquete de la Skill, pruebas y evidencias en directorios separados.

## Activación recomendada para K2

Guardar/instalar la Skill a nivel usuario, con invocación explícita, fuera del
ERP. No introducirla sobre una sesión o campaña viva. Comprobar estado actual
en lectura; si c4 sigue certificado en curso, observarlo sin intervenir. Usar
el nuevo mandato en la próxima continuación autorizada de la misma fase; si ya
cumple todos sus requisitos, proponer READY_TO_CLOSE y esperar aceptación.

La integración opcional de hooks requiere inventariar la versión viva y aprobar
el fragmento, política/hash y path efectivo concretos. Esa autorización no es
necesaria para construir, probar ni guardar esta Skill, y no se pidió durante
su elaboración. No hay cambio propuesto a contabilidad, API/eventos, constitución,
roadmap, K3 ni otras capacidades del ERP.
