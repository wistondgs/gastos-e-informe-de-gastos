import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { pdfGestion } from "../src/exportaciones/informes.js";
import { huella } from "../src/datos/archivos.js";
const gestion = {
  id: "gestion-1",
  nombre: "Jornada de prueba",
  fecha_inicio: "2026-10-20",
  fecha_fin: "2026-10-27",
};
const compra = (id, moneda, importe, gestionId = "gestion-1") => ({
  id,
  gestion_id: gestionId,
  fecha_compra: "2026-10-21",
  fecha_registro: "2026-10-21T12:00:00Z",
  proveedor: "Proveedor prueba",
  concepto: "Compra prueba",
  importe,
  moneda,
  factura: "0000123",
  estado: "factura",
});
test("informe reúne compras de una gestión con opciones de comprobantes", async () => {
  const bytes = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a0kAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const foto = {
    id: "foto-1",
    compra_id: "c1",
    ruta: "prueba",
    tipo: "image/png",
    clase: "factura",
    sha256: await huella(bytes),
  };
  const items = [
    { compra: compra("c1", "NIO", 125075), fotos: [foto] },
    { compra: compra("c2", "USD", 1000), fotos: [] },
  ];
  const files = { leer: async () => bytes };
  const sin = await PDFDocument.load(
    await pdfGestion(gestion, items, files, "Informe", false),
  );
  const con = await PDFDocument.load(
    await pdfGestion(gestion, items, files, "Informe", true),
  );
  const contenido = sin.getPage(0).node.Contents().lookup(0, PDFRawStream);
  const stream = Buffer.from(decodePDFRawStream(contenido).decode()).toString();
  const lineas = [...stream.matchAll(/<([0-9A-F]+)> Tj/g)].map((m) =>
    Buffer.from(m[1], "hex").toString("latin1"),
  );
  assert.ok(lineas.includes("Compras: 2"));
  assert.ok(lineas.includes("Córdobas: C$ 1,250.75"));
  assert.ok(lineas.includes("Dólares: US$ 10.00"));
  assert.equal(
    lineas.filter((linea) => linea.includes("Factura: 0000123")).length,
    2,
  );
  assert.equal(sin.getPageCount(), 1);
  assert.equal(con.getPageCount(), 2);
  await assert.rejects(() =>
    pdfGestion(
      gestion,
      [{ compra: compra("otra", "NIO", 1, "gestion-ajena"), fotos: [] }],
      files,
      "Informe",
      false,
    ),
  );
  await assert.rejects(() =>
    pdfGestion(
      gestion,
      [{ compra: compra("c2", "NIO", 1), fotos: [foto] }],
      files,
      "Informe",
      true,
    ),
  );
});
