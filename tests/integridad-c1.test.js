import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { entorno, basico, compra, saldo, imagen, SQL } from "./apoyo-api.js";
import { adaptarSqlJs } from "../src/datos/adaptador-sqljs.js";
import { repositorio } from "../src/datos/base.js";
import { crearApi } from "../src/api/index.js";

test("C1-01 devoluciones concurrentes no exceden la custodia", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "r",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 10000 }],
  });
  const movimiento = {
    gestion_id: "g1",
    parte_id: "agricola",
    fecha: "2026-10-22",
    importe: 6000,
    moneda: "NIO",
  };
  const resultados = await Promise.allSettled([
    api.fondos.devolver({ ...movimiento, id: "d1" }),
    api.fondos.devolver({ ...movimiento, id: "d2" }),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(resultados.filter((r) => r.status === "rejected").length, 1);
  assert.equal(
    saldo((await api.saldos.consultar()).saldos, "custodia", "agricola"),
    4000,
  );
  assert.equal((await repo.todas("movimientos")).length, 1);
  assert.equal(
    (await repo.todas("eventos")).filter((e) => e.entidad === "movimiento")
      .length,
    1,
  );
});

test("C1-02 un cambio de forma de pago con el mismo id es conflicto", async () => {
  const { api } = await entorno();
  await basico(api);
  const entrada = compra({ id: "idem" });
  await api.compras.registrar(entrada);
  assert.equal((await api.compras.registrar(entrada)).creada, false);
  await assert.rejects(
    () => api.compras.registrar({ ...entrada, forma_pago: "contado" }),
    (e) => e.codigo === "CONFLICTO",
  );
});

test("C1-03 no se declara completo si falta un PDF privado", async () => {
  const { api, informesPrivados } = await entorno();
  await basico(api);
  await api.compras.registrar(compra({ id: "pdf" }));
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: {
      titulo: "Rendición",
      responsable: "Responsable",
      destinatario: "Destino",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
    exportar: false,
  });
  await informesPrivados.borrar(informe.privado);
  await assert.rejects(
    () => api.respaldo.crear(),
    (e) => e.codigo === "INTEGRIDAD",
  );
});

test("C1-02 fechas, contraparte, distribución y comprobante forman parte de la identidad", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  const c = compra({
    id: "identidad",
    forma_pago: "contado",
    imagenes: [imagen()],
  });
  await api.compras.registrar(c);
  await assert.rejects(
    () => api.compras.registrar({ ...c, imagenes: [imagen("voucher")] }),
    (e) => e.codigo === "CONFLICTO",
  );
  const pago = {
    id: "p",
    compra_id: c.id,
    fecha: "2026-10-22",
    importe: 1000,
    origen: "tercero",
    parte_id: "agricola",
  };
  await api.pagos.registrar(pago);
  await assert.rejects(
    () => api.pagos.registrar({ ...pago, fecha: "2026-10-23" }),
    (e) => e.codigo === "CONFLICTO",
  );
  await assert.rejects(
    () => api.pagos.registrar({ ...pago, parte_id: "otra" }),
    (e) => e.codigo === "CONFLICTO",
  );
  const recepcion = {
    id: "r-id",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    referencia: "original",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 10000 }],
  };
  await api.fondos.recibir(recepcion);
  await assert.rejects(
    () => api.fondos.recibir({ ...recepcion, referencia: "distinta" }),
    (e) => e.codigo === "CONFLICTO",
  );
  await assert.rejects(
    () => api.fondos.recibir({ ...recepcion, aplicaciones: [] }),
    (e) => e.codigo === "CONFLICTO",
  );
  const mov = {
    id: "m-id",
    gestion_id: "g1",
    parte_id: "agricola",
    fecha: "2026-10-22",
    importe: 1000,
    moneda: "NIO",
  };
  await api.fondos.devolver(mov);
  await assert.rejects(
    () => api.fondos.devolver({ ...mov, parte_id: "otra" }),
    (e) => e.codigo === "CONFLICTO",
  );
  assert.equal((await repo.todas("movimientos")).length, 1);
});

test("C1-02 reintentos simultáneos idénticos se registran una vez", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  const entrada = compra({ id: "simultanea", imagenes: [imagen()] });
  const resultados = await Promise.all([
    api.compras.registrar(entrada),
    api.compras.registrar(entrada),
  ]);
  assert.deepEqual(resultados.map((r) => r.creada).sort(), [false, true]);
  assert.equal((await repo.todas("compras")).length, 1);
  assert.equal((await repo.todas("fotos")).length, 1);
});

test("C1-01 aplicaciones concurrentes compiten por una misma recepción", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "sin-aplicar",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
  });
  const a = { gestion_id: "g1", destino: "anticipo", importe: 6000 };
  const r = await Promise.allSettled([
    api.fondos.aplicar("sin-aplicar", [{ ...a, id: "a1" }]),
    api.fondos.aplicar("sin-aplicar", [{ ...a, id: "a2" }]),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await repo.todas("aplicaciones")).length, 1);
});

