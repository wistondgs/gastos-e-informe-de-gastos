/** Suspende el bloqueo solo durante una solicitud de cámara iniciada por la app. */
export function crearSalidaCamara() {
  let pendiente = false;
  return {
    pendiente: () => pendiente,
    async ejecutar(abrir) {
      if (pendiente) throw new Error("La cámara ya está abierta.");
      pendiente = true;
      try {
        return await abrir();
      } finally {
        pendiente = false;
      }
    },
  };
}
