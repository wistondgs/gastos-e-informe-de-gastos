import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "@vue/compiler-sfc";
import { entorno, basico } from "./apoyo-api.js";
import { compra } from "./apoyo-api.js";
import { prepararCompraFinanciera } from "../src/interfaz/flujo-financiero.js";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { textoDePaginas } from "./apoyo-informes.js";

test("caja obtiene las dos entregas individuales desde el historial de la gestión", async () => {
  const { api } = await entorno();
  await basico(api);
  for (const [id, fecha, importe] of [
    ["uno", "2026-10-21", 100000],
    ["dos", "2026-10-22", 300000],
  ])
    await api.fondos.recibir({
      id,
      fecha,
      parte_id: "agricola",
      importe,
      moneda: "NIO",
      referencia: id,
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe }],
    });
  const h = (await api.gestiones.detalle("g1")).historial.filter(
    (x) => x.tipo === "anticipo",
  );
  assert.deepEqual(
    h.map((x) => [x.fecha, x.importe, x.referencia]),
    [
      ["2026-10-21", 100000, "uno"],
      ["2026-10-22", 300000, "dos"],
    ],
  );
  assert.equal(
    (await api.saldos.cuentas()).cuentas.find((c) => c.parte_id === "agricola")
      .custodia,
    400000,
  );
  const { informe, bytes } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: {
      titulo: "Prueba",
      responsable: "Juan",
      destinatario: "Empresa sintética",
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
  for (const dato of [
    "21/10/2026",
    "22/10/2026",
    "1,000.00",
    "3,000.00",
    "4,000.00",
  ])
    assert.ok(texto.includes(dato), dato);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load((await api.informes.excel(informe.id)).bytes);
  const entradas = [];
  libro.getWorksheet("Recepciones").eachRow((fila, n) => {
    if (n > 1) entradas.push([fila.getCell(1).value, fila.getCell(4).value]);
  });
  assert.deepEqual(entradas, [
    ["21/10/2026", 1000],
    ["22/10/2026", 3000],
  ]);
  const fuente = await readFile(
    new URL("../src/interfaz/guiada/VerComoVoy.vue", import.meta.url),
    "utf8",
  );
  assert.equal(parse(fuente).errors.length, 0);
  assert.match(fuente, /api\.gestiones\.detalle\(id\)/);
  assert.match(fuente, /Ver compra y comprobantes/);
});

test("la recepción permite elegir fecha y la presenta antes de guardar", async () => {
  const fuente = await readFile(
    new URL("../src/interfaz/guiada/RecibirGuiado.vue", import.meta.url),
    "utf8",
  );
  assert.equal(parse(fuente).errors.length, 0);
  assert.match(fuente, /v-model="d\.fecha"/);
  assert.match(fuente, /fecha: d\.value\.fecha/);
  assert.match(fuente, /montoTexto.*d\.fecha/);
});

test("historial del mismo día sigue el orden registrado y no el orden de identificadores", async () => {
  const { api } = await entorno();
  await basico(api);
  for (const [id, aplicacion] of [
    ["r1", "z-entrada"],
    ["r2", "a-entrada"],
  ])
    await api.fondos.recibir({
      id,
      fecha: "2026-10-21",
      parte_id: "agricola",
      importe: 10000,
      moneda: "NIO",
      aplicaciones: [
        {
          id: aplicacion,
          gestion_id: "g1",
          destino: "anticipo",
          importe: 10000,
        },
      ],
    });
  await api.compras.registrar(
    prepararCompraFinanciera(compra({ id: "m-compra", importe: 10000 }), {
      tipo: "fondo",
      parte_id: "agricola",
    }),
  );
  const historial = (await api.gestiones.detalle("g1")).historial.filter((x) =>
    ["anticipo", "compra", "pago"].includes(x.tipo),
  );
  assert.deepEqual(
    historial.map((x) => x.tipo),
    ["anticipo", "anticipo", "compra", "pago"],
  );
  assert.deepEqual(
    historial.slice(0, 2).map((x) => x.id),
    ["z-entrada", "a-entrada"],
  );
});

test("la aplicación posterior muestra su fecha registrada, no la de recepción", async () => {
  let fecha = new Date("2026-10-21T12:00:00Z");
  const { api } = await entorno({ reloj: () => fecha });
  await basico(api);
  await api.fondos.recibir({
    id: "entrada",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [],
  });
  fecha = new Date("2026-10-23T12:00:00Z");
  await api.fondos.aplicar("entrada", [
    { id: "aplicacion", gestion_id: "g1", destino: "anticipo", importe: 10000 },
  ]);
  const h = (await api.gestiones.detalle("g1")).historial.find(
    (x) => x.id === "aplicacion" && x.tipo === "anticipo",
  );
  assert.equal(h.fecha, "2026-10-23");
});

