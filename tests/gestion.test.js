import { test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { adaptarSqlJs } from "../src/datos/adaptador-sqljs.js";
import { inicializar, repositorio } from "../src/datos/base.js";
import { crearRespaldo, restaurarRespaldo } from "../src/datos/respaldo.js";
const SQL = await initSqlJs();
const antigua = `CREATE TABLE compras (id TEXT PRIMARY KEY, fecha_compra TEXT NOT NULL, fecha_registro TEXT NOT NULL, concepto TEXT NOT NULL, proveedor TEXT NOT NULL, importe INTEGER NOT NULL, moneda TEXT NOT NULL, factura TEXT NOT NULL, estado TEXT NOT NULL);
CREATE TABLE fotos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id), ruta TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, clase TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL); PRAGMA user_version=1;`;
const files = {
  async leer() {
    throw new Error("no hay fotos");
  },
  async escribir() {},
  async borrar() {},
  ruta() {
    return "sin-uso";
  },
};
const gestion = {
  id: "gestion-1",
  nombre: "Winston Managua",
  fecha_inicio: "2026-10-27",
  fecha_fin: null,
};
test("migración conserva compras antiguas y gestión permite cierre y respaldo", async () => {
  const old = new SQL.Database();
  old.run(antigua);
  old.run(
    "INSERT INTO compras VALUES ('previa','2026-10-26','2026-10-27T00:00:00.000Z','Existente','Proveedor',125075,'NIO','0000123','factura')",
  );
  let snapshot;
  const db = adaptarSqlJs(SQL, old.export(), (b) => (snapshot = b));
  await inicializar(db);
  const repo = repositorio(db);
  assert.equal((await repo.compras())[0].factura, "0000123");
  assert.equal((await repo.compras())[0].gestion_id, null);
  await repo.crearGestion(gestion);
  assert.equal((await repo.gestiones()).length, 1);
  const c = {
    id: "nueva",
    fecha_compra: "2026-10-27",
    fecha_registro: "2026-10-27T12:00:00Z",
    concepto: "Gasto",
    proveedor: "Prueba",
    importe: 100,
    moneda: "NIO",
    factura: "",
    estado: "sin_factura",
    gestion_id: "gestion-1",
  };
  await repo.guardar(c, []);
  await assert.rejects(() => repo.cerrarGestion("gestion-1", "2026-10-26"));
  await repo.cerrarGestion("gestion-1", "2026-10-28");
  assert.equal((await repo.gestiones())[0].fecha_fin, "2026-10-28");
  const backup = await crearRespaldo(repo, files);
  const db2 = adaptarSqlJs(SQL, null, () => {});
  await inicializar(db2);
  const repo2 = repositorio(db2);
  await restaurarRespaldo(repo2, files, backup);
  assert.equal((await repo2.gestiones())[0].nombre, "Winston Managua");
  assert.equal(
    (await repo2.compras()).find((x) => x.id === "nueva").gestion_id,
    "gestion-1",
  );
  assert.equal(
    (await repo2.compras()).find((x) => x.id === "previa").factura,
    "0000123",
  );
  assert.ok(snapshot.length);
});

test("migración preserva referencias de fotos y revierte si falla una sentencia", async () => {
  const old = new SQL.Database();
  old.run(antigua);
  old.run(
    "INSERT INTO compras VALUES ('previa','2026-10-26','2026-10-27T00:00:00.000Z','Existente','Proveedor',125075,'NIO','0000123','factura')",
  );
  old.run(
    "INSERT INTO fotos VALUES ('foto-1','previa','comprobantes/foto-1.jpg','image/jpeg','factura','abc')",
  );
  const snapshot = old.export();
  const db = adaptarSqlJs(SQL, snapshot, () => {});
  const defectuoso = {
    ...db,
    async execute(sql, transaccion) {
      if (sql.includes("CREATE TABLE gestiones"))
        return db.execute(
          sql.replace(
            "PRAGMA user_version = 2;",
            "INSERT INTO tabla_inexistente VALUES (1); PRAGMA user_version = 2;",
          ),
          transaccion,
        );
      return db.execute(sql, transaccion);
    },
  };
  await assert.rejects(() => inicializar(defectuoso));
  assert.equal(
    (await db.query("PRAGMA user_version")).values[0].user_version,
    1,
  );
  assert.equal(
    (await db.query("SELECT ruta FROM fotos")).values[0].ruta,
    "comprobantes/foto-1.jpg",
  );
  assert.equal(
    (await db.query("SELECT name FROM sqlite_master WHERE name='gestiones'"))
      .values.length,
    0,
  );
  await inicializar(db);
  const fotos = await repositorio(db).fotos("previa");
  assert.equal(fotos.length, 1);
  assert.equal(fotos[0].ruta, "comprobantes/foto-1.jpg");
});

test("respaldo de la versión anterior se restaura sin perder la compra", async () => {
  const JSZip = (await import("jszip")).default;
  const { huella } = await import("../src/datos/archivos.js");
  const data = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      compras: [
        {
          id: "antigua",
          fecha_compra: "2026-10-27",
          fecha_registro: "2026-10-27T00:00:00Z",
          concepto: "Anterior",
          proveedor: "Prueba",
          importe: 125075,
          moneda: "NIO",
          factura: "0000123",
          estado: "factura",
        },
      ],
      fotos: [],
      encabezado: "Anterior",
    }),
  );
  const zip = new JSZip();
  zip.file("datos.json", data);
  zip.file(
    "manifiesto.json",
    JSON.stringify({ version: 1, datos: await huella(data), archivos: {} }),
  );
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const db = adaptarSqlJs(SQL, null, () => {});
  await inicializar(db);
  const repo = repositorio(db);
  await restaurarRespaldo(repo, files, bytes);
  assert.equal((await repo.compras())[0].factura, "0000123");
  assert.equal((await repo.compras())[0].gestion_id, null);
  assert.equal((await repo.gestiones()).length, 0);
});

