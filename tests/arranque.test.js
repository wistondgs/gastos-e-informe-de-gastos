import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse, compileTemplate } from "@vue/compiler-sfc";

test("la pantalla inicial se puede compilar y contiene el aviso del entorno", async () => {
  const fuente = await readFile(
    new URL("../src/interfaz/App.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(fuente, { filename: "App.vue" });
  assert.deepEqual(errors, []);
  assert.ok(descriptor.template);
  const resultado = compileTemplate({
    source: descriptor.template.content,
    filename: "App.vue",
    id: "inicio",
  });
  assert.deepEqual(resultado.errors, []);
  assert.match(resultado.code, /Entorno de desarrollo/);
});
