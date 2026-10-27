import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { bytesABase64, huella } from "../datos/archivos.js";
import { dinero } from "../dominio/compra.js";
async function imagenesVerificadas(fotos, files) {
  const resultado = [];
  for (const foto of fotos) {
    const bytes = await files.leer(foto.ruta);
    if ((await huella(bytes)) !== foto.sha256)
      throw new Error("Un comprobante falta o está alterado.");
    resultado.push({ foto, bytes });
  }
  return resultado;
}
const seguroTexto = (v) => {
  const s = String(v ?? "");
  return /^[\t\r\n ]*[=+@-]/.test(s) ? `'${s}` : s;
};
export async function excel(compra, fotos, files, conImagenes = true) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Mis gastos";
  const hoja = libro.addWorksheet("Compra");
  hoja.columns = [{ width: 24 }, { width: 48 }, { width: 20 }, { width: 20 }];
  const filas = [
    ["Identificador", compra.id],
    ["Fecha de compra", compra.fecha_compra],
    ["Fecha de registro", compra.fecha_registro],
    ["Proveedor", compra.proveedor],
    ["Concepto", compra.concepto],
    ["Moneda", compra.moneda],
    ["Importe", compra.importe / 100],
    ["Número de factura", compra.factura],
    ["Estado", compra.estado],
  ];
  filas.forEach((row) =>
    hoja.addRow(
      row.map((x, i) =>
        i === 1 && typeof x === "string" ? seguroTexto(x) : x,
      ),
    ),
  );
  hoja.getCell("B7").numFmt = "#,##0.00";
  hoja.addRow([]);
  hoja.addRow(["Comprobantes", "Identificador", "Tipo"]);
  const imgs = conImagenes
    ? await imagenesVerificadas(fotos, files)
    : fotos.map((foto) => ({ foto }));
  for (const { foto, bytes } of imgs) {
    const r = hoja.addRow([foto.clase, foto.id, foto.tipo]);
    if (bytes) {
      r.height = 120;
      const id = libro.addImage({
        base64: `data:${foto.tipo};base64,${bytesABase64(bytes)}`,
        extension: foto.tipo === "image/png" ? "png" : "jpeg",
      });
      hoja.addImage(id, {
        tl: { col: 3, row: r.number - 1 },
        ext: { width: 150, height: 150 },
      });
    }
  }
  return new Uint8Array(await libro.xlsx.writeBuffer());
}
function envolver(texto, font, size, maxWidth) {
  const palabras = String(texto || "").split(/\s+/),
    lineas = [];
  let linea = "";
  for (const p0 of palabras) {
    let p = p0;
    while (p && font.widthOfTextAtSize(p, size) > maxWidth) {
      let i = 1;
      while (
        i < p.length &&
        font.widthOfTextAtSize(p.slice(0, i + 1), size) <= maxWidth
      )
        i++;
      if (linea) {
        lineas.push(linea);
        linea = "";
      }
      lineas.push(p.slice(0, i));
      p = p.slice(i);
    }
    const siguiente = linea ? `${linea} ${p}` : p;
    if (font.widthOfTextAtSize(siguiente, size) > maxWidth) {
      lineas.push(linea);
      linea = p;
    } else linea = siguiente;
  }
  if (linea) lineas.push(linea);
  return lineas;
}
export async function pdf(compra, fotos, files, encabezado) {
  const imagenes = await imagenesVerificadas(fotos, files);
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]),
    y = 790;
  const margin = 48;
  function pagina() {
    page = doc.addPage([595, 842]);
    y = 790;
  }
  function linea(texto, font = regular, size = 11) {
    for (const l of envolver(texto, font, size, 499)) {
      if (y < 60) pagina();
      page.drawText(l, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0.12, 0.19, 0.17),
      });
      y -= size + 6;
    }
  }
  linea(encabezado || "Informe de gastos", negrita, 18);
  y -= 8;
  for (const [label, value] of [
    ["Compra", compra.id],
    ["Fecha de compra", compra.fecha_compra],
    ["Fecha de registro", compra.fecha_registro],
    ["Proveedor", compra.proveedor],
    ["Concepto", compra.concepto],
    ["Importe", dinero(compra.importe, compra.moneda)],
    ["Factura", compra.factura || "Sin número"],
    ["Estado", compra.estado],
  ])
    linea(`${label}: ${value}`);
  if (!imagenes.length) {
    y -= 12;
    linea("Sin comprobantes adjuntos.");
  }
  for (const { foto, bytes } of imagenes) {
    pagina();
    linea(`Comprobante: ${foto.clase} · ${foto.id}`, negrita, 12);
    const img =
      foto.tipo === "image/png"
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    const scale = Math.min(499 / img.width, (y - 75) / img.height, 1);
    page.drawImage(img, {
      x: margin,
      y: y - img.height * scale,
      width: img.width * scale,
      height: img.height * scale,
    });
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: margin,
      y: 25,
      size: 9,
      font: regular,
    }),
  );
  return new Uint8Array(await doc.save());
}

