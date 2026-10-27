import { deflateSync } from "node:zlib";
import { PDFRawStream, PDFArray, decodePDFRawStream } from "pdf-lib";
import { huella } from "../src/datos/archivos.js";
const crcTabla = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const trozo = (tipo, datos) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
};
/** PNG gris sintético de ancho × alto, con una banda oscura para distinguirlo. */
export function png(ancho, alto, tono = 200) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(ancho + 1, tono);
    fila[0] = 0;
    if (y % 40 < 6) fila.fill(60, 1);
    filas.push(fila);
  }
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      trozo("IHDR", ihdr),
      trozo("IDAT", deflateSync(Buffer.concat(filas))),
      trozo("IEND", Buffer.alloc(0)),
    ]),
  );
}
export async function fotoDe(id, compraId, bytes, clase = "factura") {
  return {
    id,
    compra_id: compraId,
    ruta: `comprobantes/${id}.png`,
    tipo: "image/png",
    clase,
    sha256: await huella(bytes),
  };
}
/** Archivos en memoria con la misma interfaz que los del dispositivo. */
export function archivosEnMemoria() {
  const m = new Map();
  return {
    m,
    async escribir(ruta, bytes) {
      m.set(ruta, bytes);
    },
    async leer(ruta) {
      if (!m.has(ruta)) throw new Error("Falta un comprobante guardado.");
      return m.get(ruta);
    },
    async borrar(ruta) {
      m.delete(ruta);
    },
    ruta() {
      return `comprobantes/${crypto.randomUUID()}.png`;
    },
  };
}
/** El texto de cada página, en el orden en que se dibujó. */
export function textoDePaginas(doc) {
  return doc.getPages().map((p) => {
    const contenido = p.node.Contents();
    const flujos =
      contenido instanceof PDFArray
        ? contenido.asArray().map((r) => doc.context.lookup(r, PDFRawStream))
        : [contenido];
    return flujos
      .flatMap((s) =>
        [
          ...Buffer.from(decodePDFRawStream(s).decode())
            .toString("latin1")
            .matchAll(/<([0-9A-F]*)> Tj/g),
        ].map((x) => Buffer.from(x[1], "hex").toString("latin1")),
      )
      .map((t) => Buffer.from(t, "latin1").toString("latin1"));
  });
}
export const compraDe = (id, moneda, importe, extra = {}) => ({
  id,
  gestion_id: "gestion-1",
  fecha_compra: "2026-10-21",
  fecha_registro: `2026-10-21T12:00:0${id.length % 10}Z`,
  proveedor: "Proveedor prueba",
  concepto: "Compra prueba",
  importe,
  moneda,
  factura: "0000123",
  estado: "factura",
  ...extra,
});
