import ExcelJS from "exceljs";
import { fechaCorta, textoSaldo, ESTADO_LIQUIDACION } from "./informe-pdf.js";
import { anexoTexto, TIPOS_INFORME } from "../dominio/informe.js";
const seguro = (v) => {
  const s = String(v ?? "");
  return /^[\t\r\n ]*[=+@-]/.test(s) ? `'${s}` : s;
};
const SIMBOLO = { NIO: "C$", USD: "US$" };
const formato = (m) => `"${SIMBOLO[m]}" #,##0.00`;
function hoja(libro, nombre, columnas) {
  const h = libro.addWorksheet(nombre);
  h.columns = columnas.map(([header, width]) => ({ header, width }));
  h.getRow(1).font = { bold: true };
  h.views = [{ state: "frozen", ySplit: 1 }];
  return h;
}
/** El Excel de una revisión: los mismos datos y el mismo corte que su PDF. */
export async function informeExcel(modelo) {
  const o = modelo.opciones;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Gastos y Rendiciones";
  libro.created = libro.modified = new Date(o.generado);
  const resumen = libro.addWorksheet("Resumen");
  resumen.columns = [{ width: 26 }, { width: 50 }, { width: 12 }];
  const filas = [
    ["Informe", seguro(o.titulo)],
    ["Tipo", TIPOS_INFORME[modelo.tipo].nombre],
    ["Identificador", modelo.codigo],
    ["Revisión", o.revision],
    ...modelo.descripcion.lineas.map(([k, v]) => [k, seguro(v)]),
    ["Responsable", seguro(o.responsable || "No indicado")],
    ["Destinatario", seguro(o.destinatario || "No indicado")],
    ["Corte", fechaCorta(o.corte)],
    ["Emitido (UTC)", o.generado],
  ];
  for (const r of filas) resumen.addRow(r).getCell(1).font = { bold: true };
  for (const l of modelo.financiero?.liquidaciones || [])
    resumen
      .addRow([
        `Liquidación: ${seguro(l.gestion)}`,
        ESTADO_LIQUIDACION[l.estado],
      ])
      .getCell(1).font = { bold: true };
  resumen.addRow([]);
  resumen.addRow([
    "Moneda",
    modelo.tipo === "parte" ? "Total asignado" : "Total",
    "Compras",
  ]).font = { bold: true };
  for (const m of modelo.monedas) {
    const t = modelo.totales[m];
    resumen.addRow([m, t.importe / 100, t.cantidad]).getCell(2).numFmt =
      formato(m);
  }
  if (modelo.observaciones.length) {
    resumen.addRow([]);
    resumen.addRow(["Observaciones"]).font = { bold: true };
    for (const t of modelo.observaciones) resumen.addRow([seguro(t)]);
  }
  const compras = hoja(libro, "Compras", [
    ["N.°", 6],
    ["Fecha", 12],
    ["Gestión", 24],
    ["Proveedor", 28],
    ["Documento", 14],
    ["Concepto", 36],
    ["Moneda", 8],
    ["Importe de la compra", 18],
    ["Importe en este informe", 20],
    ["Soporte", 24],
    ["Identificador interno", 38],
  ]);
  for (const f of modelo.filas) {
    const c = f.compra;
    const r = compras.addRow([
      f.numero,
      fechaCorta(c.fecha_compra),
      seguro(f.gestion || "Sin gestión"),
      seguro(c.proveedor),
      seguro(c.factura || "Sin número"),
      seguro(c.concepto),
      c.moneda,
      c.importe / 100,
      f.importe / 100,
      f.soporte.texto,
      c.id,
    ]);
    r.getCell(5).numFmt = "@";
    r.getCell(8).numFmt = r.getCell(9).numFmt = "#,##0.00";
  }
  const asignadas = modelo.filas.filter((f) => f.asignaciones.length);
  if (asignadas.length) {
    const h = hoja(libro, "Asignaciones", [
      ["Compra N.°", 11],
      ["Destino", 32],
      ["Moneda", 8],
      ["Importe", 14],
    ]);
    for (const f of asignadas)
      for (const a of f.asignaciones)
        h
          .addRow([
            f.numero,
            seguro(a.destino),
            f.compra.moneda,
            a.importe / 100,
          ])
          .getCell(4).numFmt = "#,##0.00";
  }
  if (modelo.financiero?.saldos.length) {
    const h = hoja(libro, "Fondos y saldos", [
      ["Concepto", 60],
      ["Gestión", 26],
      ["Moneda", 8],
      ["Importe", 14],
    ]);
    for (const s of modelo.financiero.saldos)
      h
        .addRow([
          seguro(textoSaldo(s)),
          seguro(s.gestion || "Sin gestión"),
          s.moneda,
          s.importe / 100,
        ])
        .getCell(4).numFmt = "#,##0.00";
  }
  const conFotos = modelo.filas.filter(
    (f) => f.cantidadFotos || f.soporte.estado !== "presente",
  );
  if (conFotos.length) {
    const h = hoja(libro, "Comprobantes", [
      ["Compra N.°", 11],
      ["Estado", 30],
      ["Anexos", 24],
      ["Imágenes", 10],
    ]);
    for (const f of conFotos)
      h.addRow([
        f.numero,
        f.soporte.texto,
        f.anexos.map(anexoTexto).join(", "),
        f.cantidadFotos,
      ]);
  }
  return new Uint8Array(await libro.xlsx.writeBuffer());
}
