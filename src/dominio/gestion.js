export function fechaValida(fecha) {
  return (
    typeof fecha === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) &&
    new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha
  );
}
export function validarGestion(g) {
  if (
    !g ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(g.id) ||
    typeof g.nombre !== "string" ||
    !g.nombre.trim() ||
    g.nombre.length > 120 ||
    !fechaValida(g.fecha_inicio)
  )
    throw new Error("Revisá el nombre y la fecha de la gestión.");
  if (
    g.fecha_fin !== null &&
    (!fechaValida(g.fecha_fin) || g.fecha_fin < g.fecha_inicio)
  )
    throw new Error("La fecha de cierre no puede ser anterior al inicio.");
  return g;
}
