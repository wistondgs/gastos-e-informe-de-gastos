import { calcularSaldos, indexar } from "./finanzas.js";

/** Resumen actual por gestión, parte y moneda, calculado desde movimientos. */
export function estadoCuentas(datos, gestionId, { corte = null } = {}) {
  const ix = indexar(datos, corte);
  const filas = new Map();
  const obtener = (gestion_id, parte_id, moneda) => {
    const clave = JSON.stringify([gestion_id, parte_id, moneda]);
    if (!filas.has(clave))
      filas.set(clave, {
        gestion_id,
        parte_id,
        moneda,
        recibido: 0,
        reembolsado: 0,
        gastos_registrados: 0,
        usado_fondo: 0,
        custodia: 0,
        aportado_propio: 0,
        por_reembolsar: 0,
        deuda_proveedor: 0,
        por_regularizar: 0,
        regularizacion_original: 0,
        regularizacion_repuesta: 0,
        regularizacion_directa: 0,
        devuelto: 0,
        traslado_entrada: 0,
        traslado_salida: 0,
      });
    return filas.get(clave);
  };
  const sumar = (fila, clave, importe) => {
    fila[clave] += importe;
    if (!Number.isSafeInteger(fila[clave]))
      throw new Error("El resumen excede el límite permitido.");
  };
  const compras = new Map(
    [...ix.compras.values()]
      .filter((c) => !gestionId || c.gestion_id === gestionId)
      .map((c) => [c.id, c]),
  );
  const recepciones = new Map(
    [...ix.recepciones.values()].map((r) => [r.id, r]),
  );
  const asignaciones = ix.asignaciones;
  for (const c of compras.values()) {
    const reparto = asignaciones.filter((a) => a.compra_id === c.id);
    if (!reparto.length)
      sumar(
        obtener(c.gestion_id, null, c.moneda),
        "gastos_registrados",
        c.importe,
      );
    else
      for (const a of reparto)
        sumar(
          obtener(c.gestion_id, a.parte_id, c.moneda),
          "gastos_registrados",
          a.importe,
        );
  }
  for (const a of ix.aplicaciones.filter(
    (x) => !gestionId || x.gestion_id === gestionId,
  )) {
    const r = recepciones.get(a.recepcion_id);
    if (r)
      sumar(
        obtener(a.gestion_id, r.parte_id, r.moneda),
        a.destino === "anticipo" ? "recibido" : "reembolsado",
        a.importe,
      );
  }
  for (const p of ix.pagos.filter((x) => compras.has(x.compra_id))) {
    const c = compras.get(p.compra_id);
    const propias = asignaciones.filter((a) => a.compra_id === c.id);
    const asignacion = p.asignacion_id
      ? propias.find((a) => a.id === p.asignacion_id)
      : propias.length === 1
        ? propias[0]
        : null;
    if (p.origen === "fondo") {
      sumar(
        obtener(c.gestion_id, p.parte_id, c.moneda),
        "usado_fondo",
        p.importe,
      );
      if (asignacion && asignacion.parte_id === null)
        sumar(
          obtener(c.gestion_id, p.parte_id, c.moneda),
          "regularizacion_original",
          p.importe,
        );
    }
    if (p.origen === "propio")
      sumar(
        obtener(c.gestion_id, asignacion?.parte_id || null, c.moneda),
        "aportado_propio",
        p.importe,
      );
  }
  for (const r of datos.regularizaciones || []) {
    if (
      (r.anulada && (!corte || r.anulada.slice(0, 10) <= corte)) ||
      (corte && r.fecha > corte)
    )
      continue;
    const p = ix.pagos.find((x) => x.id === r.pago_id);
    const c = p && compras.get(p.compra_id);
    if (!c) continue;
    sumar(
      obtener(c.gestion_id, p.parte_id, c.moneda),
      r.modalidad === "reposicion"
        ? "regularizacion_repuesta"
        : "regularizacion_directa",
      r.importe,
    );
  }
  for (const m of ix.movimientos) {
    if (!gestionId || m.gestion_id === gestionId)
      sumar(
        obtener(m.gestion_id, m.parte_id, m.moneda),
        m.tipo === "devolucion" ? "devuelto" : "traslado_salida",
        m.importe,
      );
    if (
      m.tipo === "traslado" &&
      (!gestionId || m.gestion_destino_id === gestionId)
    )
      sumar(
        obtener(m.gestion_destino_id, m.parte_id, m.moneda),
        "traslado_entrada",
        m.importe,
      );
  }
  for (const s of calcularSaldos(datos, { corte }).saldos) {
    if (gestionId && s.gestion_id !== gestionId) continue;
    sumar(obtener(s.gestion_id, s.parte_id, s.moneda), s.tipo, s.importe);
  }
  return [...filas.values()];
}
