/**
 * Núcleo financiero de las gestiones. No es contabilidad general: deriva, de
 * los movimientos registrados, cuatro saldos que nunca se compensan entre sí.
 *
 *  - custodia:        dinero de una parte que tiene el responsable de la gestión.
 *  - por_reembolsar:  lo que el responsable pagó con su dinero a cargo de una parte.
 *  - por_regularizar: fondos de una parte usados en un gasto que no es suyo.
 *  - deuda_proveedor: lo que falta pagar de una compra a crédito, y su deudor.
 *
 * Todo importe es un entero en centavos con su moneda; nunca se convierten.
 */
import { MONEDAS } from "./compra.js";
import { fechaValida } from "./gestion.js";
export const TIPOS_SALDO = [
  "custodia",
  "por_reembolsar",
  "por_regularizar",
  "deuda_proveedor",
];
export class ErrorFinanciero extends Error {
  constructor(codigo, mensaje, campo = null) {
    super(mensaje);
    this.codigo = codigo;
    this.campo = campo;
  }
}
const falla = (mensaje, campo = null) => {
  throw new ErrorFinanciero("VALIDACION", mensaje, campo);
};
const ID = /^[a-zA-Z0-9-]{1,80}$/;
const entero = (n) => Number.isSafeInteger(n) && n > 0 && n <= 99999999999;
const vigente = (fila, corte) =>
  !fila.anulada || (corte && fila.anulada.slice(0, 10) > corte);
const dentro = (fecha, corte) => !corte || fecha.slice(0, 10) <= corte;

export function validarParte(p) {
  if (!p || !ID.test(p.id || ""))
    falla("Identificador de parte inválido.", "id");
  if (typeof p.nombre !== "string" || !p.nombre.trim() || p.nombre.length > 120)
    falla("Indicá el nombre de la persona o empresa.", "nombre");
  if (!["persona", "empresa"].includes(p.tipo))
    falla("Elegí si es persona o empresa.", "tipo");
  if (![0, 1].includes(p.activa)) falla("Estado de parte inválido.", "activa");
  return p;
}
function validarRegistro(r, campos) {
  if (!r || !ID.test(r.id || "")) falla("Identificador inválido.", "id");
  if ("fecha" in campos && !fechaValida(r.fecha))
    falla("Fecha inválida.", "fecha");
  if ("importe" in campos && !entero(r.importe))
    falla("El importe debe ser mayor que cero.", "importe");
  if ("moneda" in campos && !MONEDAS.includes(r.moneda))
    falla("Moneda inválida.", "moneda");
  return r;
}

/** Índices de los datos vigentes al corte. */
function indexar(d, corte) {
  const por = (lista, f = () => true) =>
    new Map((lista || []).filter(f).map((x) => [x.id, x]));
  const compras = por(
    d.compras,
    (c) => vigente(c, corte) && dentro(c.fecha_compra, corte),
  );
  const asignaciones = (d.asignaciones || []).filter(
    (a) => vigente(a, corte) && compras.has(a.compra_id),
  );
  const pagos = (d.pagos || []).filter(
    (p) =>
      vigente(p, corte) && dentro(p.fecha, corte) && compras.has(p.compra_id),
  );
  const recepciones = por(
    d.recepciones,
    (r) => vigente(r, corte) && dentro(r.fecha, corte),
  );
  const aplicaciones = (d.aplicaciones || []).filter(
    (a) => vigente(a, corte) && recepciones.has(a.recepcion_id),
  );
  const movimientos = (d.movimientos || []).filter(
    (m) => vigente(m, corte) && dentro(m.fecha, corte),
  );
  const asignacionesDe = new Map();
  for (const a of asignaciones) {
    if (!asignacionesDe.has(a.compra_id)) asignacionesDe.set(a.compra_id, []);
    asignacionesDe.get(a.compra_id).push(a);
  }
  return {
    compras,
    asignaciones,
    asignacionesDe,
    pagos,
    recepciones,
    aplicaciones,
    movimientos,
    gestiones: por(d.gestiones),
    partes: por(d.partes),
  };
}
/**
 * La asignación a la que se imputa un pago: la indicada, o la única que tenga
 * la compra. Sin asignaciones, el pago no se imputa a nadie (null).
 */
function imputacion(pago, ix) {
  const propias = ix.asignacionesDe.get(pago.compra_id) || [];
  if (pago.asignacion_id) {
    const a = propias.find((x) => x.id === pago.asignacion_id);
    if (!a)
      falla(
        "El pago apunta a una asignación de otra compra o anulada.",
        "asignacion_id",
      );
    return a;
  }
  if (propias.length === 1) return propias[0];
  if (propias.length > 1 && pago.origen !== "tercero")
    falla(
      "La compra está repartida: indicá a qué asignación corresponde el pago.",
      "asignacion_id",
    );
  return null;
}

