import JSZip from "jszip";
import { huella } from "./archivos.js";
import { validarCompra } from "../dominio/compra.js";
import { validarGestion } from "../dominio/gestion.js";
import { validarCatalogo } from "../dominio/catalogos.js";
import { verificarImagen } from "../dominio/operaciones.js";
import { calcularSaldos, validarParte } from "../dominio/finanzas.js";
import { validarAjusteAnexo } from "../documentos/anexos.js";
import { validarAjustes, VERSION_ESQUEMA } from "./base.js";
import { ESTILOS, PAPELES } from "../dominio/informe.js";
import { TABLAS, conDefectos } from "./tablas.js";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export const MAXIMO_RESPALDO = 150 * 1024 * 1024;
const ID = /^[a-zA-Z0-9-]{1,80}$/;
const HUELLA = /^[a-f0-9]{64}$/;
const sinPdf = {
  leer: async () => {
    throw new Error("sin informes");
  },
  guardar: async (n) => n,
  borrar: async () => {},
  listar: async () => [],
};
/**
 * Respaldo v4: todas las tablas (una copia lógica completa de la base), las
 * fotos originales y las copias privadas de los informes, una sola vez por
 * huella, con un manifiesto verificable. No está cifrado.
 */
export async function crearRespaldo(repo, files, privados = sinPdf) {
  const tablas = await repo.cargarTodo();
  const zip = new JSZip();
  const archivos = {};
  for (const f of tablas.fotos) {
    const bytes = await files.leer(f.ruta);
    verificarImagen(bytes, f.tipo);
    if ((await huella(bytes)) !== f.sha256)
      throw new Error("Un comprobante está alterado; no se creó el respaldo.");
    zip.file(`imagenes/${f.id}`, bytes);
    archivos[`imagenes/${f.id}`] = f.sha256;
  }
  for (const i of tablas.informes) {
    // Las revisiones migradas desde el esquema anterior nunca tuvieron copia
    // privada; una ruta existente, en cambio, obliga a verificarla.
    if (!i.privado) {
      if (i.motor !== 1)
        throw new Error(
          "Falta un informe privado esperado; no se creó el respaldo.",
        );
      continue;
    }
    const ruta = `informes/${i.sha256}.pdf`;
    try {
      const bytes = await privados.leer(i.privado);
      if ((await huella(bytes)) !== i.sha256) throw new Error("alterado");
      zip.file(ruta, bytes);
      archivos[ruta] = i.sha256;
    } catch {
      throw new Error(
        "Falta o está alterado un informe privado; no se creó el respaldo.",
      );
    }
  }
  const json = encoder.encode(
    JSON.stringify({ version: 4, esquema: VERSION_ESQUEMA, tablas }),
  );
  zip.file("datos.json", json);
  zip.file(
    "manifiesto.json",
    JSON.stringify({
      version: 2,
      datos: await huella(json),
      archivos,
      informes_omitidos: [],
    }),
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
async function abrirZip(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAXIMO_RESPALDO)
    throw new Error("El respaldo excede el tamaño permitido.");
  try {
    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files);
    if (entries.length > 20005) throw new Error("Demasiados archivos.");
    let previsto = 0;
    for (const entry of entries) {
      if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name)
        throw new Error("Ruta insegura.");
      if (!entry.dir) {
        const size = entry._data?.uncompressedSize;
        if (!Number.isSafeInteger(size) || size < 0 || size > MAXIMO_RESPALDO)
          throw new Error("Tamaño inválido.");
        previsto += size;
        if (previsto > MAXIMO_RESPALDO) throw new Error("Excede el tamaño.");
      }
    }
    return await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new Error("El respaldo está dañado o no es válido.");
  }
}
/** Lleva un respaldo v1, v2 o v3 a la forma de las tablas actuales. */
function aTablas(datos) {
  if (datos.version === 4) {
    if (datos.esquema > VERSION_ESQUEMA)
      throw new Error(
        "El respaldo es de una versión más nueva de la aplicación.",
      );
    return datos.tablas;
  }
  if (![1, 2, 3].includes(datos.version))
    throw new Error("Versión de respaldo desconocida.");
  const ajustes =
    datos.version === 3 ? datos.ajustes : { encabezado: datos.encabezado };
  return {
    ajustes: Object.entries(validarAjustes(ajustes || {})).map(
      ([clave, valor]) => ({ clave, valor }),
    ),
    gestiones: datos.version >= 2 ? datos.gestiones : [],
    compras: datos.compras,
    fotos: datos.fotos,
    informes: (datos.version === 3 ? datos.informes : []).map((i) => ({
      ...i,
      clave: `gestion:${i.gestion_id}`,
      alcance: JSON.stringify({ tipo: "gestion", gestion_id: i.gestion_id }),
      motor: 1,
      privado: null,
    })),
  };
}
/** Valida cada tabla y las reglas financieras del conjunto. Lanza con el primer problema. */
function validarTablas(t) {
  for (const def of TABLAS) {
    if (t[def.nombre] !== undefined && !Array.isArray(t[def.nombre]))
      throw new Error(`Tabla ${def.nombre} inválida.`);
    t[def.nombre] = (t[def.nombre] || []).map((f) =>
      conDefectos(def.nombre, f),
    );
    const claves = new Set();
    for (const f of t[def.nombre]) {
      const k = f[def.clave || "id"];
      if (typeof k !== "string" || claves.has(k))
        throw new Error(`Registro repetido o sin clave en ${def.nombre}.`);
      claves.add(k);
    }
  }
  validarAjustes(Object.fromEntries(t.ajustes.map((a) => [a.clave, a.valor])));
  t.partes.forEach(validarParte);
  t.catalogos.forEach(validarCatalogo);
  t.gestiones.forEach(validarGestion);
  t.compras.forEach(validarCompra);
  const compras = new Set(t.compras.map((c) => c.id));
  const catalogos = new Map(t.catalogos.map((c) => [c.id, c]));
  for (const u of t.catalogo_usos) {
    const catalogo = catalogos.get(u.catalogo_id);
    if (
      !ID.test(u.id) ||
      !catalogo ||
      catalogo.tipo !== u.tipo ||
      !compras.has(u.compra_id) ||
      typeof u.nombre !== "string" ||
      !u.nombre.trim() ||
      u.nombre.length > 120
    )
      throw new Error("Una referencia de catálogo del respaldo es inválida.");
  }
  for (const f of t.fotos)
    if (
      !ID.test(f.id) ||
      !compras.has(f.compra_id) ||
      !["factura", "voucher", "otro"].includes(f.clase) ||
      !["image/png", "image/jpeg"].includes(f.tipo) ||
      !HUELLA.test(f.sha256)
    )
      throw new Error("Un comprobante del respaldo es inválido.");
  const fotos = new Set(t.fotos.map((f) => f.id));
  for (const a of t.anexos) {
    if (!fotos.has(a.foto_id))
      throw new Error("Un ajuste de anexo apunta a una foto inexistente.");
    validarAjusteAnexo(a);
  }
  const gestiones = new Set(t.gestiones.map((g) => g.id));
  for (const i of t.informes) {
    let modelo = null;
    try {
      modelo = JSON.parse(i.datos);
    } catch {
      /* se rechaza abajo */
    }
    if (
      !ID.test(i.id) ||
      !Number.isSafeInteger(i.revision) ||
      i.revision < 1 ||
      !Object.hasOwn(PAPELES, i.papel) ||
      !ESTILOS.includes(i.estilo) ||
      ![0, 1].includes(i.con_fotos) ||
      !HUELLA.test(i.sha256) ||
      !modelo ||
      (i.gestion_id && !gestiones.has(i.gestion_id))
    )
      throw new Error("Un informe emitido del respaldo es inválido.");
    const ids =
      i.motor === 1
        ? modelo.compras
        : (modelo.filas || []).map((f) => f.compra.id);
    if (!Array.isArray(ids) || ids.some((id) => !compras.has(id)))
      throw new Error("Un informe emitido del respaldo es inválido.");
  }
  calcularSaldos(t);
  return t;
}
/**
 * Restaura sin riesgo: valida todo, prepara los archivos con nombres nuevos,
 * reemplaza la base en una transacción y recién entonces borra lo anterior.
 * Si algo falla, el estado anterior queda intacto.
 */
