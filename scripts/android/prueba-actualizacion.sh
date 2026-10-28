#!/usr/bin/env bash
# Prueba PASO-A → PASO-B en la instalación AISLADA (nunca en la app oficial).
#   scripts/android/prueba-actualizacion.sh cargar <carpeta>     con PASO-A instalado y abierto una vez
#   scripts/android/prueba-actualizacion.sh verificar <carpeta>  antes y después de instalar PASO-B
set -euo pipefail
PAQUETE="io.necktral.gastos.entorno.pruebas"   # fijo: la app oficial no se toca
BASE="databases/gastos_fase1SQLite.db"
adb="${ADB:-$HOME/.local/share/gastos-entorno/android-sdk/platform-tools/adb}"
orden="${1:?cargar o verificar}"; dir="${2:?carpeta de evidencia}"
raiz="$(cd "$(dirname "$0")/../.." && pwd)"; sint="$raiz/scripts/android/sinteticos.mjs"
mkdir -p "$dir"
"$adb" shell pm list packages | tr -d '\r' | grep -qx "package:$PAQUETE" || { echo "No está instalada $PAQUETE." >&2; exit 2; }
version="$("$adb" shell dumpsys package "$PAQUETE" | tr -d '\r' | sed -n 's/.*versionName=//p' | head -1)"
leer() { "$adb" exec-out run-as "$PAQUETE" cat "$1"; }
"$adb" shell am force-stop "$PAQUETE"
case "$orden" in
  cargar)
    leer "$BASE" > "$dir/paso-a-vacia.db"
    node "$sint" preparar "$dir/paso-a-vacia.db" "$dir/paso-a-sintetica.db" "$dir/fotos" "$dir/manifiesto.json"
    "$adb" shell run-as "$PAQUETE" rm -f "$BASE-wal" "$BASE-shm" "$BASE-journal"
    "$adb" exec-in run-as "$PAQUETE" sh -c "cat > $BASE" < "$dir/paso-a-sintetica.db"
    "$adb" shell run-as "$PAQUETE" mkdir -p files/comprobantes
    for f in "$dir"/fotos/comprobantes/*; do
      "$adb" exec-in run-as "$PAQUETE" sh -c "cat > files/comprobantes/$(basename "$f")" < "$f"
    done
    echo "Cargado en $PAQUETE ($version)."
    ;;
  verificar)
    etapa="$(date +%H%M%S)"
    leer "$BASE" > "$dir/base-$etapa.db"
    mkdir -p "$dir/leidas-$etapa/comprobantes"
    for f in "$dir"/fotos/comprobantes/*; do
      n="$(basename "$f")"; leer "files/comprobantes/$n" > "$dir/leidas-$etapa/comprobantes/$n" || true
    done
    echo "versión instalada: $version"
    node "$sint" verificar "$dir/base-$etapa.db" "$dir/leidas-$etapa" "$dir/manifiesto.json"
    ;;
  *) echo "Orden desconocida." >&2; exit 2 ;;
esac
