import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, compra, imagen } from "./apoyo-api.js";
import { huella } from "../src/datos/archivos.js";
import { pdf } from "../src/exportaciones/informes.js";
import {
  PDFDocument,
  PDFRawStream,
  PDFArray,
  decodePDFRawStream,
} from "pdf-lib";

test("ajustes al registrar sobreviven al respaldo y conservan la foto original", async () => {
  const origen = await entorno();
  await basico(origen.api);
  const foto = imagen();
  const ajuste = {
    rotacion: 90,
    enderezar: 2,
    recorte: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  };
  await origen.api.compras.registrar(
    compra({ id: "editada", imagenes: [{ ...foto, ajuste }] }),
  );
  const detalle = await origen.api.compras.detalle("editada");
  assert.equal(detalle.anexos.length, 1);
  assert.equal(detalle.anexos[0].rotacion, 90);
  const original = await origen.api.comprobantes.original(detalle.fotos[0].id);
  assert.equal(await huella(original.bytes), await huella(foto.bytes));
  const respaldo = (await origen.api.respaldo.crear()).bytes;
  const destino = await entorno();
  await destino.api.respaldo.restaurar(respaldo);
  const restaurado = await destino.api.compras.detalle("editada");
  assert.equal(restaurado.anexos[0].rotacion, 90);
  assert.deepEqual(JSON.parse(restaurado.anexos[0].recorte), ajuste.recorte);
  assert.equal(
    await huella(
      (await destino.api.comprobantes.original(restaurado.fotos[0].id)).bytes,
    ),
    await huella(foto.bytes),
  );
});

test("el PDF individual aplica la transformación y no altera el original", async () => {
  const e = await entorno();
  await basico(e.api);
  const foto = imagen();
  await e.api.compras.registrar(compra({ id: "individual", imagenes: [foto] }));
  const d = await e.api.compras.detalle("individual");
  const original = await pdf(d.compra, d.fotos, e.files, "Informe", []);
  await e.api.anexos.ajustar(d.fotos[0].id, {
    rotacion: 90,
    enderezar: 0,
    recorte: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  });
  const cambiado = await e.api.compras.detalle("individual");
  const editado = await pdf(
    cambiado.compra,
    cambiado.fotos,
    e.files,
    "Informe",
    cambiado.anexos,
  );
  const matriz = async (bytes) => {
    const doc = await PDFDocument.load(bytes);
    const contenido = doc.getPages()[1].node.Contents();
    const flujos =
      contenido instanceof PDFArray
        ? contenido.asArray().map((r) => doc.context.lookup(r, PDFRawStream))
        : [contenido];
    return flujos
      .map((s) =>
        Buffer.from(decodePDFRawStream(s).decode()).toString("latin1"),
      )
      .join("\n")
      .match(/[-.\d]+ [-.\d]+ [-.\d]+ [-.\d]+ [-.\d]+ [-.\d]+ cm/g);
  };
  assert.notDeepEqual(await matriz(original), await matriz(editado));
  assert.equal(
    await huella((await e.api.comprobantes.original(d.fotos[0].id)).bytes),
    await huella(foto.bytes),
  );
});
