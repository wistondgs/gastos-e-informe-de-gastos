import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  PDFDocument,
  PDFRawStream,
  PDFArray,
  decodePDFRawStream,
} from "pdf-lib";
import { textoDePaginas } from "./apoyo-informes.js";
import { entorno, imagen } from "./apoyo-api.js";

test("el informe al día 15 incluye compra, reparto y saldo anulados el día 20", async () => {
  let fecha = new Date("2026-10-10T12:00:00.000Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.partes.crear({
    id: "p",
    nombre: "Persona prueba",
    tipo: "persona",
  });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión prueba",
    fecha_inicio: "2026-10-01",
  });
  await api.compras.registrar({
    id: "c",
    gestion_id: "g",
    fecha_compra: "2026-10-10",
    concepto: "Compra histórica",
    proveedor: "Proveedor prueba",
    importe: 100000,
    moneda: "NIO",
    factura: "01",
    estado: "factura",
    forma_pago: "contado",
    asignaciones: [{ parte_id: "p", importe: 100000 }],
    pagos: [{ origen: "propio", asignacion: 0, importe: 100000 }],
  });
  fecha = new Date("2026-10-20T12:00:00.000Z");
  await api.compras.anular("c", "Corrección posterior");
  const opciones = {
    titulo: "Informe de prueba",
    responsable: "",
    destinatario: "",
    corte: "2026-10-15",
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: false,
  };
  const r = await api.informes.previsualizar({
    alcance: { tipo: "parte", parte_id: "p" },
    opciones,
  });
  assert.equal(r.filas, 1);
  assert.equal(r.totales.NIO.importe, 100000);
  const texto = textoDePaginas(await PDFDocument.load(r.bytes))
    .flat()
    .join(" ");
  assert.match(texto, /Compra histórica/);
  assert.match(texto, /Por reembolsar/);
  const emitido = await api.informes.emitir({
    alcance: { tipo: "parte", parte_id: "p" },
    opciones,
    exportar: false,
  });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load((await api.informes.excel(emitido.informe.id)).bytes);
  const detalle = libro.getWorksheet("Compras").getRow(2);
  assert.equal(detalle.getCell(6).value, "Compra histórica");
  assert.equal(detalle.getCell(9).value, 1000);
  const conciliacion = libro.getWorksheet("Fondos y saldos");
  const saldos = [];
  conciliacion.eachRow((fila) => {
    if (String(fila.getCell(1).value).includes("Por reembolsar"))
      saldos.push(fila.getCell(4).value);
  });
  assert.deepEqual(saldos, [1000]);
  const posterior = await api.informes.previsualizar({
    alcance: { tipo: "parte", parte_id: "p" },
    opciones: { ...opciones, corte: "2026-10-20" },
  });
  assert.equal(posterior.filas, 0);
});

test("una sustitución económica posterior no aparece antes de su fecha", async () => {
  let fecha = new Date("2026-10-10T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.partes.crear({
    id: "p",
    nombre: "Persona prueba",
    tipo: "persona",
  });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión prueba",
    fecha_inicio: "2026-10-01",
  });
  await api.compras.registrar({
    id: "original",
    gestion_id: "g",
    fecha_compra: "2026-10-10",
    concepto: "Original",
    proveedor: "Proveedor",
    importe: 100000,
    moneda: "NIO",
    factura: "01",
    estado: "factura",
    forma_pago: "credito",
    deudor_id: "p",
  });
  fecha = new Date("2026-10-20T12:00:00Z");
  await api.compras.corregirEconomia(
    "original",
    { id: "nueva", importe: 200000 },
    "Cambio de importe",
  );
  const r = await api.informes.previsualizar({
    alcance: { tipo: "gestion", gestion_id: "g" },
    opciones: {
      titulo: "Prueba",
      responsable: "",
      destinatario: "",
      corte: "2026-10-15",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
  });
  assert.equal(r.filas, 1);
  assert.equal(r.totales.NIO.importe, 100000);
  const saldos = (await api.saldos.consultar({ corte: "2026-10-15" })).saldos;
  assert.equal(
    saldos
      .filter((s) => s.tipo === "deuda_proveedor")
      .reduce((n, s) => n + s.importe, 0),
    100000,
  );
});

test("una corrección descriptiva posterior no reescribe el contenido histórico", async () => {
  let fecha = new Date("2026-10-10T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión prueba",
    fecha_inicio: "2026-10-01",
  });
  await api.compras.registrar({
    id: "c",
    gestion_id: "g",
    fecha_compra: "2026-10-10",
    concepto: "Concepto anterior",
    proveedor: "Proveedor",
    importe: 100000,
    moneda: "NIO",
    factura: "01",
    estado: "factura",
  });
  fecha = new Date("2026-10-20T12:00:00Z");
  await api.compras.corregir(
    "c",
    { concepto: "Concepto posterior" },
    "Corrección descriptiva",
  );
  const r = await api.informes.previsualizar({
    alcance: { tipo: "gestion", gestion_id: "g" },
    opciones: {
      titulo: "Prueba",
      responsable: "",
      destinatario: "",
      corte: "2026-10-15",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
  });
  const texto = textoDePaginas(await PDFDocument.load(r.bytes))
    .flat()
    .join(" ");
  assert.match(texto, /Concepto anterior/);
  assert.doesNotMatch(texto, /Concepto posterior/);
});

