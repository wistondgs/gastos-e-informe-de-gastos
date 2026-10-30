#!/usr/bin/env bash
# Compila el APK y lo guarda en apk/ del proyecto, con su huella: Gradle vacía la carpeta de salida (E-08).
#   scripts/android/compilar.sh pruebas   → io.necktral.gastos.entorno.pruebas («Prueba beta de gastos»)
#   scripts/android/compilar.sh oficial   → io.necktral.gastos.entorno
set -euo pipefail
variante="${1:?indicá pruebas u oficial}"
raiz="$(cd "$(dirname "$0")/../.." && pwd)"
entorno="${GASTOS_ENTORNO:-$HOME/.local/share/gastos-entorno}"
destino="${GASTOS_APK_DIR:-$raiz/apk}"
export JAVA_HOME="$entorno/jdk21" ANDROID_HOME="$entorno/android-sdk"
export PATH="$JAVA_HOME/bin:$PATH"
case "$variante" in
  pruebas) extra=(-Ppruebas) ;;
  oficial) extra=() ;;
  *) echo "Variante desconocida: $variante" >&2; exit 2 ;;
esac
cd "$raiz"
read -r fuente_sha fuente_estado < <(scripts/android/identidad-fuente.sh)
npm run android:sync >/dev/null
(cd android && ./gradlew :app:assembleDebug "${extra[@]}" --no-daemon -q)
apk="android/app/build/outputs/apk/debug/app-debug.apk"
aapt="$(ls -d "$ANDROID_HOME"/build-tools/*/ | tail -1)aapt"
paquete="$("$aapt" dump badging "$apk" | sed -n "s/^package: name='\([^']*\)' versionCode='\([^']*\)' versionName='\([^']*\)'.*/\1 \2 \3/p")"
read -r nombre codigo version <<<"$paquete"
sha="$(sha256sum "$apk" | cut -c1-64)"
mkdir -p "$destino"
salida="$destino/${nombre}-v${version}-c${codigo}-${fuente_sha:0:7}-${fuente_estado}-${sha:0:8}.apk"
cp "$apk" "$salida"
echo "$salida"
echo "paquete=$nombre version=$version codigo=$codigo sha256=$sha fuente_sha=$fuente_sha fuente_estado=$fuente_estado"
