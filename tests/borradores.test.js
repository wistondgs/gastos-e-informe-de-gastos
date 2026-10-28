import { test } from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { crearBorradores } from "../src/datos/borradores.js";

test("borrador conserva id y bytes tras reabrir, y se descarta de forma explícita", async () => {
  const a = crearBorradores(indexedDB, "borradores-prueba");
  await a.guardar("compra", {
    id: "id-estable",
    imagenes: [{ bytes: new Uint8Array([1, 2, 3]) }],
  });
  const b = crearBorradores(indexedDB, "borradores-prueba");
  const recuperado = await b.obtener("compra");
  assert.equal(recuperado.id, "id-estable");
  assert.deepEqual(recuperado.imagenes[0].bytes, new Uint8Array([1, 2, 3]));
  await b.descartar("compra");
  assert.equal(await a.obtener("compra"), null);
});
