import { centavos } from "../dominio/compra.js";

export function prepararAplicaciones(filas) {
  return filas.map((fila) => {
    if (!fila.gestion_id)
      throw new Error("Elegí una gestión para cada aplicación.");
    return {
      ...(fila.id ? { id: fila.id } : {}),
      gestion_id: fila.gestion_id,
      destino: fila.destino,
      importe: centavos(fila.monto),
    };
  });
}

/** Prepara datos para la API; el cálculo y las validaciones de saldos son del dominio. */
export function prepararCompraFinanciera(compra, seleccion) {
  const { tipo, parte_id: parteId, fondo } = seleccion;
  if (tipo === "sin_detalle") return { ...compra, forma_pago: "sin_detalle" };
  if (tipo === "avanzado") {
    const forma_pago = seleccion.forma_pago;
    if (!["contado", "credito"].includes(forma_pago))
      throw new Error("Elegí contado o crédito.");
    const asignaciones = (seleccion.asignaciones || []).map((a) => ({
      parte_id: a.parte_id || null,
      importe: centavos(a.monto),
    }));
    const pagos = (seleccion.pagos || []).map((p) => ({
      origen: p.origen,
      parte_id: p.origen === "propio" ? null : p.parte_id || null,
      importe: centavos(p.monto),
      ...(p.asignacion !== "" && p.asignacion != null
        ? { asignacion: Number(p.asignacion) }
        : {}),
    }));
    return {
      ...compra,
      forma_pago,
      deudor_id: forma_pago === "credito" ? seleccion.deudor_id || null : null,
      asignaciones,
      pagos,
    };
  }
  if (!parteId)
    throw new Error("Elegí la persona o empresa relacionada con la compra.");
  if (tipo === "credito")
    return { ...compra, forma_pago: "credito", deudor_id: parteId };
  if (!["fondo", "propio", "combinado"].includes(tipo))
    throw new Error("Elegí cómo pagaste la compra.");
  const asignaciones = [{ parte_id: parteId, importe: compra.importe }];
  const pagos = [];
  if (tipo === "fondo" || tipo === "combinado") {
    const importe = tipo === "fondo" ? compra.importe : centavos(fondo);
    if (importe >= compra.importe && tipo === "combinado")
      throw new Error(
        "El importe del fondo debe ser menor que el total para registrar un aporte propio.",
      );
    pagos.push({ origen: "fondo", parte_id: parteId, importe, asignacion: 0 });
  }
  if (tipo === "propio" || tipo === "combinado") {
    const importe = compra.importe - (pagos[0]?.importe || 0);
    pagos.push({ origen: "propio", importe, asignacion: 0 });
  }
  return { ...compra, forma_pago: "contado", asignaciones, pagos };
}
