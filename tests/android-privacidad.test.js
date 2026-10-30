import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("Android excluye la copia automática y la transferencia de datos privados", async () => {
  const manifest = await readFile(
    "android/app/src/main/AndroidManifest.xml",
    "utf8",
  );
  const reglas = await readFile(
    "android/app/src/main/res/xml/data_extraction_rules.xml",
    "utf8",
  );
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(
    manifest,
    /android:dataExtractionRules="@xml\/data_extraction_rules"/,
  );
  for (const nombre of ["cloud-backup", "device-transfer"]) {
    const bloque = reglas.match(
      new RegExp(`<${nombre}>([\\s\\S]*?)</${nombre}>`),
    );
    assert.ok(bloque);
    for (const dominio of [
      "root",
      "file",
      "database",
      "sharedpref",
      "external",
      "device_root",
      "device_file",
      "device_database",
      "device_sharedpref",
    ])
      assert.match(bloque[1], new RegExp(`domain="${dominio}" path="\\."`));
  }
});
