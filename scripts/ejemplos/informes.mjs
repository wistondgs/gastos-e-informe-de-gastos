// Ejemplos con datos ficticios, por la API real: node scripts/ejemplos/informes.mjs <comprobantes> <salida>
import { readFileSync, writeFileSync } from "node:fs";
import initSqlJs from "sql.js";
import { adaptarSqlJs } from "../../src/datos/adaptador-sqljs.js";
import { inicializar, repositorio } from "../../src/datos/base.js";
import { crearAlmacenInformes } from "../../src/datos/informes-locales.js";
import { crearApi } from "../../src/api/index.js";
import { huella } from "../../src/datos/archivos.js";
const [origen, salida] = process.argv.slice(2);
const SQL = await initSqlJs();
function almacen() {
  const m = new Map();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
function crear() {
  const db = adaptarSqlJs(SQL, null, () => {});
  const memoria = new Map();
  const files = {
    escribir: async (r, b) => memoria.set(r, b),
    leer: async (r) => memoria.get(r),
    borrar: async (r) => memoria.delete(r),
    ruta: (t) =>
      `comprobantes/${crypto.randomUUID()}.${t === "image/png" ? "png" : "jpg"}`,
  };
  const storage = almacen();
  let t = Date.UTC(2026, 9, 27, 21, 30, 0);
  return inicializar(db).then(() => ({
    api: crearApi({
      repo: repositorio(db),
      files,
      informesPrivados: crearAlmacenInformes({
        nativo: false,
        storage,
        carpeta: "informes",
        prefijo: "p:",
      }),
      informesCompartidos: crearAlmacenInformes({
        nativo: false,
        storage,
        carpeta: "R",
        prefijo: "c:",
      }),
      reloj: () => new Date((t += 60000)),
    }),
  }));
}
const img = (archivo, clase = "factura") => ({
  bytes: new Uint8Array(readFileSync(`${origen}/${archivo}.jpg`)),
  tipo: "image/jpeg",
  clase,
});
const { api } = await crear();
await api.partes.crear({
  id: "winston",
  nombre: "Winston D. Gutiérrez",
  tipo: "persona",
});
await api.partes.crear({
  id: "empresa",
  nombre: "Empresa de ejemplo S.A.",
  tipo: "empresa",
});
await api.partes.crear({
  id: "osman",
  nombre: "Persona de ejemplo",
  tipo: "persona",
});
await api.gestiones.crear({
  id: "5d1c2a90-7b3e-4f11-9a0c-2e6f8b1d4c77",
  nombre: "Winston Managua",
  descripcion: "Compras de la jornada en Managua",
  responsable_id: "winston",
  fecha_inicio: "2026-10-20",
});
await api.gestiones.crear({
  id: "8e2f-segunda",
  nombre: "Visita a Estelí",
  responsable_id: "winston",
  fecha_inicio: "2026-10-24",
});
const G = "5d1c2a90-7b3e-4f11-9a0c-2e6f8b1d4c77";
await api.fondos.recibir({
  fecha: "2026-10-20",
  parte_id: "empresa",
  importe: 1000000,
  moneda: "NIO",
  referencia: "Transferencia 0042",
  aplicaciones: [{ gestion_id: G, destino: "anticipo", importe: 1000000 }],
});
await api.compras.registrar({
  id: "c1",
  gestion_id: G,
  fecha_compra: "2026-10-21",
  concepto: "Compra supermercado",
  proveedor: "Supermercado Ejemplo S.A.",
  importe: 820000,
  moneda: "NIO",
  factura: "0000123",
  estado: "factura",
  forma_pago: "contado",
  asignaciones: [{ parte_id: "empresa", importe: 820000 }],
  pagos: [{ origen: "fondo", parte_id: "empresa", importe: 820000 }],
  imagenes: [img("factura-corta")],
});
await api.compras.registrar({
  id: "c2",
  gestion_id: G,
  fecha_compra: "2026-10-22",
  concepto: "Materiales de la jornada",
  proveedor: "Ferretería Demostración",
  importe: 425075,
  moneda: "NIO",
  factura: "0000124",
  estado: "factura",
  forma_pago: "contado",
  asignaciones: [
    { parte_id: "empresa", importe: 325075 },
    { parte_id: "osman", importe: 100000 },
  ],
  pagos: [
    { origen: "fondo", parte_id: "empresa", importe: 180000, asignacion: 0 },
    { origen: "propio", importe: 145075, asignacion: 0 },
    { origen: "propio", importe: 100000, asignacion: 1 },
  ],
  imagenes: [img("factura-larga"), img("voucher", "voucher")],
});
await api.compras.registrar({
  id: "c3",
  gestion_id: G,
  fecha_compra: "2026-10-23",
  concepto: "Alimentación",
  proveedor: "Restaurante Muestra",
  importe: 8500,
  moneda: "USD",
  factura: "0000125",
  estado: "factura",
  imagenes: [img("recibo-girado")],
});
await api.compras.registrar({
  id: "c4",
  gestion_id: G,
  fecha_compra: "2026-10-24",
  concepto: "Peaje",
  proveedor: "Peaje Carretera Norte",
  importe: 10000,
  moneda: "NIO",
  factura: "",
  estado: "pendiente",
});
await api.compras.registrar({
  id: "c5",
  gestion_id: G,
  fecha_compra: "2026-10-25",
  concepto: "Repuesto a crédito",
  proveedor: "Taller Ejemplo",
  importe: 650000,
  moneda: "NIO",
  factura: "0004410",
  estado: "factura",
  forma_pago: "credito",
  deudor_id: "empresa",
  asignaciones: [{ parte_id: "empresa", importe: 650000 }],
  imagenes: [img("recibo-ancho")],
});
await api.pagos.registrar({
  compra_id: "c5",
  fecha: "2026-10-26",
  importe: 250000,
  origen: "tercero",
  parte_id: "empresa",
});
await api.compras.registrar({
  id: "c6",
  gestion_id: "8e2f-segunda",
  fecha_compra: "2026-10-25",
  concepto: "Combustible",
  proveedor: "Gasolinera Ejemplo",
  importe: 120000,
  moneda: "NIO",
  factura: "0099001",
  estado: "factura",
  forma_pago: "contado",
  asignaciones: [{ parte_id: "empresa", importe: 120000 }],
  pagos: [{ origen: "propio", importe: 120000 }],
});
await api.fondos.recibir({
  fecha: "2026-10-26",
  parte_id: "osman",
  importe: 60000,
  moneda: "NIO",
  aplicaciones: [{ gestion_id: G, destino: "reembolso", importe: 60000 }],
});
// Ajustes de presentación: el recibo girado se endereza; el ancho se recorta.
const f3 = (await api.compras.detalle("c3")).fotos[0];
await api.anexos.ajustar(f3.id, { rotacion: 90 });
const f5 = (await api.compras.detalle("c5")).fotos[0];
await api.anexos.ajustar(f5.id, { recorte: { x: 0, y: 0, w: 1, h: 0.62 } });
const base = {
  titulo: "Rendición de gastos",
  responsable: "Winston D. Gutiérrez",
  corte: "2026-10-27",
};
const ejemplos = [
  [
    "ejemplo-1-gestion-ejecutivo-carta",
    { tipo: "gestion", gestion_id: G },
    {
      ...base,
      destinatario: "Empresa de ejemplo S.A.",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: true,
    },
  ],
  [
    "ejemplo-2-destinatario-formal-a4",
    { tipo: "parte", parte_id: "empresa" },
    {
      ...base,
      destinatario: "Empresa de ejemplo S.A.",
      papel: "a4",
      estilo: "formal",
      incluirFotos: true,
    },
  ],
  [
    "ejemplo-3-varias-gestiones-ejecutivo-a4",
    { tipo: "gestiones", gestion_ids: [G, "8e2f-segunda"] },
    {
      ...base,
      destinatario: "Empresa de ejemplo S.A.",
      papel: "a4",
      estilo: "ejecutivo",
      incluirFotos: false,
    },
  ],
];
let primero;
for (const [nombre, alcance, opciones] of ejemplos) {
  const { informe, bytes } = await api.informes.emitir({ alcance, opciones });
  primero ||= informe;
  writeFileSync(`${salida}/${nombre}.pdf`, bytes);
  console.log(nombre, informe.codigo, informe.sha256.slice(0, 16));
}
writeFileSync(
  `${salida}/ejemplo-excel.xlsx`,
  (await api.informes.excel(primero.id)).bytes,
);
const { bytes: zip } = await api.respaldo.crear();
writeFileSync(`${salida}/ejemplo-respaldo.zip`, zip);
const { api: otro } = await crear();
const r = await otro.respaldo.restaurar(zip);
const regenerado = await otro.informes.regenerar(primero.id);
const iguales = (await huella(regenerado.bytes)) === primero.sha256;
const saldosA = JSON.stringify((await api.saldos.consultar()).saldos);
const saldosB = JSON.stringify((await otro.saldos.consultar()).saldos);
console.log(
  "restauración",
  JSON.stringify(r),
  "regenerado idéntico:",
  iguales,
  "saldos iguales:",
  saldosA === saldosB,
);
for (const s of (await api.saldos.consultar()).saldos)
  console.log(
    "saldo",
    s.tipo,
    s.parte_id,
    s.gestion_id.slice(0, 8),
    s.moneda,
    s.importe,
  );