export async function restaurarRespaldo(
  repo,
  files,
  bytes,
  privados = sinPdf,
  uuid = () => crypto.randomUUID(),
) {
  const zip = await abrirZip(bytes);
  const leer = async (path) => {
    const item = zip.file(path);
    if (!item) throw new Error(`Falta ${path} en el respaldo.`);
    return item.async("uint8array");
  };
  let man, tablas;
  try {
    man = JSON.parse(decoder.decode(await leer("manifiesto.json")));
    const data = await leer("datos.json");
    if ((await huella(data)) !== man.datos)
      throw new Error("La información fue alterada.");
    tablas = aTablas(JSON.parse(decoder.decode(data)));
  } catch (e) {
    throw new Error(`No se pudo validar el respaldo: ${e.message}`);
  }
  if (
    ![1, 2].includes(man.version) ||
    !man.archivos ||
    typeof man.archivos !== "object"
  )
    throw new Error("Versión o estructura de respaldo inválida.");
  validarTablas(tablas);
  // Manifiesto v1: archivos por id de foto; v2: por ruta dentro del ZIP.
  const huellaDe = (ruta, id) =>
    man.version === 1 ? man.archivos[id] : man.archivos[ruta];
  const imagenes = [];
  for (const f of tablas.fotos) {
    const contenido = await leer(`imagenes/${f.id}`);
    verificarImagen(contenido, f.tipo);
    if (
      (await huella(contenido)) !== f.sha256 ||
      huellaDe(`imagenes/${f.id}`, f.id) !== f.sha256
    )
      throw new Error("Un comprobante está alterado.");
    imagenes.push({ foto: f, bytes: contenido });
  }
  const esperadas =
    man.version === 1
      ? Object.keys(man.archivos).length
      : Object.keys(man.archivos).filter((k) => k.startsWith("imagenes/"))
          .length;
  if (esperadas !== tablas.fotos.length)
    throw new Error("El manifiesto de comprobantes no coincide.");
  const pdfs = new Map();
  for (const i of tablas.informes) {
    const ruta = `informes/${i.sha256}.pdf`;
    if (man.version === 1) {
      if (i.privado || i.motor !== 1)
        throw new Error("Falta un informe privado en el respaldo.");
      continue;
    }
    if (!man.archivos[ruta]) {
      if (i.privado || i.motor !== 1)
        throw new Error("Falta un informe privado en el respaldo.");
      continue;
    }
    if (man.archivos[ruta] !== i.sha256)
      throw new Error("La huella de un informe no coincide con el manifiesto.");
    if (!pdfs.has(i.sha256)) {
      const contenido = await leer(ruta);
      if ((await huella(contenido)) !== i.sha256)
        throw new Error("Un informe del respaldo está alterado.");
      pdfs.set(i.sha256, contenido);
    }
  }
  if (man.version === 2) {
    const rutasEsperadas = new Set(
      [...pdfs.keys()].map((h) => `informes/${h}.pdf`),
    );
    const rutasManifestadas = Object.keys(man.archivos).filter((k) =>
      k.startsWith("informes/"),
    );
    const rutasEnZip = Object.keys(zip.files).filter(
      (k) => k.startsWith("informes/") && !zip.files[k].dir,
    );
    if (
      rutasManifestadas.length !== rutasEsperadas.size ||
      rutasEnZip.length !== rutasEsperadas.size ||
      rutasManifestadas.some((r) => !rutasEsperadas.has(r)) ||
      rutasEnZip.some((r) => !rutasEsperadas.has(r))
    )
      throw new Error(
        "El manifiesto de informes no coincide con los archivos.",
      );
  }
  const fotosAnteriores = await repo.todas("fotos");
  const informesAnteriores = await repo.todas("informes");
  const fotosNuevas = [],
    pdfsNuevos = [];
  try {
    for (const { foto, bytes: contenido } of imagenes) {
      const ruta = files.ruta(foto.tipo);
      await files.escribir(ruta, contenido);
      fotosNuevas.push({ ...foto, ruta });
    }
    const informes = [];
    for (const i of tablas.informes) {
      const contenido = pdfs.get(i.sha256);
      if (!contenido) {
        informes.push({ ...i, privado: null });
        continue;
      }
      const nombre = await privados.guardar(
        `${i.id}--${uuid().slice(0, 8)}.pdf`,
        contenido,
      );
      pdfsNuevos.push(nombre);
      informes.push({ ...i, privado: nombre });
    }
    await repo.reemplazarTodo({ ...tablas, fotos: fotosNuevas, informes });
  } catch (error) {
    await Promise.all(
      fotosNuevas.map((f) => files.borrar(f.ruta).catch(() => {})),
    );
    await Promise.all(
      pdfsNuevos.map((n) => privados.borrar(n).catch(() => {})),
    );
    throw new Error(`No se restauró el respaldo: ${error.message}`);
  }
  await Promise.all(
    fotosAnteriores.map((f) => files.borrar(f.ruta).catch(() => {})),
  );
  await Promise.all(
    informesAnteriores
      .filter((i) => i.privado)
      .map((i) => privados.borrar(i.privado).catch(() => {})),
  );
  return {
    compras: tablas.compras.length,
    fotos: fotosNuevas.length,
    informes: tablas.informes.length,
    informes_con_archivo: pdfsNuevos.length,
    movimientos:
      tablas.pagos.length +
      tablas.recepciones.length +
      tablas.movimientos.length,
  };
}
