import initSqlJs from "sql.js";
import { adaptarSqlJs } from "../src/datos/adaptador-sqljs.js";
import { inicializar, repositorio } from "../src/datos/base.js";
import { crearAlmacenInformes } from "../src/datos/informes-locales.js";
import { crearApi } from "../src/api/index.js";
import { archivosEnMemoria, png } from "./apoyo-informes.js";
export const SQL = await initSqlJs();
export function memoria() {
  const m = new Map();
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
/** Una API completa sobre SQLite (SQL.js) y almacenamiento en memoria. */
export async function entorno({ snapshot = null, reloj } = {}) {
  let persistido = null;
  const db = adaptarSqlJs(SQL, snapshot, (b) => (persistido = b));
  await inicializar(db);
  const repo = repositorio(db);
  const files = archivosEnMemoria();
  const storage = memoria();
  const informesPrivados = crearAlmacenInformes({
    nativo: false,
    storage,
    carpeta: "informes",
    prefijo: "p:",
  });
  const informesCompartidos = crearAlmacenInformes({
    nativo: false,
    storage,
    carpeta: "R",
    prefijo: "c:",
  });
  let t = Date.UTC(2026, 9, 27, 18, 0, 0);
  const api = crearApi({
    repo,
    files,
    informesPrivados,
    informesCompartidos,
    reloj: reloj || (() => new Date((t += 1000))),
  });
  return {
    api,
    repo,
    db,
    files,
    storage,
    informesPrivados,
    informesCompartidos,
    persistido: () => persistido,
  };
}
/** Personas, empresas y una gestión abierta para los escenarios. */
export async function basico(api) {
  const { parte: winston } = await api.partes.crear({
    id: "winston",
    nombre: "Winston Gutiérrez",
    tipo: "persona",
  });
  const { parte: empresa } = await api.partes.crear({
    id: "agricola",
    nombre: "Agrícola de prueba",
    tipo: "empresa",
  });
  const { parte: otra } = await api.partes.crear({
    id: "otra",
    nombre: "Otra empresa de prueba",
    tipo: "empresa",
  });
  const { gestion } = await api.gestiones.crear({
    id: "g1",
    nombre: "Winston Managua",
    responsable_id: "winston",
    fecha_inicio: "2026-10-20",
  });
  return { winston, empresa, otra, gestion };
}
let n = 0;
export const compra = (extra = {}) => ({
  id: `c${++n}`,
  gestion_id: "g1",
  fecha_compra: "2026-10-21",
  concepto: "Compra de prueba",
  proveedor: "Proveedor de prueba",
  importe: 100000,
  moneda: "NIO",
  factura: "0001230",
  estado: "factura",
  ...extra,
});
export const imagen = (clase = "factura", w = 200, h = 300) => ({
  bytes: png(w, h),
  tipo: "image/png",
  clase,
});
export const saldo = (
  saldos,
  tipo,
  parte_id,
  gestion_id = "g1",
  moneda = "NIO",
) =>
  saldos
    .filter(
      (s) =>
        s.tipo === tipo &&
        s.parte_id === parte_id &&
        s.gestion_id === gestion_id &&
        s.moneda === moneda,
    )
    .reduce((t, s) => t + s.importe, 0);
