import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { textoDePaginas } from "./apoyo-informes.js";
import { entorno, basico, compra } from "./apoyo-api.js";
import { prepararCompraFinanciera } from "../src/interfaz/flujo-financiero.js";
const opciones = {
  titulo: "Conciliación",
  responsable: "",
  destinatario: "",
  corte: "2026-10-27",
  papel: "carta",
  estilo: "ejecutivo",
  incluirFotos: false,
};
test("T3: PDF y Excel exponen fondos aplicados, usados, aporte y custodia con el mismo modelo", async () => {
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
  await api.compras.registrar(
    prepararCompraFinanciera(compra({ id: "c", importe: 11000 }), {
      tipo: "combinado",
      parte_id: "agricola",
      fondo: "80",
    }),
  );
  const { informe, bytes } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
    exportar: false,
  });
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  const c = modelo.financiero.cuentas.find(
    (x) => x.parte === "Agrícola de prueba" && x.moneda === "NIO",
  );
  assert.deepEqual(
    [
      c.recibido,
      c.usado_fondo,
      c.aportado_propio,
      c.custodia,
      c.por_reembolsar,
    ],
    [10000, 8000, 3000, 2000, 3000],
  );
  assert.ok(modelo.financiero.movimientos.some((m) => m.tipo === "Aplicación"));
  assert.ok(
    modelo.financiero.movimientos.some((m) => m.tipo === "Pago con fondo"),
  );
  const txt = textoDePaginas(await PDFDocument.load(bytes))
    .flat()
    .join(" ");
  for (const x of ["100.00", "80.00", "30.00", "20.00"])
    assert.ok(txt.includes(x), x);
  const excel = await api.informes.excel(informe.id);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(excel.bytes);
  assert.ok(wb.getWorksheet("Movimientos"));
  const hoja = wb.getWorksheet("Conciliación");
  assert.ok(hoja);
  const valores = new Map();
  hoja.eachRow((r, i) => {
    if (i > 1) valores.set(r.getCell(4).value, r.getCell(5).value);
  });
  assert.equal(valores.get("Fondos aplicados"), 100);
  assert.equal(valores.get("Pagado con fondos"), 80);
  assert.equal(valores.get("Aporte propio"), 30);
  assert.equal(valores.get("Por reembolsar"), 30);
  assert.equal(valores.get("En custodia"), 20);
});
test("T5: el subconjunto no atribuye saldos de toda la gestión a las compras elegidas", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.compras.registrar(
    prepararCompraFinanciera(compra({ id: "a" }), {
      tipo: "propio",
      parte_id: "agricola",
    }),
  );
  await api.compras.registrar(
    prepararCompraFinanciera(compra({ id: "b" }), {
      tipo: "propio",
      parte_id: "agricola",
    }),
  );
  const { informe, bytes } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: { ...opciones, compras: ["a"] },
    exportar: false,
  });
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  assert.equal(modelo.filas.length, 1);
  assert.equal(modelo.financiero, null);
  assert.match(modelo.observaciones.join(" "), /selección parcial/i);
  const texto = textoDePaginas(await PDFDocument.load(bytes))
    .flat()
    .join(" ");
  assert.match(texto, /Saldos generales no incluidos/);
  assert.doesNotMatch(texto, /sin movimientos de dinero registrados/i);
});

test("T1 y T2: entradas sucesivas y distribución no duplican anticipos por gestión", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.gestiones.crear({
    id: "g2",
    nombre: "Otra gestión",
    fecha_inicio: "2026-10-20",
  });
  for (const [id, importe] of [
    ["r1", 10000000],
    ["r2", 10000000],
    ["r3", 2000000],
  ])
    await api.fondos.recibir({
      id,
      fecha: "2026-10-21",
      parte_id: "agricola",
      importe,
      moneda: "NIO",
      aplicaciones: [],
    });
  const rs = await api.fondos.recepciones();
  assert.equal(rs.length, 3);
  assert.equal(
    rs.reduce((n, r) => n + r.importe, 0),
    22000000,
  );
  await api.fondos.recibir({
    id: "repartida",
    fecha: "2026-10-21",
    parte_id: "otra",
    importe: 10000000,
    moneda: "NIO",
    aplicaciones: [
      { gestion_id: "g1", destino: "anticipo", importe: 6000000 },
      { gestion_id: "g2", destino: "anticipo", importe: 2500000 },
    ],
  });
  const entrada = (await api.fondos.recepciones()).find(
    (r) => r.id === "repartida",
  );
  assert.equal(entrada.sin_aplicar, 1500000);
  const saldos = (await api.saldos.consultar()).saldos.filter(
    (s) => s.parte_id === "otra" && s.tipo === "custodia",
  );
  assert.equal(saldos.find((s) => s.gestion_id === "g1").importe, 6000000);
  assert.equal(saldos.find((s) => s.gestion_id === "g2").importe, 2500000);
});
test("T4: las compras en dólares y córdobas no se convierten ni se mezclan", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.compras.registrar(
    prepararCompraFinanciera(compra({ id: "nio", importe: 11000 }), {
      tipo: "propio",
      parte_id: "agricola",
    }),
  );
  await api.compras.registrar(
    prepararCompraFinanciera(
      compra({ id: "usd", importe: 12000, moneda: "USD" }),
      { tipo: "propio", parte_id: "agricola" },
    ),
  );
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
    exportar: false,
  });
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  assert.equal(modelo.totales.NIO.importe, 11000);
  assert.equal(modelo.totales.USD.importe, 12000);
  assert.equal(
    modelo.financiero.cuentas.find((c) => c.moneda === "NIO").aportado_propio,
    11000,
  );
  assert.equal(
    modelo.financiero.cuentas.find((c) => c.moneda === "USD").aportado_propio,
    12000,
  );
});

