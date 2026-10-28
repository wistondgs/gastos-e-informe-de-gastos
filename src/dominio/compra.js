export const monedas = ["NIO", "USD"];
export const MONEDAS = monedas;
export const estados = ["factura", "sin_factura", "pendiente"];
export function centavos(texto) {
  const valor = String(texto).trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:[.,]\d{1,2})?$/.test(valor))
    throw new Error("Ingresá un importe válido con hasta dos decimales.");
  const [entero, decimales = ""] = valor.replace(",", ".").split(".");
  const importe = Number(entero) * 100 + Number(decimales.padEnd(2, "0"));
  if (!Number.isSafeInteger(importe) || importe <= 0)
    throw new Error("El importe debe ser mayor que cero.");
  return importe;
}
export function validarCompra(c) {
  if (!c || typeof c !== "object") throw new Error("Compra inválida.");
  for (const campo of [
    "id",
    "fecha_compra",
    "fecha_registro",
    "concepto",
    "proveedor",
  ]) {
    if (
      typeof c[campo] !== "string" ||
      !c[campo].trim() ||
      c[campo].length > 250
    )
      throw new Error(`Revisá el campo ${campo}.`);
  }
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(c.id))
    throw new Error("Identificador inválido.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha_compra) ||
    Number.isNaN(Date.parse(`${c.fecha_compra}T00:00:00Z`)) ||
    new Date(`${c.fecha_compra}T00:00:00Z`).toISOString().slice(0, 10) !==
      c.fecha_compra
  )
    throw new Error("Fecha de compra inválida.");
  if (Number.isNaN(Date.parse(c.fecha_registro)))
    throw new Error("Fecha de registro inválida.");
  if (
    !Number.isSafeInteger(c.importe) ||
    c.importe <= 0 ||
    c.importe > 99999999999
  )
    throw new Error("Importe inválido.");
  if (!monedas.includes(c.moneda) || !estados.includes(c.estado))
    throw new Error("Moneda o estado inválido.");
  if (typeof c.factura !== "string" || c.factura.length > 100)
    throw new Error("Número de factura inválido.");
  return c;
}
export function dinero(n, moneda) {
  return `${moneda === "NIO" ? "C$" : "US$"} ${(n / 100).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
