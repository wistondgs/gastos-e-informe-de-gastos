import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

test("el ejemplo es válido y rechaza versiones y campos no previstos", async () => {
  const esquema = JSON.parse(
    await readFile(
      new URL("../config/esquema-v1.json", import.meta.url),
      "utf8",
    ),
  );
  const ejemplo = JSON.parse(
    await readFile(new URL("../config/ejemplo.json", import.meta.url), "utf8"),
  );
  const validar = new Ajv2020().compile(esquema);
  assert.equal(validar(ejemplo), true);
  assert.equal(validar({ ...ejemplo, version: 2 }), false);
  assert.equal(
    validar({ ...ejemplo, regla_financiera: "alterar saldo" }),
    false,
  );
});
