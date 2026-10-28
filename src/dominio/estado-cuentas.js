import { calcularSaldos } from "./finanzas.js";

/** Resumen actual por gestión, parte y moneda, calculado desde movimientos. */
export function estadoCuentas(datos, gestionId) {
  const filas = new Map();
  const obtener = (gestion_id, parte_id, moneda) => {
    const clave = JSON.stringify([gestion_id, parte_id, moneda]);
    if (!filas.has(clave))
      filas.set(clave, {
        gestion_id,
        parte_id,
        moneda,
        recibido: 0,
        gastos_registrados: 0,
        usado_fondo: 0,
        custodia: 0,
        aportado_propio: 0,
        por_reembolsar: 0,
        deuda_proveedor: 0,
        por_regularizar: 0,
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
    datos.compras
      .filter((c) => !c.anulada && (!gestionId || c.gestion_id === gestionId))
      .map((c) => [c.id, c]),
  );
  const recepciones = new Map(
    datos.recepciones.filter((r) => !r.anulada).map((r) => [r.id, r]),
  );
  const asignaciones = datos.asignaciones.filter((a) => !a.anulada);
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
  for (const a of datos.aplicaciones.filter(
    (x) =>
      !x.anulada &&
      x.destino === "anticipo" &&
      (!gestionId || x.gestion_id === gestionId),
  )) {
    const r = recepciones.get(a.recepcion_id);
    if (r)
      sumar(obtener(a.gestion_id, r.parte_id, r.moneda), "recibido", a.importe);
  }
  for (const p of datos.pagos.filter(
    (x) => !x.anulada && compras.has(x.compra_id),
  )) {
    const c = compras.get(p.compra_id);
    const propias = asignaciones.filter((a) => a.compra_id === c.id);
    const asignacion = p.asignacion_id
      ? propias.find((a) => a.id === p.asignacion_id)
      : propias.length === 1
        ? propias[0]
        : null;
    if (p.origen === "fondo")
      sumar(
        obtener(c.gestion_id, p.parte_id, c.moneda),
        "usado_fondo",
        p.importe,
      );
    if (p.origen === "propio")
      sumar(
        obtener(c.gestion_id, asignacion?.parte_id || null, c.moneda),
        "aportado_propio",
        p.importe,
      );
  }
  for (const m of datos.movimientos.filter((x) => !x.anulada)) {
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
  for (const s of calcularSaldos(datos).saldos) {
    if (gestionId && s.gestion_id !== gestionId) continue;
    sumar(obtener(s.gestion_id, s.parte_id, s.moneda), s.tipo, s.importe);
  }
  return [...filas.values()];
}
