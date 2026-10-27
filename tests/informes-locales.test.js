import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crearAlmacenInformes,
  CARPETA_INFORMES,
} from "../src/datos/informes-locales.js";
function memoria() {
  const m = new Map();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i],
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
  };
}
function fsFalso() {
  const m = new Map();
  return {
    m,
    async stat({ path }) {
      if (!m.has(path)) throw new Error("File does not exist");
      return {};
    },
    async writeFile({ path, data }) {
      m.set(path, data);
    },
    async readFile({ path }) {
      if (!m.has(path)) throw new Error("File does not exist");
      return { data: m.get(path) };
    },
    async rename({ from, to }) {
      m.set(to, m.get(from));
      m.delete(from);
    },
    async deleteFile({ path }) {
      m.delete(path);
    },
    async readdir() {
      return {
        files: [...m.keys()]
          .filter((p) => p.startsWith(CARPETA_INFORMES + "/"))
          .map((p) => ({
            name: p.slice(CARPETA_INFORMES.length + 1),
            type: "file",
          })),
      };
    },
  };
}
test("informes conservan historial separado, bytes y no sobrescriben", async () => {
  const storage = memoria();
  const fs = fsFalso();
  const opciones = {
    nativo: true,
    filesystem: fs,
    storage,
    uuid: () => "identificador-unico",
    ahora: () => new Date("2026-10-27T21:00:00Z"),
  };
  const reports = crearAlmacenInformes(opciones);
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
  const nombre = await reports.guardar("gestion-1", bytes);
  assert.equal((await reports.listar()).length, 1);
  assert.deepEqual(await reports.leer(nombre), bytes);
  await assert.rejects(
    () => reports.guardar("gestion-1", new Uint8Array([1, 2, 3])),
    /Ya existe/,
  );
  assert.deepEqual(await reports.leer(nombre), bytes);
  assert.equal(fs.m.size, 1);
  const reabierto = crearAlmacenInformes(opciones);
  assert.equal((await reabierto.listar())[0], nombre);
});
test("fallo de escritura y verificación no presenta un informe como guardado", async () => {
  const fs = fsFalso();
  const opts = {
    nativo: true,
    filesystem: fs,
    storage: memoria(),
    uuid: () => "id",
    ahora: () => new Date("2026-10-27T21:00:00Z"),
  };
  const reports = crearAlmacenInformes(opts);
  fs.readFile = async () => ({ data: "AA==" });
  await assert.rejects(
    () => reports.guardar("gestion-1", new Uint8Array([1, 2, 3])),
    /verificar/,
  );
  assert.equal(fs.m.size, 0);
  assert.deepEqual(await reports.listar(), []);
});
