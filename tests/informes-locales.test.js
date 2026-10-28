import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crearAlmacenInformes,
  nombreValido,
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
    removeItem: (k) => m.delete(k),
  };
}
function fsFalso(carpeta) {
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
          .filter((p) => p.startsWith(carpeta + "/"))
          .map((p) => ({ name: p.slice(carpeta.length + 1), type: "file" })),
      };
    },
  };
}
const almacen = (fs, storage = memoria()) =>
  crearAlmacenInformes({
    nativo: true,
    filesystem: fs,
    storage,
    directorio: "DATA",
    carpeta: "informes",
    prefijo: "x:",
  });
test("el almacén guarda sin pisar, conserva los bytes y se puede volver a abrir", async () => {
  const fs = fsFalso("informes");
  const a = almacen(fs);
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
  assert.equal(await a.guardar("GR-1-R01.pdf", bytes), "GR-1-R01.pdf");
  assert.deepEqual(await a.listar(), ["GR-1-R01.pdf"]);
  assert.deepEqual(await a.leer("GR-1-R01.pdf"), bytes);
  await assert.rejects(
    () => a.guardar("GR-1-R01.pdf", new Uint8Array([1])),
    /Ya existe/,
  );
  assert.deepEqual(await a.leer("GR-1-R01.pdf"), bytes);
  assert.equal(fs.m.size, 1);
  assert.deepEqual(await almacen(fs).listar(), ["GR-1-R01.pdf"]);
  assert.equal(await a.existe("GR-1-R01.pdf"), true);
  await a.borrar("GR-1-R01.pdf");
  assert.equal(await a.existe("GR-1-R01.pdf"), false);
});
test("si la verificación falla, el informe no queda presentado como guardado", async () => {
  const fs = fsFalso("informes");
  const a = almacen(fs);
  fs.readFile = async () => ({ data: "AA==" });
  await assert.rejects(
    () => a.guardar("GR-2-R01.pdf", new Uint8Array([1, 2, 3])),
    /verificar/,
  );
  assert.equal(fs.m.size, 0);
  assert.deepEqual(await a.listar(), []);
});
test("los nombres no admiten rutas ni extensiones ajenas", () => {
  for (const malo of ["../x.pdf", "a/b.pdf", "x.exe", "", ".pdf", "a..b.pdf"])
    assert.equal(nombreValido(malo), false, malo);
  assert.equal(
    nombreValido("informe-gestion-x--20261027T210000--id.pdf"),
    true,
  );
});
test("en el navegador de prueba, privado y compartido no se mezclan", async () => {
  const storage = memoria();
  const privado = crearAlmacenInformes({
    nativo: false,
    storage,
    carpeta: "informes",
    prefijo: "p:",
  });
  const compartido = crearAlmacenInformes({
    nativo: false,
    storage,
    carpeta: "R",
    prefijo: "c:",
  });
  await privado.guardar("a.pdf", new Uint8Array([1]));
  assert.deepEqual(await compartido.listar(), []);
  assert.deepEqual(await privado.listar(), ["a.pdf"]);
});
