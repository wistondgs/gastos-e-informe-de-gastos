import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, compra, SQL } from "./apoyo-api.js";
import { adaptarSqlJs } from "../src/datos/adaptador-sqljs.js";
import { inicializar, repositorio } from "../src/datos/base.js";

test("catálogos de cuentas, medios, categorías y destinos sobreviven al respaldo", async () => {
  const origen = await entorno();
  for (const tipo of ["cuenta", "medio", "categoria", "destino"]) {
    await origen.api.catalogos.crear({
      id: tipo,
      tipo,
      nombre: `Ejemplo ${tipo}`,
    });
    await origen.api.catalogos.editar(
      tipo,
      { nombre: `Nuevo ${tipo}` },
      "Corrección de nombre",
    );
  }
  await origen.api.catalogos.desactivar("cuenta", "Dejó de usarse");
  assert.equal(
    (await origen.api.catalogos.listar({ tipo: "cuenta" })).length,
    0,
  );
  const zip = (await origen.api.respaldo.crear()).bytes;
  const destino = await entorno();
  await destino.api.respaldo.restaurar(zip);
  assert.equal(
    (await destino.api.catalogos.listar({ incluirInactivos: true })).length,
    4,
  );
  assert.equal(
    (
      await destino.api.catalogos.listar({
        tipo: "cuenta",
        incluirInactivos: true,
      })
    )[0].activa,
    0,
  );
});

test("migración 4 a 5 conserva los registros previos y crea catálogos vacíos", async () => {
  const e = await entorno();
  await basico(e.api);
  await e.api.compras.registrar(compra({ id: "previa", factura: "00001" }));
  const antigua = new SQL.Database(e.persistido());
  antigua.run(
    "DROP TABLE catalogo_usos; DROP TABLE catalogos; PRAGMA user_version = 4;",
  );
  const db = adaptarSqlJs(SQL, antigua.export(), () => {});
  await inicializar(db);
  assert.equal(
    (await db.query("PRAGMA user_version")).values[0].user_version,
    5,
  );
  const repo = repositorio(db);
  assert.equal((await repo.una("compras", "previa")).factura, "00001");
  assert.equal((await repo.todas("catalogos")).length, 0);
  assert.deepEqual((await db.query("PRAGMA foreign_key_check")).values, []);
});

test("editar parte conserva id, historial de nombres y roles derivados de operaciones", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "rol",
      forma_pago: "credito",
      deudor_id: "agricola",
      asignaciones: [{ parte_id: "agricola", importe: 100000 }],
    }),
  );
  await api.partes.editar(
    "agricola",
    { nombre: "Nombre nuevo" },
    "Actualización",
  );
  const { parte, roles, eventos } = await api.partes.detalle("agricola");
  assert.equal(parte.nombre, "Nombre nuevo");
  assert.ok(roles.beneficiaria_de_compras.includes("rol"));
  assert.ok(roles.deudora_de_creditos.includes("rol"));
  assert.equal(
    JSON.parse(eventos.find((e) => e.tipo === "editar").datos).antes.nombre,
    "Agrícola de prueba",
  );
  assert.equal((await api.compras.detalle("rol")).compra.deudor_id, "agricola");
});

test("los catálogos usados en compras conservan el nombre histórico", async () => {
  const e = await entorno();
  await basico(e.api);
  await e.api.catalogos.crear({
    id: "materiales",
    tipo: "categoria",
    nombre: "Materiales",
  });
  await e.api.compras.registrar(
    compra({ id: "etiquetada", catalogos: ["materiales"] }),
  );
  await e.api.catalogos.editar(
    "materiales",
    { nombre: "Materiales nuevos" },
    "Renombrar",
  );
  assert.equal(
    (await e.api.compras.detalle("etiquetada")).catalogos[0].nombre,
    "Materiales",
  );
  const zip = (await e.api.respaldo.crear()).bytes;
  const destino = await entorno();
  await destino.api.respaldo.restaurar(zip);
  assert.equal(
    (await destino.api.compras.detalle("etiquetada")).catalogos[0].nombre,
    "Materiales",
  );
});