/** Informe de compras, no liquidación: no se infieren pagos ni saldos. */
export async function pdfGestion(
  gestion,
  items,
  files,
  encabezado,
  incluirFotos = true,
) {
  if (!gestion?.id || !Array.isArray(items))
    throw new Error("Gestión o compras inválidas.");
  const vistos = new Set(),
    totales = { NIO: 0, USD: 0 },
    adjuntos = [];
  for (const { compra, fotos } of items) {
    if (
      !compra ||
      compra.gestion_id !== gestion.id ||
      vistos.has(compra.id) ||
      !Array.isArray(fotos)
    )
      throw new Error("El informe contiene una compra ajena o duplicada.");
    vistos.add(compra.id);
    if (
      !Object.hasOwn(totales, compra.moneda) ||
      !Number.isSafeInteger(compra.importe) ||
      compra.importe <= 0
    )
      throw new Error("Importe o moneda inválidos en el informe.");
    totales[compra.moneda] += compra.importe;
    if (!Number.isSafeInteger(totales[compra.moneda]))
      throw new Error("El total excede el límite permitido.");
    if (fotos.some((f) => f.compra_id !== compra.id))
      throw new Error("Un comprobante no corresponde a su compra.");
    if (incluirFotos)
      for (const foto of await imagenesVerificadas(fotos, files))
        adjuntos.push({ ...foto, compra });
  }
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]),
    y = 790;
  const margin = 48,
    ancho = 499;
  function pagina() {
    page = doc.addPage([595, 842]);
    y = 790;
  }
  function linea(texto, font = regular, size = 11) {
    for (const fragmento of envolver(texto, font, size, ancho)) {
      if (y < 65) pagina();
      page.drawText(fragmento, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0.12, 0.19, 0.17),
      });
      y -= size + 6;
    }
  }
  linea(encabezado || "Informe de gastos", negrita, 18);
  linea("Informe de compras por gestión", negrita, 13);
  y -= 8;
  linea(`Gestión: ${gestion.nombre}`);
  linea(
    `Inicio: ${gestion.fecha_inicio} · Finalización: ${gestion.fecha_fin || "Abierta"}`,
  );
  linea(
    `Generado: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
  );
  linea(`Compras: ${items.length}`);
  y -= 8;
  linea("Totales de compras", negrita, 12);
  linea(`Córdobas: ${dinero(totales.NIO, "NIO")}`);
  linea(`Dólares: ${dinero(totales.USD, "USD")}`);
  linea(
    "Este informe no calcula anticipos, pagos, créditos ni saldos.",
    regular,
    10,
  );
  y -= 10;
  if (!items.length) linea("No hay compras registradas en esta gestión.");
  for (const [i, { compra, fotos }] of items.entries()) {
    if (y < 140) pagina();
    linea(`${i + 1}. ${compra.concepto}`, negrita, 12);
    linea(`Fecha: ${compra.fecha_compra} · Proveedor: ${compra.proveedor}`);
    linea(
      `Importe: ${dinero(compra.importe, compra.moneda)} · Factura: ${compra.factura || "Sin número"}`,
    );
    linea(`Estado: ${compra.estado} · Comprobantes: ${fotos.length}`);
    y -= 8;
  }
  for (const { foto, bytes, compra } of adjuntos) {
    pagina();
    linea(`Comprobante de: ${compra.concepto}`, negrita, 12);
    linea(`Tipo: ${foto.clase} · Identificador: ${foto.id}`, regular, 10);
    const img =
      foto.tipo === "image/png"
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    const scale = Math.min(ancho / img.width, (y - 75) / img.height, 1);
    page.drawImage(img, {
      x: margin,
      y: y - img.height * scale,
      width: img.width * scale,
      height: img.height * scale,
    });
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: margin,
      y: 25,
      size: 9,
      font: regular,
    }),
  );
  return new Uint8Array(await doc.save());
}
