import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { entorno, basico, compra, imagen } from "./apoyo-api.js";
import { textoDePaginas } from "./apoyo-informes.js";
import { prepararCompraFinanciera } from "../src/interfaz/flujo-financiero.js";

test("informes con y sin fotos conservan importes, entradas y obligaciones", async () => {
  const { api } = await entorno();
  await basico(api);
  for (const [id, fecha] of [
    ["uno", "2026-10-21"],
    ["dos", "2026-10-22"],
  ])
    await api.fondos.recibir({
      id,
      fecha,
      parte_id: "agricola",
      importe: 80000,
      moneda: "NIO",
      referencia: id,
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 80000 }],
    });
  await api.compras.registrar(
    prepararCompraFinanciera(
      compra({
        id: "c1",
        importe: 100000,
        imagenes: [imagen(), imagen("voucher")],
      }),
      { tipo: "fondo", parte_id: "agricola", fondo: "1000" },
    ),
  );
  await api.compras.registrar(
    prepararCompraFinanciera(
      compra({ id: "c2", importe: 100000, imagenes: [imagen()] }),
      { tipo: "combinado", parte_id: "agricola", fondo: "600" },
    ),
  );
  const cuenta = (await api.saldos.cuentas()).cuentas.find(
    (c) => c.parte_id === "agricola",
  );
  assert.equal(cuenta.recibido, 160000);
  assert.equal(cuenta.custodia, 0);
  assert.equal(cuenta.por_reembolsar, 40000);
  const documentos = [];
  for (const incluirFotos of [false, true]) {
    const entrada = {
      alcance: { tipo: "gestion", gestion_id: "g1" },
      opciones: {
        titulo: "Prueba",
        responsable: "Juan",
        destinatario: "Empresa de prueba",
        corte: "2026-10-27",
        papel: "carta",
        estilo: "ejecutivo",
        incluirFotos,
      },
    };
    const vista = await api.informes.previsualizar(entrada);
    const emitido = await api.informes.emitir({ ...entrada, exportar: false });
    const pdf = textoDePaginas(await PDFDocument.load(emitido.bytes));
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await api.informes.excel(emitido.informe.id)).bytes);
    documentos.push({ vista, pdf, libro });
  }
  assert.equal(documentos[0].vista.totales.NIO.importe, 200000);
  assert.deepEqual(documentos[0].vista.totales, documentos[1].vista.totales);
  assert.deepEqual(
    documentos[0].vista.financiero,
    documentos[1].vista.financiero,
  );
  assert.equal(
    documentos[0].pdf.flat().some((x) => x.startsWith("ANEXO ")),
    false,
  );
  assert.equal(
    documentos[1].pdf.flat().filter((x) => /^ANEXO \d/.test(x)).length,
    3,
  );
  for (const { pdf, libro } of documentos) {
    const texto = pdf.flat().join(" ");
    for (const valor of [
      "2,000.00",
      "1,600.00",
      "400.00",
      "21/10/2026",
      "22/10/2026",
    ])
      assert.ok(texto.includes(valor), valor);
    assert.ok(!texto.includes("MOVIMIENTOS VIGENTES AL CORTE"));
    const filas = [];
    libro.getWorksheet("Recepciones").eachRow((f, n) => {
      if (n > 1) filas.push(f.getCell(4).value);
    });
    assert.deepEqual(filas, [800, 800]);
  }
});

test("el logotipo elegido queda en la revisión y no cambia su copia al emitir otra", async () => {
  const { api, repo } = await entorno();
  await basico(api);
  const { bytesABase64 } = await import("../src/datos/archivos.js");
  const logo = `data:image/png;base64,${bytesABase64(imagen().bytes)}`;
  const entrada = {
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: {
      titulo: "Informe",
      responsable: "Juan",
      destinatario: "Empresa",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: false,
      logotipo: logo,
    },
    exportar: false,
  };
  const primero = await api.informes.emitir(entrada);
  const guardado = await repo.una("informes", primero.informe.id);
  assert.equal(JSON.parse(guardado.datos).opciones.logotipo, logo);
  await api.informes.emitir({
    ...entrada,
    opciones: { ...entrada.opciones, logotipo: null },
  });
  assert.deepEqual(
    (await api.informes.abrir(primero.informe.id)).bytes,
    primero.bytes,
  );
  const respaldo = await api.respaldo.crear();
  const destino = await entorno();
  await destino.api.respaldo.restaurar(respaldo.bytes);
  assert.equal(
    JSON.parse((await destino.repo.una("informes", primero.informe.id)).datos)
      .opciones.logotipo,
    logo,
  );
  assert.deepEqual(
    (await destino.api.informes.abrir(primero.informe.id)).bytes,
    primero.bytes,
  );
  await assert.rejects(
    api.informes.previsualizar({
      ...entrada,
      opciones: { ...entrada.opciones, logotipo: "data:image/png;base64,@@" },
    }),
  );
});
