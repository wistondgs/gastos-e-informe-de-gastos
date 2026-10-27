import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
const carpeta = "comprobantes";
export const bytesABase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
export const base64ABytes = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export async function huella(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function rutaSegura(ruta) {
  if (!/^comprobantes\/[a-zA-Z0-9-]+\.(jpg|png)$/.test(ruta))
    throw new Error("Ruta de imagen inválida.");
}
export const archivos = {
  async escribir(ruta, bytes) {
    rutaSegura(ruta);
    if (Capacitor.isNativePlatform())
      await Filesystem.writeFile({
        path: ruta,
        data: bytesABase64(bytes),
        directory: Directory.Data,
        recursive: true,
      });
    else localStorage.setItem("foto:" + ruta, bytesABase64(bytes));
  },
  async leer(ruta) {
    rutaSegura(ruta);
    let data;
    if (Capacitor.isNativePlatform())
      data = (
        await Filesystem.readFile({ path: ruta, directory: Directory.Data })
      ).data;
    else data = localStorage.getItem("foto:" + ruta);
    if (typeof data !== "string")
      throw new Error("Falta un comprobante guardado.");
    return base64ABytes(data);
  },
  async borrar(ruta) {
    rutaSegura(ruta);
    if (Capacitor.isNativePlatform())
      await Filesystem.deleteFile({ path: ruta, directory: Directory.Data });
    else localStorage.removeItem("foto:" + ruta);
  },
  ruta(tipo) {
    return `${carpeta}/${crypto.randomUUID()}.${tipo === "image/png" ? "png" : "jpg"}`;
  },
};
export async function compartir(nombre, bytes, tipo) {
  if (Capacitor.isNativePlatform()) {
    const path = `exportaciones/${nombre}`;
    await Filesystem.writeFile({
      path,
      data: bytesABase64(bytes),
      directory: Directory.Cache,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({
      path,
      directory: Directory.Cache,
    });
    await Share.share({
      title: nombre,
      url: uri,
      dialogTitle: "Guardar o compartir archivo",
    });
  } else {
    const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