test("un reparto reemplazado después del corte se rechaza si no hay fecha de creación suficiente", async () => {
  let fecha = new Date("2026-10-10T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.partes.crear({ id: "a", nombre: "A", tipo: "persona" });
  await api.partes.crear({ id: "b", nombre: "B", tipo: "persona" });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión",
    fecha_inicio: "2026-10-01",
  });
  await api.compras.registrar({
    id: "c",
    gestion_id: "g",
    fecha_compra: "2026-10-10",
    concepto: "Compra",
    proveedor: "Proveedor",
    importe: 100000,
    moneda: "NIO",
    factura: "01",
    estado: "factura",
    asignaciones: [{ parte_id: "a", importe: 100000 }],
  });
  fecha = new Date("2026-10-20T12:00:00Z");
  await api.compras.asignar(
    "c",
    [{ parte_id: "b", importe: 100000 }],
    "Cambiar reparto",
  );
  await assert.rejects(
    () =>
      api.informes.previsualizar({
        alcance: { tipo: "gestion", gestion_id: "g" },
        opciones: {
          titulo: "Prueba",
          responsable: "",
          destinatario: "",
          corte: "2026-10-15",
          papel: "carta",
          estilo: "ejecutivo",
          incluirFotos: false,
        },
      }),
    (e) => e.codigo === "ESTADO" && /reparto histórico/i.test(e.message),
  );
});

test("una fotografía agregada después del corte no aparece en el informe histórico", async () => {
  let fecha = new Date("2026-10-10T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión",
    fecha_inicio: "2026-10-01",
  });
  await api.compras.registrar({
    id: "c",
    gestion_id: "g",
    fecha_compra: "2026-10-10",
    concepto: "Compra",
    proveedor: "Proveedor",
    importe: 100000,
    moneda: "NIO",
    factura: "01",
    estado: "pendiente",
  });
  fecha = new Date("2026-10-20T12:00:00Z");
  await api.comprobantes.agregar("c", [imagen()]);
  const r = await api.informes.previsualizar({
    alcance: { tipo: "gestion", gestion_id: "g" },
    opciones: {
      titulo: "Prueba",
      responsable: "",
      destinatario: "",
      corte: "2026-10-15",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: true,
    },
  });
  assert.equal(r.anexos, 0);
});

test("una aplicación posterior no mueve custodia en un corte anterior", async () => {
  let fecha = new Date("2026-10-10T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.partes.crear({ id: "p", nombre: "Persona", tipo: "persona" });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión",
    fecha_inicio: "2026-10-01",
  });
  await api.fondos.recibir({
    id: "r",
    fecha: "2026-10-10",
    parte_id: "p",
    importe: 100000,
    moneda: "NIO",
  });
  fecha = new Date("2026-10-20T12:00:00Z");
  await api.fondos.aplicar("r", [
    { id: "a", gestion_id: "g", destino: "anticipo", importe: 100000 },
  ]);
  const antiguo = await api.saldos.consultar({ corte: "2026-10-15" });
  assert.equal(antiguo.saldos.length, 0);
  const actual = await api.saldos.consultar({ corte: "2026-10-20" });
  assert.equal(
    actual.saldos.find((s) => s.tipo === "custodia").importe,
    100000,
  );
});

test("el informe histórico conserva el ajuste anterior de una fotografía", async () => {
  let fecha = new Date("2026-10-10T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await api.gestiones.crear({
    id: "g",
    nombre: "Gestión",
    fecha_inicio: "2026-10-01",
  });
  await api.compras.registrar({
    id: "c",
    gestion_id: "g",
    fecha_compra: "2026-10-10",
    concepto: "Compra",
    proveedor: "Proveedor",
    importe: 100000,
    moneda: "NIO",
    factura: "01",
    estado: "factura",
    imagenes: [imagen()],
  });
  const foto = (await api.compras.detalle("c")).fotos[0];
  const entrada = {
    alcance: { tipo: "gestion", gestion_id: "g" },
    opciones: {
      titulo: "Prueba",
      responsable: "",
      destinatario: "",
      corte: "2026-10-15",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: true,
    },
  };
  const antes = await api.informes.previsualizar(entrada);
  fecha = new Date("2026-10-20T12:00:00Z");
  await api.anexos.ajustar(foto.id, {
    rotacion: 90,
    enderezar: 0,
    recorte: null,
  });
  const despues = await api.informes.previsualizar(entrada);
  const matriz = async (bytes) => {
    const d = await PDFDocument.load(bytes);
    const c = d.getPages()[1].node.Contents();
    const streams =
      c instanceof PDFArray
        ? c.asArray().map((r) => d.context.lookup(r, PDFRawStream))
        : [c];
    return streams
      .map((s) =>
        Buffer.from(decodePDFRawStream(s).decode()).toString("latin1"),
      )
      .join("\n")
      .match(/[-.\d]+ [-.\d]+ [-.\d]+ [-.\d]+ [-.\d]+ [-.\d]+ cm/g);
  };
  assert.deepEqual(await matriz(antes.bytes), await matriz(despues.bytes));
});
