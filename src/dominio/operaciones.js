import { validarCompra } from "./compra.js";
import { huella } from "../datos/archivos.js";
export function verificarImagen(bytes, tipo) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length === 0 ||
    bytes.length > 15 * 1024 * 1024
  )
    throw new Error("El comprobante debe tener entre 1 byte y 15 MB.");
  const png =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const jpg =
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  if (!((tipo === "image/png" && png) || (tipo === "image/jpeg" && jpg)))
    throw new Error("El comprobante debe ser una imagen JPEG o PNG válida.");
}
export async function guardarCompra(repo, files, compra, imagenes) {
  validarCompra(compra);
  const staged = [];
  try {
    for (const imagen of imagenes) {
      verificarImagen(imagen.bytes, imagen.tipo);
      if (!["factura", "voucher", "otro"].includes(imagen.clase))
        throw new Error("Tipo de comprobante inválido.");
      const ruta = files.ruta(imagen.tipo);
      await files.escribir(ruta, imagen.bytes);
      staged.push({
        id: crypto.randomUUID(),
        compra_id: compra.id,
        ruta,
        tipo: imagen.tipo,
        clase: imagen.clase,
        sha256: await huella(imagen.bytes),
      });
    }
    const created = await repo.guardar(compra, staged);
    if (!created)
      await Promise.all(
        staged.map((f) => files.borrar(f.ruta).catch(() => {})),
      );
    return created;
  } catch (error) {
    await Promise.all(staged.map((f) => files.borrar(f.ruta).catch(() => {})));
    throw error;
  }
}
