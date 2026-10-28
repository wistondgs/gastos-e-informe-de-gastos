#!/usr/bin/env python3
"""Guarda local opcional de alcance/Git. Solo lectura; no certifica pruebas ni procedencia."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys


class Blocked(Exception):
    """Precondición de la operación incumplida."""


def require(condition, message):
    if not condition:
        raise Blocked(message)


def git(repo, *args, allow_missing=False):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, GIT_OPTIONAL_LOCKS="0")
    command = ["git", "--no-optional-locks", "-c", "core.hooksPath=/dev/null",
               "-c", "core.fsmonitor=false", "-C", str(repo), *args]
    result = subprocess.run(command, env=env, capture_output=True, timeout=5)
    if result.returncode == 1 and allow_missing and args[0] == "config":
        return b""
    if result.returncode:
        raise Blocked("Git no pudo verificar el estado requerido: " + args[0])
    return result.stdout


def lines0(raw):
    return [os.fsdecode(p) for p in raw.split(b"\0") if p]


def is_inside(path, root):
    return path == root or root in path.parents


def route(value):
    require(isinstance(value, str) and value, "Ruta de política vacía o no textual")
    raw = value[:-1] if value.endswith("/") else value
    require(raw and not raw.startswith("/") and "\\" not in raw, "Ruta no relativa POSIX")
    require(not any(c in raw for c in "*?[]\x00\r\n"), "Usar rutas literales, sin globs ni controles")
    require(all(p not in ("", ".", "..") for p in raw.split("/")), "Ruta no canónica")
    require(not PurePosixPath(raw).is_absolute(), "Ruta absoluta no permitida")
    return value


def matches(path, rule):
    return path.startswith(rule) if rule.endswith("/") else path == rule


def load_policy(path, expected_hash):
    require(re.fullmatch(r"[0-9a-f]{64}", expected_hash) is not None, "Hash aprobado ausente o inválido")
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == expected_hash, "La política difiere del hash aprobado")
    policy = json.loads(raw)
    keys = {"schema", "objective", "approval_reference", "repository_root", "branch",
            "baseline_sha", "role", "allowed_paths", "forbidden_paths", "protected_roots", "frozen_sha"}
    require(isinstance(policy, dict) and set(policy) == keys, "Esquema de política incompleto o desconocido")
    require(type(policy["schema"]) is int and policy["schema"] == 1, "Versión de política no admitida")
    for key in ("objective", "approval_reference", "repository_root", "branch"):
        require(isinstance(policy[key], str) and policy[key].strip(), "Falta " + key)
        require("REEMPLAZAR" not in policy[key], "La plantilla no es una autorización")
    require(policy["role"] in ("development", "certification"), "Rol no admitido")
    for key in ("allowed_paths", "forbidden_paths"):
        require(isinstance(policy[key], list) and bool(policy[key]), "Lista de rutas obligatoria: " + key)
        for p in policy[key]:
            route(p)
    require(isinstance(policy["protected_roots"], list), "Falta lista de clones protegidos")
    for p in policy["protected_roots"]:
        require(isinstance(p, str) and Path(p).is_absolute(), "Clon protegido no absoluto")
    for key in ("baseline_sha", "frozen_sha"):
        value = policy[key]
        require(value is None and key == "frozen_sha" or
                isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None,
                "SHA completo requerido: " + key)
    return policy


def check(repo, policy, operation):
    require(repo.is_dir(), "No existe el repositorio")
    root = Path(os.fsdecode(git(repo, "rev-parse", "--show-toplevel")).strip()).resolve()
    require(root == repo, "Indicar la raíz física del repositorio, no una subcarpeta")
    require(Path(policy["repository_root"]).is_absolute() and
            Path(policy["repository_root"]).resolve() == root, "La política pertenece a otro repositorio")
    for protected in policy["protected_roots"]:
        require(not is_inside(root, Path(protected).resolve()), "Clon/recurso protegido: no operar")
    require(policy["role"] == "development", "FAB no admite escrituras ni commits propios de esta guarda")
    require(policy["frozen_sha"] is None, "Candidato congelado: no mutar ni commitear")
    branch = os.fsdecode(git(root, "rev-parse", "--abbrev-ref", "HEAD")).strip()
    require(branch == policy["branch"] and branch != "HEAD", "Rama incorrecta o HEAD separado")
    head = os.fsdecode(git(root, "rev-parse", "HEAD")).strip()
    git(root, "merge-base", "--is-ancestor", policy["baseline_sha"], head)
    require(not git(root, "ls-files", "-u", "-z"), "Hay conflictos sin resolver")
    markers = ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer", "index.lock")
    git_dir = Path(os.fsdecode(git(root, "rev-parse", "--absolute-git-dir")).strip())
    for marker in markers:
        require(not (git_dir / marker).exists(), "Operación Git o bloqueo activo: " + marker)
    # diff del árbol puede activar clean/process. Rechazar filtros externos antes de invocarlo.
    filters = git(root, "config", "--includes", "--name-only", "--get-regexp",
                  r"^filter\..*\.(clean|process|smudge|required)$", allow_missing=True)
    require(not filters, "Filtros Git externos configurados: guarda no compatible sin revisión")
    tags = git(root, "ls-files", "-v", "-z").split(b"\0")
    require(not any(p and (p[:1] == b"S" or p[:1].islower()) for p in tags),
            "Índice con assume-unchanged/skip-worktree: no se pueden descartar cambios ocultos")
    # --no-renames devuelve origen borrado y destino añadido: no blanquear rutas por renombre.
    staged = lines0(git(root, "diff", "--cached", "--name-only", "--no-renames",
                        "--no-ext-diff", "--no-textconv", "-z", "--"))
    changed = set(lines0(git(root, "diff", "HEAD", "--name-only", "--no-renames", "--no-ext-diff", "--no-textconv", "-z", "--")))
    changed.update(staged)
    changed.update(lines0(git(root, "ls-files", "--others", "--exclude-standard", "-z")))
    require(operation != "commit" or bool(staged), "No hay cambios preparados para commit")
    for path in sorted(changed):
        route(path)
        require(not any(matches(path, p) for p in policy["forbidden_paths"]), "Ruta prohibida: " + repr(path))
        require(any(matches(path, p) for p in policy["allowed_paths"]), "Ruta fuera del mandato: " + repr(path))
        require(is_inside((root / path).resolve(), root), "Ruta resuelve fuera del repositorio: " + repr(path))
    # Revisar ambos lados: una eliminación ya no aparece en el índice nuevo.
    modes = git(root, "ls-files", "--stage", "-z") + git(root, "ls-tree", "-r", "-z", "HEAD")
    for row in modes.split(b"\0"):
        if not row:
            continue
        meta, path = row.split(b"\t", 1)
        if os.fsdecode(path) in changed:
            require(meta.split(b" ", 1)[0] not in (b"120000", b"160000"),
                    "Enlace simbólico o submódulo cambiado requiere revisión explícita")
    return {"result": "PASS", "objective": policy["objective"], "head": head,
            "operation": operation, "checked_paths": len(changed),
            "scope": "precondiciones locales; no es certificación ni bloqueo global"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--policy", required=True, type=Path)
    parser.add_argument("--policy-sha256", required=True)
    parser.add_argument("--operation", choices=("commit", "mutate"), default="commit")
    args = parser.parse_args(argv)
    try:
        policy = load_policy(args.policy, args.policy_sha256)
        result = check(args.repo.resolve(), policy, args.operation)
    except (Blocked, OSError, ValueError, TypeError, subprocess.SubprocessError) as error:
        print(json.dumps({"result": "BLOCKED", "reason": str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
