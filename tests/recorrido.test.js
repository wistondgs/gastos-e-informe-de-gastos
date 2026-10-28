import { test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { centavos, validarCompra } from "../src/dominio/compra.js";
import { guardarCompra } from "../src/dominio/operaciones.js";
import { inicializar, repositorio } from "../src/datos/base.js";
import { crearRespaldo, restaurarRespaldo } from "../src/datos/respaldo.js";
import { excel, pdf } from "../src/exportaciones/informes.js";
const SQL = await initSqlJs();
function dbDriver(snapshot) {
  const db = snapshot ? new SQL.Database(snapshot) : new SQL.Database();
  return {
    raw: db,
    async execute(s, tx = true) {
      if (tx) db.run("BEGIN");
      try {
        db.run(s);
        if (tx) db.run("COMMIT");
      } catch (e) {
        if (tx) db.run("ROLLBACK");
        throw e;
      }
    },
    async query(s, v = []) {
      const stmt = db.prepare(s, v),
        values = [];
      try {
        while (stmt.step()) values.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      return { values };
    },
    async run(s, v = []) {
      db.run(s, v);
    },
    async executeSet(set, tx = true) {
      if (tx) db.run("BEGIN");
      try {
        for (const s of set) db.run(s.statement, s.values);
        if (tx) db.run("COMMIT");
      } catch (e) {
        if (tx) db.run("ROLLBACK");
        throw e;
      }
    },
  };
}
function fileStore() {
  const data = new Map();
  let n = 0;
  return {
    data,
    ruta: (tipo) =>
      `comprobantes/foto-${++n}.${tipo === "image/png" ? "png" : "jpg"}`,
    async escribir(p, b) {
      data.set(p, new Uint8Array(b));
    },
    async leer(p) {
      if (!data.has(p)) throw new Error("Falta imagen");
      return data.get(p);
    },
    async borrar(p) {
      data.delete(p);
    },
  };
}
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a0kAAAAASUVORK5CYII=",
    "base64",
  ),
);
function compra(id = "compra-1") {
  return {
    id,
    fecha_compra: "2026-10-27",
    fecha_registro: "2026-10-27T12:00:00.000Z",
    proveedor: "Proveedor",
    concepto: "Compra de prueba",
    importe: centavos("1250.75"),
    moneda: "NIO",
    factura: "0000123",
    estado: "factura",
  };
}
async function context() {
  const db = dbDriver();
  await inicializar(db);
  return { db, repo: repositorio(db), files: fileStore() };
}
test("montos exactos, factura como texto y validación negativa", () => {
  assert.equal(centavos("1250.75"), 125075);
  assert.equal(centavos("0,01"), 1);
  for (const v of ["0", "12.345", "-1", "1e4", "NaN", "1,2,3"])
    assert.throws(() => centavos(v));
  assert.equal(validarCompra(compra()).factura, "0000123");
  assert.throws(() =>
    validarCompra({ ...compra(), fecha_compra: "2026-02-30" }),
  );
});
test("compra, dos fotos, reinicio SQLite e idempotencia", async () => {
  const { db, repo, files } = await context();
  const c = compra();
  const images = [
    { bytes: png, tipo: "image/png", clase: "factura" },
    { bytes: png, tipo: "image/png", clase: "voucher" },
  ];
  assert.equal(await guardarCompra(repo, files, c, images), true);
  assert.equal(await guardarCompra(repo, files, c, images), false);
  assert.equal(files.data.size, 2);
  await assert.rejects(() =>
    guardarCompra(repo, files, { ...c, importe: 7 }, []),
  );
  const reinicio = dbDriver(db.raw.export());
  await inicializar(reinicio);
  const otro = repositorio(reinicio);
  assert.equal((await otro.compras()).length, 1);
  assert.equal((await otro.compras())[0].importe, 125075);
  assert.equal((await otro.fotos(c.id)).length, 2);
  for (const f of await otro.fotos(c.id))
    assert.deepEqual(await files.leer(f.ruta), png);
  const sin = { ...compra("sin-1"), factura: "", estado: "sin_factura" };
  await guardarCompra(otro, files, sin, []);
  assert.equal((await otro.compras()).length, 2);
});
test("Excel real con y sin imágenes y PDF legible", async () => {
  const { repo, files } = await context();
  const c = compra();
  await guardarCompra(repo, files, c, [
    { bytes: png, tipo: "image/png", clase: "factura" },
    { bytes: png, tipo: "image/png", clase: "voucher" },
  ]);
  const fotos = await repo.fotos(c.id);
  for (const incluir of [true, false]) {
    const result = await excel(c, fotos, files, incluir);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(result);
    assert.equal(libro.getWorksheet("Compra").getCell("B8").value, "0000123");
    assert.equal(libro.getWorksheet("Compra").getCell("B7").value, 1250.75);
    assert.equal(
      libro.getWorksheet("Compra").getImages().length,
      incluir ? 2 : 0,
    );
  }
  const archivo = await pdf(c, fotos, files, "Informe");
  const doc = await PDFDocument.load(archivo);
  assert.equal(doc.getPageCount(), 3);
});
test("respaldo y restauración transaccional; corrupción y fallo preservan el estado", async () => {
  const { db, repo, files } = await context();
  const c = compra();
  await guardarCompra(repo, files, c, [
    { bytes: png, tipo: "image/png", clase: "factura" },
  ]);
  const zip = await crearRespaldo(repo, files);
  await guardarCompra(repo, files, compra("posterior"), []);
  const corrupto = await JSZip.loadAsync(zip);
  corrupto.file("datos.json", '{"falseado":true}');
  const fotoCorrupta = await JSZip.loadAsync(zip);
  const nombreFoto = Object.keys(fotoCorrupta.files).find(
    (nombre) =>
      nombre.startsWith("imagenes/") && !fotoCorrupta.files[nombre].dir,
  );
  fotoCorrupta.file(nombreFoto, new Uint8Array([1, 2, 3]));
  const zipFotoCorrupta = await fotoCorrupta.generateAsync({
    type: "uint8array",
  });
  await assert.rejects(() => restaurarRespaldo(repo, files, zipFotoCorrupta));
  assert.equal((await repo.compras()).length, 2);
  const mal = await corrupto.generateAsync({ type: "uint8array" });
  await assert.rejects(() => restaurarRespaldo(repo, files, mal));
  assert.equal((await repo.compras()).length, 2);
  const fallido = {
    ...files,
    async escribir() {
      throw new Error("sin espacio");
    },
  };
  await assert.rejects(() => restaurarRespaldo(repo, fallido, zip));
  assert.equal((await repo.compras()).length, 2);
  const falloTransaccion = {
    ...repo,
    async reemplazarTodo() {
      await db.executeSet(
        [
          { statement: "DELETE FROM fotos", values: [] },
          { statement: "DELETE FROM compras", values: [] },
          { statement: "INSERT INTO tabla_inexistente VALUES (1)", values: [] },
        ],
        true,
      );
    },
  };
  await assert.rejects(() => restaurarRespaldo(falloTransaccion, files, zip));
  assert.equal((await repo.compras()).length, 2);
  assert.equal((await repo.fotos(c.id)).length, 1);
  assert.equal(files.data.size, 1);
  const resultado = await restaurarRespaldo(repo, files, zip);
  assert.deepEqual(resultado, {
    compras: 1,
    fotos: 1,
    informes: 0,
    informes_con_archivo: 0,
    movimientos: 0,
  });
  assert.equal((await repo.compras()).length, 1);
  const foto = (await repo.fotos(c.id))[0];
  assert.deepEqual(await files.leer(foto.ruta), png);
  const reinicio = dbDriver(db.raw.export());
  await inicializar(reinicio);
  assert.equal((await repositorio(reinicio).compras()).length, 1);
});

test("SQLite web conserva claves foráneas después de guardar y revertir", async () => {
  const { adaptarSqlJs } = await import("../src/datos/adaptador-sqljs.js");
  let copia;
  const driver = adaptarSqlJs(SQL, null, (b) => {
    copia = b;
  });
  await inicializar(driver);
  assert.equal(
    (await driver.query("PRAGMA foreign_keys")).values[0].foreign_keys,
    1,
  );
  await assert.rejects(() =>
    driver.run(
      "INSERT INTO fotos (id,compra_id,ruta,tipo,clase,sha256) VALUES ('f','inexistente','r','image/png','factura','hash')",
    ),
  );
  assert.equal(
    (await driver.query("PRAGMA foreign_keys")).values[0].foreign_keys,
    1,
  );
  assert.ok(copia.length > 0);
  const reinicio = adaptarSqlJs(SQL, copia, () => {});
  assert.equal(
    (await reinicio.query("PRAGMA foreign_keys")).values[0].foreign_keys,
    1,
  );
});
