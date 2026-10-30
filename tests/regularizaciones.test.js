import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { textoDePaginas } from "./apoyo-informes.js";
import { entorno, basico, compra, saldo, SQL } from "./apoyo-api.js";

async function ejemplo() {
  const e = await entorno();
  await basico(e.api);
  await e.api.fondos.recibir({
    id: "r",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 100000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 100000 }],
  });
  await e.api.compras.registrar(
    compra({
      id: "personal",
      importe: 20000,
      forma_pago: "contado",
      asignaciones: [{ id: "a", parte_id: null, importe: 20000 }],
      pagos: [
        { id: "p", origen: "fondo", parte_id: "agricola", importe: 20000 },
      ],
    }),
  );
  return e;
}

test("regularización mixta se vincula al pago y no inventa recepción", async () => {
  const { api } = await ejemplo();
  await api.regularizaciones.atribuir({
    id: "at",
    pago_id: "p",
    responsable_id: "juan",
    beneficiario_id: "otra",
    fecha: "2026-10-22",
    motivo: "Atribución acordada",
  });
  const uno = {
    id: "l1",
    pago_id: "p",
    pagador_id: "otra",
    modalidad: "reposicion",
    fecha: "2026-10-23",
    importe: 8000,
    motivo: "Reintegro parcial",
  };
  assert.equal((await api.regularizaciones.liquidar(uno)).creada, true);
  assert.equal((await api.regularizaciones.liquidar(uno)).creada, false);
  await api.regularizaciones.liquidar({
    ...uno,
    id: "l2",
    modalidad: "directa",
    importe: 12000,
  });
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "custodia", "agricola"), 88000);
  assert.equal(saldo(s, "por_regularizar", "agricola"), 0);
  assert.equal((await api.fondos.recepciones()).length, 1);
  assert.equal((await api.compras.listar()).length, 1);
  const cuenta = (await api.saldos.cuentas()).cuentas.find(
    (c) => c.parte_id === "agricola",
  );
  assert.deepEqual(
    [
      cuenta.regularizacion_original,
      cuenta.regularizacion_repuesta,
      cuenta.regularizacion_directa,
      cuenta.por_regularizar,
    ],
    [20000, 8000, 12000, 0],
  );
  const { informe, bytes } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: {
      titulo: "Prueba sintética",
      responsable: "",
      destinatario: "",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
    exportar: false,
  });
  const texto = textoDePaginas(await PDFDocument.load(bytes))
    .flat()
    .join(" ");
  for (const etiqueta of [
    "Obligación original por regularizar",
    "Repuesto a custodia",
    "Devuelto directamente",
  ])
    assert.ok(texto.includes(etiqueta), etiqueta);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load((await api.informes.excel(informe.id)).bytes);
  const campos = new Map();
  libro
    .getWorksheet("Conciliación")
    .eachRow((fila) =>
      campos.set(fila.getCell(4).value, fila.getCell(5).value),
    );
  assert.equal(campos.get("Obligación original por regularizar"), 200);
  assert.equal(campos.get("Repuesto a custodia"), 80);
  assert.equal(campos.get("Devuelto directamente"), 120);
  assert.equal(campos.get("Por regularizar"), 0);
});

test("sin atribución no se liquida; exceso, competencia y anulación preservan los saldos", async () => {
  const { api, repo } = await ejemplo();
  const mov = {
    id: "m1",
    pago_id: "p",
    pagador_id: "otra",
    modalidad: "reposicion",
    fecha: "2026-10-23",
    importe: 20000,
    motivo: "Reposición",
  };
  await assert.rejects(() => api.regularizaciones.liquidar(mov), /atribu/i);
  await api.regularizaciones.atribuir({
    id: "at",
    pago_id: "p",
    responsable_id: "juan",
    beneficiario_id: "otra",
    fecha: "2026-10-22",
    motivo: "Atribución explícita",
  });
  await assert.rejects(
    () =>
      api.regularizaciones.liquidar({ ...mov, id: "exceso", importe: 20001 }),
    /excede/i,
  );
  const competidores = await Promise.allSettled([
    api.regularizaciones.liquidar(mov),
    api.regularizaciones.liquidar({ ...mov, id: "m2" }),
  ]);
  assert.equal(competidores.filter((r) => r.status === "fulfilled").length, 1);
  const registros = await api.regularizaciones.listar();
  assert.equal(registros.regularizaciones.length, 1);
  const aplicada = registros.regularizaciones[0];
  assert.equal(registros.atribuciones[0].responsable_id, "juan");
  assert.equal(registros.atribuciones[0].beneficiario_id, "otra");
  assert.equal(aplicada.pagador_id, "otra");
  await assert.rejects(() =>
    api.pagos.anular("p", "Anulación con dependencia"),
  );
  await api.regularizaciones.anular(aplicada.id, "Corrección de reintegro");
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "custodia", "agricola"), 80000);
  assert.equal(saldo(s, "por_regularizar", "agricola"), 20000);
  assert.ok(
    (await repo.todas("eventos")).some(
      (x) => x.entidad === "regularizacion" && x.tipo === "anular",
    ),
  );
});

