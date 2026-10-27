# Registro de errores y guardas · Mis gastos móvil

**Qué es.** La lista de lo que ya nos mordió, con la **guarda** que impide que vuelva a morder. Vive en el árbol, versionada, compartida por todos los roles y todas las sesiones.

**Las tres reglas.**
1. **Una entrada sin guarda no está cerrada.** Mecánica si puede ser; si no, una pregunta obligatoria en un punto concreto del flujo. Sin guarda, la entrada queda **ABIERTA**.
2. **Se lee en el momento del riesgo, no en un índice.** El enganche de este proyecto es: [ficha de fase](PLANTILLA_FASE.md), cuyo **punto 0** es «qué entradas de este registro aplican y cómo se cumple cada una». «Ninguna aplica» se justifica.
3. **Cada cierre alimenta el registro.** El cierre lista qué guardas saltaron, cuáles callaron y qué entradas nuevas añade.

**Las guardas de banco de trabajo no se leen: se importan.** Están en `guardas.py`. Una guarda que vive en código actúa aunque nadie abra este fichero.

---

## E-01 · <qué se hizo mal, no qué salió mal>
**Clase:** criterio | instrumento | banco de trabajo · **Veces que saltó:** 0 · *<resumen de una línea>*
**<fecha>, <contexto> (error de <quién>).** <el hecho con su fuente: número, comando, commit, fichero>
**Por qué.** <la causa de método, no la técnica>
**Severidad.** <y en qué moneda: tiempo, una afirmación falsa en un informe, datos>
**Firma (cómo se detecta).** <el síntoma observable la próxima vez, antes de saber la causa>
**Guarda** `[MECÁNICA]` | `[PREGUNTA → punto N]`: <qué impide que vuelva>
**Aplicada en:** <fichero y función> | pendiente | **ABIERTA**

---

## Ejes no vigilados (agujeros declarados)

*Un registro sin eventos pero con ejes no vigilados no es un certificado de salud: es un certificado con agujeros declarados.*

- <error que hoy sólo detecta una persona leyendo; sin detector mecánico>

## Cómo añadir una entrada

Número siguiente, fecha, los campos del formato, y la guarda con su tipo. Si la guarda no puede ser mecánica, decir por qué y en qué punto del flujo va la pregunta.
