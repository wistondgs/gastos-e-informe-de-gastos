#!/usr/bin/env python3
"""Pruebas de integración de la guarda en repositorios Git temporales, nunca ERP V4."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("phase_guard.py")


def git_env():
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")
    return env


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="necktral-guard-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.g("init", "-q", "-b", "fase-prueba")
        self.g("config", "user.name", "Fixture")
        self.g("config", "user.email", "fixture@example.invalid")
        self.g("config", "core.hooksPath", "/dev/null")
        self.write("src/ok.txt", "base\n")
        self.write("outside/legacy.txt", "base ajena\n")
        self.write("CLAUDE.md", "constitucion fixture\n")
        self.g("add", ".")
        self.g("commit", "-qm", "base")
        self.base = self.g("rev-parse", "HEAD").strip()
        self.policy = {"schema": 1, "objective": "fase de ensayo",
                       "approval_reference": "mandato sintético de ensayo",
                       "repository_root": str(self.repo), "branch": "fase-prueba",
                       "baseline_sha": self.base, "role": "development",
                       "allowed_paths": ["src/"], "forbidden_paths": ["CLAUDE.md", "src/private/"],
                       "protected_roots": [], "frozen_sha": None}
        self.policy_file = self.root / "policy.json"
        self.stage_ok()

    def g(self, *args, cwd=None):
        result = subprocess.run(["git", "--no-optional-locks", "-c", "core.fsmonitor=false", "-C",
                                 str(cwd or self.repo), *args], capture_output=True, text=True,
                                env=git_env())
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def write(self, name, content):
        p = self.repo / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)

    def stage_ok(self):
        self.write("src/ok.txt", "cambio permitido\n")
        self.g("add", "src/ok.txt")

    def run_guard(self, expected=0, operation="commit", hash_override=None, repo_override=None):
        raw = json.dumps(self.policy, ensure_ascii=False).encode()
        self.policy_file.write_bytes(raw)
        digest = hash_override or hashlib.sha256(raw).hexdigest()
        result = subprocess.run([sys.executable, str(SCRIPT), "--repo", str(repo_override or self.repo),
                                 "--policy", str(self.policy_file), "--policy-sha256", digest,
                                 "--operation", operation], capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        parsed = json.loads(result.stdout)
        self.assertEqual(parsed["result"], "PASS" if expected == 0 else "BLOCKED")
        return parsed

    def test_allowed_change_and_readonly(self):
        before = self.g("status", "--porcelain=v1", "-z")
        head = self.g("rev-parse", "HEAD")
        index = (self.repo / ".git/index").read_bytes()
        self.run_guard()
        self.assertEqual(before, self.g("status", "--porcelain=v1", "-z"))
        self.assertEqual(head, self.g("rev-parse", "HEAD"))
        self.assertEqual(index, (self.repo / ".git/index").read_bytes())

    def test_forbidden_precedes_allow(self):
        self.write("src/private/key.txt", "no autorizado")
        self.g("add", ".")
        self.assertIn("prohibida", self.run_guard(1)["reason"])

    def test_outside_untracked_preserved(self):
        self.write("outside/wip.txt", "WIP ajeno")
        self.run_guard(1)
        self.assertEqual((self.repo / "outside/wip.txt").read_text(), "WIP ajeno")

    def test_unstaged_outside_scope(self):
        self.write("outside/legacy.txt", "modificado")
        self.run_guard(1)

    def test_deleted_outside_scope(self):
        (self.repo / "outside/legacy.txt").unlink()
        self.g("add", "-u")
        self.run_guard(1)

    def test_rename_cannot_launder_forbidden_source(self):
        self.g("mv", "outside/legacy.txt", "src/imported.txt")
        self.assertIn("outside/legacy.txt", self.run_guard(1)["reason"])

    def test_rename_out_of_scope(self):
        self.g("mv", "src/ok.txt", "outside/moved.txt")
        self.run_guard(1)

    def test_prefix_boundary(self):
        self.write("src-other/x.txt", "no autorizado")
        self.g("add", ".")
        self.run_guard(1)

    def test_exact_file_rule_has_no_descendants(self):
        self.policy["allowed_paths"] = ["src/ok.txt"]
        self.write("src/extra.txt", "no autorizado")
        self.g("add", ".")
        self.run_guard(1)

    def test_spaces_and_unicode_filename(self):
        self.write("src/árbol con espacios.txt", "permitido")
        self.g("add", ".")
        self.run_guard()

    def test_policy_hash_mismatch(self):
        self.assertIn("hash", self.run_guard(1, hash_override="0" * 64)["reason"])

    def test_wrong_repo(self):
        self.policy["repository_root"] = str(self.root)
        self.run_guard(1)

    def test_wrong_branch(self):
        self.policy["branch"] = "otra"
        self.run_guard(1)

    def test_detached_head(self):
        self.g("checkout", "--detach", "-q", self.base)
        self.policy["branch"] = "HEAD"
        self.run_guard(1)

    def test_unrelated_baseline(self):
        self.g("stash", "push", "-qm", "fixture")
        self.g("checkout", "--orphan", "otra")
        self.g("commit", "-qm", "base sin parentesco")
        self.policy["branch"] = "otra"
        self.stage_ok()
        self.run_guard(1)

    def test_descendant_of_approved_base(self):
        self.g("commit", "-qm", "avance autorizado")
        self.write("src/ok.txt", "siguiente avance")
        self.g("add", ".")
        self.run_guard()

    def test_certification_role_denies_commit(self):
        self.policy["role"] = "certification"
        self.assertIn("FAB", self.run_guard(1)["reason"])

    def test_protected_clone_denies_mutation(self):
        self.policy["protected_roots"] = [str(self.root)]
        self.assertIn("protegido", self.run_guard(1, operation="mutate")["reason"])

    def test_symlink_to_protected_root(self):
        link = self.root / "alias"
        link.symlink_to(self.repo, target_is_directory=True)
        self.policy["protected_roots"] = [str(link)]
        self.run_guard(1, repo_override=link)

    def test_frozen_candidate_denies_commit(self):
        self.policy["frozen_sha"] = self.base
        self.assertIn("congelado", self.run_guard(1)["reason"])

    def test_active_git_markers(self):
        for name in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "index.lock"):
            with self.subTest(name=name):
                p = self.repo / ".git" / name
                p.write_text(self.base + "\n")
                self.run_guard(1)
                p.unlink()
        for name in ("rebase-merge", "rebase-apply", "sequencer"):
            with self.subTest(name=name):
                p = self.repo / ".git" / name
                p.mkdir()
                self.run_guard(1)
                p.rmdir()

    def test_unmerged_index(self):
        blob = self.g("rev-parse", "HEAD:src/ok.txt").strip()
        data = "\n".join(f"100644 {blob} {stage}\tsrc/ok.txt" for stage in (1, 2, 3)) + "\n"
        p = subprocess.run(["git", "-C", str(self.repo), "update-index", "--index-info"],
                           input=data, text=True, capture_output=True, env=git_env())
        self.assertEqual(p.returncode, 0, p.stderr)
        self.run_guard(1)

    def test_empty_index(self):
        self.g("reset", "-q", "HEAD")
        self.run_guard(1)
        self.run_guard(operation="mutate")

    def test_symlink_file_outside_repo(self):
        (self.repo / "src/link").symlink_to(self.root / "policy.json")
        self.g("add", ".")
        self.run_guard(1)

    def test_internal_symlink_requires_review(self):
        (self.repo / "src/link").symlink_to("ok.txt")
        self.g("add", ".")
        self.run_guard(1)

    def test_submodule_requires_review(self):
        self.g("update-index", "--add", "--cacheinfo", "160000," + self.base + ",src/submodule")
        self.run_guard(1)

    def test_invalid_policy_cases(self):
        for key, value in (("allowed_paths", []), ("allowed_paths", ["../outside/"]),
                           ("allowed_paths", ["src//"]), ("allowed_paths", ["src/*"]),
                           ("allowed_paths", ["src/./"]), ("forbidden_paths", []),
                           ("baseline_sha", "abc"), ("schema", True), ("role", "admin"),
                           ("objective", "REEMPLAZAR"), ("protected_roots", ["relative/"])):
            with self.subTest(key=key, value=value):
                previous = self.policy[key]
                self.policy[key] = value
                self.run_guard(1)
                self.policy[key] = previous

    def test_extra_policy_key_rejected(self):
        self.policy["disable_official_gate"] = True
        self.run_guard(1)

    def test_external_clean_filter_is_not_executed(self):
        sentinel = self.root / "external-side-effect"
        filter_script = self.root / "filter.sh"
        filter_script.write_text(f"#!/bin/sh\necho ejecutado > '{sentinel}'\ncat\n")
        filter_script.chmod(0o755)
        self.g("config", "filter.fixture.clean", str(filter_script))
        # No add posterior a configurar el filtro: el efecto solo puede venir de la guarda.
        (self.repo / ".git/info/attributes").write_text("src/ok.txt filter=fixture\n")
        self.write("src/ok.txt", "cambio sin preparar")
        self.run_guard(1)
        self.assertFalse(sentinel.exists(), "Una comprobación de lectura ejecutó el filtro externo")

    def test_assume_unchanged_cannot_hide_prohibited_changes(self):
        self.g("update-index", "--assume-unchanged", "CLAUDE.md")
        self.write("CLAUDE.md", "cambio prohibido oculto")
        self.run_guard(1)

    def test_skip_worktree_cannot_hide_prohibited_changes(self):
        self.g("update-index", "--skip-worktree", "CLAUDE.md")
        self.write("CLAUDE.md", "cambio prohibido oculto")
        self.run_guard(1)

    def test_deleted_symlink_requires_review(self):
        self.g("commit", "-qm", "cambio de fixture")
        (self.repo / "src/link").symlink_to("ok.txt")
        self.g("add", ".")
        self.g("commit", "-qm", "enlace preexistente")
        (self.repo / "src/link").unlink()
        self.g("add", "-u")
        self.run_guard(1)

    def test_deleted_gitlink_requires_review(self):
        self.g("commit", "-qm", "cambio de fixture")
        self.g("update-index", "--add", "--cacheinfo", "160000," + self.base + ",src/submodule")
        self.g("commit", "-qm", "gitlink preexistente")
        self.g("update-index", "--force-remove", "src/submodule")
        self.run_guard(1)

    def test_precommit_composition_and_commit_msg_preserved(self):
        hooks = self.repo / ".git/hooks"
        hooks.mkdir(exist_ok=True)
        self.g("config", "core.hooksPath", str(hooks))
        self.run_guard()
        raw = self.policy_file.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        # Rutas de fixture sin metacaracteres; se usan argumentos separados en la guarda.
        pre = hooks / "pre-commit"
        pre.write_text("#!/bin/sh\n" +
                       f"'{sys.executable}' '{SCRIPT}' --repo '{self.repo}' --policy '{self.policy_file}' " +
                       f"--policy-sha256 '{digest}' --operation commit || exit 1\n" +
                       "echo dispatcher_preservado > .git/dispatcher-ran\n")
        msg = hooks / "commit-msg"
        msg.write_text("#!/bin/sh\necho contrato_previo > .git/commit-msg-ran\nexit 1\n")
        pre.chmod(0o755)
        msg.chmod(0o755)
        before = self.g("rev-parse", "HEAD")
        proc = subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "ensayo"], capture_output=True, env=git_env())
        self.assertNotEqual(proc.returncode, 0)
        self.assertEqual(before, self.g("rev-parse", "HEAD"))
        self.assertTrue((self.repo / ".git/dispatcher-ran").exists())
        self.assertTrue((self.repo / ".git/commit-msg-ran").exists())
        msg.write_text("#!/bin/sh\necho ok > .git/commit-msg-ran\n")
        self.write("outside/wip.txt", "no autorizado")
        (self.repo / ".git/dispatcher-ran").unlink()
        proc = subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "bloquear"], capture_output=True, env=git_env())
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse((self.repo / ".git/dispatcher-ran").exists())

    def test_git_environment_cannot_redirect_repo(self):
        env_before = dict(os.environ)
        try:
            os.environ["GIT_DIR"] = str(self.root / "missing")
            os.environ["GIT_WORK_TREE"] = str(self.root / "other")
            self.run_guard()
        finally:
            os.environ.clear()
            os.environ.update(env_before)

    def test_test_runner_isolates_ambient_git_repository(self):
        external = self.root / "external-repo"
        external.mkdir()
        self.g("init", "-q", "-b", "external", cwd=external)
        self.g("config", "user.name", "Persona externa", cwd=external)
        self.g("config", "user.email", "external@example.invalid", cwd=external)
        self.g("config", "core.hooksPath", "/ruta/de/hooks/previos", cwd=external)
        config = (external / ".git/config").read_bytes()
        contaminated = {**os.environ, "GIT_DIR": str(external / ".git"), "GIT_WORK_TREE": str(external)}
        run = subprocess.run([sys.executable, str(Path(__file__).resolve()),
                              "GuardTests.test_allowed_change_and_readonly"],
                             env=contaminated, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertEqual(config, (external / ".git/config").read_bytes())
        self.assertFalse((external / ".git/index").exists())

    def test_linked_worktree_resolves_git_markers(self):
        self.g("stash", "push", "-qm", "fixture")
        wt = self.root / "worktree"
        self.g("worktree", "add", "-qb", "wt", str(wt))
        self.policy["repository_root"] = str(wt)
        self.policy["branch"] = "wt"
        (wt / "src/ok.txt").write_text("cambio")
        self.g("add", ".", cwd=wt)
        self.run_guard(repo_override=wt)
        actual = Path(self.g("rev-parse", "--git-path", "CHERRY_PICK_HEAD", cwd=wt).strip())
        actual.write_text(self.base)
        self.run_guard(1, repo_override=wt)


if __name__ == "__main__":
    unittest.main(verbosity=2)