test("la compra guiada conserva la fecha elegida en la entrada de la API", async () => {
  const { prepararCompraGuiada } =
    await import("../src/interfaz/guiada/guia.js");
  const entrada = prepararCompraGuiada(
    {
      id: "c",
      gestion_id: "g1",
      fecha: "2026-10-21",
      concepto: "Ejemplo",
      proveedor: "Negocio",
      monto: "10",
      moneda: "NIO",
      factura: "",
      comprobante: "sin_factura",
      quien: "personal",
      pagado: "si",
    },
    "2026-10-29",
  );
  assert.equal(entrada.fecha_compra, "2026-10-21");
  const fuente = await readFile(
    new URL("../src/interfaz/guiada/AsistenteGasto.vue", import.meta.url),
    "utf8",
  );
  assert.match(fuente, /props\.api\.saldos\.cuentas/);
  assert.match(fuente, /Pendiente de\s+reembolso/);
});

test("la revisión de pago combinado indica ambos importes exactos", async () => {
  const { resumenPagoCombinado } =
    await import("../src/interfaz/guiada/guia.js");
  const d = {
    id: "c",
    gestion_id: "g1",
    concepto: "Compra",
    proveedor: "Negocio",
    monto: "1000",
    moneda: "NIO",
    factura: "",
    comprobante: "sin_factura",
    quien: "agricola",
    pagado: "si",
    origen: "combinado",
    propietario_id: "agricola",
    monto_fondo: "800",
  };
  const texto = resumenPagoCombinado(d, "2026-10-21", "Empresa");
  assert.match(texto, /C\$ 800\.00/);
  assert.match(texto, /C\$ 200\.00/);
});

test("vista previa entrega los mismos saldos del informe sin emitir revisión", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "fondo",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 80000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 80000 }],
  });
  await api.compras.registrar(
    prepararCompraFinanciera(compra({ id: "mixta", importe: 100000 }), {
      tipo: "combinado",
      parte_id: "agricola",
      fondo: "800",
    }),
  );
  const vista = await api.informes.previsualizar({
    alcance: { tipo: "gestion", gestion_id: "g1" },
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
  const c = vista.financiero.cuentas.find((x) => x.parte_id === "agricola");
  assert.deepEqual(
    [
      c.recibido,
      c.usado_fondo,
      c.aportado_propio,
      c.custodia,
      c.por_reembolsar,
    ],
    [80000, 80000, 20000, 0, 20000],
  );
  assert.equal((await repo.todas("informes")).length, 0);
  const emitido = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
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
  const texto = textoDePaginas(await PDFDocument.load(emitido.bytes))
    .flat()
    .join(" ");
  assert.match(texto, /Pagado con fondos C\$ 800\.00/);
  assert.match(texto, /Aporte propio C\$ 200\.00/);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load((await api.informes.excel(emitido.informe.id)).bytes);
  const fila = libro.getWorksheet("Compras").getRow(2);
  assert.equal(fila.getCell(12).value, 800);
  assert.equal(fila.getCell(13).value, 200);
});

test("los ejemplos visibles no incluyen el nombre del propietario", async () => {
  const archivos = [
    "../src/interfaz/App.vue",
    "../src/interfaz/guiada/InicioGuiado.vue",
    "../src/interfaz/guiada/RecibirGuiado.vue",
    "../src/interfaz/guiada/AsistenteGasto.vue",
    "../src/interfaz/guiada/guia.js",
  ];
  for (const archivo of archivos) {
    const fuente = await readFile(new URL(archivo, import.meta.url), "utf8");
    assert.doesNotMatch(fuente, /winston/i);
  }
});

test("Excel por destinatario no revela el total de una compra compartida", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "compartida",
      importe: 100000,
      forma_pago: "contado",
      asignaciones: [
        { parte_id: "agricola", importe: 60000 },
        { parte_id: "otra", importe: 40000 },
      ],
      pagos: [
        { origen: "propio", asignacion: 0, importe: 60000 },
        { origen: "propio", asignacion: 1, importe: 40000 },
      ],
    }),
  );
  const { informe, bytes } = await api.informes.emitir({
    alcance: { tipo: "parte", parte_id: "agricola" },
    opciones: {
      titulo: "Prueba",
      responsable: "Juan",
      destinatario: "Agrícola",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
    exportar: false,
  });
  const libro = new ExcelJS.Workbook();
  const pdf = textoDePaginas(await PDFDocument.load(bytes))
    .flat()
    .join(" ");
  assert.doesNotMatch(pdf, /Otra empresa de prueba|1,000\.00|400\.00/);
  assert.match(pdf, /600\.00/);
  await libro.xlsx.load((await api.informes.excel(informe.id)).bytes);
  const fila = libro.getWorksheet("Compras").getRow(2);
  assert.equal(fila.getCell(8).value, null);
  assert.equal(fila.getCell(9).value, 600);
  assert.doesNotMatch(JSON.stringify(libro.model), /Otra empresa de prueba/);
  const originalPdf = await api.informes.abrir(informe.id);
  await repo.aplicar({
    cambios: [{ tabla: "informes", id: informe.id, campos: { motor: 8 } }],
  });
  await assert.rejects(() => api.informes.excel(informe.id), /nueva revisión/i);
  const historico = await api.informes.abrir(informe.id);
  assert.deepEqual(historico.bytes, originalPdf.bytes);
});
