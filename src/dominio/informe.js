import { fechaValida } from "./gestion.js";
import { vigente } from "./finanzas.js";
export const PAPELES = { carta: [612, 792], a4: [595.28, 841.89] };
export const ESTILOS = ["ejecutivo", "formal"];
export const TIPOS_INFORME = {
  gestion: { prefijo: "GR", nombre: "Informe de gastos por gestión" },
  gestiones: { prefijo: "GM", nombre: "Informe de gastos de varias gestiones" },
  periodo: { prefijo: "GH", nombre: "Historial de compras por período" },
  parte: { prefijo: "GP", nombre: "Informe de gastos por empresa o persona" },
  pendientes: { prefijo: "GC", nombre: "Gastos pendientes de comprobante" },
};
const CLASES = { factura: "Factura", voucher: "Voucher", otro: "Soporte" };
const orden = (a, b) =>
  a.compra.fecha_compra.localeCompare(b.compra.fecha_compra) ||
  a.compra.fecha_registro.localeCompare(b.compra.fecha_registro) ||
  a.compra.id.localeCompare(b.compra.id);
/** FNV-1a de 32 bits: identifica un alcance de forma estable y corta. */
function hash8(texto) {
  let h = 0x811c9dc5;
  for (const c of new TextEncoder().encode(texto)) {
    h ^= c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}
/** Clave canónica de un alcance: dos pedidos iguales numeran la misma serie de revisiones. */
export function claveAlcance(alcance) {
  const a = alcance || {};
  switch (a.tipo) {
    case "gestion":
      return `gestion:${a.gestion_id}`;
    case "gestiones":
      return `gestiones:${[...a.gestion_ids].sort().join(",")}`;
    case "periodo":
      return `periodo:${a.desde}:${a.hasta}`;
    case "parte":
      return `parte:${a.parte_id}:${[...(a.gestion_ids || [])].sort().join(",")}`;
    case "pendientes":
      return `pendientes:${[...(a.gestion_ids || [])].sort().join(",")}`;
    default:
      throw new Error("Tipo de informe desconocido.");
  }
}
export function codigoInforme(alcance, revision) {
  const r = `R${String(revision).padStart(2, "0")}`;
  if (alcance.tipo === "gestion")
    return `GR-${alcance.gestion_id.replace(/-/g, "").slice(0, 8).toUpperCase()}-${r}`;
  return `${TIPOS_INFORME[alcance.tipo].prefijo}-${hash8(claveAlcance(alcance))}-${r}`;
}
export function validarOpciones(o) {
  if (!o || !Object.hasOwn(PAPELES, o.papel) || !ESTILOS.includes(o.estilo))
    throw new Error("Elegí el papel y el estilo del informe.");
  if (!Number.isSafeInteger(o.revision) || o.revision < 1)
    throw new Error("Revisión de informe inválida.");
  if (!fechaValida(o.corte)) throw new Error("Fecha de corte inválida.");
  if (Number.isNaN(Date.parse(o.generado)))
    throw new Error("Fecha de emisión inválida.");
  for (const campo of ["titulo", "responsable", "destinatario"])
    if (typeof o[campo] !== "string" || o[campo].length > 120)
      throw new Error(`Revisá el campo ${campo} del informe.`);
  if (!o.titulo.trim()) throw new Error("El informe necesita un título.");
  return o;
}
/**
 * Arma el contenido de un informe: filas, totales por moneda (sobre lo
 * asignado al destinatario cuando lo hay), soporte de cada compra, anexos
 * numerados y el resumen financiero recibido ya calculado al corte.
 * El resultado es JSON puro: es lo que se guarda de cada revisión.
 */
export function prepararInforme(contexto, opciones) {
  validarOpciones(opciones);
  const {
    alcance,
    descripcion,
    items,
    financiero = null,
    observaciones = [],
  } = contexto || {};
  if (!alcance || !TIPOS_INFORME[alcance.tipo] || !Array.isArray(items))
    throw new Error("Alcance o compras inválidas.");
  const vistos = new Set(),
    totales = {
      NIO: { importe: 0, cantidad: 0 },
      USD: { importe: 0, cantidad: 0 },
    };
  for (const it of items) {
    const { compra, fotos } = it;
    if (!compra || vistos.has(compra.id) || !Array.isArray(fotos))
      throw new Error("El informe contiene una compra duplicada o inválida.");
    if (alcance.gestion_ids && !alcance.gestion_ids.includes(compra.gestion_id))
      throw new Error("El informe contiene una compra ajena.");
    if (alcance.tipo === "gestion" && compra.gestion_id !== alcance.gestion_id)
      throw new Error("El informe contiene una compra ajena.");
    if (
      alcance.tipo === "periodo" &&
      (compra.fecha_compra < alcance.desde ||
        compra.fecha_compra > alcance.hasta)
    )
      throw new Error("El informe contiene una compra fuera del período.");
    vistos.add(compra.id);
    if (
      !Object.hasOwn(totales, compra.moneda) ||
      !Number.isSafeInteger(compra.importe) ||
      compra.importe <= 0
    )
      throw new Error("Importe o moneda inválidos en el informe.");
    if (
      it.asignado != null &&
      (!Number.isSafeInteger(it.asignado) ||
        it.asignado <= 0 ||
        it.asignado > compra.importe)
    )
      throw new Error("Importe asignado inválido en el informe.");
    if (alcance.tipo === "parte" && it.asignado == null)
      throw new Error("Un informe por destinatario solo lleva lo asignado.");
    if (fotos.some((f) => f.compra_id !== compra.id))
      throw new Error("Un comprobante no corresponde a su compra.");
    if (!vigente(compra, opciones.corte))
      throw new Error("Una compra anulada no va en el detalle.");
  }
  const incluidas = items
    .filter(({ compra }) => compra.fecha_compra <= opciones.corte)
    .sort(orden);
  const anexos = [];
  const filas = incluidas.map((it, i) => {
    const { compra, fotos } = it;
    const importe = it.asignado ?? compra.importe;
    const t = totales[compra.moneda];
    t.importe += importe;
    t.cantidad += 1;
    if (!Number.isSafeInteger(t.importe))
      throw new Error("El total excede el límite permitido.");
    const anexar =
      opciones.incluirFotos && (!it.compartida || opciones.incluirCompartidos);
    const propios = anexar
      ? fotos.map((foto) => {
          const anexo = {
            numero: anexos.length + 1,
            foto,
            compra,
            fila: i + 1,
            titulo: `${CLASES[foto.clase] || "Soporte"}${compra.factura ? ` ${compra.factura}` : ""}`,
            ajuste: it.ajustes?.[foto.id] || null,
            dims: it.dims?.[foto.id] || null,
          };
          anexos.push(anexo);
          return anexo.numero;
        })
      : [];
    return {
      numero: i + 1,
      compra,
      importe,
      asignado: it.asignado ?? null,
      compartida: !!it.compartida,
      gestion: it.gestion || null,
      asignaciones: it.asignaciones || [],
      cantidadFotos: fotos.length,
      anexos: propios,
      soporte: soporte(
        compra,
        fotos,
        propios,
        opciones.incluirFotos,
        it.compartida && !anexar,
      ),
    };
  });
  return {
    tipo: alcance.tipo,
    alcance,
    descripcion: descripcion || { titulo: "", lineas: [] },
    opciones,
    codigo: opciones.codigo || codigoInforme(alcance, opciones.revision),
    filas,
    totales,
    anexos,
    monedas: Object.keys(totales).filter((m) => totales[m].cantidad > 0),
    financiero,
    observaciones,
  };
}
export const anexoTexto = (n) => `A-${String(n).padStart(2, "0")}`;
function soporte(compra, fotos, anexos, incluirFotos, reservado) {
  if (fotos.length && anexos.length)
    return { estado: "presente", texto: anexos.map(anexoTexto).join(", ") };
  if (fotos.length && reservado)
    return { estado: "presente", texto: "Presente, compartido: no anexado" };
  if (fotos.length)
    return { estado: "presente", texto: "Presente, no anexado" };
  if (compra.estado === "factura")
    return { estado: "ausente", texto: "Ausente: falta la imagen" };
  if (compra.estado === "pendiente")
    return { estado: "pendiente", texto: "Pendiente" };
  return { estado: "sin_factura", texto: "Sin factura" };
}