test("restaurar respaldo anterior recupera imagen junto con compra", async () => {
  const JSZip = (await import("jszip")).default;
  const { huella } = await import("../src/datos/archivos.js");
  const imagen = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a0kAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const digest = await huella(imagen);
  const foto = {
    id: "foto-anterior",
    compra_id: "antigua",
    ruta: "comprobantes/foto-anterior.png",
    tipo: "image/png",
    clase: "factura",
    sha256: digest,
  };
  const compra = {
    id: "antigua",
    fecha_compra: "2026-10-27",
    fecha_registro: "2026-10-27T00:00:00Z",
    concepto: "Anterior",
    proveedor: "Prueba",
    importe: 125075,
    moneda: "NIO",
    factura: "0000123",
    estado: "factura",
  };
  const datos = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      compras: [compra],
      fotos: [foto],
      encabezado: "Informe",
    }),
  );
  const zip = new JSZip();
  zip.file("datos.json", datos);
  zip.file("imagenes/foto-anterior", imagen);
  zip.file(
    "manifiesto.json",
    JSON.stringify({
      version: 1,
      datos: await huella(datos),
      archivos: { "foto-anterior": digest },
    }),
  );
  const copia = await zip.generateAsync({ type: "uint8array" });
  let guardada;
  const archivo = {
    ruta() {
      return "comprobantes/restaurada.png";
    },
    async escribir(_, bytes) {
      guardada = bytes;
    },
    async borrar() {},
    async leer() {
      return guardada;
    },
  };
  const db = adaptarSqlJs(SQL, null, () => {});
  await inicializar(db);
  const repo = repositorio(db);
  await restaurarRespaldo(repo, archivo, copia);
  assert.deepEqual(guardada, imagen);
  assert.equal((await repo.fotos("antigua"))[0].sha256, digest);
  assert.equal((await repo.compras())[0].factura, "0000123");
});
