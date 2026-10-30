import { test } from "node:test";
import assert from "node:assert/strict";
import { bordes, cambiarBorde, cambiarZoom } from "../src/interfaz/recorte.js";
import { recorteSeguro } from "../src/documentos/anexos.js";

test("recorte permite ajustar bordes, acercar y alejar conservando límites", () => {
  let r = { x: 0, y: 0, w: 1, h: 1 };
  r = cambiarBorde(r, "izquierda", 20);
  r = cambiarBorde(r, "derecha", 30);
  assert.deepEqual(bordes(r), {
    izquierda: 20,
    derecha: 30,
    arriba: 0,
    abajo: 0,
  });
  assert.equal(recorteSeguro(r), true);
  const anterior = r;
  assert.deepEqual(cambiarBorde(r, "derecha", 70), anterior);
  for (let i = 0; i < 20; i++) r = cambiarZoom(r, -1);
  assert.equal(recorteSeguro(r), true);
  assert.equal(r.w, 0.2);
  for (let i = 0; i < 20; i++) r = cambiarZoom(r, 1);
  assert.equal(recorteSeguro(r), true);
  assert.equal(r.w, 1);
});