test("devolución directa parcial y respaldo conservan su atribución", async () => {
  const { api } = await ejemplo();
  await api.regularizaciones.atribuir({
    id: "at",
    pago_id: "p",
    responsable_id: "juan",
    beneficiario_id: "otra",
    fecha: "2026-10-22",
    motivo: "Asignación",
  });
  await api.regularizaciones.liquidar({
    id: "directa",
    pago_id: "p",
    pagador_id: "otra",
    modalidad: "directa",
    fecha: "2026-10-23",
    importe: 8000,
    motivo: "Devolución",
  });
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "custodia", "agricola"), 80000);
  assert.equal(saldo(s, "por_regularizar", "agricola"), 12000);
  const destino = await entorno();
  await destino.api.respaldo.restaurar((await api.respaldo.crear()).bytes);
  assert.deepEqual(
    await destino.api.regularizaciones.listar(),
    await api.regularizaciones.listar(),
  );
  assert.equal(
    saldo(
      (await destino.api.saldos.consultar()).saldos,
      "por_regularizar",
      "agricola",
    ),
    12000,
  );
});

test("dos obligaciones de la misma empresa no pueden cancelarse con el reintegro de la otra", async () => {
  const { api } = await ejemplo();
  await api.compras.registrar(
    compra({
      id: "segunda",
      importe: 10000,
      forma_pago: "contado",
      asignaciones: [{ id: "a2", parte_id: null, importe: 10000 }],
      pagos: [
        { id: "p2", origen: "fondo", parte_id: "agricola", importe: 10000 },
      ],
    }),
  );
  for (const [id, pago_id] of [
    ["at1", "p"],
    ["at2", "p2"],
  ])
    await api.regularizaciones.atribuir({
      id,
      pago_id,
      responsable_id: "juan",
      beneficiario_id: "otra",
      fecha: "2026-10-22",
      motivo: "Atribución",
    });
  const m = {
    id: "directa2",
    pago_id: "p2",
    pagador_id: "juan",
    modalidad: "directa",
    fecha: "2026-10-23",
    importe: 10000,
    motivo: "Pago de segunda obligación",
  };
  await api.regularizaciones.liquidar(m);
  await assert.rejects(
    () => api.regularizaciones.liquidar({ ...m, id: "exceso2", importe: 1 }),
    /excede/i,
  );
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "por_regularizar", "agricola"), 20000);
  assert.equal(saldo(s, "custodia", "agricola"), 70000);
});

test("migración desde esquema 7 preserva hechos previos y permite atribución", async () => {
  const original = await ejemplo();
  const antes = await original.repo.cargarTodo();
  const vieja = new SQL.Database(original.persistido());
  vieja.run(
    "DROP TABLE regularizaciones; DROP TABLE atribuciones_regularizacion; PRAGMA user_version = 7;",
  );
  const nueva = await entorno({ snapshot: vieja.export() });
  assert.equal(
    (await nueva.db.query("PRAGMA user_version")).values[0].user_version,
    8,
  );
  assert.deepEqual(await nueva.repo.cargarTodo(), antes);
  await nueva.api.regularizaciones.atribuir({
    id: "at",
    pago_id: "p",
    responsable_id: "juan",
    beneficiario_id: "otra",
    fecha: "2026-10-22",
    motivo: "Atribución histórica explícita",
  });
  await nueva.api.regularizaciones.liquidar({
    id: "liq",
    pago_id: "p",
    pagador_id: "juan",
    modalidad: "reposicion",
    fecha: "2026-10-23",
    importe: 20000,
    motivo: "Reposición",
  });
  assert.equal(
    saldo((await nueva.api.saldos.consultar()).saldos, "custodia", "agricola"),
    100000,
  );
});

test("propietarios y monedas permanecen separados", async () => {
  const { api } = await ejemplo();
  await api.fondos.recibir({
    id: "usd",
    fecha: "2026-10-21",
    parte_id: "otra",
    importe: 100000,
    moneda: "USD",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 100000 }],
  });
  await api.compras.registrar(
    compra({
      id: "usd-personal",
      moneda: "USD",
      importe: 20000,
      forma_pago: "contado",
      asignaciones: [{ id: "usd-a", parte_id: null, importe: 20000 }],
      pagos: [
        { id: "usd-p", origen: "fondo", parte_id: "otra", importe: 20000 },
      ],
    }),
  );
  await api.regularizaciones.atribuir({
    id: "usd-at",
    pago_id: "usd-p",
    responsable_id: "juan",
    beneficiario_id: "juan",
    fecha: "2026-10-22",
    motivo: "Atribución",
  });
  await api.regularizaciones.liquidar({
    id: "usd-liq",
    pago_id: "usd-p",
    pagador_id: "juan",
    modalidad: "directa",
    fecha: "2026-10-23",
    importe: 20000,
    motivo: "Devolución",
  });
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "por_regularizar", "agricola", "g1", "NIO"), 20000);
  assert.equal(saldo(s, "por_regularizar", "otra", "g1", "USD"), 0);
  assert.equal(saldo(s, "custodia", "otra", "g1", "USD"), 80000);
});