test("C1-01 pagos y traslados compiten por la misma custodia", async () => {
  for (const tipo of ["pago", "traslado"]) {
    const { api, repo } = await entorno();
    await basico(api);
    await api.gestiones.crear({
      id: "g2",
      nombre: "Otra",
      fecha_inicio: "2026-10-20",
    });
    await api.fondos.recibir({
      id: "r",
      fecha: "2026-10-21",
      parte_id: "agricola",
      importe: 10000,
      moneda: "NIO",
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 10000 }],
    });
    const mov = {
      gestion_id: "g1",
      gestion_destino_id: "g2",
      parte_id: "agricola",
      fecha: "2026-10-22",
      importe: 6000,
      moneda: "NIO",
    };
    let operaciones;
    if (tipo === "traslado")
      operaciones = [
        api.fondos.trasladar({ ...mov, id: "t1" }),
        api.fondos.trasladar({ ...mov, id: "t2" }),
      ];
    else {
      await api.compras.registrar(
        compra({ id: "compra", forma_pago: "contado" }),
      );
      const pago = {
        compra_id: "compra",
        fecha: "2026-10-22",
        importe: 6000,
        origen: "fondo",
        parte_id: "agricola",
      };
      operaciones = [
        api.pagos.registrar({ ...pago, id: "p1" }),
        api.pagos.registrar({ ...pago, id: "p2" }),
      ];
    }
    const r = await Promise.allSettled(operaciones);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      saldo((await api.saldos.consultar()).saldos, "custodia", "agricola"),
      4000,
    );
    assert.equal(
      (await repo.todas(tipo === "pago" ? "pagos" : "movimientos")).length,
      1,
    );
  }
});

test("C1-03 rechaza PDF alterado y restauración sin archivo requerido", async () => {
  const origen = await entorno();
  await basico(origen.api);
  await origen.api.compras.registrar(
    compra({ id: "foto", imagenes: [imagen()] }),
  );
  const { informe } = await origen.api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: {
      titulo: "Rendición",
      responsable: "Responsable",
      destinatario: "Destino",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
    exportar: false,
  });
  const respaldo = (await origen.api.respaldo.crear()).bytes;
  await origen.informesPrivados.borrar(informe.privado);
  await origen.informesPrivados.guardar(
    informe.privado,
    new Uint8Array([1, 2, 3]),
  );
  await assert.rejects(
    () => origen.api.respaldo.crear(),
    (e) => e.codigo === "INTEGRIDAD",
  );
  const zip = await JSZip.loadAsync(respaldo);
  zip.remove(`informes/${informe.sha256}.pdf`);
  const destino = await entorno();
  await basico(destino.api);
  await destino.api.compras.registrar(compra({ id: "conservar" }));
  const incompleto = await zip.generateAsync({ type: "uint8array" });
  await assert.rejects(() => destino.api.respaldo.restaurar(incompleto));
  assert.equal((await destino.api.compras.listar())[0].id, "conservar");
});

test("C1-01 SQLite conserva integridad tras rechazo concurrente", async () => {
  const { api, db } = await entorno();
  await basico(api);
  for (let i = 0; i < 5; i++) {
    await api.fondos.recibir({
      id: `r${i}`,
      fecha: "2026-10-21",
      parte_id: "agricola",
      importe: 10000,
      moneda: "NIO",
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 10000 }],
    });
    const x = {
      gestion_id: "g1",
      parte_id: "agricola",
      fecha: "2026-10-22",
      importe: 6000,
      moneda: "NIO",
    };
    // Dejar únicamente C$100 disponibles antes de cada contienda.
    if (i) await api.fondos.devolver({ ...x, id: `ajuste${i}`, importe: 4000 });
    const r = await Promise.allSettled([
      api.fondos.devolver({ ...x, id: `d${i}a` }),
      api.fondos.devolver({ ...x, id: `d${i}b` }),
    ]);
    assert.equal(r.filter((v) => v.status === "fulfilled").length, 1);
  }
  assert.equal(
    (await db.query("PRAGMA integrity_check")).values[0].integrity_check,
    "ok",
  );
  assert.deepEqual((await db.query("PRAGMA foreign_key_check")).values, []);
});

test("C1-01 dos conexiones SQL.js coordinadas recargan el estado antes de competir", async () => {
  const e = await entorno();
  await basico(e.api);
  await e.api.fondos.recibir({
    id: "r",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 10000 }],
  });
  let snapshot = e.persistido();
  let turno = Promise.resolve();
  const coordinacion = {
    leer: () => snapshot,
    bloquear: async (f) => {
      const anterior = turno;
      let liberar;
      turno = new Promise((r) => {
        liberar = r;
      });
      await anterior;
      try {
        return await f();
      } finally {
        liberar();
      }
    },
  };
  const crear = () =>
    crearApi({
      repo: repositorio(
        adaptarSqlJs(
          SQL,
          snapshot,
          (b) => {
            snapshot = b;
          },
          coordinacion,
        ),
      ),
      files: e.files,
      informesPrivados: e.informesPrivados,
      informesCompartidos: e.informesCompartidos,
    });
  const a = crear(),
    b = crear();
  const m = {
    gestion_id: "g1",
    parte_id: "agricola",
    fecha: "2026-10-22",
    importe: 6000,
    moneda: "NIO",
  };
  const r = await Promise.allSettled([
    a.fondos.devolver({ ...m, id: "a" }),
    b.fondos.devolver({ ...m, id: "b" }),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    saldo((await a.saldos.consultar()).saldos, "custodia", "agricola"),
    4000,
  );
});
