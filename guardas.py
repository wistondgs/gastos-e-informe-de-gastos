#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""guardas · esqueleto portátil. Las guardas de banco de trabajo, en código.

POR QUÉ ESTA CAPA EXISTE
Un registro de errores en prosa sólo actúa cuando alguien abre el documento donde se
obliga a consultarlo. Los errores de banco de trabajo ocurren ENTRE documentos, en
comandos improvisados. Una guarda que se importa actúa aunque nadie recuerde la libreta.

CÓMO SE USA
    from guardas import no_vacio, matar_por_pid, salida_a_fichero, contrato
    n = no_vacio(filas, "filas a comparar")      # aborta si son cero
    print(f"comparadas {n} filas")               # el informe usa ESE n, no una constante

CÓMO SE AMPLÍA
Las tres primeras funciones son portátiles a cualquier proyecto. Las de DOMINIO se añaden
al final, una por error ya cometido, siguiendo el contrato de abajo. No se añaden guardas
para errores hipotéticos: el criterio de admisión es sólo lo que ya falló.

EL CONTRATO DE UNA GUARDA
  1. Levanta GuardaViolada cuando detecta lo que vigila. No devuelve False: aborta.
  2. Devuelve el dato útil cuando pasa, para que el informe use ese valor y no una
     constante escrita a mano.
  3. Cuenta sus consultas y sus saltos, para que el cierre pueda medirla.
  4. Tiene su mutante en el bloque __main__. Una guarda que no puede fallar no es guarda.
  5. Si es PREVENTIVA POR CONSTRUCCIÓN (no detecta, hace imposible el error), se registra
     con el sufijo [constructiva]: nunca saltará, y su silencio no es síntoma.