test("la recepción conserva finalidad y beneficiario por separado y protege el reintento", async () => {
  const { api } = await entorno();
  await basico(api);
  const entrada = {
    id: "r-contexto",
    fecha: "2026-10-21",
    parte_id: "agricola",
    beneficiario_id: "otra",
    finalidad: "Compra de materiales",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [],
  };
  await api.fondos.recibir(entrada);
  const r = (await api.fondos.recepciones()).find((x) => x.id === "r-contexto");
  assert.equal(r.parte_id, "agricola");
  assert.equal(r.beneficiario_id, "otra");
  assert.equal(r.finalidad, "Compra de materiales");
  assert.equal((await api.fondos.recibir(entrada)).creada, false);
  await assert.rejects(
    () => api.fondos.recibir({ ...entrada, finalidad: "Otra finalidad" }),
    /conflicto|identificador/i,
  );
});

test("migrar esquema 5 conserva la recepción y su reintento sin inventar contexto", async () => {
  const { SQL, entorno, basico } = await import("./apoyo-api.js");
  const e = await entorno();
  await basico(e.api);
  const entrada = {
    id: "v5",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
  };
  await e.api.fondos.recibir(entrada);
  const vieja = new SQL.Database(e.persistido());
  vieja.run(
    "DROP TABLE regularizaciones; DROP TABLE atribuciones_regularizacion; ALTER TABLE recepciones DROP COLUMN beneficiario_id; ALTER TABLE recepciones DROP COLUMN finalidad; PRAGMA user_version = 5;",
  );
  const nueva = await entorno({ snapshot: vieja.export() });
  const r = (await nueva.api.fondos.recepciones()).find((x) => x.id === "v5");
  assert.equal(r.importe, 10000);
  assert.equal(r.finalidad, "");
  assert.equal(r.beneficiario_id, null);
  assert.equal((await nueva.api.fondos.recibir(entrada)).creada, false);
});

test("un respaldo de esquema 5 restaura la recepción sin inventar datos nuevos", async () => {
  const { default: JSZip } = await import("jszip");
  const { huella } = await import("../src/datos/archivos.js");
  const e = await entorno();
  await basico(e.api);
  await e.api.fondos.recibir({
    id: "backup-v5",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
  });
  const zip = await JSZip.loadAsync((await e.api.respaldo.crear()).bytes);
  const datos = JSON.parse(await zip.file("datos.json").async("string"));
  datos.esquema = 5;
  for (const r of datos.tablas.recepciones) {
    delete r.finalidad;
    delete r.beneficiario_id;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(datos));
  zip.file("datos.json", bytes);
  const manifiesto = JSON.parse(
    await zip.file("manifiesto.json").async("string"),
  );
  manifiesto.datos = await huella(bytes);
  zip.file("manifiesto.json", JSON.stringify(manifiesto));
  const otra = await entorno();
  await otra.api.respaldo.restaurar(
    await zip.generateAsync({ type: "uint8array" }),
  );
  const r = (await otra.api.fondos.recepciones()).find(
    (x) => x.id === "backup-v5",
  );
  assert.equal(r.importe, 10000);
  assert.equal(r.finalidad, "");
  assert.equal(r.beneficiario_id, null);
});

test("destinatario identificado conserva nombre en revisión tras editar persona", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "parte", parte_id: "agricola" },
    opciones: { ...opciones, destinatario_id: "agricola" },
    exportar: false,
  });
  await api.partes.editar(
    "agricola",
    { nombre: "Nombre cambiado" },
    "Corrección de nombre",
  );
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  assert.equal(modelo.opciones.destinatario_id, "agricola");
  assert.equal(modelo.opciones.destinatario, "Agrícola de prueba");
});

test("informe distingue una recepción global de sus aplicaciones y remanente", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.gestiones.crear({
    id: "g2",
    nombre: "Segunda",
    fecha_inicio: "2026-10-20",
  });
  await api.fondos.recibir({
    id: "global",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000000,
    moneda: "NIO",
    aplicaciones: [
      { gestion_id: "g1", destino: "anticipo", importe: 6000000 },
      { gestion_id: "g2", destino: "anticipo", importe: 2500000 },
    ],
  });
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
    exportar: false,
  });
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  assert.equal(modelo.financiero.recepciones.length, 1);
  assert.deepEqual(
    [
      modelo.financiero.recepciones[0].total,
      modelo.financiero.recepciones[0].sin_aplicar,
    ],
    [10000000, 1500000],
  );
  assert.equal(
    modelo.financiero.cuentas.find((c) => c.gestion_id === "g1").recibido,
    6000000,
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await api.informes.excel(informe.id)).bytes);
  assert.ok(wb.getWorksheet("Recepciones"));
});

test("el responsable de la gestión no aparece como no indicado", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
    exportar: false,
  });
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  assert.equal(modelo.opciones.responsable, "Juan Pérez");
  assert.equal(
    modelo.descripcion.lineas.some(([k]) => k.startsWith("Responsable de ")),
    false,
  );
});
