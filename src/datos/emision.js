import { huella } from "./archivos.js";
import { instantanea, prepararInforme } from "../dominio/informe.js";
import { informePdf } from "../exportaciones/informe-pdf.js";
/**
 * Emite una revisión nueva: genera el PDF, lo guarda y registra su huella.
 * Si el registro falla, el archivo guardado se borra: no queda un PDF sin revisión.
 */
export async function emitirInforme({
  repo,
  files,
  almacen,
  gestion,
  items,
  opciones,
  ahora = () => new Date(),
  uuid = () => crypto.randomUUID(),
}) {
  const revision = await repo.siguienteRevision(gestion.id);
  const generado = ahora().toISOString();
  const modelo = prepararInforme(gestion, items, {
    ...opciones,
    revision,
    generado,
  });
  const bytes = await informePdf(modelo, files);
  const sha256 = await huella(bytes);
  const archivo = await almacen.guardar(gestion.id, bytes);
  const registro = {
    id: uuid(),
    gestion_id: gestion.id,
    revision,
    codigo: modelo.codigo,
    fecha_corte: opciones.corte,
    generado,
    papel: opciones.papel,
    estilo: opciones.estilo,
    con_fotos: opciones.incluirFotos ? 1 : 0,
    datos: JSON.stringify(instantanea(modelo)),
    sha256,
    archivo,
  };
  try {
    await repo.registrarInforme(registro);
  } catch (e) {
    await almacen.borrar(archivo).catch(() => {});
    throw new Error(`No se registró la revisión: ${e.message}`);
  }
  return { registro, modelo, bytes };
}
/** Reconstruye el modelo de una revisión emitida con lo que se guardó al emitirla. */
export async function modeloDeRevision(repo, registro) {
  const snap = JSON.parse(registro.datos);
  const compras = new Map((await repo.compras()).map((c) => [c.id, c]));
  const items = [];
  for (const id of snap.compras) {
    const compra = compras.get(id);
    if (!compra) throw new Error("Falta una compra de esta revisión.");
    items.push({ compra, fotos: await repo.fotos(id) });
  }
  const gestion = { id: registro.gestion_id, ...snap.gestion };
  const modelo = prepararInforme(gestion, items, {
    titulo: snap.titulo,
    responsable: snap.responsable,
    destinatario: snap.destinatario,
    corte: registro.fecha_corte,
    papel: registro.papel,
    estilo: registro.estilo,
    incluirFotos: registro.con_fotos === 1,
    revision: registro.revision,
    generado: registro.generado,
  });
  for (const m of Object.keys(modelo.totales))
    if ((snap.totales[m] || 0) !== modelo.totales[m].importe)
      throw new Error("Los totales no coinciden con la revisión emitida.");
  return modelo;
}
/** Vuelve a producir el PDF de una revisión y comprueba que sea idéntico al entregado. */
export async function regenerarInforme(repo, files, registro) {
  const bytes = await informePdf(await modeloDeRevision(repo, registro), files);
  if ((await huella(bytes)) !== registro.sha256)
    throw new Error("La copia regenerada no coincide con la revisión emitida.");
  return bytes;
}
/** Estado del archivo guardado de una revisión: verificado, alterado o ausente. */
export async function verificarArchivo(almacen, registro) {
  if (!registro.archivo) return "ausente";
  try {
    const bytes = await almacen.leer(registro.archivo);
    return (await huella(bytes)) === registro.sha256
      ? "verificado"
      : "alterado";
  } catch {
    return "ausente";
  }
}
