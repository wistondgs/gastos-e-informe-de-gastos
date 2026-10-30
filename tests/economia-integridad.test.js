import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { entorno, basico, compra, saldo, SQL, imagen } from "./apoyo-api.js";
import { textoDePaginas } from "./apoyo-informes.js";

test("fondos ajenos usados personalmente dejan custodia y obligación separadas", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "custodia",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 100000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 100000 }],
  });
  await api.compras.registrar(
    compra({
      id: "personal",
      importe: 20000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: null, importe: 20000 }],
      pagos: [{ origen: "fondo", parte_id: "agricola", importe: 20000 }],
    }),
  );
  const saldos = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(saldos, "custodia", "agricola"), 80000);
  assert.equal(saldo(saldos, "por_regularizar", "agricola"), 20000);
  assert.equal(saldo(saldos, "por_reembolsar", "agricola"), 0);
  assert.equal((await api.compras.listar()).length, 1);
});

test("tres depósitos aplicados menos compra con fondos dejan exactamente C$70,000", async () => {
  const { api } = await entorno();
  await basico(api);
  for (const [id, importe] of [
    ["d1", 10000000],
    ["d2", 10000000],
    ["d3", 2000000],
  ])
    await api.fondos.recibir({
      id,
      fecha: "2026-10-21",
      parte_id: "agricola",
      importe,
      moneda: "NIO",
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe }],
    });
  await api.compras.registrar(
    compra({
      id: "compra-fondos",
      importe: 15000000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 15000000 }],
      pagos: [{ origen: "fondo", parte_id: "agricola", importe: 15000000 }],
    }),
  );
  const cuentas = (await api.saldos.cuentas()).cuentas.find(
    (c) =>
      c.gestion_id === "g1" && c.parte_id === "agricola" && c.moneda === "NIO",
  );
  assert.equal(cuentas.recibido, 22000000);
  assert.equal(cuentas.usado_fondo, 15000000);
  assert.equal(cuentas.custodia, 7000000);
  assert.equal((await api.compras.listar()).length, 1);
});

test("un crédito sin pagos tiene deuda pendiente y no es una gestión sin movimientos", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "credito",
      importe: 1000000,
      forma_pago: "credito",
      deudor_id: "agricola",
      asignaciones: [{ parte_id: "agricola", importe: 1000000 }],
    }),
  );
  const antes = await api.saldos.liquidacion("g1");
  assert.equal(antes.estado, "pendiente");
  assert.equal(saldo(antes.saldos, "deuda_proveedor", "agricola"), 1000000);
  await api.pagos.registrar({
    id: "abono",
    compra_id: "credito",
    fecha: "2026-10-25",
    importe: 400000,
    origen: "tercero",
    parte_id: "agricola",
  });
  const despues = await api.saldos.liquidacion("g1");
  assert.equal(despues.estado, "parcial");
  assert.equal(saldo(despues.saldos, "deuda_proveedor", "agricola"), 600000);
  assert.equal((await api.compras.listar()).length, 1);
});

test("informe por empresa sin compras reconoce su custodia sin revelar otra empresa", async () => {
  const { api } = await entorno();
  await basico(api);
  for (const [id, parte_id, importe] of [
    ["r1", "agricola", 10000],
    ["r2", "otra", 50000],
  ])
    await api.fondos.recibir({
      id,
      fecha: "2026-10-21",
      parte_id,
      importe,
      moneda: "NIO",
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe }],
    });
  await api.fondos.recibir({
    id: "sin-aplicar",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 2500,
    moneda: "NIO",
    aplicaciones: [],
  });
  const r = await api.informes.previsualizar({
    alcance: { tipo: "parte", parte_id: "agricola" },
    opciones: {
      titulo: "Prueba",
      responsable: "",
      destinatario: "",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
  });
  const texto = textoDePaginas(await PDFDocument.load(r.bytes))
    .flat()
    .join(" ");
  assert.match(texto, /100\.00/);
  assert.match(texto, /25\.00/);
  assert.doesNotMatch(texto, /sin movimientos de dinero registrados/i);
  assert.doesNotMatch(texto, /Otra empresa de prueba|500\.00/);
  const emitido = await api.informes.emitir({
    alcance: { tipo: "parte", parte_id: "agricola" },
    opciones: {
      titulo: "Prueba",
      responsable: "",
      destinatario: "",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
    exportar: false,
  });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load((await api.informes.excel(emitido.informe.id)).bytes);
  const recibidos = [];
  libro.getWorksheet("Recepciones").eachRow((fila, n) => {
    if (n > 1)
      recibidos.push([
        fila.getCell(2).value,
        fila.getCell(4).value,
        fila.getCell(5).value,
      ]);
  });
  assert.deepEqual(recibidos, [
    ["Agrícola de prueba", 100, 0],
    ["Agrícola de prueba", 25, 25],
  ]);
});

