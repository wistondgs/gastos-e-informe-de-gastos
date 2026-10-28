const CLAVE = "gastos-bloqueo-dispositivo";
export function crearProteccion({ nativo, sistema, storage }) {
  const activa = () => nativo && storage.getItem(CLAVE) === "1";
  async function autenticar() {
    if (!nativo)
      throw new Error("La protección está disponible en el teléfono.");
    const estado = await sistema.checkBiometry();
    if (!estado.deviceIsSecure)
      throw new Error("Configurá un PIN, patrón o contraseña en el teléfono.");
    await sistema.authenticate({
      reason: "Desbloquear Mis gastos",
      title: "Protección de Mis gastos",
      allowDeviceCredential: true,
    });
  }
  return {
    activa,
    autenticar,
    async activar() {
      await autenticar();
      storage.setItem(CLAVE, "1");
    },
    async desactivar() {
      await autenticar();
      storage.removeItem(CLAVE);
    },
  };
}
