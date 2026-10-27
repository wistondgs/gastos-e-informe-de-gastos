import ExcelJS from "exceljs";
import { fechaCorta } from "./informe-pdf.js";
const seguro = (v) => {
  const s = String(v ?? "");
  return /^[\t\r\n ]*[=+@-]/.test(s) ? `'${s}` : s;
};
const SIMBOLO = { NIO: "C$", USD: "US$" };
/** El Excel de una revisión: mismos datos y corte que su PDF, sin imágenes. */
export async function informeExcel(modelo) {
  const o = modelo.opciones,
    g = modelo.gestion;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Gastos y Rendiciones";
  libro.created = libro.modified = new Date(o.generado);
  const resumen = libro.addWorksheet("Resumen");
  resumen.columns = [{ width: 24 }, { width: 46 }];
  const filas = [
    ["Informe", seguro(o.titulo)],
    ["Identificador", modelo.codigo],
    ["Revisión", o.revision],
    ["Gestión", seguro(g.nombre)],
    ["Responsable", seguro(o.responsable || "No indicado")],
    ["Destinatario", seguro(o.destinatario || "No indicado")],
    ["Apertura", fechaCorta(g.fecha_inicio)],
    ["Cierre", g.fecha_fin ? fechaCorta(g.fecha_fin) : "Gestión abierta"],
    ["Corte", fechaCorta(o.corte)],
    ["Emitido (UTC)", o.generado],
    ["Liquidación", "No calculada en esta versión"],
  ];
  for (const r of filas) resumen.addRow(r).getCell(1).font = { bold: true };
  resumen.addRow([]);
  resumen.addRow(["Moneda", "Total", "Compras"]).font = { bold: true };
  resumen.getColumn(3).width = 12;
  for (const m of modelo.monedas) {
    const t = modelo.totales[m];
    const r = resumen.addRow([m, t.importe / 100, t.cantidad]);
    r.getCell(2).numFmt = `"${SIMBOLO[m]}" #,##0.00`;
  }
  const hoja = libro.addWorksheet("Compras");
  hoja.columns = [
    { header: "N.°", width: 6 },
    { header: "Fecha", width: 12 },
    { header: "Proveedor", width: 28 },
    { header: "Documento", width: 14 },
    { header: "Concepto", width: 36 },
    { header: "Moneda", width: 8 },
    { header: "Importe", width: 14 },
    { header: "Soporte", width: 22 },
    { header: "Identificador interno", width: 38 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const f of modelo.filas) {
    const c = f.compra;
    const r = hoja.addRow([
      f.numero,
      fechaCorta(c.fecha_compra),
      seguro(c.proveedor),
      seguro(c.factura || "Sin número"),
      seguro(c.concepto),
      c.moneda,
      c.importe / 100,
      f.soporte.texto,
      c.id,
    ]);
    r.getCell(4).numFmt = "@";
    r.getCell(7).numFmt = "#,##0.00";
  }
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  return new Uint8Array(await libro.xlsx.writeBuffer());
}
