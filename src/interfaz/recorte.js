/** Ajustes expresados sobre la imagen girada, sin modificar el original. */
export function bordes(r) {
  return {
    izquierda: Math.round(r.x * 100),
    arriba: Math.round(r.y * 100),
    derecha: Math.round((1 - r.x - r.w) * 100),
    abajo: Math.round((1 - r.y - r.h) * 100),
  };
}
export function cambiarBorde(r, lado, valor) {
  const l = { ...bordes(r), [lado]: Number(valor) };
  if (
    !Object.hasOwn(bordes(r), lado) ||
    !Number.isFinite(l[lado]) ||
    l[lado] < 0 ||
    l[lado] > 80 ||
    l.izquierda + l.derecha > 80 ||
    l.arriba + l.abajo > 80
  )
    return r;
  return {
    x: l.izquierda / 100,
    y: l.arriba / 100,
    w: (100 - l.izquierda - l.derecha) / 100,
    h: (100 - l.arriba - l.abajo) / 100,
  };
}
export function cambiarZoom(r, direccion) {
  const w = Math.max(
    0.2,
    Math.min(1, Math.round((r.w + direccion * 0.1) * 100) / 100),
  );
  const h = Math.max(
    0.2,
    Math.min(1, Math.round((r.h + direccion * 0.1) * 100) / 100),
  );
  return {
    x: Math.max(0, Math.min(1 - w, r.x + (r.w - w) / 2)),
    y: Math.max(0, Math.min(1 - h, r.y + (r.h - h) / 2)),
    w,
    h,
  };
}
