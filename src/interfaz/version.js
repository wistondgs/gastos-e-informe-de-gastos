export async function versionInstalada(esNativo, obtenerInfo) {
  if (!esNativo) return "Disponible en la aplicación instalada";
  try {
    const info = await obtenerInfo();
    if (typeof info?.version !== "string" || !info.version.trim())
      throw new Error("Versión ausente");
    return info.version;
  } catch {
    return "No disponible";
  }
}
