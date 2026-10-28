import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/** Un adb falso: «ls» devuelve lo indicado y la consulta de medios, el tamaño indicado. */
function adbFalso(dir, { descargas, tamano }) {
  const ruta = join(dir, "adb");
  writeFileSync(
    ruta,
    `#!/usr/bin/env bash
case "$*" in
  *"ls /sdcard/Download/"*) printf '%b' "${descargas}" ;;
  push*) echo "1 file pushed" ;;
  *"--method scan_file"*) echo "Result: Bundle[]" ;;
  *"content query"*) echo "Row: 0 _size=${tamano}" ;;
esac
`,
  );
  chmodSync(ruta, 0o755);
  return ruta;
}
function entregar(opciones) {
  const dir = mkdtempSync(join(tmpdir(), "adb-"));
  try {
    const apk = join(dir, "x.apk");
    writeFileSync(apk, Buffer.alloc(1234));
    const r = spawnSync(
      "bash",
      ["scripts/android/entregar.sh", apk, "PASO-B-instalar.apk"],
      {
        env: { ...process.env, ADB: adbFalso(dir, opciones) },
        encoding: "utf8",
      },
    );
    return { codigo: r.status, salida: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("E-06: no copia un APK si ya hay otro en Descargas", () => {
  const r = entregar({
    descargas: "MisGastos-prueba.apk\\nfoto.png\\n",
    tamano: 1234,
  });
  assert.equal(r.codigo, 3, r.salida);
  assert.match(r.salida, /MisGastos-prueba\.apk/);
});
test("E-07: falla si el teléfono no indexó el APK con su tamaño real", () => {
  assert.equal(
    entregar({ descargas: "foto.png\\n", tamano: "NULL" }).codigo,
    4,
  );
});
test("con Descargas sin APK y el tamaño indexado, entrega", () => {
  const r = entregar({ descargas: "foto.png\\n", tamano: 1234 });
  assert.equal(r.codigo, 0, r.salida);
  assert.match(r.salida, /indexado/);
});