/**
 * Los saldos distintos de cero al corte (o con todo lo registrado si no hay
 * corte), y las observaciones que no son saldos. Lanza si algún movimiento
 * viola las reglas: así sirve también para validar antes de registrar.
 */
export function calcularSaldos(datos, { corte = null } = {}) {
  const ix = indexar(datos, corte);
  const saldos = new Map(),
    observaciones = [];
  const sumar = (tipo, gestion_id, parte_id, moneda, importe, extra = {}) => {
    const k = [tipo, gestion_id, parte_id, moneda, extra.compra_id || ""].join(
      "|",
    );
    const s = saldos.get(k) || {
      tipo,
      gestion_id,
      parte_id,
      moneda,
      importe: 0,
      ...extra,
    };
    s.importe += importe;
    if (!Number.isSafeInteger(s.importe))
      falla("Un saldo excede el límite permitido.");
    saldos.set(k, s);
  };
  // Compras: asignaciones exactas y lo que falta pagar.
  for (const c of ix.compras.values()) {
    const asig = ix.asignacionesDe.get(c.id) || [];
    if (asig.length) {
      const suma = asig.reduce((t, a) => t + a.importe, 0);
      if (suma !== c.importe)
        falla(
          `Las asignaciones de «${c.concepto}» suman ${suma} y la compra ${c.importe}.`,
          "asignaciones",
        );
      for (const a of asig)
        if (a.parte_id && !ix.partes.has(a.parte_id))
          falla("Asignación a una parte inexistente.", "parte_id");
    }
    const pagos = ix.pagos.filter((p) => p.compra_id === c.id);
    const pagado = pagos.reduce((t, p) => t + p.importe, 0);
    if (pagado > c.importe)
      falla(`Los pagos de «${c.concepto}» exceden su importe.`, "importe");
    if (c.forma_pago === "sin_detalle" && pagos.length)
      falla(
        "Indicá primero si la compra fue al contado o a crédito.",
        "forma_pago",
      );
    if (c.forma_pago === "credito") {
      if (!c.deudor_id)
        falla("Una compra a crédito necesita su deudor.", "deudor_id");
      if (c.importe > pagado)
        sumar(
          "deuda_proveedor",
          c.gestion_id,
          c.deudor_id,
          c.moneda,
          c.importe - pagado,
          {
            compra_id: c.id,
            proveedor: c.proveedor,
          },
        );
    }
    if (c.forma_pago === "contado" && pagado < c.importe)
      observaciones.push({
        tipo: "origen_sin_detallar",
        compra_id: c.id,
        gestion_id: c.gestion_id,
        moneda: c.moneda,
        importe: c.importe - pagado,
      });
  }
  // Pagos: su origen mueve custodia, reembolsos o regularizaciones.
  for (const p of ix.pagos) {
    const c = ix.compras.get(p.compra_id);
    const a = imputacion(p, ix);
    const cargo = a ? a.parte_id : undefined; // null: ámbito personal
    if (p.origen === "propio") {
      if (cargo)
        sumar("por_reembolsar", c.gestion_id, cargo, c.moneda, p.importe);
      else
        observaciones.push({
          tipo: a ? "pago_personal" : "pago_propio_sin_cargo",
          compra_id: c.id,
          gestion_id: c.gestion_id,
          moneda: c.moneda,
          importe: p.importe,
        });
    } else if (p.origen === "fondo") {
      if (!p.parte_id || !ix.partes.has(p.parte_id))
        falla("Indicá de quién son los fondos usados.", "parte_id");
      if (!c.gestion_id)
        falla(
          "Los fondos en custodia se usan dentro de una gestión.",
          "gestion_id",
        );
      if (cargo && cargo !== p.parte_id)
        falla(
          "Los fondos de una parte no pagan el gasto de otra sin un traslado explícito.",
          "parte_id",
        );
      sumar("custodia", c.gestion_id, p.parte_id, c.moneda, -p.importe);
      if (cargo === null)
        sumar("por_regularizar", c.gestion_id, p.parte_id, c.moneda, p.importe);
    } else if (p.origen === "tercero") {
      if (!p.parte_id || !ix.partes.has(p.parte_id))
        falla("Indicá quién pagó directamente.", "parte_id");
    } else falla("Origen de pago inválido.", "origen");
  }
  // Recepciones y sus aplicaciones.
  const aplicado = new Map();
  for (const ap of ix.aplicaciones) {
    const r = ix.recepciones.get(ap.recepcion_id);
    if (!ix.gestiones.has(ap.gestion_id))
      falla("Aplicación a una gestión inexistente.", "gestion_id");
    aplicado.set(r.id, (aplicado.get(r.id) || 0) + ap.importe);
    if (aplicado.get(r.id) > r.importe)
      falla("Las aplicaciones exceden el dinero recibido.", "importe");
    if (ap.destino === "anticipo")
      sumar("custodia", ap.gestion_id, r.parte_id, r.moneda, ap.importe);
    else if (ap.destino === "reembolso")
      sumar("por_reembolsar", ap.gestion_id, r.parte_id, r.moneda, -ap.importe);
    else falla("Destino de aplicación inválido.", "destino");
  }
  for (const r of ix.recepciones.values()) {
    const libre = r.importe - (aplicado.get(r.id) || 0);
    if (libre > 0)
      observaciones.push({
        tipo: "recepcion_sin_aplicar",
        recepcion_id: r.id,
        parte_id: r.parte_id,
        moneda: r.moneda,
        importe: libre,
      });
  }
  // Devoluciones y traslados de fondos en custodia.
  for (const m of ix.movimientos) {
    if (!ix.gestiones.has(m.gestion_id))
      falla("Movimiento de una gestión inexistente.", "gestion_id");
    sumar("custodia", m.gestion_id, m.parte_id, m.moneda, -m.importe);
    if (m.tipo === "traslado") {
      if (
        !m.gestion_destino_id ||
        m.gestion_destino_id === m.gestion_id ||
        !ix.gestiones.has(m.gestion_destino_id)
      )
        falla(
          "El traslado necesita otra gestión de destino.",
          "gestion_destino_id",
        );
      sumar("custodia", m.gestion_destino_id, m.parte_id, m.moneda, m.importe);
    } else if (m.tipo !== "devolucion") falla("Movimiento inválido.", "tipo");
  }
  const lista = [...saldos.values()];
  for (const s of lista) {
    if (s.importe < 0 && s.tipo === "custodia")
      falla(
        "No hay fondos suficientes en custodia para ese movimiento.",
        "importe",
      );
    if (s.importe < 0 && s.tipo === "por_reembolsar")
      falla("El reembolso excede lo que se adelantó.", "importe");
  }
  return {
    saldos: lista
      .filter((s) => s.importe !== 0)
      .sort((a, b) =>
        [a.gestion_id, a.tipo, a.parte_id, a.moneda, a.compra_id]
          .join("|")
          .localeCompare(
            [b.gestion_id, b.tipo, b.parte_id, b.moneda, b.compra_id].join("|"),
          ),
      ),
    observaciones,
  };
}
/** Estado de liquidación de una gestión, independiente de su cierre. */
export function liquidacion(datos, gestionId, opciones = {}) {
  const { saldos } = calcularSaldos(datos, opciones);
  const propios = saldos.filter((s) => s.gestion_id === gestionId);
  const ix = indexar(datos, opciones.corte);
  const deLaGestion = (c) => ix.compras.get(c)?.gestion_id === gestionId;
  const hubo =
    ix.pagos.some((p) => deLaGestion(p.compra_id)) ||
    ix.aplicaciones.some((a) => a.gestion_id === gestionId) ||
    ix.movimientos.some(
      (m) => m.gestion_id === gestionId || m.gestion_destino_id === gestionId,
    );
  if (!hubo) return { estado: "sin_movimientos", saldos: [] };
  if (!propios.length) return { estado: "liquidada", saldos: [] };
  const cancelaciones =
    ix.aplicaciones.some(
      (a) => a.gestion_id === gestionId && a.destino === "reembolso",
    ) ||
    ix.movimientos.some((m) => m.gestion_id === gestionId) ||
    ix.pagos.some(
      (p) =>
        deLaGestion(p.compra_id) &&
        ix.compras.get(p.compra_id).forma_pago === "credito",
    );
  return { estado: cancelaciones ? "parcial" : "pendiente", saldos: propios };
}
export function validarMovimientoBasico(tipo, r) {
  if (tipo === "recepcion")
    return validarRegistro(r, { fecha: 1, importe: 1, moneda: 1 });
  if (tipo === "aplicacion") return validarRegistro(r, { importe: 1 });
  if (tipo === "pago") return validarRegistro(r, { fecha: 1, importe: 1 });
  if (tipo === "movimiento")
    return validarRegistro(r, { fecha: 1, importe: 1, moneda: 1 });
  if (tipo === "asignacion") return validarRegistro(r, { importe: 1 });
  falla("Tipo de registro desconocido.");
}
