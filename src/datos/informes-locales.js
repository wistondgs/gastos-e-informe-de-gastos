import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { base64ABytes, bytesABase64, huella } from "./archivos.js";
export const CARPETA_INFORMES = "Registros de mis gastos";
const ausente = (e) =>
  /not exist|does not exist|not found|no such/i.test(e?.message || "");
export const nombreValido = (nombre) =>
  typeof nombre === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.pdf$/.test(nombre) &&
  !nombre.includes("..");
/**
 * Un almacén de PDF en una carpeta. La app usa dos: el privado (la copia de
 * referencia de cada revisión, en sus archivos propios) y el compartido
 * (Documentos, visible para otras apps). En el navegador de prueba, ambos
 * viven en el almacenamiento local con prefijos distintos.
 */
export function crearAlmacenInformes({
  nativo,
  filesystem,
  storage,
  directorio,
  carpeta,
  prefijo,
}) {
  const ruta = (nombre) => `${carpeta}/${nombre}`;
  const validar = (nombre) => {
    if (!nombreValido(nombre)) throw new Error("Nombre de informe inválido.");
  };
  return {
    carpeta,
    async existe(nombre) {
      validar(nombre);
      if (!nativo) return storage.getItem(prefijo + nombre) !== null;
      try {
        await filesystem.stat({ path: ruta(nombre), directory: directorio });
        return true;
      } catch (e) {
        if (ausente(e)) return false;
        throw e;
      }
    },
    /** Guarda sin pisar: escribe aparte, verifica la huella y recién entonces renombra. */
    async guardar(nombre, bytes) {
      validar(nombre);
      if (!(bytes instanceof Uint8Array) || !bytes.length)
        throw new Error("El informe no es válido.");
      if (await this.existe(nombre))
        throw new Error("Ya existe un informe con ese nombre.");
      if (!nativo) {
        storage.setItem(prefijo + nombre, bytesABase64(bytes));
        return nombre;
      }
      const temporal = `${ruta(nombre)}.tmp`;
      try {
        await filesystem.writeFile({
          path: temporal,
          data: bytesABase64(bytes),
          directory: directorio,
          recursive: true,
        });
        const leido = await filesystem.readFile({
          path: temporal,
          directory: directorio,
        });
        if (
          typeof leido.data !== "string" ||
          (await huella(base64ABytes(leido.data))) !== (await huella(bytes))
        )
          throw new Error("No se pudo verificar el informe guardado.");
        await filesystem.rename({
          from: temporal,
          to: ruta(nombre),
          directory: directorio,
        });
        return nombre;
      } catch (e) {
        await filesystem
          .deleteFile({ path: temporal, directory: directorio })
          .catch(() => {});
        throw new Error(
          `No se pudo guardar el informe en ${carpeta}: ${e.message}`,
        );
      }
    },
    async listar() {
      if (!nativo) {
        const nombres = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k?.startsWith(prefijo) && nombreValido(k.slice(prefijo.length)))
            nombres.push(k.slice(prefijo.length));
        }
        return nombres.sort();
      }
      try {
        const r = await filesystem.readdir({
          path: carpeta,
          directory: directorio,
        });
        return r.files
          .filter((f) => f.type === "file" && nombreValido(f.name))
          .map((f) => f.name)
          .sort();
      } catch (e) {
        if (ausente(e)) return [];
        throw new Error(
          `No se puede abrir la carpeta de informes: ${e.message}`,
        );
      }
    },
    async leer(nombre) {
      validar(nombre);
      const data = nativo
        ? (
            await filesystem.readFile({
              path: ruta(nombre),
              directory: directorio,
            })
          ).data
        : storage.getItem(prefijo + nombre);
      if (typeof data !== "string")
        throw new Error("No se encontró el informe.");
      return base64ABytes(data);
    },
    async borrar(nombre) {
      validar(nombre);
      if (!nativo) storage.removeItem(prefijo + nombre);
      else
        await filesystem.deleteFile({
          path: ruta(nombre),
          directory: directorio,
        });
    },
  };
}
const nativo = Capacitor.isNativePlatform();
export const informesPrivados = crearAlmacenInformes({
  nativo,
  filesystem: Filesystem,
  storage: globalThis.localStorage,
  directorio: Directory.Data,
  carpeta: "informes",
  prefijo: "gastos-informe-privado:",
});
export const informesCompartidos = crearAlmacenInformes({
  nativo,
  filesystem: Filesystem,
  storage: globalThis.localStorage,
  directorio: Directory.Documents,
  carpeta: CARPETA_INFORMES,
  prefijo: "gastos-informe:",
});
