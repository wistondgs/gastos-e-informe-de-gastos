import { crearRespaldo, restaurarRespaldo } from "../datos/respaldo.js";
export function servicioRespaldo({ repo, files, informesPrivados }) {
  return {
    /** ZIP con la base, las fotos y los informes privados. Sin cifrar: guardalo en un lugar privado. */
    async crear() {
      return {
        bytes: await crearRespaldo(repo, files, informesPrivados),
        cifrado: false,
      };
    },
    /** Reemplaza todo por el respaldo, solo si el respaldo entero es válido. */
    async restaurar(bytes) {
      return restaurarRespaldo(repo, files, bytes, informesPrivados);
    },
  };
}
