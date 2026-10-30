import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSalidaCamara } from "../src/interfaz/salida-camara.js";
test("la excepción de cámara dura solo hasta recibir la foto o cancelar", async () => {
  const camara = crearSalidaCamara();
  let resolver;
  const foto = camara.ejecutar(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  assert.equal(camara.pendiente(), true);
  await assert.rejects(
    camara.ejecutar(async () => {}),
    /ya está abierta/,
  );
  resolver("foto");
  assert.equal(await foto, "foto");
  assert.equal(camara.pendiente(), false);
  await assert.rejects(
    camara.ejecutar(async () => {
      throw new Error("cancelada");
    }),
    /cancelada/,
  );
  assert.equal(camara.pendiente(), false);
});
