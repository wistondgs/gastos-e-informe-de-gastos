# Instrucciones del proyecto de gastos móvil

Este proyecto es autónomo. Sus fases, reglas y pruebas se rigen por el mandato del usuario y los documentos del proyecto de gastos; no se aplican automáticamente procedimientos de ERP V4.

Antes de iniciar o retomar una fase autorizada, leer `ERRORES_Y_GUARDAS.md` y completar el punto 0 de una ficha de fase basada en `PLANTILLA_FASE.md`: entradas aplicables y cumplimiento de sus guardas; si ninguna aplica, justificarlo. Ejecutar los mutantes de `guardas.py` con un archivo de contadores de prueba separado antes de dar la ficha por final; no confundir esos saltos deliberados con los contadores reales. Las pruebas de las pruebas preceden a la ejecución real. Si refutan un criterio, corregir la ficha antes de continuar.

Registrar los errores propios efectivamente ocurridos en este proyecto, con evidencia, firma y guarda según `MODELO_ERRORES_Y_GUARDAS.md`. Una entrada sin guarda queda ABIERTA. Una guarda mecánica nueva lleva su mutante; una pregunta obligatoria debe estar vinculada a un punto que efectivamente se use. No importar errores ni guardas de dominio de otro proyecto por mera precaución.

Al cerrar una unidad, informar guardas consultadas, saltos, silencios y errores nuevos. Revisar las guardas detectoras que no salten en dos unidades, diferenciando las preventivas por construcción. Las pruebas de mutación usan contadores aislados; los contadores reales reflejan las consultas reales y no son una garantía de registro infalible.
