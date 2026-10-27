import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { base64ABytes, bytesABase64, huella } from "./archivos.js";
export const CARPETA_INFORMES = "Registros de mis gastos";
const PREFIX = "informe-gestion-";
const ausente = (e) =>
  /not exist|does not exist|not found|no such/i.test(e?.message || "");
const ordenar = (nombres) =>
  nombres.sort(
    (a, b) =>
      b.split("--")[1].localeCompare(a.split("--")[1]) || b.localeCompare(a),
  );
function nombreValido(nombre) {
  return (
    typeof nombre === "string" &&
    /^informe-gestion-[a-zA-Z0-9-]{1,80}--\d{8}T\d{6}--[a-zA-Z0-9-]{1,80}\.pdf$/.test(
      nombre,
    )
  );
}
export function crearAlmacenInformes({
  nativo,
  filesystem,
  storage,
  uuid = () => crypto.randomUUID(),
  ahora = () => new Date(),
}) {
  const key = "gastos-informe:";
  const ruta = (nombre) => `${CARPETA_INFORMES}/${nombre}`;
  return {
    async guardar(gestionId, bytes) {
      if (
        !/^[a-zA-Z0-9-]{1,80}$/.test(gestionId) ||
        !(bytes instanceof Uint8Array) ||
        !bytes.length
      )
        throw new Error("El informe no es válido.");
      const fecha = ahora().toISOString().replace(/[-:]/g, "").slice(0, 15);
      const nombre = `${PREFIX}${gestionId}--${fecha}--${uuid()}.pdf`;
      if (!nombreValido(nombre))
        throw new Error("El nombre del informe no es válido.");
      if (!nativo) {
        if (storage.getItem(key + nombre) !== null)
          throw new Error("Ya existe un informe con ese nombre.");
        storage.setItem(key + nombre, bytesABase64(bytes));
        return nombre;
      }
      const temporal = `${ruta(nombre)}.tmp`;
      try {
        let existe = false;
        try {
          await filesystem.stat({
            path: ruta(nombre),
            directory: Directory.Documents,
          });
          existe = true;
        } catch (e) {
          if (!ausente(e)) throw e;
        }
        if (existe) throw new Error("Ya existe un informe con ese nombre.");
        await filesystem.writeFile({
          path: temporal,
          data: bytesABase64(bytes),
          directory: Directory.Documents,
          recursive: true,
        });
        const leido = await filesystem.readFile({
          path: temporal,
          directory: Directory.Documents,
        });
        if (
          typeof leido.data !== "string" ||
          (await huella(base64ABytes(leido.data))) !== (await huella(bytes))
        )
          throw new Error("No se pudo verificar el informe guardado.");
        await filesystem.rename({
          from: temporal,
          to: ruta(nombre),
          directory: Directory.Documents,
        });
        return nombre;
      } catch (e) {
        await filesystem
          .deleteFile({ path: temporal, directory: Directory.Documents })
          .catch(() => {});
        throw new Error(
          `No se pudo guardar el informe en Documentos/${CARPETA_INFORMES}: ${e.message}`,
        );
      }
    },
    async listar() {
      if (!nativo) {
        const nombres = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k?.startsWith(key) && nombreValido(k.slice(key.length)))
            nombres.push(k.slice(key.length));
        }
        return ordenar(nombres);
      }
      let result;
      try {
        result = await filesystem.readdir({
          path: CARPETA_INFORMES,
          directory: Directory.Documents,
        });
      } catch (e) {
        if (ausente(e)) return [];
        throw new Error(
          `No se puede abrir la carpeta de informes: ${e.message}`,
        );
      }
      return ordenar(
        result.files
          .filter((f) => f.type === "file" && nombreValido(f.name))
          .map((f) => f.name),
      );
    },
    async leer(nombre) {
      if (!nombreValido(nombre)) throw new Error("Nombre de informe inválido.");
      const data = nativo
        ? (
            await filesystem.readFile({
              path: ruta(nombre),
              directory: Directory.Documents,
            })
          ).data
        : storage.getItem(key + nombre);
      if (typeof data !== "string")
        throw new Error("No se encontró el informe.");
      return base64ABytes(data);
    },
  };
}
export const informesLocales = crearAlmacenInformes({
  nativo: Capacitor.isNativePlatform(),
  filesystem: Filesystem,
  storage: globalThis.localStorage,
});
