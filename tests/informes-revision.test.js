import { test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import JSZip from "jszip";
import { adaptarSqlJs } from "../src/datos/adaptador-sqljs.js";
import { inicializar, repositorio } from "../src/datos/base.js";
import { crearRespaldo, restaurarRespaldo } from "../src/datos/respaldo.js";
import { crearAlmacenInformes } from "../src/datos/informes-locales.js";
import {
  emitirInforme,
  regenerarInforme,
  verificarArchivo,
  modeloDeRevision,
} from "../src/datos/emision.js";
import { huella } from "../src/datos/archivos.js";
import { png, fotoDe, archivosEnMemoria, compraDe } from "./apoyo-informes.js";
const SQL = await initSqlJs();
const v2 = `CREATE TABLE compras (id TEXT PRIMARY KEY, fecha_compra TEXT NOT NULL, fecha_registro TEXT NOT NULL, concepto TEXT NOT NULL, proveedor TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), factura TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('factura','sin_factura','pendiente')));
CREATE TABLE fotos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE, ruta TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, clase TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE gestiones (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, fecha_inicio TEXT NOT NULL, fecha_fin TEXT);
ALTER TABLE compras ADD COLUMN gestion_id TEXT REFERENCES gestiones(id);
PRAGMA user_version = 2;`;
const gestion = {
  id: "gestion-1",
  nombre: "Winston Managua",
  fecha_inicio: "2026-10-20",
  fecha_fin: null,
};
const opciones = {
  titulo: "Rendición",
  responsable: "Responsable de prueba",
  destinatario: "Destinatario de prueba",
  corte: "2026-10-27",
  papel: "carta",
  estilo: "ejecutivo",
  incluirFotos: true,
};
function almacenEnMemoria() {
  const datos = new Map();
  const storage = {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
    key: (i) => [...datos.keys()][i] ?? null,
    get length() {
      return datos.size;
    },
  };
  let reloj = 0;
  return {
    datos,
    almacen: crearAlmacenInformes({
      nativo: false,
      storage,
      ahora: () => new Date(Date.UTC(2026, 9, 27, 20, 0, reloj++)),
    }),
  };
}
async function baseV2ConDatos() {
  const old = new SQL.Database();
  old.run(v2);
  old.run(
    "INSERT INTO gestiones VALUES ('gestion-1','Winston Managua','2026-10-20',NULL)",
  );
  old.run(
    "INSERT INTO compras VALUES ('c1','2026-10-21','2026-10-21T12:00:00Z','Compra supermercado','Proveedor','820000','NIO','0000123','factura','gestion-1')",
  );
  old.run(
    "INSERT INTO compras VALUES ('c2','2026-10-22','2026-10-22T12:00:00Z','Alimentación','Proveedor','8500','USD','0000125','factura','gestion-1')",
  );
  old.run(
    "INSERT INTO fotos VALUES ('foto-1','c1','comprobantes/foto-1.png','image/png','factura','x')",
  );
  old.run("INSERT INTO ajustes VALUES ('encabezado','Mi encabezado')");
  return old.export();
}
async function preparado() {
  const db = adaptarSqlJs(SQL, await baseV2ConDatos(), () => {});
  await inicializar(db);
  const repo = repositorio(db);
  const files = archivosEnMemoria();
  const bytes = png(200, 300);
  const foto = await fotoDe("foto-1", "c1", bytes);
  await files.escribir(foto.ruta, bytes);
  await db.run("UPDATE fotos SET sha256=? WHERE id='foto-1'", [foto.sha256]);
  const items = async () => {
    const r = [];
    for (const compra of await repo.compras())
      r.push({ compra, fotos: await repo.fotos(compra.id) });
    return r;
  };
  return { db, repo, files, items, ...almacenEnMemoria() };
}
test("la migración 2→3 conserva gestiones, compras, fotos y el encabezado", async () => {
  const { db, repo } = await preparado();
  assert.equal(
    (await db.query("PRAGMA user_version")).values[0].user_version,
    3,
  );
  assert.equal((await repo.compras()).length, 2);
  assert.equal((await repo.fotos("c1"))[0].ruta, "comprobantes/foto-1.png");
  assert.equal((await repo.gestiones())[0].nombre, "Winston Managua");
  assert.equal((await repo.ajustes()).encabezado, "Mi encabezado");
  assert.equal((await repo.ajustes()).responsable, "");
  assert.deepEqual(await repo.informes(), []);
});
test("si la migración 3 falla, la base queda en la versión 2 sin perder nada", async () => {
  const db = adaptarSqlJs(SQL, await baseV2ConDatos(), () => {});
  const defectuoso = {
    ...db,
    async execute(sql, t) {
      if (sql.includes("CREATE TABLE informes"))
        return db.execute(
          sql.replace(
            "PRAGMA user_version = 3;",
            "INSERT INTO tabla_inexistente VALUES (1); PRAGMA user_version = 3;",
          ),
          t,
        );
      return db.execute(sql, t);
    },
  };
  await assert.rejects(() => inicializar(defectuoso));
  assert.equal(
    (await db.query("PRAGMA user_version")).values[0].user_version,
    2,
  );
  assert.equal(
    (await db.query("SELECT name FROM sqlite_master WHERE name='informes'"))
      .values.length,
    0,
  );
  assert.equal((await db.query("SELECT * FROM compras")).values.length, 2);
});
test("cada emisión es una revisión nueva, regenerable idéntica y verificable", async () => {
  const { repo, files, items, almacen, datos } = await preparado();
  const ahora = () => new Date("2026-10-27T20:00:00.000Z");
  const r1 = await emitirInforme({
    repo,
    files,
    almacen,
    gestion,
    items: await items(),
    opciones,
    ahora,
  });
  const r2 = await emitirInforme({
    repo,
    files,
    almacen,
    gestion,
    items: await items(),
    opciones: { ...opciones, estilo: "formal" },
    ahora,
  });
  assert.equal(r1.registro.revision, 1);
  assert.equal(r2.registro.revision, 2);
  assert.equal(r2.registro.codigo, "GR-GESTION1-R02");
  const registros = await repo.informes("gestion-1");
  assert.deepEqual(
    registros.map((r) => r.revision),
    [2, 1],
  );
  const rev1 = registros.find((r) => r.revision === 1);
  assert.equal(rev1.sha256, await huella(r1.bytes));
  assert.equal(await verificarArchivo(almacen, rev1), "verificado");
  // Después de emitir: una compra nueva, la gestión terminada y otros ajustes.
  await repo.guardar(
    compraDe("c9", "NIO", 500, { fecha_compra: "2026-10-23" }),
    [],
  );
  await repo.cerrarGestion("gestion-1", "2026-10-28");
  await repo.guardarAjustes({ responsable: "Otra persona" });
  const copia = await regenerarInforme(repo, files, rev1);
  assert.equal(
    await huella(copia),
    rev1.sha256,
    "la revisión entregada no cambia",
  );
  const modelo = await modeloDeRevision(repo, rev1);
  assert.equal(modelo.gestion.fecha_fin, null);
  assert.equal(modelo.opciones.responsable, "Responsable de prueba");
  assert.ok(!modelo.filas.some((f) => f.compra.id === "c9"));
  // Una huella que no coincide nunca se entrega como copia fiel.
  await assert.rejects(
    () => regenerarInforme(repo, files, { ...rev1, sha256: "0".repeat(64) }),
    /no coincide/,
  );
  // Un archivo alterado o borrado se detecta.
  const clave = [...datos.keys()].find((k) => k.endsWith(rev1.archivo));
  datos.set(clave, Buffer.from("otro").toString("base64"));
  assert.equal(await verificarArchivo(almacen, rev1), "alterado");
  datos.delete(clave);
  assert.equal(await verificarArchivo(almacen, rev1), "ausente");
  // Una foto alterada impide regenerar en silencio.
  files.m.set("comprobantes/foto-1.png", png(5, 5));
  await assert.rejects(() => regenerarInforme(repo, files, rev1), /alterado/);
});
test("la revisión elegida solo incluye las compras seleccionadas", async () => {
  const { repo, files, items, almacen } = await preparado();
  const todos = await items();
  const r = await emitirInforme({
    repo,
    files,
    almacen,
    gestion,
    items: todos.filter((i) => i.compra.id === "c2"),
    opciones,
  });
  assert.deepEqual(JSON.parse(r.registro.datos).compras, ["c2"]);
  assert.deepEqual(JSON.parse(r.registro.datos).totales, { USD: 8500 });
});
test("si el registro de la revisión falla, no queda el PDF guardado", async () => {
  const { repo, files, items, almacen, datos } = await preparado();
  const roto = {
    ...repo,
    registrarInforme: async () => {
      throw new Error("disco lleno");
    },
  };
  await assert.rejects(
    () =>
      emitirInforme({
        repo: roto,
        files,
        almacen,
        gestion,
        items: [],
        opciones,
      }),
    /No se registró/,
  );
  assert.equal([...datos.keys()].length, 0);
  assert.deepEqual(await repo.informes(), []);
  await emitirInforme({
    repo,
    files,
    almacen,
    gestion,
    items: await items(),
    opciones,
  });
  const [emitida] = await repo.informes();
  await assert.rejects(
    () => repo.registrarInforme({ ...emitida, id: "otro" }),
    /UNIQUE/,
    "la misma revisión no se registra dos veces",
  );
});
test("el respaldo v3 conserva ajustes y revisiones; un v2 sigue restaurando", async () => {
  const { repo, files, items, almacen } = await preparado();
  await repo.guardarAjustes({
    responsable: "Responsable de prueba",
    destinatario: "Destino",
  });
  const { registro } = await emitirInforme({
    repo,
    files,
    almacen,
    gestion,
    items: await items(),
    opciones,
  });
  const zip = await crearRespaldo(repo, files);
  const db2 = adaptarSqlJs(SQL, null, () => {});
  await inicializar(db2);
  const repo2 = repositorio(db2);
  const files2 = archivosEnMemoria();
  const r = await restaurarRespaldo(repo2, files2, zip);
  assert.equal(r.informes, 1);
  assert.equal((await repo2.ajustes()).destinatario, "Destino");
  const [rest] = await repo2.informes();
  assert.equal(rest.sha256, registro.sha256);
  assert.equal(
    await huella(await regenerarInforme(repo2, files2, rest)),
    registro.sha256,
  );
  // Un respaldo v2 (sin informes ni ajustes nuevos) sigue entrando.
  const z = await JSZip.loadAsync(zip);
  const d = JSON.parse(await z.file("datos.json").async("string"));
  const viejo = {
    version: 2,
    compras: d.compras,
    fotos: d.fotos,
    gestiones: d.gestiones,
    encabezado: "Viejo",
  };
  const json = new TextEncoder().encode(JSON.stringify(viejo));
  z.file("datos.json", json);
  const man = JSON.parse(await z.file("manifiesto.json").async("string"));
  man.datos = await huella(json);
  z.file("manifiesto.json", JSON.stringify(man));
  await restaurarRespaldo(
    repo2,
    files2,
    await z.generateAsync({ type: "uint8array" }),
  );
  assert.equal((await repo2.ajustes()).encabezado, "Viejo");
  assert.deepEqual(await repo2.informes(), []);
  // Una revisión que apunta a una compra inexistente se rechaza y no borra nada.
  d.informes[0].datos = JSON.stringify({
    ...JSON.parse(d.informes[0].datos),
    compras: ["fantasma"],
  });
  const json2 = new TextEncoder().encode(JSON.stringify(d));
  z.file("datos.json", json2);
  man.datos = await huella(json2);
  z.file("manifiesto.json", JSON.stringify(man));
  await assert.rejects(
    async () =>
      restaurarRespaldo(
        repo2,
        files2,
        await z.generateAsync({ type: "uint8array" }),
      ),
    /informe emitido/,
  );
  assert.equal((await repo2.compras()).length, 2);
});
