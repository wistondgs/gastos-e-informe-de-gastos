import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { abrirRepositorio } from "../datos/abrir.js";
import { archivos } from "../datos/archivos.js";
import {
  informesPrivados,
  informesCompartidos,
} from "../datos/informes-locales.js";
import { crearApi } from "./index.js";
/** La API armada con el almacenamiento real del dispositivo (o del navegador de prueba). */
export async function abrirApi() {
  const repo = await abrirRepositorio();
  const api = crearApi({
    repo,
    files: archivos,
    informesPrivados,
    informesCompartidos,
    version: async () =>
      Capacitor.isNativePlatform() ? (await App.getInfo()).version : null,
  });
  return { api, repo };
}
