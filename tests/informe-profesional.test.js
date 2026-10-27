import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { prepararInforme, codigoInforme } from "../src/dominio/informe.js";
import { informePdf } from "../src/exportaciones/informe-pdf.js";
import { informeExcel } from "../src/exportaciones/informe-excel.js";
import {
  png,
  fotoDe,
  archivosEnMemoria,
  textoDePaginas,
  compraDe,
} from "./apoyo-informes.js";
const gestion = {
  id: "gestion-1",
  nombre: "Winston Managua",
  fecha_inicio: "2026-10-20",
  fecha_fin: "2026-10-27",
};
const base = {
  titulo: "Rendición de gastos",
  responsable: "Winston D. Gutiérrez",
  destinatario: "Agrícola de prueba",
  corte: "2026-10-27",
  papel: "carta",
  estilo: "ejecutivo",
  incluirFotos: true,
  revision: 1,
  generado: "2026-10-27T20:00:00.000Z",
};
async function escenario() {
  const files = archivosEnMemoria();
  const corta = png(300, 200),
    larga = png(300, 1400, 230),
    voucher = png(200, 300, 180);
  const f1 = await fotoDe("foto-1", "c1", corta);
  const f2 = await fotoDe("foto-2", "c2", larga);
  const f3 = await fotoDe("foto-3", "c2", voucher, "voucher");
  await files.escribir(f1.ruta, corta);
  await files.escribir(f2.ruta, larga);
  await files.escribir(f3.ruta, voucher);
  const items = [
    {
      compra: compraDe("c2", "NIO", 425075, {
        fecha_compra: "2026-10-22",
        factura: "0000124",
        concepto: "Combustible",
      }),
      fotos: [f2, f3],
    },
    {
      compra: compraDe("c1", "NIO", 820000, {
        factura: "0000123",
        concepto: "Compra supermercado",
      }),
      fotos: [f1],
    },
    {
      compra: compraDe("c3", "USD", 8500, {
        fecha_compra: "2026-10-23",
        factura: "0000125",
        concepto: "Alimentación",
      }),
      fotos: [],
    },
    {
      compra: compraDe("c4", "NIO", 10000, {
        fecha_compra: "2026-10-24",
        factura: "",
        estado: "pendiente",
        concepto: "Peaje",
      }),
      fotos: [],
    },
    {
      compra: compraDe("c5", "USD", 1500, {
        fecha_compra: "2026-10-29",
        concepto: "Después del corte",
      }),
      fotos: [],
    },
  ];
  return { files, items };
}
test("los totales van por moneda, cuadran con las filas y respetan el corte", async () => {
  const { items } = await escenario();
  const m = prepararInforme(gestion, items, base);
  assert.deepEqual(
    m.filas.map((f) => f.compra.id),
    ["c1", "c2", "c3", "c4"],
  );
  assert.equal(m.totales.NIO.importe, 820000 + 425075 + 10000);
  assert.equal(m.totales.USD.importe, 8500);
  for (const mon of ["NIO", "USD"])
    assert.equal(
      m.filas
        .filter((f) => f.compra.moneda === mon)
        .reduce((a, f) => a + f.compra.importe, 0),
      m.totales[mon].importe,
    );
  assert.deepEqual(m.monedas, ["NIO", "USD"]);
  assert.equal(m.codigo, codigoInforme("gestion-1", 1));
  assert.equal(m.codigo, "GR-GESTION1-R01");
});
test("los anexos se numeran en el orden de la tabla y la falta de imagen se informa", async () => {
  const { items } = await escenario();
  const m = prepararInforme(gestion, items, base);
  assert.deepEqual(
    m.anexos.map((a) => [a.numero, a.compra.id, a.foto.id, a.fila]),
    [
      [1, "c1", "foto-1", 1],
      [2, "c2", "foto-2", 2],
      [3, "c2", "foto-3", 2],
    ],
  );
  assert.equal(m.filas[0].soporte.texto, "A-01");
  assert.equal(m.filas[1].soporte.texto, "A-02, A-03");
  assert.equal(m.filas[2].soporte.estado, "ausente");
  assert.equal(m.filas[3].soporte.estado, "pendiente");
  assert.equal(m.anexos[1].titulo, "Factura 0000124");
  assert.equal(m.anexos[2].titulo, "Voucher 0000124");
  const sin = prepararInforme(gestion, items, { ...base, incluirFotos: false });
  assert.equal(sin.anexos.length, 0);
  assert.equal(sin.filas[0].soporte.texto, "Presente, no anexado");
});
test("rechaza compras ajenas, duplicadas, fotos cruzadas y cortes inválidos", async () => {
  const { items } = await escenario();
  const ajena = {
    ...items[0],
    compra: { ...items[0].compra, gestion_id: "otra" },
  };
  assert.throws(() => prepararInforme(gestion, [ajena], base), /ajena/);
  assert.throws(
    () => prepararInforme(gestion, [items[0], items[0]], base),
    /duplicada/,
  );
  assert.throws(
    () =>
      prepararInforme(gestion, [{ ...items[2], fotos: items[0].fotos }], base),
    /no corresponde/,
  );
  assert.throws(
    () =>
      prepararInforme(
        gestion,
        [{ ...items[2], compra: { ...items[2].compra, moneda: "EUR" } }],
        base,
      ),
    /moneda/,
  );
  assert.throws(
    () => prepararInforme(gestion, items, { ...base, corte: "2026-10-19" }),
    /corte/,
  );
  assert.throws(
    () => prepararInforme(gestion, items, { ...base, papel: "oficio" }),
    /papel/,
  );
  assert.throws(
    () => prepararInforme(gestion, items, { ...base, titulo: " " }),
    /título/,
  );
});
test("el PDF ejecutivo en Carta trae datos, tabla, totales separados y anexos", async () => {
  const { files, items } = await escenario();
  const m = prepararInforme(gestion, items, base);
  const doc = await PDFDocument.load(await informePdf(m, files));
  const paginas = textoDePaginas(doc);
  const todo = paginas.flat();
  assert.deepEqual(
    doc.getPages().map((p) => [p.getWidth(), p.getHeight()]),
    Array(doc.getPageCount()).fill([612, 792]),
  );
  assert.equal(doc.getPageCount(), 1 + 3);
  assert.ok(todo.includes("Winston Managua"));
  assert.ok(todo.includes("GR-GESTION1-R01"));
  assert.ok(todo.includes("C$ 12,550.75"));
  assert.ok(todo.includes("US$ 85.00"));
  assert.ok(
    !todo.some((t) => /C\$ 12,635|13,400/.test(t)),
    "nunca un total mezclado",
  );
  assert.ok(
    todo.includes("Compra 3 · Proveedor prueba · Ausente: falta la imagen"),
  );
  assert.ok(todo.includes("A-02, A-03"));
  assert.ok(!todo.includes("Después del corte"));
  assert.equal(paginas[1][0], "ANEXO 01");
  assert.equal(paginas[2][1], "Factura 0000124");
  assert.equal(paginas[3][1], "Voucher 0000124");
  paginas.forEach((p, i) => assert.ok(p.includes(`Página ${i + 1} de 4`)));
  assert.ok(
    !todo.some((t) => t.includes("W. D. Gutiérrez")),
    "sin la firma del desarrollador",
  );
  assert.ok(
    todo.some((t) => t.includes("Liquidación del dinero: no calculada")),
  );
});
test("el modo formal en A4 trae el bloque de revisión y no tiene anexos sin fotos", async () => {
  const { files, items } = await escenario();
  const m = prepararInforme(gestion, items, {
    ...base,
    papel: "a4",
    estilo: "formal",
    incluirFotos: false,
  });
  const doc = await PDFDocument.load(await informePdf(m, files));
  const todo = textoDePaginas(doc).flat();
  assert.equal(doc.getPageCount(), 1);
  assert.equal(Math.round(doc.getPage(0).getWidth()), 595);
  assert.equal(Math.round(doc.getPage(0).getHeight()), 842);
  assert.ok(todo.includes("REVISIÓN Y CONFORMIDAD"));
  assert.ok(todo.includes("Revisado por"));
  assert.ok(todo.includes("Esta revisión se emitió sin anexos fotográficos."));
});
test("la tabla larga continúa en otra página con su cabecera", async () => {
  const files = archivosEnMemoria();
  const items = Array.from({ length: 60 }, (_, i) => ({
    compra: compraDe(`c${String(i).padStart(2, "0")}`, "NIO", 100 + i, {
      concepto: `Concepto largo número ${i} con varias palabras para ocupar dos líneas de la columna`,
    }),
    fotos: [],
  }));
  const m = prepararInforme(gestion, items, { ...base, incluirFotos: false });
  const doc = await PDFDocument.load(await informePdf(m, files));
  const paginas = textoDePaginas(doc);
  assert.ok(paginas.length >= 3);
  for (const p of paginas.slice(1, -1))
    assert.ok(p.includes("Proveedor"), "cabecera repetida");
  const numeros = paginas
    .flat()
    .filter((t) => /^\d+$/.test(t))
    .map(Number);
  for (let n = 1; n <= 60; n++) assert.ok(numeros.includes(n), `fila ${n}`);
});
test("un emoji o un carácter fuera de WinAnsi no rompe el PDF", async () => {
  const files = archivosEnMemoria();
  const items = [
    {
      compra: compraDe("c1", "NIO", 100, { concepto: "Café ☕ y pan → 𝔁" }),
      fotos: [],
    },
  ];
  const m = prepararInforme(gestion, items, {
    ...base,
    titulo: "Informe ✓",
    incluirFotos: false,
  });
  const doc = await PDFDocument.load(await informePdf(m, files));
  assert.ok(
    textoDePaginas(doc)
      .flat()
      .some((t) => t.startsWith("Café ? y pan ? ?")),
  );
});
test("un comprobante alterado detiene el informe", async () => {
  const { files, items } = await escenario();
  files.m.set("comprobantes/foto-1.png", png(10, 10));
  const m = prepararInforme(gestion, items, base);
  await assert.rejects(() => informePdf(m, files), /alterado/);
});
test("el Excel de la revisión trae los mismos totales, documento como texto y sin fórmulas", async () => {
  const { items } = await escenario();
  items[0].compra.proveedor = "=HYPERLINK(1)";
  const m = prepararInforme(gestion, items, base);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await informeExcel(m));
  const resumen = libro.getWorksheet("Resumen"),
    hoja = libro.getWorksheet("Compras");
  const valores = [];
  resumen.eachRow((r) => valores.push(r.values.slice(1)));
  assert.ok(
    valores.some((v) => v[0] === "NIO" && v[1] === 12550.75 && v[2] === 3),
  );
  assert.ok(valores.some((v) => v[0] === "USD" && v[1] === 85 && v[2] === 1));
  assert.equal(hoja.rowCount, 1 + 4);
  assert.equal(hoja.getRow(2).getCell(4).value, "0000123");
  assert.equal(hoja.getRow(3).getCell(3).value, "'=HYPERLINK(1)");
});
test("una compra en la fecha de corte entra en el informe", async () => {
  const { items } = await escenario();
  const m = prepararInforme(gestion, items, { ...base, corte: "2026-10-22" });
  assert.deepEqual(
    m.filas.map((f) => f.compra.id),
    ["c1", "c2"],
  );
});
test("el PDF no depende del reloj: la misma revisión da los mismos bytes otro día", async (t) => {
  const { files, items } = await escenario();
  const m = prepararInforme(gestion, items, base);
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 27) });
  const a = await informePdf(m, files);
  t.mock.timers.setTime(Date.UTC(2027, 2, 3, 10, 30));
  const b = await informePdf(m, files);
  assert.deepEqual(a, b);
});
