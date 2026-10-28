import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  concatTransformationMatrix,
  drawObject,
} from "pdf-lib";
import { bytesABase64, huella } from "../datos/archivos.js";
import { dinero } from "../dominio/compra.js";
import {
  ajusteEfectivo,
  dimensiones,
  geometria,
  orientacionExif,
  planificarAnexos,
} from "../documentos/anexos.js";
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
export async function pdf(compra, fotos, files, encabezado, ajustes = []) {
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
  const preparados = imagenes.map(({ foto, bytes }) => ({
    foto,
    bytes,
    dims: dimensiones(bytes, foto.tipo),
    ajuste: ajusteEfectivo(
      ajustes.find((a) => a.foto_id === foto.id),
      orientacionExif(bytes, foto.tipo),
    ),
  }));
  const paginasAnexos = preparados.flatMap((anexo) =>
    planificarAnexos([anexo], { ancho: 499, alto: 720, cabecera: 40 }),
  );
  for (const colocaciones of paginasAnexos) {
    pagina();
    for (const { anexo, caja, cabeceraY, tramo } of colocaciones) {
      const { foto, bytes } = anexo;
      page.drawText(
        `Comprobante: ${foto.clase}${tramo ? ` · Parte ${tramo.parte} de ${tramo.de}` : ""}`,
        { x: margin, y: 65 + cabeceraY - 16, size: 11, font: negrita },
      );
      const img =
        foto.tipo === "image/png"
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
      const g = geometria(
        anexo.dims,
        anexo.ajuste,
        { ...caja, x: margin + caja.x, y: 65 + caja.y },
        tramo,
      );
      const nombre = page.node.newXObject("Image", img.ref);
      page.pushOperators(
        pushGraphicsState(),
        rectangle(g.visible.x, g.visible.y, g.visible.w, g.visible.h),
        clip(),
        endPath(),
        concatTransformationMatrix(...g.matriz),
        drawObject(nombre),
        popGraphicsState(),
      );
    }
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
