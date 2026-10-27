import { fechaValida } from "./gestion.js";
export const PAPELES = { carta: [612, 792], a4: [595.28, 841.89] };
export const ESTILOS = ["ejecutivo", "formal"];
const CLASES = { factura: "Factura", voucher: "Voucher", otro: "Soporte" };
const orden = (a, b) =>
  a.compra.fecha_compra.localeCompare(b.compra.fecha_compra) ||
  a.compra.fecha_registro.localeCompare(b.compra.fecha_registro) ||
  a.compra.id.localeCompare(b.compra.id);
export const codigoInforme = (gestionId, revision) =>
  `GR-${gestionId.replace(/-/g, "").slice(0, 8).toUpperCase()}-R${String(revision).padStart(2, "0")}`;
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
 * Arma el contenido del informe de una gestión: filas, totales por moneda,
 * soporte de cada compra y anexos numerados. No calcula pagos ni saldos.
 */
export function prepararInforme(gestion, items, opciones) {
  validarOpciones(opciones);
  if (!gestion?.id || !Array.isArray(items))
    throw new Error("Gestión o compras inválidas.");
  if (opciones.corte < gestion.fecha_inicio)
    throw new Error("El corte no puede ser anterior al inicio de la gestión.");
  const vistos = new Set(),
    totales = {
      NIO: { importe: 0, cantidad: 0 },
      USD: { importe: 0, cantidad: 0 },
    };
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
    if (fotos.some((f) => f.compra_id !== compra.id))
      throw new Error("Un comprobante no corresponde a su compra.");
  }
  const incluidas = items
    .filter(({ compra }) => compra.fecha_compra <= opciones.corte)
    .sort(orden);
  const anexos = [];
  const filas = incluidas.map(({ compra, fotos }, i) => {
    const t = totales[compra.moneda];
    t.importe += compra.importe;
    t.cantidad += 1;
    if (!Number.isSafeInteger(t.importe))
      throw new Error("El total excede el límite permitido.");
    const propios = opciones.incluirFotos
      ? fotos.map((foto) => {
          const anexo = {
            numero: anexos.length + 1,
            foto,
            compra,
            fila: i + 1,
            titulo: `${CLASES[foto.clase] || "Soporte"}${compra.factura ? ` ${compra.factura}` : ""}`,
          };
          anexos.push(anexo);
          return anexo.numero;
        })
      : [];
    return {
      numero: i + 1,
      compra,
      cantidadFotos: fotos.length,
      anexos: propios,
      soporte: soporte(compra, fotos, propios, opciones.incluirFotos),
    };
  });
  return {
    gestion,
    opciones,
    codigo: codigoInforme(gestion.id, opciones.revision),
    filas,
    totales,
    anexos,
    monedas: Object.keys(totales).filter((m) => totales[m].cantidad > 0),
  };
}
export const anexoTexto = (n) => `A-${String(n).padStart(2, "0")}`;
function soporte(compra, fotos, anexos, incluirFotos) {
  if (fotos.length && incluirFotos)
    return { estado: "presente", texto: anexos.map(anexoTexto).join(", ") };
  if (fotos.length)
    return { estado: "presente", texto: "Presente, no anexado" };
  if (compra.estado === "factura")
    return { estado: "ausente", texto: "Ausente: falta la imagen" };
  if (compra.estado === "pendiente")
    return { estado: "pendiente", texto: "Pendiente" };
  return { estado: "sin_factura", texto: "Sin factura" };
}
/** Lo que se conserva de una revisión emitida para poder regenerarla igual. */
export function instantanea(modelo) {
  const o = modelo.opciones;
  return {
    titulo: o.titulo,
    responsable: o.responsable,
    destinatario: o.destinatario,
    gestion: {
      nombre: modelo.gestion.nombre,
      fecha_inicio: modelo.gestion.fecha_inicio,
      fecha_fin: modelo.gestion.fecha_fin,
    },
    compras: modelo.filas.map((f) => f.compra.id),
    totales: Object.fromEntries(
      modelo.monedas.map((m) => [m, modelo.totales[m].importe]),
    ),
  };
}
