# Fragmento opcional para el pre-commit EXISTENTE, después de inventariarlo y aprobar integración.
# No instalar como sustituto del dispatcher ni cambiar core.hooksPath. Conservar commit-msg.
# Sustituir el hash por el de la política concreta revisada. Sin ello bloquea por diseño.
python3 "$HOME/.agents/skills/necktral-phase-execution/scripts/phase_guard.py" \
  --repo "$(git rev-parse --show-toplevel)" \
  --policy "$(git rev-parse --absolute-git-dir)/necktral-phase-policy.json" \
  --policy-sha256 'REEMPLAZAR_SHA256_POLITICA_APROBADA' \
  --operation commit || exit 1
