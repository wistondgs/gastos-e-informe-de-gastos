// Produce los informes de ejemplo con datos ficticios: node scripts/ejemplos/informes.mjs <comprobantes> <salida>
import { readFileSync, writeFileSync } from "node:fs";
import { prepararInforme } from "../../src/dominio/informe.js";
import { informePdf } from "../../src/exportaciones/informe-pdf.js";
import { informeExcel } from "../../src/exportaciones/informe-excel.js";
import { huella } from "../../src/datos/archivos.js";
const [origen, salida] = process.argv.slice(2);
const memoria = new Map();
const files = { leer: async (ruta) => memoria.get(ruta) };
async function foto(id, compra, archivo, clase = "factura") {
  const bytes = new Uint8Array(readFileSync(`${origen}/${archivo}.jpg`));
  const ruta = `comprobantes/${id}.jpg`;
  memoria.set(ruta, bytes);
  return {
    id,
    compra_id: compra,
    ruta,
    tipo: "image/jpeg",
    clase,
    sha256: await huella(bytes),
  };
}
const gestion = {
  id: "5d1c2a90-7b3e-4f11-9a0c-2e6f8b1d4c77",
  nombre: "Winston Managua",
  fecha_inicio: "2026-10-20",
  fecha_fin: "2026-10-27",
};
const compra = (
  id,
  fecha,
  proveedor,
  factura,
  concepto,
  importe,
  moneda,
  estado = "factura",
) => ({
  id,
  gestion_id: gestion.id,
  fecha_compra: fecha,
  fecha_registro: `${fecha}T15:00:00Z`,
  proveedor,
  concepto,
  importe,
  moneda,
  factura,
  estado,
});
const items = [
  {
    compra: compra(
      "c1",
      "2026-10-21",
      "Supermercado Ejemplo S.A.",
      "0000123",
      "Compra supermercado",
      820000,
      "NIO",
    ),
    fotos: [await foto("f1", "c1", "factura-corta")],
  },
  {
    compra: compra(
      "c2",
      "2026-10-22",
      "Ferretería Demostración",
      "0000124",
      "Combustible y materiales de la jornada",
      425075,
      "NIO",
    ),
    fotos: [
      await foto("f2", "c2", "factura-larga"),
      await foto("f3", "c2", "voucher", "voucher"),
    ],
  },
  {
    compra: compra(
      "c3",
      "2026-10-23",
      "Restaurante Muestra",
      "0000125",
      "Alimentación",
      8500,
      "USD",
    ),
    fotos: [await foto("f4", "c3", "recibo-girado")],
  },
  {
    compra: compra(
      "c4",
      "2026-10-24",
      "Peaje Carretera Norte",
      "",
      "Peaje",
      10000,
      "NIO",
      "pendiente",
    ),
    fotos: [],
  },
  {
    compra: compra(
      "c5",
      "2026-10-25",
      "Taller Ejemplo",
      "0004410",
      "Reparación de llanta",
      65000,
      "NIO",
    ),
    fotos: [],
  },
];
const base = {
  titulo: "Rendición de gastos",
  responsable: "Winston D. Gutiérrez",
  destinatario: "Empresa de ejemplo S.A.",
  corte: "2026-10-27",
  revision: 1,
  generado: "2026-10-27T21:30:00.000Z",
};
const ejemplos = [
  [
    "ejemplo-1-ejecutivo-carta-con-anexos",
    { ...base, papel: "carta", estilo: "ejecutivo", incluirFotos: true },
  ],
  [
    "ejemplo-2-formal-a4-con-anexos",
    { ...base, papel: "a4", estilo: "formal", incluirFotos: true, revision: 2 },
  ],
  [
    "ejemplo-3-ejecutivo-a4-sin-anexos",
    {
      ...base,
      papel: "a4",
      estilo: "ejecutivo",
      incluirFotos: false,
      revision: 3,
      corte: "2026-10-23",
    },
  ],
];
for (const [nombre, o] of ejemplos) {
  const m = prepararInforme(gestion, items, o);
  const bytes = await informePdf(m, files);
  writeFileSync(`${salida}/${nombre}.pdf`, bytes);
  console.log(nombre, m.codigo, (await huella(bytes)).slice(0, 16));
}
writeFileSync(
  `${salida}/ejemplo-excel.xlsx`,
  await informeExcel(
    prepararInforme(gestion, items, {
      ...base,
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: true,
    }),
  ),
);
