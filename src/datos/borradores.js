// Todas las instancias que usan la misma base comparten el orden de operaciones.
const colas = new WeakMap();
/** Borradores locales separados de la base financiera; admite fotos como bytes. */
export function crearBorradores(
  idb = globalThis.indexedDB,
  nombre = "gastos-borradores",
) {
  if (!colas.has(idb)) colas.set(idb, new Map());
  const porNombre = colas.get(idb);
  if (!porNombre.has(nombre)) porNombre.set(nombre, Promise.resolve());
  const abrir = () =>
    new Promise((resolve, reject) => {
      const solicitud = idb.open(nombre, 1);
      solicitud.onupgradeneeded = () =>
        solicitud.result.createObjectStore("borradores");
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
    });
  const ejecutar = (modo, accion) => {
    const siguiente = porNombre.get(nombre).then(async () => {
      const db = await abrir();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction("borradores", modo);
          const solicitud = accion(tx.objectStore("borradores"));
          let resultado;
          solicitud.onsuccess = () => {
            resultado = solicitud.result;
          };
          tx.oncomplete = () => resolve(resultado ?? null);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () =>
            reject(tx.error || new Error("No se guardó el borrador."));
        });
      } finally {
        db.close();
      }
    });
    porNombre.set(
      nombre,
      siguiente.catch(() => {}),
    );
    return siguiente;
  };
  return {
    guardar: (tipo, datos) => ejecutar("readwrite", (t) => t.put(datos, tipo)),
    obtener: (tipo) => ejecutar("readonly", (t) => t.get(tipo)),
    descartar: (tipo) => ejecutar("readwrite", (t) => t.delete(tipo)),
  };
}
