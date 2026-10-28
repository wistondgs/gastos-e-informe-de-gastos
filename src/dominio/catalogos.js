const TIPOS = ["cuenta", "medio", "categoria", "destino"];
export function validarCatalogo(item) {
  if (
    !item ||
    !/^[A-Za-z0-9-]{1,80}$/.test(item.id || "") ||
    !TIPOS.includes(item.tipo) ||
    typeof item.nombre !== "string" ||
    !item.nombre.trim() ||
    item.nombre.length > 120 ||
    ![0, 1].includes(item.activa) ||
    Number.isNaN(Date.parse(item.creada))
  )
    throw new Error("El elemento del catálogo no es válido.");
  return item;
}