test("un reembolso sin gestión liquida solo la obligación de la misma parte y moneda", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "sin-gestion",
      gestion_id: null,
      importe: 10000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 10000 }],
      pagos: [{ origen: "propio", importe: 10000 }],
    }),
  );
  const previo = await api.informes.previsualizar({
    alcance: { tipo: "parte", parte_id: "agricola" },
    opciones: {
      titulo: "Sin gestión",
      responsable: "",
      destinatario: "",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
  });
  const textoPrevio = textoDePaginas(await PDFDocument.load(previo.bytes))
    .flat()
    .join(" ");
  assert.match(textoPrevio, /Por reembolsar/);
  assert.match(textoPrevio, /100\.00/);
  const entrada = {
    id: "devuelto",
    fecha: "2026-10-25",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: null, destino: "reembolso", importe: 10000 }],
  };
  assert.equal((await api.fondos.recibir(entrada)).creada, true);
  assert.equal((await api.fondos.recibir(entrada)).creada, false);
  assert.equal(
    saldo(
      (await api.saldos.consultar()).saldos,
      "por_reembolsar",
      "agricola",
      null,
    ),
    0,
  );
  assert.equal((await api.compras.listar()).length, 1);
  await assert.rejects(
    () => api.fondos.recibir({ ...entrada, id: "exceso" }),
    /excede/i,
  );
  await assert.rejects(
    () => api.fondos.recibir({ ...entrada, id: "usd", moneda: "USD" }),
    /excede/i,
  );
  await assert.rejects(
    () =>
      api.fondos.recibir({
        ...entrada,
        id: "anticipo",
        aplicaciones: [
          { gestion_id: null, destino: "anticipo", importe: 10000 },
        ],
      }),
    /gestión/i,
  );
  const respaldo = await api.respaldo.crear();
  const restaurada = await entorno();
  await restaurada.api.respaldo.restaurar(respaldo.bytes);
  assert.equal(
    saldo(
      (await restaurada.api.saldos.consultar()).saldos,
      "por_reembolsar",
      "agricola",
      null,
    ),
    0,
  );
  assert.equal(
    (await restaurada.api.fondos.recepciones()).find((r) => r.id === "devuelto")
      .aplicaciones[0].gestion_id,
    null,
  );
});

test("migración 6 a 7 conserva aplicaciones y eventos existentes", async () => {
  const e = await entorno();
  await basico(e.api);
  await e.api.fondos.recibir({
    id: "entrada-v6",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [
      {
        id: "aplicacion-v6",
        gestion_id: "g1",
        destino: "anticipo",
        importe: 10000,
      },
    ],
  });
  await e.api.compras.registrar(
    compra({
      id: "compra-v6",
      importe: 5000,
      forma_pago: "contado",
      asignaciones: [
        { id: "asignacion-v6", parte_id: "agricola", importe: 5000 },
      ],
      pagos: [{ id: "pago-v6", origen: "propio", importe: 5000 }],
      imagenes: [imagen()],
    }),
  );
  const antes = await e.repo.cargarTodo();
  const anterior = new SQL.Database(e.persistido());
  anterior.run(`DROP TABLE regularizaciones; DROP TABLE atribuciones_regularizacion;
  CREATE TABLE aplicaciones_v6 (id TEXT PRIMARY KEY, recepcion_id TEXT NOT NULL REFERENCES recepciones(id), gestion_id TEXT NOT NULL REFERENCES gestiones(id), destino TEXT NOT NULL CHECK(destino IN ('anticipo','reembolso')), importe INTEGER NOT NULL CHECK(importe > 0), anulada TEXT);
  INSERT INTO aplicaciones_v6 SELECT * FROM aplicaciones;
  DROP TABLE aplicaciones;
  ALTER TABLE aplicaciones_v6 RENAME TO aplicaciones;
  CREATE INDEX aplicaciones_recepcion ON aplicaciones(recepcion_id);
  PRAGMA user_version = 6;`);
  const actual = await entorno({ snapshot: anterior.export() });
  assert.deepEqual(await actual.repo.cargarTodo(), antes);
  assert.equal(
    (await actual.db.query("PRAGMA user_version")).values[0].user_version,
    8,
  );
  assert.equal(
    (await actual.repo.una("aplicaciones", "aplicacion-v6")).importe,
    10000,
  );
  assert.equal(
    saldo((await actual.api.saldos.consultar()).saldos, "custodia", "agricola"),
    10000,
  );
  assert.ok(
    (await actual.repo.todas("eventos")).some(
      (event) => event.entidad_id === "entrada-v6",
    ),
  );
});