"""
from __future__ import annotations

import json
import os
import signal
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
CONTADORES = os.environ.get("GUARDAS_CONTADORES",
                            os.path.join(AQUI, "guardas_contadores.json"))


class GuardaViolada(AssertionError):
    """Una guarda detectó exactamente lo que vigila. Es un alto, no un aviso."""


def _contar(guarda, salto):
    """Registra la consulta y si saltó. Nunca estorba a quien la llama."""
    try:
        d = {}
        if os.path.exists(CONTADORES):
            try:
                d = json.load(open(CONTADORES, encoding="utf-8"))
            except ValueError:
                d = {}
        e = d.setdefault(guarda, {"consultada": 0, "salto": 0, "ultimo_salto": None})
        e["consultada"] += 1
        if salto:
            e["salto"] += 1
            e["ultimo_salto"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        os.makedirs(os.path.dirname(os.path.abspath(CONTADORES)) or ".", exist_ok=True)
        json.dump(d, open(CONTADORES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    except OSError:
        pass


def contrato(nombre, condicion, mensaje, constructiva=False):
    """Atajo para escribir una guarda nueva en una línea, cumpliendo el contrato.

        contrato("importe_decimal", isinstance(x, Decimal),
                 f"{x!r} es float donde debe haber Decimal")

    `condicion` es lo que debe ser CIERTO. Si es falsa, salta.
    """
    salto = not condicion
    _contar(f"{nombre}[constructiva]" if constructiva else nombre, salto)
    if salto:
        raise GuardaViolada(f"[{nombre}] {mensaje}")
    return True


# ---------------------------------------------------------------------------
# Portátiles · sirven en cualquier proyecto
# ---------------------------------------------------------------------------
def no_vacio(coleccion, nombre, minimo=1):
    """Una verificación sobre cero elementos no es una verificación.

    El error que previene: filtrar una lista, que el filtro no case con nada, recorrer
    cero elementos y leer «ninguna diferencia» como confirmación. El falso verde perfecto.

    Devuelve el recuento, para que el informe use ESE número. Un «ninguno» que no viene
    con su recuento al lado no es un resultado: es una cadena de texto.
    """
    n = len(coleccion)
    salto = n < minimo
    _contar("no_vacio", salto)
    if salto:
        raise GuardaViolada(
            f"«{nombre}» tiene {n} elementos y hacen falta al menos {minimo}. "
            f"Cualquier conclusión sobre esto sería un falso verde.")
    return n


def matar_por_pid(pid, espera=3.0):
    """Matar por patrón puede matar al que llama.

    El error que previene: `pkill -f nombre_del_script` coincide también con la shell que
    lo ejecuta, porque el patrón está en su línea de órdenes. El comando se mata a sí
    mismo y lo que venía después del `;` no se ejecuta, en silencio.
    """
    salto = pid in (os.getpid(), os.getppid())
    _contar("matar_por_pid", salto)
    if salto:
        raise GuardaViolada(f"PID {pid} es este proceso o su padre: matarlo es el error.")
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return "ya no existía"
    fin = time.time() + espera
    while time.time() < fin:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return "terminado con SIGTERM"
        time.sleep(0.1)
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        return "terminado con SIGTERM"
    return "terminado con SIGKILL"


def salida_a_fichero(ruta, etiqueta="", permitir_efimero=False):
    """PREVENTIVA POR CONSTRUCCIÓN. No detecta nada: hace imposible el error.

    El error que previene: un proceso largo cuya salida va por `| tail` (o `head`, o
    `sort`, o `grep` sin --line-buffered). Esas órdenes no entregan nada hasta que el
    proceso termina, y un proceso que muere por un tope de tiempo NO termina: la salida
    se pierde entera y no sabes ni por dónde iba.

    Devuelve un fichero en modo línea-a-línea. Llama a .flush() tras cada hito, o invoca
    el programa con `python3 -u`.
    """
    # 26-oct · AMPLIADA tras caer en la variante que no cubría: escribí a un fichero,
    # pero en el directorio temporal de la sesión, que se borra al terminarla. Perdí la
    # salida igual que con una tubería. «A fichero» no basta: tiene que ser a un sitio
    # DURABLE, al lado del artefacto. Esta parte sí detecta, así que la guarda es mixta.
    EFIMERO = ("/tmp/", "/var/tmp/", "/dev/shm/", "/run/")
    absoluta = os.path.abspath(ruta)
    efimero = absoluta.startswith(EFIMERO) or "/scratchpad" in absoluta
    _contar("salida_a_fichero", efimero)
    if efimero and not permitir_efimero:
        raise GuardaViolada(
            f"«{absoluta}» está en un directorio temporal que no sobrevive a la sesión. "
            f"Una salida que no dura no es custodia: escribe al lado del artefacto, en el "
            f"árbol. Si de verdad es desechable, pasa permitir_efimero=True y dilo.")
    _contar("salida_a_fichero[constructiva]", False)
    os.makedirs(os.path.dirname(os.path.abspath(ruta)) or ".", exist_ok=True)
    f = open(ruta, "a", encoding="utf-8", buffering=1)
    if etiqueta:
        f.write(f"# {etiqueta} · {time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
        f.flush()
    return f


def campo_de(registro, campo, porque=""):
    """La pertenencia se deriva de un CAMPO, nunca de la posición ni del orden de llegada.

    El error que previene: deducir a qué grupo pertenece una fila por su posición en el
    fichero, justo después de haber cambiado el orden en que se escriben las filas.
    """
    salto = campo not in registro
    _contar("campo_de", salto)
    if salto:
        raise GuardaViolada(
            f"el registro no lleva «{campo}», así que sólo podría deducirse de su "
            f"posición, que es el error. {porque} Campos presentes: {sorted(registro)[:12]}")
    return registro[campo]


# ---------------------------------------------------------------------------
# DOMINIO · una por error ya cometido. Borra estos ejemplos y pon los vuestros.
# ---------------------------------------------------------------------------
def ejemplo_dominio_migracion_reversible(migracion):
    """EJEMPLO ILUSTRATIVO, no es una guarda real de ningún proyecto.

    Muestra la forma: un error de dominio ya cometido, su firma, y la condición que lo
    hace imposible. Sustituir por las del proyecto.
    """
    return contrato(
        "migracion_reversible",
        getattr(migracion, "inversa", None) is not None,
        f"la migración {getattr(migracion, 'nombre', migracion)!r} no trae inversa probada")


# ---------------------------------------------------------------------------
def sin_azar_usado(modulos, nombre="nuestros módulos"):
    """E-07 corregida el 27-oct · comprobar USO de azar, no su importación.

    El error: el artefacto registraba «random importado: SÍ» y la frase «sin random» dejó
    de ser verificable. Pero `random` estaba en sys.modules porque lo importa `statistics`
    —que nosotros usamos para un cuantil normal— y también `tempfile`. Ninguna línea
    nuestra llama a `random`. Comprobar la importación mide a las dependencias; lo que hay
    que medir es si NOSOTROS lo usamos.

    Se analiza el ÁRBOL SINTÁCTICO, no el texto. La primera versión usaba una expresión
    regular y se cazó a sí misma: encontró `import random` dentro de una cadena de su
    propio mutante. Una guarda que da falsos positivos se acaba ignorando, y eso es peor
    que no tenerla. La regex nombraba el mecanismo (un patrón de texto); el AST nombra la
    propiedad (un uso real en el código).

    Devuelve la lista de usos, vacía si está limpia.
    """
    import ast as _ast
    usos = []
    for ruta in modulos:
        try:
            arbol = _ast.parse(open(ruta, encoding="utf-8").read())
        except (OSError, SyntaxError):
            continue
        for nodo in _ast.walk(arbol):
            if isinstance(nodo, _ast.Import):
                for a in nodo.names:
                    if a.name.split(".")[0] == "random":
                        usos.append((os.path.basename(ruta), nodo.lineno, f"import {a.name}"))
            elif isinstance(nodo, _ast.ImportFrom):
                if (nodo.module or "").split(".")[0] == "random":
                    usos.append((os.path.basename(ruta), nodo.lineno, f"from {nodo.module} import …"))
            elif isinstance(nodo, _ast.Attribute):
                v = nodo.value
                if isinstance(v, _ast.Name) and v.id == "random":
                    usos.append((os.path.basename(ruta), nodo.lineno, f"random.{nodo.attr}"))
    _contar("sin_azar_usado", bool(usos))
    if usos:
        raise GuardaViolada(
            f"«{nombre}» usa azar en {len(usos)} sitio(s): {usos[:5]}. La afirmación "
            f"«determinista» no se sostiene.")
    return usos


def informe(out=sys.stdout):
    """Lo que el cierre necesita: qué guardas saltaron y cuáles callaron."""
    if not os.path.exists(CONTADORES):
        out.write("sin contadores todavía\n")
        return {}
    d = json.load(open(CONTADORES, encoding="utf-8"))
    out.write(f"{'guarda':<32}{'consultada':>11}{'saltó':>7}  último salto\n")
    for k, v in sorted(d.items()):
        out.write(f"{k:<32}{v['consultada']:>11}{v['salto']:>7}  {v['ultimo_salto'] or '—'}\n")
    calladas = [k for k, v in d.items() if v["salto"] == 0 and "[constructiva]" not in k]
    constructivas = [k for k in d if "[constructiva]" in k]
    if calladas:
        out.write(f"\nCALLADAS Y DETECTORAS · revisar: o el error ya no es posible (cerrar la "
                  f"entrada como «resuelta por construcción») o la guarda no detecta y hay "
                  f"que rehacerla → {', '.join(calladas)}\n")
    if constructivas:
        out.write(f"CONSTRUCTIVAS · no saltan por diseño; su silencio no es síntoma y NO "
                  f"entran en la regla de poda → {', '.join(constructivas)}\n")
    return d


if __name__ == "__main__":
    # Mutantes: cada guarda tiene que poder fallar. Si todos pasan, las guardas sirven.
    print("=== mutantes de las guardas ===")
    ok = {}

    try:
        no_vacio([], "lista vacía")
        ok["no_vacio detecta la colección vacía"] = False
    except GuardaViolada:
        ok["no_vacio detecta la colección vacía"] = True
    ok["no_vacio devuelve el recuento"] = (no_vacio([1, 2, 3], "tres") == 3)

    try:
        matar_por_pid(os.getpid())
        ok["matar_por_pid se niega a suicidarse"] = False
    except GuardaViolada:
        ok["matar_por_pid se niega a suicidarse"] = True

    try:
        campo_de({"id": 1}, "grupo")
        ok["campo_de detecta el registro sin el campo"] = False
    except GuardaViolada:
        ok["campo_de detecta el registro sin el campo"] = True
    ok["campo_de devuelve el valor"] = (campo_de({"grupo": "A"}, "grupo") == "A")

    try:
        contrato("prueba", False, "debe saltar")
        ok["contrato salta cuando la condición es falsa"] = False
    except GuardaViolada:
        ok["contrato salta cuando la condición es falsa"] = True
    ok["contrato pasa cuando es cierta"] = contrato("prueba", True, "no debe saltar")

    try:
        salida_a_fichero("/tmp/prueba_guardas/salida.txt")
        ok["salida_a_fichero detecta el destino efímero"] = False
    except GuardaViolada:
        ok["salida_a_fichero detecta el destino efímero"] = True
    import tempfile as _tf
    _d = _tf.mkdtemp(dir=AQUI)
    try:
        f = salida_a_fichero(os.path.join(_d, "ok.txt"), "mutante")
        f.close()
        ok["salida_a_fichero deja pasar el destino durable"] = True
    except GuardaViolada:
        ok["salida_a_fichero deja pasar el destino durable"] = False
    import shutil as _sh
    _sh.rmtree(_d, ignore_errors=True)

    import tempfile as _t2
    _f = os.path.join(_t2.mkdtemp(dir=AQUI), "usa_azar.py")
    open(_f, "w").write("import random\nx = random.random()\n")
    try:
        sin_azar_usado([_f], "fichero que sí usa azar")
        ok["sin_azar_usado detecta el uso real"] = False
    except GuardaViolada:
        ok["sin_azar_usado detecta el uso real"] = True
    _g = os.path.join(os.path.dirname(_f), "solo_importa_dependencia.py")
    open(_g, "w").write("from statistics import NormalDist\n# random entra por statistics\n")
    try:
        sin_azar_usado([_g], "fichero limpio")
        ok["sin_azar_usado NO se queja de la dependencia"] = True
    except GuardaViolada:
        ok["sin_azar_usado NO se queja de la dependencia"] = False
    import shutil as _s2
    _s2.rmtree(os.path.dirname(_f), ignore_errors=True)

    for k, v in ok.items():
        print(f"  [{'OK' if v else 'ROTO'}] {k}")
    print(f"LAS GUARDAS {'SIRVEN' if all(ok.values()) else 'ESTÁN ROTAS'}\n")
    informe()
    sys.exit(0 if all(ok.values()) else 1)
