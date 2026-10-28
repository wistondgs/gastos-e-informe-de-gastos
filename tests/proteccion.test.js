import { test } from "node:test";
import assert from "node:assert/strict";
import { crearProteccion } from "../src/interfaz/proteccion.js";

test("activar y desactivar exigen autenticación y no guardan credenciales", async () => {
  const datos = new Map();
  const storage = {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => datos.set(k, v),
    removeItem: (k) => datos.delete(k),
  };
  let autoriza = false;
  const sistema = {
    checkBiometry: async () => ({ deviceIsSecure: true }),
    authenticate: async () => {
      if (!autoriza) throw new Error("Cancelado");
    },
  };
  const p = crearProteccion({ nativo: true, sistema, storage });
  await assert.rejects(() => p.activar());
  assert.equal(p.activa(), false);
  autoriza = true;
  await p.activar();
  assert.equal(p.activa(), true);
  assert.deepEqual([...datos.values()], ["1"]);
  autoriza = false;
  await assert.rejects(() => p.desactivar());
  assert.equal(p.activa(), true);
  autoriza = true;
  await p.desactivar();
  assert.equal(p.activa(), false);
});

test("no se habilita sin bloqueo del teléfono ni en navegador", async () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("no debe guardar");
    },
  };
  const sistema = { checkBiometry: async () => ({ deviceIsSecure: false }) };
  await assert.rejects(
    () => crearProteccion({ nativo: true, sistema, storage }).activar(),
    /PIN/,
  );
  await assert.rejects(
    () => crearProteccion({ nativo: false, sistema, storage }).activar(),
    /teléfono/,
  );
});
