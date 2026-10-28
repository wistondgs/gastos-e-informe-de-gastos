#!/usr/bin/env bash
# Copia UN APK a Descargas del teléfono con un nombre inconfundible (E-06) y lo deja
# indexado con su tamaño real, para que el instalador no lo abra en blanco (E-07).
#   scripts/android/entregar.sh <apk> <NOMBRE-VISIBLE.apk>
set -euo pipefail
apk="${1:?falta el APK}"; nombre="${2:?falta el nombre visible}"
adb="${ADB:-$HOME/.local/share/gastos-entorno/android-sdk/platform-tools/adb}"
[[ "$nombre" == *.apk && "$nombre" != */* ]] || { echo "Nombre inválido: $nombre" >&2; exit 2; }
existentes="$("$adb" shell 'ls /sdcard/Download/ 2>/dev/null' | tr -d '\r' | grep -i '\.apk$' || true)"
if [[ -n "$existentes" ]]; then
  echo "Se niega: ya hay APK en Descargas y podrían confundirse (E-06):" >&2
  echo "$existentes" >&2
  exit 3
fi
ruta="/sdcard/Download/$nombre"
"$adb" push "$apk" "$ruta" >/dev/null
"$adb" shell content call --uri content://media --method scan_file --arg "/storage/emulated/0/Download/$nombre" >/dev/null
tam="$("$adb" shell content query --uri content://media/external/file --projection _size --where "\"_display_name='$nombre'\"" | tr -d '\r' | sed -n 's/.*_size=\([0-9]*\).*/\1/p')"
esperado="$(stat -c %s "$apk")"
if [[ "$tam" != "$esperado" ]]; then
  echo "El teléfono no indexó el APK con su tamaño ($tam en vez de $esperado): el instalador lo abriría en blanco (E-07)." >&2
  exit 4
fi
echo "Listo: Descargas/$nombre ($esperado bytes, indexado)"
