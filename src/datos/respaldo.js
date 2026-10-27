import JSZip from "jszip";
import { huella } from "./archivos.js";
import { validarCompra } from "../dominio/compra.js";
import { validarGestion } from "../dominio/gestion.js";
import { verificarImagen } from "../dominio/operaciones.js";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAX = 100 * 1024 * 1024;
export async function crearRespaldo(repo, files) {
  const compras = await repo.compras();
  const fotos = [];
  for (const c of compras) fotos.push(...(await repo.fotos(c.id)));
  const datos = {
    version: 2,
    compras,
    fotos,
    gestiones: await repo.gestiones(),
    encabezado: await repo.ajuste(),
  };
  const zip = new JSZip();
  const json = encoder.encode(JSON.stringify(datos));
  zip.file("datos.json", json);
  const manifest = { version: 1, datos: await huella(json), archivos: {} };
  for (const f of fotos) {
    const bytes = await files.leer(f.ruta);
    verificarImagen(bytes, f.tipo);
    const digest = await huella(bytes);
    if (digest !== f.sha256)
      throw new Error("Un comprobante está alterado; no se creó el respaldo.");
    zip.file(`imagenes/${f.id}`, bytes);
    manifest.archivos[f.id] = digest;
  }
  zip.file("manifiesto.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export async function restaurarRespaldo(repo, files, bytes) {
  if (bytes.length > MAX) throw new Error("El respaldo excede 100 MB.");
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files);
    if (entries.length > 10005)
      throw new Error("Demasiados archivos en el respaldo.");
    let previsto = 0;
    for (const entry of entries) {
      if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name)
        throw new Error("Ruta insegura en el respaldo.");
      if (!entry.dir) {
        const size = entry._data?.uncompressedSize;
        if (!Number.isSafeInteger(size) || size < 0 || size > MAX)
          throw new Error("Tamaño de archivo inválido.");
        previsto += size;
        if (previsto > MAX)
          throw new Error("El respaldo descomprimido excede 100 MB.");
      }
    }
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new Error("El respaldo está dañado o no es válido.");
  }
  async function leer(path) {
    const item = zip.file(path);
    if (!item) throw new Error(`Falta ${path} en el respaldo.`);
    const data = await item.async("uint8array");
    if (data.length > MAX)
      throw new Error("Un archivo del respaldo es demasiado grande.");
    return data;
  }
  let man, datos;
  try {
    man = JSON.parse(decoder.decode(await leer("manifiesto.json")));
    const data = await leer("datos.json");
    if ((await huella(data)) !== man.datos)
      throw new Error("La información fue alterada.");
    datos = JSON.parse(decoder.decode(data));
  } catch (e) {
    throw new Error(`No se pudo validar el respaldo: ${e.message}`);
  }
  if (
    man.version !== 1 ||
    ![1, 2].includes(datos.version) ||
    (datos.version === 2 && !Array.isArray(datos.gestiones)) ||
    !Array.isArray(datos.compras) ||
    !Array.isArray(datos.fotos) ||
    typeof datos.encabezado !== "string" ||
    datos.encabezado.length > 120 ||
    !man.archivos ||
    typeof man.archivos !== "object"
  )
    throw new Error("Versión o estructura de respaldo inválida.");
  const gestiones = datos.version === 1 ? [] : datos.gestiones;
  const gestionIds = new Set();
  for (const g of gestiones) {
    validarGestion(g);
    if (gestionIds.has(g.id))
      throw new Error("Gestión duplicada en el respaldo.");
    gestionIds.add(g.id);
  }
  const ids = new Set();
  for (const c of datos.compras) {
    validarCompra(c);
    if (c.gestion_id != null && !gestionIds.has(c.gestion_id))
      throw new Error("La compra referencia una gestión ausente.");
    if (ids.has(c.id)) throw new Error("Compra duplicada en el respaldo.");
    ids.add(c.id);
  }
  const fids = new Set(),
    imagenes = [];
  let total = 0;
  for (const f of datos.fotos) {
    if (
      !f ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(f.id) ||
      fids.has(f.id) ||
      !ids.has(f.compra_id) ||
      !["factura", "voucher", "otro"].includes(f.clase) ||
      !["image/png", "image/jpeg"].includes(f.tipo) ||
      !/^[a-f0-9]{64}$/.test(f.sha256)
    )
      throw new Error("Un comprobante del respaldo es inválido.");
    fids.add(f.id);
    const contenido = await leer(`imagenes/${f.id}`);
    total += contenido.length;
    if (total > MAX)
      throw new Error("Las imágenes exceden el límite del respaldo.");
    verificarImagen(contenido, f.tipo);
    if (
      (await huella(contenido)) !== f.sha256 ||
      man.archivos[f.id] !== f.sha256
    )
      throw new Error("Un comprobante está alterado.");
    imagenes.push({ foto: f, bytes: contenido });
  }
  if (Object.keys(man.archivos).length !== fids.size)
    throw new Error("El manifiesto de comprobantes no coincide.");
  const antiguas = [];
  for (const c of await repo.compras())
    antiguas.push(...(await repo.fotos(c.id)));
  const staging = [];
  try {
    for (const { foto, bytes: contenido } of imagenes) {
      const ruta = files.ruta(foto.tipo);
      await files.escribir(ruta, contenido);
      staging.push({ ...foto, ruta });
    }
    await repo.reemplazar(datos.compras, staging, datos.encabezado, gestiones);
  } catch (error) {
    await Promise.all(staging.map((f) => files.borrar(f.ruta).catch(() => {})));
    throw new Error(`No se restauró el respaldo: ${error.message}`);
  }
  await Promise.all(antiguas.map((f) => files.borrar(f.ruta).catch(() => {})));
  return { compras: datos.compras.length, fotos: staging.length };
}
